import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * O `.tmj` COMO MODULO.
 *
 * O plugin de JSON do Vite so reconhece `.json` — nao existe opcao
 * `jsonExtensions` na versao 6 — entao o mapa do Tiled chegava no Rollup
 * como arquivo JavaScript e o build morria no primeiro `{`.
 *
 * `export default` na frente do JSON e o mesmo truque que o proprio plugin
 * de JSON usa: o arquivo ja e um objeto literal valido de JavaScript, e o
 * unico coisa que falta e o `export`. Sem passo de geracao: editar o mapa no
 * Tiled e salvar recarrega a tela
 */
function tiledTmj() {
  return {
    name: "tiled-tmj",

    // antes do plugin de JSON, que nao reconheceria a extensao
    enforce: "pre",

    async load(id) {
      // o id vem com `?import` e afins colados; o caminho real e o que vem
      // antes do primeiro `?`
      const caminho = id.split("?")[0];

      if (!caminho.endsWith(".tmj")) return null;

      const codigo = await readFile(caminho, "utf8");

      return `export default ${codigo};`;
    },
  };
}

export default defineConfig(({ mode }) => {
  /**
   * PRODUCAO OU DESENVOLVIMENTO.
   *
   * O `mode` e o que o `vite build --mode production` passa, e e o que
   * diferencia o build que vai para o servidor do build local. Ler o
   * `NODE_ENV` do ambiente nao funciona: ele nem sempre esta setado, e o Vite
   * nao garante que chegue na hora da config
   */
  const producao = mode === "production";

  return {
    plugins: [react(), tiledTmj()],

  test: {
    // o painel de craft e a tela de selecao tem estado proprio:
    // o botao de raridade e o bloqueio do JOGAR so revelam defeito
    // depois de um clique de verdade, e isso exige um DOM. os
    // demais testes continuam no ambiente de node, que e mais
    // rapido e nao carrega jsdom sem necessidade
    environment: "node",

    environmentMatchGlobs: [
      ["**/src/components/**/*.test.jsx", "jsdom"],
      ["**/src/scenes/**/*.test.jsx", "jsdom"],
    ],

    globals: false,
  },

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },

      // o WebSocket passa pelo proxy com `ws: true`. sem isso o
      // `new WebSocket("ws://localhost:5173/ws")` no devitoria
      // "conexao recusada" enquanto a API responde normal na
      // mesma porta, e o erro parece de firewall
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",

    /**
     * SOURCEMAP SO EM DESENVOLVIMENTO.
     *
     * ## POR QUE ISTO E O QUE MAIS IMPORTA
     *
     * O `.map` publica o codigo ORIGINAL ao lado do bundle: os nomes das
     * funcoes, as variaveis, os comentarios, a estrutura de pastas. E o
     * `sourcemap: true` de antes colocava um `jogo.html.map` de 4MB no
     * `dist/`, servido junto com o jogo
     *
     * Quem quise ler o codigo pegava esse arquivo e tinha o fonte inteiro,
     * identico ao que esta no disco — a ofuscacao do bundle nao serviria
     * para nada, porque o original continuava publicado do lado
     *
     * ## E POR QUE ISSO E MAIS VALIOSO QUE OFUSCACAO
     *
     * A ofuscacao atrapalha a leitura por minutos. Tirar o sourcemap
     * elimina a forma mais facil de ler — que e clicar no arquivo. Por isso
     * a ordem correta e esta primeiro
     *
     * ## E O QUE SE PERDE
     *
     * O rastreamento de pilha em producao passa a mostrar a posicao no
     * bundle, e nao no arquivo original. E o preco justo: nenhum stack trace
     * de jogador vale publicar o codigo
     *
     * Para developing, o `vite dev` nao usa nada disso — o sourcemap de la vem
     * do Vite e cobre o fonte em tempo real
     */
    sourcemap: !producao,

    /**
     * MINIFICACAO MAIS AGRESSIVA EM PRODUCAO.
     *
     * O padrao do esbuild ja remove espacos e nomes locais. Subir para
     * `minifyIdentifiers` e `minifySyntax` derruba mais: nomes de variaveis
     * locais viram uma letra, e expressoes que so servem para depurar saem
     *
     * `minifyWhitespace` fica desligado porque o esbuild ja faz isso, e pedir
     * duas vezes so deixa o build mais lento
     */
    minify: producao ? "esbuild" : false,

    esbuild: {
      /**
       * O QUE O ESBUILD CONSERVA DEPOIS DE MINIFICAR.
       *
       * `keepNames` e `false` porque e ele que mantem o nome original das
       * classes e funcoes no bundle. Desligado, `PlayerSession` vira `a` e
       * `criarPersonagem` vira `n` — e o DevTools perde a leitura, que e o
       * objetivo
       */
      keepNames: false,

      legalComments: "none",
    },

    /**
     * OS DOIS ENTRY POINTS.
     *
     * - `index.html` e a página do jogo, aberta de um navegador
     * - `jogo.html` e a MESMA página, mas dentro do iframe do site
     *
     * Os dois montam o mesmo `main.jsx` e produzem o mesmo bundle. A
     * diferenca esta no `main.jsx`: ele detecta que esta dentro de um iframe
     * (via `window.parent !== window`) e passa a falar com o site por
     * `postMessage` — avisando que montou, e recebendo o token de entrada
     *
     * ## POR QUE NAO SÓ UM
     *
     * Porque um unico `index.html` aberto direto no navegador precisa
     * funcionar: e assim que se develope o jogo sem passar pelo site. E o
     * `jogo.html` separado deixa o iframe obivio, sem condicional de URL
     *
     * E o `index.html` que o site NAO usa — o iframe aponta para
     * `jogo.html`
     */
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), "index.html"),
        jogo: resolve(process.cwd(), "jogo.html"),
      },
    },
  },
  };
});
