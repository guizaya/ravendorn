import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
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

/**
 * O SHARP, E POR QUE ELE E CARREGADO COM `await import` DENTRO DE UM TRY.
 *
 * ## O QUE ELE FAZ
 *
 * O `sharp` e a biblioteca de imagem que faz a conversao para WebP. Ele fica
 * em `devDependencies` porque e uma ferramenta de BUILD: nada disso entra no
 * navegador, e o `dist/` recebe so o arquivo ja convertido
 *
 * ## POR QUE NAO UM `import` NO TOPO DO ARQUIVO
 *
 * Porque `devDependencies` nao e instalada em todo lugar. O servidor de producao
 * roda `npm run build` com `--omit=dev` em muita parte dos hospedos, e um `import sharp` no
 * topo do `vite.config.js` mataria o build inteiro com "cannot find module" —
 * e o jogo nao entraria no ar por causa de uma otimizacao de imagem
 *
 * ## E O QUE ACONTECE QUANDO O SHARP NAO ESTA
 *
 * Nada. O `catch` devolve `null`, e o plugin simplesmente deixa de existir:
 * o Vite segue o caminho normal, emitting os PNG como estao. O build fica
 * mais pesado e CONTINUA CORRETO
 *
 * E por isso que o plugin e escolhido dentro de `defineConfig`, e nao no
 * array de plugins fixo: assim a ausencia do sharp vira um no-op em vez de um
 * erro de configuracao
 */
let sharpCache;

/**
 * O SHARP, OU `null` SE ELE NAO ESTIVER INSTALADO.
 *
 * A promessa fica em cache de proposito: `sharp` e um modulo nativo pesado, e
 * o `load` do plugin roda uma vez por arquivo — sem cache seriam centenas de
 * import do mesmo modulo
 */
async function pegarSharp() {
  if (sharpCache !== undefined) return sharpCache;

  try {
    const mod = await import("sharp");

    sharpCache = mod.default ?? mod;
  } catch {
    sharpCache = null;
  }

  return sharpCache;
}

/**
 * OS ARQUIVOS PEQUENOS FICAM DE FORA.
 *
 * ## POR QUE 2 KB
 *
 * Porque o WebP tem um cabecalho proprio, e em arquivo muito pequeno ele pode
 * sair MAIOR que o PNG original. Pior: para um icone de 1 KB a diferenca de
 * 300 bytes nao muda nada para o jogador, e o preco e um arquivo novo no
 * cache do navegador
 *
 * ## E POR QUE NAO E UM TAMANHO FIXO PARA TODO MUNDO
 *
 * Porque a taxa de compressao depende do conteudo, nao da extensao. Um PNG de
 * 3 MB de textura de chao e um PNG de 3 MB de ruido nao se comportam igual, e
 * o corte por tamanho e so a primeira linha de defesa — a conversao so acontece
 * se o resultado for MENOR, como ve o `escolheFormato`
 */
const TAMANHO_MINIMO_PARA_CONVERTER = 2 * 1024;

/**
 * A QUALIDADE DO WEBP COM LOSSY.
 *
 * ## POR QUE 82, E NAO 80 OU 90
 *
 * Porque em imagem de terreno o olho nao acha a diferenca entre 80 e 90, e o
 * arquivo encolhe bastante. Nos terrenos testados, 1254x1254, o passo de 90
 * para 82 tirava cerca de um terco do peso sem diferenca visivel no jogo
 *
 * E o padrao do `sharp` seria 80. Fica um pouco acima porque o terreno e o que
 * o jogador olha o jogo inteiro: e o ultimo lugar para arriscar faixa
 */
const QUALIDADE_WEBP_LOSSY = 82;

/**
 * A ARTE QUE SO APARECE PEQUENA NA TELHA, E O LIMITE DELA.
 *
 * ## O QUE O PROBLEMA E
 *
 * Os cinco icones de habilidade do Arbalista e a mira eram imagens de 1600x1600
 * pixels usadas em 34 a 64. Sao 25 vezes maiores que o necessario em cada
 * dimensao: 1,7 MB de arquivo para|area de tela que um quadradinho de 128
 * pixels ocupa
 *
 * ## POR QUE 256 E NAO 64
 *
 * Porque a tela nao e o unico consumidor. Um slot de 64 px em monitor de 2x
 * pede 128 px reais de imagem, e o `img` preenche o container inteiro — tela
 * maior usa mais ainda. Com 256 px sobram 2x de folga sobre o pior caso de
 * tela retina, e a diferenca visual entre 256 e 1600 some completamente
 *
 * ## E POR QUE SO ARTE PEQUENA
 *
 * Porque o resto do jogo tem imagem grande de verdade. Os terrenos sao tileset
 * de 1254 e 1600 px, e reduzir um tileset troca a borda de cada tile na tela.
 * Quem entra na lista sao os icones e a mira — conteudo que o jogador nunca ve
 * em tamanho grande
 *
 * ## E POR QUE ISSO NAO TOCA NO `src/`
 *
 * Igual ao WebP: e uma operacao de build. O arquivo de 1600 px continua no
 * repositorio, e quem quiser gerar arte maior tem o original a uma linha de
 * distancia
 */
const LARGURA_MAXIMA_DE_ARTE_PEQUENA = 256;

/**
 * A LISTA DE ARTE PEQUENA, LIDA DOS PROPRIOS CATALOGOS.
 *
 * ## POR QUE NAO UM REGEX NA PASTA
 *
 * Duas tentativas, e as duas falharam em silencio — build verde, zero imagens
 * reduzidas:
 *
 * 1. `/assets/skills/` no nome do arquivo. O Vite achata o caminho do bundle
 *    e emite `assets/ult-DPcJfuNA.jpg`, sem pasta nenhuma
 *
 * 2. Comparar com `ult.jpg` do catalogo. O bundle tem o HASH no meio do
 *    nome, e `ult-DPcJfuNA.jpg` nunca casa com `ult.jpg`
 *
 * Ler o catalogo e comparar sem extensao e sem hash resolve as duas de uma vez
 *
 * ## E POR QUE LER O CATALOGO, E NAO ESCREVER A LISTA NA MAO
 *
 * Porque `skillIcons.js` e `cursor/index.js` ja sao a lista verdadeira do que e
 * arte pequena. Ler eles faz uma habilidade nova entrar sozinha na otimizacao, e
 * um icone que sair do catalogo parar de ser reduzido
 *
 * E o `catch`: se algum dos dois arquivos mudar de nome ou nao existir, a lista
 * fica vazia e o build funciona igual — sem reducao, e sem erro
 */
const CATALOGOS_DE_ARTE_PEQUENA = [
  "src/data/skillIcons.js",
  "src/data/cursor/index.js",
];

const NOMES_DE_ARTE_PEQUENA = (() => {
  const nomes = new Set();

  for (const caminho of CATALOGOS_DE_ARTE_PEQUENA) {
    try {
      const codigo = readFileSync(resolve(process.cwd(), caminho), "utf8");

      for (const achado of codigo.matchAll(/new URL\(\s*"[^"]*\/([^/"]+)"/g)) {
        nomes.add(achado[1].replace(/\.[^.]+$/, ""));
      }
    } catch {
      // catalogo fora do lugar: sem reducao, e o build segue normal
    }
  }

  return nomes;
})();

/**
 * O ARQUIVO E ARTE PEQUENA NA TELHA?
 *
 * ## POR QUE O HASH E A EXTENSAO SAO TIRADOS ANTES
 *
 * Porque e o que quebra as duas tentativas anteriores: o catalogo tem
 * `ult.jpg` e o bundle tem `ult-DPcJfuNA.jpg`. Comparar os dois inteiros nunca
 * da certo, e nenhuma imagem era reduzida — com o build passando
 *
 * O hash do Vite tem 8 caracteres. O piso de 6 e para o nome de arquivo curto
 * nao gerar um corte errado
 */
function ehArtePequena(fileName) {
  const base = fileName.slice(fileName.lastIndexOf("/") + 1);

  const semHash = base
    .replace(/\.[^.]+$/, "")
    .replace(/-[A-Za-z0-9_-]{6,}$/, "");

  return NOMES_DE_ARTE_PEQUENA.has(semHash);
}


/**
/**
 * O QUE CONVERTE PARA WEBP, E O QUE NAO CONVERTE.
 *
 * ## POR QUE AGORA O `.jpg` ENTRA, E ANTES NAO
 *
 * A primeira medicao deu perda: `grama.jpg` de 450 KB virando WebP de 501 KB,
 * MAIOR. Com isso, a conclusao foi "JPG nao tem o que perder" e a regra ficou
 * so para PNG
 *
 * A conclusao estava errada porque mediu UM arquivo. Medindo os tres que
 * realmente sobram no `dist/`, o resultado muda:
 *
 *   neve.jpg    230 KB -> WebP 151 KB
 *   terra_2.jpg 203 KB -> WebP 121 KB
 *   ...preta.jpg 110 KB -> WebP  70 KB
 *
 * O JPG e um formato de 1992; a foto que ele comprime mal e a que ele salvou
 * pior. Decidir pelo formato e decidir pelo arquivo sao coisas diferentes
 *
 * E o que garante que a regra continue segura: a conversao so vale se o
 * resultado for MENOR que o original. O arquivo que piora volta a ficar como
 * estava, entao uma imagem estranha no futuro nao vira um arquivo maior
 *
 * ## POR QUE GIF NAO ENTRA
 *
 * Porque sao animacoes, e conversao de GIF animado exige ferramenta propria
 * (`gifsicle`). O `sharp` le so o primeiro quadro, que e exatamente o oposto do
 * que se quer: perder a animacao para ganhar quase nada
 */
function deveConverter(caminho) {
  return /\.(png|jpe?g)$/i.test(caminho);
}

/**
 * O PLUGIN: PNG PARA WEBP, EM TEMPO DE BUILD.
 *
 * ## POR QUE UM PLUGIN, E NAO CONVERTER OS ARQUIVOS DO DISCO
 *
 * Porque converter no disco e mexer em 639 arquivos e reescrever cada
 * referencia em cada `new URL(...)` do codigo. Um arquivo referido em lugar
 * nenhum continua no disco, entra no `git`, e o preco do erro e um sprite
 * quebrado em producao
 *
 * No plugin, o arquivo original do `src/` nunca e tocado. O Vite pede a imagem,
 * o plugin entrega um WebP, e o `dist/` recebe o WebP com o hash e a extensao
 * certain. Se o plugin sumir, o Vite entrega o PNG. Os dois caminhos funcionam
 *
* ## E POR QUE UM `generateBundle`, E NAO UM `load`
 *
 * Porque este projeto NAO importa imagem do jeito que o Vite espera. Quase
 * toda arte entra por `new URL("../../assets/x.png", import.meta.url)`, e o
 * `vite:asset-import-meta-url` resolve isso dentro do `transform` do modulo que
 * chama — ele emite o arquivo e pronto, sem nunca passar pelo `load` da imagem
 *
 * Um plugin com `load` converteria apenas os poucos arquivos que usam
 * `import url from "x.png"`. Nos outros, ele nao seria chamado NENHUMA VEZ, e o
 * build terminaria verde com 15 MB de PNG no `dist/`: o pior resultado possivel,
 * porque parece que funcionou
 *
 * ## E POR QUE NAO CONVERTER NO DISCO
 *
 * Porque sao 639 arquivos e uma referencia em cada `new URL` espalhado pelos
 * modulos de dados. Um arquivo esquecido vira sprite quebrado em producao, e o
 * preco de errar e alto demais para o ganho
 *
 * Aqui o `src/` nunca e tocado. O bundle ja esta montado, com os nomes com
 * hash; o plugin troca o conteudo do arquivo, troca a extensao e reescreve o
 * nome nos trechos de codigo que o citaram
 *
 * ## E POR QUE ISSO NAO QUEBRA NADA
 *
 * Porque o nome no bundle e unico por conteudo — e `new_grama_mapa_1-m-_bFaYb.png`
 * so aparece no codigo como URL daquele asset especifico. Trocar o sufixo da
 * extensao em todas as ocorrencias e uma substituicao sem ambiguidade
 */
function imagensEmWebp(producao) {
  /**
   * A PASTA DE SAIDA, ANOTADA PARA O `closeBundle`.
   *
   * Porque `generateBundle` roda ANTES do Rollup gravar qualquer arquivo: com
   * o `dist/` vazio nesse momento, o `readdirSync` nao achava nem o bundle.
   * Era por isso que nenhum `.gz` aparecia, sem nenhum erro no build
   */
  let pastaDeSaida = null;

  return {
    name: "imagens-em-webp",
    apply: "build",

    async generateBundle(opcoes, bundle) {
      if (!producao) return;

      pastaDeSaida = resolve(opcoes.dir ?? "dist");
      if (!producao) return;

      const sharp = await pegarSharp();

      // sem sharp, o build segue normal e entrega os PNG de origem
      if (!sharp) return;

      /**
       * AS TROCAS PRIMEIRO, OS ARQUIVOS DEPOIS.
       *
       * A ordem importa: primeiro se descobre quais imagens viram WebP, e so
       * entao o nome novo e escrito no codigo. Fazendo o contrario, um arquivo
       * convertido no meio do caminho deixaria de ser referenciado e ele iria
       * para o `dist/` orfao, somando peso sem uso
       */
      const trocas = [];

for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type !== "asset") continue;

        /**
         * A ARTE QUE SO APARECE PEQUENA NA TELHA.
         *
         * Nao e o que define a conversao, e o que define o REDIMENSIONAMENTO:
         * os icones de habilidade e a mira sao arte de 1600 px usada em 34 a 64,
         * e sao eles que precisam encolher antes de virar WebP
         */
        const ePequena = ehArtePequena(fileName);

        if (!deveConverter(fileName)) continue;

        const bruto = Buffer.isBuffer(item.source)
          ? item.source
          : Buffer.from(item.source);

        if (bruto.length < TAMANHO_MINIMO_PARA_CONVERTER) continue;

        let sharp = await pegarSharp();

        if (!sharp) continue;

        /**
         * O REDIMENSIONAMENTO, E SO QUANDO A IMAGEM ESTOURA O LIMITE.
         *
         * `withoutEnlargement` impede o caminho contrario, que viraria um icone
         * pequeno em um arquivo grande e menor do que ja estava
         *
         * E o `catch` deste bloco ja pagou um bug: o nome da constante mudou
         * para `LARGURA_MAXIMA_DE_ARTE_PEQUENA` e o uso continuou com o nome
         * antigo. O `ReferenceError` caia aqui dentro, o `catch` devolvia a
         * imagem sem reduzir, e o resultado eram icones de 1600 px no `dist/`
         * com o build inteiro passando
         *
         * Um `catch` largo demais engole erro de PROGRAMACAO junto com erro de
         * imagem. O que este bloco trata e falha do `sharp` em abrir o
         * arquivo — e o `catch` estreito nao esconderia um nome errado
         */
        let fonte = bruto;

        if (ePequena) {
          try {
            fonte = await sharp(bruto)
              .resize({
                width: LARGURA_MAXIMA_DE_ARTE_PEQUENA,
                height: LARGURA_MAXIMA_DE_ARTE_PEQUENA,
                fit: "inside",
                withoutEnlargement: true,
              })
              .toBuffer();
          } catch {
            fonte = bruto;
          }
        }

        let meta;

        try {
          meta = await sharp(fonte).metadata();
        } catch {
          continue;
        }

        /**
         * COM ALFA, A CONVERSAO E SEM PERDA.
         *
         * ## POR QUE ISTO E A REGRA MAIS IMPORTANTE DO PLUGIN
         *
         * Porque o WebP com perda tem um artefato conhecido no canal alpha: a
         * borda do pixel transparente ganha franja da cor vizinha. Em terreno,
         * que e opaco, o olho nao acha. Em um sprite com contorno, a franja
         * aparece como um halo sujo em volta do bicho, e e exatamente o tipo de
         * defeito que o jogador reporta como "a arte estragou"
         *
         * E a perda nao compra quase nada nos sprites com alpha: o `tree.png` de
         * 1589 KB foi para 954 KB sem perda, contra 150 KB com perda. A diferenca
         * somada nao paga o defeito visual
         */
const opcoes = meta.hasAlpha
          ? { lossless: true, effort: 6 }
          : { quality: QUALIDADE_WEBP_LOSSY, effort: 6 };

        let saida;

        try {
          saida = await sharp(fonte).webp(opcoes).toBuffer();
        } catch {
          continue;
        }

        /**
         * A REGRA QUE SALVA O BUILD DE UM ARQUIVO RUIM.
         *
         * A comparacao e com o arquivo de ENTRADA do bundle, e nao com a
         * imagem ja reduzida: o que esta no disco continua sendo o original de
         * 1600 px, e e contra ele que o resultado precisa ganhar
         */
        if (saida.length >= bruto.length) continue;

        trocas.push({
          antes: fileName,
          depois: fileName.replace(/\.(png|jpe?g)$/i, ".webp"),
          bytesAntes: bruto.length,
          bytesDepois: saida.length,
          bytes: saida,
        });
      }

      if (!trocas.length) return;

      /**
       * AGORA O NOME NO CODIGO.
       *
       * O nome do asset entra no JS como string de URL e no CSS como `url(...)`.
       * Nos dois e o mesmo arquivo com hash, entao trocar `.png` por `.webp`
       * naquele nome exato acerta todas as referencias de uma vez
       *
       * E por isso que a extensao e trocada no NOME COMPLETO, e nao num trecho:
       * `assets/logo.png` vira `assets/logo.webp`, e o resto do nome — que tem
       * o hash — fica intacto. Sem hash, dois assets com o mesmo nome base
       * colidiriam
       */
/**
       * O NOME NO CODIGO, NAS DUAS FORMAS QUE O VITE ESCREVE.
       *
       * ## O ARQUIVO QUE ESCAPOU, E COMO
       *
       * Um tileset se chamava
       * `64x64_seamless_top-down_2D_MMORPG_terrain_tile_sho (1).png`, com
       * espaco e parenteses no nome. No bundle o Vite escreve o espaco como
       * `%20`:
       *
       *     "/assets/64x64_seamless_..._sho%20(1)-DSN7f-0U.png"
       *
       * A troca de extensao procurava o nome CRU, com o espaco de verdade, e nao
       * encontrava. O arquivo virava `.webp` no disco enquanto o codigo seguia
       * pedindo `.png`: uma referencia quebrada, silenciosa, que so apareceria
       * no navegador como tile em falta
       *
       * ## POR QUE AS DUAS FORMAS
       *
       * Porque `encodeURI` e o que o Vite usa, e ele troca o espaco por `%20`
       * mas deixa o parenteses como esta. Trocar o nome cru E o nome codificado
       * cobre os dois, sem depender do nome do arquivo
       *
       * E a verificacao que vem depois do build e que pegaria isso: um
       * arquivo orfao no `dist/` e uma URL sem arquivo atras.
       */
      for (const item of Object.values(bundle)) {
        if (item.type === "chunk") {
          if (typeof item.code !== "string") continue;

          for (const t of trocas) {
            item.code = item.code.split(t.antes).join(t.depois);
            item.code = item.code.split(encodeURI(t.antes)).join(t.depois);
          }
        } else if (item.type === "asset" && typeof item.source === "string") {
          for (const t of trocas) {
            item.source = item.source.split(t.antes).join(t.depois);
            item.source = item.source.split(encodeURI(t.antes)).join(t.depois);
          }
        }
      }

      /**
       * E SO AGORA O CONTEUDO: a entrada antiga sai, a nova entra.
       *
       * O `delete` vem antes da atribuicao de proposito. Se os dois fossem o
       * mesmo objeto, o `delete` apagaria o arquivo que acabara de ser escrito
       */
      for (const t of trocas) {
        delete bundle[t.antes];

        bundle[t.depois] = {
          type: "asset",
          fileName: t.depois,
          name: t.depois.split("/").pop(),
          needsCodeReference: false,
          originalFileName: null,
          source: t.bytes,
        };
      }

const antes = trocas.reduce((s, t) => s + t.bytesAntes, 0);
      const depois = trocas.reduce((s, t) => s + t.bytesDepois, 0);

      console.log(
        `\n  imagens-em-webp: ${trocas.length} arquivo(s), ` +
          `${(antes / 1024 / 1024).toFixed(2)} MB -> ${(depois / 1024 / 1024).toFixed(2)} MB ` +
          `(-${Math.round((1 - depois / antes) * 100)}%)`
      );

    },

    /**
     * O `.gz`, DEPOIS DE TUDO GRAVADO.
     *
     * O `closeBundle` e o unico gancho que roda com o `dist/` completo. No
     * `generateBundle` a pasta ainda estava vazia, e o passo inteiro nao fazia
     * nada — sem erro, sem aviso, e com o build reportingando sucesso
     */
    closeBundle() {
      if (!producao || !pastaDeSaida) return;

      gerarComprimidosNoDisco(pastaDeSaida);
    },
  };
}

/**
 * O `.gz` DE CADA TEXTO, PARA O SERVIDOR NAO TER QUE COMPRIMIR NA HORA.
 *
 * ## POR QUE PRE-COMPRIMIR, E NAO COMPRIMIR NA RESPOSTA
 *
 * A forma comum de fazer gzip em Node e um middleware que troca `res.write` e
 * `res.end` para enfiar um `zlib` no meio da resposta. Ela funciona, e tambem
 * quebra de tres jeitos que so aparecem com arquivo grande:
 *
 * - o `pipe` do Node procura `dest.write` a cada pedaco, e como o destino era a
 *   propria resposta — que ja tinha o `write` trocado — o fluxo virava laco e o
 *   `zlib` morria com "write after end"
 *
 * - o `dest.end()` do `pipe` chamava o `end` trocado, que chamava `gzip.end()`
 *   sobre um stream ja encerrado, e a conexao nunca fechava
 *
 * - o `Content-Length` do Express aponta o tamanho do arquivo CRU, e o
 *   navegador cortava a resposta no meio
 *
 * Aqui o arquivo comprimido e um ARQUIVO. O servidor so precisa saber qual
 * entregar em vez do original, e o Express continua respondendo pelo
 * `sendFile`, com o mesmo `ETag` e o mesmo tratamento de `HEAD` de antes
 */
const EXTENSOES_QUE_COMPRIMEM = /\.(?:js|mjs|css|html|json|svg|wasm)$/i;

/**
 * E POR QUE ISTO ACONTECE DEPOIS DE GRAVAR, E NAO NO `generateBundle`.
 *
 * ## O DEFÉITO QUE O `generateBundle` CAUSA
 *
 * No `generateBundle` o CSS ainda esta em memoria, e em memoria ele tem 12
 * bytes a mais do que o arquivo final: o Vite acrescenta um marcador
 * `/*$vite$:1*\/` no fim do CSS e o remove quando grava. Comprimindo ali, o
 * `.gz` saia com esses 12 bytes, e o arquivo servido deixava de ser igual ao do
 * disco. Sao bytes de um comentario interno do Vite: nao quebram nada hoje, e
 * quebram amanha se o Vite mudar esse marcador
 *
 * ## POR QUE LER DO DISCO RESOLVE
 *
 * Porque o arquivo do disco e o arquivo que o servidor manda. Sem interpretacao,
 * sem marcador, sem divergencia: o `.gz` e a compressao dos bytes que existem
 *
 * ## E POR QUE SO QUANDO GANHA
 *
 * Porque um `.gz` maior que o original seria peso em disco sem ganho nenhum.
 * A regra e a mesma do WebP: se nao encolheu, nao gera
 */
function gerarComprimidosNoDisco(pastaSaida) {
  let bytesOriginais = 0;
  let bytesComprimidos = 0;
  let quantidade = 0;

  for (const arquivo of readdirSync(pastaSaida, { recursive: true })) {
    if (!EXTENSOES_QUE_COMPRIMEM.test(arquivo)) continue;

    const caminho = join(pastaSaida, arquivo);

    let dados;

    try {
      if (!statSync(caminho).isFile()) continue;

      dados = readFileSync(caminho);
    } catch {
      continue;
    }

    // abaixo de meio KB o cabecalho do gzip pesa mais que o arquivo
    if (dados.length < 512) continue;

    const comprimido = gzipSync(dados, { level: 9 });

    if (comprimido.length >= dados.length) continue;

    writeFileSync(`${caminho}.gz`, comprimido);

    bytesOriginais += dados.length;
    bytesComprimidos += comprimido.length;
    quantidade += 1;
  }

  if (quantidade) {
    console.log(
      `  arquivos .gz: ${quantidade} arquivo(s), ` +
        `${(bytesOriginais / 1024).toFixed(0)} KB -> ${(bytesComprimidos / 1024).toFixed(0)} KB ` +
        `(-${Math.round((1 - bytesComprimidos / bytesOriginais) * 100)}%)`
    );
  }
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
    plugins: [react(), tiledTmj(), imagensEmWebp(producao)],

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

      /**
       * O BUNDLE EM PEDAÇOS, E O MOTIVO REAL DE ISSO NAO SER DESEMPENHO.
       *
       * ## O PROBLEMA DE UM ARQUIVO SO
       *
       * Hoje todo o jogo sai em `main-ABC123.js`. O nome tem o hash do
       * conteudo inteiro, entao uma linha alterada em qualquer lugar — um
       * comentario, uma cor no CSS, um numero de HP — muda o hash, e o nome
       * novo e um arquivo que o navegador nunca viu
       *
       * Com o `Cache-Control: immutable` de um ano, o efeito e o pior possivel:
       * cada deploy obriga TODOS os jogadores a baixar de novo os 236 KB do
       * jogo inteiro, mesmo com 99,9% do conteudo igual
       *
       * ## O QUE A DIVISAO FAZ
       *
       * O React vai para o seu proprio arquivo e fica com o hash dele. Ele muda
       * quando o React muda — quase nunca. O mesmo vale para o motor e para os
       * catalogos de dados, que entram uma vez e raramente sao mexidos
       *
       * O jogador que volta depois de um deploy baixa so o pedaco que mudou
       *
       * ## E POR QUE `normalize` NO `id`
       *
       * Porque no Windows o id vem com barra invertida e no Linux com barra
       * normal. Sem normalizar, o `includes("/src/game/")` nao acha nada na
       * maquina de desenvolvimento — e a divisao funciona em producao e falha
       * aqui, que e o contrario do que se quer
       */
      output: {
        manualChunks(id) {
          const caminho = id.replace(/\\/g, "/");

          /**
           * O REACT SOZINHO, E NAO COMO PARTE DO `vendor`.
           *
           * Porque ele muda em outra frequencia que qualquer outra
           * dependencia: e o unico pedaco do jogo que fica igual entre deploys.
           * Junto do resto do `vendor`, ele mudaria junto com qualquer coisa que
           * o Rollup quisesse reordenar
           */
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(caminho)) {
            return "react";
          }

          /**
           * O MOTOR E OS DADOS, NO MESMO PEDACO, E POR QUE NAO SEPARADOS.
           *
           * ## O CICLO QUE SEPARAR CRIAVA
           *
           * Os catalogos de `src/data/` importam do motor, e o motor importa os
           * catalogos. Sao dois blocos que se referenciam, e o Rollup avisava
           * "Circular chunk: motor -> dados -> motor" toda vez que o build
           * rodava
           *
           *## POR QUE ISSO NAO E SO UM AVISO
           *
           * Um aviso de pedaco circular e a forma do build dizer que a ordem de
           * avaliacao dos modulos deixou de estar definida. Na melhor das
           * cenarios funciona e ninguem percebe. Pior: um `class`, um `const` ou
           * uma variavel exportada de um dos lados vira `undefined` na
           * primeira avaliacao — e o defeito aparece em producao, no meio do
           * jogo, como "cannot access before initialization"
           *
           *## O QUE SE PERDE AO JUNTAR
           *
           * Nada que importasse: os dois continuam fora do `main`, entao uma
           * correcao de cor no HUD ainda nao rebaixa o motor. E o `react` segue
           * separado, que e o pedaco que realmente nunca muda
           */
          if (
            caminho.includes("/src/game/") ||
            caminho.includes("/src/data/")
          ) {
            return "jogo";
          }

          return undefined;
        },
      },
    },
  },
  };
});
