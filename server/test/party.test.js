import { describe, expect, it } from "vitest";
import { PartyStore, PARTY_INVITE_TTL } from "../src/domain/PartyStore.js";

/**
 * A PARTY.
 *
 * ## O QUE FICA SENDO TESTADO AQUI
 *
 * A composicao do grupo: quem entra, quem fica de fora, quantos cabem, e
 * o prazo do convite. A DIVISAO DE LOOT e do motor, e esta em
 * `partyLoot.test.js`
 *
 * ## POR QUE O RELOGIO E INJETADO
 *
 * O prazo de 5 segundos nao pode ser testado esperando 5 segundos. O
 * `agora` e uma funcao, entao o teste anda com ela — e e o mesmo caminho
 * que o `GuildStore` usa para os pontos por hora
 */
function mundoCom(nomes) {
  const players = new Map();

  nomes.forEach((nome, i) => {
    players.set(`p_${nome}`, {
      id: `p_${nome}`,
      name: nome,
      classId: "warrior",
      player: { hp: 100, maxHp: 100 },
    });
  });

  return { players };
}

/**
 * O RELOGIO DO TESTE.
 *
 * O objeto `relogio` e o que guarda o tempo, e e ele que vai para a
 * store. A primeira versao devolvia `{ agora, avanca }` e a store lia
 * `relogio.t` de um objeto que nao tinha `t` — o prazo virava
 * `undefined` e a expiry nunca disparava, e o teste "passado o prazo"
 * passava com `ok: true` sem que ninguem olhasse
 */
function relogioDe(t = 1000) {
  return {
    t,
    avanca(segundos) {
      this.t += segundos * 1000;
    },
  };
}

/** A store com o relogio do teste ligado. */
function PartyStoreComRelogio(relogio) {
  return new PartyStore({ agora: () => relogio.t });
}

describe("a party e montada", () => {
  it("o convite cria a party quando o convidado aceita", () => {
    const t = relogioDe();
    const store = PartyStoreComRelogio(t);
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);

    expect(store.convitePendente("p_Bento")).toBeTruthy();
    expect(store.partyDe("p_Ana")).toBe(null);
    expect(store.partyDe("p_Bento")).toBe(null);

    const resultado = store.aceitarConvite("p_Bento", world);

    expect(resultado.ok).toBe(true);

    // os dois na MESMA party
    expect(store.partyDe("p_Ana")?.id).toBe(resultado.party.id);
    expect(store.partyDe("p_Bento")?.id).toBe(resultado.party.id);
  });

  it("quem aceitou some da fila de convites", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    // o proximo convite e que pode entrar na tela
    expect(store.convitePendente("p_Bento")).toBe(null);
  });

  it("o convite por nome acha o jogador", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "bento"]);

    // caixa diferente e minuscula: o digitado pelo jogador nao bate
    // com o nome salvo em byte a byte
    const resultado = store.convidarPorNome("p_Ana", "BENTO", world);

    expect(resultado.ok).toBe(true);
    expect(store.convitePendente("p_bento")).toBeTruthy();
  });

  it("o convite por nome falha com jogador desconhecido", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana"]);

    const resultado = store.convidarPorNome("p_Ana", "Fantasma", world);

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("não encontrado");
  });
});

describe("o limite de tres", () => {
  it("a quarta pessoa nao entra", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora", "Dani"]);

    // Ana convida e aceita com cada um, um de cada vez
    for (const nome of ["Bento", "Cora", "Dani"]) {
      store.convidar("p_Ana", world.players.get(`p_${nome}`), world);
      store.aceitarConvite(`p_${nome}`, world);
    }

    expect(store.membrosDe("p_Ana")).toHaveLength(3);
  });

  it("convidar para uma party cheia e recusado", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora", "Dani"]);

    for (const nome of ["Bento", "Cora"]) {
      store.convidar("p_Ana", world.players.get(`p_${nome}`), world);
      store.aceitarConvite(`p_${nome}`, world);
    }

    // Dani e o quarto
    const resultado = store.convidar(
      "p_Ana",
      world.players.get("p_Dani"),
      world,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("cheia");
  });
});

describe("os 5 segundos do convite", () => {
  it("dentro do prazo, o aceite passa", () => {
    const t = relogioDe();
    const store = PartyStoreComRelogio(t);
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);

    t.avanca(PARTY_INVITE_TTL - 1);

    expect(store.aceitarConvite("p_Bento", world).ok).toBe(true);
  });

  it("passado o prazo, o aceite e recusado", () => {
    const t = relogioDe();
    const store = PartyStoreComRelogio(t);
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);

    t.avanca(PARTY_INVITE_TTL + 1);

    const resultado = store.aceitarConvite("p_Bento", world);

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("expirou");

    // e ninguem entrou na party
    expect(store.partyDe("p_Bento")).toBe(null);
  });

  it("o tick tira o convite da fila", () => {
    const t = relogioDe();
    const store = PartyStoreComRelogio(t);
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);

    expect(store.convitePendente("p_Bento")).toBeTruthy();

    t.avanca(PARTY_INVITE_TTL + 1);

    const expirados = store.tick(world);

    expect(expirados).toHaveLength(1);
    expect(expirados[0].sessionId).toBe("p_Bento");
    expect(store.convitePendente("p_Bento")).toBe(null);
  });

  it("um convite por vez: o segundo espera o primeiro sair", () => {
    const t = relogioDe();
    const store = PartyStoreComRelogio(t);
    const world = mundoCom(["Ana", "Cora", "Bento"]);

    // Cora convida Bento, e depois Ana convida o mesmo Bento
    store.convidar("p_Cora", world.players.get("p_Bento"), world);

    t.avanca(1);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);

    /**
     * NA TELA esta o ultimo, e o da Ana.
     *
     * Com dois convites de uma vez o jogador teria de escolher qual
     * fechar em 5 segundos. O pedido foi o contrario: o que esta na tela
     * tem os 5 segundos dele, e o proximo so depois
     */
    expect(store.convitePendente("p_Bento").de).toBe("p_Ana");
  });
});

describe("sair da party", () => {
  it("quem sai deixa de estar na party", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    store.sair("p_Bento");

    expect(store.partyDe("p_Bento")).toBe(null);
    expect(store.membrosDe("p_Ana")).toEqual(["p_Ana"]);
  });

  it("o lider sai e o grupo NAO se dissolve", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    store.convidar("p_Ana", world.players.get("p_Cora"), world);
    store.aceitarConvite("p_Cora", world);

    const resultado = store.sair("p_Ana");

    expect(resultado.dissolvida).toBeFalsy();

    // Bento e Cora continuam juntos, e o lider passa para o Bento
    expect(store.membrosDe("p_Bento")).toEqual(["p_Bento", "p_Cora"]);
    expect(store.partyDe("p_Bento")?.id).toBe(store.partyDe("p_Cora")?.id);
  });

  it("o ultimo membro sai e a party some", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    // Ana saiu primeiro e o grupo sobreviveu com o Bento; agora e a vez
    // do Bento, que e o ultimo
    store.sair("p_Ana");

    const resultado = store.sair("p_Bento");

    expect(resultado.dissolvida).toBe(true);
    expect(store.partyDe("p_Bento")).toBe(null);
  });

  it("quem sai do jogo tambem sai da party", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    store.remover("p_Ana");

    expect(store.membrosDe("p_Bento")).toEqual(["p_Bento"]);
  });
});

describe("as regras que impedem o grupo se desfazer sozinho", () => {
  it("quem ja esta em party nao entra em outra", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora", "Dani"]);

    // party de Ana e Bento
    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    // Cora tenta trazer o Dani para a party DELA
    const resultado = store.convidar(
      "p_Cora",
      world.players.get("p_Dani"),
      world,
    );

    expect(resultado.ok).toBe(true);

    store.aceitarConvite("p_Dani", world);

    // Dani fica com Cora
    expect(store.partyDe("p_Dani")?.id).toBe(store.partyDe("p_Cora")?.id);

    // e Ana e Bento continuam juntos, intactos
    expect(store.partyDe("p_Ana")?.id).toBe(store.partyDe("p_Bento")?.id);
    expect(store.membrosDe("p_Ana")).toHaveLength(2);
  });

  it("convidar alguem que ja esta na MINHA party e recusado", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    const resultado = store.convidar(
      "p_Ana",
      world.players.get("p_Bento"),
      world,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("já está na party");
  });

  it("o convite por MESMA party leva o grupo inteiro", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    store.convidar("p_Ana", world.players.get("p_Cora"), world);

    expect(store.convitePendente("p_Cora")?.partyId).toBe(
      store.partyDe("p_Ana")?.id,
    );

    store.aceitarConvite("p_Cora", world);

    expect(store.membrosDe("p_Cora")).toHaveLength(3);
  });
});

describe("o caminho do botao [Criar party]", () => {
  it("criar uma party de um so NAO e um convite vazio", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana"]);

    /**
     * O QUE ESTAVA QUEBRADO.
     *
     * O botao mandava `PARTY_INVITE` com `alvoId: null`, e o servidor
     * procurava `pedido.alvoId` para achar a sessao — e devolvia
     * "Jogador nao encontrado". O jogador clicava em criar e ganhava um
     * erro, e o campo do nick nunca aparecia
     *
     * Sem estar numa party o jogador esta FORA dela, e a caixa mostra so
     * [Criar party]. Criar e o que troca esse estado
     */
    const resultado = store.criar("p_Ana");

    expect(resultado.ok).toBe(true);
    expect(resultado.party.membros.size).toBe(1);
    expect(store.membrosDe("p_Ana")).toEqual(["p_Ana"]);
  });

  it("depois de criar, a caixa tem UM membro e mostra o caminho de convidar", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    const antes = store.snapshot("p_Ana", world);

    // FORA de party: a lista vazia e o que faz a caixa mostrar criar
    expect(antes.membros).toEqual([]);

    store.criar("p_Ana");

    const depois = store.snapshot("p_Ana", world);

    // SOZINHA: um membro, e e esse estado que acende o campo do nick
    expect(depois.membros).toHaveLength(1);
    expect(depois.membros[0].eu).toBe(true);
    expect(depois.lider).toBe("p_Ana");
  });

  it("criar duas vezes nao faz uma segunda party", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.criar("p_Ana");

    const segunda = store.criar("p_Ana");

    expect(segunda.jaExistia).toBe(true);
    expect(store.membrosDe("p_Ana")).toHaveLength(1);
  });

  it("quem ja esta em party nao cria outra por cima", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    const antes = store.partyDe("p_Ana")?.id;

    store.criar("p_Ana");

    // a mesma party, nao um grupo paralelo com o jogador nos dois
    expect(store.partyDe("p_Ana")?.id).toBe(antes);
    expect(store.membrosDe("p_Ana")).toHaveLength(2);
  });
});

describe("o caminho do campo do nick", () => {
  it("o nick digitado acha o jogador e o convite chega", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "bento"]);

    store.criar("p_Ana");

    const resultado = store.convidarPorNome("p_Ana", "BENTO", world);

    expect(resultado.ok).toBe(true);

    // e o convidado ve a caixa de 5 segundos
    const caixa = store.snapshot("p_bento", world).convite;

    expect(caixa).toBeTruthy();
    expect(caixa.de.nome).toBe("Ana");
    expect(caixa.ttl).toBe(PARTY_INVITE_TTL);
  });

it("o aceite tira o jogador na party E fecha a caixa", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.criar("p_Ana");
    store.convidarPorNome("p_Ana", "Bento", world);

    const antes = store.snapshot("p_Bento", world).convite;

    expect(antes).toBeTruthy();

    const resultado = store.aceitarConvite("p_Bento", world);

    expect(resultado.ok).toBe(true);

    // entrou
    expect(store.membrosDe("p_Bento")).toHaveLength(2);

    // e a caixa de 5 segundos NAO continua na tela: sem isso o jogador
    // veria um convite ja cumprido e poderia clicar de novo
    expect(store.snapshot("p_Bento", world).convite).toBe(null);
  });

  it("a party chega em tres e o campo some por-capacity", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora", "Dani"]);

    store.criar("p_Ana");

    for (const nome of ["Bento", "Cora"]) {
      store.convidarPorNome("p_Ana", nome, world);
      store.aceitarConvite(`p_${nome}`, world);
    }

    const snap = store.snapshot("p_Ana", world);

    expect(snap.membros).toHaveLength(3);
    expect(snap.membros.length >= snap.max).toBe(true);

    // e o quarto nao entra
    const quarto = store.convidarPorNome("p_Ana", "Dani", world);

    expect(quarto.ok).toBe(false);
  });
});

describe("a expulsao", () => {
  /** Ana, Bento e Cora na MESMA party, com Ana na frente. */
  function trio() {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora"]);

    store.criar("p_Ana");
    store.convidarPorNome("p_Ana", "Bento", world);
    store.aceitarConvite("p_Bento", world);
    store.convidarPorNome("p_Ana", "Cora", world);
    store.aceitarConvite("p_Cora", world);

    return { store, world };
  }

  it("o lider tira um membro da party", () => {
    const { store } = trio();

    const resultado = store.expulsar("p_Ana", "p_Cora");

    expect(resultado.ok).toBe(true);
    expect(store.membrosDe("p_Ana")).toEqual(["p_Ana", "p_Bento"]);
    expect(store.partyDe("p_Cora")).toBe(null);
  });

  it("NENHUM membro alem do lider pode expulsar", () => {
    const { store } = trio();

    /**
     * O `alvoId` vem do cliente, entao a checagem tem de ser no store.
     * Bento expulsando Cora pareceria justo na tela dele — e o grupo
     * mudaria de dono na mao do jogador errado
     */
    const resultado = store.expulsar("p_Bento", "p_Cora");

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("líder");

    // ninguem saiu
    expect(store.membrosDe("p_Ana")).toHaveLength(3);
  });

  it("o lider nao pode se expulsar — ele usa sair", () => {
    const { store } = trio();

    const resultado = store.expulsar("p_Ana", "p_Ana");

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("sair");

    expect(store.membrosDe("p_Ana")).toHaveLength(3);
  });

  it("nao da para expulsar quem nao esta na party", () => {
    const { store, world } = trio();

    world.players.set("p_Dani", {
      id: "p_Dani",
      name: "Dani",
      classId: "warrior",
      player: { hp: 100, maxHp: 100 },
    });

    const resultado = store.expulsar("p_Ana", "p_Dani");

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("não está na party");
  });

  it("quem e expulso e avisado junto com quem ficou", () => {
    const { store } = trio();

    const resultado = store.expulsar("p_Ana", "p_Cora");

    /**
     * A LISTA E A MESMA PARA OS DOIS.
     *
     * Sem o aviso, o expulsado ficaria com uma party na tela que ele
     * ja nao esta — e o proximo painel nao viraria rapido o bastante
     */
    expect(resultado.avisar).toContain("p_Cora");
    expect(resultado.avisar).toContain("p_Ana");
    expect(resultado.avisar).toContain("p_Bento");
  });

  it("expulsar o ultimo socio NAO dissolve a party do lider", () => {
    const { store, world } = trio();

    store.expulsar("p_Ana", "p_Cora");
    store.expulsar("p_Ana", "p_Bento");

    // Ana e a lider e sobrou sozinha: o grupo continua, com uma caixa
    // de um membro e o botao de convidar
    expect(store.membrosDe("p_Ana")).toEqual(["p_Ana"]);
    expect(store.snapshot("p_Ana", world).convite).toBe(null);
  });
});

describe("o que a caixa da tela recebe", () => {
  it("quem nao tem party ve a lista vazia, e e o botao de criar", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    const snap = store.snapshot("p_Bento", world);

    /**
     * A LISTA VAZIA E O ESTADO "FORA DE PARTY".
     *
     * Estar sozinho nao e estar em party: a party nasce quando alguem
     * ACEITA um convite, e ate la a lista fica vazia e a caixa mostra o
     * botao de criar. Tratar "sozinho" como party de um membro faria o
     * jogador ver duas pessoas na caixa sendo que so existe ele
     */
    expect(snap.partyId).toBe(null);
    expect(snap.membros).toEqual([]);
    expect(snap.lider).toBe(null);
    expect(snap.max).toBe(3);
    expect(snap.convite).toBe(null);
  });

  it("quem esta sozinho na party ja ve o botao de convidar", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento", "Cora"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);
    store.aceitarConvite("p_Bento", world);

    store.sair("p_Bento");

    // Ana sobrou sozinha: a caixa vira a de um membro com o botao de
    // convidar embaixo
    const snap = store.snapshot("p_Ana", world);

    expect(snap.membros).toHaveLength(1);
    expect(snap.membros[0].eu).toBe(true);
    expect(snap.lider).toBe("p_Ana");
  });

  it("o convite chega com o prazo, e nao com o tempo restante", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    store.convidar("p_Ana", world.players.get("p_Bento"), world);

    const snap = store.snapshot("p_Bento", world);

    expect(snap.convite.de.nome).toBe("Ana");
    expect(snap.convite.ttl).toBe(PARTY_INVITE_TTL);
    expect(typeof snap.convite.expiraEm).toBe("number");
  });

  it("quem nao tem party ve a lista vazia e nao um estado quebrado", () => {
    const store = new PartyStore();
    const world = mundoCom(["Ana", "Bento"]);

    const snap = store.snapshot("p_Bento", world);

    expect(snap.partyId).toBe(null);
    expect(snap.membros).toEqual([]);
    expect(snap.lider).toBe(null);
  });
});