// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * O QUE NAO ESTA AQUI, E POR QUE.
 *
 * ## SEM OFUSCACAO DE BUNDLE
 *
 * O `javascript-obfuscator` foi testado neste projeto e saiu: o bundle do
 * indice foi de 334KB para 724KB. O `stringArray` guarda as strings num
 * array embaralhado, e o array mais o gabarito de decodificacao custam mais
 * bytes do que as strings que esconderam — o site carregava o dobro do
 * tamanho para nada
 *
 * ## E POR QUE NAO SERIA SEGURANCA MESMO
 *
 * O codigo do front JA E PUBLICO: ele chega no navegador, e o F12 mostra o
 * source. Ofuscar muda a leitura de minutos para segundos, e nao muda o
 * fato. O que protege de verdade e nao estar no cliente: as regras de conta,
 * a verificacao da assinatura, a persistencia e o segredo do token vivem no
 * servidor, e nenhuma camada de build os toca
 *
 * O sourcemap do JOGO foi desligado (o `vite.config.js` da raiz) — essa era
 * a parte que valia, porque publicava o fonte original com todos os nomes
 */
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});