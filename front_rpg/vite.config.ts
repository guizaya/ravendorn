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
  /**
   * O PRESET DO NITRO E `node-server`, E NAO O PADRAO DO PACOTE.
   *
   * ## O QUE ESTAVA ERRADO
   *
   * O `@lovable.dev/vite-tanstack-config` entra com
   * `defaultPreset: "cloudflare-module"`, que empacota o `.output` para
   * Cloudflare Workers. O Node da raiz do jogo faz proxy para esse `.output`
   * esperando um servidor HTTP comum, e o que estava la nao sobe — o front
   * respondia 502 em producao, em qualquer sistema operacional
   *
   * E o preset tambem vinha de uma variavel de ambiente (`NITRO_PRESET` ou
   * `SERVER_PRESET`), mas so dentro do sandbox da plataforma. Fora dele as
   * duas sao silenciosamente ignoradas, e o padrao cloudflare voltava sem
   * aviso
   *
   * ## POR QUE PASSAR AQUI E NAO POR VARIAVEL
   *
   * Porque esta opcao e o que o pacote le de verdade: ele espalha o que vem
   * em `options.nitro` POR CIMA do `defaultPreset`. E por isso que o valor
   * sobrevive a uma atualizacao do pacote — uma variavel de ambiente
   * silenciosamente ignorada e um preset errado silenciosamente aceito
   */
  nitro: { preset: "node-server" },

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});