/**
 * VOLTAR PARA O FRONT, DE ONDE O JOGO FOI EMBUTIDO.
 *
 * ## POR QUE ISTO EXISTE
 *
 * O jogo nao tem mais tela de selecao de personagem. Quem abre o `jogo.html`
 * sem token de entrada — recarregou a pagina, o HMR recarregou o iframe, o
 * token de uso unico ja foi gasto — nao tem para onde ir dentro do jogo: a
 * unica tela que vem depois da escolha de personagem passou a ser o front,
 * onde a sessao vive
 *
 * ## POR QUE O TOKEN SE PERDE NUM RECARREGAMENTO
 *
 * Porque ele vale UMA VEZ e fica em `sessionStorage` do front. A rota `/jogo`
 * le, APAGA e entrega por `postMessage`. Um recarregamento do iframe nao passa
 * pela rota de novo: o storage do pai ja esta vazio, entao o token nao volta.
 *
 * Era por isso que o F5 caia na selecao de classe — e a tela que existia para
 * "ninguem escolheu personagem ainda", que e exatamente o caso de quem
 * RECARREGOU e nao o de quem está pela primeira vez
 */

/**
 * O FRONT EM DEV.
 *
 * O `npm run dev` do front e o unico processo que o navegador abre, e ele
 * roda na 3000. O jogo, em dev, e servido pelo Vite dele na 5173 — origens
 * diferentes, entao o caminho relativo `/` levaria de volta ao jogo
 */
const FRONT_EM_DEV = "http://localhost:3000";

/**
 * QUANTO O JOGO ESPERA O TOKEN ANTES DE CONCLUIR QUE NAO VIRA.
 *
 * ## POR QUE EXISTE UMA ESPERA
 *
 * Porque o token nao esta aqui quando a pagina carrega. A ordem real e:
 *
 *   1. o jogo sobe e manda `{ tipo: "pronto" }`
 *   2. o front recebe e responde com `{ tipo: "entrada", token }`
 *   3. o jogo le o token e so entao monta o mapa
 *
 * O passo 2 depende de o `load` ter disparado, que e depois de todas as
 * imagens do mapa. Sem esta espera, o `App` monta no meio do caminho, ve
 * `entrada === null`, e manda o jogador para o front — no carregamento
 * NORMAL, com o token a caminho. Seria um laco, nao uma protecao
 *
 * ## POR QUE 12 SEGUNDOS E NAO 3
 *
 * Porque o mesmo tempo governs o `setTimeout` de 30s da rota `/jogo` do
 * front, que e o unico outro prazo do caminho. Qualquer valor seria
 * arbitrio; escolher um proximo daquele mantem os dois separados por folga
 * e faz o sintoma ser "o jogo avisou que nao recebeu o token" em vez de
 * "o front e o jogo falharam ao mesmo tempo"
 *
 * ## E POR QUE O TEMPO NAO ESTA AQUI
 *
 * Porque o valor pertence ao front, que e quem manda o token. Se um dia ele
 * mudar, este numero tem que mudar junto — e a forma de isso acontecer sem
 * silenciosamente quebrar e ser lido de la, e nao escrito duas vezes
 */
export const ESPERA_PELO_TOKEN_MS = 12_000;

/**
 * DE ONDE O JOGO SAI, E PARA ONDE ELE VOLTA.
 *
 * ## A ORDEM DAS TRES FONTES
 *
 * 1. **`VITE_URL_DO_FRONT`**, quando existe. E o unico jeito de forcar um
 *    endereco, e o que um deploy com o front em outro dominio precisa
 *
 * 2. **O `document.referrer`.** E a resposta certa na maioria dos casos e
 *    precisa de zero configuracao: o jogo roda DENTRO de um iframe, e o
 *    `referrer` e a pagina que o embutiu — ou seja, o proprio front. Em dev
 *    da `http://localhost:3000/jogo`, que e a 3000; em producao, que esta
 *    na mesma origem, da a propria origem
 *
 * 3. **O padrao.** `/` em producao, porque front e jogo sao servidos pelo
 *    mesmo Node e a raiz ja e o front. Em dev, a 3000, porque la `/` seria
 *    o proprio jogo e viraria um laco
 *
 * ## POR QUE O REFERER E SEGURO AQUI
 *
 * Ele nao decide nada de seguranca — quem decide e a checagem de origem do
 * `main.jsx`, no `postMessage`. Aqui ele so diz um endereco para onde navegar,
 * e o pior que um `referrer` falso causaria e o jogador cair numa pagina
 * errada, que e um incodo e nao um acesso
 */
export function urlDoFront() {
  const doEnv = import.meta.env?.VITE_URL_DO_FRONT;

  if (typeof doEnv === "string" && doEnv.trim()) {
    return doEnv.trim();
  }

  if (typeof document !== "undefined" && window.parent !== window) {
    const referencia = document.referrer;

    if (referencia) {
      try {
        return new URL(referencia).origin;
      } catch {
        // um `referrer` que nao e URL e ruido de extensao de navegador.
        // cai na fonte seguinte em vez de derrubar a tela
      }
    }
  }

  return import.meta.env?.DEV ? FRONT_EM_DEV : "/";
}

/**
 * UMA REDIRECIONACAO POR PAGINA.
 *
 * O `App` roda o efeito dentro de `<React.StrictMode>`, que em desenvolvimento
 * dispara efeito duas vezes de proposito. Chamar `replace` duas vezes no mesmo
 * instante nao quebra nada, mas tambem nao ajuda: o primeiro ja partiu. A
 * bandeira deixa o segundo chamar ser um no-op explicito
 */
let jaRedirecionou = false;

/**
 * MANDA O JOGADOR PARA O FRONT.
 *
 * E `replace`, e nao `assign`: sem isso o botao "voltar" do navegador traz a
 * pagina morta do jogo de volta, que recarrega e manda para o front outra
 * vez — e o usuario fica preso num va e vem de dois cliques
 */
/**
 * A ORIGEM DO PAI, que e a do front.
 *
 * E a mesma string que o `main.jsx` usa para conferir a mensagem de entrada.
 * `null` quando o iframe foi aberto direto, sem pagina que o tenha embutido
 */
function origemDoPai() {
  if (typeof document === "undefined" || !document.referrer) return null;

  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

/**
 * A MENSAGEM QUE PEDE AO FRONT PARA LEVAR O JOGADOR DE VOLTA.
 *
 * ## POR QUE O JOGO NAO PODE FAZER ISSO SOZINHO
 *
 * Porque `window.location` dentro de um iframe navega SO o iframe. Trocar a
 * URL dele traz o front_home para dentro do quadro do mapa — o jogador
 * continua na pagina `/jogo`, com a home renderizada num buraco no meio da
 * tela, e a URL do navegador nao muda
 *
 * E para mexer na janela de cima seria preciso `window.top.location`, que em
 * dev e cross-origin de verdade (jogo na 5173, front na 3000). O navegador
 * deixa ESCRVER ali, mas bloqueia por falta de gesto do usuario, e o
 * resultado e um aviso no console e nenhuma navegacao
 *
 * ## POR QUE PEDIR PELO CANAL QUE JA EXISTE
 *
 * Porque o front ja escuta o jogo, ja confere `evento.origin` contra a
 * origem do jogo, e ja sabe qual e a propria pagina. Pedir por mensagem nao
 * acrescenta uma porta nova: usa a mesma, com a mesma conferencia
 *
 * ## E POR QUE O `targetOrigin` PODE SER `'*'`
 *
 * Porque a conferencia esta do lado de QUEM RECEBE: o front compara
 * `evento.origin` com a origem do jogo antes de olhar qualquer campo. O
 * `targetOrigin` do `postMessage` protege o CONTEUDO contra quem estiver
 * ouvindo — e aqui nao ha conteudo secreto, e o jogo so esta pedindo para
 * sair
 */
export function voltarParaOFront() {
  if (jaRedirecionou) return;

  jaRedirecionou = true;

  const destino = urlDoFront();

  // fora do iframe nao ha front para pedir: a navegaao e direto
  if (typeof window === "undefined" || window.parent === window) {
    window.location.replace(destino);

    return;
  }

  // dentro do iframe, quem navega e o pai. o destino vai junto porque em dev
  // o front pode estar em um endereco diferente do padrao
  window.parent.postMessage(
    { tipo: "eldoria:sem-token", destino },
    origemDoPai() ?? "*",
  );
}