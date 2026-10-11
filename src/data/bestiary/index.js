import {
  BEHAVIOR,
  CREATURE_TYPES,
  LEVEL_TIERS,
  MAP_2_ROSTER,
  ZONE_ROSTER,
} from "../enemies/index.js";
import { getZoneById } from "../maps/index.js";
import { ESCADA_MAPA_1, ESCADA_MAPA_2 } from "../quests/index.js";

export const BESTIARY_ICON = {
  slime: "◍",
  rat: "⌇",
  goblin: "☗",
  ghoul: "☠",
  skeleton: "⚔",
  ogre: "⛊",
  zumbi_arbalist: "✜",
  // o ogre da predeira e um ogre, entao divide o glifo do ogre da
  // pedreira. Um glifo novo aqui seria um caractere a mais de uma
  // fonte de icone, e a lista do bestiario ficaria com dois ogres
  // quase iguais: o nome e o que diferencia
  ogre_da_predeira: "⛊",
};

/**
 * Cada criatura do bestiario tem tres cacadas encadeadas.
 * A recompensa e um bonus PERMANENTE de stat e soma direto no
 * pipeline do equipamento, entao voltar a caçar um bicho antigo
 * continua valendo.
 */
const HUNT_TIERS = [
  { tier: 1, fator: 2 },
  { tier: 2, fator: 4 },
  { tier: 3, fator: 6 },
];

/**
 * O DEGRAU da missao principal que pede esta criatura.
 *
 * E o degrau da ESCADA, e nao o nivel do mob: o limo do campo e de nivel
 * 6 e o da pedreira e de nivel 1, e as duas cacadas de limo saem com o
 * MESMO total porque as duas copias o mesmo degrau
 *
 * ## POR QUE AS DUAS ESCADAS
 *
 * A sentinela e o arqueiro zumbi so aparecem na escada do mapa 2. Ler so
 * a do mapa 1 as faria cair no degrau 1 por falta de correspondencia, e
 * as cacadas da criatura mais cara do jogo sairiam com a mesma meta do
 * primeiro degrau do vale
 */
function degrauDaCriatura(typeId) {
  const achado = [
    ...ESCADA_MAPA_1,
    ...ESCADA_MAPA_2,
  ].find((degrau) => degrau.target === typeId);

  return achado?.nivel ?? 1;
}

/**
 * A MESMA CONTA da missao: 10 no primeiro degrau, mais 2 por nivel.
 *
 * Duplicada aqui de proposito, e nao importada: a conta do modulo de
 * missoes e uma funcao privada, e o bestiario precisa do numero, nao de
 * todo o catalogo de missoes. As duas contas juntas com o degrau sao o
 * que prende o bestiario na campanha — se uma mudar, a outra tem de
 * mudar junto
 */
function quantidadeBaseDoDegrau(nivel) {
  return 10 + (nivel - 1) * 2;
}

/** rotulo curto dos stats que o bestiario pode conceder */
export const BESTIARY_STAT = {
  maxHp: { label: "Vida", short: "VID" },
  speed: { label: "Velocidade", short: "VEL" },
  attackSpeed: { label: "Vel. Atq", short: "VEL. ATQ", percent: true },
  attack: { label: "Ataque", short: "ATQ" },
  defense: { label: "Defesa", short: "DEF" },
  resourceRegen: { label: "Regen", short: "REG" },
};

function formatStat(stat, value) {
  // regen e um valor absoluto (o equipamento usa a mesma unidade)
  const percent = BESTIARY_STAT[stat]?.percent === true;

  if (percent) {
    return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
  }

  return `+${Math.round(value)}`;
}

/** descricao legivel do bonus, ex: "+12 Vida  ·  +6% Vel. Atq" */
export function describeBonus(bonus) {
  return Object.entries(bonus ?? {})
    .map(([stat, value]) => {
      const info = BESTIARY_STAT[stat];

      return info
        ? `${formatStat(stat, value)} ${info.label}`
        : `${formatStat(stat, value)} ${stat}`;
    })
    .join("  ·  ");
}

/**
 * a vitrine de uma criatura e a zona onde ela e mais comum.
 * sem isso todas cairiam na primeira zona do roster.
 */
/**
 * O NIVEL MEDIO que uma zona da a uma criatura.
 *
 * Uma linha do roster declara `niveis: [min, max]` ou nao declara. Com o
 * intervalo, a media e a do meio dele. Sem ele, e o nivel base do tipo
 * mais a media do `LEVEL_TIERS` — que e o que o sorteio faz, so que
 * em vez de um numero sorteado e o valor esperado
 *
 * E por isso que a funcao nao sorteia: `zoneOf` e chamado na
 * construcao do bestiario, e uma media sorteada ali faria o "ir
 * matar" do mesmo creature apontar para zonas diferentes a cada
 * partida
 */
function nivelMedioDe(row, typeId) {
  /**
   * O NIVEL QUE A ZONA DAVA A ESTA CRIATURA, e nao o do tipo.
   *
   * O `niveisPorTipo` e o nivel exato: a linha do campo de provas diz
   * "aqui a sentinela e de nivel 19", mesmo que o tipovezade base 11
   *
   * Sem esta leitura, a linha sem `niveis` caia no nivel base do tipo
   * mais a media dos tiers, e a sentinela do mapa 2 mediava uns 12. O
   * `zoneOf` escolhe a zona de MENOR nivel, e o campo de provas — que
   * mediava menos que a Floresta, 13 — virava a casa dela. O "ir matar
   * sentinela" levava o jogador para o lado errado do mapa
   */
  if (row.niveisPorTipo?.[typeId] !== undefined) {
    return row.niveisPorTipo[typeId];
  }

  if (row.niveis) {
    return (row.niveis[0] + row.niveis[1]) / 2;
  }

  const base = CREATURE_TYPES[typeId].level ?? 1;

  const soma = LEVEL_TIERS.reduce((acc, tier) => acc + tier, 0);

  return base + soma / LEVEL_TIERS.length;
}

/**
 * A ZONA que o "ir matar" leva o jogador.
 *
 * ## A REGRA: MAIS FACIL PRIMEIRO, PESO NO EMPATE
 *
 * Entre as zonas onde a criatura aparece, vence a de **menor nivel
 * medio**. No empate, vence a de **maior peso** no mix
 *
 * ## POR QUE O PESO SOZINHO NAO SERVIA
 *
 * A versao anterior escolhia so pelo maior peso, e as tres zonas de limo
 * acabaram com `slime: 100` — o Pantano (nivel 1 e 2), a Pedreira (nivel
 * 2) e as Dunas (nivel 3). Com peso identico, o desempate era a ordem
 * do array, e ela mudou sozinho a cada zona slime-only que foi criada.
 * O "ir matar limo" chegou a levar o jogador para o degrau mais
 * avancado da progressao, que e o contrario do que um bestiario deve
 * fazer
 *
 * ## POR QUE O PESO NO EMPATE
 *
 * So pelo nivel, o rato iria para a Floresta: ele aparece nas cinco
 * zonas com o mesmo nivel medio, e a Floresta e a primeira declarada.
 * A Toca dos Ratos, que tem peso 70 contra 12 da floresta, e a casa
 * dele. O peso entra como segundo criterio, e e ele que mantem o rato
 * na toca e o goblin no acampamento
 *
 * O resultado e que **apenas o limo muda**: todas as outras sete
 * criaturas continuam apontando para a mesma zona de antes
 *
 * ## POR QUE ESTA EXPORTADA
 *
 * `BESTIARY` e montado uma vez, no load do modulo. Um teste que
 * reordenasse o `ZONE_ROSTER` depois disso nao mediria nada: o
 * bestiario ja estaria pronto e a inversao do array nao teria efeito
 * sobre ele. Exportar a funcao e o que permite chamar com a ordem
 * invertida de verdade e ver a diferenca
 */
export function zoneOf(typeId) {
  let best = null;

  /**
   * OS DOIS ROSTERS, e nao so o do mapa 1.
   *
   * A sentinela e o arqueiro zumbi so existem no mapa 2, e o `zoneOf`
   * deles precisa vir do `MAP_2_ROSTER`. Sem esta segunda passada, o
   * `zoneId` das duas cairia em `null` e o "ir matar" nao apareceria —
   * a mesma vitrine decacada que a lista de criaturas ja teve
   *
   * O `best` e o MESMO nos dois loops de proposito: as duas criaturas nao
   * dividem zona com ninguem do outro mapa, entao o "menor nivel vence"
   * roda uma vez so e o criterio continua valendo entre mapas
   */
  for (const [roster, prefixo] of [
    [ZONE_ROSTER, ""],
    [MAP_2_ROSTER, "m2_"],
  ]) {
    for (const row of roster) {
    const weight = row.mix?.[typeId] ?? 0;

    if (weight <= 0) continue;

    const nivel = nivelMedioDe(row, typeId);

    /**
     * O predicado inteiro em uma linha, e nao dois `if`.
     *
     * Separado em "descarta se nivel maior" e "descarta se nivel igual e
     * peso menor", o segundo `if` mostraria que empate de nivel nao e o
     * mesmo que empate de peso — e um `<` trocado ali manda o rato para
     * a Floresta sem erro nenhum
     */
    if (
      best &&
      (nivel > best.nivel ||
        (nivel === best.nivel && weight <= best.weight))
    ) {
      continue;
    }

    best = { zona: `${prefixo}${row.zone}`, weight, nivel };
    }
  }

  /**
   * O `zoneId` devolvido e o do MAPO DA CRIATURA.
   *
   * A sentinela devolve `m2_floresta` e nao `floresta`: sao ids
   * diferentes, e o `getZoneById` so acha a zona certa com o prefixo. Um
   * `floresta` aqui levaria o "ir matar" do mapa 2 para o mapa 1
   */
  return best ? getZoneById(best.zona) : null;
}

function buildHunts(typeId, rewards) {
  /**
   * A CACADA E A MISSAO PRINCIPAL DA ZONA, EM DOSES MAIORES.
   *
   * O degrau 1 pede 10 limos, entao a cacada 1 pede 20, a 2 pede 40 e a
   * 3 pede 60
   *
   * E a MESMA conta da missao, e nao um numero solto. Com 5, 15 e 40
   * fixos, a primeira cacada do ogre da pedreira (que so aparece do
   * degrau 8 em diante) pedia MENOS que a missao que o jogador acabou
   * de fechar: 5 contra 24. O melhorio de stats saia mais barato que
   * a missao que acabava de fechar, e o bestiario virava um atalho
   */
  const base = quantidadeBaseDoDegrau(degrauDaCriatura(typeId));

  return HUNT_TIERS.map((tier, index) => {
    const count = base * tier.fator;

    return {
      id: `${typeId}_cacada_${tier.tier}`,
      creatureId: typeId,
      tier: tier.tier,
      count,

      /**
       * A BASE DE ONDE A CACADA SAIU, e o fator.
       *
       * E o que permite a tela dizer "2x o que a missao pedia" em vez
       * de um numero solto, e o que faz o jogador entender que a cacada
       * acompanha a campanha
       */
      baseDaMissao: base,
      fator: tier.fator,

      title: `${count}x ${CREATURE_TYPES[typeId].name}`,
      summary: `Mate ${count} ${CREATURE_TYPES[typeId].name} para wonhar ${describeBonus(rewards[index])}`,
      reward: rewards[index],
    };
  });
}

const REWARDS = {
  slime: [
    { maxHp: 12 },
    { speed: 4 },
    { maxHp: 20, attackSpeed: 0.04 },
  ],
  rat: [
    { speed: 6 },
    { attackSpeed: 0.05 },
    { speed: 10, maxHp: 15 },
  ],
  goblin: [
    { attack: 6 },
    { maxHp: 30, speed: 4 },
    { attack: 10, attackSpeed: 0.06 },
  ],
  ghoul: [
    { maxHp: 45 },
    { defense: 10 },
    { maxHp: 60, resourceRegen: 2 },
  ],
/**
 * A sentinela agora e ATIRADORA, e a recompensa mudou de leitura.
 *
 * Antes ela era um esqueleto de perto: 520 de vida contra 360 do
 * arqueiro zumbi, e o bonus era vida e defense, porque o bicho chegava
 * em cima. Caçar de longe inverte a leitura — e o que o arqueiro zumbi
 * recebe, com uma camada a mais pelo nivel 11 contra o 12
 *
 * Manter `defense` aqui daria uma recompensa de esqueleto de perto
 * para uma criatura que o jogador nunca encosta: o bonus nao
 * descreveria o bicho
 */
skeleton: [
  { attack: 12 },
  { attack: 10, attackSpeed: 0.05 },
  { maxHp: 70, attack: 14, speed: 6 },
],

  ogre: [
    { maxHp: 90 },
    { attack: 18, defense: 18 },
    { maxHp: 120, attackSpeed: 0.08, speed: 6 },
  ],

  // o arqueiro zumbi e mais fraco que a sentinela (360 de vida contra
  // 520), e os dois atiram de longe. A sentinela e a mais dura e a que
  // mantem a distancia maior, entao a recompensa dela e a mesma
  // leitura: ataque e cadencia
  zumbi_arbalist: [
    { attack: 10 },
    { maxHp: 40, attackSpeed: 0.05 },
    { attack: 14, speed: 6 },
  ],

  // o ogre da predeira e o mais duro dos caçados: 1420 de vida
  // contra 1250 do ogre da pedreira. A recompensa segue a leitura
  // de um bicho grande e lento que chega perto: vida e defesa, e
  // nao velocidade como o arqueiro zumbi
  ogre_da_predeira: [
    { maxHp: 70 },
    { defense: 16, maxHp: 50 },
    { attack: 16, maxHp: 90 },
  ],
};

/**
 * AS CRIATURAS QUE MORAM NO MAPA 1.
 *
 * ## POR QUE NAO E TODA CRIATURA DECLARADA
 *
 * `CREATURE_TYPES` tem oito tipos, e o mapa 1 tem tres: o limo, o ogre
 * da predeira e o ogre da pedreira. Rato, goblin, ghoul, esqueleto e
 * arqueiro zumbi foram removidos do `ZONE_ROSTER` quando as cinco zonas
 * do meio do mapa passaram a ser so de ogre
 *
 * Listar os cinco aqui dava uma vitrine decacada que nao se fecha: o
 * `zoneOf` devolvia `null`, o "ir matar" nao aparecia, e o jogador via
 * um bicho no bestiario que nao existia em lugar nenhum do mundo — sem
 * nenhum aviso de que aquilo era impossivel
 *
 * ## POR QUE O ROSTER E A FONTE, E NAO UMA LISTA
 *
 * Ler o `ZONE_ROSTER` e o que mantem a vitrine e o mundo em acordo sem
 * manutencao. Quando uma zona trocar de criatura, a vitrine troca no
 * mesmo commit — e se um tipo for usado em duas zonas, ele aparece uma
 * vez so
 */
/**
* AS CRIATURAS DO CODEX.
   *
   * ## DERIVADAS DOS ROSTERS, E NAO ESCRITAS A MAO
   *
   * Porque a lista precisa se manter em dia sozinha: uma criatura que entra
   * numa zona do `ZONE_ROSTER` ja entra no Codex, sem ninguem editar este
   * arquivo. Uma lista escrita a mao envelhecia em silencio — o bicho novo
   * aparecia no mapa e nao aparecia no bestiario, e ninguem via o defeito
   *
   * E o mesmo `zoneOf` que decide o `zoneId` caminha pelos DOIS rosters,
   * entao os dois entram aqui. Sem o `MAP_2_ROSTER`, as criaturas que so
   * existem no mapa 2 ficariam fora do Codex enquanto apareciam no jogo
   *
   * ## POR QUE O `filter` PELO `REWARDS`
   *
   * Porque `buildHunts` le `rewards[index]` e um `undefined` ali joga o
   * modulo inteiro no chao na carga — sem erro de sintaxe, sem erro de
   * log, so um `TypeError` que derruba o jogo na abertura. Criaturas sem
   * recompensa ainda nao entram no Codex; o dia que entrarem, ganham
   * entrada no `REWARDS` na mesma hora
   */
  const CRIATURAS_DO_JOGO = [
    ...new Set(
      [...ZONE_ROSTER, ...MAP_2_ROSTER].flatMap((row) =>
        Object.keys(row.mix ?? {}),
      ),
    ),
  ].filter((typeId) => CREATURE_TYPES[typeId] && REWARDS[typeId]);
  
  export const BESTIARY = CRIATURAS_DO_JOGO.map(
  (typeId) => {
    const type = CREATURE_TYPES[typeId];
    const zone = zoneOf(typeId);

    return {
      id: typeId,
      creatureId: typeId,
      name: type.name,

      /**
       * `icon` e `color` NAO SAO DO PAINEL DE BESTIARIO.
       *
       * O cartao da criatura no painel ficou sem glifo, e pareceu que
       * estes dois campos tinham ficado sem leitor. Nao: o
       * `bestiaryAutoSnapshot` do motor monta a caixa de cacada automatica
       * da HUD a partir da MESMA entrada, e e dela que vem o icone
       * colorido que aparece no alto da tela quando a cacada esta rodando
       *
       * Sao duas leituras em telas diferentes, entao o campo continua
       * aqui. O que foi removido foi o `<span>` do painel, nao o dado
       */
      icon: BESTIARY_ICON[typeId] ?? "?",
      level: type.level,
      behavior: type.behavior,
      color: type.color,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      hunts: buildHunts(typeId, REWARDS[typeId]),
    };

  },
);

export const TOTAL_HUNTS = BESTIARY.reduce(
  (sum, entry) => sum + entry.hunts.length,
  0,
);

export function getBestiaryEntry(id) {
  return BESTIARY.find((entry) => entry.id === id) ?? null;
}
