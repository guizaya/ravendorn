/**
 * A PONTE ENTRE O FRONT E O SERVIDOR DO JOGO.
 *
 * ## O QUE TROCOU AQUI
 *
 * Antes cada tela falava com o Supabase: `supabase.auth.getUser()` para saber
 * quem esta logado, `supabase.auth.updateUser()` para gravar a carteira, e
 * `localStorage` para os personagens e os diamantes. Sao tres lugares, e o
 * mais perigoso era o terceiro: um `localStorage.clear()` ou uma janela
 * anonima apagava todos os personagens sem aviso
 *
 * Agora e uma API so, e o servidor manda em tudo. O front pergunta e o
 * servidor responde — inclusive o que e um nome valido, quantas vagas existem
 * e se o jogador tem saldo
 *
 * ## A SESSAO FICOU NO NAVEGADOR, E ISSO E PROPOSITAL
 *
 * O token de sessao (`eldoria:sessao`) e a credencial do jogador, e ele
 * PRECISA ficar no navegador: e o que permite recarregar a pagina sem pedir
 * a carteira de novo. O que saiu foi o `localStorage` de DADOS — personagens
 * e diamantes agora vivem no servidor
 *
 * A diferenca: um token de sessao perdido custa um pedido de assinatura
 * (dez segundos). Um personagem perdido custava o personagem inteiro
 *
 * ## POR QUE O TOKEN NAO VAI NUM COOKIE
 *
 * O front roda em outra origin (localhost:5173 no dev), e um cookie
 * cross-site exige `SameSite=None; Secure`, que nao funciona em http local.
 * O header `Authorization` nao tem esse problema
 */

/**
 * ONDE O SERVIDOR DO JOGO ESTA.
 *
 * ## POR QUE NAO PODE SER A ORIGEM ATUAL
 *
 * Em dev o front roda no Vite dele (3000) e o servidor do jogo roda em outra
 * porta (8787). Se a chamada fosse relativa, o navegador pediria
 * `3000/api/...` e tomaria 404 — o sintoma e "a MetaMask abre, mas o
 * servidor responde que a rota nao existe"
 *
 * Por isso o `VITE_API_URL` primeiro, e a regra da porta 3000 depois
 *
 * ## A REGRA QUE SUBSTITUI AS DUAS SITUACOES
 *
 * Tudo que NAO for a porta 3000 e a propria origem: em producao front e jogo
 * sao servidos pelo mesmo servidor do Node, e a origin atual ja atende a
 * API. A 3000 e o unico caso de front rodando sozinho, e ele aponta para a
 * 8787
 */
export function urlDaApi() {
  const configurada = (import.meta as any).env?.VITE_API_URL as string | undefined;

  if (configurada) return configurada.replace(/\/$/, "");

  if (typeof window === "undefined") return "";

  // a origem atual e o proprio front em dev, e nao o servidor do jogo
  if (window.location.port === "3000") {
    return "http://localhost:8787";
  }

  return window.location.origin;
}

const CHAVE_DA_SESSAO = "eldoria:sessao";

/**
 * A SESSAO QUE O NAVEGADOR GUARDA.
 *
 * `token` e a credencial, e `expiraEm` e quando ela morre. Perder a sessao
 * custa um pedido de assinatura de novo; perder um personagem custava o
 * personagem inteiro, que e o que o `localStorage` permitia
 */
export type Sessao = {
  token: string
  expiraEm: number
  identidade: { tipo: string; endereco?: string; email?: string }
}

/** a sessao guardada, ou `null` */
export function sessaoSalva(): Sessao | null {
  if (typeof window === "undefined") return null;

  try {
    const bruto = window.localStorage.getItem(CHAVE_DA_SESSAO);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

function guardarSessao(sessao: Sessao) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessao));
}

export function limparSessao() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(CHAVE_DA_SESSAO);
}

/**
 * O ERRO QUE A CHAMADA LANCA.
 *
 * `dados` e o corpo da resposta do servidor. E opcional porque o servidor
 * pode recusar sem JSON nenhum (um 502 do proxy, por exemplo) — e o
 * `exactOptionalPropertyTypes` exige o `| undefined` explicito para o
 * `dados` poder ficar de fora
 */
type ErroDeApi = Error & {
  status?: number
  dados?: { erro?: string; detalhe?: string } | undefined
}

/**
 * A chamada de rede.
 *
 * Lanca um erro com `status` quando o servidor recusa, para cada tela poder
 * dizer o que aconteceu em vez de mostrar um erro generico
 */
async function chamar<T>(
  caminho: string,
  { metodo = "GET", corpo = null, token = null }: {
    metodo?: string
    corpo?: Record<string, unknown> | null
    token?: string | null
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};

  if (corpo) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;

  /**
   * O `body` SO ENTRA QUANDO HA CORPO.
   *
   * O `exactOptionalPropertyTypes` esta ligado no tsconfig, e ele recusa
   * `{ body: undefined }` num `RequestInit` que declara `body?: BodyInit`:
   * "presente com valor undefined" e diferente de "ausente". Mandar
   * `body: undefined` num GET faria o TypeScript reclamar e o fetch tratar
   * como chave presente
   */
  const init: RequestInit = { method: metodo, headers };

  if (corpo) init.body = JSON.stringify(corpo);

  const resposta = await fetch(urlDaApi() + caminho, init);

  const texto = await resposta.text();

  let dados: unknown = null;

  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = texto;
  }

  if (!resposta.ok) {
    const erro = new Error(texto) as ErroDeApi;
    erro.status = resposta.status;
    // o `dados` pode ser `null` quando o corpo nao era JSON. O
    // `exactOptionalPropertyTypes` nao aceita `undefined` numa chave
    // opcional, entao o guard e o que mantem o tipo honesto
    if (dados && typeof dados === "object") {
      erro.dados = dados as ErroDeApi["dados"];
    }
    throw erro;
  }

  // o servidor responde JSON, e o `T` e o que cada tela espera encontrar
  // dentro dele. A falha fica a cargo do TypeScript no ponto do uso: e o
  // servidor, e nao este arquivo, que garante o formato
  return dados as T;
}

/**
 * O LOGIN, EM DUAS ETAPAS.
 *
 * A primeira devolve a mensagem para assinar; a segunda confirma. O
 * endereco so vira conta DEPOIS que a assinatura prova que pertence a quem
 * esta conectando — quem faz essa conta e o servidor, nao este arquivo
 *
 * O parametro e o `endereco`, e nao a `mensagem`: quem assina e a carteira,
 * que e do jogador, e o passo de pedir a assinatura acontece dentro de
 * `entrarComCarteira` para nao deixar a tela montar pedido e mensagem
 * separadas
 */
export async function entrarComCarteira(
  pedirAssinatura: (endereco: string) => Promise<string>,
) {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw Object.assign(new Error("MetaMask nao encontrada."), { status: 400 });
  }

  const ethereum = (window as any).ethereum;

  const contas: string[] = await ethereum.request({ method: "eth_requestAccounts" });

  const endereco = contas?.[0];

  if (!endereco) {
    throw Object.assign(new Error("Nenhuma conta selecionada."), { status: 400 });
  }

  // 1. o servidor monta a mensagem com o nonce
  const pedido = await chamar("/api/conta/carteira/pedir-assinatura", {
    metodo: "POST",
    corpo: { endereco },
  });

  // 2. a carteira assina
  const assinatura: string = await pedirAssinatura((pedido as { mensagem: string }).mensagem);

  // 3. o servidor confere e cria a conta
  const dados = await chamar("/api/conta/carteira", {
    metodo: "POST",
    corpo: { endereco, assinatura },
  }) as Sessao & { resumo: unknown };

  const sessao: Sessao = { token: dados.token, expiraEm: dados.expiraEm, identidade: dados.identidade };

  guardarSessao(sessao);

  return { sessao, resumo: dados.resumo };
}

/** o token atual, ou `null` */
function tokenAtual() {
  const sessao = sessaoSalva();
  if (!sessao) return null;

  if (sessao.expiraEm <= Date.now()) {
    limparSessao();
    return null;
  }

  return sessao.token;
}

/** o resumo: diamantes, vagas e personagens */
export async function carregarResumo() {
  const token = tokenAtual();
  if (!token) throw Object.assign(new Error("Sem sessao."), { status: 401 });

  return (await chamar("/api/conta", { token })) as {
    diamantes: number;
    unlockedSlots: number;
    personagens: Personagem[];
  };
}

/**
 * O PERSONAGEM, COMO O SERVIDOR DEVOLVE.
 *
 * `nome` e `classe`, e nao `name`/`cls` como no `localStorage`: quem
 * decide o formato e o servidor, e o front consome. `nivel` e opcional
 * porque o resumo da conta nao traz o progresso — o nivel vive no save do
 * jogo, e aqui so interessa mostrar "Nível 1" ate o primeiro login
 */
export type Personagem = {
  id: string
  nome: string
  classe: string
  criadoEm: number
  nivel?: number
};

/** os personagens da conta */
export async function carregarPersonagens() {
  const token = tokenAtual();
  if (!token) throw Object.assign(new Error("Sem sessao."), { status: 401 });

  const dados = (await chamar("/api/conta/personagens", { token })) as { personagens: Personagem[] };

  return dados.personagens;
}

/**
 * CRIA UM PERSONAGEM.
 *
 * O servidor decide se o nome serve. O erro vem como `NOME_EM_USO`,
 * `NOME_INVALIDO`, `CLASSE_INVALIDA` ou `SEM_VAGA`, e a tela traduz
 */
export async function criarPersonagem(nome: string, classe: string) {
  const token = tokenAtual();
  if (!token) throw Object.assign(new Error("Sem sessao."), { status: 401 });

  const dados = await chamar("/api/conta/personagens", {
    metodo: "POST",
    token,
    corpo: { nome, classe },
  }) as { personagem: Personagem };

  return dados.personagem;
}

/** apaga um personagem da conta */
export async function apagarPersonagem(id: string) {
  const token = tokenAtual();
  if (!token) throw Object.assign(new Error("Sem sessao."), { status: 401 });

  await chamar(`/api/conta/personagens/${id}`, { metodo: "DELETE", token });
}

/** desbloqueia a proxima vaga, debitando diamantes */
export async function desbloquearVaga() {
  const token = tokenAtual();
  if (!token) throw Object.assign(new Error("Sem sessao."), { status: 401 });

  return (await chamar("/api/conta/vaga", { metodo: "POST", token })) as {
    diamantes: number;
    unlockedSlots: number;
  };
}

/**
 * O TOKEN DE ENTRADA: a passagem para o jogo.
 *
 * Este e o token que viaja na URL do redirecionamento, uma vez so, e que o
 * `GameServer` confere no JOIN. E diferente do token de sessao, que fica no
 * navegador
 *
 * ## POR QUE AGORA EXIGE ASSINATURA
 *
 * Antes o token de sessao bastava: qualquer um que conseguisse lal — do
 * `localStorage` de outra pessoa, ou de um site qualquer, porque o CORS era
 * `*` — recebia tokens de entrada para qualquer personagem da conta, sem
 * nunca ter a carteira na frente
 *
 * Agora o servidor monta uma mensagem por entrada, a carteira dona da conta
 * assina, e so entao o token sai. O token de sessao continua valendo por 30
 * dias e continua guardando a conta; sozinho ele nao abre mais o mapa
 *
 * ## POR QUE A ASSINATURA ENTRA COMO CALLBACK
 *
 * Porque a carteira e do jogador e a MetaMask so existe no navegador. Quem
 * assina precisa estar no clique, e nao dentro de uma funcao de rede — e e o
 * mesmo arranjo do `entrarComCarteira`, que ja funciona assim
 */
export async function pedirTokenDeEntrada(
  personagemId: string,
  pedirAssinatura: (mensagem: string) => Promise<string>,
) {
  const token = tokenAtual();
  if (!token) throw Object.assign(new Error("Sem sessao."), { status: 401 });

  const pedido = (await chamar("/api/entrada/pedir-assinatura", {
    metodo: "POST",
    token,
    corpo: { personagemId },
  })) as { mensagem: string };

  const assinatura = await pedirAssinatura(pedido.mensagem);

  const dados = (await chamar("/api/entrada", {
    metodo: "POST",
    token,
    corpo: { personagemId, assinatura },
  })) as { token: string; personagem: Personagem };

  return dados.token;
}

/**
 * PARA ONDE O BOTAO JOGAR LEVA.
 *
 * ## UMA SO ORIGEM
 *
 * O front e o jogo sao servidos pelo MESMO servidor Node: as rotas do site
 * vem do Nitro por proxy, o `jogo.html` e os assets sao estaticos, e a API
 * e o WebSocket estao la tambem. Nao existe segunda porta para lembrar
 *
 * O token NAO vai por aqui: ele fica no `sessionStorage`, e a rota `/jogo` o
 * le de la. A URL do site e sempre `/jogo`, sem nada depois do nome
 */
/**
 * DE ONDE O MAPA E CARREGADO.
 *
 * ## EM DESENVOLVIMENTO: O VITE DO JOGO (5173)
 *
 * Sem isso, mexer no jogo exigiria `npm run build` na raiz a cada mudanca, e
 * o ciclo de desenvolvimento seria lento demais. O `vite dev:web` da raiz ja
 * serve o jogo com HMR, e o `vite.config.js` dele ja tem proxy de `/ws` e
 * `/api` para o 8787 — entao o jogo carregado do 5173 conversa com o servidor
 * certo sem mudanca nenhuma
 *
 * ## EM PRODUCAO: O SERVIDOR UNICO
 *
 * Nao existe porta 5173 para o jogador: o front e o jogo sao servidos pelo
 * mesmo Node. A origin atual ja serve o `jogo.html`
 *
 * ## O QUE FAZ O VITE TROCAR DE PORTA SO NO DEV
 *
 * `import.meta.env.DEV` e `true` no `vite dev` e `false` no build. E ele
 * que decide, e nao a porta do front: assim o `npm run build` do front
 * continua apontando para a origem onde o site esta
 */
export function urlDoJogo() {
  const configurada = (import.meta as any).env?.VITE_JOGO_URL as string | undefined;

  if (configurada) return configurada.replace(/\/$/, "");

  if (typeof window === "undefined") return "";

  // o jogo sobe no Vite da raiz em desenvolvimento, para ter HMR
  const emDev = (import.meta as any).env?.DEV === true;

  if (emDev) return "http://localhost:5173";

  return window.location.origin;
}

/**
 * O TOKEN DE ENTRADA, GUARDADO PARA A PROXIMA PAGINA.
 *
 * ## POR QUE `sessionStorage` E NAO A URL
 *
 * A URL passa por tres lugares que nao devolvem: o historico do navegador
 * (e o "voltar" depois), o `Referer` que vai para qualquer link aberto
 * dali, e a tela de quem estiver olhando. Um token que autoriza entrar no
 * jogo nao pode ficar none nenhum deles
 *
 * O token vive 60 segundos e vale uma vez, entao o storage e apagado na
 * primeira leitura. Quem recarregar a pagina depois disso cai na selecao de
 * classe, que e o comportamento correto
 *
 * ## POR QUE `sessionStorage` E NAO `localStorage`
 *
 * O `localStorage` dura semanas, e o token nem dura um minuto: ficaria um
 * token velho no disco, para sempre. O `sessionStorage` morre com a aba, que
 * e o prazo de vida util do token
 *
 * ## E POR QUE APAGAR NA LEITURA, E NAO DEPOIS
 *
 * Se a leitura nao apagasse, um `F5` na tela do mapa entregaria o mesmo token
 * de novo — e o servidor, que o consome na primeira entrada, recusaria a
 * segunda. Apagar no ato faz o token ser de uso unico de verdade, e nao so
 * no servidor
 */
const CHAVE_DO_TOKEN_PENDENTE = "eldoria:entrada-pendente";

export function guardarTokenPendente(token: string) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(CHAVE_DO_TOKEN_PENDENTE, token);
}

/**
 * Le o token pendente e APAGA.
 *
 * Devolve `null` quando nao ha token — que e o caso de quem abriu `/jogo`
 * direto, e cai na selecao de classe
 */
export function lerTokenPendente(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const token = window.sessionStorage.getItem(CHAVE_DO_TOKEN_PENDENTE);

    if (!token) return null;

    window.sessionStorage.removeItem(CHAVE_DO_TOKEN_PENDENTE);

    return token;
  } catch {
    return null;
  }
}