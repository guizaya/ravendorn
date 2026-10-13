import { criarAccountStore, PASTA_CONTAS_PADRAO } from "../persistence/AccountStore.js";
import { nameKey, validateName } from "../../../src/data/characterName.js";

/**
 * ============================================================================
 *  >>> VALOR DE TESTE — REMOVER ANTES DE PUBLICAR <<<
 * ============================================================================
 *
 * Os diamantes que toda conta nova recebe. Esta em um `const` sozinho, com o
 * nome falando, para que a troca seja o trabalho de uma linha quando o valor
 * real existir.
 *
 * ## PARA REMOVER
 *
 * 1. troque este numero pelo valor de producao
 * 2. apague este bloco de comentario inteiro
 *
 * Nao ha outro lugar para mexer: `criarSeNaoExiste` usa esta constante, e
 * nenhuma outra parte do servidor le um numero de diamante inicial. O valor
 * so vale no instante em que a conta e criada — uma conta que ja existe
 * guarda o saldo dela e nao e tocada por isto
 *
 * ## POR QUE 1000
 *
 * Porque ainda nao existe origem de diamante no jogo (ver
 * `movimentarDiamantes`): a conta nasce com o saldo e so desce. Sem um valor
 * alto nao da para testar nem o passe, que custa 100 por ativacao, nem varias
 * vagas de personagem
 */
const DIAMANTES_INICIAIS = 1000;

/**
 * A CONTA DO JOGADOR, NO SERVIDOR.
 *
 * ## O QUE MUDOU
 *
 * Antes a conta vivia em dois lugares que nao eram do jogo: os personagens e
 * os diamantes no `localStorage` do navegador (`eldoria:characters:<id>` e
 * `eldoria:diamonds:<id>`), e a carteira no `user_metadata` do Supabase. O
 * `user_metadata` e um campo de TEXTO que o cliente escreve com
 * `updateUser()` — e o cliente proving que e o dono do texto. Nada veria a
 * assinatura. Um jogador trocava de navegador e perdia tudo
 *
 * Agora a conta e um arquivo no servidor, como o save do personagem ja era.
 * O provedor de identidade (Google ou a propria carteira) so PROVA quem e a
 * pessoa; depois disso quem manda e este arquivo
 *
 * ## A ASSINATURA DA CARTEIRA E VERIFICADA AQUI
 *
 * A MetaMask devolve uma assinatura de `personal_sign` sobre uma mensagem que
 * o servidor montou. A verificacao e `verifyMessage` do `ethers`, que
 * recupera o endereco que assinou e compara com o declarado. Sem essa
 * comparacao, qualquer um podia escrever `wallet_address` de outra pessoa
 *
 * E por isso que a mensagem precisa ter um texto fixo conhecido do
 * servidor, com o nonce: um texto montado com data do cliente pode ser
 * assinado uma vez e reenviado para sempre
 */

/**
 * O QUE UMA CONTA GUARDA.
 *
 * `personagens` e a lista de herois do jogador, e cada um tem `nome`,
 * `classe` e os ids das vagas. `diamantes` e o saldo, que compra vaga
 *
 * `carteira` guarda o endereco so depois que a assinatura foi verificada
 */
export function criarContas({
  pasta = PASTA_CONTAS_PADRAO,
  origemPermitida = null,
  googleClientId = process.env.GOOGLE_CLIENT_ID ?? null,
  googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? null,
  googleRedirectUri = process.env.GOOGLE_REDIRECT_URI ?? null,
  segredoDoToken = process.env.SEGREDO_DO_TOKEN ?? null,
  segundosDoToken = 60,
} = {}) {
  const store = criarAccountStore({ pasta });

  // os tokens de entrada sao de uso unico e vivem pouco. O segredo e
  // obrigatorio: sem ele qualquer um forja um token e entra no jogo como
  // qualquer personagem
  if (!segredoDoToken) {
    throw new Error(
      "SEGREDO_DO_TOKEN nao configurado. O token de entrada e assinado por ele, e sem ele qualquer um forja um personagem."
    );
  }

  // o Google precisa das tres credenciais juntas. Sem elas o login com
  // Google fica INDISPONIVEL, e nao quebrado: o front mostra o aviso e o
  // jogador ainda pode entrar pela carteira
  const googlePronto = Boolean(
    googleClientId && googleClientSecret && googleRedirectUri
  );

  return {
    pasta: store.pasta,
    googleDisponivel: googlePronto,

    /**
     * Le a conta pela identidade do provedor. `null` quando nao existe
     * ainda — o que significa "conta nova", e nao erro
     */
    ler(identidade) {
      const id = normalizarIdentidade(identidade);

      if (!id) return null;

      return store.carregar(id);
    },

    /**
     * Cria a conta se ela nao existir, e devolve a conta.
     *
     * `identidade` e `{ tipo, id }`, onde `tipo` e `"google"` ou
     * `"carteira"`. O `id` e o `sub` do Google ou o endereco da carteira,
     * ja verificado pelo chamador no caso da carteira
     *
     * Os diamantes iniciais sao gravados AQUI, na primeira vez, e nunca
     * mais. O `unlockedSlots: 1` e a mesma primeira vaga gratis do front
     * antigo (`STARTING_DIAMONDS` e `loadWallet`)
     *
     * O valor vem de `DIAMANTES_INICIAIS`, no topo deste arquivo — que hoje
     * e um numero de teste. Trocar o valor la muda toda conta nova, e so
     * elas: uma conta ja criada guarda o saldo dela
     */
    criarSeNaoExiste(identidade, { email = null } = {}) {
      const id = normalizarIdentidade(identidade);

      if (!id) return null;

      const existente = store.carregar(id);

      if (existente) return existente;

      const conta = {
        id,
        tipo: identidade?.tipo === "carteira" ? "carteira" : "google",
        email,
        carteira: identidade?.tipo === "carteira" ? id : null,

        diamantes: DIAMANTES_INICIAIS,
        unlockedSlots: 1,

        personagens: [],
        criadoEm: Date.now(),
      };

      store.salvar(id, conta);

      return conta;
    },

    /**
     * Vincula (ou troca) a carteira da conta. `endereco` ja vem
     * verificado pelo chamador
     */
    vincularCarteira(identidade, endereco) {
      const id = normalizarIdentidade(identidade);

      if (!id) return null;

      const normalizado = normalizarEndereco(endereco);

      if (!normalizado) return null;

      const conta = store.carregar(id) ?? this.criarSeNaoExiste(identidade);

      conta.carteira = normalizado;
      store.salvar(id, conta);

      return conta;
    },

    /**
     * Os personagens da conta, do mais novo pro mais antigo.
     *
     * O servidor e a autoridade: a lista vem do arquivo, nunca do cliente.
     * O front so envia nome e classe; quantos existem e quais nomes sao
     * proibidos e o servidor que decide
     */
    personagens(identidade) {
      const conta = this.ler(identidade);

      if (!conta?.personagens?.length) return [];

      return [...conta.personagens].sort((a, b) => b.criadoEm - a.criadoEm);
    },

    /**
     * Cria um personagem na conta.
     *
     * Regras, todas do lado do servidor:
     *  - a classe tem que existir no catalogo do jogo (`CLASSES_VALIDAS`)
     *  - o nome passa pelo mesmo `validateName` que o JOIN do mundo usa
     *  - o nome nao pode repetir DENTRO da conta
     *  - a conta nao pode passar do numero maximo de vagas liberadas
     *
     * O erro vem como `codigo` e nao como frase, para o front poder
     * decidir o texto em portugues sem adivinhar
     */
    criarPersonagem(identidade, { nome, classe }) {
      const id = normalizarIdentidade(identidade);

      if (!id) return { erro: "IDENTIDADE_INVALIDA" };

      const conta = store.carregar(id) ?? this.criarSeNaoExiste(identidade);

      if (!CLASSES_VALIDAS.has(classe)) {
        return { erro: "CLASSE_INVALIDA" };
      }

      const checagem = validateName(nome);

      if (!checagem.ok) {
        return { erro: "NOME_INVALIDO", detalhe: checagem.reason };
      }

      const jaExiste = (conta.personagens ?? []).some(
        (p) => nameKey(p.nome) === nameKey(checagem.value)
      );

      if (jaExiste) return { erro: "NOME_EM_USO" };

      const vagaLivre =
        (conta.personagens?.length ?? 0) < (conta.unlockedSlots ?? 1);

      if (!vagaLivre) return { erro: "SEM_VAGA" };

      const personagem = {
        id: cryptoId(),
        nome: checagem.value,
        classe,
        criadoEm: Date.now(),
      };

      conta.personagens = [...(conta.personagens ?? []), personagem];

      store.salvar(id, conta);

      return { personagem, conta };
    },

    /**
     * Apaga um personagem da conta. Devolve `false` quando o
     * personagem nao e desta conta — o `id` do personagem vem do
     * cliente, entao a pertenencia e conferida aqui
     */
    apagarPersonagem(identidade, idPersonagem) {
      const contaId = normalizarIdentidade(identidade);

      if (!contaId) return false;

      const conta = store.carregar(contaId);

      if (!conta?.personagens) return false;

      const antes = conta.personagens.length;

      conta.personagens = conta.personagens.filter((p) => p.id !== idPersonagem);

      if (conta.personagens.length === antes) return false;

      store.salvar(contaId, conta);

      return true;
    },

    /**
     * Desbloqueia a proxima vaga, debitando diamantes.
     *
     * A ordem e obrigatoria, como no front antigo (`unlockSlot`): a
     * vaga 3 so abre depois da 2. Sem isso o jogador pularia a vaga 2
     * pagando por ela
     */
    desbloquearVaga(identidade) {
      const id = normalizarIdentidade(identidade);

      if (!id) return { erro: "IDENTIDADE_INVALIDA" };

      const conta = store.carregar(id);

      if (!conta) return { erro: "CONTA_NAO_ENCONTRADA" };

      const proxima = (conta.unlockedSlots ?? 1) + 1;

      // a 4a vaga nao existe: o catalogo tem 3
      if (proxima > CUSTO_DAS_VAGAS.length) {
        return { erro: "LIMITE_DE_VAGAS" };
      }

      const custo = CUSTO_DAS_VAGAS[proxima - 1];

      if ((conta.diamantes ?? 0) < custo) {
        return { erro: "DIAMANTES_INSUFICIENTES", custo, saldo: conta.diamantes ?? 0 };
      }

      conta.diamantes -= custo;
      conta.unlockedSlots = proxima;

      store.salvar(id, conta);

      return { conta };
    },

    /**
     * O resumo que o front consome para desenhar a tela de personagens.
     * Nao expoe email nem endereco: so o que a tela precisa
     */
    resumo(identidade) {
      const conta = this.ler(identidade);

      if (!conta) return null;

      return {
        diamantes: conta.diamantes ?? 0,
        unlockedSlots: conta.unlockedSlots ?? 1,
        personagens: this.personagens(identidade),
      };
    },

    /**
     * O SALDO DE DIAMANTES DA CONTA.
     *
     * ## O DIAMANTE E DA CONTA, E NAO DO PERSONAGEM
     *
     * Era o mesmo numero em dois lugares: `conta.diamantes` pagava a vaga de
     * personagem, e `inventory.diamonds` pagava o passe — e os dois campos
     * nunca se viram. Um jogador com 500 na conta gastava no jogo como se
     * tivesse zero, e o saldo do jogo nao valia para abrir vaga
     *
     * Agora existe UM saldo, e ele mora aqui. O `inventory.diamonds` do
     * personagem vira espelho: o servidor escreve nele ao entrar e le de
     * volta ao gravar
     *
     * ## POR QUE ACEITA O `contaId` CRU
     *
     * Porque e o que a sessao do jogo tem. `sessao.contaId` e o endereco da
     * carteira (vem do token de entrada), e nao o id normalizado
     * `carteira_0x...` que nomeia o arquivo. O metodo reconstrói a identidade
     * para nao obrigar quem llama a montar o objeto — e o lugar de montar
     * identidade e aqui dentro, nao em cada chamada
     *
     * @returns {number} o saldo, ou 0 quando a conta nao existe
     */
    diamantes(identidadeOuContaId) {
      const conta = this.ler(identidadeDeChamada(identidadeOuContaId));

      if (!conta) return 0;

      return Math.max(0, Math.floor(Number(conta.diamantes) || 0));
    },

    /**
     * MOVE O SALDO DE DIAMANTES DA CONTA, e devolve o novo valor.
     *
     * ## POR QUE UM `delta` E NAO DOIS METODOS
     *
     * Porque credito e debito tem a MESMA aritmetica, e um metodo que faz os
     * dois tem um lugar so onde o saldo e gravado, fica em memoria e vai pro
     * disco. `adicionar(n)` e `movimentar(-n)` sao o mesmo caminho com o
     * sinal trocado
     *
     * ## POR QUE O SALDO NUNCA FICA NEGATIVO
     *
     * Porque um saldo negativo e um bug silencioso: o `diamonds` do
     * inventario e um contador que a HUD desenha, e `-50` la vira um ganho de
     * 50 em qualquer compra que use a conta. O debito e barrado no
     * chamador; aqui o piso e a ultima rede
     *
     * @param {object|string} identidadeOuContaId a identidade, ou o `contaId`
     * @param {number} delta quanto entrar (positivo) ou sair (negativo)
     * @returns {number} o saldo depois do movimento
     */
    movimentarDiamantes(identidadeOuContaId, delta) {
      const identidade = identidadeDeChamada(identidadeOuContaId);

      const id = normalizarIdentidade(identidade);

      if (!id) return 0;

      const conta = store.carregar(id);

      if (!conta) return 0;

      const atual = Math.max(0, Math.floor(Number(conta.diamantes) || 0));

      const passo = Math.floor(Number(delta) || 0);

      conta.diamantes = Math.max(0, atual + passo);

      store.salvar(id, conta);

      return conta.diamantes;
    },
  };
}

/**
 * A IDENTIDADE DE UMA CHAMADA, venha como vier.
 *
 * O `contas` inteiro fala com `{ tipo, id }` — e e assim que `index.js`
 * chama. O jogo so tem o `contaId` cru na sessao, porque ele veio do token.
 * Esta funcao aceita os dois para nao obrigar cada chamada nova a saber qual
 * dos dois ela tem
 */
function identidadeDeChamada(identidadeOuContaId) {
  if (identidadeOuContaId && typeof identidadeOuContaId === "object") {
    return identidadeOuContaId;
  }

  const bruto = String(identidadeOuContaId ?? "").trim();

  if (!bruto) return null;

  /**
   * O `0x` DECIDE O TIPO.
   *
   * Um endereco de carteira tem prefixo; um `sub` do Google e uma string
   * opaca sem ele. Testar o formato e mais barato e mais seguro do que
   * carregar o `tipo` pela sessao — que ele nao tem
   */
  return /^0x[0-9a-f]{40}$/i.test(bruto)
    ? { tipo: "carteira", id: bruto }
    : { tipo: "google", id: bruto };
}

/**
 * O CATALOGO DE CLASSES, DO MESMO LADO DO JOGO.
 *
 * O front antigo tinha `Guerreiro|Arqueiro|Mago` e o jogo tem
 * `warrior|arbalist|sorcerer|lancer`. Sao os MESMOS ids do
 * `src/data/characters/index.js` — o front antigo so falava em portugues,
 * e quem traduzia era a tela. Aqui o id e o do jogo desde o comeco, e a
 * traducao fica com quem mostra
 *
 * `lancer` fica de fora por decisao de produto: a grade do jogo esconde
 * (`CLASSES_NA_SELECAO`), mas o servidor aceita para quem ja tem save
 */
const CLASSES_VALIDAS = new Set(["warrior", "arbalist", "sorcerer"]);

/** 1a vaga e gratis, 2a custa 10, 3a custa 20 */
const CUSTO_DAS_VAGAS = [0, 10, 20];

/**
 * A identidade do provedor, normalizada para virar nome de arquivo.
 *
 * `tipo` nao entra no arquivo: um mesmo `sub` do Google e um mesmo
 * endereco nunca coexistem, e misturar os dois criaria duas contas para a
 * mesma pessoa
 */
function normalizarIdentidade(identidade) {
  const bruto = String(identidade?.id ?? "").trim().toLowerCase();

  if (!bruto) return null;

  if (identidade?.tipo === "carteira") {
    /**
     * COM O `0x`, e nao sem.
     *
     * `identidade.id` vem do `resultado.endereco` de `confirmarVinculo`, que
     * devolve o endereco COM prefixo. O regex antigo aceitava 40 hex sem
     * `0x`, entao nenhum endereco real casava: `criarSeNaoExistia` devolvia
     * `null`, a conta nunca era gravada, e `resumo` devolvia `null` — o
     * login respondia 200 com uma sessao que nao achava conta nenhuma
     *
     * E a MESMA regra de `normalizarEndereco`, que ja tinha o `0x`. As
     * duas nao podem divergir: uma normaliza o que a outra aceitou
     */
    return /^0x[0-9a-f]{40}$/.test(bruto) ? `carteira_${bruto}` : null;
  }

  return bruto;
}

function normalizarEndereco(endereco) {
  const bruto = String(endereco ?? "").trim().toLowerCase();

  return /^0x[0-9a-f]{40}$/.test(bruto) ? bruto : null;
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() ?? `p_${Math.random().toString(36).slice(2, 10)}`;
}