import { createAction, SKILL_PACKS } from "../skills/index.js";

function basicAttack({
  classId,
  damage,
  type = "cone",
  range,
  cooldown,
  damageType = "physical",
  resourceCost = 0,
  projectileSpeed = 0,
  projectileStyle,
  lifesteal = 0,
  effects = [],
}) {
  return createAction("Basic Attack", type, {
    id: `${classId}_basic_attack`,
    name: "Ataque BÃ¡sico",
    icon: "ATK",
    description: "Ataque bÃ¡sico da classe.",
    damage,
    damageType,
    cooldown,
    range,
    radius: type === "line" ? 45 : 0,
    angle: 1.65,
    resourceCost,
    projectileSpeed,
    projectileStyle,
    lifesteal,

    /**
     * O EMPURRAO DO BASICO.
     *
     * ## POR QUE O BASICO NAO TINHA NENHUM
     *
     * Porque as skills que empurram tracem o `effects` uma a uma, e o
     * basico vinha com a lista vazia. O resultado era uma briga corpo a
     * corpo em que nada nunca deslocava ninguem: o alvo recebia o dano,
     * piscava, e ficava exatamente onde estava. Numa copia de melee o golpe
     * nao se sente no mundo â€” so no numero
     *
     * ## POR QUE `value: 55`, E NAO OS 70-320 DAS SKILLS
     *
     * Porque o basico e o golpe que sai varias vezes por segundo, e o
     * empurrao e proporcional ao dano (`enemiesPush` soma no
     * `pushVelocity`). Um valor de skill aqui empurraria o mob para fora do
     * alcance a cada golpe, e o Guerreiro passaria a lutar em outro lugar
     *
     * 55 com o decaimento de `exp(-8 * dt)` da o equivalente a uns 7px de
     * deslocamento: o bastante para o golpe ter peso, pouco o bastante para
     * nao virar controle
     *
     * E o `effects` que vem por parametro continua entrando DEPOIS deste,
     * em `...effects`: assim uma classe que passe `effects` propio soma o
     * dela em vez de trocar a nossa
     */
    effects: [
      ...(type === "projectile"
        ? []
        : [{ type: "knockback", value: 55 }]),
      ...effects,
    ],
    impactRadius: type === "projectile" ? 60 : 0,
    color: "#ffffff",
  });
}

const warrior = {
  id: "warrior",
  name: "Warrior",
  icon: "\u{1F5E1}\u{FE0F}",
  accent: "#ef5350",
  tagline: "Linha de frente, controle e resistÃªncia",
  description:
    "Combatente pesado que permanece na linha de frente, protege aliados e usa forÃ§a fÃ­sica para controlar grupos.",
  role: "Tank / Frontline / Controle",
  combatType: "Corpo a corpo e controle de Ã¡rea",
  rangeLabel: "Curto",
  damageType: "FÃ­sico",
  playstyle:
    "AvanÃ§ar primeiro, encaixar habilidades de Ã¡rea, manter postura defensiva e contra-atacar.",
  mechanic: {
    name: "Postura de ferro",
    description:
      "Combina resistÃªncia, escudos, controle de posicionamento e contra-ataques.",
  },
  characteristics: [
    "Vida e defesa elevadas",
    "Alta resistÃªncia a controle",
    "Dano fÃ­sico mÃ©dio",
    "Baixa mobilidade",
    "Forte controle de grupo",
  ],
  strengths: [
    "Sobrevive Ã  frente",
    "Excelente AoE",
    "Stun, pull e knockback",
    "Boa proteÃ§Ã£o contra grupos",
  ],
  weaknesses: [
    "Pouca velocidade",
    "Alcance curto",
    "Depende de posicionamento",
  ],
  stats: {
    hp: 1400,
    resource: 100,
    attack: 82,
    defense: 42,
    speed: 165,
    attackSpeed: 0.85,
    critRate: 0.1,
    critDamage: 1.5,
    range: 105,
    resourceRegen: 9,
  },
  /**
   * Os CINCO atributos do Guerreiro, e o quanto cada um sobe por
   * nivel.
   *
   * O Guerreiro e o tanque: VIT e STR sao os dois maiores e sao os que
   * mais sobem. E o que faz a folha dele nao ser a do Lancer com
   * numeros trocados â€” os dois comecam perto, mas aos 30 o Guerreiro
   * aguenta o triplo e o Lancer nao
   *
   * E o que a folha de stats le: `game/stats/StatSheet.js`. O
   * atributo nao entra direto em combate ainda, ele move MATK, MDEF,
   * PEN, ACC, EVA e as taxas â€” e por isso que ele aparece na tela
   */
  attributes: {
    str: 18,
    int: 7,
    dex: 11,
    vit: 20,
    wis: 8,
  },
  attributeGrowth: { str: 2, int: 1, dex: 1, vit: 3, wis: 1 },
  resource: {
    name: "Chi",
    // laranja, e nao vermelho: o HP ja e vermelho, e as duas barras
    // ficam lado a lado no alto da tela. Com o Chi em `#ff5233` as duas
    // saiam no mesmo matiz, e o jogador parava de saber qual era qual
    // sem olhar o rotulo
    color: "#ff6a00",
  },
  basicAttack: basicAttack({
    classId: "warrior",
    damage: 82,
    range: 115,
    cooldown: 1 / 0.85,
  }),
  ...SKILL_PACKS.warrior,
};

/**
 * O LANCER SEM COR.
 *
 * ## POR QUE A `accent` SUMIU
 *
 * Porque a classe foi descontinuada: ela saiu da seleção de classe e dos
 * chips do mercado faz tempo, e o que sobrou no catálogo existe só para um save
 * antigo ainda carregar o id. Uma cor aqui seria uma quarta cor de classe
 * aparecendo em lugar nenhum, e pior: ela era azul — o mesmo azul que o
 * Sorcerer passou a usar — então qualquer coisa que lesse o `accent` por
 * atributo pintaria o Lancer da cor do mago
 *
 * ## POR QUE A CLASSE CONTINUA AQUI
 *
 * Porque `CHARACTER_CLASSES` e lido pelo motor para abrir save. Apagar a
 * entrada faria um save de Lancer quebrar na hora de carregar, e um jogador que
 * jogou dias daquela classe perderia a conta. A classe fica inerte: sem cor,
 * fora dos chips e fora do filtro
 *
 * ## E O QUE ACONTECE QUANDO ALGO LE O `accent` DELE
 *
 * Nada. O `ClassFilterChips` filtra o Lancer antes de renderizar, e o
 * `ListingCard` so recebe classe de item — nenhum dos dois tem como ver esta
 * entrada. Onde o token cairia vazio, o CSS usa o cinza de reserva
 */
const lancer = {
  id: "lancer",
  name: "Lancer",
  icon: "\u{2694}\u{FE0F}",
  tagline: "Entrar, controlar e reposicionar",
  description:
    "Bruiser mÃ³vel que combina estocadas longas, investidas e ataques de Ã¡rea para entrar e sair do combate.",
  role: "Bruiser / DPS / Controle / Mobilidade",
  combatType: "Corpo a corpo alongado e investidas",
  rangeLabel: "Curto a mÃ©dio",
  damageType: "FÃ­sico",
  playstyle:
    "Usar alcance para golpear, dash para entrar, controlar o alvo e reposicionar antes do contra-ataque.",
  mechanic: {
    name: "Fluxo de combate",
    description:
      "A) Atacar com mÃ©dia distÃ¢ncia  B) Controlar  C) Recuperar espaÃ§o com dash.",
  },
  characteristics: [
    "Alcance maior que Warrior",
    "Boa velocidade",
    "Dano fÃ­sico consistente",
    "Defesa mÃ©dia",
    "Dash perfurante",
  ],
  strengths: [
    "Mobilidade",
    "Alcance mÃ©dio",
    "Combo de trÃªs golpes",
    "Roubo de vida",
  ],
  weaknesses: [
    "Menos resistente que Warrior",
    "Depende de acertar investidas",
    "Sem proteÃ§Ã£o extrema",
  ],
  stats: {
    hp: 1050,
    resource: 110,
    attack: 90,
    defense: 30,
    speed: 220,
    attackSpeed: 1.15,
    critRate: 0.14,
    critDamage: 1.65,
    range: 180,
    resourceRegen: 12,
  },
  /**
   * O Lancer e o bruiser movel: DEX e o atributo maior e o que mais
   * sobe, com VIT logo atras por causa do dash atravessa o grupo.
   * Menos VIT que o Guerreiro e mais DEX e STR, que e o que faz ele
   * entrar e sair sem dying
   */
  attributes: {
    str: 16,
    int: 9,
    dex: 15,
    vit: 13,
    wis: 9,
  },
  attributeGrowth: { str: 2, int: 1, dex: 3, vit: 2, wis: 1 },
  resource: {
    name: "Foco",
    color: "#00c2ff",
  },
  basicAttack: basicAttack({
    classId: "lancer",
    damage: 90,
    type: "line",
    range: 180,
    cooldown: 1 / 1.15,
  }),
  ...SKILL_PACKS.lancer,
};

const sorcerer = {
  id: "sorcerer",
  name: "Sorcerer",
  icon: "\u{1F52E}",
  accent: "#52c7ff",
  tagline: "Dano elemental Ã  distÃ¢ncia",
  description:
    "Mage de alto dano mÃ¡gico, Ã¡reas elementais e controle, especialmente perigosa quando mantÃ©m distÃ¢ncia.",
  role: "Mage / Ranged DPS / AoE / Controle",
  combatType: "ProjÃ©teis elementais e tempestades",
  rangeLabel: "Longo",
  damageType: "MÃ¡gico elemental",
  playstyle:
    "Manter distÃ¢ncia, aplicar elementos em sequÃªncia e usar campos de Ã¡rea antes de ser cercada.",
  mechanic: {
    name: "ReaÃ§Ã£o elemental",
    description:
      "Fogo, gelo, tempestade, trevas e veneno podem receber sinergias futuras.",
  },
  characteristics: [
    "Maior dano mÃ¡gico",
    "Longo alcance",
    "Excelente AoE",
    "Baixa defesa",
    "Mana como recurso",
  ],
  strengths: [
    "Dano Ã  distÃ¢ncia",
    "Controle em Ã¡rea",
    "Slow e pull",
    "Esquiva de projÃ©teis",
  ],
  weaknesses: [
    "FrÃ¡gil em corpo a corpo",
    "Consumo elevado de Mana",
    "Precisa manter distÃ¢ncia",
  ],
  stats: {
    hp: 680,
    resource: 210,
    attack: 112,
    defense: 16,
    speed: 195,
    attackSpeed: 0.9,
    critRate: 0.12,
    critDamage: 1.6,
    range: 400,
    resourceRegen: 13,
  },
  /**
   * O Sorcerer e o caster: INT e WIS lideram de longe e sao os que
   * mais sobem. E o unico da lista com INT no topo, e e por isso que
   * o MATK dele e o maior do jogo enquanto a DEF e a menor
   */
  attributes: {
    str: 8,
    int: 21,
    dex: 11,
    vit: 9,
    wis: 17,
  },
  attributeGrowth: { str: 1, int: 3, dex: 2, vit: 1, wis: 2 },
  resource: {
    name: "Mana",
    color: "#a02bff",
  },
  basicAttack: basicAttack({
    classId: "sorcerer",
    damage: 112,
    type: "projectile",
    range: 430,
    projectileSpeed: 430,
    damageType: "magic",
    projectileStyle: "fire",
    cooldown: 1 / 0.9,
  }),
  ...SKILL_PACKS.sorcerer,
};

const arbalist = {
  id: "arbalist",
  name: "Arbalist",
  icon: "\u{1F3F9}",
  accent: "#8ed081",
  tagline: "Dano fÃ­sico, crÃ­tico e mobilidade",
  description:
    "Especialista em manter distÃ¢ncia, disparos rÃ¡pidos, crÃ­tico, veneno e reposicionamento ofensivo.",
  role: "Ranged DPS / Crit / Mobilidade",
  combatType: "Disparos de longa distÃ¢ncia",
  rangeLabel: "Muito longo",
  damageType: "FÃ­sico",
  playstyle:
    "Atacar, reposicionar, dashar para longe ou entrar para burst e voltar Ã  distÃ¢ncia.",
  mechanic: {
    name: "Cycle de distÃ¢ncia",
    description:
      "A) Atacar  B) Reposicionar  C) Dash  D) Atacar novamente.",
  },
  characteristics: [
    "Alto dano fÃ­sico",
    "CrÃ­tico elevado",
    "Disparo rÃ¡pido",
    "Longo alcance",
    "Baixa resistÃªncia",
  ],
  strengths: [
    "CrÃ­tico",
    "Alcance",
    "Cloaking",
    "Veneno",
    "Dash ofensivo",
  ],
  weaknesses: [
    "Pouca resistÃªncia",
    "VulnerÃ¡vel se cercada",
    "Depende de reposicionar",
  ],
  stats: {
    hp: 700,
    resource: 125,
    attack: 104,
    defense: 18,
    speed: 230,
    attackSpeed: 1.4,
    critRate: 0.25,
    critDamage: 2,
    range: 520,
    resourceRegen: 10,
  },
  /**
   * A Arbalist e a critista: DEX e o maior atributo e o que mais sobe,
   * com WIS em segundo porque veneno e dash dependem de saber a hora.
   * STR e VIT sao os mais baixos das quatro classes, e e por isso que
   * ela morre primeiro se alguem chegar perto
   */
  attributes: {
    str: 13,
    int: 11,
    dex: 18,
    vit: 11,
    wis: 12,
  },
  attributeGrowth: { str: 2, int: 1, dex: 3, vit: 2, wis: 2 },
  resource: {
    name: "Foco",
    // sem vermelho nenhum: `#5ce83f` e `#3ddc3d` davam 79% e 69% de
    // saturacao, e era o verde que mais lavava. Verde saturado exige
    // vermelho baixo, entao o R vai para zero e o matiz gira um pouco
    // para o verde-agua
    color: "#00e04a",
  },
  basicAttack: basicAttack({
    classId: "arbalist",
    damage: 104,
    type: "projectile",
    range: 550,
    projectileSpeed: 720,
    projectileStyle: "arrow",
    cooldown: 1 / 1.4,
  }),
  ...SKILL_PACKS.arbalist,
};

/**
 * As quatro classes do jogo.
 *
 * Sao estas, e nao mais: `taoist`, `darkist`, `lionheart` e
 * `summoner` saÃ­ram, e sairam junto com o skill pack, o sprite e a
 * arte de cada uma. A ordem e a de aparicao na tela de selecao.
 *
 * ## ESTA LISTA NAO E "AS CLASSES QUE EXISTEM"
 *
 * E o catalogo completo, e e ele que o servidor consulta no JOIN para
 * aceitar o personagem guardado. Tirar uma classe daqui nao a apaga do
 * jogo: tira a possibilidade de alguem ENTRAR com ela
 */
export const CHARACTER_CLASSES = Object.freeze([
  warrior,
  lancer,
  sorcerer,
  arbalist,
]);

/**
 * AS CLASSES OFERECIDAS NA TELA DE SELECAO.
 *
 * ## POR QUE ISSO EXISTE E POR QUE NAO E O `CHARACTER_CLASSES`
 *
 * Porque "esconder da tela" e "sair do jogo" sao coisas diferentes, e
 * confundir as duas custa o save de quem ja entrou
 *
 * O `lancer` saiu da selecao por decisao de produto, nao por ter sido
 * removido do jogo. A classe continua existindo: o sprite, o skill pack, os
 * itens, o ranking e o save de quem ja jogou com ela estao todos intactos
 *
 * E o servidor continua aceitando `lancer` no JOIN, porque e o
 * `CHARACTER_CLASSES` que ele le. Um jogador com lancer no save volta
 * digitando o nome dele e escolhendo Lancer na tela â€” e a tela mostra o
 * card dele mesmo com ele escondido da grade, que e o que o bloco de
 * recuperacao abaixo faz
 *
 * ## O QUE FICA QUANDO A CLASSE SOME DA GRADE
 *
 * Nada se perde: e um filtro de exibicao, e a lista completa continua
 * exportada e no servidor. Reverter e tirar um id desta lista
 */
export const CLASSES_NA_SELECAO = Object.freeze(
  CHARACTER_CLASSES.filter((character) => character.id !== "lancer"),
);

export function getCharacterDefinition(id) {
  return CHARACTER_CLASSES.find((character) => character.id === id) ?? null;
}
