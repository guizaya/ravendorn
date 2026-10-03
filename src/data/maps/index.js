import {
  PROP_TYPES,
  propVariantCount,
} from "../props/index.js";
import { PORTALS } from "../portais/index.js";
import { BASE_MAP } from "./base.js";
import {
  minimapColorFor,
  terrainLabelColor,
} from "../terrain/index.js";

/**
 * AS PROPS VOLTARAM AO MAPA — mas so uma: a arvore.
 *
 * A flag quegoverna isso e a `MAP_1_PROPS_LIGADAS`, logo abaixo. Ela estava
 * `false` depois de as props antigas serem retiradas, e esta e a etapa
 * seguinte: o vale ganhou uma arvore de verdade, spreade pelo mapa
 *
 * O que mudou em relacao ao estado anterior:
 *
 *   - `BLOCKING_PLAN` passou a ter SO `arvore`, e a quantidade e 180
 *   - nao ha mais decorativo: os 620 arbustos continuam fora
 *   - `treeSmall`, `treeMedium`, `treeLarge`, `rock` e `bush` continuam
 *     no catalogo e na folha `props.png`, intactos e desenhaveis, mas
 *     nenhuma e posicionada
 *
 * A CONSEQUENCIA NO JOGO: a arvore VOLTOU A BLOQUEAR PASSAGEM, pelo
 * tronco de 11px de raio. O vale deixou de ser um campo aberto — e o
 * inimigo que antes atravessava onde hoje ha arvore volta a desviar
 *
 * Para desligar de novo: so esta flag
 */
export const MAP_1_PROPS_LIGADAS = true;

export const MAP_1_SEED = 20260929;

export function createRandom(seed = MAP_1_SEED) {
  let state = seed | 0;

  return function random() {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAP_1_WIDTH = 6000;
export const MAP_1_HEIGHT = 4200;
export const MAP_1_BOUNDS = {
  x: 40,
  y: 40,
  width: MAP_1_WIDTH - 80,
  height: MAP_1_HEIGHT - 80,
};

export const MAP_1_SPAWN = { x: 3000, y: 2100 };

export const MAP_1_ZONES = [
  {
    id: "treino",
    name: "Campo de Provas",
    kind: "training",
    terrain: "grass",
    terrainAlt: "dirt",
    altBias: 0.22,
    x: 2560,
    y: 1700,
    width: 1000,
    height: 900,
  },

  {
    id: "floresta",
    name: "Floresta Sombria",
    kind: "semi",
    terrain: "forest",
    terrainAlt: "grass",
    altBias: 0.3,
    x: 80,
    y: 80,
    width: 1300,
    height: 1250,
  },

  {
    id: "acampamento",
    name: "Acampamento Goblin",
    kind: "semi",
    terrain: "dirt",
    terrainAlt: "forest",
    altBias: 0.28,
    x: 1520,
    y: 100,
    width: 1300,
    height: 1150,
  },

  {
    id: "campina",
    name: "Campina Gelada",
    kind: "active",
    terrain: "ice",
    terrainAlt: "stone",
    altBias: 0.26,
    x: 3080,
    y: 80,
    width: 1300,
    height: 1250,
  },

  {
    id: "ruinas",
    name: "Ruínas dos Ghouls",
    kind: "semi",
    terrain: "stone",
    terrainAlt: "ash",
    altBias: 0.24,
    x: 4560,
    y: 100,
    width: 1320,
    height: 1180,
  },

  {
    id: "toca",
    name: "Toca dos Ratos",
    kind: "passive",
    terrain: "dirt",
    terrainAlt: "swamp",
    altBias: 0.26,
    x: 100,
    y: 1480,
    width: 1300,
    height: 1200,
  },

  {
    id: "brejo",
    name: "Brejo Lento",
    kind: "passive",
    terrain: "swamp",
    terrainAlt: "forest",
    altBias: 0.3,
    x: 1520,
    y: 1420,
    width: 900,
    height: 1240,
  },

  {
    id: "cripta",
    name: "Cripta Esquelética",
    kind: "active",
    terrain: "stone",
    terrainAlt: "ice",
    altBias: 0.22,
    x: 4620,
    y: 1460,
    width: 1280,
    height: 1200,
  },

  {
    id: "cinzas",
    name: "Vale das Cinzas",
    kind: "active",
    terrain: "ash",
    terrainAlt: "stone",
    altBias: 0.28,
    x: 80,
    y: 2880,
    width: 1360,
    height: 1200,
  },

  {
    id: "dunas",
    name: "Dunas Perdidas",
    kind: "semi",
    terrain: "sand",
    terrainAlt: "ash",
    altBias: 0.24,
    x: 1560,
    y: 2860,
    width: 1300,
    height: 1220,
  },

  {
    id: "pedreira",
    name: "Pedreira do Ogro",
    kind: "active",
    terrain: "sand",
    terrainAlt: "stone",
    altBias: 0.3,
    x: 3080,
    y: 2880,
    width: 1300,
    height: 1200,
  },

  {
    id: "pantano",
    name: "Pântano Profundo",
    kind: "active",
    terrain: "swamp",
    terrainAlt: "ash",
    altBias: 0.26,
    x: 4560,
    y: 2860,
    width: 1340,
    height: 1220,
  },
];

for (const zone of MAP_1_ZONES) {
  zone.mapColor = minimapColorFor(zone.terrain);
  zone.color = terrainLabelColor(zone.terrain);
}

export function getZoneById(id) {
  return MAP_1_ZONES.find((zone) => zone.id === id) ?? null;
}

const KEEP_CLEAR = [
  { x: MAP_1_SPAWN.x - 220, y: MAP_1_SPAWN.y - 220, r: 440 },
  ...MAP_1_ZONES.map((zone) => ({
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
    r: Math.min(zone.width, zone.height) / 2,
  })),
];

function isClear(x, y, half) {
  for (const area of KEEP_CLEAR) {
    const dx = x - area.x;
    const dy = y - area.y;

    if (Math.hypot(dx, dy) < area.r + half) {
      return false;
    }
  }

  return (
    x - half > MAP_1_BOUNDS.x + 40 &&
    y - half > MAP_1_BOUNDS.y + 40 &&
    x + half < MAP_1_BOUNDS.x + MAP_1_BOUNDS.width - 40 &&
    y + half < MAP_1_BOUNDS.y + MAP_1_BOUNDS.height - 40
  );
}

const ZONE_MARGIN = 46;

function insideAnyZone(x, y, margin = 0) {
  for (const zone of MAP_1_ZONES) {
    if (
      x > zone.x - margin &&
      x < zone.x + zone.width + margin &&
      y > zone.y - margin &&
      y < zone.y + zone.height + margin
    ) {
      return true;
    }
  }

  return false;
}

/**
 * O que o vale tem hoje: SO arvores, do tipo novo.
 *
 * Os tipos antigos (`treeSmall`, `treeMedium`, `treeLarge`, `rock`) e o
 * arbusto continuam no catalogo e na folha de 32px, mas nao sao
 * posicionados. Sao arte de pixel art em um jogo que ficou com uma
 * unica prop ilustrada, e misturar as duas estilas no mesmo cenario
 * ficava estranho
 *
 * Se quiser os arbustos de volta, e so acrescentar `{ type: "bush" }`
 * aqui e subir o `QUANTIDADE_DECORATIVA`
 */
const BLOCKING_PLAN = [
  { type: "arvore", weight: 100 },
];

/**
 * Quantas arvores.
 *
 * O numero e uma troca entre densidade e custo: cada arvore e um
 * obstaculo de colisao, e o `CollisionSystem` consulta a lista toda a
 * cada teste de posicao livre. O vale tinha 129 obstaculos antes das
 * props serem tiradas; 180 fica perto disso
 *
 * A densidade vem do espaco minimo entre uma e outra: com `radius: 46`,
 * o `placeProps` exige 46 + 46 + 34 = 126px de centro a centro, e a
 * copa tem 96px. Ou seja, uma folga de 30px entre as copas — bosque,
 * e nao muro
 *
 * ESTE NUMERO E UM TETO, E O VALE FICA COM MENOS
 *
 * O `placeProps` da 40 tentativas por arvore e desiste se nao achar
 * lugar. Pedir 180 rende 137, porque as 12 zonas de criatura ocupam
 * 73% da area util e nenhuma arvore pode entrar nelas — e o lugar de
 * spawn e de mundo esta la dentro
 *
 * 137 arvores dao uma a cada 422px de lado, ou umas 5 por tela de
 * 1280x720. Para encher mais, o caminho e afrouxar a regra de zona,
 * e nao subir este numero: as arvores sumiriam de onde o jogo acontece
 */
const QUANTIDADE_ARVORES = 180;

/**
 * Nenhum decorativo.
 *
 * O `placeProps` ainda roda, com contagem zero. Ele fica no lugar
 * porque e o mesmo caminho de sorteio que as arvores usam, e porque
 * `decorative` continua no formato de saida — o minimapa e os testes leem
 * essa lista
 */
const DECORATIVE_PLAN = [];

const QUANTIDADE_DECORATIVA = 0;

function pickPlanEntry(plan, roll) {
  let total = 0;

  for (const entry of plan) {
    total += entry.weight;
  }

  let cursor = roll * total;

  for (const entry of plan) {
    cursor -= entry.weight;

    if (cursor <= 0) return entry;
  }

  return plan[plan.length - 1];
}

function placeProps(
  plan,
  count,
  random,
  accept,
  others = [],
  prefix = "prop",
) {
  const placed = [];
  const minimumGap = 34;

  for (let index = 0; index < count; index += 1) {
    let attempts = 0;
    let accepted = false;

    while (attempts < 40 && !accepted) {
      attempts += 1;

      const x = MAP_1_BOUNDS.x + 70 + random() * (
        MAP_1_BOUNDS.width - 140
      );
      const y = MAP_1_BOUNDS.y + 70 + random() * (
        MAP_1_BOUNDS.height - 140
      );

      const entry = pickPlanEntry(plan, random());
      const type = PROP_TYPES[entry.type];

      if (!accept(x, y, type.radius)) continue;

      let blocked = false;

      for (const other of [...placed, ...others]) {
        const gap = type.radius + other.radius;

        if (
          Math.hypot(x - other.x, y - other.y) <
          gap + minimumGap
        ) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      placed.push({
        id: `${prefix}_${entry.type}_${index}`,
        type: entry.type,
        isTree: type.isTree ?? entry.type.startsWith("tree"),
        x: Math.round(x),
        y: Math.round(y),
        radius: type.radius,
        colliderRadius: type.collider,
        blocking: type.blocking,
        variant: Math.floor(
          random() * propVariantCount(type),
        ),
      });

      accepted = true;
    }
  }

  return placed;
}

/**
 * Posiciona as props, ou nao.
 *
 * `ligadas` tem o padrao da `MAP_1_PROPS_LIGADAS`, que e `false`: o mapa
 * nasem tem prop. Passando `true` o sorteio inteiro acontece como
 * sempre — e o que os testes usam para continuar provando o
 * mecanismo
 */
export function createProps(
  seed = MAP_1_SEED,
  ligadas = MAP_1_PROPS_LIGADAS,
) {
  /**
   * Sem props, e nao com props quebradas.
   *
   * Tres listas vazias em vez de `undefined`: o `GameEngine`, o minimapa
   * e o `CollisionSystem` percorrem todas com `for` e contam `.length`,
   * entao lista vazia e o estado que eles ja sabem tratar
   */
  if (!ligadas) {
    return { props: [], blocking: [], decorative: [] };
  }

  const random = createRandom(seed ^ 0x5f3a);

  const blocking = placeProps(
    BLOCKING_PLAN,
    QUANTIDADE_ARVORES,
    random,
    (x, y, radius) =>
      isClear(x, y, radius) &&
      !insideAnyZone(x, y, ZONE_MARGIN),
    [],
    "arvore",
  );

  const decorative = placeProps(
    DECORATIVE_PLAN,
    QUANTIDADE_DECORATIVA,
    random,
    (x, y, radius) => {
      if (
        x - radius < MAP_1_BOUNDS.x + 30 ||
        y - radius < MAP_1_BOUNDS.y + 30 ||
        x + radius > MAP_1_BOUNDS.x + MAP_1_BOUNDS.width - 30 ||
        y + radius > MAP_1_BOUNDS.y + MAP_1_BOUNDS.height - 30
      ) {
        return false;
      }

      return (
        Math.hypot(x - MAP_1_SPAWN.x, y - MAP_1_SPAWN.y) > 190
      );
    },
    blocking,
    "bush",
  );

  return {
    props: [...blocking, ...decorative],
    blocking,
    decorative,
  };
}


/**
 * As props bloqueantes viram obstaculos de colisao.
 *
 * O collider do prop e MENOR que a copa de propósito: `treeLarge` tem
 * `radius: 34` e `collider: 14`. Usando a copa inteira, o jogador
 * parava de andar a um metro da arvore, do lado de dentro da sombra
 *
 * A funcao esta exportada porque e a MESMA conta que o mapa faz, e o
 * `PropRenderer.test.js` precisa refaze-la para montar um mapa com
 * props num teste. Duas copias da conta divergiriam, e o teste passaria
 * com um collider diferente do que o jogo usa
 */
export function buildPropSolids(blocking = []) {
  return blocking.map((prop) => {
    const half = prop.colliderRadius;

    return {
      x: prop.x - half,
      y: prop.y - half,
      width: half * 2,
      height: half * 2,
      kind: prop.type,
    };
  });
}

const { props, blocking, decorative } = createProps();

const solids = buildPropSolids(blocking);

export const MAP_1 = {
  id: "map_1",
  name: "Mapa 1",

  width: MAP_1_WIDTH,
  height: MAP_1_HEIGHT,

  bounds: MAP_1_BOUNDS,

  background: "#17221f",

  /**
   * A GRAMA, o chao deste mapa
   *
   * Chave, e nao URL: o `groundTileFor` traduz. O mapa base declara
   * "cidade" e este declara "grama"
   */
  groundTile: "grama",

spawn: MAP_1_SPAWN,

  /**
   * O VALE CONTINUA DE ONDE VOCE PAROU.
   *
   * O oposto do hub: aqui o save manda na posicao, porque o mapa e de
   * exploracao e voltar no meio do nada seria perder o caminho que
   * ainda estava pela frente
   *
   * A posicao continua sendo validada contra os limites do mapa — o
   * vale aceita o save dele, e nada mais
   */
  resumeWhereLeftOff: true,

  /**
   * O VALE NAO APERTA A CAMERA.
   *
   * `1` e o enquadramento de sempre: a tela mostra `viewport.width` de
   * mundo, do jeito que mostrava antes de o hub existir
   *
   * Fica escrito porque o hub declara `1 / 0.7`, e a diferenca entre os
   * dois e o proposito — o vale e um mundo para andar, o hub e uma praca
   * para olhar de perto
   */
  cameraZoom: 1,

  /**
   * A semente que espalha criaturas e arvores deste mapa.
   *
   * Vive no mapa e nao no motor: e o vale que sorteia, e nao o motor
   * que sabe qual e a seed do vale
   */
  seed: MAP_1_SEED,

  /**
   * As zonas COMpletas, nao so o retangulo.
   *
   * Esta copia existia porque o mapa so usava `x/y/width/height`. Com o
   * segundo mapa ela virou um buraco: `GameEngine` passou a ler as
   * zonas de `map.zones` para desenhar o terreno e o minimapa, e o
   * roster de criaturas precisa de `id` e `kind` para saber quem mora
   * onde
   *
   * `label` e o que o minimapa escreve na area. Antes vinha de `name` e
   * nao existia, entao o nome nunca aparecia
   */
  zones: MAP_1_ZONES.map((zone) => ({
    ...zone,
    label: zone.name,
  })),

  props,
  blocking,
  decorative,
  solids,

  /**
   * O portal, em (5618, 3837).
   *
   * Vem do catalogo de portais e nao e montado aqui: e um enfeite com
   * posicao pedida, e nao algo que o sorteio do mapa decida. Ele cai
   * dentro do Pantano Profundo, que e zona de mob — ver o comentario no
   * `src/data/portais/index.js`
   *
   * Nao entra em `solids`: o portal e decorativo e nao barra passagem
   */
  portals: PORTALS,
};

export const MAP_1_META = {
  width: MAP_1_WIDTH,
  height: MAP_1_HEIGHT,
  bounds: MAP_1_BOUNDS,
  spawn: MAP_1_SPAWN,
  zones: MAP_1_ZONES,
};

/**
 * O REGISTRO DE MAPAS.
 *
 * Sao dois mapas, e o jogo abre no `base`.
 *
 * A chave e o `id` de cada mapa. E o que o `getMap` recebe, e o que
 * o `save` deve guardar quando o jogo saber travel entre eles
 *
 * A ordem de declaracao NAO e a ordem de importance: `base` vem
 * primeiro porque e o inicial
 */
export const MAPS = {
  base: BASE_MAP,
  map_1: MAP_1,
};

/**
 * O MAPA QUE O JOGO ABRE.
 *
 * O `base`: o hub. E o que o `GameCanvas` e o `GameServer` pedem ao
 * entrar no mundo
 */
export const DEFAULT_MAP_ID = "base";

/**
 * O mapa de um id.
 *
 * Devolve o `DEFAULT_MAP_ID` quando o id nao existe no registro.
 *
 * Um `null` aqui quebraria o `setMap` na cara do jogador, com uma tela
 * preta e um erro no console. Um id errado — um save de uma versao
 * futura, um link guardado a mao — e melhor cair no hub do que
 * derrubar o mundo
 */
export function getMap(id) {
  return MAPS[id] ?? MAPS[DEFAULT_MAP_ID];
}

/**
 * O mapa de um id, OU `null` se ele nao existir.
 *
 * A versao ESTRITA do `getMap`, e a diferença nao e um detalhe: ela
 * separa "entrar no mundo" de "saber para onde um portal vai".
 *
 * O `getMap` cai no hub de proposito — um id errado na entrada e melhor
 * do que uma tela preta. Num portal, o mesmo fallback seria um defeito
 * silencioso: um `destino` apagado viraria "volte para o hub", e a box
 * prometeria uma viagem que ninguem pediu. Aqui o id errado vira
 * `null`, e quem chama decide: o portal nao oferece a travessia
 *
 * Tambem e o que protege o cliente de pular de mapa: ele usa este para
 * seguir o servidor, e cair no hub por um id desconhecido deixaria o
 * cliente desenhando um mapa em que o servidor nao esta
 */
export function findMap(id) {
  if (typeof id !== "string") return null;

  // `MAPS` e um objeto comum: sem isto, o id "constructor" acharia uma
  // funcao e o `setMap` receberia algo que nao e mapa
  if (!Object.hasOwn(MAPS, id)) return null;

  return MAPS[id] ?? null;
}

export { BASE_MAP };
