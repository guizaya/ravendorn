import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import {
  BASE_MAP,
  MAP_1,
  MAP_1_ZONES,
} from "../../data/maps/index.js";
import { PORTALS, BASE_PORTALS } from "../../data/portais/index.js";
import { BESTIARY } from "../../data/bestiary/index.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { NavGrid } from "../nav/NavGrid.js";
import {
  MAIN_QUESTS,
  SIDE_QUESTS,
} from "../../data/quests/index.js";
import { rotaDeMapas } from "../nav/rotaDeViagem.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

const ARBALIST = CHARACTER_CLASSES.find(
  (definition) => definition.id === "arbalist",
);

/**
 * A VIAGEM AUTOMATICA entre mapas.
 *
 * ## O QUE ESTE ARQUIVO SEGURA
 *
 * A promessa e uma: clicar "ir matar" no bestiario, ou "completar
 * auto" numa missao, com o jogador no hub, tem que Levar o boneco ate a
 * zona — atravessando o portal, e nao andando contra a borda do mapa.
 *
 * Antes disso, o objetivo virava um waypoint com a coordenada da zona,
 * resolvida no mapa em que o jogador ESTIVESSE. Do hub, isso dava um
 * alvo a 4.400px fora dos limites: o `clampToBounds` empurrava o boneco
 * para a borda e o piloto andava contra ela, sem mensagem e sem parar.
 * O sintoma era indistinguivel de "o auto esta quebrado"
 *
 * Por isso o teste nao mede "o plano foi montado": mede o resultado,
 * que e o mapa em que o jogador esta e o lugar onde ele parou
 *
 * ## POR QUE UM MAPA SO
 *
 * O grafo tem dois nos e uma aresta util. Uma viagem com varios saltos
 * exercitaria o BFS, e o BFS tem teste proprio — o que nao se exercita
 * aqui e o que nao existe para ser exercitado
 */
function criarNo(mapa) {
  const canvas = createTestCanvas();

  const engine = new GameEngine(canvas.element, ARBALIST, () => {});

  engine.setMap(mapa);

  return engine;
}

/**
 * O portal do hub esta em `BASE_PORTALS` e nao em `PORTALS`.
 *
 * Os dois-catalogos sao separados porque o hub foi feito depois, e o
 * `PORTALS` sozinho daria `undefined` aqui — um teste que passa com
 * `undefined` no meio e nao prova nada
 */
const PORTAL_HUB = BASE_PORTALS.find((p) => p.id === "portal_hub");

/**
 * ## A VOLTA, E POR QUE ESTE ARQUIVO NAO A EXERCE
 *
 * Nenhum objetivo hoje tem zona no hub: `base` declara `zones: []`, e
 * todo `location` de missao e todo `zoneId` de bestiario apontam para o
 * vale. A rota vale -> hub existe e e testada no grafo, mas nao ha
 * como alcancar um objetivo que a exija, entao um teste de motor que
 * tentasse seria um teste de um cenario que o jogo nao tem
 *
 * Quando o hub ganhar a primeira zona, e este arquivo ganha o caso
 * inverso — e ele vai funcionar sem mudanca, porque o plano e montado
 * a partir de `rotaDeMapas` e nao do caso "hub -> vale"
 */

/**
 * O QUANTO de quadros que o teste gasta.
 *
 * O vale tem 6 mil pixels e o boneco anda 165px/s. A viagem mais longa
 * deste arquivo — hub, portal, Pantano, e a zona mais longe — e de uns
 * 40 segundos de caminhada, ou 2.400 quadros a 60fps. O teto e o
 * dobro, para sobrar margem e ainda assim falhar se o piloto parar
 *
 * E um TETO, nao um `while`: um laco sem limite que esperaria o piloto
 * chegar transformaria um defeito em travamento de suite, e o sintoma
 * seria o teste sumindo em vez de reprovar
 */
const TETO_DE_QUADROS = 6_000;

const PASSO = 1 / 60;

/** onde o boneco parou, ou `null` se o tempo acabou */
function rodar(engine, condicao) {
  for (let quadro = 0; quadro < TETO_DE_QUADROS; quadro += 1) {
    engine.update(PASSO);

    if (condicao()) {
      return { chegou: true, quadro };
    }
  }

  return { chegou: false, quadro: TETO_DE_QUADROS };
}

const dentroDaZona = (engine, zona) =>
  engine.world.player.x >= zona.x &&
  engine.world.player.x <= zona.x + zona.width &&
  engine.world.player.y >= zona.y &&
  engine.world.player.y <= zona.y + zona.height;

const zonaDe = (id) =>
  MAP_1_ZONES.find((zona) => zona.id === id) ?? null;

/**
 * A ZONA que o bestiario aponta para uma criatura.
 *
 * O bestiario guarda UMA zona por criatura — a de maior peso no roster
 * — e e ela que o piloto usa como destino. Ler a zona de la em vez de
 * chumbar um id mantem o teste honesto quando o peso muda
 */
/**
 * A ZONA que a missao aponta.
 *
 * Lida do catalogo de missoes e nao do bestiario: sao duas tabelas
 * diferentes e as duas precisam resolver para a mesma zona. Um id
 * chumbado aqui passaria a medir a zona errada sem ninguem ver
 */
const zonaDaMissao = (engine, questId) => {
  const missao =
    MAIN_QUESTS.find((q) => q.id === questId) ??
    SIDE_QUESTS.find((q) => q.id === questId);

  const zona = zonaDe(missao?.location);

  expect(
    zona,
    `a missao ${questId} aponta para ${missao?.location}, ` +
      "que nao e uma zona",
  ).toBeTruthy();

  void engine;

  return zona;
};

const zonaDoMelhorario = (creatureId) => {
  const entrada = BESTIARY.find(
    (item) => item.creatureId === creatureId,
  );

  const zona = zonaDe(entrada?.zoneId);

  expect(zona, `o bestiario de ${creatureId} nao tem zona`).toBeTruthy();

  return zona;
};

describe("o hub sabe o caminho para o vale", () => {
  it("a rota existe e sai pelo portal do hub", () => {
    const rota = rotaDeMapas(BASE_MAP.id, MAP_1.id);

    expect(rota).not.toBe(null);
    expect(rota).toHaveLength(1);
    expect(rota[0].portal.id).toBe(PORTAL_HUB.id);
    expect(rota[0].mapa.id).toBe(MAP_1.id);
  });

  it("a rota de volta existe e sai pelo portal do pantano", () => {
    const rota = rotaDeMapas(MAP_1.id, BASE_MAP.id);

    expect(rota).not.toBe(null);
    expect(rota[0].portal.id).toBe("portal_pantano");
    expect(rota[0].mapa.id).toBe(BASE_MAP.id);
  });

  it("o portal decorativo nao entra na rota", () => {
    /**
     * `portal_floresta` esta dentro do vale e nao declara destino.
     *
     * Se ele contasse como aresta, a rota do vale para o hub poderia
     * sair por ele — e o jogador atravessaria para `undefined`,
     * desaparecendo do mundo sem erro
     */
    const rota = rotaDeMapas(MAP_1.id, BASE_MAP.id);

    expect(rota.map((s) => s.portal.id)).not.toContain(
      "portal_floresta",
    );
  });

  it("cada zona do vale declara o mapa que ela esta", () => {
    /**
     * Sem `mapId` na zona, o destino e so um retangulo sem dono: o
     * planejador nao sabe em que mapa procurar caminho, e o piloto so
     * aprende isso depois de andar para a borda
     */
    for (const zona of MAP_1_ZONES) {
      expect(zona.mapId, zona.id).toBe(MAP_1.id);
    }
  });
});

describe("ir auto atravessa o portal", () => {
  it("do hub, o boneco chega na zona que o bestiario aponta", () => {
    const engine = criarNo(BASE_MAP);

    /**
     * O OGRE fica no Pantano, que e a zona que contem o portal de volta.
     *
     * E o melhor caso para o piloto e o pior para um teste ingenuo: o
     * destino e a zona que contem o portal, entao um piloto que
     * atravessasse "para o lado errado" pararia aqui do mesmo jeito, e
     * o teste passaria sem ter verificado nada. E por isso que o
     * segundo teste deste arquivo usa uma zona longe
     */
    expect(engine.setBestiaryAuto("ogre")).toBe(true);

    /**
     * A zona vem do bestiario, e nao de um id escrito aqui.
     *
     * `zoneOf` escolhe a zona de MAIOR peso no roster, entao o destino
     * do goblin e o Acampamento (66) e nao a Floresta (46). Um id
     * chumbado no teste passaria a medir a zona errada quando o peso
     * mudasse, e o teste continuaria verde
     */
    const zona = zonaDoMelhorario("ogre");

    const { chegou } = rodar(
      engine,
      () =>
        engine.world.map.id === MAP_1.id &&
        dentroDaZona(engine, zona),
    );

    expect(
      chegou,
      `o boneco parou em ${engine.world.map.id} ` +
        `(${Math.round(engine.world.player.x)}, ` +
        `${Math.round(engine.world.player.y)}), ` +
        `fora de ${zona.id}`,
    ).toBe(true);

    expect(engine.world.map.id).toBe(MAP_1.id);
    expect(engine.bestiaryTargetType).toBe("ogre");

    engine.destroy();
  });

  it("do hub, o boneco chega numa zona do outro lado do vale", () => {
    const engine = criarNo(BASE_MAP);

    /**
     * O ESQUELETO fica na Cripta, no canto oposto ao portal do
     * Pantano.
     *
     * Sao as duas condicoes que quebram o piloto antigo. A distancia
     * longa sozinha daria um boneco andando para fora dos limites do
     * hub; e a arvore na reta — que existe em 8 das 12 zonas — daria um
     * boneco empurrando contra o tronco
     */
    expect(engine.setBestiaryAuto("skeleton")).toBe(true);

    const zona = zonaDoMelhorario("skeleton");

    /**
     * A zona precisa estar LONGE do portal de saida.
     *
     * Sem esta asercao o teste passaria mesmo com o piloto quebrado, em
     * qualquer zona vizinha do portal — e a Cripta esta a 1995px dele,
     * que e quase um terco da largura do vale. O corte e um quarto do
     * mapa, e nao um numero solto: e a mesma medida em qualquer mapa
     */
    const portal = PORTALS.find((p) => p.id === "portal_pantano");

    const distancia = Math.hypot(
      zona.x + zona.width / 2 - portal.x,
      zona.y + zona.height / 2 - portal.y,
    );

    expect(
      distancia,
      `a zona ${zona.id} esta perto demais do portal para testar travessia`,
    ).toBeGreaterThan(MAP_1.width / 4);

    const { chegou } = rodar(
      engine,
      () =>
        engine.world.map.id === MAP_1.id &&
        dentroDaZona(engine, zona),
    );

    expect(
      chegou,
      `o boneco parou em ${engine.world.map.id} ` +
        `(${Math.round(engine.world.player.x)}, ` +
        `${Math.round(engine.world.player.y)}), ` +
        `fora de ${zona.id}`,
    ).toBe(true);

    expect(dentroDaZona(engine, zona)).toBe(true);

    engine.destroy();
  });

  it("o plano some quando o auto e desligado", () => {
    const engine = criarNo(BASE_MAP);

    engine.setBestiaryAuto("ogre");

    engine.update(PASSO);

    expect(engine.travelPlan.length).toBeGreaterThan(0);

    engine.soltarPiloto();

    /**
     * O plano TEM de sumir junto.
     *
     * Se ele sobrevivesse, ficaria esperando em memoria sem ninguem
     * consumir — e o proximo `auto` ligado recomecaria a viagem de onde
     * o jogador parou, andando para o portal como se nada tivesse
     * acontecido
     */
    expect(engine.travelPlan).toEqual([]);
    expect(engine.travelParado).toBe(0);

    engine.destroy();
  });

  it("o plano e refeito quando o auto e desligado no meio da viagem", () => {
    const engine = criarNo(BASE_MAP);

    engine.setBestiaryAuto("ogre");

    // anda um pouco, mas nao chega em lugar nenhum
    for (let i = 0; i < 120; i += 1) {
      engine.update(PASSO);
    }

    engine.soltarPiloto();
    engine.setBestiaryAuto("skeleton");

    engine.update(PASSO);

    /**
     * O plano novo aponta para a zona do ESQUELETO, e nao a do ogre.
     *
     * E aqui que um plano velho aparece: `soltarPiloto` zera o plano,
     * mas um plano que sobrevivesse reaproveitaria as etapas do
     * destino anterior e o boneco iria para o Pantano em vez do
     * Acampamento
     */
    const etapa = engine.travelPlan[0];

    if (etapa) {
      expect(etapa.destinoMapId).toBe(MAP_1.id);
    }

    engine.destroy();
  });
});

describe("o caminho pela missao", () => {
  it("do hub, o boneco chega na zona da missao principal", () => {
    const engine = criarNo(BASE_MAP);

    /**
     * A MESMA viagem, pedida pela missao em vez do bestiario.
     *
     * As duas entradas nao compartilham codigo antes do destino: o
     * bestiario vira `{ target, location }` dentro do
     * `getAutoObjective`, e a missao ja e a missao. Se o bestiario
     * atravessar e a missao nao, o defeito esta no ramo da missao — e
     * sem este teste os dois caminhos teriam de ser medidos juntos
     */
    expect(engine.focusQuest("main_brejo")).toBe(true);

    const brejo = zonaDaMissao(engine, "main_brejo");

    const { chegou } = rodar(
      engine,
      () =>
        engine.world.map.id === MAP_1.id &&
        dentroDaZona(engine, brejo),
    );

    expect(
      chegou,
      `o boneco parou em ${engine.world.map.id} ` +
        `(${Math.round(engine.world.player.x)}, ` +
        `${Math.round(engine.world.player.y)}), fora de ${brejo.id}`,
    ).toBe(true);

    expect(dentroDaZona(engine, brejo)).toBe(true);

    engine.destroy();
  });

  it("do hub, o boneco chega na zona da missao secundaria", () => {
    const engine = criarNo(BASE_MAP);

    /**
     * A SECUNDARIA aceita e o foco e nela.
     *
     * `focusQuest` resolve principal e secundaria pelo mesmo caminho,
     * mas so depois que a secundaria esta ACEITA. Sem o `acceptSide` o
     * `focusQuest` devolveria `true` — ele acha a missao no catalogo —
     * e nao haveria objetivo nenhum para o piloto seguir
     *
     * O id nao e a zona com um prefixo: a secundaria da Cripta se
     * chama `side_esqueletos`, porque o que ela pede e a criatura. Um
     * id montado por regra passaria a testar uma missao que nao existe
     */
    expect(engine.world.quests.acceptSide("side_esqueletos")).toBe(
      true,
    );

    expect(engine.focusQuest("side_esqueletos")).toBe(true);

    const cripta = zonaDaMissao(engine, "side_esqueletos");

    const { chegou } = rodar(
      engine,
      () =>
        engine.world.map.id === MAP_1.id &&
        dentroDaZona(engine, cripta),
    );

    expect(
      chegou,
      `o boneco parou em ${engine.world.map.id} ` +
        `(${Math.round(engine.world.player.x)}, ` +
        `${Math.round(engine.world.player.y)}), fora de ${cripta.id}`,
    ).toBe(true);

    engine.destroy();
  });

  it("uma missao sem zona nao viaja", () => {
    const engine = criarNo(BASE_MAP);

    /**
     * `main_toca` e do tipo `kill`, sem `location`.
     *
     * Ela vale em qualquer lugar, entao nao ha para onde atravessar. E
     * o caso em que um plano seria inventado: sem destino, o piloto
     * ficaria parado ou, pior, tentaria sair do mapa
     */
    engine.world.quests.mainIndex = 1;

    expect(engine.focusQuest("main_toca")).toBe(true);

    engine.update(PASSO);

    expect(engine.travelPlan).toEqual([]);

    engine.destroy();
  });
});

describe("a viagem nao quebra o piloto", () => {
  it("o waypoint aponta para o PORTAL, e nao para a zona de outro mapa", () => {
    const engine = criarNo(BASE_MAP);

    engine.setBestiaryAuto("ogre");

    engine.update(PASSO);

    /**
     * O `autoWaypoint` espelha o proximo ponto do caminho, e o primeiro
     * ponto e o portal do hub.
     *
     * A versao anterior deste teste exigia `null`, e a exigencia era
     * verdadeira na epoca em que o plano nao publishava nada. Ele
     * passou a publicar porque o campo responde "para onde o boneco
     * esta indo", e a leitura que importa e para ONDE — nao se ele
     * esta vazio
     */
    expect(engine.travelPlan.length).toBeGreaterThan(0);

    expect(engine.autoWaypoint).toBeTruthy();

    expect(engine.autoWaypoint.x).toBe(PORTAL_HUB.x);
    expect(engine.autoWaypoint.y).toBe(PORTAL_HUB.y);

    /**
     * E NAO a coordenada da zona, que esta em outro mapa.
     *
     * Este e o defeito original: um waypoint para a zona do outro mapa
     * e o boneco andando contra a borda do hub. A asercao e o que
     * distingue "o piloto aponta para o portal" de "o piloto aponta
     * para o destino final desde o primeiro quadro"
     */
    const etapaFinal = engine.travelPlan.at(-1);

    expect(etapaFinal.mapId).toBe(MAP_1.id);

    expect(
      engine.autoWaypoint.x,
      "o waypoint apontou para a zona de outro mapa",
    ).not.toBe(etapaFinal.x);

    engine.destroy();
  });

  it("o plano sobrevive ao setMap que a propria travessia faz", () => {
    const engine = criarNo(BASE_MAP);

    engine.setBestiaryAuto("ogre");

    engine.update(PASSO);

    expect(engine.travelPlan.length).toBeGreaterThan(1);

    // a primeira etapa termina em portal, a segunda nao
    expect(engine.travelPlan[0].portalId).toBe(PORTAL_HUB.id);
    expect(engine.travelPlan[1].portalId).toBe(null);

    engine.destroy();
  });

  it("um mapa sem objetivo com zona nao monta plano", () => {
    const engine = criarNo(BASE_MAP);

    /**
     * Sem objetivo nenhum, nao ha para onde viajar.
     *
     * E o caso do `autoPlay` puro, o botao de cacar perto: ele nao tem
     * zona, entao nao pode atravessar mapa. Um plano montado aqui seria
     * uma viagem para lugar nenhum
     */
    engine.setAutoPlay(true);

    engine.update(PASSO);

    expect(engine.travelPlan).toEqual([]);

    engine.destroy();
  });
});

/**
 * A CAMINHADA DENTRO DO VALE.
 *
 * A viagem entre mapas nao era o unico caminho. O objetivo estava no
 * mesmo mapa e o piloto seguia um *seek* reto: `walkToward` apontava e
 * o boneco empurrava contra a arvore. Com 137 arvores no vale, e a
 * progressao de quatro zonas de limo exigindo travessias longas, isso
 * travava o piloto no meio do caminho
 */
describe("a caminhada dentro do vale", () => {
  it("a reta do spawn ate a Cripta tem arvore", () => {
    /**
     * O DEFEITO DE ORIGEM, medido.
     *
     * Sem esta verificacao, o teste de chegada abaixo passaria mesmo
     * com um piloto quebrado: o `escapeCorner` gira o passo e o boneco
     * as vezes passa raspando. E o numero que mostra que o caminho
     * precisa de desvio, e nao so de persistencia
     *
     * O ponto de partida e o SPAWN e nao o portal. Da Cripta ate o
     * portal do Pantano a reta e limpa, e medir de la daria `true` e
     * este teste viraria uma tautologia
     */
    const grid = new NavGrid(MAP_1, new CollisionSystem(MAP_1, []));

    const cripta = MAP_1_ZONES.find((z) => z.id === "cripta");

    expect(
      grid.temLinhaDeVisada(MAP_1.spawn, {
        x: cripta.x + cripta.width / 2,
        y: cripta.y + cripta.height / 2,
      }),
      "a reta esta livre: o teste de chegada nao prova nada",
    ).toBe(false);
  });

  /**
   * Deixa o vale SEM criaturas.
   *
   * Sem isso a caça toma conta: `pickAutoTarget` acha uma criatura da
   * zona e o plano cede, e o boneco vai atras dela em vez de andar ate
   * a zona. E o comportamento certo, mas nao o que estes testes medem
   */
function semCriaturas(engine) {
  for (const enemy of engine.world.enemies) {
    enemy.alive = false;
    enemy.respawnTimer = 9999;
  }
}

  it("o piloto atravessa o vale e chega na zona", () => {
    const engine = criarNo(MAP_1);

    semCriaturas(engine);

    /**
     * O CRIPTA e a zona do ogre no bestiario, e uma das mais distantes
     * do ponto de partida
     */
    expect(engine.setBestiaryAuto("ogre")).toBe(true);

    const cripta = zonaDoMelhorario("ogre");

    const { chegou } = rodar(
      engine,
      () => dentroDaZona(engine, cripta),
    );

    expect(
      chegou,
      `o boneco parou em ` +
        `(${Math.round(engine.world.player.x)}, ` +
        `${Math.round(engine.world.player.y)}), fora de ${cripta.id}`,
    ).toBe(true);
  });

  it("o plano vale tambem para o MESMO mapa", () => {
    const engine = criarNo(MAP_1);

    semCriaturas(engine);

    engine.setBestiaryAuto("ogre");

    engine.update(PASSO);

    /**
     * Uma etapa so, e sem portal.
     *
     * E o que distingue a caminhada do vale da viagem entre mapas: a
     * etapa tem `portalId: null` e acontece no mapa em que o jogador ja
     * esta. O mesmo percorrimento de `caminho` e o mesmo replanejamento
     * por travamento servem para os dois casos
     */
    expect(engine.travelPlan).toHaveLength(1);

    expect(engine.travelPlan[0].portalId).toBe(null);

    expect(engine.travelPlan[0].mapId).toBe(MAP_1.id);
  });

  it("uma criatura VIVA cancela a caminhada", () => {
    const engine = criarNo(MAP_1);

    semCriaturas(engine);

    engine.setBestiaryAuto("ogre");

    const cripta = zonaDoMelhorario("ogre");

    const jogador = engine.world.player;

    jogador.x = cripta.x + cripta.width / 2 - 100;
    jogador.y = cripta.y + cripta.height / 2;

    // um ogre vivo dentro da zona
    const ogre = engine.world.enemies.find(
      (e) => e.id.replace(/_\d+$/, "") === "ogre",
    );

    expect(ogre, "o vale nao tinha ogre").toBeTruthy();

    ogre.alive = true;
    ogre.respawnTimer = 0;
    ogre.x = cripta.x + cripta.width / 2 + 40;
    ogre.y = cripta.y + cripta.height / 2;

    /**
     * Com alvo na mao, o piloto vai atras do OGRE, e nao do centro da
     * zona.
     *
     * Sem esta cedencia, o plano levaria o boneco para o meio da zona e
     * ele ignoraria o ogre a dois passos — a progressao de seis zonas
     * seria percorrida sem nunca lutar
     */
    expect(engine.pickAutoTarget()).toBe(ogre);

    expect(
      engine.runTravelPlan(1 / 60, jogador),
      "o plano nao cedeu para a cacada",
    ).toBe(false);
  });
});

/**
 * Um ponto que o jogador NAO VE, no lado pedido.
 *
 * ## POR QUE PROCURAR E NAO CHUTAR
 *
 * A primeira versao deste arquivo chutava uma coordenada 700px a direita
 * e 600px abaixo, e o chute CAIA EM PISO LIVRE: o vale tem 137 arvores
 * em 6.000px de largura, e acertar uma semeada nao e dificil
 *
 * Com o cenario errado, os dois testes de obstaculo passavam sem nunca
 * exercitar o A*. A busca garante que o obstaculo existe antes de
 * medir o piloto em cima dele
 *
 * ## POR QUE O LADO
 *
 * O teste do relogio precisa de dois alvos bloqueados, um de cada lado
 * do jogador, para provar que o caminho foi recalculado E que aponta
 * para o lado novo. Espelhar a coordenada nao serve: o obstaculo que
 * barra a direita pode nao existir a esquerda
 *
 * ## POR QUE UM PONTO SEM VISADA NAO CHEGA MAIS
 *
 * A visada da grade e testada com o RAIO DE NAVEGACAO, que e o raio do
 * boneco mais a folga. E a folga que impede o caminho de raspar no
 * arbusto, e e o que a torna maior que a visada do corpo
 *
 * Antes da folga, "sem visada" queria dizer exatamente uma coisa: ha um
 * obstaculo no caminho, e o piloto vai ter de contornar. Agora quer dizer
 * duas: ha um obstaculo no caminho, OU o destino esta a menos de 8px de
 * um obstaculo. O segundo caso e o destino colado numa arvore — o
 * caminho e a reta mesmo assim, e o piloto chega
 *
 * Por isso o cenario exige as DUAS: sem visada para a navegacao E sem
 * visada para o CORPO. E o que garante que os testes de obstaculo
 * continuam exercitando obstaculo
 *
 * ## A VARREDURA E DETERMINISTICA
 *
 * Os deslocamentos sao fixos e o mapa tem semente fixa, entao a mesma
 * posicao volta sempre. Um `random` aqui faria o teste medir coisas
 * diferentes em execucoes diferentes
 */
function pontoSemVisao(engine, jogador, lado = 0) {
  const grade = engine.gradeDoMapa();

  const de = { x: jogador.x, y: jogador.y };

  for (const raio of [700, 900, 1100, 1300, 1500]) {
    for (let grau = 0; grau < 360; grau += 15) {
      const rad = (grau * Math.PI) / 180;

      const ponto = {
        x: Math.round(de.x + Math.cos(rad) * raio),
        y: Math.round(de.y + Math.sin(rad) * raio),
      };

      if (lado !== 0) {
        const delta = ponto.x - de.x;

        if (lado > 0 ? delta <= 0 : delta >= 0) continue;
      }

      if (grade.temLinhaDeVisada(de, ponto)) continue;

      if (grade.temLinhaDeVisada(de, ponto, jogador.radius)) continue;

      return ponto;
    }
  }

  throw new Error(
    `nao achei nenhum ponto sem visada no lado ${lado} a partir ` +
      "do spawn — o cenario deste arquivo depende de ter obstaculo",
  );
}

describe("a perseguicao com obstaculo", () => {
  /** um alvo em cima do jogador, e um ponto que ele nao ve */
  function cenario() {
    const engine = criarNo(MAP_1);

    const jogador = engine.world.player;

    const grade = engine.gradeDoMapa();

    const alvo = engine.world.enemies.find((e) => e.alive);

    return { engine, jogador, grade, alvo };
  }

  it("sem obstaculo, o piloto usa a RETA e nao aloca caminho", () => {
    const { engine, jogador, grade, alvo } = cenario();

    // um alvo a vista, perto
    alvo.x = jogador.x + 200;
    alvo.y = jogador.y;

    expect(
      grade.temLinhaDeVisada(
        { x: jogador.x, y: jogador.y },
        { x: alvo.x, y: alvo.y },
      ),
      "o cenario de teste nao tem linha de visada",
    ).toBe(true);

    const direcao = engine.direcaoDePerseguicao(jogador, alvo);

    expect(direcao.x).toBeGreaterThan(0);
    expect(Math.abs(direcao.y)).toBeLessThan(0.01);

    /**
     * Nenhum caminho guardado, e nenhum relogio armado.
     *
     * E o caso comum: o vale tem 137 arvores mas a maioria dos alvos
     * esta a vista. Alocar um A* aqui seria trabalho jogado fora
     */
    expect(engine.cacadaCaminho).toBe(null);
  });

  it("com obstaculo, o piloto contorna e chega na distancia de tiro", () => {
    const { engine, jogador, grade, alvo } = cenario();

    const longe = pontoSemVisao(engine, jogador);

    alvo.x = longe.x;
    alvo.y = longe.y;

    expect(
      grade.temLinhaDeVisada(jogador, alvo),
      "o cenario nao tem obstaculo: o teste nao prova nada",
    ).toBe(false);

    engine.frameDelta = 1 / 60;

    // deixa o piloto andar, refazendo o caminho quando ele acaba
    for (let quadro = 0; quadro < 2400; quadro += 1) {
      engine.frameDelta = 1 / 60;

      const direcao = engine.direcaoDePerseguicao(
        jogador,
        alvo,
      );

      jogador.x += direcao.x * 165 * (1 / 60);
      jogador.y += direcao.y * 165 * (1 / 60);
    }

    const distancia = Math.hypot(
      alvo.x - jogador.x,
      alvo.y - jogador.y,
    );

    /**
     * O alcance do arqueiro e 550, e a distancia desejada e 385.
     *
     * Este e o numero do defeito: antes o jogador ficava a 800px, e
     * nunca disparava. Chegar perto e o que destrava o tiro
     */
    expect(
      distancia,
      `terminou a ${Math.round(distancia)}px do alvo`,
    ).toBeLessThan(550);
  });

  it("o caminho e refeito quando o alvo se move", () => {
    const { engine, jogador, grade, alvo } = cenario();

    const longe = pontoSemVisao(engine, jogador);

    alvo.x = longe.x;
    alvo.y = longe.y;

    expect(
      grade.temLinhaDeVisada(jogador, alvo),
      "o cenario nao tem obstaculo",
    ).toBe(false);

    engine.frameDelta = 1 / 60;

    engine.direcaoDePerseguicao(jogador, alvo);

    const primeiro = engine.cacadaCaminho;

    expect(primeiro, "nenhum caminho foi calculado").toBeTruthy();

    /**
     * O alvo CORREU para o lado OPOSTO, para um obstaculo continuar
     * entre ele e o jogador. Os dois pontos sao buscados com o mesmo
     * criterio, um de cada lado
     */
    const outroLado = pontoSemVisao(engine, jogador, -1);

    expect(
      outroLado.x,
      "os dois pontos cairam do mesmo lado do jogador",
    ).toBeLessThan(jogador.x);

    alvo.x = outroLado.x;
    alvo.y = outroLado.y;

    expect(
      grade.temLinhaDeVisada(jogador, alvo),
      "o novo lado do alvo esta visivel",
    ).toBe(false);

    /**
     * Passa do RELOGIO de 0.5s, e nao um quadro de 1/60.
     *
     * A primeira versao deste teste usava `frameDelta = 0.1` e o
     * caminho nao era refeito — o `cacadaRelogio` ficava em 0.4 e a
     * recalculacao nao acontecia. O teste reprovava por um motivo
     * errado: nao porque o caminho estava velho, e porque ele estava
     * novo demais
     */
    engine.frameDelta = 0.6;

    engine.direcaoDePerseguicao(jogador, alvo);

    /**
     * Passou do relogio, entao o caminho foi refeito — e o novo aponta
     * para o LADO NOVO, que e o que prova que o relogio funciona
     */
    expect(engine.cacadaCaminho).not.toBe(primeiro);

    const proximo = engine.cacadaCaminho[0];

    expect(proximo.x).toBeLessThan(jogador.x);
  });

  it("o relogio evita recalcular a CADA quadro", () => {
    const { engine, jogador, grade, alvo } = cenario();

    const longe = pontoSemVisao(engine, jogador);

    alvo.x = longe.x;
    alvo.y = longe.y;

    expect(
      grade.temLinhaDeVisada(jogador, alvo),
      "o cenario nao tem obstaculo",
    ).toBe(false);

    engine.frameDelta = 1 / 60;

    engine.direcaoDePerseguicao(jogador, alvo);

    const primeiro = engine.cacadaCaminho;

    engine.frameDelta = 1 / 60;

    engine.direcaoDePerseguicao(jogador, alvo);

    /**
     * O MESMO objeto, no quadro seguinte.
     *
     * Um A* por quadro custaria ate 80ms por quadro por jogador. O
     * caminho so e refeito quando o relogio vence ou quando ele acaba
     */
    expect(engine.cacadaCaminho).toBe(primeiro);
  });

  it("o primeiro ponto do caminho SOBREVIVE: e o canto", () => {
    /**
     * A REGRESSAO DE UM BUG REAL.
     *
     * O `NavGrid` faz *string pulling*, entao o primeiro ponto do
     * caminho e o mais distante que o jogador enxerga — o canto que
     * contorna a arvore, e nao a celula em que ele esta
     *
     * Uma versao anterior deste arquivo descartava esse primeiro ponto
     * com um `shift()` na hora de recalcular, achando que ele era a
     * celula de origem. O caminho bruto era `[(3220, 2900), (limo)]` e
     * virava `[(limo)]`: o piloto passava a andar DIRETO no obstaculo,
     * travava a 1.700px do alvo, e o `bestiaryAuto` falhava em 2 de 6
     * rodadas
     *
     * O sintoma era silencioso de um jeito que so aparecia com o piloto
     * no meio do caminho: a direcao continuava sendo publicada, e o
     * passo seguinte era bloqueado pelo colisor
     */
    const { engine, jogador, grade, alvo } = cenario();

    const longe = pontoSemVisao(engine, jogador);

    alvo.x = longe.x;
    alvo.y = longe.y;

    expect(
      grade.temLinhaDeVisada(jogador, alvo),
      "o cenario nao tem obstaculo",
    ).toBe(false);

    engine.frameDelta = 1 / 60;

    const bruto = grade.caminho(
      { x: jogador.x, y: jogador.y },
      { x: alvo.x, y: alvo.y },
    );

    expect(bruto.length, "o caminho sem obstaculo").toBeGreaterThan(1);

    engine.direcaoDePerseguicao(jogador, alvo);

    expect(engine.cacadaCaminho).toHaveLength(bruto.length);

    expect(engine.cacadaCaminho[0]).toEqual(bruto[0]);
  });

  it("a direcao publicada NAO e a direta quando ha obstaculo", () => {
    /**
     * O numero do bug, medido.
     *
     * Se a direcao do piloto apontasse direto para o alvo, ele estaria
     * indo de encontro com a arvore. O passo precisa diferir da reta
     */
    const { engine, jogador, grade, alvo } = cenario();

    const longe = pontoSemVisao(engine, jogador);

    alvo.x = longe.x;
    alvo.y = longe.y;

    expect(
      grade.temLinhaDeVisada(jogador, alvo),
      "o cenario nao tem obstaculo",
    ).toBe(false);

    engine.frameDelta = 1 / 60;

    const direcao = engine.direcaoDePerseguicao(jogador, alvo);

    const reta = {
      x: alvo.x - jogador.x,
      y: alvo.y - jogador.y,
    };

    const tamanho = Math.hypot(reta.x, reta.y);

    const retaNormalizada = {
      x: reta.x / tamanho,
      y: reta.y / tamanho,
    };

    const mesmaDirecao =
      Math.abs(direcao.x - retaNormalizada.x) < 0.01 &&
      Math.abs(direcao.y - retaNormalizada.y) < 0.01;

    expect(
      mesmaDirecao,
      "o piloto esta apontando direto para o alvo, atraves do obstaculo",
    ).toBe(false);

    /**
     * E o passo a frente e andavel.
     *
     * E a verificacao que teria pegado o bug: com o canto descartado, a
     * direcao era a reta e o passo batia na arvore
     */
    const teste = {
      x: jogador.x + direcao.x * 12,
      y: jogador.y + direcao.y * 12,
    };

    expect(
      engine.world.collision.isPositionFree(
        teste,
        jogador.radius,
      ),
      `o passo a frente esta bloqueado em ` +
        `(${Math.round(teste.x)}, ${Math.round(teste.y)})`,
    ).toBe(true);
  });
});