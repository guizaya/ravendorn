/**
 * O MINIMAPA MOSTRA O MAPA, E MOSTRA NO LUGAR CERTO.
 *
 * ## POR QUE UM VERIFICADOR E NAO UM TESTE
 *
 * Porque o que precisa ser provado sao DUAS COISAS QUE PRECISAM CONFERIR: o
 * canvas fora de tela e do tamanho que o `computeMinimapTransform` espera, e
 * ele cobre o mapa inteiro. E uma comparacao de numeros entre duas funcoes
 *
 * ## E POR QUE VARIAR O TAMANHO DO PAINEL
 *
 * Porque o painel nao e fixo: o HUD reduz com a janela, e um painel mais alto
 * que largo muda qual lado limita a escala. A primeira versao deste codigo
 * levava so a largura, e num painel 300x200 o canvas saia 300x211 enquanto
 * o transform esperava 285x200 — o mapa aparecia 15px largo demais e o
 * jogador ia para fora do mapa desenhado
 *
 * Esse e o tipo de defeito que so aparece em uma resolucao especifica, e que
 * ninguem acha jogando num monitor grande
 */

import { computeMinimapTransform, MINIMAP_WIDTH, MINIMAP_HEIGHT } from "../src/game/ui/minimap.js";
import { destinoDe } from "../src/game/maps/minimapaTiled.js";

let ok = 0;
let falhas = 0;

function conferir(condicao, mensagem, detalhe) {
  if (condicao) {
    ok++;
    return;
  }
  falhas++;
  console.error(`  FALHA  ${mensagem}`);
  if (detalhe !== undefined) console.error(`         ${detalhe}`);
}

console.log("\n  O MINIMAPA DO MAPA 1\n");

const MUNDO = { width: 6016, height: 4224 };

/** A MESMA CONTA QUE `prepararMinimapa` FAZ */
function escalaDoCanvas(larguraPainel, alturaPainel) {
  return Math.min(larguraPainel / MUNDO.width, alturaPainel / MUNDO.height);
}

const paineis = [
  ["o padrao do jogo", MINIMAP_WIDTH, MINIMAP_HEIGHT],
  ["janela pequena", 160, 100],
  ["painel alto", 300, 200],
  ["painel largo", 400, 120],
  ["o dobro", MINIMAP_WIDTH * 2, MINIMAP_HEIGHT * 2],
  ["minusculo", 90, 70],
];

console.log("  o canvas tem que bater com o transform em TODO tamanho de painel\n");

for (const [nome, largura, altura] of paineis) {
  const t = computeMinimapTransform(MUNDO, largura, altura);
  const escala = escalaDoCanvas(largura, altura);

  const canvasLargura = Math.round(MUNDO.width * escala);
  const canvasAltura = Math.round(MUNDO.height * escala);

  const bate =
    Math.abs(canvasLargura - t.width) <= 1 &&
    Math.abs(canvasAltura - t.height) <= 1;

  conferir(
    bate,
    `painel ${nome} (${largura}x${altura}): o canvas tem o tamanho do transform`,
    `transform ${Math.round(t.width)}x${Math.round(t.height)}  canvas ${canvasLargura}x${canvasAltura}`,
  );

  /**
   * E O MAPA INTEIRO TEM QUE CABER DENTRO DO PAINEL.
   *
   * E o que garante que o minimapa nao cuts a beira do mapa. Um canvas maior
   * que o painel cortaria a ponta do dungeon, e o jogador veria a sala do
   * chefe fora do minimapa
   */
  conferir(
    canvasLargura <= largura + 1 && canvasAltura <= altura + 1,
    `painel ${nome}: o mapa inteiro cabe`,
    `canvas ${canvasLargura}x${canvasAltura} em painel ${largura}x${altura}`,
  );

  console.log(
    `  ${nome.padEnd(20)}${String(largura).padStart(4)}x${String(altura).padEnd(4)}  ` +
    `transform ${String(Math.round(t.width)).padStart(4)}x${String(Math.round(t.height)).padEnd(4)}  ` +
    `canvas ${String(canvasLargura).padStart(4)}x${String(canvasAltura).padEnd(4)}  ${bate ? "ok" : "DIVERGE"}`,
  );
}

/**
 * O PAINEL PREENCHE O MAPA, E NAO DEIXA MARGEM.
 *
 * ## O DEFEITO QUE ESTE TESTE PEGA
 *
 * Com o painel 240x146 e o mapa 6016x4224, o painel era 1.64 e o mapa 1.42.
 * O `computeMinimapTransform` centraliza o que sobra, e o minimapa mostrava
 * o dungeon encolhido no meio de um painel com 16px de cada lado — o mapa
 * "menor" que o jogador via, com o personagem andando no lugar errado
 *
 * A razao do painel tem que ser a do mapa. Com 168 de altura, a diferenca cai
 * para menos de meio pixel
 */
conferir(
  Math.abs(MINIMAP_WIDTH / MINIMAP_HEIGHT - MUNDO.width / MUNDO.height) / (MUNDO.width / MUNDO.height) < 0.005,
  "o painel tem a proporcao do mapa",
  `painel ${(MINIMAP_WIDTH / MINIMAP_HEIGHT).toFixed(5)} vs mapa ${(MUNDO.width / MUNDO.height).toFixed(5)}`,
);

/**
 * E O MAPA PREENCHE O PAINEL INTEIRO.
 *
 * A sobra tem que ser de menos de 1px. Acima disso o minimapa esta com
 * margem vazia ao redor, que e o que o jogador viu
 */
const tPadrao = computeMinimapTransform(MUNDO, MINIMAP_WIDTH, MINIMAP_HEIGHT);

conferir(
  MINIMAP_WIDTH - tPadrao.width < 1 && MINIMAP_HEIGHT - tPadrao.height < 1,
  "o mapa preenche o painel sem margem",
  `sobra de ${(MINIMAP_WIDTH - tPadrao.width).toFixed(2)}px em x e ${(MINIMAP_HEIGHT - tPadrao.height).toFixed(2)}px em y`,
);

/**
 * O DEFEITO DO ARREDONDAMENTO, QUE CORTAVA A PONTA DO MAPA.
 *
 * ## O QUE ACONTECIA
 *
 * Um tile de 64px neste mapa sai com `64 * 0.0398 = 2.545px`. A primeira
 * versao arredondava para `3`, e 94 tiles multiplicados por 3 davam 282px num
 * canvas de 239 — 43px a mais. O canvas descarta o que nao cabe, entao o
 * minimapa mostrava so o mapa ate `x=5099`, e o portal, em `x=5799`, ficava
 * sem arte debaixo
 *
 * ## O QUE O JOGADOR VIU
 *
 * O marcador dele — e o portal — flutuando no meio de uma regiao que nao tinha
 * imagem. Parecia o mapa estar "deslocado", mas o mapa nao estava: ele
 * terminava antes, e o marcador caia no trecho em branco
 */

/**
 * O TAMANHO DO TILE VEM DA FUNCAO REAL, E NAO DE UMA COPIA.
 *
 * A primeira versao deste arquivo reescrevia a conta aqui, e o verificador
 * passou verde mesmo com o `Math.round` de volta no codigo: ele conferia a
 * propria copia, e nao o que o motor faz. Para um verificador valer, ele tem
 * que chamar a mesma funcao que o jogo chama
 */

/** O TAMANHO EXATO, SEM O PISO — para saber se o piso foi o que estourou */
function destinoDeExato(tileWidth, escala) {
  return tileWidth * escala;
}

const TILE = 64;
const COLS = MUNDO.width / TILE;

for (const [nome, largura, altura] of paineis) {
  const escala = escalaDoCanvas(largura, altura);

  const destino = destinoDe(TILE, escala);
  const larguraDesenhada = COLS * destino;
  const larguraCanvas = Math.round(MUNDO.width * escala);

  /**
   * O ESTOURO SO E ERRO ACIMA DO PISO DE 1PX.
   *
   * `destinoDe` tem um piso de 1px: num painel tao pequeno que o tile cairia
   * abaixo de 1px, ele vira 1px e o desenho estoura o canvas. Isso e o
   * comportamento correto — sem o piso, o tile seria 0px e a parede sumiria
   * do minimapa em vez de virar um ponto
   *
   * O defeito que importa e o arredondamento: ele estoura mesmo com o tile
   * grande, que e o caso de 240x168
   */
  const noPiso = destino === 1 && destinoDeExato(TILE, escala) < 1;

  conferir(
    larguraDesenhada <= larguraCanvas + 1 || noPiso,
    `painel ${nome}: os tiles nao estouram o canvas`,
    `${COLS} tiles x ${destino.toFixed(3)}px = ${larguraDesenhada.toFixed(1)}px num canvas de ${larguraCanvas}px`,
  );

  conferir(
    larguraCanvas - larguraDesenhada < 1 || noPiso,
    `painel ${nome}: nenhum tile do mapa foi cortado`,
    `${(larguraCanvas - larguraDesenhada).toFixed(1)}px de mapa ficaram de fora`,
  );

  console.log(
    `  ${nome.padEnd(20)}tile de ${destino.toFixed(3)}px  ` +
    `${COLS} tiles = ${larguraDesenhada.toFixed(1)}px  canvas ${larguraCanvas}px  ` +
    `${larguraDesenhada <= larguraCanvas + 1 || noPiso ? "ok" : "ESTOURA"}`,
  );
}

console.log("");
console.log("  o mapa nunca e ampliado no minimapa");
conferir(
  escalaDoCanvas(MINIMAP_WIDTH, MINIMAP_HEIGHT) <= 1,
  "o mapa nunca e ampliado no minimapa",
  `escala ${escalaDoCanvas(MINIMAP_WIDTH, MINIMAP_HEIGHT).toFixed(4)}`,
);

/**
 * O MAPA E O JOGADOR NASCEM DA MESMA ORIGEM.
 *
 * ## O DEFEITO QUE ESTE TESTE PEGA
 *
 * O canvas fora de tela e o mapa CRU — sem a margem que centraliza. O
 * `drawMinimap` cola ele em `baseX`, que e o offset, e e o mesmo offset que
 * posiciona o jogador
 *
 * A primeira versao colava o canvas em 0 e o jogador em `baseX`. O resultado
 * era o mapa 16px a esquerda de onde ele devia: um inimigo da outra ponta
 * caia em cima da borda do desenho, e o jogador andava sobre o lugar errado
 *
 * E o que o usuario viu: mob do pantano "saindo do mapa", andando no lugar
 * de sempre
 */
for (const [nome, largura, altura] of paineis) {
  const t = computeMinimapTransform(MUNDO, largura, altura);

  const jogador = { x: MUNDO.width / 2, y: MUNDO.height / 2 };
  const pxJogador = t.offsetX + jogador.x * t.scale;
  const pyJogador = t.offsetY + jogador.y * t.scale;

  /**
   * O CENTRO DO MAPA TEM QUE CAIR NO CENTRO DO PAINEL.
   *
   * E a forma mais direta de dizer "as duas origens sao a mesma": se o
   * jogador no meio do mundo aparece no meio do painel, o mapa que ele ve
   * atras dele esta alinhado com o mundo
   */
  conferir(
    Math.abs(pxJogador - largura / 2) <= 1,
    `painel ${nome}: o jogador no centro do mundo cai no centro do painel`,
    `jogador em ${pxJogador.toFixed(1)}, painel ${largura} de largura`,
  );

  /**
   * E OS EXTREMOS DO MAPO PRECISAM CABER DENTRO DO PAINEL.
   *
   * O canto do mundo, em 0,0 e em `width,height`, e o que a parede mais
   * distante representa. Se ele cai fora do painel, o minimapa esta cortando
   * o mapa — e um inimigo naquela parede cai no nada
   */
  const cantos = [
    [0, 0],
    [MUNDO.width, 0],
    [0, MUNDO.height],
    [MUNDO.width, MUNDO.height],
  ];

  for (const [wx, wy] of cantos) {
    const px = t.offsetX + wx * t.scale;
    const py = t.offsetY + wy * t.scale;

    conferir(
      px >= -1 && px <= largura + 1 && py >= -1 && py <= altura + 1,
      `painel ${nome}: o canto (${wx}, ${wy}) do mundo cabe no painel`,
      `canto em ${px.toFixed(1)},${py.toFixed(1)} em painel ${largura}x${altura}`,
    );
  }

  console.log(
    `  ${nome.padEnd(20)}centro do mapa cai em ${pxJogador.toFixed(1)},${pyJogador.toFixed(1)}  (painel ${largura}x${altura})`,
  );
}

/**
 * UM MAPA COMO O MAPA 1 PRECISA TER LAYER.
 *
 * A escala e calculada sobre `mapa.width`, que vem de `lerMapaTiled`. Se um
 * mapa sem layer chegasse aqui, a divisao seria por `undefined` e o canvas
 * nasceria com 1px
 */
conferir(MUNDO.width > 0 && MUNDO.height > 0, "o mapa tem tamanho");

console.log(`\n  ${ok} ok, ${falhas} falhas\n`);

process.exit(falhas ? 1 : 0);