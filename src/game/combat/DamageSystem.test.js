import { describe, expect, it } from "vitest";
import { COR_DANO, DamageSystem } from "./DamageSystem.js";
import { mostrarDano, textoDoDano } from "./DanoVisual.js";

/**
 * O DANO e o numero que ele mostra.
 *
 * Este arquivo mede tres coisas que o jogador ve e nao o balanco de
 * vida:
 *
 * 1. **a COR** — quatro estados, quatro cores, e a prioridade entre
 *    eles. Um critico pintado da cor do golpe normal e um numero que o
 *    jogador deixa de procurar
 * 2. **o MISS** — o golpe que passou batido, que precisa dizer "MISS"
 *    e nao "0", e precisa NAO tirar vida nem disparar lifesteal
 * 3. **o `onResolved`** — o hook que alimenta o numero no online. Sem
 *    ele, o motor do servidor cria o texto e o jogador nunca ve
 */

/**
 * Um `StatusSystem` que responde o minimo.
 *
 * O `DamageSystem` pergunta tres coisas: se o alvo esta invulneravel,
 * os multiplicadores, e o reflexo. Um stub em vez do sistema inteiro
 * porque este arquivo nao esta medindo status — e os multiplicadores
 * sao 1, que e o que o jogo faz quando nao ha buff nenhum
 */
function statusFalso() {
  return {
    isInvulnerable: () => false,
    getMultiplier: () => 1,
    getReflect: () => 0,
  };
}

/** os textos que o `EffectSystem` receberia */
function efeitosFalsos() {
  const textos = [];

  return {
    textos,
    addText: (x, y, text, color, critical) =>
      textos.push({ x, y, text, color, critical }),
    add() {},
    update() {},
    draw() {},
  };
}

const alvo = (extra = {}) => ({
  hp: 500,
  maxHp: 500,
  alive: true,
  x: 100,
  y: 200,
  radius: 18,
  defense: 0,
  evasion: 0,
  shield: 0,
  ...extra,
});

const atacante = (extra = {}) => ({
  x: 10,
  y: 20,
  radius: 18,
  critRate: 0,
  critDamage: 1.5,
  accuracy: 0,
  ...extra,
});

/**
 * Monta o sistema com o sorteio cravado.
 *
 * `random` decide o miss E o critico. Passando `() => 1` nenhum dos
 * dois sai; `() => 0` faz os dois sairem. E o que permite testar
 * "acertou" e "errou" sem uma unica rodapega
 */
function sistema({ random = () => 1, status = statusFalso() } = {}) {
  const efeitos = efeitosFalsos();

  const resolvidos = [];

  const damage = new DamageSystem({
    statuses: status,
    effects: efeitos,
    random,
    onResolved: (...args) => resolvidos.push(args),
  });

  return { damage, efeitos, resolvidos };
}

describe("o miss", () => {
  it("o golpe que passa diz MISS e nao tira vida", () => {
    const { damage, efeitos } = sistema({ random: () => 0 });
    const mob = alvo({ evasion: 0.5 });

    const dano = damage.applyDamage(atacante({ accuracy: 0 }), mob, {
      damage: 100,
      damageType: "physical",
    });

    expect(dano, "o golpe que errou tirou vida").toBe(0);
    expect(mob.hp).toBe(500);

    expect(efeitos.textos).toHaveLength(1);
    expect(efeitos.textos[0].text).toBe("MISS");
  });

  it("a palavra MISS e branca", () => {
    const { damage, efeitos } = sistema({ random: () => 0 });

    damage.applyDamage(
      atacante({ accuracy: 0 }),
      alvo({ evasion: 0.5 }),
      { damage: 100, damageType: "physical" },
    );

    expect(efeitos.textos[0].color).toBe(COR_DANO.miss);
  });

  it("MISS nunca e um numero", () => {
    /**
     * O `0` seria mentira.
     *
     * Um mob com vida cheia ja aparece como `hp / maxHp` cheio: um `0`
     * ao lado dele parece "chegou e nao doeu", que e outra coisa. O
     * jogador precisa ler que o golpe PASSOU
     */
    const { damage, efeitos } = sistema({ random: () => 0 });

    damage.applyDamage(
      atacante({ accuracy: 0 }),
      alvo({ evasion: 0.5 }),
      { damage: 100, damageType: "physical" },
    );

    expect(efeitos.textos[0].text).not.toBe("0");
  });

  it("o golpe que errou nao dispara o onDamaged", () => {
    let avisou = false;

    const efeitos = efeitosFalsos();

    const damage = new DamageSystem({
      statuses: statusFalso(),
      effects: efeitos,
      random: () => 0,
      onDamaged: () => {
        avisou = true;
      },
    });

    damage.applyDamage(
      atacante({ accuracy: 0 }),
      alvo({ evasion: 0.5 }),
      { damage: 100, damageType: "physical" },
    );

    expect(avisou, "o golpe que errou conta como dano aplicado").toBe(
      false,
    );
  });

  it("o golpe que errou nao da lifesteal", () => {
    const { damage, resolvidos } = sistema({ random: () => 0 });
    const heroi = atacante({ accuracy: 0 });

    const vidaAntes = heroi.hp ?? 0;

    damage.applyDamage(heroi, alvo({ evasion: 0.5 }), {
      damage: 100,
      damageType: "physical",
      lifesteal: 0.5,
    });

    expect(heroi.hp ?? 0).toBe(vidaAntes);
    expect(resolvidos[0][2].amount).toBe(0);
  });

  it("quem nao tem esquiva nunca ve MISS", () => {
    const { damage, efeitos } = sistema({ random: () => 0 });

    damage.applyDamage(atacante({ accuracy: 0 }), alvo(), {
      damage: 100,
      damageType: "physical",
    });

    expect(efeitos.textos[0].text).not.toBe("MISS");
    expect(efeitos.textos[0].text).toBe("100");
  });

  it("a imunidade ganha do miss", () => {
    /**
     * A IMUNIDADE ganha do miss.
     *
     * Um alvo invulneravel nao "errou": o golpe chegou e foi recusado.
     * "MISS" seria mentira, e "IMUNE" e o texto certo
     */
    const status = statusFalso();

    status.isInvulnerable = () => true;

    const { damage, efeitos } = sistema({ random: () => 0, status });

    damage.applyDamage(
      atacante({ accuracy: 0 }),
      alvo({ evasion: 0.5 }),
      { damage: 100, damageType: "physical" },
    );

    expect(efeitos.textos[0].text).toBe("IMUNE");
  });
});

describe("as cores do dano", () => {
  const golpes = {
    normal: () => 1,
    critico: () => 0,
  };

  it("o dano normal e amarelo", () => {
    const { damage, efeitos } = sistema({ random: golpes.normal });

    damage.applyDamage(atacante(), alvo(), {
      damage: 100,
      damageType: "physical",
    });

    expect(efeitos.textos[0].color).toBe(COR_DANO.normal);
    expect(COR_DANO.normal).toBe("#ffe66d");
  });

  it("o critico e vermelho", () => {
    const { damage, efeitos } = sistema({ random: golpes.critico });

    damage.applyDamage(
      atacante({ critRate: 1 }),
      alvo(),
      { damage: 100, damageType: "physical" },
    );

    expect(efeitos.textos[0].color).toBe(COR_DANO.critico);
    expect(COR_DANO.critico).toBe("#ff5f56");
  });

  it("o magico e roxo", () => {
    const { damage, efeitos } = sistema({ random: golpes.normal });

    damage.applyDamage(atacante(), alvo(), {
      damage: 100,
      damageType: "magic",
    });

    expect(efeitos.textos[0].color).toBe(COR_DANO.magico);
  });

  it("o critico magico e vermelho, e nao roxo", () => {
    /**
     * A prioridade que o jogador sente.
     *
     * O critico e o numero que ele procura para meter ponto em
     * afinidade. Um critico magico pintado de roxo seria lido como
     * "fogo normal" e o jogador passaria por ele
     */
    const { damage, efeitos } = sistema({ random: golpes.critico });

    damage.applyDamage(atacante({ critRate: 1 }), alvo(), {
      damage: 100,
      damageType: "magic",
    });

    expect(efeitos.textos[0].color).toBe(COR_DANO.critico);
  });

  it("as quatro cores sao distintas", () => {
    const cores = Object.values(COR_DANO);

    expect(new Set(cores).size).toBe(cores.length);
  });

  it("o critico sai com a fonte maior", () => {
    const { damage, efeitos } = sistema({ random: golpes.critico });

    damage.applyDamage(
      atacante({ critRate: 1 }),
      alvo(),
      { damage: 100, damageType: "physical" },
    );

    expect(efeitos.textos[0].critical).toBe(true);
  });
});

describe("o hook onResolved", () => {
  it("conta tambem o golpe que errou", () => {
    /**
     * O que o online precisa.
     *
     * O `onDamaged` so dispara no acerto que tira vida, e o "MISS" nao
     * tira vida. Sem este hook o cliente nunca mostraria que errou, e o
     * jogador veria o mob sem piscar sem entender o que aconteceu
     */
    const { damage, resolvidos } = sistema({ random: () => 0 });

    damage.applyDamage(
      atacante({ accuracy: 0 }),
      alvo({ evasion: 0.5 }),
      { damage: 100, damageType: "physical" },
    );

    expect(resolvidos).toHaveLength(1);
    expect(resolvidos[0][2].missed).toBe(true);
    expect(resolvidos[0][2].amount).toBe(0);
  });

  it("leva quem atirou, quem levou e o resultado", () => {
    const { damage, resolvidos } = sistema();
    const heroi = atacante();
    const mob = alvo();

    damage.applyDamage(heroi, mob, {
      damage: 100,
      damageType: "physical",
    });

    const [quemAtirou, quemLevou, resultado] = resolvidos[0];

    expect(quemAtirou).toBe(heroi);
    expect(quemLevou).toBe(mob);
    expect(resultado).toMatchObject({
      amount: 100,
      critical: false,
      missed: false,
      damageType: "physical",
    });
  });

  it("marca o critico no resultado", () => {
    const { damage, resolvidos } = sistema({ random: () => 0 });

    damage.applyDamage(
      atacante({ critRate: 1 }),
      alvo(),
      { damage: 100, damageType: "physical" },
    );

    expect(resolvidos[0][2].critical).toBe(true);
  });

  it("conta o golpe na imunidade tambem", () => {
    const status = statusFalso();

    status.isInvulnerable = () => true;

    const { damage, resolvidos } = sistema({ status });

    damage.applyDamage(atacante(), alvo(), {
      damage: 100,
      damageType: "physical",
    });

    expect(resolvidos[0][2].immune).toBe(true);
  });

  it("nao conta golpe em alvo ja morto", () => {
    const { damage, resolvidos } = sistema();

    damage.applyDamage(atacante(), alvo({ hp: 0 }), {
      damage: 100,
      damageType: "physical",
    });

    // nao ha golpe nenhum: houve um ataque a um cadaver
    expect(resolvidos).toHaveLength(0);
  });
});

describe("o texto do numero, dos dois lados", () => {
  it("o single player e o online dizem a mesma coisa", () => {
    /**
     * A paleta compartilhada.
     *
     * O `DamageSystem` cria o texto no offline e o `DanoVisual` cria no
     * online. Se as duas pontas divergissem, um critico seria vermelho
     * numa e amarelo na outra, e o jogador acharia que o jogo mudava
     * de regra conforme ele entrasse numa partida
     */
    const { damage, efeitos } = sistema({ random: () => 0 });

    damage.applyDamage(
      atacante({ critRate: 1 }),
      alvo(),
      { damage: 100, damageType: "physical" },
    );

    const online = textoDoDano({
      amount: efeitos.textos[0].text,
      critical: true,
      missed: false,
      damageType: "physical",
    });

    expect(online.cor).toBe(efeitos.textos[0].color);
    expect(online.texto).toBe(efeitos.textos[0].text);
  });

  it("o online escreve MISS do mesmo jeito", () => {
    const { damage, efeitos } = sistema({ random: () => 0 });

    damage.applyDamage(
      atacante({ accuracy: 0 }),
      alvo({ evasion: 0.5 }),
      { damage: 100, damageType: "physical" },
    );

    expect(textoDoDano({ missed: true }).texto).toBe(
      efeitos.textos[0].text,
    );
  });
});

describe("mostrarDano", () => {
  /** um motor so com o que o numero precisa */
  function motorFalso(inimigos = [], player = null) {
    const textos = [];

    return {
      textos,
      world: { enemies: inimigos, player },
      effects: {
        addText: (x, y, text, color, critical) =>
          textos.push({ x, y, text, color, critical }),
      },
    };
  }

  it("desenha sobre o mob que levou", () => {
    const mob = { id: "slime_1", x: 400, y: 600, radius: 20 };
    const motor = motorFalso([mob]);

    mostrarDano(motor, {
      alvoId: "slime_1",
      alvoSouJogador: false,
      amount: 42,
      critical: false,
      missed: false,
      damageType: "physical",
    });

    expect(motor.textos).toHaveLength(1);
    expect(motor.textos[0].x).toBe(400);
    expect(motor.textos[0].y).toBe(600 - 20 - 8);
    expect(motor.textos[0].text).toBe("42");
  });

  it("desenha sobre o jogador quando ele e a vitima", () => {
    const motor = motorFalso([], { x: 800, y: 588, radius: 16 });

    mostrarDano(motor, {
      alvoId: "p_ana",
      alvoSouJogador: true,
      amount: 7,
      critical: false,
      missed: false,
      damageType: "physical",
    });

    expect(motor.textos[0].x).toBe(800);
    expect(motor.textos[0].text).toBe("7");
  });

  it("cai no jogador quando o mob nao esta no mundo", () => {
    /**
     * O mob morreu no golpe e o snapshot ainda nao chegou.
     *
     * O `DAMAGE` chega antes do `SNAPSHOT` que fecharia o golpe, e
     * nesse intervalo o id pode nao estar na lista. Sem o reserva, o
     * jogador nao veria NENHUM numero no abate — que e justo o golpe
     * que ele mais quer ver
     */
    const motor = motorFalso([], { x: 100, y: 100, radius: 16 });

    mostrarDano(motor, {
      alvoId: "slime_99",
      alvoSouJogador: false,
      amount: 999,
      critical: true,
      missed: false,
      damageType: "physical",
    });

    expect(motor.textos).toHaveLength(1);
    expect(motor.textos[0].text).toBe("999");
  });

  it("nao desenha sem motor", () => {
    expect(mostrarDano(null, { amount: 1 })).toBe(false);
  });

  it("nao desenha sem payload", () => {
    expect(mostrarDano(motorFalso(), null)).toBe(false);
  });
});
