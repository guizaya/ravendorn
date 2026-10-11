import {
  PROP_TYPES,
  propVariantCount,
} from "../props/index.js";
import { PORTALS, MAP_2_PORTALS } from "../portais/index.js";
import { BASE_MAP } from "./base.js";
import { BOSS_1_ID, BOSS_1_MAP } from "./boss1.js";
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

/**
 * O LADO DO TILE deste mapa, em pixel de mundo.
 *
 * E o ladrilho da grama: `groundTileSizeFor` devolve 64 para a chave
 * `grama`, que e a deste mapa. O valor esta aqui para o mapa ter uma grade
 * que fecha com o chao que ele desenha
 */
export const MAP_1_TILE = 64;

/**
 * AS MEDIDAS EM MULTIPLO DO TILE.
 *
 * ## POR QUE NAO 6000 x 4200
 *
 * Porque 6000 e 4200 nao sao multiplos de 64: 6000 / 64 = 93,75 e
 * 4200 / 64 = 65,625. Uma grade de tile nao fecha em numero quebrado, e o
 * Tiled arredonda para cima — o que daria um mapa de 6016 x 4224 desenhando
 * sobre um mundo de 6000 x 4200, com 16px de vao de um lado e 24 de outro
 *
 * ## POR QUE CRESCER, E NAO ENCOLHER
 *
 * Encolher para 5952 x 4160 tiraria 48px da direita e 40 de baixo do mapa
 * de verdade, e as tres zonas da coluna direita — ruinas, cripta e pantano —
 * terminam a 5880, a 5900 e a 5900, com 72 e 76px de folga. Encolher
 * apagaria parte delas
 *
 * Crescendo para 6016 x 4224, oBounds vai de 40 ate 5976 na horizontal e
 * ate 4184 na vertical. As doze zonas continuam dentro: a mais apertada e a
 * `ruinas`, que termina a 5880 com 96px de sobra
 */
export const MAP_1_WIDTH = Math.ceil(6000 / MAP_1_TILE) * MAP_1_TILE;
export const MAP_1_HEIGHT = Math.ceil(4200 / MAP_1_TILE) * MAP_1_TILE;

export const MAP_1_BOUNDS = {
  x: 40,
  y: 40,
  width: MAP_1_WIDTH - 80,
  height: MAP_1_HEIGHT - 80,
};

/**
 * O PONTO DE NASCIMENTO, e ele e o CENTRO do mapa.
 *
 * ## POR QUE PASSOU A SER DERIVADO
 *
 * Porque o `MAP_1_CENTRO` e calculado do `MAP_1_BOUNDS`, e o bounds mudou
 * quando o mapa cresceu 16 x 24. Com o nascimento escrito a mao em 3000,
 * 2100 ele ficaria 8px a esquerda e 12px acima do centro de verdade — o
 * suficiente para o chefe nascer em um ponto que nao e o centro, e para o
 * Tiled e o jogo discordarem de onde e o meio
 *
 * ## E POR QUE ISSO NAO MOVE O JOGADOR DE MANEIRA VISIVEL
 *
 * O deslocamento e de 8px na horizontal e 12 na vertical, contra um
 * personagem de 32px de celula. Ninguem ve a diferenca; o que importa e que
 * a conta seja uma so
 */
export const MAP_1_SPAWN = {
  x: Math.round(40 + MAP_1_BOUNDS.width / 2),
  y: Math.round(40 + MAP_1_BOUNDS.height / 2),
};

/**
 * O CENTRO DO VALE, que e onde o chefe mora.
 *
 * ## E O MESMO PONTO DO `MAP_1_SPAWN`
 *
 * Sao o mesmo objeto de proposito. O chefe precisa nascer no centro, e o
 * jogador precisa nascer longe do chefe — e "longe do chefe" ja e uma conta
 * separada, o `MAP_1_SPAWN_COM_CHEFE`, que soma a distancia abaixo
 *
 *## POR QUE NAO REPETIR A CONTA
 *
 * Porque as duas contas JA existediam separadas e divergiram: o
 * `MAP_1_SPAWN` estava escrito a mao em 3000, 2100 e o `MAP_1_CENTRO` era
 * derivado do `bounds`. Quando o mapa cresceu 16 x 24, o centro foi para
 * 3008, 2112 e o nascimento ficou para tras — dois numeros que deveriam
 * ser um
 *
 * Usar o `MAP_1_SPAWN` aqui e o que garante que o chefe e o nascimento
 * sejam o mesmo ponto por construcao, e nao por coincidencia
 */
export const MAP_1_CENTRO = MAP_1_SPAWN;

/**
 * A DISTANCIA ENTRE O NASCIMENTO E O CHEFE DO VALE.
 *
 * ## POR QUE O NASCIMENTO SE AFASTOU
 *
 * Porque o `MAP_1_SPAWN` e o CENTRO do vale, e o centro do vale e onde o
 * pedido poe o Hulk. Deixado como estava, o jogador nascia dentro do chefe:
 * o `hulk_val` tem `damage` de ~380 e o `MAP_TESTE` tem
 * `resumeWhereLeftOff: false`, entao o vale SEMPRE joga o jogador no ponto
 * de nascimento. Isso nao era "comecar perto do chefe" — era comecar a luta
 * sem ter visto a luta
 *
 * ## POR QUE 760, E NAO OS 320 DA ARENA
 *
 * A arena resolve o mesmo problema com 320, e funciona porque o
 * `aggroRange` do `hulk` e 520: o jogador chega, ve o chefe parado e decide
 * chegar ou nao, e o chefe vem atras de qualquer passo
 *
 * Aqui o chefe e maior (raio 62), o `aggroRange` e 620 e o mapa e ABERTO —
 * nao ha parede para fechar a briga. Com 320 o jogador apareceria a menos de
 * meio segundo do golpe de um chefe de 380 de dano, sem tempo de ver nada.
 * Com 760 ele chega a ~2s de.views, o que e o suficiente para ler a tela e
 * correr
 *
 * E o valor cabe DENTRO da zona livre das pedras: o retangulo tem 2200 de
 * largura, e 760 das duas metades sai dentro dele — o jogador nasce no chao
 * limpo, sem uma pedra nas costas
 */
export const MAP_1_DISTANCIA_DO_CHEFE = 760;

/**
 * O NASCIMENTO DO MAPA QUE TEM CHEFE, e o `MAP_1_SPAWN` puxado para longe
 * do centro.
 *
 * ## POR QUE UM `const` NOVO, E NAO MUDAR O `MAP_1_SPAWN`
 *
 * Porque o `MAP_1_SPAWN` e usado por QUATRO mapas — o Mapa 1, o Mapa 2, o
 * Vale 1 e o `MAP_1_META`. Mexer nele tiraria o jogador do centro dos
 * outros tres, e o centro deles nao tem chefe nenhum: o Mapa 1 e o Mapa 2
 * estao vazios de mob, e o centro la e so chao
 *
 * Este `const` so muda o vale, que e o unico mapa com `bosses` declarado
 */
export const MAP_1_SPAWN_COM_CHEFE = {
  x: MAP_1_SPAWN.x,
  y: MAP_1_SPAWN.y + MAP_1_DISTANCIA_DO_CHEFE,
};

/**
 * O CHEFE DO CENTRO DO VALE.
 *
 * ## POR QUE UM `const` E NAO UM LITERAL DENTRO DO MAPA
 *
 * Porque a MESMA posicao e usada por tres coisas: o `bosses` do mapa, o
 * `getEnemySprite` nao (esse e pelo id), e o `spawn` do mapa. Se o chefe
 * e o nascimento forem escritos a mao em lugares diferentes, o dia que um
 * deles mexer o outro vira um chefe em cima do jogador sem ninguem ver
 *
 * O `creature` e `hulk_val`, nao `hulk`: sao criaturas diferentes, com
 * numeros e arte diferentes. O `hulk` continua sendo o chefe da arena
 */
export const MAP_1_CHEFES = [
  {
    creature: "hulk_val",
    x: MAP_1_CENTRO.x,
    y: MAP_1_CENTRO.y,
  },
];

/**
 * AS ZONAS DO MAPA 1: o QUE a zona e, nao ONDE ela fica.
 *
 * ## O RETANGULO AGORA VEM DO `.tmj`, E ESTE FICOU SO COM O RESTO
 *
 * Antes cada zona trazia `x`, `y`, `width` e `height` aqui. Hoje o retangulo
 * vem da camada de objeto com o mesmo nome no `dungeon.tmj`, e o autor move
 * a area la, no editor, com o desenho do lado
 *
 * Estes numeros continuam escritos porque o MAPA 2 deriva deles — e o mapa 2
 * nao tem `.tmj`, e nao vai ter. Apagar os campos quebraria a copia inteira
 * do mapa 2 junto
 *
 * Entao o arranjo e: o retangulo daqui e a reserva, e o do Tiled e o que
 * vale para o mapa 1. Quem junta os dois e o `getZoneById`, que e por onde
 * a viagem automatica, o bestiario e o craft leem a zona — antes deles
 * apontarem para a caixa antiga depois de voce mover a caixa no editor
 *
 * ## O QUE CONTINUA AQUI, E POR QUE
 *
 * `name`, `terrain`, `kind` e as cores. Nenhum deles esta no arquivo de
 * mapa: o Tiled guarda um retangulo, e quem decide que o brejo e chao de
 * brejo e que a cripta e ativa e o codigo
 *
 * ## E A GRADE DE 64
 *
 * Os numeros estao em multiplos de 64 porque o mapa e um Tiled de tile de 64,
 * e a zona vai virar um retangulo desenhado nele. Um retangulo com `x: 80` ou
 * `y: 1420` cai no meio de um tile: o Tiled deixa, o desenho sai torto contra
 * a grade, e ninguem sabe depois se o erro foi no mapa ou no editor
 *
 * ## E COMO MEXER SEM QUEBRAR A ESCADA
 *
 * O `ZONE_ROSTER` aponta para estas zonas pelo `id`, e nao pela posicao, entao
 * mover um retangulo nao troca criatura de lugar — o que troca e ONDE ela
 * nasce. Por isso nenhuma zona pode invadir a vizinha, e por isso o
 * `conferir-zonas-tiled.mjs` e o lugar de conferir
 */
export const MAP_1_ZONES = [
  {
    id: "treino",
    name: "Campo de Provas",
    kind: "training",

    /**
     * A METRICA depois do DEGRAU 6 do Brejo.
     *
     * ## O TAMANHO
     *
     * Era 1000x900, e virou 1900x1200 — 2.5 vezes mais area. O campo
     * de provas e onde o jogador passa para aprender a classe, e ele era
     * a menor zona do vale, com menos espaco que qualquer area de mob que
     * so tem sete criaturas
     *
     * ## POR QUE ESTES LIMITES, E NAO OS DO MAPA
     *
     * A expansao para de 140px antes de cada zona vizinha, e nao na
     * borda do mapa. O vale tem uma grade de areas com vaos de 120 a
     * 180px entre elas, e o campo de provas respects o mesmo vao:
     *
     * - acima: a Campina Gelada termina em y 1330, e o treino comeca
     *   em 1500
     * - abaixo: a Dunas e a Pedreira comecam em y 2860, e o treino
     *   termina em 2700
     * - esquerda: o Brejo Lento termina em x 2420, e o treino comeca em
     *   2560
     * - direita: a Cripta comeca em x 4620, e o treino termina em 4460
     *
     * E o trainings que ocupa o vau entre a Campina e a Cripta, no meio
     * do vale. Do jeito que estava, ele era um bloco pequeno com sobra
     * dos quatro lados
     */
    x: 2560,
    y: 1472,
    width: 1920,
    height: 1216,

    /**
     * O CHAO PADRAO do mapa, e nao um terreno de zona.
     *
     * `grass` e o `BASE_TERRAIN`, o mesmo de fora de qualquer zona. O
     * `terrainAlt` de terra batida e a `altBias` de 0.22 sairam: eles
     * existiam para a grade antiga de patches, que sorteava celula a
     * celula entre os dois. Com o chao padrao do mapa na tela, o que
     * sobraria seria uma mancha de terra dentro de grama, sem nenhum
     * motivo
     */
    terrain: "grass",
  },

  {
    id: "floresta",
    name: "Floresta Sombria",
    kind: "semi",
    terrain: "forest",
    terrainAlt: "grass",
    altBias: 0.3,
    x: 64,
    y: 64,
    width: 1280,
    height: 1280,
  },

  {
    id: "acampamento",
    name: "Acampamento Goblin",
    kind: "semi",
    terrain: "dirt",
    terrainAlt: "forest",
    altBias: 0.28,
    x: 1536,
    y: 128,
    width: 1280,
    height: 1152,
  },

  {
    id: "campina",
    name: "Campina Gelada",
    kind: "active",
    terrain: "ice",
    terrainAlt: "stone",
    altBias: 0.26,
    x: 3072,
    y: 64,
    width: 1280,
    height: 1280,
  },

  {
    id: "ruinas",
    name: "Ruínas dos Ghouls",
    kind: "semi",
    terrain: "stone",
    terrainAlt: "ash",
    altBias: 0.24,
    x: 4544,
    y: 128,
    width: 1344,
    height: 1152,
  },

  {
    id: "toca",
    name: "Toca dos Ratos",
    kind: "passive",
    terrain: "dirt",
    terrainAlt: "swamp",
    altBias: 0.26,
    x: 128,
    y: 1472,
    width: 1280,
    height: 1216,
  },

  {
    id: "brejo",
    name: "Brejo Lento",
    kind: "passive",
    terrain: "swamp",
    terrainAlt: "forest",
    altBias: 0.3,
    x: 1536,
    y: 1408,
    width: 896,
    height: 1216,
  },

  {
    id: "cripta",
    name: "Cripta Esquelética",
    kind: "active",
    terrain: "stone",
    terrainAlt: "ice",
    altBias: 0.22,
    x: 4608,
    y: 1472,
    width: 1280,
    height: 1216,
  },

  {
    id: "cinzas",
    name: "Vale das Cinzas",

    /**
     * `passive`, e nao mais `active`.
     *
     * Quarto degrau de limo, e o limo e PASSIVE. Como nas outras tres
     * zonas da progressao, o `kind` passou a descrever o que mora na
     * zona, e nao o bioma — e nada alem da checagem de `training` le
     * este campo, entao o desenho continua vindo de `terrain`
     */
    kind: "passive",
    terrain: "ash",
    terrainAlt: "stone",
    altBias: 0.28,
    x: 64,
    y: 2880,
    width: 1344,
    height: 1216,
  },

  {
    id: "dunas",
    name: "Dunas Perdidas",

    /**
     * `passive`, e nao mais `semi`.
     *
     * Terceiro degrau de limo da progressao, e o limo e PASSIVE. Como
     * no Pantano e na Pedreira, o `kind` passou a descrever o que mora
     * na zona, e nao o bioma — e nada alem da checagem de `training`
     * le este campo, entao o bioma visual continua vindo de `terrain`
     */
    kind: "passive",
    terrain: "sand",
    terrainAlt: "ash",
    altBias: 0.24,
    x: 1536,
    y: 2880,
    width: 1280,
    height: 1216,
  },

  {
    id: "pedreira",
    name: "Pedreira do Ogro",

    /**
     * `passive`, e nao mais `active`.
     *
     * A zona era `active` e hoje so tem Limo Preguiçoso, que e PASSIVE.
     * O `kind` passou a descrever o que mora na zona, e nao o bioma
     *
     * Como no Pantano, isto nao muda desenho nem som: as duas unicas
     * leituras de `kind` de zona comparam com `"training"`, e o bioma
     * visual vem de `terrain`, que continua `sand`
     */
    kind: "passive",
    terrain: "sand",
    terrainAlt: "stone",
    altBias: 0.3,
    x: 3072,
    y: 2880,
    width: 1280,
    height: 1216,
  },

  {
    id: "pantano",
    name: "Pântano Profundo",

    /**
     * `passive`, e nao mais `active`.
     *
     * O Pantano virou a zona de ENTRADA: e onde o jogador chega
     * atravessando o portal que vem do hub, e agora so tem Limo
     * Preguiçoso, que e PASSIVE. Deixar `active` aqui era o dado
     *MENTINDO sobre o que mora na zona
     *
     * Este campo nao muda nenhum desenho nem som. As duas unicas coisas
     * que leem `kind` de zona sao a checagem de `training` no roster de
     * criaturas e a checagem de `training` no terreno — e as duas so
     * comparam com a string `"training"`. O bioma visual vem de
     * `terrain`, que continua `swamp`
     */
    kind: "passive",
    terrain: "swamp",
    terrainAlt: "ash",
    altBias: 0.26,
    x: 4544,
    y: 2880,
    width: 1344,
    height: 1216,
  },
];

/**
 * O MAPA 2.
 *
 * Uma COPIA do mapa 1, e o `id` que o distingue.
 *
 * O id precisa ser outro porque e ele que o `getMap` recebe, o que o
 * save guarda e o que o `NetworkWorld` compara para trocar o mapa do
 * cliente. Reusar `map_1` faria os dois mapas serem o mesmo objeto, e
 * atravessar o portal seria andar de um mapa para o mesmo mapa
 */
export const MAP_2_ID = "map_2";

const MAP_1_ID = "map_1";

for (const zone of MAP_1_ZONES) {
  /**
   * A QUE MAPA a zona pertence.
   *
   * Este campo nao existia, e a falta dele era um buraco que so
   * aparecia com a viagem automatica. `location` de missao e `zoneId` de
   * bestiario dizem "onde fica", e sem o mapa ninguem conseguia ir la:
   * o unico jeito de transformar zona em destino era o `getZoneById`,
   * que devolvia o retangulo e o piloto andava ate ele — no mapa em que
   * o jogador estivesse
   *
   * O defeito era invisivel porque as duas zonas jogaveis (`base`) nao
   * tem zona nenhuma. Com o alvo em `map_1` e o jogador no hub, o
   * waypoint virava (5230, 3470) e o `clampToBounds` empurrava o boneco
   * para a borda do hub: o piloto andava contra a parede ate o auto ser
   * desligado, sem mensagem nenhuma
   *
   * E o que separa "chegar na zona" de "chegar no mapa certo e depois
   * na zona"
   */
  zone.mapId = MAP_1_ID;

  zone.mapColor = minimapColorFor(zone.terrain);
  zone.color = terrainLabelColor(zone.terrain);
}

/**
 * O MAPA 2 E UMA COPIA DO MAPA 1.
 *
 * As zonas sao as mesmas, com duas mudancas obrigatorias:
 *
 * - `id` com o prefixo `m2_`, porque o `ZONE_REGISTRY` guarda um id por
 *   zona. Com o id repetido, a segunda copia sobrescrevia a primeira e o
 *   mapa 1 passaria a pointar para as zonas do mapa 2 — o `mapId` da
 *   zona e o que o planejador de viagem le
 *
 * - `baseId`, o id da zona do mapa 1 que esta copia. E o que permite ao
 *   roster de criaturas montar o mesmo elenco aqui sem duplicar as cem
 *   linhas do `ZONE_ROSTER`: o roster aponta para `pantano`, e o mapa 2
 *   acha a zona pelo `baseId`
 */
export const MAP_2_ZONES = MAP_1_ZONES.map((zone) => {
  const copia = {
    ...zone,
    id: `m2_${zone.id}`,
    baseId: zone.id,
    mapId: MAP_2_ID,
    label: zone.name,
  };

  copia.mapColor = minimapColorFor(copia.terrain);
  copia.color = terrainLabelColor(copia.terrain);

  return copia;
});

/**
 * O INDICE de zonas por id.
 *
 * Um `Map` em vez de um `find` em lista. O `getZoneById` era chamado a
 * cada 0.25s por jogador no tick do piloto, e varrer doze zonas para
 * achar uma era trabalho jogado fora
 */
const ZONE_REGISTRY = new Map([
  ...MAP_1_ZONES.map((zone) => [zone.id, zone]),
  ...MAP_2_ZONES.map((zone) => [zone.id, zone]),
]);

/**
 * QUEM CORRIGE O RETANGULO DE UMA ZONA, e o `.tmj` do mapa 1.
 *
 * ## O PROBLEMA QUE ESTE RESOLVEDOR RESOLVE
 *
 * As zonas do mapa 1 tem o retangulo em dois lugares: no `.tmj`, que o autor
 * move, e em `MAP_1_ZONES`, que e codigo. O motor ja lia o do Tiled, mas
 * `getZoneById` devolvia o do codigo — e e por ele que a viagem automatica
 * escolhe o destino, que o bestiario mostra a area, e que o craft diz onde o
 * material cai
 *
 * Sem isto, mover a caixa no Tiled alinhava os esqueletos e deixava todo o
 * resto do jogo apontando para a caixa antiga: o jogador voaria para o meio
 * de um campo vazio achando que era a zona
 *
 * ## POR QUE UM RESOLVEDOR INJETADO, E NAO UM `import` DAQUI PARA O JOGO
 *
 * Porque este arquivo e dado, e `data/` nao importa `game/`. E porque o
 * `.tmj` so existe no navegador (plugin do Vite) e no servidor (leitura do
 * disco) — quem sabe o retangulo novo e o registro de tiles, que ja e
 * acessivel dos dois lados
 *
 * ## E POR QUE SO O MAPA 1
 *
 * Porque so ele tem `.tmj`. O mapa 2 e uma copia escrita em codigo e nao tem
 * camada nenhuma: para ele o resolvedor devolve `null` e o retangulo segue
 * sendo o do codigo
 */
let resolvedorDeZonas = null;

/**
 * INSTALA QUEM CORRIGE O RETANGULO DAS ZONAS. Quem chama e o registro de tiles.
 *
 * Registrar um `.tmj` novo precisa descartar a resolucao antiga: o arquivo
 * pode ter mudado no disco desde a ultima leitura, e um resolvedor velho
 * devolveria a caixa de uma versao que nao existe mais
 */
export function definirResolvedorDeZonas(fn) {
  resolvedorDeZonas = typeof fn === "function" ? fn : null;
}

export function getZoneById(id) {
  const zona = ZONE_REGISTRY.get(id) ?? null;

  if (!zona || !resolvedorDeZonas) return zona;

  return resolvedorDeZonas(id, zona) ?? zona;
}

/**
 * O ID DO MAPA de uma zona, ou `null`.
 *
 * E o que o planejador de viagem pede: nao o retangulo, mas o mapa onde
 * ele esta. Devolver `null` para uma zona desconhecida e o que impede o
 * planejador de inventar um destino
 */
export function getMapIdOfZone(id) {
  return getZoneById(id)?.mapId ?? null;
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

/**
 * A SEBE DO SUL.
 *
 * Uma fileira de arbustos que segura o jogador dentro dos campos de
 * cima, em `y` constante de `x1` a `x2`.
 *
 * ## O PASSO SEGUE A ARTE, E NAO O CONTRARIO
 *
 * A primeira versao tinha passo 60 com arte de 96: sobreposicao de 36px,
 * e a fileira lia como um macico. Reduzir a arte para 67 SEM mexer no
 * passo deixou 7px de sobreposicao, e a sebe desmanchou — 80 arbustos
 * redondos em linha, com entalhe entre cada par, em vez de uma cerca.
 * A arte encolhe, o passo encolhe junto
 *
 * Sao tres numeros que nao podem se separar:
 *
 *   arte 67 | passo 44 | sobreposicao 23px -> fileira cheia
 *   arte 67 | passo 60 | sobreposicao  7px -> 80 arbustos soltos
 *
 * E o `collider` continua 14 em qualquer um deles: ele nao acompanha a
 * arte nem o passo, porque e a unica coisa que barra o jogador
 *
 * ## POR QUE O PASSO 44 E NAO "O MENOR POSSIVEL"
 *
 * O que fecha a passagem e o `collider`. Cada arbusto vira uma caixa de
 * 28px (o `collider: 14` do tipo, dobrado), e o jogador e um circulo de
 * raio 22 — 44px de diametro. A folga entre duas caixas e `passo - 28`:
 *
 *   passo 44  ->  folga 16  ->  16 < 44  ->  barrado, com 28px de sobra
 *
 * Com passo 34 a folga seria 6px, ainda barrado, mas a sebe viraria um
 * bloco unico e solido, sem nenhuma leitura de "isto e uma cerca de
 * arbustos". O passo 44 e o menor que ainda deixa a fileira com
 * desenho
 */
/**
 * As SEBES DO VALE, todas com a mesma receita.
 *
 * Cada uma e uma fileira horizontal que segura o jogador de um lado, e
 * o motivo delas e forcAR O CAMINHO: nao leaving `y` livre para descer
 * o vale inteiro de uma vez, e sim obrigar a passar pela faixa de campos
 * que esta entre uma linha e outra
 *
 * ## A EXTREMIDADE DE CADA UMA
 *
 * O que sela um buraco no fim da fileira e a COLISAO contra a borda do
 * mapa, e nao a arte. Com `collider: 14`, a caixa vai 14px para fora do
 * centro:
 *
 *   sebe do sul   x1=1166  ->  caixa comeca em 1152; borda em 40  ->  VAZIO de 1112px
 *   sebe do norte x1=70    ->  caixa comeca em 56;   borda em 40  ->  VAZIO de 16px (jogador tem 44 -> selado)
 *   sebe do norte x2=4796  ->  caixa termina em 4810; borda em 5960 -> VAZIO de 1150px
 *
 * E por isso que a do norte tem a porta NA DIREITA: e o lado por onde o
 * jogador vem do portal, que esta em (178, 180), ao norte dela. O
 * caminho obrigatorio e descer pelo leste
 */
const SEBES = Object.freeze([
  {
    x1: 1166,
    x2: 5922,
    y: 2747,
    passo: 44,
  },
  {
    x1: 70,
    x2: 4796,
    y: 1385,
    passo: 44,
  },
]);

/**
 * AS QUATRO BORDAS DO MAPA, uma fileira de arbustos em cada lado.
 *
 * ## POR QUE ISTO EXISTE
 *
 * O limite do mapa era uma parede invisivel: o
 * `CollisionSystem.isInsideBounds` empurrava o boneco para dentro e ele
 * andava contra uma borda que nao se via, sem nenhuma pista na tela do
 * motivo. Era o "o automatico esta quebrado" mais dificil de
 * diagnosticar que existe, porque nada na imagem explicava
 *
 * ## A BORDA E DECLARADA PELA BASE, E O COLLIDER PELA DIRECAO
 *
 * A arte do arbusto tem 65px e sobe a partir da base. Uma fileira
 * declarada pela base tem a arte INTEIRA de um lado so, e e esse lado que
 * tem de ficar virado para fora do mapa: com a arte virada para dentro,
 * o boneco pararia 36px antes do collider e ficaria com 65px de arbusto
 * desenhados por cima dele
 *
 * ## A BORDA NAO BARRE NADA
 *
 * A arte do arbusto tem 65px e sobe a partir da base. Uma fileira
 * declarada pela base tem a arte INTEIRA de um lado so, e e esse lado que
 * tem de ficar virado para fora do mapa — com a arte virada para dentro,
 * o boneco ficaria com 65px de arbusto desenhados por cima do sprite
 *
 * ## POR QUE O COLLIDER SAI PARA FORA
 *
 * Porque a barreira do limite ja existe e e outra: o
 * `CollisionSystem.isInsideBounds`. Com o collider do arbusto do lado de
 * dentro, a fileira barrava o boneco 26px antes de onde ele ja parava —
 * uma segunda parede invisivel em cima da primeira, e a unica que o
 * jogador nao via
 *
 * Entao o collider nasce 14px (que e o raio dele) do lado de FORA da
 * base. Nenhum arbusto de borda encosta no limite, e o boneco volta a
 * parar exatamente onde parava antes das sebes
 *
 * `colliderX` e `colliderY` sao os campos que carregam essa posicao, e o
 * `buildPropSolids` le eles quando existem. Nas duas sebes do meio do
 * vale eles nao existem, e o collider fica na base como sempre — que e
 * o lugar dele, porque ali a sebe E a barreira
 *
 * ## A ARTE FICA TODA FORA DA LINHA CINZA
 *
 * O `GameEngine.drawMap` desenha um retangulo de 8px na cor `#647064`
 * em cima de `map.bounds` — a linha cinza. Ela e o desenho da parede, e
 * um arbusto por cima dela era parede pintada de verde
 *
 * Por isso a base da borda e a propria linha: a arte sobe 65px a partir
 * dela, e com a base no limite ela inteira cai do lado de fora. Com a
 * base 40px para dentro — que era a primeira conta — a arte cruzava a
 * linha e cobria 77px do campo de visada
 *
 * ## DUAS COLUNAS, PARA FORA
 *
 * Uma coluna so deixa 16px de folga entre duas caixas de 28px, e o
 * jogador e um circulo de 44px: passaria raspando por cima da fileira.
 * A segunda coluna entra para FORA — e o que mantem a arte com espessura
 * sem invadir o campo de visada, que e onde o boneco anda
 */
const BORDAS = Object.freeze([
  {
    /**
     * A borda de CIMA, com o campo ABAIXO
     *
     * A base e a linha cinza, e nao um deslocamento dela: a arte
     * pendurada para cima fica inteira na faixa de 40px entre a borda da
     * tela e a linha, que e onde uma sebe de borda de mapa tem que estar
     */
    eixo: "h",
    de: -40,
    para: MAP_1_WIDTH + 40,
    base: MAP_1_BOUNDS.y - 4,
    dentro: 1,
    passo: 44,
    colunas: 2,
  },
  {
    /**
     * A borda de BAIXO, com o campo ACIMA
     *
     * A base e o limite mais 70px porque a arte SOBE: uma base na linha
     * mesma cortaria o arbusto pela linha da tela. Sao 70px e nao 66
     * porque o tracejado tem 4px de cada lado da linha, e a arte comeca
     * depois deles
     */
    eixo: "h",
    de: -40,
    para: MAP_1_WIDTH + 40,
    base: MAP_1_BOUNDS.y + MAP_1_BOUNDS.height + 70,
    dentro: -1,
    passo: 44,
    colunas: 2,
  },
  {
    /**
     * A borda da ESQUERDA, e a que corre na vertical
     *
     * A arte sobe a partir da base, e por isso que a coluna da esquerda
     * le como uma fileira de arbustos empilhados, e nao como uma arte
     * deitada: nao ha como girar a folha no `PropRenderer`
     */
    eixo: "v",
    de: -40,
    para: MAP_1_HEIGHT + 40,
    base: MAP_1_BOUNDS.x - 4,
    dentro: 1,
    passo: 44,
    colunas: 2,
  },
  {
    /**
     * A borda da DIREITA, com o campo a ESQUERDA
     *
     * A mesma conta da borda de baixo, no outro eixo: a arte cresce para
     * a esquerda a partir da base, entao a base precisa ficar alem do
     * limite para a arte nao cair em cima de quem chega nela
     */
    eixo: "v",
    de: -40,
    para: MAP_1_HEIGHT + 40,
    base: MAP_1_BOUNDS.x + MAP_1_BOUNDS.width + 70,
    dentro: -1,
    passo: 44,
    colunas: 2,
  },
]);

/**
 * A ALTURA da arte do arbusto.
 *
 * Sai do catalogo e nao e um literal: reduzir a arte no
 * `gerar-arbusto-prop.mjs` move a parede inteira junto, sem ninguem
 * lembrar de atualizar um numero
 */
const ALTURA_ARBUSTO = PROP_TYPES.arbusto.frameHeight;

/**
 * A fileira, em posicao FINAL.
 *
 * Nao passa pelo `placeProps`: ele SORTEIA posicao dentro do mapa, e uma
 * parede sorteada e uma parede com buracos. As coordenadas aqui sao
 * exatas, e a divisao e feita para o ultimo arbusto cair em `para` e nao
 * faltando ou sobrando no fim
 *
 * O `id` leva o indice da sebe porque os ids sao lidos por Equality em
 * varias places — o hover de NPC, o do inimigo, o do minimapa. Com seis
 * fileiras, `arbusto_0` a `arbusto_108` repetiria o mesmo id duas vezes e
 * o destaque da segunda fileira marcaria a primeira
 *
 * ## OS DOIS FORMATOS
 *
 * Uma fileira do meio do vale e `x1`/`x2`/`y`, e o collider fica na base.
 * Uma fileira de borda e `eixo`/`de`/`para`/`base`/`dentro`, e o collider
 * sai 14px da base para o lado do campo. Os dois casos sao a mesma
 * receita — um arbusto a cada `passo`, do primeiro ate o ultimo — e o
 * que muda e onde a caixa de colisao nasce
 */
function criarSebe(sebe, indice) {
  const type = PROP_TYPES.arbusto;

  const borda = sebe.eixo !== undefined;

  const vertical = borda ? sebe.eixo === "v" : sebe.y1 !== undefined;

  const de = borda ? sebe.de : vertical ? sebe.y1 : sebe.x1;

  const para = borda ? sebe.para : vertical ? sebe.y2 : sebe.x2;

  const total = Math.round((para - de) / sebe.passo) + 1;
  const passoReal = (para - de) / (total - 1);

  const colunas = sebe.colunas ?? 1;

  /**
   * As COLUNAS se encostam, e nao se afastam.
   *
   * O deslocamento e 80% da altura da arte: e o que faz a segunda coluna
   * cobrir a fresta que sobra entre duas copas de arbusto, sem repetir a
   * arte exata por cima da primeira
   *
   * Na borda o sentido e `-dentro`, e por isso que elas entram PARA FORA
   * do campo: uma coluna para dentro cobriria o boneco com arte
   */
  const passoColuna = Math.round(ALTURA_ARBUSTO * 0.8);

  const lista = [];

  for (let coluna = 0; coluna < colunas; coluna += 1) {
    const lateral = coluna * passoColuna;

    for (let i = 0; i < total; i += 1) {
      const posicao = Math.round(de + i * passoReal);

      const arbusto = {
        id: `arbusto_${indice}_${coluna}_${i}`,
        type: "arbusto",
        isTree: false,
        radius: type.radius,
        colliderRadius: type.collider,
        blocking: true,
        variant: 0,
      };

      if (!borda) {
        arbusto.x = vertical ? sebe.x : posicao;
        arbusto.y = vertical ? posicao : sebe.y + lateral;
      } else if (sebe.eixo === "h") {
        /**
         * A BORDA DE CIMA E DE BAIXO
         *
         * O collider sai 14px da base PARA FORA, e nao para o campo:
         * e o que tira a barreira de cima do limite. Com ele do lado de
         * dentro, a fileira barrava o boneco 26px antes de onde ele ja
         * parava, e essa era uma parede invisivel em cima da outra —
         * duas barreiras para o mesmo limite, e a de cima invisivel
         *
         * Com o collider fora, nenhum arbusto de borda encosta no
         * limite: quem segura o boneco e o `clampToBounds`, como antes
         * das sebes, e a sebe e so o que se ve do limite
         */
        arbusto.x = posicao;
        arbusto.y = sebe.base - sebe.dentro * lateral;

        arbusto.colliderY =
          sebe.base - sebe.dentro * type.collider -
          sebe.dentro * lateral;
      } else {
        /**
         * A BORDA DA ESQUERDA E DA DIREITA
         *
         * A mesma conta no outro eixo. A arte sobe a partir da base, e
         * por isso que a coluna da esquerda e da direita leem como uma
         * fileira de arbustos empilhados, e nao como uma arte deitada
         */
        arbusto.y = posicao;
        arbusto.x = sebe.base - sebe.dentro * lateral;

        arbusto.colliderX =
          sebe.base - sebe.dentro * type.collider -
          sebe.dentro * lateral;
      }

      lista.push(arbusto);
    }
  }

  return lista;
}

/**
 * Todas as fileiras: as duas que cortam o vale e as quatro da borda.
 *
 * A ordem nao muda nada no desenho — elas sao desenhadas por `y`, no
 * `sort` — mas ela fixa o indice que entra no `id`, e portanto o `id`
 * de cada arbusto. Trocar a ordem das declarations trocaria todos os
 * ids do mapa
 */
function criarSebes() {
  return [...SEBES, ...BORDAS].flatMap((sebe, indice) =>
    criarSebe(sebe, indice),
  );
}

/**
 * A faixa que uma fileira de arbustos COBRE, perpendicular a ela.
 *
 * E o que o filtro de arvore precisa saber da fileira: onde comeca e onde
 * termina a arte que o jogador ve. Sem o intervalo, um filtro de
 * sobreposicao passaria a apagar uma faixa do mapa inteiro
 *
 * ## A BORDA TEM A FAIXA DAS DUAS COLUNAS
 *
 * A segunda coluna entra para fora, e e por isso que a faixa vai de uma
 * ponta ate a outra: `min` e `max` do conjunto de bases, com a altura da
 * arte em cada uma. Uma arvore que invade a coluna de fora esta a 52px
 * alem da base, e e a ultima a ver
 */
function faixaDaSebe(sebe) {
  const borda = sebe.eixo !== undefined;

  const colunas = sebe.colunas ?? 1;

  const passoColuna = Math.round(ALTURA_ARBUSTO * 0.8);

  const referencia = borda ? sebe.base : sebe.y;

  const deslocamento = borda ? -sebe.dentro * passoColuna : passoColuna;

  const bases = Array.from(
    { length: colunas },
    (_, coluna) => referencia + coluna * deslocamento,
  );

  const menor = Math.min(...bases);
  const maior = Math.max(...bases);

  return [menor - ALTURA_ARBUSTO, maior];
}

/**
 * Uma arvore atrapalha alguma sebe?
 *
 * A pergunta e de SOBREPOSICAO DE ARTE, e e a arte que o jogador ve: uma
 * arvore cujas ramas atravessam a fileira de arbustos fica com o tronco
 * aparecendo por cima da sebe, e o muro vira um cipo
 *
 * ## AS DUAS FAIXAS QUE SE CRUZAM
 *
 *   arvore  ocupa  [y - 119, y]     (a copa, `frameHeight` da arvore)
 *   sebe    ocupa  [y -  65, y]     (o arbusto, `frameHeight` dele)
 *
 * E a `faixaDaSebe` que diz qual e a faixa da sebe: em `y` numa fileira
 * horizontal, em `x` numa vertical. O ALCANCE da fileira — `x1`/`x2` ou
 * `y1`/`y2` — e o que impede o apagamento de virar um risco no mapa
 * inteiro
 *
 * ## A BORDA PRECISA DAS COLUNAS
 *
 * Uma fileira de borda tem duas colunas, e `faixaDaSebe` ja devolve a
 * faixa das DUAS. Uma arvore que invade a segunda coluna entra 52px
 * mais para dentro, e e por isso que a faixa nao e so a linha da ponta
 *
 * NINGUMA arvore e removida do sorteio, so do resultado. Tirar do
 * `accept` do `placeProps` mudaria a sequencia do `random` e a floresta
 * inteira se reorganizaria — cada arvore depois da primeira rejeitada
 * ocuparia o lugar da seguinte. O vale perderia o desenho que o jogador
 * ja conhece
 */
function arvoreAtropelaSebe(prop) {
  const arvore = PROP_TYPES.arvore;
  const meio = arvore.frameWidth / 2;

  for (const sebe of [...SEBES, ...BORDAS]) {
    const vertical = sebe.eixo === "v" || sebe.y1 !== undefined;

    const de = sebe.eixo
      ? sebe.de
      : vertical
        ? sebe.y1
        : sebe.x1;

    const para = sebe.eixo
      ? sebe.para
      : vertical
        ? sebe.y2
        : sebe.x2;

    /**
     * O ALCANCE entra na conta antes da faixa.
     *
     * E o `x` numa fileira horizontal e o `y` numa vertical: sem ele o
     * filtro apagaria todas as arvores do mapa. A margem e a copa da
     * arvore, porque um tronco 60px fora do comeco da fileira ainda a
     * invade com o ramo
     */
    const alcance = vertical ? prop.y : prop.x;

    if (alcance < de - meio || alcance > para + meio) continue;

    const [faixaInicio, faixaFim] = faixaDaSebe(sebe);

    const posicao = vertical ? prop.x : prop.y;

    const copa = vertical ? arvore.frameWidth : arvore.frameHeight;

    const inicio = posicao - copa;

    if (inicio < faixaFim && posicao > faixaInicio) return true;
  }

  return false;
}

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

  /**
   * ONDE SORTEAR, e quando nao vem o sorteio e uniforme como sempre.
   *
   * ## POR QUE ISTO EXISTE
   *
   * Porque o sorteio uniforme nao sabe "borda". Um mapa de 5920x4120 com
   * 40 pedras sorteadas por igual chance enche o miolo — e o miolo e onde o
   * jogador esta, onde ele anda, onde ele bate. As pedras viram obstaculo
   * no caminho e nao recurso no canto
   *
   * Quem sabe onde a pedra DEVE estar e quem chama: o vale passa um
   * amostrador de borda, os outros mapas continuam uniformes, e o
   * `placeProps` nao ganha nenhum `if` de "e o vale?"
   *
   * @param {(random: () => number) => {x: number, y: number}}
   */
  sorteiaPosicao = null,
) {
  const placed = [];
  const minimumGap = 34;

  /**
   * O SORTEIO PADRAO: uniforme em toda a area, com a margem de 70px.
   *
   * E o comportamento de antes, e ele continua valendo para quem nao passa
   * um amostrador. A margem existe para a arte caber dentro do limite
   */
  const sorteiaAqui = (rnd) => ({
    x: MAP_1_BOUNDS.x + 70 + rnd() * (MAP_1_BOUNDS.width - 140),
    y: MAP_1_BOUNDS.y + 70 + rnd() * (MAP_1_BOUNDS.height - 140),
  });

  const sorteia = sorteiaPosicao ?? sorteiaAqui;

  for (let index = 0; index < count; index += 1) {
    let attempts = 0;
    let accepted = false;

    while (attempts < 40 && !accepted) {
      attempts += 1;

      const { x, y } = sorteia(random);

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

        /**
         * O SOLIDO DO TAMANHO DA ARTE, SO QUANDO O TIPO PEDE.
         *
         * O spread e o que faz a arvore e o arbusto nao ganharem tres
         * campos a `undefined`: `solidoNaArte` e o opt-in explicito, e o
         * `buildPropSolids` cai no quadrado de sempre quando os campos nao
         * vem
         */
        ...(type.solidoNaArte
          ? {
              solidWidth: type.drawWidth,
              solidHeight: type.drawHeight,
              base: type.base,
            }
          : {}),
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

  const arvores = placeProps(
    BLOCKING_PLAN,
    QUANTIDADE_ARVORES,
    random,
    (x, y, radius) =>
      isClear(x, y, radius) &&
      !insideAnyZone(x, y, ZONE_MARGIN),
    [],
    "arvore",
  );

  // A sebe entra no meio: as arvores que a atropelam saem, e ela entra
  const sebe = criarSebes();

  const blocking = [
    ...arvores.filter((prop) => !arvoreAtropelaSebe(prop)),
    ...sebe,
  ];

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
    // a sebe entra aqui como obstaculo vizinho: um decorativo sorteado em
    // cima do muro apareceria atravessado por ele
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
    /**
     * O SOLIDO PODE NAO SER UM QUADRADO, E NAO E POR ACASO
     *
     * Uma prop que declara `solidWidth` e `solidHeight` tem um solido do
     * tamanho do RETANGULO que ela ocupa, e nao um quadrado centrado no
     * ponto da prop. E assim que o cristal do vale 1 barra o jogador na
     * BORDA VISIVEL da arte: com o quadrado de sempre, um cristal de
     * 139x180 teria um bloco de 138x138 na base e o jogador subia por
     * cima dos 40px de arte que ficavam de fora
     *
     * O `base` vem do tipo e e o que decide de onde a arte cresce para
     * cima. Com `base: 1`, o pe da arte esta EM `y` e o solido vai de
     * `y - height` ate `y`. Um tipo com `base: 0.5` cresceria para os
     * dois lados, e o solido teria de acompanhar
     *
     * O quadrado de sempre e o caminho de quem nao declara nada: arvore,
     * sebe e os tipos antigos seguem por aqui, sem mudar uma linha
     */
    if (prop.solidWidth && prop.solidHeight) {
      const peX = prop.colliderX ?? prop.x;
      const peY = prop.colliderY ?? prop.y;
      const base = prop.base ?? 1;

      return {
        x: Math.round(peX - prop.solidWidth / 2),
        y: Math.round(peY - prop.solidHeight * base),
        width: Math.round(prop.solidWidth),
        height: Math.round(prop.solidHeight),
        kind: prop.type,

        /**
         * O ID DA PROP, e nao so o tipo.
         *
         * E o que permite tirar do caminho uma pedra JA DEMOLIDA sem
         * derrubar as outras 22 do mesmo tipo. Com o `kind` sozinho — que e
         * `cristal_comum` nas 23 — nao ha como saber QUAL delas acabou, e
         * o cristal invisivel continuava barrando o jogador no lugar onde
         * ele so via o chao
         */
        propId: prop.id,
      };
    }

    const half = prop.colliderRadius;

    /**
     * O COLLIDER PODE NAO ESTAR NO LUGAR DA PROP.
     *
     * `colliderX` e `colliderY` existem so para a BORDA do mapa: a arte do
     * arbusto tem 93px e cresce para um lado, e uma fileira declarada
     * pela base collidiria 36px antes da arte — o jogador pararia com
     * 90px do arbusto desenhados por cima dele. Com o collider na PONTA
     * da arte, ele para com a sebe inteira do outro lado
     *
     * O `??` e o caminho de sempre: arvore e sebe do meio do vale nao
     * declaram os dois campos, e o collider fica onde a prop esta
     */
    const centroX = prop.colliderX ?? prop.x;
    const centroY = prop.colliderY ?? prop.y;

    return {
      x: centroX - half,
      y: centroY - half,
      width: half * 2,
      height: half * 2,
      kind: prop.type,
    };
  });
}

const { props, blocking, decorative } = createProps();

const solids = buildPropSolids(blocking);

export const MAP_1 = {
  id: MAP_1_ID,
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
   * O SORCERER DESTE MAPA, 5px MAIOR QUE O PADRAO.
   *
   * ## A CONTA
   *
   * Sem este fator o sorcerer sai com `90 * 0.697 = 62.7px` no vale. O
   * tamanho pedido agora e 67.7px, e o fator que produz isso e
   *
   *     67.7 / 62.7 = 1.079
   *
   * ## O HISTORICO DESTE FATOR
   *
   * Este numero ja foi 1.319 (82.7px) e depois 1.159 (72.7px), cada um
   * dimuindo 10px a um pedido. A conta esta escrita porque o numero sozinho
   * nao diz para que tamanho ele serve: trocar o valor sem trocar a conta
   * deixa um comentario que promete um tamanho e entrega outro
   *
   * ## E POR QUE UM FATOR DO MAPA, E NAO A `SORCERER_SCALE`
   *
   * Porque a base tem uma exigencia propria: o sorcerer tem que sair do
   * mesmo tamanho que o arqueiro la, e o `escalaSprites: { arbalist: 0.7,
   * sorcerer: 0.7 }` da base resolve isso. Mudar a escala da CLASSE
   * arrastaria a base junto e quebraria essa igualdade
   *
   * ## E POR QUE SO O SORCERER
   *
   * Porque `escalaSprites` e por classe. Guerreiro e lancer medem 36.8px e
   * 34.4px no vale, e sao o tamanho de sempre — mexer neles aqui mudaria as
   * outras tres classes sem ninguem pedir
   *
   * ## O QUE ISSO NAO MEXE
   *
   * Nem a base, nem o chefe e nem o mapa 2: cada um le o seu fator, e so
   * este mapa declara um
   *
   * Todo mapa que nao declarar isto usa 1
   */
  escalaSprites: { sorcerer: 1.079 },

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

  /**
   * AS PROPS SUMIRAM DESTE MAPA.
   *
   * ## O QUE TINHA AQUI
   *
   * 1234 props de `createProps()` — 1173 arbustos e 61 arvores, todas
   * `blocking`, e portanto 1234 solidos de colisao derivados delas
   *
   * ## POR QUE ESTE MAPA NAO TEM MAIS NENHUMA
   *
   * Porque o chao deste mapa passou a vir do Tiled, e a paisagem tambem. Um
   * arbusto espalhado por semente nao conversa com um mapa pintado a mao: o
   * jogador veria o desenho dele e, em volta, mato que ninguem colocou
   *
   * ## E ONDE A BORDA FICOU
   *
   * No desenho. As 316 celulas de borda do `dungeon.tmj` usam o tile de
   * parede, entao o mapa continua fechados visualmente sem a sebe de arbusto
   *
   * O que AINDA nao existe e a colisao dessas paredes — o Tiled e so visual
   * por enquanto. Sem ela o jogador anda pela parede e e segurado so pelo
   * `clampToBounds`, na ultima linha de pixel da tela, o que e pior que nao
   * ter parede nenhuma: ele ve parede e atravessa
   *
   * ## POR QUE O MAPA 2 CONTINUA COM AS PROPS
   *
   * Porque ele nao tem camada de Tiled. As duas linhas shareavam a mesma
   * `const` de modulo, e esvaziar o array do mapa 1 sem tocar na do mapa 2 e
   * o que mantem as duas coisas reversiveis com uma edicao so
   */
  props: [],
  blocking: [],
  decorative: [],
  solids: [],

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
 * O MAPA 2: uma copia do mapa 1.
 *
 * ## O QUE E COPIA E O QUE E NOVO
 *
 * COPIA, sem mudanca: as dimensoes, os limites, o nascimento, o chao, o
 * enquadramento da camera, a semente e as arvores. E o que o pedido
 * pediu — "deixe ele do mesmo jeito por enquanto" — e tambem o que faz
 * os dois mapas servirem de campo de teste um do outro: o mesmo
 * territorio com outra semente de criacao de arena mais adiante
 *
 * ## POR QUE AS ARVORES SAO AS MESMAS REFERENCIAS
 *
 * `props`, `blocking`, `decorative` e `solids` sao calculados uma vez
 * pelo sorteio da semente e so lidos depois. Passar as mesmas listas
 * para os dois mapas economiza um sorteio inteiro e, como nada os
 * altera, os dois mapas ficam realmente identicos
 *
 * NOVO: o `id`, as zonas com o prefixo `m2_` e o portal. Sao as tres
 * coisas que fazem do mapa 2 um mapa
 */
export const MAP_2 = {
  id: MAP_2_ID,
  name: "Mapa 2",

  width: MAP_1_WIDTH,
  height: MAP_1_HEIGHT,

  bounds: MAP_1_BOUNDS,

  background: "#17221f",

  groundTile: "neve",

  /**
   * A TERRA DAS ZONAS DE MOB.
   *
   * O mapa 1 e a base usam a terra do vale, que e o padrao. O mapa 2
   * declara a sua porque a neve ja mudou o clima do cenario, e a
   * terra de campo de mob que vem do vale destoava
   */
  zoneTile: "terra_2",

  /**
   * AS PROPS SEM SOMBRA NESTE MAPA.
   *
   * A sombra e uma elipse preta fixa sob a prop. Na neve ela nao segue
   * a luz do cenario e denuncia o que e arte colada no chao, entao o
   * arbusto e a arvore ficam sem ela
   *
   * A lista e POR TIPO, e nao "o mapa inteiro sem sombra": pedra e
   * toco continuam com a sombra, que e o que da assentamento ao resto
   */
  propsSemSombra: ["arbusto", "arvore"],

  spawn: MAP_1_SPAWN,

  /**
   * O MAPA 2 TAMBEM CONTINUA DE ONDE VOCE PAROU.
   *
   * Copia do mapa 1 porque o mapa e de exploracao: voltar no meio do
   * nada perderia o caminho que ainda estava pela frente
   */
  resumeWhereLeftOff: true,

cameraZoom: 1,

  /**
   * O SORCERER DESTE MAPA, COM O MESMO TAMANHO DO MAPA 1.
   *
   * ## O MESMO 1.079, E POR QUE E O MESMO
   *
   * Porque o `cameraZoom` dos dois e 1. O fator e o que sobra para o
   * personagem, depois que o mapa ja empurrou o zoom: com o mesmo zoom, o
   * mesmo fator da o mesmo tamanho. Copiar o numero do mapa 1 e o que garante
   * que o sorcerer nao mude de tamanho ao atravessar o portal
   *
   * O que este mapa NAO faz e usar a escala da classe: a base depende de
   * `escalaSprites` proprio, e mudar a `SORCERER_SCALE` arrastaria ela junto
   */
  escalaSprites: { sorcerer: 1.079 },

  /**
   * A MESMA SEMENTE, e de proposito.
   *
   * E o que faz as arvores cairem nos mesmos lugares: `createProps` roda
   * com a semente do mapa, e uma semente diferente daria outro desenho
   * de floresta — que e a primeira coisa a mexer quando este mapa comecar
   * a ser propriamente dele
   */
  seed: MAP_1_SEED,

  zones: MAP_2_ZONES,

  props,
  blocking,
  decorative,
  solids,

  /**
   * O PORTAL DE ENTRADA, e um so.
   *
 * O par do `portal_floresta` do mapa 1: o segundo portal do vale leva
   * para o primeiro portal daqui, e este devolve. O mapa 2 ainda nao tem
   * o par do `portal_pantano`, e nao ter destino e o que faz um portal
   * continuar sendo enfeite
   */
  portals: MAP_2_PORTALS,
};

/**
 * O MAPA DE TESTE.
 *
 * ## O QUE ELE E
 *
 * Um vazio do tamanho do vale, com o chao de terra do mapa 2 e sem
 * ninguem dentro. Serve para testar camera, movimento, colisao e o
 * desenho do limite sem nenhum mob andando por cima da medicao
 *
 * ## O QUE ELE COPIA DO MAPA 1, E POR QUE
 *
 * `width`, `height` e `bounds` sao as MESMAS constantes
 * (`MAP_1_WIDTH`, `MAP_1_BOUNDS`), nao "o mesmo tamanho aproximado". E
 * o que faz a camera do botao ter o mesmo alcance do vale, e comparar o
 * mesmo teste nos dois da para ler a diferenca como diferenca do CHAO e
 * nao como diferenca de mapa
 *
 * ## `cameraZoom: 1` ESTA ESCRITO, E NAO HERDADO
 *
 * `cameraZoom` nao tem padrao no codigo: o `getter` do motor le
 * `map?.cameraZoom ?? 1`. Apagado daria 1 por acidente, e e o mesmo
 * numero so que escrito fica visivel que a camera e uma escolha deste
 * mapa e nao um sobrar
 *
 * ## POR QUE `zones: []` E NAO AUSENTE
 *
 * Porque `drawMap` percorre `map.zones` sem `?? []` — o `terrain.draw`
 * acima usa, o laco de rotulos nao. Ausente daria
 * `TypeError: map.zones is not iterable` na hora de desenhar, e este
 * mapa nao tem zona nenhuma justamente por nao ter rotulo
 *
 * E `zones: []` tambem e o que garante o "sem nenhum mob": o elenco de
 * criaturas sai das zonas, e uma lista vazia nao casa com nenhuma
 * entrada do `ZONE_ROSTER`
 *
 * ## POR QUE AS PROPS VEM DE `criarPropsTeste()` E NAO DE `createProps()`
 *
 * Porque `createProps()` semeia arvore e arbusto pela semente do vale, e
 * este mapa nao quer nenhum dos dois: ele tem um campo de cristal, e o
 * cristal vem em quatro raridades com contagem exata. `createProps()`
 * entregaria 180 arvores em volta do campo
 *
 * ## POR QUE O NOME E "VALE 1" E O ID CONTINUA `mapa_teste`
 *
 * O `name` e o que o jogador le, e e este que foi trocado. O `id` nao
 * foi: ele nao e etiqueta, e chave de quatro arquivos — `protocol.js`,
 * `GameServer`, `GameClient` e o botao da HUD comparam a string
 * `mapa_teste`, e o save do jogador pode ter ela gravada
 *
 * A troca de id fica de fora deste pedido de proposito. E uma renomeacao
 * de seis arquivos que nao muda nada na tela, e o dia em que vale a pena
 * fazer e junto com a primeira coisa que depender do nome, e nao antes
 *
 * ## A LINHA DO FIM, E POR QUE SO NESTE MAPA
 *
 * A linha cinza que delimita o mapa foi despensada quando a sebe de
 * arbusto passou a fechar as quatro bordas do vale — ver o bloco "A
 * LINHA CINZA DA BORDA FOI DESPENSADA" no `GameEngine.drawMap`. Era
 * parede pintada por cima da parede de verdade
 *
 * Aqui nao tem sebe: e um mapa vazio, sem prop nenhuma. Sem a linha o
 * jogador sai andando do nada — o `clampToBounds` segura ele, mas nao
 * ha nada na tela dizendo onde o mundo acaba
 *
 * Por isso a linha volta, e volta como `limiteVisivel: true`, uma
 * propriedade deste mapa. Nao volta no `drawMap` para todos: o vale e o
 * hub ja tem a sebe, e la a linha seria de novo a parede pintada
 */
/**
 * A SEMENTE DO VALE 1.
 *
 * Um numero so, e nao o `MAP_1_SEED`. As duas semeaduras nao podem
 * concordar: se usassem a mesma, o cristal cairia exatamente onde a
 * arvore cai, e da para o jogador andar pelo campo de cristal e tropecar
 * numa arvore invisivel
 *
 * O numero e arbitrario e fixo, como o do mapa 1. E o que faz os 40
 * cristais ficarem sempre nos mesmos lugares: um campo que muda de posicao
 * a cada entrada e impossivel de medir
 */
export const MAP_TESTE_SEED = 771402;

/**
 * OS 40 CRISTAIS DO VALE 1, E COMO ELES SE DISTRIBUEM.
 *
 * Sao 23 comuns, 10 raros, 5 epicos e 2 lendarios — 40 no total. A conta
 * fecha, e a proporcao e de proposito: a maioria e comum porque e o que
 * o jogador ve todo dia andando, e o lendario e rarity tao rara que dois
 * no mapa inteiro ja sao um acontecimento
 *
 * ## A ORDEM DELE, E POR QUE ESTA DE MAIS RARO PARA MAIS COMUM
 *
 * A lista esta do lendario para o comum, e e a ordem em que o sorteio
 * acontece. O lendario e o primeiro a escolher lugar, e por dois motivos:
 * ele tem o raio maior, entao e o mais caro de acomodar; e se algum dia
 * este mapa ganhar obstaculo, portal ou bau, o cristal lendario e o
 * primeiro a poder ficar sem o melhor ponto
 *
 * Se o comum fosse semeado primeiro, os 23 comuns ocupaem o mapa e o
 * lendario passaria a aceitar qualquer sobra. Com o campo poucas vezes
 * dando conta, hoje a ordem nao muda o resultado — ela esta aqui para
 * quando mudar
 *
 * ## POR QUE UM `placeProps` POR RARIDADE, E NAO UM PLAN COM PESO
 *
 * Porque o `pickPlanEntry` sorteia pelo PESO, e peso da proporcao, nao
 * contagem exata. Um plan com pesos 23/10/5/2 entregaria 40 cristais, mas
 * a distribuicao seria uma media em torno disso — e a lista abaixo pede 2,
 * 5, 10 e 23. Sortear raridade por raridade e o que torna os numeros exatos
 */
const CRISTAIS_DO_VALE = [
  { type: "cristal_lendario", quantidade: 2 },
  { type: "cristal_epico", quantidade: 5 },
  { type: "cristal_raro", quantidade: 10 },
  { type: "cristal_comum", quantidade: 23 },
];

/**
 * A ZONA LIVRE, e o retangulo no centro do vale onde nao nasce pedra.
 *
 * ## POR QUE SO O CENTRO, E NAO SO AS PONTAS
 *
 * A primeira versao destas pedras botava tudo nos quatro cantos e o vale
 * ficou oco: 40 cristais concentrados em quatro bolsos, com um mapa enorme
 * no meio sem nada para buscar. O caminho intermediario e o que foi pedido
 * agora — pedra em TODO o mapa, menos o retangulo central
 *
 * ## POR QUE UM RETANGULO, E NAO UM CIRCULO
 *
 * Porque o retangulo e um contrato verificavel. Com um circulo a borda fica
 * curva e a duvida de "isso e o centro?" so se responde medindo a distancia
 * ate o meio. Com o retangulo, "esta fora" e uma comparacao em X e outra em
 * Y, e da para conferir num script
 *
 * ## O TAMANHO: 2200 x 1700
 *
 * O miolo precisa caber o painel do jogador, o spawn e as zonas de mob, com
 * folga para um dash inteiro. A area util do vale e 5700 x 3900, e isso
 * deixa uma faixa de pedras com 1750px de espessura em cima e embaixo e
 * 1750 nas laterais — o suficiente para as pedras se espalharem por todo o
 * anel, e nao so nos quatro cantos
 */
const CRISTAIS_ZONA_LIVRE = {
  largura: 2200,
  altura: 1700,
};

/**
 * O AMOSTRADOR FORA DO CENTRO, e ele sorteia uniforme e joga fora o que
 * caiu no retangulo livre.
 *
 * ## POR QUE REJEICAO, E NAO ESCOLHER UM LADO
 *
 * Porque escolher um lado sorteia DENTRO dele — e escolher entre quatro
 * lados e a mesma coisa que mandar tudo pros cantos. A rejeicao deixa o
 * sorteio uniforme sobre o anel inteiro: cada ponto fora do centro tem a
 * MESMA chance, e nao so os quatro cantos
 *
 * ## POR QUE 60 TENTATIVAS, E NAO AS 40 DO `placeProps`
 *
 * Porque sao contagens diferentes. Aqui o alvo nao e a prop repetida, e o
 * centro vazio — e a chance de cair dentro dele e de cerca de 17%, o que
 * da uma media de 1,2 tentativas por ponto aceito. As 60 e folga, e o
 * sorteio do `placeProps` continua com as 40 dele, que sao para nao repetir
 * prop
 *
 * ## O RETORNO DO FIM, QUANDO AS 60 FALHAM
 *
 * Nao e "impossivel": com 17% por tentativa, 60 seguidas tem chance de 1 em
 * 10^47. Mas `amostrarForaDoCentro` tem que devolver um ponto VALIDO, e o
 * contrato do chamador nao tem como pedir ponto extra. Entao, se ainda assim
 * vier um ponto dentro, ele e empurrado para fora pela face mais proxima — e
 * a chance de o retorno ser ruim e zero, nao pequena
 */
function amostrarForaDoCentro(random) {
  const margemX = MAP_1_BOUNDS.x + 70;
  const margemY = MAP_1_BOUNDS.y + 70;
  const larguraUtil = MAP_1_BOUNDS.width - 140;
  const alturaUtil = MAP_1_BOUNDS.height - 140;

  const centroX = margemX + larguraUtil / 2;
  const centroY = margemY + alturaUtil / 2;

  const meiaLargura = CRISTAIS_ZONA_LIVRE.largura / 2;
  const meiaAltura = CRISTAIS_ZONA_LIVRE.altura / 2;

  const dentroDoCentro = (ponto) =>
    Math.abs(ponto.x - centroX) <= meiaLargura &&
    Math.abs(ponto.y - centroY) <= meiaAltura;

  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    const ponto = {
      x: margemX + random() * larguraUtil,
      y: margemY + random() * alturaUtil,
    };

    if (!dentroDoCentro(ponto)) return ponto;
  }

  /**
   * O EMPURRAO, e ele sai pela face mais proxima.
   *
   * Mede o que sobra ate cada par de bordas e sai pela menor: sair pela face
   * mais proxima e o menor movimento possivel, e mantem o ponto na ponta do
   * anel em vez de teletransporta-lo para o lado oposto
   */
  const folga = 1;
  const sobraX = meiaLargura - Math.abs(ponto.x - centroX);
  const sobraY = meiaAltura - Math.abs(ponto.y - centroY);

  if (sobraX < sobraY) {
    ponto.x =
      ponto.x >= centroX
        ? centroX + meiaLargura + folga
        : centroX - meiaLargura - folga;
  } else {
    ponto.y =
      ponto.y >= centroY
        ? centroY + meiaAltura + folga
        : centroY - meiaAltura - folga;
  }

  return ponto;
}

/**
 * O VALOR DO `placeProps` NESTE MAPA: um cristal nao entra em cima do
 * ponto em que o jogador aparece.
 *
 * `placeProps` ja afasta 70px da borda do mapa, e isso basta para a arte
 * caber dentro do limite. O que ele nao sabe e que aqui tem um `spawn`:
 * sem este filtro, um cristal pode cair nas 5920x4120 em cima dos 3000,
 * 2100, e o jogador entra no vale ja dentro de uma rocha
 *
 * O `180` alem do raio e o espaco de andar. Sem ele, o cristal respeita a
 * borda e mesmo assim chega perto demais: o jogador apareceria a few
 * pixels de uma parede
 */
const CRISTAIS_LONGE_DO_SPAWN = 180;

/**
 * SEMEIA OS 40 CRISTAIS DO VALE 1, EM TODO O MAPA MENOS NO CENTRO.
 *
 * ## POR QUE 40, E POR QUE FORA DO CENTRO
 *
 * A primeira versao botava 40 pedras uniforme, e o miolo ficava cheio de
 * obstaculo. A segunda botou as 40 nos quatro cantos e o vale ficou oco.
 * Esta e a terceira: as 40 voltaram, e agora o unico lugar proibido e o
 * retangulo central — entao o mapa inteiro tem o que buscar e o meio
 * continua limpo para o jogador andar
 *
 * Devolve o mesmo formato do `createProps` do mapa 1 — `props`,
 * `blocking` e `decorative` — porque quem consome sao os mesmos tres
 * percursos do motor, do minimapa e do `CollisionSystem`, e o contrato
 * deles e lista vazia em vez de `undefined`
 *
 * `decorative` volta vazio, e nao por esquecimento: os quatro tipos de
 * cristal sao `blocking: true`. E uma lista vazia aqui significa a coisa
 * verdadeira, que neste mapa nao existe prop decorativa
 */
function criarPropsTeste() {
  const random = createRandom(MAP_TESTE_SEED);

  const props = [];
  const blocking = [];
  const decorative = [];

  for (const { type, quantidade } of CRISTAIS_DO_VALE) {
    const lote = placeProps(
      [{ type, weight: 1 }],
      quantidade,
      random,
      (x, y, radius) =>
        Math.hypot(x - MAP_1_SPAWN.x, y - MAP_1_SPAWN.y) >
        CRISTAIS_LONGE_DO_SPAWN + radius,
      // os lotes anteriores entram como `others`: e o que impede um
      // cristal de cair em cima de outro de raridade diferente
      props,
      "cristal",
      // as pedras nascem em todo o mapa, menos no retangulo livre do centro
      amostrarForaDoCentro,
    );

    props.push(...lote);
    blocking.push(...lote.filter((prop) => prop.blocking));
  }

  return { props, blocking, decorative };
}

const {
  props: propsDoVale,
  blocking: blockingDoVale,
  decorative: decorativeDoVale,
} = criarPropsTeste();

const solidsDoVale = buildPropSolids(blockingDoVale);

export const MAP_TESTE_ID = "mapa_teste";

export const MAP_TESTE = {
  id: MAP_TESTE_ID,
  name: "Vale 1",

  /**
   * ESTE MAPA DESENHA AS ZONAS POR CIMA DO CHAO.
   *
   * O vale 1 nao tem arte de dungeon: e um campo escuro com 40 cristais
   * espalhados, e a zona pintada e a unica coisa que diz "aqui tem
   * cristal, aqui e o brejo". Tirar o desenho e o rotulo deixaria uma tela
   * preta sem nenhuma orientacao
   *
   * O mapa 1 tem o contrario — o Tiled desenhado — e por isso nao declara
   * isto, e o `drawMap` nao pinta nada por cima dele
   */
  desenhaZonas: true,

  width: MAP_1_WIDTH,
  height: MAP_1_HEIGHT,

  bounds: MAP_1_BOUNDS,

  background: "#17221f",

  /**
   * o chao escuro que o usuario deixou: a arte da
   * `terra_2-voce-consedue-deixar-ela-uma-terra-mais-preta.jpg`
   */
  groundTile: "dark",

  /**
   * O NASCIMENTO AFUADO DO CHEFE, e nao o `MAP_1_SPAWN`.
   *
   * Este mapa tem `resumeWhereLeftOff: false`, entao o `spawn` e onde o
   * jogador SEMPRE entra no vale. Como o chefe fica no centro e o
   * `MAP_1_SPAWN` e o centro, manter os dois no mesmo ponto punha o
   * jogador dentro do `hulk_val` no instante em que o mapa carregava
   *
   * O `MAP_1_DISTANCIA_DO_CHEFE` e o mesmo numero que a arena usa para
   * resolver este problema — ver o comentario da constante
   */
  spawn: MAP_1_SPAWN_COM_CHEFE,

  /** nao tem de onde voltar, entao comeca sempre pelo meio */
  resumeWhereLeftOff: false,

  cameraZoom: 1,

  /**
   * O HULK DO VALE, NO CENTRO DO MAPA.
   *
   * ## O `bosses` E SEPARADO DAS ZONAS, E O MOTOR LE OS DOIS
   *
   * O roster espalha criaturas numa grade dentro de cada zona, e ele foi
   * feito para o campo de mob: sete bichos por zona, todos iguais. Um
   * chefe nao cabe nesse desenho — ele e UM, em UM ponto. Por isso o mapa
   * tem um campo `bosses` e o `createBosses` do motor le
   *
   * Este vale tem `zones: []`, entao sem este campo ele nao teria NENHUMA
   * criatura: nem mob, nem chefe. E o `hulk_val` precisa de um `typeId`
   * proprio porque e uma criatura diferente do `hulk` da arena, com arte e
   * numeros proprios — ver `src/data/enemies/index.js`
   */
  bosses: MAP_1_CHEFES,

  /** o vazio nao tem semente: nada e espalhado com ela */
  zones: [],

  /**
   * OS 40 CRISTAIS, e nao mais listas vazias.
   *
   * Sao quatro `placeProps`, um por raridade, e nao um `createProps()`
   * porque este mapa nao tem arvore nem arbusto para semear: ele tem
   * cristal, e o cristal vem em quatro raridades com contagem exata. O
   * `createProps()` do vale semearia 180 arvores em volta de um campo que
   * nao deveria ter arvore nenhuma
   *
   * ## POR QUE `solids` VEM JUNTO E NAO SO `props`
   *
   * Porque os dois andam juntos: `solids` e a versao colidivel de
   * `blocking`, e um cristal visivel sem coluna nao seria um cristal, seria
   * um cenario. Sao os quatro lotes que bloqueiam — `decorative` fica
   * vazio porque nenhum dos quatro e decorativo
   */
  props: propsDoVale,
  blocking: blockingDoVale,
  decorative: decorativeDoVale,
  solids: solidsDoVale,

  /** sem portal: quem volta para o mapa anterior e o botao da HUD */
  portals: [],

  /** a linha do limite, que o vale nao precisa porque tem sebe */
  limiteVisivel: true,
};



/**
 * O REGISTRO DE MAPAS.
 *
 * Sao tres mapas de mundo e a arena, e o jogo abre no `base`.
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
  map_2: MAP_2,

  /**
   * A ARENA DE CHEFE.
   *
   * Sem portal apontando para ela ainda: a arena se entra por outra
   * etapa, e um `destino` viria do portal que a traz — nao da arena
   */
  boss_1: BOSS_1_MAP,

  /**
   * O MAPA DE TESTE.
   *
   * Sem portal e sem atalho: quem entra nele e quem sai dele e o botao
   * da HUD, que pergunta ao servidor. Nao tem `destino` em portal
   * porque nao e um destino — e um destino do BOTAO
   */
  [MAP_TESTE_ID]: MAP_TESTE,
};

/**
 * O MAPA QUE O JOGO ABRE.
 *
 * O `base`: o hub. E o que o `GameCanvas` e o `GameServer` pedem ao
 * entrar no mundo
 */
export const DEFAULT_MAP_ID = "base";

/**
 * O ID DA ARENA DO CHEFE, reexportado.
 *
 * O botao do HUD precisa dele para comparar com o mapa em que o jogador
 * esta, e o import dele por aqui evita que o HUD alcance o arquivo do
 * mapa por um caminho proprio: quem registra mapa e quem fala do id dele
 * sao o mesmo lugar
 */
export { BOSS_1_ID as ARENA_ID };

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
