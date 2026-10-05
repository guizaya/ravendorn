/**
 * A PARTY.
 *
 * ## ONDE ESTA
 *
 * No SERVIDOR, e so no servidor. O cliente pede e recebe; ele nunca
 * decide a composicao do grupo. Uma party montada no cliente permitiria
 * que um jogador forcesse os outros a dividirem loot — que e o que a
 * party decide
 *
 * O `PARTY_MAX` e o `PARTY_INVITE_TTL` vem do protocolo: os dois lados
 * precisam dos mesmos numeros, e um numero que so existe aqui faria a
 * tela mostrar "convidar" para uma party cheia
 */
import {
  PARTY_MAX,
} from "../../../src/shared/protocol.js";

export { PARTY_MAX };

/**
 * QUANTO TEMPO O CONVIDE FICA NA TELA.
 *
 * Cinco segundos. E o prazo do CONVITE, nao da party: aceita depois
 * disso, o convite ja foi para o chao e o jogador seria puxado para um
 * grupo que ele nao consegue mais recusar
 */
export const PARTY_INVITE_TTL = 5;

/**
 * Um ID de party.
 *
 * O contador e do processo e nunca reinicia, o que faz o id ser
 * diferente entre duas parties criadas na mesma sessao. Um id derivado
 * do nome do jogador poderia colidir quando o mesmo jogador saisse e
 * voltasse
 */
let contador = 0;

function novoId() {
  contador += 1;

  return `party_${contador}`;
}

export class PartyStore {
  constructor({ agora } = {}) {
    /**
     * O RELOGIO E INJETADO, como no `MarketStore` e no `GuildStore`.
     *
     * O prazo de 5 segundos nao pode ser testado esperando 5 segundos, e
     * um `Date.now()` solto no meio do arquivo e o que impediria isso
     */
    this.agora = agora ?? (() => Date.now());

    /**
     * `sessionId -> partyId`
     *
     * O nome e `partyPorSessao` e nao `partyDe` porque `partyDe` ja e o
     * METODO que consulta o indice. Um campo com o mesmo nome sombreia o
     * metodo, e `this.partyDe(x)` viraria `this.partyDe.get(x)` — que e
     * um `TypeError` na primeira party montada
     */
    this.partyPorSessao = new Map();

    /** `partyId -> { id, membros: Set<sessionId> }` */
    this.parties = new Map();

    /**
     * `sessionId -> convite pendente recebido`
     *
     * E so o RECEBIDO. O que o jogador mandou fica em `convidadoPor`,
     * e assim um convite aceito nao apaga o que o outroMandou
     */
    this.convitesRecebidos = new Map();

    /** `sessionId -> { partyId, expiresAt, nome, classe }` */
    this.enviados = new Map();
  }

  /* ---------------------------------------------------------------- */
  /* LEITURA                                                          */
  /* ---------------------------------------------------------------- */

  /**
 * CRIA A PARTY DE UM JOGADOR SO.
 *
 * ## POR QUE ISSO EXISTE
 *
 * Sem isso o botao [Criar party] teria que ser um convite vazio, e um
 * convite sem alvo estourava em "jogador nao encontrado" — que e
 * exatamente o que acontecia
 *
 * A party de um so e um estado legitimo, e nao um palpite: e ele que faz
 * o campo do nick aparecer. Sem uma party, o jogador esta FORA de party,
 * e a caixa mostra so o botao de criar — nunca o caminho de convidar
 *
 * Criar duas vezes nao faz nada: o jogador que ja esta em party continua
 * na party que estava
 */
criar(sessionId) {
  const atual = this.partyDe(sessionId);

  // ja estou em party: criar de novo nao muda nada e nao cria um grupo
  // paralelo com o jogador dentro dos dois
  if (atual) return { ok: true, party: atual, jaExistia: true };

  /**
     * O LIDER NASCE COMO QUEM ABRIU.
     *
     * E so a definicao inicial: depois disso o campo muda por
     * `transferirLideranca`, e e ele que o snapshot le. Sem gravar
     * aqui, uma party recem-criada teria `lider` vazio e o servidor
     * recusaria a primeira transmissao com "so o lider passa"
     */
    const party = {
      id: novoId(),
      lider: sessionId,
      membros: new Set([sessionId]),
    };

  this.parties.set(party.id, party);

  this.partyPorSessao.set(sessionId, party.id);

  return { ok: true, party };
}

  /** A party de um jogador, ou `null`. */
  partyDe(sessionId) {
    const id = this.partyPorSessao.get(sessionId);

    if (!id) return null;

    return this.parties.get(id) ?? null;
  }

  /** Os ids de sessao de uma party, na ordem em que entraram. */
  membrosDe(sessionId) {
    const party = this.partyDe(sessionId);

    if (!party) return [];

    return [...party.membros];
  }

  /** As MESMAS sessions de uma party, como objetos do servidor. */
  sessoesDaParty(members, world) {
    return members
      .map((id) => world.players.get(id))
      .filter(Boolean);
  }

  /** O convite pendente de um jogador, ou `null`. */
  convitePendente(sessionId) {
    return this.convitesRecebidos.get(sessionId) ?? null;
  }

  /**
   * O estado que o painel desenha.
   *
   * Sai daqui e nao do cliente porque a lista de membros e dado de tela
   * com nome, classe e vida: o servidor sabe tudo isso, e o cliente so
   * tem o que o `NetworkWorld` ja desenhou
   */
  snapshot(sessionId, world) {
    const members = this.membrosDe(sessionId);

    const party = this.partyDe(sessionId);

    return {
      partyId: party?.id ?? null,

      /**
       * QUEM ESTE JOGADOR ESTA SEGUINDO, ou `null`.
       *
       * Vai no painel e nao num evento porque o botao de seguir precisa
       * mostrar QUAL dos dois esta ligado — e o que impede o jogador de
       * clicar em "seguir" duas vezes em pessoas diferentes sem saber
       * de quem ele esta seguindo
       *
       * O `seguindoId` mora na SESSAO e nao aqui: o store monta o
       * grupo, quem guarda o acompanhamento e o motor, que e quem
       * caminha
       */
      seguindoId: world.players.get(sessionId)?.seguindoId ?? null,

      /**
       * O FOCO DO LIDER ESTA LIGADO PARA ESTE JOGADOR.
       *
       * Vem no snapshot e nao num evento porque o botao e um interruptor
       * que mostra o proprio estado: sem isto o cliente so saberia que
       * ligou se o pedido voltasse, e o botao ficaria cinza ate o
       * proximo painel
       */
      focarLider: Boolean(world.players.get(sessionId)?.focarLider),

      /**
       * `lider` e o CAMPO da party, e nao o primeiro membro.
       *
       * Era a ordem de insercao, e isso servia enquanto ninguem
       * passava o comando. Com a lideranca transferivel, "quem abriu" e
       * "quem manda" sao coisas diferentes: o marcador de lider na tela
       * trocaria de pessoa sozinha quando o primeiro saisse, e o botao
       * de expulsar apareceria para quem nao tem o comando
       *
       * O `?? members[0]` cobre a party montada sem o campo — o
       * primeiro membro e a resposta certa para um grupo recem-criado
       */
      lider: party?.lider ?? members[0] ?? null,

      max: PARTY_MAX,

      membros: members.map((id) => {
        const sessao = world.players.get(id);

        return {
          id,
          nome: sessao?.name ?? "?",
          classId: sessao?.classId ?? null,
          hp: Math.ceil(sessao?.player?.hp ?? 0),
          maxHp: sessao?.player?.maxHp ?? 0,
          online: Boolean(sessao),
          eu: id === sessionId,

          /**
           * ESTE MEMBRO ESTA FOCANDO O LIDER.
           *
           * E por membro, e nao um estado so da party: cada um liga e
           * desliga na sua hora. Sem vir por membro, o lider nao teria
           * como ver quem esta com o foco ligado, e a opcao pareceria
           * inexistente do lado de quem manda
           */
          focandoLider: Boolean(sessao?.focarLider),
        };
      }),

      /**
       * O CONVITE RECEBIDO que esta na tela agora, ou `null`.
       *
       * O `expiraEm` e um instante absoluto, e nao um tempo restante: o
       * cliente roda em outra maquina e o relogio dele pode estar
       * adiantado. Mandar o UNIX e o servidor que decide
       */
      convite: this.conviteParaTela(sessionId),
    };
  }

  /**
   * O estado do CONVITE na tela, ou `null`.
   *
   * `expiraEm` e um instante absoluto e nao um tempo restante: o cliente
   * roda em outra maquina e o relogio dele pode estar adiantado. Mandar
   * o UNIX e deixar o servidor decidir quando o convite morre
   */
  conviteParaTela(sessionId) {
    const convite = this.convitesRecebidos.get(sessionId);

    if (!convite) return null;

    return {
      de: {
        id: convite.de,
        nome: convite.nome,
        classe: convite.classe,
      },
      expiraEm: convite.expiresAt,
      ttl: PARTY_INVITE_TTL,
    };
  }

  /* ---------------------------------------------------------------- */
  /* CONVITE                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Convida um jogador pelo nome.
   *
   * ## POR QUE O NOME E BUSCADO AQUI
   *
   * A party e por id de sessao, e a sessao muda a cada entrada. O
   * jogador digita o NICK, e e o nick que ele conhece — pedir um id de
   * sessao no campo de texto mostraria `p_a1b2` para quem tem dois
   * personagens com o mesmo nome na tela
   */
  convidarPorNome(deSessionId, nome, world) {
    const alvo = this.buscarPorNome(nome, world);

    if (!alvo) {
      return { ok: false, motivo: "Jogador não encontrado" };
    }

    return this.convidar(deSessionId, alvo, world);
  }

  /** A sessao cujo nome bate, ignorando maiusculas e espacos. */
  buscarPorNome(nome, world) {
    const alvo = String(nome ?? "").trim().toLowerCase();

    if (!alvo) return null;

    for (const sessao of world.players.values()) {
      if (String(sessao.name ?? "").trim().toLowerCase() === alvo) {
        return sessao;
      }
    }

    return null;
  }

  /** Convida uma sessao especifica — e o caminho do clique no personagem. */
  convidar(deSessionId, alvo, world) {
    const minha = this.partyDe(deSessionId);

    /**
     * JA ESTOU NUMA PARTY.
     *
     * O convite e por MESAO e vale o grupo inteiro: e o que o jogador
     * espera quando clica em alguem com o time formado. E o grupo inteiro
     * que entra, e nao so quem foi clicado
     */
    if (minha) {
      if (minha.membros.has(alvo.id)) {
        return { ok: false, motivo: "Ele já está na party" };
      }

      if (minha.membros.size >= PARTY_MAX) {
        return { ok: false, motivo: "A party está cheia" };
      }
    }

    const partyDoAlvo = this.partyDe(alvo.id);

    /**
     * O CONVIDADO JA ESTA EM OUTRA PARTY.
     *
     * Entrar aqui removeria o grupo antigo no meio de uma briga, e o
     * loot dos dois lados mudaria sem ninguem pedir
     */
    if (partyDoAlvo && partyDoAlvo.id !== minha?.id) {
      return { ok: false, motivo: "Ele já está em outra party" };
    }

    const agora = this.agora();

    const convite = {
      partyId: minha?.id ?? null,
      de: deSessionId,
      nome: world.players.get(deSessionId)?.name ?? "?",
      classe: world.players.get(deSessionId)?.classId ?? null,
      expiresAt: agora + PARTY_INVITE_TTL * 1000,
    };

    /**
     * UM CONVITE POR VEZ.
     *
     * O pedido foi: com dois convites chegando, o jogador tem os 5
     * segundos do que esta NA TELA e so depois ve o proximo. Enfileirar
     * aqui e o que faz a fila existir — o cliente recebe um convite por
     * vez e o proximo so quando o anterior expira
     */
    const jaRecebido = this.convitesRecebidos.get(alvo.id);

    this.convitesRecebidos.set(alvo.id, convite);

    this.enviados.set(deSessionId, {
      partyId: convite.partyId,
      para: alvo.id,
      expiresAt: convite.expiresAt,
    });

    // o convidado precisa saber que JA tem um convite na tela, mesmo
    // que ele nao fosse aceito ainda
    if (jaRecebido) {
      return {
        ok: true,
        substituiu: true,
        convite,
      };
    }

    return { ok: true, convite };
  }

  /**
   * Aceita o convite que esta na tela.
   *
   * ## POR QUE A VERIFICACAO DE TEMPO E AQUI
   *
   * O cliente tambem conta os 5 segundos, para fechar a caixa. Mas o
   * cliente nao e autoridade: a expiry e conferida no servidor, porque
   * um `PANEL` atrasado ou um relogio adiantado nao podem criar uma
   * party com 20 segundos de vida
   */
  aceitarConvite(sessionId, world) {
    const convite = this.convitesRecebidos.get(sessionId);

    if (!convite) {
      return { ok: false, motivo: "Convite não encontrado" };
    }

    if (this.agora() >= convite.expiresAt) {
      this.convitesRecebidos.delete(sessionId);

      return { ok: false, motivo: "O convite expirou" };
    }

    /**
     * A party ja existia quando o convite saiu.
     *
     * O convite carrega o `partyId`, entao aceitar e ENTRAR num grupo que
     * ja tem membros. Entrar sem o `partyId` seria criar uma party nova,
     * e o convidado acabaria num grupo so
     */
    let party;

    if (convite.partyId && this.parties.has(convite.partyId)) {
      party = this.parties.get(convite.partyId);
    } else {
      /**
       * O CONVIDADO VIRA O LIDER.
       *
       * Nao ha ninguem no grupo ainda, entao quem aceita e quem tem o
       * comando. E o mesmo caso de `criar`: o `lider` precisa nascer
       * gravado, porque e ele que o snapshot le e que o servidor
       * consulta na transmissao
       */
      party = { id: novoId(), lider: convite.de, membros: new Set() };

      this.parties.set(party.id, party);

      party.membros.add(convite.de);
      this.partyPorSessao.set(convite.de, party.id);
    }

    if (party.membros.size >= PARTY_MAX) {
      return { ok: false, motivo: "A party está cheia" };
    }

    party.membros.add(sessionId);
    this.partyPorSessao.set(sessionId, party.id);

    // o convite foi cumprido: ele sai da fila, e o proximo da fila entra
    this.convitesRecebidos.delete(sessionId);

    return { ok: true, party };
  }

  /**
   * De QUEM foi o convite, e para QUEM foi mandado.
   *
   * Com o convite por NOME o servidor so tem o nome digitado e o id de
   * quem mandou; a sessao do convidado e recuperada pela identidade do
   * objeto, e nao por um campo novo no convite
   */
  conviteRecebidoDe(convite) {
    for (const [sessionId, pendente] of this.convitesRecebidos) {
      if (pendente === convite) return sessionId;
    }

    return null;
  }

  /**
 * TIRA UM MEMBRO DA PARTY.
 *
 * ## SO O LIDER, E SO OS OUTROS
 *
 * O lider e quem montou o grupo. Sem essa checagem, qualquer membro
 * poderia expulsar o lider e tomar o grupo — e o `id` do alvo vem do
 * cliente, entao a checagem tem de ser aqui
 *
 * O lider nao se expulsa: para sair do proprio grupo ele usa `sair`, e
 * o grupo passa para o proximo. Se ele pudesse se expulsar, o
 * `sair` e o `expulsar` seriam o mesmo caminho com dois nomes
 */
expulsar(liderSessionId, alvoId) {
  const party = this.partyDe(liderSessionId);

  if (!party) {
    return { ok: false, motivo: "Você não está em party" };
  }

/**
     * O LIDER E O CAMPO, e nao o primeiro da lista.
     *
     * A ordem de insercao so coincidia com o comando enquanto ninguem
     * passava a lideranca. Com a transmissao, quem opened o grupo pode
     * deixar de mandar — e continuar expulsando ninguem, que e o inverso
     * do que a tela mostraria
     */
    if ((party.lider ?? [...party.membros][0]) !== liderSessionId) {
      return { ok: false, motivo: "Só o líder pode expulsar" };
    }

  if (alvoId === liderSessionId) {
    return { ok: false, motivo: "Use sair para sair da party" };
  }

  if (!party.membros.has(alvoId)) {
    return { ok: false, motivo: "Ele não está na party" };
  }

  const antes = [...party.membros];

  /**
   * A SAIDA E O `sair` DELE, e nao uma remocao pela fora.
   *
   * Se o store so apagasse o id, o expulsado continuaria com o
   * `convitesRecebidos` dele e a proxima party o chamaria de volta sem
   * ele ter visto nada
   */
  const resultado = this.sair(alvoId);

  return {
    ok: true,
    party,
    expulsado: alvoId,
    /**
     * Quem a tela precisa avisar: o expulsado e quem ficou.
     *
     * O expulsado e o unico que muda de estado de verdade, mas quem
     * ficou precisa da lista nova tambem — e a lista e a mesma para os
     * dois
     */
    avisar: [...antes],
    restantes: resultado.restantes ?? antes,
  };
}

/**
 * Sai da party.
   *
   * Se o lider sai, a party NAO se dissolve: ela passa para o proximo da
   * ordem. Perder um membro e uma coisa; perder o grupo inteiro porque o
   * primeiro jogador saiu e outra
   */
  sair(sessionId) {
    const party = this.partyDe(sessionId);

    if (!party) return { ok: true };

    // O INDICE some e o MEMBRO tambem.
    //
    // Apagar so o indice deixaria a sessao fora do `partyPorSessao` e
    // ainda dentro do `membros` da party: o `membrosDe` continua
    // devolvendo o jogador que saiu, e a caixa dele continuaria mostrando
    // o grupo com quatro membros
    this.partyPorSessao.delete(sessionId);

    party.membros.delete(sessionId);

    const restantes = [...party.membros];

    if (restantes.length === 0) {
      this.parties.delete(party.id);

      /**
       * O CONVITE PENDENTE de um jogador que era o unico membro e
       * cancelado: o grupo que ele ia entrar deixou de existir
       */
      for (const [destinatario, convite] of this.convitesRecebidos) {
        if (convite.partyId === party.id) {
          this.convitesRecebidos.delete(destinatario);
        }
      }

      return { ok: true, dissolvida: true };
    }

    /**
     * QUEM SAIU ERA O LIDER.
     *
     * O grupo nao pode ficar sem comando: o proximo da ordem assume.
     * Sem esta linha, o `lider` apontaria para alguem que ja saiu, e o
     * servidor recusaria a proxima transmissao com "so o lider passa" —
     * a party ficaria sem ninguem able de expulsar ou de passar o
     * comando para frente
     */
    if (party.lider === sessionId) {
      party.lider = restantes[0];
    }

    // o proximo da ordem assume: o grupo nao fica sem lider
    this.partyPorSessao.set(restantes[0], party.id);

    return {
      ok: true,
      party,
      /** quem sobrou, para o servidor avisar a box de cada um */
      restantes,
    };
  }

  /**
   * Limpa o que o tempo destroys.
   *
   * Chamado a cada tick do servidor. E o que FAZ a fila de convites
   * andar: sem isso o cliente receberia um convite expirado e mostraria
   * uma caixa morta ate ele clicar
   */
  tick(world) {
    const agora = this.agora();

    const expirados = [];

    for (const [sessionId, convite] of this.convitesRecebidos) {
      if (agora >= convite.expiresAt) {
        expirados.push({ sessionId, de: convite.de });
      }
    }

    for (const alvo of expirados) {
      this.convitesRecebidos.delete(alvo.sessionId);
    }

    return expirados;
  }

  /** Remove uma sessao que saiu do jogo. */
  remover(sessionId) {
    this.convitesRecebidos.delete(sessionId);
    this.enviados.delete(sessionId);

    this.sair(sessionId);
  }
}