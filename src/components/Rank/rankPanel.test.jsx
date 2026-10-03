import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RankPanel from "./RankPanel.jsx";

/**
 * O painel nao ordena: a lista chega pronta do servidor. Estes
 * testes montam a lista na ordem em que o SERVIDOR mandaria, e
 * verificam se a tela respeita essa ordem, troca de criterio e
 * destaca o jogador.
 */
function entrada({
  id,
  name,
  nivel,
  xp,
  cacadas,
  abates,
  posicao,
  medalha,
}) {
  return { id, name, nivel, xp, cacadas, abates, posicao, medalha };
}

const ana = entrada({
  id: "p1",
  name: "Ana",
  nivel: 9,
  xp: 0,
  cacadas: 1,
  abates: 4,
  posicao: 1,
  medalha: "🥇",
});

const bia = entrada({
  id: "p2",
  name: "Bia",
  nivel: 3,
  xp: 90,
  cacadas: 6,
  abates: 20,
  posicao: 2,
  medalha: "🥈",
});

const cid = entrada({
  id: "p3",
  name: "Cid",
  nivel: 1,
  xp: 0,
  cacadas: 0,
  abates: 0,
  posicao: 3,
  medalha: "🥉",
});

const rank = {
  nivel: [ana, bia, cid],
  bestiario: [bia, ana, cid],
};

afterEach(cleanup);

/**
 * O `user-event` nao esta instalado no projeto, e os outros testes
 * de componente usam o mesmo caminho: `act` em volta de um
 * `.click()` nativo.
 */
const clicar = async (alvo) => {
  await act(async () => {
    alvo.click();
  });
};

const aba = (nome) =>
  screen
    .getAllByRole("tab")
    .find((botao) =>
      botao.textContent.toLowerCase().includes(nome),
    );

const nomesVisiveis = () =>
  screen.getAllByRole("listitem").map(nomeDaLinha);

/**
 * O nome sozinho, sem a badge "voce".
 *
 * A badge e um elemento dentro do `strong`, e nao texto colado: e o
 * mesmo desenho das badges de item do inventario. Ler
 * `textContent` inteiro daria "Cidvoce" e o teste passaria a
 * depender de um espaco que nao existe.
 */
function nomeDaLinha(li) {
  const forte = li.querySelector(".rnk-row__name");

  return forte.childNodes[0].textContent.trim();
}

const badgeDaLinha = (li) =>
  li.querySelector(".rnk-row__you")?.textContent ?? null;

describe("RankPanel", () => {
  it("abre na aba de nivel e mostra a lista na ordem do servidor", () => {
    render(<RankPanel rank={rank} meuId="p3" onClose={() => {}} />);

    expect(nomesVisiveis()).toEqual(["Ana", "Bia", "Cid"]);
  });

  it("troca para o bestiario e respeita a outra ordem", async () => {
    render(<RankPanel rank={rank} meuId="p3" onClose={() => {}} />);

    await clicar(aba("bestiario"));

    // A ordem e a de cacadas: a Bia subiu mesmo sendo nivel 3, e a
    // Ana desceu mesmo sendo nivel 9. E a prova de que a tela nao
    // esta reordenando por conta propria. O "voce" e o Cid (`p3`),
    // que e quem esta olhando a lista, e nao a lider.
    expect(nomesVisiveis()).toEqual(["Bia", "Ana", "Cid"]);
  });

  it("marca a aba ativa e destaca o jogador na lista", () => {
    const { container } = render(
      <RankPanel rank={rank} meuId="p1" onClose={() => {}} />,
    );

    const [abaNivel, abaBestiario] = screen.getAllByRole("tab");

    expect(abaNivel.getAttribute("aria-selected")).toBe("true");
    expect(abaBestiario.getAttribute("aria-selected")).toBe("false");

    const minha = container.querySelector(".rnk-row.is-you");

    expect(nomeDaLinha(minha)).toBe("Ana");
    expect(badgeDaLinha(minha)).toBe("voce");

    // e so uma linha recebe a badge: as outras duas ficam neutras
    expect(
      container.querySelectorAll(".rnk-row.is-you"),
    ).toHaveLength(1);
  });

  it("mostra o numero do criterio de cada aba", async () => {
    const { container } = render(
      <RankPanel rank={rank} meuId="p1" onClose={() => {}} />,
    );

    // O rotulo do numero esta no `title`, e nao em texto solto: o
    // "12" sozinho nao diz se e cacada ou XP, e repetir o rotulo em
    // cada linha da um painel talkingudo. O title responde no hover.
    const valor = () =>
      container.querySelector(".rnk-row__value");

    expect(valor().getAttribute("title")).toBe("0 xp no nivel 9");
    expect(valor().textContent).toBe("0");

    await clicar(aba("bestiario"));

    // na aba de bestiario a primeira linha e a Bia, com 6 cacadas:
    // e a mesma lista trocando de ordem, nao outra lista
    expect(valor().getAttribute("title")).toBe("6 cacadas");
    expect(valor().textContent).toBe("6");
  });

  it("conta quantas pessoas estao conectadas", () => {
    render(<RankPanel rank={rank} meuId="p1" onClose={() => {}} />);

    expect(screen.getByText("3 conectados")).toBeTruthy();
  });

  it("fecha pelo botao", async () => {
    let fechou = false;

    render(
      <RankPanel
        rank={rank}
        meuId="p1"
        onClose={() => {
          fechou = true;
        }}
      />,
    );

    await clicar(screen.getByTitle("Fechar (R)"));

    expect(fechou).toBe(true);
  });

  it("avisa quando ninguem esta conectado, em vez de renderizar vazio", () => {
    render(
      <RankPanel
        rank={{ nivel: [], bestiario: [] }}
        meuId="p1"
        onClose={() => {}}
      />,
    );

    // o mesmo texto e a mesma classe do inventario: e o estado
    // vazio padrao das janelas do jogo
    const vazio = document.querySelector(".inv-panel__empty");

    expect(vazio.textContent).toBe("Nenhum jogador conectado");
  });

  it("sobrevive a um painel sem rank, que e o estado antes do primeiro pacote", () => {
    render(<RankPanel meuId="p1" onClose={() => {}} />);

    expect(aba("nivel")).toBeTruthy();
  });
});
