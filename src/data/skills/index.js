function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function iconFromName(name) {
  return name
    .replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function createAction(name, type, configuration = {}) {
  return {
    id: slugify(name),
    name,
    icon: configuration.icon ?? iconFromName(name),
    description: configuration.description ?? "",
    type,
    damage: 0,
    damageType: "physical",
    cooldown: 5,
    resourceCost: 0,
    castTime: 0,
    range: 0,
    radius: 0,
    duration: 0,
    angle: Math.PI / 2,
    hits: 1,
    hitInterval: 0.35,
    targetType:
      type === "self"
        ? "self"
        : type === "ground"
          ? "ground"
          : "direction",
    effects: [],
    selfEffects: [],
    ...configuration,
  };
}

/**
 * QUANTAS HABILIDADES CADA PERSONAGEM TEM.
 *
 * ## O LIMITE
 *
 * Quatro, e o `ultimate` NAO conta: ele fica no botao proprio e nao ocupa
 * um dos slots de habilidade
 *
 * ## POR QUE O CORTE E AQUI E NAO NAS LISTAS
 *
 * As listas ainda escrevem todas as acoes, e o corte acontece em
 * `slice(0, MAX_SKILLS)` no `createPack`. Isso e deliberado:
 *
 * - o que fica e sempre a PRIMEIRA metade, na ordem em que foi escrita, e
 *   o criterio "as quatro primeiras" fica visivel no dado
 * - trocar a ordem de uma lista muda o que o jogador recebe, e isso nao
 *   deve acontecer por acidente ao editar uma acao no meio do arquivo
 *
 * As acoes alem do limite continuam no arquivo. Elas nao viram habilidade,
 * nao entram no save e nao aparecem na barra — mas ficam legiveis para
 * uma classe nova, e apagar codigo que funciona e o jeito mais rapido de
 * perder trabalho
 *
 * ## POR QUE QUATRO, E COMO UMA CLASSE PERDE A SUA
 *
 * Baixou de cinco para quatro por decisao do jogador. O que caiu NAO foi
 * sempre a mesma posicao: o Warrior, o Lancer e o Arbalist perderam o
 * TERCEIRO slot, e o Sorcerer perdeu o QUARTO
 *
 * Isso e por isso que a acao removida foi MOVIDA para depois do limite em
 * vez de apagada. O `slice` e por posicao, entao "remover o terceiro" e
 * "deixar o terceiro de fora" sao coisas diferentes: apagando o codigo, o
 * quinto viraria o quarto e a classe ganharia uma habilidade nova sem
 * ninguem pedir
 */
const MAX_SKILLS = 4;

function createPack(prefix, actions, ultimateAction) {
  const skills = actions
    .slice(0, MAX_SKILLS)
    .map((item, index) => ({
      ...item,
      id: `${prefix}_${item.id}`,
      slot: index + 1,
    }));

  return {
    skills,
    ultimate: {
      ...ultimateAction,
      id: `${prefix}_${ultimateAction.id}`,
      slot: "ultimate",
    },
  };
}

export const SKILL_PACKS = {
  warrior: createPack(
    "warrior",
    [
      createAction("Void Slash", "line", {
        damage: 92,
        cooldown: 5,
        resourceCost: 18,
        range: 220,
        radius: 48,
        effects: [{ type: "knockback", value: 70 }],
      }),

      createAction("Splitting Slash", "cone", {
        damage: 118,
        cooldown: 8,
        resourceCost: 22,
        range: 145,
        angle: 1.9,
        effects: [{ type: "knockback", value: 90 }],
      }),

      createAction("Ground Smash", "circle", {
        damage: 108,
        cooldown: 9,
        resourceCost: 25,
        radius: 165,
        effects: [
          { type: "knockback", value: 240 },
          { type: "stun", duration: 0.65 },
        ],
      }),

      createAction("Gale Slash", "circle", {
        damage: 44,
        cooldown: 10,
        resourceCost: 28,
        radius: 145,
        hits: 3,
        hitInterval: 0.32,
      }),

      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * O `Body Check` era o TERCEIRO slot do Warrior, e saiu da fileira
       * por decisao do jogador. Ele NAO foi apagado: virou uma das acoes
       * alem do `MAX_SKILLS`, que e exatamente o que acontece com as
       * acoes que sempre ficaram fora daqui
       *
       * Ele e o `dash` do Warrior — o unico da classe com `stun` curto e
       * recuo curto. `Sweeping Storm` e `Dragon Tail` cobrem o avanco e
       * o controle de linha sem custar um slot
       */
      createAction("Body Check", "dash", {
        damage: 72,
        cooldown: 7,
        resourceCost: 18,
        distance: 220,
        width: 55,
        effects: [{ type: "stun", duration: 0.35 }],
      }),

      createAction("Lion's Roar", "circle", {
        damage: 74,
        cooldown: 12,
        resourceCost: 30,
        radius: 190,
        effects: [
          { type: "weaken", duration: 5, value: 0.25 },
          { type: "stun", duration: 0.8 },
        ],
      }),

      createAction("Riposte", "self", {
        cooldown: 14,
        resourceCost: 22,
        duration: 4,
        shield: 120,
        reflect: 0.15,
        selfEffects: [
          { type: "damageReduction", duration: 4, value: 0.35 },
        ],
        icon: "RP",
      }),

      createAction("Iron Shackle", "line", {
        damage: 48,
        cooldown: 12,
        resourceCost: 25,
        range: 300,
        radius: 46,
        effects: [{ type: "pull", value: 300 }],
      }),

      createAction("Crescent Strike", "cone", {
        damage: 105,
        cooldown: 6,
        resourceCost: 18,
        range: 180,
        angle: 2.25,
        damageType: "physical",
      }),

      createAction("Berserk", "self", {
        cooldown: 24,
        resourceCost: 30,
        duration: 10,
        selfEffects: [
          { type: "power", duration: 10, value: 0.4 },
          { type: "attackSpeed", duration: 10, value: 0.35 },
          { type: "resistance", duration: 10, value: 0.15 },
        ],
      }),

      createAction("Barbaric Charge", "dash", {
        damage: 165,
        cooldown: 14,
        resourceCost: 35,
        distance: 430,
        width: 95,
        effects: [
          { type: "knockback", value: 320 },
          { type: "knockdown", duration: 1.2, value: 260 },
        ],
      }),

      createAction("Unbreakable Stance", "self", {
        cooldown: 30,
        resourceCost: 35,
        duration: 8,
        selfEffects: [
          { type: "damageReduction", duration: 8, value: 0.65 },
          { type: "controlResistance", duration: 8, value: 0.75 },
          { type: "slow", duration: 8, value: 0.35 },
        ],
      }),
    ],
    createAction("Dragon Flame", "line", {
      damage: 330,
      damageType: "magic",
      cooldown: 45,
      resourceCost: 70,
      range: 480,
      radius: 110,
      castTime: 0.45,
      selfEffects: [
        { type: "invulnerability", duration: 0.5 },
      ],
      color: "#ff5b35",
    }),
  ),

  lancer: createPack(
    "lancer",
    [
      createAction("Ravaging Blow", "cone", {
        damage: 56,
        cooldown: 3,
        resourceCost: 8,
        range: 145,
        angle: 0.9,
      }),

      createAction("Crescent Blade", "cone", {
        damage: 65,
        cooldown: 7,
        resourceCost: 15,
        range: 175,
        angle: 1.8,
        hits: 3,
        hitInterval: 0.18,
      }),

      createAction("Sweeping Storm", "circle", {
        damage: 61,
        cooldown: 9,
        resourceCost: 22,
        radius: 150,
        hits: 3,
        hitInterval: 0.28,
      }),

      createAction("Dragon Tail", "line", {
        damage: 86,
        cooldown: 7,
        resourceCost: 18,
        range: 190,
        radius: 60,
        effects: [{ type: "knockback", value: 210 }],
      }),

      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * O `Nirvana Kick` era o TERCEIRO slot do Lancer, e saiu da fileira
       * por decisao do jogador. Continua no arquivo como acao de reserva,
       * junto com as outras que o corte sempre deixou de fora
       *
       * O Lancer ficava com dois `cone` de raspão (Ravaging Blow e
       * Crescent Blade) e nenhum avanco; sem o dash, o alcance curto
       * dele passa a ser problema do jogador e nao da classe
       */
      createAction("Nirvana Kick", "dash", {
        damage: 78,
        cooldown: 7,
        resourceCost: 15,
        distance: 240,
        width: 60,
      }),

      createAction("Crushing Blow", "cone", {
        damage: 148,
        cooldown: 8,
        resourceCost: 22,
        range: 165,
        angle: 0.8,
        effects: [{ type: "stun", duration: 0.45 }],
      }),

      createAction("Wind Wall", "self", {
        cooldown: 16,
        resourceCost: 25,
        duration: 5,
        shield: 180,
        selfEffects: [
          { type: "damageReduction", duration: 5, value: 0.22 },
          { type: "projectileBlock", duration: 5 },
        ],
      }),

      createAction("Piercing Spear", "line", {
        damage: 145,
        cooldown: 10,
        resourceCost: 27,
        range: 430,
        radius: 52,
      }),

      createAction("Blitz Strike", "dash", {
        damage: 102,
        cooldown: 8,
        resourceCost: 20,
        distance: 330,
        width: 58,
        effects: [{ type: "slow", duration: 2, value: 0.3 }],
      }),

      createAction("Absorption", "cone", {
        damage: 82,
        cooldown: 9,
        resourceCost: 20,
        range: 170,
        angle: 1.3,
        lifesteal: 0.35,
      }),
    ],
    createAction("Dragon Spear", "line", {
      damage: 305,
      cooldown: 42,
      resourceCost: 65,
      range: 500,
      radius: 78,
      effects: [{ type: "knockback", value: 120 }],
      color: "#65d9ff",
    }),
  ),

  sorcerer: createPack(
    "sorcerer",
    [
      createAction("Flame Orb", "projectile", {
        damage: 138,
        damageType: "magic",
        cooldown: 6,
        resourceCost: 19,
        range: 500,
        projectileSpeed: 390,
        impactRadius: 105,
        projectileStyle: "fire",
        effects: [
          { type: "burning", duration: 4, value: 15, tickInterval: 1 },
        ],
      }),

      createAction("Frost Orb", "projectile", {
        damage: 98,
        damageType: "magic",
        cooldown: 7,
        resourceCost: 21,
        range: 470,
        projectileSpeed: 420,
        impactRadius: 90,
        projectileStyle: "ice",
        effects: [{ type: "slow", duration: 4, value: 0.5 }],
      }),

      createAction("Dark Vortex", "circle", {
        damage: 34,
        damageType: "magic",
        cooldown: 13,
        resourceCost: 32,
        radius: 220,
        hits: 5,
        hitInterval: 0.3,
        effects: [{ type: "pull", value: 230 }],
      }),

      createAction("Magic Shield", "self", {
        cooldown: 14,
        resourceCost: 28,
        shield: 300,
        shieldResourceCost: 18,
        selfEffects: [
          { type: "shieldMaintenance", duration: 6, value: 12 },
        ],
      }),

      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * O `Thunderstorm` era o QUARTO slot do Sorcerer, e saiu da fileira
       * por decisao do jogador — Repare que aqui a habilidade que caiu foi
       * a quarta e nao a terceira: o corte e por POSICAO, e cada classe
       * perdeu uma diferente
       *
       * Com ele fora, o Sorcerer fica com tres projeteis e um escudo, sem
       * nenhuma area marcada no chao. `Blizzard`, que ja vivia alem do
       * limite, e o `ground` mais próximo que a classe ainda tem escrito
       */
      createAction("Thunderstorm", "ground", {
        damage: 162,
        damageType: "magic",
        cooldown: 15,
        resourceCost: 40,
        range: 420,
        radius: 195,
        hits: 3,
        hitInterval: 0.32,
      }),

      createAction("Blizzard", "ground", {
        damage: 48,
        damageType: "magic",
        cooldown: 20,
        resourceCost: 48,
        range: 450,
        radius: 240,
        hits: 5,
        hitInterval: 0.28,
        effects: [
          { type: "slow", duration: 4, value: 0.55 },
          { type: "freeze", duration: 0.55, chance: 0.2 },
        ],
      }),

      createAction("Chain Lightning", "chain", {
        damage: 182,
        damageType: "magic",
        cooldown: 13,
        resourceCost: 36,
        range: 430,
        jumpRange: 230,
        maxTargets: 5,
      }),

      createAction("Flame Strike", "ground", {
        damage: 158,
        damageType: "magic",
        cooldown: 10,
        resourceCost: 30,
        range: 390,
        radius: 155,
        effects: [{ type: "knockback", value: 190 }],
      }),

      createAction("Soul Devour", "projectile", {
        damage: 122,
        damageType: "magic",
        cooldown: 9,
        resourceCost: 18,
        range: 430,
        projectileSpeed: 390,
        impactRadius: 80,
        restoreResource: 25,
        projectileStyle: "soul",
      }),

      createAction("Immolate", "cone", {
        damage: 212,
        damageType: "magic",
        cooldown: 12,
        resourceCost: 38,
        range: 280,
        angle: 1.05,
      }),

      createAction("Phoenix Embrace", "self", {
        cooldown: 24,
        resourceCost: 35,
        duration: 12,
        selfEffects: [
          { type: "power", duration: 12, value: 0.35 },
          { type: "resistance", duration: 12, value: 0.25 },
        ],
      }),

      createAction("Frozen Block", "circle", {
        damage: 44,
        damageType: "magic",
        cooldown: 17,
        resourceCost: 32,
        radius: 155,
        shield: 250,
        selfEffects: [
          { type: "damageReduction", duration: 6, value: 0.55 },
        ],
        effects: [{ type: "freeze", duration: 0.8 }],
      }),
    ],
    createAction("Dragon Tornado", "ground", {
      damage: 72,
      damageType: "magic",
      cooldown: 48,
      resourceCost: 75,
      range: 460,
      radius: 245,
      hits: 5,
      hitInterval: 0.3,
      effects: [
        { type: "pull", value: 280 },
        { type: "slow", duration: 3, value: 0.35 },
      ],
      color: "#b85cff",
    }),
  ),

  arbalist: createPack(
    "arbalist",
    [
createAction("Quick Shot", "projectile", {
            damage: 49,
            cooldown: 1.3,
            resourceCost: 4,
            range: 560,
            projectileSpeed: 720,
            projectileStyle: "arrow",

            /**
             * O EFEITO DE VELOCIDADE, e so nesta skill.
             *
             * ## POR QUE PELA ACAO E NAO PELA ARTE
             *
             * As tres flechas do arquiro compartilham a MESMA imagem. Se o
             * efeito estivesse na arte, as tres esticariam — e `Illusion Arrow`
             * e `Arrow Rain` nao sao tiros rapidos: sao lentos, pesados e
             * precisos. O que distingue a `Quick Shot` nao e a arte, e a
             * velocidade, entao a marca vai na velocidade
             *
             * E o `720` acima e a prova: esta e a flecha mais rapida do jogo,
             * e e a unica que precisa parecer estar correndo
             *
             * ## O QUE O MOTOR FAZ COM ISTO
             *
             * Estica a arte em 1,45x no eixo do tiro nos primeiros 90ms e
             * desenha tres riscos atras dela. O eixo X do canvas ja e a
             * direcao do projétil, entao nao ha conta de angulo nenhuma
             */
            speedEffect: true,
          }),

      createAction("Illusion Arrow", "projectile", {
        damage: 72,
        cooldown: 5,
        resourceCost: 12,
        range: 430,
        projectileSpeed: 650,
        selfEffects: [
          { type: "speedBoost", duration: 1.5, value: 0.2 },
        ],
        projectileStyle: "arrow",
      }),

      createAction("Venom Mist Shell", "projectile", {
        damage: 42,
        cooldown: 10,
        resourceCost: 24,
        range: 430,
        projectileSpeed: 330,
        impactRadius: 135,
        projectileStyle: "venom",
        effects: [
          {
            type: "poison",
            duration: 6,
            value: 11,
            tickInterval: 1,
          },
        ],
      }),

      createAction("Cloaking", "self", {
        cooldown: 18,
        resourceCost: 22,
        duration: 5,
        selfEffects: [
          { type: "cloak", duration: 5 },
          { type: "speedBoost", duration: 5, value: 0.15 },
        ],
      }),

      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * O `Burst Shell` era o TERCEIRO slot do Arbalist, e saiu da fileira
       * por decisao do jogador. Continua escrito, como as outras acoes
       * que o corte deixa de fora
       *
       * ## POR QUE ISSO NAO QUEBRA O TESTE DO SPRITE
       *
       * `arbalistSprite.test.js` exige que a classe tenha uma habilidade
       * `self`, e ela continua sendo o `Cloaking`. O que saiu foi o
       * `dash`, nao o `self` — se o `Cloaking` tivesse sido o removido,
       * o teste precisaria mudar junto
       */
      createAction("Burst Shell", "dash", {
        damage: 96,
        cooldown: 8,
        resourceCost: 19,
        distance: 305,
        width: 58,
      }),

      createAction("Seeking Bolt", "projectile", {
        damage: 107,
        cooldown: 9,
        resourceCost: 23,
        range: 670,
        projectileSpeed: 470,
        homing: true,
        projectileStyle: "seeking",
      }),

      createAction("Ice Cage", "ground", {
        damage: 62,
        cooldown: 12,
        resourceCost: 28,
        range: 450,
        radius: 115,
        effects: [{ type: "freeze", duration: 1.8 }],
        targetType: "enemy",
      }),
    ],
    createAction("Arrow Rain", "projectile", {
      damage: 53,
      cooldown: 42,
      resourceCost: 65,
      range: 600,
      projectileSpeed: 650,
      impactRadius: 270,
      count: 18,
      spread: 2.6,
      hits: 3,
      hitInterval: 0.28,
      rain: true,
      projectileStyle: "arrow",
      color: "#b9e8ff",
    }),
  ),

};

/**
 * O NIVEL EM QUE A ULTIMATE LIBERA.
 *
 * ## POR QUE A ULTIMATE E A UNICA EXCECAO
 *
 * As quatro habilidades de slot sao ensinadas por livro, compradas com o
 * Mestre. A ultimate nao: ela libera por NÍVEL
 *
 * A razao e a diferenca de papel. As quatro slots sao o repertorio e sao
 * compradas — um livro e um item, entao o jogador sabe exatamente o que
 * falta e o preco. A ultimate e a assinatura da classe, e um livro
 * dela seria um item novo, com arte nova e preco novo, e a unica coisa
 * que ele ensinaria e "esperar mais um nivel"
 *
 * E o nivel 6 e o primeiro degrau do vale. Um personagem novo no hub nao
 * tem nada contra ninguem ainda, entao travar a ultimate ate la nao tira
 * nada de ninguem
 *
 * Quem consulta: `GameEngine.useUltimate` (a porta do servidor) e o HUD
 * (a tranca na tela). Os dois leem ESTE numero — se cada um tivesse o
 * seu, a tela diria "travada" com o servidor deixando passar
 */
export const ULTIMATE_NIVEL = 6;

/**
 * A ULTIMATE JA LIBEROU PARA ESTE JOGADOR?
 *
 * ## POR QUE ESTE FICA AQUI E NAO NO MOTOR
 *
 * E a MESMA pergunta que a HUD e o servidor precisam responder, e as duas
 * leem este codigo. Se o numero do nivel estivesse escrito duas vezes, a
 * tela e o servidor divergiriam no primeiro save
 */
export function ultimateLiberada(level) {
  return Number(level ?? 0) >= ULTIMATE_NIVEL;
}
