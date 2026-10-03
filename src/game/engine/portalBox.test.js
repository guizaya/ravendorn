import { describe, expect, it } from "vitest";

import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { BASE_MAP } from "../../data/maps/base.js";
import { MAP_1, getMap } from "../../data/maps/index.js";
import { BASE_PORTALS, PORTALS } from "../../data/portais/index.js";
import { worldToMinimap } from "../ui/minimap.js";

/**
 * A BOX DO PORTAL.
 *
 * Duas metades, e elas nao podem ser testadas juntas:
 *
 * - o MOTOR descobre que o jogador esta em cima de um portal
 * - o SERVIDOR decide se pode atravessar
 *
 * A separacao existe porque o botao nao teleporta no cliente: ele pede,
 * e o servidor refaz a mesma conta. Sem a segunda metade, qualquer jogador
 * poderia mandar "travesse para o vale" sem nunca andar ate o portal — e o
 * portal seria decoracao
 */

const classe = CHARACTER_CLASSES.find(
  (c) => c.id === "warrior",
);

const criar = (mapa = BASE_MAP) => {
  const engine = new GameEngine(null, classe, null, {
    playerId: "p1",
    characterName: "Ana",
  });

  engine.setMap(mapa);

  return engine;
};

const [PORTAL] = BASE_PORTALS;

/** põe o jogador em cima do portal, do jeito que o jogador chegaria */
const emCima = (engine) => {
  engine.world.player.x = PORTAL.x;
  engine.world.player.y = PORTAL.y;
};

describe("o que o motor publish no painel", () => {
  it("longe do portal, nao ha box", () => {
    const engine = criar();

    expect(engine.portalSobOsPes()).toBe(null);
    expect(engine.dadosDoPortalNoPe()).toBe(null);

    engine.destroy();
  });

  it("em cima do portal, o painel traz id, destino e nome", () => {
    const engine = criar();

    emCima(engine);

    expect(engine.dadosDoPortalNoPe()).toEqual({
      id: "portal_hub",
      destino: "map_1",
      nome: "Mapa 1",
    });

    engine.destroy();
  });

  it("o zone e um circulo do raio do portal", () => {
    const engine = criar();

    // a arte e redonda e o portal e ancorado pelo centro, entao o zone
    // e `size / 2`. Na diagonal, `size` inteiro daria um quadrado com
    // os quatro cantos vazios dentro
    const raio = PORTAL.size / 2;

    engine.world.player.x = PORTAL.x + raio - 2;
    engine.world.player.y = PORTAL.y;

    expect(engine.portalSobOsPes()).not.toBe(null);

    engine.world.player.x = PORTAL.x + raio + 2;
    engine.world.player.y = PORTAL.y;

    expect(engine.portalSobOsPes()).toBe(null);

    engine.destroy();
  });

  it("um portal sem destino nao mostra box nenhuma", () => {
    /**
     * O `portal_floresta` continua sem `destino`, e e por isso que
     * atravessar um enfeite nao e possivel — nem pela box, nem pelo
     * servidor
     */
    const floresta = PORTALS.find(
      (p) => p.id === "portal_floresta",
    );

    expect(floresta.destino).toBe(undefined);

    const engine = criar(MAP_1);

    engine.world.player.x = floresta.x;
    engine.world.player.y = floresta.y;

    expect(engine.portalSobOsPes()).toBe(null);

    engine.destroy();
  });

  it("o portal do pantano ja traz a box do voltar para o hub", () => {
    const pantano = PORTALS.find(
      (p) => p.id === "portal_pantano",
    );

    const engine = criar(MAP_1);

    engine.world.player.x = pantano.x;
    engine.world.player.y = pantano.y;

    expect(engine.dadosDoPortalNoPe()).toEqual({
      id: "portal_pantano",
      destino: "base",
      nome: "Base",
    });

    engine.destroy();
  });

  it("um destino que nao existe no registro e ignorado", () => {
    /**
     * Um `destino` com id apagado faria a box prometer um mapa que o
     * mundo nao tem
     */
    const engine = criar();

    engine.world.portals = [
      { ...PORTAL, destino: "mapa_que_nao_existe" },
    ];

    emCima(engine);

    expect(engine.portalSobOsPes()).toBe(null);

    engine.destroy();
  });

  it("funciona antes de qualquer mapa, no motor recem-construido", () => {
    /**
     * O construtor chama o `sendSnapshot` antes de existir `setMap`, e
     * `world.portals` so e montado no `setMap`. Sem o `?? []` do
     * `portalSobOsPes`, o primeiro painel estouraria — e o servidor
     * engole excecao de painel de proposito, entao o sintoma seria um
     * painel que nunca chega, sem erro visivel na tela
     */
    const engine = new GameEngine(null, classe, null, {
      playerId: "p1",
      characterName: "Ana",
    });

    expect(engine.world.portals).toBe(undefined);
    expect(engine.dadosDoPortalNoPe()).toBe(null);

    engine.destroy();
  });
});

describe("a chegada do outro lado", () => {
  it("chega no portal de chegada, e nao no spawn do mapa", () => {
    /**
     * O spawn do vale e (3000, 2100), a tres mil pixels do portal.
     * Atravessar e aparecer no meio do mapa deixaria o jogador sem
     * nenhuma pista de que veio do hub
     */
    const engine = criar();

    emCima(engine);
    engine.travessarPortal();

    expect(engine.world.map.id).toBe("map_1");
    expect(engine.world.player.x).toBe(5799);
    expect(engine.world.player.y).toBe(3981);

    expect(engine.world.player.x).not.toBe(MAP_1.spawn.x);
    expect(engine.world.player.y).not.toBe(MAP_1.spawn.y);

    engine.destroy();
  });

  it("o ponto de chegada e o do portal, lido do mapa de destino", () => {
    const engine = criar();

    emCima(engine);

    const destino = getMap(PORTAL.destino);
    const alvo = destino.portals.find(
      (p) => p.id === PORTAL.chegada,
    );

    expect(alvo, "o portal de chegada nao existe no destino").toBeTruthy();

    expect(
      engine.chegadaDe(PORTAL, destino),
    ).toEqual({ x: alvo.x, y: alvo.y });

    engine.destroy();
  });

  it("o portal ligado declara a chegada como id, e nao como ponto", () => {
    /**
     * Se fosse uma coordenada, mover o portal do vale deixaria a
     * chegada do hub apontando para sempre para o lugar antigo
     */
    expect(PORTAL.chegada).toBe("portal_pantano");
    expect(typeof PORTAL.chegada).toBe("string");
  });

  it("uma chegada que nao existe no destino cai no spawn", () => {
    /**
     * Melhor aparecer no meio do mapa do que nao atravessar. E o
     * destino continua sendo o do portal — o que some e o ponto
     */
    const engine = criar();

    const quebrado = { ...PORTAL, chegada: "portal_que_nao_existe" };

    engine.world.portals = [quebrado];

    emCima(engine);
    engine.travessarPortal();

    expect(engine.world.map.id).toBe("map_1");
    expect(engine.world.player.x).toBe(MAP_1.spawn.x);
    expect(engine.world.player.y).toBe(MAP_1.spawn.y);

    engine.destroy();
  });

  it("um portal sem chegada cai no spawn", () => {
    const engine = criar();

    engine.world.portals = [
      { ...PORTAL, chegada: undefined },
    ];

    emCima(engine);
    engine.travessarPortal();

    expect(engine.world.player.x).toBe(MAP_1.spawn.x);

    engine.destroy();
  });

  it("entrar num mapa sem atravessar usa o spawn dele", () => {
    /**
     * A guarda do `setMap`: a travessia e a unica coisa que muda onde o
     * jogador cai. Qualquer outra troca de mapa continua nascendo no
     * meio, como antes
     */
    const engine = criar();

    engine.setMap(MAP_1);

    expect(engine.world.player.x).toBe(MAP_1.spawn.x);
    expect(engine.world.player.y).toBe(MAP_1.spawn.y);

    engine.destroy();
  });

  it("chegou no portal do vale, e a box do voltar ja aparece", () => {
    /**
     * O oposto do que este teste afirmava antes do caminho de volta: o
     * jogador chega em cima do `portal_pantano` e a box do hub aparece
     * na hora, sem precisar sair de cima do portal para poder sair dele
     */
    const engine = criar();

    emCima(engine);
    engine.travessarPortal();

    expect(engine.dadosDoPortalNoPe()).toEqual({
      id: "portal_pantano",
      destino: "base",
      nome: "Base",
    });

    engine.destroy();
  });

  it("a ida e a volta fecham o ciclo, e nenhuma das duas passa pelo centro", () => {
    /**
     * O caminho inteiro duas vezes, com a posicao conferida em cada
     * chegada
     *
     * Chegar no meio do hub obrigaria o jogador a andar de volta ate o
     * portal para sair dele, e o segundo clique pareceria nao funcionar
     */
    const engine = criar();

    // hub -> vale
    emCima(engine);
    engine.travessarPortal();

    expect(engine.world.map.id).toBe("map_1");
    expect(engine.world.player.x).toBe(5799);
    expect(engine.world.player.y).toBe(3981);

    // vale -> hub
    engine.travessarPortal();

    expect(engine.world.map.id).toBe("base");
    expect(engine.world.player.x).toBe(1475);
    expect(engine.world.player.y).toBe(588);

    // e de volta ao vale, do mesmo portal
    engine.travessarPortal();

    expect(engine.world.map.id).toBe("map_1");
    expect(engine.world.player.x).toBe(5799);

    engine.destroy();
  });

  it("os dois lados declaram o par pelo id do outro portal", () => {
    /**
     * Nenhum dos lados guarda coordenada de chegada. Se guardasse,
     * mover um portal deixaria a volta apontando para o lugar antigo
     */
    const hub = BASE_PORTALS.find((p) => p.id === "portal_hub");
    const pantano = PORTALS.find(
      (p) => p.id === "portal_pantano",
    );

    expect(hub.destino).toBe("map_1");
    expect(hub.chegada).toBe(pantano.id);

    expect(pantano.destino).toBe("base");
    expect(pantano.chegada).toBe(hub.id);
  });
});

describe("o minimapa acompanha o mapa", () => {
  /**
   * A escala do minimapa vem de `min(panelWidth / map.width,
   * panelHeight / map.height)`, e ela MUDOUVE entre os dois mapas: 0,124
   * no hub e 0,035 no vale
   *
   * O `getMinimapTransform` memoiza essa conta. A chave da memoizacao
   * precisa incluir o mapa, e nao so o tamanho do painel — que e
   * 240x146 em qualquer mapa. Sem o mapa na chave, o cache acertava na
   * travessia e o vale era desenhado no tamanho do hub
   */
  const painel = { width: 240, height: 146 };

  const dentroDoPainel = (engine) => {
    const t = engine.getMinimapTransform(
      painel.width,
      painel.height,
    );

    const p = worldToMinimap(
      t,
      engine.world.player.x,
      engine.world.player.y,
    );

    return {
      escala: t.scale,
      dentro:
        p.x >= 0 &&
        p.x <= painel.width &&
        p.y >= 0 &&
        p.y <= painel.height,
    };
  };

  it("a escala do hub e maior, porque o hub e menor", () => {
    const engine = criar();

    const base = dentroDoPainel(engine).escala;

    emCima(engine);
    engine.travessarPortal();

    const vale = dentroDoPainel(engine).escala;

    expect(base).toBeGreaterThan(vale);

    engine.destroy();
  });

  it("atravessar troca a escala do minimapa", () => {
    const engine = criar();

    const antes = dentroDoPainel(engine).escala;

    emCima(engine);
    engine.travessarPortal();

    const depois = dentroDoPainel(engine).escala;

    // se a escala nao mudou, o vale esta sendo desenhado com a
    // transformacao do hub
    expect(depois).not.toBe(antes);
    expect(depois).toBeCloseTo(
      Math.min(
        painel.width / MAP_1.width,
        painel.height / MAP_1.height,
      ),
      6,
    );

    engine.destroy();
  });

  it("o jogador fica DENTRO do painel em cada mapa", () => {
    /**
     * A falha que o jogador viu: com a escala do hub, o ponto (5799,
     * 3981) do vale caia a 719px do canto, bem fora dos 240px do
     * painel — o personagem sumia do minimapa
     */
    const engine = criar();

    expect(dentroDoPainel(engine).dentro).toBe(true);

    emCima(engine);
    engine.travessarPortal();

    expect(dentroDoPainel(engine).dentro).toBe(true);

    engine.travessarPortal();

    expect(dentroDoPainel(engine).dentro).toBe(true);

    engine.destroy();
  });

  it("a volta traz a escala do hub de volta", () => {
    const engine = criar();

    const base = dentroDoPainel(engine).escala;

    emCima(engine);
    engine.travessarPortal();
    engine.travessarPortal();

    expect(dentroDoPainel(engine).escala).toBeCloseTo(base, 6);

    engine.destroy();
  });

  it("o cache nao sobrevive a uma troca de mapa", () => {
    /**
     * O cache e por OBJETO, e nao por `map.id`. Dois mapas com o mesmo
     * tamanho dariam a mesma escala e a comparacao por id nao diria
     * que o cache e velho; a identidade garante que qualquer troca
     * invalida, sem o `setMap` ter que lembrar de limpar isto
     */
    const engine = criar();

    const antesDoCache = engine.minimapCache;

    engine.getMinimapTransform(painel.width, painel.height);

    const depoisDoCache = engine.minimapCache;

    expect(depoisDoCache.map).toBe(BASE_MAP);

    engine.setMap(MAP_1);
    engine.getMinimapTransform(painel.width, painel.height);

    expect(depoisDoCache.map).toBe(BASE_MAP);
    expect(engine.minimapCache.map).toBe(MAP_1);

    // e o `setMap` nao precisa limpar o cache: a identidade ja invalidou
    expect(antesDoCache).toBe(null);

    engine.destroy();
  });

  it("a escala confere com a conta, mapa a mapa", () => {
    const engine = criar();

    for (const mapa of [BASE_MAP, MAP_1]) {
      engine.setMap(mapa);

      const t = engine.getMinimapTransform(
        painel.width,
        painel.height,
      );

      expect(
        t.scale,
        mapa.id,
      ).toBeCloseTo(
        Math.min(
          painel.width / mapa.width,
          painel.height / mapa.height,
        ),
        6,
      );
    }

    engine.destroy();
  });
});

describe("a travessia pelo motor", () => {
  it("trocou de mapa", () => {
    const engine = criar();

    emCima(engine);

    expect(engine.travessarPortal()).toBe(true);
    expect(engine.world.map.id).toBe("map_1");

    engine.destroy();
  });

  it("longe do portal, nao atravessa", () => {
    const engine = criar();

    expect(engine.travessarPortal()).toBe(false);
    expect(engine.world.map.id).toBe("base");

    engine.destroy();
  });

  it("o mapa de destino e o do registro, e nao uma copia", () => {
    /**
     * O `destino` e o `id` de um mapa, e o `setMap` recebe o objeto do
     * registro. Se a box guardasse uma copia, o mapa poderia divergir do
     * que o mundo usa
     */
    const engine = criar();

    emCima(engine);
    engine.travessarPortal();

    expect(engine.world.map).toBe(getMap("map_1"));

    engine.destroy();
  });
});
