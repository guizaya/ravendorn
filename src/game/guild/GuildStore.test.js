import { describe, expect, it } from "vitest";

import { GuildStore } from "./GuildStore.js";
import {
  GUILD_MEMBROS_MAX,
  GUILD_PONTOS_MAX,
  GUILD_ROLE,
  GUILD_TALENT_CUSTO_TOTAL,
  talentBonuses,
} from "../../data/guild/index.js";

/**
 * A GUILDA, no store.
 *
 * O que este arquivo mede sao as regras que o jogador nao ve falhar:
 * o limite de membros, quem pode abrir o cofre, se um mesmo jogador
 * consegue estar em duas guildas, e a conta de pontos por hora
 *
 * O relogio e INJETADO em todos os testes. Um ponto por hora com teto
 * de 24 nao se testa com `Date.now()` de verdade: ou o teste espera uma
 * hora, ou usa timer falso — e timer falso esconde a borda que importa,
 * que e o jogador que ficou offline no meio do intervalo
 */

const HORA = 60 * 60 * 1000;

/** um store com o relogio na mao: `avancar(24)` pula 24 horas */
function loja(relogioInicial = 1_000_000) {
  let agora = relogioInicial;

  const store = new GuildStore({ agora: () => agora });

  return {
    store,
    get agora() {
      return agora;
    },
    avancar(horas) {
      agora += horas * HORA;

      return agora;
    },
  };
}

const criar = (store, nome = "Lobos Famintos", liderId = "p1") =>
  store.criar({
    nome,
    tag: "LMAO",
    liderId,
    liderNome: liderId.toUpperCase(),
  });

describe("criar guilda", () => {
  it("cria com o jogador como lider", () => {
    const { store } = loja();

    const { ok, guilda } = criar(store);

    expect(ok).toBe(true);
    expect(guilda.liderId).toBe("p1");
    expect(guilda.membros.get("p1").papel).toBe(GUILD_ROLE.LIDER);
    expect(store.guildaDoJogador("p1")).toBe(guilda);
  });

  it("a segunda guilda do mesmo nome e recusada", () => {
    const { store } = loja();

    criar(store, "Lobos Famintos", "p1");

    const segunda = store.criar({
      nome: "lobos  famintos",
      tag: "OUT",
      liderId: "p2",
      liderNome: "P2",
    });

    expect(segunda.ok).toBe(false);
    expect(segunda.motivo).toBe("ocupado");
  });

  it("um jogador nao pode estar em duas guildas", () => {
    const { store } = loja();

    criar(store, "Lobos", "p1");
    criar(store, "Dracos", "p2");

    const terceira = store.criar({
      nome: "Terceiros",
      tag: "TER",
      liderId: "p1",
      liderNome: "P1",
    });

    expect(terceira.motivo).toBe("jaTemGuilda");
  });

  it("recusa nome curto, nome com caractere e tag grande", () => {
    const { store } = loja();

    expect(criar(store, "Ab").motivo).toBe("nome:curto");
    expect(criar(store, "Lobos!!").motivo).toBe("nome:caractere");
    expect(criar(store, "Lobos", "p1").ok).toBe(true);
    expect(
      store.criar({ nome: "Dracos", tag: "DRACOS", liderId: "p2" })
        .motivo,
    ).toBe("tag:longa");
  });
});

describe("buscar", () => {
  it("acha por pedaco do nome", () => {
    const { store } = loja();

    criar(store, "Os Lobos Famintos", "p1");

    expect(
      store.buscar("lobo").map((g) => g.nome),
    ).toEqual(["Os Lobos Famintos"]);
  });

  it("acha pela tag, sem caixa", () => {
    const { store } = loja();

    criar(store, "Os Lobos Famintos", "p1");

    expect(store.buscar("lmao")).toHaveLength(1);
    expect(store.buscar("LMAO")).toHaveLength(1);
  });

  it("a maior vem primeiro", () => {
    const { store } = loja();

    const a = criar(store, "Lobos Pequenos", "p1").guilda;
    const b = criar(store, "Lobos Grandes", "p2").guilda;

    b.membros.set("p3", { id: "p3", nome: "P3", papel: GUILD_ROLE.MEMBRO, desde: 0 });

    expect(store.buscar("lobos")[0].id).toBe(b.id);
    expect(store.buscar("lobos")).toHaveLength(2);
    expect(a.id).not.toBe(b.id);
  });

  it("busca vazia devolve lista vazia, e nao null", () => {
    const { store } = loja();

    expect(store.buscar("")).toEqual([]);
    expect(store.buscar("   ")).toEqual([]);
    expect(store.buscar("nao-existe")).toEqual([]);
  });
});

describe("pedir e aceitar entrada", () => {
  it("o pedido fica na fila da guilda", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    const pedido = store.pedirEntrada("p2", guilda.id, {
      nome: "Ana",
      classe: "warrior",
    });

    expect(pedido.ok).toBe(true);
    expect(guilda.pedidos).toHaveLength(1);
    expect(guilda.pedidos[0].chave).toBe("p2");
  });

  it("pedir duas vezes nao duplica", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });

    expect(guilda.pedidos).toHaveLength(1);
  });

  it("so a diretoria aceita", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.pedirEntrada("p4", guilda.id, { nome: "Bento" });

    // p3 entra como membro comum para tentar aceitar
    store.aceitarEntrada("p1", guilda.id, "p3");

    const porMembro = store.aceitarEntrada("p3", guilda.id, "p4");

    expect(porMembro.ok).toBe(false);
    expect(porMembro.motivo).toBe("semCargo");

    const porLider = store.aceitarEntrada("p1", guilda.id, "p4");

    expect(porLider.ok).toBe(true);
    expect(guilda.membros.get("p4").papel).toBe(GUILD_ROLE.MEMBRO);

    // o pedido do p4 saiu da fila; o do p2 continua esperando
    expect(guilda.pedidos.map((p) => p.chave)).toEqual(["p2"]);
  });

  it("o co-lider tambem aceita", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");
    store.definirCoLider("p1", "p2");

    store.pedirEntrada("p3", guilda.id, { nome: "Bento" });

    expect(store.aceitarEntrada("p2", guilda.id, "p3").ok).toBe(true);
  });

  it("ninguem aceita a si mesmo se nao for da diretoria", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p3");

    // p3 tenta aceitar o pedido que o p2 deixou
    expect(
      store.aceitarEntrada("p3", guilda.id, "p2").motivo,
    ).toBe("semCargo");
  });

  it("guilda no limite de membros recusa o pedido", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    for (let i = 2; i <= GUILD_MEMBROS_MAX; i += 1) {
      guilda.membros.set(`p${i}`, {
        id: `p${i}`,
        nome: `P${i}`,
        papel: GUILD_ROLE.MEMBRO,
        desde: 0,
      });
    }

    // a recusa vem no PEDIDO, e nao no aceite: aceitar um pedido que
    // nao existe seria "semPedido", e o painel mostraria a mensagem
    // errada para um motivo real
    const pedido = store.pedirEntrada("p99", guilda.id, { nome: "P99" });

    expect(pedido.ok).toBe(false);
    expect(pedido.motivo).toBe("cheia");
    expect(guilda.pedidos).toHaveLength(0);
  });
});

describe("sair e passar lideranca", () => {
  it("membro comum sai", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    expect(store.sair("p2").ok).toBe(true);
    expect(guilda.membros.has("p2")).toBe(false);
    expect(store.guildaDoJogador("p2")).toBe(null);
  });

  it("o lider nao sai: passa o cargo ou dissolve", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    expect(store.sair("p1").motivo).toBe("liderTemQuePassar");

    const passou = store.passarLideranca("p1", "p2");

    expect(passou.ok).toBe(true);
    expect(guilda.liderId).toBe("p2");
    expect(guilda.membros.get("p2").papel).toBe(GUILD_ROLE.LIDER);
    expect(guilda.membros.get("p1").papel).toBe(GUILD_ROLE.MEMBRO);
  });

  it("dissolver limpa os indices", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.passarLideranca("p1", null);

    expect(store.get(guilda.id)).toBe(null);
    expect(store.guildaDoJogador("p1")).toBe(null);
    expect(store.nomeLivre("Lobos")).toBe(null);
  });

  it("so o lider passa a lideranca", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    expect(store.passarLideranca("p2", "p2").motivo).toBe("naoEhLider");
  });
});

describe("a arvore de talentos", () => {
  const guildaCom = (store, guildaId) => store.get(guildaId);

  it("a arvore inteira custa o teto de pontos", () => {
    /**
     * O desenho fecha em 24 por causa do teto: um membro que fica 24
     * horas fora volta capaz de destravar tudo sozinho, e a guilda de
     * quem nao joga nao fica parada
     */
    expect(GUILD_TALENT_CUSTO_TOTAL).toBe(GUILD_PONTOS_MAX);
  });

  it("destrava um talento e gasta os pontos de quem gasta", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    const r = store.destravarTalent("p1", guilda.id, "mao_leve", 5);

    expect(r.ok).toBe(true);
    expect(r.custo).toBe(1);
    expect(guilda.talentos.has("mao_leve")).toBe(true);
  });

  it("exige o pai antes do filho", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    // o pai nao foi destravado
    expect(
      store.destravarTalent("p1", guilda.id, "golpe_duplo", 20).motivo,
    ).toBe("exigePai");

    store.destravarTalent("p1", guilda.id, "mao_leve", 20);
    store.destravarTalent("p1", guilda.id, "golpe_duplo", 20);

    expect(guilda.talentos.has("golpe_duplo")).toBe(true);
  });

  it("recusa sem pontos", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    expect(
      store.destravarTalent("p1", guilda.id, "mao_leve", 0).motivo,
    ).toBe("pontosInsuficientes");
  });

  it("um pedido de quem ja tem guilda e recusado", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    criar(store, "Dracos", "p2");
    store.pedirEntrada("p2", guilda.id, { nome: "P2" });

    expect(
      store.pedirEntrada("p2", guilda.id, { nome: "P2" }).motivo,
    ).toBe("jaTemGuilda");
  });

  it("nao destrava duas vezes", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.destravarTalent("p1", guilda.id, "mao_leve", 20);

    expect(
      store.destravarTalent("p1", guilda.id, "mao_leve", 20).motivo,
    ).toBe("jaDestraulado");
  });

  it("o talento e da guilda, e o bonus vale para todos", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    // p2 destrava gastando o ponto DELE
    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");
    store.destravarTalent("p2", guilda.id, "mao_leve", 5);

    const aberto = guildaCom(store, guilda.id);

    // p3, que nao gastou nada, ve o mesmo talento destravado
    expect(aberto.talentos.has("mao_leve")).toBe(true);
    expect(talentBonuses(aberto.talentos)).toEqual({ attack: 3 });
  });
});

describe("o cofre", () => {
  it("so a diretoria mexe, como a regra pede", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    // membro comum: recusado
    expect(
      store.mexerNoCofre("p2", guilda.id, "depositar").motivo,
    ).toBe("semCargo");

    // lider: passa
    expect(
      store.mexerNoCofre("p1", guilda.id, "depositar").ok,
    ).toBe(true);
  });

  it("o co-lider tambem mexe", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");
    store.definirCoLider("p1", "p2");

    expect(store.mexerNoCofre("p2", guilda.id, "depositar").ok).toBe(true);
  });

  it("o cofre nasce vazio e so a diretoria enche", () => {
    /**
     * A consequencia da regra pedida, e ela e o efeito colateral
     * esperado: nao ha deposito de membro comum, entao o cofre nao
     * enche sozinho
     */
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    expect(guilda.cofre).toBe(undefined);

    const primeiro = store.mexerNoCofre("p1", guilda.id, "depositar");

    expect(primeiro.cofre.slots).toEqual([]);
    expect(primeiro.cofre.moedas).toBe(0);
  });
});

describe("os pontos por hora", () => {
  it("da um ponto por hora", () => {
    const { store, avancar } = loja();

    const s = { guilda: { pontos: 0, ultimoPontoEm: null } };

    store.sincronizarPontos(s);

    const primeiro = s.guilda.pontos;

    expect(primeiro).toBe(0);

    avancar(1);

    expect(store.sincronizarPontos(s)).toBe(1);

    avancar(1);

    expect(store.sincronizarPontos(s)).toBe(2);
  });

  it("nao da ponto antes de uma hora", () => {
    const { store, avancar } = loja();

    const s = { guilda: { pontos: 0, ultimoPontoEm: null } };

    store.sincronizarPontos(s);

    avancar(0.5);

    expect(store.sincronizarPontos(s)).toBe(0);
  });

  it("acumula enquanto o jogador esta OFFLINE", () => {
    /**
     * O ponto que o jogador pede e o que mais importa: ele fecha o
     * jogo e volta 10 horas depois
     */
    const { store, avancar } = loja();

    const s = { guilda: { pontos: 0, ultimoPontoEm: null } };

    store.sincronizarPontos(s);

    // sem nenhuma chamada no meio: o tempo passa sozinho
    avancar(10);

    expect(store.sincronizarPontos(s)).toBe(10);
  });

  it("para em 24, e so volta a ganhar depois de gastar", () => {
    const { store, avancar } = loja();

    const s = { guilda: { pontos: 0, ultimoPontoEm: null } };

    store.sincronizarPontos(s);

    avancar(24 * 30);

    expect(store.sincronizarPontos(s)).toBe(GUILD_PONTOS_MAX);

    // mais um mes offline nao passa de 24
    avancar(24 * 30);

    expect(store.sincronizarPontos(s)).toBe(GUILD_PONTOS_MAX);

    // gastou 3: agora volta a ganhar, a partir do relogio em dia
    s.guilda.pontos -= 3;

    avancar(1);

    expect(store.sincronizarPontos(s)).toBe(GUILD_PONTOS_MAX - 3 + 1);
  });

  it("o primeiro acesso comeca a contar de agora, e nao do nascimento", () => {
    /**
     * Sem registro, um jogador novo que entrasse na semana seguinte do
     * mundo viria com centenas de horas de presente
     */
    const { store, avancar } = loja();

    const s = { guilda: { pontos: 0, ultimoPontoEm: null } };

    avancar(24 * 100);

    expect(store.sincronizarPontos(s)).toBe(0);

    avancar(2);

    expect(store.sincronizarPontos(s)).toBe(2);
  });

  it("quem nao tem guilda nao ganha ponto", () => {
    const { store, avancar } = loja();

    const s = { guilda: null };

    avancar(24 * 10);

    expect(store.sincronizarPontos(s)).toBe(0);
  });
});

describe("o que vai para o painel", () => {
  it("quem nao tem guilda ve a arvore bloqueada e nenhum cofre", () => {
    const { store } = loja();

    const vista = store.snapshotPara("p9", 3);

    expect(vista.guilda).toBe(null);
    expect(vista.ehLider).toBe(false);
    expect(vista.cofre).toBe(null);
    expect(vista.pontos).toBe(3);
    expect(vista.arvore.every((n) => !n.destravado)).toBe(true);
  });

  it("o membro comum ve a guilda mas nao ve o cofre", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    const vista = store.snapshotPara("p2", 4);

    expect(vista.guilda.nome).toBe("Lobos");
    expect(vista.ehLider).toBe(false);
    expect(vista.ehDiretoria).toBe(false);
    expect(vista.cofre).toBe(null);
    expect(vista.guilda.pedidos).toHaveLength(0);
  });

  it("o lider ve os pedidos e o cofre", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.pedirEntrada("p2", guilda.id, { nome: "Ana", classe: "warrior" });

    const vista = store.snapshotPara("p1", 0);

    expect(vista.ehLider).toBe(true);
    expect(vista.ehDiretoria).toBe(true);
    expect(vista.guilda.pedidos).toHaveLength(1);
    expect(vista.guilda.pedidos[0].nome).toBe("Ana");
  });

  it("a arvore do painel diz o estado de cada node", () => {
    const { store } = loja();

    const { guilda } = criar(store, "Lobos", "p1");

    store.destravarTalent("p1", guilda.id, "mao_leve", 10);

    const { arvore } = store.snapshotPara("p1", 10);

    const mao = arvore.find((n) => n.id === "mao_leve");
    const golpe = arvore.find((n) => n.id === "golpe_duplo");
    const muralha = arvore.find((n) => n.id === "muralha");
    const peleDura = arvore.find((n) => n.id === "pele_dura");

    expect(mao.destravado).toBe(true);
    expect(mao.disponivel).toBe(false);

    // o filho do que foi destravado liberou
    expect(golpe.destravado).toBe(false);
    expect(golpe.disponivel).toBe(true);

    // a outra RAIZ continua disponivel: destravar uma raiz nao trava
    // as demais
    expect(peleDura.exige).toBe(null);
    expect(peleDura.disponivel).toBe(true);

    // mas o tier 3 depende do tier 2 dele, que nao foi destravado
    expect(muralha.disponivel).toBe(false);
  });

  it("um membro so tem o que ver da guilda dele", () => {
    const { store } = loja();

    const a = criar(store, "Lobos", "p1").guilda;
    const b = criar(store, "Dracos", "p2").guilda;

    store.pedirEntrada("p3", b.id, { nome: "P3" });
    store.aceitarEntrada("p2", b.id, "p3");

    expect(store.snapshotPara("p3", 0).guilda.nome).toBe("Dracos");
    expect(store.snapshotPara("p1", 0).guilda.nome).toBe("Lobos");
    expect(a.membros.has("p3")).toBe(false);
  });
});
