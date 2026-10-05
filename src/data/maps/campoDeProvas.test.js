import { describe, expect, it } from "vitest";
import { MAP_1, MAP_1_ZONES } from "../../data/maps/index.js";
import {
  BASE_TERRAIN,
  ZONE_TILE,
  zoneUsesTile,
} from "../../data/terrain/index.js";
import {
  createCreatureRoster,
  TRAINING_DUMMY_BLUEPRINTS,
} from "../../data/enemies/index.js";

/**
 * O CAMPO DE PROVAS: a metrica e o chao.
 *
 * ## O QUE MUDOU
 *
 * A zona tinha 1000x900 e era a menor do vale, menor que qualquer area
 * de mob que so tem sete criaturas. E era o unico lugar do mapa ainda
 * no pixel art de 32px, ao lado de onze ladrilhos de 128px — a diferenca
 * aparecia na borda da zona como um degrau de estilo
 *
 * Agora ela tem 1900x1200 e usa o chao padrao do mapa
 *
 * ## POR QUE ESTE ARQUIVO EXISTE
 *
 * Uma zona e um retangulo dentro de uma grade de outras onze. Aumentar
 * uma sem olhar as vizinhas e o caminho mais rapido de transformar o
 * vale numa zona so — o `KEEP_CLEAR` nao impede sobreposicao de zona,
 * ele so evita arvore dentro delas
 */
const TREINO = MAP_1_ZONES.find((z) => z.id === "treino");

const dentro = (z, p) =>
  p.x >= z.x && p.x <= z.x + z.width && p.y >= z.y && p.y <= z.y + z.height;

describe("a metrica do campo de provas", () => {
  it("cresceu", () => {
    expect(TREINO.width).toBeGreaterThan(1000);

    expect(TREINO.height).toBeGreaterThan(900);
  });

  it("cabe dentro dos limites do mapa", () => {
    expect(TREINO.x).toBeGreaterThanOrEqual(MAP_1.bounds.x);

    expect(TREINO.y).toBeGreaterThanOrEqual(MAP_1.bounds.y);

    expect(TREINO.x + TREINO.width).toBeLessThanOrEqual(
      MAP_1.bounds.x + MAP_1.bounds.width,
    );

    expect(TREINO.y + TREINO.height).toBeLessThanOrEqual(
      MAP_1.bounds.y + MAP_1.bounds.height,
    );
  });

  it("NAO se sobrepoe a nenhuma outra zona", () => {
    /**
     * A REGRA que o vale inteiro depende.
     *
     * O `createProps` evita arvore dentro de zona, mas nao evita que
     * DUAS zonas ocupem o mesmo pixel — e o `terrainAt` devolve a
     * primeira que achar, entao uma sobreposicao faria o desenho e o
     * minimapa discordarem sobre o que existe ali
     */
    for (const zona of MAP_1_ZONES) {
      if (zona.id === TREINO.id) continue;

      const sobrepoe =
        TREINO.x < zona.x + zona.width &&
        TREINO.x + TREINO.width > zona.x &&
        TREINO.y < zona.y + zona.height &&
        TREINO.y + TREINO.height > zona.y;

      expect(sobrepoe, `o treino se sobrepoe a ${zona.id}`).toBe(false);
    }
  });

  it("mantem vao com as vizinhas, como as outras zonas", () => {
    /**
     * O vale e uma grade com vaos de 120 a 180px entre as areas.
     *
     * O campo de provas agora ocupa o vao entre a Campina e a Cripta,
     * e ele respects o mesmo vao. Sem esta verificacao a expansao
     * poderia encostar numa vizinha sem falhar em nada — as areas
     * continuariam sem sobrepor, so que coladas
     */
    const VAO_MINIMO = 100;

    for (const zona of MAP_1_ZONES) {
      if (zona.id === TREINO.id) continue;

      const horizontal =
        TREINO.x < zona.x + zona.width &&
        TREINO.x + TREINO.width > zona.x;

      const vertical =
        TREINO.y < zona.y + zona.height &&
        TREINO.y + TREINO.height > zona.y;

      /**
       * So ha vao a medir entre as que se cruzam em um eixo.
       *
       * Duas zonas diagonalmente opostas nao tem vao entre elas: o
       * `Math.max` das duas separação daria zero e a asercao reprovaria
       * num par que nao esta encostado
       */
      if (!horizontal && !vertical) continue;

      const vaoX = Math.max(
        TREINO.x - (zona.x + zona.width),
        zona.x - (TREINO.x + TREINO.width),
      );

      const vaoY = Math.max(
        TREINO.y - (zona.y + zona.height),
        zona.y - (TREINO.y + TREINO.height),
      );

      const vao = Math.max(vaoX, vaoY);

      expect(
        vao,
        `${zona.id} a ${vao}px do campo de provas`,
      ).toBeGreaterThanOrEqual(VAO_MINIMO);
    }
  });

  it("NAO ha mais boneco no campo", () => {
    /**
     * O campo ficou com criaturas de verdade.
     *
     * Eram dois bonecos: o de madeira e o reforcado. Os dois sairam, e
     * o que fica no lugar e o par de limo 6 e ogre 7, dos dois lados
     *
     * A lista continua existindo e continua vazia: `createTrainingDummy`,
     * o `DUEL_DUMMY_IDS` e o chamador no motor nao mudaram, e um hub sem
     * zona de treino ja devolvia lista vazia antes
     */
    expect(TRAINING_DUMMY_BLUEPRINTS).toEqual([]);
  });

  it("as criaturas do campo estao todas dentro dele", () => {
    /**
     * Uma criatura fora da zona nao e desenhada nem colidivel, e o
     * campo viraria um retangulo vazio com criaturas ao lado
     */
    const criaturas = createCreatureRoster().filter((c) =>
      dentro(TREINO, { x: c.spawnX, y: c.spawnY }),
    );

    expect(criaturas.length).toBeGreaterThan(0);

    for (const criatura of criaturas) {
      expect(dentro(TREINO, { x: criatura.x, y: criatura.y }), criatura.typeId).toBe(
        true,
      );
    }
  });

  it("o par do campo e limo 6 e ogre 7, dos dois lados", () => {
    /**
     * Limo do lado do BREJO (oeste) e ogre do lado da CRIPTA (leste)
     */
    const criaturas = createCreatureRoster().filter((c) =>
      dentro(TREINO, { x: c.spawnX, y: c.spawnY }),
    );

    const limos = criaturas.filter((c) => c.typeId === "slime");
    const ogres = criaturas.filter((c) => c.typeId === "ogre_da_predeira");

    expect(limos.length).toBeGreaterThan(1);
    expect(ogres.length).toBeGreaterThan(1);

    for (const limo of limos) {
      expect(limo.level, "o limo do campo e nivel 6").toBe(6);

      expect(limo.spawnX, "o limo fica do lado do Brejo").toBeLessThan(
        TREINO.x + TREINO.width / 2,
      );
    }

    for (const ogre of ogres) {
      expect(ogre.level, "o ogre do campo e nivel 7").toBe(7);

      expect(ogre.spawnX, "o ogre fica do lado da Cripta").toBeGreaterThan(
        TREINO.x + TREINO.width / 2,
      );
    }
  });
});

describe("o chao do campo de provas", () => {
  it("usa o ladrilho de terra, como as onze areas de mob", () => {
    /**
     * A MESMA arte das onze areas de mob: o `terra.jpg`.
     *
     * O campo de provas ja foi a unica zona de fora duas vezes, por
     * motivos diferentes: primeiro no pixel art de 32px, depois no
     * chao de fora das zonas. As duas vezes ele era o unico retangulo
     * do vale com outra textura
     */
    expect(zoneUsesTile(TREINO)).toBe(true);

    expect(ZONE_TILE).toContain("terra.jpg");
  });

  it("nao ha nenhuma excecao de ladrilho no vale", () => {
    /**
     * As DOZE zonas ladrilham, sem nenhuma condicao por id ou por kind.
     *
     * Se uma voltasse a cair fora, ela voltaria a ser o unico lugar do
     * mapa com outra textura — que e o defeito que as duas exclusoes
     * anteriores produziram
     */
    for (const zona of MAP_1_ZONES) {
      expect(zoneUsesTile(zona), zona.id).toBe(true);
    }
  });

  it("o terreno continua sendo o BASE, para o minimapa", () => {
    /**
     * O `terrain` nao escolhe o ladrilho — as doze compartilham um
     * pattern so. Ele pinta a area no minimapa, e um campo de provas
     * verde continua sendo verde
     */
    expect(TREINO.terrain).toBe(BASE_TERRAIN);
  });

  it("nao tem mais a mistura com terra batida", () => {
    /**
     * O `terrainAlt` e a `altBias` existiam para a GRADE ANTIGA de
     * patches, que sorteava celula a celula entre os dois terrenos
     *
     * Com o ladrilho eles nunca chegam a ser lidos, e sobrariam como
     * campo morto no dado — a pior forma de confusao, porque parece
     * que ainda valem alguma coisa
     */
    expect(TREINO.terrainAlt).toBeUndefined();

    expect(TREINO.altBias).toBeUndefined();
  });
});