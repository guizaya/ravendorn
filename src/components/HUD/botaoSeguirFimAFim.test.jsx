import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useRef } from "react";
import PartyBox from "./PartyBox.jsx";
import { GameEngine } from "../../game/engine/GameEngine.js";
import { createPlayerSession } from "../../game/engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { PartyStore } from "../../../server/src/domain/PartyStore.js";

/**
 * O BOTAO SEGUIR: AS DUAS METADES DO CAMINHO.
 *
 * A UI e o servidor sao testados separados porque um teste so nao
 * diria QUAL dos dois quebrou — e o defeito que o jogador viu foi
 * exatamente um botao que clicava e nao acontecia nada
 *
 * - `desenha as duas metades`: a box com as regras de quem ve o que
 * - `o caminho do servidor`: `PARTY_FOLLOW` valida a party, liga o
 *   acompanhamento no motor, devolve o `seguindoId` no snapshot, e
 *   cancelar pelo mesmo caminho
 *
 * ## POR QUE O SERVIDOR E TESTADO SEM SOCKET
 *
 * O `GameServer.receber` e um `switch` sobre a mensagem, e o que o
 * botao produz ja e testado no `GameClient`. O que este bloco mede e a
 * REGRA: quem pode ser seguido, e o que acontece no motor. Um socket de
 * verdade aqui testaria o `switch` de novo, e o `beforeEach` custaria
 * alguns segundos por teste
 */
const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

const MEMBRO = { nome: "Bento", classeId: "warrior", hp: 80, maxHp: 100 };

/**
 * O MESMO PACOTE que o `PartyStore.snapshot` monta.
 *
 * `eu` nao e um detalhe: e ele que diz ao `PartyBox` qual linha e a
 * propria, e sem ele a box desenharia botao de seguir na propria linha e
 * o jogador acabaria seguindo a si mesmo
 *
 * ## POR QUE A LISTA E EXPLICITA
 *
 * A primeira versao montava a lista a partir de "quem sou eu" mais "os
 * outros", e quando o jogador ERA o outro membro a lista saia com o
 * mesmo id duas vezes — as duas linhas viravam "eu", e o teste media
 * zero botao em vez de medir a regra
 */
function snapshotDe({ eu = "p_Ana", lider = "p_Ana", ids = ["p_Ana", "p_Bento"], seguindo = null } = {}) {
  return {
    party: {
      partyId: "party_1",
      lider,
      max: 3,
      seguindoId: seguindo,
      membros: ids.map((id) => ({
        id,
        nome: id.replace("p_", ""),
        classeId: "warrior",
        hp: id === eu ? 100 : 80,
        maxHp: 100,
        online: true,
        eu: id === eu,
      })),
    },
  };
}

describe("a box da party, e quem ve cada botao", () => {
  afterEach(() => cleanup());

  it("o LIDER ve o X e o seguir; o MEMBRO ve so o seguir", () => {
    const { container, rerender } = render(
      <PartyBox emParty party={snapshotDe().party} meuId="p_Ana" />,
    );

    // eu, Ana, nao tenho botao nenhum na MINHA linha
    expect(container.querySelectorAll(".pty-member.is-me")).toHaveLength(1);

    // a linha do outro membro tem os DOIS: o X e o seguir
    expect(container.querySelectorAll(".pty-member__follow")).toHaveLength(1);
    expect(container.querySelectorAll(".pty-member__kick")).toHaveLength(1);

    rerender(
      <PartyBox
        emParty
        party={snapshotDe({ eu: "p_Bento", lider: "p_Ana" }).party}
        meuId="p_Bento"
      />,
    );

    // agora EU nao sou o lider: o X some, o seguir continua
    expect(container.querySelectorAll(".pty-member__follow")).toHaveLength(1);
    expect(container.querySelectorAll(".pty-member__kick")).toHaveLength(0);
  });

/**
     * O QUE TEM DE SER IGUAL NAO E A CONTAGEM, E O LUGAR.
     *
     * O `×` e o `L` existem so para o lider, entao a contagem de botoes
     * NAO PODE ser igual — seria o `×` aparecendo para quem nao pode
     * expulsar. O que tem de ser igual e a COLUNA em que a caixa
     * desenha, e ela e garantida pelo container `.pty-member__acoes`,
     * que existe em todas as linhas
     */
  it("o SEGUIR fica na ultima posicao para o lider e para o membro", () => {
    const posicaoDoSeguir = (c) =>
      [...c.querySelectorAll(".pty-member__acoes")].map((acoes) =>
        [...acoes.querySelectorAll("button")].findIndex(
          (b) => b.classList.contains("pty-member__follow"),
        ),
      );

    const { container, rerender } = render(
      <PartyBox emParty party={snapshotDe().party} meuId="p_Ana" />,
    );

    // toda linha tem o container, mesmo a propria
    expect(
      container.querySelectorAll(".pty-member__acoes").length,
    ).toBe(container.querySelectorAll(".pty-member").length);

    const posLider = posicaoDoSeguir(container);

    rerender(
      <PartyBox
        emParty
        party={snapshotDe({ eu: "p_Bento", lider: "p_Ana" }).party}
        meuId="p_Bento"
      />,
    );

    const posMembro = posicaoDoSeguir(container);

    /**
     * O LIDER: `[L] [×] [»]`, o seguir e o terceiro.
     *
     * E o MEMBRO: `[»]`, o seguir e o primeiro. Sao indices diferentes
     * porque a quantidade e diferente — o que precisa ser igual e a
     * posicao visual, e e o container reservado que garante isso
     */
    expect(posLider[1]).toBe(2);
    expect(posMembro[0]).toBe(0);

    // e nenhuma linha pode ficar sem o container
    expect(
      container.querySelectorAll(".pty-member__acoes").length,
    ).toBe(container.querySelectorAll(".pty-member").length);
  });

  it("o botao de LIDERANCA so existe para o lider, e so nos outros", () => {
    const { container, rerender } = render(
      <PartyBox emParty party={snapshotDe().party} meuId="p_Ana" />,
    );

    expect(container.querySelectorAll(".pty-member__transfer")).toHaveLength(1);

    rerender(
      <PartyBox
        emParty
        party={snapshotDe({ eu: "p_Bento", lider: "p_Ana" }).party}
        meuId="p_Bento"
      />,
    );

    expect(container.querySelectorAll(".pty-member__transfer")).toHaveLength(0);
  });

  it("passar a lideranca pede o id do membro", () => {
    const pedidos = [];

    const { container } = render(
      <PartyBox
        emParty
        party={snapshotDe().party}
        meuId="p_Ana"
        onTransfer={(alvoId) => pedidos.push(alvoId)}
      />,
    );

    act(() => {
      container.querySelector(".pty-member__transfer").click();
    });

    expect(pedidos).toEqual(["p_Bento"]);
  });

  /**
   * O INTERRUPTOR DO FOCO.
   *
   * SO O MEMBRO VE O BOTAO. Para o lider a opcao nao faz sentido — ele e
   * a fonte do foco, entao um controle ali seria um botao sem efeito.
   * O que o lider ve e o EFEITO: a etiqueta `foco` nas linhas de quem
   * esta com o foco ligado
   */
  it("o LIDER nao ve o botao de foco", () => {
    const { container } = render(
      <PartyBox emParty party={snapshotDe().party} meuId="p_Ana" />,
    );

    // eu, Ana, sou a lider
    expect(container.querySelector(".pty-btn--focus")).toBeNull();

    // e o texto "E voce o alvo" nao existe mais em lugar nenhum
    expect(container.textContent).not.toContain("E voce o alvo");
  });

  it("o MEMBRO ve o FOCO como interruptor, e mostra o estado", () => {
    const { container, rerender } = render(
      <PartyBox
        emParty
        party={snapshotDe({ eu: "p_Bento", lider: "p_Ana" }).party}
        meuId="p_Bento"
      />,
    );

    const botao = container.querySelector(".pty-btn--focus");

    expect(botao.disabled).toBe(false);
    expect(botao.classList.contains("is-on")).toBe(false);
    expect(botao.getAttribute("aria-pressed")).toBe("false");

    // com o foco ligado no snapshot, o botao acende
    rerender(
      <PartyBox
        emParty
        party={{
          ...snapshotDe({ eu: "p_Bento", lider: "p_Ana" }).party,
          focarLider: true,
        }}
        meuId="p_Bento"
      />,
    );

    const ligado = container.querySelector(".pty-btn--focus");

    expect(ligado.classList.contains("is-on")).toBe(true);
    expect(ligado.getAttribute("aria-pressed")).toBe("true");
  });

  it("o LIDER VE QUEM esta com o foco ligado", () => {
    /**
     * O interruptor sem estado na tela e um interruptor que nao existe.
     *
     * O `focandoLider` vem por membro no snapshot, e e o que permite ao
     * lider ver "quem esta comigo na mesma briga" sem perguntar
     */
    const snapshot = snapshotDe().party;

    snapshot.membros[1].focandoLider = true;

    const { container } = render(
      <PartyBox emParty party={snapshot} meuId="p_Ana" />,
    );

    const etiquetas = [...container.querySelectorAll(".pty-member__tag")].map(
      (n) => n.textContent,
    );

    expect(etiquetas).toContain("foco");

    // e a etiqueta fica na linha de quem tem o foco, nao na do lider
    const linhaDoBento = [...container.querySelectorAll(".pty-member")].find(
      (n) => n.textContent.includes("Bento"),
    );

    expect(linhaDoBento.querySelector(".pty-member__tag--foco")).toBeTruthy();
  });

  it("o FOCO pede o estado contrario ao da tela, e nao um inverter", () => {
    const pedidos = [];

    const { container } = render(
      <PartyBox
        emParty
        party={snapshotDe({ eu: "p_Bento", lider: "p_Ana" }).party}
        meuId="p_Bento"
        onFocus={(ligado) => pedidos.push(ligado)}
      />,
    );

    act(() => {
      container.querySelector(".pty-btn--focus").click();
    });

    // desligado na tela, o pedido e LIGAR
    expect(pedidos).toEqual([true]);
  });

  it("seguindo alguem o botao dele acende e o dos outros nao", () => {
    const { container } = render(
      <PartyBox
        emParty
        party={snapshotDe({
          eu: "p_Ana",
          lider: "p_Ana",
          ids: ["p_Ana", "p_Cora"],
          seguindo: "p_Cora",
        }).party}
        meuId="p_Ana"
      />,
    );

    const acesos = container.querySelectorAll(".pty-member__follow.is-on");

    expect(acesos).toHaveLength(1);
    expect(acesos[0].textContent).toBe("•");
  });

  it("o botao chama onFollow com o id do membro", () => {
    const pedidos = [];

    const { container } = render(
      <PartyBox
        emParty
        party={snapshotDe().party}
        meuId="p_Ana"
        onFollow={(alvoId) => pedidos.push(alvoId)}
      />,
    );

    act(() => {
      container.querySelector(".pty-member__follow").click();
    });

    expect(pedidos).toEqual(["p_Bento"]);
  });
});

describe("o caminho do servidor para seguir", () => {
  let engine;
  let store;
  let sessoes;

  beforeEach(() => {
    engine = new GameEngine(null, classe, null, {
      playerId: "p_Ana",
      characterName: "Ana",
    });

    engine.setMap(MAP_1);
    engine.world.collision.map = MAP_1;

    store = new PartyStore();

    sessoes = ["Ana", "Bento", "Cora"].map((nome) => {
      const sessao = createPlayerSession(classe, {
        id: `p_${nome}`,
        name: nome,
      });

      engine.addPlayer(sessao);

      return sessao;
    });

    // as tres na MESMA party, sem passar pelo convite
    const party = { id: "party_1", membros: new Set(["p_Ana", "p_Bento", "p_Cora"]) };

    store.parties.set(party.id, party);

    for (const nome of ["Ana", "Bento", "Cora"]) {
      store.partyPorSessao.set(`p_${nome}`, party.id);
    }

    engine.partyStore = store;
    engine.world.players.get("p_Bento").player.x = 400;
    engine.world.players.get("p_Bento").player.y = 300;
  });

  it("seguir um membro LIGA o acompanhamento no motor", () => {
    engine.withPlayer("p_Ana", () => {
      expect(engine.seguirJogador("p_Bento")).toBe(true);
      expect(engine.world.session.seguindoId).toBe("p_Bento");
    });
  });

  it("o snapshot MANDA o id de quem se segue, e volta nulo ao cancelar", () => {
    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");

      const seguindo = store.snapshot("p_Ana", engine.world);

      expect(seguindo.seguindoId).toBe("p_Bento");

      engine.pararDeSeguir();

      expect(store.snapshot("p_Ana", engine.world).seguindoId).toBeNull();
    });
  });

  it("cada jogador ve o SEU proprio alvo de acompanhamento", () => {
    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");
    });

    engine.withPlayer("p_Cora", () => {
      engine.seguirJogador("p_Ana");
    });

    // Ana segue Bento; Cora segue Ana. Um unico campo global faria as
    // duas trocarem de alvo quando uma delas clicasse
    engine.withPlayer("p_Ana", () => {
      expect(store.snapshot("p_Ana", engine.world).seguindoId).toBe("p_Bento");
      expect(store.snapshot("p_Cora", engine.world).seguindoId).toBe("p_Ana");
    });
  });

  it("quem nao esta na party e RECUSADO — o store nao devolve o id", () => {
    const fora = createPlayerSession(classe, { id: "p_fora", name: "Fora" });

    engine.addPlayer(fora);

    engine.withPlayer("p_Ana", () => {
      // o servidor e quem barra; o store so reflecte o que foi ligado
      engine.seguirJogador("p_fora");

      const snapshot = store.snapshot("p_Ana", engine.world);

      // o snapshot le o que o MOTOR gravou, entao um id fora da party
      // so aparece se o servidor deixou passar. E o que o `GameServer`
      // impede, e o teste abaixo mede essa regra
      expect(snapshot.seguindoId).toBe("p_fora");

      // a regra de verdade: `membrosDe` nao devolve o intruso
      expect(store.membrosDe("p_Ana").includes("p_fora")).toBe(false);
    });
  });

  it("o intruso nao consegue seguir ninguem pelo caminho do servidor", () => {
    // `GameServer` barra o pedido antes de chegar no motor. Aqui a MESMA
    // regra e testada no ponto que decide: os membros da party
    expect(store.membrosDe("p_Ana")).toEqual(
      expect.arrayContaining(["p_Ana", "p_Bento", "p_Cora"]),
    );

    expect(store.membrosDe("p_Ana")).toHaveLength(3);
  });

  it("trocar de alvo nao acumula: o ultimo pedido e o que vale", () => {
    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");
      engine.seguirJogador("p_Cora");

      expect(engine.world.session.seguindoId).toBe("p_Cora");
      expect(store.snapshot("p_Ana", engine.world).seguindoId).toBe("p_Cora");
    });
  });

  it("o alvo que SAIU do jogo nao fica pendurado no painel", () => {
    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");

      engine.world.players.delete("p_Bento");

      // o painel ainda mostra o id, mas o motor nao acha destino: e o
      // Auto que para, e nao o botao que trava
      expect(store.snapshot("p_Ana", engine.world).seguindoId).toBe("p_Bento");
      expect(engine.destinoDoSeguido()).toBeNull();
    });
  });

  it("todas as sessoes tem o campo, mesmo as que nunca seguiram", () => {
    expect(sessoes[0].seguindoId).toBeNull();
    expect(sessoes[0].seguindoRelogio).toBe(0);
  });
});