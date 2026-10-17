import { RARITY, RARITY_ORDER } from "../items/index.js";

import {
  CREATURE_TYPES,
  MAP_2_ROSTER,
  scaleForLevel,
} from "../enemies/index.js";
import { BALANCE } from "../../game/balance.js";
import { getZoneById } from "../maps/index.js";

/**
 * A RECOMPENSA de uma missao, no formato que o painel desenha e que
 * o `QuestLog` entrega ao resgate.
 *
 * Sao tres coisas e nada mais: `coins`, `xp` e `items`. As tres sao
 * opcionais porque uma missao de nivel, por exemplo, paga ouro e nao
 * paga xp (o nivel ja e o premio), e uma caçada antiga pode pagar so
 * moedas.
 *
 * `items` e a lista de `{ itemId, count }`, e o `count` e a
 * quantidade NAO opcional: um item com `count` zero nao apareceria na
 * mochila e so ocuparia um espaco na lista
 */
export function normalizeRewards(rewards) {
  const bruto = rewards ?? {};

  const coins = Math.max(0, Math.floor(Number(bruto.coins) || 0));
  const xp = Math.max(0, Math.floor(Number(bruto.xp) || 0));

  const items = (Array.isArray(bruto.items) ? bruto.items : [])
    .map((entry) => ({
      itemId: entry?.itemId ?? null,
      count: Math.max(0, Math.floor(Number(entry?.count) || 0)),
    }))
    .filter((entry) => entry.itemId && entry.count > 0);

  return { coins, xp, items };
}

/** A recompensa tem alguma coisa a entregar? */
export function hasRewards(rewards) {
  const { coins, xp, items } = normalizeRewards(rewards);

  return coins > 0 || xp > 0 || items.length > 0;
}

/**
 * OS TIPOS DE MISSAO, E OS DE TUTORIAL.
 *
 * Os quatro primeiros — `HUNT`, `KILL`, `EQUIP`, `LEVEL` — medem o jogo de
 * sempre: matar, vestir, subir de nivel. Sao objetivos de ESTADO, e o
 * `QuestLog` ja os conta por evento
 *
 * Os seis seguintes sao os TUTORIAIS, e eles existem para uma coisa que os
 * outros nao fazem: ensinar um SISTEMA que o jogador nao conhece
 *
 * ## POR QUE SAO TIPOS, E NAO UM TEXTO
 *
 * Porque a diferenca entre um tutorial e uma missao de cacada e o que a
 * tela faz com ele. A de cacada mostra "Vá ao Pântano e mate 10 esqueletos" e
 * o auto sabe levar o jogador ate la. O tutorial nao tem lugar nenhum para ir:
 * ele diz "encante uma peça" e o painel precisa tratar aquilo como uma
 * PISTA, com um botao que abre a aba certa
 *
 * Se um tutorial fosse uma missao de cacada com outro texto, o auto levaria o
 * jogador para o Pântano para ele descobrir que precisava abrir o craft
 *
 * ## O `target` DE CADA TUTORIAL
 *
 * E o `id` do que precisa ser feito, nao uma criatura: `craft`, `enchant`,
 * `enhance`, `mine`, `deliver`, `learnSkill`, `market`, `codex`. O
 * `QuestLog` compara o que o jogador fez com esse `target`
 */
export const QUEST_TYPE = {
  HUNT: "hunt",
  KILL: "kill",
  EQUIP: "equip",
  LEVEL: "level",

  /**
   * CRIAR UM ITEM NO CRAFT.
   *
   * E o primeiro tutorial de verdade: o jogador novo nasce sem inventario e
   * sem Equipment, e a unica fonte de item no jogo e o drop. Este tutorial
   * mostra que o craft existe e produz material a partir do que ele dropou
   */
  CRAFT: "craft",

  /**
   * ENCANTAR UMA PECA.
   *
   * O primeiro afixo e o que muda a identidade de uma peca comum. E o
   * tutorial tem de vir logo depois do `craft`, porque o encantamento usa
   * ouro, e ouro so existe depois de vender algo ou de uma missao
   */
  ENCHANT: "enchant",

  /**
   * APRIMORAR UMA PECA A +5.
   *
   * O aprimoramento e steel, e steel so sai de minerar. Este tutorial e o
   * unico que depende de outro sistema inteiro funcionando antes
   */
  ENHANCE: "enhance",

  /**
   * MINERAR UMA PEDRA NO VALE.
   *
   * E a unica fonte de steel do jogo, e a unica que nao passa por combate.
   * Sem ele o jogador nunca chega no `enhance`
   */
  MINE: "mine",

  /**
   * ENTREGAR UMA PARCELA DE COLECAO.
   *
   * A colecao e o sistema de progressao PERMANENTE, e o unico que paga sem
   * consumir nada. E o que transforma drop em stat
   */
  DELIVER: "deliver",

  /**
   * APRENDER UMA HABILIDADE.
   *
   * As quatro skills de cada classe vem de livro, e o livro e o drop mais
   * raro do catalogo. Sem este tutorial o jogador pode nunca descobrir que
   * aquilo existe
   */
  LEARN_SKILL: "learnSkill",

  /**
   * COMPRAR NA LOJA.
   *
   * A loja e onde o ouro do drop vira pocoes e livros. E o sistema que o
   * jogador nunca abriria por conta propria, porque o painel nao avisa que
   * o dinheiro parado nao faz nada
   */
  BUY: "buy",

  /**
   * O QUE NAO ESTEVE AQUI: `breakdown`, para entregar peca no codigo.
   *
   * O tutorial faria sentido — sem ele o inventario vira deposito — mas o
   * jogo nao tem o sistema. O `codexView` sabe LER a criatura e a
   * `Collection` sabe RECEBER material; nenhum dos dois tem o caminho de
   * "jogador entrega uma peca e ela vira alguma coisa"
   *
   * Declarar o tipo aqui sem o sistema seria um tutorial que nunca fecha:
   * o `QuestLog` contero, o painel mostraria, e o jogador ficaria preso
   * nisso sem nenhuma acao do jogo que o fizesse andar. Quando o
   * sistema existir, o tipo entra aqui e no `onAcao` do motor junto
   */
};

/**
 * OS TIPOS QUE ABREM UM PAINEL EM VEZ DE LEVAR A UM LUGAR.
 *
 * E a lista que o `QuestPanel` le para trocar o "Vá a {zona}" por um botao
 * que abre a aba certa. `HUNT` e `KILL` NAO estao aqui: eles tem zona, e o
 * auto sabe levar o jogador ate ela
 *
 * `EQUIP` e `LEVEL` tambem nao estao: o primeiro precisa de uma peca na mao
 * e o segundo nao tem lugar nenhum, entao nenhum dos dois abre painel
 */
export const TIPOS_COM_PAINEL = new Set([
  QUEST_TYPE.CRAFT,
  QUEST_TYPE.ENCHANT,
  QUEST_TYPE.ENHANCE,
  QUEST_TYPE.DELIVER,
  QUEST_TYPE.BUY,
]);

/**
 * OS TIPOS QUE O `QuestLog` CONTA POR `onAcao`.
 *
 * E este conjunto, e nao o `TIPOS_COM_PAINEL`, que diz o que o motor
 * consegue contar. Sao quase os mesmos, e a diferenca e o tutorial de
 * minerar: ele tem um `target` e um `count`, o motor conta a batida, mas
 * ele nao abre painel nenhum — o painel dele aponta para o mapa
 *
 * `EQUIP` e `LEVEL` nao estao aqui pelos motivos opostos: os dois contam por
 * metodo proprio (`onEquipRarity` e `syncLevel`) porque os dois comparam o
 * que o jogador TEM, e nao um evento que aconteceu
 */
export const TIPOS_DE_TUTORIAL = new Set([
  QUEST_TYPE.CRAFT,
  QUEST_TYPE.ENCHANT,
  QUEST_TYPE.ENHANCE,
  QUEST_TYPE.MINE,
  QUEST_TYPE.DELIVER,
  QUEST_TYPE.LEARN_SKILL,
  QUEST_TYPE.BUY,
]);

/**
 * O PAINEL DE CADA TUTORIAL.
 *
 * E o `PAINEL` do `HUD`, e a chave e o `id` do botao que abre aquela aba.
 * Vive aqui e nao no `QuestPanel` porque o painel e quem CONSOME este
 * mapa, e ele nao pode importar o `HUD` sem criar um ciclo — o `HUD`
 * importa o `QuestPanel`
 *
 * ## POR QUE SO OS QUE TEM ABA
 *
 * Porque um tutorial que abre um painel precisa que o painel exista com
 * esse nome. `hunt` e `equip` lead para o mapa e para o inventario, que sao
 * coisas de tela cheia e nao abas da HUD
 */
export const PAINEL_DO_TUTORIAL = {
  [QUEST_TYPE.CRAFT]: "craft",
  [QUEST_TYPE.ENCHANT]: "enchant",
  [QUEST_TYPE.ENHANCE]: "enchant",
  [QUEST_TYPE.DELIVER]: "collection",
  [QUEST_TYPE.BUY]: "loja",

  /**
   * A MINERACAO NAO TEM PAINEL, E O BOTAO VAI PARA O VALE.
   *
   * Porque a mineracao nao e uma aba: e um clique numa pedra do mapa. O
   * `MineracaoPanel` so abre DEPOIS que o jogador chega nela, e ele precisa
   * estar encostado. Um botao que abrisse um painel de mineracao mostraria o
   * vazio, porque o painel precisa de uma `propId` que so vem do clique no
   * mapa
   *
   * O tutorial de minerar por isso e o unico que nao usa este mapa: o painel
   * dele diz "Procure uma pedra no Vale das Cinzas", que e o que o auto sabe
   * fazer — levar o jogador ate a zona
   */

  /**
   * O CODEX TAMBEM NAO TEM PAINEL NA HUD.
   *
   * O codex e aberto pelo item, pelo atalho, e nao por um botao da fileira.
   * Colocar um botao para ele aqui seria um botao a mais numa fileira que ja
   * tem oito, e ele nao se juntaria aos outros: os outros paineis sao de
   * consulta rapida, e o codex e de leitura longa
   */
};

/**
 * A ABA QUE ABRE DENTRO DO PAINEL.
 *
 * ## POR QUE SO ENCANTAR E APRIMORAR PRECISAM DISSO
 *
 * Porque `enchant` e o UNICO painel do mapa que tem duas abas: encantar e
 * aprimorar. Os dois tutorials apontam para o mesmo `painel`, e sem este
 * mapa o painel abria sempre na primeira aba — a missao de aprimorar
 * mandava o jogador para a tela de encantar
 *
 * ## POR QUE O `includes` DO PAINEL JA NAO RESOLVE
 *
 * Porque o `EnchantPanel` so troca de aba quando o `abaInicial` MUDA. A
 * aba nasce em `useState("encantar")` e o efeito so roda quando o valor
 * recebido e diferente. Quem precisa dizer qual aba abrir e o botao da box,
 * e nao o painel: o painel nao sabe que tutorial o jogador esta fazendo
 */
export const ABA_DO_TUTORIAL = {
  [QUEST_TYPE.ENCHANT]: "encantar",
  [QUEST_TYPE.ENHANCE]: "aprimorar",
};

/**
 * O NPC QUE O TUTORIAL MANDA O JOGADOR ATENDER.
 *
 * E o outro lado de "nao abre painel": um tutorial pode ser feito em uma
 * pessoa, e nao em uma aba. O livro de habilidade e vendido pelo mestre de
 * habilidades, que mora na base — e nao pela loja de diamantes
 *
 * ## POR QUE O ID E DE DADO E NAO UM NOME
 *
 * Porque e o `id` que o motor procura no mapa da base para saber a
 * coordenada. Um nome viraria busca por texto, e o motor teria de adivinhar
 * o NPC certo em uma lista
 *
 * ## POR QUE ISSO NAO E UM PAINEL
 *
 * Porque o mestre de habilidades nao abre um painel: ele e um NPC em pe no
 * calcamento. Mandar o jogador ate ele e um caminhar, e o que o `travelPlan`
 * ja faz sozinho quando o destino esta em outro mapa
 */
export const NPC_DO_TUTORIAL = {
  [QUEST_TYPE.LEARN_SKILL]: "npc_habilidades_base",
};

/**
 * O VERBO QUE O TUTORIAL ENSINA, no gerundio.
 *
 * E o que o painel escreve no card. A lista e escrita e nao montada com
 * template porque o gerundio do portugues nao se tira do substantivo:
 * "craft" viraria "craftndo", e o texto errado em seis idiomas de programa
 * e o tipo de coisa que passa reta e se lê por anos
 */
export const VERBO_DO_TUTORIAL = {
  [QUEST_TYPE.CRAFT]: "Aprendendo a criar",
  [QUEST_TYPE.ENCHANT]: "Aprendendo a encantar",
  [QUEST_TYPE.ENHANCE]: "Aprendendo a aprimorar",
  [QUEST_TYPE.MINE]: "Aprendendo a minerar",
  [QUEST_TYPE.DELIVER]: "Aprendendo a entregar",
  [QUEST_TYPE.LEARN_SKILL]: "Aprendendo a usar",
  [QUEST_TYPE.BUY]: "Aprendendo a comprar",
};

export const QUEST_SCOPE = {
  MAIN: "main",
  SIDE: "side",
};

export const AUTO_TYPES = new Set([
  QUEST_TYPE.HUNT,
  QUEST_TYPE.KILL,

  /**
   * A MINERACAO ENTROU NO AUTO.
   *
   * E o unico dos tres que nao e cacada, e ele destoa por um motivo
   * concreto: os outros dois tem um alvo que se MOVE pelo mapa, e o auto
   * precisa de um `location` para chegar perto e esperar. O tutorial de
   * minerar nao se move: ele tem uma PEDIDA, e o auto sabe ir ate uma prop
   *
   * Sem esta linha, `temDestinoDeAuto` devolvia `false` e o `objective()`
   * devolvia `null`: o auto ligava, o painel dizia que a missao era o
   * objetivo, e o personagem ficava parado porque nao havia destino
   */
  QUEST_TYPE.MINE,
]);

export function isAutoCompletable(quest) {
  return Boolean(quest) && AUTO_TYPES.has(quest.type);
}

/**
 * OS TIPOS QUE O AUTO SABE LEVAR ATE, e nao so completar.
 *
 * ## A DISTINCAO QUE FALTAVA
 *
 * `isAutoCompletable` responde "o auto sozinho fecha essa missao?", e a
 * resposta e nao para sete dos sete tutorials: nenhum deles e "mate N bicho".
 * Mas essa resposta estava sendo usada para uma segunda pergunta — "o auto
 * tem para onde andar?" — e as duas nao sao a mesma coisa
 *
 * O sintoma foi o botao "IR ATE O NPC" da missao do livro: ele ligava o
 * auto, o `toggleQuestAuto` chamava `objective()`, recebia `null` porque
 * `LEARN_SKILL` nao esta no `AUTO_TYPES`, e desligava o auto de novo
 * mostrando "Nenhuma missao automatica disponivel". O botao acionado nao
 * acontecia
 *
 * ## POR QUE O `LEARN_SKILL` ENTRA AQUI
 *
 * Porque ele e o unico dos sete que tem um LUGAR: um NPC em outro mapa. Os
 * outros seis tem aba, e aba nao se alcanca a pe. Este tem um destino de
 * verdade, e o `travelPlan` sabe ir la atravessando portal
 *
 * E o auto para quando chega: ele leva o jogador ate o mestre e para. Quem
 * compra o livro e usa e o jogador, nao o auto — por isso ele NAO esta no
 * `AUTO_TYPES`, e o card continua pedindo acao manual
 */
export const TIPOS_COM_DESTINO = new Set([
  ...AUTO_TYPES,
  QUEST_TYPE.LEARN_SKILL,
]);

export function temDestinoDeAuto(quest) {
  return Boolean(quest) && TIPOS_COM_DESTINO.has(quest.type);
}

/**
 * A ESCADA DE MISSOES DO MAPA 1.
 *
 * Uma linha por degrau de nivel, na ordem em que o jogador sobe. E a
 * fonte da verdade: `MAIN_QUESTS` e `SIDE_QUESTS` sao geradas daqui, o
 * que torna as duas metades da regra impossiveis de furar
 *
 * ## A ORDEM
 *
 * Do limo de nivel 1 no Pantano ao ogre de nivel 12 na Floresta. Os
 * niveis nao sobem de um em um em todo o mapa — o limo pula do 6 para o
 * 7, que e o ogre da predeira do campo de provas, e do 7 para o 8, que e
 * o ogre comum da Cripta
 *
 * ## A QUANTIDADE SOBE COM O NIVEL
 *
 * De 10 na primeira para 32 na ultima: mais 2 por degrau. E o que faz a
 * campanha nao ficar trivial no fim — o jogador leva tres vezes mais
 * trabalho no topo do que na entrada
 *
 * ## A ZONA E O `target` COM `minLevel`
 *
 * `location` e onde o auto leva o jogador; `target` com `minLevel` e o
 * que faz o abate contar. Um limo nasce no nivel 1 ou 2 no Pantano e no
 * 6 no Brejo, entao o `minLevel` e o que separa um degrau do outro
 */
/**
 * A ESCADA da campanha do mapa 1.
 *
 * Exportada porque o bestiario e a colecao tiram dela a quantidade base
 * de cada criatura: a cacada de stats e a entrega de colecao sao a
 * missao principal da zona repetida em doses maiores
 */
/**
 * A ESCADA da campanha do mapa 1.
 *
 * ## VAZIA DE PROPOSITO NESTA ETAPA
 *
 * A escada antiga apontava para materiais que foram apagados na troca
 * de drop, e missao de material que ninguem dropa e uma missao que nunca
 * fecha. A escada volta a ser escrita no proximo passo, ja com os
 * materiais novos
 *
 * Ela continua sendo EXPORTADA e continua sendo uma lista, porque o
 * bestiario e a colecao tiram dela a quantidade base de cada criatura,
 * e os dois leem este nome sem saber que ele esta vazio
 */
export const ESCADA_MAPA_1 = [
    {
      target: "slime",
      nivel: 1,
      zona: "pantano",
      nome: "O Pantano",
      mapa: "map_1",
    },

    {
      target: "slime",
      nivel: 2,
      zona: "pedreira",
      nome: "A Pedreira",
      mapa: "map_1",
    },

    {
      target: "slime",
      nivel: 3,
      zona: "dunas",
      nome: "As Dunas",
      mapa: "map_1",
    },

    {
      target: "slime",
      nivel: 4,
      zona: "cinzas",
      nome: "O Vale das Cinzas",
      mapa: "map_1",
    },

    {
      target: "slime",
      nivel: 5,
      zona: "toca",
      nome: "A Toca dos Ratos",
      mapa: "map_1",
    },

    {
      target: "slime",
      nivel: 6,
      zona: "brejo",
      nome: "O Brejo",
      mapa: "map_1",
    },

    {
      target: "ogre",
      nivel: 8,
      zona: "cripta",
      nome: "A Cripta",
      mapa: "map_1",
    },

    {
      target: "ogre",
      nivel: 9,
      zona: "ruinas",
      nome: "As Ruínas",
      mapa: "map_1",
    },

    {
      target: "ogre",
      nivel: 10,
      zona: "campina",
      nome: "A Campina Gelada",
      mapa: "map_1",
    },

    {
      target: "ogre",
      nivel: 11,
      zona: "acampamento",
      nome: "O Acampamento Goblin",
      mapa: "map_1",
    },

    {
      target: "ogre",
      nivel: 12,
      zona: "floresta",
      nome: "A Floresta Sombria",
      mapa: "map_1",
    },

    /*
      O TOPO DO MAPA 1: O CHEFE.

      ## POR QUE UM CAMPO `chefe` E NAO SO UM `target`

      Porque `target: "hulk"` sozinho deixa a missao igual a qualquer
      outra: ela aponta para uma criatura, o auto leva ate a zona, e o
      jogador mata o que for preciso. Faltaria a parte que importa — o
      CHEFE VIVE NA ARENA, e a arena fica atras deste exato portal

      ## O CIRCULO QUE ESTE CAMPO DESFAZ

      O portal `portal_floresta` e o que abre o mapa 2, e ele so abre
      terminando o mapa 1. A ultima missao do mapa 1 e esta. O jogador
      chegaria nela e veria: "mate o Hulk", sendo que o Hulk esta na arena,
      e a arena fica do outro lado deste portal — que so abre quando esta
      missao estiver feita

      Ele descobriria o impossibility depois de dezoito degraus. O campo
      `chefe` existe para a `PortalBox` oferecer "Enfrentar o chefe" em vez
      de um "Selado" sem saida

      ## POR QUE A ZONA E `arena`

      Porque e onde o chefe esta, e o `location` da missao e o que o painel
      escreve em "Va a {zona}". Escrever `floresta` deixaria o jogador
      cacando goblin em uma missao de quem nao esta la
    */
    {
      target: "hulk",
      nivel: 20,
      zona: "arena",
      nome: "O Hulk",
      mapa: "map_1",
chefe: {
        criatura: "hulk",
        nome: "Hulk",
        arena: "boss_1",
      },
    },
  ];

/**
 * A RECOMPENSA DE MATERIAL de uma missao de cacada.
 *
 * ## POR QUE ELA SAI DO `loot` DA CRIATURA
 *
 * Porque a recompensa e o drop da criatura que a missao manda matar. Se
 * fosse uma lista escrita aqui, a missao do esqueleto poderia pagar
 * couro de goblin â e o jogador receberia um material que a criatura que
 * ele acabou de matar nem tem, sem nenhuma explicacao
 *
 * ## POR QUE SO O PRIMEIRO ITEM, E NAO O MAIS PESADO
 *
 * Porque o primeiro item do `loot` e o material PRINCIPAL da criatura, e
 * ele esta no comeco por construcao: as tabelas foram escritas nessa
 * ordem. Pegar o mais pesado por peso seria mais correto em teoria e mais
 * fragil na pratica â reordenar o pool por balanceamento trocaria a
 * recompensa da missao sem ninguem mexer na missao
 *
 * ## POR QUE VOLTA VAZIA E NAO QUEBRA
 *
 * Porque uma criatura sem loot, ou um pool vazio, e o mesmo que "esta
 * missao nao paga material". Quebrar aqui derrubaria o modulo de missoes
 * inteiro, e uma recompensa a menos e um problema pequeno
 */
/**
 * A RECOMPENSA DO DEGRAU: MATERIAL DA CRIATURA + A PREPARO DO TUTORIAL.
 *
 * ## POR QUE OS ITENS SAO SOMADOS E NAO DUPLICADOS
 *
 * Porque o degrau do Pantano paga `osso_quebrado x 5` duas vezes — uma como
 * material da criatura e outra como preparo do tutorial de craft. O
 * `Inventory.add` empilha as duas e o jogador receberia 10 em uma entrega so,
 * com o painel mostrando dois icones de osso de 5
 *
 * A soma por `itemId` e o que evita isso: as duas viram uma pilha de 10, e o
 * tutorial continuaExecutable porque 10 e maior que 5
 *
 * E a contagem e SOMADA mesmo quando o preparo repetir o material: dar 5 para
 * craft e mais 5 de preparo e 10 no total, e nao 5. O preparo existe para
 * garantir o MINIMO, e ele nunca pode DIMINUIR o que o degrau ja pagava
 */
function recompensaDoDegrau(degrau) {
  const material = recompensaEmMaterial(degrau.target);

  const preparacao = PREPARA_PARA[degrau.nome]?.extra ?? [];

  const porItem = new Map();

  for (const item of [...material, ...preparacao]) {
    const anterior = porItem.get(item.itemId);

    porItem.set(item.itemId, {
      itemId: item.itemId,
      count: (anterior?.count ?? 0) + item.count,
      ...(item.rarity ? { rarity: item.rarity } : {}),
    });
  }

  return [...porItem.values()];
}

function recompensaEmMaterial(creatureId) {
  const loot = CREATURE_TYPES[creatureId]?.loot;

  const primeiro = loot?.items?.[0];

  if (!primeiro) return [];

  return [{ itemId: primeiro.id, count: 5 }];
}

/**
 * O QUE O DEGRAU ENTREGA PARA O TUTORIAL QUE VEM DEPOIS.
 *
 * ## O PROBLEMA QUE ESTE MAPA RESOLVE
 *
 * Os sete tutorials teachem sistemas que dependem de DROPS, e drop e
 * acaso. O jogador chega no tutorial de criar e pode ter 3 ossos em vez de
 * 5. Chega no de encantar e nunca achou um arco. E o de habilidade e
 * IMPOSSIVEL: o livro de skill nao dropa de nenhum mob do jogo
 *
 * Sem isto o jogador fica parado numa missao que ele nao pode fechar, e o
 * painel mostra "aguardando" sem dizer o que ele precisa
 *
 * ## POR QUE A ENTREGA E NO DEGRAU ANTERIOR, E NAO NO TUTORIAL
 *
 * Porque o tutorial nao paga a si mesmo. Se a entrega viesse junto da
 * missao de tutorial, ela apareceria DEPOIS de concluida — tarde demais
 *
 * ## POR QUE ISTO NAO E UM ITEM DE GRAÇA
 *
 * Porque nao e. Sao 5 ossos a mais em um degrau que ja paga ouro e xp, e
 * uma aljava no segundo. O jogador continua caçando — ele ganha o que o
 * proximo passo exige E o ouro do degrau. E o preco de Ensinar e uma missao
 * de cacada, nao um item
 *
 * A excecao e o livro de habilidade, que dropa de NINGUEM: la nao ha
 * alternativa. Ele vai como recompensa do degrau da Cripta, e e o unico item
 * do jogo que o jogador recebe garantido
 */
const PREPARA_PARA = {
  "O Pantano": {
    /**
     * O CRAFT PRECISA DE 5, E A RECOMPENSA COMUM ERA 4.
     *
     * Era um abate de margem: o jogador terminava o primeiro degrau com
     * material suficiente e um item a menos, e o tutorial de criar virava uma
     * caça a mais antes de qualquer coisa — que e a pior forma de ensinar
     */
    extra: [{ itemId: "osso_quebrado", count: 5 }],
  },

  "A Pedreira": {
    /**
     * O ENCANTAR PRECISA DE UMA PEÇA, e o arco e a aljava so dropam por
     * acaso — no peso deles no pool, e nao na certeza
     *
     * A aljava e a escolha e nao o arco porque e `uncommon`, o arco tambem, e
     * a aljava cabe no slot `weapon2`: um arquiro que ja esta equipado troca
     * de mao, e um arqueiro sem arco e um personagem sem arma principal
     */
    extra: [{ itemId: "aljava_arbalist", count: 1, rarity: RARITY.COMMON }],
  },

  "A Toca dos Ratos": {
    /**
     * A COLECAO PEDE 20 DO MATERIAL, e a recompensa do degrau pagava 5.
     *
     * Sem isto o jogador terminaria o tutorial de entrega e ainda teria de
     * voltar a caçar so para ter material dela — e o tutorial viraria um
     * aviso de que existe outra coisa para fazer, que e o oposto de ensinar
     */
    extra: [{ itemId: "osso_quebrado", count: 20 }],
  },

  "A Cripta": {
    /**
     * O LIVRO DE HABILIDADE, e ele NAO DROPA DE NINGUEM.
     *
     * `livro_quick_shot` esta no catalogo e nao esta em nenhum pool de loot do
     * jogo. Sem esta entrega o tutorial de habilidade e IMPOSSIVEL de
     * concluir, por mais que o jogador caque ate o topo da campanha
     *
     * E a unica entrega garantida do jogo, e o motivo e esse: nao ha drop
     * para usar. A raridade e `rare` porque e o que o catalogo declara, e nao
     * porque foi pensado para o tier do degrau
     */
    extra: [{ itemId: "livro_quick_shot", count: 1 }],
  },
};

/**
/**
 * O numero de inimigos do degrau, e CADA MAPA TEM A SUA CURVA.
 *
 * ## AS DUAS PONTAS DECLARADAS, e nao uma serie que atravessa os dois
 *
 * ```
 * mapa 1:  10 -> 24    (a Floresta Sombria e o topo do vale)
 * mapa 2:  24 -> 48    (o Pântano Final e o topo do segundo mapa)
 * ```
 *
 * E o FIM do mapa 1 que e o COMECO do mapa 2. Nao e coincidencia numerica: o
 * mapa 2 comeca no nivel 13 com o jogador que acabou de limpar o vale, e a
 * campanha inteira dele roda numa faixa que o vale nao usava. Sem isso, os
 * dois mapas subiriam a mesma serie e o segundo seria mais repeticao que
 * dificuldade
 *
 * ## POR QUE GEOMETRICA E NAO SOMADA
 *
 * Porque a diferenca entre o primeiro e o ultimo degrau e o que o jogador
 * SENTE como escalada, e uma soma linear entrega degraus iniciais quase
 * iguais: `10 + 1.4 * n` daria 10, 11, 13 e 14 ate 24 — tres degraus seguidos
 * com 10, 11 e 13 abates, indistinguiveis
 *
 * A interpolacao geometrica pune a mesma carga em todo o mapa: os primeiros
 * degraus sao rapidos e o topo pesa, que e a forma como a dificuldade de uma
 * campanha deve crescer
 *
 * ## O QUE A ESCALA RESPEITA
 *
 * Cada zona tem entre 6 e 14 mobs vivos, e a missao se cumpre em ondas. Com
 * 48 no topo do mapa 2 e 7 no campo, sao 7 ondas — o maximo aceitavel sem
 * passar meia hora no mesmo lugar
 */
const CURVA_POR_MAPA = {
  /**
   * O VALE: 10 no Pantano, 24 na Floresta.
   *
   * E o primeiro mapa do jogo, e a curva e deliberadamente curta. Um jogador
   * novo encontra 10 esqueletos no primeiro degrau e 24 no ultimo: ele termina
   * o mapa sabendo o que e uma missao de cacada, e nao cansado dela
   */
  map_1: { inicio: 10, fim: 24 },

  /**
   * O SEGUNDO MAPA: 24 na Floresta Cinzenta, 48 no Pântano Final.
   *
   * Comeca onde o vale terminou e termina no DOBRO do topo do vale. O jogador
   * entra aqui no nivel 13 e sai no 25, e a quantidade dobra no caminho — e ele
   * ja conhece cada sistema do jogo, entao a dificuldade extra e de volume e
   * de mob mais forte, nao de feature nova
   */
  map_2: { inicio: 24, fim: 48 },
};

/**
 * QUANTOS INIMIGOS NESTE DEGRAU.
 *
 * E a interpolacao geometrica entre as duas pontas da curva do mapa:
 *
 * ```
 * razao = (fim / inicio) ^ (1 / (total - 1))
 * quantidade = inicio * razao ^ (posicao - 1)
 * ```
 *
 * Com `total = 11`, `inicio = 10` e `fim = 24`, a razao da 1.091 e a serie
 * sai 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 24
 *
 * ## POR QUE `Math.round` E NAO `Math.floor`
 *
 * Porque `1.091 ^ 6` da 1.68, e o truncar daria 16 num degrau que deveria
 * custar 17. Arredondando a serie fecha em numeros redondos de verdade
 */
function quantidadeDoDegrau(mapa, posicao, total) {
  const curva = CURVA_POR_MAPA[mapa] ?? CURVA_POR_MAPA.map_1;

  /**
   * UM MAPA COM UM SO DEGRAU.
   *
   * E o `1 / 0` da razao devolvendo `Infinity`, e o `inicio * Infinity`
   * virando `NaN`. Um mapa novo com uma missao so receberia `NaN` na
   * quantidade — que o painel desenharia como "NaN esqueletos"
   */
  if (total <= 1) return curva.inicio;

  const razao = (curva.fim / curva.inicio) ** (1 / (total - 1));

  return Math.round(curva.inicio * razao ** (posicao - 1));
}

/**
 * O OURO da missao.
 *
 * ## A REGRA QUE ESTE NUMERO CUMPRE
 *
 * O ouro que um mob da tem que ser MENOR que o da missao do campo dele.
 * Com 45 por nivel, o degrau 1 paga 45 contra os 9 que o mob da, e o
 * degrau 12 paga 540 contra os 190 do ogre
 *
 * ## POR QUE 45 E NAO A QUANTIDADE
 *
 * A primeira versao pagava `quantidade * 4`, o que dava 40 no degrau 1 e
 * 128 no degrau 12 â abaixo do drop do proprio ogre. Ligar a 45 por nivel
 * e ao nivel, e nao a quantidade: e o que a regiao custa que o jogador
 * recebe, e a quantidade e o preco de chegar la
 */
function ouroDoDegrau(nivel) {
  return nivel * 45;
}

/**
 * O XP da missao.
 *
 * ## A REGRA
 *
 * O XP de um mob morto nao pode ser maior que o da missao do campo. O
 * `xpForKill` e `maxHp * 0.6`, entao o piso da missao e o dobro do XP de
 * UM mob do degrau
 *
 * ## POR QUE O PISO E SO O COMUM
 *
 * Um degrau futuro pode ser a virada de criatura, e ligado so no HP o XP da
 * missao CAI no degrau em que o mob da zona fica mais forte que o do
 * degrau anterior. E por isso que o piso e o maximo entre o mob da zona e
 * o degrau anterior mais um degrau: a missao paga sempre mais que o
 * anterior, e sempre mais que o mob que ela manda matar
 */
function xpDoDegrau(nivel, xpDeUmMob, xpDoDegrauAnterior) {
  return Math.max(
    Math.round(xpDeUmMob * 2),
    (xpDoDegrauAnterior ?? 0) + 20,
  );
}

/**
 * O NOME CURTO da criatura, para o id.
 *
 * O `target` fica em ingles (`slime`) porque e o que o `onKill` compara e
 * o `id` da missao vai para o save. O nome que o jogador le e em
 * portugues, e e `NOME_LEGIVEL` abaixo
 *
 * ## POR QUE ESTA TABELA NAO SAIU NA TROCA DE MATERIAL
 *
 * Porque ela nao tem nada a ver com material: e o nome da CRIATURA, e a
 * criatura nao mudou quando os materiais dela foram trocados. O `slime`
 * continua sendo o mesmo `id` â ele que e a chave do save e do bestiario
 */
const NOME_CURTO = {
  slime: "limo",
  ogre: "ogre",
  ogre_da_predeira: "ogre_predeira",
  skeleton: "sentinela",
zumbi_arbalist: "arqueiro_zumbi",
    hulk: "hulk",
  };

/**
 * O nome da criatura como o jogador ve.
 *
 * ## POR QUE DIZ "ESQUELETO" E NAO "LIMO"
 *
 * Porque o `slime` virou esqueleto na tela: a arte e o `name` do catalogo
 * de criaturas mudaram, e so o `id` ficou â ele e a chave do save, das
 * cacadas e das missoes ja feitas
 *
 * A missao nova tem que chamar a criatura pelo nome que o jogador ve. Um
 * "mate 10 limos" apontando para um esqueleto seria um texto que descreve
 * uma criatura que o jogo nao tem
 */
const NOME_LEGIVEL = {
  slime: "Esqueleto",
  ogre: "Goblin",
  ogre_da_predeira: "goblin da pedreira",
  skeleton: "Kaelen",
zumbi_arbalist: "Nylara",
    hulk: "Hulk",
  };

/**
 * A ZONA em portugues, para o texto da missao.
 *
 * E o que a zona chama no dado, e nao uma tabela que diverge: se a zona
 * mudar de nome, o texto da missao acompanha
 *
 * As chaves do mapa 2 NAO estao aqui. Elas seguem o prefixo `m2_` das
 * zonas do mapa 2, e sao resolvidas por `nomeDaZona`, que le o `name` do
 * registro da zona. Uma entrada `m2_floresta` aqui seria a mesma
 * palavra escrita duas vezes, e a segunda seria a que divergiria
 */
const ZONA_LEGIVEL = {
  pantano: "Pântano Profundo",
  pedreira: "Pedreira do Ogro",
  dunas: "Dunas Perdidas",
  cinzas: "Vale das Cinzas",
  toca: "Toca dos Ratos",
  brejo: "Brejo Lento",
  treino: "Campo de Provas",
  cripta: "Cripta Esquelâtica",
  ruinas: "Ruânas dos Ghouls",
  campina: "Campina Gelada",
  acampamento: "Acampamento Goblin",
  floresta: "Floresta Sombria",
};

/**
 * O NOME DE UMA ZONA, seja do mapa 1 ou do mapa 2.
 *
 * A tabela acima so conhece o mapa 1. O mapa 2 tem as mesmas 12 zonas com
 * o prefixo `m2_`, e o jeito de nao escrever 12 entradas novas e o
 * `baseId`: a zona `m2_floresta` declara `baseId: "floresta"`, que e a
 * chave da tabela
 *
 * Cai no `name` do registro como ultimo recurso: e melhor mostrar o nome
 * que a zona realmente tem do que mostrar `undefined` no texto da missao
 */
function nomeDaZona(zoneId) {
    /**
     * O NOME DA ZONA, e nao o nome do MAPA 1.
     *
     * A `ZONA_LEGIVEL` acima so conhece o vale. Ela e a PRIMEIRA opcao porque
     * e onde estao os nomes escritos a mao do mapa 1 — mas ela nao pode
     * atender o mapa 2: as duas metades do jogo tem as mesmas doze zonas com
     * o mesmo nome curto, e `m2_floresta` casaria com `floresta` e o jogador
     * leria "Floresta Sombria" num degrau do outro mapa
     *
     * O `getZoneById` vem ANTES do fallback por id, e ele le o `name` do
     * registro real da zona. E o que faz o degrau `m2_floresta` dizer
     * "Floresta Sombria" — que e o nome que o jogador ve no minimapa, e nao
     * uma segunda traducao inventada aqui
     *
     * A ordem e: registro real, depois a tabela escrita, depois o proprio id.
     * O registro primeiro porque ele e a verdade do mapa; a tabela depois
     * porque cobre as zonas do hub que o `getZoneById` pode nao conhecer
     */
    const zona = getZoneById(zoneId);

    if (zona?.name) return zona.name;

    const base = zoneId.startsWith("m2_")
      ? zoneId.slice(3)
      : zoneId;

    return ZONA_LEGIVEL[base] ?? zoneId;
  }

/**
 * O `id` de uma missao da escada.
 *
 * O INDICE do degrau entra no id, e nao o nivel: se uma linha da
 * escada mudar de nivel, o id nao muda e o save do jogador continua
 * apontando para a missao certa
 *
 * ## POR QUE O MAPA ENTRA NO ID
 *
 * `map1_main_1_limo_pantano` e `map2_main_13_arqueiro_zumbi_m2_floresta`
 * sao de mapas diferentes, e o save guarda o id. Sem o mapa no id, os
 * dois mapas teriam ids que so diferem no indice, e uma missao do mapa 2
 * recem-criada poderia colidir com uma do mapa 1
 */
function idDoDegrau(mapa, indice, curto, zona, suffix = "") {
  return `${mapa}_main_${indice}_${curto}_${zona}${suffix}`;
}

/**
 * O XP do degrau de CACADA anterior na campanha.
 *
 * ## POR QUE PRECISA PULAR O TUTORIAL
 *
 * Porque a campanha agora tem passos de dois tipos, e so os de cacada tem
 * `target` de criatura. A funcao andava para tras pelo indice e lia
 * `anterior.target` — que e `undefined` no passo de tutorial, e o
 * `CREATURE_TYPES[undefined]` derrubava o modulo inteiro na primeira
 * importacao
 *
 * E ela nao pode simplesmente pegar o passo anterior: o tutorial de craft
 * entra DEPOIS do primeiro degrau, entao o degrau seguinte leria um tutorial
 * e nao acharia criatura nenhuma
 *
 * ## POR QUE RECURSA E NAO ITERATIVO
 *
 * Porque o piso de XP e uma escada crescente, e ela so existe DEPOIS que a
 * campanha esta montada. Ler `CAMPANHA` de dentro dela e seguro porque e
 * uma `const` que ja foi avaliada quando o `MAIN_QUESTS.map` chama: o
 * `CAMPANHA` e declarado antes do `MAIN_QUESTS`
 */
function xpDoDegrauAnterior(indice) {
  if (indice <= 0) return 0;

  /**
   * ANDA PARA TRAS ATE ACHAR UM PASSO DE CACADA.
   *
   * E o `indice - 1` que comeca a busca: o passo na propria posicao ja esta
   * sendo pago agora, e o que ele precisa e do que veio antes
   */
  let anterior = null;

  for (let i = indice - 1; i >= 0; i -= 1) {
    const passo = CAMPANHA[i];

    if (passo?.tutorial) continue;

    anterior = passo;
    break;
  }

  /**
   * NAO HOU DEGRAU DE CACADA ANTES DESTE.
   *
   * E o caso do primeiro degrau, e o piso e o XP de UM mob do proprio
   * degrau. Devolver 0 aqui faria o primeiro degrau pagar `xpDeUmMob * 2`
   * sem ninguem contra o qual se comparar
   */
  if (!anterior) return 0;

  const tipoAnterior = CREATURE_TYPES[anterior.target];

  if (!tipoAnterior) return 0;

  const hpAnterior = scaleForLevel(
    tipoAnterior,
    anterior.nivel,
  ).maxHp;

  const xpDeUmMobAnterior = Math.max(
    1,
    Math.round(hpAnterior * BALANCE.xpShare.creature),
  );

  return xpDoDegrau(
    anterior.nivel,
    xpDeUmMobAnterior,
    xpDoDegrauAnterior(indice - 1),
  );
}

/**
 * A ESCADA da campanha do mapa 2, tambem vazia nesta etapa, pela mesma
 * razao da do mapa 1
 */
/**
 * A ESCADA da campanha do mapa 2.
 *
 * ## O `m2_` DO `zona` NAO E OPCIONAL
 *
 * As duas escadas tem as MESMAS doze zonas com o mesmo nome curto: `floresta`
 * existe no mapa 1 e no mapa 2. A unica coisa que as separa e o prefixo, e ele
 * e o que o painel de missoes le para escolher a aba — `mapaDaZona` faz
 * `zoneId.startsWith("m2_")`
 *
 * Sem o prefixo, os onze degraus do mapa 2 apareciam TODOS na aba do mapa 1.
 * A aba do mapa 2 ficava vazia e o jogador via a campanha inteira do vale
 * duas vezes. Nenhum erro, nenhum aviso: o `location` existia e era um nome de
 * zona VALIDO, so que nao era o certo
 *
 * E por isso que `nomeDaZona` tira o `m2_` antes de procurar o nome em
 * portugues: o jogador le "Floresta Cinzenta", e nao "m2_floresta"
 */
export const ESCADA_MAPA_2 = [
    {
      target: "skeleton",
      nivel: 13,
      zona: "m2_floresta",
      nome: "A Floresta Cinzenta",
      mapa: "map_2",
    },

    {
      target: "skeleton",
      nivel: 14,
      zona: "m2_acampamento",
      nome: "O Acampamento Silencioso",
      mapa: "map_2",
    },

    {
      target: "skeleton",
      nivel: 15,
      zona: "m2_campina",
      nome: "A Campina Morta",
      mapa: "map_2",
    },

    {
      target: "skeleton",
      nivel: 16,
      zona: "m2_ruinas",
      nome: "As Ruínas Afogadas",
      mapa: "map_2",
    },

    {
      target: "skeleton",
      nivel: 17,
      zona: "m2_cripta",
      nome: "A Cripta Profunda",
      mapa: "map_2",
    },

    {
      target: "zumbi_arbalist",
      nivel: 20,
      zona: "m2_brejo",
      nome: "O Brejo Podre",
      mapa: "map_2",
    },

    {
      target: "zumbi_arbalist",
      nivel: 21,
      zona: "m2_toca",
      nome: "A Toca Enorme",
      mapa: "map_2",
    },

    {
      target: "zumbi_arbalist",
      nivel: 22,
      zona: "m2_cinzas",
      nome: "As Cinzas Eternas",
      mapa: "map_2",
    },

    {
      target: "zumbi_arbalist",
      nivel: 23,
      zona: "m2_dunas",
      nome: "As Dunas do Vazio",
      mapa: "map_2",
    },

    {
      target: "zumbi_arbalist",
      nivel: 24,
      zona: "m2_pedreira",
      nome: "A Pedreira Sem Fundo",
      mapa: "map_2",
    },

    {
      target: "zumbi_arbalist",
      nivel: 25,
      zona: "m2_pantano",
      nome: "O Pântano Final",
      mapa: "map_2",
    },
  ];

/**
 * A ESCADA INTEIRA, e nao so a do mapa 1.
 *
 * E a concatenacao das duas, e e daqui que saem as missoes principais e
 * secundarias. Continua sendo um `const` derivado e nao uma lista escrita
 * a mao, porque as duas metades vem de arquivos diferentes e o
 * `indiceDaUltimaMissao` precisa saber onde o mapa 2 comeca
 */
const ESCADA = [
    ...ESCADA_MAPA_1,
    ...ESCADA_MAPA_2,
  ];

  /**
   * ONDE O MAPA 2 COMECA NO VETOR CONCATENADO.
   *
   * E quantos degraus o mapa 1 tem. A `quantidadeDoDegrau` conta pela
   * POSICAO dentro do mapa, e nao pelo nivel nem pelo indice global: cada
   * mapa recomeca a conta, porque o mapa 2 comeca no nivel 13 e a serie de
   * trabalho e do comeco da campanha dele
   *
   * Sem este numero, a geracao de `MAIN_QUESTS` somaria o indice global e o
   * primeiro degrau do mapa 2 pediria `10 * 2 ^ 6 = 640` inimigos — mais que
   * a campanha inteira do mapa 1 somada
   */
  const MAPA_1_GRAU_INICIAL = ESCADA_MAPA_1.length;

/**
 * QUANTOS TUTORIAIS JA PASSARAM ANTES DESTA POSICAO DA CAMPANHA.
 *
 * ## POR QUE A POSICAO PRECISA DESCONTAR ISTO
 *
 * Porque a `quantidadeDoDegrau` mede o TRABALHO, e o trabalho e contar
 * abates. Um tutorial nao e um abate: ele e uma acao, e sem este desconto
 * cada tutorial que entra na campanha empurra todos os degraus seguintes
 * uma posicao para cima na serie
 *
 * Com os 7 tutorials do mapa 1, o ultimo degrau cairia em `grau = 18` e
 * pediria 3620 inimigos em vez de 226 — dezesseis vezes mais, sem nenhuma
 * mudanca no jogo que justificasse
 *
 * ## POR QUE SUBTRAIR E NAO SOMAR
 *
 * Porque o `i` e a posicao REAL na campanha, e os degraus sao os que
 * sobram depois de tirar os tutorials. A serie tem 11 degraus no mapa 1 e a
 * campanha tem 18 passos, entao o ultimo degrau e `18 - 7 = 11`
 */
function quantidadeDeTutoriaisAntes(posicao) {
  let quantos = 0;

  for (let i = 0; i < posicao; i += 1) {
    if (CAMPANHA[i]?.tutorial) quantos += 1;
  }

  return quantos;
}

  /**
   * OS TUTORIAIS, e ONDE CADA UM SE ENTRA NA CAMPANHA.
   *
   * ## O QUE UM TUTORIAL FAZ AQUI
   *
   * Ele ocupa uma posicao na escada entre dois degraus de cacada. O jogador
   * chega no Pântano, mata 10 esqueletos, e no lugar da segunda missao de
   * cacada ele recebe "forje um osso reforcado". Ele faz aquilo, e so entao
   * a segunda missao de cacada aparece
   *
   * E assim que os tutorials ensinam: no momento em que o jogador tem o
   * MATERIAL para usar a feature. Nao no comeco do jogo, quando ele nao tem
   * nada, nem no fim, quando ja sabe
   *
   * ## A REGRA DE `depoisDo`
   *
   * E o NOME do degrau que vem ANTES, e nao um indice. Um indice mudaria
   * sozinho quando um degrau fosse inserido no meio da escada, e o tutorial
   * saltaria para outro lugar sem ninguem editar nada. Um nome nao se move
   *
   * ## POR QUE ESTAO NUMA LISTA E NAO DENTRO DA ESCADA
   *
   * Porque a escada e de CACADA: tem zona, mob e nivel, e todos os degraus
   * dela compartilham a mesma forma. Um tutorial nao tem zona nem mob, e a
   * `quantidadeDoDegrau` nao faz sentido para ele — ele pede 1 acao, nao
   * 14 abates. Misturar os dois na mesma lista faria o gerador de cacada ter
   * que tratar um caso que nao e dele
   *
   * ## O `location` DO TUTORIAL E A ZONA DO DEGRAU ANTERIOR
   *
   * E o que faz o auto funcionar: o tutorial acontece ONDE o jogador ja
   * esta. Ele acabou de matar os 10 esqueletos do Pantano e recebe o
   * tutorial ali mesmo, sem o auto ter que levar ele a lugar nenhum
   */
  export const TUTORIAIS = [
    {
      tipo: QUEST_TYPE.CRAFT,
      nome: "A Primeira Forja",
      depoisDo: "O Pantano",

      /**
       * POR QUE O CRAFT E O PRIMEIRO TUTORIAL
       *
       * E o unico sistema que o jogador PODE usar com o que ele ja tem. O
       * drop do primeiro esqueleto e osso quebrado, e `osso_quebrado x 5`
       * sai em `osso_quebrado_reforcado`. Nenhum outro tutorial tem essa
       * garantia: os outros dependem de moeda, de steel ou de um livro raro
       *
       * E ele ensina a base de todo o resto: o material vira coisa melhor,
       * e "coisa melhor" e o que o jogador vai ver no loot de qualquer mob
       * ate o fim do jogo
       */
      objetivo: "Crie 1 item no craft a partir de material que voce juntou",
      dica:
        "Abra o CRAFT (C). A primeira receita do Osso Quebrado usa 5 " +
        "unidades e nao custa ouro.",
      icone: "\u2692",
    },

    {
      tipo: QUEST_TYPE.ENCHANT,
      nome: "O Primeiro Afixo",
      depoisDo: "A Pedreira",

      /**
       * POR QUE O ENCANTAMENTO VEM DEPOIS DO CRAFT
       *
       * Porque encantar custa OURO, e ouro na primeira missao mal da para
       * o primeiro encantar. O tutorial vem no fim da segunda degrau de
       * cacada, quando o jogador tem ouro de duas missoes — e assim o
       * primeiro afixo acontece sem ele pensar duas vezes
       *
       * E porque a peca existe: o arco e a aljava dropam no andar QUEBRADO da
       * campanha, e este e o primeiro degrau em que o jogador TEM uma peca
       * para encantar
       */
      objetivo: "Encante uma peca para receber seu primeiro afixo",
      dica:
        "Abra ENCANTAR (aba ao lado do CRAFT). Escolha a peca da mochila e " +
        "o afixo e sorteado na hora — repetir paga de novo e troca o afixo.",
      icone: "\u2726",
    },

    {
      tipo: QUEST_TYPE.MINE,
      nome: "O Veio do Vale",
      depoisDo: "As Dunas",

      /**
       * POR QUE MINERAR VEM ANTES DE APRIMORAR
       *
       * Porque aprimorar custa STEEL, e o steel so sai de minerar. Este e o
       * unico tutorial que e pre-requisito de outro, e ele vem primeiro por
       * isso: o tutorial de aprimorar viria para o jogador sem steel, e ele
       * abriria a aba, veria "Steel insuficiente" e nao entenderia de onde
       * vem
       *
       * E a unica acao do jogo que nao passa por combate, entao e a unica
       * que o jogador nunca encontraria sozinho
       */
      objetivo: "Minere uma pedra no Vale",
      dica:
        "Ligue o auto e ele atravessa para o Vale, acha um cristal comum " +
        "e comeca a minerar sozinho. No manual, procure um cristal no Vale " +
        "e clique nele — o painel so abre quando voce chega perto, e o " +
        "steel e o unico recurso que nao vem de matar.",
      icone: "\u26CF",
    },

    {
      tipo: QUEST_TYPE.ENHANCE,
      nome: "A Primeira Bigorna",
      depoisDo: "O Vale das Cinzas",

      /**
       * POR QUE ESTE VIM DEPOIS DO DE MINERAR
       *
       * E a ordem que o jogo impõe: steel primeiro, aprimoramento depois.
       *
       * E o `count: 1` porque o tutorial e sobre EXISTIR o numero, nao sobre
       * chegar a um degrau. O jogador sai daqui com uma peca em +1, e e a
       * primeira vez que ele ve o numero de aprimoramento em algum lugar da
       * tela — no badge do icone, na placa do alvo e na propria aba
       */
      objetivo: "Aprimore uma peca em +1",

      /**
       * O `count` E 1, E O `+1` ESTA NO OBJETIVO E NAO NO DADO.
       *
       * ## O QUE MUDOU
       *
       * Era `count: 5` com o objetivo "Aprimore 5 vezes, ate o +5". Agora e
       * uma vez so, ate o +1
       *
       * ## POR QUE
       *
       * Porque cinco Degrees sao uma parede na frente do jogador novo. Cada
       * degrau custa ouro E steel, e o steel so existe a partir do tutorial
       * de minerar — que vem imediatamente antes. Um novo jogador que
       * acabou de aprender a minerar estava sendo obrigado a gastar cinco
       * graus de um recurso que ele ainda nao tem, para fechar um TUTORIAL
       *
       * E o tutorial nao ensinava nada nos graus 2 a 5. O que ele ensina e o
       * clique, o custo e o numero aparecendo na tela — e o +1 mostra os
       * tres de uma vez
       *
       * ## POR QUE NAO E UM GRAÇA
       *
       * Continua custando ouro e steel como todo aprimoramento. O tutorial
       * nao ensina a，出现了, ele ensina a GASTAR: o preco que sobe e o
       * que fecha o degrau 1 e o degrau 2, e esse preco e a coisa nova
       */
      count: 1,
      dica:
        "Abra ENCANTAR e use a seta de aprimorar. O primeiro clique gasta " +
        "ouro e steel e marca a peca com +1.",
      icone: "\u2699",
    },

    {
      tipo: QUEST_TYPE.DELIVER,
      nome: "A Primeira Entrega",
      depoisDo: "A Toca dos Ratos",

      /**
       * POR QUE A COLECAO VIM TAO TARDE
       *
       * Porque o bonus da colecao e PERMANENTE, e a primeira entrega e o
       * momento em que o jogador descobre que existe um lugar onde o
       * material dele vira atributo em vez de virar item
       *
       * Ate aqui ele juntou material para craftar. A colecao e a resposta
       * para "e se eu nao quiser craftar?" — e essa e uma pergunta que so
       * faz sentido depois de ter feito craft duas ou tres vezes
       */
      objetivo: "Entregue 1 parcela de uma colecao e receba bonus permanente",
      dica:
        "Abra COLECAO (K) e escolha uma entrega que voce ja tenha o " +
        "material. O bonus que voce recebe fica para sempre.",
      icone: "\u2611",
    },

    {
      tipo: QUEST_TYPE.BUY,
      nome: "A Primeira Compra",
      depoisDo: "O Brejo",

      /**
       * POR QUE COMPRAR VIM DEPOIS DE ENTREGAR
       *
       * Porque e a terceira forma de usar o recurso: craftar (transforma
       * material), entregar (transforma material em atributo) e COMPRAR
       * (transforma ouro em pocao e livro)
       *
       * E o unico tutorial que precisa de duas coisas prontas — ouro na
       * carteira e uma loja aberta — e o degrau do Brejo e onde o jogador
       * ja tem das duas
       */
      objetivo: "Compre 1 item na loja",
      dica:
        "Abra a LOJA pelo botao da prateleira. Ouro parado na carteira nao " +
        "faz nada — e pocao e livro de habilidade so se compra.",
      icone: "\uD83D\uDECD",
    },

    {
      tipo: QUEST_TYPE.LEARN_SKILL,
      nome: "A Primeira Skill",
      depoisDo: "A Cripta",

      /**
       * POR QUE APRENDER SKILL E O ULTIMO TUTORIAL DO MAPA 1
       *
       * Porque e o tutorial de maior risco do jogo: o livro e o drop mais
       * raro, entao o jogador pode ficar horas sem poder cumpri-lo
       *
       * E por isso ele vem no meio do mapa 1 e nao no fim — com a loja e a
       * colecao ja ensinadas, ele tem ouro para comprar o livro se o drop
       * nao vier. E assim que o jogador descobre que as skills existem
       * ANTES de passar o resto do mapa ignorando elas
       *
       * E o ultimo porque e o que fecha o ciclo: depois deste, o jogador
       * conhece craft, encantar, minerar, aprimorar, colecao, loja e
       * habilidades. Sao os sete sistemas
       */
objetivo: "Aprenda 1 habilidade usando um livro",
      dica:
        "O mestre de habilidades, na base, vende o livro. Clique em " +
        "IR ATE O NPC e o auto te leva ate la — depois e so usar o livro " +
        "na mochila e a skill entra no seu slot de habilidade.",
      icone: "★",
    },
  ];

/**
 * A RECOMPENSA DE UM TUTORIAL.
 *
 * ## POR QUE NAO PAGA O MESMO QUE UM DEGRAU
 *
 * Porque um tutorial nao e trabalho: e uma acao. O degrau paga por ABATE —
 * ouro e XP que crescem com o nivel e com a quantidade. Um tutorial de uma
 * acao que paga ouro de degrau transformaria aprender a forjar em farming
 *
 * ## O OURO
 *
 * E fixo em 40, e nao sobe com o nivel. E a MESMA moeda do primeiro degrau,
 * e pela mesma razao: o ouro do tutorial e para que o jogador tenha o
 * bastante para o PROXIMO passo do tutorial seguinte. Ele vai encantar logo
 * em seguida, e encantar custa ouro
 *
 * E nao zero pelo mesmo motivo do contrario: zero faria o tutorial parecer
 * um texto de ajuda, e nao uma missao
 */
const OURO_DO_TUTORIAL = 40;

/**
 * A MISSAO DE UM TUTORIAL, no mesmo formato de um degrau.
 *
 * ## O QUE E IGUAL
 *
 * O `id` no formato da campanha, o `count`, o `summary`, o `rewards` com
 * `coins`/`xp`/`items`, e o `location`. E por isso que ela entra na mesma
 * lista: o `QuestLog`, o painel, o auto e o resgate nao precisam saber que
 * existe um tipo novo de passo
 *
 * ## O QUE MUDA
 *
 * - `type`: o tipo do tutorial, e nao `HUNT`
 * - `target`: o nome da ACAO (`craft`, `enchant`...), e nao a criatura
 * - `count`: 1, quase sempre — ver o `enhance`, que e 5
 * - `dica`: o texto que o painel mostra abaixo do objetivo. E o que
 *   transforma "crie 1 item" em "abra o CRAFT, a primeira receita usa 5
 *   unidades"
 * - `painel`: o id da aba que abre. E o `PAINEL_DO_TUTORIAL` do tipo
 *
 * ## O `count` POR TIPO
 *
 * Todo tutorial e 1, MENOS o de aprimorar. E porque todos os outros ensinam
 * um botao — clicar uma vez e pronto — e o de aprimorar ensina um PROCESSO:
 * o preco sobe a cada degrau, ate o +5 nao ha risco, e depois passa a ter.
 * Um tutorial de "aprimore 1 vez" fecharia no primeiro clique, e o jogador
 * nunca veria nada disso
 */
function questDoTutorial(passo, indice) {
  const tutorial = passo.tutorial;

  const mapa = passo.mapa ?? "map_1";

  /**
   * O `id` LEVA O MAPA E O INDICE GLOBAL, como um degrau.
   *
   * O indice global e o que mantem o save: a missao e sempre a mesma para
   * quem chegou nela, e um tutorial inserido no meio da campanha empurra os
   * ids de cacada em vez de trocar de lugar
   */
  const slug = tutorial.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const painel = PAINEL_DO_TUTORIAL[tutorial.tipo] ?? null;

  return {
    id: `${mapa}_main_${indice + 1}_tut_${slug}`,

    /**
     * O NOME COM O VERBO NA FRENTE.
     *
     * E o `VERBO_DO_TUTORIAL` do tipo mais o nome do tutorial. O painel
     * mostra o `name` como titulo do card, e "A Primeira Forja" sozinho nao
     * diz que o jogador esta aprendendo a forjar — ele nao sabe o que e uma
     * "primeira forja". O verbo diz
     */
    name: `${VERBO_DO_TUTORIAL[tutorial.tipo] ?? "Aprendendo"}: ${tutorial.nome}`,

    /**
     * O NOME CURTO, sem o verbo na frente.
     *
     * E o nome do tutorial sozinho: "A Primeira Bigorna" em vez de
     * "Aprendendo a aprimorar: A Primeira Bigorna". Sao 15 caracteres de
     * menos, e a caixa da HUD le ESTE
     *
     * ## POR QUE O VERBO NAO CABE LÁ
     *
     * Porque a caixa da HUD tem 10px de fonte e umas 150px de largura util.
     * O verbo ocupa metade dela, e o nome que sobra e "Aprend…", que nao
     * identifica tutorial nenhum — sete nomes truncados no mesmo lugar
     *
     * ## ONDE O VERBO CONTINUA APARECENDO
     *
     * No painel de missoes, na walkthrough e na lista de passos, que tem
     * largura para ele. O verbo e ENSINO, e a caixa da HUD e um lembrete
     * curto: ela precisa dizer QUAL, e o painel diz COMO
     */
    nomeCurto: tutorial.nome,

    type: tutorial.tipo,

    /**
     * O `location` E A ZONA DO DEGRAU ANTERIOR.
     *
     * E o que faz o auto funcionar: o tutorial acontece onde o jogador ja
     * esta, e ele nao e levado a lugar nenhum. Um tutorial de minerar com
     * `location: "vale"` levaria o jogador ate la — mas o Vale das Cinzas ja
     * e a zona onde ele esta, e uma ida a la de novo seria anda sem ganho
     */
    location: passo.alvoZona,

    target: tutorial.tipo,

    /**
     * O `minLevel` E O DO DEGRAU ANTERIOR.
     *
     * Nao e exigido por nenhum codigo — o `onAcao` nao olha `minLevel` — mas
     * e o que o painel usa para mostrar "acima do seu nivel" na lista lateral
     */
    minLevel: passo.alvoNivel ?? 1,

    count: tutorial.count ?? 1,

    summary: tutorial.objetivo,
    dica: tutorial.dica,
    icone: tutorial.icone,
    painel,
    aba: ABA_DO_TUTORIAL[tutorial.tipo] ?? null,
    npc: NPC_DO_TUTORIAL[tutorial.tipo] ?? null,
    tutorial: true,

    rewards: {
      coins: OURO_DO_TUTORIAL,

      xp: Math.max(
        xpDoDegrauAnterior(indice - 1) + 15,
        Math.round(10 * BALANCE.xpShare.creature * 2),
      ),
      items: [],
    },
  };
}

/**
 * A CAMPANHA COM OS TUTORIAIS INTERCALADOS.
 *
 * ## O QUE ELA E
 *
 * A `ESCADA` — os degraus de cacada, na ordem — com cada tutorial COLADO
 * logo depois do degrau que ele nomeia em `depoisDo`. E a lista que
 * `MAIN_QUESTS` gera, e e dela que sai a ordem que o painel mostra
 *
 * ## POR QUE INTERCALAR E NAO COLOCAR NO FIM
 *
 * Porque no fim nao ensina. O tutorial de craft no fim da campanha
 * mostraria ao jogador, no ultimo degrau, que ele poderia ter estado
 * refinando material desde o primeiro minuto. Intercalado, ele aparece
 * quando o jogador ja tem 10 ossos na mochila — e nesse instante a feature
 * faz sentido
 *
 * ## POR QUE O MAPA 2 NAO TEM TUTORIAL
 *
 * Porque sao os SETE SISTEMAS, e todos os sete ja foram ensinados no mapa 1.
 * O mapa 2 e a campanha: mais criatura, mais nivel, mais material. Repetir
 * "aprende a forjar" no nivel 13 seria o tutorial falando com quem ja
 *ouviu
 *
 * E porque o mapa 2 comeca no nivel 13 com o jogador sabendo jogar: a curva
 * de dificuldade dele esta no HP do mob, nao em sistema novo
 */
export const CAMPANHA = (() => {
  const saida = [];

  for (const degrau of ESCADA) {
    saida.push({ ...degrau, tutorial: null });

    /**
     * O TUTORIAL QUE NASCE DEPOIS DESTE DEGRAU.
     *
     * O `depoisDo` e o NOME do degrau, e ele e comparado dentro do
     * `filter`. E um nome e nao um indice pelo motivo do comentario da
     * `TUTORIAIS`: um indice mudaria sozinho quando um degrau fosse
     * inserido no meio
     */
    for (const tutorial of TUTORIAIS) {
      if (tutorial.depoisDo !== degrau.nome) continue;

      saida.push({
        /**
         * O MAPO DO TUTORIAL E O DO DEGRAU QUE O GEROU.
         *
         * Sem esta linha o tutorial nao teria `mapa`, e a `quantidadeDoDegrau`
         * do proximo degrau do mapa 2 calcularia a partir da posicao global
         * — voltando a pedir 640 inimigos no primeiro degrau do mapa 2
         */
        mapa: degrau.mapa,
        alvoZona: degrau.zona,
        alvoNivel: degrau.nivel,
        tutorial,
      });
    }
  }

  return saida;
})();

/**
 * O tutorial que o `depoisDo` nao encontrou.
 *
 * E o que impede um tutorial de sumir em silencio: um nome escrito errado em
 * `TUTORIAIS` deixaria a feature sem missao, sem erro de build, e sem o
 * tutorial aparecer. O console diz o nome que nao casou
 */
const TUTORIAIS_ORFAOS = TUTORIAIS.filter(
    (tutorial) =>
      !CAMPANHA.some((passo) => passo.tutorial === tutorial),
  );

  if (TUTORIAIS_ORFAOS.length > 0) {
    console.warn(
      "[quests] tutorial sem degrau de origem, `depoisDo` nao casa: " +
        TUTORIAIS_ORFAOS.map((t) => `${t.nome} -> "${t.depoisDo}"`).join(", "),
    );
  }

export const MAIN_QUESTS = CAMPANHA.map((passo, i) => {
  if (passo.tutorial) return questDoTutorial(passo, i);

  const degrau = passo;

    /**
     * A POSICAO DO DEGRAU DENTRO DA ESCADA DO MAPO DELE.
     *
     * E o `i` GLOBAL menos o comeco do mapa, menos os tutoriais que ja
     * passaram, mais um. O `i` da campanha inclui os 7 tutorials do mapa 1,
     * entao sem descontar eles cada degrau cairia uma posicao a frente na
     * curva — e o topo do mapa 1 pediria 21 em vez de 24
     */
    const inicio = degrau.mapa === "map_2" ? MAPA_1_GRAU_INICIAL : 0;

    const posicao = i - inicio - quantidadeDeTutoriaisAntes(i) + 1;

    /**
     * A QUANTIDADE SAI DA CURVA DO MAPO, e nao de um numero global.
     *
     * O `mapa` e o que escolhe entre `10 -> 24` e `24 -> 48`, e o `total` e
     * quantos degraus aquele mapa tem — e ele precisa do TOTAL, porque a razao
     * da interpolacao so existe quando se sabe onde a curva termina
     */
    const mapa = degrau.mapa ?? "map_1";

    const total = ESCADA.filter((d) => (d.mapa ?? "map_1") === mapa).length;

    const quantidade = quantidadeDoDegrau(mapa, posicao, total);
  const curto = NOME_CURTO[degrau.target];
  const alvo = NOME_LEGIVEL[degrau.target];
  const zona = nomeDaZona(degrau.zona);

  /**
   * O XP que um mob deste degrau dropa.
   *
   * Sai do `CREATURE_TYPES`, e nao de uma constante escrita aqui: o
   * `xpForKill` do jogo e `maxHp * BALANCE.xpShare.creature`, entao o
   * piso da recompensa tem que sair do HP do mob. Se o HP do ogre mudar,
   * a recompensa da missao acompanha
   */
  const tipo = CREATURE_TYPES[degrau.target];

  const hpNoNivel = scaleForLevel(tipo, degrau.nivel).maxHp;

  const xpDeUmMob = Math.max(
    1,
    Math.round(hpNoNivel * BALANCE.xpShare.creature),
  );

  const xp = xpDoDegrau(
    degrau.nivel,
    xpDeUmMob,
    xpDoDegrauAnterior(i),
  );

  /**
   * O CHEFE: UMA MISSAO, UM ABATE.
   *
   * E a unica degrau da campanha que nao e uma curva. O `count` de um
   * degrau normal vem da curva da posicao, e a curva do topo daria 24
   * Hulks — o que quer dizer 24 voltas na arena, cada uma custando uma
   * vida ou o mesmo item
   *
   * O `count` e forcado em 1 e o `type` vira `KILL`, que e o unico tipo do
   * catalogo que conta abate sem exigir uma quantidade. O `QuestLog` ja
   * trata os dois no mesmo `onKill`, entao nao ha metodo novo
   *
   * E o `chefe` vai no objeto porque e ele que a `PortalBox` le: sem o
   * campo, o portal selado so sabe dizer que a campanha nao acabou
   */
  if (degrau.chefe) {
    return {
      id: idDoDegrau(degrau.mapa ?? "map1", i + 1, curto, degrau.zona),
      name: degrau.nome,
      type: QUEST_TYPE.KILL,
      location: degrau.zona,
      target: degrau.target,
      minLevel: degrau.nivel,
      count: 1,
      chefe: degrau.chefe,
      summary: `Vá a ${zona} e derrube ${alvo}`,
      rewards: {
        coins: ouroDoDegrau(degrau.nivel),
        xp,
        items: recompensaDoDegrau(degrau),
      },
    };
  }

  return {
    id: idDoDegrau(degrau.mapa ?? "map1", i + 1, curto, degrau.zona),
    name: degrau.nome,
    type: QUEST_TYPE.HUNT,
    location: degrau.zona,
    target: degrau.target,
    minLevel: degrau.nivel,
    count: quantidade,
    summary: `Vá a ${zona} e mate ${quantidade} ${alvo}s de nível ${degrau.nivel}`,
    rewards: {
      /**
       * A recompensa tambem sobe com o nivel.
       *
       * Um degrau de nivel 12 pagando o mesmo do nivel 1 faz a escalada
       * nao custar nada, e o jogador nao sente o topo
       */
      coins: ouroDoDegrau(degrau.nivel),
      xp,

      /**
       * A RECOMPENSA EM MATERIAL DESTA MISSAO.
       *
       * E o material que a CRIATURA ALVO dropa, e nao um item escolhido a
       * mao. A missao de esqueleto paga Osso Quebrado porque o esqueleto
       * solta Osso Quebrado: o jogador que a completa ja saiu de la com o
       * material na mao, e a recompensa e uma segunda dose do mesmo
       *
       * A lista e montada do `loot` da criatura e nao escrita aqui: se o
       * drop do esqueleto mudar, a recompensa acompanha. E o primeiro item
       * do pool e o que ele solta com mais peso, que e o material
       * principal daquela criatura
       *
       * ## POR QUE 4 E NAO 1
       *
       * Porque um material so nao paga a missao. O ouro dela ja e pouco
       * (45 no primeiro degrau) e o XP e o piso do degrau; a recompensa de
       * material e o que faz a missao valer a pena alem do numero. Quatro
       * do material comum e o suficiente para o jogador entrar no primeiro
       * refino sem ter guardado nada antes
       */
      items: recompensaDoDegrau(degrau),
    },
  };
});

/**
 * AS SECUNDARIAS DO MAPA 1: metade da principal, na MESMA zona.
 *
 * ## POR QUE A METADE
 *
 * A secundaria e o caminho curto: o jogador pega a missao curta, mata o
 * que a principal exige, e ao voltar a principal ja esta a meia. Com a
 * mesma quantidade a principal viraria repeticao; com menos, ela fica
 * inutil
 *
 * ## POR QUE O MESMO `location`
 *
 * E o que faz o auto levar o jogador para a zona certa: os dois pedidos
 * apontam para o mesmo lugar, entao o caminho vale para as duas. Com
 * zonas diferentes, o auto escolheria uma e o painel mostraria a outra
 */
export const SIDE_QUESTS = ESCADA.map((degrau, i) => {
    /**
     * A MESMA POSICAO que a principal usou, e nao o nivel.
     *
     * E o que garante que a secundaria e sempre a METADE da principal que
     * esta no mesmo degrau. Se as duas calculassem a quantidade por caminhos
     * diferentes, a secundaria do topo do mapa 2 pediria `640 / 2 = 320`
     * inimigos contra os 50 da principal — e o "atalho" seria o degrau mais
     * caro do jogo
     */
    const inicio = degrau.mapa === "map_2" ? MAPA_1_GRAU_INICIAL : 0;

    /**
     * A MESMA CURVA DO MAPO, e nao a serie global.
     *
     * A `SIDE_QUESTS` e gerada da `ESCADA`, que nao tem tutorial — entao o
     * `i` dela ja e a posicao do degrau dentro do mapa, e o `mapa` e o total
     * sao os mesmos que a principal usou
     *
     * E o que garante que a secundaria e sempre a METADE da principal do mesmo
     * degrau. Se ela calculasse por um caminho diferente, a secundaria do
     * topo do mapa 2 pediria 12 em vez de 24 — e o "atalho" seria mais barato
     * que a missao principal que ele deveria substituir
     */
    const mapa = degrau.mapa ?? "map_1";

    const total = ESCADA.filter((d) => (d.mapa ?? "map_1") === mapa).length;

    const metade = Math.ceil(
      quantidadeDoDegrau(mapa, i - inicio + 1, total) / 2,
    );
  const curto = NOME_CURTO[degrau.target];
  const alvo = NOME_LEGIVEL[degrau.target];
  const zona = nomeDaZona(degrau.zona);

  const tipo = CREATURE_TYPES[degrau.target];

  const hpNoNivel = scaleForLevel(tipo, degrau.nivel).maxHp;

  const xpDeUmMob = Math.max(
    1,
    Math.round(hpNoNivel * BALANCE.xpShare.creature),
  );

  /**
   * O ouro da secundaria e METADE do da principal.
   *
   * E o que mantem a regra: a secundaria paga menos que a principal da
   * mesma zona, entao nenhuma das duas cai abaixo do drop do mob do campo.
   * O piso continua sendo o ouro do mob, porque a secundaria e sempre a
   * mesma criatura na mesma zona
   */
  const ouroPrincipal = ouroDoDegrau(degrau.nivel);

  return {
    // o sufixo `__side` e o que casa o par: nao um indice, para uma
    // missao inserida no meio da campanha nao arrastar a secundaria
    id: idDoDegrau(degrau.mapa ?? "map1", i + 1, curto, degrau.zona, "__side"),
    name: `${degrau.nome} — o caminho curto`,
    type: QUEST_TYPE.KILL,
    location: degrau.zona,
    target: degrau.target,
    minLevel: degrau.nivel,
    count: metade,
    summary: `Mate ${metade} ${alvo}s de nível ${degrau.nivel} em ${zona}`,
    rewards: {
      /**
       * O XP da secundaria e o do DOIS mob, e nao a metade do XP da
       * principal: a secundaria pede metade dos inimigos, entao o XP
       * proporcional ao trabalho daria metade do XP de dois mobs — e a
       * regra do piso e por mob morto
       */
      coins: Math.round(ouroPrincipal / 2),
      xp: xpDoDegrau(
        degrau.nivel,
        xpDeUmMob,
        xpDoDegrauAnterior(i),
      ),

      /**
       * A MESMA RECOMPENSA DE MATERIAL DA PRINCIPAL, e nao metade dela.
       *
       * A metade e a regra da SECUNDARIA para o que se vai CAÇAR: cinco
       * bichos em vez de dez. O material nao segue essa regra porque o
       * numero dele e pequeno e fixo, e a metade de quatro seria dois —
       * uma recompensa de material tao baixa que a missao pareceria nao
       * pagar nada
       *
       * E o que mantem as duas parecendo o mesmo awarding: o jogador
       * completar a secundaria e nao receber material nenhum seria a
       * primeira pista de que aquela missao e o atalho errado
       */
      items: recompensaDoDegrau(degrau),
    },
  };
});

export const ALL_QUESTS = [
  ...MAIN_QUESTS,
  ...SIDE_QUESTS,
];

export function getQuest(id) {
  return (
    ALL_QUESTS.find((quest) => quest.id === id) ?? null
  );
}

export function getMainQuest(index) {
  return MAIN_QUESTS[index] ?? null;
}

export function getSideQuest(id) {
  return (
    SIDE_QUESTS.find((quest) => quest.id === id) ??
    null
  );
}

/**
 * AS MISSOES PRINCIPAIS DE UM MAPA, na ordem da escada.
 *
 * A escada e UMA lista com os dois mapas concatenados, entao "as do
 * mapa 1" e uma fatia: as primeiras doze. Cortar por mapa e o que
 * permite falar da "ultima missao do mapa 1" sem escrever o indice 11
 * em tres arquivos — um `11` solto vira errado no dia em que a escada
 * ganhar um degrau
 */
export function mainQuestsDoMapa(mapa) {
    /**
     * O `id` da missao ja traz o mapa COM O UNDERSCORE.
     *
     * A traducao vivia aqui antes, e ela quebrou: o `id` era gerado com
     * `degrau.mapa ?? "map1"` — sem underscore — e esta funcao procurava
     * `map_1_main_`. Os dois lados estavam certos sozinhos e errados juntos,
     * e o resultado era `mainQuestsDoMapa` devolvendo zero para os dois
     * mapas. A trava do portal usava esse zero, e `-1` significa
     * "nenhuma missao", que libera o portal
     *
     * Ou seja: o bug nao trancava a porta, ele destrancava o portal do
     * mapa 2 para sempre. Um save antigo ainda tem ids com `map1_`, entao
     * as duas formas sao aceitas aqui — e a do `degrau.mapa` e a que o
     * `idDoDegrau` escreve hoje
     */
    const alvo =
      mapa === "map_1"
        ? "map_1"
        : mapa === "map_2"
          ? "map_2"
          : mapa;

    const legado =
      mapa === "map_1" ? "map1" : mapa === "map_2" ? "map2" : null;

    return MAIN_QUESTS.filter(
      (quest) =>
        quest.id.startsWith(`${alvo}_main_`) ||
        (legado && quest.id.startsWith(`${legado}_main_`)),
    );
  }

/**
 * O INDICE da ultima missao principal de um mapa, ou `-1`.
 *
 * E o `-1` que faz a conta nao depender de a escada estar cheia: um mapa
 * sem missao nao trava ninguem, porque "terminar a ultima missao de um
 * mapa que nao tem missoes" e uma condicao que ja nasce satisfeita
 *
 * O indice e o que o `QuestLog.mainIndex` guarda. `>=` este numero e a
 * porta estar aberta; `<` e a porta fechada com a campanha ainda
 * correndo
 */
export function indiceDaUltimaMissao(mapa) {
  const missoes = mainQuestsDoMapa(mapa);

  if (missoes.length === 0) return -1;

  return MAIN_QUESTS.indexOf(missoes[missoes.length - 1]);
}

/**
 * O PORTAL QUE EXIGE A CAMPANHA ESTA ABERTO?
 *
 * ## POR QUE A REGRA VIVE AQUI E NAO NO PORTAL
 *
 * O portal declara a exigencia com `exigeMissaoDe: "map_1"`, mas quem
 * sabe o que "terminar o mapa 1" significa e a escada — e a escada esta
 * aqui. Se a funcao morasse em `data/portais`, aquele arquivo
 * importaria este, e como `quests` alcanca `data/maps`, que alcanca
 * `portais`, o ciclo voltaria a estourar em `Cannot access before
 * initialization` — que e o erro que aparece em runtime e nao no
 * build, entao passa reto
 *
 * ## POR QUE UM SO LUGAR
 *
 * Sao dois chamadores com papeis opostos: o `GameEngine`, que troca o
 * mapa, e o `GameServer`, que precisa recusar ANTES de o motor saber.
 * Eles tem que dar a mesma resposta, entao nao podem ter uma copia cada.
 *
 * Devolve `{ ok: true }` ou `{ ok: false, motivo }`, com o `motivo` ja
 * na lingua do jogador: e ele que vai para a box e para o aviso, e um
 * texto montado em cada um dos dois seria duas tradicoes do mesmo texto
 *
 * O `mainIndex` e o numero que o `QuestLog` ja guarda. Nao ha estado
 * novo para sincronizar e nenhuma missao precisa ser consultada: a
 * campanha e uma escada, e o indice diz ate onde o jogador chegou
 */
/**
 * O NUMERO DA MISSAO COMO A CAMPANHA MOSTRA: `mapa.missao`.
 *
 * ## POR QUE ESTA FUNCAO ESTA AQUI, E NAO NO PAINEL
 *
 * Porque a trava do portal e o painel de missoes falam da MESMA degrau, e
 * cada um com a sua conta eles divergem: o painel mostrava `1.19` e a trava
 * escrevia "O Hulk". O jogador lia um numero na campanha e um nome no
 * portal, sem caminho para ligar um no outro
 *
 * ## POR QUE O INDICE E REINICIADO POR MAPA
 *
 * Porque o numero impresso responde "onde eu to", e nao "quantas coisas eu
 * ja fiz". Quem abre o mapa 2 espera `2.1` — e `2.19` faz o jogador achar
 * que pulou dezenove degraus
 *
 * ## POR QUE A TABELA E FIXA, E NAO CALCULADA
 *
 * Porque o `id` e usado como CHAVE DE SAVE. Derivar o numero da posicao em
 * `MAIN_QUESTS` pareceria mais limpo, mas um degrau novo inserido no meio do
 * mapa 1 mudaria o numero do mapa 2 inteiro — e o numero impresso passaria
 * a depender de um arquivo que esta a tres `import` de distancia
 */
const PRIMEIRO_INDICE_DO_MAPA = { 1: 1, 2: 19 };

export function numeroDaMissao(id) {
  const partes = String(id ?? "").split("_");

  /**
   * O MAPA ESTA PARTIDO EM DUAS PARTES, E NAO EM UMA.
   *
   * O `id` e `map_1_main_1_limo_pantano`, e dividir por underscore da
   * `["map", "1", "main", "1", "limo", "pantano"]`. A forma antiga era
   * `map1_main_1`, sem separador entre o mapa e o numero
   */
  const temSeparador = partes[0] === "map";

  const mapa = temSeparador
    ? (/^\d+$/.test(partes[1] ?? "") ? partes[1] : null)
    : (/^map(\d+)$/.exec(partes[0] ?? "")?.[1] ?? null);

  const indiceGlobal = Number(
    partes.find((parte, i) => i > 1 && /^\d+$/.test(parte)),
  );

  /**
   * ID FORA DO PADRAO E UM SAVE DE OUTRA VERSAO, NAO UMA MISSAO.
   *
   * O `null` deixa o nome sozinho, que e o que o jogador ainda consegue ler.
   * Um "0.0" no lugar seria pior que nada
   */
  if (!mapa || !Number.isInteger(indiceGlobal) || indiceGlobal < 1) {
    return null;
  }

  const indice = indiceGlobal - (PRIMEIRO_INDICE_DO_MAPA[mapa] ?? 1) + 1;

  if (indice < 1) return null;

  return `${mapa}.${indice}`;
}

export function portalLiberado(exigeMissaoDe, mainIndex) {
  // sem exigencia, o portal e um corredor
  if (!exigeMissaoDe) return LIBERADO;

  const indice = indiceDaUltimaMissao(exigeMissaoDe);

  /**
   * UM MAPA QUE NAO TEM MISSOES NAO TRAVA NINGUEM.
   *
   * `indiceDaUltimaMissao` devolve `-1` quando o mapa nao tem degrau, e
   * `-1` e tambem o indice de "campanha nao comecou". Comparar
   * `mainIndex >= -1` deixa a porta aberta, que e o que um mapa sem
   * campanha deve fazer — e sem este tratamento, um mapa novo sem
   * missoes seria um portal fechado para sempre
   */
  if (indice < 0) return LIBERADO;

  if (mainIndex > indice) return LIBERADO;

  /**
   * A PORTA FECHADA, e a ultima missao que falta.
   *
   * ## POR QUE O NUMERO E O NOME, E SO O NOME
   *
   * A trava falava `Termine "O Hulk"` e a campanha mostra `1.19` para a
   * mesma degrau. Sao a mesma missao escrita de duas maneiras, e o jogador
   * nao tinha como ligar uma na outra — ele procurava no painel um "Hulk"
   * que o painel nunca mostrou
   *
   * O `numeroDaMissao` e a MESMA conta do painel,importada de la agora: as
   * duas telas mostram `1.19` quando falam da degrau 19 do mapa 1
   *
   * E o nome continua depois do numero, e nao no lugar dele: o numero diz
   * ONDE procurar, e o nome diz o que o jogador vai ler quando chegar
   */
  const quest = MAIN_QUESTS[indice];

  const numero = quest ? numeroDaMissao(quest.id) : null;

  const doMapa = mainQuestsDoMapa(exigeMissaoDe).length;

  const feitas = Math.max(0, Math.min(mainIndex + 1, doMapa));

  return {
    ok: false,
    motivo: quest
      ? numero
        ? `Para atravessar complete a missao: ${numero}/${doMapa} da campanha.`
        : `Voce nao pode atravessar`
      : "Termine a campanha deste mapa para atravessar.",
    questId: quest?.id ?? null,

    /**
     * O NUMERO DA DEGRAU, PARA QUEM QUISER MOSTRAR SO ELE.
     *
     * A box e o painel usam este campo em vez de recortar a frase do
     * `motivo`: o texto e para o jogador e o numero e para a maquetacao
     */
    numeroMissao: numero,

    /**
     * O CHEFE, quando a missao que tranca a porta e o proprio chefe.
     *
     * So a ultima degrau de um mapa tem essa propriedade, e ela e o que
     * transforma "selado" em "va ate la derrubar o Hulk". Sem este campo a
     * box so teria a frase de bloqueio — e o jogador ficaria parado num
     * portal que so abre com algo que ele so encontra depois de atravessar
     * outro portal
     */
    chefe: quest?.chefe ?? null,
  };
}

/** O mesmo "pode", so no formato curto do painel */
export function dadosDaTrava(exigeMissaoDe, mainIndex) {
  const veredito = portalLiberado(exigeMissaoDe, mainIndex);

  return {
    bloqueado: !veredito.ok,
    motivo: veredito.motivo ?? null,

    /**
     * O CHEFE QUE ESTA TRAVANDO ESTA PORTA, ou `null`.
     *
     * ## POR QUE A BOX PRECISA SABER ISSO
     *
     * Porque "selado" sozinho e um beco sem saida: o jogador le que a
     * campanha do mapa 1 precisa terminar e nao tem para onde ir. A ultima
     * missao do mapa 1 e matar o Hulk na arena, e a arena fica do outro
     * lado de um portal — que e justamente este, o unico que a campanha
     * tranca. Uma trava que depende de uma missao atras de outra trava e
     * um circulo, e o jogador so descobre isso depois de fazer dezoito
     * degraus
     *
     *## POR QUE SO QUANDO A TRAVA E O CHEFE
     *
     * Porque `null` e o estado normal de toda outra trava, e a box precisa
     * continuar mostrando so "Selado" nelas. O campo e a PERGUNTA "este
     * portal tem um chefe?", e a resposta quase sempre e nao
     */
    chefe: veredito.ok ? null : (veredito.chefe ?? null),
  };
}

/**
 * O VEREDITO DE "PORTAL ABERTO".
 *
 * Um objeto so, compartilhado, e nao um `{ ok: true }` novo a cada
 * chamada: quem compara o resultado com `===` precisa que todos os
 * abertos sejam o mesmo objeto. E `motivo` e `null` de proposito,
 * porque o painel le `motivo` sem precisar testar `ok`
 */
const LIBERADO = Object.freeze({ ok: true, motivo: null });

/**
 * O JOGADOR PODE ENTRAR NA ARENA DO CHEFE AGORA?
 *
 * ## A REGUA
 *
 * A arena e do degrau do chefe: o jogador entra nela **enquanto a missao do
 * Hulk e a missao atual dele**. Nao antes, e nao depois
 *
 * Antes nao faz sentido — o degrau ainda nao chegou, e o jogador entraria
 * numa luta que o painel nem mostra. Depois tambem nao: com o degrau feito, o
 * portal ja esta aberto e o caminho normal passa a ser o proprio portal
 *
 * ## POR QUE O `chefe` DO DEGRAU E A REGUA, E NAO O ID DA ARENA
 *
 * Porque `arena` e o **lugar**, e o lugar nao muda com o jogador: ele
 * descreveria "esta fightindo" em vez de "pode comecar a fightir". O campo
 * `chefe` mora no degrau da campanha, entao ele responde a pergunta do
 * jeito certo: o jogador esta NA missao que pede o chefe
 *
 * E por isso que um `boss_1` novo nao precisa de codigo: a escada e que
 * diz onde a arena esta
 *
 * ## POR QUE UM VEREDITO E NAO UM BOOLEAN
 *
 * Pelos mesmos motivos do `portalLiberado`: a frase que o jogador le mora
 * aqui, uma vez. O servidor manda no aviso vermelho e a box escreve no
 * `data-tip` — duas tradicoes do mesmo texto, se cada lado montasse o seu
 *
 * ## POR QUE FICA AQUI E NAO NO `GameServer`
 *
 * Porque sao dois chamadores com papeis opostos — o `GameEngine`, que
 * escreve a box, e o `GameServer`, que precisa recusar ANTES de o motor
 * saber. Eles tem que dar a mesma resposta, entao nao podem ter uma copia
 * cada
 *
 * @param {number} mainIndex onde o jogador esta na escada da campanha
 * @returns {{ok: boolean, motivo: string|null, quest: object|null}}
 */
export function entradaNaArena(mainIndex) {
  const atual = MAIN_QUESTS[mainIndex] ?? null;

  if (atual?.chefe?.arena) {
    return {
      ok: true,
      motivo: null,
      quest: atual,
    };
  }

  /**
   * O NOME DA MISSAO NO AVISO, e nao um "faca a missao do chefe".
   *
   * O jogador que clica no botao sem estar no degrau esta no meio da
   * campanha. Dizer o nome e dizer ONDE ele esta agora: a missao que ele
   * precisa terminar para chegar no degrau do chefe
   *
   * E o `name` do degrau atual, e nao o `nome` do degrau bruto: e `MAIN_QUESTS`
   * que traduz o campo, em `name: degrau.nome`. Ler `nome` aqui daria
   * `undefined` dentro da frase — e um aviso escrito "Termine "undefined"
   * para liberar...", que e pior do que nao ter aviso
   */
  const ondeEsta = atual?.name ?? "a campanha deste mapa";

  return {
    ok: false,
    motivo: `Termine "${ondeEsta}" para liberar a entrada na arena do chefe.`,
    quest: atual,
  };
}

/**
 * De onde veio a missao: `main` ou `side`.
 *
 * O `scope` decide o que a tela mostra depois do resgate (a campanha
 * continua ou a caixa de secundarias volta a aceitar uma) e por isso
 * ele NUNCA vem do cliente nem do arquivo de save: sai daqui, do
 * catalogo. Um `scope` forjado colocaria a recompensa de uma
 * principal na coluna das secundarias
 */
export function questScopeOf(questId) {
  if (MAIN_QUESTS.some((quest) => quest.id === questId)) {
    return QUEST_SCOPE.MAIN;
  }

  if (SIDE_QUESTS.some((quest) => quest.id === questId)) {
    return QUEST_SCOPE.SIDE;
  }

  return null;
}

/**
 * A SECUNDARIA DE UMA PRINCIPAL.
 *
 * ## A REGRA
 *
 * Toda missao principal tem uma secundaria, e a secundaria pede **METADE**
 * dos inimigos da principal. E o `id` da secundaria sai do `id` da
 * principal, entao o par nasce junto e nao por acaso
 *
 * ## POR QUE A METADE
 *
 * A secundaria e o caminho curto: o jogador pega a missao curta, mata o
 * que a principal exige, e ao voltar a principal ja esta a meia 力.
 * Com a mesma quantidade, a principal viraria repeticao; com menos, ela
 * fica inutil
 *
 * ## O `location` E O MESMO
 *
 * A secundaria repete o `location` da principal. E o que faz o auto
 * levar o jogador para a zona certa: os dois pedidos apontam para o
 * mesmo lugar, entao o caminho do auto vale para as duas. Com
 * `location` diferentes, o auto escolheria um e o painel mostraria o
 * outro
 *
 * Devolve `null` quando a missao nao tem par, que e o caso de uma
 * principal de `equip` ou `level`: nao ha "inimigo pela metade" numa
 * missao que nao mata nada
 */
export function getSideFor(mainId) {
  const main = MAIN_QUESTS.find((quest) => quest.id === mainId);

  if (!main) return null;

  const temAbate =
    main.type === QUEST_TYPE.HUNT ||
    main.type === QUEST_TYPE.KILL;

  if (!temAbate) return null;

  return (
    SIDE_QUESTS.find(
      (quest) => quest.id === getSideIdFor(main.id),
    ) ?? null
  );
}

/**
 * O ID da secundaria que casa com uma principal.
 *
 * `main_1_limo_pantano` vira `main_1_limo_pantano__side`
 *
 * A regra e o sufixo `__side` e nao um indice: a secundaria e a
 * ```
 * da principal, e nao a proxima da lista. Uma secundaria escrita com o
 * indice se moveria sozinha quando uma missao fosse inserida no meio
 */
export function getSideIdFor(mainId) {
  return `${mainId}__side`;
}

export function rarityRank(rarity) {
  const index = RARITY_ORDER.indexOf(rarity);

  return index < 0 ? -1 : index;
}

export function meetsRarity(have, want) {
  const rank = rarityRank(have);
  const required = rarityRank(want);

  if (rank < 0 || required < 0) return false;

  return rank >= required;
}
