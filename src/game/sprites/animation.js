export const DIRECTION_KEYS = [
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
];

const DIRECTION_SECTOR =
  (Math.PI * 2) / DIRECTION_KEYS.length;

const DEFAULT_DIRECTION = "south";

export function isDirectionalFormat(definition) {
  return definition?.format === "directional";
}

export function resolveDirectionKey(
  facing,
  fallback = DEFAULT_DIRECTION,
) {
  const x = Number(facing?.x) || 0;
  const y = Number(facing?.y) || 0;

  if (x === 0 && y === 0) {
    return fallback;
  }

  const steps = Math.round(
    Math.atan2(y, x) / DIRECTION_SECTOR,
  );

  const index =
    ((steps % DIRECTION_KEYS.length) +
      DIRECTION_KEYS.length) %
    DIRECTION_KEYS.length;

  return DIRECTION_KEYS[index];
}

export function resolveDirection(facing, directions) {
  const absX = Math.abs(facing.x);
  const absY = Math.abs(facing.y);

  if (absY > absX) {
    return {
      row: facing.y > 0 ? directions.down : directions.up,
      flip: false,
    };
  }

  return {
    row: directions.side,
    flip: facing.x < 0,
  };
}

export function resolveAnimation(player, definition) {
  const animations = definition?.animations;

  /**
   * A reacao ao dano tem a maior prioridade de todas.
   *
   * `hitFlash` e o que o `DamageSystem` levanta quando o golpe
   * acerta. Se a arte do personagem tiver um bloco `hurt`, e ele que
   * entra; se nao tiver, o `resolveFrameRect` cai no `walk` e o
   * personagem continua na pose que tinha, sem sumir nem travar.
   *
   * Isto e o que faz a reacao funcionar de graça quando a arte
   * chegar: nao ha nada para ligar, o `hurt` passa a existir na
   * definicao do sprite e ja entra aqui
   */
  if (player.hitFlash > 0) {
    return "hurt";
  }

  if (player.attackAnimation > 0) {
    if (!animations) return "attack";

    const attack = animations.attack;

    // needsTarget marca arte de tiro: ela so entra quando ha
    // alvo de verdade. um buff proprio passa por aqui tambem, e
    // nesse caso o personagem tem de ficar em walk/idle. sem arte
    // de ataque propria, cai para walk/idle do mesmo jeito.
    if (attack && (!attack.needsTarget || player.firingTargetId)) {
      return "attack";
    }
  }

  return player.isMoving ? "walk" : "idle";
}

const MOVING_STATES = new Set([
  "chase",
  "wander",
  "return",

  // o atirador andando para tras de proposito. Sem esta entrada o
  // arquiro zumbi andava de costas e aparecia PARADO, porque o
  // desenho de andar so entra nos estados que andam
  "retreat",
]);

export function isCreatureMoving(enemy) {
  return MOVING_STATES.has(enemy.aiState);
}

export function resolveCreatureAnimation(enemy) {
  if (enemy.hitFlash > 0) {
    return "hurt";
  }

  if (enemy.attackAnimation > 0) {
    return "attack";
  }

  return isCreatureMoving(enemy) ? "walk" : "idle";
}

export function resolveFrame(animation, elapsed) {
  const length = animation.length;

  if (!Number.isFinite(length) || length <= 0) {
    return animation.start;
  }

  const fps = animation.fps > 0 ? animation.fps : 1;

  // Um tempo invalido aqui vira um retangulo de origem com `NaN`, e
  // o navegador nao desenha NADA: o inimigo some sem erro, sem aviso
  // e sem resto de vetor. Foi o que aconteceu com o boneco de
  // madeira, cujo `spriteOffset` nao existia e o tempo virava
  // `NaN`. A arte estava certa e ele estava invisivel
  const tempo = Number.isFinite(elapsed) ? elapsed : 0;

  const cycle = length / fps;
  const time = tempo % cycle;

  const frame = Math.floor(time * fps);

  return animation.start + (frame % length);
}

export function resolveFrameRect(
  definition,
  animationName,
  elapsed,
  facing,
) {
  if (isDirectionalFormat(definition)) {
    const key = resolveDirectionKey(
      facing,
      definition.fallbackDirection,
    );

    /**
     * O que fazer quando a arte nao tem a animacao pedida.
     *
     * O pedido e `hurt` para qualquer alvo que levou golpe, e a
     * maioria das folhas nao tem esse bloco. O reserva ANTIGO era
     * `walk`, e ele produzia o pior defeito possivel: um
     * personagem PARADO que recebia um golpe entrava no ciclo de
     * caminhada. O jogador via ele "andar no lugar" e, como a
     * reacao durava enquanto o pacote mandava valor, a cena ficava
     * com o boneco andando sem se mexer no mapa.
     *
     * O reserva e `idle`: um quadro parado e o que se parece com
     * alguém levando um golpe. E o `walk` continua como ultimo
     * recurso, para a folha antiga que so tem andar
     */
    const animation =
      definition.animations[animationName] ??
      definition.animations.idle ??
      definition.animations.walk;

    // row fixa (idle) ou deslocamento por direcao (tiro), em que
    // cada animacao tem seu proprio bloco de linhas na folha
    const directionRow = definition.directions[key] ?? 0;

    const row = animation.row !== undefined
      ? animation.row
      : (animation.rowOffset ?? 0) + directionRow;

    const column = resolveFrame(animation, elapsed);

    return {
      x: column * definition.frameWidth,
      y: row * definition.frameHeight,
      width: definition.frameWidth,
      height: definition.frameHeight,
      flip: false,
    };
  }

  const animation = definition.animations[animationName];
  const direction = resolveDirection(
    facing,
    definition.directions,
  );

  const column = resolveFrame(animation, elapsed);

  return {
    x: column * definition.frameWidth,
    y: direction.row * definition.frameHeight,
    width: definition.frameWidth,
    height: definition.frameHeight,
    flip: direction.flip,
  };
}

export function resolveWalkOffset(definition, entity) {
  const bob = definition.walkBob;
  const blend = entity.walkBlend ?? 0;

  if (!bob || bob.amplitude <= 0 || blend <= 0) {
    return { x: 0, y: 0 };
  }

  const phase =
    (entity.walkPhase ?? 0) *
    bob.frequency *
    Math.PI *
    2;

  return {
    x: 0,
    y: -Math.abs(Math.sin(phase)) * bob.amplitude * blend,
  };
}

export function resolveDrawRect(
  definition,
  player,
) {
  const scale = definition.scale;

  const width = definition.frameWidth * scale;
  const height = definition.frameHeight * scale;

  return {
    x: player.x - definition.anchorX * scale,
    y:
      player.y +
      definition.footOffset -
      definition.anchorY * scale,
    width,
    height,
  };
}

/**
 * Quanto tempo o alvo fica reagindo a um golpe.
 *
 * Vive aqui, e nao no `DamageSystem`, porque e uma constante de
 * APRESENTACAO: quem consome e o desenho, no flash e no tremor. O
 * `DamageSystem` importa este numero e usa para ligar o relogio, e
 * nao para ter uma copia que pode divergir
 */
export const HURT_FLASH_DURATION = 0.18;

/**
 * O TREMEOR de quem levou dano.
 *
 * E o deslocamento em pixels do desenho durante o `hitFlash`. Sem ele
 * o personagem levava o golpe sem reacao nenhuma: perdia vida, o
 * numero da barra caia, e o boneco continuava exatamente igual.
 *
 * A onda e uma senoide amortecida, e nao um pulo unico: um golpe
 * unico e um "piscar" que some antes de ser lido. A amplitude
 * diminui com o tempo restante, entao o tremor morre junto com o
 * flash em vez de abruptamente.
 *
 * O deslocamento e aplicado pela `translate` do contexto, e nao
 * dentro do retangulo: mexer no retangulo entraria na conta da
 * colisao e do alvo, e o tremor passaria a empurrar o personagem
 * dentro da geometria do jogo.
 */
export const HURT_SHAKE_AMPLITUDE = 6;
export const HURT_SHAKE_HZ = 26;

export function resolveHurtShake(hitFlash) {
  if (!(hitFlash > 0)) return { x: 0, y: 0 };

  const sobra = Math.min(1, hitFlash / HURT_FLASH_DURATION);
  const onda = Math.sin(hitFlash * HURT_SHAKE_HZ);

  return {
    x: onda * HURT_SHAKE_AMPLITUDE * sobra,
    y: onda * HURT_SHAKE_AMPLITUDE * 0.5 * sobra,
  };
}
