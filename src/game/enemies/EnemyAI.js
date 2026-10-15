import { distance, normalize, randomBetween } from "../math.js";
import { BEHAVIOR, CREATURE_TYPES } from "../../data/enemies/index.js";
import { habilidadesDe } from "./telegraphSkills.js";

const STUCK_THRESHOLD = 0.45;
const STUCK_SIDESTEP = 0.55;
const STUCK_COOLDOWN = 0.8;
const ARRIVE_EPSILON = 14;
const RETURN_ARRIVE = 20;
const RETURN_MARGIN = 20;
const RETARGET_INTERVAL = 0.35;

/**
 * O VAO QUE UM MOB DEIXA PARA O OUTRO.
 *
 * ## O QUE ISTO RESOLVE
 *
 * O `isPositionFree` do colisor e uma parede DURA: o passo e bloqueado se
 * a nova posicao cair dentro de `radius + radius` de outro mob. Com sete
 * ogres correndo para o mesmo jogador, os seis de tras ficam presos no
 * primeiro, empilham, e o desenho mostra a animacao de andar com o
 * personagem parado
 *
 * O espaco extra de 34% abaixo da soma dos raios e o que vira a parede
 * em "todos cabem". Nao deixa sobrepor, entao continua parecendo solido,
 * mas da para um bicho contornar o outro em vez de ficar parado esperando
 * ele morrer
 *
 * ## POR QUE 1.34 E NAO MAIS
 *
 * Acima de ~1.5 os mobes param de se encostar e a arena vira roda de
 * bicho. Abaixo de ~1.2 eles voltam a empilhar. A janela e estreita de
 * proposito: e o minimo que faz a multidao andar
 */
const SEPARATION_FACTOR = 1.34;

/**
 * ATE ONDE A SEPARACAO EMPURRA.
 *
 * Alem disso o mob ate o alvo empurra a multidao inteira na direcao
 * errada: um ogre no fundo da sala giraria o grupo em vez de chegar
 */
const SEPARATION_RANGE = 120;

/**
 * O quanto a separacao pesa contra a direcao do alvo.
 *
 * O valor e grande de proposito. Com 0.4 o mob vencia a multidao e
 * atravessava os outros; a separacao precisa ganhar do alvo, senao o
 * primeiro da fila e o unico que chega
 */
const SEPARATION_WEIGHT = 1.15;

/**
 * O SETOR DE CADA MOB AO REDOR DO ALVO.
 *
 * ## POR QUE EXISTE
 *
 * Todo mundo mira no PONTO do jogador, entao sete ogres tentam ocupar a
 * mesma circunferencia de raio `attackRange`. Seis ficam fora do alcance
 * e ficam empurrando para sempre
 *
 * Cada mob recebe um angulo proprio, derivado do id, e persegue um ponto
 * girado em torno do alvo. Com angulos diferentes, todos entram no
 * alcance ao mesmo tempo e todos batem â€” o que e o que o jogador espera
 * de uma briga contra um grupo
 *
 * O angulo nao e sorteado: e o hash do id. Dois ogres nunca pegam o
 * mesmo setor, e a distribuicao nao muda entre quadros nem entre sessoes
 */
const SLOT_COUNT = 8;
const SLOT_SWEEP = Math.PI * 2;

/**
 * A TOLERANCIA DE GOLPE NA MULTIDAO.
 *
 * ## A GEOMETRIA NAO DEIXA
 *
 * N criaturas de raio `r` em volta de um ponto ficam todas na mesma
 * distancia `r_eq = 2r / (2 * sin(pi/N))`. Para oito ogres de raio 32 isso
 * da 84px â€” e o alcance de golpe deles e 78. Nao ha posicao em que os
 * oito alcancem: e area de circunferencia, nao opcao de tuning
 *
 * ## O QUE A TOLERANCIA FAZ
 *
 * Um mob que chegou na borda da multidao, travado pelos sete vizinhos e
 * a 6px do alcance, bate em vez de esperar. A folga e metade do proprio
 * raio: o bastante para o anel de oito caber, e pequenao ponto de um
 * mob BATENDO de fora do alcance dele ficar absurdo
 *
 * E por isso que a tolerancia e do RAAIO e nao um numero solto: ela
 * cresce com o bicho. Um ogre grande tolera mais que um limo, que e o que
 * a leitura visual espera
 */
const TOLERANCIA_MULTIDAO = 0.5;

/** o alcance de golpe, com a folga da multidao */
function alcanceEfetivo(enemy) {
  return (
    (enemy.attackRange ?? 44) +
    (enemy.radius ?? 20) * TOLERANCIA_MULTIDAO
  );
}

/** o angulo de um mob em torno do alvo, derivado do id */
function anguloDoSlot(enemy) {
  let soma = 0;

  const id = String(enemy.id ?? enemy.typeId ?? "?");

  for (let i = 0; i < id.length; i += 1) {
    soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  }

  return (soma % SLOT_COUNT) * (SLOT_SWEEP / SLOT_COUNT);
}

/** o ponto que o mob persegue: o alvo girado no angulo do seu setor */
function pontoDoSetor(enemy, target) {
  const angulo = anguloDoSlot(enemy);

  const distancia = (enemy.attackRange ?? 44) * 0.72;

  return {
    x: target.x + Math.cos(angulo) * distancia,
    y: target.y + Math.sin(angulo) * distancia,
  };
}

/**
 * A MENOR FOLGA ACEITA, para uma criatura que declara `teleportaParaCasa`
 * sem dar um numero proprio.
 *
 * E o piso do campo: um chefe que declarasse `teleportaParaCasa: 0` ainda
 * precisa de um respiro, senao ele cruza a linha da pedra, volta, e cruza
 * de novo — um chefe tremendo na borda, que e o defeito que a regra veio
 * corrigir. Quem escreve o campo no catalogo escolhe o valor; este so
 * garante que nao exista zero
 */
const RESET_PROP_FOLGA_MINIMA = 40;

/**
 * O CHEFE ENCOSTOU NUMA PROP?
 *
 * E o guarda de `updateBehavior`: devolve `true` e forca o `updateReturn`
 *
 * ## POR QUE UM CAMPO NO CATALOGO, E NAO UM `instanceof`
 *
 * Porque a regra e do CHEFE, e o catalogo e o lugar onde uma criatura
 * declara como ela se comporta. `teleportaParaCasa` e o nome do campo, e o
 * que ele carrega e a DISTANCIA de deteccao: o numero de pixels a que o
 * chefe precisa chegar de uma prop bloqueante para voltar. Sem o campo, a
 * regra valeria para os sete bichos de cada zona do mapa — e nenhum deles
 * precisa dela, porque nenhum passeia longe o bastante para encostar numa
 * pedra
 *
 * ## POR QUE `blocking`, E NAO TODA PROP
 *
 * Porque uma prop decorativa nao barra o caminho. O `blocking: false` e o
 * que separa "isto e um obstaculo" de "isto e um enfeite", e o chefe so
 * precisa fugir do primeiro
 *
 * ## E POR QUE PERCORRE A LISTA INTEIRA
 *
 * Porque sao 40 pedras neste mapa e UM chefe. Um indice espacial seria 40
 * linhas de construcao para trocar um `for` de 40 comparacoes que roda uma
 * vez por tick — e so quando ha chefe de prop vivo, porque o guarda do
 * campo e o primeiro `if` e retorna antes de qualquer coisa
 *
 * ## E DE ONDE VEM A LISTA: `world.map.props`, E NAO `world.props`
 *
 * Porque `world` e o estado COMUM entre jogadores, e ele nao tem lista de
 * props: cada mapa tem o seu, em `mapContexts`, e sao 40 no vale contra 0
 * na arena e 0 no hub. O `world.map` e trocado no `setMap` e aponta para o
 * contexto que o `CollisionSystem` do jogador esta usando — entao a prop que
 * esta na lista e a prop que esta no chao, sem chance de o motor estar
 * olhando para o mapa errado
 *
 * Ler `world.props` aqui daria `undefined` em TODO mapa, e a regra
 * devolveria `false` sempre: um chefe que nunca respeita prop nenhuma. Foi
 * o que a primeira versao fez
 *
 * ## E A SOMA: CHEFE MAIS PEDRA MAIS FOLGA
 *
 * O `radius` do chefe e a metade da arte dele, e o da prop e o alcance que
 * a pedra tem. Os dois juntos sao o ponto em que os desenhos ja se cruzam;
 * a folga e o quanto o chefe se permite chegar antes de mudar de ideia
 */
function resetouPorProp(world, enemy) {
  if (!enemy.teleportaParaCasa) return false;

  const props = world?.map?.props;

  if (!props?.length) return false;

  const alcance = Math.max(
    enemy.teleportaParaCasa,
    RESET_PROP_FOLGA_MINIMA,
  );

  for (const prop of props) {
    if (!prop.blocking) continue;

    const raioTotal =
      (enemy.radius ?? 0) + (prop.radius ?? 0) + alcance;

    if (distance(enemy, prop) < raioTotal) return true;
  }

  return false;
}

/**
 * HAI ALGUM JOGADOR DENTRO DA `aggroRange`?
 *
 * E a pergunta que decide a VELOCIDADE do retorno, e ela e diferente de
 * `isAggressive` de proposito
 *
 * ## POR QUE NAO REUSAR O `isAggressive`
 *
 * Porque o `isAggressive` responde "ele esta lutando agora", e esse aqui
 * responde "tem alguem perto". Sao coisas diferentes no momento exato em
 * que a importa:
 *
 * - um chefe pode estar `alerted` por causa do `stuck`, ou seja, sem ninguem
 *   por perto — o `isAggressive` diz `true` e o retorno andaria devagar
 * - um chefe pode estar dentro do `aggroRange` mas sem estar em combate,
 *   porque o alvo esta atras de uma pedra — o `isAggressive` ja mudou de
 *   assunto e o retorno nao precisaria ser rapido
 *
 * A pergunta crua — ha alguem dentro do `aggroRange`? — e a que descreve o
 * que o jogador ve: "o chefe esta voltando sozinho e rapido" so faz
 * sentido quando nao tem ninguem ali para brigar
 *
 * ## E O `retalia` DO PASSIVO NAO ENTRA AQUI
 *
 * Porque um passivo sem alvo travado e um bicho parado, e um bicho parado
 * nao esta "voltando para casa": ele nunca saiu. A velocidade de retorno so
 * interessa para quem esta de fato se deslocando para o ponto de origem
 */
function temAlvoNaRange(ai, enemy) {
  const alvo = ai.nearestPlayer(enemy);

  if (!alvo) return false;

  return distance(enemy, alvo) <= enemy.aggroRange;
}

/**
 * O CHEFE ESTA EXECUTANDO UMA HABILIDADE?
 *
 * ## E POR QUE A TRAVA EXISTE
 *
 * Porque a secao 6 do pedido diz: "a IA nao deve selecionar uma nova
 * habilidade enquanto o boss estiver executando uma acao incompativel". Sem
 * isto, o `ground_slam` de 1.8s de preparo seria interrompido por um
 * `cleave` de 1.2s assim que o cooldown permitisse, e o primeiro telegraph
 * sumiria do chao no meio do preenchimento
 *
 * ## E O QUE NAO TRAVA
 *
 * O `retreating`. Um chefe voltando para casa nao esta executando uma
 * habilidade: ele esta andando. Se a trava valesse para o retorno, o chefe
 * ficaria esperando o telegraph anterior terminar para poder fugir
 */
function chefeEstaOcupado(enemy) {
  const execucao = enemy.telegraphAtivo;

  if (!execucao) return false;

  // o telegraph dele, e nao o de outro chefe
  return enemy.habilidadesTelegraph === true;
}

/**
 * ESCOLHE E COMECA UMA HABILIDADE DE CHEFE.
 *
 * ## O ORDEM DA ESCOLHA, E POR QUE E ESTA
 *
 * A lista de candidatas ja vem filtrada por fase e por cooldown. A ordem de
 * escolha nao e "a primeira disponivel" — e por ORDEM DE PERIGO, do maior
 * raio para o menor, dentro da faixa de distancia aceitavel
 *
 * E porque um chefe com duas habilidades na range deve usar a MAIOR primeiro:
 * o `ground_slam` de raio 260 e o `cleave` de 300x90graus sao areas
 * parecidas em tamanho, mas o slam cobre em volta e o cone so a frente. O
 * jogador que ve o cone sabe desviar para tras; o que ve o circulo so pode
 * sair andando. O circulo primeiro e o que impede o chefe de gastar a
 * briga inteira em golpes que o jogador ja sabe desviar
 *
 * ## E POR QUE O ALVO DO `marked_strike` E O MAIS PROXIMO
 *
 * Porque o `marked_strike` e marcado no JOGADOR, e nao no chefe. Se usasse
 * o alvo travado, a marca cairia num jogador que ja saiu da briga e o
 * ataque viraria no ar
 */
export function escolherHabilidadeDeChefe(enemy, jogador, agora) {
  const candidatas = habilidadesDe(enemy);

  if (!candidatas.length) return null;

  const distancia = distance(enemy, jogador);

  // filtra por fase, cooldown e distancia
  const viaveis = candidatas.filter((hab) => {
    /**
     * A ABERTURA NAO ENTRA NA DISPUTA NORMAL.
     *
     * E o que faz ela ser "o primeiro golpe" e nao "um golpe com cooldown
     * zero". Sem esta linha, `cooldown: 0` a faria ser escolhida em TODO
     * quadro em que a boss esta em combate — nao no primeiro contato, e
     * sim sempre, com o disco de raio 300 renascendo sem parar
     *
     * Quem chama a abertura e o `tentarHabilidadeDeChefe`, na borda da
     * aggro, e so uma vez por briga
     */
    if (hab.abertura) return false;

    if ((enemy.fase ?? 1) < (hab.faseMin ?? 1)) return false;

    if ((enemy.cooldownsTelegraph?.[hab.id] ?? 0) > agora) return false;

    if (distancia < hab.distanciaMin) return false;

    return distancia <= hab.distanciaMax;
  });

  if (!viaveis.length) return null;

  // a de maior area primeiro
  viaveis.sort((a, b) => areaDe(b) - areaDe(a));

  return viaveis[0];
}

/**
 * A AREA DE UMA HABILIDADE, e so para ordenar a escolha.
 *
 * ## POR QUE NAO USAR O `raio` SO
 *
 * Porque as cinco habilidades nao tem o mesmo campo: o `cone` tem `alcance`,
 * o `anel` tem `raioExterno`, e a `line` tem `alcance` e `largura`. Sem uma
 * funcao que normaliza, o `sort` compararia `undefined` com numeros e a
 * ordem viraria indefinida — e a ordem da lista e o que decide qual golpe
 * sai
 */
function areaDe(hab) {
  switch (hab.tipo) {
    case "circle":
    case "targeted":
      return Math.PI * hab.raio * hab.raio;

    case "ring":
      return Math.PI * (hab.raioExterno ** 2 - hab.raioInterno ** 2);

    case "cone":
      return 0.5 * hab.alcance * hab.alcance * (hab.anguloGraus * Math.PI / 180);

    case "line":
    case "charge":
      return hab.alcance * hab.largura;

    default:
      return 0;
  }
}

/**
 * O JOGADOR ESTA CRUZANDO A BORDA DA AGGRO NESTE QUADRO?
 *
 * E a DIFFERENCA ENTRE "esta dentro" e "acabou de entrar", e sao coisas
 * muito diferentes para uma abertura
 *
 * ## POR QUE PRECISA DA BORDA, E NAO SO DA DISTANCIA
 *
 * Porque o chefe fica parado no centro enquanto ninguem chega. Se a
 * abertura disparasse em "esta dentro da range", ela dispararia no PRIMEIRO
 * quadro em que a IA roda — que e com o jogador parado no mapa, longe — e
 * gastaria o golpe de abertura no ar
 *
 * ## E O QUE FAZ A BORDA SER UMA SO VEZ
 *
 * A borda e um evento de subida: o jogador estava fora, esta dentro. No
 * quadro seguinte ele ja estava dentro no quadro anterior, entao a borda
 * nao repete. E a trava `aberturaFeita` fecha a porta de vez, porque a
 * abertura e uma vez por briga e nao uma vez por aproximacao
 */
function cruzouBordaDaAggro(enemy, jogador) {
  const dentro = distance(enemy, jogador) <= enemy.aggroRange;

  const estavaDentro = enemy.dentroDaAggroAnterior === true;

  enemy.dentroDaAggroAnterior = dentro;

  return dentro && !estavaDentro;
}

/**
 * A HABILIDADE DE ABERTURA de uma criatura, ou `null`.
 *
 * E a que tem `abertura: true` no catalogo. Ela e procurada pelo marcador e
 * nao pelo id, porque o id e o que o jogador ve no nome da habilidade e o
 * marcador e o que a IA usa
 */
function aberturaDe(enemy) {
  const candidatas = habilidadesDe(enemy);

  for (const hab of candidatas) {
    if (hab.abertura) return hab;
  }

  return null;
}

export class EnemyAI {
  constructor(world, { onDamagePlayer, onShootPlayer } = {}) {
    this.world = world;
    this.onDamagePlayer = onDamagePlayer ?? (() => {});

    // atirador: quem cria a flecha e o motor, nao a IA. aqui so
    // chega o "agora atira neste alvo"
    this.onShootPlayer = onShootPlayer ?? (() => {});
  }

  get player() {
    return this.world.player;
  }

  /**
   * Todos os jogadores online, em UM array reaproveitado.
   *
   * Este getter e lido TRES vezes por inimigo por tique â€” `updateAlert`,
   * `isAggressive` e `updateCombat` chamam `nearestPlayer`, que le aqui.
   * A versao anterior devolvia `[...map.values()].map(...)`: um array
   * novo e um objeto por jogador, 3 vezes por mob. Com 93 mobs do mapa 1
   * e 50 jogadores online, sao 279 arrays por tique por mapa â€” 5.580/s
   * so para materializar uma lista que nao muda
   *
   * A lista so muda quando alguem entra ou sai, e quem sabe disso e o
   * `GameServer`. Entao o array e montado uma vez e invalidado pelo
   * `invalidatePlayers`, e o `nearestPlayer` passou a percorrer o `Map`
   * direto â€” assim nem chega a precisar da lista
   */
  get players() {
    if (this.world.players?.size) {
      if (!this._players) {
        this._players = [...this.world.players.values()].map(
          (session) => session.player,
        );
      }

      return this._players;
    }

    // o array de um jogador so tambem pode ser reaproveitado: e o
    // `world.player` virando lista toda vez que o foco muda
    if (!this._playerUnico) this._playerUnico = [];

    if (this.world.player) {
      this._playerUnico[0] = this.world.player;
      this._playerUnico.length = 1;
    } else {
      this._playerUnico.length = 0;
    }

    return this._playerUnico;
  }

  /**
   * Esquece a lista de jogadores.
   *
   * O `GameServer` chama quando alguem entra ou sai do mundo. Sem isso
   * a lista ficaria congelada com quem ja saiu
   */
  invalidatePlayers() {
    this._players = null;
  }

  /**
   * O jogador que este inimigo esta perseguindo: o mais proximo.
   *
   * Devolve `null` quando nao ha ninguem no mapa. Isso acontece
   * de verdade: e o instante entre o ultimo jogador sair e o
   * proximo entrar. Sem o `null` explicito, `distance(enemy,
   * null)` leria `x` de `null` e derrubaria o laco do servidor
   * inteiro, nao so este mob.
   *
   * No single player nunca e `null`, entao o comportamento nao
   * muda. Online, o inimigo so persegue o mais proximo: senao ele
   * ignoraria o resto da partida e pareceria travado de costas.
   */
  /**
   * O jogador mais proximo, sem alocar nada.
   *
   * Percorre o `Map` de sessoes direto em vez de passar pelo `players`,
   * porque aqui a lista nao e preciso: so interessa o minimo. Com o
   * `players` no meio, cada chamada ainda materializava o array
   *
   * A distancia e comparada AO QUADRADO. `distance` faz `Math.hypot`,
   * que e uma chamada nativa cara, e a ordem dos dois jogadores nao
   * muda comparando quadrados: se `a` esta mais perto que `b`, `aÂ²` e
   * menor que `bÂ²` para as duas distancias nao negativas
   */
  nearestPlayer(enemy) {
    let best = null;
    let bestSquared = Infinity;

    const sessoes = this.world.players;

    /**
     * UM JOGADOR MORTO NAO E ALVO.
     *
     * Sem este filtro, o slime que matou o jogador continua perseguindo
     * e atacando o cadaver: o `DamageSystem` recusa o dano (a linha 66
     * ve `hp <= 0`), mas o mob continua se movendo em direcao a ele e
     * gastando o cooldown do golpe. O resultado era um aglomerado de
     * bicho andando em circulo em cima do corpo, e no multiplayer cada
     * jogador vivo puxava a turma de volta â€” a partida inteira virava
     * um grupo de mob andando em cima de um morto
     *
     * E o filtro e o MESMO `estaDePe` que o resto da IA usa. Se este
     * `hp > 0` e o `estaDePe` divergirem, o comportamento mais curto
     * ganha, e a divergencia so aparece como um mob que segue um cadaver
     */
    if (sessoes?.size) {
      for (const sessao of sessoes.values()) {
        const player = sessao.player;

        if (!this.estaDePe(player)) continue;

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;

        const squared = dx * dx + dy * dy;

        if (squared < bestSquared) {
          bestSquared = squared;
          best = player;
        }
      }

      return best;
    }

    const player = this.world.player;

    if (player && this.estaDePe(player)) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;

      if (dx * dx + dy * dy < bestSquared) best = player;
    }

    return best;
  }

  update(enemy, deltaTime) {
    if (!enemy.isCreature && !enemy.duelo) return;

    enemy.attackAnimation = Math.max(
      0,
      enemy.attackAnimation - deltaTime,
    );

    enemy.attackCooldownRemaining = Math.max(
      0,
      enemy.attackCooldownRemaining - deltaTime,
    );

    if (!enemy.alive) {
      enemy.aiState = "dead";
      return;
    }

    // O boneco de duelo tem a regra DELA, e nao a de mob: trava no
    // primeiro agressor, nao vagueia e nao volta para casa. Sem
    // este desvio antes do `updateAlert`, ele usaria o alerta por
    // `aggroRange` e trocaria de alvo pelo mais proximo
    if (enemy.duelo) {
      this.updateDuel(enemy, deltaTime);
      return;
    }

    /**
     * O PASSIVO RETALIANDO, que tem a regra do duelo mas o tuning dele.
     *
     * O `enemy` no terceiro argumento e o que faz a diferenca: o boneco
     * usa `DUEL_DUMMY` (speed 96, alcance 70), e o esqueleto usa os
     * numeros do proprio catalogo. Sem o argumento, o esqueleto andaria a
     * 96px e bateria de 70 de longe
     *
     * ## E SO COM ALVO TRAVADO, SEMPRE
     *
     * Porque sem alvo a criatura volta a ser o PASSIVO de antes: fora
     * dele, `updateDuel` so faria `aiState = "idle"` e a criatura
     * PARARIA de passear. O `if` exige `enemy.targetId`, entao quem
     * vagueia e `updateBehavior`, e quem persegue e a regra de retaliaÃ§Ã£o
     */
    if (enemy.retalia && enemy.targetId) {
      this.updateDuel(enemy, deltaTime, enemy);
      return;
    }

    this.updateAlert(enemy, deltaTime);
    this.updateBehavior(enemy, deltaTime);
  }

  /**
   * A regra do boneco de duelo.
   *
   * Fica em duelo ate um dos dois morrer: ele trava em quem bateu
   * primeiro, vai ate la, bate, e NAO troca de alvo nem se um
   * jogador mais perto aparecer na frente. So quando o alvo morre
   * (ou sai) o agro passa para quem estiver batendo nele naquele
   * instante; sem ninguem batendo, o boneco volta a ficar parado.
   *
   * Quem trava e o `provoke`, e nao aqui: e no golpe que se sabe
   * QUEM bateu. Aqui so se resolve o que fazer com essa informacao.
   */
  updateDuel(enemy, deltaTime, tuning = enemy.duelo) {
    if (!enemy.targetId) {
      enemy.aiState = "idle";
      return;
    }

    const alvo = this.playerById(enemy.targetId);

    // O alvo morreu ou saiu. O agro vai para quem esta batendo
    // AGORA, e e a unica troca de alvo da regra
    if (!alvo || !this.estaDePe(alvo)) {
      const proximo = enemy.lastHitById
        ? this.playerById(enemy.lastHitById)
        : null;

      if (
        proximo &&
        this.estaDePe(proximo) &&
        proximo.id !== enemy.targetId
      ) {
        enemy.targetId = proximo.id;
      } else {
        // ninguem para bater: o boneco destrava e volta a ser alvo
        // fixo, do jeito que estava antes do primeiro golpe
        enemy.targetId = null;
        enemy.aiState = "idle";
        return;
      }
    }

    const alvoAtual = this.playerById(enemy.targetId);

    if (!alvoAtual) {
      enemy.targetId = null;
      enemy.aiState = "idle";
      return;
    }

    const distancia = distance(enemy, alvoAtual);

    enemy.facing = normalize(
      alvoAtual.x - enemy.x,
      alvoAtual.y - enemy.y,
    );

    if (distancia <= tuning.attackRange) {
      enemy.aiState = "attack";
      this.tryAttack(
        enemy,
        distancia,
        alvoAtual,
        tuning,
      );

      return;
    }

    // SEM recuo e SEM `leash`: o boneco vai ate o fim. A regra
    // pedida e ir ate o outro, e um boneco que desistisse no meio do
    // campo por causa da `leash` do mob estaria se comportando como
    // mob
    enemy.aiState = "chase";

    this.moveToward(
      enemy,
      alvoAtual,
      deltaTime,
      tuning.speed,
    );
  }

  /**
   * O jogador ainda esta de pe.
   *
   * A entidade do jogador NAO tem `alive`: a morte dele e `hp <= 0`.
   * Usar `alive` aqui dava `undefined`, que e falso, e o boneco
   * soltava o alvo no primeiro tick e voltava a ficar parado com o
   * agro apontado para o jogador
   */
  estaDePe(player) {
    return player.hp > 0;
  }

  /** O jogador online com este id, ou `null`. */
  playerById(id) {
    if (!id) return null;

    for (const player of this.players) {
      if (player.id === id) return player;
    }

    return null;
  }

  provoke(enemy, attacker = null) {
    // o boneco de duelo e provoke por qualquer golpe, mesmo sem o
    // `behavior` de mob, e o `attacker` e o que define o alvo
    if (enemy.duelo) {
      this.provocarDuelo(enemy, attacker);
      return;
    }

    if (!enemy.isCreature) return;

    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      /**
       * O PASSIVO QUE RETALIA.
       *
       * O `return` que estava aqui era a barreira: um PASSIVO nao guarda
       * quem o bateu, entao nunca revidava. A criatura com `retalia` usa
       * a MESMA trava de alvo do boneco de duelo â€” quem bateu primeiro e
       * o alvo, e so troca se esse morrer
       *
       * Sem este desvio o `slime` seria o unico PASSIVO que ataca, e o
       * `if` de baixo continuaria sendo a regra dos outros
       */
      if (enemy.retalia) {
        this.provocarDuelo(enemy, attacker);
      }

      return;
    }

    if (!enemy.provoked) {
      enemy.provoked = true;
      enemy.alerted = true;

      /**
       * O CHAMADO DOS COMPANHEIROS, e ele fica AQUI DENTRO.
       *
       * ## POR QUE DENTRO DO `if` E NAO DEPOIS
       *
       * Porque este bloco so roda na PRIMEIRA vez que a criatura e basicida.
       * Fora dele, cada soco puxaria dois aliados de novo — e como os ja
       * provocados sao pulados pela varredura, a segunda pancada acabaria
       * acordando o bando inteiro, um a um
       *
       * ## E POR QUE SO NO `SEMI_PASSIVE`
       *
       * Porque um `PASSIVE` nunca luta: o `provoke` dele ja voltou antes de
       * marcar qualquer coisa. O `SEMI_PASSIVE` e o unico que aceita o
       * `provoked` e mesmo assim fica parado ate levar pancada — que e
       * exatamente o bando de goblin
       */
      if (enemy.behavior === BEHAVIOR.SEMI_PASSIVE) {
        this.puxarAliados(enemy);
      }
    }
  }

  /**
   * ACORDA OS COMPANHEIROS MAIS PROXIMOS, quando a criatura permite.
   *
   * ## O QUE ESTE METODO FAZ, E O QUE NAO FAZ
   *
   * Ele MARCA os outros como provocados, e nada mais. Ele nao escolhe alvo,
   * nao teleporta, nao muda posicao e nao mexe em cooldown. O caminho e o
   * mesmo de levar pancada: um aliado marcado fica agressivo pelo
   * `isAggressive` do `SEMI_PASSIVE`, que devolve `enemy.provoked`
   *
   * E por isso que o alvo dos aliados sai correto sem codigo aqui: eles
   * seguem a mesma regra de mira que seguiram se tivessem sido acertados
   *
   * ## POR QUE OS DOIS CAMPOS SAO LIDOS DO CATALOGO, E NAO DA INSTANCIA
   *
   * Porque `alertarAliados` e `raioDoAlerta` sao configuracao de ESPECIE, e
   * nao estado. O `typeId` da criatura diz de que tipo ela e, e o catalogo
   * diz o que aquele tipo faz. Ler do catalogo evita a duvida de o campo ter
   * chegado ou nao na instancia, e mantem uma fonte de verdade so
   *
   * ## E POR QUE UM SO `sqrt` POR PAR
   *
   * O filtro de distancia e no QUADRADO, que e comparacao de multiplicacao,
   * e o `sqrt` so acontece para quem ja passou no corte. O laco de separacao
   * de duas linhas abaixo diz o mesmo coisa e o mesmo motivo: e o laco mais
   * caro do servidor, e um `Math.hypot` em cada par custa caro demais
   */
  puxarAliados(enemy) {
    const tipo = CREATURE_TYPES[enemy.typeId];

    const quantos = tipo?.alertarAliados ?? 0;

    if (!(quantos > 0)) return;

    const raio = tipo?.raioDoAlerta ?? 0;

    // sem raio nao ha chamado: a lista viraria "todo goblin do mapa"
    if (!(raio > 0)) return;

    const raioSquared = raio * raio;

    /**
     * OS CANDIDATOS, e a ordem importa.
     *
     * O pedido e "os DOIS mais proximos", entao a distancia decide quem
     * entra — nao a ordem da lista, que e a de spawn. Guardar so o melhor e
     * o segundo melhor numa varredura e o que faz isso valer com qualquer
     * quantidade de goblins em volta
     */
    let primeiro = null;
    let segundo = null;
    let primeiroDist = Infinity;
    let segundoDist = Infinity;

    for (const outro of this.world.enemies) {
      if (outro === enemy) continue;
      if (outro.alive === false) continue;
      if (outro.isCreature !== true) continue;

      /**
       * SO DA MESMA ESPECIE.
       *
       * E o que impede um goblin de acordar um ghoul. Sem esta linha um
       * bando de duas especies acordaria inteiro, e o ghoul — que tambem e
       * `SEMI_PASSIVE` — entraria na briga sem o jogador ter visto nada
       */
      if (outro.typeId !== enemy.typeId) continue;

      // ja estava brigando: conta-lo de novo gastaria uma das duas vagas
      if (outro.provoked) continue;

      const dx = enemy.x - outro.x;
      const dy = enemy.y - outro.y;

      const distanciaSquared = dx * dx + dy * dy;

      if (distanciaSquared >= raioSquared) continue;

      if (distanciaSquared < primeiroDist) {
        segundo = primeiro;
        segundoDist = primeiroDist;

        primeiro = outro;
        primeiroDist = distanciaSquared;
      } else if (distanciaSquared < segundoDist) {
        segundo = outro;
        segundoDist = distanciaSquared;
      }
    }

    /**
     * OS ESCOLHIDOS, e o `quantos` cortando a lista.
     *
     * E aqui que `alertarAliados: 2` e lido de verdade: a varredura sempre
     * guarda o melhor e o segundo melhor, e o `slice` e o que faz
     * `alertarAliados: 1` acordar um so, sem um segundo `if` para cada valor
     * possivel
     *
     * `alerted` alem de `provoked` porque e o par que o `provoke` escreve. Um
     * aliado marcado so por `provoked` se comportaria diferente do outro em
     * qualquer codigo que leia os dois
     *
     * E o `alerted` e o que segura o chamado em cascata: o `puxarAliados` nao
     * e chamado por aliado, e so pelo `provoke` de um golpe. Se algum dia ele
     * passar a ser chamado daqui, um goblin acordaria dois, cada um acordaria
     * dois, e o mapa inteiro viraria um
     */
    const escolhidos = [primeiro, segundo].filter(Boolean).slice(0, quantos);

    for (const aliado of escolhidos) {
      aliado.provoked = true;
      aliado.alerted = true;
    }
  }

  /**
   * O primeiro golpe trava o alvo, e nao o primeiro a estar perto.
   *
   * E a diferenca entre "vai ate quem bateu" e "vai ate o mais
   * proximo": o boneco tem `aggroRange: Infinity`, entao ele
   * reagiria a qualquer um no mapa. Quem trava e o primeiro a
   * encostar.
   */
  provocarDuelo(enemy, attacker) {
    if (!attacker?.isPlayer) return;

    // o ultimo a bater e sempre lembrado: e o proximo alvo quando o
    // atual morrer
    enemy.lastHitById = attacker.id;

    // JA TRAVADO: nao troca. E o que o jogador pediu, e o que
    // diferencia o boneco de todo mob do jogo
    if (enemy.targetId) return;

    enemy.targetId = attacker.id;
    enemy.provoked = true;
    enemy.alerted = true;
  }

  updateAlert(enemy, deltaTime) {
    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      enemy.alerted = false;
      return;
    }

    /**
     * O SEMI_PASSIVE CORRE A MESMA REGRA DE CORDA, E ANTES NAO CORRIA.
     *
     * Este `return` e o que fazia um goblinersistir agressivo para sempre
     * depois de levar um unico soco: o `isAggressive` do `SEMI_PASSIVE` devolve
     * `enemy.provoked`, e nada limpava esse `provoked`. Nao por fuga, nao por
     * tempo, nao por distancia. O bando inteiro que acordou com o primeiro
     * golpe ia atras do jogador ate o fim do mapa
     *
     * ## POR QUE A CORDA DELE E `max(leash, aggroRange) * 1,6`
     *
     * E a mesma conta do mob ativo, e ela e a conta certa aqui: o
     * `aggroRange` do goblin e ZERO (e por isso ele nunca ve ninguem), entao
     * o que manda e a `leash` de 620. Com o fator de 1,6 o goblin desiste
     * quando o jogador passa de 992px — perto o bastante para ele nao
     * desistir no meio da luta, longe o bastante para uma fuga de verdade
     * acalmar o bando
     *
     * ## E POR QUE O `PASSIVE` CONTINUA SAINDO ANTES
     *
     * Porque um passivo nao tem `provoked` para limpar nem corda para
     * esticar: ele nunca luta. O `alerted = false` e so para nao sobrar
     * estado de um comportamento que ele nunca assume
     */
    if (enemy.alerted) {
      enemy.aiTimer += deltaTime;

      const leash = enemy.leash;
      const alvo = this.nearestPlayer(enemy);

      // sem alvo nao ha para onde esticar a corda. o mob volta a
      // ficar calmo em vez de comparar a distancia com `null`
      if (!alvo) {
        enemy.alerted = false;
        enemy.provoked = false;
        return;
      }

      if (
        distance(enemy, alvo) >
        Math.max(leash, enemy.aggroRange) * 1.6
      ) {
        enemy.alerted = false;
        enemy.provoked = false;
      }
    }
  }

  isAggressive(enemy) {
    /**
     * O CHEFE QUE JA DECIDIU VOLTAR NAO VOLTA A PERSEGUIR.
     *
     * E o `retreating` funcionando. Sem esta linha o ciclo era de um quadro:
     * a `leash` dispara, o `updateReturn` da um passo na direcao de casa, e
     * no quadro seguinte o `isAggressive` ve o jogador ainda perto e reacende
     * o `alerted` — o chefe dava meia-volta, logo voltava a correr atras, e
     * isso se repetia a 60 quadros por segundo
     *
     * O sintoma na tela era um chefe tremendo na borda do mapa: ele nao
     * estava parado por falta de passo, estava oscilando entre dois estados
     * que discordavam do que ele devia fazer
     *
     * A trava so se abre quando ele chega em casa — ver o `updateReturn`,
     * que limpa o campo quando `distance(enemy, home) < RETURN_ARRIVE`
     */
    if (enemy.retreating) return false;

    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      /**
       * O PASSIVO SO E AGRESSIVO COM ALVO TRAVADO.
       *
       * `false` fixo era o que mantinha o limo quieto. Com `retalia`, a
       * agressividade nao vem de `aggroRange` nem de `alerted` â€” vem de
       * existir alguem na lista de quem o bateu. Sem isso o esqueleto
       * atacaria o primeiro jogador que aparecesse no `aggroRange`, que e
       * `0` e por isso nunca chegaria a atacar ninguem
       */
      return Boolean(enemy.retalia && enemy.targetId);
    }

    if (enemy.behavior === BEHAVIOR.SEMI_PASSIVE) {
      return enemy.provoked;
    }

    if (enemy.alerted || enemy.provoked) {
      return true;
    }

    const alvo = this.nearestPlayer(enemy);

    // ninguem no mapa: ninguem para provocar
    if (!alvo) return false;

    if (
      distance(enemy, alvo) <= enemy.aggroRange
    ) {
      enemy.alerted = true;
      enemy.aiTimer = 0;
      return true;
    }

    return false;
  }


  /**
 * O CHEFE PREPARA UMA HABILIDADE, se couber uma agora.
 *
 * ## O QUE ESTE METODO FAZ, EM ORDEM
 *
 * 1. se o chefe ja tem um telegraph correndo, mantem o estado e devolve `true`
 *    (ele esta ocupado, e a trava e o que impede duas preparacoes)
 * 2. se nao e um chefe de telegraph, devolve `false` e o combate normal roda
 * 3. se ele esta voltando para casa, devolve `false` — o `retreating` vem
 *    antes e ja cortou o caminho
 * 4. escolhe a habilidade, aplicando o cooldown, e comeca a execucao
 *
 * ## E O QUE ELE NAO FAZ
 *
 * Ele nao aplica dano. O dano sai do `TelegraphSystem` no instante do
 * impacto, e nao aqui. A separacao e o que garante que o jogador veja o
 * telegraph inteiro antes de levar dano
 */
tentarHabilidadeDeChefe(enemy, deltaTime) {
  // 1. ja esta occupied?
  if (chefeEstaOcupado(enemy)) {
    enemy.aiState = "attack";
    return true;
  }

  // 2. e um chefe de telegraph?
  if (!enemy.habilidadesTelegraph) return false;

  // 3. o relogio do motor, que e o mesmo que o do impacto
  const agora = this.world.time ?? 0;

  const jogador = this.nearestPlayer(enemy);

  // sem ninguem, nao ha para quem mirar nem o que escalar
  if (!jogador) return false;

  /**
   * O JOGADOR PRECISA ESTAR NA AGGRO.
   *
   * E o filtro que faltava, e ele e a correcao de um defeito real: o
   * `charge` aceita de 250 a 800px, entao com o jogador a 760 — que e
   * EXATAMENTE onde o vale faz o jogador nascer, 760px abaixo do centro —
   * a habilidade passava o filtro de distancia e o chefe disparava um golpe
   * de investida com ninguem na range
   *
   * ## POR QUE ISTO E UM `return false`, E NAO UM FILTRO
   *
   * Porque nenhuma habilidade deveria ser escolhida para um alvo fora da
   * range de agro. A `distanciaMax` de cada uma e sobre o ALCANCE do
   * golpe (o quanto a area cobre), e nao sobre a distancia de APPROXIMACAO.
   * Sao numeros de coisas diferentes: o `energy_beam` tem `distanciaMax: 900`
   * porque o feixe e longo, e o `ground_slam` tem 340 porque o circulo e
   * curto. Misturar os dois deixava o chefe golpear de longe
   */
  if (distance(enemy, jogador) > enemy.aggroRange) return false;

  /**
   * A ABERTURA, e ela tem prioridade sobre a escolha normal.
   *
   * ## E POR QUE NAO PASSA PELO FILTRO DE COOLDOWN
   *
   * Porque este e o primeiro golpe da briga e ele nao pode falhar por causa
   * de um cooldown: no primeiro quadro em que o jogador entra na range, todo
   * cooldown esta zerado e a escolha normal ja pegaria alguma coisa — mas
   * pegaria a de MAIOR AREA, que e o `ground_slam` de raio 260, e nao a
   * abertura de raio 300 com dano reduzido
   *
   * A trava `aberturaFeita` e o que garante uma vez so. Ela e marcada
   * ANTES de comecar, porque se fosse depois o `onIniciarTelegraph` poderia
   * devolver `null` (motor sem o sistema) e a trava ficaria armada para
   * tentar de novo no proximo quadro
   */
  if (!enemy.aberturaFeita && cruzouBordaDaAggro(enemy, jogador)) {
    const abertura = aberturaDe(enemy);

    if (abertura) {
      enemy.aberturaFeita = true;

      if (this.comecarHabilidade(enemy, abertura, agora, jogador)) {
        return true;
      }

      // o motor nao aceitou: destrava para nao ficar preso sem abertura
      enemy.aberturaFeita = false;
    }
  }

  const habilidade = escolherHabilidadeDeChefe(enemy, jogador, agora);

  // 4. nenhuma habilidade cabe agora: segue o combate normal
  if (!habilidade) return false;

  return this.comecarHabilidade(enemy, habilidade, agora, jogador);
}

/**
 * COMECA UMA HABILIDADE: cooldown, trava, execucao e o virado do chefe.
 *
 * ## POR QUE ESTE TRECHO SAIU DO METODO ACIMA
 *
 * Porque a abertura e a escolha normal faziam EXATAMENTE a mesma coisa
 * depois do ponto em que cada uma escolheu a habilidade: marcar o cooldown,
 * travar o chefe, pedir a execucao ao motor e virar o corpo. Sao 20 linhas
 * duplicadas, e a duplicacao era o jeito de um dos dois caminhos ficar sem
 * uma das etapas
 *
 * O retorno e `false` quando o motor nao aceitou a execucao, e quem chamou
 * decide o que fazer: a abertura destrava, a escolha normal devolve `false`
 * e o combate comum continua
 */
comecarHabilidade(enemy, habilidade, agora, jogador) {
  /**
   * O COOLDOWN E MARCADO AQUI, no inicio da preparacao, e nao no impacto.
   *
   * E o que impede o chefe de spamming: se o cooldown so fosse marcado no
   * impacto, ele comecaria a proxima no mesmo quadro em que a anterior
   * terminou, e o jogador veria um telegraph novo nascer no mesmo instante
   * em que o outro some
   */
  enemy.cooldownsTelegraph = enemy.cooldownsTelegraph ?? {};
  enemy.cooldownsTelegraph[habilidade.id] =
    agora + habilidade.cooldown;

  // a trava: enquanto o telegraph corre, o chefe nao escolhe outro
  enemy.telegraphAtivo = true;

  const execucao = this.world.telegraphs
    ? this.world.onIniciarTelegraph?.(
      enemy,
      habilidade,
      agora,
      jogador,
    )
    : null;

  // se o motor nao tem o sistema ligado, a trava nao pode ficar presa
  if (!execucao) {
    enemy.telegraphAtivo = false;
    return false;
  }

/**
     * O CHEFE VIRA PARA O ALVO no instante da preparacao.
     *
     * E aqui, e nao no `TelegraphSystem`, porque a orientacao e do corpo do
     * chefe: um cone que sai para a esquerda enquanto o chefe olha para a
     * direita e um telegraph mentindo
     */
    enemy.facing = normalize(
      jogador.x - enemy.x,
      jogador.y - enemy.y,
    );

  // o chefe fica parado durante a preparacao: e a janela do jogador
  enemy.aiState = "attack";

  return true;
}

updateBehavior(enemy, deltaTime) {
    /**
     * O CHEFE QUE ENCOSTOU NUMA PROP VOLTA PARA CASA.
     *
     * E o `updateReturn` sendo chamado antes de qualquer outro raciocinio â€”
     * antes do `isAggressive`, antes do combate, antes do passeio. O chefe
     * que encosta numa pedra nao persegue, nao ataca e nao passeia: ele volta
     *
     * ## POR QUE ISSO E DO CHEFE, E NAO DE TODA CRIATURA
     *
     * Porque o pedido e do chefe do centro do vale, e o motivo e o
     * `wanderRadius` de 340 dele. Um mob comum passeia em 70 e nunca chega
     * perto de prop nenhuma; o chefe do vale sai do centro, e o anel de
     * pedras comeca a 1100px do centro â€” entao ele CRUZA a linha das pedras
     * com o passeio, e o que estava la e uma parede solida de 139x180
     *
     * Sem esta regra o chefe fica empurrando ooze contra uma pedra que ele
     * nao atravessa, e o `stuck` do colisor vira um chefe tremendo no lugar
     *
     * ## E POR QUE VOLTAR, E NAO TELEPORTAR
     *
     * Porque `updateReturn` e o caminho que o jogo ja tem para "volta para
     * casa", e ele e o mesmo que a `leash` usa. O chefe volta andando, o
     * jogador ve ele se afastando, e a luta nao perde um quadro. Um
     * teleporte aqui zeraria a perseguicao no meio do golpe e o chefe
     * reapareceria no centro do nada
     */
    if (resetouPorProp(this.world, enemy)) {
      this.updateReturn(enemy, deltaTime);

      return;
    }

    /**
     * O CHEFE COM TELEGRAPH TEM PRIORIDADE SOBRE O COMBATE COMUM.
     *
     * E antes do `isAggressive` porque a decisao de habilidade e a
     * INTENCAO da acao: enquanto um telegraph esta correndo, o chefe nao
     * persegue, nao ataca e nao passeia. E ele quem escolhe entre as cinco
     * habilidades
     *
     * ## E POR QUE `tentarHabilidadeDeChefe` DEVOLVE UM BOOLEANO
     *
     * Porque "nenhuma habilidade cabe agora" e "uma habilidade comecou" sao
     * respostas diferentes, e o motor precisa das duas: a primeira segue
     * para o combate normal de proximity, a segunda sai do `updateBehavior`
     * sem nada mais
     */
    if (this.tentarHabilidadeDeChefe(enemy, deltaTime)) {
      return;
    }

    if (!this.isAggressive(enemy)) {
      const home = {
        x: enemy.spawnX,
        y: enemy.spawnY,
      };

      const restRadius =
        (enemy.wanderRadius ?? 60) + RETURN_MARGIN;

      if (distance(enemy, home) > restRadius) {
        this.updateReturn(enemy, deltaTime);
        return;
      }

      /**
       * JA ESTA EM CASA: a trava do `retreating` abre.
       *
       * O `updateReturn` so limpa a trava quando o chefe chega a menos de
       * `RETURN_ARRIVE` (20px) do ponto exato. Mas ele so continua no
       * `updateReturn` enquanto estiver FORA do `restRadius` (aqui, 360px) —
       * dentro dele o `updateBehavior` desvia para o `updateIdle`, e o
       * `updateIdle` nao conhece a trava
       *
       * O efeito era um chefe parado em casa com `retreating: true` para
       * sempre: ele nao perseguia mais (a trava segurava o `isAggressive`),
       * mas tambem nao reagia a ninguem. Um chefe morto em vida
       *
       * Aqui e o lugar certo de abrir: dentro do `restRadius` o chefe JA
       * voltou ao posto, que e o que a trava representa. Abrir aqui e
       * deixar o `updateReturn` cuida do resto nao deixa buraco
       */
      enemy.retreating = false;

      this.updateIdle(enemy, deltaTime, restRadius);
      return;
    }

    this.updateCombat(enemy, deltaTime);
  }

  updateCombat(enemy, deltaTime) {
    const player = this.nearestPlayer(enemy);

    // o jogador desconectou entre o `isAggressive` e aqui. sem
    // este retorno o `distance` abriria o `null`
    if (!player) return;

    /**
     * A `leash` E VERIFICADA ANTES DE TUDO, e antes do golpe.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * A checagem vivia DEPOIS do `if (toPlayer <= alcanceEfetivo(enemy))`,
     * e esse `if` tem um `return` dentro. Um chefe no limite com o jogador
     * dentro do alcance do golpe entrava por ali, atacava e saia — sem nunca
     * chegar na linha da `leash`
     *
     * Pior: a linha da `leash` fazia `enemy.alerted = false`, e o
     * `isAggressive` comeca por `if (enemy.alerted || enemy.provoked)`. Um
     * chefe que ja estava `alerted` ficava agressivo para sempre. Resultado
     * na tela: o chefe seguia o jogador ate a borda do mapa e ali ficava
     * batendo nele, travado, sem nunca voltar
     *
     * ## E A DISTANCIA MEDIDA E A DO CHEFE, E NAO A DO JOGADOR
     *
     * A conta antiga era `distance(spawn, player)`: o quanto a BRIGA andou
     * para longe de casa. O que a `leash` restringe e o CHEFE. Sao coisas
     * diferentes no momento em que importa — com o jogador parado dentro do
     * circulo de casa e o chefe do lado dele depois de uma colisao, a conta do
     * jogador nao disparava e o chefe ficava fora do posto para sempre
     *
     * ## E POR QUE AGORA MARCA `retreating`
     *
     * Porque sem isso o retorno so dura UM quadro. O `updateReturn` anda
     * na direcao de casa, e no quadro seguinte o `isAggressive` ve o jogador
     * ainda dentro da `aggroRange`, reacende o `alerted` e o chefe volta a
     * perseguir — dois estados brigando pelo mesmo quadro, que e o mesmo
     * defeito do `wanderTarget` velho descrito no `updateReturn`
     *
     * O `retreating` e a trava: enquanto ele estiver ligado, o chefe nao
     * volta a ser agressivo ate chegar em casa
     */
    const distanciaDaCasa = distance(enemy, {
      x: enemy.spawnX,
      y: enemy.spawnY,
    });

    const distanciaDoJogadorDaCasa = distance(
      { x: enemy.spawnX, y: enemy.spawnY },
      player,
    );

    if (
      enemy.behavior === BEHAVIOR.ACTIVE &&
      !enemy.provoked &&
      (distanciaDaCasa > enemy.leash ||
        distanciaDoJogadorDaCasa > enemy.leash)
    ) {
      enemy.alerted = false;
      enemy.retreating = true;

      /**
       * A VOLTA POR `leash` E RAPIDA MESMO COM O JOGADOR PERTO.
       *
       * O `updateReturn` tem dois的速度: o normal, quando ha alvo na
       * `aggroRange`, e o `velocidadeDeRetorno`, quando nao ha. Esta volta
       * e o segundo caso — o jogador esta COLADO no chefe e o `
       * temAlvoNaRange` responderia `true`, e o chefe voltaria a 82 devagar,
       * tremendo na borda do mapa ate chegar em casa
       *
       * E o sintoma reportado: o chefe no limite, o jogador em cima dele, e
       * o chefe andando devagar de volta com o jogador do lado. Numa borda
       * de mapa, "devagar" e "travado"
       *
       * A trava `retreating` garante que ele chegue: enquanto andar para
       * casa, nao reacende o `alerted`, e nao ha mais oscilacao
       */
      enemy.velocidadeDeRetornoForcada = true;
      this.updateReturn(enemy, deltaTime);
      enemy.velocidadeDeRetornoForcada = false;

      return;
    }

    const toPlayer = distance(enemy, player);

    // O atirador NAO encosta. Se o jogador chega perto demais, ele
    // da um passo para tras em vez de ficar parado no lugar levando
    // pancada de perto: a arte dele e um arco, e um arco a 40px nao
    // faz sentido nenhum.
    //
    // O `updateBehavior` ja so chega aqui com o bicho engatado
    // (`isAggressive`), entao nao ha como um atirador de passagem
    // andar para tras de quem passou perto sem ter notado.
    if (enemy.ranged && toPlayer < enemy.keepDistance) {
      enemy.facing = normalize(
        enemy.x - player.x,
        enemy.y - player.y,
      );

      const andou = this.moveToward(
        enemy,
        { x: enemy.x * 2 - player.x, y: enemy.y * 2 - player.y },
        deltaTime,
        enemy.speed,
      );

      /**
       * `retreat` tambem esta no conjunto de andar, entao o mesmo defeito
       * atingia o atirador: ele batia na multidao do jogador, o passo
       * saia zero e a arte de andar tocava com o bicho parado
       */
      enemy.aiState = andou ? "retreat" : "idle";

      return;
    }

    /**
     * O ALCANCE QUE DECIDE O GOLPE tem a folga da multidao.
     *
     * O `tryAttack` ainda exige o alcance de verdade para acertar: ele
     * recebe `toPlayer` e compara com `tuning.attackRange`. Aqui a
     * comparacao e a do `alcanceEfetivo`, que e o mesmo alcance mais meia
     * raio â€” o suficiente para o anel de oito ogres caber
     */
    if (toPlayer <= alcanceEfetivo(enemy)) {
      enemy.aiState = "attack";
      enemy.facing = normalize(
        player.x - enemy.x,
        player.y - enemy.y,
      );

      this.tryAttack(enemy, toPlayer, player);

      return;
    }

    /**
     * O ALVO E O SETOR, e nao o jogador.
     *
     * Perseguir o ponto do jogador faz todos tentarem a mesma
     * circunferencia: um entra no alcance e seis ficam do lado de fora
     * empurrando. Cada mob persegue o girado do seu setor, entao varios
     * chegam a bater ao mesmo tempo
     *
     * A comparacao do `toPlayer` acima continua sendo com o jogador de
     * verdade: e o alcance do golpe que conta, e nao o do setor
     */
    const andou = this.moveToward(
      enemy,
      pontoDoSetor(enemy, player),
      deltaTime,
      enemy.speed,
    );

    /**
     * O ESTADO SO E `chase` SE O MOBO ANDOU.
     *
     * Era aqui que nascia a animacao travada: o `aiState` virava
     * `chase` pela INTENCAO, e `chase` esta no conjunto de estados que
     * tocam animacao de andar. Com o mob bloqueado por outro, o estado
     * continuava `chase` e o desenho tocava andar com o bicho parado
     *
     * Sem passo, o estado volta a `idle`, que e o que o desenho sabe
     * tocar parado. O proximo quadro em que ele destravar traz `chase`
     * de volta sozinho
     */
    enemy.aiState = andou ? "chase" : "idle";

    enemy.facing = normalize(
      player.x - enemy.x,
      player.y - enemy.y,
    );
  }

  updateReturn(enemy, deltaTime) {
    const home = {
      x: enemy.spawnX,
      y: enemy.spawnY,
    };

    if (distance(enemy, home) < RETURN_ARRIVE) {
      /**
       * CHEGOU: a trava do `retreating` abre aqui.
       *
       * E o unico lugar onde ela abre. Se abrisse no `updateBehavior` o
       * chefe abriria a trava no primeiro quadro fora da `restRadius`, ou
       * seja, ANTES de chegar em casa — e voltaria a perseguir o jogador a
       * meio caminho, que e o mesmo defeito de novo
       *
       * `return` e o que mantem o chefe parado em casa no quadro da chegada.
       * Sem ele o `updateIdle` ainda entraria no mesmo quadro e escolheria um
       * passeio novo
       */
      enemy.retreating = false;
      enemy.aiState = "idle";
      enemy.wanderTarget = null;
      return;
    }

    /**
     * O PASSEIO E INTERROMPIDO AQUI, e nao so quando o bicho chega.
     *
     * Sem esta linha o bicho fica segurando o alvo de passeio antigo,
     * que aponta para FORA da area, enquanto ele volta para casa. No
     * quadro seguinte, ja dentro do `restRadius`, o `updateIdle`
     * encontra esse alvo velho e continua a caminhada para fora â€” e o
     * `updateBehavior` puxa de volta no quadro seguinte. Os dois
     * estados brigam pelo mesmo quadro, para sempre
     *
     * O sintoma era um piscar, e nao um tremor de corpo: a cada quadro
     * o bicho saltava entre a linha de caminhada de uma direcao e a da
     * direcao OPOSTA, 60 vezes por segundo. Como o `wanderRadius` e
     * maior que o `restRadius` na diagonal, isso atingia qualquer bicho
     * que passeasse â€” o rato era so o mais comum de ver
     *
     * Zerar o alvo aqui ainda deixa a pausa natural: o `wanderWait`
     * congelou em 1.2 a 3.4s no momento em que o passeio comecou, e
     * ele so volta a andar quando esse tempo passa
     */
    enemy.wanderTarget = null;

    enemy.aiState = "return";
    enemy.facing = normalize(
      home.x - enemy.x,
      home.y - enemy.y,
    );

    /**
     * A VELOCIDADE DO RETORNO, e ela depende de ter alguem por perto
     *
     * ## COM ALVO PERTO: A VELOCIDADE DE NORMAL
     *
     * Ha alguem na `aggroRange`, entao este retorno e consequencia de uma
     * briga — o jogador puxou o chefe, ou o chefe perseguiu e desistiu. O
     * chefe anda no passo dele e chega logo: ele esta indo para a briga
     * recomecar, nao indo embora
     *
     * ## SEM ALVO PERTO: A VELOCIDADE DE RETORNO
     *
     * Nao ha ninguem na `aggroRange`, entao o retorno nao tem nada a ver com
     * luta: e o chefe refazendo a ronda do ponto de origem. E aqui que entra
     * `velocidadeDeRetorno`, o campo que a criatura declara no catalogo
     *
     * Sem esse campo a diferenca nao existe e o chefe volta no passo normal
     * de todo mundo. Com ele, o retorno fica visivelmente mais rapido que a
     * caminhada, e o jogador ve o chefe "desistindo" em vez de arrastando
     * os pes de volta
     *
     * ## E POR QUE O CHEFE DO VALE PRECISA DISSO
     *
     * Porque ele e lento por escolha — `speed: 82`, abaixo dos 93 do Hulk da
     * arena, para a fuga continuar valendo num mapa aberto. Mas um chefe que
     * passeia a 82 e volta a 82 gasta quase 3 segundos para atravessar o
     * centro do vale, e nesse tempo ele parece quebrado, e nao um chefe que
     * desistiu da briga e esta voltando para o posto
     */
    const semAlvo =
      enemy.velocidadeDeRetornoForcada ||
      enemy.retreating ||
      !temAlvoNaRange(this, enemy);

    const velocidade =
      semAlvo && enemy.velocidadeDeRetorno
        ? enemy.velocidadeDeRetorno
        : enemy.speed;

    const andou = this.moveToward(
      enemy,
      home,
      deltaTime,
      velocidade,
    );

    enemy.aiState = andou ? "return" : "idle";
  }

  updateIdle(enemy, deltaTime, restRadius = null) {
    if (!enemy.wanderTarget) {
      enemy.wanderWait -= deltaTime;

      if (enemy.wanderWait > 0) return;

      enemy.wanderWait = randomBetween(1.2, 3.4);

      const raio = enemy.wanderRadius ?? 0;

      const alvo = {
        x: enemy.spawnX + randomBetween(-1, 1) * raio,
        y: enemy.spawnY + randomBetween(-1, 1) * raio,
      };

      /**
       * O alvo NUNCA pode pedir para o bicho sair da area.
       *
       * O alvo e sorteado por eixo, entao o canto mais longe e
       * `wanderRadius * 1.41`. Com o `restRadius` sendo
       * `wanderRadius + 20`, qualquer bicho com raio acima de ~48
       * sorteava um alvo diagonal que estava FORA do limite: ele
       * andava para fora, era puxado de volta no meio do caminho, e
       * ainda segurava o alvo velho â€” e o `updateReturn` agora limpa o
       * alvo, o que impede o piscar, mas deixaria o bicho fazendo
       * vaivem de ida e volta na borda
       *
       * Encolher o alvo ate caber no limite mantem o passeio inteiro
       * dentro da area. O bicho continua andando pelo mesmo tamanho de
       * terreno; ele so nunca mais sai e e puxado de volta
       */
      if (restRadius !== null) {
        const dx = alvo.x - enemy.spawnX;
        const dy = alvo.y - enemy.spawnY;
        const longe = Math.hypot(dx, dy);

        if (longe > restRadius && longe > 0) {
          alvo.x = enemy.spawnX + (dx / longe) * restRadius;
          alvo.y = enemy.spawnY + (dy / longe) * restRadius;
        }
      }

      enemy.wanderTarget = alvo;

      return;
    }

    if (distance(enemy, enemy.wanderTarget) < ARRIVE_EPSILON) {
      enemy.wanderTarget = null;
      enemy.aiState = "idle";
      return;
    }

    /**
     * O `wander` so e `wander` SE ANDOU.
     *
     * E o caso mais comum do defeito: sete limos nao agressivos nascem
     * perto um do outro, todos sorteiam o mesmo ponto de passeio e
     * empilham. O primeiro chega e fica `idle`; os outros seis ficam
     * com `wander` rodando sem sair do lugar, e sete bixos tocam
     * animacao de caminhada parada
     */
    const andou = this.moveToward(
      enemy,
      enemy.wanderTarget,
      deltaTime,
      enemy.wanderSpeed ?? enemy.speed * 0.35,
    );

    enemy.aiState = andou ? "wander" : "idle";
  }

  tryAttack(enemy, targetDistance, target, tuning = enemy) {
    if (enemy.attackCooldownRemaining > 0) return;

    /**
     * O alcance aqui e o EFETIVO, com a folga da multidao.
     *
     * E o que permite o mob travado na borda do anel acertar o golpe. Sem
     * esta troca, o `updateCombat` o colocaria em `attack` (dentro da
     * tolerancia) e o `tryAttack` recusaria de novo pelo alcance real â€”
     * o bicho ficaria parado em `attack` para sempre
     */
    if (targetDistance > alcanceEfetivo(tuning)) return;

    enemy.attackCooldownRemaining = tuning.attackCooldown;

    // O boneco de duelo nao tem arte de golpe, e o `resolveFrameRect`
    // cai no walk quando pedem "attack". O tempo de animacao ainda
    // conta, para o boneco nao recarregar no ar
    enemy.attackAnimation = 0.28;

    // O atirador dispara; todo mundo else encosta.
    //
    // A arte de tiro dele so entra com alvo de verdade
    // (`needsTarget`), e o alvo existe: o `facing` acabou de ser
    // virado para o jogador. O `onShootPlayer` e o motor montando a
    // flecha: a IA nao cria projetel, porque quem decide o dano e
    // o servidor, e no single player o motor da tela e o mesmo
    // caminho
    if (enemy.ranged) {
      this.onShootPlayer(enemy, target);
      return;
    }

    this.onDamagePlayer(enemy, tuning.damage, target);
  }

  /**
   * A EMPURRAO ENTRE MOBES.
   *
   * ## POR QUE EXISTE
   *
   * O colisor so diz "este passo esta bloqueado". Isso e o suficiente
   * para uma parede, e e exatamente o que forma a parede de mobes: cada um
   * empurra o proximo, e o ultimo da fila nao sai do lugar
   *
   * Aqui a multidao se resolve ANTES do passo: cada mob soma um vetor que
   * aponta PARA FORA de quem esta perto demais, e esse vetor entra na
   * direcao final. O resultado e um circulo que se abre sozinho, sem
   * nenhum mob precisar saber dos outros
   *
   * ## POR QUE SO ENTRE MOBES VIVOS
   *
   * O filtro e o mesmo do colisor (`alive !== false`), e por ele que um
   * cadaver nao empurra ninguem e o jogador nao entra na conta. Um mob que
   * se aproxima do jogador tem que atravessar a multidao dos aliados
   *
   * ## POR QUE A FORCA CAI COM A DISTANCIA
   *
   * `1 - distancia / (minimo * FATOR)`: dois mobes encostados empurram com
   * forca 1 e dois que quase se tocam empurram com quase nada. E o que faz
   * a multidao ceder espaco em vez de tremer
   */
  separacaoDe(thisEnemy) {
    let x = 0;
    let y = 0;

    const vizinhos = this.world.enemies;

    /**
     * O CORTE ANTES DA RAIZ.
     *
     * `SEPARATION_RANGE` ao quadrado, calculado uma vez por mob. O
     * teste de longe e feito no quadrado ANTES de qualquer `sqrt`, e o
     * `sqrt` so acontece para quem de fato esta dentro do alcance
     *
     * Este e o laco mais caro do servidor inteiro: cada uma das 93
     * criaturas do mapa 1 itera as 93, o que da 8.649 pares por tique.
     * Com `Math.hypot` em cada par eram 173.000 chamadas nativas por
     * segundo por mapa, e o `hypot` e varias vezes mais lento que
     * `Math.sqrt(dx*dx + dy*dy)` â€” ele existe para nao estourar o
     * numero, e aqui os valores sao coordenadas de mapa, que nao
     * estouram
     *
     * E o corte importava: num aglomerado tipico, dos 93 pares, so
     * uma dezena esta dentro dos 120px. O resto era 82 chamadas
     * nativas por mob por tique jogadas fora
     */
    const alcanceSquared =
      SEPARATION_RANGE * SEPARATION_RANGE;

    for (const outro of vizinhos) {
      if (outro === thisEnemy) continue;
      if (outro.alive === false) continue;
      if (outro.isCreature !== true) continue;

      const dx = thisEnemy.x - outro.x;
      const dy = thisEnemy.y - outro.y;

      const distanciaSquared = dx * dx + dy * dy;

      // longe demais: nao ha por que empurrar
      if (distanciaSquared >= alcanceSquared) continue;

      const distancia = Math.sqrt(distanciaSquared);

      const minimo = (thisEnemy.radius ?? 20) + (outro.radius ?? 20);

      /**
       * `distancia` em 0 daria `NaN` na divisao. Dois corpos exatamente
       * sobrepostos e o caso que a multidao produz, porque todos miram o
       * mesmo ponto â€” e e o pior estado possivel do sistema
       */
      if (distancia < 0.0001) {
        const ang = anguloDoSlot(thisEnemy);

        x += Math.cos(ang);
        y += Math.sin(ang);

        continue;
      }

      const sobreposicao =
        1 - distancia / (minimo * SEPARATION_FACTOR);

      if (sobreposicao <= 0) continue;

      const forca = sobreposicao * SEPARATION_WEIGHT;

      x += (dx / distancia) * forca;
      y += (dy / distancia) * forca;
    }

    return { x, y };
  }

  /**
   * Anda na direcao de um ponto, somando a empurrao da multidao.
   *
   * ## POR QUE A DIRECAO FINAL NAO E O ALVO
   *
   * Ir direto no alvo e o que forma a parede de mobes. A separacao entra
   * na MESMA soma da direcao do alvo, e nao como um passo a parte: dois
   * passos depois do colisor produziriam um trem de allowances, em que a
   * separacao sempre perde para o bloqueio do primeiro da fila
   *
   * ## O QUE VOLTA
   *
   * `true` quando o mob ANDOU. E o que o `updateCombat` usa para nao
   * deixar a animacao de andar com o bicho parado: `chase` so continua
   * se houve passo, e sem passo o estado volta a `idle`, que e o que o
   * desenho sabe tocar
   */
  moveToward(enemy, target, deltaTime, speed) {
    const rumo = normalize(
      target.x - enemy.x,
      target.y - enemy.y,
    );

    const empurrao = this.separacaoDe(enemy);

    /**
     * A EMPURRAO SO TRABALHA DE LADO.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * A primeira versao somava a empurrao inteira na direcao do alvo. Com
     * oito ogres em volta do jogador, cada um empurrava o vizinho para
     * FORA do centro, e o equilibrio era um anel a 84px â€” seis pixels
     * fora do alcance de golpe de 78. O resultado era o pior dos dois:
     * nenhum se sobrepunha e nenhum batia
     *
     * ## POR QUE SO A PARTE TANGENCIAL
     *
     * O que resolve a multidao e DESLIZAR: o mob que tem outro na frente
     * contorna de lado ate a posicao estar livre. Empurrar para longe do
     * alvo fights o objetivo em vez de servir a ele
     *
     * A projecao em `(perpendicular Â· empurrao)` joga fora a componente
     * que aponta para tras e guarda a que corre ao longo do anel. Com
     * isso o anel aperta o quanto precisar para todos caberem e o
     * primeiro que chega bate
     */
    const lateral =
      -rumo.y * empurrao.x + rumo.x * empurrao.y;

    let dirX = rumo.x + -rumo.y * lateral;
    let dirY = rumo.y + rumo.x * lateral;

    const tamanho = Math.hypot(dirX, dirY);

    if (tamanho > 0.0001) {
      dirX /= tamanho;
      dirY /= tamanho;
    }

    if (dirX === 0 && dirY === 0) {
      return false;
    }

    const stepX = dirX * speed * deltaTime;
    const stepY = dirY * speed * deltaTime;

    const before = { x: enemy.x, y: enemy.y };

    this.world.collision.moveEntity(
      enemy,
      stepX,
      stepY,
      this.world.enemies,
    );

    const moved = Math.hypot(
      enemy.x - before.x,
      enemy.y - before.y,
    );

    if (moved < STUCK_THRESHOLD) {
      enemy.stuckTimer += deltaTime;
    } else {
      enemy.stuckTimer = 0;
      enemy.sidestepTimer = 0;
    }

    if (enemy.stuckTimer > STUCK_THRESHOLD * 4) {
      if (enemy.sidestepTimer <= 0) {
        enemy.sidestepSign = Math.random() < 0.5 ? -1 : 1;
        enemy.sidestepTimer = STUCK_SIDESTEP;
      }
    }

    if (enemy.sidestepTimer > 0) {
      const perpendicular = {
        x: -dirY * enemy.sidestepSign,
        y: dirX * enemy.sidestepSign,
      };

      const sidestepSpeed = speed * 0.85;

      this.world.collision.moveEntity(
          enemy,
          perpendicular.x * sidestepSpeed * deltaTime,
          perpendicular.y * sidestepSpeed * deltaTime,
          this.world.enemies,
        );
    }

    return moved >= STUCK_THRESHOLD;
  }
}

export const AI_CONSTANTS = {
  STUCK_THRESHOLD,
  STUCK_SIDESTEP,
  STUCK_COOLDOWN,
  ARRIVE_EPSILON,
  RETURN_ARRIVE,
  RETURN_MARGIN,
  RETARGET_INTERVAL,
};
