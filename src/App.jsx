import { Component, useCallback, useEffect, useState } from "react";
import TestMapScene from "./scenes/TestMapScene/TestMapScene.jsx";
import { fallbackName } from "./data/characterName.js";
import { getCharacterDefinition } from "./data/characters/index.js";
import { ESPERA_PELO_TOKEN_MS, voltarParaOFront } from "./front.js";
import { precarregarArteDoMundo } from "./game/preload.js";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro inesperado na aplicação:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <div className="fatal-error__card">
            <span className="eyebrow">ERRO DE EXECUÇÃO</span>
            <h1>Não foi possível continuar.</h1>
            <p>{this.state.error.message}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

/**
 * O CORPO DO TOKEN, SEM VERIFICAR A ASSINATURA.
 *
 * E so para escolher qual tela mostrar. A autoridade continua sendo o
 * servidor, que confere o token de novo no JOIN e recusa se estiver
 * expirado, adulterado ou ja usado — um token invalido manda o jogador de
 * volta para o front, que e o comportamento certo: nao ha personagem
 * escolhivel aqui, a sessao vive la
 *
 * O corpo esta em base64url no primeiro segmento, antes do ponto da
 * assinatura
 */
function decodificarToken(token) {
  if (typeof token !== "string") return null;

  const corpo = token.split(".")[0];

  try {
    const json = atob(corpo.replace(/-/g, "+").replace(/_/g, "/"));
    const dados = JSON.parse(json);

    const classe = getCharacterDefinition(dados.classe);

    // classe desconhecida e o token invalido, e nao a falta de personagem:
    // quem veio pelo front nao escolhe classe nenhuma agora
    if (!classe) return null;

    return {
      token,
      nome: dados.nome ?? fallbackName(classe.id),
      classe,
    };
  } catch {
    return null;
  }
}

/**
 * O TOKEN JA ESTA NO `window`?
 *
 * O `main.jsx` registra o token em `window.__TOKEN_DE_ENTRADA__` antes de
 * este componente montar, porque o postMessage do pai chega antes do React
 * subir. Ler o global aqui evita esperar um evento que ja passou
 */
function lerTokenQueJaChegou() {
  if (typeof window === "undefined") return null;

  return decodificarToken(window.__TOKEN_DE_ENTRADA__);
}

/**
 * O QUE O FRONT JA DISSE, LIDO DO `window`.
 *
 * Sao DUAS informacoes e nao uma, porque elas arrive em momentos diferentes:
 * o TOKEN (que pode ser `null`) e o FATO de o front ter respondido
 *
 * ## POR QUE O FATO IMPORTA MAIS QUE O TOKEN
 *
 * Porque `null` e ambíguo: e o token invalido E o token que nao chegou. A
 * distincao muda o que o jogo faz:
 *
 * - front respondeu com `null`: nao ha sessao, volta agora
 * - front nao respondeu: ele ainda esta pensando, espera
 *
 * Sem essa segunda informacao o jogo so poderia adivinhar, e o preco do
 * palpite e o jogador encarando "Carregando" ate o prazo estourar — que e
 * exatamente o sintoma de "ficou travado"
 *
 * A checagem de origem do `main.jsx` ja rodou antes de qualquer uma delas
 * aparecer aqui: quem escreve no global e quem passou pela conference
 */
function lerRespostaDoFront() {
  if (typeof window === "undefined") {
    return { entrada: null, respondeu: false };
  }

  return {
    entrada: lerTokenQueJaChegou(),
    respondeu: window.__ENTRADA_RESPONDIDA__ === true,
  };
}

/**
 * O JOGO NAO TEM NENHUMA TELA PROPRIA.
 *
 * ## POR QUE ISTO E `null` E NAO UM TEXTO DE "VOLTANDO"
 *
 * Porque qualquer coisa renderizada aqui e PINTA. O navegador desenha o
 * quadro, e so depois o efeito roda e a pagina parte — o jogador veria um
 * texto no meio da partida, que e exatamente a tela intermediaria que se
 * quer eliminar
 *
 * Com `null`, o iframe fica vazio por um quadro e ja era. Como o proprio
 * front esconde o iframe enquanto o mapa nao avisou que montou, e o que
 * aparece nessa janela e a tela de espera DELE, que ja existe e ja e a
 * resposta certa para "o jogo ta carregando"
 *
 * ## QUEM REDIRECIONA, ENTÃO
 *
 * A rota `/jogo` do front, que sabe da ausencia de token antes de o jogo
 * existir. Este `null` so cobre o caso em que o iframe recarrega sozinho —
 * o HMR, ou um F5 no quadro — e nesse caso o pai ainda esta em `/jogo` com o
 * token em maos, entao quem navega e o pedido que o `front.js` manda
 */
export default function App() {
  const [resposta, setResposta] = useState(lerRespostaDoFront);

  /**
   * O TOKEN PODE CHEGAR DEPOIS DO PRIMEIRO RENDER.
   *
   * O `main.jsx` dispara `eldoria:entrada` assim que recebe a mensagem do
   * pai. Se o React ainda nao montou, o evento se perde — e o jogo ficaria
   * esperando um token que ja chegou, sem nunca entrar no mundo
   *
   * Por isso o listener fica, E a leitura do global roda antes de entrar
   * nele: quem ja chegou e pego de uma vez, quem vem depois e pego pelo
   * evento
   *
   * O `set` com a forma ANTIGA e o que impede o laco: sem ele, cada render
   * criaria um objeto novo, o efeito dependente dele rodaria de novo, e o
   * componente nunca pararia de renderizar
   */
  useEffect(() => {
    function aoReceberEntrada() {
      setResposta((atual) => {
        const novo = lerRespostaDoFront();

        const igual =
          novo.entrada === atual.entrada && novo.respondeu === atual.respondeu;

        return igual ? atual : novo;
      });
    }

    // cobre o token que chegou entre o primeiro render e este efeito
    aoReceberEntrada();

    window.addEventListener("eldoria:entrada", aoReceberEntrada);

    return () => window.removeEventListener("eldoria:entrada", aoReceberEntrada);
  }, []);

  /**
   * SEM TOKEN, O JOGO NAO TEM NENHUMA TELA PROPRIA.
   *
   * A selecao de personagem foi embora: ela existia para quem abria o jogo
   * direto, sem passar pelo front, e esse caso nao existe mais. Quem recarrega
   * a pagina, ou quem entra no `jogo.html` sem token, volta para o front —
   * que e onde a sessao mora e onde se escolhe personagem
   *
   * ## POR QUE HA DOIS CAMINHOS PARA VOLTAR
   *
   * **O front respondeu e nao mandou token.** E o recarregamento: o token de
   * uso unico ja foi gasto, o storage do front esta vazio, e o `postMessage`
   * volta com `null`. A volta e imediata, sem prazo nenhum — o front ja disse
   * que nao tem nada para entregar
   *
   * **O front nao respondeu.** Ou o `jogo.html` foi aberto direto, sem
   * nenhum pai, ou o front nao esta no ar. Aqui nao da para saber se ha
   * sessao, entao a espera existe: sem ela, o jogo expulsaria o jogador
   * durante um carregamento normal e lento
   *
   * O prazo cobre so o caso patologico, e nao o comum — que e por isso que
   * ele pode ser generoso sem custar nada a quem esta com o fluxo funcionando
   *
   * ## POR QUE O EFEITO VIVE AQUI E NAO DENTRO DO `if`
   *
   * Porque um `useEffect` dentro de um `if` muda a CONTAGEM de hooks entre
   * um render e o outro: quando o token chega e o `if` deixa de ser
   * verdadeiro, o React reclama "rendered fewer hooks than expected" e
   * derruba a tela — justo no caso em que o token funcionou
   *
   * E por isso que o redirect mora num efeito so, com o `return` DENTRO dele.
   * O `if` abaixo e so de render
   */
  useEffect(() => {
    if (resposta.entrada?.classe) return;

    if (resposta.respondeu) {
      voltarParaOFront();

      return;
    }

    const espera = window.setTimeout(voltarParaOFront, ESPERA_PELO_TOKEN_MS);

    return () => window.clearTimeout(espera);
  }, [resposta]);

  /**
   * "O MUNDO JA DESENHOU", PARA O FRONT.
   *
   * ## POR QUE ESTE HOOK VIVE ACIMA DO `if`, E NAO COMIGO
   *
   * Pelo mesmo motivo do efeito acima: um hook depois de um `return`
   * antecipado muda a CONTAGEM de hooks entre um render e o outro. Quando o
   * token chega e o `if` deixa de valer, o React reclama "rendered fewer
   * hooks than expected" e derruba a tela — justo no caso em que o token
   * funcionou
   *
   * ## POR QUE ISTO E UM AVISO SEPARADO DO `pronto`
   *
   * Porque `pronto` e a PERGUNTA e este e a RESPOSTA. O front so manda o
   * token depois de ouvir `pronto`, entao `pronto` nao pode esperar pelo mapa:
   * sem token o `App` nem monta, sem motor nao ha folha de tile, e as duas
   * esperas se travariam uma na outra
   *
   * `pronto` = "o documento vive, me manda o token" — sai no `window.load`
   * Este = "o chao ja esta pronto" — sai quando a folha de tile carregou
   *
   * ## POR QUE O FRONT ESPERA O SEGUNDO PARA TIRAR A TELA
   *
   * Porque e a tela de espera que deve cobrir a carga, e nao o contrario. Com
   * o `pronto` decidindo, a tela sumia antes da folha baixar e o jogador via
   * o mapa chegar depois de um intervalo sem nenhuma explicacao — que e
   * exatamente o defeito
   */
  const avisarQueOMundoDesenhou = useCallback(() => {
    /**
     * O PRELOAD COMECA AQUI, E NAO ANTES.
     *
     * ## POR QUE ESTE EXATO MOMENTO
     *
     * Porque e o primeiro instante em que o jogo esta DESENHANDO. O preload de
     * fundo existe para o jogador nao esperar na travessia do mapa, e ele nao
     * pode atrapalhar a primeira pintura: 22 folhas somando quase 2 MB baixadas
     * junto com o primeiro quadro atrasariam todo mundo na entrada, e o unico
     * que pagaria por isso e o jogador que depois vai andar para o proximo mapa
     *
     * Aqui o mapa da base ja esta na tela e o personagem ja andou. O preload
     * roda na janela ociosa — a que existe enquanto o jogador ainda nao fez
     * nada no mapa novo — e some antes de ele chegar no portal
     *
     * ## E POR QUE ANTES DO `postMessage`
     *
     * Porque o `mundo:pronto` e o sinal de que a tela de espera do site pode
     * sair. O que vier DEPOIS nao atrasa mais nada: a reserva de uma aba, o
     * jogador apontando o mouse. Um preload que comecasse ali seria o jogador
     * vendo o jogo engasgar no primeiro segundo de liberdade
     */
    precarregarArteDoMundo();

    if (typeof window === "undefined" || window.parent === window) return;

    window.parent.postMessage({ tipo: "mundo:pronto" }, "*");
  }, []);

  const entrada = resposta.entrada;

  if (!entrada?.classe) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <TestMapScene
        key={`${entrada.classe.id}:${entrada.nome}`}
        classDefinition={entrada.classe}
        characterName={entrada.nome}
tokenDeEntrada={entrada.token}
      onBack={voltarParaOFront}
      onMundoPronto={avisarQueOMundoDesenhou}
    />
    </AppErrorBoundary>
  );
}