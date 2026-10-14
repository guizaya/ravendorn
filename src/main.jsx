import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import TooltipGlobal from "./components/UI/TooltipGlobal.jsx";
import "./styles.css";
import "./theme-inventory.css";

/**
 * A CAMADA DA ARVORE DE HABILIDADE, e ela entra por ULTIMO de proposito.
 *
 * Como o `theme-inventory.css`, este arquivo so sobrescreve o que a arvore
 * precisa de diferente: altura fixa do painel, os degraus empilhados e a
 * rolagem nos dois eixos. O desenho dos nos NAO esta aqui — ele vem das
 * classes do talento da guilda, e e por isso que as duas arvores sao iguais
 *
 * Entrando depois do tema do inventario, o `var(--t-gold)` e o `--t-line-2`
 * ja valem os valores do tema, e a arvore nao precisa repetir nenhuma cor
 */
import "./theme-skilltree.css";

/**
 * A CAMADA DE TILE DO MAPA 1, e ela se registra por efeito de import.
 *
 * E um import de arquivo inteiro, e nao uma chamada: este arquivo e o
 * UNICO lugar do projeto que pode ler o `.tmj`. O motor consulta o registro,
 * e o registro nao sabe de nenhum mapa
 *
 * ## POR QUE ESTA LINHA NAO ESTA NO MOTOR
 *
 * Porque o `GameServer` importa o `GameEngine.js` e roda em Node puro, onde
 * o plugin do Vite que transforma `.tmj` em modulo nao existe. Com o import
 * aqui dentro, o servidor cairia na carga com um erro de extensao — e o
 * sintoma seria o jogo fora do ar, sem nada apontando para o mapa
 *
 * ## E POR QUE O IMPORT CRITICO DELE PRECEDE O PRIMEIRO QUADRO
 *
 * Porque o `ReactDOM.render` abaixo ja cria a tela, e o motor pergunta a
 * camada no primeiro `drawMap`. Um import dinamico chegaria tarde demais, e
 * o primeiro quadro abriria com o terreno por baixo de um mapa que o Tiled
 * substituiu
 */
import "./game/maps/camadaDoMapa1.js";
import "./game/maps/camadaDaBase.js";

/**
 * A CAMADA DA ARENA DO HULK.
 *
 * O terceiro import de camada, e pelo mesmo motivo dos outros: e um
 * registro por efeito de import, e ele precisa acontecer antes do primeiro
 * quadro. Sem este `import`, a arena continuaria desenhando o chao do
 * `TerrainRenderer` em vez do `boss_1.tmj`, e voce veria o Tiled salvar sem
 * nenhum efeito na tela
 */
import "./game/maps/camadaDoBoss1.js";

/**
 * A CAMADA DO VALE 1.
 *
 * O quarto import de camada, e pelo mesmo motivo dos outros: e um registro
 * por efeito de import, e ele precisa acontecer antes do primeiro quadro.
 * Sem este `import`, o vale continuaria desenhando o chao escuro do
 * `TerrainRenderer` ladrilhado em 128, e voce veria o `vale.tmj` salvo sem
 * nenhum efeito na tela
 */
import "./game/maps/camadaDoVale1.js";

/**
 * A CAMADA DO MAPA 2.
 *
 * O quinto import de camada, e pelo mesmo motivo dos outros: e um registro
 * por efeito de import, e ele precisa acontecer antes do primeiro quadro.
 * Sem este `import`, o mapa 2 continuaria desenhando a neve do
 * `TerrainRenderer` em vez do `map_2.tmj`, e as paredes da camada `PAREDES`
 * nao existiriam para o `colisaoTiled` ler
 */
import "./game/maps/camadaDoMapa2.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />

    {/*
      O TOOLTIP GLOBAL, como IRMAO do `App` e nao dentro dele.

      Porque ele escuta o `document` inteiro e nao depende de nenhum estado
      do jogo: qualquer elemento com `data-tip` em qualquer painel o aciona.
      Dentro do `App` ele so existiria enquanto um painel estivesse aberto,
      e o HUD — que esta sempre na tela — ficaria sem tooltip

      E um irmao, e nao filho: o `App` tem `overflow` e `transform`, que
      transformam o elemento em bloco contentor de `position: fixed`. O
      tooltip portalizado sairia para o `body` de qualquer jeito, e por isso
      ele ja nasce fora
    */}
    <TooltipGlobal />
  </React.StrictMode>,
);

/**
 * O TOKEN DE ENTRADA, CHEGANDO PELO PAI.
 *
 * ## POR QUE O TOKEN VIA POSTMESSAGE E NAO PELA URL
 *
 * O front embrulha esta pagina num iframe, e o token de entrada vive 60
 * segundos e vale uma vez. Se ele fosse passado na query do iframe, ficaria
 * na barra de endereco, no historico do navegador, e no `Referer` de tudo que
 * o mapa carregasse. O postMessage nao deixa rastro nenhum
 *
 * ## POR QUE announce QUE ESTA PRONTO
 *
 * O pai so envia o token DEPOIS de o jogo mandar este aviso. Sem ele, o
 * `App` montaria na tela de selecao — que so existe para quem nao tem token,
 * e nao e o caso de quem veio pelo front
 *
 * ## E O QUE ACONTECE SEM TOKEN
 *
 * O jogo abre normalmente, com a selecao de classe. E o que mantem o
 * `npm run dev` na raiz funcionando para quem so quer abrir o jogo direto
 * no navegador, sem passar pelo front
 *
 * ## A ORIGEM DO PAI VEM NA MENSAGEM
 *
 * ## POR QUE O JOGO NAO PODE SO COMPARAR COM A ORIGEM DELE
 *
 * Em dev, o front roda no Vite dele (3000) e este jogo e servido pelo Node
 * (8787). Sao origens diferentes. Se o jogo exigisse `evento.origin` igual a
 * `window.location.origin` dele, a mensagem do pai seria recusada — sempre —
 * e o token nunca chegaria, com a tela do mapa presa em "carregando"
 *
 * A checagem que importa nao e "a origem e a minha", e "a origem e a do meu
 * pai". E o pai sabe qual e a sua propria origem, entao ele a manda junto com
 * o token, e o jogo compara com o `document.referrer` — que e a pagina que
 * de fato embutiu este iframe
 *
 * Sem essa checagem, qualquer site poderia embutir o jogo num iframe e
 * postar um token forjado. Com ela, so o site que abriu o jogo pode
 */
if (typeof window !== "undefined" && window.parent !== window) {
  const avisarQueEstaPronto = () => {
    window.parent.postMessage({ tipo: "pronto" }, "*");
  };

  // o `load` pode ja ter disparado antes deste listener existir, que e o
  // caso normal: o script roda DEPOIS que o documento terminou de carregar
  if (document.readyState === "complete") {
    avisarQueEstaPronto();
  } else {
    window.addEventListener("load", avisarQueEstaPronto, { once: true });
  }

  window.addEventListener(
    "message",
    (evento) => {
      const dados = evento.data;

      if (dados?.tipo !== "entrada") return;

/**
       * A CONFERENCIA DA ORIGEM.
       *
       * O pai manda a origem dele, e ela precisa bater com a pagina que
       * embutiu este iframe. Sao a mesma informacao vista de dois lados: o
       * `document.referrer` nao mente sobre quem abriu a moldura, e o pai
       * nao mente sobre qual e a origem dele
       */
      const origemEsperada = dados.origem;

      const referencia = document.referrer
        ? new URL(document.referrer).origin
        : null;

      // sem referencia, o iframe foi aberto direto e nao por um site: o
      // token nao pode vir de lugar nenhum, e o jogo cai na selecao
      if (!origemEsperada || !referencia) return;

      if (origemEsperada !== referencia) return;

      // o token so entra no `window` DEPOIS da checagem. Antes disso, o
      // `App` teria lido um valor que nao passou pela origem
      window.__TOKEN_DE_ENTRADA__ = dados.token ?? null;

      /**
       * O FRONT JA RESPONDEU, COM TOKEN OU SEM.
       *
       * ## POR QUE ISTO E SEPARADO DO TOKEN
       *
       * Porque "o token e `null`" e uma resposta, e "o token ainda nao veio"
       * e silencio — e o `App` precisa saber a diferenca. Sem esta marca, os
       * dois casos viram o mesmo `null`, e o jogo so poderia concluir que
       * nao ha token depois de um prazo adivinhado
       *
       * ## O QUE MUDA COM ELA
       *
       * Um recarregamento e resolvido na hora. O front le o `sessionStorage`,
       * ve que o token de uso unico ja foi gasto, e responde `token: null` no
       * primeiro `postMessage` — o jogo pede a volta imediatamente, em vez de
       * ficar olhando para "Carregando" ate o prazo estourar
       */
      window.__ENTRADA_RESPONDIDA__ = true;

      window.dispatchEvent(new Event("eldoria:entrada"));
    },
    { once: false },
  );
}