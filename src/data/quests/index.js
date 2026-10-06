import { RARITY_ORDER } from "../items/index.js";

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

export const QUEST_TYPE = {
  HUNT: "hunt",
  KILL: "kill",
  EQUIP: "equip",
  LEVEL: "level",
};

export const QUEST_SCOPE = {
  MAIN: "main",
  SIDE: "side",
};

export const AUTO_TYPES = new Set([
  QUEST_TYPE.HUNT,
  QUEST_TYPE.KILL,
]);

export function isAutoCompletable(quest) {
  return Boolean(quest) && AUTO_TYPES.has(quest.type);
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
export const ESCADA_MAPA_1 = [
  {
    target: "slime",
    nivel: 1,
    zona: "pantano",
    nome: "Primeiros Passos",
  },
  {
    target: "slime",
    nivel: 2,
    zona: "pantano",
    /**
     * A PEDREIRA E O MESMO DEGRAU DO PANTANO.
     *
     * As duas tem limo de nivel 2, e o `onKill` compara `target` com
     * `minLevel` — nao a zona. Duas missoes de "limo nv2" seriam
     * completadas pelo mesmo abate, e o jogador veria a mesma barra
     * crescendo duas vezes
     *
     * A missao fica no Pantano porque e a zona de ENTRADA: e onde o
     * jogador esta quando a campanha comeca. A `location` e o que o auto
     * percorre, e o auto precisa levar a algum lugar que o jogador
     * conhece
     */
    nome: "Cacos do Brejo",
  },
  {
    target: "slime",
    nivel: 3,
    zona: "dunas",
    nome: "Areia e Gelo",
  },
  {
    target: "slime",
    nivel: 4,
    zona: "cinzas",
    nome: "Cinzas Quentes",
  },
  {
    target: "slime",
    nivel: 5,
    zona: "toca",
    nome: "Fundo da Toca",
  },
  {
    target: "slime",
    nivel: 6,
    zona: "brejo",
    nome: "O Brejo Lento",
  },
  {
    target: "ogre_da_predeira",
    nivel: 7,
    zona: "treino",
    nome: "O Gigante da Pedreira",
  },
  {
    target: "ogre",
    nivel: 8,
    zona: "cripta",
    nome: "A Cripta Esquelética",
  },
  {
    target: "ogre",
    nivel: 9,
    zona: "ruinas",
    nome: "Ruínas dos Ghouls",
  },
  {
    target: "ogre",
    nivel: 10,
    zona: "campina",
    nome: "Campina Gelada",
  },
  {
    target: "ogre",
    nivel: 11,
    zona: "acampamento",
    nome: "Acampamento Goblin",
  },
  {
    target: "ogre",
    nivel: 12,
    zona: "floresta",
    nome: "Floresta Sombria",
  },
];

/**
 * O numero de inimigos do degrau.
 *
 * De 10 no nivel 1, mais 2 por nivel. A conta esta aqui e nao espalhada em
 * cada missao porque a escada cresce: quando entrar um degrau 13, e uma
 * linha aqui e nao uma edicao em doze lugares
 */
function quantidadeDoDegrau(nivel) {
  return 10 + (nivel - 1) * 2;
}

/**
 * O OURO da missao.
 *
 * ## A REGRA QUE ESTE NUMERO CUMPRE
 *
 * O ouro que um mob da tem que ser MENOR que o da missao do campo dele.
 * Com 45 por nivel, o degrau 1 paga 45 contra os 9 que o limo da, e o
 * degrau 12 paga 540 contra os 190 do ogre
 *
 * ## POR QUE 45 E NAO A QUANTIDADE
 *
 * A primeira versao pagava `quantidade * 4`, o que dava 40 no degrau 1 e
 * 128 no degrau 12 — abaixo do drop do proprio ogre. Ligar a 45 por nivel
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
 * O degrau 7 e a virada de criatura: o limo de nivel 6 tem 315 de HP e o
 * gigante do campo de provas tem 280. Ligado so no HP, o XP da missao
 * CAI de 378 para 336 no degrau 7 — e o jogador recebe menos por subir
 * de nivel, que e o oposto de uma escalada
 *
 * E por isso que o piso e o maximo entre o mob da zona e o degrau
 * anterior mais um degrau. O degrau paga sempre mais que o anterior, e
 * sempre mais que o mob que ele manda matar
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
 */
const NOME_CURTO = {
  slime: "limo",
  ogre: "ogre",
  ogre_da_predeira: "ogre_predeira",
  skeleton: "sentinela",
  zumbi_arbalist: "arqueiro_zumbi",
};

/** O nome da criatura como o jogador ve. */
const NOME_LEGIVEL = {
  slime: "limo",
  ogre: "ogre",
  ogre_da_predeira: "ogre da pedreira",
  skeleton: "sentinela esqueletica",
  zumbi_arbalist: "arqueiro zumbi",
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
  cripta: "Cripta Esquelética",
  ruinas: "Ruínas dos Ghouls",
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
  const base = zoneId.startsWith("m2_")
    ? zoneId.slice(3)
    : zoneId;

  const zona = getZoneById(zoneId);

  return ZONA_LEGIVEL[base] ?? zona?.name ?? zoneId;
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
 * recem-criada poderia撞 colidir com uma do mapa 1
 */
function idDoDegrau(mapa, indice, curto, zona, suffix = "") {
  return `${mapa}_main_${indice}_${curto}_${zona}${suffix}`;
}

/**
 * AS MISSOES PRINCIPAIS DO MAPA 1.
 *
 * ## POR QUE GERADAS E NAO ESCRITAS
 *
 * A regra "a secundaria tem metade e na mesma zona" e o que mantem a
 * campanha e a caixa de secundarias em acordo. Escritas a mao, as duas
 * listas divergem na quinta missao sem ninguem ver: o painel mostra uma
 * secundaria pedindo 10 na mesma zona de uma principal que pede 20, e
 * parece escolha de design
 *
 * Derivando as duas da mesma tabela, a metade e a zona sao consequencia e
 * nao promessa
 */
/**
 * O XP do degrau anterior da escada.
 *
 * Sai do `ESCADA` e nao da lista de missoes ja construida: o
 * `MAIN_QUESTS.map` se referenciaria a si mesmo, e o `const` ainda nao
 * estaria pronto no primeiro elemento
 */
function xpDoDegrauAnterior(indice) {
  if (indice <= 0) return 0;

  /**
   * A ESCADA INTEIRA, e nao so a do mapa 1.
   *
   * O piso de XP encadeia pelo degrau anterior. Com a lista do mapa 1, o
   * primeiro degrau do mapa 2 — indice 12 — leria `ESCADA_MAPA_1[11]`,
   * que e o ultimo degrau do mapa 1, e o piso do 13 comecaria de um
   * numero de outro mapa
   */
  const anterior = ESCADA[indice - 1];

  const tipoAnterior = CREATURE_TYPES[anterior.target];

  const hpAnterior = scaleForLevel(tipoAnterior, anterior.nivel).maxHp;

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
 * O NOME de um degrau novo, escrito a mao.
 *
 * Os doze nomes do mapa 1 sao historia: "Primeiros Passos", "O Gigante da
 * Pedreira". Um nome gerado seria "Degrau 13", que nao e uma missao, e
 * quem le a campanha repara
 */
const NOMES_MAPA_2 = {
  floresta: "A Sentinela do Portal",
  acampamento: "Vigia da Fenda",
  campina: "O Frio que Anda",
  ruinas: "Ossario Silencioso",
  cripta: "A ultima Guarda",
  treino: "Tiros no Alvo",
  brejo: "Passos na Lama",
  toca: "Ninho Alto",
  cinzas: "Fumo e Osso",
  dunas: "Areia Que Anda",
  pedreira: "Pedra Rachada",
  pantano: "O Fim da Estrada",
};

/**
 * A ESCADA DO MAPA 2.
 *
 * Um degrau por linha do `MAP_2_ROSTER`, na ordem em que o jogador
 * atravessa: entra pela Floresta, que e o 13, e sobe ate o Pantano, que e
 * o 25.
 *
 * ## DE ONDE VEM O ALVO
 *
 * Do `mix` da propria linha: o degrau mata o bicho que mora na zona. E o
 * que mantem a missao e o roster falando a mesma coisa — um degrau
 * pedindo limo numa zona so de sentinela seria uma missao que o jogador
 * nao consegue fechar
 *
 * O campo de provas e o unico com dois tipos, e o degrau pega o de
 * MAIOR peso: o arqueiro zumbi, que sao 6 dos 10 ali
 *
 * ## A QUANTIDADE SOBE SOZINHA
 *
 * `quantidadeDoDegrau` nao sabe que o mapa 2 existe: ela le o nivel. O
 * degrau 13 pede 34, contra os 32 do ultimo degrau do mapa 1 — a
 * campanha continuar subindo e o que faz a missao do mapa 2 pesar mais
 * sem nenhuma conta nova
 */
export const ESCADA_MAPA_2 = MAP_2_ROSTER.map((row) => {
  const dominante = Object.entries(row.mix ?? {}).reduce(
    (melhor, atual) => (atual[1] > melhor[1] ? atual : melhor),
  )[0];

  /**
   * O NIVEL do degrau.
   *
   * A linha do campo de provas tem dois tipos com dois niveis, e o
   * degrau e do DOMINANTE: o arqueiro, no 18. A sentinela no 19 e a
   * outra coisa que mora ali, e nao o alvo deste degrau
   */
  const nivel = row.niveis
    ? row.niveis[0]
    : (row.niveisPorTipo?.[dominante] ?? 13);

  return {
    target: dominante,
    nivel,
    zona: `m2_${row.zone}`,

    /**
     * O id da missao vai no save do jogador. Com `m2_` na zona e no
     * indice global, nenhuma missao do mapa 2 colide com uma do mapa 1
     */
    mapa: "map2",
    nome: NOMES_MAPA_2[row.zone] ?? `Degrau ${nivel}`,
  };
});

/**
 * A ESCADA INTEIRA: mapa 1 e depois mapa 2.
 *
 * Uma lista so, e nao duas. O `QuestLog` tem UM `mainIndex` e caminha
 * por ele; com duas listas o jogador terminaria a campanha do mapa 1, o
 * `getMainQuest` devolveria `null` e o auto ficaria sem objetivo
 *
 * A ordem concatena o mapa 1 inteiro e o mapa 2 inteiro, que e a ordem
 * em que o jogador atravessa: vale do 1 ao 12, Floresta do 13 ao 25
 */
const ESCADA = [...ESCADA_MAPA_1, ...ESCADA_MAPA_2];

export const MAIN_QUESTS = ESCADA.map((degrau, i) => {
  const quantidade = quantidadeDoDegrau(degrau.nivel);
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
      items: [{ itemId: "slime_core", count: 1 }],
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
  const metade = Math.ceil(
    quantidadeDoDegrau(degrau.nivel) / 2,
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
      items: [{ itemId: "slime_gel", count: 2 }],
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
  const alvo = mapa === "map_1" ? "map1" : mapa === "map_2" ? "map2" : mapa;

  return MAIN_QUESTS.filter((quest) =>
    quest.id.startsWith(`${alvo}_main_`));
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
   * O nome vai no motivo de proposito: sem ele o jogador ve "finalize a
   * campanha" e nao sabe o que procurar. `indice` e a ultima do mapa, e
   * o jogador parado nela e justamente o caso que o jogador mais
   * encontra — ele fez onze e falta a decima segunda
   */
  const quest = MAIN_QUESTS[indice];

  const doMapa = mainQuestsDoMapa(exigeMissaoDe).length;

  const feitas = Math.max(0, Math.min(mainIndex + 1, doMapa));

  return {
    ok: false,
    motivo: quest
      ? `Termine "${quest.name}" para atravessar (${feitas}/${doMapa} da campanha).`
      : "Termine a campanha deste mapa para atravessar.",
    questId: quest?.id ?? null,
  };
}

/** O mesmo "pode", so no formato curto do painel */
export function dadosDaTrava(exigeMissaoDe, mainIndex) {
  const veredito = portalLiberado(exigeMissaoDe, mainIndex);

  return {
    bloqueado: !veredito.ok,
    motivo: veredito.motivo ?? null,
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
