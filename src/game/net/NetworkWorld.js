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
    this.aplicarPedidasFora(estado.pedidasFora);

    return true;
  }

  /**
   * AS PEDRAS QUE ESTAO FORA DO MAPA, no motor.
   *
   * Vai num `Set` e nao num array porque a consulta e "esta pedra esta
   * fora?", e o `Set` responde em tempo constante. Sao 40 cristais e a
   * consulta acontece uma vez por prop por quadro, no desenho
   *
   * ## POR QUE UM CAMPO DO MOTOR E NAO UM FILTRO NA HORA DE DESENHAR
   *
   * Porque quem decide o que existe no mundo e o servidor. O cliente
   * guardar a lista aqui e so um espelho do que veio, e o `aplicarPedidasFora`
   * substitui a lista inteira a cada pacote de 20Hz — sem mesclar, sem
   * acumular. Um filtro que tirasse as pedras do array de props do mapa
   * seria mais curto e seria ERRADO: a lista do mapa e o dado, e o dado
   * nao muda por causa de quem olha
   */
  aplicarPedidasFora(lista) {
    const mapa = this.engine.world?.map?.id ?? null;

    /**
     * A LISTA VAI PARA DENTRO DO `Set` COMPARTILHADO DO MAPA.
     *
     * Nao e um `Set` novo. O `CollisionSystem` foi construcao com a MESMA
     * instancia que o desenho le, e ele e reconstruido a cada troca de
     * jogador em foco — trocar o objeto aqui deslinkaria a colisao da tela,
     * e o cristal voltaria a sumir do desenho sem sair do caminho
     *
     * E o `sincronizarPedidasFora` do motor porque e o mesmo metodo que o
     * servidor usa quando uma pedra cai: os dois lados escrevem a mesma
     * verdade, na mesma lista
     */
    this.engine.sincronizarPedidasFora(mapa, lista);
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

    /**
     * A PICARETA, que o servidor decide.
     *
     * E escrita direto no jogador, sem `max` e sem guarda: o valor chega
     * `true` ou `false` a cada pacote de 20Hz, e nao e um relogio que
     * corra. Um `max` aqui prenderia a picareta no ar para sempre depois
     * do primeiro `true` — o mesmo defeito que o `hurt` acima teve e que
     * o comentario dele descreve
     *
     * Sem este campo o arquiro nunca socaria: no modo rede o cliente nao
     * roda a `runMineracao`, entao ninguem escreveria o `isMining` dele
     */
    jogador.isMining = dado.mining === true;
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
       * O CADAVER, e o relogio que ele precisa.
       *
       * O `killEnemy` que liga a animacao de morte roda no MOTOR DO
       * SERVIDOR, nunca no cliente: o pacote traz `restamMorte` e e aqui que
       * ele vira de novo um relogio. O cliente so descobre que o bicho morreu
       * neste pacote, e este e o unico lugar onde ele descobre
       *
       * ## POR QUE O TEMPO E LIDO DA ARTE, E NAO DO PACOTE
       *
       * O pacote manda o que RESTA, e nao o `duration` nem o `fade`. Sao dois
       * numeros que moram no layout do sprite, e o layout e do cliente — o
       * servidor nao tem a folha. Ler os tres aqui e o que mantem os dois
       * lados com o mesmo total, e e o que o `resolveDeathElapsed` do motor
       * usa para saber quando o ciclo acabou e o cadaver vira esmaecimento
       *
       * Sem isto o `deathTimer` ficava em `null`, que e o valor que o
       * `eMostrandoCadaver` do motor le para recusar o cadaver — e o goblin
       * sumia no mesmo quadro em que morria, sem a animacao
       */
      if (inimigo.alive) {
        /**
         * O RESPAWN ZERA O RELOGIO DO CADAVER.
         *
         * O `reviveEnemy` do motor faz isso no offline, e o cliente nao tem
         * `reviveEnemy`: quem traz a criatura de volta e o pacote, com
         * `state` diferente de `"dead"`. Sem esta linha o `deathTimer`
         * ficaria no valor em que parou — e o proximo abate daquele goblin
         * mostraria o cadaver com o tempo ja todo contado, aparecendo e
         * sumindo no mesmo quadro
         */
        inimigo.deathTimer = null;
        inimigo.deathDuration = 0;
        inimigo.deathFade = 0;
      } else if (inimigo.deathTimer <= 0) {
        const restam = dado.restamMorte;

        /**
         * O PRIMEIRO PACOTE DA MORTE, e so ele.
         *
         * O guarda `deathTimer <= 0` e o que impede o reescrever a cada
         * pacote: depois do primeiro, o relogio corre LOCAL, e cada pacote
         * seguinte traria um numero menor que zeraria o progresso — o cadaver
         * ficaria preso no primeiro quadro
         *
         * O `restamMorte` chega como `null` de quem nao tem arte de morte, e
         * o `typeof` recusa esse `null` sem precisar de uma checagem a mais
         */
        if (typeof restam === "number" && restam > 0) {
          const definition =
            this.engine.enemySprites.get(inimigo.id)?.definition;

          inimigo.deathTimer = restam;
          inimigo.deathDuration = definition?.deathDuration ?? 0;
          inimigo.deathFade = definition?.deathFade ?? 0;
        }
      }

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
      }

      /**
       * O TELEGRAPH, e a unica coisa que o cliente recebe do preparo.
       *
       * ## E POR QUE O CLIENTE RECONSTRUI, E NAO USA O OBJETO DO PACOTE
       *
       * Porque o pacote e JSON: os numeros chegam arredondados e as chaves
       * ausentes viram `undefined`. A execucao que o motor desenha e a MESMA
       * classe que o servidor produziu — o `TelegraphSystem` monta a
       * execucao a partir de um pacote puro, e e o que garante que o
       * `contemPonto` do cliente e o do servidor concordem
       *
       * ## E POR QUE O `impactoEm` VIJA ABSOLUTO
       *
       * Porque o relogio do cliente e o do servidor andam juntos — o mesmo
       * `world.time` que o motor avanca. Se o pacote trouxesse "faltam 1.4s",
       * cada cliente contaria do seu jeito e dois jogadores veriam o disco
       *chegar emFrames diferentes. Com o instante, ambos recalculam
       * `progresso = 1 - (impactoEm - agora) / duracao` e chegam no mesmo
       * lugar
       *
       * ## E POR QUE SUSTITUI, E NAO ACUMULA
       *
       * Porque um telegraph e um estado INTEIRO, nao um evento. A cada pacote
       * chega o estado atual daquela execucao; o cliente mantem uma por
       * chefe e descarta a anterior. Sem isso, o pacote de 1.0s, 1.5s e 2.0s
       * virariam tres circulos no chao
       */
      this.aplicarTelegraph(dado.telegraph, inimigo);
    }
  }

  /**
   * O TELEGRAPH DE UM CHEFE, no estado do cliente.
   *
   * E a MESMA execucao que o servidor produziu, montada a partir do pacote.
   * A lista local e substituida porque o desenho le `world.telegraphs`, e o
   * motor no cliente nao roda a IA — quem decide o que acontece e o servidor
   */
  aplicarTelegraph(dado, inimigo) {
    const { world } = this.engine;

    if (!Array.isArray(world.telegraphs)) return;

    // remove o telegraph anterior deste chefe, se houver
    for (let i = world.telegraphs.length - 1; i >= 0; i -= 1) {
      if (world.telegraphs[i].inimigoId === inimigo.id) {
        world.telegraphs.splice(i, 1);
      }
    }

    if (!dado) return;

    /**
     * A EXECUCAO RECONSTRUIDA.
     *
     * Nao e o objeto do pacote: e um objeto com a MESMA forma que o
     * `TelegraphSystem` produz no servidor. O `impactoEm` vem cru, sem
     * ajuste — ver o comentario do metodo sobre por que o relogio e
     * compartilhado
     */
    world.telegraphs.push({
      id: dado.id,
      inimigoId: inimigo.id,
      habilidadeId: dado.habilidadeId,
      tipo: dado.tipo,
      cor: dado.cor,

      inicioEm: dado.inicioEm,
      impactoEm: dado.impactoEm,
      duracao: dado.duracao,

      /**
       * O DESLOCAMENTO ENTRE OS DOIS RELOGIOS.
       *
       * ## POR QUE ISTO EXISTE
       *
       * Porque `impactoEm` e um numero do `world.time` do SERVIDOR, e o
       * cliente conta em `spriteTime`. Os dois nao tem nada um com o outro:
       * o servidor pode estar em 340 e o cliente em 12, e a conta direta dava
       * `restante: 330` num telegraph de preparo 2s — o `progresso` era um
       * numero negativo cortado em zero
       *
       * O sintoma era exato: a AREA aparecia (que e desenhada com o progresso
       * zero), a frente luminosa nunca crescia, e o pulso nunca rodava. O
       * jogador via o telegraph parado, sem nenhuma nocão de quando o golpe
       * comecava ou terminava
       *
       * ## A CONTA
       *
       * `deslocamento = relogioDoServidorAgora - meuRelogioAgora`
       *
       * Com isso, o cliente reproduz o instante do servidor com o relogio
       * dele: `impactoEm - (meuRelogio + deslocamento)` e o tempo restante
       * certo, com a latencia de um pacote ja embutida
       */
      deslocamento: (dado.servidorEm ?? 0) - (this.engine.spriteTime ?? 0),

      x: dado.x,
      y: dado.y,
      dirX: dado.dirX,
      dirY: dado.dirY,

      raio: dado.raio,
      raioInterno: dado.raioInterno,
      raioExterno: dado.raioExterno,
      alcance: dado.alcance,
      largura: dado.largura,
      anguloGraus: dado.anguloGraus,

      /**
       * O `isRemote` E O QUE PROTEGE ESTA EXECUCAO.
       *
       * Sem ele, o `TelegraphSystem` do cliente — que existe para o single
       * player — tentaria aplicar o impacto e o dano de novo, com o cliente
       * decidindo quem levou o golpe. E exatamente o que a secao 13 do
       * pedido proibe
       */
      isRemote: true,
      danoAplicado: false,
    });
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
       * O NIVEL, pelo mesmo motivo do `maxHp`: o servidor e quem sabe, e sem
       * ele a barra flutuante mostrava "Nv.1" para qualquer jogador. E o
       * `?? remoto.level` pela mesma razao do `guilda` abaixo: um pacote sem
       * o campo nao significa nivel 1, significa "continua igual"
       */
      remoto.level = dado.level ?? remoto.level;

      /**
       * A TAG DA GUILDA, ou `null`.
       *
       * ## POR QUE ELA VIAJA COM O REMOTO E NAO COM O PAINEL
       *
       * Porque o desenho da tag acontece no CANVAS, na funcao que desenha o
       * nome do remoto, e essa funcao so recebe o remoto. Se a tag viesse
       * pelo painel, o canvas teria de guardar uma tabela de "quem esta com
       * guilda" separada e cruzaria as duas a cada quadro
       *
       * ## POR QUE `?? remoto.guilda` E NAO SO `dado.guilda`
       *
       * Porque o servidor so manda o campo quando o jogador LIGOU a tag. Um
       * pacote sem o campo nao significa "sem guilda": significa "isto
       * continua igual ao que eu ja sei". Sobrescrever com `undefined`
       * apagaria a tag de um jogador que estava com ela ligada, e o nome
       * dele piscaria sem a tag a cada pacote que por algum motivo nao
       * trouxesse o campo
       *
       * E o `null` explicito do servidor e o que DESLIGA: ai o `??` nao
       * segura nada e a tag sai
       */
      remoto.guilda =
        dado.guilda === undefined ? remoto.guilda ?? null : dado.guilda;

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

      /**
       * O NIVEL no nascimento, e nao so no `aplicarOutrosJogadores`.
       *
       * Pelo mesmo motivo do `guilda`: um remoto novo nasce num pacote onde o
       * dado ja veio, e so o `aplicar` atualizaria a partir do segundo — a
       * barra mostraria nivel errado por um pacote
       */
      level: dado.level ?? 1,

      /**
       * A TAG no nascimento, e nao So no `aplicarOutrosJogadores`.
       *
       * Porque um remoto novo nasce num pacote onde o `dado.guilda` ja veio,
       * e so o `aplicar` atualizaria a partir do segundo pacote. No primeiro
       * quadro o jogador apareceria sem a tag e so a receberia no seguinte
       * — e o pacote chega a 20Hz, entao a falha duraria 50ms, o suficiente
       * para se ver como um piscar
       */
      guilda: dado.guilda ?? null,

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
