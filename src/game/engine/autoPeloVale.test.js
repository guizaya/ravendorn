import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { createPlayerSession } from "./PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import {
  MAP_1,
  MAP_1_ZONES,
  getZoneById,
} from "../../data/maps/index.js";
import { BESTIARY } from "../../data/bestiary/index.js";
import { MAIN_QUESTS } from "../../data/quests/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

/**
 * OS TRES AUTOMATICOS ATRAVESSANDO O VALE
 *
 * ## O QUE ESTE ARQUIVO SEGURA
 *
 * O vale tem duas fileiras de arbustos que FECHAM o mapa em tres faixas,
 * e um vao em cada pontas: o do sul e o oeste, o do norte e o leste.
 * Uma zona de cima so se alcança descendo pelo leste; uma de baixo, so
 * subindo pelo oeste
 *
 * Sao exatamente esses tres pedidos que dependem disso:
 *
 * - **seguir o lider da party** — o destino e a posicao de uma pessoa,
 *   e a pessoa pode estar na faixa de cima;
 * - **o automatico da missao** — o destino e o centro de uma zona, e a
 *   primeira missao da campanha aponta para o Pantano, que e a ultima
 *   faixa do mapa;
 * - **o "ir matar" do bestiario** — o mesmo caminho, com outra zona
 *
 * ## O QUE O TESTE MEDE
 *
 * Tres coisas, e as tres sao o defeito:
 *
 * 1. **CHEGA** — o boneco entra na zona, em tempo finito
 * 2. **NAO TRAVA** — nenhum quadro passa sem movimento por tres
 *    segundos seguidos, que e o que o motor usa para declarar travamento
 * 3. **PASSA POR DENTRO DO VALE** — o boneco atravessou a faixa em que
 *    estava, o que so acontece pelo vao: nao ha como chegar do outro
 *    lado sem ele
 *
 * A terceira e a que pega o caminho que "anda em cima do arbusto": um
 * caminho que atravessa a fileira chega do outro lado tambem — mas
 * batendo nela o tempo todo, e o travamento e o que o denuncia
 */

const CLASSE = CHARACTER_CLASSES.find((c) => c.id === "warrior");

/** Um tique grosso: o vale e grande, e a contagem de quadros e o preco */
const PASSO = 1 / 30;

/**
 * O TETO de quadros, e o tempo que ele representa.
 *
 * A viagem mais longa deste arquivo — do nascimento, no meio do vale,
 * ate uma zona da outra ponta — e de uns 6.500px a 165px/s, o que sao
 * 40 segundos. O teto e o dobro, para sobrar margem e ainda assim
 * reprovar quando o piloto para
 */
const TETO = 2_500;

/**
 * As FAIXAS do vale, e o vao que liga uma na outra.
 *
 * A fileira do sul e a do norte sao linhas de arbusto de 28px com 16px
 * de folga entre uma e outra, e o jogador e um circulo de 44px: nao ha
 * buraco. O unico caminho de uma faixa para a outra e a ponta da fileira
 * que sobra
 */
const FAIXAS = [
  { nome: "norte", yMax: 1_371 },
  { nome: "meio", yMin: 1_399, yMax: 2_733 },
  { nome: "sul", yMin: 2_761 },
];

const faixaDe = (y) =>
  FAIXAS.find((f) => y >= (f.yMin ?? -Infinity) && y <= (f.yMax ?? Infinity))
    ?.nome ?? "fora";

/** as zonas que NAO estao na faixa do nascimento */
const zonasDeOutraFaixa = () => {
  const doNascimento = faixaDe(MAP_1.spawn.y);

  return MAP_1_ZONES.filter(
    (zona) =>
      faixaDe(zona.y + zona.height / 2) !== doNascimento &&
      faixaDe(zona.y + zona.height / 2) !== "fora",
  );
};

/** um motor no vale, com o boneco no nascimento */
function criarNoVale() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    CLASSE,
    () => {},
    { playerId: "p_Ana", characterName: "Ana" },
  );

  engine.setMap(MAP_1);

  const jogador = engine.world.player;

  jogador.x = MAP_1.spawn.x;
  jogador.y = MAP_1.spawn.y;

  return { engine, jogador };
}

/**
 * Roda o auto ate a condicao valer, e mede o TRAVAMENTO pelo caminho.
 *
 * O travamento e medido em POSICAO e nao em "o motor pediu para andar":
 * durante a caminhada o piloto pode querer andar e nao andar. O que
 * conta e o boneco having andado
 *
 * Um bloco sem movimento de 1s ja e registrado, porque tres segundos e o
 * limite que faz o motor declarar travamento e replanejar
 */
function rodar(engine, jogador, condicao) {
  let travadoDesde = 0;

  let piorTravamento = 0;

  let ultimoX = jogador.x;
  let ultimoY = jogador.y;

  let quadro = 0;

  for (; quadro < TETO; quadro += 1) {
    engine.update(PASSO);

    if (condicao()) return { chegou: true, quadro, piorTravamento };

    const andou = Math.hypot(
      jogador.x - ultimoX,
      jogador.y - ultimoY,
    );

    if (andou < 4) {
      travadoDesde += PASSO;

      if (travadoDesde > piorTravamento) {
        piorTravamento = travadoDesde;
      }
    } else {
      travadoDesde = 0;
    }

    ultimoX = jogador.x;
    ultimoY = jogador.y;
  }

  return { chegou: false, quadro, piorTravamento };
}

const dentroDaZona = (jogador, zona) =>
  jogador.x >= zona.x &&
  jogador.x <= zona.x + zona.width &&
  jogador.y >= zona.y &&
  jogador.y <= zona.y + zona.height;

describe("os tres autos atravessando o vale", () => {
  it("o automatico da MISSAO chega na zona do outro lado do vao", () => {
    const { engine, jogador } = criarNoVale();

    /**
     * A MISSAO e escolhida pelo CATALOGO, e nao por id chumbado.
     *
     * Os ids sao gerados (`map1_main_<n>_<curto>_<zona>`), entao um id
     * fixo neste arquivo envelheceria junto com o catalogo — e o teste
     * passaria a medir "o id existe" em vez de "o piloto atravessa"
     */
    const missao = MAIN_QUESTS.find((q) => {
      const zona = getZoneById(q.location);

      return (
        zona &&
        zonasDeOutraFaixa().some((outra) => outra.id === zona.id)
      );
    });

    expect(missao, "nenhuma missao principal aponta para outra faixa")
      .toBeTruthy();

    const zona = getZoneById(missao.location);

    expect(engine.focusQuest(missao.id)).toBe(true);

    const faixaDoNascimento = faixaDe(MAP_1.spawn.y);
    const faixaDaZona = faixaDe(zona.y + zona.height / 2);

    expect(faixaDaZona, "a zona esta na mesma faixa do nascimento")
      .not.toBe(faixaDoNascimento);

    const { chegou, quadro, piorTravamento } = rodar(
      engine,
      jogador,
      () => dentroDaZona(jogador, zona),
    );

    expect(
      chegou,
      `o boneco parou em (${Math.round(jogador.x)}, ` +
        `${Math.round(jogador.y)}), na faixa ` +
        `${faixaDe(jogador.y)}, fora de ${zona.id}`,
    ).toBe(true);

    expect(piorTravamento, "o piloto travou no caminho").toBeLessThan(3);

    void quadro;
  });

  it("o IR MATAR do bestiario chega na zona do outro lado do vao", () => {
    const { engine, jogador } = criarNoVale();

    const entrada = BESTIARY.find((item) =>
      zonasDeOutraFaixa().some((z) => z.id === item.zoneId),
    );

    expect(entrada, "nenhuma criatura do bestiario esta em outra faixa")
      .toBeTruthy();

    const zona = getZoneById(entrada.zoneId);

    expect(engine.setBestiaryAuto(entrada.creatureId)).toBe(true);

    const { chegou, piorTravamento } = rodar(engine, jogador, () =>
      dentroDaZona(jogador, zona),
    );

    expect(
      chegou,
      `o boneco parou em (${Math.round(jogador.x)}, ` +
        `${Math.round(jogador.y)}), fora de ${zona.id}`,
    ).toBe(true);

    expect(piorTravamento, "o piloto travou no caminho").toBeLessThan(3);
  });

  it("SEGUIR o lider atravessa o vao e chega do lado", () => {
    const { engine, jogador } = criarNoVale();

    const sessao = createPlayerSession(CLASSE, {
      id: "p_Bento",
      name: "Bento",
    });

    engine.addPlayer(sessao);

    /**
     * O LIDER na outra ponta do vale.
     *
     * E o caso que o pedido de "seguir" promete: o destino do
     * acompanhamento e a posicao de uma PESSOA, e nao um ponto fixo. Um
     * lider na mesma faixa nao exigiria o vao, e o teste passaria sem
     * exercitar o caminho
     */
    const bento = engine.world.players.get("p_Bento").player;

    const alvo = zonasDeOutraFaixa().at(-1);

    bento.x = alvo.x + alvo.width / 2;
    bento.y = alvo.y + alvo.height / 2;

    expect(
      faixaDe(bento.y),
      "o lider precisa estar em outra faixa",
    ).not.toBe(faixaDe(MAP_1.spawn.y));

    engine.seguirJogador("p_Bento");

    /**
     * O RAIO DE CHEGADA do acompanhamento.
     *
     * E o `TRAVEL_CHEGADA` mais o raio do seguido: o pedido e "chegar
     * do lado", e o lado e a borda do outro personagem, nao o meio dele
     */
    const chegouDoLado = () =>
      Math.hypot(bento.x - jogador.x, bento.y - jogador.y) <= 24 + 22;

    const { chegou, piorTravamento } = rodar(engine, jogador, chegouDoLado);

    expect(
      chegou,
      `o boneco parou a ` +
        `${Math.round(
          Math.hypot(bento.x - jogador.x, bento.y - jogador.y),
        )}px do lider`,
    ).toBe(true);

    expect(piorTravamento, "o seguidor travou no caminho").toBeLessThan(3);
  });
});