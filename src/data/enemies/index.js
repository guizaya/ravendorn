import {
  createRandom,
  getZoneById,
  MAP_1,
  MAP_1_SEED,
} from "../maps/index.js";
import { applyDropScaling } from "../../game/balance.js";

export const BEHAVIOR = {
  PASSIVE: "passive",
  SEMI_PASSIVE: "semiPassive",
  ACTIVE: "active",
};

/**
 * quanto cada nivel acima do base da criatura engrossa o bicho.
 * o HP e o dano sobem mais rapido que a defesa, senao o mob fica
 * imortal contra quem tem pouco ataque.
 */
export const CREATURE_GROWTH = {
  hpPerLevel: 0.22,
  damagePerLevel: 0.16,
  defensePerLevel: 0.12,
};

/**
 * A ESQUIVA das criaturas, que nao tem dado de atributo nenhum.
 *
 * Uma criatura e feita de hp, dano e defesa. Nao existe DEX em
 * `CREATURE_TYPES`, e dar esquiva pelo atributo seria inventar um
 * atributo que o resto do jogo nao conhece
 *
 * Entao a esquiva vem de um piso que sobe com o nivel, e o teto e o
 * que segura: um mob de nivel alto nao pode virar um alvo que o
 * jogador nunca acerta
 *
 * Sao 3% no nivel 1, subindo 0,25 ponto por nivel, ate 8%. Um jogador
 * de Warriro no nivel 1 tem cerca de 75 de precisao, que reduz essa
 * esquiva a uns 2% — o suficiente para o "MISS" aparecer, e raro o
 * bastante para nao parecer que o golpe falhou
 */
const CREATURE_EVASION_BASE = 0.03;
const CREATURE_EVASION_POR_NIVEL = 0.0025;
const CREATURE_EVASION_MAXIMA = 0.08;

/** variacao de nivel sorteada no roster: a maioria fica no base */
export const LEVEL_TIERS = [0, 0, 0, 1, 2];

/**
 * escala relativa ao nivel base do tipo: no nivel base o multador e 1,
 * entao o balanceamento atual continua igual.
 */
export function scaleForLevel(type, level) {
  const base = type.level ?? 1;
  const steps = (level ?? base) - base;

  return {
    maxHp: Math.max(
      1,
      Math.round(type.maxHp * (1 + CREATURE_GROWTH.hpPerLevel * steps)),
    ),
    damage: Math.max(
      1,
      Math.round(type.damage * (1 + CREATURE_GROWTH.damagePerLevel * steps)),
    ),
    defense: Math.max(
      0,
      Math.round(type.defense * (1 + CREATURE_GROWTH.defensePerLevel * steps)),
    ),
  };
}

export function resolveLevel(type, level) {
  return Math.max(1, Math.round(level ?? type.level ?? 1));
}

export const CREATURE_TYPES = {
  slime: {
    id: "slime",
    name: "Limo Preguiçoso",
    behavior: BEHAVIOR.PASSIVE,
    level: 1,
    maxHp: 140,
    defense: 2,
    radius: 21,
    speed: 48,
    damage: 7,
    attackRange: 44,
    aggroRange: 0,
    leash: 260,
    attackCooldown: 1.6,
    spriteScale: 1.5,
    wanderRadius: 150,
    wanderSpeed: 30,
    color: "#6fbf8a",
    loot: applyDropScaling({
      coins: { min: 3, max: 9 },
      itemChance: 0.34,
      maxItems: 1,
      items: [
        { id: "slime_gel", weight: 84 },
        { id: "slime_core", weight: 15 },
        { id: "skeleton_bone", weight: 1 },
      ],
    }),
  },

  rat: {
    id: "rat",
    name: "Rato da Toca",
    behavior: BEHAVIOR.PASSIVE,
    level: 2,
    maxHp: 90,
    defense: 1,
    radius: 15,
    speed: 96,
    damage: 6,
    attackRange: 36,
    aggroRange: 0,
    leash: 220,
    attackCooldown: 1.1,
    spriteScale: 1.15,
    wanderRadius: 190,
    wanderSpeed: 72,
    color: "#a08a63",
    loot: applyDropScaling({
      coins: { min: 5, max: 14 },
      itemChance: 0.4,
      maxItems: 1,
      items: [
        { id: "rat_tail", weight: 80 },
        { id: "rat_pelt", weight: 18 },
        { id: "goblin_cloth", weight: 2 },
      ],
    }),
  },

  goblin: {
    id: "goblin",
    name: "Goblin Saqueador",
    behavior: BEHAVIOR.SEMI_PASSIVE,
    level: 5,
    maxHp: 260,
    defense: 8,
    radius: 20,
    speed: 118,
    damage: 22,
    attackRange: 52,
    aggroRange: 0,
    leash: 620,
    attackCooldown: 1.5,
    spriteScale: 1.25,
    wanderRadius: 90,
    wanderSpeed: 40,
    color: "#8faf5a",
    loot: applyDropScaling({
      coins: { min: 12, max: 30 },
      itemChance: 0.5,
      maxItems: 2,
      items: [
        { id: "goblin_cloth", weight: 70 },

      ],
    }),
  },

  ghoul: {
    id: "ghoul",
    name: "Ghoul Faminto",
    behavior: BEHAVIOR.SEMI_PASSIVE,
    level: 8,
    maxHp: 420,
    defense: 14,
    radius: 23,
    speed: 104,
    damage: 34,
    attackRange: 50,
    aggroRange: 0,
    leash: 700,
    attackCooldown: 1.8,
    spriteScale: 1.4,
    wanderRadius: 70,
    wanderSpeed: 34,
    color: "#9a7fae",
    loot: applyDropScaling({
      coins: { min: 22, max: 52 },
      itemChance: 0.56,
      maxItems: 2,
      items: [
        { id: "ghoul_rot", weight: 78 },
        { id: "ghoul_claw", weight: 52 },
        { id: "ghoul_rib", weight: 30 },

      ],
    }),
  },

  skeleton: {
    id: "skeleton",
    name: "Sentinela Esquelética",
    behavior: BEHAVIOR.ACTIVE,
    level: 11,
    maxHp: 520,
    defense: 22,
    radius: 22,
    speed: 126,
    damage: 42,
    attackRange: 58,
    aggroRange: 330,
    leash: 900,
    attackCooldown: 1.6,
    spriteScale: 1.35,
    wanderRadius: 60,
    wanderSpeed: 30,
    color: "#cfd3d6",
    loot: applyDropScaling({
      coins: { min: 30, max: 68 },
      itemChance: 0.62,
      maxItems: 2,
      items: [
        { id: "skeleton_bone", weight: 58 },
        { id: "skeleton_skull", weight: 30 },

      ],
    }),
  },

  /**
   * O primeiro inimigo que ataca de LONGE.
   *
   * Todos os outros encostam e batem. Este nasce com a arte de oito
   * direcoes do arqueiro e por isso atira: a animacao de arco em cima
   * de um golpe corpo a corpo ficaria incoerente.
   *
   * `ranged` e o que muda o comportamento na IA: com ele, o bicho
   * entra em `retreat` quando o jogador chega perto demais, em vez de
   * ficar parado no lugar deixando o arquero colar nele.
   *
   * Fica declarado ENTRE o esqueleto e o ogre, e nao no fim do
   * arquivo, porque a ordem de declaracao e a ordem de poder: o
   * `loot` precisa crescer junto com o nivel, e um bicho de nivel 12
   * no fim da lista derrubaria a chance de item de todo mundo que
   * viesse antes.
   */
  zumbi_arbalist: {
    id: "zumbi_arbalist",
    name: "Arqueiro Zumbi",
    behavior: BEHAVIOR.ACTIVE,
    level: 12,
    maxHp: 360,
    defense: 12,
    radius: 20,
    speed: 100,
    damage: 30,
    attackRange: 300,
    aggroRange: 420,
    leash: 900,
    attackCooldown: 1.9,
    spriteScale: 1,
    wanderRadius: 70,
    wanderSpeed: 26,
    color: "#7fa650",

    // o tiro dele
    ranged: true,
    keepDistance: 190,
    projectileSpeed: 430,
    projectileRadius: 8,
    projectileStyle: "arrow",
    projectileColor: "#9ec46a",

    // 0.70 fica entre o esqueleto (0.62) e o ogre (0.78): e o preco
    // de um bicho de nivel 12 que atira de longe
    loot: applyDropScaling({
      coins: { min: 26, max: 60 },
      itemChance: 0.7,
      maxItems: 2,
      items: [
        { id: "ghoul_rot", weight: 44 },
        { id: "skeleton_bone", weight: 30 },
        { id: "ghoul_claw", weight: 18 },
        { id: "skeleton_skull", weight: 6 },

      ],
    }),
  },

  /**
   * O ogre da PREDEIRA: o segundo direcional, e o primeiro de
   * CORPO A CORPO com arte de oito direcoes.
   *
   * A pasta de origem chama o golpe de `shoot`, mas nao ha arco
   * nenhum: e o porrete. Por isso NAO ha `ranged` nem `keepDistance`
   * nem projétil, e e o campo `ranged` que decide: e ele que faz a
   * `EnemyAI` escolher entre `onShootPlayer` e `onDamagePlayer`, e
   * entre recuar e fechar. Sem ele, o ogre caminha ate o jogador e
   * bate de perto, que e o que o bicho precisa fazer.
   *
   * A velocidade e 118, a mesma do goblin saqueador e acima do ogre
   * da pedreira (92). O guerreiro anda a 165, entao da para
   * daria para passar por ele andando, e ele nunca vai encostar num
   * jogador que corre. Isso ja valia para o resto: nenhum mob do
   * jogo alcanca o guerreiro em linha reta. O que muda aqui e o
   * ARRANCADA inicial, que e o que o jogador ve quando o ogre
   * acorda.
   */
  ogre_da_predeira: {
    id: "ogre_da_predeira",
    name: "Ogre da Predeira",
    behavior: BEHAVIOR.ACTIVE,
    level: 16,
    maxHp: 1420,
    defense: 36,
    radius: 34,
    speed: 118,
    damage: 84,
    attackRange: 84,
    aggroRange: 430,
    leash: 1000,
    attackCooldown: 2.2,
    spriteScale: 1,
    wanderRadius: 56,
    wanderSpeed: 30,
    color: "#8a9a5b",

    // sem `ranged`: a `EnemyAI` so cria a arte de tiro e o
    // projétil quando o inimigo atira de longe
    loot: applyDropScaling({
      coins: { min: 95, max: 205 },
      itemChance: 0.8,
      maxItems: 3,
      items: [
        { id: "ogre_pebble", weight: 52 },
        { id: "ogre_hide", weight: 34 },


      ],
    }),
  },

  ogre: {
    id: "ogre",
    name: "Ogre da Pedreira",
    behavior: BEHAVIOR.ACTIVE,
    level: 15,
    maxHp: 1250,
    defense: 34,
    radius: 32,
    speed: 92,
    damage: 78,
    attackRange: 78,
    aggroRange: 400,
    leash: 1000,
    attackCooldown: 2.4,
    spriteScale: 1.9,
    wanderRadius: 50,
    wanderSpeed: 24,
    color: "#b07a52",
    loot: applyDropScaling({
      coins: { min: 85, max: 190 },
      itemChance: 0.78,
      maxItems: 3,
      items: [
      { id: "ogre_pebble", weight: 58 },
      { id: "ogre_hide", weight: 38 },


      ],
    }),
  },
};

export const TRAINING_DUMMY_BLUEPRINTS = [
  {
    id: "dummy_warrior",
    name: "Boneco de Madeira",
    maxHp: 1500,
    defense: 10,
    radius: 25,
    color: "#b78555",
    position: { x: 2820, y: 1900 },
  },
  {
    id: "dummy_mage",
    name: "Boneco Arcano",
    maxHp: 1100,
    defense: 5,
    radius: 25,
    color: "#8d76bf",
    position: { x: 3160, y: 2080 },
  },
  {
    id: "dummy_heavy",
    name: "Boneco Reforçado",
    maxHp: 2400,
    defense: 25,
    radius: 30,
    color: "#8e6849",
    position: { x: 2880, y: 2320 },
  },
  {
    id: "dummy_light",
    name: "Boneco Leve",
    maxHp: 900,
    defense: 2,
    radius: 22,
    color: "#c79c66",
    position: { x: 3260, y: 1860 },
  },
  {
    id: "dummy_control",
    name: "Boneco de Controle",
    maxHp: 1300,
    defense: 8,
    radius: 26,
    color: "#5b9b8e",
    position: { x: 2760, y: 2180 },
  },
  {
    id: "dummy_ranged",
    name: "Boneco de Longo Alcance",
    maxHp: 1000,
    defense: 4,
    radius: 24,
    color: "#7095b7",
    position: { x: 3380, y: 2200 },
  },
  {
    id: "dummy_poison",
    name: "Boneco de Ensaio",
    maxHp: 1200,
    defense: 6,
    radius: 25,
    color: "#a95774",
    position: { x: 3060, y: 2420 },
  },
];

export const ZONE_ROSTER = [
  {
    // A PREDEIRA nao e uma zona do mapa: o nome do ogre vem da arte
    // (a denseza onde ele vive), e nao de um bioma do jogo. Ele foi
    // posto na FLORESTA, que e a zona de mato do mapa e a unica
    // combinacao. Se um dia existir uma zona chamada predeira, e so
    // trocar o campo `zone` aqui.
    //
    // O peso e alto de proposito. Com 16 de 100 e 7 spawns, o
    // arredondamento do `allocateTypes` dava UM ogre da predeira no
    // mapa inteiro, a 2500px do nascimento: a arte nova nunca
    // aparecia em teste, e o que o jogador via era o ogre da
    // pedreira, com a arte antiga. Agora sao tres.
    zone: "floresta",
    count: 14,
    mix: {
      goblin: 46,
      rat: 12,
      ghoul: 10,
      slime: 8,
      ogre_da_predeira: 30,
    },
  },
  {
    zone: "acampamento",
    count: 6,
    mix: { goblin: 66, rat: 18, ghoul: 16 },
  },
  {
    zone: "campina",
    count: 7,
    mix: { skeleton: 60, slime: 24, ogre: 16 },
  },
  {
    zone: "ruinas",
    count: 7,
    mix: { ghoul: 62, skeleton: 24, goblin: 14 },
  },
  {
    zone: "toca",
    count: 7,
    mix: { rat: 70, goblin: 18, slime: 12 },
  },
  {
    zone: "brejo",
    count: 7,
    mix: { slime: 66, rat: 20, ghoul: 14 },
  },
  {
    zone: "cripta",
    count: 8,
    mix: { skeleton: 62, ogre: 18, ghoul: 12, zumbi_arbalist: 8 },
  },
  {
    zone: "cinzas",
    count: 7,
    mix: { ogre: 60, ghoul: 24, skeleton: 16 },
  },
  {
    zone: "dunas",
    count: 6,
    mix: { goblin: 60, rat: 24, ogre: 16 },
  },
  {
    zone: "pedreira",
    count: 7,
    mix: { ogre: 68, skeleton: 20, goblin: 12 },
  },
  {
    zone: "pantano",
    count: 7,
    mix: { ogre: 62, ghoul: 22, slime: 16 },
  },
];

function allocateTypes(count, mix) {
  const entries = Object.entries(mix);

  const total = entries.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );

  const exact = entries.map(([id, weight]) => ({
    id,
    value: (count * weight) / total,
  }));

  for (const entry of exact) {
    entry.count = Math.floor(entry.value);
    entry.rest = entry.value - entry.count;
  }

  let assigned = exact.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );

  const byRest = [...exact].sort(
    (a, b) => b.rest - a.rest,
  );

  let cursor = 0;

  while (assigned < count) {
    byRest[cursor % byRest.length].count += 1;
    assigned += 1;
    cursor += 1;
  }

  return exact
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ id: entry.id, count: entry.count }));
}

function buildZoneTypes(entry) {
  const allocated = allocateTypes(
    entry.count,
    entry.mix,
  );

  const types = [];

  for (const item of allocated) {
    for (let n = 0; n < item.count; n += 1) {
      types.push(item.id);
    }
  }

  return types;
}

export function createCreature(
  typeId,
  position,
  index,
  level,
) {
  const type = CREATURE_TYPES[typeId];

  if (!type) {
    throw new Error(`tipo de criatura desconhecido: ${typeId}`);
  }

  const resolvedLevel = resolveLevel(type, level);
  const scaled = scaleForLevel(type, resolvedLevel);

  return {
    ...type,
    ...scaled,

    id: `${typeId}_${index}`,

    // O `id` da criatura carrega o indice para ficar unico no mundo
    // (`skeleton_7`), entao NAO serve para achar sprite, loot nem
    // ficha de bestiario: todos esses registros usam o id do TIPO.
    // O `id` do tipo vinha no `...type` acima e era sobrescrito
    // nesta linha, entao o tipo de gato sumia do mob.
    typeId,

    level: resolvedLevel,
    baseLevel: type.level ?? 1,

    x: position.x,
    y: position.y,

    spawnX: position.x,
    spawnY: position.y,

    hp: scaled.maxHp,
    alive: true,

    isCreature: true,
    isDummy: false,

    /**
     * A ESQUIVA desta criatura, como FRACAO.
     *
     * Nenhuma criatura declara `evasion` no tipo, entao ela vem de um
     * valor base que cresce devagar com o nivel: um mob de nivel 1
     * escapa de uns 3% dos golpes e um de nivel 20 escapa de uns 8%.
     * O jogador ve o "MISS" aparecer de vez em quando, sem que o
     * primeiro slimesco do mapa seja um alvo impossivel
     *
     * E o MESMO formato do `evasion` do jogador — fracao, e nao um
     * numero de defesa. As duas unidades tem de bater, ou a chance de
     * errar sai de escala em um dos lados
     *
     * O boneco de DUELO e a excecao declarada em `evasion: 0`: um
     * alvo de treino que faz o jogador errar ensina a esperar, nao a
     * jogar. Ele esta nesta lista porque revida, entao e uma
     * criatura comum no combate
     */
    evasion:
      type.evasion ??
      Math.min(
        CREATURE_EVASION_MAXIMA,
        CREATURE_EVASION_BASE +
          (resolvedLevel - 1) * CREATURE_EVASION_POR_NIVEL,
      ),

    facing: { x: 0, y: 1 },

    hitFlash: 0,
    attackAnimation: 0,

    pushVelocity: { x: 0, y: 0 },
    statusEffects: [],

    respawnTimer: 0,

    aiState: "idle",
    aiTimer: 0,
    provoked: false,
    alerted: false,
    attackCooldownRemaining: 0,

    wanderTarget: null,
    wanderWait: 0,

    stuckTimer: 0,
    sidestepTimer: 0,
    sidestepSign: 1,

    spriteOffset: (index % 7) * 0.37,
  };
}

/**
 * AS CRIATURAS DE UM MAPA.
 *
 * O roster mora em `ZONE_ROSTER`, que aponta para `MAP_1_ZONES` por
 * id. Isso prendia o mundo ao vale: o hub, que nao tem zona nenhuma,
 * aparecia cheio de Pantano Profundo assim que o mapa entrava
 *
 * Agora o mapa decide. Cada entrada do roster so vira criatura se a
 * zona existir NO MAPA QUE ESTA SENDO MONTADO, e um hub sem zonas
 * devolve lista vazia — que e o correto para um hub
 *
 * Sem argumento continua sendo o vale, com a mesma seed de sempre. E o
 * que mantem de pe os testes que montam um elenco sem se preocupar com
 * mapa: eles perguntam "as criaturas do jogo", e o jogo ainda e o vale
 */
export function createCreatureRoster(
  map = MAP_1,
  seed = MAP_1_SEED,
) {
  const random = createRandom(seed);
  const roster = [];

  /**
   * Os ids das zonas deste mapa.
   *
   * Um `Set` porque a busca acontece uma vez por entrada do roster, e
   * as zonas do vale sao doze
   */
  const zonasDoMapa = new Set(
    (map.zones ?? []).map((zone) => zone.id),
  );

  let index = 0;

  for (const entry of ZONE_ROSTER) {
    // a zona existe, mas e de outro mapa: aqui nao mora ninguem
    if (!zonasDoMapa.has(entry.zone)) continue;

    const zone =
      map.zones.find((z) => z.id === entry.zone) ??
      getZoneById(entry.zone);

    if (!zone) {
      throw new Error(`zona desconhecida: ${entry.zone}`);
    }

    const columns = Math.ceil(Math.sqrt(entry.count));
    const rows = Math.ceil(entry.count / columns);

    const types = buildZoneTypes(entry);

    for (let slot = 0; slot < entry.count; slot += 1) {
      const column = slot % columns;
      const row = Math.floor(slot / columns);

      const cellWidth = zone.width / (columns + 1);
      const cellHeight = zone.height / (rows + 1);

      const jitterX = (random() - 0.5) * cellWidth * 0.55;
      const jitterY = (random() - 0.5) * cellHeight * 0.55;

      const position = {
        x: Math.round(
          zone.x + cellWidth * (column + 1) + jitterX,
        ),
        y: Math.round(
          zone.y + cellHeight * (row + 1) + jitterY,
        ),
      };

      const type = CREATURE_TYPES[types[slot]];

      const level = Math.max(
        1,
        (type.level ?? 1) +
          LEVEL_TIERS[
            Math.floor(random() * LEVEL_TIERS.length)
          ],
      );

      roster.push(
        createCreature(
          types[slot],
          position,
          index,
          level,
        ),
      );

      index += 1;
    }
  }

  return roster;
}

export const DUMMY_LOOT = applyDropScaling({
  coins: { min: 6, max: 18 },
  itemChance: 0.3,
  maxItems: 1,
  items: [
    { id: "dummy_wood", weight: 88 },
    { id: "goblin_cloth", weight: 9 },
    { id: "slime_gel", weight: 3 },
  ],
});

/**
 * O boneco de DUELO: o unico boneco de treino que revida.
 *
 * A regra pedida e: parado enquanto ninguem encosta, e assim que leva
 * o primeiro golpe ele vai ate QUEM BATEU e causa dano. Ele nao
 * vagueia, nao volta para casa e nao persegue o jogador mais proximo
 * como o resto dos mobs: trava no primeiro agressor e so troca de
 * alvo quando esse alvo MORRE, assumindo quem estiver batendo
 * nele.
 *
 * Os numeros sao de boneco de treino, e nao de mob: 1500 de vida e
 * um golpe leve o suficiente para o jogador aprender a distancia e a
 * sobreviver. O `speed` e menor que o do jogador de proposito: um
 * boneco que corre mais que o guerreiro nao serve para treinar
 * nada. Ajuste aqui se quiser outro tom.
 */
const DUEL_DUMMY = {
  speed: 96,
  damage: 16,
  attackRange: 70,
  attackCooldown: 2.4,
  aggroRange: Infinity,
  leash: Infinity,
  wanderRadius: 0,
  wanderSpeed: 0,

  /**
   * O boneco de duelo NAO escapa de golpe.
   *
   * E o unico boneco que revida, entao e uma criatura no meio das
   * outras e teria esquiva pelo nivel. Mas a funcao dele e servir de
   * alvo: um boneco que falha 3% das vezes ensina o jogador a esperar
   * o golpe passar em vez de aprender a acertar. As outras criaturas
   * ficam com a esquiva do nivel
   */
  evasion: 0,
};

/** O boneco de madeira e o de duelo. Os outros seis sao alvos fixos. */
const DUEL_DUMMY_IDS = new Set(["dummy_warrior"]);

export function createTrainingDummy(blueprint) {
  return {
    ...blueprint,

    level: 1,
    baseLevel: 1,

    x: blueprint.position.x,
    y: blueprint.position.y,

    spawnX: blueprint.position.x,
    spawnY: blueprint.position.y,

    hp: blueprint.maxHp,
    alive: true,

    isCreature: false,
    isDummy: true,

    // O `typeId` e o que o motor usa para achar a arte. O boneco
    // precisa dele tanto quanto uma criatura, senao o registro de
    // sprite nao acha nada e ele cai no corpo vetorial. Para o
    // boneco de madeira o proprio id serve de tipo
    typeId: blueprint.id,

    // `duelo` marca o boneco que revida. E o que a EnemyAI le para
    // rodar nele a regra do duelo; os outros seis ficam com zero
    // deste campo e continuam alvos fixos
    duelo: DUEL_DUMMY_IDS.has(blueprint.id)
      ? { ...DUEL_DUMMY }
      : null,

    // O desenho soma este valor no tempo da animacao. Sem ele o
    // tempo vira `NaN`, o retangulo de origem sai com `x: NaN` e o
    // boneco SOME: foi assim que a arte do boneco de madeira "nao
    // aparecia", carregada e valida, com o desenho recebendo
    // coordenadas invalidas
    spriteOffset: 0,

    facing: { x: 0, y: 1 },

    hitFlash: 0,
    attackAnimation: 0,

    pushVelocity: { x: 0, y: 0 },
    statusEffects: [],
    statusTickTimer: 0,

    loot: DUMMY_LOOT,

    respawnTimer: 0,

    aiState: "idle",
    aiTimer: 0,
    provoked: false,
    alerted: false,
    attackCooldownRemaining: 0,

    // A memoria do duelo. `targetId` e o ID do jogador travado: o
    // boneco nao troca de alvo enquanto esse jogador estiver vivo, e
    // e por isso que ele guarda o ID e nao a entidade. `lastHitById`
    // e quem esta batendo AGORA, e de onde vem o alvo quando o
    // primeiro morre
    targetId: null,
    lastHitById: null,
  };
}

/**
 * Os bonecos do Campo de Provas.
 *
 * Eles vivem dentro da zona de treino do vale, entao seguem a mesma
 * regra das criaturas: so aparecem no mapa que tem a zona. Um hub sem
 * `kind: "training"` devolve lista vazia
 */
export function createTrainingDummies(map) {
  if (map) {
    const temTreino = (map.zones ?? []).some(
      (zone) => zone.kind === "training",
    );

    if (!temTreino) return [];
  }

  return TRAINING_DUMMY_BLUEPRINTS.map(createTrainingDummy);
}
