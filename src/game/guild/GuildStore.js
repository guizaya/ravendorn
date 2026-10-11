import {
GUILD_COFRE_SLOTS_MAX,
  GUILD_MEMBROS_MAX,
  GUILD_PEDIDOS_MAX,
  GUILD_PONTOS_MAX,
  GUILD_ROLE,
  GUILD_NOME_MIN,
  GUILD_TALENTS,
  GUILD_TALENT_NIVEL_MAX,
  GUILD_TALENT_POR_CLIQUE,
  chaveDeBusca,
  corDaGuilda,
  getTalent,
  normalizarNome,
  normalizarTag,
  pontosDesde,
  podeGerenciar,
  talentNivel,
  talentNoMaximo,
  talentPontos,
  talentPodeSubir,
  talentProgresso,
  validarEstiloGuilda,
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

    /**
     * TERMO VAZIO E "MOSTRE TUDO", e nao "nao achei nada".
     *
     * Antes o `if (!procurado) return []` recusava o termo vazio, e a
     * aba Buscar abria sempre vazia: o jogador so via guildas digitando
     * algo e apertando Procurar. A lista do mundo e o que ele quer ao
     * ABRIR a aba — o filtro e o que ele usa depois
     *
     * O `limite` continua valendo: sem ele, abrir a aba traria todas as
     * guildas do servidor de uma vez, e o painel perderia o sentido de
     * lista
     */
    const achadas = [];

    for (const guilda of this.guilds.values()) {
      /**
       * SEM TERMO, NINGUEM E DESCARTADO.
       *
       * O filtro e aplicado so quando ha algo a comparar. Com termo, um
       * `includes` de string vazia casaria com tudo, entao o `procurado`
       * continua sendo o que separa os dois caminhos
       */
      if (procurado) {
        const noNome = chaveDeBusca(guilda.nome).includes(procurado);
        const naTag = guilda.tag.toLowerCase().includes(procurado);

        if (!noNome && !naTag) continue;
      }

      achadas.push(guilda);
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
  criar({ nome, tag, liderId, liderNome, icone, cor }) {
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

    /**
     * O ESTILO nasce VALIDADO, e nao do jeito que chegou.
     *
     * O `icone` e a `cor` vem do cliente, e `validarEstiloGuilda` so deixa
     * passar o que existe no catalogo. E valida AQUI e nao so no painel
     * porque o store e quem grava no disco: um store que aceitasse a string
     * que o cliente mandasse colocaria `#fff` num arquivo que o motor le e
     * pinta direto
     */
    const estilo = validarEstiloGuilda({ icone, cor });

    // uma pessoa so pode estar em uma guilda
    if (this.guildaDaChave.has(liderId)) {
      return { ok: false, motivo: "jaTemGuilda" };
    }

    const guilda = {
      id: this.novoId(),
      nome: String(nome).trim(),
      tag: normalizarTag(tag),

      /**
       * O EMBLEMA e a COR da guilda.
       *
       * Sao da guilda e nao do membro porque o lider escolhe uma vez e vale
       * para todo mundo: um membro escolhendo a propria cor faria duas
       * guildas com o mesmo nome em duas cores diferentes, e a tag sobre o
       * boneco deixaria de dizer de qual guilda ele e
       */
      icone: estilo.icone,
      cor: estilo.cor,
      liderId,
      coLiderId: null,
membros: new Map(),
      pedidos: [],

      /**
       * Os Talentos da guilda, por NIVEL.
       *
       * O valor e o nivel alcancado (0 a 5) e nao um `Set` de ids
       * ligados: a arvore tem degraus, e um `Set` so consegue dizer "ligado
       * ou nao" — que perderia a metade do desenho
       *
       * O `Map` guarda o NIVEL e o catalogo guarda o BONUS de cada
       * degrau. Os dois nunca ficam no mesmo lugar, entao nao existe
       * estado que possa discordar do catalogo
       */
      talentos: new Map(),

      criadoEm: this.agora(),
    };

guilda.membros.set(liderId, {
      id: liderId,
      nome: liderNome,
      papel: GUILD_ROLE.LIDER,
      desde: guilda.criadoEm,

      /**
       * O LIDER comeca com a tag LIGADA.
       *
       * Porque a guilda foi criada por ele, com a cor que ele escolheu: a
       * primeira coisa que a tela mostra e a propria assinatura. Todo mundo
       * mais entra com `false` e decide por si
       */
      mostrarTag: true,
    });

    this.guilds.set(guilda.id, guilda);
    this.nomes.add(normalizarNome(guilda.nome));
    this.guildaDaChave.set(liderId, guilda.id);

return { ok: true, guilda };
  }

  /**
   * MUDA O EMBLEMA e A COR da guilda.
   *
   * ## POR QUE SO O LIDER
   *
   * Porque a cor e a assinatura visual da guilda, e ela aparece no MUNDO,
   * em cima do boneco dos outros jogadores. Se qualquer membro pudesse
   * mudar, uma guilda de quarenta pessoas teria quarenta cores diferentes
   * circulando pelo mapa, e a tag deixaria de dizer de qual guilda e
   *
   * ## E POR QUE O CO_LIDER NAO PODE
   *
   * Porque ele pode mexer no cofre, que e o que a diretoria controla. A
   * identidade visual fica com quem controla o destino da guilda, e nao com
   * quem pode gastar — as duas coisas sao poderes separados de proposito
   *
   * ## POR QUE O ESTILO E REVALIDADO AQUI
   *
   * Porque `icone` e `cor` vem do cliente, e este metodo vai parar num
   * `fillStyle` do motor. A lista do `validarEstiloGuilda` e o que impede um
   * cliente modificado de gravar `#fff` no arquivo da guilda
   */
  definirEstilo(chave, bruto) {
    const guilda = this.guildaDoJogador(chave);

    if (!guilda) return { ok: false, motivo: "semGuilda" };

    if (guilda.liderId !== chave) {
      return { ok: false, motivo: "semPermissao" };
    }

    const estilo = validarEstiloGuilda(bruto);

    /**
     * O MESMO ESTILO DEVOLVE `false`, e nao escreve nada.
     *
     * Sem isso, o painel do lider gravaria a guilda no disco a cada clique
     * em uma cor que ja era a dele — e `salvar` reescreve o arquivo inteiro
     * de guildas. Um jogador mexendo no seletor de cor derrubaria o
     * arquivo de guildas umas vinte vezes por segundo
     */
    if (guilda.icone === estilo.icone && guilda.cor === estilo.cor) {
      return { ok: false, motivo: "igual" };
    }

    guilda.icone = estilo.icone;
    guilda.cor = estilo.cor;

    return { ok: true, guilda };
  }

  /**
   * LIGA OU DESLIGA a tag deste jogador sobre o boneco dele.
   *
   * ## POR QUE E POR MEMBRO E NAO POR GUILDA
   *
   * Porque a tag sai em cima do boneco de QUEM liga, e cada jogador decide
   * sobre o proprio boneco. Uma opcao da guilda obrigaria os quarenta
   * membros a exibir a tag, ou a nenhum
   *
   * ## E POR QUE NAO E "INVERTER"
   *
   * Porque o pedido traz o valor novo. Dois cliques rapidos chegam ao
   * servidor em qualquer ordem, e inverter os dois deixaria a opcao como
   * estava — o mesmo motivo do interruptor do passe premium
   */
  definirMostrarTag(chave, mostrar) {
    const guilda = this.guildaDoJogador(chave);

    if (!guilda) return { ok: false, motivo: "semGuilda" };

    const membro = guilda.membros.get(chave);

    if (!membro) return { ok: false, motivo: "semGuilda" };

    const alvo = mostrar === true;

    if (membro.mostrarTag === alvo) {
      return { ok: false, motivo: "igual" };
    }

    membro.mostrarTag = alvo;

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

      /**
       * SEMPRE DESLIGADA ao entrar.
       *
       * Porque a tag e exibida sobre o boneco, no mundo, para todo mundo ver.
       * Ligar isso sem o jogador pedir seria botar o nome da guilda de outra
       * pessoa no meio da tela dele — e a escolha tem de ser de quem entra
       */
      mostrarTag: false,
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
   * SOBE UM DEGRAU de um talento da arvore.
   *
   * Os pontos sao do jogador que gasta e o talento e da guilda: e o
   * "todo mundo ajuda" do desenho. Um membro sobe o degrau, e todos os
   * outros ganham o bonus
   *
   * ## AS QUATRO RECUSAS
   *
   * Cada uma fecha uma porta diferente, e a ordem importa:
   *
   * 1. **o no nao existe** — id errado
   * 2. **ja esta no topo** — `talentNoMaximo`. Antes do saldo: um no no
   *    Nv. 5 nao aceita mais ponto, e a barra dele esta cheia ha dias
   * 3. **os pais nao subiram** — `talentPodeSubir`. O no e do MEIO ou do
   *    TOPO, e a raiz ainda esta no Nv. 0
   * 4. **o jogador nao tem ponto** — o unico lugar onde o custo sai
   *
   * O `custo` volta no resultado porque o SERVIDOR e quem desconta o
   * ponto do jogador: o store nao guarda saldo (o ponto e da sessao), e
   * quem cobra precisa saber quanto foi
   *
   * ## O QUE MUDA: UM PONTO, E O NIVEL SAI DEPOIS
   *
   * O `Map` guarda o TOTAL de pontos do no, nao o nivel. Este metodo soma
   * `1` e devolve — e o nivel e derivado das marcas, em `talentNivel`.
   * Guardar o nivel aqui obrigaria a conta do nivel a existir em dois
   * lugares, e a barra do painel a depender dela
   */
  atribuirPonto(chave, guildaId, talentId, pontosDoJogador) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    const node = getTalent(talentId);

    if (!node) return { ok: false, motivo: "talentNaoExiste" };

    if (talentNoMaximo(talentId, guilda.talentos)) {
      return { ok: false, motivo: "talentNoMaximo" };
    }

    if (!talentPodeSubir(talentId, guilda.talentos)) {
      return { ok: false, motivo: "exigePai" };
    }

    if ((pontosDoJogador ?? 0) < GUILD_TALENT_POR_CLIQUE) {
      return { ok: false, motivo: "pontosInsuficientes" };
    }

    const jaRecebidos = talentPontos(talentId, guilda.talentos);

    const nivelAntes = talentNivel(talentId, guilda.talentos);

    guilda.talentos.set(talentId, jaRecebidos + GUILD_TALENT_POR_CLIQUE);

    const nivelDepois = talentNivel(talentId, guilda.talentos);

    return {
      ok: true,
      guilda,
      custo: GUILD_TALENT_POR_CLIQUE,
      pontos: jaRecebidos + GUILD_TALENT_POR_CLIQUE,
      nivel: nivelDepois,
      nivelMax: GUILD_TALENT_NIVEL_MAX,

      /**
       * O CLIQUE SUBIU O NIVEL, ou so encheu a barra.
       *
       * E a distincao que o painel usa para decidir se vale a pena
       * avisar: um clique e o caso comum — a barra sobe um ponto — e a
       * maioria dos cliques nao muda nenhum stat. Sem este campo, o
       * painel anunciaria "Nv. 2!" quatro vezes para o mesmo nivel
       *
       * E o servidor que avisa o jogador quando isso acontece, porque o
       * bonus so entra no personagem nessa hora
       */
      subiuDeNivel: nivelDepois > nivelAntes,
    };
  }

/* ------------------------------------------------------------------
     O COFRE
     ------------------------------------------------------------------ */

  /**
   * O COFRE da guilda: moedas e itens, e so a diretoria mexe.
   *
   * A regra do jogador e literal: **so o lider e o co-lider tocam no
   * cofre**. Nao existe deposito de membro comum, e essa consequencia
   * e aceita — um cofre que so a diretoria abre nunca enche sozinho
   *
   * ## POR QUE CADA MOVIMENTO E UMA OPERACAO SO
   *
   * Depositar "500 moedas e este item" em um pedido so exigiria um meio
   * caminho, e o meio caminho e onde o item se perde: as moedas entram, o
   * cofre esta cheio, o item volta para a mochila do jogador... e se o
   * servidor cair no meio, as moedas ja foram e o item nao voltou
   *
   * Com uma operacao por pedido, cada uma tem UM ponto de falha e um
   * caminho de volta. O item nunca e recebido sem lugar, e a moeda nunca
   * e debitada sem ser creditada
   *
   * ## O QUE CADA RECUSA FECHA
   *
   * 1. **sem permissao** — `semCargo`
   * 2. **o item nao existe** — veio do cliente, entao nao e confiavel
   * 3. **a quantidade e zero ou negativa** — `quantidade`
   * 4. **a mochila nao tem** — e o mais comum
   * 5. **o destino nao cabe** — o cofre cheio no deposito, a mochila
   *    cheia no saque. E o unico caso em que o item volta inteiro
   */
  mexerNoCofre(chave, guildaId, acao, dados = {}) {
    const guilda = this.get(guildaId);

    if (!guilda) return { ok: false, motivo: "guildaNaoExiste" };

    if (!podeGerenciar(guilda, chave)) {
      return { ok: false, motivo: "semCargo" };
    }

    const cofre = this.cofreDe(guilda);

    /**
     * O QUE FOI PEDIDO, resolvido por tipo.
     *
     * `moeda` e `item` sao os dois caminhos, e nao ha um terceiro: o
     * que um slot de item e uma quantidade significam ja esta escrito
     * nos dois metodos abaixo
     */
    if (dados.moeda !== undefined) {
      return acao === "retirar"
        ? this.sacarMoedas(cofre, dados.moeda)
        : this.depositarMoedas(cofre, dados.moeda);
    }

    if (dados.item !== undefined) {
      return acao === "retirar"
        ? this.sacarItem(cofre, dados.item, dados.quantidade)
        : this.depositarItem(cofre, dados.item, dados.quantidade);
    }

    return { ok: false, motivo: "cofreInvalido" };
  }

  /**
   * O COFRE de uma guilda, criando se ela nunca recebeu um.
   *
   * Criar na leitura e o que faz `snapshotPara` poder mostrar `moedas: 0`
   * e `slots: []` sem um `if` em cada lugar — e o que impede a recusa
   * "cofre nao existe" de existir, ja que toda guilda tem um
   */
  cofreDe(guilda) {
    if (!guilda.cofre) {
      guilda.cofre = { slots: [], moedas: 0 };
    }

    return guilda.cofre;
  }

  /**
   * DEPOSITA moedas.
   *
   * O desconto e do SERVIDOR, nao daqui: o dinheiro mora na sessao e o
   * store nao sabe o saldo. O que este metodo e guarda e o outro lado —
   * o `cofre.moedas`, que e do store e nao de ninguem
   *
   * E o valor pedido e o valor a adicionar. Quem cobra passa o saldo
   * inteiro: e o que impede um `descontar` parcial e um credito cheio
   * quando um dos dois falha
   */
  depositarMoedas(cofre, valor) {
    const moedas = Math.floor(Number(valor) || 0);

    if (moedas <= 0) return { ok: false, motivo: "quantidade" };

    cofre.moedas += moedas;

    return { ok: true, cofre, moedas };
  }

  /**
   * SACA moedas do cofre.
   *
   * O piso e o saldo do cofre, e nao um `min`: um saque maior que o que
   * tem e recusado, em vez de sacar tudo e o jogador achar que sacou o
   * numero que pediu
   */
  sacarMoedas(cofre, valor) {
    const moedas = Math.floor(Number(valor) || 0);

    if (moedas <= 0) return { ok: false, motivo: "quantidade" };

    if (cofre.moedas < moedas) {
      return { ok: false, motivo: "cofreSemMoedas" };
    }

    cofre.moedas -= moedas;

    return { ok: true, cofre, moedas };
  }

  /**
   * O SLOT de um item no cofre, pelo `uid` do slot.
   *
   * A busca e por `uid` e nao por `itemId`: o cofre guarda o MESMO item
   * em raridades diferentes, e um saque que casasse por `itemId` tiraria
   * a raridade errada. E o que impede um lootingrar com dois slots iguais
   * de devolver o item duas vezes
   */
  slotDoCofre(cofre, uid) {
    return cofre.slots.find((s) => s.uid === uid) ?? null;
  }

  /**
   * DEPOSITA um item da mochila.
   *
   * O `uid` e da MOCHILA do jogador, e o servidor e que tira o item de la
   * antes de chamar aqui. O store nao conhece a mochila: ele so sabe o
   * que ja esta no cofre
   *
   * ## O ITEM VOLTA INTEIRO SE O COFRE NAO CABE
   *
   * E o unico lugar do jogo inteiro em que um item pode voltar. A
   * alternativa — guardar do mesmo jeito e o jogador descobrir depois que
   * sumiram — e pior que a recusa, porque o item nao tem nem lugar onde
   * foi parar
   *
   * ## A FUSAO E A MESMA DA MOCHILA
   *
   * Um material de 40 que entra num cofre que ja tem 30 vira uma pilha de
   * 70, e nao duas. Sem isso o cofre encheria de duplicatas do mesmo
   * material e ocuparia um slot por deposito
   */
  depositarItem(cofre, entrada, quantidade) {
    const itemId = entrada?.itemId;

    if (!itemId) return { ok: false, motivo: "cofreInvalido" };

    const count = Math.floor(Number(quantidade) || 0);

    if (count <= 0) return { ok: false, motivo: "quantidade" };

    const rarity = entrada.rarity ?? null;

    // ## A FUSAO, com a mesma regra da `Inventory`: so com item E
    // ## raridade iguais. `??` porque um slot antigo pode ter o campo
    // ## fora, e a raridade de catalogo e o que o `add` usaria
    const existente = cofre.slots.find(
      (s) =>
        s.itemId === itemId &&
        (s.rarity ?? null) === (rarity ?? null),
    );

    const total = (existente?.quantidade ?? 0) + count;

    /**
     * O COFRE CABE NESSE ITEM?
     *
     * Uma pilha de material nao tem teto no cofre — e o que o
     * `maxStack` da mochila nao governa, porque o cofre nao e equipamento
     * e nao tem limite de pilha. O que limita e a quantidade de SLOTS
     */
    if (!existente && cofre.slots.length >= GUILD_COFRE_SLOTS_MAX) {
      return { ok: false, motivo: "cofreCheio" };
    }

    if (existente) {
      existente.quantidade = total;
    } else {
      cofre.slots.push({
        uid: entrada.uid ?? this.novoUidSlot(),
        itemId,
        rarity,
        quantidade: count,
        nome: entrada.nome ?? itemId,
        enchant: entrada.enchant ?? null,
      });
    }

    return { ok: true, cofre, itemId, count };
  }

  /**
   * SACA um item do cofre para a mochila.
   *
   * O `soltar` e o destino, e ele e quem devolve o item se a mochila
   * estiver cheia: um `add` parcial deixaria parte do item num lugar e
   * parte em outro, e o jogador veria "saquei 40" com 20 no cofre e 20 na
   * mochila sem nenhum aviso
   *
   * O parametro existe por um motivo so — o store nao conhece a mochila.
   * Quem sabe o que cabe nao e este arquivo, e sim quem tem o
   * `Inventory` na mao: o servidor
   */
  sacarItem(cofre, uid, quantidade, soltar = null) {
    const slot = this.slotDoCofre(cofre, uid);

    if (!slot) return { ok: false, motivo: "cofreSemItem" };

    const pedido = Math.floor(Number(quantidade) || 0);

    if (pedido <= 0) return { ok: false, motivo: "quantidade" };

    if (slot.quantidade < pedido) {
      return { ok: false, motivo: "cofreSemItem" };
    }

    /**
     * SEM DESTINO, E SO A CONTAGEM.
     *
     * O `soltar` ausente nao e erro: quem chama pode estar so
     * conferindo se o item existe e quanto tem. O item SAI do cofre
     * apenas quando houve para onde ir
     */
    if (soltar) {
      const recebido = soltar(slot.itemId, pedido, slot.rarity);

      if (recebido.added < pedido) {
        return { ok: false, motivo: "mocheiraCheia" };
      }
    }

    slot.quantidade -= pedido;

    if (slot.quantidade <= 0) {
      cofre.slots.splice(cofre.slots.indexOf(slot), 1);
    }

    return {
      ok: true,
      cofre,
      itemId: slot.itemId,
      rarity: slot.rarity,
      count: pedido,
      enchant: slot.enchant,
    };
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

    this.cofreDe(guilda).moedas += Math.max(
      0,
      Math.floor(Number(coins) || 0),
    );

    return guilda.cofre;
  }

  /** um id de slot novo, para quando o item veio sem `uid` */
  novoUidSlot() {
    this.seqSlot = (this.seqSlot ?? 0) + 1;

    return `cofre_${this.seqSlot}`;
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
         * A arvore aparece mesmo sem guilda, toda zerada.
         *
         * E o que mostra ao jogador o que ele PODE subir se criar uma —
         * esconder a arvore faria a aba parecer quebrada
         *
         * E ela vem com a PORCENTAGEM ja calculada contra o saldo do
         * jogador, e nao zerada: quem esta fora de guilda mas tem pontos
         * acumulado ve o quanto ja runner up do primeiro degrau, e isso
         * e o que convence a criar a guilda agora em vez de depois
         *
         * `cofre: null` e explicito, e nao omitido: o painel pergunta
         * pelo cofre sem perguntar se tem guilda antes, e `undefined`
         * seria um terceiro estado que so o painel saberia tratar
         */
        cofre: null,
        arvore: arvoreSnapshot(new Map(), pontos ?? 0),
      };
    }

    return {
guilda: {
        id: guilda.id,
        nome: guilda.nome,
        tag: guilda.tag,

        /**
         * O ESTILO, com o HEX e nao o ID.
         *
         * O ID e o que viaja no pedido e no disco; o hex e o que o painel
         * pinta. Converter aqui, e nao no painel, e o que mantem a lista de
         * cores em um lugar so — o painel nunca conhece os onze valores
         */
        icone: guilda.icone,
        cor: corDaGuilda(guilda.cor),
        corId: guilda.cor,
membros: [...guilda.membros.values()].map((m) => ({
          id: m.id,
          nome: m.nome,
          papel: m.papel,

          /**
           * O `jogadorId` e o `m.id`, e nao um `m.chave`.
           *
           * O membro nao tem campo `chave`: a chave ESTEVE no `id`, que
           * e a `donoKey`. Ler `m.chave` dava `undefined` em todos os
           * membros, o que mandava `jogadorId: undefined` ao painel e
           * deixava `eu` sempre falso — o jogador nunca via qual linha
           * era a dele na aba Membros
           *
           * O `id` volta tambem porque e ele que o painel usa para
           * conferir os botoes de expulsar e passar a lideranca
           */
          jogadorId: m.id,
          eu: m.id === chave,

          /**
           * SE ESTE MEMBRO ESTA COM A TAG LIGADA.
           *
           * E por membro porque a opcao e sobre o boneco de cada um: o
           * jogador liga a sua, e nao a dos outros. E volta no snapshot
           * inteiro porque a aba de Configuracoes mostra a sua propria opcao
           * e a aba Membros mostra a de todo mundo
           */
          mostrarTag: m.mostrarTag === true,
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

      arvore: arvoreSnapshot(guilda.talentos, pontos ?? 0),

// o cofre so vem no painel de quem pode mexer nele. Membro comum
      // recebe `null` e o painel nem desenha a aba
      cofre:
        podeGerenciar(guilda, chave) && guilda.cofre
          ? { slots: guilda.cofre.slots, moedas: guilda.cofre.moedas }
          : null,
    };
  }

  /* ------------------------------------------------------------------
     DISCO
     ------------------------------------------------------------------ */

  /**
   * AS GUILDAS como um objeto simples.
   *
   * ## POR QUE ISTO EXISTE
   *
   * Sem esta funcao a guilda vivia so no `this.guilds`, e uma guilda
   * evaporava com o processo: o jogador criava, via o clan ativo, e no
   * relog (ou no primeiro reinicio do servidor) voltava para "criar ou
   * buscar". O save do personagem guarda os PONTOS do jogador, mas nao a
   * qual guilda ele pertence — e e o store que e o dono dessa ligacao
   *
   * O que entra e o que o store precisa para responder as MESMAS
   * perguntas depois de recarregar: o `id`, o nome normalizado (para o
   * conflito e a busca), o lider, os membros COM A CHAVE (e o que
   * refaz o indice `guildaDaChave`), os pedidos, os talentos por nivel,
   * o cofre e a data
   *
   * O `Map` vira lista de pares e o `Set` vira lista: nenhum dos dois
   * sobrevive ao JSON, e um `Map` vazio num arquivo lido de volta e uma
   * guilda que perdeu todos os membros sem nenhum aviso
   */
  toSave() {
    return [...this.guilds.values()].map((guilda) => ({
      id: guilda.id,
      nome: guilda.nome,
      tag: guilda.tag,
      liderId: guilda.liderId,
      coLiderId: guilda.coLiderId,
      criadoEm: guilda.criadoEm,

      /**
       * O ESTILO da guilda, por ID e nao por hex.
       *
       * E o ID e nao o hex pelo mesmo motivo que o pedido usa ID: o arquivo
       * de guildas e lido por este mesmo `carregar`, e um hex escrito a mao
       * num arquivo editado na mao viraria cor que o motor nao conhece. Com o
       * ID, `validarEstiloGuilda` descarta o que nao existe na leitura
       */
      icone: guilda.icone,
      cor: guilda.cor,

      /**
       * Os MEMBROS com a chave no `id`.
       *
       * O `id` do membro JA e a chave — e o mesmo valor que o
       * `guildaDaChave` indexa — entao ele e quem sobrevive. E ele que
       * faz o jogador voltar a encontrar a guilda pelo nome normalizado
       * depois do relog
       */
      membros: [...guilda.membros.values()].map((m) => ({
        id: m.id,
        nome: m.nome,
        papel: m.papel,
        desde: m.desde,

        /**
         * A OPCIONAL DE TAG deste membro.
         *
         * Vai para o disco porque e uma escolha do jogador sobre o proprio
         * boneco, e o relog nao pode esquecela: sem este campo, quem ligou a
         * tag entraria no jogo de novo com a tag desligada sem saber por que
         */
        mostrarTag: m.mostrarTag === true,
      })),

      pedidos: guilda.pedidos.map((p) => ({
        chave: p.chave,
        nome: p.nome,
        classe: p.classe,
        pedidoEm: p.pedidoEm,
      })),

      /**
       * Os Talentos como lista de pares `[id, nivel]`.
       *
       * E o `Map` do nivel, e um `Set` de ids seria um arquivo que nao
       * distingue "subiu um degrau" de "subiu cinco"
       */
      talentos: [...guilda.talentos.entries()],

      cofre: guilda.cofre
        ? {
            slots: guilda.cofre.slots,
            moedas: guilda.cofre.moedas,
          }
        : null,
    }));
  }

  /**
   * Recarrega as guildas do arquivo.
   *
   * ## POR QUE UM INDICE, E NAO UM MAP CHEIO DE CONFIANÇA
   *
   * O arquivo pode ter sido editado a mao, vir de uma versao futura ou
   * ficar pela metade. Cada guilda passa por um filtro, e uma guilda que
   * falha o filtro e DESCARTADA em vez de entrar pela metade: uma guilda
   * sem lider nao tem quem promova, e uma guilda com um `id` repetido
   * faria dois jogadores aparecerem na mesma
   *
   * Os dois indices sao refeitos aqui, e nao guardados no arquivo:
   * `nomes` e um derivado do nome (busca e conflito) e `guildaDaChave` e
   * um derivado dos membros. Guardar os dois no disco seria guardar duas
   * copias que so podem divergir da terceira
   *
   * A `sequencia` do `novoId` andou ate o maior id numerico do arquivo,
   * para uma guilda nova criada depois do reload NAO colidir com uma que
   * ja estava la
   */
  fromSave(bruto) {
    if (!Array.isArray(bruto)) return 0;

    let carregadas = 0;

    let maiorNumero = -1;

    for (const item of bruto) {
      const guilda = guildaLegivel(item);

      if (!guilda) continue;

      // um id repetido faria a segunda sobrescrever a primeira no
      // `guilds`, e um membro ficaria em duas guildas ao mesmo tempo
      if (this.guilds.has(guilda.id)) continue;

      this.guilds.set(guilda.id, guilda);
      this.nomes.add(normalizarNome(guilda.nome));

      for (const membro of guilda.membros.values()) {
        this.guildaDaChave.set(membro.id, guilda.id);
      }

      carregadas += 1;

      const numero = numeroDoId(guilda.id);

      if (numero > maiorNumero) maiorNumero = numero;
    }

    this.sequencia = maiorNumero + 1;

    return carregadas;
  }
}

/**
 * O numero de um id no formato `g_7`.
 *
 * O `novoId` do store gera `g_` mais um contador, e e esse contador que
 * precisa continuar de onde parou depois do reload
 */
function numeroDoId(id) {
  const numero = Number(String(id ?? "").replace(/^g_/, ""));

  return Number.isFinite(numero) ? numero : -1;
}

/**
 * UMA GUILDA do arquivo, ou `null` se nao presta.
 *
 * O filtro e o mesmo espirito do `pagamentosLegiveis` do mercado: um
 * arquivo pela metade devolve `null` e a guilda e descartada. O que
 * obrigatorio e o `id` (sem ele a guilda nao tem endereco) e o `nome`
 * (sem ele a busca e o conflito nao funcionam)
 *
 * O LIDER e conferido contra os membros, e nao aceito como veio: um
 * `liderId` apontando para alguem que nao esta na lista produziria uma
 * guilda que ninguem pode administrar e ninguem pode expulsar. Nesse
 * caso a guilda sobe assim mesmo, com o primeiro membro como lider — o
 * que o arquivo quis dizer e que sobrou gente
 */
function guildaLegivel(bruto) {
  if (!bruto || typeof bruto !== "object") return null;

  const id = String(bruto.id ?? "").trim();

  const nome = String(bruto.nome ?? "").trim();

  if (!id) return null;
  if (nome.length < GUILD_NOME_MIN) return null;

  const membros = new Map();

  for (const brutoMembro of bruto.membros ?? []) {
    const chave = String(brutoMembro?.id ?? "").trim();

    if (!chave) continue;

    membros.set(chave, {
      id: chave,
      nome: String(brutoMembro?.nome ?? chave).trim(),
      papel:
        brutoMembro?.papel === GUILD_ROLE.CO_LIDER
          ? GUILD_ROLE.CO_LIDER
          : GUILD_ROLE.MEMBRO,
      desde: Number(brutoMembro?.desde) || 0,

      /**
       * A TAG SO VOLTA LIGADA SE O ARQUIVO DIZER ISSO.
       *
       * E `=== true` e nao `Boolean(...)`: um arquivo escrito antes da opcao
       * existir nao tem o campo, e `Boolean(undefined)` seria `false` — que
       * e o certo aqui. O que seria errado e o contrario: tratar campo
       * ausente como ligado, e todo mundo que entrasse numa guilda antiga
       * aparecia no mundo com a tag sem nunca ter pedido
       */
      mostrarTag: brutoMembro?.mostrarTag === true,
    });
  }

  if (membros.size === 0) return null;

  const liderId = membros.has(String(bruto.liderId ?? ""))
    ? String(bruto.liderId)
    : [...membros.keys()][0];

  const coLiderId = membros.has(String(bruto.coLiderId ?? ""))
    ? String(bruto.coLiderId)
    : null;

  const talentos = new Map();

  for (const par of bruto.talentos ?? []) {
    const [talentId, pontos] = Array.isArray(par) ? par : [];

    if (!talentId) continue;
    if (!getTalent(talentId)) continue;

    /**
     * O valor lido e o do formato ATUAL: pontos atribuitos.
     *
     * O `Map` passou a guardar o total de pontos de cada no, e nao o nivel
     * — o nivel e derivado das marcas. Um arquivo do formato antigo, que
     * gravava o nivel, e convertido para pontos pela ultima marca que
     * aquele nivel alcancava: um no que estava no Nv. 2 (marca 10) volta
     * com 10 pontos, que e o mesmo estado e a mesma barra
     *
     * Sem essa conversao, o `Math.min(nivel)` de antes gravaria 2 e a
     * barra do no passaria a mostrar 2 de 40 — um no que o jogador tinha
     * comprado inteiro aparecia com 5% depois do reinicio
     */
    talentos.set(
      String(talentId),
      Math.max(0, Math.floor(Number(pontos) || 0)),
    );
  }

  return {
    id,
    nome,
    tag: normalizarTag(bruto.tag),
    liderId,
    coLiderId,
    membros,

    /**
     * O ESTILO lido do arquivo, e revalidado na leitura.
     *
     * Passa pelo `validarEstiloGuilda` porque este arquivo pode ter sido
     * editado a mao: um `icone` ou uma `cor` que nao existam no catalogo
     * cairiam no padrao em vez de virar `undefined` e quebrar o painel
     */
    ...validarEstiloGuilda({ icone: bruto.icone, cor: bruto.cor }),
    pedidos: (bruto.pedidos ?? [])
      .filter((p) => p && p.chave)
      .map((p) => ({
        chave: String(p.chave),
        nome: String(p.nome ?? p.chave),
        classe: String(p.classe ?? ""),
        pedidoEm: Number(p.pedidoEm) || 0,
      })),
    talentos,
    cofre: bruto.cofre
      ? {
          slots: Array.isArray(bruto.cofre.slots)
            ? bruto.cofre.slots
            : [],
          moedas: Math.max(0, Number(bruto.cofre.moedas) || 0),
        }
      : null,
    criadoEm: Number(bruto.criadoEm) || 0,
  };
}

/**
 * A ARVORE como o painel a consome.
 *
 * Cada no vem com o estado inteiro do degrau — nivel, se esta no topo, a
 * porcentagem, e se o jogador pode subir agora — porque essa decisao e do
 * servidor e a tela nao tem como refaze-la sem duplicar as regras
 *
 * ## O CUSTO NAO ENTRA, E E DE PROPOSITO
 *
 * O numero do degrau e segredo, e este e o unico lugar que monta o
 * payload que viaja no socket. Mandar o `custo` e o painel voltar a
 * mostrar, nao importa o que o JSX faça com ele: o `GameClient` guarda o
 * pacote inteiro e qualquer um que abrir o console le o numero
 *
 * O que viaja e a PORCENTAGEM e um `temPontos` booleano. A porcentagem
 * responde "esta perto?" e o booleano responde "da para subir agora?",
 * que sao as duas perguntas que o painel faz — nenhuma delas precisa do
 * valor
 */
function arvoreSnapshot(talentos, pontos) {
  return GUILD_TALENTS.map(
    (node) => talentProgresso(node.id, talentos, pontos ?? 0),
  );
}
