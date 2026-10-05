import {
  PROP_TYPES,
  propVariantCount,
} from "../props/index.js";
import { PORTALS, MAP_2_PORTALS } from "../portais/index.js";
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
    y: 1500,
    width: 1900,
    height: 1200,

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
    x: 80,
    y: 2880,
    width: 1360,
    height: 1200,
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
    x: 1560,
    y: 2860,
    width: 1300,
    height: 1220,
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
    x: 3080,
    y: 2880,
    width: 1300,
    height: 1200,
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
    x: 4560,
    y: 2860,
    width: 1340,
    height: 1220,
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

export function getZoneById(id) {
  return ZONE_REGISTRY.get(id) ?? null;
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

  groundTile: "grama",

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
  map_2: MAP_2,
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
