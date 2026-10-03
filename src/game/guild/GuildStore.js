import {
  GUILD_MEMBROS_MAX,
  GUILD_PEDIDOS_MAX,
  GUILD_PONTOS_MAX,
  GUILD_ROLE,
  GUILD_TALENTS,
  chaveDeBusca,
  getTalent,
  normalizarNome,
  normalizarTag,
  pontosDesde,
  podeGerenciar,
  talentDisponivel,
  validarNomeGuilda,
  validarTagGuilda,
} from "../../data/guild/index.js";

/**
 * A GUILDA: o estado que o mundo divide.
 *
 * E o segundo lugar do jogo, depois do market, onde o dinheiro e o item
 * de um jogador andam para o de outro. Por isso roda no SERVIDOR e tem
 * uma unica copia: duas instancias permitiriam a duas guildas com o
 * mesmo nome, ou a um jogador estar em duas ao mesmo tempo
 *
 * O que NAO mora aqui, e o que o jogador carrega: os pontos de talento
 * sao POR JOGADOR e vao na `PlayerSession`, como o inventario. O store
 * guarda a GUilda — quem esta nela, a arvore que ela destravou, o
 * cofre. Se os pontos morassem aqui, uma sessao recreated perderia
 * pontos, e o jogador perderia horas de espera
 *
 * O `agora` e INJETADO, como o do `MarketStore`. Um ponto por hora com
 * teto de 24 e impossivel de testar com `Date.now()` de verdade: ou o
 * teste espera uma hora, ou usa timer falso — e timer falso esconde a
 * borda que importa, que e o jogador que ficou offline no meio do
 * intervalo
 */
export class GuildStore {
  /**
   * @param {object} opcoes
   * @param {() => number} opcoes.agora  o relogio, em ms
   * @param {() => string} opcoes.novoId  gerador de id de guilda
   */
  constructor({ agora = () => Date.now(), novoId = null } = {}) {
    this.agora = agora;
    this.novoId = novoId ?? (() => `g_${this.sequencia++}`);
    this.sequencia = 0;

    /** as guildas do mundo, por id */
    this.guilds = new Map();

    /** o indice de nome normalizado, para a busca e para o conflito */
    this.nomes = new Set();

    /**
   * CHAVE DO PERSONAGEM -> guildaId.
   *
   * A chave e a donoKey — o nome normalizado — e nao o id da
   * sessao. O id e p_<uuid> e muda a cada entrada: indexar por ele
   * fazia a guilda evaporar quando o jogador reconectava
   */
    this.guildaDaChave = new Map();
  }

  /* ------------------------------------------------------------------
     CONSULTAS
     ------------------------------------------------------------------ */

  get(id) {
    return this.guilds.get(id) ?? null;
  }

  /** a guilda de um jogador, ou `null` */
  /** a guilda de um personagem, pela chave dele */
  guildaDoJogador(chave) {
    const id = this.guildaDaChave.get(chave);

    return id ? this.get(id) : null;
  }

  /**
   * BUSCAR guilda por nome ou tag.
   *
   * Devolve as guildas cujo nome ou tag CONTEM o termo, e nao apenas
   * iguais a ele: o jogador digita "lobo" e espera achar "Os Lobos
   * Famintos"
   *
   * A ordem e por numero de membros, do maior para o menor. Duas
   * guildas com o mesmo nome nao existem — o `nomes` barra a segunda —
   * mas "lobo" acha varias, e a lista precisa de uma ordem estavel
   */
  buscar(termo, limite = 12) {
    const procurado = chaveDeBusca(termo);

    if (!procurado) return [];

    const achadas = [];

    for (const guilda of this.guilds.values()) {
      const noNome = chaveDeBusca(guilda.nome).includes(procurado);
      const naTag = guilda.tag.toLowerCase().includes(procurado);

      if (noNome || naTag) achadas.push(guilda);
    }

    return achadas
      .sort((a, b) => {
        if (b.membros.size !== a.membros.size) {
          return b.membros.size - a.membros.size;
        }

        return a.nome.localeCompare(b.nome, "pt-BR");
      })
      .slice(0, limite);
  }

  /** o motivo da recusa, ou `null` se o nome serve */
  nomeLivre(nome) {
    return this.nomes.has(normalizarNome(nome))
      ? "ocupado"
      : null;
  }

  /* ------------------------------------------------------------------
     CRIAR E SAIR
     ------------------------------------------------------------------ */

  /**
   * CRIA uma guilda.
   *
   * O jogador vira LIDER no mesmo instante. Nao existe guilda sem
   * lider: ela nasce com um, e sem ele o resto do jogo nao tem a quem
   * perguntar quem abre o cofre
   */
  criar({ nome, tag, liderId, liderNome }) {
    if (!liderId) return { ok: false, motivo: "semLider" };

    const problemaNome = validarNomeGuilda(nome);

    if (problemaNome) {
      return { ok: false, motivo: `nome:${problemaNome}` };
    }

    const problemaTag = validarTagGuilda(tag);

    if (problemaTag) {
      return { ok: false, motivo: `tag:${problemaTag}` };
    }

    const ocupado = this.nomeLivre(nome);

    if (ocupado) return { ok: false, motivo: "ocupado" };

    // uma pessoa so pode estar em uma guilda
    if (this.guildaDaChave.has(liderId)) {
      return { ok: false, motivo: "jaTemGuilda" };
    }

    const guilda = {
      id: this.novoId(),
      nome: String(nome).trim(),
      tag: normalizarTag(tag),
      liderId,
      coLiderId: null,
      membros: new Map(),
      pedidos: [],
      talentos: new Set(),
      criadoEm: this.agora(),
    };

    guilda.membros.set(liderId, {
      id: liderId,
      nome: liderNome,
      papel: GUILD_ROLE.LIDER,
      desde: guilda.criadoEm,
    });

    this.guilds.set(guilda.id, guilda);
    this.nomes.add(normalizarNome(guilda.nome));
    this.guildaDaChave.set(liderId, guilda.id);

    return { ok: true, guilda };
  }

  /**
   * SAI da guilda.
   *
   * O lider que sai tem dois caminhos: transferir o cargo ou dissolver.
   * Sair sem fazer nenhum dos dois deixaria a guilda sem ninguem para
   * abrir o cofre, que e o unico jeito de ela ter conteudo
   */
  sair(chave) {
    const guilda = this.guildaDoJogador(chave);

    if (!guilda) return { ok: false, motivo: "semGuilda" };

    if (guilda.liderId === chave) {
      return { ok: false, motivo: "liderTemQuePassar" };
    }

    guilda.membros.delete(chave);
    this.guildaDaChave.delete(chave);

    return { ok: true, guilda };
  }

  /**
   * PASSA o cargo de lider, ou dissolve a guilda.
   *
   * `paraChave` transfere; sem ele, a guilda deixa de existir
   *
   * E a unica forma de um membro virar co-lider, e de proposito:
   * subir de cargo e coisa da diretoria, nao de um pedido
   */
  passarLideranca(chave, paraChave = null) {
    const guilda = this.guildaDoJogador(chave);

    if (!guilda) return { ok: false, motivo: "semGuilda" };

    if (guilda.liderId !== chave) {
      return { ok: false, motivo: "naoEhLider" };
    }

    if (paraChave === null) {
      this.dissolver(guilda);

      return { ok: true, dissolvida: true };
    }

    const alvo = guilda.membros.get(paraChave);

    if (!alvo) return { ok: false, motivo: "alvoNaoEhMembro" };

    // o co-lider vira lider, e o lugar de co-lider fica vago
    alvo.papel = GUILD_ROLE.LIDER;
    guilda.liderId = paraChave;

    const saindo = guilda.membros.get(chave);

    if (saindo) saindo.papel = GUILD_ROLE.MEMBRO;

    return { ok: true, guilda };
  }

  /** o cargo de co-lider, que so a diretoria ocupa e larga */
  definirCoLider(chave, alvoId) {
    const guilda = this.guildaDoJogador(chave);

    if (!guilda) return { ok: false, motivo: "semGuilda" };

    if (!podeGerenciar(guilda, chave)) {
      return { ok: false, motivo: "semCargo" };
    }

    if (alvoId === null) {
      guilda.coLiderId = null;

      return { ok: true, guilda };
    }

    const alvo = guilda.membros.get(alvoId);

    if (!alvo) return { ok: false, motivo: "alvoNaoEhMembro" };

    if (guilda.liderId === alvoId) {
      return { ok: false, motivo: "alvoEhLider" };
    }

    // o lugar de co-lider e um so: trocar o titular e o que acontece
    if (guilda.coLiderId !== alvoId) {
      const antes = guilda.membros.get(guilda.coLiderId);

      if (antes) antes.papel = GUILD_ROLE.MEMBRO;
    }

    alvo.papel = GUILD_ROLE.CO_LIDER;
    guilda.coLiderId = alvoId;

    return { ok: true, guilda };
  }

  /** apaga a guilda e limpa todos os indices */
  dissolver(guilda) {
    for (const membroId of guilda.membros.keys()) {
      this.guildaDaChave.delete(membroId);
    }

    this.nomes.delete(normalizarNome(guilda.nome));
    this.guilds.delete(guilda.id);
  }

  /* ------------------------------------------------------------------
     PEDIDOS DE ENTRADA
     ------------------------------------------------------------------ */

  /** se PEDE para entrar. Chamar duas vezes nao duplica o pedido */
  pedirEntrada(chave, guildaId, { nome, classe } = {}) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    if (this.guildaDaChave.has(chave)) {
      return { ok: false, motivo: "jaTemGuilda" };
    }

    if (guilda.membros.size >= GUILD_MEMBROS_MAX) {
      return { ok: false, motivo: "cheia" };
    }

    const jaPediu = guilda.pedidos.find(
      (p) => p.chave === chave,
    );

    if (jaPediu) return { ok: true, guilda, repetido: true };

    if (guilda.pedidos.length >= GUILD_PEDIDOS_MAX) {
      return { ok: false, motivo: "pedidosCheios" };
    }

    guilda.pedidos.push({
      chave,
      nome,
      classe,
      pedidoEm: this.agora(),
    });

    return { ok: true, guilda };
  }

  /**
   * ACEITA um pedido.
   *
   * E a diretoria que aceita: lider e co-lider. Sem isso, qualquer
   * jogador poderia se colocar na guilda
   */
  aceitarEntrada(chave, guildaId, alvoId) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    if (!podeGerenciar(guilda, chave)) {
      return { ok: false, motivo: "semCargo" };
    }

    const posicao = guilda.pedidos.findIndex(
      (p) => p.chave === alvoId,
    );

    if (posicao < 0) return { ok: false, motivo: "semPedido" };

    if (this.guildaDaChave.has(alvoId)) {
      return { ok: false, motivo: "jaTemGuilda" };
    }

    if (guilda.membros.size >= GUILD_MEMBROS_MAX) {
      return { ok: false, motivo: "cheia" };
    }

    const [pedido] = guilda.pedidos.splice(posicao, 1);

    guilda.membros.set(alvoId, {
      id: alvoId,
      nome: pedido.nome,
      papel: GUILD_ROLE.MEMBRO,
      desde: this.agora(),
    });

    this.guildaDaChave.set(alvoId, guilda.id);

    return { ok: true, guilda };
  }

  /** NEGA um pedido. Tambem so a diretoria */
  negarEntrada(chave, guildaId, alvoId) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    if (!podeGerenciar(guilda, chave)) {
      return { ok: false, motivo: "semCargo" };
    }

    const posicao = guilda.pedidos.findIndex(
      (p) => p.chave === alvoId,
    );

    if (posicao < 0) return { ok: false, motivo: "semPedido" };

    guilda.pedidos.splice(posicao, 1);

    return { ok: true, guilda };
  }

  /* ------------------------------------------------------------------
     TALENTOS
     ------------------------------------------------------------------ */

  /**
   * DESTRAVA um talento da arvore.
   *
   * Os pontos sao do jogador que gasta e o talento e da guilda: e o
   * "todo mundo ajuda" do desenho. Um membro destrava, e todos os
   * outros ganham o bonus
   *
   * As tres recusas, cada uma fechando uma porta: pontos demais, pai
   * nao destravado, e ja destravado
   */
  destravarTalent(chave, guildaId, talentId, pontosDoJogador) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    const node = getTalent(talentId);

    if (!node) return { ok: false, motivo: "talentNaoExiste" };

if (guilda.talentos.has(talentId)) {
      return { ok: false, motivo: "jaDestraulado" };
    }

    if (!talentDisponivel(talentId, guilda.talentos)) {
      return { ok: false, motivo: "exigePai" };
    }

    if ((pontosDoJogador ?? 0) < node.custo) {
      return { ok: false, motivo: "pontosInsuficientes" };
    }

    guilda.talentos.add(talentId);

    return { ok: true, guilda, custo: node.custo };
  }

  /* ------------------------------------------------------------------
     O COFRE
     ------------------------------------------------------------------ */

  /**
   * O COFRE: deposito e saque, so pela diretoria.
   *
   * A regra e do jogador e ela e literal: **so o lider e o co-lider
   * tocam no cofre**. Nao existe deposito de membro comum
   *
   * Vale registrar a consequencia, porque ela e o efeito colateral da
   * regra pedida: um cofre que so a diretoria abre nunca enche sozinho.
   * Ele comeca vazio e so recebe o que a diretoria colocar nele. E o
   * que foi pedido — nao e um bug, e a regra
   */
  mexerNoCofre(chave, guildaId, acao) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    if (!podeGerenciar(guilda, chave)) {
      return { ok: false, motivo: "semCargo" };
    }

    if (!guilda.cofre) {
      guilda.cofre = {
        slots: [],
        moedas: 0,
      };
    }

return { ok: true, guilda, cofre: guilda.cofre, acao };
  }

  /**
   * CRIA o cofre, ou junta dinheiro nele.
   *
   * E o que a taxa de criacao usa: a guilda recem-fundada ja nasce com
   * os dez milhoes dentro, em vez de um cofre vazio que so a
   * diretoria poderia encher — e que, sem ter com o que começar,
   * ficaria vazio ate o proximo milionario passar por ali
   *
   * Devolve o cofre e nao um `ok`: quem chama ja sabe que a guilda
   * existe, e o que ele quer e o objeto
   */
  adicionarAoCofre(guildaId, { coins = 0 } = {}) {
    const guilda = this.get(guildaId);

    if (!guilda) return null;

    if (!guilda.cofre) {
      guilda.cofre = {
        slots: [],
        moedas: 0,
      };
    }

    guilda.cofre.moedas += Math.max(
      0,
      Math.floor(Number(coins) || 0),
    );

    return guilda.cofre;
  }


  /**
   * ATUALIZA os pontos de um jogador pelo relogio.
   *
   * E o unico lugar onde o tempo vira ponto, e ele roda quando o painel
   * e montado. Assim o jogador que ficou offline dez horas recebe os
   * dez pontos no primeiro painel depois de voltar, sem ninguem ter
   * ficado de guarda
   *
   * O estado do jogador (`pontos` e `ultimoPontoEm`) fica na sessao e
   * NAO no store: e por jogador, e perder com a sessao seria perder
   * horas de espera
   *
   * O teto e sobre o SALDO, e nao sobre o tempo: quem tem 10 pontos e
   * fica 30 dias fora ganha ate 24, para nos 24, e so volta a ganhar
   * depois de gastar. O `proximoEm` avanca sempre pela conta matematica,
   * entao o relogio fica em dia e as horas que nao couberam se perdem
   * em vez de virar divida
   */
  sincronizarPontos(sessao) {
    if (!sessao?.guilda) {
      return 0;
    }

    const estado = sessao.guilda;

    const { pontos, proximoEm } = pontosDesde(
      estado.ultimoPontoEm,
      this.agora(),
    );

    estado.ultimoPontoEm = proximoEm;

    if (pontos > 0) {
      estado.pontos = Math.min(
        GUILD_PONTOS_MAX,
        (estado.pontos ?? 0) + pontos,
      );
    }

    return estado.pontos ?? 0;
  }

  /* ------------------------------------------------------------------
     O QUE VAI PARA O PAINEL
     ------------------------------------------------------------------ */

  /**
   * A guilda de um jogador, no formato do PAINEL.
   *
   * E por JOGADOR porque o que cada um ve depende do papel dele: o
   * lider ve os pedidos e o botao de co-lider, o membro comum nao. E
   * por guilda e nao por sessao pelo mesmo motivo do market
   */
  snapshotPara(chave, pontos) {
    const guilda = this.guildaDoJogador(chave);

    if (!guilda) {
      return {
        guilda: null,
        ehLider: false,
        ehDiretoria: false,
        pontos: pontos ?? 0,
        pontosMax: GUILD_PONTOS_MAX,

        /**
         * A arvore aparece mesmo sem guilda, toda bloqueada.
         *
         * E o que mostra ao jogador o que ele PODE desbloquear se criar
         * uma — esconder a arvore faria a aba parecer quebrada
         *
         * `cofre: null` e explicito, e nao omitido: o painel pergunta
         * pelo cofre sem perguntar se tem guilda antes, e `undefined`
         * seria um terceiro estado que so o painel saberia tratar
         */
        cofre: null,
        arvore: arvoreSnapshot(new Set()),
      };
    }

    return {
      guilda: {
        id: guilda.id,
        nome: guilda.nome,
        tag: guilda.tag,
membros: [...guilda.membros.values()].map((m) => ({
          id: m.id,
          nome: m.nome,
          papel: m.papel,
          jogadorId: m.chave,
          eu: m.chave === chave,
        })),

        membrosMax: GUILD_MEMBROS_MAX,
        pedidos: guilda.pedidos.map((p) => ({
          jogadorId: p.chave,
          nome: p.nome,
          classe: p.classe,
        })),
      },

      ehLider: guilda.liderId === chave,
      ehDiretoria: podeGerenciar(guilda, chave),

      pontos: pontos ?? 0,
      pontosMax: GUILD_PONTOS_MAX,

      arvore: arvoreSnapshot(guilda.talentos),

      // o cofre so vem no painel de quem pode mexer nele. Membro comum
      // recebe `null` e o painel nem desenha a aba
      cofre:
        podeGerenciar(guilda, chave) && guilda.cofre
          ? { slots: guilda.cofre.slots, moedas: guilda.cofre.moedas }
          : null,
    };
  }
}

/**
 * A ARVORE como o painel a consome.
 *
 * Os nodes vem com o estado de cada um — destravado, disponivel ou
 * bloqueado — porque essa decisao e do servidor e a tela nao tem como
 * refaze-la sem duplicar as regras. O guilda nao entra: o estado do
 * node vem so do conjunto de talentos
 */
function arvoreSnapshot(talentos) {
  return GUILD_TALENTS.map((node) => ({
    id: node.id,
    nome: node.nome,
    custo: node.custo,
    tier: node.tier,
    exige: node.exige,
    descricao: node.descricao,
    destravado: talentos.has(node.id),
    disponivel: talentDisponivel(node.id, talentos),
  }));
}
