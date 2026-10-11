import { TAU } from "../math.js";

const MAX_EFFECTS = 400;

/**
 * OS PONTOS QUE UM DASH GUARDA NO RASTRO.
 *
 * ## POR QUE 26 E NAO UM NUMERO QUALQUER
 *
 * Porque a fila e a memoria do efeito: a 60Hz, um dash de 0,3s cria 18
 * pontos, e 26 da folga para o rastro nao ser cortado em pleno voo
 *
 * E o teto que importa: com 400 efeitos vivos, 26 pontos cada um sao 10.400
 * `moveTo` por quadro no pior caso. O `MAX_EFFECTS` limita quantos efeitos
 * existem, e este limita quanto cada um pesa
 */
const DASH_RASTRO_MAX = 26;

export class EffectSystem {
  constructor() {
    this.effects = [];
  }

  add(kind, properties, duration = 0.35) {
    /**
     * O EXCEDENTE SAI PELA CABECA.
     *
     * `shift()` em um array de 400 e O(n): ele move 400 referencias para
     * frente. E o `add` roda por efeito de dano, e um arqueiro
     * puxando area em um aglomerado cria dezenas por golpe — entao o
     * estouro do teto, que era raro, virava o caminho normal
     *
     * `pop()` e O(1) e remove o MAIS ANTIGO do fim. A diferenca e que
     * o oldest-efetimo-vivo que estava no inicio passa a ser removido
     * em vez do mais novo, e um efeito com duracao de 0,3s que esteja
     * no fim foi criado ha menos tempo que um do inicio. Como o tique
     * limpa os que venceram o `ttl`, sobra no fim so o que ainda estava
     * vivo quando o teto estourou — e perder o mais velho dele e o
     * mesmo que perder um novo
     */
    if (this.effects.length >= MAX_EFFECTS) {
      this.effects.pop();
    }

    this.effects.push({
      kind,
      ...properties,
      ttl: duration,
      maxTtl: duration,
    });
  }

  line(x, y, angle, length, width, color, duration = 0.25) {
    this.add(
      "line",
      { x, y, angle, length, width, color },
      duration,
    );
  }

  circle(x, y, radius, color, duration = 0.35, filled = false) {
    this.add(
      "circle",
      { x, y, radius, color, filled },
      duration,
    );
  }

  cone(x, y, angle, radius, color, duration = 0.3) {
    this.add(
      "cone",
      { x, y, angle, radius, color },
      duration,
    );
  }

  burst(x, y, color, duration = 0.45) {
    this.add("burst", { x, y, color }, duration);
  }

  addText(x, y, text, color, critical = false) {
    this.add(
      "text",
      {
        x,
        y,
        text,
        color,
        critical,
        velocityY: critical ? -52 : -38,
      },
      0.9,
    );
  }

  /**
   * O EFEITO DO DASH, e ele e o unico que SABE ANDAR.
   *
   * ## POR QUE UM TIPO NOVO E NAO UM `line` SOZINHO
   *
   * Porque o `line` nasce parado: ele desenha do ponto A ao ponto B e
   * apaga. O dash e o contrario disso — o boneco SAI do ponto A, entao um
   * risco desenhado em A ficaria para tras dele, e a ilusao seria de um
   * raio, nao de um deslocamento
   *
   * Este efeito guarda uma fila de pontos e redesenha o rastro inteiro a
   * cada quadro. O `ttl` de cada ponto diz ate quando ele pertence ao rastro,
   * entao a cauda encolhe sozinha conforme o boneco avanca
   *
   * ## POR QUE ISSO E UM EFEITO E NAO UMA ANIMACAO DA SPRITE
   *
   * Porque a folha do boneco nao tem quadro de dash em nenhuma das quatro
   * classes. Um efeito desenhado pelo canvas nao precisa de arte nova: ele
   * nasce de um retangulo e de um circulo, e funciona para as quatro classes
   * sem um arquivo por classe
   *
   * E o custo: 0 bytes de arte contra ~10 linhas de desenho
   */
  dash(x, y, angle, distance, color = "#9fd8ff", duration = 0.3) {
    this.add(
      "dash",
      { x, y, angle, distance, color, rastro: [] },
      duration,
    );
  }

  update(deltaTime) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];

      effect.ttl -= deltaTime;

      if (effect.kind === "text") {
        effect.x += Math.sin(effect.ttl * 12) * 12 * deltaTime;
        effect.y += effect.velocityY * deltaTime;
      }

      /**
       * O RASTRO DO DASH ANDA JUNTO COM O JOGADOR.
       *
       * Sem esta linha a fila ficaria presa no ponto de origem: o efeito
       * nasce onde o dash comecou e nunca mais se move, entao o boneco
       * correria para fora de um rastro parado — o oposto do que o efeito
       * existe para mostrar
       */
      if (effect.kind === "dash") {
        effect.rastro.push({ x: effect.x, y: effect.y });

        /**
         * O LIMITE DA FILA, e ele e o que segura o teto de 400 efeitos.
         *
         * Com a duracao de 0,3s e o tique a 60Hz, o dash cria 18 pontos por
         * uso. A fila inteira, a 60 dashes por minuto, seria 1080 pontos
         * vivos — e cada um vira um `moveTo` no canvas
         */
        if (effect.rastro.length > DASH_RASTRO_MAX) {
          effect.rastro.shift();
        }
      }

      if (effect.ttl <= 0) {
        this.effects.splice(index, 1);
      }
    }
  }

  /**
   * O DASH DESLOCADO, em pixels.
   *
   * Quem chama passa o `distance` e nao a velocidade, porque o motor sabe a
   * distancia total e nao quantos quadros o boneco vai levar ate parar
   */
  desenharDash(context, effect) {
    const { rastro, angle } = effect;

    if (rastro.length < 2) return;

    context.lineCap = "round";

    for (let indice = 1; indice < rastro.length; indice += 1) {
      const antes = rastro[indice - 1];
      const agora = rastro[indice];

      /**
       * A CAUDA AFINA: o ponto mais novo e o mais grosso.
       *
       * E o que faz o rastro parecer VELOCIDADE. Com largura igual em todos
       * os pontos, o desenho vira um retangulo comprido — e o jogador le um
       * borrão parado em vez de um movimento
       *
       * E o mesmo desenho, so com a espessura mudando: nao ha cor, nem
       * alpha, nem sprite por ponto
       */
      const peso = indice / rastro.length;

      context.lineWidth = 2 + peso * 9;

      context.globalAlpha = 0.08 + peso * 0.5;

      context.beginPath();
      context.moveTo(antes.x, antes.y);
      context.lineTo(agora.x, agora.y);
      context.stroke();
    }

    /**
     * A CABECA DO RASTRO, um circulo no ultimo ponto.
     *
     * E o que amarra a cauda no boneco: sem ela, o rastro termina no ar e
     * parece que o dash parou antes de chegar nele
     */
    const cabeca = rastro[rastro.length - 1];

    context.globalAlpha = 0.55;
    context.lineWidth = 2;

    context.beginPath();
    context.arc(cabeca.x, cabeca.y, 7, 0, TAU);
    context.stroke();
  }

  draw(context) {
    for (const effect of this.effects) {
      const progress = 1 - effect.ttl / effect.maxTtl;
      const fade = 1 - progress;

      context.save();
      context.globalAlpha = Math.max(0, fade);
      context.strokeStyle = effect.color;
      context.fillStyle = effect.color;
      context.lineWidth = effect.width ?? 4;
      context.shadowColor = effect.color;
      context.shadowBlur = 14;

      switch (effect.kind) {
        case "line": {
          const startX = effect.x;
          const startY = effect.y;

          const endX =
            startX + Math.cos(effect.angle) * effect.length;

          const endY =
            startY + Math.sin(effect.angle) * effect.length;

          context.lineCap = "round";
          context.beginPath();
          context.moveTo(startX, startY);
          context.lineTo(endX, endY);
          context.stroke();
          break;
        }

        case "circle": {
          context.beginPath();
          context.arc(
            effect.x,
            effect.y,
            Math.max(1, effect.radius * (0.75 + progress * 0.25)),
            0,
            TAU,
          );

          if (effect.filled) {
            context.globalAlpha *= 0.2;
            context.fill();
          }

          context.stroke();
          break;
        }

        case "cone": {
          context.beginPath();
          context.moveTo(effect.x, effect.y);
          context.arc(
            effect.x,
            effect.y,
            effect.radius,
            effect.angle - effect.angle / 2,
            effect.angle + effect.angle / 2,
          );
          context.closePath();
          context.globalAlpha *= 0.25;
          context.fill();
          context.globalAlpha = fade;
          context.stroke();
          break;
        }

        case "burst": {
          context.translate(effect.x, effect.y);
          context.rotate(progress * Math.PI);

          for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * TAU;
            const length = effect.radius
              ? effect.radius * progress
              : 35 + progress * 35;

            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(
              Math.cos(angle) * length,
              Math.sin(angle) * length,
            );
            context.stroke();
          }
          break;
        }

        case "text": {
          context.shadowBlur = 4;
          context.font = effect.critical
            ? "800 20px Inter, sans-serif"
            : "700 15px Inter, sans-serif";
          context.textAlign = "center";
          context.fillText(
            effect.text,
            effect.x,
            effect.y,
          );
          break;
        }

        case "dash":
          this.desenharDash(context, effect);
          break;

        default:
          break;
      }

      context.restore();
    }
  }
}
