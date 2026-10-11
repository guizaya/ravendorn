import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import TooltipGlobal from "./components/UI/TooltipGlobal.jsx";
import "./styles.css";
import "./theme-inventory.css";

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
