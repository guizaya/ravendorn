import { createPlayer } from "../entities/Player.js";
import { Inventory } from "../inventory/Inventory.js";
import { Equipment } from "../equipment/Equipment.js";
import { QuestLog } from "../quests/QuestLog.js";
import { Bestiary } from "../bestiary/Bestiary.js";
import { Craft } from "../craft/Craft.js";
import { Collection } from "../collection/Collection.js";
import { darKitDeTeste } from "../entities/kitDeTeste.js";

/**
 * Tudo o que pertence a UM jogador, e nao ao mundo.
 *
 * No single player o motor guardava inventario, equipamento,
 * missoes, bestiario e craft em `world`, e havia um so jogador.
 * Online isso quebra de dois jeitos: dois jogadores com o mesmo
 * inventario (o loot de um apareceria no do outro) e o estado de
 * um contaminando o do outro.
 *
 * A sessao e esse "por jogador": o servidor cria uma por conexao,
 * joga no `world.players` e o resto do motor le dela em vez de
 * ler do mundo.
 */
export function createPlayerSession(
  classDefinition,
  options = {},
) {
  const {
    spawn = { x: 1200, y: 800 },
    id,
    name,
    input,
    donoKey = null,
  } = options;

  const player = createPlayer(
    classDefinition,
    spawn,
    { id: id ?? `p_${classDefinition.id}`, name },
  );

  const equipment = new Equipment();

  /* ==============================================================
     KIT DE TESTE — APAGAR ESTAS DUAS LINHAS
     ==============================================================
     Um equipamento para o personagem novo, só para a classe que já
     tem item no catálogo. É teste, não conteúdo do jogo.

     Apague o bloco abaixo E o import do `darKitDeTeste` lá em cima.
     Não há flag de desligamento: uma flag esquecida continua dando
     equipamento a todo mundo, e isso é pior do que código apagado.

     A chamada acontece ANTES do objeto da sessão ser montado, porque
     o `darKitDeTeste` recebe a sessão pronta e preenche o
     `equipment` dela. Ele foi chamado antes deste bloco justamente
     para isso: é a única linha dele que depende da ordem
     ============================================================== */
  darKitDeTeste({ classId: classDefinition.id, equipment });

  return {
    id: player.id,
    name: player.name,
    classId: classDefinition.id,
    classDefinition,

    /**
     * A chave do PERSONAGEM, estavel entre conexoes.
     *
     * O `id` acima e da sessao e muda a cada entrada — e ele que o
     * mundo usa. Esta chave e quem o jogador e para fins de
     * propriedade: e por ela que o mercado acha o dono de um anuncio
     * depois que ele saiu, e que o pagamento de uma venda offline
     * encontra a sessao nova quando ele volta. No single player fica
     * `null`, porque ninguem sai do jogo e nao ha a quem pagar depois
     */
    donoKey,

    // a entidade que anda, leva dano e aparece no snapshot
    player,

    // o estado privado deste jogador
    inventory: new Inventory(),
    equipment,
    quests: new QuestLog(),
    bestiary: new Bestiary(),
    craft: new Craft(),

    /**
     * A GUILDA deste jogador, e so o que E DELE.
     *
     * `pontos` e `ultimoPontoEm` moram aqui, e nao no `GuildStore`, por
     * um motivo que ja custaria horas de espera de alguem: sao estado
     * POR JOGADOR. Se estivessem no store e a sessao fosse recriada ao
     * reconectar, os pontos voltariam a zero e o jogador que passou
     * a noite offline para juntar 24 voltaria com zero
     *
     * `ultimoPontoEm` e o que faz o accrue offline funcionar sem
     * ninguem de guarda: e o relogio, e nao um contador que alguem
     * incrementa. Guardar QUANDO foi o ultimo ponto, e nao QUANTOS
     * tem, e o que faz o tempo com o jogo fechado contar
     */
    guilda: {
      pontos: options.pontos ?? 0,
      ultimoPontoEm: options.ultimoPontoEm ?? null,
    },

    /**
     * A COLECAO: as entregas.
     *
     * Vive aqui, e nao no `GameEngine`, pelo mesmo motivo de todo o
     * resto desta lista: e estado privado. Duas sessoes compartilhando
     * o mesmo `Collection` fariam uma entrega de um jogador fechar a
     * colecao do outro
     */
    collection: new Collection(),

    // a ultima intencao recebida do cliente. e o que o motor
    // consome no tick: o cliente manda para ONDE quer ir, nunca
    // a posicao final
    intent: {
      seq: 0,
      moveX: 0,
      moveY: 0,
      aimX: 0,
      aimY: 0,
    },

    // o teclado e o mouse tambem sao por jogador. no navegador so
    // existe um, e ele e o jogador local; no servidor cada um
    // recebe a intencao que mandou. se o input ficasse no motor,
    // o segundo jogador andaria junto com o primeiro
    input: input ?? {
      keys: new Set(),
      pointer: {
        x: classDefinition.stats.range + 100,
        y: 0,
        inside: false,
      },
    },

    // alvo escolhido, cacada e o modo automatico tambem sao por
    // jogador. o motor le e escreve estes campos atraves de
    // acessorios que apontam para a sessao em foco, entao eles
    // PRECISAM existir aqui.
    //
    // `engagedTargetId` e o que faz o personagem andar ate o alvo
    // depois de um clique. Sem ele no servidor, o ataque saia sem
    // ninguem chegar perto e o golpe nao conectava.
    selectedTargetId: null,
    engagedTargetId: null,
    autoPlay: false,
    bestiaryTargetType: null,

    // quais skills deste jogador foram arrastadas para baixo.
    // fica NA sessao, e nao num `Map` de modulo: no servidor um
    // `Map` de modulo e compartilhado por todos, e arrastar uma
    // skill na Ana ligava o automatico dela no Bento tambem
    skillAuto: new Set(),

    /**
     * AS HABILIDADES QUE ESTE JOGADOR APRENDEU.
     *
     * Nasce VAZIO, e essa e a mudanca de regra: o personagem comeca sem
     * nenhuma habilidade. Quem ensina e o livro, comprado com o Mestre de
     * Habilidades — nao o nivel
     *
     * E um `Set` pelo mesmo motivo do `skillAuto` acima: no servidor um
     * `Set` de modulo seria compartilhado por todos, e a Ana aprender
     * uma skill ligaria a do Bento tambem
     *
     * Guarda o ID da skill (`"arbalist_quick_shot"`), e nao o slot: o
     * slot e a posicao no array da classe e muda se a ordem do catalogo
     * mudar, e um save antigo apontaria para a habilidade errada
     *
     * A ULTIMATE NAO ENTRA AQUI. Ela e liberada pelo nivel 6, e nao por
     * livro — ver `ULTIMATE_NIVEL` em `src/data/skills/index.js`
     */
    habilidadesAprendidas: new Set(),

    // o caminho que o auto esta percorrendo
    autoWaypoint: null,
    autoMoveDirection: null,
    autoFacing: null,
    autoDecisionTimer: 0,
    autoLeashRange: 1500,

    /**
     * A VIAGEM: a fila de etapas para chegar no objetivo.
     *
     * ## POR QUE NAO CABE EM `autoWaypoint`
     *
     * `autoWaypoint` e um PONTO, e e reescrito a cada 0.25s pelo
     * `autoPlayTarget`. Um destino em outro mapa nao cabe nele por dois
     * motivos independentes:
     *
     * 1. `setMap` ZERA o campo (`GameEngine.setMap`), e trocar de mapa e
     *    justamente o meio da viagem. O plano precisaria sobreviver ao
     *    `setMap` que ele proprio provocou;
     * 2. o ponto e resolvido no mapa em que o jogador ESTA. Apos
     *    atravessar o portal, a mesma linha de codigo continuaria
     *    apontando para a coordenada antiga, agora em outro mapa
     *
     * ## O FORMATO
     *
     * Cada etapa e `{ mapId, x, y, portalId, caminho }`:
     *
     * - `mapId` — o mapa em que a etapa acontece. E o que permite
     *   perceber que o plano ficou velho;
     * - `x`/`y` — o ponto a alcancar nesta etapa: o portal a atravessar,
     *   ou o destino final;
     * - `portalId` — o portal a atravessar ao chegar. `null` na ultima
     *   etapa, que e a unica que termina numa zona em vez de noutro mapa;
     * - `caminho` — os pontos do A* ate `x`/`y`, ja simplificados. Vem
     *   preenchido na hora de comecar a etapa e vai sendo consumido
     *
     * Vive na sessao pelo mesmo motivo do resto: no servidor dois
     * jogadores com planos diferentes nao podem compartilhar um campo
     */
    travelPlan: [],

    /**
     * O JOGADOR QUE ESTE ESTA SEGUINDO, ou `null`.
     *
     * E um id de SESSAO, e nao uma posicao: o seguido anda, e o plano
     * precisa ser refeito a cada vez que ele muda de lugar. Guardar a
     * coordenada faria o seguidor ir para o ponto onde ele estava e
     * parar la
     *
     * Vive na sessao como o `travelPlan`, pelo mesmo motivo: dois
     * jogadores podem estar seguindo gente diferente ao mesmo tempo
     */
    seguindoId: null,

    /**
     * O TEMPO ate o plano ser refeito enquanto se segue.
     *
     * O seguido se mexe varias vezes por segundo, e refazer o A* a cada
     * quadro custaria um BFS e uma montagem de plano por quadro. Como o
     * plano tambem tem de se atualizar logo apos uma travessia de portal,
     * este e o piso: enquanto ele nao vence, o plano segue válido
     */
    seguindoRelogio: 0,

    /**
     * O SEGUIR LIGOU O AUTO, e nao o jogador.
     *
     * Sem este flag o `pararDeSeguir` desligaria um Auto que o jogador
     * tinha ligado antes de pedir para seguir, e ele voltaria do
     * primeiro passo para a cacada que tinha montado
     */
    seguindoAuto: false,

    /**
     * CHEGOU DO LADO E ESTA PARADO.
     *
     * Differe de "nao esta seguindo": o acompanhamento acabou, mas o
     * piloto fica suspenso para o personagem NAO voltar a cacar o que
     * esta em volta. E o que faz o pedido "seguir e ao chegar ficar
     * parado no ponto final"
     *
     * Some quando o jogador aperta T ou liga a cacada de novo
     */
    seguindoParado: false,

    /**
     * O MAPA DESTE JOGADOR.
     *
     * E o que impede todo mundo de atravessar o portal junto. O mapa e
     * um campo do MOTOR — `world.map`, `world.enemies`, `world.collision`
     * — e nao da sessao, entao sem este campo o `setMap` de um jogador
     * trocava o mapa de todo mundo: o outro recebia o snapshot com o id
     * novo e o cliente dele desenhava o outro mapa
     *
     * Vive na sessao porque e o unico lugar que o motor nao troca
     */
    mapId: null,

    /**
     * FOCAR O MESMO INIMIGO DO LIDER.
     *
     * Quando ligado, o Auto deste jogador nao escolhe alvo proprio: ele
     * ataca o que o lider esta batendo. E quando o lider nao esta
     * batendo em ninguem, este tambem nao bate — que e o pedido, e o
     * oposto de "cada um caça o mob mais perto"
     *
     * Vive na sessao porque e uma ESCOLHA do jogador, e nao uma regra
     * do grupo: o lider nao precisa disso para ele mesmo, e cada
     * membro liga e desliga na sua hora
     */
    focarLider: false,

    /**
     * O TEMPO que o jogador passou parado durante a viagem.
     *
     * O plano pode ficar velho sem ninguem tocar nele: um inimigo empurra
     * o jogador, o `shoveEnemiesOffPlayer` resolve, ou o alvo sai do
     * caminho no meio da etapa. Quando isso empurra o boneco para tras
     * do ultimo ponto do A*, o piloto ficaria andando para um ponto que
     * ele ja passou
     *
     * E o contador que faz o motor replanejar. Acima de um limite, o
     * passo e refeito do zero e o numero volta a zero
     */
    travelParado: 0,

    /**
     * O CAMINHO de perseguicao, e ha quanto tempo ele foi calculado.
     *
     * ## A MESMA COISA QUE A VIAGEM, SO QUE PARA UM ALVO QUE ANDA
     *
     * O `approachTarget` apontava direto para o alvo e andava em linha
     * reta. Com uma arvore no meio, o boneco empurrava contra o tronco e
     * nunca chegava na distancia de tiro — o arqueiro (alcance 550) ficava
     * olhando um limo a 800px sem disparar uma flecha so
     *
     * ## POR QUE FICA NA SESSAO E POR QUE TEM RELOGIO
     *
     * Na sessao pelo mesmo motivo do resto: no servidor dois jogadores
     * perseguindo alvos diferentes nao podem compartilhar um caminho
     *
     * E o `cacadaRelogio` porque o alvo ANDA. Um caminho calculado uma
     * vez so serve enquanto o alvo nao se moveu; recalcular a cada quadro
     * custaria ate 80ms de A* por quadro por jogador
     */
    cacadaCaminho: null,
    cacadaRelogio: 0,

    /**
     * O aviso de tela ("+16 moedas", "missao concluida").
     *
     * Era um campo do MOTOR, e por isso TODO mundo connected via a
     * receber no painel: quando a Ana matava um slime, o "+16 moedas"
     * aparecia na tela do Bento tambem, e parecia que a recompensa
     * tinha ido para os dois. O premio em si ja era do dono (o
     * `lastHitBy` decide); o que vazava era o AVISO.
     *
     * O aviso e por sessao pelo mesmo motivo do resto: e informacao
     * privada de quem ganhou.
     */
    /**
     * O filtro de coleta DESTE jogador.
     *
     * `null` e o estado inicial, que e "pega tudo". Antes o filtro
     * vivia no MOTOR, entao um so filtro valia para o mundo inteiro:
     * o jogador que ajustasse o dele mudava o loot de todo mundo no
     * mesmo mapa, e online o ajuste nao valia nem para si, porque o
     * loot e decidido no servidor.
     */
    lootFilter: null,

    /**
     * O RESULTADO DA BUSCA DE GUILDA deste jogador.
     *
     * ## POR QUE VIVE AQUI, E NAO NO MOTOR
     *
     * Era `this.searchResults`, um campo do MOTOR: a busca da Ana
     * aparecia na aba Buscar do Bento, que nem tinha digitado nada. No
     * servidor o motor e compartilhado por todo mundo conectado, entao
     * um campo dele e a ultima busca que alguem fez — e nao a do dono da
     * sessao que esta recebendo aquele painel
     *
     * E o mesmo motivo do resto desta sessao: a lista e privada do
     * jogador, e dois jogadores buscando guilda ao mesmo tempo nao
     * podem compartilhar um campo
     *
     * ## COMECA VAZIA DE PROPOSITO
     *
     * A aba Buscar e a mais importante para quem ainda nao tem guilda, e
     * ela abre mostrando a lista. O termo vai no pedido, nao aqui: o que
     * mora na sessao e o RESULTADO
     */
    guildaBusca: [],

    /**
     * A MORTE, e o PRAZO para escolher.
     *
     * ## POR QUE ISTO EXISTE
     *
     * O painel da morte (o `DeathPanel`) le UM campo so, `morte.morto`,
     * e o servidor manda esse campo no painel a cada pacote. Ele nunca
     * existiu: o componente esta no disco e o HUD o renderiza, mas o
     * motor nao produzia o estado — entao o painel vivia fechado, sem
     * erro nenhum, que e a pior forma de sumir
     *
     * ## POR QUE VIVE NA SESSAO E NAO NO MOTOR
     *
     * Pelos mesmos motivos de `lootFilter` e `message`: sao estado
     * PRIVADO. No servidor dois jogadores podem estar mortos ao mesmo
     * tempo, cada um com o proprio relogio correndo. Um campo do motor
     * faria o prazo de um cair para o outro, e um deles seria puxado de
     * volta a base enquanto ainda lia o preco da outra saida
     *
     * `restante` e o relogio em SEGUNDOS, e o motor e quem decrementa.
     * O painel so exibe: um cliente que calculasse o prazo mostraria 5s
     * com os botoes liberados enquanto o servidor ja estava voltando o
     * jogador para a base
     */
    morte: {
      ativo: false,
      restante: 0,
    },

    message: null,
    messageRemaining: 0,
    messageTick: null,
  };
}
