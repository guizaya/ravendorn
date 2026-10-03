import { createPlayer } from "../entities/Player.js";
import { Inventory } from "../inventory/Inventory.js";
import { Equipment } from "../equipment/Equipment.js";
import { QuestLog } from "../quests/QuestLog.js";
import { Bestiary } from "../bestiary/Bestiary.js";
import { Craft } from "../craft/Craft.js";
import { Collection } from "../collection/Collection.js";

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
    equipment: new Equipment(),
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

    // o caminho que o auto esta percorrendo
    autoWaypoint: null,
    autoMoveDirection: null,
    autoFacing: null,
    autoDecisionTimer: 0,
    autoLeashRange: 1500,

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

    message: null,
    messageRemaining: 0,
    messageTick: null,
  };
}
