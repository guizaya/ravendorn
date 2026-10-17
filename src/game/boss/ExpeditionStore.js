import { chefePorId, DIFICULDADES } from "../../data/bosses/index.js";

/**
 * AS EXPEDIÇÕES DO CHEFE.
 *
 * ## POR QUE ISTO É UM STORE E NÃO UM ARRAY NO MOTOR
 *
 * Porque expedição é estado do MUNDO, não da sessão. A guilda é o mesmo
 * problema e a mesma solução: um store criado pelo `GameServer` e passado ao
 * motor, que o consulta por referência
 *
 * A consequência prática é a que importa: uma expedição criada por um jogador
 * aparece para os outros porque os dois estão lendo o MESMO `Map`. Se cada
 * `GameEngine` tivesse o seu array, cada jogador veria um mundo só dele — e o
 * botão "entrar" não teria em quem clicar
 *
 * ## E POR QUE NÃO ESTÁ NO SAVE
 *
 * Porque o save é do PERSONAGEM. A expedição sobrevive ao jogador sair do
 * jogo, e se ela fosse gravada no `CharacterSave` de quem criou, desapareceria
 * junto — e o grupo|leaderado por alguém que saiu seria um grupo em que não dá
 * para mais entrar
 *
 * ## E O QUE ESTÁ AQUI, E O QUE NÃO
 *
 * Está a lista, o dono, os membros e o lugar de cada um. NÃO está a
 * recompensa, o loot, o chefão vivo ou a zona: nenhum desses existe ainda, e a
 * expedição é um **acordo de intenção** — "cinco pessoas vão às 20h tentar o
 * III". Nada aqui dá poder no mundo, então nada aqui é explorável
 */

/**
 * O MÁXIMO DE MEMBROS, E ELE MORA AQUI E NÃO NO PAINEL.
 *
 * Porque cinco é o número de lugares do chefe, e é o servidor que decide se
 * cabe mais. Se o valor viesse do pedido, um cliente alterado criaria a
 * expedição com `max: 999` e ela nunca lotaria — e "lotada" é justamente a
 * condição que o painel usa para mostrar "entrar" desligado
 */
export const EXPEDICAO_MAX_MEMBROS = 5;

/**
 * OS MOTIVOS DE RECUSA, e o motivo de serem uma lista nomeada.
 *
 * Porque o store devolve TEXTO e não código solto: um código sem lista em lugar
 * nenhum quebraria assim que alguém acrescentasse uma regra nova — o painel
 * receberia a string e a traduziria por `switch`, e o aviso de "você já está
 * numa party" passaria a sumir em silêncio
 *
 * E a lista mora aqui porque é o store que recusa. O painel só traduz
 */
export const EXPEDICAO_ERROS = {
  SEM_JOGADOR: "sem jogador",
  SEM_CHEFE: "sem chefe",
  DIFICULDADE: "dificuldade invalida",

  /**
   * A TRAVA DA PARTY.
   *
   * Ela NÃO é conferida aqui dentro, e é o ponto: o `ExpeditionStore` não
   * conhece party. Party é grupo que anda pelo mundo com loot dividido;
   * expedição é acordo de intenção sobre um chefe. São estados diferentes, e
   * quem conhece os dois é o `GameServer` — é lá que a regra é aplicada
   *
   * E o motivo é declarado aqui de qualquer forma, para o painel ter a frase
   * pronta como tem as outras. Se a regra mudar, a lista avisa o que sumiu
   */
  EM_PARTY: "voce esta em uma party",
};


export class ExpeditionStore {
  constructor({ agora = () => Date.now(), maximo = EXPEDICAO_MAX_MEMBROS } = {}) {
    this.agora = agora;

    /**
     * O MÁXIMO DE MEMBROS VEM DA ENTRADA, E NÃO DE CADA CHEFE.
     *
     * O chefe tem cinco lugares, e toda expedição leva a quantia que cabe. Se
     * cada chefe tivesse o seu número, a Difficulty III lotaria com cinco e a
     * I com dois — e o jogador teria que lembrar qual é qual antes de criar
     */
    this.maximo = maximo;

    /**
     * O ID DA EXPEDIÇÃO.
     *
     * É o tempo, e não um contador: dois jogadores clicando em "criar" no
     * mesmo milissegundo precisam cair em chaves diferentes, e `Date.now()` é o
     * único número que os dois lados do servidor já têm
     */
    this.proximoId = 1;

    /**
     * AS EXPEDIÇÕES, POR ID.
     *
     * E um `Map` e não um array porque toda operação do painel é por id — listar
     * é o único lugar que itera, e ele precisa de ordem
     */
    this.expedicoes = new Map();

    /**
     * EM QUE EXPEDIÇÃO CADA JOGADOR ESTÁ.
     *
     * É um índice invertido de propósito. A regra "um jogador, uma expedição"
     * precisa responder "onde está o jogador X?" a cada criação e a cada
     * entrada, e varrer a lista para isso é O(n) num lugar chamado toda vez que
     * alguém mexe num grupo
     */
    this.doJogador = new Map();
  }

  /**
   * UM RESUMO DA EXPEDIÇÃO, DO JEITO QUE O PAINEL LÊ.
   *
   * ## POR QUE VOLTA COPIA E NÃO O OBJETO
   *
   * Porque este store vai inteiro pelo `JSON.stringify` do pacote de painel, e
   * uma referência viva dentro do pacote seria serializada como `{}` no `Map`
   * e vazada para o cliente. Copiar aqui é o que mantém o store privado: o
   * cliente nunca enxerga `membros` como `Map`, nem um campo interno
   *
   * E o `souLider` e `estouAqui` sao derivados por `jogadorId`, e nao campos
   * guardados. O store nao guarda "quem esta marcado" — ele guarda quem esta,
   * e a tela decide o que isso significa
   */
  resumo(expedicao, jogadorId) {
    return {
      id: expedicao.id,
      nome: expedicao.nome,
      dificuldade: expedicao.dificuldade,
      chefeId: expedicao.chefeId,
      max: expedicao.max,
      membros: expedicao.membros.length,
      lotada: expedicao.membros.length >= expedicao.max,
      souLider: expedicao.lider === jogadorId,
      estouAqui: expedicao.membros.includes(jogadorId),
    };
  }

  /**
   * A LISTA QUE O PAINEL VÊ.
   *
   * A ordem é a mesma da lista: **o jogador primeiro**, depois as mais novas.
   * Quem procura grupo quer o próprio grupo na frente, e quer saber o que
   * acabou de aparecer — a expedição mais velha é a que já está cheia há muito
   * tempo e ninguém vai entrar
   */
  listar(jogadorId, { chefeId = null, dificuldade = null } = {}) {
    const lista = [...this.expedicoes.values()]
      .filter((e) => (chefeId === null ? true : e.chefeId === chefeId))
      .filter((e) =>
        dificuldade === null ? true : e.dificuldade === dificuldade,
      );

    return lista
      .map((e) => ({
        e,
        oMeuOuEntrou: e.lider === jogadorId || e.membros.includes(jogadorId),
      }))
      .sort(
        (a, b) =>
          Number(b.oMeuOuEntrou) - Number(a.oMeuOuEntrou) ||
          b.e.id - a.e.id,
      )
      .map(({ e }) => this.resumo(e, jogadorId));
  }

  /**
   * A EXPEDIÇÃO DE UM JOGADOR, ou `null`.
   *
   * É o índice invertido virando leitura. O painel chama isto no render para
   * trocar o rodapé entre "procurar/criar" e "ver expedição", e ele precisa ser
   * barato porque roda a cada quadro do pacote
   */
  de(jogadorId) {
    const id = this.doJogador.get(jogadorId);

    if (id === undefined) return null;

    const expedicao = this.expedicoes.get(id);

    if (!expedicao) return null;

    return this.resumo(expedicao, jogadorId);
  }

  /**
   * A PRIMEIRA VAGA DE UM CHEFE.
   *
   * E o que `criar` usa para achar um lugar, e é o que impede que dois grupos
   * do mesmo chefe e da mesma dificuldade existam ao mesmo tempo. Sem isso, o
   * jogador acharia uma expedição com 1 de 5 lugares e não teria para onde ir
   */
  vagaPara(chefeId, dificuldade) {
    for (const expedicao of this.expedicoes.values()) {
      if (expedicao.chefeId !== chefeId) continue;
      if (expedicao.dificuldade !== dificuldade) continue;
      if (expedicao.membros.length < expedicao.max) return expedicao;

      return null;
    }

    return null;
  }

  /**
   * CRIAR.
   *
   * ## POR QUE O SERVIDOR INVENTA O NOME
   *
   * Porque o `nome` do pedido é ignorado de propósito. É o mesmo nome que o
   * jogador dá ao personagem, e o painel é quem decide o formato
   * ("Expedicao de Fulano"). Se o servidor aceitasse o texto do pedido, um
   * cliente adulterado criaria uma expedição de 3000 caracteres ou com o nome
   * de outro jogador — e essa linha aparece para todo mundo que procurar
   * grupo
   *
   * ## E POR QUE A DIFICULDADE VEM DO PEDIDO
   *
   * Porque aqui é o contrário do nome: a dificuldade é uma escolha de WHICH
   * boss run, e o servidor valida se ela existe. O que não pode é o jogador
   * escolher coisas que o servidor deveria decidir — e a dificuldade não é uma
   * delas: o chefe tem três e as três são públicas
   */
  criar({ jogadorId, jogadorNome, chefeId, dificuldade }) {
    if (!jogadorId || typeof jogadorNome !== "string") {
      return { erro: "sem jogador" };
    }

    /**
     * O CHEFE PRECISA EXISTIR, E A CONFERÊNCIA É AQUI DENTRO.
     *
     * O `GameServer` também confere, e é a primeira barreira. Esta é a
     * segunda: o store é quem tem os dados, e um store que aceita qualquer
     * texto em `chefeId` fica a um `criar()` de distância de ser chamado por
     * outro caminho — um teste, um script de manutenção, um comando de
     * servidor novo — e nenhum deles passaria pela validação do `case`
     *
     * E o erro é o MESMO ("sem chefe") que o `!chefeId` daria. O painel não
     * precisa saber a diferença entre "não veio chefe" e "chefe que não existe":
     * para o jogador é a mesma ação — escolher um chefe
     */
    if (!chefeId || !chefePorId(chefeId)) {
      return { erro: "sem chefe" };
    }

    if (!DIFICULDADES[dificuldade]) {
      return { erro: "dificuldade invalida" };
    }

    /**
     * UM JOGADOR, UMA EXPEDIÇÃO.
     *
     * Entrar em duas é recusado pelo `entrar`, mas criar não passa por lá — e
     * sem esta linha o jogador criava o segundo grupo com um clique e ficava
     * nos dois, que é o estado sem Meaning nenhum
     */
    const jaTem = this.doJogador.get(jogadorId);

    if (jaTem !== undefined) {
      return { erro: "ja esta em uma expedicao" };
    }

    const nome = `Expedicao de ${jogadorNome}`.slice(0, 28);

    const expedicao = {
      id: this.agora() + this.proximoId++,
      nome,
      dificuldade,
      chefeId,
      max: this.maximo,
      lider: jogadorId,
      membros: [jogadorId],
    };

    this.expedicoes.set(expedicao.id, expedicao);
    this.doJogador.set(jogadorId, expedicao.id);

    return { expedicao: this.resumo(expedicao, jogadorId) };
  }

  /**
   * ENTRAR.
   *
   * E recusada com motivo, e não silenciosamente, porque cada recusa é um caso
   * que o painel precisa mostrar: "está cheia", "você já está em outra",
   * "você organizou essa" — três textos diferentes para o jogador, e um `null`
   * genérico transformaria os três no mesmo silêncio
   */
  entrar({ jogadorId, expedicaoId }) {
    const expedicao = this.expedicoes.get(expedicaoId);

    if (!expedicao) return { erro: "expedicao nao existe" };

    const jaTem = this.doJogador.get(jogadorId);

    if (jaTem !== undefined) return { erro: "ja esta em uma expedicao" };

    if (expedicao.membros.length >= expedicao.max) {
      return { erro: "expedicao cheia" };
    }

    expedicao.membros.push(jogadorId);
    this.doJogador.set(jogadorId, expedicao.id);

    return { expedicao: this.resumo(expedicao, jogadorId) };
  }

  /**
   * SAIR.
   *
   * O LÍDER NÃO SAI: ele dissolve.
   *
   * Porque uma expedição sem líder não tem quem START, e um grupo de cinco sem
   * dono é um grupo que ninguém pode fechar. O painel oferece as duas ações
   * separadas por isso, e o store recusa sair do líder para que um cliente
   * adulterado não produza esse estado
   */
  sair({ jogadorId, expedicaoId }) {
    const expedicao = this.expedicoes.get(expedicaoId);

    if (!expedicao) return { erro: "expedicao nao existe" };

    if (expedicao.lider === jogadorId) {
      return { erro: "o lider dissolve, ele nao sai" };
    }

    expedicao.membros = expedicao.membros.filter((id) => id !== jogadorId);
    this.doJogador.delete(jogadorId);

    return { expedicao: this.resumo(expedicao, jogadorId) };
  }

  /**
   * DISSOLVER.
   *
   * Só o líder. E o `doJogador` de todo mundo é apagado, não só o do líder: sair
   * da lista sem tirar o índice invertido deixaria o membro preso em uma
   * expedição que não existe mais, e o `de()` dele devolveria um grupo morto
   */
  dissolver({ jogadorId, expedicaoId }) {
    const expedicao = this.expedicoes.get(expedicaoId);

    if (!expedicao) return { erro: "expedicao nao existe" };

    if (expedicao.lider !== jogadorId) {
      return { erro: "so o lider dissolve" };
    }

    for (const id of expedicao.membros) this.doJogador.delete(id);

    this.expedicoes.delete(expedicaoId);

    return { dissolvida: expedicaoId };
  }
}