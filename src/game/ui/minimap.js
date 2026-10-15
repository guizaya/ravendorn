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
/**
 * A LARGURA E A ALTURA, E POR QUE ELAS SAO AS DA COLUNA DE MISSOES.
 *
 * A coluna da direita da HUD e calculada, nao escolhida: sao cinco botoes de
 * 32px com quatro vaos de 8px, que dao 192px. A caixa de missoes ocupa essa
 * largura inteira porque e `width: 100%` da coluna
 *
 * ## POR QUE O MINIMAPA PRECISA DA MESMA LARGURA
 *
 * Porque o jogador olha para a coluna direita como uma coisa so. Duas caixas
 * empilhadas com larguras diferentes — o minimapa com 168 e as missoes com
 * 192 — parecem dois paineis que nao conversam, e o desalinhamento de 24px na
 * borda e visivel de longe
 *
 * ## E A ALTURA VEM DA RAZAO, E NAO DE UM NUMERO NOVO
 *
 * O mapa e desenhado com `contain`: `computeMinimapTransform` escala pelos
 * dois eixos e centraliza. A largura subiu de 168 para 192, um fator de
 * 1,1429; a altura subiu na mesma razao, de 118 para 135. Escolher 135 a mao
 * daria a mesma sobra de hoje; escolher outro valor esticaria o mapa ou
 * deixaria uma tarja — que e o que o `contain` existe para evitar
 */
export const MINIMAP_WIDTH = 192;
export const MINIMAP_HEIGHT = 135;

/**
 * A COR E O TAMANHO DO PONTO DO CHEFE.
 *
 * ## POR QUE UM TOM SEPARADO DO VERMELHO DE INIMIGO
 *
 * Porque o vermelho dos inimigos aqui e o `enemy.color`, que cada criatura
 * traz do catalogo. Um chefe marcado com o mesmo vermelho nao se distinguiria
 * de um mob raro no meio de outros 30 pontos
 *
 * E o tom e mais quente e mais saturado que o vermelho de mob: no minimapa ele
 * tem que ser o unico ponto que o jogador procura
 *
 * ## E POR QUE 3px, E NAO O RAIO DO CHEFE
 *
 * Porque o marcador do vale e um LUGAR, nao a criatura: e onde o chefe esta.
 * Desenhar no tamanho do Hulk daria um quadrado de 46px no meio de um
 * minimapa de 168 — um terco da largura para dizer "o chefe esta aqui"
 */
export const CHEFE_NO_MINIMAPA = "#ff3b46";
export const LADO_DO_CHEFE = 3;

/**
 * A MARGEM DA DIREITA, e ela virou a margem REAL do minimapa.
 *
 * ## O QUE MUDOU
 *
 * O minimapa morava na coluna ESQUERDA, embaixo da box do personagem, e a
 * borda era governada pelo `MINIMAP_LEFT`. Agora ele mora na coluna DIREITA,
 * acima da caixa de missoes, e e esta margem que o posiciona: o `drawMinimap`
 * calcula a origem por `width - MINIMAP_RIGHT - MINIMAP_WIDTH`
 *
 * ## E POR QUE 12, E NAO OS 20 DE ANTES
 *
 * Porque a coluna da direita da HUD esta em `right: 12px`. Com 20 aqui, o
 * minimapa terminaria 8px mais a esquerda do que a caixa de missoes, e o
 * desalinhamento reaparecia pela outra porta — em cima, em vez de na largura.
 * A margem do minimapa e a margem da coluna, e nao um numero solto
 */
export const MINIMAP_RIGHT = 12;

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
 * ONDE O MINIMAPA NASCE: LOGO ABAIXO DO GRUPO DE BOTOES.
 *
 * ## A CONTA
 *
 * A coluna direita da HUD comeca em `top: 12px` e traz o menu antes de
 * qualquer outra coisa. O menu e uma FILEIRA nao uma coluna — o
 * `justify-content: flex-end` dele e a prova — e cada botao e um
 * `.hud-btn` de 32x32. Entao a altura do menu e 32px, e nao o produto de
 * cinco botoes:
 *
 *     12 (top da coluna) + 32 (altura do menu) + 8 (gap) = 52
 *
 * ## POR QUE 192 NAO SERIA O `top`
 *
 * Porque 192 e a LARGURA da coluna, que sai de `--menu-n * --btn-h +
 * (--menu-n - 1) * --btn-gap` com os botoes lado a lado. Usar esse numero
 * como altura punha o minimapa em `212`, bem dentro da caixa de missoes, e o
 * minimapa sumia atras dela — que e o sintoma de quando esta constante estava
 * errada
 *
 * ## E POR QUE UM NUMERO E NAO A LEITURA DO DOM
 *
 * Porque a altura da caixa de missoes depende do que ha dentro dela. Ler o
 * DOM por quadro seria caro, e 32px e a altura fixa do `.hud-btn`
 */
export const MINIMAP_TOP_IDLE = 52;

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
export const MINIMAP_TOP_TARGETED = 148;

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
    /** os pontos do chefe, quando ele nao esta no mesmo mapa do jogador */
    chefes = [],
    viewport,
    /**
     * O CENTRO DA CAMERA, que e o jogador preso aos limites do mapa.
     *
     * Vem de fora porque este arquivo nao tem como saber: o clamp depende
     * do zoom e das medidas da tela, e quem tem as duas e o motor. Ausente
     * — o chamador antigo, um teste — a camera segue o jogador, que e o
     * comportamento de antes
     */
    centroDaCamera = null,
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

  /**
   * O RETANGULO DO CAMPO DE VISAO.
   *
   * Sai do CENTRO DA CAMERA, e nao do jogador: perto da borda do mapa os
   * dois se separam, e medir pelo jogador desenhava a faixa longe de onde
   * a tela estava realmente olhando.
   *
   * O `Math.max(0, ...)` tambem era de meio lado so — prendia a esquerda e
   * o topo e deixava vazar pela direita e por baixo. Aqui os dois eixos
   * passam pelo mesmo limite.
   */
  const centro = centroDaCamera ?? player;
  const esquerda = Math.max(0, centro.x - viewport.width / 2);
  const topo = Math.max(0, centro.y - viewport.height / 2);

  const larguraVisivel = Math.min(viewport.width, map.width - esquerda);
  const alturaVisivel = Math.min(viewport.height, map.height - topo);

  if (larguraVisivel > 0 && alturaVisivel > 0) {
    context.strokeRect(
      baseX + esquerda * scale,
      baseY + topo * scale,
      larguraVisivel * scale,
      alturaVisivel * scale,
    );
  }

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

  /**
   * OS PONTOS DO CHEFE, DEPOIS DOS INIMIGOS E ANTES DO JOGADOR.
   *
   * ## A ORDEM
   *
   * Depois dos inimigos, para o ponto do chefe ficar POR CIMA deles: no vale
   * ele e o unico ponto vermelho quente e o resto sao criaturas, e ele nao
   * pode sumir atras de um mob que caiu na frente
   *
   * Antes do jogador, pela mesma razao com o quadrado branco: o jogador e o
   * unico que nunca pode ficar escondido
   *
   * ## E POR QUE SO UM PONTO FIXO
   *
   * Porque o que entra aqui e o `bosses` do mapa: o lugar onde o chefe esta.
   * O desenho dele em tamanho de criatura foi o que virou uma mancha de 46px
   * no meio da arena, e o minimapa nao e um mapa deSizes — e um mapa de onde
   * ir
   */
  for (const chefe of chefes) {
    context.fillStyle = chefe.color ?? CHEFE_NO_MINIMAPA;

    context.beginPath();
    context.arc(
      baseX + chefe.x * scale,
      baseY + chefe.y * scale,
      LADO_DO_CHEFE,
      0,
      Math.PI * 2,
    );
    context.fill();
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
