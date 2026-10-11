import {
  resolveAnimation,
  resolveCreatureAnimation,
  resolveDeathAlpha,
  resolveDrawRect,
  resolveFrameRect,
  resolveHurtShake,
  resolveWalkOffset,
} from "./animation.js";

export class SpriteSheet {
    constructor(definition) {
      this.definition = definition;

      /**
       * O TAMANHO DESTE SPRITE NESTE MAPA, sobre o `scale` da definicao.
       *
       * E 1 quase sempre: so a base declara outra coisa, para o arquiro
       * caber no hub sem ocupar a tela inteira
       *
       * ## POR QUE ISTO VIVE NA FOLHA E NAO NO MAPA
       *
       * Porque o mapa nao sabe qual folha esta desenhando. Ele declara o
       * FATOR, e a folha o aplica a `resolveDrawRect` — assim o `scale` da
       * definicao continua sendo o tamanho do personagem, e o mapa apenas
       * multiplica
       *
       * E o que impede o outro defeito: escrever direto no
       * `definition.scale` de fora contaminationaria as DUAS folhas do
       * arquiro ao mesmo tempo — a do jogador local e a de `playerSprites` —
       * e a conta se perderia na troca de mapa
       */
      this.escalaDoMapa = 1;

      this.loaded = false;
    this.failed = false;
    this.scratch = null;

    this.image = null;

    if (typeof Image === "undefined") {
      this.failed = true;
      return;
    }

    this.image = this.createImage(definition.src);

    if (!this.image) {
      this.failed = true;
    }
  }

  createImage(src) {
    if (typeof Image === "undefined") return null;

    const image = new Image();

    image.onload = () => {
      this.loaded = true;
    };

    image.onerror = () => {
      this.failed = true;
    };

    image.src = src;

    return image;
  }

  get ready() {
    return this.loaded && this.image !== null;
  }

  createScratch() {
    if (this.scratch) return this.scratch;

    try {
      if (
        typeof document !== "undefined" &&
        typeof document.createElement === "function"
      ) {
        const canvas = document.createElement("canvas");

        if (canvas && typeof canvas.getContext === "function") {
          this.scratch = canvas;
          return canvas;
        }
      }
    } catch {
      this.scratch = null;
    }

    try {
      if (typeof OffscreenCanvas !== "undefined") {
        this.scratch = new OffscreenCanvas(1, 1);
        return this.scratch;
      }
    } catch {
      this.scratch = null;
    }

    return null;
  }

  getScratch(width, height) {
    const scratch = this.createScratch();

    if (!scratch) return null;

    if (
      scratch.width !== width ||
      scratch.height !== height
    ) {
      scratch.width = width;
      scratch.height = height;
    }

    return scratch;
  }

  draw(context, player, elapsed) {
    return this.drawEntity(
      context,
      player,
      elapsed,
      resolveAnimation(player, this.definition),
    );
  }

  /**
   * O BICHO, E O BICHO QUE ESTA MORRENDO.
   *
   * `morrendo` e separado porque o cadaver tem dois estados que nao
   * cabem em um nome de animacao so: ele precisa da arte de `death` e
   * de um alfa que muda com o tempo, e o `resolveFrameRect` so devolve
   * um retangulo de origem
   *
   * Sem este parametro, o motor teria de escrever em `enemy` para dizer
   * "este esta morrendo", e o `resolveCreatureAnimation` — que e
   * compartilhado por toda folha de criatura — passaria a depender de
   * um campo que so o motor conhece
   */
  drawCreature(context, enemy, elapsed, morrendo = false) {
    const animation = morrendo
      ? "death"
      : resolveCreatureAnimation(enemy);

    /**
     * O ALFA DA MORTE.
     *
     * O cadaver fica opaco enquanto o ciclo roda e so esmaece no fim.
     * Aplicar o fade desde o primeiro quadro deixaria o golpe com o
     * corpo translucido, e o jogador veria o mapa atraves do mob que
     * ele acabou de acertar
     */
    const fade = morrendo ? resolveDeathAlpha(enemy) : 1;

    return this.drawEntity(context, enemy, elapsed, animation, fade);
  }

  /**
   * @param fade o alfa do desenho, de 0 a 1. Quem esta vivo passa 1 e
   * nao sente diferenca; o cadaver passa o que sobra do relogio e
   * some sozinho
   */
  drawEntity(context, entity, elapsed, animationName, fade = 1) {
    if (!this.ready) return false;

    const definition = this.definition;

    const source = resolveFrameRect(
      definition,
      animationName,
      elapsed,
      entity.facing,
    );

    const target = resolveDrawRect(
      definition,
      entity,
      this.escalaDoMapa,
    );
    const offset = resolveWalkOffset(definition, entity);

    /**
     * O TREMOR de quem levou dano.
     *
     * O flash de cima ja existia e e o que avisa "acertaram em mim".
     * O que faltava era o CORPO se mexer: sem o tremor, o golpe
     * aparecia como um piscar de cor num personagem parado, e o
     * jogador nao sentia o impacto. O deslocamento e uma
     * `translate` do contexto e NAO entra no retangulo de destino:
     * mudar o retangulo contaminaria a colisao e o alvo
     */
    const tremor = resolveHurtShake(entity.hitFlash);

    target.x += offset.x;
    target.y += offset.y;

    context.save();

    /**
     * O ALFA ENTRA DEPOIS DO `save`, e nunca antes.
     *
     * O `save` e o `restore` sao o par que devolve o contexto ao estado
     * anterior. Se o alfa fosse posto antes do `save`, o `restore` o
     * levaria junto e o proximo desenho — o drop, o jogador, o proprio
     * mob seguinte — sairia com o cadaver ainda translucido
     */
    if (fade < 1) {
      context.globalAlpha = Math.max(0, fade);
    }

    if (tremor.x !== 0 || tremor.y !== 0) {
      context.translate(tremor.x, tremor.y);
    }

    if (source.flip) {
      context.translate(
        target.x + target.width,
        target.y,
      );
      context.scale(-1, 1);
    }

    if (entity.hitFlash > 0) {
      this.drawFlash(
        context,
        source,
        target,
        entity.hitFlash,
      );
    } else {
      context.drawImage(
        this.image,
        source.x,
        source.y,
        source.width,
        source.height,
        target.x,
        target.y,
        target.width,
        target.height,
      );
    }

    context.restore();

    return true;
  }

  drawFlash(context, source, target, amount) {
    const scratch = this.getScratch(
      target.width,
      target.height,
    );

    if (!scratch) return;

    const scratchContext = scratch.getContext("2d");

    scratchContext.clearRect(
      0,
      0,
      target.width,
      target.height,
    );

    scratchContext.imageSmoothingEnabled = false;

    scratchContext.drawImage(
      this.image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      target.width,
      target.height,
    );

    scratchContext.globalCompositeOperation =
      "source-atop";

    scratchContext.fillStyle = `rgba(255, 255, 255, ${Math.min(
      1,
      amount * 4,
    )})`;

    scratchContext.fillRect(
      0,
      0,
      target.width,
      target.height,
    );

    scratchContext.globalCompositeOperation =
      "source-over";

    context.drawImage(
      scratch,
      0,
      0,
      target.width,
      target.height,
      target.x,
      target.y,
      target.width,
      target.height,
    );
  }

  destroy() {
    if (this.image) {
      this.image.onload = null;
      this.image.onerror = null;
      this.image.src = "";
    }

    this.image = null;
    this.scratch = null;
    this.loaded = false;
  }
}
