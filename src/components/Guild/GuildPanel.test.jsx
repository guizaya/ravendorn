import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GuildPanel from "./GuildPanel.jsx";
import { EMPTY_GUILD_SNAPSHOT } from "../../game/guild/GuildStore.js";
import { GUILD_CRIACAO_CUSTO } from "../../data/guild/index.js";

/**
 * O PAINEL de guilda.
 *
 * Este arquivo existe por causa de um defeito que nao tem teste nenhum
 * pegaria: o painel recebia o SNAPSHOT e o tratava como se fosse a
 * GUILDA. Como o snapshot vem sempre preenchido, mesmo para quem nao tem
 * guilda, `Boolean(guilda)` era sempre verdadeiro e a aba Membros
 * recebia um objeto sem `membros` — `Cannot read properties of undefined
 * (reading 'map')`, na hora de abrir o painel
 *
 * O que este arquivo segura:
 *
 * 1. **a forma.** `snapshot.guilda.guilda` e a entidade; `pontos`,
 *    `arvore` e `cofre` ficam no snapshot. Sao dois niveis com nomes
 *    iguais, e trocar um pelo outro quebrava a tela
 * 2. **a aba "Criar".** E a que um jogador sem guilda mais precisa, e
 *    era justamente a que sumia
 * 3. **os `?? []`.** A lista de membros e a de pedidos vem do servidor e
 *    nao pode derrubar o painel se vier incompleta
 */

/**
 * O `cleanup` e GLOBAL, e nao de um `describe` so.
 *
 * Com ele so no primeiro bloco, as abas de talento e de busca
 * achavam duas copias de cada aba montada — a do teste anterior ainda
 * no DOM — e `getByRole` reclamava de elemento duplicado
 */
afterEach(() => {
  cleanup();
});

/**
 * Um talento de amostra.
 *
 * Vive no topo porque tres blocos do arquivo precisam dele: o da aba de
 * talentos e o das abas que abrem. Cada bloco com a sua copia faria
 * divergirem sem ninguem perceber
 */
const NODES = [
  {
    id: "mao_leve",
    nome: "Mao Leve",
    custo: 1,
    tier: 1,
    exige: null,
    descricao: "+3 de ataque",
    destravado: false,
    disponivel: true,
  },
];

/** um snapshot como o servidor manda, com a guilda dentro */
function comGuilda(extra = {}) {  return {
    guilda: {
      id: "g_0",
      nome: "Lobos Famintos",
      tag: "LMAO",
      membros: [
        {
          id: "ana",
          nome: "Ana",
          papel: "lider",
          eu: true,
        },
      ],
      membrosMax: 40,
      pedidos: [],
    },
    ehLider: true,
    ehDiretoria: true,
    pontos: 0,
    pontosMax: 24,
    cofre: null,
    arvore: [],
    ...extra,
  };
}

describe("o painel de guilda", () => {
  it("abre na aba Criar quando o jogador nao tem guilda", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    // sem guilda, o snapshot AINDA e um objeto com `guilda: null`
    expect(screen.getByRole("tab", { name: "Criar" })).toBeTruthy();
  });

  /**
   * As DUAS abas de guilda nao existem para quem nao tem guilda.
   *
   * Apareciam, e Membros abria em "Voce nao tem guilda ainda" — uma
   * tela inteira para dizer o que o jogador ja sabe. Quem esta sem
   * guilda ve so o que o ajuda a conseguir uma
   */
  it("sem guilda, as abas de Membros e Talentos nao aparecem", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    expect(screen.queryByRole("tab", { name: "Membros" })).toBe(null);
    expect(screen.queryByRole("tab", { name: "Talentos" })).toBe(null);
  });

  it("com guilda, as abas de guilda aparecem e a de Criar some", () => {
    render(<GuildPanel guilda={comGuilda()} />);

    expect(screen.getByRole("tab", { name: "Membros" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Talentos" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Criar" })).toBe(null);
  });

  it("o X fecha o painel", () => {
    const onClose = vi.fn();

    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /✕/ }));

    expect(onClose).toHaveBeenCalled();
  });

  it("nao estoura ao abrir Membros sem guilda", () => {
    // o defeito original: `guilda.membros` era `undefined`
    expect(() =>
      render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />),
    ).not.toThrow();
  });

  it("a aba Criar some depois que a guilda existe", () => {
    render(<GuildPanel guilda={comGuilda()} />);

    expect(screen.queryByRole("tab", { name: "Criar" })).toBe(null);
  });

  it("a identidade da guilda aparece dentro do corpo", () => {
    render(<GuildPanel guilda={comGuilda()} />);

    // e `[LMAO] Lobos Famintos`, e nao `[undefined] undefined`
    expect(screen.getByText(/LMAO/)).toBeTruthy();
    expect(screen.getByText(/Lobos Famintos/)).toBeTruthy();
  });

  it("lista os membros com o papel de cada um", async () => {
    render(<GuildPanel guilda={comGuilda()} />);

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Lider")).toBeTruthy();
  });

  it("so a diretoria ve os pedidos, e a lista volta vazia sem quebrar", () => {
    render(
      <GuildPanel guilda={comGuilda({ pedidos: undefined })} />,
    );

    // sem `pedidos` no servidor, a aba mostra o estado vazio em vez de
    // estourar no `.map`
    expect(screen.getByText("Nenhum pedido esperando.")).toBeTruthy();
  });

  it("o membro comum recebe o texto de que nao ve pedidos", () => {
    render(
      <GuildPanel guilda={comGuilda({ ehDiretoria: false })} />,
    );

    expect(screen.getByText("So a diretoria ve os pedidos.")).toBeTruthy();
  });

  it("o snapshot inteiro continua aceito, mesmo sem `guilda`", () => {
    expect(() => render(<GuildPanel guilda={null} />)).not.toThrow();
  });
});

describe("a aba de talentos", () => {
  it("mostra o saldo de pontos e a arvore", async () => {
    render(<GuildPanel guilda={comGuilda({ arvore: NODES, pontos: 2 })} />);

    fireEvent.click(screen.getByRole("tab", { name: "Talentos" }));

    expect(screen.getByText("Mao Leve")).toBeTruthy();
    expect(screen.getByText("+3 de ataque")).toBeTruthy();

    /**
     * O saldo vem em pedacos: `<strong>2</strong> de 24 pontos`. O
     * `getByText` nao acha a frase inteira, e comparar so o numero
     * seria frouxo demais — "2" tambem aparece no custo do talento
     */
    const saldo = document.querySelector(".gld-pontos");

    expect(saldo.querySelector("strong").textContent).toBe("2");
    expect(saldo.textContent).toContain("de 24 pontos");
  });

  it("pede o talento com o id do no", async () => {
    const onTalent = vi.fn();

    render(
      <GuildPanel
        guilda={comGuilda({ arvore: NODES, pontos: 2 })}
        onTalent={onTalent}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Talentos" }));

    fireEvent.click(screen.getByRole("button", { name: "Destravar" }));

    expect(onTalent).toHaveBeenCalledWith("mao_leve");
  });

  it("nao deixa gastar ponto que o jogador nao tem", async () => {
    render(
      <GuildPanel guilda={comGuilda({ arvore: NODES, pontos: 0 })} />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Talentos" }));

    const botao = screen.getByRole("button", { name: "Destravar" });

    expect(botao.hasAttribute("disabled")).toBe(true);
  });
});

describe("a aba de busca", () => {
  const busca = [
    {
      id: "g_1",
      nome: "Corvos Negros",
      tag: "CRV",
      membros: 7,
      membrosMax: 40,
      cheia: false,
    },
  ];

  it("lista o resultado e manda o id ao pedir", async () => {
    const onPedir = vi.fn();

    render(
      <GuildPanel guilda={comGuilda({ busca })} onPedir={onPedir} />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));

    expect(screen.getByText("Corvos Negros")).toBeTruthy();
    expect(screen.getByText("[CRV]")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pedir" }));

    expect(onPedir).toHaveBeenCalledWith("g_1");
  });

  it("marca a propria guilda em vez de deixar pedir nela", async () => {
    // `g_0` e a propria guilda do `comGuilda`: e o que faz `jaSou`
    render(
      <GuildPanel
        guilda={comGuilda({ busca: [{ ...busca[0], id: "g_0" }] })}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));

    expect(screen.getByText("sua")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pedir" })).toBe(null);
  });

  it("nao estoura quando o jogador ainda nao buscou", async () => {
    render(<GuildPanel guilda={comGuilda()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));

    // `busca` ausente e o estado normal do primeiro clique
    expect(screen.getByRole("button", { name: "Procurar" })).toBeTruthy();
  });
});

describe("todas as abas abrem", () => {
  /**
   * O que distingue ESTE painel dos outros.
   *
   * Aqui a lista de abas depende do estado do jogador, e a aba
   * mostrada dependia da lista. Foi essa dependencia que travou a aba
   * de Buscar: sem guilda, o `atual` era forcado para "criar" e o
   * clique na Busca nao mudava nada
   *
   * O teste clica em CADA aba, nos DOIS estados, e olha o corpo do
   * painel. Clicar e nao ter assertado nada passaria com a aba travada
   */
  const CORPO = () => document.querySelector(".gld-panel__body");

  it("sem guilda, Buscar abre o campo de busca", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));

    expect(screen.getByLabelText("Nome ou tag")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Procurar" })).toBeTruthy();
    expect(CORPO().textContent).not.toContain("Nome da guilda");
  });

  it("sem guilda, Criar abre o formulario", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    fireEvent.click(screen.getByRole("tab", { name: "Criar" }));

    expect(screen.getByLabelText("Nome da guilda")).toBeTruthy();
  });

  it("sem guilda, da para voltar de Buscar para Criar", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));
    fireEvent.click(screen.getByRole("tab", { name: "Criar" }));

    expect(screen.getByLabelText("Nome da guilda")).toBeTruthy();
  });

  it("sem guilda, da para voltar de Criar para Buscar", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    fireEvent.click(screen.getByRole("tab", { name: "Criar" }));
    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));

    expect(screen.getByLabelText("Nome ou tag")).toBeTruthy();
  });

  it("com guilda, Membros abre a lista", () => {
    render(<GuildPanel guilda={comGuilda()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Membros" }));

    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("com guilda, Talentos abre a arvore", () => {
    render(<GuildPanel guilda={comGuilda({ arvore: NODES })} />);

    fireEvent.click(screen.getByRole("tab", { name: "Talentos" }));

    expect(screen.getByText("Mao Leve")).toBeTruthy();
  });

  it("com guilda, Buscar tambem abre", () => {
    render(<GuildPanel guilda={comGuilda()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));

    expect(screen.getByLabelText("Nome ou tag")).toBeTruthy();
  });

  it("com guilda, percorre as tres sem travar", () => {
    render(<GuildPanel guilda={comGuilda({ arvore: NODES })} />);

    for (const aba of ["Talentos", "Buscar", "Membros"]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));

      expect(
        CORPO().textContent.trim().length,
        `a aba ${aba} abriu vazia`,
      ).toBeGreaterThan(0);
    }
  });

  it("so uma aba fica marcada por vez", () => {
    render(<GuildPanel guilda={comGuilda()} />);

    for (const aba of ["Talentos", "Buscar", "Membros"]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));

      const ativas = document.querySelectorAll(
        ".inv-tab.is-active",
      );

      expect(
        ativas.length,
        `${ativas.length} abas marcadas depois de clicar em ${aba}`,
      ).toBe(1);

      expect(ativas[0].textContent).toContain(aba);
    }
  });

  /**
   * Criar a guilda some da barra enquanto o jogador esta nela.
   *
   * Sem a correcao, o corpo ficaria vazio: a aba escolhida nao existe
   * mais, e nenhuma outra estaria marcada. Ele cai em Membros, que e o
   * que o jogador quer ver logo apos funder
   */
  it("criar a guilda leva de Criar para Membros, e nao deixa o corpo vazio", () => {
    const { rerender } = render(
      <GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Criar" }));

    rerender(<GuildPanel guilda={comGuilda()} />);

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(CORPO().textContent.trim().length).toBeGreaterThan(0);
  });

  /**
   * Sair da guilda tem o mesmo problema pelo outro lado: as abas de
   * guilda somem e a escolhida deixa de existir
   */
  it("sair da guilda leva de Membros para Buscar", () => {
    const { rerender } = render(<GuildPanel guilda={comGuilda()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Membros" }));

    rerender(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} />);

    expect(screen.getByLabelText("Nome ou tag")).toBeTruthy();
    expect(CORPO().textContent.trim().length).toBeGreaterThan(0);
  });
});

describe("a aba de criar, e a taxa", () => {
  /** o estado inicial do jogador sem guilda e sem dinheiro */
  const semGrana = () => (
    <GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} moedas={0} />
  );

  it("o campo aceita o que o jogador digita", () => {
    render(semGrana());

    const campo = screen.getByLabelText("Nome da guilda");

    /**
     * O defeito que o jogador viu: clicar no campo e nao digitar.
     *
     * Nao era o `onChange` — o input ja era controlado. Era o
     * `pointer-events: none` do `.hud`, que so e reativado em
     * `.hud button`: o painel vinha sem a casca `inv-panel`, e a
     * `input` ficava com o clique atravessando direto para o jogo. O
     * campo de verdade precisaria de `fireEvent.change`, que nao
     * respeita ponteiro — entao o teste pegaria o `setNome` quebrado e
     * nao o problema de clique
     */
    fireEvent.change(campo, { target: { value: "Lobos" } });

    expect(campo.value).toBe("Lobos");
  });

  it("mostra o preco da taxa", () => {
    render(semGrana());

    expect(screen.getByText("10")).toBeTruthy();
  });

  it("diz quanto falta quando o jogador nao tem o dinheiro", () => {
    render(<GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} moedas={4} />);

    // o jogador tem 4 e precisa de 10
    expect(screen.getByText(/Faltam 6/)).toBeTruthy();
  });

  it("trava o botao sem o dinheiro da taxa", () => {
    render(semGrana());

    // e travado JA sem digitar nome e tag, porque o preco e o que
    // impede — nao a falta de texto
    expect(
      screen.getByRole("button", { name: /Criar guilda/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("libera o botao com o dinheiro e o nome preenchido", () => {
    render(
      <GuildPanel guilda={EMPTY_GUILD_SNAPSHOT} moedas={GUILD_CRIACAO_CUSTO} />,
    );

    fireEvent.change(screen.getByLabelText("Nome da guilda"), {
      target: { value: "Lobos" },
    });

    fireEvent.change(screen.getByLabelText("Tag"), {
      target: { value: "LMAO" },
    });

    expect(
      screen.getByRole("button", { name: /Criar guilda/ })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("manda nome e tag ao criar", () => {
    const onCriar = vi.fn();

    render(
      <GuildPanel
        guilda={EMPTY_GUILD_SNAPSHOT}
        moedas={GUILD_CRIACAO_CUSTO}
        onCriar={onCriar}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome da guilda"), {
      target: { value: "Lobos" },
    });

    fireEvent.change(screen.getByLabelText("Tag"), {
      target: { value: "LMAO" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Criar guilda/ }));

    expect(onCriar).toHaveBeenCalledWith("Lobos", "LMAO");
  });
});
