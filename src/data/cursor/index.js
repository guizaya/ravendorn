/**
 * A arte da mira, o cursor que o jogador mira com o mouse.
 *
 * ## POR QUE ISTO E UM ARQUIVO SO, E NAO UM MAPA
 *
 * Porque a mira e a mesma em todo mapa — o que muda entre um mapa e
 * outro e se ela aparece, e quem decide isso e o `emZonaDeCombate` do
 * motor. Um mapa nao escolhe a arte da mira
 *
 * ## POR QUE O CAMINHO ESTA ESCRITO POR EXTENSO
 *
 * E a regra do Vite: ele so empacota o `new URL` quando o caminho esta
 * literal. Com `new URL(\`../assets/cursor/${nome}.png\`, import.meta.url)`
 * o build passa, imprime `built`, e o PNG nao vai para o `dist` — no
 * desenvolvimento a URL `file://` funciona e a mira aparece, e so em
 * producao que ela some, sem erro e sem aviso
 *
 * O `new URL(..., import.meta.url)` e o mesmo motivo de `./sprites/` e de
 * `data/items/icons.js`: o motor tambem roda no servidor Node, e um
 * `import url from "mira.png"` derrubaria o processo com
 * ERR_UNKNOWN_FILE_EXTENSION. O Node resolve isto para uma string sem
 * abrir o arquivo
 */
export const MIRA = new URL(
  "../../assets/cursor/mira_variacao1.png",
  import.meta.url,
).href;

/**
 * O ICONE DO SLOT DO AUTO, O DA DIREITA.
 *
 * ## POR QUE ESTE ARQUIVO E NAO O `HUD`
 *
 * Pela regra do Vite: ele so empacota o `new URL` quando o caminho esta
 * LITERAL. Um `new URL(\`../assets/icons/${lado}.png\`, import.meta.url)`
 * passaria o build, imprimiria `built`, e o PNG nao iria para o `dist` — no
 * desenvolvimento a URL `file://` funciona e o icone aparece, e so em
 * producao ele sumiria, sem erro e sem aviso
 *
 * E o mesmo motivo do `MIRA` acima: o motor tambem roda no servidor Node, e
 * um `import url from "right.png"` derrubaria o processo com
 * ERR_UNKNOWN_FILE_EXTENSION
 */
export const ICONE_SLOT_DIREITA = new URL(
  "../../assets/icons/right.png",
  import.meta.url,
).href;

/**
 * O TAMANHO DA MIRA NA TELA, EM PIXEL DE TELA.
 *
 * E o LADO do quadrado em que a arte e desenhada, e nao o tamanho da arte
 * visivel. A PNG e de 1600x1600 e so ocupa uns dois tercos dela — o resto e
 * transparente. Desenhada no tamanho dela, a mira cobriria a tela inteira;
 * desenhada pequena, ela some entre os inimigos
 *
 * ## POR QUE 34 CONTINUA SERVINDO COM A ARTE NOVA
 *
 * A arte nova e mais DELEGADA que a anterior: 11,2% dos pixels dela tem
 * cor, contra 20,8% da `mira_transparente`. No mesmo quadrado de 34px ela
 * ocupa 21,6x21,0 px visiveis, e a antiga ocupava 26,7x28,9
 *
 * Ou seja: no mesmo `MIRA_TAMANHO`, a mira nova aparece MENOR. Isso e
 * proposital — um reticulo fino some menos em cima de um mob grande do que um
 * reticulo pesado. Se ela ficar pequena demais na tela, o ajuste e aqui e
 * nowhere else
 *
 * E o `devicePixelRatio` nao entra: o `context` ja esta escalado pelo `dpr`
 * no `render`, entao o numero e sempre em pixel de TELA e independente da
 * densidade do monitor
 */
export const MIRA_TAMANHO = 34;

/**
 * O DESLOCAMENTO DO PONTEIRO DENTRO DA ARTE.
 *
 * A mira e desenhada com o PONTEIRO no CENTRO do quadrado, e nao no canto:
 * e o que faz o clique acertar o que esta embaixo do mouse. O valor e o
 * quanto o desenho recua desse centro, em pixel de tela
 *
 * ## POR QUE `{x: 0, y: 0}` COM A ARTE NOVA
 *
 * Porque o desenho nao esta centrado no PNG, e mesmo assim o zero e o certo.
 * Medindo os pixels que tem cor: o centro da arte esta 2,5px a esquerda e
 * 45,5px ABAIXO do meio dos 1600px — 2,8% da altura
 *
 * Levado para os 34px de tela, esse 2,8% vira menos de 1px. Compensar com um
 * `y` negativo tiraria a mira do lugar exato por um valor que o olho nao
 * distingue, e o `server` mira pela posicao do ponteiro: um desvio aqui e um
 * desvio no golpe
 *
 * ## POR QUE O CENTRO, E NAO O MEIO DA ARTE
 *
 * Porque a arte e um retículo SIMETRICO. Se o desenho tivesse o centro
 * de massa no meio do PNG, o jogador teria de mirar um pouco fora do
 * inimigo, e o servidor — que mira pela posicao do ponteiro — acertaria
 * outro lugar
 */
export const MIRA_OFFSET = { x: 0, y: 0 };
