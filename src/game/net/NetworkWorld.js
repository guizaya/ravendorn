/**
 * Escreve o que o servidor mandou nas entidades que o motor desenha.
 *
 * O motor sabe desenhar terreno, props, sprites, barras de vida e
 * numeros de dano. Ele nao sabe mais nada: onde o slime esta, se
 * esta vivo e quem esta perto vem do servidor. Esta ponte e a cola
 * entre os dois, e ela nao decide nada por conta propria.
 *
 * Por que ids batem: o motor gera a lista de inimigos localmente a
 * partir do `MAP_SEED`, e o servidor gera a mesma lista com o mesmo
 * seed. Entao `slime_0` do snapshot e a MESMA entidade que
 * `slime_0` da lista local, e nao uma copia parecida. O teste de
 * determinismo do motor headless e o que garante isso.
 */
/**
 * Quanto tempo a arte de tiro de um jogador remoto fica valendo.
 *
* O mesmo valor que o motor local usa, para os dois ficarem
 * iguais. O servidor so avisa que o disparo COMECOU; quem conta
 * o tempo e o cliente.
 */
const REMOTO_ATAQUE = 0.28;

/**
 * Quanto tempo o mob fica na pose de golpe quando o servidor avisa.
 *
 * O mesmo valor do jogador (`REMOTO_ATAQUE`) porque e a MESMA
 * duracao de animacao no motor: o `attackAnimation` do mob vale
 * 0.28s quando ele ataca. Se o cliente usasse um numero
 * diferente, o mob sairia da pose antes ou depois do sprite.
 */
const MOB_ATAQUE = 0.28;

import { getClassSprite } from "../../data/sprites/index.js";
import { findMap } from "../../data/maps/index.js";

export class NetworkWorld {  /**
   * @param {object} engine  o motor, em modo rede
   */
  constructor(engine) {
    this.engine = engine;

    /** id do inimigo -> entidade, para nao procurar 83 vezes por quadro */
    this.porId = new Map(
      engine.world.enemies.map((e) => [e.id, e]),
    );

    this.ultimoEstado = null;
  }

  /**
   * Aplica um estado vindo do servidor.
   *
   * Devolve quantas coisas foram efetivamente atualizadas. Um
   * estado vazio (o primeiro, antes do primeiro snapshot) nao
   * sobrescreve o desenho com zeros e faz o personagem piscar no
   * canto da tela.
   */
  aplicar(estado) {
    if (!estado?.eu) return false;

    /**
     * TROCOU DE MAPA?
     *
     * Acontece ANTES de aplicar as posicoes, e a ordem e o ponto
     * inteiro: o indice `porId` foi montado com o elenco do mapa
     * anterior, e `setMap` recria inimigos, props e folhas de sprite.
     * Aplicar as posicoes do vale sobre o motor que ainda esta no hub
     * colocaria o jogador e os mobs nas coordenadas de um mapa que ele
     * nao esta desenhando
     *
     * O `porId` tambem e reconstruido: os ids do elenco novo sao outros
     */
    if (estado.mapa && estado.mapa !== this.engine.world.map?.id) {
      /**
       * `findMap`, e nao `getMap`: um id que o servidor nao conhece
       * deixa o cliente no mapa em que ele esta, em vez de pular para o
       * hub e ficar desenhando um mundo que o servidor nao esta
       */
      const destino = findMap(estado.mapa);

      if (destino) {
        this.engine.setMap(destino);

        this.porId = new Map(
          this.engine.world.enemies.map((e) => [e.id, e]),
        );
      }
    }

    this.ultimoEstado = estado;

    this.aplicarJogador(this.engine.world.player, estado.eu);
    this.aplicarInimigos(estado.inimigos);
    this.aplicarOutrosJogadores(estado.outros);
    this.aplicarDrops(estado.drops);
    this.aplicarProjetis(estado.projeteis);

    return true;
  }


  /**
   * O SEU jogador, que e desenhado pelo mesmo caminho de sempre.
   *
   * `acting` e o aviso de "o tiro comecou". Sem(transformar isso
   * em pose, o arqueiro chegava perto do mob, o servidor batia o
   * dano, e o cliente mostrava o personagem parado no idle: o dano
   * acontecia e nao parecia.
   *
   * O aviso e um INSTANTE e nao um estado. O pacote pode trazer
   * `acting: true` duas vezes seguidas (o tiro dura 0.22s e o
   * pacote vem a cada 50ms), e isso e um tiro so. Por isso o
   * `attackAnimation` e setado aqui e completado em
   * `updatePresentation`: se fosse setado a cada pacote, a pose
   * nunca terminaria e o arqueiro ficaria permanentemente
   * segurando o arco.
   */
  aplicarJogador(jogador, dado) {
    if (!jogador || !dado) return;

    jogador.x = dado.x;
    jogador.y = dado.y;
    jogador.hp = dado.hp;
    jogador.isMoving = Boolean(dado.isMoving);

    /**
     * A reacao ao dano, no seu proprio jogador.
     *
     * O valor do servidor e o TEMPO RESTANTE, e ele ja chega
     * diminuindo a cada pacote. Entao o cliente aceita o numero e
     * deixa o relogio correr por conta propria entre um pacote e
     * outro: cada pacote corrige qualquer desvio do relogio local,
     * e o tremor morre suave em vez de abruptamente.
     *
     * E por isso que aqui NAO pode ser um `max` com o valor que o
     * cliente ja tinha: o servidor segura o flash em 0.18 por
     * 0.18s, e um `max` devolveria o tremor ao comeco a cada 50ms,
     * prendendo o personagem tremendo para sempre
     */
    if (typeof dado.hurt === "number" && dado.hurt > 0) {
      jogador.hitFlash = dado.hurt;
    }

    // a direcao vem do servidor para o sprite virar junto com o
    // corpo, em vez de o cliente adivinhar pelo movimento
    if (dado.facing && typeof dado.facing === "object") {
      jogador.facing = dado.facing;
      jogador.moveDirection = dado.facing;
    }

    // so um alvo de verdade entra na arte de tiro. `needsTarget`
    // existe para o arco nao aparecer quando o arqueiro esta
    // lancando um buff em si mesmo
    if (dado.acting && dado.hasTarget) {
      jogador.attackAnimation = REMOTO_ATAQUE;
      jogador.firingTargetId = "alvo";
    }

    // O alvo ESCOLHIDO, que e diferente do alvo do tiro.
    //
    // E quem desce o minimapa e mantem o painel do alvo aberto.
    // Precisa vir do servidor porque quem escolhe o alvo e o
    // jogador, e o estado dele mora la: o cliente nao tem como
    // saber que o alvo continua escolhido depois que o `acting`
    // some entre um disparo e outro.
    //
    // A escrita passa pelo `engine`, e nao direto no `jogador`: o
    // `selectedTargetId` do motor e um acessorio que guarda na
    // SESSAO, que e onde o minimapa e o HUD leem. Escrever no
    // objeto do jogador nao mudaria nada.
    this.engine.selectedTargetId = dado.selectedTargetId ?? null;
  }

  /**
   * As flechas e os outros projeteis que o SERVIDOR esta simulando.
   *
   * Sem isto o arquiro nao "tacava flecha" em modo rede: o
   * `world.projectiles` nasce do `SkillSystem`, que roda no
   * servidor, e o cliente nunca tinha essa lista. O dano acontecia
   * (o servidorapplyou) e nao havia nada voando na tela.
   *
   * A posicao e a do servidor, sempre. O cliente nao integra a
   * velocidade da flecha: se integrasse, um cliente modificado
   * veria a flechavoando sozinha, e a mira pareceria errada sem
   * que ninguem pudesse explicar o por que.
   */
  aplicarProjetis(lista) {
    const { world } = this.engine;

    // o pacote pode nao ter o campo: um servidor velho, ou o
    // primeiro pacote antes de existir projetil
    if (!Array.isArray(lista)) return;

    const porId = new Map();

    for (const dado of lista) {
      porId.set(dado.id, {
        id: dado.id,
        x: dado.x,
        y: dado.y,
        radius: dado.radius ?? 10,
        velocityX: dado.velocityX ?? 0,
        velocityY: dado.velocityY ?? 0,

        // `drawProjectiles` le o estilo em `action.projectileStyle`.
        // no servidor esse objeto vem inteiro da definicao da
        // classe; aqui montamos so o que o desenho precisa, porque
        // mandar a acao inteira por pacote seria desperdicio
        action: {
          projectileStyle: dado.style,
          color: dado.color,
          rain: Boolean(dado.rain),
        },

        style: dado.style,
        color: dado.color,
        rain: Boolean(dado.rain),
      });
    }

    world.projectiles = [...porId.values()];
  }

  aplicarInimigos(lista) {
    if (!Array.isArray(lista)) return;

    for (const dado of lista) {
      const inimigo = this.porId.get(dado.id);

      // o servidor pode mandar um inimigo que o cliente ainda nao
      // conhece. ignorar e melhor do que inventar uma entidade sem
      // sprite e sem barra
      if (!inimigo) continue;

      inimigo.x = dado.x;
      inimigo.y = dado.y;
      inimigo.hp = dado.hp;
      inimigo.maxHp = dado.maxHp ?? inimigo.maxHp;

      // `alive` e o que o render usa para pular o mob. sem isto, um
      // slime morto continuaria desenhado com a barra vazia
      inimigo.alive = dado.state !== "dead" && dado.hp > 0;
      inimigo.aiState = dado.state;

      /**
       * Para onde o mob esta olhando, e o que faz a arte de oito
       * direcoes escolher a linha certa.
       *
       * Sem isto o `facing` da entidade ficava no valor inicial de
       * `createCreature` (sempre para o sul) e o mob andava de
       * lado pelo mapa sem virar o corpo. O `aiState` acima tambem
       * nao dava conta: ele diz se o mob esta andando, mas NAO para
       * onde, e sao duas informacoes diferentes.
       */
      if (dado.facing && typeof dado.facing === "object") {
        inimigo.facing = dado.facing;
      }

      /**
       * O INSTANTE do golpe, com o mesmo cuidado do jogador.
       *
       * O pacote vem a cada 50ms e o golpe dura 0.28s, entao
       * definir o tempo aqui inteiro a cada pacote prenderia a pose
       * para sempre. E o `updatePresentation` do motor que
       * consome: ele reduz o valor e o mob volta a andar quando
       * zera. Sem este campo a arte de tiro nunca entrava.
       */
      if (dado.acting) {
        inimigo.attackAnimation = MOB_ATAQUE;
      }    }
  }

  /**
   * Os outros jogadores entram na lista de inimigos do mundo.
   *
   * E um truque feio, e o comentario explica: o desenho de
   * personagens e o mesmo caminho de codigo dos mobs. Colocando os
   * outros jogadores como "inimigos" que nao atacam e nao tomam
   * dano, o desenho, a barra de vida e o nome funcionam sem
   * duplicar todo o codigo de render.
   */
  aplicarOutrosJogadores(lista) {
    const { world } = this.engine;

    // remove quem saiu, para o mapa nao ficar com gente invisivel
    for (const [id, remoto] of this.remotos ?? []) {
      if (!lista?.some((j) => j.id === id)) {
        world.enemies = world.enemies.filter((e) => e !== remoto);
        this.porId.delete(id);
      }
    }

    this.remotos = new Map();

    for (const dado of lista ?? []) {
      let remoto = this.porId.get(dado.id);

      if (!remoto) {
        remoto = this.criarRemoto(dado);
        world.enemies.push(remoto);
        this.porId.set(dado.id, remoto);
      }

      remoto.x = dado.x;
      remoto.y = dado.y;
      remoto.hp = dado.hp;
      remoto.maxHp = dado.maxHp ?? remoto.maxHp;
      remoto.name = dado.name;
      remoto.classId = dado.classId ?? remoto.classId;

      /**
       * `alive` vem do HP que o servidor mandou, e nao e `true` fixo.
       *
       * Quando este jogador MORREU, quem ve a cena precisa ver o
       * boneco no chao. Com `alive = true` fixo, o corpo de um jogador
       * morto continuava andando pela tela dos outros — ele morria, o
       * painel aparecia nele, e ele ia em frente como se nada
       *
       * E a mesma regra que o inimigo usa duas funcoes acima:
       * `dado.state !== "dead" && dado.hp > 0`. Aqui nao ha `state`
       * para jogador, entao o HP e a unica fonte
       */
      remoto.alive = (dado.hp ?? remoto.hp) > 0;

      remoto.aiState = "idle";

      // a reacao ao dano do OUTRO jogador. o valor ja chega
      // diminuindo do servidor, entao e aceito como esta: aceitar
      // evita que o Bao tremendo na tela de quem esta do lado fique
      // preso no comeco do tremor a cada pacote
      if (typeof dado.hurt === "number" && dado.hurt > 0) {
        remoto.hitFlash = dado.hurt;
      }

      // o que faz o sprite dele virar junto com o corpo. sem isto,
      // a classe direcional andaria sempre olhando para baixo
      if (dado.facing && typeof dado.facing === "object") {
        remoto.facing = dado.facing;
        remoto.moveDirection = dado.facing;
      }

          remoto.isMoving = Boolean(dado.isMoving);

      // A arte de tiro e instantanea: o servidor avisa "ele esta
      // atirando" e o cliente anda o relogio local ate o proximo
      // pacote. Se o sinal viesse a cada tick, a animacao ficaria
      // presa no disparo e nunca voltaria para o idle.
      if (dado.acting) {
        remoto.attackAnimation = REMOTO_ATAQUE;
        remoto.firingTargetId = dado.hasTarget ? "alvo" : null;
      }


      this.remotos.set(dado.id, remoto);
    }
  }

  /**
   * O corpo de um jogador distante.
   *
   * Antes ele era uma copia de um mob, e saia com a figura, a
   * cor e a ancora do monstro. Agora tem os mesmos campos que o
   * jogador local, porque e o MESMO desenho que vai rodar em
   * cima: `SpriteSheet.draw` le `facing`, `isMoving`,
   * `attackAnimation`, `walkPhase` e `walkBlend`.
   *
   * `isRemote` e o que faz o motor desviar para o caminho de
   * jogador em vez do de mob.
   */
  criarRemoto(dado) {
    const sprite = getClassSprite(dado.classId);

    // Pede a folha ASSIM QUE o jogador aparece, e nao no primeiro
    // desenho. Criando no desenho, ele entraria como um boneco
    // vetorial por um instante e so viraria imagem no proximo
    // quadro. E o cache e por classe: dez Arbalist na tela
    // compartilham a mesma imagem.
    this.engine.spriteDeClasse(dado.classId);

    return {
      id: dado.id,
      isPlayer: true,
      isRemote: true,
      classId: dado.classId,
      name: dado.name,

      x: dado.x,
      y: dado.y,
      hp: dado.hp,
      maxHp: dado.maxHp ?? dado.hp,
      alive: true,

      // o que o desenho de JOGADOR le
      facing: { x: 0, y: 1 },
      moveDirection: { x: 0, y: 1 },
      isMoving: false,
      attackAnimation: 0,
      firingTargetId: null,

      // o balanco do andar (o Arbalist usa) e o tempo de animacao
      walkPhase: 0,
      walkBlend: 0,
      animationTime: 0,

      // o que o desenho de MOB usaria, se algo cair no reserva
      kind: 1,
      color: "#ffffff",
      radius: 12,
      hitFlash: 0,
      aiState: "idle",
      spriteOffset: 0,

      // a ancora vem da classe, para a barra de vida e o nome
      // ficarem acima da cabeca certa
      radiusClasse: sprite ? sprite.frameWidth * sprite.scale * 0.3 : 12,
    };
  }

  /**
   * Os drops no chao.
   *
   * O dono vem no pacote. O cliente esconde o drop de outro
   * jogador, mas quem DEVE decidir isso e o servidor (um cliente
   * modificado mostraria o que quiser) - aqui a gente so evita
   * desenhar o que nao pode pegar.
   */
  aplicarDrops(lista) {
    if (!Array.isArray(lista)) return;

    const { world } = this.engine;
    const meus = lista.filter(
      (d) => !d.ownerId || d.ownerId === this.ultimoEstado?.eu?.id,
    );

    // reaproveita as entidades existentes para nao piscar
    const porUid = new Map(world.drops.map((d) => [d.uid, d]));

    world.drops = meus.map((dado) => {
      const anterior = porUid.get(dado.uid);

      if (anterior) {
        // atualiza NO LUGAR. criar um objeto novo a cada pacote
        // (20x por segundo) faria o item piscar e a idade reiniciar
        // sem parar, e o desenho perderia a referencia
        Object.assign(anterior, dado);
        return anterior;
      }

      return { ...dado, age: 0 };
    });
  }
}
