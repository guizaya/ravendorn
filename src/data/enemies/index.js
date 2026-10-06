import {
  createRandom,
  getZoneById,
  MAP_1,
  MAP_1_SEED,
} from "../maps/index.js";
import { applyDropScaling } from "../../game/balance.js";

export const BEHAVIOR = {
  PASSIVE: "passive",
  SEMI_PASSIVE: "semiPassive",
  ACTIVE: "active",
};

/**
 * quanto cada nivel acima do base da criatura engrossa o bicho.
 * o HP e o dano sobem mais rapido que a defesa, senao o mob fica
 * imortal contra quem tem pouco ataque.
 */
export const CREATURE_GROWTH = {
  hpPerLevel: 0.22,
  damagePerLevel: 0.16,
  defensePerLevel: 0.12,
};

/**
 * A ESQUIVA das criaturas, que nao tem dado de atributo nenhum.
 *
 * Uma criatura e feita de hp, dano e defesa. Nao existe DEX em
 * `CREATURE_TYPES`, e dar esquiva pelo atributo seria inventar um
 * atributo que o resto do jogo nao conhece
 *
 * Entao a esquiva vem de um piso que sobe com o nivel, e o teto e o
 * que segura: um mob de nivel alto nao pode virar um alvo que o
 * jogador nunca acerta
 *
 * Sao 3% no nivel 1, subindo 0,25 ponto por nivel, ate 8%. Um jogador
 * de Warriro no nivel 1 tem cerca de 75 de precisao, que reduz essa
 * esquiva a uns 2% — o suficiente para o "MISS" aparecer, e raro o
 * bastante para nao parecer que o golpe falhou
 */
const CREATURE_EVASION_BASE = 0.03;
const CREATURE_EVASION_POR_NIVEL = 0.0025;
const CREATURE_EVASION_MAXIMA = 0.08;

/** variacao de nivel sorteada no roster: a maioria fica no base */
export const LEVEL_TIERS = [0, 0, 0, 1, 2];

/**
 * escala relativa ao nivel base do tipo: no nivel base o multador e 1,
 * entao o balanceamento atual continua igual.
 */
export function scaleForLevel(type, level) {
  const base = type.level ?? 1;
  const steps = (level ?? base) - base;

  return {
    maxHp: Math.max(
      1,
      Math.round(type.maxHp * (1 + CREATURE_GROWTH.hpPerLevel * steps)),
    ),
    damage: Math.max(
      1,
      Math.round(type.damage * (1 + CREATURE_GROWTH.damagePerLevel * steps)),
    ),
    defense: Math.max(
      0,
      Math.round(type.defense * (1 + CREATURE_GROWTH.defensePerLevel * steps)),
    ),
  };
}

export function resolveLevel(type, level) {
  return Math.max(1, Math.round(level ?? type.level ?? 1));
}

export const CREATURE_TYPES = {
  slime: {
    id: "slime",
    name: "Limo Preguiçoso",
    behavior: BEHAVIOR.PASSIVE,
    level: 1,

    /**
     * O HP vai de 140 para 150 e o DANO de 7 para 22.
     *
     * Com 7 de dano o limo tirava o lvl 1 em 91 golpes: nenhuma criatura
     * do mapa era uma ameaca, e a campanha inteira era so volume. Com 22
     * sao ~44 golpes, e tres limos juntos derrubam quem fica parado
     *
     * O HP subiu pouco de proposito: o limo e o degrau 1 e precisa cair
     * em 2 golpes de um lvl 1, senao o primeiro degrau da campanha ja
     * vira uma parede
     */
    maxHp: 150,
    defense: 2,
    radius: 21,
    speed: 48,
    damage: 22,
    attackRange: 44,
    aggroRange: 0,
    leash: 260,
    attackCooldown: 1.6,
    spriteScale: 1.5,
    wanderRadius: 150,
    wanderSpeed: 30,
    color: "#6fbf8a",
    loot: applyDropScaling({
      coins: { min: 3, max: 9 },
      itemChance: 0.34,
      maxItems: 1,
      items: [
        { id: "slime_gel", weight: 84 },
        { id: "slime_core", weight: 15 },
        { id: "skeleton_bone", weight: 1 },
      ],
    }),
  },

  rat: {
    id: "rat",
    name: "Rato da Toca",
    behavior: BEHAVIOR.PASSIVE,
    level: 2,
    maxHp: 90,
    defense: 1,
    radius: 15,
    speed: 96,
    damage: 6,
    attackRange: 36,
    aggroRange: 0,
    leash: 220,
    attackCooldown: 1.1,
    spriteScale: 1.15,
    wanderRadius: 190,
    wanderSpeed: 72,
    color: "#a08a63",
    loot: applyDropScaling({
      coins: { min: 5, max: 14 },
      itemChance: 0.4,
      maxItems: 1,
      items: [
        { id: "rat_tail", weight: 80 },
        { id: "rat_pelt", weight: 18 },
        { id: "goblin_cloth", weight: 2 },
      ],
    }),
  },

  goblin: {
    id: "goblin",
    name: "Goblin Saqueador",
    behavior: BEHAVIOR.SEMI_PASSIVE,
    level: 5,
    maxHp: 260,
    defense: 8,
    radius: 20,
    speed: 118,
    damage: 22,
    attackRange: 52,
    aggroRange: 0,
    leash: 620,
    attackCooldown: 1.5,
    spriteScale: 1.25,
    wanderRadius: 90,
    wanderSpeed: 40,
    color: "#8faf5a",
    loot: applyDropScaling({
      coins: { min: 12, max: 30 },
      itemChance: 0.5,
      maxItems: 2,
      items: [
        { id: "goblin_cloth", weight: 70 },

      ],
    }),
  },

  ghoul: {
    id: "ghoul",
    name: "Ghoul Faminto",
    behavior: BEHAVIOR.SEMI_PASSIVE,
    level: 8,
    maxHp: 420,
    defense: 14,
    radius: 23,
    speed: 104,
    damage: 34,
    attackRange: 50,
    aggroRange: 0,
    leash: 700,
    attackCooldown: 1.8,
    spriteScale: 1.4,
    wanderRadius: 70,
    wanderSpeed: 34,
    color: "#9a7fae",
    loot: applyDropScaling({
      coins: { min: 22, max: 52 },
      itemChance: 0.56,
      maxItems: 2,
      items: [
        { id: "ghoul_rot", weight: 78 },
        { id: "ghoul_claw", weight: 52 },
        { id: "ghoul_rib", weight: 30 },

      ],
    }),
  },

  /**
   * A SENTINELA ESQUELETICA: o segundo atirador, e o esqueleto de
   * elite.
   *
   * Antes era um `skeleton` comum, com `attackRange` de 58 — o alcance
   * de uma chifrada. O bicho andava ate o jogador e batia de perto,
   * que era incoerente com a arte: uma sentinela com escudo e lance nao
   * briga de punho
   *
   * O que troca, e por que cada campo importa:
   *
   * - `ranged` — o campo que a IA le. Com ele, o golpe vira `flecha`
   *   em vez de dano direto, e o bicho entra em `retreat` quando o
   *   jogador encosta, em vez de ficar parado deixando o arqueiro
   *   colar nele
   * - `attackRange` 58 -> 300 — de onde ele atira. Com 58 ele
   *   continuaria tendo de encostar para ter o que atirar
   * - `keepDistance` — a distancia que ele tenta manter. Sem ela o
   *   `retreat` nao tem para onde recuar e o arqueiro fica colado
   * - `projectileSpeed` — mais lenta que a do zumbi: a sentinela e mais
   *   pesada, e a flecha pesada da para o jogador desviar
   *
   * O `damage` cai de 42 para 34 porque o golpe agora chega de longe e
   * o jogador tem mais chance de desviar. Um arqueiro mais forte e
   * mais preciso seria injusto; um arqueiro mais lento e mais fraco e
   * um alvo legivel
   */
  skeleton: {
    id: "skeleton",
    name: "Sentinela Esquelética",
    behavior: BEHAVIOR.ACTIVE,
    level: 11,
    maxHp: 520,
    defense: 22,
    radius: 22,
    speed: 126,
    damage: 34,
    attackRange: 300,
    aggroRange: 380,
    leash: 900,
    attackCooldown: 1.9,
    spriteScale: 1.35,
    wanderRadius: 60,
    wanderSpeed: 30,
    color: "#cfd3d6",

    // o tiro dele
    ranged: true,
    keepDistance: 220,
    projectileSpeed: 370,
    projectileRadius: 9,
    projectileStyle: "arrow",
    projectileColor: "#d8dde0",

    loot: applyDropScaling({
      coins: { min: 30, max: 68 },
      itemChance: 0.62,
      maxItems: 2,
      items: [
        { id: "skeleton_bone", weight: 58 },
        { id: "skeleton_skull", weight: 30 },

      ],
    }),
  },

  /**
   * O arqueiro zumbi: o primeiro inimigo que ataca de LONGE.
   *
   * A sentinela passou a atirar tambem e subiu para o topo da lista
   * dos atiradores, entao este deixa de ser "o primeiro"
   * viesse antes.
   */
  zumbi_arbalist: {
    id: "zumbi_arbalist",
    name: "Arqueiro Zumbi",
    behavior: BEHAVIOR.ACTIVE,
    level: 12,
    maxHp: 360,
    defense: 12,
    radius: 20,
    speed: 100,
    damage: 30,
    attackRange: 300,
    aggroRange: 420,
    leash: 900,
    attackCooldown: 1.9,
    spriteScale: 1,
    wanderRadius: 70,
    wanderSpeed: 26,
    color: "#7fa650",

    // o tiro dele
    ranged: true,
    keepDistance: 190,
    projectileSpeed: 430,
    projectileRadius: 8,
    projectileStyle: "arrow",
    projectileColor: "#9ec46a",

    // 0.70 fica entre o esqueleto (0.62) e o ogre (0.78): e o preco
    // de um bicho de nivel 12 que atira de longe
    loot: applyDropScaling({
      coins: { min: 26, max: 60 },
      itemChance: 0.7,
      maxItems: 2,
      items: [
        { id: "ghoul_rot", weight: 44 },
        { id: "skeleton_bone", weight: 30 },
        { id: "ghoul_claw", weight: 18 },
        { id: "skeleton_skull", weight: 6 },

      ],
    }),
  },

  /**
   * O ogre da PREDEIRA: o segundo direcional, e o primeiro de
   * CORPO A CORPO com arte de oito direcoes.
   *
   * A pasta de origem chama o golpe de `shoot`, mas nao ha arco
   * nenhum: e o porrete. Por isso NAO ha `ranged` nem `keepDistance`
   * nem projétil, e e o campo `ranged` que decide: e ele que faz a
   * `EnemyAI` escolher entre `onShootPlayer` e `onDamagePlayer`, e
   * entre recuar e fechar. Sem ele, o ogre caminha ate o jogador e
   * bate de perto, que e o que o bicho precisa fazer.
   *
   * A velocidade e 118, a mesma do goblin saqueador e acima do ogre
   * da pedreira (92). O guerreiro anda a 165, entao da para
   * daria para passar por ele andando, e ele nunca vai encostar num
   * jogador que corre. Isso ja valia para o resto: nenhum mob do
   * jogo alcanca o guerreiro em linha reta. O que muda aqui e o
   * ARRANCADA inicial, que e o que o jogador ve quando o ogre
   * acorda.
   */
  ogre_da_predeira: {
    id: "ogre_da_predeira",
    name: "Ogre da Predeira",
    behavior: BEHAVIOR.ACTIVE,

    /**
     * O NIVEL BASE E 7, e nao 16.
     *
     * `level` e o ponto de partida da escala: o `scaleForLevel` faz
     * `steps = nivel_da_zona - level`. Com 16 aqui e a zona no nivel 7,
     * `steps` era -9, o fator `1 + 0.22 * -9` ficava negativo e o HP
     * caia no piso de 1. O ogre do campo de provas morria de um golpe
     * e dava 1 de XP
     *
     * E o `maxHp` tambem era do nivel 16. Um bicho de nivel 7 na escada
     * deste mapa tem 280 de HP, e e contra esse numero que a missao
     * `minLevel: 7` foi calibrada
     */
    level: 7,
    maxHp: 280,
    defense: 16,
    radius: 34,
    speed: 118,

    /**
     * O DANO sobe de 84 para 46.
     *
     * Com 84, o ogre tirava o lvl 1 em ~24 golpes. Agora sao ~44: o
     * jogador ainda pode morrer se ficar parado na frente de tres, que e
     * o que torna a zona do campo de provas um degrau e nao um passeio
     */
    damage: 46,
    attackRange: 84,
    aggroRange: 430,
    leash: 1000,
    attackCooldown: 2.2,
    spriteScale: 1,
    wanderRadius: 56,
    wanderSpeed: 30,
    color: "#8a9a5b",

    // sem `ranged`: a `EnemyAI` so cria a arte de tiro e o
    // projétil quando o inimigo atira de longe
    loot: applyDropScaling({
      coins: { min: 60, max: 130 },
      itemChance: 0.8,
      maxItems: 3,
      items: [
        { id: "ogre_pebble", weight: 52 },
        { id: "ogre_hide", weight: 34 },


      ],
    }),
  },

  ogre: {
    id: "ogre",
    name: "Ogre da Pedreira",
    behavior: BEHAVIOR.ACTIVE,

    /**
     * O NIVEL BASE E 8, e nao 15 — o mesmo bug do ogre da predeira.
     *
     * As cinco zonas de ogre deste mapa sao os niveis 8 a 12. Com 15
     * aqui, `steps` ia de -7 a -3, o HP caia no piso de 1 nas tres
     * primeiras zonas e o `damage` tambem despencava
     *
     * O `maxHp` de 1250 era o do nivel 15. Contra a escada real, um ogre
     * de base 8 tem 260
     */
    level: 8,
    maxHp: 260,
    defense: 20,
    radius: 32,
    speed: 92,

    /**
     * O DANO desce de 78 para 52.
     *
     * Com 78 o ogre tirava o lvl 1 em ~13 golpes, e a zona da Floresta
     * virava um espacinho sem risco. Agora sao ~24, o que mantem o
     * degrau 12 como o mais perigoso do mapa sem matar o jogador em
     * segundos
     */
    damage: 52,
    attackRange: 78,
    aggroRange: 400,
    leash: 1000,
    attackCooldown: 2.4,
    spriteScale: 1.9,
    wanderRadius: 50,
    wanderSpeed: 24,
    color: "#b07a52",
    loot: applyDropScaling({
      coins: { min: 70, max: 160 },
      itemChance: 0.78,
      maxItems: 3,
      items: [
      { id: "ogre_pebble", weight: 58 },
      { id: "ogre_hide", weight: 38 },


      ],
    }),
  },

  /**
   * O HULK: o CHEFE DA ARENA.
   *
   * ## POR QUE ELE FICA LONGE DA ESCADA
   *
   * A `scaleForLevel` de todo bicho cresce com o nivel, e o `ogre` — o
   * mais forte do vale — chega ao Nv. 12 com 260 de HP. Um `level: 20`
   * aqui passaria por `steps = 20 - 8 = 12` degraus de crescimento, e o
   * numero saeria de uma conta que nao foi feita para um chefe
   *
   * Por isso os numeros deste sao ESCOLHIDOS, e nao derivados: o `level`
   * e 20 porque e o que o bestiario e a tela de status vao mostrar, e o
   * `maxHp` e o que faz a luta do jeito que ela foi desenhada
   *
   * ## OS NUMEROS, E POR QUE CADA UM
   *
   * O `maxHp` de 9000 e o que faz o chefe ser uma luta e nao um
   * obstaculo. Contra o HP do jogador no fim do mapa 2, sao ~200 golpes
   * de um jogador sozinho — e o numero de um alvo que a PARTY precisa
   * derrubar em conjunto, que e para isso que o botao da arena e livre
   * e o jogo empurra todo mundo para dentro
   *
   * O `defense` de 60 e a metade do que o golpe mais forte da campanha
   * tira depois da mitigacao. Sem ele, qualquer golpe positivo do Nv. 1
   * seria visivel no chefe e o numero "450 de dano" pareceria bug
   *
   * O `damage` de 260 e o que dá peso ao golpe: mata um jogador de
   * Nv. 20 em tres golpes sem armadura. E de proposito que a arena seja
   * perigosa — ela e o lugar mais difícil do jogo
   */
  hulk: {
    id: "hulk",
    name: "Hulk",
    behavior: BEHAVIOR.ACTIVE,

    /**
     * O NIVEL E 20, que e o topo do jogo hoje.
     *
     * O topo do mapa 2 e o degrau 24, e um chefe de Nv. 20 fica abaixo
     * dele de proposito: ele e para ser facedo por quem chegou ate la, e
     * nao para ser o ultima coisa que um jogador novo encontra
     */
    level: 20,
    maxHp: 9000,
    defense: 60,

    /**
     * O RAIO E 46, e nao 32 do ogre.
     *
     * E o maior do jogo e precisa ocupar o chao. O `radius` e o que o
     * colisor usa para barrar o jogador e o que o golpe dele mede, e um
     * chefe com raio de bicho pequeno pareceria um mob grande — que e
     * leitura de dificuldade errada
     */
    radius: 46,

    /**
     * A VELOCIDADE E 93, e a mais alta do jogo.
     *
     * Antes era 62, a mais baixa de um `ACTIVE`, escolhida para a luta
     * ser de posicao. O pedido foi o oposto: 1,5x mais rapido, e 62 x 1,5
     * da 93. Isso coloca o chefe acima do ogre, que corre a 92
     *
     * A consequencia e de design e vale saber: com o dobro do desenho
     * (136px) e 93 de velocidade, o Hulk fecha a arena em poucos
     * segundos e a fuga deixa de ser uma opcao tao boa quanto era. A
     * `wanderRadius` curta e o `leash` curto continuam sendo o que segura
     * ele perto do centro
     */
    speed: 93,

    damage: 260,

    /**
     * O ALCANCE E 96, e nao os 78 do ogre.
     *
     * E maior que o ogre DE PROPÓSITO: com o `radius` de 46, o golpe tem
     * que alcancar da borda do chefe, e nao do centro. Um alcance curto
     * aqui faria o golpe passar "dentro" do desenho do chefe, e o dano
     * sairia de um lugar que o jogador nao ve
     */
    attackRange: 96,

    /**
     * O AGGRO E 520, e o MAIOR do jogo.
     *
     * O jogador entra na arena pelo MEIO e o chefe esta no MEIO tambem:
     * nao ha como entrar andando e chegar perto sem entrar na zona. Com
     * um `aggroRange` pequeno o chefe ficaria parado ate o jogador ir
     * ate ele, e uma arena sem ameaca e so um patio
     */
    aggroRange: 520,

    /**
     * O LEASH E DA ARENA INTEIRA.
     *
     * O limite do `clampToBounds` circular e mais apertado que os 1000 do
     * ogre, e um `leash` de 1200 deixa o chefe percorrer a arena sem
     * tentar sair dela — o que faria o `EnemyAI` puxa-lo de volta pelo
     * mapa inteiro, atravessando o limite enquanto volta
     */
    leash: 1200,

    attackCooldown: 2.2,

    /**
     * A ESCALA E 2, E ESTE CAMPO NAO E O QUE DESENHA.
     *
     * O desenho do chefe sai do `scale` do layout, em
     * `src/data/sprites/enemyLayout.js` (`HULK_SCALE`), e nao deste
     * numero. Este campo fica aqui como o valor DECLARADO do tamanho,
     * para o catalogo e o layout contarem a mesma historia — mas se os
     * dois divergirem, quem manda na tela e o layout
     *
     * Antes este numero era 2.6 e nao fazia nada: o chefe saia em 68px,
     * metade do jogador. O 2 de agora e o que o desenho assume, e o
     * dobro do goblin
     */
    spriteScale: 2,

    /**
     * O PASSEIO E CURTO E DEVAGAR.
     *
     * O chefe fica perto do centro: ele e o guardian de um lugar, e
     * passear pela arena inteira seria o jogador o caçando, que e o
     * inverso da luta
     */
    wanderRadius: 70,
    wanderSpeed: 33,

    /**
     * A COR E O VERMELHO DE PERIGO.
     *
     * A mesma que o painel da morte e o botao de sair da arena usam. E
     * a cor que o projeto ja reserva para "voce esta em perigo", e um
     * chefe nao pode ser verde de "bicho comum" nem dourado de
     * "recompensa"
     */
    color: "#c8403a",

    loot: applyDropScaling({
      coins: { min: 400, max: 900 },
      itemChance: 1,
      maxItems: 3,
      items: [
        { id: "ogre_hide", weight: 60 },
        { id: "ogre_pebble", weight: 30 },
        { id: "skeleton_bone", weight: 10 },
      ],
    }),
  },
};

/**
 * Os BOMBOS do Campo de Provas.
 *
 * Sao dois, e a lista encolheu de sete: o Arcano, o Leve, o de Longo
 * Alcance, o de Ensaio e o de Controle foram removidos. Eles ocupavam
 * o campo de provas com cinco alvos passivos que so existiam para
 * medir um numero — e um jogador passava por eles sem nunca ter motivo
 * para bater, porque boneco nao anda e boneco nao ataca
 *
 * ## POR QUE SOBRARAM ESTES DOIS
 *
 * - o Boneco de Madeira e o de DUELO: o unico que revida, e o que da
 *   ao Campo de Provas o unico teste que importa, que e o de perder
 *   para algo
 * - o Boneco Reforzado e o alvo de TANTO HP que da para ver a barra de
 *   vida inteira
 *
 * Os cinco que sairam nao tinham papel nenhum depois do primeiro
 * golpe: sem recompensa propria (o loot e o mesmo dos outros), sem
 * comportamento, e sem numero de balanceamento quedependesse do id
 */
/**
 * O CAMPO DE PROVAS NAO TEM MAIS BONECO.
 *
 * O Campo de Provas comeca com sete bonecos e dois sobreviveram: o de
 * madeira e o reforcado. Os dois sairam agora, e a lista ficou vazia
 *
 * ## POR QUE O CAMPO FICOU COM CRIATURAS DE VERDADE
 *
 * O boneco existe para o jogador treinar sem risco: parado, sem dano,
 * com muita vida. Um par de limo 6 e ogre 7 faz o oposto — o jogador
 * que entra no campo agora apanha, e o campo virou mais um degrau da
 * progressao em vez de um lugar seguro
 *
 * O que fica no lugar dos bonecos e o par de criaturas, com nivel alto
 * e dos dois lados: limo do lado do Brejo, ogre do lado da Cripta
 *
 * ## POR QUE A LISTA CONTINUA SENDO UMA LISTA
 *
 * `createTrainingDummies` continua existindo e continua devolvendo uma
 * lista, mesmo vazia. O chamador, o `createTrainingDummy` e o
 * `DUEL_DUMMY_IDS` nao mudam: um hub sem zona de treino ja devolvia
 * lista vazia antes, entao esse caminho ja era exercitado
 */
export const TRAINING_DUMMY_BLUEPRINTS = [];

export const ZONE_ROSTER = [
  {
    // A PREDEIRA nao e uma zona do mapa: o nome do ogre vem da arte
    // (a denseza onde ele vive), e nao de um bioma do jogo. Ele foi
    // posto na FLORESTA, que e a zona de mato do mapa e a unica
    // combinacao. Se um dia existir uma zona chamada predeira, e so
    // trocar o campo `zone` aqui.
    //
    // O peso e alto de proposito. Com 16 de 100 e 7 spawns, o
    // arredondamento do `allocateTypes` dava UM ogre da predeira no
    // mapa inteiro, a 2500px do nascimento: a arte nova nunca
    // aparecia em teste, e o que o jogador via era o ogre da
    // pedreira, com a arte antiga. Agora sao tres.
    zone: "floresta",
    count: 14,

    /**
     * SO OGRE, NIVEL 12.
     *
     * ## A ESCALADA DE OGRE
     *
     * Cinco zonas de ogre, e o nivel sobe uma de uma vez seguindo a
     * ordem em que o jogador atravessa o mapa:
     *
     *   Cripta Esquelética   8
     *   Ruinas dos Ghouls    9
     *   Campina Gelada      10
     *   Acampamento Goblin  11
     *   Floresta Sombria    12
     *
     * Sao os cinco degraus mais altos do vale, acima dos seis degraus de
     * limo (1 a 6) e do par do campo de provas (6 e 7)
     *
     * A Floresta e o topo da escalada: era a zona mais populosa do mapa
     * e a unica com seis tipos. O `ogre_da_predeira` era o segundo
     * direcional novo do jogo, posto aqui porque a Pedreira e o nome da
     * arte dele e nao uma zona; com o campo de provas ganhando um ogre
     * de nivel 7, ele passa a ter um lugar mais honesto
     */
    mix: { ogre: 100 },
    niveis: [12, 12],
  },
  {
    zone: "acampamento",
    count: 6,

    /**
     * SO OGRE, NIVEL 11.
     *
     * Segundo degrau do topo da escalada de ogre
     */
    mix: { ogre: 100 },
    niveis: [11, 11],
  },
  {
    zone: "campina",
    count: 7,

    /**
     * SO OGRE, NIVEL 10.
     *
     * Terceiro degrau do topo da escalada de ogre
     */
    mix: { ogre: 100 },
    niveis: [10, 10],
  },
  {
    zone: "ruinas",
    count: 7,

    /**
     * SO OGRE, NIVEL 9.
     *
     * Segundo degrau de baixo da escalada de ogre. Era o lugar de maior
     * peso do ghoul (62), e o ghoul nao esta mais no mapa
     */
    mix: { ogre: 100 },
    niveis: [9, 9],
  },
  {
    /**
     * A TOCA DOS RATOS, o quinto e ultimo degrau de limo.
     *
     * A sequencia completa que o jogador percorre atravessando o portal
     * do hub: Pantano (1 e 2), Pedreira (2), Dunas (3), Cinzas (4),
     * Toca (5). As cinco tem um tipo so, e o nivel sobe de uma em uma
     *
     * A ordem das zonas NAO e a ordem geografica: a Toca fica no canto
     * superior esquerdo do vale e o Pantano no inferior direito. A
     * progressao e de nivel, e nao de distancia — o que mantem o
     * "ir matar limo" do bestiario no degrau 1, que e o que o jogador
     * alcanca pelo portal
     *
     * Antes eram rato (70), goblin (18) e limo (12). O rato e o caso
     * delicate: a Toca era o lugar de MAIOR peso dele, e o que sobra e o
     * Brejo (20, contra 18 do Acampamento e 12 da Floresta). E por isso
     * que o rato e o unico creature que muda de zona no bestiario
     */
    zone: "toca",
    count: 7,
    mix: { slime: 100 },

    /** Todo limo aqui e do nivel 5 */
    niveis: [5, 5],
  },
  {
    /**
     * O BREJO LENTO, o sexto e ULTIMO degrau de limo.
     *
     * A sequencia completa: Pantano (1 e 2), Pedreira (2), Dunas (3),
     * Cinzas (4), Toca (5), Brejo (6). As seis tem um tipo so, e o nivel
     * sobe de uma em uma
     *
     * O Brejo e onde a progressao volta para a direita depois da Toca, no
     * canto superior esquerdo. A ordem geografica e um zigue-zague e nao
     * importa: o que ordena e o nivel, e e o que permite o "ir matar
     * limo" do bestiario recomecar no degrau 1
     *
     * Antes eram limo (66), rato (20) e ghoul (14). O rato e o caso
     * delicado: depois do Brejo ele sobra em DUAS zonas — o Acampamento
     * (18) e a Floresta (12), uma margem de 6 pontos. O ghoul continua
     * nas Ruinas (62), o mais alto de todos
     */
    zone: "brejo",
    count: 7,
    mix: { slime: 100 },

    /** Todo limo aqui e do nivel 6 */
    niveis: [6, 6],
  },
  {
zone: "cripta",
    count: 8,

    /**
     * SO OGRE, NIVEL 8.
     *
     * O MAIS BAIXO dos cinco degraus da escalada de ogre, e o primeiro
     * que o jogador encontra
     *
     * A Cripta era ogerada por quatro tipos — esqueleto (62), ogre (18),
     * ghoul (12) e zumbi arbalist (8) — e o nome da zona prometia o
     * esqueleto
     */
    mix: { ogre: 100 },
    niveis: [8, 8],
  },
  {
    /**
     * O VALE DAS CINZAS, o quarto degrau de limo.
     *
     * A sequencia que o jogador percorre atravessando o portal do hub:
     * Pantano (1 e 2), Pedreira (2), Dunas (3), Cinzas (4). As quatro tem
     * um tipo so, e o nivel sobe de uma em uma
     *
     * Antes eram ogre (60), ghoul (24) e esqueleto (16). As tres vivem
     * em outras zonas, entao nenhuma some: o ghoul continua nas Ruinas
     * (62) e o esqueleto na Cripta (62). O ogre e o unico que muda de
     * zona — as Cinzas eram o lugar de maior peso dele (60) e o que
     * sobra e a Cripta (18), o que faz o Ogre e o Esqueleto apontarem
     * para a mesma zona
     */
    zone: "cinzas",
    count: 7,
    mix: { slime: 100 },

    /** Todo limo aqui e do nivel 4 */
    niveis: [4, 4],
  },
  {
    /**
     * As DUNAS PERDIDAS, o terceiro degrau de limo.
     *
     * A sequencia que o jogador percorre atravessando o portal do hub:
     * Pantano (nivel 1 e 2), Pedreira (nivel 2), Dunas (nivel 3). As tres
     * zonas tem um tipo so, e o nivel sobe de uma em uma
     *
     * Antes eram goblin (60), rat (24) e ogre (16) — e nenhum limo. As
     * tres vivem em outras zonas com peso maior, entao nenhuma some do
     * bestiario: o goblin vai para o Acampamento (66), o rat para a
     * Toca (70) e o ogre para o Vale das Cinzas (60)
     */
    zone: "dunas",
    count: 6,
    mix: { slime: 100 },

    /** Todo limo aqui e do nivel 3 */
    niveis: [3, 3],
  },
  {
    /**
     * A PEDREIRA DO OGRO, ao lado do Pantano.
     *
     * So tem Limo Preguiçoso, e todo limo e do nivel 2. Antes eram
     * ogre (68), esqueleto (20) e goblin (12) — a zona se chamava
     * Pedreira do Ogre e nao tinha nenhum ogre nela
     *
     * ## NENHUMA CRIATURA SAI DO JOGO
     *
     * As tres que moravam aqui vivem em outras zonas, e o bestiario
     * continua com as tres. O que muda e ONDE o "ir matar" leva o
     * jogador: o ogre vai para o Vale das Cinzas (peso 60, era 68 aqui),
     * o esqueleto para a Cripta (62) e o goblin para o Acampamento (66).
     * O limite e 2 e nao "1 a 2" porque a zona e o degrau DEPOIS do
     * Pantano na progressao do jogador
     */
    zone: "pedreira",
    count: 7,
    mix: { slime: 100 },

    /**
     * Todo limo aqui e do nivel 2.
     *
     * O intervalo e `[2, 2]` e nao `2`: o campo e um intervalo, e
     * escrever `niveis: 2` seria lido como `[2, undefined]` e viraria
     * `NaN` no sorteio
     */
    niveis: [2, 2],
  },
  {
    /**
     * O PANTANO e a zona de ENTRADA do vale.
     *
     * Ela e onde o jogador chega atravessando o portal que vem do hub,
     * entao o que mora aqui e a primeira coisa que ele enfrenta. E o
     * unico lugar do jogo que so tem limo, e so limo de nivel 1 e 2
     *
     * Antes eram ogre (nivel 15), ghoul (8) e um punhado de limo. O
     * jogador de nivel 1 saia do hub, andava quatro mil pixels e
     * encontrava um ogre de nivel 15 no primeiro passo — o portal
     * became a armadilha mais longe do mapa
     *
     * O `niveis` e o que segura o teto. O `LEVEL_TIERS` global soma ate
     * 2 ao nivel do tipo, e o limo tem base 1, entao sem o clamp ele
     * nasceria tambem no nivel 3
     */
    zone: "pantano",
    count: 7,
    mix: { slime: 100 },

    /**
     * O NIVEL sorteado na zona, em vez do `LEVEL_TIERS` global.
     *
     * O clamp e o que garante o "1 a 2" do enunciado. Um limo tem base
     * 1, entao 1 e 2 e o nivel base e o nivel base mais um
     */
    niveis: [1, 2],
  },
  {
    /**
     * O CAMPO DE PROVAS tambem tem um par de criaturas.
     *
     * O campo e o lugar de treino, e os bonecos parados continuam
     * sendo o alvo de pratica. Estas duas nao sao alvo: sao o par de
     * nivel mais alto do vale, postas nos lados para o jogador medir
     *
     * O limo 6 continua a progressao (o Brejo e 6 tambem) e o ogre 7 e
     * o degrau acima dele
     *
     * ## ESTA ENTRADA VAI NO FIM DE PROPONTO
     *
     * A ordem do roster define o indice global de cada criatura, e o
     * indice 0 e o que os testes de auto e de missao usam como "a
     * primeira criatura do mapa". Colocar o campo na frente punha um
     * limo a 1800px do nascimento nesse papel, e o piloto passava a
     * atravessar o mapa para alcancar uma criatura que nao e a que o
     * teste nomeou
     */
    zone: "treino",
    count: 10,
    mix: { slime: 60, ogre_da_predeira: 40 },

    /** Um nivel por tipo: o `niveis` da zona e um intervalo so */
    niveisPorTipo: { slime: 6, ogre_da_predeira: 7 },

    /**
     * Comportamento por tipo, e nao so o `niveisPorTipo`.
     *
     * Um limo do campo e SEMI_PASSIVE: ele nao persegue, mas tambem nao
     * FOGE. O `slime` do tipo e PASSIVE, e um passive foge do jogador a
     * 100px — o piloto andando atras dele mantem a distancia igual, e o
     * auto de cacar perto fica sem alvo valido
     *
     * Este e o primeiro limo da lista, e o que fica mais perto do
     * nascimento dentro do campo
     */
    behaviors: { slime: BEHAVIOR.SEMI_PASSIVE },

    /**
     * Posicao por TIPO, e nao por slot.
     *
     * A grade do roster espalha por igual, e aqui os lados importam: o
     * limo encosta no Brejo (oeste, que termina em x=2420) e o ogre na
     * Cripta (leste, que comeca em x=4620)
     *
     * ## POR QUE OS DOIS FICAM LONGE DO CENTRO
     *
     * O nascimento do jogador e no meio do campo (3000,2100). Uma
     * criatura perto dele atravessa a linha entre o jogador e o resto
     * do mapa, e qualquer teste que posicione um alvo no oeste a 420px
     * passa a ter um obstaculo no meio do caminho — o alvo fica a 217px
     * e nunca chega no alcance
     *
     * Todos os pontos ficam a mais de 500px do nascimento, entao o
     * campo nunca vira um obstaculo no meio do mapa
     */
    posicoes: {
      /**
       * O PRIMEIRO limo nao entra no miolo.
       *
       * E o mais perto do nascimento que nao esta na linha dos outros,
       * e ele precisa ficar assim: o clique-para-engatar do
       * `GameEngine.test` procura a criatura viva mais proxima, e um
       * limo PASSIVO a 253px do spawn foge do jogador em vez de
       *fightar — o clique erra e o ataque basico nunca e pedido
       *
       * Os outros cinco ficam agrupados no canto oeste, que e o lado do
       * Brejo
       */
      slime: [
        { x: 2720, y: 1960 },
        { x: 2960, y: 2560 },
        { x: 2660, y: 2280 },
        { x: 2900, y: 1780 },
        { x: 3140, y: 1660 },
        { x: 2760, y: 2520 },
      ],
      ogre_da_predeira: [
        { x: 4300, y: 1900 },
        { x: 4200, y: 2300 },
        { x: 4340, y: 2540 },
        { x: 4180, y: 1640 },
      ],
    },
  },
];

/**
 * O ROSTER DO MAPA 2.
 *
 * ## A ESCALA CONTINUA DEPOIS DO MAPA 1
 *
 * O mapa 1 fecha no 12, na Floresta Sombria — que e a zona onde esta o
 * `portal_floresta`, o unico portal que leva para ca. No mapa 2 essa
 * mesma Floresta e o 13, e o mapa inteiro continua subindo a partir
 * dela: o Acampamento, que esta do lado, e o 14
 *
 * ## POR QUE A ESCALA SOBE, E O MAPA 1 DESCE
 *
 * No mapa 1 o jogador entra pelo Pantano, no nivel 1, e sobe ate a
 * Floresta. No mapa 2 ele entra pela Floresta, no 13, e a partir dai o
 * caminho continua para o lado oposto: Acampamento, Campina, Ruinas,
 * Cripta, e depois o campo de provas e o miolo do mapa
 *
 * Por isso a lista e escrita na ordem da ESCALA e nao na ordem em que
 * as linhas do mapa 1 foram escritas. Um `+1` mecanico daria Acampamento
 * 12 — o jogador atravessaria o portal para o 13 e encontraria o 12 logo
 * em seguida, e a campanha voltaria a andar para tras
 *
 * ## A SENTINELA NO LUGAR DO OGRE
 *
 * Todo ogre do mapa 2 e `skeleton`, a Sentinela Esqueletica, inclusive o
 * `ogre_da_predeira` do campo de provas. As contagens por zona e as
 * posicoes vem do roster do mapa 1, entao o desenho do territorio e o
 * mesmo e so a criatura muda
 */
const ESCALA_MAPA_2 = [
  ["floresta", 13],
  ["acampamento", 14],
  ["campina", 15],
  ["ruinas", 16],
  ["cripta", 17],

  /**
   * O CAMPO DE PROVAS e o par, como no mapa 1: um nivel para o slime e
   * um para a sentinela, com o `slime` no mais fraco
   */
  ["treino", 18],

  ["brejo", 20],
  ["toca", 21],
  ["cinzas", 22],
  ["dunas", 23],
  ["pedreira", 24],
  ["pantano", 25],
];

/**
 * A TABELA DE TIPOS DO MAPA 2.
 *
 * O mapa 2 nao tem nenhum ogre nem nenhum limo: onde o mapa 1 tem ogre
 * e sentinela, onde o mapa 1 tem limo e arqueiro zumbi
 *
 * E uma tabela, e nao uma regra no estilo "comeca com ogre". Os dois
 * ogres viram a MESMA sentinela, e o limo vira o arqueiro — um `+1`
 * mecanico ou um `replace` por nomeacinaria o limo no arqueiro e
 * esqueceria o `ogre_da_predeira`, que e o outro ogre do jogo
 */
const TIPOS_DO_MAPA_2 = {
  ogre: "skeleton",
  ogre_da_predeira: "skeleton",
  slime: "zumbi_arbalist",
};

export const MAP_2_ROSTER = ESCALA_MAPA_2.map(([zone, nivel]) => {
  const base = ZONE_ROSTER.find((row) => row.zone === zone);

  if (!base) {
    throw new Error(`zona ausente no roster do mapa 1: ${zone}`);
  }

  const renomeia = (typeId) => TIPOS_DO_MAPA_2[typeId] ?? typeId;

  const trocou = (typeId) => renomeia(typeId) !== typeId;

  /**
   * O `mix` e a lista de tipos com peso, e os dois ogres do campo de
   * provas somam 100. Trocar os dois pelo mesmo `skeleton` faria o peso
   * dobrar, entao as chaves iguais somam e o total volta a 100
   */
  const mix = {};

  for (const [typeId, weight] of Object.entries(base.mix ?? {})) {
    mix[renomeia(typeId)] = (mix[renomeia(typeId)] ?? 0) + weight;
  }

  /**
   * O `niveisPorTipo` e do PAR do campo de provas: um nivel para o
   * slime e o seguinte para a sentinela, na ordem em que as chaves
   * aparecem no `niveisPorTipo` do mapa 1
   *
   * Soma-se o indice da chave e nao um `+1` fixo: o par do mapa 1 e
   * {slime: 6, ogre_da_predeira: 7}, entao o primeiro tipo fica na
   * escala e o segundo um acima
   */
  const chaves = Object.keys(base.niveisPorTipo ?? {});

  const niveisPorTipo = {};

  chaves.forEach((typeId, indice) => {
    niveisPorTipo[renomeia(typeId)] = nivel + indice;
  });

/**
 * O `behaviors` NAO E LEVADO JUNTO QUANDO O TIPO MUDA.
 *
 * O override do mapa 1 existe para o SLIME do campo de provas: ele e
 * semi-passivo no treino e passivo no resto, porque um passive foge do
 * jogador a 100px e o auto de cacar perto fica sem alvo valido
 *
 * Copiar esse override para o arqueiro zumbi inverteria o comportamento
 * dele: a sentinela e ATIVA e ataca de longe, e um arqueiro zumbi
 * semi-passivo andando de costas atirando flecha seria o pior dos dois
 * mundos. O arqueiro fica com o ATIVE do proprio tipo
 */
  const behaviors = Object.fromEntries(
    Object.entries(base.behaviors ?? {})
      .filter(([typeId]) => !trocou(typeId))
      .map(([typeId, valor]) => [renomeia(typeId), valor]),
  );

  /**
   * AS POSICOES por tipo, ligadas ao mix.
   *
   * Sao os mesmos pontos do mapa 1 — o mapa 2 tem as mesmas dimensoes e
   * o mesmo terreno — e so a CHAVE do tipo muda
   */
  const posicoes = {};

  for (const [typeId, pontos] of Object.entries(base.posicoes ?? {})) {
    posicoes[renomeia(typeId)] = pontos;
  }

  const linha = { zone, count: base.count, mix };

  if (base.niveis) {
    /**
     * O `niveis` do mapa 1 e um INTERVALO, e o Pantano era [1, 2] — o
     * jogador mata qualquer um dos dois. Aqui vira um nivel so, o da
     * escala: o mapa 2 nao repete degrau
     */
    linha.niveis = [nivel, nivel];
  }

  if (Object.keys(niveisPorTipo).length > 0) {
    linha.niveisPorTipo = niveisPorTipo;
  }

  if (behaviors) {
    linha.behaviors = behaviors;
  }

  if (Object.keys(posicoes).length > 0) {
    linha.posicoes = posicoes;
  }

  return linha;
});

/**
 * O ROSTER DE UM MAPA.
 *
 * O mapa 1 usa o roster declarado na mão; o mapa 2 usa o derivado. A
 * escolha e pelo `id` do mapa e nao por "tem zona com `baseId`", porque
 * o `id` e a unica coisa que identifica o mapa em todo o resto do jogo
 */
export function rosterOf(map) {
  return map?.id === "map_2" ? MAP_2_ROSTER : ZONE_ROSTER;
}

function allocateTypes(count, mix) {
  const entries = Object.entries(mix);

  const total = entries.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );

  const exact = entries.map(([id, weight]) => ({
    id,
    value: (count * weight) / total,
  }));

  for (const entry of exact) {
    entry.count = Math.floor(entry.value);
    entry.rest = entry.value - entry.count;
  }

  let assigned = exact.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );

  const byRest = [...exact].sort(
    (a, b) => b.rest - a.rest,
  );

  let cursor = 0;

  while (assigned < count) {
    byRest[cursor % byRest.length].count += 1;
    assigned += 1;
    cursor += 1;
  }

  return exact
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ id: entry.id, count: entry.count }));
}

/**
 * O NIVEL de uma criatura nesta zona.
 *
 * ## A REGRA GERAL
 *
 * O `LEVEL_TIERS` global sorteia um deslocamento e soma ao nivel base do
 * tipo: um limo (base 1) nasce em 1, 2 ou 3, e um ogre (base 15) em 15,
 * 16 ou 17. E o que faz a zona危险 do jeito que o bioma pede
 *
 * ## A REGRA DA ZONA
 *
 * Uma zona que declara `niveis` usa o intervalo dela, e o nivel base do
 * tipo e IGNORADO. E assim que o Pantano Profundo consegue ser a zona de
 * entrada com limo de nivel 1 e 2: sem o intervalo, o `LEVEL_TIERS`
 * global colocaria um limo de nivel 3 la, e o `slime.level` continuaria
 * sendo 1 para o resto do jogo
 *
 * O campo e um intervalo, e nao um teto. Um "teto" sozinho deixaria o
 * piso nas maos do sorteio global, e a zona nao teria os dois numeros
 * que o enunciado pede
 *
 * ## POR QUE O `random` E PASSADO
 *
 * A funcao sorteia, e nao recebe o numero ja sorteado. Assim o mesmo
 * `random` do roster serve para posicao e para nivel, e uma semente
 * continua reproduzindo o mesmo mapa
 */
function nivelDaZona(entry, type, random) {
  /**
   * O NIVEL POR TIPO tem precedencia sobre o da zona.
   *
   * O campo de provas tem dois niveis diferentes no mesmo campo: limo 6
   * e ogre 7. O `niveis` da zona e um unico intervalo, entao ele nao da
   * para expressar os dois. O `niveisPorTipo` e escrito por tipo e
   * consultado antes
   */
  if (entry.niveisPorTipo) {
    const nivel = entry.niveisPorTipo[type.id];

    if (nivel !== undefined) return nivel;
  }

  if (!entry.niveis) {
    return Math.max(
      1,
      (type.level ?? 1) +
        LEVEL_TIERS[
          Math.floor(random() * LEVEL_TIERS.length)
        ],
    );
  }

  const [min, max] = entry.niveis;

  return Math.round(min + random() * (max - min));
}

function buildZoneTypes(entry) {
  const allocated = allocateTypes(
    entry.count,
    entry.mix,
  );

  const types = [];

  for (const item of allocated) {
    for (let n = 0; n < item.count; n += 1) {
      types.push(item.id);
    }
  }

  return types;
}

export function createCreature(
  typeId,
  position,
  index,
  level,
) {
  const type = CREATURE_TYPES[typeId];

  if (!type) {
    throw new Error(`tipo de criatura desconhecido: ${typeId}`);
  }

  const resolvedLevel = resolveLevel(type, level);
  const scaled = scaleForLevel(type, resolvedLevel);

  return {
    ...type,
    ...scaled,

    id: `${typeId}_${index}`,

    // O `id` da criatura carrega o indice para ficar unico no mundo
    // (`skeleton_7`), entao NAO serve para achar sprite, loot nem
    // ficha de bestiario: todos esses registros usam o id do TIPO.
    // O `id` do tipo vinha no `...type` acima e era sobrescrito
    // nesta linha, entao o tipo de gato sumia do mob.
    typeId,

    level: resolvedLevel,
    baseLevel: type.level ?? 1,

    x: position.x,
    y: position.y,

    spawnX: position.x,
    spawnY: position.y,

    hp: scaled.maxHp,
    alive: true,

    isCreature: true,
    isDummy: false,

    /**
     * A ESQUIVA desta criatura, como FRACAO.
     *
     * Nenhuma criatura declara `evasion` no tipo, entao ela vem de um
     * valor base que cresce devagar com o nivel: um mob de nivel 1
     * escapa de uns 3% dos golpes e um de nivel 20 escapa de uns 8%.
     * O jogador ve o "MISS" aparecer de vez em quando, sem que o
     * primeiro slimesco do mapa seja um alvo impossivel
     *
     * E o MESMO formato do `evasion` do jogador — fracao, e nao um
     * numero de defesa. As duas unidades tem de bater, ou a chance de
     * errar sai de escala em um dos lados
     *
     * O boneco de DUELO e a excecao declarada em `evasion: 0`: um
     * alvo de treino que faz o jogador errar ensina a esperar, nao a
     * jogar. Ele esta nesta lista porque revida, entao e uma
     * criatura comum no combate
     */
    evasion:
      type.evasion ??
      Math.min(
        CREATURE_EVASION_MAXIMA,
        CREATURE_EVASION_BASE +
          (resolvedLevel - 1) * CREATURE_EVASION_POR_NIVEL,
      ),

    facing: { x: 0, y: 1 },

    hitFlash: 0,
    attackAnimation: 0,

    pushVelocity: { x: 0, y: 0 },
    statusEffects: [],

    respawnTimer: 0,

    aiState: "idle",
    aiTimer: 0,
    provoked: false,
    alerted: false,
    attackCooldownRemaining: 0,

    wanderTarget: null,
    wanderWait: 0,

    stuckTimer: 0,
    sidestepTimer: 0,
    sidestepSign: 1,

    spriteOffset: (index % 7) * 0.37,
  };
}

/**
 * AS CRIATURAS DE UM MAPA.
 *
 * O roster mora em `ZONE_ROSTER`, que aponta para `MAP_1_ZONES` por
 * id. Isso prendia o mundo ao vale: o hub, que nao tem zona nenhuma,
 * aparecia cheio de Pantano Profundo assim que o mapa entrava
 *
 * Agora o mapa decide. Cada entrada do roster so vira criatura se a
 * zona existir NO MAPA QUE ESTA SENDO MONTADO, e um hub sem zonas
 * devolve lista vazia — que e o correto para um hub
 *
 * Sem argumento continua sendo o vale, com a mesma seed de sempre. E o
 * que mantem de pe os testes que montam um elenco sem se preocupar com
 * mapa: eles perguntam "as criaturas do jogo", e o jogo ainda e o vale
 */
export function createCreatureRoster(
  map = MAP_1,
  seed = MAP_1_SEED,
) {
  const random = createRandom(seed);
  const roster = [];

/**
   * Os ids das zonas deste mapa.
   *
   * Um `Set` porque a busca acontece uma vez por entrada do roster, e as
   * zonas do vale sao doze
   *
   * Entram os DOIS ids de cada zona: o dela e o `baseId`, que e o id da
   * zona do mapa 1 que ela copia. Sem o `baseId` no conjunto, o mapa 2
   * — cujas zonas tem o prefixo `m2_` — nao casaria com nenhuma entrada
   * do roster e nasceria sem criatura nenhuma
   */
  const zonasDoMapa = new Set(
    (map.zones ?? []).flatMap((zone) =>
      zone.baseId ? [zone.id, zone.baseId] : [zone.id],
    ),
  );

  let index = 0;

  /**
   * O ROSTER E DO MAPA, e nao um so.
   *
   * O mapa 1 usa o roster declarado na mao e o mapa 2 usa o derivado:
   * sentinela no lugar do ogre e um nivel acima em cada degrau. Um
   * roster unico obrigaria o mapa 2 a ter ogres, ou o mapa 1 a ter
   * sentinelas
   */
  for (const entry of rosterOf(map)) {
    // a zona existe, mas e de outro mapa: aqui nao mora ninguem
    if (!zonasDoMapa.has(entry.zone)) continue;

    /**
   * A ZONA DO ROSTER NESTE MAPA.
   *
   * O `ZONE_ROSTER` aponta para as zonas pelo id do mapa 1. O mapa 2 e
   * uma copia, e as zonas dele tem o prefixo `m2_` — sem o `baseId` o
   * roster nao reconheceria nenhuma e o mapa 2 nasceria sem criatura
   *
   * O `baseId` e o id da zona do mapa 1 que a copia representa. E o que
   * evita duplicar as centenas de linhas do roster para o mapa 2
   */
  const zone =
    map.zones.find(
      (z) => z.id === entry.zone || z.baseId === entry.zone,
    ) ??
    getZoneById(entry.zone);

    if (!zone) {
      throw new Error(`zona desconhecida: ${entry.zone}`);
    }

    const columns = Math.ceil(Math.sqrt(entry.count));
    const rows = Math.ceil(entry.count / columns);

    const types = buildZoneTypes(entry);

    for (let slot = 0; slot < entry.count; slot += 1) {
      const type = CREATURE_TYPES[types[slot]];

      /**
       * A POSICAO FIXA tem precedencia sobre a grade.
       *
       * A grade espalha por igual, e o campo de provas nao quer igual:
       * o limo e o ogre tem que ficar nos lados pedidos — o limo junto
       * do Brejo, o ogre junto da Cripta. A entrada escreve a posicao
       * de cada tipo, e o que nao vier no grid
       *
       * `posicoes[tipo]` e uma LISTA, e o enésimo spot do tipo e o
       * enésimo da lista. A ultima posição da lista repete, entao um
       * mix com mais criaturas que pontos continua placing todas
       */
      const lista = entry.posicoes?.[types[slot]];

      let position;

      if (lista) {
        const spots = Array.isArray(lista) ? lista : [lista];

        const usada = entry.positionsUsadas ??= new Map();

        const n = usada.get(types[slot]) ?? 0;

        usada.set(types[slot], n + 1);

        const spot = spots[Math.min(n, spots.length - 1)];

        position = { x: spot.x, y: spot.y };
      } else {
        const column = slot % columns;
        const row = Math.floor(slot / columns);

        const cellWidth = zone.width / (columns + 1);
        const cellHeight = zone.height / (rows + 1);

        const jitterX = (random() - 0.5) * cellWidth * 0.55;
        const jitterY = (random() - 0.5) * cellHeight * 0.55;

        position = {
          x: Math.round(
            zone.x + cellWidth * (column + 1) + jitterX,
          ),
          y: Math.round(
            zone.y + cellHeight * (row + 1) + jitterY,
          ),
        };
      }

const criatura = createCreature(
          types[slot],
          position,
          index,
          nivelDaZona(entry, type, random),
        );

        /**
         * O COMPORTAMENTO por tipo vem por cima do que a criatura
         * herdou do seu tipo
         *
         * O campo de provas usa isto: um limo `semiPassive` em vez de
         * `passive`. O `slime` do tipo foge do jogador a 100px, e um
         * alvo que foge nunca serve para o auto de cacar perto
         */
        const comportamento = entry.behaviors?.[types[slot]];

        if (comportamento) {
          criatura.behavior = comportamento;
        }

        roster.push(criatura);

        index += 1;
    }
  }

  return roster;
}

export const DUMMY_LOOT = applyDropScaling({
  coins: { min: 6, max: 18 },
  itemChance: 0.3,
  maxItems: 1,
  items: [
    { id: "dummy_wood", weight: 88 },
    { id: "goblin_cloth", weight: 9 },
    { id: "slime_gel", weight: 3 },
  ],
});

/**
 * O boneco de DUELO: o unico boneco de treino que revida.
 *
 * A regra pedida e: parado enquanto ninguem encosta, e assim que leva
 * o primeiro golpe ele vai ate QUEM BATEU e causa dano. Ele nao
 * vagueia, nao volta para casa e nao persegue o jogador mais proximo
 * como o resto dos mobs: trava no primeiro agressor e so troca de
 * alvo quando esse alvo MORRE, assumindo quem estiver batendo
 * nele.
 *
 * Os numeros sao de boneco de treino, e nao de mob: 1500 de vida e
 * um golpe leve o suficiente para o jogador aprender a distancia e a
 * sobreviver. O `speed` e menor que o do jogador de proposito: um
 * boneco que corre mais que o guerreiro nao serve para treinar
 * nada. Ajuste aqui se quiser outro tom.
 */
const DUEL_DUMMY = {
  speed: 96,
  damage: 16,
  attackRange: 70,
  attackCooldown: 2.4,
  aggroRange: Infinity,
  leash: Infinity,
  wanderRadius: 0,
  wanderSpeed: 0,

  /**
   * O boneco de duelo NAO escapa de golpe.
   *
   * E o unico boneco que revida, entao e uma criatura no meio das
   * outras e teria esquiva pelo nivel. Mas a funcao dele e servir de
   * alvo: um boneco que falha 3% das vezes ensina o jogador a esperar
   * o golpe passar em vez de aprender a acertar. As outras criaturas
   * ficam com a esquiva do nivel
   */
  evasion: 0,
};

/** O boneco de madeira e o de duelo. O reforcado e alvo fixo. */
const DUEL_DUMMY_IDS = new Set(["dummy_warrior"]);

export function createTrainingDummy(blueprint) {
  return {
    ...blueprint,

    level: 1,
    baseLevel: 1,

    x: blueprint.position.x,
    y: blueprint.position.y,

    spawnX: blueprint.position.x,
    spawnY: blueprint.position.y,

    hp: blueprint.maxHp,
    alive: true,

    isCreature: false,
    isDummy: true,

    // O `typeId` e o que o motor usa para achar a arte. O boneco
    // precisa dele tanto quanto uma criatura, senao o registro de
    // sprite nao acha nada e ele cai no corpo vetorial. Para o
    // boneco de madeira o proprio id serve de tipo
    typeId: blueprint.id,

    // `duelo` marca o boneco que revida. E o que a EnemyAI le para
    // rodar nele a regra do duelo; o outro fica com zero
    // deste campo e continuam alvos fixos
    duelo: DUEL_DUMMY_IDS.has(blueprint.id)
      ? { ...DUEL_DUMMY }
      : null,

    // O desenho soma este valor no tempo da animacao. Sem ele o
    // tempo vira `NaN`, o retangulo de origem sai com `x: NaN` e o
    // boneco SOME: foi assim que a arte do boneco de madeira "nao
    // aparecia", carregada e valida, com o desenho recebendo
    // coordenadas invalidas
    spriteOffset: 0,

    facing: { x: 0, y: 1 },

    hitFlash: 0,
    attackAnimation: 0,

    pushVelocity: { x: 0, y: 0 },
    statusEffects: [],
    statusTickTimer: 0,

    loot: DUMMY_LOOT,

    respawnTimer: 0,

    aiState: "idle",
    aiTimer: 0,
    provoked: false,
    alerted: false,
    attackCooldownRemaining: 0,

    // A memoria do duelo. `targetId` e o ID do jogador travado: o
    // boneco nao troca de alvo enquanto esse jogador estiver vivo, e
    // e por isso que ele guarda o ID e nao a entidade. `lastHitById`
    // e quem esta batendo AGORA, e de onde vem o alvo quando o
    // primeiro morre
    targetId: null,
    lastHitById: null,
  };
}

/**
 * Os bonecos do Campo de Provas.
 *
 * Eles vivem dentro da zona de treino do vale, entao seguem a mesma
 * regra das criaturas: so aparecem no mapa que tem a zona. Um hub sem
 * `kind: "training"` devolve lista vazia
 */
export function createTrainingDummies(map) {
  if (map) {
    const temTreino = (map.zones ?? []).some(
      (zone) => zone.kind === "training",
    );

    if (!temTreino) return [];
  }

  return TRAINING_DUMMY_BLUEPRINTS.map(createTrainingDummy);
}
