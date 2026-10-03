import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

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
