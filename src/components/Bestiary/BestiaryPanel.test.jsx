import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BestiaryPanel from "./BestiaryPanel.jsx";
import { Bestiary } from "../../game/bestiary/Bestiary.js";
import { BESTIARY } from "../../data/bestiary/index.js";

function render(bestiary, props = {}) {
  return renderToStaticMarkup(
    <BestiaryPanel
      bestiary={bestiary}
      onHunt={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );
}

function snapshotWith(kills = {}) {
  const bestiary = new Bestiary();

  for (const [creatureId, amount] of Object.entries(kills)) {
    bestiary.onKill(creatureId, amount);
  }

  return bestiary.snapshot();
}

describe("BestiaryPanel", () => {
  it("abre com o placar de cacadas", () => {
    const html = render(snapshotWith());

    expect(html).toContain("Bestiario");
    expect(html).toContain("0/");
    expect(html).toContain("cacadas");
  });

  it("lista todas as criaturas do bestiario", () => {
    const html = render(snapshotWith());

    for (const entry of BESTIARY) {
      expect(html, entry.name).toContain(entry.name);
    }
  });

  it("mostra as tres cacadas de cada criatura", () => {
    const html = render(snapshotWith());

    expect(
      (html.match(/class="bst-hunt"/g) ?? []).length,
    ).toBe(BESTIARY.length * 3);
  });

  it("mostra o nivel e a zona de cada criatura", () => {
    const html = render(snapshotWith());

    expect(html).toContain("Nv.1");

    /**
     * O LIMO aparece no Pantano Profundo, o degrau mais facil.
     *
     * Este texto e o mesmo dado que o motor le quando o jogador clica
     * "ir matar", entao ele nao pode divergir do `Bestiary.test.js`.
     * A zona vem da de menor nivel medio, com o peso como desempate —
     * as quatro zonas de limo empatam em peso, entao so o nivel separa
     */
    expect(html).toContain("Pântano Profundo");

    /**
     * O ogre foi para a Cripta.
     *
     * O Vale das Cinzas era o lugar de maior peso dele (60) e virou o
     * quarto degrau de limo. As Cinzas continuam no painel, mas nao pelo
     * ogre — e este texto esta aqui para travar o nome certo, ja que as
     * duas zonas aparecem na tela
     */
    expect(html).toContain("Cripta Esquelética");
  });

  it("traduz o comportamento", () => {
    const html = render(snapshotWith());

    expect(html).toContain("Pacífico");
    expect(html).toContain("Agressivo");
  });

  it("conta os abates no progresso", () => {
    const html = render(snapshotWith({ slime: 3 }));

    expect(html).toContain("3/5");
  });

  it("marca a cacada concluida", () => {
    const html = render(snapshotWith({ slime: 5 }));

    expect(html).toContain("is-done");
  });

  it("mostra a recompensa de cada cacada", () => {
    const html = render(snapshotWith());

    expect(html).toContain("+12 Vida");
    expect(html).toContain("+5% Vel. Atq");
  });

  it("mostra o bonus acumulado no topo", () => {
    const html = render(snapshotWith({ slime: 5 }));

    expect(html).toContain("Bônus permanente");

    /**
     * O selo agora usa o rotulo do JOGO, e nao o rotulo curto do
     * bestiario.
     *
     * `maxHp` escrevia "VID" aqui e "HP" no painel de status, para o
     * mesmo numero: o jogador tinha de saber que VID era HP. O
     * `PermanentBonus` le o rotulo no `StatSheet`, e ai os dois
     * paineis falam a mesma língua
     */
    expect(html).toContain("HP");
    expect(html).toContain("+12");

    // e o selo e o mesmo componente da colecao, entao o bonus se le
    // igual nas duas telas
    expect(html).toContain("perm-bonus__chip");
  });

  it("convida a cacar quando nao ha bonus", () => {
    const html = render(snapshotWith());

    expect(html).toContain("Nenhuma cacada concluida");
  });

  it("conta o placar por criatura", () => {
    const html = render(snapshotWith({ slime: 15 }));

    expect(html).toContain("2/3");
  });

  it("avisa quando o bestiario fecha", () => {
    const all = {};

    for (const entry of BESTIARY) {
      all[entry.creatureId] = 999;
    }

    const html = render(snapshotWith(all));

    expect(html).toContain("Bestiario completo");
  });

  it("aguenta snapshot vazio", () => {
    const html = render(null);

    expect(html).toContain("Bestiario");
    expect(html).toContain("0/0");
    expect(html).toContain("Nenhuma cacada concluida");
  });
});

describe("BestiaryPanel botao de cacar", () => {
  it("oferece ir matar em todas as criaturas", () => {
    const html = render(snapshotWith());

    const buttons = html.match(/bst-entry__go/g) ?? [];

    expect(buttons).toHaveLength(BESTIARY.length);
    expect(html).toContain("Ir matar");
  });

  it("nomeia a zona de destino no title", () => {
    const html = render(snapshotWith());

    for (const entry of BESTIARY) {
      expect(entry.zoneName, entry.id).toBeTruthy();
      expect(html, entry.name).toContain(entry.zoneName);
    }
  });

  it("nao habilita o botao de criatura sem zona", () => {
    const data = snapshotWith();

    const entry = data.entries[0];

    const html = render({
      ...data,
      entries: [{ ...entry, zoneId: null }],
    });

    expect(html).toContain("bst-entry__go");
    expect(html).toContain("disabled");
    expect(html).toContain("não tem zona conhecida");
  });

  it("vira parar na criatura que esta sendo cacada", () => {
    const html = render(snapshotWith(), {
      hunting: "slime",
    });

    expect(html).toContain("Parar");
    expect(html).toContain("Parar de caçar");
    expect(html).toContain("is-hunting");
  });

  it("mantem ir matar nas outras criaturas", () => {
    const html = render(snapshotWith(), {
      hunting: "slime",
    });

    expect(html).toContain("Ir matar");
    expect(html.match(/is-hunting/g) ?? []).toHaveLength(1);
  });

  it("aguenta snapshot sem hunts", () => {
    const html = render({
      entries: [],
      completed: 0,
      total: 0,
      isComplete: false,
      bonuses: {},
      bonusesLabel: "",
    });

    expect(html).toContain("Bestiario");
    expect(html).not.toContain("bst-entry__go");
  });
});
