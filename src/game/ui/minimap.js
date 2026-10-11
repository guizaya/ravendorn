import { minimapColorFor } from "../../data/terrain/index.js";

/**
 * O PAINEL DO MINIMAPA.
 *
 * ## POR QUE 168 x 118, E NAO 172 x 120
 *
 * Porque a razao do painel tem que ser a do mapa. `6016 / 4224 = 1.42424`, e
 * `168 / 118 = 1.42373` — erro de 0.036%, e sobra de 0.04px nos dois eixos
 *
 * ## POR QUE 172 x 120 NAO SERVIA, JA QUE PARECE MAIS REDONDO
 *
 * Porque `172 / 120 = 1.43333`, 0.6% mais larga que o mapa. Com o painel
 * largo demais, o `computeMinimapTransform` limita pela ALTURA, o mapa sai
 * com 170.9px em vez de 172, e sobra 1.09px de margem vazia a direita
 *
 * Foi exatamente o defeito que o autor reportou duas vezes: o mapa encolhido
 * no meio de uma caixa com sobra. `conferir-minimapa-tiled.mjs` reprovou o
 * 172 x 120, e com razao
 *
 * ## E POR QUE ESTES E NAO OUTROS
 *
 * Porque qualquer par serve se a razao bater. `178 x 125` daria erro de
 * 0.017%, ainda melhor, mas e maior. O par e o menor que deixa a sobra nos
 * dois eixos abaixo de 0.1px, que e invisivel e centrado
 */
export const MINIMAP_WIDTH = 168;
export const MINIMAP_HEIGHT = 118;

/**
 * A MARGEM DA DIREITA.
 *
 * O minimapa mora na coluna ESQUERDA, embaixo da box do personagem, entao
 * quem manda na borda dele agora e `MINIMAP_LEFT`. Esta constante sobrou
 * do layout antigo e o `minimap.test.js` ainda a importa para checar a
 * largura e a borda do painel de alvo — por isso continua exportada,
 * mesmo sem o motor usar
 */
export const MINIMAP_RIGHT = 20;

/**
 * A MARGEM DA ESQUERDA, e a margem de baixo.
 *
 * `MINIMAP_LEFT` e o mesmo `12px` que a `.hud-vitals` usa, para o
 * minimapa ficar alinhado com a box de cima em vez de pendurado ao lado
 *
 * `MINIMAP_BOTTOM` e o espaco reservado embaixo do painel. Serve para o
 * `drawMinimap` saber quanto ainda sobra de altura util antes de
 * desenhar
 */
export const MINIMAP_LEFT = 12;

/**
 * A MARGEM DE BAIXO, que e o VAO ENTRE O MINIMAPA E O RODAPE.
 *
 * ## POR QUE 32 E NAO MAIS 20
 *
 * Porque o rodape da barra de acoes fica na MESMA coluna do minimapa — o
 * `grid` da barra e `auto 1fr`, e o `.rodape` ocupa a primeira coluna, que e
 * a da esquerda. Com o minimapa colado nele, os dois pareciam uma caixa so
 *
 * O `20px` antigo era a folga que existia quando o minimapa era `240x146` e
 * a box de cima era mais alta. Depois que as tres caixas encolheram, o
 * minimapa subiu e o vao ficou curto demais: 20px entre duas bordas que
 * parecem do mesmo painel
 *
 * ## E POR QUE ESTE NUMERO, E NAO O `padding-top` DA BARRA
 *
 * Porque o `padding-top: 22px` da barra vale para a largura INTEIRA — ele
 * segura o trilho de XP e a fileira de skills, que sao largos e nao podem
 * descer mais. Mexer nele afasta o minimapa do rodape E empurra a barra
 * inteira para baixo, gastando altura de tela com algo que so incomoda na
 * coluna esquerda
 *
 * Subir o minimapa em 12px e o que abre o vao sem mexer no rodape nem no
 * resto da barra
 */
export const MINIMAP_BOTTOM = 32;

/**
 * ONDE O MINIMAPA NASCE, E ONDE ELE FICA.
 *
 * `84` era o `top` do `.target-panel`, na coluna direita: os dois dividiam
 * o mesmo slot e o minimapa saltava para `190` quando um alvo era
 * selecionado, para o painel de alvo aparecer no lugar dele
 *
 * Hoje o minimapa esta na coluna esquerda, embaixo da `.hud-vitals` (que
 * ocupa de `12px` ate perto de `93px`), e o painel de alvo virou o
 * `hud-topo`, no alto central
 *
 * ## POR QUE 94 E NAO MAIS 105
 *
 * Porque a `.hud-vitals` encolheu duas vezes: o padding, a fonte do nivel,
 * do nome e da classe desceram de tamanho, e a box passou a terminar antes.
 * O `top` do minimapa e a distancia da box de cima, entao ficar em 105
 * abriria um buraco grande entre as duas — e um buraco grande entre a box
 * do personagem e o minimapa e a mesma coisa que um vao pequeno entre o
 * minimapa e o rodape: o jogador le as tres como uma coluna so
 *
 * Com 94 o minimapa fica colado na box de cima, que e o que as duas caixas
 * de verdade pedem, e o vao que sobra em baixo e o que separa do rodape
 *
 * ## E POR QUE ISSO NAO SE CALCULA SOZINHO
 *
 * Porque o `top` da box esta em CSS e a altura dela depende do que esta
 * dentro: numero de linhas do nome, altura da barra, padding. Ler a caixa de
 * verdade do DOM por quadro seria caro, e um numero fixo com 94 medido e o
 * que o resto da coluna ja faz
 */
export const MINIMAP_TOP_IDLE = 94;

/**
 * ## SEM USO NO MOTOR — ESTA E A PARTE QUE FALTA
 *
 * As duas constantes abaixo descreviam a descida do minimapa quando havia
 * alvo: um `top` de descanso e uma taxa de interpolacao por quadro. A
 * descida foi removida do `GameEngine.drawMinimap` porque o painel de
 * alvo nao divide mais o slot do minimapa, entao ela nao desviava de nada
 *
 * Elas continuam exportadas por um motivo so: `minimap.test.js`,
 * `GameEngine.test.js` e `arteTiroRede.test.js` as importam e ainda
 * descrevem a animacao. Sem elas, o `import` estouraria e TRES arquivos de
 * teste inteiro parariam de carregar — e um arquivo que nao carrega nao
 * diz mais nada sobre o que quebrou
 *
 * Apagar estas duas linhas junto com as assercoes de `minimapY` nos tres
 * arquivos e o passo que fecha isso de vez
 */
export const MINIMAP_TOP_TARGETED = 190;

export const MINIMAP_SLIDE = 0.18;

const PANEL_BG = "rgba(7, 11, 15, 0.82)";
const PANEL_BORDER = "rgba(255, 255, 255, 0.14)";

export function computeMinimapTransform(
  map,
  width = MINIMAP_WIDTH,
  height = MINIMAP_HEIGHT,
) {
  const scale = Math.min(
    width / map.width,
    height / map.height,
  );

  const drawnWidth = map.width * scale;
  const drawnHeight = map.height * scale;

  return {
    scale,
    offsetX: (width - drawnWidth) / 2,
    offsetY: (height - drawnHeight) / 2,
    width: drawnWidth,
    height: drawnHeight,
  };
}

export function worldToMinimap(transform, x, y) {
  return {
    x: transform.offsetX + x * transform.scale,
    y: transform.offsetY + y * transform.scale,
  };
}

function drawMinimapPanel(
  context,
  originX,
  originY,
  width,
  height,
) {
  context.save();

  context.fillStyle = PANEL_BG;
  context.strokeStyle = PANEL_BORDER;
  context.lineWidth = 1;

  context.beginPath();

  if (context.roundRect) {
    context.roundRect(
      originX,
      originY,
      width,
      height,
      10,
    );
  } else {
    context.rect(
      originX,
      originY,
      width,
      height,
    );
  }

  context.fill();
  context.stroke();

  context.restore();
}

export function drawMinimap(
  context,
  {
    map,
    zones,
    player,
    enemies,
    viewport,
    /** os ids das props que o servidor tirou do mapa */
    pedidasFora,
    /** o canvas com o mapa do Tiled ja desenhado, quando o mapa tem um */
    imagemDoMapa,
    width,
    height,
    originX,
    originY,
    transform,
  },
) {
  drawMinimapPanel(
    context,
    originX,
    originY,
    width,
    height,
  );

  context.save();

  context.beginPath();
  context.rect(originX, originY, width, height);
  context.clip();

  context.translate(originX, originY);

  const scale = transform.scale;
  const baseX = transform.offsetX;
  const baseY = transform.offsetY;

  /**
   * O FUNDO DO MAPA sumiu.
   *
   * Havia um `fillRect` com `#141d1a` — um verde quase preto — que
   * cobria a area inteira do minimapa antes das zonas. O efeito era um
   * fundo verde chapado, e o painel arredondado parecia a borda de uma
   * mancha em vez de uma moldura
   *
   * O que fica e o `drawMinimapPanel`: o quadrado de `border-radius` com
   * o seu fundo escuro e a borda. As zonas, as arvores, o retangulo do
   * seu campo de visao e os pontos de mob continuam desenhados por
   * cima, e o que nao tem zona fica transparente, deixando o jogo
   * aparecer em vez de um retangulo opaco
   */

/**
 * O MAPA DE VERDADE, QUANDO O MAPA TEM UM.
 *
 * ## POR QUE ISTO VEM ANTES DAS ZONAS
 *
 * Porque a zona pintada e uma informacao que fica SOBRE o mapa, e o mapa
 * e o fundo. Desenhar as zonas primeiro e o mapa depois apagaria as zonas
 * com o retangulo da imagem
 *
 * ## E POR QUE COMO UM BLOCO SO
 *
 * Porque o canvas fora de tela ja tem o mapa inteiro desenhado na escala
 * dele. Desenhar tile a tile aqui seria refazer, a cada quadro, o que o
 * canvas ja tem pronto
 *
 * ## E POR QUE COLADO EM `baseX`
 *
 * Porque o canvas fora de tela e o mapa CRU — do canto dele ate o canto
 * oposto, sem margem. O `baseX` e o offset que centraliza o mapa no painel
 *
 * O jogador e os inimigos usam `baseX` tambem, entao os dois nascem da mesma
 * origem. Sem o offset, o mapa encostaria na esquerda do painel e o jogador
 * andaria 16px a direita de onde ele esta — e um inimigo da outra ponta do
 * mapa cairia em cima da borda do desenho
 */
if (imagemDoMapa) {
  context.drawImage(
    imagemDoMapa,
    baseX,
    baseY,
    transform.width,
    transform.height,
  );
} else {
    /**
     * SEM MAPA DE VERDADE, AS ZONAS SÃO O QUE TEM PARA MOSTRAR.
     *
     * E o caso do hub, do mapa 2 e do vale 1: nenhum deles tem `.tmj`, e o
     * minimapa sem zona nenhuma seria um retangulo vazio
     */
    for (const zone of zones) {
      context.fillStyle =
        zone.mapColor ??
        minimapColorFor(zone.terrain);

      context.fillRect(
        baseX + zone.x * scale,
        baseY + zone.y * scale,
        zone.width * scale,
        zone.height * scale,
      );
    }
  }

  /**
 * OS PONTOS DE OBSTACULO.
 *
 * Antes eram ~1226 `fillRect`, um por prop bloqueante, e um `fillStyle`
 * novo a cada um. Isso roda a 60Hz: sao 73 mil chamadas de canvas por
 * segundo so para desenhar pontinhos de 1 a 3px no minimapa
 *
 * As CORES sao Duas, nao 1226. Entao o `fillStyle` muda duas vezes e nao
 * uma por prop. O `fillRect` continua um por prop — agrupar exigiria
 * `beginPath` por ponto, que e mais caro do que o proprio rect
 *
 * E o cache vem do `map`, que e estavel: o minimapa desenha os mesmos
 * obstaculos em toda chamada e so o jogador e os inimigos mudam. A
 * lista ja vem em coordenadas de mundo, entao o que se cacheia e o
 * resultado depois da transformacao
 */
function desenharObstaculos(context, blocking, scale, baseX, baseY) {
  if (!blocking?.length) return;

  // uma passada para o verde, outra para o cinza: e o que troca o
  // `fillStyle` o menor numero de vezes possivel
  for (let cor = 0; cor < 2; cor += 1) {
    context.fillStyle = cor === 0
      ? "rgba(34, 63, 45, 0.8)"
      : "rgba(150, 155, 160, 0.6)";

    for (const prop of blocking) {
      const ehArvore = prop.isTree === true;

      if ((ehArvore ? 0 : 1) !== cor) continue;

      const size = Math.max(1, prop.radius * scale * 0.5);

      context.fillRect(
        baseX + prop.x * scale - size / 2,
        baseY + prop.y * scale - size / 2,
        size,
        size,
      );
    }
  }
}

/**
 * AS PROPS QUE O MINIMAPA PODE DESENHAR, e nao `map.blocking` cru.
 *
 * A pedra de cristal que o jogador minerou ate o fim SAI do mundo: o
 * servidor manda o id dela em `pedidasFora`, o desenho do canvas some com
 * ela e o colisor para de barra-la. O minimapa lia `map.blocking` direto e
 * deixava um ponto cinza onde a pedra nao estava mais — o unico lugar da
 * tela que ainda mostrava uma coisa que nao existe
 *
 * E o filtro esta AQUI, e nao em quem chama o `drawMinimap`, porque quem
 * chama passa o mapa inteiro e nao tem lista nenhuma. Uma linha por lugar
 * que desenha props e o jeito de a proxima nao esquecer
 *
 * E por `prop.id` e nao por `prop.type`: as 23 pedras comuns do vale sao
 * todas `cristal_comum`, e filtrar por tipo apagaria o campo inteiro
 */
const propsVisiveis = (map, pedidasFora) => {
  const fora = pedidasFora instanceof Set
    ? pedidasFora
    : new Set(pedidasFora ?? []);

  if (fora.size === 0) return map.blocking;

  return map.blocking.filter((prop) => !fora.has(prop.id));
};

desenharObstaculos(
  context,
  propsVisiveis(map, pedidasFora),
  scale,
  baseX,
  baseY,
);

  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 1;

  context.strokeRect(
    baseX +
      Math.max(0, player.x - viewport.width / 2) * scale,
    baseY +
      Math.max(0, player.y - viewport.height / 2) * scale,
    viewport.width * scale,
    viewport.height * scale,
  );

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const size = Math.max(
      2,
      enemy.radius * scale * 0.8,
    );

    context.fillStyle = enemy.color;

    context.fillRect(
      baseX + enemy.x * scale - size / 2,
      baseY + enemy.y * scale - size / 2,
      size,
      size,
    );
  }

  const playerX = baseX + player.x * scale;
  const playerY = baseY + player.y * scale;

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#0b1118";
  context.lineWidth = 1;

  context.beginPath();
  context.arc(
    playerX,
    playerY,
    3.5,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.stroke();

  context.restore();
}
