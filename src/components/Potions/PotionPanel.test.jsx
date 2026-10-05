import { describe, expect, it, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import PotionPanel from "./PotionPanel.jsx";
import {
  POCAO_MAX_POR_COMPRA,
  precoPocao,
} from "../../data/potions/index.js";
import { getItem } from "../../data/items/index.js";

/**
 * A LOJA DE POCOES, na tela.
 *
 * O que este arquivo segura e o que o painel FAZ COM O QUE O
 * SERVIDOR DISSE, e nao a compra em si. A compra e medida em
 * `server/test/pocaoRede.test.js`, de ponta a ponta, porque quem cobra
 * e o servidor
 *
 * Os tres defeitos que estes testes pegam, e que nenhum teste de rede
 * pegaria:
 *
 * 1. **o painel mostra o preco do CATALOGO.** O servidor cobra o preco
 *    dele; se a tela mostrasse outro, o jogador veria um numero e
 *    pagaria outro
 * 2. **o botao desliga quando o saldo nao alcanca.** E conveniencia,
 *    nao seguranca — mas sem isso o jogador clica num botao morto e
 *    nao entende por que nada acontece
 * 3. **um saldo desconhecido NAO e saldo zero.** O primeiro pacote de
 *    rede chega um instante depois do primeiro quadro, e tratar
 *    "ainda nao sei" como "tenho zero" desligaria o botao da loja
 *    inteira no primeiro quadro
 */

afterEach(cleanup);

/**
 * O clique, dentro de `act`.
 *
 * O `.click()` puro dispara o evento mas nao deixa o React aplicar o
 * estado. A quantidade mora em `useState` dentro do painel, entao sem o
 * `act` o botao de "x5" clicaria, o estado nao mudaria, e o teste
 * mediria a tela errada — um teste que diria que a loja esta quebrada
 * quando o quebrado e o teste
 */
const clicar = (alvo) => {
  act(() => {
    alvo.click();
  });
};

const botaoComprar = () =>
  document.querySelector(".pocao-comprar");

/** o botao de quantidade pedido: o primeiro e 1, o segundo e o teto */
const botaoQtd = (n) =>
  document.querySelectorAll(".pocao-qtd__btn")[n];

const POCAO = getItem("pocao_cura");

describe("a loja de pocoes", () => {
  it("mostra a pocao a venda", () => {
    render(<PotionPanel coins={500} onBuy={() => {}} onClose={() => {}} />);

    expect(screen.getByText(POCAO.name)).toBeTruthy();
  });

  it("mostra o preco do catalogo", () => {
    /**
     * O `precoPocao` e nao um numero escrito aqui.
     *
     * Se o catalogo mudar o preco e o painel continuar mostrando 50, o
     * jogador veria um preco e pagaria outro — e nenhum teste de rede
     * falharia, porque o servidor estaria cobrando o preco certo. E o
     * erro mais caro desta feature, e o mais invisivel
     */
    render(<PotionPanel coins={500} onBuy={() => {}} onClose={() => {}} />);

    expect(document.querySelector(".pocao-linha__preco").textContent)
      .toBe(`${precoPocao("pocao_cura") * 1}`);
  });

  it("mostra o saldo do jogador", () => {
    render(<PotionPanel coins={321} onBuy={() => {}} onClose={() => {}} />);

    expect(document.querySelector(".pocao-tab__coins").textContent)
      .toBe("321");
  });

  it("compra mandando o id e a quantidade", () => {
    const pedidos = [];

    render(
      <PotionPanel
        coins={500}
        onBuy={(id, count) => pedidos.push({ id, count })}
        onClose={() => {}}
      />,
    );

    clicar(botaoComprar());

    /**
     * O `id`, e nao o item inteiro.
     *
     * O painel manda o que o servidor precisa saber: qual item e
     * quantos. Mandar o objeto inteiro daria ao servidor uma
     * descricao do item que ele proprio tem, e que poderia estar
     * adulterada
     */
    expect(pedidos).toEqual([
      { id: POCAO.id, count: 1 },
    ]);
  });

  it("fecha pelo botao", () => {
    let fechou = false;

    render(
      <PotionPanel
        coins={500}
        onBuy={() => {}}
        onClose={() => { fechou = true; }}
      />,
    );

    clicar(document.querySelector(".inv-close"));

    expect(fechou).toBe(true);
  });
});

describe("o botao e o saldo", () => {
  it("fica ligado com moedas", () => {
    render(<PotionPanel coins={500} onBuy={() => {}} onClose={() => {}} />);

    expect(botaoComprar().disabled).toBe(false);
  });

  it("desliga quando o saldo nao alcanca", () => {
    render(<PotionPanel coins={10} onBuy={() => {}} onClose={() => {}} />);

    expect(botaoComprar().disabled).toBe(true);
    expect(botaoComprar().textContent).toContain("Sem moedas");
  });

  it("desliga no multiplo quando o saldo so paga uma", () => {
    /**
     * O botao olha o TOTAL, e nao o preco unitario.
     *
     * Com x5 selecionado e saldo de 100 numa pocao de 50, o botao
     * tem de estar desligado: o jogador nao tem 250. Um `disabled`
     * calculado sobre o preco unitario deixaria o botao ligado e o
     * jogador descobriria o saldo so depois do clique
     */
    render(<PotionPanel coins={100} onBuy={() => {}} onClose={() => {}} />);

    clicar(botaoQtd(1));

    expect(botaoComprar().disabled).toBe(true);
  });

  it("FICA LIGADO com o saldo desconhecido", () => {
    /**
     * `null` e "ainda nao chegou", e nao "tenho zero".
     *
     * Tratar como zero desligaria a loja inteira no primeiro quadro, e
     * o jogador veria um painel com o botao cinza e nenhum motivo. O
     * servidor recusa o saldo insuficiente de qualquer jeito, entao o
     * `disabled` aqui e so conveniencia: e melhor um clique que volta
     * com recusa do que um botao morto sem explicacao
     */
    render(<PotionPanel coins={null} onBuy={() => {}} onClose={() => {}} />);

    expect(botaoComprar().disabled).toBe(false);

    expect(document.querySelector(".pocao-tab__coins").textContent)
      .toBe("—");
  });
});

describe("a quantidade", () => {
  it("comeca em uma", () => {
    const pedidos = [];

    render(
      <PotionPanel
        coins={10_000}
        onBuy={(id, count) => pedidos.push(count)}
        onClose={() => {}}
      />,
    );

    clicar(botaoComprar());

    expect(pedidos).toEqual([1]);
  });

  it("manda o lote quando o jogador escolhe", () => {
    const pedidos = [];

    render(
      <PotionPanel
        coins={10_000}
        onBuy={(id, count) => pedidos.push(count)}
        onClose={() => {}}
      />,
    );

    clicar(botaoQtd(1));

    clicar(botaoComprar());

    expect(pedidos).toEqual([POCAO_MAX_POR_COMPRA]);
  });

  it("muda o preco mostrado para o total do lote", () => {
    render(<PotionPanel coins={10_000} onBuy={() => {}} onClose={() => {}} />);

    const preco = precoPocao("pocao_cura");

    expect(document.querySelector(".pocao-linha__preco").textContent)
      .toBe(`${preco}`);

    clicar(botaoQtd(1));

    /**
     * O TOTAL, e o que o jogador vai pagar.
     *
     * Mostrar o preco unitario com o lote selecionado daria um numero
     * que o servidor nunca vai cobrar — e o jogador que contaria a
     * diferenca, clicando duas vezes
     */
    expect(document.querySelector(".pocao-linha__preco").textContent)
      .toBe(`${preco * POCAO_MAX_POR_COMPRA}`);
  });

  it("so oferece 1 e o teto da loja", () => {
    render(<PotionPanel coins={10_000} onBuy={() => {}} onClose={() => {}} />);

    const botoes = [...document.querySelectorAll(".pocao-qtd__btn")];

    expect(botoes.map((b) => b.textContent)).toEqual([
      "×1",
      `×${POCAO_MAX_POR_COMPRA}`,
    ]);
  });
});

describe("o catalogo que a tela mostra", () => {
  it("a linha mostra a arte do item, e nao o glifo", () => {
    render(<PotionPanel coins={500} onBuy={() => {}} onClose={() => {}} />);

    /**
     * A pocao tem arte nas cinco raridades.
     *
     * Com o glifo, o icone da linha cairia no texto `"!"` do catalogo e
     * o jogador veria um ponto de exclamacao no lugar do frasco. O
     * `item-icon--glyph` e a classe que marca exatamente esse caso
     */
    expect(document.querySelector(".pocao-linha__art .item-icon img"))
      .toBeTruthy();

    expect(
      document.querySelector(".pocao-linha__art .item-icon--glyph"),
    ).toBe(null);
  });

  it("a linha mostra a descricao do catalogo da loja", () => {
    render(<PotionPanel coins={500} onBuy={() => {}} onClose={() => {}} />);

    expect(
      document.querySelector(".pocao-linha__desc").textContent,
    ).toContain("120");
  });
});