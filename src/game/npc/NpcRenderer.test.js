import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NpcRenderer } from "./NpcRenderer.js";
import {
  BASE_NPCS,
  NPC_ACAO,
  NPC_TYPES,
  getNpcType,
} from "../../data/npc/index.js";
import { NPC_SHEETS } from "../../data/npc/sheets.js";
import { BASE_MAP } from "../../data/maps/base.js";

/**
 * O NPC DO HUB.
 *
 * O que este arquivo segura e o CONTRATO pedido, e nao a arte:
 *
 * 1. **a posicao.** (710, 377), o pe do NPC — nao o centro
 * 2. **o que o clique abre.** A loja de pocoes, e nao combate
 * 3. **a escala e a ancora.** O desenho e de 520x597 e nao cabe no
 *    calcamento do hub sem encolher; e o `pe` tem de ficar no `y`, senao
 *    o mercador flutua
 * 4. **a arte existe.** A pasta tem um arquivo so, e ele tem o
 *    tamanho que o catalogo declara — uma constante crida aqui seria
 *    um numero inventado
 */

/** o PNG do disco, medido pelo cabecalho */
function tamanhoNoDisco(url) {
  const caminho = fileURLToPath(new URL(url.replace(/.*assets/, "../../assets"), import.meta.url));

  const buffer = readFileSync(caminho);

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("o catalogo de NPCs", () => {
  it("o mercador abre a loja de pocoes", () => {
    /**
     * A LOJA, e nao o mercado entre jogadores.
     *
     * `NPC_ACAO.MERCADO` nao existe mais. Ele apontava para o mercado
     * entre jogadores, que e de oferta e proposta, e o mercador da base
     * nao tem oferta nenhuma: o clique caia num painel de mercado
     * vazio
     */
    expect(NPC_ACAO.POCOES).toBe("pocoes");
    expect(NPC_TYPES.mercador.acao).toBe(NPC_ACAO.POCOES);
  });

  it("o mercador barra passagem", () => {
    // sem isto o boneco atravessa a barraca e o NPC vira adesivo
    expect(NPC_TYPES.mercador.blocking).toBe(true);
  });

  it("getNpcType devolve o tipo, e null para o que nao existe", () => {
    expect(getNpcType("mercador")).toBe(NPC_TYPES.mercador);
    expect(getNpcType("inexistente")).toBe(null);
  });

  it("o catalogo declara o tamanho que a arte tem", () => {
    const noDisco = tamanhoNoDisco(NPC_SHEETS.mercador);

    expect(noDisco.width).toBe(NPC_TYPES.mercador.naturalWidth);
    expect(noDisco.height).toBe(NPC_TYPES.mercador.naturalHeight);
  });
});

describe("o mercador do hub", () => {
  it("esta em (710, 377)", () => {
    expect(BASE_NPCS).toHaveLength(1);

    const [mercador] = BASE_NPCS;

    expect(mercador.x).toBe(710);
    expect(mercador.y).toBe(377);
    expect(mercador.typeId).toBe("mercador");
  });

  it("esta dentro do mapa base", () => {
    const [mercador] = BASE_NPCS;

    expect(mercador.x).toBeGreaterThan(BASE_MAP.bounds.x);
    expect(mercador.y).toBeGreaterThan(BASE_MAP.bounds.y);
    expect(mercador.x).toBeLessThan(
      BASE_MAP.bounds.x + BASE_MAP.bounds.width,
    );
    expect(mercador.y).toBeLessThan(
      BASE_MAP.bounds.y + BASE_MAP.bounds.height,
    );
  });

  it("o mapa base o declara, e nao em props", () => {
    expect(BASE_MAP.npcs).toBe(BASE_NPCS);

    /**
     * Nao em `props`, e a diferenca que faz o clique funcionar.
     *
     * Uma prop e enfeite: nao reage a clique. Se o mercador estivesse
     * em `props` ele apareceria igual e o clique passaria direto por
     * ele, e o jogador veria o NPC sem nenhum painel
     */
    const emProps = (BASE_MAP.props ?? []).some(
      (prop) => prop.id === BASE_NPCS[0].id,
    );

    expect(emProps, "o NPC entrou como prop").toBe(false);
  });

  it("o hub nao tem mob nenhum, e o NPC nao virou inimigo", () => {
    expect(BASE_MAP.zones).toHaveLength(0);
  });
});

describe("o desenho do NPC", () => {
  const npc = { ...BASE_NPCS[0], ...NPC_TYPES.mercador };

  it("o PE fica em (x, y)", () => {
    const renderer = new NpcRenderer();
    const box = renderer.boxOf(npc);

    /**
     * A arte e ancorada pelo PE, e nao pelo centro.
     *
     * Com 597px de altura e escala 0.34 o NPC tem 203px. Ancorado pelo
     * centro, a barraca tocaria o chao 100px acima do `y` do dado, e o
     * mercador apareceria flutuando sobre o calcamento
     */
    expect(box.y + box.height).toBe(npc.y);
    expect(box.x + box.width / 2).toBe(npc.x);
  });

  it("o NPC tem o tamanho de um personagem, e nao de um obstaculo", () => {
    const renderer = new NpcRenderer();
    const { height, width } = renderer.sizeOf(npc);

    /**
     * 119px de altura, contra 203 da primeira versao.
     *
     * O jogador tem 128px. Um NPC do tamanho do jogador le como
     * alguem; um de 203px ocupava uma fatia do calcamento que nao
     * parece parte de um hub — e a camera do hub, que ja e 1.4286 mais
     * perto, faz a arte parecer ainda maior em tela
     */
    expect(height).toBeCloseTo(119, 0);
    expect(height).toBeLessThan(128);
    expect(width).toBeCloseTo(104, 0);
  });

  it("a escala e um quarto da arte, e nao um numero solto", () => {
    // 0.2 sobre 597px. Se a escala mudar, o NPC volta a ser grande
    // demais ou pequeno demais sem que nenhum teste reclame
    expect(NPC_TYPES.mercador.scale).toBe(0.2);
  });

  it("a pegada e uma fatia de baixo, e nao a arte inteira", () => {
    const renderer = new NpcRenderer();
    const arte = renderer.boxOf(npc);
    const pegada = renderer.blockBoxOf(npc);

    /**
     * Um solido de 203px pararia o jogador no AR.
     *
     * A pegada e os 42% de baixo: e a barraca e os pes. O tronco e a
     * cabeca ficam de fora, e o boneco passa por tras deles
     */
    expect(pegada.height).toBeLessThan(arte.height);
    expect(pegada.height / arte.height).toBeCloseTo(0.42, 2);
    expect(pegada.y + pegada.height).toBe(npc.y);
  });

  it("o clique pega o NPC dentro da arte", () => {
    const renderer = new NpcRenderer();
    const box = renderer.boxOf(npc);

    // no meio da barraca
    expect(
      renderer.pickAt([npc], { x: npc.x, y: npc.y - 20 }),
      "o clique na barra nao pegou o NPC",
    ).toBe(npc);

    // na cabeca, que esta dentro da caixa da arte
    expect(
      renderer.pickAt([npc], {
        x: npc.x,
        y: box.y + 20,
      }),
      "o clique na cabeca nao pegou o NPC",
    ).toBe(npc);
  });

  it("o clique no chao ao lado nao pega", () => {
    const renderer = new NpcRenderer();
    const box = renderer.boxOf(npc);

    expect(
      renderer.pickAt([npc], { x: box.x - 20, y: npc.y }),
      "o clique no calcamento pegou o NPC",
    ).toBe(null);
  });

  it("quando dois NPCs se sobrepoem, vale o de frente", () => {
    const renderer = new NpcRenderer();
    const atras = { ...npc, id: "atras", y: npc.y - 40 };
    const frente = { ...npc, id: "frente", y: npc.y + 40 };

    /**
     * O de MAIOR `y` esta mais embaixo, e e o que esta na frente.
     *
     * E o mesmo criterio da ordenacao de desenho: o que o jogador ve
     * por cima. Sem isso o clique pegaria o NPC de tras, que esta
     * escondido
     */
    const pego = renderer.pickAt([atras, frente], {
      x: npc.x,
      y: npc.y,
    });

    expect(pego?.id).toBe("frente");
  });

  it("a lista vazia nao pega nada", () => {
    const renderer = new NpcRenderer();

    expect(renderer.pickAt([], { x: 0, y: 0 })).toBe(null);
    expect(renderer.pickAt(null, { x: 0, y: 0 })).toBe(null);
  });

  it("o recorte da camera tira quem esta fora da tela", () => {
    const renderer = new NpcRenderer();

    const longe = { ...npc, x: npc.x + 5000 };

    const visiveis = renderer.collectVisible([npc, longe], {
      x: npc.x - 100,
      y: npc.y - 300,
      width: 800,
      height: 600,
    });

    expect(visiveis.map((n) => n.id)).toEqual([npc.id]);
  });
});
