import { readFile } from "node:fs/promises";
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

export default defineConfig({
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
    sourcemap: true,
  },
});
