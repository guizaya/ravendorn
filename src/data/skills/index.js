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
 * Tres, e o `ultimate` NAO conta: ele fica no botao proprio e nao ocupa
 * um dos slots de habilidade
 *
 * ## POR QUE O CORTE E AQUI E NAO NAS LISTAS
 *
 * As listas ainda escrevem todas as acoes, e o corte acontece em
 * `slice(0, MAX_SKILLS)` no `createPack`. Isso e deliberado:
 *
 * - o que fica e sempre a PRIMEIRA metade, na ordem em que foi escrita, e
 *   o criterio "as tres primeiras" fica visivel no dado
 * - trocar a ordem de uma lista muda o que o jogador recebe, e isso nao
 *   deve acontecer por acidente ao editar uma acao no meio do arquivo
 *
 * As acoes alem do limite continuam no arquivo. Elas nao viram habilidade,
 * nao entram no save e nao aparecem na barra — mas ficam legiveis para
 * uma classe nova, e apagar codigo que funciona e o jeito mais rapido de
 * perder trabalho
 *
 * ## A HISTORIA DO CORTE, QUE E A MESMA REGRA DUAS VEZES
 *
 * Baixou de cinco para quatro, e depois para tres, sempre por decisao do
 * jogador. O que caiu NAO foi sempre a mesma posicao, e essa e a parte que
 * importa: o `slice` e por POSICAO, entao "remover o terceiro" e "deixar o
 * terceiro de fora" sao coisas diferentes
 *
 * Apagando o codigo, o quarto viraria o terceiro e a classe ganharia uma
 * habilidade nova sem ninguem pedir. E por isso que a acao removida foi
 * MOVIDA para depois do limite em vez de apagada — inclusive agora:
 *
 * | Classe   | Ficou (3)                       | Caiu fora          |
 * |----------|---------------------------------|--------------------|
 * | Warrior  | Void Slash, Splitting, Ground   | Gale Slash         |
 * | Lancer   | Ravaging, Sweeping, Dragon Tail | Crescent Blade     |
 * | Sorcerer | Flame Orb, Dark Vortex, Shield  | Frost Orb          |
 * | Arbalist | Quick Shot, Illusion, Cloaking  | Venom Mist Shell   |
 *
 * O criterio de cada uma foi o MESMO arquétipo duplicado: o corte cai na skill
 * que repete o tipo de uma que ficou ao lado
 */
const MAX_SKILLS = 3;

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

      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * O `Gale Slash` era o QUARTO slot do Warrior, e saiu da fileira por
       * decisao do jogador. Ele NAO foi apagado: virou uma das acoes alem do
       * `MAX_SKILLS`, que e exatamente o que acontece com as acoes que sempre
       * ficaram fora daqui
       *
       * Ele era o `circle` fraco da classe: 44 de dano em 3 golpes, contra os
       * 108 do `Ground Smash` que ficou ao lado E ainda leva atordoamento. Sao
       * dois circulos brutos competindo pelo mesmo slot, e o `Ground Smash`
       * cobre mais
       *
       * Com ele fora, sobrou um de cada arquetipo: `line`, `cone` e `circle`
       */
      createAction("Gale Slash", "circle", {
        damage: 44,
        cooldown: 10,
        resourceCost: 28,
        radius: 145,
        hits: 3,
        hitInterval: 0.32,
      }),

      /*
       * O `Body Check` tambem ja foi removido do mesmo jeito, no corte de cinco
       * para quatro — e continua aqui embaixo pelo mesmo motivo
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
       * O `Crescent Blade` era o SEGUNDO slot do Lancer, e saiu da fileira
       * por decisao do jogador. Ele NAO foi apagado — virou acao de reserva,
       * junto com as outras que o corte sempre deixou de fora
       *
       * Ele era o `cone` repetido: o `Ravaging Blow`, que ficou na posicao 1,
       * e o mesmo arquetipo e sai mais barato — 3s de recarga e 8 de recurso
       * contra 7s e 15. Os dois nao cabiam em tres slots
       *
       * Com ele fora, o Lancer ficou com `cone`, `circle` e `line`
       */
      createAction("Crescent Blade", "cone", {
        damage: 65,
        cooldown: 7,
        resourceCost: 15,
        range: 175,
        angle: 1.8,
        hits: 3,
        hitInterval: 0.18,
      }),

      /*
       * O `Nirvana Kick` tambem ja foi removido do mesmo jeito, no corte de
       * cinco para quatro — e continua aqui pelo mesmo motivo
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
      /**
       * SKILL 1 — LANÇA DE MANA.
       *
       * E o UNICO tiro do jogo que ATRAVESSA. Ela sai rapida, cruza uma
       * linha de 8 tiles e leva TODOS os inimigos que estiver no caminho, e o
       * dano CAI a cada um que ela toca — entao acertar um mob fraco primeiro
       * e o grande depois e a leitura certa, e nao o contrario
       *
       * O `perfura` e o que muda a colisao: sem ele o projetil explode no
       * primeiro acerto, e o `pierceQueda` e o quanto o dano multiplica a cada
       * alvo. O alcance e a linha inteira, e nao um raio de explosao
       */
      createAction("Mana Lance", "projectile", {
        cooldown: 5,
        resourceCost: 16,
        damage: 96,
        damageType: "magic",

        /** A LINHA INTEIRA: 8 tiles x 64 */
        range: 512,

        /** ESTREITA E LONGA: e o que faz ela parecer um raio e nao uma bomba */
        projectileSpeed: 980,
        radius: 34,
        remaining: 0.75,

        /** ATRAVESSA TUDO, e NAO EXPLODE NO PRIMEIRO ACERTO */
        pierce: true,

        /** O DANO CAI A CADA ALVO: 72% do anterior a cada acerto */
        pierceQueda: 0.72,

        projectileStyle: "fire",
      }),

      /**
       * SKILL 2 — NOVA DE CRISTAL.
       *
       * Cria um circulo no chao e NAO estoura: ele fica ali, dando lentidao em
       * quem entrar. Quem ficar 3 segundos dentro do circulo leva um atordoamento
       * de 1 segundo na saida
       *
       * ## POR QUE A REGRA E "FICAR DENTRO", E NAO "RECEBER"
       *
       * Porque e a leitura da skill: ela nao pune quem passa, so quem fica. Um
       * inimigo que atravessa o circulado leva a lentidao e segue; um que para
       * dentro de um mob lento perde a acao por 1 segundo
       *
       * E o `tempoDentro` e POR INIMIGO, nao do circulo. O circulo nao pode
       * ter uma memoria so: sao tres mobs entrando em tempos diferentes, e cada
       * um tem que cumprir os 3s dele
       *
       * O `duracao` de 8s e maior que os 3s do atordoamento de proposito: se o
       * circulo durasse exatamente 3s, nunca haveria tempo de sair andando
       */
      createAction("Crystal Nova", "nova", {
        cooldown: 9,
        resourceCost: 22,
        targetType: "ground",

        /**
         * ## O `range` NAO E OPCIONAL, E O MOTIVO E O PROTOCOLO
         *
         * O cliente nao manda a posicao do mouse: manda so uma DIRECAO
         * normalizada (`aimX`/`aimY`, em `shared/protocol.js`), e o servidor
         * reconstrói um ponto a `DISTANCIA_DE_MIRA` — 1000 unidades — do boneco
         * (`GameServer.js`)
         *
         * Ou seja: o servidor nunca sabe onde o mouse esta. O `createAim`
         * (`SkillSystem.js`) e quem conserta, cortando esse ponto de 1000 de
         * volta para o `range`, na linha da mira
         *
         * Com `range: 0` o corte e `&& action.range > 0` — ou seja, NAO CORTA.
         * O circulo nascia entao a 1000 unidades do conjurador, quase o dobro
         * do alcance de qualquer outra skill de chao, e o dano e o atordoamento
         * caíam la em cima em vez de sob o cursor
         *
         * E por isso que as duas tem `range`: e o que traduz a direcao numa
         * posicao no chao. As outras de chao (`Thorn Trap` 340, `Venom Bolt
         * Rain` 420, `Dragon Tornado` 460) continuam pelo mesmo motivo
         */
        range: 340,
        radius: 150,

        /** O CIRCULO FICA NO CHAO por 8s */
        duracao: 8,

        /** A LENTIDAO, renovada a cada tique enquanto o inimigo estiver dentro */
        lentidao: { value: 0.45, duration: 0.5 },

        /** QUANTO TEMPO DENTRO PARA LEVAR O ATORDOAMENTO */
        tempoParaStun: 3,
        stun: 1,

        /** A CONTA DO TEMPO DENTRO, de 4 em 4 tiques — 0,2s */
        tickInterval: 0.2,

        color: "#7fd4ff",
      }),

      /**
       * SKILL 3 — SINGULARIDADE.
       *
       * Um circulo na mira que, por 3 segundos, puxa os inimigos para o centro e
       * dá dano alto. E a unica skill do jogo que tem forca de ARRANCAR: as
       * outras juntam o mob no chao e passively, e esta arranca de longe
       *
       * ## POR QUE O PUXAO E NO `tick` E NAO NA CRIAÇÃO
       *
       * Porque o `pull` e uma velocidade aplicada no tique. Se valesse uma vez
       * so, o inimigo entraria no centro e ficaria parado ali ate o fim da
       * skill, e o circulo viraria uma area de dano quietinha — o oposto de
       * singularidade
       *
       * O `pull` e fraco de proposito: um empurrao forte passaria por cima do
       * colisor e atravessaria o mob, e a singularidade viraria um empurrao
       * sem causa
       */
      createAction("Singularity", "singularidade", {
        cooldown: 20,
        resourceCost: 34,
        targetType: "ground",

        /**
         * O `range` e o mesmo motivo da Nova: sem ele o protocolo so entrega a
         * direcao, e o servidor marcaria o circulo a 1000 unidades do boneco
         *
         * 380 em vez dos 340 da Nova porque e o skill de mao pesada do
         * conjurador: o alcance maior e o que paga a recarga de 20s e o custo
         * de 34
         */
        range: 380,
        radius: 170,
        damage: 52,
        damageType: "magic",

        /** O CIRCULO EXISTE POR 3s */
        duracao: 3,

        /** O PUXAO, fraco e repetido a cada tique */
        pull: 240,
        tickInterval: 0.5,

        color: "#b98cff",
      }),

      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * O `Frost Orb` era o SEGUNDO slot do Sorcerer, e saiu da fileira por
       * decisao do jogador. Ele NAO foi apagado — virou acao de reserva
       *
       * Ele era o `projectile` repetido: o `Flame Orb`, que ficou na posicao 1,
       * e o mesmo arquetipo e sai mais barato. O que o gelo trazia de diferenca
       * — o `slow` de 50% por 4s — foi o que empurou a escolha para o `venom`
       * do arqueiro, e nao para o conjurador
       *
       * Repare que aqui a habilidade que caiu foi a SEGUNDA, e no corte de
       * cinco para quatro tinha sido a QUARTA: o corte e por POSICAO, e cada
       * classe perde uma diferente
       *
       * Com ele fora, o Sorcerer ficou com `projectile`, `circle` e `self`
       */
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

      /*
       * O `Thunderstorm` tambem ja foi removido do mesmo jeito, no corte de
       * cinco para quatro — e continua aqui pelo mesmo motivo
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
      /**
       * SKILL 1 — ARMADILHA DE ESPINHOS.
       *
       * E postada NA MIRA, arma em meio segundo, prende quem pisar por 2s e
       * some sozinha depois de 15s. Duas no maximo ao mesmo tempo — o que
       * transforma a recarga de 6s numa escolha de posicao: a segunda tem que
       * ir para onde a primeira nao cobre
       *
       * E o `root` que segura, e ele ja existe: esta em `TRAVAM_MOVIMENTO` no
       * `StatusSystem`, ao lado do `stun` e do `freeze`. Nenhum caso novo no
       * sistema de status so para travar o inimigo
       */
      createAction("Thorn Trap", "armadilha", {
        cooldown: 6,
        resourceCost: 18,
        range: 340,
        targetType: "ground",
        radius: 46,
        damage: 34,
        damageType: "physical",

        /** MEIO SEGUNDO antes de morder: da tempo de sair de cima dela */
        armaEm: 0.5,

        /** 15s no chao, e some sozinha */
        duracao: 15,

        /** DUAS no mapa. A terceira toma a mais antiga */
        limite: 2,

        effects: [{ type: "root", duration: 2 }],
        color: "#8fbf5a",
      }),

      /**
       * SKILL 2 — SALVA EM LEQUE.
       *
       * Cinco virotes abertos num cone de 60 graus, e o dano cai com a
       * DISTANCIA DO ARQUEIRO — e nao com a origem do virote. E o que faz a
       * skill valer a pena de perto: de longe os cinco batem fraco, e nao ha
       * com o que compensar, entao o caminho do jogador e chegar perto
       */
      createAction("Fan Volley", "projectile", {
        cooldown: 7,
        resourceCost: 20,
        range: 380,
        damage: 46,
        projectileSpeed: 700,
        projectileStyle: "arrow",

        /** CINCO virotes abertos num cone de 60 graus */
        count: 5,
        spread: Math.PI / 3,

        /**
         * A QUEDA DE DANO, e ela e por DISTANCIA DO ARQUEIRO.
         *
         * E o que faz a skill valer a pena de perto: de longe os cinco batem
         * fraco, e nao ha com o que compensar, entao o caminho do jogador e
         * chegar perto
         *
         * Os dois numeros vao no `explodeProjectile`, que mede do DONO do tiro
         * ate o ponto do impacto. Um virote que travelled 300px nao pode contar
         * a distancia dele mesmo: ele sempre nasce na mao
         */
        falloffAlcance: 300,
        falloffMinimo: 0.35,
      }),

      /**
       * SKILL 3 — CHUVA DE VIROTES VENENOSOS.
       *
       * O chao e MARCADO num raio de 2,5 tiles, e 1 segundo depois os
       * virotes comecam a cair durante 3s. Sobra uma nuvem de veneno que dura
       * mais 4s
       *
       * O `delay` usa a fila de `delayedEffects` do motor — a mesma do
       * telegraph do chefe — em vez de um timer novo: o marcado e a chuva sao
       * o mesmo objeto em dois estados, e o jogador ve a diferenca na tela
       */
      createAction("Venom Bolt Rain", "chuva", {
        cooldown: 20,
        resourceCost: 34,
        range: 420,
        targetType: "ground",
        radius: 160,
        damage: 22,
        damageType: "physical",
        projectileStyle: "venom",

        /** 2,5 tiles x 64 */
        delay: 1,

        /** quanto tempo cai virote antes da nuvem assumir */
        chuvaDuracao: 3,
        nuvemDuracao: 4,
        tickInterval: 0.5,

        effects: [{ type: "poison", duration: 6, value: 9, tickInterval: 1 }],
        color: "#7bd45a",
      }),
      /*
       * A PARTIR DAQUI NINGUEM VIRA HABILIDADE.
       *
       * As tres skills antigas do Arbalist sairam da fileira por decisao do
       * jogador, no mesmo corte que levou as outras classes a tres slots. Nenhuma
       * foi apagada: continuam escritas aqui como acao de reserva, como todas as
       * que o corte sempre deixou de fora
       */
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

      createAction("Cloaking", "self", {
        cooldown: 18,
        resourceCost: 22,
        duration: 5,
        selfEffects: [
          { type: "cloak", duration: 5 },
          { type: "speedBoost", duration: 5, value: 0.15 },
        ],
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

      createAction("Burst Shell", "dash", {
        damage: 96,
        cooldown: 8,
        resourceCost: 19,
        distance: 305,
        width: 58,
      }),

      createAction("Seeking Bolt", "projectile", {
        damage: 44,
        cooldown: 5,
        resourceCost: 10,
        range: 520,
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
