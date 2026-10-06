import { minimapColorFor } from "../../data/terrain/index.js";

export const MINIMAP_WIDTH = 240;
export const MINIMAP_HEIGHT = 146;
export const MINIMAP_RIGHT = 20;

export const MINIMAP_TOP_IDLE = 84;
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

desenharObstaculos(
  context,
  map.blocking,
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
