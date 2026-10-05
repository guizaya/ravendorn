import { createTrainingDummies } from "../entities/TrainingDummy.js";
import { createPlayerSession } from "./PlayerSession.js";
import { PARTY_MAX } from "../../shared/protocol.js";
import { EnemyAI } from "../enemies/EnemyAI.js";
import {
  grantXp,
  statsForLevel,
  xpForKill,
  xpToNext,
} from "../progression/Levels.js";
import { CRAFT_RESULT } from "../craft/Craft.js";
import { DELIVER_RESULT as COLLECTION_RESULT } from "../collection/Collection.js";
import { isAutoCompletable } from "../../data/quests/index.js";
import {
  canEnchantItem,
  enchantCost,
  rollEnchant,
} from "../../data/enchant/index.js";
import {
  buildStatSheet,
  describeStatBonus,
  statValueOf,
} from "../stats/StatSheet.js";
import {
  RARITY_ORDER,
  RARITY_STYLE,
} from "../../data/items/index.js";
import { LootSystem } from "../loot/LootSystem.js";
import {
  describeFilter,
  isCollectedId,
  loadLootFilter,
  LOOT_CATEGORY,
  normalizeLootFilter,
  saveLootFilter,
} from "../loot/lootFilter.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { PropRenderer } from "../props/PropRenderer.js";
import { NpcRenderer } from "../npc/NpcRenderer.js";
import { getNpcType } from "../../data/npc/index.js";
import { PortalRenderer } from "../portais/PortalRenderer.js";
import { portalsOf } from "../../data/portais/index.js";
import { findMap, getMap } from "../../data/maps/index.js";
import {
  getItem,
  ITEM_TYPE,
  rarityOf,
  valueAt,
} from "../../data/items/index.js";
import {
  describeBonus,
  getBestiaryEntry,
} from "../../data/bestiary/index.js";

/**
 * soma dicionarios de bonus stat por chave.
 * spread nao serve aqui: equipamento e bestiario usam as mesmas
 * chaves (maxHp, attack...) e uma sobrescreveria a outra.
 */
export function mergeBonuses(...sources) {
  const total = {};

  for (const source of sources) {
    for (const [stat, value] of Object.entries(
      source ?? {},
    )) {
      total[stat] = (total[stat] ?? 0) + value;
    }
  }

  return total;
}
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { StatusSystem } from "../effects/StatusSystem.js";
import { EffectSystem } from "../effects/EffectSystem.js";
import { DamageSystem } from "../combat/DamageSystem.js";
import { SkillSystem } from "../skills/SkillSystem.js";
import { distance, normalize } from "../math.js";
import { montarRank } from "../ranking/rank.js";
import {
  snapshotMarket,
} from "../market/MarketStore.js";
import {
  ANUNCIOS_MAXIMOS,
  PRECO_MAXIMO,
  PRECO_MINIMO,
} from "../../data/market/index.js";

/**
 * O painel do market quando nao ha nenhum.
 *
 * O store e `null` no single player — o mercado entre jogadores nao
 * tem sentido com uma pessoa so — e o painel precisa continuar tendo
 * a MESMA forma, para o componente nao quebrar em `null`
 */
const EMPTY_MARKET = {
  listings: [],
  meus: [],
  historico: [],
  total: 0,
  coins: 0,
  limites: {
    maxAnuncios: ANUNCIOS_MAXIMOS,
    precoMinimo: PRECO_MINIMO,
    precoMaximo: PRECO_MAXIMO,
  },
};
/**
 * A GUILDA de quem nao tem store: a arvore bloqueada e nada mais.
 *
 * E o que o single player mostra, e o que o painel mostra antes da
 * primeira entrada. E um objeto CONSTRUIDO, e nao `null`: o painel
 * pergunta por `arvore` e por `cofre` sem antes perguntar se ha guilda,
 * e `null` seria um terceiro estado que so a tela saberia tratar
 *
 * `disponivel: true` em todo node, e nao `false`: a arvore de quem
 * ainda nao tem guilda esta INTEIRA disponivel, porque o que falta e a
 * guilda, e nao o talent. Marcar tudo como bloqueado faria o jogador
 * ver uma arvore morta em vez de uma arvore para destravar
 */
/**
 * A PARTY VAZIA.
 *
 * O estado de quem nao esta em party nenhuma: a box existe e traz o
 * botao de criar, que e o que o pedido descreve para o jogador sozinho
 */
const EMPTY_PARTY_SNAPSHOT = {
  partyId: null,
  lider: null,
  max: PARTY_MAX,
  membros: [],
  convite: null,
};

const EMPTY_GUILD_SNAPSHOT = {
  guilda: null,
  ehLider: false,
  ehDiretoria: false,
  pontos: 0,
  pontosMax: GUILD_PONTOS_MAX,
  cofre: null,
  busca: [],
  arvore: GUILD_TALENTS.map((node) => ({
    id: node.id,
    nome: node.nome,
    custo: node.custo,
    tier: node.tier,
    exige: node.exige,
    descricao: node.descricao,
    destravado: false,
    disponivel: true,
  })),
};

import {
  GUILD_PONTOS_MAX,
  GUILD_TALENTS,
  talentBonuses,
} from "../../data/guild/index.js";
import { SpriteSheet } from "../sprites/SpriteSheet.js";
import { resolveHurtShake } from "../sprites/animation.js";
import { getClassSprite } from "../../data/sprites/index.js";
import { getEnemySprite } from "../../data/sprites/enemies.js";
import { digitandoEm } from "../ui/typing.js";
import {
  computeMinimapTransform,
  drawMinimap,
  MINIMAP_HEIGHT,
  MINIMAP_RIGHT,
  MINIMAP_SLIDE,
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
  MINIMAP_WIDTH,
} from "../ui/minimap.js";
import { getZoneById } from "../../data/maps/index.js";
import { NavGrid } from "../nav/NavGrid.js";
import { rotaDeMapas } from "../nav/rotaDeViagem.js";
import {
  BEHAVIOR,
  createCreatureRoster,
} from "../../data/enemies/index.js";

const AUTO_RETARGET_INTERVAL = 0.25;
const AUTO_LEASH_RANGE = 1500;
const AUTO_LOW_HEALTH = 0.6;

/**
 * O RAIO DE CHEGADA de uma etapa da viagem.
 *
 * O mesmo `24` do `walkToward`, e nao o raio de travessia do portal
 * (96px). A razao e a ordem: estar a 24px do centro do portal ja esta
 * dentro dos 96px, entao o `travessarPortal` nunca recusa aqui
 *
 * Com um raio MENOR que o do `walkToward` o piloto passaria direto
 * pelas etapas: o `walkToward` devolve `false` ao chegar, o ponto
 * seraitado, e a etapasaltaria sem nunca chegar perto o bastante para
 * o portal valer
 */
const TRAVEL_CHEGADA = 24;

/**
 * A MEIA CELULA de tolerancia a mais na chegada de uma ETAPA.
 *
 * O caminho nem sempre termina no ponto exato da etapa: quando o destino
 * esta a menos de uma celula de um obstaculo, o `NavGrid` fecha o caminho
 * no CENTRO da celula vizinha, porque ir ate o centro e um passo de lado
 * e ir ate o destino seria raspar no obstaculo. Sao ate 28px de diferenca,
 * e 24px de tolerancia deixaria o piloto a 4px do fim, andando para sempre
 *
 * Meia celula e o que resolve: 24 + 20 = 44px, que e menos que o raio de
 * 96px do portal e continua sendo "chegou na zona", nao "chegou no
 * canto da zona"
 */
const TRAVEL_CHEGADA_CELULA = 20;

/**
 * QUANTO tempo o jogador pode ficar parado numa etapa antes de o motor
 * replanejar o caminho.
 *
 * Tres segundos e o tempo de um coinco lento de inferno, e o que separa
 * "chegando na arvore" de "preso na arvore". Menor que isso, um
 * obstaculo que empurre o jogador por um quadro faria o A* rodar de
 * novo sem necessidade — e o A* custa ate 80ms
 */
/**
 * DE QUANTO EM QUANTO O PLANO DE SEGUIR E REFEITO.
 *
 * O seguido anda varias vezes por segundo. Refazer o A* a cada quadro
 * custaria um BFS e uma montagem de plano por quadro, e o plano novo
 * quase nunca muda tanto assim em 400ms
 *
 * O valor e o mesmo periodo de um tique de rede do servidor: e o que faz
 * o seguidor virar no mesmo passo em que o followed vira
 */
const SEGUIR_REPLANEJA = 0.4;

/**
 * QUANTO o seguido precisa andar para o plano de seguir ser refeito.
 *
 * O relogio acima e o TETO, e nao o gatilho: 400ms e o piso para o
 * seguidor virar no mesmo passo que o lider, mas refazer o A* a cada
 * 400ms custa ate 80ms de CPU por chamada — e o A* do seguidor e o
 * caminho mais caro do jogo, porque o objetivo dele e a posicao de uma
 * PESSOA, que nunca para de andar
 *
 * Com o piso de distancia, dois jogadores andando na mesma direcao
 * reusam o mesmo caminho: o plano so e refeito quando o lider se afasta
 * o bastante para o caminho antigo acabar na posicao errada. E o que
 * mantem o A* do `seguir` na frequencia de uma mudanca de direcao, e
 * nao na frequencia de um relogio
 *
 * 96px e meio corredor de arvore: e o tanto de deslocamento que muda a
 * rota, e nao o tanto que muda o rumo
 */
const SEGUIR_REPLANEJA_PX = 96;

const TRAVEL_TRAVADO_LIMITE = 3;

/**
 * O MENOR deslocamento que conta como "andou".
 *
 * Um quadro a 60fps da uns 6px de caminhada, entao 4px separa o
 * tremor de uma arvore do movimento real. Maior que isso, o piloto
 * andando em direcao a uma parede por dois segundos contaria como
 * progresso e o replanejamento nunca aconteceria
 */
const TRAVEL_TRAVADO_EPSILON = 4;

/**
 * DE QUANDO EM QUANDO o caminho de perseguicao e refeito.
 *
 * Meio segundo e o compromise entre "o alvo andou" e "o A* custa ate
 * 80ms". Com 0.5s o arqueiro refaz o caminho umas duas vezes por
 * intervalo de tiro, o que e suficiente para a mira nao ficar
 * apontando para um lugar de onde o limo saiu
 *
 * O caminho tambem se refaz antes disso quando ele ACABA — e o sinal de
 * que o alvo escapou para longe demais e que o proximo passo precisa de
 * um caminho novo
 */
const CACA_RECALCULA = 0.5;

/**
 * Teto de flechas no ar, contando as do jogador e as do inimigo.
 *
 * O `SkillSystem` ja tem o seu (`MAX_PROJECTILES`) para nao deixar
 * o jogador encher a tela. Este e o mesmo teto para o total, e o
 * arco de tiro e o lugar onde uma trava apareceria primeiro.
 */
const MAX_FLECHAS = 256;

const CONTROLLED_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "KeyR",
  "KeyT",

  /**
   * O `Backspace` esta aqui sem ser atalho de nada.
   *
   * Ele e a tecla que o jogador precisa para APAGAR um caractere, e o
   * navegador antigo tratava `Backspace` como "voltar". Cancelar o
   * evento fora do campo e o que impede essa navegacao — e dentro do
   * campo o `digitandoEm` deixa passar, que e onde apagar tem que
   * funcionar
   *
   * O atalho que existia em cima dele — ressuscitar os bonecos de
   * treino — foi removido. Cancelar o evento e o que sobrou
   */
  "Backspace",
]);

const STATUS_COLORS = {
  poison: "#83d65b",
  burning: "#ff744d",
  stun: "#ffe36d",
  freeze: "#77dfff",
  root: "#be8cff",
  curse: "#d65c9d",
  weaken: "#b574d8",
  slow: "#7ba8c9",
};

const SKILL_CODE_PATTERN = /^Digit([1-8])$/;

const ACTIVE_RANGE = 1700;
const EMPTY_LIST = [];

const BEHAVIOR_COLORS = {
  [BEHAVIOR.PASSIVE]: "#6fbf8a",
  [BEHAVIOR.SEMI_PASSIVE]: "#f2c14d",
  [BEHAVIOR.ACTIVE]: "#e05a4a",
};

const COIN_COLOR = "#ffc857";

const ZONE_BEHAVIOR_COLORS = {
  training: "#6fbf8a",
  passive: "#6fbf8a",
  semi: "#f2c14d",
  active: "#e05a4a",
};

/**
 * A recompensa de uma missao em uma frase, para o aviso do resgate.
 *
 * O NOME do item, e nao o `itemId`: o jogador conhece a peca como
 * "Nucleo de Limo", e `slime_core` no aviso e o identificador interno
 * vazando para a tela
 */
function descreverRecompensa(reward) {
  const partes = [];

  if (reward.coins > 0) {
    partes.push(`${reward.coins} moedas`);
  }

  if (reward.xp > 0) {
    partes.push(`${reward.xp} xp`);
  }

  for (const item of reward.items ?? []) {
    const nome = getItem(item.itemId)?.name ?? item.itemId;

    partes.push(
      item.count > 1 ? `${nome} x${item.count}` : nome,
    );
  }

  return partes.length > 0 ? partes.join(" · ") : "nada";
}

export class GameEngine {
  /**
   * Entra no mundo compartilhado.
   *
   * No single player e o proprio jogador local. Online o servidor
   * chama isto uma vez por conexao, e todas as secoes apontam
   * para a mesma lista de inimigos: e isso que faz duas pessoas
   * verem o mesmo slime.
   */
  addPlayer(session, { focus = false, mapId = null } = {}) {
    if (this.world.players.has(session.id)) {
      return this.world.players.get(session.id);
    }

    /**
     * O MAPA DE QUEM ENTRA.
     *
     * Uma sessao nova vem sem `mapId`, e sem esta linha o `focusPlayer`
     * nao acharia mapa nenhum e o jogador nasceria sem colisor nem
     * inimigos
     *
     * O servidor passa o mapa de entrada dele, e nao o `world.map`: com
     * cada jogador no seu mapa, o `world` aponta para o do ultimo em
     * foco, e quem entrasse enquanto outro estivesse no vale nasceria no
     * vale
     */
    if (!session.mapId) {
      session.mapId = mapId ?? this.world.map?.id ?? null;
    }

    this.world.players.set(session.id, session);

    if (focus || !this.world.session) {
      this.focusPlayer(session.id);
    }

    return session;
  }

  removePlayer(id) {
    const session = this.world.players.get(id);

    this.world.players.delete(id);

    if (this.world.session?.id === id) {
      // sem alguem em foco, o motor ficaria lendo `null` em
      // `world.inventory` e estouraria em todo acesso
      this.focusPlayer(
        this.world.players.keys().next().value,
      );
    }

    return session;
  }

  focusPlayer(id) {
    this.world.session = this.world.players.get(id) ?? null;

    const sessao = this.world.session;

    if (!sessao) return null;

    /**
     * O `world` PASTA A APONTAR PARA O MAPA DELE.
     *
     * Sem esta troca o mapa seria o do ultimo `setMap`, e o jogador que
     * NAO atravessou o portal seria simulado no mapa do outro: os
     * inimigos, o colisor e os portais seriam os de fora
     *
     * E o que faz o portal atravessar so quem clique nele
     */
    const mapa = findMap(sessao.mapId);

    if (mapa) {
      this.aplicarContexto(this.contextoDoMapa(mapa));
    }

    return sessao;
  }

  /**
   * Roda `fn` com a sessao de `id` em foco e devolve a sessao
   * anterior.
   *
   * O motor le o estado privado por `world.inventory` e
   * `world.player`. Em vez de reescrever centenas de linhas
   * parametro-a-parametro, o servidor troca o foco antes de
   * resolver a acao daquele jogador. Como o `try/finally`
   * devolve o foco, um erro no meio do caminho nao deixa o motor
   * com o inventario de outra pessoa em memoria.
   */
  withPlayer(id, fn) {
    const anterior = this.world.session;

    this.focusPlayer(id);

    try {
      return fn(this.world.session);
    } finally {
      this.world.session = anterior;
    }
  }

  isPlayer(entity) {
    return entity?.isPlayer === true;
  }

  /**
   * Teclado e mouse do jogador em foco.
   *
   * Antes era um unico par no motor. No navegador continua sendo
   * o do jogador local, entao nada muda. Online, cada sessao tem
   * o seu e o `withPlayer` troca junto com o inventario: sem isso
   * o Bento andaria para ONDE a Ana estivesse apertando.
   */
  /**
   * O estado de COMBATE e de CACA, por jogador.
   *
   * Esses nove campos eram do MOTOR. No single player isso era
   * invisivel, porque so existe uma pessoa: mas online, o
   * `engagedTargetId` da Ana aparecia no `update` do Bento, e o
   * Bento ia atras do mob que a Ana clicou. Pior, o `autoPlay` de
   * um ligava o do outro.
   *
   * Agora sao acessorios que leem e escrevem na sessao em foco,
   * o mesmo caminho do `input`. As escritas que o motor faz no
   * loop de cada jogador ficam na sessao DELE, e o `finally` do
   * `withPlayer` devolve o foco, entao nao vaza nada.
   */
  /**
   * A classe do JOGADOR EM FOCO, e nao a do motor.
   *
   * Este e o mesmo problema dos outros campos por sessao, e o mais
   * danoso de todos porque decide COMO o jogador ataca.
   *
   * O servidor tem UM motor so, criado com a primeira classe que
   * entrou. O `this.classDefinition` era a do motor: um Arbalist
   * que entrasse depois usaria o `basicAttack` do Warrior (cone) em
   * vez do dele (projectile). O sintoma era o arqueiro batendo de
   * perto, sem arte de tiro e sem flecha nenhuma voando, porque o
   * motor estava disparando um cone.
   *
   * `withPlayer` troca o foco a cada jogador do laco, entao o
   * acessor devolve a classe certa para quem esta agindo agora.
   *
   * O DESENHO continua lendo `this.classDefinition`: la, a classe
   * e a do personagem que esta na tela, e isso e uma coisa so.
   */
  get classeDoJogador() {
    return (
      this.sessaoDeJogador?.classDefinition ??
      this.classDefinition
    );
  }

  /**
   * O ataque basico do jogador em foco, para o auto-play.
   *
   * Isto era um campo do MOTOR, montado com a classe do motor. No
   * servidor, com um so motor para o mundo inteiro, o auto-play
   * offered o basico do primeiro jogador para todo mundo: o
   * Arbalist ficava a 385 do alvo testando o alcance do cone do
   * Warrior, nao encontrava acao em alcance, e parava de bater
   * depois do primeiro golpe. O sintoma era "bate uma vez e para".
   *
   * Ver `classeDoJogador`: a classe e a da sessao em foco.
   */
  get autoBasicAction() {
    return this.classeDoJogador.basicAttack;
  }

  /**
   * As acoes candidatas do auto-play: o basico mais as
   * habilidades da classe, menos as vazias.
   *
   * E uma lista nova a cada chamada de proposito. Sao quatro
   * acoes por jogador, num metodo que roda umas 20 vezes por
   * segundo: guardar em cache exigiria invalidar quando o foco
   * muda, e um cache errado aqui significa offercer a habilidade
   * de outro jogador. O preco de refazer a lista e uma alocacao
   * minuscula contra um bug que ninguem entenderia depois.
   */
  get autoActions() {
    return [
      this.autoBasicAction,
      ...this.classeDoJogador.skills.filter(Boolean),
    ];
  }

  get engagedTargetId() {
    return this.sessaoDeJogador?.engagedTargetId ?? null;
  }

  set engagedTargetId(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.engagedTargetId = valor;
  }

  get selectedTargetId() {
    return this.sessaoDeJogador?.selectedTargetId ?? null;
  }

  set selectedTargetId(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.selectedTargetId = valor;
  }

  get autoPlay() {
    return this.sessaoDeJogador?.autoPlay ?? false;
  }

  set autoPlay(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.autoPlay = valor;
  }

  get bestiaryTargetType() {
    return this.sessaoDeJogador?.bestiaryTargetType ?? null;
  }

  set bestiaryTargetType(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.bestiaryTargetType = valor;
  }

  get autoWaypoint() {
    return this.sessaoDeJogador?.autoWaypoint ?? null;
  }

  set autoWaypoint(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.autoWaypoint = valor;
  }

  get autoMoveDirection() {
    return this.sessaoDeJogador?.autoMoveDirection ?? null;
  }

  set autoMoveDirection(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.autoMoveDirection = valor;
  }

  get autoFacing() {
    return this.sessaoDeJogador?.autoFacing ?? null;
  }

  set autoFacing(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.autoFacing = valor;
  }

  get autoDecisionTimer() {
    return this.sessaoDeJogador?.autoDecisionTimer ?? 0;
  }

  set autoDecisionTimer(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.autoDecisionTimer = valor;
  }

  /**
   * A FILA de etapas da viagem, por sessao.
   *
   * O `?? []` e o que mantem o motor funcionando antes de existir
   * sessao em foco: o construtor chama `sendSnapshot` antes de qualquer
   * `setMap`, e `updateAutoPlay` roda logo depois
   */
  get travelPlan() {
    return this.sessaoDeJogador?.travelPlan ?? [];
  }

  set travelPlan(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.travelPlan = valor;
  }

  get travelParado() {
    return this.sessaoDeJogador?.travelParado ?? 0;
  }

  set travelParado(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.travelParado = valor;
  }

  get cacadaCaminho() {
    return this.sessaoDeJogador?.cacadaCaminho ?? null;
  }

  set cacadaCaminho(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.cacadaCaminho = valor;
  }

  get cacadaRelogio() {
    return this.sessaoDeJogador?.cacadaRelogio ?? 0;
  }

  set cacadaRelogio(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.cacadaRelogio = valor;
  }

  get autoLeashRange() {
    return (
      this.sessaoDeJogador?.autoLeashRange ?? AUTO_LEASH_RANGE
    );
  }

  set autoLeashRange(valor) {
    const sessao = this.sessaoDeJogador;
    if (sessao) sessao.autoLeashRange = valor;
  }

  /**
   * O estado por jogador, ou `null` quando ninguem esta em foco.
   *
   * Acessivel durante a construcao, antes do world existir, por
   * isso o `?.`: as opcoes do construtor ja gravam alguns destes
   * campos e ainda nao ha senao.
   */
  get sessaoDeJogador() {
    return this.world?.session ?? null;
  }

  get input() {
    return this.world?.session?.input ?? this.localInput;
  }

  set input(value) {
    // o construtor atribui o input ANTES do world existir
    this.localInput = value;

    if (this.world?.session) {
      this.world.session.input = value;
    }
  }

  constructor(canvas, classDefinition, onSnapshot, options = {}) {
    // o nome curto existe porque `options.playerId` e `options.marketStore`
    // aparecem em varias linhas e `opcoes` fica legivel demais num
    // bloco de inicializacao longo
    const opcoes = options;
    // O engine roda em dois lugares: no navegador, com canvas, e no
    // SERVIDOR, sem nada de DOM. Esta e a unica fonte de simulacao
    // do jogo: o cliente desenha o que o servidor calculou. Rodar
    // duas simulacoes separadas (uma no cliente, outra no servidor)
    // faria os dois divergirem no primeiro frame, entao o servidor
    // usa esta mesma classe sem a parte de desenhar.
    this.headless = !canvas;
    this.canvas = canvas ?? null;

    /**
     * O STORE do market, so no servidor.
     *
     * E a unica injecao que o motor recebe de fora, e ela existe
     * porque o market e o unico subsistema que NAO e por jogador: o
     * anuncio de um jogador e o produto que o outro compra, entao ele
     * tem de ser de todos. Todo o resto vive na `PlayerSession`
     *
     * No single player fica `null` e o painel vem vazio
     */
    this.marketStore = opcoes.marketStore ?? null;

    /**
     * A GUILDA: estado compartilhado, injetado pelo servidor.
     *
     * `null` no single player, e o painel de guilda simplesmente mostra
     * o que qualquer jogador novo ve: a arvore bloqueada e nenhum botao
     * de criar. Sem `guildStore` a tela nao quebra, ela so nao tem o que
     * mostrar
     */
    this.guildStore = opcoes.guildStore ?? null;

    /**
     * A PARTY: estado compartilhado, injetado pelo servidor.
     *
     * O motor so LÊ. Ele pergunta "quem mais esta na party deste
     * jogador" e divide o abate; quem cria, quem entra e quem sai e o
     * `PartyStore`, no servidor
     *
     * `null` no single player, e o jogo segue sem divisao de loot — que e
     * o que ja acontecia antes de a party existir
     */
    this.partyStore = opcoes.partyStore ?? null;

    // No modo rede o motor vira so DESENHO. `GameEngine` continua
    // sendo a unica fonte de layout de sprites, terreno, props e
    // barras de vida, para o online e o offline olharem igual; o
    // que muda e que nada here e SIMULADO, porque quem simula e o
    // servidor. Ligado por `setNetworked`.
    this.networked = false;

    // Quem receber o clique no modo rede. O motor descobre o alvo
    // sob o cursor (ele sabe converter tela para mundo) e
    // entrega o id; quem fala com o servidor e a camada de rede,
    // que o motor nao conhece.
    this.onTargetClick = null;

    /**
     * O NPC que foi clicado.
     *
     * Differe do `onTargetClick` porque o alvo de um golpe e um ID que
     * o servidor valida, e o alvo de um painel e a ENTIDADE do NPC, com
     * o que ela abre dentro. Passar so o id obrigaria a tela a voltar
     * ao motor para perguntar de novo o que aquele NPC faz
     */
    this.onNpcClick = null;

    /**
     * O NPC SOB O CURSOR, e o modo do cursor que ele implica.
     *
     * Antes so havia o clique: o `pickAt` rodava no clique e o ponteiro
     * era sempre a mesma mira. O jogador nao tinha como saber que aquele
     * mercador era clicavel sem clicar, e clicava para discover
     *
     * O `id` e guardado em vez da ENTIDADE porque o NPC e recriado a cada
     * snapshot da rede. Guardar o objeto faria `===` falhar logo no
     * primeiro pacote recebido, e o balanco do NPC pararia de piscar
     */
    this.npcHover = null;

    /**
     * O ponteiro como o jogo quer que ele apareca: `npc`, `hub` ou
     * `combat`. Quem le e o `GameCanvas`, que escreve no `style` do
     * canvas — o motor nao mexe em DOM
     */
    this.cursorMode = "combat";

    /**
     * Notifica a tela quando o MODO do cursor muda.
     *
     * So no cambio, e nao a cada quadro: o `render` roda 60 vezes por
     * segundo e o `classList.toggle` 60 vezes por segundo nao mudaria
     * nada visivel, mas faria o React reavaliar a lista de classes do
     * canvas sem parar
     */
    this.onCursorChange = null;

    /**
     * O relogio do balanco de hover, em segundos.
     *
     * Vive aqui e nao no renderer porque o motor e o unico que sabe
     * quanto tempo passou entre dois desenhos. `performance.now()` dentro
     * do `drawNpc` daria um salto para cada NPC e o balanco deles
     * ficaria dessincronizado entre si
     */
    this.drawClock = 0;
    this.lastDrawAt = null;

    this.context = canvas
      ? canvas.getContext("2d")
      : null;
    this.classDefinition = classDefinition;
    this.onSnapshot = onSnapshot;

    // identidade do personagem. `playerId` precisa ser unico por
    // sessao: no single player o id da classe bastava, mas com
    // varios jogadores online dois "warrior" teriam o mesmo id e
    // o loot do last hit nao saberia a quem pertence
    this.playerId =
      options.playerId ?? `p_${classDefinition.id}`;
    this.characterName =
      options.characterName ?? classDefinition.name;

    this.viewport = {
      width: 1,
      height: 1,
      dpr: 1,
    };

    /**
     * A GRADE de navegacao do mapa atual, ou `null`.
     *
     * Montada sob demanda pelo `gradeDoMapa` e ZERADA no `setMap`. Nao
     * entra no construtor como `NavGrid`: a grade precisa do
     * `world.collision`, que so existe depois do primeiro `setMap`, e
     * construir uma no construtor custaria 15 mil testes de colisao
     * para um motor que talvez nunca ande
     */
    this.navGrid = null;

/**
   * O ESTADO DE CADA MAPA, cacheado pelo OBJETO do mapa.
   *
   * Nasce vazio e se preenche no primeiro `setMap`. E o que permite
   * dois jogadores estarem em mapas diferentes ao mesmo tempo sem
   * que o `world` do motor seja um so
   *
   * ## POR QUE UM `WeakMap` E NAO UM `Map` POR ID
   *
   * A chave e o OBJETO do mapa, e nao o `id`. Os mapas de verdade sao
   * singletons — o `findMap` devolve sempre o mesmo objeto — entao o
   * efeito e o de um cache por id: dois jogadores no mesmo mapa
   * compartilham o mesmo contexto
   *
   * A diferenca aparece com dois objetos de mapa de mesmo id: o cache
   * por id devolveria o contexto do primeiro para o segundo, e o segundo
   * apareceria com os inimigos e os portais do primeiro
   */
  this.mapContexts = new WeakMap();


    /**
     * A ONDE o jogador estava no quadro anterior da viagem.
     *
     * E o que permite detectar travamento por POSICAO em vez de por
     * comando. `null` no primeiro quadro, porque comparar com zero
     * diria que o jogador andou tres mil pixels
     */
    this.travelUltimaX = null;
    this.travelUltimaY = null;

    // o input nasce dentro da sessao do jogador local (ver
    // `createPlayerSession`). aqui so guardamos uma referencia
    // para o caso de o `input` ser lido antes do world existir
    this.localInput = {
      keys: new Set(),
      pointer: {
        x: classDefinition.stats.range + 100,
        y: 0,
        inside: false,
      },
    };

    // `selectedTargetId`, `autoPlay`, `engagedTargetId`,
    // `autoDecisionTimer`, `autoMoveDirection`, `autoFacing`,
    // `autoLeashRange` e `bestiaryTargetType` NAO sao inicializados
    // aqui: sao acessorios que apontam para a sessao em foco, e o
    // world ainda nem existe neste ponto do construtor. A sessao
    // local ja nasce com eles zerados (ver `createPlayerSession`).
    //
    // O aviso de tela (`message`) era um destes: um campo do MOTOR.
    // Online, todo painel lia o mesmo campo, entao o "+16 moedas" da
    // Ana aparecia na tela de todo mundo. Agora e da sessao, e a
    // sessao ja nasce com ele nulo.
    this.skillPage = 0;
    this.destroyed = false;
    this.lastTime = performance.now();
    this.snapshotAccumulator = 0;
    this.canvasRect = null;

    this.world = {
      time: 0,

      // quem esta online. no single player tem uma so pessoa; o
      // servidor enche este mapa com uma sessao por conexao
      players: new Map(),

      // a sessao em foco. todo o estado privado (inventario,
      // missoes, craft) e lido daqui, e nao do world, para que o
      // motor unchanged funcione igual para qualquer jogador
      session: null,

      /**
       * O resto do world e COMUM: inimigos, projeteis, drops e o
       * mapa sao o mesmo para todo mundo. e exatamente isso que
       * faz "os mesmos mobs" funcionar
       *
       * Os inimigos entram VAZIOS aqui e sao montados no `setMap`.
       * Eles moram dentro das zonas, e a zona so existe depois que o
       * mapa foi escolhido — no construtor ainda nao ha mapa nenhum.
       * Com a lista pronta aqui, o hub nascia cheio de Pantano
       * Profundo
       */
      enemies: [],

      /**
       * Os NPCs deste mapa.
       *
       * Lista propria e nao dentro de `props` porque um NPC reage a
       * clique e uma prop nao. Juntar os dois faria o mercador do hub
       * parecer parte do cenario, e o clique atravessaria ele ate
       * chegar no chao
       *
       * Vive no `world` e nao em `this.npcs`, pelo mesmo motivo que
       * `enemies`: o `CollisionSystem` e o desenho leem pela mesma
       * lista, e duas copias divergem no primeiro quadro
       */
      npcs: [],

      projectiles: [],
      pendingPulses: [],
      delayedEffects: [],
      drops: [],

      map: null,
      collision: null,
      statuses: null,
      damage: null,
      effects: null,

      enemiesPush(target, velocityX, velocityY) {
        target.pushVelocity.x += velocityX;
        target.pushVelocity.y += velocityY;
      },

      // atalhos para o estado da sessao em foco. o codigo antigo
      // usava `world.inventory` e `world.player`; manter os
      // nomes evita reescrever as centenas de linhas que leem
      // isso, e o resultado e o mesmo porque o world so tem um
      // jogador em foco por vez
      get player() {
        return this.session?.player ?? null;
      },
      get inventory() {
        return this.session?.inventory ?? null;
      },
      get equipment() {
        return this.session?.equipment ?? null;
      },
      get quests() {
        return this.session?.quests ?? null;
      },
      get bestiary() {
        return this.session?.bestiary ?? null;
      },
      get craft() {
        return this.session?.craft ?? null;
      },
      get collection() {
        return this.session?.collection ?? null;
      },
    };

    // no single player o motor ja e um jogador. o servidor cria o
    // motor uma vez e usa `addPlayer` para cada conexao
    const sessaoLocal = createPlayerSession(classDefinition, {
      x: 1200,
      y: 800,
      id: this.playerId,
      name: this.characterName,
      input: this.localInput,
    });

    // No single player a sessao nasce com o filtro do navegador.
    // Online este valor e ignorado: cada sessao recebe o filtro do
    // seu dono, e o loot e sorteado no servidor
    sessaoLocal.lootFilter = loadLootFilter();

    this.addPlayer(sessaoLocal, { focus: true });

    this.effects = new EffectSystem();
    this.statuses = new StatusSystem();
    this.loot = new LootSystem(this.world);
    // so o filtro do JOGADOR LOCAL semeia a sessao dele, e vem do
    // `localStorage` porque no single player o navegador e o dono do
    // save. Online o valor daqui e ignorado: cada sessao recebe o
    // filtro do seu dono, e o servidor e quem decide o loot
    this.lootFilter = loadLootFilter();

    this.damage = new DamageSystem({
      statuses: this.statuses,
      effects: this.effects,
      onDamaged: (attacker, target) => {
        // "o atacante e o jogador local" nao serve mais: online o
        // segundo jogador tambem e um jogador e tambem tem que
        // provocar o mob. o flag da entidade resolve os dois casos
        if (attacker?.isPlayer) {
          // O ATIRADOR vai junto, e nao so o alvo. E o que permite
          // ao boneco de duelo travar no primeiro agressor: sem o
          // `attacker` a IA saberia que foi levar pancada, e nao de
          // QUEM
          this.enemyAI?.provoke(target, attacker);
        }
      },
      onDeath: (attacker, target) => {
        // passa o atacante: `handleKill` usa este para saber de
        // quem e o loot. antes o parametro chegava aqui e era
        // descartado
        this.killEnemy(target, attacker);
      },
      onResolved: (attacker, target, resultado) => {
        /**
         * O numero sobe em DOIS lugares, e cada um no seu.
         *
         * No single player, o `DamageSystem` ja desenhou o texto aqui
         * mesmo, e a tela ve direto. No modo rede o motor e o do
         * SERVIDOR, que nao desenha: o texto morre no `EffectSystem`
         * de um motor sem canvas. E quem tem o canvas e o cliente
         *
         * Por isso o motor so REPASSA o resultado. Quem decide para
         * quem enviar — se e so para quem atirou, ou tambem para quem
         * levou — e o dono do motor, e ele muda entre os dois usos
         */
        this.onDanoResolvido?.(attacker, target, resultado);
      },
    });

    this.enemyAI = new EnemyAI(this.world, {
      onDamagePlayer: (enemy, amount, target) =>
        this.damage.applyDamage(enemy, target, {
          id: `${enemy.id}_attack`,
          damage: amount,
          damageType: "physical",
          color: enemy.color,
        }),

      // o atirador (o arqueiro zumbi) nao causa dano direto: ele
      // solta uma flecha que viaja e acerta depois
      onShootPlayer: (enemy, target) =>
        this.dispararFlechaHostil(enemy, target),
    });

    this.world.effects = this.effects;
    this.world.statuses = this.statuses;
    this.world.damage = this.damage;
    this.world.collision = null;

    this.skillSystem = new SkillSystem(
      this.world,
      (message) => this.showMessage(message, true),
    );

    this.spriteSheet = null;
    this.spriteTime = 0;
    this.minimapCache = null;
    this.terrain = new TerrainRenderer();
    this.props = new PropRenderer();

    /**
     * O renderer dos NPCs, ao lado do das props.
     *
     * Sao dois porque as artes nao se misturam: prop vem de folha de
     * 32px com quatro variacoes, NPC e um desenho unico ancorado no
     * pe. Forcar os NPCs a entrarem no `PropRenderer` seria fazer o
     * indice de quadro valer para uma imagem que nao tem grade
     */
    this.npcs = new NpcRenderer();

    this.portals = new PortalRenderer();
    this.world.sort = [];
    this.frameErrors = 0;
    this.minimapY = MINIMAP_TOP_IDLE;
    this.frameDelta = 1 / 60;

    const spriteDefinition = getClassSprite(
      classDefinition.id,
    );

    if (spriteDefinition) {
      this.spriteSheet = new SpriteSheet(
        spriteDefinition,
      );
    }

    this.enemySprites = new Map();

    // Os sprites de CLASSE dos OUTROS jogadores, por `classId`.
    //
    // E um mapa por classe, e nao por jogador, de proposito: dois
    // Arbalist na tela compartilham a MESMA imagem, e nao baixam
    // duas copias. E o que mantem a animacao deles igual a do
    // jogador local, em vez de virarem uma figura generica.
    this.playerSprites = new Map();

    this.buildEnemySprites();

    this.boundLoop = this.boundLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.refreshCanvasRect =
      this.refreshCanvasRect.bind(this);

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleContextMenu = (event) => event.preventDefault();

    this.applyEquipment();
    this.sendSnapshot();

    // sem DOM nao ha input para escutar nem frame para pedir. o
    // servidor chama `update` do proprio laço de tempo, e o
    // navegador deixa o rAF cuidar disso
    if (!this.headless) {
      this.bindDomEvents();
      this.handleResize();
      this.animationFrame = requestAnimationFrame(
        this.boundLoop,
      );
    }
  }

  /**
   * Escuta teclado, mouse e janela.
   *
   * Fica separado do construtor porque no servidor nao ha nada
   * disso: `window` e `canvas` nao existem, e chamar
   * `addEventListener` la estoura.
   */
  bindDomEvents() {
    const canvas = this.canvas;

    canvas.addEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    canvas.addEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    canvas.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener(
      "scroll",
      this.refreshCanvasRect,
      true,
    );

    canvas.addEventListener(
      "contextmenu",
      this.handleContextMenu,
    );
  }

  /**
   * UMA FOLHA DE SPRITE POR INIMIGO.
   *
   * O filtro NAO e mais `isCreature`. Os bonecos de treino sao
   * `isCreature: false` e ficavam sem arte, caindo no corpo vetorial.
   * Quem decide se algo tem desenho e o registro: se `getEnemySprite`
   * nao conhece o tipo, o boneco segue no vetor, que e o que os outros
   * seis merecem
   *
   * E pelo TIPO, e nao pelo `enemy.id`: o id da criatura tem o indice
   * (`slime_7`) e o registro de sprite usa o tipo (`slime`). Com o id
   * inteiro o registro nunca casava e TODOS os mobs caiam no corpo
   * vetorial de fallback
   *
   * Vive num metodo e nao no construtor porque os inimigos tambem
   * dependem do mapa: no construtor ainda nao ha elenco, e a folha de
   * cada um so existe depois do `setMap`
   */
  buildEnemySprites() {
    for (const enemy of this.world.enemies) {
      const definition = getEnemySprite(enemy.typeId);

      if (!definition) continue;

      this.enemySprites.set(
        enemy.id,
        new SpriteSheet(definition),
      );
    }
  }

/**
   * O ESTADO DE CADA MAPA, e o `world` aponta para um deles.
   *
   * ## POR QUE EXISTE ISSO
   *
   * O mapa, os inimigos, os NPCs, o colisor e os portais sao campos do
   * MOTOR, e o servidor tem um motor so. Com eles globais, o `setMap` de
   * um jogador trocava o mapa de todo mundo: o `broadcast` mandava o id
   * novo no pacote dos outros, o `NetworkWorld` de cada um via o mapa
   * junto, e os dois personagens atravessavam o portal como se fosse um
   *
   * A correcao e o `world` apontar para o contexto do mapa de quem esta
   * em foco. Dois jogadores no mesmo mapa compartilham o MESMO contexto
   * — e o que faz "os mesmos mobs" continuar valendo — e cada um ve o
   * contexto do seu proprio mapa
   *
   * O contexto e cacheado por `mapId`: sem o cache, voltar ao hub
   * remontaria os inimigos do hub e o drop que estava no chao sumiria
   */
  contextoDoMapa(map) {
    const guardado = this.mapContexts.get(map);

    if (guardado) return guardado;

    const contexto = this.montarContexto(map);

    this.mapContexts.set(map, contexto);

    return contexto;
  }

  /**
   * Monta o estado de UM mapa, sem encostar no `world`.
   *
   * E o corpo antigo do `setMap`, com o destino trocado: cada campo
   * nasce dentro do contexto em vez de sobrescrever o do mundo
   */
  montarContexto(map) {
    const npcs = (map.npcs ?? []).map((npc) => {
      const tipo = getNpcType(npc.typeId);

      if (!tipo) return null;

      return {
        ...npc,
        ...tipo,
        typeId: npc.typeId,
      };
    }).filter(Boolean);

    const collision = new CollisionSystem(
      map,
      npcs.filter((npc) => npc.blocking).map((npc) => this.npcs.blockBoxOf(npc)),
    );

    return {
      map,
      collision,
      npcs,
      props: map.props ?? [],
      portals: portalsOf(map),
      enemies: [
        ...createTrainingDummies(map),
        ...createCreatureRoster(map, map.seed),
      ],

      /**
       * O que esta NO CHAO tambem e do mapa.
       *
       * Drop, tiro e efeito pendente de um mapa nao podem aparecer em
       * outro: com o mundo unico isso nunca acontecia, porque so havia
       * um mapa. Com dois contextos vivos, um drop largado no vale
       * reapareceria no hub
       */
      drops: [],
      projectiles: [],
      pendingPulses: [],
      delayedEffects: [],

      /**
       * A GRADE e guardada no contexto, e nao no motor.
       *
       * Ela foi construida com o colisor DESTE mapa. Reusar a grade de
       * outro daria um caminho calculado contra obstaculos que nao
       * existem aqui
       */
      navGrid: null,
    };
  }

  /**
   * APONTA O `world` PARA O CONTEXTO DE UM MAPA.
   *
   * E o `world` que o resto do motor le, entao trocar o contexto aqui e
   * o mesmo que trocar de mapa — so que agora o mapa anterior fica
   * intacto para quem ainda esta nele
   */
  aplicarContexto(contexto) {
    this.world.map = contexto.map;
    this.world.collision = contexto.collision;
    this.world.npcs = contexto.npcs;
    this.world.props = contexto.props;
    this.world.portals = contexto.portals;
    this.world.enemies = contexto.enemies;
    this.world.drops = contexto.drops;
    this.world.projectiles = contexto.projectiles;
    this.world.pendingPulses = contexto.pendingPulses;
    this.world.delayedEffects = contexto.delayedEffects;

    this.navGrid = contexto.navGrid;

    // as folhas andam com o elenco
    this.buildEnemySprites();
  }

  setMap(map, { chegada = null } = {}) {
    const sessao = this.world.session;

    /**
     * O MAPA PASSA A SER DA SESSAO.
     *
     * E o `mapId` que o `focusPlayer` le para trocar o `world` de mapa,
     * e o `broadcast` que le para mandar o id certo no pacote de cada
     * um. Sem esta linha o servidor continuaria sabendo de um mapa so
     */
    if (sessao) {
      sessao.mapId = map.id;
    }

    this.aplicarContexto(this.contextoDoMapa(map));

    /**
     * ONDE O JOGADOR NASCE NESTE MAPA.
     *
     * O spawn do mapa, por padrao. A excecao e a TRAVESSIA de portal,
     * que chega no portal de chegada em vez do meio do mapa: atravessar
     * o portal do hub e aparecer no meio do vale deixaria o jogador a
     * tres mil pixels do portal de onde saiu, sem nenhuma pista de que
     * veio de la
     *
     * E o proprio `setMap` que aplica, e nao quem chamou. Um
     * `setMap` seguido de um `player.x = ...` la fora deixaria um
     * intervalo em que o jogador esta no mapa novo, na posicao antiga
     */
    const ondeChega = chegada ?? map.spawn;

    this.world.player.x = ondeChega.x;
    this.world.player.y = ondeChega.y;
    this.autoWaypoint = null;

    /**
     * O CURSOR ACOMPANHA O MAPA.
     *
     * O modo inicial do construtor e `combat`, e ele so seria corrigido no
     * primeiro quadro — o que deixaria a base com a mira de combate
     * durante a tela de carregamento inteira. Entrar num mapa e justamente
     * quando o cursor pode mudar, entao e aqui que a troca e feita
     *
     * O `render` tambem chama `atualizarHoverDeNpc`, e os dois nao
     * brigam: ele so avisa a tela quando o modo de fato mudou
     */
    this.atualizarHoverDeNpc();
  }

  /**
   * A folha de sprites de uma CLASSE, para desenhar os outros
   * jogadores.
   *
   * O sprite de quem joga e `this.spriteSheet`, criado no
   * construtor. Sem isto, um Arbalist que entrasse na sala
   * apareceria com a figura do primeiro mob da lista: foi
   * exatamente o bug que este metodo resolve.
   *
   * O cache e por `classId`, entao dez Arbalist na tela
   * compartilham uma imagem.
   */
  spriteDeClasse(classId) {
    if (!classId) return null;

    const jaExiste = this.playerSprites.get(classId);

    if (jaExiste) return jaExiste;

    const definition = getClassSprite(classId);

    // classe sem sprite: o desenho cai no corpo vetorial, que e o
    // mesmo reserva que o jogador local usa
    if (!definition) return null;

    const sheet = new SpriteSheet(definition);

    this.playerSprites.set(classId, sheet);

    return sheet;
  }

  liberarSpritesDeJogadores() {
    for (const sheet of this.playerSprites.values()) {
      sheet?.destroy?.();
    }

    this.playerSprites.clear();
  }

  /**
   * O desenho de um OUTRO jogador.
   *
   * Ele esta na lista de inimigos para reaproveitar o caminho de
   * codigo do desenho de corpos, mas nao e um mob: usa a folha da
   * CLASSE dele e a animacao de jogador (idle, walk e tiro),
   * exatamente a mesma que o proprio jogador local usa.
   */
  drawJogadorRemoto(context, remoto) {
    const sheet = this.spriteDeClasse(remoto.classId);

    // a sombra vem antes: e o que separa o boneco do chao, e o
    // jogador local tambem desenha a dele
    context.save();
    context.fillStyle = "rgba(0,0,0,0.32)";
    context.beginPath();
    context.ellipse(
      remoto.x,
      remoto.y + 17,
      22,
      10,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();

    const desenhou = sheet
      ? sheet.draw(context, remoto, this.spriteTime)
      : false;

    if (!desenhou) {
      this.drawEnemyBody(context, remoto);
    }

    this.drawNomeDeRemoto(context, remoto);
  }

  /**
   * O nome em cima do outro jogador.
   *
   * Sem isso o outro jogador e so uma figura sem nome no meio da
   * briga: da para ver que alguem esta la, mas nao quem.
   */
  drawNomeDeRemoto(context, remoto) {
    if (!remoto.name) return;

    const base = this.enemyHeadTop(remoto);

    context.save();
    context.textAlign = "center";
    context.font = "700 11px Inter, sans-serif";

    // um contorno grosso porque o texto passa por cima de
    // qualquer sprite, incluindo o escuro
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0,0,0,0.75)";
    context.strokeText(remoto.name, remoto.x, base - 6);

    context.fillStyle = "#e8f4ff";
    context.fillText(remoto.name, remoto.x, base - 6);

    context.restore();
  }

  destroy() {
    this.destroyed = true;

    this.liberarSpritesDeJogadores();

    if (this.headless) {
      this.enemySprites.clear();
      this.spriteSheet = null;
      return;
    }

    cancelAnimationFrame(this.animationFrame);

    this.spriteSheet?.destroy();
    this.spriteSheet = null;

    for (const sheet of this.enemySprites.values()) {
      sheet.destroy();
    }

    this.enemySprites.clear();

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener(
      "scroll",
      this.refreshCanvasRect,
      true,
    );

    this.canvas.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.canvas.removeEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    this.canvas.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.canvas.removeEventListener(
      "contextmenu",
      this.handleContextMenu,
    );
  }

  refreshCanvasRect() {
    if (this.headless) return;

    this.canvasRect =
      this.canvas.getBoundingClientRect();
  }

  handleResize() {
    this.refreshCanvasRect();

    this.viewport.width = Math.max(1, this.canvasRect.width);
    this.viewport.height = Math.max(1, this.canvasRect.height);
    this.viewport.dpr = Math.min(
      window.devicePixelRatio || 1,
      2,
    );

    this.canvas.width = Math.round(
      this.viewport.width * this.viewport.dpr,
    );

    this.canvas.height = Math.round(
      this.viewport.height * this.viewport.dpr,
    );

    this.context.imageSmoothingEnabled = false;
  }

/**
 * O PONTO DA TELA QUE O MOUSE APONTA, NO MUNDO.
 *
 * E o inverso exato da camera do `render`:
 *
 *     tela   = (mundo - jogador) * zoom + centro
 *     mundo  = (tela - centro) / zoom + jogador
 *
 * O zoom aparece aqui tambem, e por um motivo bem concreto: com a
 * camera 30% mais perto, o mesmo pixel da tela aponta para um terco de
 * mundo a menos. Sem dividir por `z`, o clique cairia longe do ponto que
 * o jogador esta vendo e o tiro iria para o lado errado
 *
 * O jogador NAO e dividido: ele e o ponto fixo do zoom, e some no
 * `+ jogador` do fim. Com `zoom = 1` a conta volta a ser exatamente a
 * de antes
 */
screenToWorld(clientX, clientY) {
  const rect = this.canvasRect;

  const z = this.cameraZoom;

  return {
    x:
      (clientX - rect.left - this.viewport.width / 2) / z +
      this.world.player.x,
    y:
      (clientY - rect.top - this.viewport.height / 2) / z +
      this.world.player.y,
  };
}


  handlePointerMove(event) {
    this.input.pointer = {
      ...this.screenToWorld(
        event.clientX,
        event.clientY,
      ),
      inside: true,
    };
  }

  handlePointerLeave() {
    this.input.pointer.inside = false;

    // Saiu da tela: o NPC debaixo do cursor deixou de existir. Sem isto o
    // ultimo mercador ficaria balancando para sempre, com o ponteiro fora
    this.npcHover = null;
  }

  /**
   * O NPC debaixo do cursor e o modo do cursor. Roda no desenho.
   *
   * No `render` e nao no `pointermove` por dois motivos: o ponteiro pode
   * estar parado enquanto um NPC entra no alcance dele — um snapshot da
   * rede cria e remove mercadores sem mover um pixel do mouse — e o
   * calculo depende de `world.npcs`, que no cliente so existe depois do
   * primeiro pacote
   */
  atualizarHoverDeNpc() {
    const ponteiro = this.input.pointer;

    /**
     * A ORDEM DE PRECEDENCIA DO CURSOR.
     *
     * O NPC ganha do hub, e o hub ganha do combate. O motivo e que os
     * dois casos sao sobre o QUE O PONTEIRO FAZ, nao sobre o lugar: um
     * mercador na base continua sendo clicavel, e o hub continua sem
     * inimigos mesmo com o ponteiro em cima de um
     */
    const npc =
      ponteiro.inside === true
        ? this.npcs.pickAt(this.world.npcs, ponteiro)
        : null;

    const hover = npc?.id ?? null;

    this.npcHover = hover;

    const modo = hover !== null ? "npc" : this.cursorDoMapa();

    if (modo === this.cursorMode) return;

    this.cursorMode = modo;
    this.onCursorChange?.(modo);
  }

  /**
   * O modo do cursor quando nao ha NPC embaixo dele.
   *
   * A base e `hub` porque la nao existe inimigo: a mira de combate seria
   * uma promessa que o mapa nao cumpre. Todo o resto e `combat`
   */
  cursorDoMapa() {
    return this.world.map?.id === "base" ? "hub" : "combat";
  }

  handlePointerDown(event) {
    if (event.button !== 0) return;

    const point = this.screenToWorld(
      event.clientX,
      event.clientY,
    );

    this.input.pointer = {
      ...point,
      inside: true,
    };

    /**
     * O NPC tem a PRIMEIRA palavra, antes do inimigo.
     *
     * O mercador e o alvo que o jogador quis mirar, e a barra de
     * pocoes dele tem 203px de altura: o raio do inimigo embaixo
     * passaria por dentro da perna do NPC e o clique abriria o
     * combate no chao em vez do painel
     *
     * O `return` e o que garante isso: um NPC sob o cursor e um NPC
     * clicado, e o inimigo mais perto nao existe para o jogador que
     * estava mirando no mercador
     */
    const npc = this.npcs.pickAt(this.world.npcs, point);

    if (npc) {
      this.onNpcClick?.(npc);
      return;
    }

    /**
     * O OUTRO JOGADOR tem a PRIMEIRA palavra, depois do NPC.
     *
     * Os remotos vivem em `world.enemies` com `isPlayer: true` e raio 12,
     * e o `find` de inimigos abaixo ENCAIXAVA NELES. Clicar num colega de
     * party abria o combate contra ele: o motor nao acha alvo valido, o
     * jogador batia em um aliado e nenhuma animacao de golpe saia
     *
     * O clique num jogador e o pedido de convite, e nao um ataque
     */
    const outroJogador = this.world.enemies.find(
      (entity) =>
        entity.isPlayer === true &&
        (entity.x - point.x) ** 2 + (entity.y - point.y) ** 2 <=
          (entity.radius + 18) ** 2,
    );

    if (outroJogador) {
      this.onPlayerClick?.(outroJogador.id, outroJogador);

      return;
    }

    const target = this.world.enemies.find(
      (enemy) =>
        enemy.alive &&
        (enemy.x - point.x) ** 2 + (enemy.y - point.y) ** 2 <=
          (enemy.radius + 18) ** 2,
    );

    const targetId = target?.id ?? null;

    // ONLINE: o clique vira um PEDIDO e quem executa e o servidor.
    //
    // Sem este desvio, o cliente rodava o golpe aqui mesmo: a
    // animacao tocava, o efeito aparecia, e nada acontecia no
    // mundo, porque o motor em modo rede nao simula. Era
    // exatamente o sintoma de "o ataque funciona e nao acerta".
    if (this.networked) {
      this.onTargetClick?.(targetId, point);
      return;
    }

    this.engageTarget(targetId);
  }

  /**
   * "Quero brigar com este alvo": marca, ataca uma vez e CONTINUA
   * avancando enquanto ele estiver vivo.
   *
   * O `engagedTargetId` e o que faz o personagem andar ate o alvo.
   * Sem ele o golpe sai parado no lugar, sem dano nenhum, porque
   * a habilidade de corpo a corpo nao alcança de longe. E o
   * caminho e o mesmo para o clique e para o comando de rede: se
   * cada um montasse o seu, o online e o offline divergiriam.
   */
  engageTarget(targetId, { atacarAgora = true } = {}) {
    this.selectedTargetId = targetId;
    this.engagedTargetId = targetId;

    if (atacarAgora) {
      this.useBasicAttack();
    }
  }

  /**
   * Aponta o alvo para um inimigo pela mira, sem marcar o
   * engagement.
   *
   * Usado pelas habilidades de area e pelo ultimate, que miram
   * onde a mira esta e nao o que foi clicado.
   */
  lookAtTarget(targetId) {
    const alvo = this.findEnemyById(targetId);

    if (!alvo) return null;

    // a mira precisa estar no ALVO, e nao onde o cliente apontou
    // na tela: o servidor nao sabe onde fica o mouse, e a
    // resolucao do cliente nao e a de ninguem mais
    this.input.pointer = {
      x: alvo.x,
      y: alvo.y,
      inside: true,
    };

    return alvo;
  }

  handleKeyDown(event) {
    /**
     * COM O FOCO NUM CAMPO, A TECLA E DO CAMPO.
     *
     * Este e o terceiro consumidor de teclado do jogo — a HUD abre
     * painel e o `GameCanvas` manda movimento — e era o unico que
     * chamava `preventDefault`. Era ele que comia a letra: com o foco
     * no campo do nome da guilda, o `A` de "Ana" era cancelado antes de
     * chegar no input, e o jogador via o boneco parado, nenhum painel
     * abrindo e o campo em branco. As outras duas guardas que eu tinha
     * feito nao davam conta, porque nenhuma delas pode falar "nao
     * cancele"
     *
     * O `preventDefault` e o `keys.add` andam juntos de proposito:
     * cancelar o evento impede o caractere de aparecer, e o `keys.add`
     * com a tecla ja pressionada no motor local-andava offline
     */
    if (digitandoEm(event)) return;

    if (CONTROLLED_CODES.has(event.code)) {
      event.preventDefault();
    }

    this.input.keys.add(event.code);

    if (event.repeat) return;

    // ONLINE, as teclas de ORDEM nao sao do motor.
    //
    // `Space`, `1`-`8`, `R` e `T` sao pedidos, e quem executa pedido e
    // o servidor. O `GameCanvas` as transforma em pacote. Se o motor
    // tambem as tratasse aqui, ele mexeria num estado local que ninguem
    // le: a `T` ligaria um auto play que so existe na tela, e o jogador
    // acharia que o botao nao fez nada.
    if (this.networked) return;

    if (event.code === "Space") {
      this.useBasicAttack();
      return;
    }

    const match = SKILL_CODE_PATTERN.exec(event.code);

    if (match) {
      this.useSkillSlot(this.skillPage * 8 + Number(match[1]));
      return;
    }

    if (event.code === "KeyR") {
      this.useUltimate();
      return;
    }

    if (event.code === "KeyT") {
      this.toggleAutoPlay();
    }
  }

  handleKeyUp(event) {
    /**
     * O `keyup` e apagado MESMO com o foco num campo.
     *
     * Apagar sempre e seguro e e a unica forma de soltar a tecla que o
     * jogador apertou antes de clicar no campo. Filtrar aqui deixaria o
     * personagem andando sozinho no single player
     */
    this.input.keys.delete(event.code);
  }

  handleBlur() {
    this.input.keys.clear();
  }

  setSkillPage(page) {
    this.skillPage = Math.max(0, page);
  }

  /**
   * Desliga o piloto SEM avisar o jogador.
   *
   * Usado quando outro auto assume o comando. Sao tres pedidos
   * diferentes - cacar perto, seguir a missao, cacar uma criatura
   * - e so um pode estar no comando. O jogador pediu o outro, entao
   * avisar "Auto play desativado" seria mentira: ele nao desativou
   * nada, o personagem so mudou de tarefa.
   *
   * Deixa `autoPlay` intacto de proposito: quem chama ja cuidou
   * desse flag.
   */
  soltarPiloto() {
    this.engagedTargetId = null;
    this.selectedTargetId = null;
    this.autoMoveDirection = null;
    this.autoFacing = null;
    this.autoWaypoint = null;
    this.autoDecisionTimer = 0;

    /**
     * A VIAGEM tambem e solta.
     *
     * Sem esta linha, desligar o piloto no meio de uma travessia
     * deixava o plano esperando: o `runTravelPlan` roda no inicio do
     * `updateAutoPlay`, que so volta a chegar nele com `isAutoActive`
     * verdadeiro — e ele nao estaria mais. O plano ficaria parado em
     * memoria ate o proximo `auto` ligado, e o jogador comecaria a
     * viagem de onde parou, sem saber por que
     */
    this.travelPlan = [];
    this.travelParado = 0;

    /**
     * O CAMINHO de perseguicao tambem e solto.
     *
     * Sem esta linha ele ficaria na sessao apontando para um alvo que o
     * jogador acabou de trocar, e o proximo `approachTarget` comecaria
     * por um `shift` em cima de um caminho de outro mob
     */
    this.cacadaCaminho = null;
    this.cacadaRelogio = 0;

    this.bestiaryTargetType = null;
  }

  setAutoPlay(enabled) {
    const next = Boolean(enabled);

    if (next === this.autoPlay) return;

    /**
     * APERTAR T LIBERTA O PERSONAGEM PARADO.
     *
     * O "parado" da chegada do follow e uma suspensao, nao uma trava: o
     * jogador apertar T e o jeito de mandar o personagem
     * andar de novo. Sem esta linha, chegar do lado de alguem deixava
     * o Auto inerte ate recarregar a pagina
     */
    if (this.world.session) {
      this.world.session.seguindoParado = false;
    }

    // O botao (e a tecla T) e o auto de CACAR PERTO. Ele nao pode
    // dividir o comando com a missao nem com o bestiario: com os
    // dois ligados, o piloto obedece ao objetivo mais especifico e
    // o botao vira um cacador que atravessa o mapa atras da zona em
    // vez de bater no mob do lado. Ligar um desliga os outros.
    //
    // O bestiario e o caso que mais escapa: `getAutoObjective` da
    // PRIORIDADE a ele, entao uma cacada de criatura que sobrevive
    // ao botao continuava mandando no piloto, e o sintoma era
    // exatamente "cliquei no auto e o personagem foi para a outra
    // zona".
    if (next) {
      this.world.quests.setAuto(false);
      this.bestiaryTargetType = null;
    }

    this.autoPlay = next;
    this.autoDecisionTimer = 0;

    // O waypoint tambem e limpo AO LIGAR.
    //
    // Ele e o ponto que o piloto estava caminhando - e, com a missao
    // no comando, era o centro da zona dela. Ligar o auto de cacar
    // perto sem limpar isso deixava o personagem apontado para a
    // zona por um tick, ate o proximo `autoPlayTarget`. Nao e um
    // tempo perceptivel, e nao explica o sintoma sozinho, mas e o
    // que faz o primeiro passo do piloto sair na direcao errada.
    this.autoWaypoint = null;
    this.engagedTargetId = null;
    this.selectedTargetId = null;
    this.autoMoveDirection = null;
    this.autoFacing = null;

    if (!next) {
      // o botao de auto e parada-mestre: se a cacada do bestiario
      // sobreviver a ele, a box continuaria mostrando AUTO sem
      // ninguem cacando. clearBestiaryAuto nao volta aqui porque
      // o alvo ja foi limpo antes.
      this.bestiaryTargetType = null;
      this.world.quests.setAuto(false);
    }

    this.showMessage(
      next
        ? "Auto play ativado."
        : "Auto play desativado.",
    );

    this.sendSnapshot();
  }

  toggleAutoPlay() {
    this.setAutoPlay(!this.autoPlay);
  }

  isAutoActive() {
    return (
      this.autoPlay ||
      this.engagedTargetId !== null ||
      this.bestiaryTargetType !== null ||
      this.getQuestObjective() !== null
    );
  }

  /**
   * o auto do bestiario e um auto dedicado a uma criatura: ele
   * vira o objetivo do piloto, entao todo o resto (escolher alvo,
   * ir ate a zona, chegar na distancia) ja funciona sem duplicar
   * nada. clicar no mesmo bicho de novo desliga.
   */
  toggleBestiaryAuto(creatureId) {
    if (this.bestiaryTargetType === creatureId) {
      return this.clearBestiaryAuto();
    }

    return this.setBestiaryAuto(creatureId);
  }

  setBestiaryAuto(creatureId) {
    const entry = getBestiaryEntry(creatureId);

    if (!entry) {
      this.showMessage(
        "Criatura desconhecida no bestiario.",
        true,
      );

      this.sendSnapshot();

      return false;
    }

    this.bestiaryTargetType = entry.creatureId;
    this.autoDecisionTimer = 0;
    this.engagedTargetId = null;
    this.selectedTargetId = null;
    this.autoWaypoint = null;

    // o bestiario assume o comando. ele e um pedido dedicado a UMA
    // criatura, e dividi-lo com o botao ou com a missao faria o
    // piloto alternar entre alvos e nao completar nenhum
    this.autoPlay = false;
    this.world.quests.setAuto(false);

    this.showMessage(
      `Auto: caçando ${entry.name}` +
        `${entry.zoneName ? ` em ${entry.zoneName}` : ""}.`,
    );

    this.sendSnapshot();

    return true;
  }

  clearBestiaryAuto() {
    if (this.bestiaryTargetType === null) return false;

    const entry = getBestiaryEntry(this.bestiaryTargetType);

    this.bestiaryTargetType = null;
    this.selectedTargetId = null;
    this.autoDecisionTimer = 0;
    this.autoWaypoint = null;

    this.showMessage(
      `Auto do bestiario desligado` +
        `${entry ? `: ${entry.name}` : ""}.`,
    );

    this.sendSnapshot();

    return true;
  }

  get isBestiaryAutoOn() {
    return this.bestiaryTargetType !== null;
  }

  bestiaryAutoSnapshot() {
    if (this.bestiaryTargetType === null) return null;

    const entry = getBestiaryEntry(this.bestiaryTargetType);

    if (!entry) return null;

    return {
      creatureId: entry.creatureId,
      name: entry.name,
      icon: entry.icon,
      color: entry.color,
      zoneId: entry.zoneId,
      zoneName: entry.zoneName,
      kills: this.world.bestiary.kills.get(entry.creatureId) ?? 0,
    };
  }

  /**
   * o objetivo que o auto segue agora. quando o bestiario esta
   * ativo ele tem prioridade sobre a missao, e usa o mesmo formato
   * { target, location } para o piloto nao saber a diferenca.
   */
  getAutoObjective() {
    if (this.bestiaryTargetType !== null) {
      const entry = getBestiaryEntry(this.bestiaryTargetType);

      if (entry) {
        return {
          target: entry.creatureId,
          location: entry.zoneId,
          summary: `Cacar ${entry.name}`,
          fromBestiary: true,
        };
      }
    }

    return this.getQuestObjective();
  }

  focusQuest(questId) {
    const quests = this.world.quests;

    const wasAuto =
      quests.autoEnabled && quests.objectiveId === questId;

    if (!quests.focusQuest(questId)) return false;

    const quest = quests.currentObjective;

    if (!isAutoCompletable(quest)) {
      this.showMessage(
        "Esta missÃ£o precisa ser feita manualmente.",
        true,
      );

      this.sendSnapshot();

      return false;
    }

    if (wasAuto) {
      quests.setAuto(false);
      quests.clearObjective();
      this.soltarPiloto();

      this.showMessage(`Auto desligado: ${quest.name}`);

      this.sendSnapshot();

      return true;
    }

    quests.setAuto(true);

    // A missao assume o comando. O botao e "cacar perto": se
    // continuasse ligado, o piloto teria dois alvos e o jogador
    // nao saberia qual dos dois o personagem estava seguindo. E o
    // `autoPlay` nao e ligado aqui de proposito: o auto da missao
    // funciona pelo objetivo dela, e nao por esse flag. Era
    // justamente por ele que apertar T no meio da missao desligava
    // o piloto e deixava a tela mostrando AUTO com o personagem
    // parado.
    this.autoPlay = false;
    this.soltarPiloto();

    this.showMessage(`Auto: ${quest.summary}`);

    this.sendSnapshot();

    return true;
  }

  toggleQuestAuto() {
    const quests = this.world.quests;
    const enabled = quests.toggleAuto();

    if (enabled) {
      const objective = quests.objective();

      if (!objective) {
        quests.setAuto(false);
        this.showMessage(
          "Nenhuma missÃ£o automÃ¡tica disponÃ­vel.",
          true,
        );

        this.sendSnapshot();

        return false;
      }

      // a missao assume o comando: o botao e a cacada do
      // bestiario saem, e o `autoPlay` nao e ligado (o auto da
      // missao funciona pelo objetivo dela)
      this.autoPlay = false;
      this.soltarPiloto();

      this.showMessage(
        `Auto: ${objective.summary}`,
      );
    } else {
      this.soltarPiloto();

      this.showMessage("Auto de missão desligado.");
    }

    this.sendSnapshot();

    return enabled;
  }

  /**
   * Liga ou desliga o automatico de UMA skill deste jogador.
   *
   * A flag vai para a sessao, nao para um store global. O painel
   * e o que devolve a lista para o HUD acender o `AUTO`, entao o
   * arrasto online tem que aparecer no proximo pacote.
   */
  setSkillAuto(skillId, enabled) {
    const sessao = this.sessaoDeJogador;

    if (!sessao) return false;

    const ligada = Boolean(enabled);

    if (ligada) {
      sessao.skillAuto.add(skillId);
    } else {
      sessao.skillAuto.delete(skillId);
    }

    this.sendSnapshot();

    return ligada;
  }

  checkEquipQuest() {
    const equipment = this.world.equipment;

    for (const item of equipment.getEquippedItems()) {
      const rarity = item?.rarity;

      if (!rarity) continue;

      this.resolveQuestProgress(
        this.world.quests.onEquipRarity(rarity),
      );
    }
  }

  acceptSideQuest(questId) {
    const accepted = this.world.quests.acceptSide(questId);

    if (!accepted) {
      this.showMessage(
        "Termine a missÃ£o secundÃ¡ria atual primeiro.",
        true,
      );

      return false;
    }

    this.showMessage(
      "MissÃ£o secundÃ¡ria aceita.",
    );

    this.sendSnapshot();

    return true;
  }

  abandonSideQuest() {
    const dropped = this.world.quests.abandonSide();

    if (dropped) {
      this.showMessage(
        "MissÃ£o secundÃ¡ria abandonada.",
      );
    }

    this.sendSnapshot();

    return dropped;
  }

  getSkillAuto(skillId) {
    return Boolean(this.sessaoDeJogador?.skillAuto?.has(skillId));
  }

  /**
   * O slot onde este item tem que entrar, ou `null`.
   *
   * O painel e o auto-equip usam este para escolher o destino, em vez
   * de varrer os slots procurando o primeiro que aceita o tipo: com
   * tres slots de armadura, o primeiro dependia da ordem do boneco
   * e nao do item
   */
  slotFor(itemId) {
    return this.world.equipment.slotForItem(itemId);
  }

  equipItem(uid, slotId) {
    const inventory = this.world.inventory;
    const equipment = this.world.equipment;

    const stack = inventory.findByUid(uid);

    if (!stack) return false;

    if (!equipment.canEquip(stack.itemId, slotId)) {
      return false;
    }

    const previous = equipment.equip(
      stack.itemId,
      slotId,
      stack.rarity,

      /**
       * O afixo da peca que ENTRA vai junto.
       *
       * Sem este quarto argumento o slot receberia `null`, e um arco
       * encantado perderia o afixo no instante em que o jogador
       * vestisse: o afixo estaria na mochila, o slot nao saberia, e o
       * painel mostraria a peca sem afixo com ela vestida
       */
      stack.enchant,
    );

    inventory.takeUid(uid, 1);

    if (previous) {
      // a peca trocada volta na MESMA raridade, senao um arco
      // lendario perderia a forca so por trocar de lugar
      inventory.add(
        previous.itemId,
        1,
        previous.rarity,
      );

      /**
       * E volta com o afixo, pela mesma razao. `add` cria uma pilha
       * nova, entao o afixo precisa ser colado na pilha recem-criada
       * logo depois — e pela MESMA chave `uid`, e nao por `itemId`:
       * duas pecas iguais na mesma raridade sao pilhas diferentes, e
       * procurar por `itemId` pegaria a primeira e trocaria o afixo
       * entre elas
       */
      const devolvida = inventory.findStack(
        previous.itemId,
        previous.rarity,
      );

      if (devolvida && previous.enchant) {
        devolvida.enchant = previous.enchant;
      }
    }

    this.applyEquipment();
    this.checkEquipQuest();
    this.sendSnapshot();

    return true;
  }

  /**
   * USA um item consumivel da mochila: a pocao de cura, por enquanto.
   *
   * E o caminho de uso, e nao um caso particular da pocao. O
   * catalogo diz O QUE o item faz (`use: { heal: 120 }`) e este
   * metodo aplica qualquer efeito declarado ali. Uma pocao de mana
   * entra acrescentando `restoreResource`, e um item que da dano
   * pessoal entra com `heal` negativo — sem tocar neste arquivo de
   * novo
   *
   * ## A POCAO NAO E GASTA COM VIDA CHEIA
   *
   * O `heal` devolve quanto curou, e o `0` e a condicao de recusa.
   * Sem isso, beber a ultima pocao em vida cheia daria `+0`, apagaria
   * da mochila e nao curaria nada — o pior resultado possivel, porque
   * o jogador perdeu o item E nao ganhou nada. E o jogador precisa
   * poder Falhar aqui de proposito, e nao por acidente
   *
   * ## O EFEITO PRECISA VALER ALGO ANTES DE GASTAR
   *
   * O item sai da mochila so depois do efeito. Inverter a ordem
   * cobraria o jogador por uma pocao que nao curou, e no online o
   * erro apareceria como um item a menos sem causa
   */
  usarItem(uid) {
    const inventory = this.world.inventory;

    const stack = inventory.findByUid(uid);

    if (!stack) return false;

    const definition = getItem(stack.itemId);

    /**
     * Item sem `use` nao e consumivel, e nao ha o que aplicar.
     *
     * O `equipItem` tambem recusa item que nao serve no slot, e pelo
     * mesmo motivo: a acao foi pedida para um item que nao admite ela,
     * e o certo e recusar em vez de gastar o item
     */
    if (!definition?.use) return false;

    /**
     * O jogador local e `world.player`, e nao `sessaoDeJogador`.
     *
     * `sessaoDeJogador` e a sessao com os INTENTS (alvo, auto-play,
     * waypoint) e pode nao existir em rede, onde o cliente nao e dono
     * da sessao. `world.player` e quem o `heal` ja cura no regeneracao,
     * entao e o mesmo objeto que a barra de vida da tela mostra
     */
    const jogador = this.world.player;

    if (!jogador) return false;

    let aplicou = false;

    for (const [efeito, valor] of Object.entries(definition.use)) {
      if (efeito === "heal") {
        /**
         * Soma o que cada efeito devolveu.
         *
         * Um item com dois efeitos (curar e curar recurso) precisa
         * CONSUMIR se um deles funcionou. Com um `if` por efeito e
         * `aplicou = true` em ambos, isso vem natural; com um `if` por
         * efeito assignando direto, o segundo efeito apagaria o
         * primeiro e o item sumiria sem curar
         */
        const curado = this.damage.heal(jogador, valor);

        if (curado > 0) aplicou = true;
      } else {
        /**
         * Efeito declarado e nao implementado.
         *
         * Fica visivel de proposito: e melhor um efeito que nao faz
         * nada do que um item que nao se consome e nao avisa. Um
         * `throw` aqui derrubaria o turno por causa de um item
         *catalogo, e um `continue` calado deixaria o jogador preso
         * com uma pocao que nao bebe
         */
        console.warn(
          `[usarItem] efeito desconhecido: ${efeito} em ${stack.itemId}`,
        );
      }
    }

    if (!aplicou) return false;

    inventory.takeUid(uid, 1);

    this.sendSnapshot();

    return true;
  }

  unequipItem(slotId) {
    const equipment = this.world.equipment;

    const previous = equipment.unequip(slotId);

    if (!previous) return false;

    const result = this.world.inventory.add(
      previous.itemId,
      1,
      previous.rarity,
    );

    /**
     * A peca desvestida volta com o afixo, e ele e lido do `previous`
     * e nao do slot: o `unequip` ja devolveu a peca inteira e limpou o
     * slot, entao o `add` comecou do zero. Sem esta linha, tirar uma
     * arma da mao apagaria o encantamento dela
     */
    const devolvida = this.world.inventory.findStack(
      previous.itemId,
      previous.rarity,
    );

    if (devolvida && previous.enchant) {
      devolvida.enchant = previous.enchant;
    }

    this.applyEquipment();
    this.sendSnapshot();

    return result.added > 0;
  }

  /**
   * ENCANTA uma peca da mochila.
   *
   * Sorteia o stat e a raridade, cobra o ouro e troca o afixo da peca.
   * O afixo ANTERIOR e perdido de proposito: encantar e um reroll com
   * preco, e guardar os dois deixaria o jogador com duas colunas de
   * bonus no mesmo item sem nenhum motivo
   *
   * Devolve `{ ok, enchant }` e nao um `boolean`, porque o painel
   * precisa saber QUAL afixo saiu para mostrar o resultado. Um
   * `boolean` obrigaria o painel a sortear de novo para exibir, e o
   * que ele mostraria nao seria o que o jogador comprou
   *
   * A peca precisa estar na MOCHILA. Encantar algo vestido exigiria o
   * motor de guardar e restaurar o item ao trocar de slot, e o painel
   * mostraria um boneco com a peca "saindo" no meio do sorteio — o
   * jogador perderia a referencia de onde estava a peca
   */
  enchantItem(uid) {
    const inventory = this.world.inventory;
    const stack = inventory.findByUid(uid);

    if (!stack) {
      return { ok: false, reason: "Item não encontrado." };
    }

    return this.aplicarEncantamento({
      itemId: stack.itemId,
      rarity: stack.rarity,
      gravar: (enchant) => {
        stack.enchant = enchant;
      },
    });
  }

  /**
   * ENCANTA a peca VESTIDA de um slot.
   *
   * O painel mostra a mochila E o que esta no corpo, e sem este metodo
   * o jogador veria a armadura na lista e nao conseguiria encantar sem
   * antes tira-la das costas
   *
   * E o mesmo sorteio do `enchantItem`, com o preco e a validacao
   * compartilhados: os dois caminhos passam por `aplicarEncantamento`,
   * e nao por duas copias da mesma regra. Se o custo ou a recusa
   * divergissem entre os dois, o jogador veria um preco na caixa da
   * esquerda e pagaria outro
   *
   * `trinket1` e `trinket2` sao recusados: nao ha item de reliquia no
   * catalogo hoje, e o pedido foi arma e armadura. O `canEnchantItem`
   * e quem decide, e ele le o TIPO do item
   */
  enchantSlot(slotId) {
    const slot = this.world.equipment.getSlot(slotId);

    if (!slot?.itemId) {
      return { ok: false, reason: "Slot vazio." };
    }

    return this.aplicarEncantamento({
      itemId: slot.itemId,
      rarity: slot.rarity,
      gravar: (enchant) => {
        this.world.equipment.setSlotEnchant(slotId, enchant);
      },
    });
  }

  /**
   * O comum dos dois caminhos de encantar.
   *
   * Sorteia, cobra e devolve o resultado. O que muda entre a mochila e
   * o slot e SO onde o afixo e gravado, e e por isso que isso vem como
   * `gravar` e nao como um `if` dentro do metodo
   *
   * A ordem e importante: o preco e conferido ANTES do sorteio. Sortear
   * e de graca, entao sortear antes de saber se o jogador pode pagar
   * seria jogar fora o resultado e dar ao jogador a ilusao de que o
   * proximo vai sair diferente
   */
  aplicarEncantamento({ itemId, rarity, gravar }) {
    const inventory = this.world.inventory;

    if (!canEnchantItem(itemId)) {
      return {
        ok: false,
        reason: "Só arma e armadura podem ser encantadas.",
      };
    }

    const custo = enchantCost(itemId, rarity);

    if (inventory.coins < custo) {
      return {
        ok: false,
        reason: `Ouro insuficiente: ${custo} necessários.`,
      };
    }

    const enchant = rollEnchant(itemId);

    if (!enchant) {
      return { ok: false, reason: "Encantamento indisponível." };
    }

    inventory.spendCoins(custo);

    gravar(enchant);

    this.applyEquipment();
    this.sendSnapshot();

    return { ok: true, enchant, custo };
  }

  /**
   * Tira do corpo as pecas vestidas na posicao errada.
   *
   * A peca volta para a mochila, e NAO e vestida no slot certo: quem
   * pediu foi "desequipar o que esta no lugar errado", e mover
   * sozinho seria decisao do jogador. A peca sai do corpo, ele ve o
   * que aconteceu e veste o que quiser
   *
   * A raridade volta junto, como em todo desequipar. Perder a variante
   * ao abrir o inventario seria o pior resultado possivel para uma
   * correcao automatica: o jogador fechava o painel e tinha menos
   * poder do que antes, sem ter clicado em nada
   *
   * Existe por causa dos saves antigos. Antes de a peca declarar
   * posicao, `head`, `chest` e `legs` aceitavam qualquer `ARMOR`, e o
   * jogo gravava no arquivo o que o jogador vestiu. Quem tinha um
   * capuz no peito continua com ele no arquivo, e nenhuma regra de
   * `equip` corrigiria isso sozinha: ela so roda quando o jogador
   * veste alguma coisa
   */
  fixMisplacedEquipment() {
    const equipment = this.world.equipment;
    const inventory = this.world.inventory;

    const errados = equipment.misplacedSlots();

    if (errados.length === 0) return [];

    const movidos = [];

    for (const slotId of errados) {
      const peca = equipment.unequip(slotId);

      if (!peca) continue;

      const resultado = inventory.add(
        peca.itemId,
        1,
        peca.rarity,
      );

      const item = getItem(peca.itemId);

      // a peca so volta a ficar vestida se a mochila estiver cheia. Com
      // a mochila cheia o `add` devolve 0, e a peca nao pode sumir: ela
      // volta para o MESMO slot, que e o melhor destino que existe
      // quando nao ha lugar na mochila. Antes era esse o destino de
      // qualquer desequipar, entao nada se perde
      if (resultado.added === 0) {
        // `equip` nao serve aqui: ele recusa pela MESMA regra que
        // detectou o erro, e a peca nunca voltaria. `restore` ignora
        // a checagem de posicao, que e justamente o que este metodo
        // existe para desfazer
        equipment.restore(peca, slotId);
      }

      movidos.push({
        itemId: peca.itemId,
        rarity: peca.rarity,
        name: item?.name ?? peca.itemId,
        slotId,
      });
    }

    if (movidos.length > 0) {
      this.applyEquipment();
      this.sendSnapshot();
    }

    return movidos;
  }

  /** remove a peÃ§a do inventÃ¡rio sem qualquer contrapartida */
  discardItem(uid, count = Number.POSITIVE_INFINITY) {
    const taken = this.world.inventory.takeUid(uid, count);

    if (!taken) return false;

    const name = getItem(taken.itemId)?.name ?? taken.itemId;

    this.showMessage(
      `${taken.count}x ${name} descartado.`,
    );

    this.sendSnapshot();

    return true;
  }

  /** tira a peca do corpo e some com ela */
  discardEquipped(slotId) {
    const equipped = this.world.equipment.getEquipped(slotId);

    if (!equipped) return false;

    // a peca vestida NUNCA esta na mochila: ela foi retirada de
    // la ao equipar. So tirar do slot ja a destroi, e pulling da
    // bolsa aqui apagaria uma copia diferente da que estava no
    // corpo.
    const previous = this.world.equipment.unequip(slotId);

    if (!previous) return false;

    this.applyEquipment();
    this.checkEquipQuest();
    this.showMessage(`${equipped.name} descartado.`);
    this.sendSnapshot();

    return true;
  }

  /**
   * Aplica o filtro de coleta do jogador em FOCO.
   *
   * O filtro e POR JOGADOR e mora na sessao. Antes ele era um campo
   * do motor, e ai estavam os dois defeitos de uma vez: online o
   * clique mudava o filtro do cliente, que nao decide loot nenhum, e
   * o filtro do servidor valia para todo mundo no mapa.
   *
   * O `saveLootFilter` (localStorage) e so do single player: online o
   * dono do filtro e o servidor, e a sessao dele e a copia que vale.
   */
  setLootFilter(filter) {
    const normalizado = normalizeLootFilter(filter);
    const sessao = this.world.session;

    if (!sessao) {
      // sem sessao em foco nao ha a quem aplicar. O caminho offline
      // sempre tem uma, entao este e o caso de seguridad
      return null;
    }

    sessao.lootFilter = normalizado;

    // so o drop DESTE jogador e podado: o filtro de um nao pode
    // apagar o loot de outro que esteja no chao ao lado
    const removed = this.loot.pruneDrops(
      normalizado,
      sessao.id,
    );

    if (removed > 0) {
      this.showMessage(
        `${removed} no chao descartado(s) pelo filtro.`,
      );
    }

    this.sendSnapshot();

    return normalizado;
  }

  /** o filtro de coleta do jogador em foco */
  filtroDoJogador() {
    return this.world.session?.lootFilter ?? null;
  }

  /** limpa a mochila o que o filtro reprova */
  pruneInventory() {
    const inventory = this.world.inventory;
    const filtro = this.filtroDoJogador();
    let removed = 0;

    for (let index = inventory.stacks.length - 1; index >= 0; index -= 1) {
      const stack = inventory.stacks[index];

      if (isCollectedId(stack.itemId, filtro)) {
        continue;
      }

      // A pilha INTEIRA, e nao um item. O `takeUid` tira uma unidade
      // por padrao, entao sem a quantidade o "Limpar mochila" apagava
      // um de cada pilha e deixava o resto
      const taken = inventory.takeUid(stack.uid, stack.count);

      removed += taken?.count ?? 0;
    }

    if (removed > 0) {
      this.showMessage(
        `${removed} item(ns) da mochila descartado(s).`,
      );
      this.sendSnapshot();
    }

    return removed;
  }

  lootFilterSummary() {
    const filtro = this.filtroDoJogador();

    return {
      ...(filtro ?? {}),
      label: describeFilter(filtro),
    };
  }

  autoEquipBest() {
    const inventory = this.world.inventory;
    const equipment = this.world.equipment;

    let changed = false;

    for (const slot of equipment.getSlots()) {
      let best = null;
      let bestScore = -Infinity;

      for (const stack of inventory.stacks) {
        // o TIPO nao basta: os tres slots de armadura aceitam
        // `ARMOR`, ento so o tipo deixava o auto-equip trocar o
        // capuz pela bota, pois os dois cabiam em qualquer um dos tres
        if (!equipment.slotAccepts(slot.id, stack.itemId)) {
          continue;
        }

        const item = getItem(stack.itemId);

        if (!item) continue;

        // o score e o valor NA raridade da variante, senao um arco
        // comum e um lendario empatariam no catalogo
        const score = valueAt(stack.itemId, stack.rarity);

        if (score > bestScore) {
          bestScore = score;
          best = stack;
        }
      }

      if (!best) continue;

      if (equipment.slotAccepts(slot.id, best.itemId)) {
        changed = this.equipItem(best.uid, slot.id) || changed;
      }
    }

    if (changed) {
      this.showMessage("Equipamento ajustado.");
    }

    return changed;
  }

  /**
 * Os BONUS dos talentos da guilda deste jogador.
 *
 * Objeto vazio sem store ou sem guilda, e nao `null`: o `mergeBonuses`
 * soma os termos, e um `null` aqui viraria um `undefined` na conta
 * dentro do `applyEquipment`
 *
 * Os talentos sao DA GUILDA e nao do jogador — e o desenho de "todo
 * mundo ajuda". Quem destrava gasta o ponto DELE, e o bonus vale para
 * todos os membros
 */
guildBonuses() {
  if (!this.guildStore) return {};

  const guilda = this.guildStore.guildaDoJogador(
    chaveDaSessao(this.world.session),
  );

  if (!guilda) return {};

  return talentBonuses(guilda.talentos);
}

  applyEquipment() {
    const player = this.world.player;
    const stats = player.definition.stats;
    const growth = statsForLevel(player.level ?? 1);

    // equipamento, bestiario, colecao e guilda no mesmo pipeline. As
    // quatro fontes somam como se fossem item vestida, entao precisam
    // ser SOMADAS por stat: um spread sobrescreveria o maxHp do
    // equipamento com o do bestiario.
    //
    // O quarto termo e o AFIXO das pecas vestidas. Ele e a FRACAO do
    // stat base multiplicada pela base, e nao um valor da peca: por
    // isso recebe `stats`, e nao o jogador. Passar o jogador inteiro
    // faria o afixo crescer com o proprio bonus — `speed` viraria uma
    // corrida de 2%, 2.04%, 2.08%
    //
    // A GUILDA e o quinto. E o unico termo que vem de um estado
    // COMPARTILHADO, e nao da sessao: os talentos destravados sao da
    // guilda, entao os dois jogadores da mesma guilda veem o mesmo
    // bonus. E por isso que ele precisa do store para ser lido
    const bonus = mergeBonuses(
      this.world.equipment.bonuses(),
      this.world.equipment.enchantBonuses(stats),
      this.world.bestiary.bonuses(),
      this.world.collection.bonuses(),
      this.guildBonuses(),
    );

    const maxHp =
      stats.hp + growth.maxHp + (bonus.maxHp ?? 0);

    const previousMax = player.maxHp;

    player.maxHp = maxHp;
    player.maxResource =
      stats.resource + (bonus.resource ?? 0);

    player.attack =
      stats.attack + growth.attack + (bonus.attack ?? 0);
    player.defense =
      stats.defense +
      growth.defense +
      (bonus.defense ?? 0);
    player.speed = stats.speed + (bonus.speed ?? 0);
    player.range = stats.range;

    player.attackSpeedBonus = bonus.attackSpeed ?? 0;
    player.resourceRegenBonus =
      bonus.resourceRegen ?? 0;

    if (maxHp > previousMax) {
      player.hp += maxHp - previousMax;
    }

    player.hp = Math.max(
      0,
      Math.min(player.hp, player.maxHp),
    );

    player.resource = Math.max(
      0,
      Math.min(player.resource, player.maxResource),
    );

    /**
     * A FOLHA DE STATS do personagem, recalculada junto com tudo.
     *
     * Ela entra no MESMO ponto do pipeline dos outros stats, e nao em
     * um `sendSnapshot` avulso: a folha le os numeros que acabaram de
     * ser definidos, entao uma peca vestida ou uma cacada fechada
     * aparece no painel no mesmo quadro em que muda o combate. Ler a
     * folha em outro lugar daria uma tela que concorda com o
     * personagem com um pacote de atraso
     *
     * Os cinco stats que o MOTOR calcula sao passados de volta para a
     * folha como `atuais`. E o que garante que o ATK da tela seja o
     * `player.attack` deste exato quadro, e nao uma segunda conta da
     * mesma formula feita em outro lugar
     */
    player.stats = buildStatSheet(
      player.definition,
      player.level ?? 1,
      bonus,
      player,
    );

    /**
     * PRECISAO e ESQUIVA viram campos do jogador, e nao so da tela.
     *
     * Eles eram calculados aqui, mostrados no painel, e lidos em lugar
     * nenhum: subir de DEX aumentava "Precisao" na tela e nao mudava
     * o combate em nada. Sao eles que decidem se um golpe passa batido
     * (`game/combat/Chance.js`), e o combate so enxerga o que esta
     * no objeto
     *
     * Sao lidos da folha que acabamos de refazer, e nao recalculados
     * aqui: duas contas da mesma formula divergem, e a divergencia
     * apareceria como "a tela diz 84 e o combate usa 79"
     */
    player.accuracy =
      statValueOf(player.stats, "accuracy") ?? 0;

    /**
     * A ESQUIVA e uma FRACAO, e nao um numero como a precisao.
     *
     * A diferenca vem do `StatSheet` e e de proposito: 0.055 e "5,5% de
     * chance de errar", e nao "0,055 de defesa". Misturar as duas
     * unidades aqui transformaria o miss em quase zero
     */
    player.evasion =
      statValueOf(player.stats, "evasion") ?? 0;
  }

  useSkillSlot(slot) {
    // a classe do jogador em foco, e nao a do motor: ver
    // `classeDoJogador`. um Arbalist no servidor usaria as
    // habilidades do Warrior sem isto
    const action = this.classeDoJogador.skills[slot - 1];

    if (!action) return false;

    return this.skillSystem.request(
      action,
      this.input.pointer,
      this.selectedTargetId,
    );
  }

  useSkill(index) {
    return this.useSkillSlot(index + 1);
  }

  useUltimate() {
    return this.skillSystem.request(
      this.classeDoJogador.ultimate,
      this.input.pointer,
      this.selectedTargetId,
    );
  }

  /**
   * O MAPA ACEITA GOLPE?
   *
   * A base e o hub, e la nao ha inimigo. O basico nao PRECISA de um alvo
   * valido para sair: `skillSystem.request` so precisa da DIRECAO da
   * mira, entao ele dispara em pleno chao vazio, a animacao da espada
   * varre o piso e nenhum dano acontece. Era o que o jogador via na base
   *
   * A pergunta e do MAPA e nao do ALVO. Um inimigo embaixo do cursor nao
   * muda nada, porque o inimigo nao existe na base — e o caminho do
   * `targetId` nem passa por aqui, entao perguntar pelo alvo deixaria o
   * basico destravado justamente no mapa onde ele nao tem para quem
   * acertar
   */
  emZonaDeCombate() {
    return this.world.map?.id !== "base";
  }

  useBasicAttack() {
    /**
     * O portao do hub.
     *
     * O `return false` ANTES do `request` e o que importa: pedir o golpe e
     * o que comeca a animacao e a contagem de recarga. Barrar depois
     * deixaria o jogador gastando recarga num golpe que nao aconteceu, e
     * o proximo ataque no vale sairia mais fraco sem ele saber por que
     */
    if (!this.emZonaDeCombate()) return false;

    return this.skillSystem.request(
      this.classeDoJogador.basicAttack,
      this.input.pointer,
      this.selectedTargetId,
    );
  }

  /**
   * O aviso de tela do jogador em foco.
   *
   * Fica NA SESSAO, e nao no motor. Com uma pessoa nao faz
   * diferenca nenhuma; online, um campo do motor e lido por todos os
   * paineis, entao o "+16 moedas" da Ana aparecia na tela do Bento
   * tambem -- e parecia que a recompensa tinha ido para os dois.
   *
   * O que decide a recompensa e o dono do abate, em `handleKill`.
   * Aqui so decide para QUEM o aviso e escrito.
   */
  showMessage(text, bad = false) {
    const sessao = this.world.session;

    // sem sessao em foco nao ha a quem mostrar. Perder um aviso e
    // melhor do que inventionar um dono: o painel de todo mundo
    // leria `null` e nao mostraria nada
    if (!sessao) return;

    const agora = this.world.time;

    // DOIS avisos no mesmo instante nao podem se comer. Fechar uma
    // cacada e subir de nivel acontecem no mesmo abate, e o segundo
    // `showMessage` apagava o primeiro: o jogador fechava a cacada e
    // so via "Nivel 2 alcancado", sem a recompensa que ele acabara
    // de ganhar. Aqui eles viram uma linha so, na ordem em que
    // aconteceram
    if (sessao.message && sessao.messageTick === agora) {
      sessao.message = {
        text: `${sessao.message.text}  ·  ${text}`,
        bad: sessao.message.bad || bad,
      };
    } else {
      sessao.message = { text, bad };
    }

    sessao.messageTick = agora;
    sessao.messageRemaining = 2.5;
  }

  /**
   * Consome os ingredientes e cria o item. A falha nunca sai pela
   * metade: ou a receita fecha inteira, ou nada muda na mochila.
   */
  craftItem(recipeId, rarity = null) {
    const result = this.world.craft.craft(
      this.world.inventory,
      recipeId,
      this.world.player.classId,
      rarity,
    );

    if (!result.ok) {
      this.showMessage(
        this.craftFailureMessage(result),
        true,
      );

      this.sendSnapshot();

      return false;
    }

    const item = getItem(result.recipe.itemId);
    const style = RARITY_STYLE[result.variant?.rarity];

    this.showMessage(
      `${item?.name ?? result.recipe.itemId} criado${
        style ? ` (${style.label})` : ""
      }.`,
    );

    this.sendSnapshot();

    return true;
  }

  /**
   * Entrega uma COLECAO.
   *
   * A entrega e a unica acao do jogo que tira item do jogador sem
   * dar nada em troca imediato: o material vai embora e a recompensa
   * entra em `pending` no `Collection`. Por isso a recompensa so e
   * creditada aqui, e nunca dentro do `deliver` — a ordem e
   *consumir, creditar, avisar, e o credito nunca pode perder o
   * material ja consumido
   *
   * Devolve `true` so quando a entrega aconteceu. O painel so usa
   * isso para saber se vale mandar o snapshot; a recusa vem no
   * `snapshot` seguinte, com o que falta
   */
  deliverCollection(collectionId) {
    const resultado = this.world.collection.deliver(
      collectionId,
      this.world.inventory,
      this.world.equipment,
    );

    if (!resultado.ok) {
      this.showMessage(this.collectionFailureMessage(resultado), true);
      this.sendSnapshot();

      return false;
    }

    /**
     * A ENTREGA SOMA O BONUS, e o bonus entra no personagem.
     *
     * O `deliver` ja somou no `collection.bonus`, e e o
     * `applyEquipment` abaixo que leva esse bonus para o jogador. A
     * ordem importa: sem ele, o painel mostraria a colecao como
     * entregue e os stats ainda sem o valor novo, no exato instante em
     * que o jogador olha para os dois
     */
    this.applyEquipment();

    this.showMessage(
      `Colecao entregue: ${resultado.collection.name}. ` +
        describeStatBonus(resultado.reward),
    );

    this.sendSnapshot();

    return true;
  }

  /** o texto de uma entrega recusada, naming o que falta */
  collectionFailureMessage(resultado) {
    if (resultado.reason === COLLECTION_RESULT.DONE) {
      return "Essa colecao ja foi entregue.";
    }

    if (resultado.reason === COLLECTION_RESULT.UNKNOWN) {
      return "Colecao inexistente.";
    }

    if (resultado.reason === COLLECTION_RESULT.MISSING) {
      const faltam = (resultado.faltam ?? [])
        .map((falta) => `${falta.falta}x ${falta.label}`)
        .join(", ");

      return `Falta material: ${faltam}.`;
    }

    return "Nao foi possivel entregar a colecao.";
  }

  /** o painel da colecao, com o que falta em cada uma */
  collectionSnapshot() {
    if (!this.world.collection) {
      return {
        entries: [],
        completed: 0,
        total: 0,
        isComplete: false,
        bonuses: {},
      };
    }

    return this.world.collection.snapshot(
      this.world.inventory,
      this.world.equipment,
    );
  }

  /** o painel do craft, ja filtrado pela classe do jogador */
  craftSnapshot() {
    return this.world.craft.snapshot(
      this.world.inventory,
      this.world.player.classId,
    );
  }

  craftFailureMessage(result) {
    if (result.reason === CRAFT_RESULT.LOCKED) {
      const allowed =
        this.world.craft
          .allowedClassesOf(result.recipe)
          .join(", ");

      return `Sua classe nao cria essa arma. Quem cria: ${
        allowed || "ninguem"
      }.`;
    }

    if (result.reason === CRAFT_RESULT.COINS) {
      return "Moedas insuficientes para essa receita.";
    }

    if (result.reason === CRAFT_RESULT.FULL) {
      return "Mochila cheia: libere um slot para criar o item.";
    }

    if (result.reason === CRAFT_RESULT.UNKNOWN) {
      return "Receita desconhecida.";
    }

    return "Faltam materiais para essa receita.";
  }

  /**
   * Devolve um inimigo morto a vida.
   *
   * Fica num metodo so porque o estado de "morto" tem varias
   * partes: `alive`, `hp`, os efeitos, o push e o `rewardGranted`.
   * Cada um desses e lido em um lugar diferente da simulacao, e
   * esquecer de limpar um deles em um dos caminhos de ressurreicao
   * (o respawn automatico e o reset manual) produz um mob que
   * parece vivo mas nunca mais da loot, sem nenhum erro no
   * console.
   */
  reviveEnemy(enemy) {
    enemy.hp = enemy.maxHp;
    enemy.alive = true;
    enemy.respawnTimer = 0;
    enemy.statusEffects = [];
    enemy.pushVelocity = { x: 0, y: 0 };
    enemy.hitFlash = 0;
    enemy.aiState = "idle";
    enemy.alerted = false;
    enemy.provoked = false;
    enemy.wanderTarget = null;
    // o proximo abate deste mob precisa poder ser premiado de
    // novo, e o loot do ciclo anterior nao pode sobrar para
    // informar quem matou da proxima vez
    enemy.rewardGranted = false;
    enemy.lastHitBy = null;

    return enemy;
  }

  findEnemyById(id) {
    if (id === null || id === undefined) {
      return null;
    }

    return (
      this.world.enemies.find(
        (enemy) => enemy.id === id && enemy.alive,
      ) ?? null
    );
  }

  getQuestObjective() {
    return this.world.quests.objective();
  }

  getQuestZone(quest) {
    if (!quest?.location) return null;

    return getZoneById(quest.location);
  }

  pickAutoTarget() {
    const objective = this.getAutoObjective();
    const player = this.world.player;
    const leash = this.autoLeashRange;

    const zone = this.getQuestZone(objective);

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      if (!enemy.isCreature) continue;

      if (
        objective?.target &&
        enemy.id.replace(/_\d+$/, "") !==
          objective.target
      ) {
        continue;
      }

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const squared = dx * dx + dy * dy;

      if (zone) {
        const inside =
          enemy.x >= zone.x &&
          enemy.x <= zone.x + zone.width &&
          enemy.y >= zone.y &&
          enemy.y <= zone.y + zone.height;

        if (!inside) continue;
      } else if (squared > leash * leash) {
        continue;
      }

      if (squared < bestDistance) {
        bestDistance = squared;
        best = enemy;
      }
    }

    if (best) return best;

    if (zone) return null;

    return this.pickNearestCreature();
  }

  pickNearestCreature() {
    const player = this.world.player;
    const leash = this.autoLeashRange;

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const squared = dx * dx + dy * dy;

      if (squared > leash * leash) continue;

      if (squared < bestDistance) {
        bestDistance = squared;
        best = enemy;
      }
    }

    return best;
  }

  autoPlayTarget() {
    const objective = this.getAutoObjective();
    const target = this.pickAutoTarget();

    if (target) return target;

    const destino = this.destinoDoObjetivo();

    if (!destino) return null;

    /**
     * O objetivo esta em OUTRO MAPA.
     *
     * Aqui nao ha nada a fazer, e e o que a `runTravelPlan` resolve
     * antes deste metodo ser chamado. A guarda existe porque este
     * metodo tambem e chamado de fora do ciclo do piloto — e o sintoma
     * de nao ter a guarda era o pior possivel: um waypoint para uma
     * coordenada de outro mapa, com o boneco andando contra a borda do
     * mapa atual ate o auto ser desligado a mao
     */
    if (destino.mapId !== this.world.map.id) return null;

    const zona = destino.zone;

    if (this.reachedQuestZone(zona)) return null;

    return {
      x: destino.x,
      y: destino.y,
      isWaypoint: true,
    };
  }

  reachedQuestZone(zone) {
    const player = this.world.player;

    return (
      player.x >= zone.x &&
      player.x <= zone.x + zone.width &&
      player.y >= zone.y &&
      player.y <= zone.y + zone.height
    );
  }

  canAutoUse(action) {
    if (!action) return false;

    const player = this.world.player;

    if (player.hp <= 0) return false;
    if (player.cast) return false;

    if (!this.statuses.canCastSkill(player)) {
      return false;
    }

    if ((player.cooldowns[action.id] ?? 0) > 0) {
      return false;
    }

    const reserve =
      this.classeDoJogador.basicAttack.resourceCost ?? 0;

    return (
      player.resource >= action.resourceCost + reserve
    );
  }

  isAutoInRange(action, targetDistance) {
    switch (action.type) {
      case "self":
        return true;

      case "circle":
        return targetDistance <= (action.radius ?? 0) + 40;

      case "dash":
        return targetDistance <= (action.distance ?? 0);

      default:
        return targetDistance <= (action.range ?? 0);
    }
  }

  findAutoAction(targetDistance, filter, score) {
    let best = null;
    let bestScore = -Infinity;

    const candidates = this.autoActions;

    for (const action of candidates) {
      if (!action) continue;

      if (
        action !== this.autoBasicAction &&
        !this.getSkillAuto(action.id)
      ) {
        continue;
      }

      if (!filter(action)) continue;
      if (!this.canAutoUse(action)) continue;
      if (!this.isAutoInRange(action, targetDistance)) {
        continue;
      }

      const value = score(action);

      if (value > bestScore) {
        bestScore = value;
        best = action;
      }
    }

    return best;
  }

  chooseAutoAction(targetDistance) {
    const player = this.world.player;

    const lowHealth =
      player.hp <= player.maxHp * AUTO_LOW_HEALTH;

    if (lowHealth) {
      const defensive = this.findAutoAction(
        targetDistance,
        (action) =>
          (action.healing ?? 0) > 0 ||
          (action.shield ?? 0) > 0,
        (action) =>
          (action.healing ?? 0) +
          (action.shield ?? 0) * 2 +
          (action.restoreResource ?? 0) * 0.5,
      );

      if (defensive) return defensive;
    }

    return this.findAutoAction(
      targetDistance,
      (action) =>
        (action.damage ?? 0) > 0 ||
        (action.healing ?? 0) > 0 ||
        (action.shield ?? 0) > 0 ||
        (action.restoreResource ?? 0) > 0 ||
        (action.selfEffects ?? []).length > 0,
      (action) =>
        (action.damage ?? 0) +
        (action.hits ?? 1) * 0.5 +
        (action.lifesteal ?? 0) * 40,
    );
  }

  getAutoDesiredRange() {
    const basic = this.classeDoJogador.basicAttack;

    return Math.max(
      55,
      (basic.range ?? 100) * 0.7,
    );
  }

  updateAutoPlay(deltaTime) {
    this.autoMoveDirection = null;
    this.autoFacing = null;

    if (!this.isAutoActive()) {
      this.autoWaypoint = null;
      this.travelPlan = [];
      this.travelParado = 0;

      return;
    }

    const player = this.world.player;

    if (player.hp <= 0) return;

    if (this.engagedTargetId !== null) {
      this.autoWaypoint = null;
      this.travelPlan = [];
      this.runEngagedTarget(player);
      return;
    }

    /**
     * A VIAGEM tem a PRIMEIRA palavra sobre o piloto.
     *
     * Antes do piloto, e nao depois: enquanto o objetivo esta em outro
     * mapa, qualquer coisa que o `runAutoHunt` fizesse seria andar
     * na direcao errada. Ele receberia a zona como waypoint, a zona
     * estaria a tres mil pixels e meio mapa longe, e o boneco iria
     * contra a borda do hub ate o auto ser desligado a mao
     *
     * E o `return` logo depois e o que impede o `runAutoHunt` de
     * sobrescrever o waypoint da viagem com o `autoPlayTarget`: os dois
     * escrevem no mesmo campo, e quem escreve por ultimo ganha
     */
    if (this.runTravelPlan(deltaTime, player)) return;

    /**
     * CHEGOU DO LADO E FICOU PARADO.
     *
     * O pedido foi: seguir, e ao chegar ficar parado no ponto final. O
     * `autoPlay` desligado sozinho NAO basta: o auto da missao e o do
     * bestiario continuam valendo em `getAutoObjective`, e no quadro
     * seguinte ao da chegada o `runAutoHunt` recebia a vez e ia bater no
     * mob mais proximo — o mesmo sintoma de antes, so que um quadro
     * depois
     *
     * Este flag e o que segura o personagem no ponto final. Ele some
     * quando o jogador manda alguma coisa: apertar T, ligar a cacada, ou
     * clicar num mob
     */
    if (this.world.session?.seguindoParado && !this.world.session?.focarLider) {
      return;
    }

    // O piloto roda por ter um OBJETIVO, nao pelo `autoPlay`.
    //
    // O `autoPlay` e so o botao de cacar perto. O auto da missao e
    // o do bestiario tem objetivo proprio, e e o objetivo que diz o
    // que fazer. Quando o piloto era ligado so pelo `autoPlay`,
    // apertar T no meio de uma missao desligava o piloto sem
    // desligar a missao: a tela dizia AUTO e o personagem ficava
    // parado.
    if (this.getAutoObjective() !== null || this.autoPlay || this.focoDoLiderAtivo()) {
      this.runAutoHunt(deltaTime, player);
    }
  }

  /**
   * A GRADE de navegacao do mapa atual, montada uma vez por mapa.
   *
   * O cache e um campo so, e nao um `Map` por id, porque ele e
   * invalidado no `setMap` — que e a unica hora em que o mapa muda.
   * Guardar duas grades ao mesmo tempo custaria 15 mil celulas do outro
   * mapa sem ninguem pedir
   *
   * E o cache NAO e de modulo porque a grade depende do
   * `CollisionSystem`, e o colisor muda com o mapa e com os NPCs
   * bloqueantes. Um cache de modulo sobreviveria a uma troca de mapa e
   * serviria a grade do mapa velho com o colisor do novo
   */
  gradeDoMapa() {
    if (this.navGrid instanceof NavGrid) return this.navGrid;

    const t0 = Date.now();

    this.navGrid = new NavGrid(
      this.world.map,
      this.world.collision,
    );

    /**
     * O tempo de montagem vale ser visto.
     *
     * Sao 15 mil testes de `isPositionFree` no vale, e o numero e o que
     * diria se a celula da grade fosse diminuida. Em silencio, a grade
     * virando um segundo por frame seria muito mais dificil de achar
     */
    if (Date.now() - t0 > 50) {
      console.info(
        `[nav] grade de ${this.world.map.id} em ${Date.now() - t0}ms`,
      );
    }

    return this.navGrid;
  }

  /**
   * ONDE o objetivo do piloto esta, e em que mapa.
   *
   * Devolve `{ x, y, mapId }` ou `null`. E a unica fonte de "para onde
   * ir" do piloto, e tanto a viagem quanto a cacada leem daqui — assim
   * o bestiario e a missao nao podem divergir sobre o destino
   */
  destinoDoObjetivo() {
    /**
     * O SEGUIDO VEM ANTES DA MISSAO.
     *
     * Quem esta seguindo alguem nao esta indo atras de zona nenhuma: o
     * destino e a posicao viva de quem se segue. E o que faz o plano
     * atravessar portal e ficar do outro lado, porque e a mesma montagem
     * de `rotaDeMapas` com outro destino
     */
    const seguindo = this.destinoDoSeguido();

    if (seguindo) return seguindo;

    const objective = this.getAutoObjective();

    if (!objective) return null;

    const zona = this.getQuestZone(objective);

    if (!zona) return null;

    return {
      x: zona.x + zona.width / 2,
      y: zona.y + zona.height / 2,
      mapId: zona.mapId,
      zone: zona,
    };
  }

/**
   * ONDE ESTA QUEM EU ESTOU SEGUINDO.
   *
   * Devolve `null` quando nao ha ninguem sendo seguido, e quando quem se
   * seguia saiu do jogo — um id que nao acha sessao e o mesmo que nao
   * haver id
   *
   * ## O MAPA E O DO ALVO, E ISSO E O QUE FAZ O PORTAL FUNCIONAR
   *
   * Cada jogador tem o seu mapa. Quando Bento atravessa um portal, so
   * ele muda de mapa — e as coordenadas dele passam a nao significar
   * nada no mapa da Ana, que ficou para tras
   *
   * Ler o mapa do SEGUIDOR aqui fazia o pior dos dois: o destino saia
   * "no meu mapa, na posicao do outro", e a Ana ia andar em direcao a
   * um ponto que no mapa dela nao existe. O resultado na tela era o
   * personagem andando infinito contra o limite do mapa
   *
   * Devolver o `mapId` do alvo e o que entrega a rota: o
   * `travelPlanParaObjetivo` ja sabe receber um destino em outro mapa e
   * monta a etapa de portal com o `rotaDeMapas`
   */
  destinoDoSeguido() {
    const sessao = this.world.session;

    const id = sessao?.seguindoId;

    if (!id) return null;

    // seguir a si mesmo e o que acontece quando o alvo sai do jogo e o
    // store ainda aponta para a sessao antiga
    if (id === sessao.id) return null;

const alvo = this.world.players.get(id);

    if (!alvo?.player) return null;

    /**
     * AINDA ESTA NA MINHA PARTY?
     *
     * Sem esta conferences, sair da party deixava o acompanhamento
     * pendurado: o `seguindoId` continua apontando para a sessao, que
     * continua no mundo, e o jogador iria atras de alguem que nao e mais
     * do grupo — atravessando portal, inclusive
     *
     * E o `membrosDe` que decide, e nao o `id existir`: estar no mundo
     * e estar na party sao coisas diferentes
     */
    const party = this.partyStore?.partyDe(sessao.id);

    if (party && !party.membros.has(id)) return null;

    return {
      x: alvo.player.x,
      y: alvo.player.y,

      /**
       * O MAPA DELE, e nao o meu.
       *
       * E o campo inteiro do acompanhamento entre mapas: com o `mapId`
       * do alvo aqui, o `travelPlanParaObjetivo` cai no `rotaDeMapas` e
       * monta a etapa de portal
       */
      mapId: alvo.mapId,
    };
  }

  /**
   * COMECOU A SEGUIR ALGUEM.
   *
   * O plano antigo e jogado fora: ele era para a zona da missao, e as
   * etapas apontariam para o meio de outra zona ate o primeiro replanejar
   */
  seguirJogador(sessionId) {
    const sessao = this.world.session;

    if (!sessao) return false;

    sessao.seguindoId = sessionId;
    sessao.seguindoRelogio = 0;

    // pedir para seguir de novo e uma ordem do jogador: o "parado" da
    // chegada anterior deixa de valer
    sessao.seguindoParado = false;

    /**
     * O PILOTO PRECISA ANDAR.
     *
     * O Auto e o que le o plano de viagem, entao sem ele o botao de
     * seguir nao andava nada. E o `autoPlay` e ligado AQUI, e nao no
     * servidor, para o `pararDeSeguir` saber que foi ele quem ligou e
     * desligar no fim
     */
    if (!this.autoPlay) {
      this.setAutoPlay(true);

      sessao.seguindoAuto = true;
    }

    this.travelPlan = [];
    this.travelParado = 0;

    return true;
  }

  /**
   * PAROU DE SEGUIR.
   *
   * O plano tambem e limpo: sem isto o piloto continuaria andando para a
   * ultima etapa conhecida depois que o jogador clicasse em parar
   *
   * ## POR QUE O AUTO DESLIGA AQUI
   *
   * O `autoPlay` e o que faz o personagem andar e CAÇAR o que esta perto.
   * Sem esta linha o jogador chegava do lado, o follow acabava, e o
   * Auto aproveitava o mesmo quadro para ir bater no slime mais proximo
   * — que foi o que o jogador viu: "apos seguir o personagem saiu
   * batendo nos mobs proximos"
   *
   * O pedido e chegar do lado e FICAR PARADO no ponto final, entao o
   * Auto que o proprio follow ligou e desligado aqui
   */
  pararDeSeguir() {
    const sessao = this.world.session;

    if (!sessao?.seguindoId) return false;

    sessao.seguindoId = null;
    sessao.seguindoRelogio = 0;

    if (sessao.seguindoAuto) {
      sessao.seguindoAuto = false;

      this.setAutoPlay(false);
    }

    this.travelPlan = [];
    this.travelParado = 0;

    // o alvo escolhido no quadro da chegada viraria alvo de ataque
    this.selectedTargetId = null;

    return true;
  }

  /**
   * MONTAR o plano de viagem, se o objetivo esta em outro mapa.
   *
   * Devolve `true` quando existe viagem a fazer. `false` quando o
   * jogador ja esta no mapa do destino, quando nao ha rota, ou quando
   * nao ha objetivo com zona — e nos tres casos o piloto deve seguir o
   * caminho normal
   */
  travelPlanParaObjetivo() {
    const destino = this.destinoDoObjetivo();

    if (!destino) return false;

    /**
     * O MAPA em que a etapa atual acontece.
     *
     * E `let` porque o laco das etapas avanca: cada portal causa a etapa
     * seguinte a acontecer no mapa de DESTINO dele. Um `const` aqui era
     * o `Assignment to constant variable` que impedia qualquer viagem de
     * existir — o plano era montado, o `for` estourava na primeira
     * travessia, e o piloto nunca saia do hub
     */
    let mapaAtual = this.world.map.id;

    /**
     * O MESMO MAPA tambem e um plano, e e uma etapa so.
     *
     * Antes esta linha era `return false`, e o objetivo no mapa de
     * qualquer era um waypoint reto: `walkToward` aponta e o boneco
     * empurra contra a arvore. O vale tem 137 arvores, e a reta do
     * spawn ate a Cripta tem arvore no meio — o piloto andava 694px e
     * travava, a 1.566px do destino
     *
     * Com o destino no mapa, o plano vira uma etapa sem portal, e o
     * A* dela faz o contorno. O codigo e o mesmo que ja levava ate o
     * portal: e o mesmo percorrimento de `caminho`, o mesmo
     * replanejamento por travamento e o mesmo consumo de etapa
     */
    const rota =
      destino.mapId === mapaAtual
        ? []
        : rotaDeMapas(mapaAtual, destino.mapId);

    /**
     * Sem rota: o destino esta em um mapa inalcancavel.
     *
     * Nao e erro do jogador e nao e caso de teste; e o caso em que a box
     * de travessia do portal da `portal_floresta` tambem nao aparece.
     * O aviso importa porque sem ele o piloto simplesmente para, e o
     * jogador nao distingue "chegou" de "desistiu"
     */
    if (rota === null) {
      this.travelPlan = [];
      this.travelParado = 0;

      return false;
    }

    /**
     * O plano so e refeito quando o destino MUDA.
     *
     * Refazer a cada chamada custaria um BFS e uma montagem de plano
     * por quadro. Como o `runTravelPlan` roda antes do `runAutoHunt` e
     * devolve `true` enquanto o plano tem etapa, o caminho so chega aqui
     * quando o plano acabou — ou quando o objetivo mudou. O `firmar` no
     * ultimo passo cobre o primeiro caso; o resto vem do objetivo
     */
    const atual = this.travelPlan[0];

    if (
      atual &&
      atual.destinoX === destino.x &&
      atual.destinoY === destino.y &&
      atual.destinoMapId === destino.mapId
    ) {
      return true;
    }

    const etapas = [];

    /**
     * Uma etapa por portal da rota, MAIS a etapa final.
     *
     * A etapa final e a que nao atravessa nada: ela leva do portal de
     * chegada ate a zona. Sem ela, o piloto atravessaria, acordaria no
     * portal e ficaria parado — o `setMap` zera o `autoWaypoint` e o
     * proximo destino so viria 0.25s depois, tempo em que o jogador ve
     * o boneco parado no meio do vale
     */
    for (const saida of rota) {
      etapas.push({
        mapId: mapaAtual,
        x: saida.portal.x,
        y: saida.portal.y,
        portalId: saida.portal.id,
        destinoMapa: saida.mapa.id,
        destinoX: destino.x,
        destinoY: destino.y,
        destinoMapId: destino.mapId,
        caminho: null,
      });

      mapaAtual = saida.mapa.id;
    }

    etapas.push({
      mapId: mapaAtual,
      x: destino.x,
      y: destino.y,
      portalId: null,
      destinoX: destino.x,
      destinoY: destino.y,
      destinoMapId: destino.mapId,
      caminho: null,
    });

    this.travelPlan = etapas;
    this.travelParado = 0;

    return true;
  }

  /**
   * PERCORRER o plano: andar o caminho e atravessar os portais.
   *
   * Devolve `true` enquanto houver viagem, e `false` quando o plano
   * acabou — e o `false` e o que devolve o controle ao piloto normal
   *
   * ## POR QUE O PLANO VENCE A CACADA, MAS SO A CAMINHADA
   *
   * Uma viagem entre mapas e uma cacada com duas etapas a mais. Se o
   * piloto de cacada rodar junto, ele apontaria para a zona de outro mapa
   * e brigaria com o caminho do portal pela mesma variavel
   *
   * ## POR QUE UMA CRIATURA VIVA CANCELA A CAMINHADA
   *
   * O plano tambem existe agora para o objetivo no MESMO mapa, e nesse
   * caso ele seria uma etapa so: andar ate o centro da zona. Se ele
   * rodasse sem condicao, o boneco iria para o centro da zona e nunca
   * brigaria com o slime que esta a dois passos dele
   *
   * E o `pickAutoTarget` que decide: devolve a criatura da zona que
   * esta viva, e o plano cede. Sem criatura, o plano manda — que e o
   * caso em que o boneco precisa atravessar o vale
   */
  runTravelPlan(deltaTime, player) {
    if (!this.isAutoActive()) return false;

    if (player.hp <= 0) return false;

    /**
     * A CACADA VENCE quando ha alvo vivo.
     *
     * O `pickAutoTarget` e o mesmo que o `autoPlayTarget` usa, e ele
     * exige que a criatura seja do tipo do objetivo e esteja dentro da
     * zona. Uma criatura do outro tipo, ou fora da zona, nao cancela a
     * caminhada: o objetivo continua sendo chegar na zona
     *
     * ## POR QUE ISSO NAO VALE QUANDO ESTA SEGUINDO
     *
     * Quem segue quer ir atras de uma PESSOA, e nao de um slime. Sem
     * esta guarda, um bicho vivo no caminho cancelava o plano de ir ate
     * o outro e o jogador ficava parado lutando no meio do caminho —
     * o botao parecia quebrado
     */
    if (!this.world.session?.seguindoId && this.pickAutoTarget()) {
      return false;
    }

    if (this.travelPlan.length === 0) {
      if (!this.travelPlanParaObjetivo()) return false;
    }

/**
     * SEGUINDO, O PLANO VELHO.
     *
     * Quem se segue anda varias vezes por segundo, e um plano guardado
     * levaria o seguidor para o ponto onde o outro ESTAVA. O plano e
     * refeito no ritmo de `seguindoRelogio`, e nao a cada quadro: um A*
     * por quadro e um BFS por quadro, e o plano novo quase nunca muda
     * tanto assim em 400ms
     *
     * O relogio e zerado em cada replanejamento, entao o intervalo conta
     * a partir do ULTIMO plano, e nao do inicio do acompanhamento
     *
     * ## E O RELOGIO E UM TETO, NAO UM GATILHO
     *
     * Quem segue tem por destino a posicao de uma PESSOA, e a primeira
     * etapa dessa viagem e o A* mais caro do jogo — o objetivo e uma
     * coordenada que muda a cada quadro. Refazer o plano a cada 400ms
     * gastaria ate 80ms de CPU por chamada, e o follower ficaria com o
     * jogo travando a cada meio segundo enquanto andava
     *
     * Por isso o plano so e refeito quando o seguido ANDOU o bastante
     * para o caminho antigo terminar na posicao errada. Dois jogadores
     * andando na mesma direcao reusam o mesmo caminho, e o A* roda na
     * frequencia de uma mudanca de rumo, que e a frequencia que importa
     *
     * O piso de distancia nunca segura o plano para sempre: e o
     * `#contarTravelParado` que abre a excepcao, zerando o `caminho` da
     * etapa quando o jogador para, e o caminho passa a ser refeito do
     * zero no proximo tique
     */

    const sessao = this.world.session;

    if (sessao?.seguindoId) {
      sessao.seguindoRelogio += deltaTime;

      if (sessao.seguindoRelogio >= SEGUIR_REPLANEJA) {
        sessao.seguindoRelogio = 0;

        const destino = this.destinoDoObjetivo();

        const etapaAtual = this.travelPlan[0];

        const andou =
          !destino ||
          !etapaAtual ||
          Math.hypot(
            etapaAtual.destinoX - destino.x,
            etapaAtual.destinoY - destino.y,
          ) >= SEGUIR_REPLANEJA_PX;

        if (andou) {
          this.travelPlan = [];

          if (!this.travelPlanParaObjetivo()) return false;
        }
      }
    }

    /**
     * CHEGOU DO LADO.
     *
     * O pedido foi "deve parar de seguir ao chegar do lado somente". O
     * `TRAVEL_CHEGADA` e a distancia de chegada de uma etapa: chegar ali
     * e estar do lado. Acima disso o Auto continuaria andando em direcao
     * a um jogador que ja esta do lado, e ele ia passar por ele
     */
    const seguindo = this.destinoDoSeguido();

    if (seguindo && seguindo.mapId === this.world.map.id) {
      const distancia = Math.hypot(
        seguindo.x - player.x,
        seguindo.y - player.y,
      );

      const sessaoSeguida = this.world.players.get(
        this.world.session?.seguindoId,
      );

      /**
       * `+` o raio do seguido: o ponto do plano e o CENTRO dele, e o que
       * "do lado" significa e a borda. Sem isto o Auto andava ate o meio
       * do outro personagem antes de parar
       */
      const raioDoAlvo = sessaoSeguida?.player?.radius ?? 0;

      if (distancia <= TRAVEL_CHEGADA + raioDoAlvo) {
        /**
         * O CHEGADA MARCA O FIM.
         *
         * `pararDeSeguir` desliga o Auto; este flag segura o personagem
         * no ponto final contra o auto da missao e o do bestiario, que
         * voltariam a cacar no proximo quadro
         */
        sessao.seguindoParado = true;

        this.pararDeSeguir();

        this.sendSnapshot();

        return false;
      }
    }

    const etapa = this.travelPlan[0];

    /**
     * O PLANO VELHO.
     *
     * A etapa e de outro mapa: o jogador atravessou o portal a mao, ou
     * morreu e renasceu no hub, ou o servidor o devolveu ao inicio. Em
     * vez de tentar seguir uma etapa de outro mapa — e andar para uma
     * coordenada que aqui nao significa nada — o plano e descartado e
     * refeito a partir de onde o jogador esta
     */
    if (etapa.mapId !== this.world.map.id) {
      this.travelPlan = [];
      this.travelParado = 0;

      return this.travelPlanParaObjetivo();
    }

    this.#contarTravelParado(deltaTime, player);

    /**
     * O TRAVADO.
     *
     * Acima do limite, a etapa e refeita com um caminho novo. E o que
     * salva o piloto quando o plano envelhece sem ninguem mexer nele: um
     * inimigo empurra o jogador para tras do ultimo ponto do caminho, ou
     * o ponto final fica dentro de um obstaculo que o grid marcou livre
     */
    if (this.travelParado > TRAVEL_TRAVADO_LIMITE) {
      this.travelParado = 0;
      etapa.caminho = null;
    }

    /**
     * Chegou no ponto final da etapa?
     *
     * O `24` e o mesmo raio do `walkToward`, e nao o raio de travessia
     * do portal: estar a 24px do centro ja esta dentro do raio de 96px
     * que o `portalSobOsPes` aceita, entao o `travessarPortal` nunca
     * falha aqui. Se falhasse, o passo abaixo reentraria no loco e a
     * proxima tentativa veria o jogador ja em cima do portal
     *
     * E a chegada e MEDIA CELULA mais larga que a de um ponto do caminho,
     * porque o caminho nem sempre termina no ponto exato da etapa: quando
     * o destino esta perto demais de um arbusto para a folga, o `NavGrid`
     * fecha o caminho no centro da celula vizinha. Ver
     * `TRAVEL_CHEGADA_CELULA`
     */
    if (
      Math.hypot(etapa.x - player.x, etapa.y - player.y) <
      TRAVEL_CHEGADA + TRAVEL_CHEGADA_CELULA
    ) {
      return this.#concluirEtapa(etapa);
    }

    /**
     * O CAMINHO da etapa, calculado uma vez e consumido aos poucos.
     *
     * O A* custa ate 80ms no vale. Por quadro, com dois jogadores, isso
     * seria um travamento visivel. Por etapa, e um custo invisivel
     *
     * E o `length === 0` no teste: caminho VAZIO e caminho gasto. Acontece
     * no `seguir`, em que o alvo e uma pessoa e o plano so e refeito
     * quando o seguido andou 96px — o caminho acaba antes disso e o
     * jogador precisa de um caminho novo para o resto do caminho, sem
     * contar com o replanejamento do plano
     */
    if (!etapa.caminho || etapa.caminho.length === 0) {
      etapa.caminho = this.gradeDoMapa()
        .caminho(
          { x: player.x, y: player.y },
          { x: etapa.x, y: etapa.y },
        );

      /**
       * Sem caminho, a etapa e INALCANCAVEL e nao "dificil".
       *
       * A grade e feita dos solidos do mapa e dos NPCs bloqueantes.
       * O caso real e o mercador do hub: se algum dia ele for para
       * dentro de uma parede, o destino fica dentro de um solido e o
       * A* nao acha celula de entrada. Sem este `if` o piloto ficaria
       * andando na direcao do obstaculo para sempre
       *
       * E o caminho VAZIO entra no mesmo `if` de proposito: um caminho
       * sem nenhum ponto faria o `caminho[0]` abaixo ser `undefined`, e o
       * `walkToward` explodiria em `proximo.x`. Descartar a etapa e o
       * que mantem o piloto dando as costas em vez de quebrando
       */
      if (!etapa.caminho || etapa.caminho.length === 0) {
        this.travelPlan = [];
        this.travelParado = 0;

        return false;
      }
    }

    const proximo = etapa.caminho[0];

    /**
     * O ponto seguinte e o destino: consome e a etapa terminou.
     *
     * O `shift` em vez de indice guardado e o que mantem o plano
     * pequeno. Um plano de viagem tem duas ou tres etapas; guardar o
     * indice seria um campo a mais na sessao por causa de nada
     */
    if (this.#chegouEm(player, proximo.x, proximo.y)) {
      etapa.caminho.shift();

      return true;
    }

    /**
     * O WAYPOINT PUBLICADO e o proximo ponto do caminho.
     *
     * Sem esta linha o plano andava pelo `caminho` e deixava o
     * `autoWaypoint` vazio, e o campo que responde "para onde o boneco
     * esta indo" ficaria mentindo durante toda a caminhada — inclusive
     * para o `bestiaryAuto.test.js`, que verifica que o piloto usa
     * waypoint
     *
     * Ele e espelhado, nao e a fonte: quem manda no movimento e o
     * `walkToward` com o `proximo`, logo abaixo. Um lugar so decide o
     * destino e o outro o movimento, e nao um so as duas coisas
     */
    this.autoWaypoint = proximo;

    this.walkToward(player, proximo);

    return true;
  }

  /**
   * O TEMPO que o jogador passou sem avancar, para o replanejamento.
   *
   * A medicao e de POSICAO e nao de "o motor pediu para andar": durante
   * a viagem o piloto pode querer andar e nao andar — um status que
   * prende, um `canMove` falso — e um contador de comando ignoraria
   * esses quadros. Medindo o deslocamento real, so conta o que o
   * jogador esta de fato parado
   *
   * O primeiro quadro e ignorado de proposito: `travelUltimaX` comeca em
   * zero, e a primeira comparacao diria "andou 3000px" e zeraria o
   * contador em qualquer viagem
   */
  #contarTravelParado(deltaTime, player) {
    if (this.travelUltimaX !== null) {
      const andou =
        Math.hypot(
          player.x - this.travelUltimaX,
          player.y - this.travelUltimaY,
        ) > TRAVEL_TRAVADO_EPSILON;

      this.travelParado = andou ? 0 : this.travelParado + deltaTime;
    }

    this.travelUltimaX = player.x;
    this.travelUltimaY = player.y;
  }

  /** o jogador esta no RAIO DE CHEGADA do ponto? */
  #chegouEm(player, x, y) {
    return Math.hypot(x - player.x, y - player.y) < TRAVEL_CHEGADA;
  }

  /**
   * TERMINOU a etapa: atravessou o portal, ou era a ultima.
   *
   * E aqui que o plano sobrevive ao `setMap`. O `travessarPortal` chama
   * `setMap`, que reposiciona o jogador no ponto de chegada e ZERA o
   * `autoWaypoint` — mas nao toca no `travelPlan`, entao a etapa seguinte
   * ja esta esperando com o mapa novo
   */
  #concluirEtapa(etapa) {
    /**
     * A ETAPA FINAL: o destino foi alcancado.
     *
     * O plano e esvaziado e o piloto recebe de volta o
     * `autoPlayTarget`, que vai passar a cacar a criatura da zona. A
     * proxima linha e o `return true`, e ele impede o `updateAutoPlay`
     * de cair no `runAutoHunt` no MESMO quadro — o que daria um quadro
     * de cacada em um mapa onde a criatura da zona pode nao estar, e o
     * piloto andaria para tras
     */
    if (etapa.portalId === null) {
      this.travelPlan = [];
      this.travelParado = 0;

      return true;
    }

    /**
     * A TRAVESSIA.
     *
     * `travessarPortal` refaz a conferencia de posicao e de destino: se
     * o portal debaixo do jogador nao for o desta etapa, ele devolve
     * `false` e a etapa fica para a proxima tentativa. E o que impede
     * o piloto de atravessar o portal errado — num mapa com dois portais
     * para o mesmo destino, e no caso em que um inimigo empurrou o
     * jogador para dentro do portal vizinho
     */
    if (!this.travessarPortal()) return true;

    this.travelPlan.shift();
    this.travelParado = 0;

    return true;
  }

  runEngagedTarget(player) {
    let target = this.findEnemyById(this.engagedTargetId);

    if (!target) {
      this.engagedTargetId = null;
      this.selectedTargetId = null;
      this.showMessage("Alvo eliminado.");
      return;
    }

    this.selectedTargetId = target.id;
    this.approachTarget(player, target);
  }

  /**
   * O FOCO DO LIDER ESTA LIGADO PARA ESTE JOGADOR?
   *
   * Exige as tres coisas: o botao ligado, uma party, e NAO ser o lider.
   * O lider nao foca em ninguem — ele ja e a fonte do foco, e o motor
   * trataria ele como alvo de si mesmo
   */
  focoDoLiderAtivo() {
    const sessao = this.world.session;

    if (!sessao?.focarLider) return false;

    const party = this.partyStore?.partyDe(sessao.id);

    if (!party) return false;

    return party.lider !== sessao.id;
  }

  /**
   * O INIMIGO QUE O LIDER ESTA BATENDO, e so esse.
   *
   * Devolve `null` quando o lider nao tem alvo, quando a party sumiu,
   * quando o lider esta em OUTRO MAPA, e quando o mob ja morreu. Nos
   * tres ultimos casos o efeito e o mesmo: o membro nao bate em ninguem
   *
   * O `findEnemyById` e o que resolve o ultimo caso de graca: os
   * inimigos sao do mapa em foco, e o do outro mapa simply nao esta na
   * lista
   */
  inimigoDoAlvoDoLider() {
    const sessao = this.world.session;

    const party = this.partyStore?.partyDe(sessao.id);

    if (!party) return null;

    const lider = this.world.players.get(party.lider);

    if (!lider) return null;

    /**
     * O `engagedTargetId` e o clique: o que o jogador mandou bater.
     * O `selectedTargetId` e o Auto do lider: o que o piloto dele
     * escolheu. Os dois contam como "estar batendo", e o clique vem
     * primeiro porque e a intencao mais especifica
     */
    const alvo = lider.engagedTargetId ?? lider.selectedTargetId ?? null;

    return this.findEnemyById(alvo);
  }

  runAutoHunt(deltaTime, player) {
    /**
     * A BASE NAO E CAMPO DE CACA.
     *
     * Este e o quarto caminho do golpe, e o unico que nao passa por
     * `useBasicAttack`: o piloto chama `skillSystem.request` direto, com a
     * mira ja apontada no alvo. Sem esta guarda, o autoplay ligado na base
     * procuraria um mob que nao existe e sairia do `alvo` vazio — mas o
     * `T` do teclado liga o piloto em qualquer mapa, e o jogador que
     * entrasse no hub com o auto ligado levaria o portao de lado
     *
     * E a MESMA regra de `useBasicAttack`, pelo mesmo metodo. Duas
     * condicoes com nomes diferentes divergem na primeira vez que uma delas
     * for esquecida
     */
    if (!this.emZonaDeCombate()) return;

    /**
     * O FOCO DO LIDER SUBSTITUI A ESCOLHA DE ALVO.
     *
     * E o unico ponto do piloto que decide "contra quem eu bato". Com o
     * foco ligado, a escolha e o alvo do lider; sem o foco, e o
     * `autoPlayTarget` de sempre
     *
     * Devolver `null` quando o lider nao esta batendo em ninguem e o que
     * faz a segunda metade do pedido: `picked` vazio limpa o
     * `selectedTargetId`, e o `findEnemyById` abaixo nao acha alvo
     * nenhum — o membro fica parado em vez de ir atras do mob mais
     * proximo
     */
    const focusing = this.focoDoLiderAtivo();

    /**
     * SEGUINDO, O PILOTO NAO CACA.
     *
     * Sem esta guarda, o Auto cacava o slime que estava no caminho: o
     * `runTravelPlan` só cede o controle quando o plano acaba ou não
     * existe, e nesses quadros o `runAutoHunt` recebia a vez e ia
     * atrás do mob mais proximo. O jogador pedia para seguir uma
     * pessoa e acabava batendo em tudo que passava no caminho
     *
     * Quem se segue e uma PESSOA, e a missao de chegar do lado nao tem
     * alvo nenhum
     */
    if (this.world.session?.seguindoId) return;

    this.autoDecisionTimer -= deltaTime;

    if (this.autoDecisionTimer <= 0) {
      this.autoDecisionTimer = AUTO_RETARGET_INTERVAL;

      const picked = focusing
        ? this.inimigoDoAlvoDoLider()
        : this.autoPlayTarget();

      this.autoWaypoint = picked?.isWaypoint
        ? picked
        : null;

      this.selectedTargetId = picked?.isWaypoint
        ? null
        : (picked?.id ?? null);
    }

    if (this.autoWaypoint) {
      if (!this.walkToward(player, this.autoWaypoint)) {
        this.autoWaypoint = null;
      }

      return;
    }

    const target = this.findEnemyById(
      this.selectedTargetId,
    );

    if (!target) return;

    this.approachTarget(player, target);
  }

  /** true enquanto ainda ha caminho, false quando chegou */
  walkToward(player, point) {
    const dx = point.x - player.x;
    const dy = point.y - player.y;

    if (Math.hypot(dx, dy) < 24) return false;

    this.autoFacing = { x: dx, y: dy };

    if (!this.statuses.canMove(player)) return true;

    this.autoMoveDirection = normalize(dx, dy);

    return true;
  }

  approachTarget(player, target) {
    const targetDistance = distance(player, target);

    this.autoFacing = {
      x: target.x - player.x,
      y: target.y - player.y,
    };

    if (
      targetDistance > this.getAutoDesiredRange() &&
      this.statuses.canMove(player)
    ) {
      this.autoMoveDirection = this.direcaoDePerseguicao(
        player,
        target,
      );
    } else {
      /**
       * Alvo em alcance: o caminho antigo nao serve mais.
       *
       * Sem esta limpeza o proximo quadro que precisar se aproximar
       * comecaria a andar para um ponto de um caminho obsoleto, com o
       * alvo ja having ido
       */
      this.cacadaCaminho = null;
      this.cacadaRelogio = 0;
    }

    const action = this.chooseAutoAction(targetDistance);

    if (!action) return;

    this.skillSystem.request(
      action,
      {
        x: target.x,
        y: target.y,
        inside: true,
      },
      target.id,
    );
  }

  /**
   * A DIRECAO do proximo passo em direcao a um alvo que anda.
   *
   * ## A RETA PRIMEIRO, E O CASO COMUM
   *
   * O vale tem 137 arvores, mas a maioria dos alvos esta a vista. O
   * teste de linha de visada custa uma linha e nao aloca nada, e um
   * caminho de A* aqui seria 80ms de trabalho para redesenhar a reta
   *
   * ## O CAMINHO SO QUANDO A RTA ESTA BLOQUEADA
   *
   * Era aqui que o piloto morria: com arvore no meio, o boneco empurrava
   * contra o tronco e o arqueiro ficava a 800px de um limo, fora do
   * alcance de 550, sem disparar uma flecha em 60 segundos. A correcao
   * nao e "andar mais rapido": e nao haver para onde andar
   *
   * ## POR QUE UM RELOGIO, E NAO A CADA QUADRO
   *
   * O alvo ANDA, entao o caminho envelhece. Refazer a cada quadro
   * custaria ate 80ms por quadro por jogador. O `cacadaRelogio` refaz
   * meio segundo, ou antes se o caminho acabar — e o caminho acabando e
   * o sinal de que o alvo corrou para longe demais
   *
   * ## SEM ROTA, VOLTA A RETA
   *
   * Nao ha rota possivel quando o alvo esta atras de um solido fechado.
   * A reta e o melhor que resta: o `escapeCorner` pode destravar, e ficar
   * parado de proposito pioraria
   */
  direcaoDePerseguicao(player, alvo) {
    const grade = this.gradeDoMapa();

    const de = { x: player.x, y: player.y };
    const para = { x: alvo.x, y: alvo.y };

    const reta = { x: para.x - de.x, y: para.y - de.y };

    if (grade.temLinhaDeVisada(de, para)) {
      this.cacadaCaminho = null;
      this.cacadaRelogio = 0;

      return normalize(reta.x, reta.y);
    }

    this.cacadaRelogio -= this.frameDelta;

    const semCaminho =
      !this.cacadaCaminho || this.cacadaCaminho.length === 0;

    if (semCaminho || this.cacadaRelogio <= 0) {
      this.cacadaCaminho = grade.caminho(de, para);
      this.cacadaRelogio = CACA_RECALCULA;
    }

    const caminho = this.cacadaCaminho;

    if (!caminho || caminho.length === 0) {
      return normalize(reta.x, reta.y);
    }

    /**
     * Consome os pontos ja alcancados.
     *
     * ## POR QUE ESTE `while` E O DESCARTAR DO PRIMEIRO PONTO
     *
     * A primeira versao fazia `shift()` assim que recalculava, com a
     * justificativa de que "o primeiro ponto e a celula de partida". Era
     * falso: o `NavGrid` passa por *string pulling*, e o primeiro ponto
     * que sobra e o mais DISTANTE que o jogador enxerga — o canto que
     * contorna a arvore, muitas vezes no lado oposto do alvo
     *
     * Descartar esse canto e o que fazia o piloto andar direto no
     * obstaculo: o caminho bruto era `[(3220, 2900), (limo)]`, virava
     * `[(limo)]`, e o passo seguinte batia na arvore. O piloto travava
     * a 1.700px do alvo, com a direcao publicada e o passo bloqueado
     *
     * O `while` abaixo resolve os dois casos: ele so descarta o ponto
     * quando o jogador esta EM CIMA dele, e o canto sobrevive
     */
    while (
      caminho.length > 1 &&
      Math.hypot(
        caminho[0].x - player.x,
        caminho[0].y - player.y,
      ) < TRAVEL_CHEGADA
    ) {
      caminho.shift();
    }

    const proximo = caminho[0];

    this.autoWaypoint = proximo;

    return normalize(
      proximo.x - player.x,
      proximo.y - player.y,
    );
  }

  update(deltaTime) {
    // No navegador o `destroy` cancela o requestAnimationFrame e o
    // laco morre sozinho. No servidor o laco e de fora, entao um
    // tick ja enfileirado continuaria simulando um jogador que ja
    // saiu: o mob continuaria tomando dano de um fantasma e o loot
    // iria para ninguem.
    if (this.destroyed) return;

    this.frameDelta = deltaTime;

    // MODO REDE: o cliente nao simula nada. A posicao de cada um
    // veio do servidor, e este ramo so avanca o relogio de
    // DESENHO (animacao dos sprites, duracao das barras) para o
    // quadro nao ficar congelado entre um snapshot e o outro.
    //
    // O ramo fica ANTES de qualquer logica de jogo de proposito:
    // se a simulacao local rodasse junto, o cliente teria uma
    // segunda copia do mundo divergindo da do servidor, que e
    // exatamente o problema que a autoridade do servidor veio
    // resolver.
    if (this.networked) {
      this.spriteTime += deltaTime;
      this.updatePresentation(deltaTime);

      /**
       * Os EFEITOS andam com o tempo no modo rede tambem.
       *
       * `effects.update` estava depois do `return` deste ramo, e o
       * `EffectSystem` e o dono do numero de dano que sobe. Com o
       * `update` fora, o `ttl` nao decairia: cada numero criado ficaria
       * parado no primeiro quadro, com o mesmo texto sobreposto no
       * mesmo pixel, para sempre — e a lista so cresceria ate o teto
       * de 400, expulsando os mais antigos sem nunca mostrar nada
       *
       * Aqui dentro e nao la embaixo porque este ramo e o unico que
       * roda no cliente, e o cliente e quem tem o canvas
       */
      this.effects.update(deltaTime);

      this.snapshotAccumulator += deltaTime;

      if (this.snapshotAccumulator >= 0.1) {
        this.snapshotAccumulator = 0;
        this.sendSnapshot();
      }

      return;
    }

    this.world.time += deltaTime;

    // o aviso de tela e POR SESSAO: cada um tem o seu e o seu
    // relogio. Antes era um campo do motor, e o texto do "+16
    // moedas" ficava na tela de todo mundo connected ate a mesma
    // hora de expirar
    for (const sessao of this.world.players.values()) {
      if (sessao.messageRemaining <= 0) continue;

      sessao.messageRemaining -= deltaTime;

      if (sessao.messageRemaining <= 0) {
        sessao.message = null;
        sessao.messageRemaining = 0;
      }
    }

    // A PARTE POR JOGADOR: cooldown, movimento, status e as
    // habilidades de cada um. Com uma pessoa e o que sempre foi.
    // Com varias, o foco e trocado antes de resolver cada um, e o
    // `withPlayer` devolve o foco no fim, ate se algo estourar no
    // meio: sem isso o jogador B andaria com o inventario do A.
    for (const id of [...this.world.players.keys()]) {
      // alguem pode ter saído durante o proprio tick
      if (!this.world.players.has(id)) continue;

      this.withPlayer(id, () => {
        this.updateCooldowns(deltaTime);
        this.updateAutoPlay(deltaTime);
        this.updatePlayer(deltaTime);

        this.skillSystem.update(deltaTime);

        // o drop no chao e por jogador: cada um recolhe o que esta
        // perto DELE, e nao o do jogador em foco
        this.coletarDropDoChao();

        this.statuses.update(
          this.world.player,
          deltaTime,
        );
      });
    }

    this.spriteTime += deltaTime;

    /**
     * A PARTE COMPARTILHADA: inimigos, projeteis, efeitos e
     * drops sao o MESMO para todo mundo, entao rodam UMA vez por
     * tick. Se estes loops ficassem dentro do de cima, um slime
     * levaria o dano do tanto de jogadoresQuanto houvesse online
     * e o tempo de vida dele cairia N vezes mais rapido.
     *
     * ## POR QUE UMA VEZ POR MAPA, E NAO UMA VEZ POR TICK
     *
     * Estes loops leem `world.enemies`, e o `world` aponta para o mapa
     * do jogador em foco. Rodando uma vez so, os mobs do mapa de quem
     * NAO esta em foco simplesmente nao andariam: ficariam parados com
     * a vida cheia, e o drop de um mapa vazio nunca venceria
     *
     * Uma passada por mapa com pelo menos um jogador resolve. Passando
     * por `withPlayer` com um jogador daquele mapa, a `updateEnemies`
     * ainda tem um `world.player` para medir a distancia do agro e o
     * guia — e sem ninguem em cena, nao ha o que agressar
     */
    for (const id of this.jogadoresPorMapa()) {
      if (!this.world.players.has(id)) continue;

      this.withPlayer(id, () => {
        this.updateEnemies(deltaTime);

        // As flechas andam aqui, e nao dentro do `skillSystem.update`:
        // `world.projectiles` e compartilhado, entao rodar por jogador
        // fazia a flecha voar N vezes mais rapida com N gente online
        this.skillSystem.updateProjectiles(deltaTime);
        this.updateFlechasHostis(deltaTime);

        this.updateDrops(deltaTime);
      });
    }

    this.effects.update(deltaTime);

    this.snapshotAccumulator += deltaTime;

    if (this.snapshotAccumulator >= 0.1) {
      this.snapshotAccumulator = 0;
      this.sendSnapshot();
    }
  }

  /**
   * UM JOGADOR POR MAPA, para a parte compartilhada do tick.
   *
   * Devolve o id de um jogador de cada mapa que tem alguem online. E o
   * suficiente para a `updateEnemies` ter um `world.player` do mapa
   * certo: dois jogadores no mesmo mapa nao precisam de duas passadas,
   * e os mobs deles nao podem tomar o dano em dobro
   */
  jogadoresPorMapa() {
    const vistos = new Set();

    const umPorMapa = [];

    for (const sessao of this.world.players.values()) {
      if (vistos.has(sessao.mapId)) continue;

      vistos.add(sessao.mapId);

      umPorMapa.push(sessao.id);
    }

    return umPorMapa;
  }

  updateCooldowns(deltaTime) {
    const cooldowns = this.world.player.cooldowns;

    for (const id in cooldowns) {
      const next = Math.max(
        0,
        cooldowns[id] - deltaTime,
      );

      if (next === 0) {
        delete cooldowns[id];
      } else {
        cooldowns[id] = next;
      }
    }
  }

  updatePlayer(deltaTime) {
    const player = this.world.player;

    if (player.hp <= 0) {
      player.isMoving = false;
      return;
    }

    const keys = this.input.keys;

    let movementX = 0;
    let movementY = 0;

    if (keys.has("KeyA") || keys.has("ArrowLeft")) {
      movementX -= 1;
    }

    if (keys.has("KeyD") || keys.has("ArrowRight")) {
      movementX += 1;
    }

    if (keys.has("KeyW") || keys.has("ArrowUp")) {
      movementY -= 1;
    }

    if (keys.has("KeyS") || keys.has("ArrowDown")) {
      movementY += 1;
    }

    // A intencao que o SERVIDOR recebeu tem prioridade sobre o
    // teclado. No navegador o teclado e a intencao, entao o
    // resultado e o mesmo. Online o `keys` esta vazio e quem manda
    // e o pacote: era este o ponto onde o servidor nao conseguia
    // mover ninguem, porque o motor so sabia ler tecla.
    const intencao = this.world.session?.intent;

    if (intencao && intencao.seq > 0) {
      movementX = intencao.moveX;
      movementY = intencao.moveY;
    }

    const direction = this.autoMoveDirection
      ? this.autoMoveDirection
      : normalize(movementX, movementY);

    const statusMultiplier = this.statuses.getMultiplier(
      player,
      "movementSpeed",
    );

    player.isMoving = direction.x !== 0 || direction.y !== 0;

    if (
      player.isMoving &&
      this.statuses.canMove(player)
    ) {
      const castMultiplier = player.cast ? 0.55 : 1;

      const speed =
        player.speed *
        statusMultiplier *
        castMultiplier;

      this.world.collision.moveEntity(
        player,
        direction.x * speed * deltaTime,
        direction.y * speed * deltaTime,
        EMPTY_LIST,
      );

      player.moveDirection = direction;
      player.facing = direction;
      player.animationTime += deltaTime * 9;
    } else {
      player.animationTime += deltaTime * 2;
    }

    // o jogador so colide com solidos. inimigos nao podem virar
    // parede: numa turba o personagem ficava cercado e sem
    // nenhuma direcao livre. roda sempre, inclusive parado, senao
    // a horda empilha em cima dele.
    this.shoveEnemiesOffPlayer(player, deltaTime);

    // ultimo recurso: se sobrou empurrao dentro de um obstaculo,
    // o jogador e devolvido para fora em vez de ficar travado
    this.world.collision.resolveOverlap(
      player,
      player.radius,
    );

    player.walkPhase += deltaTime;

    const walkTarget = player.isMoving ? 1 : 0;

    player.walkBlend +=
      (walkTarget - player.walkBlend) *
      Math.min(1, deltaTime * 12);

    const autoFacing = this.autoFacing
      ? normalize(this.autoFacing.x, this.autoFacing.y)
      : null;

    const pointerFacing = this.input.pointer.inside
      ? normalize(
        this.input.pointer.x - player.x,
        this.input.pointer.y - player.y,
      )
      : null;

    const aimDirection = autoFacing ?? pointerFacing;

    if (
      aimDirection &&
      (aimDirection.x !== 0 || aimDirection.y !== 0)
    ) {
      player.aimDirection = aimDirection;
    }

    // atirando com foco num inimigo, o arqueiro vira para o alvo:
    // a arte de tiro e por direcao e precisa casar com a mira.
    // fora da janela do tiro o facing continua sendo o do
    // movimento, como manda a regra de andar.
    if (player.attackAnimation > 0 && player.firingTargetId) {
      const aimed = this.findEnemyById(player.firingTargetId);

      if (aimed) {
        player.facing = normalize(
          aimed.x - player.x,
          aimed.y - player.y,
        );
      }
    }

    const resourceRegen =
      player.definition.stats.resourceRegen *
      this.statuses.getMultiplier(
        player,
        "resourceRegen",
      );

    player.resource = Math.min(
      player.maxResource,
      player.resource + resourceRegen * deltaTime,
    );

    for (const effect of player.statusEffects) {
      if (
        effect.type === "regeneration" &&
        effect.value > 0
      ) {
        this.damage.heal(
          player,
          Math.round(effect.value * deltaTime),
        );
      }
    }

    player.attackAnimation = Math.max(
      0,
      player.attackAnimation - deltaTime,
    );

    player.hitFlash = Math.max(
      0,
      player.hitFlash - deltaTime,
    );
  }

  updateEnemies(deltaTime) {
    const player = this.world.player;
    const allEnemies = this.world.enemies;
    const emptyList = EMPTY_LIST;

    for (const enemy of allEnemies) {
      if (!enemy.alive) {
        enemy.respawnTimer -= deltaTime;

        if (enemy.respawnTimer <= 0) {
          this.reviveEnemy(enemy);
        }

        continue;
      }

      enemy.hitFlash = Math.max(
        0,
        enemy.hitFlash - deltaTime,
      );

      const dx = player ? enemy.x - player.x : 0;
      const dy = player ? enemy.y - player.y : 0;

      // sem ninguem no mapa nao ha o que descartar: `player` e
      // `null` entre o ultimo jogador sair e o proximo entrar, e
      // comparar a distancia com `null` derrubava o laco do
      // servidor inteiro
      const nearPlayer =
        !player ||
        dx * dx + dy * dy <= ACTIVE_RANGE * ACTIVE_RANGE;

      this.statuses.update(enemy, deltaTime);

      const damping = Math.exp(-8 * deltaTime);

      this.world.collision.moveEntity(
        enemy,
        enemy.pushVelocity.x * deltaTime,
        enemy.pushVelocity.y * deltaTime,
        nearPlayer ? allEnemies : emptyList,
      );

      enemy.pushVelocity.x *= damping;
      enemy.pushVelocity.y *= damping;

      // inimigo empanado num solido fica travado igual o jogador
      this.world.collision.resolveOverlap(
        enemy,
        enemy.radius,
        2,
      );

      if (
        Math.abs(enemy.pushVelocity.x) < 0.5 &&
        Math.abs(enemy.pushVelocity.y) < 0.5
      ) {
        enemy.pushVelocity = { x: 0, y: 0 };
      }

      if (enemy.hp <= 0) {
        // o StatusSystem tira vida direto, sem passar pelo
        // DamageSystem, entao o `onDeath` nunca dispara para
        // veneno e queimadura. Antes este bloco so marcava o
        // mob como morto e seguia: o loot, o xp, a missao e o
        // bestiario eram perdidos. Um abate por DoT NAO pode ser um
        // abate sem premio
        this.killEnemy(enemy);

        continue;
      }

      // O boneco de duelo tambem roda a IA, mesmo sem ser
      // criatura: e ele que vai ate quem bateu nele. Sem este `||`
      // a regra do duelo simplesmente nunca executava, e o boneco
      // ficava travado em `idle` com o alvo travado nele
      if ((enemy.isCreature || enemy.duelo) && nearPlayer) {
        this.enemyAI.update(enemy, deltaTime);
      }
    }
  }

  /**
   * afasta os inimigos que invadiram o jogador. o jogador nao
   * cede nada: e ele quem empurra, porque o movimento dele ja e
   * so contra solidos e nao pode ser travado por nenhum corpo.
   */
  shoveEnemiesOffPlayer(player, deltaTime) {
    const collision = this.world.collision;
    const strength = 18 * deltaTime + 2;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;

      const minimum =
        player.radius + enemy.radius;

      const squared = dx * dx + dy * dy;

      if (squared >= minimum * minimum) continue;

      let normalX = 1;
      let normalY = 0;
      let distance = 0;

      if (squared > 0) {
        distance = Math.sqrt(squared);
        normalX = dx / distance;
        normalY = dy / distance;
      }

      const overlap = minimum - distance;

      // empurra o inimigo para fora, mas nunca alem do que a
      // sobreposicao pede: evita teletransportar corpos
      const step = Math.min(overlap, strength);

      // lista vazia de proposito: se o outro inimigo bloquear o
      // empurrao, o anel inteiro fica comprimido em cima do
      // jogador. a separacao entre inimigos acontece no update
      // deles e desfaz o amontoado nos frames seguintes.
      collision.moveEntity(
        enemy,
        normalX * step,
        normalY * step,
        EMPTY_LIST,
      );

      collision.resolveOverlap(enemy, enemy.radius, 2);
    }
  }

  /**
   * A unica rota de morte de inimigo.
   *
   * Existiam duas e elas discordavam: o DamageSystem chamava
   * `handleKill` (com loot, xp, missao e bestiario) e o
   * `updateEnemies` apenas marcava `alive = false` quando o
   * StatusSystem matava por veneno. O segundo caminho premiava
   * ninguem.
   *
   * O dono do abate vem do ultimo a dar dano, nao de quem clicou
   * por ultimo: com dois jogadores batendo no mesmo mob, o loot
   * e de quem aplicou o golpe que zerou o HP. O `lastHitBy` e
   * gravado pelo DamageSystem a cada dano e sobrevive a quem
   * estiver longe no momento da morte.
   */
  killEnemy(enemy, killer = null) {
    if (!enemy) return;

    // A guarda nao pode ser `alive === false`: o DamageSystem ja
    // marcou o mob como morto ANTES de chamar `onDeath`, entao
    // aqui o `alive` ja vem false na rota normal e o loot nunca
    // seria entregue. O marco de "ja processado" e um campo
    // proprio, que so esta rota escreve.
    if (enemy.rewardGranted) return;

    enemy.rewardGranted = true;

    enemy.alive = false;
    enemy.respawnTimer = 5;
    enemy.aiState = "dead";
    enemy.wanderTarget = null;
    enemy.alerted = false;
    enemy.provoked = false;
    enemy.stuckTimer = 0;
    enemy.sidestepTimer = 0;

    this.handleKill(enemy, killer ?? enemy.lastHitBy);
  }

  handleKill(enemy, killer = null) {
    // QUEM GANHA e o dono do abate, e nao quem estiver em foco.
    //
    // O `updateEnemies` e a parte COMPARTILHADA do tick: ele roda
    // fora do `withPlayer` de cada jogador, e o abate por DoT chega
    // aqui sem `killer`. O foco nessa hora e do ultimo jogador que
    // entrou, entao a missao, o bestiario, o xp e a recompensa iam
    // para quem nao matou - e a secundaria hunt nunca contava.
    //
    // O id da sessao e o id do jogador (`createPlayerSession` cria
    // o player com o id da sessao), entao o dono se localiza direto
    const owner = killer ?? enemy.lastHitBy ?? null;
    const sessao = owner?.id
      ? this.world.players.get(owner.id)
      : null;

    // Abate sem dono conhecido nao da NADA a ninguem. Creditar o
    // jogador em foco seria dar missao, xp e ouro para quem nao
    // matou -- e o sorteio de loot, que vem antes, colocaria moeda
    // e item na mochila de quem so estava no mapa.
    //
    // Por isso a sessao e resolvida ANTES do `collectFrom`: sem
    // dono, o loot nem e sorteado.
    if (!sessao) return;

    /**
     * O loot vai para a SESSAO do dono, e nao para a entidade do
     * jogador.
     *
     * Sao coisas diferentes: o `inventory` mora na sessao
     * (`createPlayerSession`), e `owner` aqui e a entidade `player`.
     * Passar a entidade fazia o `inventoryOf` nao achar `.inventory`
     * e cair no fallback, que e o inventario do jogador EM FOCO no
     * fim do tick. Nos testes com a matadora entrando por ultimo as
     * duas coisas coincidiam e o bug passava escondido; com tres
     * jogadores, o terceiro da fila recebia as moedas de um abate
     * alheio.
     */
    /**
     * O LOOT DO DONO so entra quando NAO ha party.
     *
     * Com party, o dono e creditado dentro do `repartirAbatePorParty`,
     * que divide o total entre todos. Creditar aqui E la dava o loot
     * cheio ao dono e mais uma parte: o unico membro de uma party de
     * tres recebia 1/3 a mais do que o mob tinha
     */
    const membrosDaParty = this.partnersDe(sessao.id);

    const temParty = membrosDaParty.length > 0;

    /**
     * O ITEM VAI PARA UM SO, e por isso o sorteio do loot tem de ser o
     * mesmo com e sem party.
     *
     * Sem party, o dono recebe tudo. Com party, o lote completo e o que
     * sera dividido — o item sai para um membro sorteado, e o ouro pela
     * divisao
     */
    const collected = temParty
      ? this.loot.roll(enemy, sessao?.lootFilter ?? this.loot.filter)
      : this.loot.collectFrom(enemy, sessao);

this.withPlayer(sessao.id, () => {
      // dentro do bloco, e nao antes: o "+16 moedas" e um aviso da]
      // SESSAO, e escrito fora daqui ele cairia no jogador que]
      // estivesse em foco no fim do tick]
      if (!temParty) {
        this.announceLoot(collected);

        /**
         * O ABATE DO DONO, SO SEM PARTY.
         *
         * Com party, quem credita missao, bestiario e XP de cada membro
         * — inclusive o dono — e o `repartirAbatePorParty`, logo abaixo.
         * Rodar os dois creditaria o dono DUAS vezes: um slime abatido
         * contava 2 na missao dele, o bestiario subia duas vezes, e o XP
         * era o inteiro mais uma fração
         *
         * Era o loot que ja ficava sem duplicar (o `collected` completo
         * so entrava sem party) e a missao que escapou
         */
        this.concederAbate(enemy, owner);
      }
    });

    /**
     * A PARTY recebe o MESMO abate.
     *
     * A divisao acontece AQUI e nao dentro do `concederAbate`, porque o
     * que muda nao e apenas para quem matou: e que os OUTROS membros
     * tambem contam o mesmo mob na missao deles
     *
     * E o `collected` ja sorteado que e dividido, e nao um sorteio novo
     * por membro: um item por abate, para o grupo inteiro. Sortear tres
     * vezes fara tres itens cairem em tres gente, e a party viraria uma
     * maquina de multiplicar loot
     */
    if (temParty) {
      this.repartirAbatePorParty(
        enemy,
        owner,
        collected,
        membrosDaParty,
      );
    }
  }

  /**
   * Os IDS de sessao da party de um jogador, ele fora.
   *
   * Vem do servidor: no modo rede o `PartyStore` mora la, e o motor so
   * le. No single player e `null` e o jogo segue como antes
   */
  partnersDe(sessionId) {
    /**
     * Os OUTROS membros, nunca o proprio jogador.
     *
     * O dono do abate ja foi credenciado em `handleKill` antes de vir
     * aqui. Inclui-lo na lista faria ele receber o gold duas vezes: uma
     * como dono e outra como "parceiro" de si mesmo
     */
    if (!this.partyStore) return [];

    return this.partyStore
      .membrosDe(sessionId)
      .filter((id) => id !== sessionId);
  }

  /**
   * O MESMO ABATE PARA TODOS OS MEMBROS DA PARTY.
   *
   * ## AS TRES DIVISAS
   *
   * - MISSAO e BESTIARIO contam o abate INTEIRO para cada um. Nao e
   *   divisao: o pedido foi "o mob que 1 matar deve contar na missao dos
   *   dois", e dividir a barra por dois faria a missao levar o dobro de
   *   tempo so por estar acompanhado
   *
   * - OURO e XP sao DIVIDIDOS: cada um recebe `total / membros`, e a
   *   sobra vai para o dono. E o que faz a party ser comparavel a jogar
   *   sozinho em numero de recurso
   *
   * - ITEM vai para UM so, sorteado. Um item por abate, e o dono do
   *   sorteio e quem pegou — quem matou entra no sorteio com o mesmo
   *   peso de quem nao matou
   */
  repartirAbatePorParty(
    enemy,
    owner,
    collected,
    membrosDaParty,
  ) {
    const todos = [owner?.id, ...membrosDaParty];

    const idsUnicos = [...new Set(todos.filter(Boolean))];

    const tipoId = enemy.isCreature
      ? enemy.id.replace(/_\d+$/, "")
      : null;

    /* -------------------------------------------------------------- */
    /* OURO E XP: DIVIDIDOS                                           */
    /* -------------------------------------------------------------- */

    const moedas = Math.floor(
      (collected.coins ?? 0) / idsUnicos.length,
    );

    const sobraMoedas =
      (collected.coins ?? 0) - moedas * idsUnicos.length;

    const xpTotal = xpForKill(enemy);

    const xp = Math.floor(xpTotal / idsUnicos.length);

    const sobraXp = xpTotal - xp * idsUnicos.length;

    /* -------------------------------------------------------------- */
    /* ITEM: SORTEADO PARA UM SO                                       */
    /* -------------------------------------------------------------- */

    /**
     * O ITEM VAI PARA UM MEMBRO SO.
     *
     * O sorteio e sobre o INDICE, e nao sobre a sessao: distribuir o item
     * para o dono e "sortear" seria o item ir sempre para quem matou, e
     * a party nao valeria nada
     *
     * O indice sai do mesmo sorteio que o `scatter` usa. E o `Math.random` que
     * sorteou o resto do loot, entao um teste com semente fixa continua
     * reproduzivel
     */
    const itens = collected.items ?? [];

    const destinoDoItem =
      itens.length > 0
        ? Math.floor(Math.random() * idsUnicos.length)
        : -1;

    /* -------------------------------------------------------------- */
    /* APLICANDO                                                      */
    /* -------------------------------------------------------------- */

    for (const [i, sessionId] of idsUnicos.entries()) {
      const sessao = this.world.players.get(sessionId);

      if (!sessao) continue;

      /**
       * A MOEDA E O XP DELES: mais a sobra, quando ha sobra.
       *
       * A sobra vai para os primeiros da lista, e o dono e o primeiro.
       * E o que faz a divisao fechar certinho — a soma das partes e
       * igual ao total, sem moeda que aparece do nada nem que some
       */
      const moedasDele = moedas + (i < sobraMoedas ? 1 : 0);

      const xpDele = xp + (i < sobraXp ? 1 : 0);

      this.withPlayer(sessionId, () => {
        if (moedasDele > 0) {
          sessao.inventory.addCoins(moedasDele);
        }

        /**
         * A MISSÃO E DO MEMBRO, e nao do dono.
         *
         * E o `onKill` deste jogador com o `typeId` e o nivel do bicho.
         * Sem o nivel, a missao de nivel 6 do Brejo contaria um limo do
         * Pantano
         */
        if (tipoId) {
          this.resolveQuestProgress(
            this.world.quests.onKill(tipoId, 1, enemy.level),
          );

          this.resolveBestiaryProgress(
            this.world.bestiary.onKill(tipoId, 1),
          );
        }

        if (xpDele > 0) {
          const levels = grantXp(this.world.player, xpDele);

          for (const level of levels) {
            this.announceLevelUp(level);

            this.resolveQuestProgress(
              this.world.quests.onLevelUp(level),
            );
          }

          if (levels.length > 0) {
            this.applyEquipment();
          }
        }

        const itensDele =
          i === destinoDoItem ? itens : [];

        if (itensDele.length > 0 || moedasDele > 0 || xpDele > 0) {
          this.announceLoot({
            coins: moedasDele,
            items: itensDele,
            party: idsUnicos.length > 1,
          });
        }

        this.sendSnapshot();
      });
    }
  }

  /**
   * Missao, bestiario e xp de UM abate, no contexto da sessao do
   * dono. O loot ja saiu antes, em `handleKill`, porque adrop no
   * chao e de todo mundo.
   */
  concederAbate(enemy, owner) {
    const typeId = enemy.isCreature
      ? enemy.id.replace(/_\d+$/, "")
      : null;

    if (typeId) {
      /**
       * O NIVEL vai junto do `typeId`.
       *
       * A missao "matar 5 limos de nivel 1" precisa saber o nivel do
       * bicho abatido: sem ele, o objetivo conta qualquer limo e o
       * jogador cumpre a missao no Brejo sem nunca ir ao Pantano
       */
      this.resolveQuestProgress(
        this.world.quests.onKill(typeId, 1, enemy.level),
      );

      this.resolveBestiaryProgress(
        this.world.bestiary.onKill(typeId, 1),
      );
    }

    const levels = grantXp(
      this.world.player,
      xpForKill(enemy),
    );

    for (const level of levels) {
      this.announceLevelUp(level);

      this.resolveQuestProgress(
        this.world.quests.onLevelUp(level),
      );
    }

    if (levels.length > 0) {
      this.applyEquipment();
      this.sendSnapshot();
    }
  }

  resolveBestiaryProgress(hunts) {
    if ((hunts ?? []).length === 0) return;

    for (const hunt of hunts) {
      this.showMessage(
        `Cacada do bestiario: ${hunt.title} (${describeBonus(hunt.reward)})`,
      );
    }

    // o bonus e permanente: recalcula os stats na hora
    this.applyEquipment();
    this.sendSnapshot();
  }

  resolveQuestProgress(quests) {
    /**
     * Toda vez que a lista de missoes muda, a missao de nivel e
     * reconferida contra o nivel ATUAL.
     *
     * E o que fecha o furo de quem chegou no nivel 5 ANTES de
     * `nivel_5` virar a missao atual: a missao anterior foi
     * concluida agora, a de nivel entrou, e o nivel do jogador ja a
     * cumpria. Sem esta chamada ela ficava mostrando 0 de 5 sem
     * nunca andar.
     *
     * A recursao e segura: depois do primeiro `syncLevel` a missao
     * de nivel ja nao e a atual, entao a segunda chamada volta
     * vazia na hora
     */
    const novas = this.world.quests.syncLevel(
      this.world.player?.level ?? 1,
    );

    if ((novas ?? []).length > 0) {
      quests = [...(quests ?? []), ...novas];
    }

    if ((quests ?? []).length === 0) return;

    for (const quest of quests) {
      this.showMessage(
        `Missão concluída: ${quest.name} — rewards esperando.`,
      );
    }

    /**
     * A recompensa NAO e paga aqui.
     *
     * Ela fica na fila de resgate do `QuestLog` e o painel mostra
     * [RECEBER]. Pagar no mesmo instante tirava do jogador a chance
     * de ver o que ganhou, e deixava o ouro na mochila sem nenhum
     * cartao na tela explicando de onde veio
     *
     * Quem paga e o `claimQuestReward`, pelo pedido do botao
     */
    this.sendSnapshot();
  }

  /**
   * Paga a recompensa de UMA missao concluida.
   *
   * E o unico lugar do motor que entrega moedas, xp e itens de
   * missao. O `questId` chega do cliente e por isso nao vale nada
   * aqui: o `QuestLog` procura a recompensa pela id e devolve `null`
   * se ela nao estiver na fila. Como `claim` remove a linha da fila
   * no mesmo passo que devolve, o segundo clique do mesmo botao
   * encontra a fila vazia e nao paga de novo
   *
   * Devolve `true` quando pagou e `false` quando nao havia nada
   */
  claimQuestReward(questId) {
    const entrada = this.world.quests.claim(questId);

    if (!entrada) {
      this.showMessage(
        "Essa recompensa já foi recebida.",
        true,
      );

      return false;
    }

    const { reward } = entrada;

    if (reward.coins > 0) {
      this.world.inventory.addCoins(reward.coins);
    }

    for (const item of reward.items ?? []) {
      this.world.inventory.add(item.itemId, item.count);
    }

    if (reward.xp > 0) {
      const levels = grantXp(this.world.player, reward.xp);

      for (const level of levels) {
        this.announceLevelUp(level);
      }
    }

    // o xp da missao pode ter subido o nivel, e o level-up recalcula
    // os stats. Sem isto o jogador ficaria com vida maxima antiga ate
    // o proximo abate
    this.applyEquipment();

    this.showMessage(
      `Recompensa recebida: ${descreverRecompensa(reward)}.`,
    );

    this.sendSnapshot();

    return true;
  }

  announceLevelUp(level) {
    this.showMessage(`NÃ­vel ${level} alcanÃ§ado!`);
  }

  announceLoot(collected) {
    const parts = [];

    if (collected.coins > 0) {
      parts.push(`+${collected.coins} moedas`);
    }

    for (const entry of collected.items) {
      const item = getItem(entry.itemId);

      if (!item) continue;

      parts.push(
        entry.count > 1
          ? `${item.name} x${entry.count}`
          : item.name,
      );
    }

    if (parts.length > 0) {
      this.showMessage(parts.join(" Â· "));
    }

    if (collected.dropped > 0) {
      this.showMessage(
        "InventÃ¡rio cheio: o excedente ficou no chÃ£o.",
        true,
      );
    }
  }

  /**
   * Envelhece os drops do chao. E a parte COMPARTILHADA: um drop
   * envelhece uma vez por tick, para todo mundo.
   */
  updateDrops(deltaTime) {
    this.loot.update(deltaTime);
  }

  /**
   * Recolhe o que esta no chao perto do jogador em foco.
   *
   * Isto e POR JOGADOR e nao pode ficar na parte compartilhada do
   * tick. La o `world.player` e a sessao em foco, que no servidor e
   * o ultimo jogador que entrou: so ele pegaria loot, e no instante
   * em que ninguem esta no mundo o `world.player` e `null` e o
   * `collectNear` abria o `player.id` numa excecao. Como a excecao
   * acontece DENTRO do tick, tres seguidos derrubavam o laco de
   * 20Hz do servidor inteiro.
   */
  coletarDropDoChao() {
    const player = this.world.player;

    if (!player) return;

    // o inventario vem explicito, da sessao deste jogador. O
    // `collectNear` receberia a entidade do jogador, e ela nao tem
    // `.inventory`: sem este argumento a mochila sairia do jogador em
    // foco, e o loot do chao iria para a pessoa errada
    const collected = this.loot.collectNear(
      player,
      undefined,
      this.world.session?.inventory,
    );

    if (collected.coins <= 0 && collected.items.length === 0) {
      return;
    }

    const parts = [];

    if (collected.coins > 0) {
      parts.push(`+${collected.coins} moedas`);
    }

    for (const entry of collected.items) {
      const item = getItem(entry.itemId);

      if (!item) continue;

      parts.push(
        entry.count > 1
          ? `${item.name} x${entry.count}`
          : item.name,
      );
    }

    if (parts.length > 0) {
      this.showMessage(parts.join(" � "));
    }

    if (collected.rejected > 0) {
      this.sendSnapshot();
    }
  }

  sendSnapshot() {
    if (!this.onSnapshot) return;

    // Sem sessao em foco nao ha painel de ninguem para montar.
    //
    // No servidor isso acontece de verdade: e o instante entre o
    // ultimo jogador sair e o proximo entrar. Sem esta guarda, o
    // `world.inventory` seria `null`, a montagem do painel estouraria
    // dentro do `setInterval`, e uma excecao la MATA o timer: o
    // servidor inteiro congelava e nao voltava nem com jogador
    // novo.
    if (!this.world.session) return;

    const player = this.world.player;
    const selectedTarget = this.getLiveTarget();

    this.onSnapshot({
      time: this.world.time,

      autoPlay: this.autoPlay,
      engaged: this.engagedTargetId !== null,
      bestiaryAuto: this.bestiaryAutoSnapshot(),

      inventory: this.world.inventory.summary(
        this.world.equipment,
      ),
      equipment: this.world.equipment.summary(),

      /**
       * O PORTAL EM BAIXO DO JOGADOR, ou `null`.
       *
       * Vai no PAINEL e nao no estado do mundo porque e uma leitura de
       * tela — e a box do minimapa so precisa saber que existe, e para
       * onde. E o mesmo motivo do rank: e dado do jogador, e o painel ja
       * e por jogador
       *
       * Sai reduced para tres campos. O painel vai por JSON no socket, e
       * mandar o objeto inteiro arrastaria as referencias de mapa e
       * destino — que o cliente nao tem como usar e nao deve conhecer
       */
      portal: this.dadosDoPortalNoPe(),
      lootFilter: this.lootFilterSummary(),
      bestiary: this.world.bestiary.snapshot(),
      quests: this.world.quests.snapshot(),
      /**
       * A PARTY, no painel.
       *
       * Vai por aqui e nao no `SNAPSHOT` do mundo porque a composicao do
       * grupo e dado do JOGADOR: cada um ve os mesmos nomes, mas so o
       * que importa e a box dele
       */
      party: this.partySnapshot(),
      craft: this.craftSnapshot(),
      collection: this.collectionSnapshot(),

      /**
       * O MARKET, no formato do painel.
       *
       * Vai no PAINEL e nao no snapshot do mundo pelo mesmo motivo do
       * rank: e dado por jogador, e o painel ja e por jogador
       *
       * O `marketStore` e INJETADO pelo servidor no construtor. No
       * single player ele e `null` e o painel vem vazio: o mercado
       * entre jogadores nao tem sentido com uma pessoa so
       */
market: this.marketStore
          ? snapshotMarket({
              store: this.marketStore,

              // a chave do DONO, e nao o id da sessao: e por ela que
              // o servidor separa "os meus anuncios" da vitrine, e o
              // id muda a cada entrada
              viewerKey: this.world.session?.donoKey ?? null,
              viewerName: player.name,
              coins: this.world.inventory.coins,
            })
          : EMPTY_MARKET,

      /**
       * O rank de quem esta conectado, nas duas ordens.
       *
       * Vai no PAINEL e nao no snapshot do mundo de proposito: o
       * painel ja e por jogador e vai 4x por segundo, e um rank a
       * 20Hz seria a mesma lista repetida cinco vezes para todo
       * mundo. E a ordem vem PRONTA do servidor, porque um cliente
       * que recebesse a lista cru e ordenasse no navegador
       * mostraria a posicao que quisesse.
       */
      rank: montarRank([...this.world.players.values()]),

      /**
       * A GUILDA, do jeito que ESTE jogador a ve.
       *
       * O store monta a vista, e nao o motor: quem sabe o papel, os
       * pedidos e os talentos destravados e o `GuildStore`. Aqui so
       * entra a sincronizacao dos pontos, que depende do relogio e do
       * saldo que mora na sessao
       */
      guilda: {
        ...this.guildaSnapshot(),

        /**
         * O RESULTADO da busca, quando o jogador mandou uma.
         *
         * A busca e a unica operacao de guilda que nao vem da sessao
         * dele: e sobre o MUNDO, e o resultado precisa voltar pelo mesmo
         * caminho do resto. Sem este campo o painel mostraria a lista
         * do ultimo pedido de outro jogador
         *
         * A lista vem do servidor por `searchResults`, e nao de um
         * `buscar()` local: as guildas sao do servidor, e refazer a
         * busca no cliente mostraria um mundo que so existe na tela
         */
        busca: this.searchResults ?? [],
      },

      player: {
        id: player.id,
        name: player.name,
        className: player.definition.name,
        level: player.level,
        xp: Math.floor(player.xp ?? 0),
        xpToNext: xpToNext(player.level ?? 1),

        /**
         * ONDE O PERSONAGEM ESTA NO MAPA.
         *
         * Arredondado, e nao bruto: o mostrador do canto esquerdo da
         * tela mostra numero inteiro, e um `1283.7291` piscando a cada
         * quadro e ilegivel
         *
         * E do DONO e vai no painel, pelo mesmo motivo do rank: os
         * outros jogadores nao precisam saber a posicao de quem nao esta
         * na mesma tela
         */
        x: Math.round(player.x),
        y: Math.round(player.y),

        hp: Math.ceil(player.hp),
        maxHp: player.maxHp,

        resource: Math.floor(player.resource),
        maxResource: player.maxResource,
        resourceName: player.definition.resource.name,

        shield: Math.ceil(player.shield),
        attack: player.attack,
        defense: player.defense,
        speed: player.speed,

        /**
         * A folha de stats, inteira.
         *
         * E o mesmo objeto que o `applyEquipment` montou, e nao uma
         * segunda conta feita no painel: e o que garante que o ATK
         * da tela seja o mesmo `attack` que o golpe usou
         *
         * A folha e do DONO e vai no painel, nao no snapshot do
         * mundo: os outros jogadores nao precisam saber os numeros de
         * quem nao esta na mesma tela
         */
        stats: player.stats ?? null,

        casting: Boolean(player.cast),
        castingName: player.cast?.action.name ?? null,

        statusEffects: this.statuses.snapshot(player),
      },

      cooldowns: {
        ...player.cooldowns,
      },

      // quais skills estao em automatico. o HUD le isto para
      // acender o `AUTO`; sem o campo, arrastar a skill funcionava
      // e nao sinalizava nada
      skillAuto: [...(this.sessaoDeJogador?.skillAuto ?? [])],

      selectedTarget: selectedTarget
        ? {
          id: selectedTarget.id,
          name: selectedTarget.name,
          level: Math.max(
            1,
            Math.round(selectedTarget.level ?? 1),
          ),
          hp: Math.ceil(selectedTarget.hp),
          maxHp: selectedTarget.maxHp,
          statusEffects: this.statuses.snapshot(
            selectedTarget,
          ),
        }
        : null,

      /**
       * O aviso e da SESSAO, lido aqui do jogador em foco. Buscar no
       * motor (`this.message`) colocaria o mesmo texto no painel de
       * todo mundo conectado, e o "+16 moedas" da Ana piscaria na
       * tela de todo mundo.
       */
      message: this.world.session?.message
        ? {
            text: this.world.session.message.text,
            bad: this.world.session.message.bad,
          }
        : null,
    });
  }

  boundLoop(timestamp) {
    if (this.destroyed) return;

    this.animationFrame = requestAnimationFrame(
      this.boundLoop,
    );

    const deltaTime = Math.min(
      (timestamp - this.lastTime) / 1000,
      0.05,
    );

    this.lastTime = timestamp;

    this.tick(deltaTime);
  }

  /**
   * Um passo de simulacao, com o desenho incluido.
   *
   * O servidor usa `update` direto e nunca chega aqui: ele tem o
   * proprio laço de tempo e nao tem onde desenhar. Ainda assim o
   * `render` e protegido, para o `tick` poder ser chamado em teste
   * sem canvas.
   */
  tick(deltaTime) {
    try {
      this.update(deltaTime);
      this.render();
    } catch (error) {
      this.reportFrameError(error);
    }
  }

  /**
   * O que ainda roda no cliente quando a simulacao e do servidor.
   *
   * Sao apenas contadores de DESENHO. Nada aqui decide onde alguem
   * esta, se algo morreu ou quanto dano foi dado: isso tudo veio no
   * snapshot. Se alguma coisa de gameplay entrasse aqui, o cliente
   * voltaria a ter uma segunda opiniao sobre o mundo.
   */
  updatePresentation(deltaTime) {
    // O SEU jogador tambem precisa de relogio de desenho.
    //
    // Antes so os jogadores distantes passavam por aqui, e o
    // arqueiro local ficava sem animacao de tiro E sem o balanco
    // do andar: o `resolveAnimation` lia `attackAnimation` e
    // `walkBlend`, que nobody atualizava. O resultado era o dano
    // acontecendo no servidor com o personagem parado no idle.
    this.animarJogador(this.world.player, deltaTime);

    for (const enemy of this.world.enemies) {
      /**
       * O flash branco do dano tem duracao contada em segundos e
       * precisa sumir sozinho, senao o mob ficaria piscando para
       * sempre apos levar um golpe
       *
       * O `!isRemote` importa: o jogador de outro navegador entra
       * no mesmo laco, e o tempo do flash DELE e contado pelo
       * `animarJogador` logo abaixo. Contar nos dois lugares gastaria
       * o tempo do flash do remoto em dobro, e a reacao dele
       * acabaria pela metade da dos mob
       */
      if (!enemy.isRemote && enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(
          0,
          enemy.hitFlash - deltaTime,
        );
      }

      /**
       * O relogio do golpe do MOB, e nao so do jogador.
       *
       * Quem põe o `attackAnimation` do mob e o pacote do servidor,
       * com o aviso `acting`. Se o valor fosse setado aqui e nunca
       * contido, ele ficaria em 0.28 para sempre e o mob
       * seguraria o arco permanentemente, que e o mesmo defeito que
       * o `REMOTO_ATAQUE` resolveu para o jogador.
       *
       * Este metodo so roda no modo rede, entao o offline nao e
       * afetado: la quem conta o tempo do golpe e a `EnemyAI`.
       *
       * O `isRemote` fica de fora de proposito: o jogador de outro
       * navegador e tratado pelo `animarJogador`, logo abaixo, que
       * JA conta o tempo dele E limpa o `firingTargetId` quando a
       * pose acaba. Contar aqui tambem gastaria o tempo em dobro e
       * a limpeza nunca encontraria o valor positivo.
       */
      if (!enemy.isRemote && enemy.attackAnimation > 0) {
        enemy.attackAnimation = Math.max(
          0,
          enemy.attackAnimation - deltaTime,
        );
      }

      if (enemy.isRemote) {
        this.animarJogador(enemy, deltaTime);
      }
    }

    for (const drop of this.world.drops) {
      drop.age = (drop.age ?? 0) + deltaTime;
    }
  }

  /**
   * O relogio de animacao de um jogador, seja ele o seu ou um
   * jogador distante.
   *
   * O servidor manda `isMoving` e um aviso de "esta atirando"; o
   * TEMPO anda aqui. Sem isto, o sprite ficaria congelado na
   * primeira pose do pacote, e o balanco do andar nunca
   * terminaria.
   *
   * E a MESMA conta que o jogador local usa no modo offline, para
   * os dois andarem igual. Por isso o metodo serve para os dois
   * casos: em modo rede ele roda em `updatePresentation`, e offline
   * em `updatePlayer`.
   */
  animarJogador(remoto, deltaTime) {
    /**
     * O flash do dano tem de andar AQUI, e nao so no `updatePlayer`.
     *
     * O `updatePlayer` e a simulacao local, e em modo rede ele nunca
     * roda: o `update` volta antes, no ramo `networked`. O unico
     * lugar que o cliente conta tempo de desenho e este metodo. Sem
     * esta conta, o `hitFlash` do seu jogador recebia o tempo que
     * sobrava do servidor e FICAVA PARADO no ultimo valor: o
     * personagem ficava branco para sempre e, como `resolveAnimation`
     * so devolve `hurt` com `hitFlash > 0`, ele nunca voltava para o
     * idle. Parecia que o golpe tinha grudado nele
     *
     * O pacote reescreve o valor a cada 50ms com o tempo que sobra
     * no servidor, entao o tremor continua suave: entre um pacote e
     * outro ele corre sozinho, e cada pacote corrige o relogio
     */
    if (remoto.hitFlash > 0) {
      remoto.hitFlash = Math.max(
        0,
        remoto.hitFlash - deltaTime,
      );
    }

    if (remoto.attackAnimation > 0) {
      remoto.attackAnimation = Math.max(
        0,
        remoto.attackAnimation - deltaTime,
      );

      // o sinal "atirando" so vale enquanto a arte corre: depois
      // disso o `firingTargetId` e limpo, senao o Arbalist ficaria
      // mirando para sempre
      if (remoto.attackAnimation === 0) {
        remoto.firingTargetId = null;
      }
    }

    const alvo = remoto.isMoving ? 1 : 0;

    remoto.walkPhase += deltaTime;

    remoto.walkBlend += (alvo - remoto.walkBlend) * Math.min(1, deltaTime * 10);

    remoto.animationTime = remoto.isMoving
      ? remoto.animationTime + deltaTime * 9
      : remoto.animationTime + deltaTime * 2;
  }
  /**
   * Liga ou desliga o modo desenho-apenas.
   *
   * Desligar volta a simulacao local, que e o que o single player
   * usa. Fica explicito em vez de derivado de "tem socket" porque
   * uma tela pode ter socket e ainda assim estar desenhando o
   * ultimo estado conhecido enquanto a conexao volta.
   */
  setNetworked(ligado) {
    this.networked = Boolean(ligado);
    return this.networked;
  }

  reportFrameError(error) {
    this.frameErrors += 1;

    if (this.frameErrors > 3) return;

    console.error(
      `[GameEngine] erro no frame: ${error?.message ?? error}`,
      error,
    );

    if (this.frameErrors === 3) {
      console.error(
        "[GameEngine] suprimindo logs de erro apos 3 falhas",
      );
    }
  }

  render() {
    // sem canvas nao ha o que desenhar. no servidor o `update` roda
    // sozinho e o estado vai por snapshot
    if (this.headless) return;

    /**
     * O TEMPO ENTRE DOIS DESENHOS.
     *
     * O `lastDrawAt` comecando em `null` e o que faz o primeiro quadro
     * nao dividir por zero: sem ele, `agora - null` seria `NaN` e o
     * `drawClock` viraria `NaN` para sempre, matando o balanco do NPC
     * para o resto da sessao
     */
    const agora = performance.now();

    if (this.lastDrawAt !== null) {
      this.drawClock += Math.min((agora - this.lastDrawAt) / 1000, 0.1);
    }

    this.lastDrawAt = agora;

    /**
     * O hover ANTES de qualquer desenho.
     *
     * O balanco do NPC e lido no `drawNpc`, e o `cursorMode` e lido pelo
     * `GameCanvas` no mesmo quadro. Se esta chamada viesse depois do laco
     * de desenho, o NPC reagiria um quadro atrasado e o cursor um
     * quadro atrasado em relacao aos dois — o balanco "acordaria" quando
     * o ponteiro ja tivesse ido embora
     */
    this.atualizarHoverDeNpc();

    const context = this.context;
    const { width, height, dpr } = this.viewport;
    const player = this.world.player;

    /**
     * A CAMERA.
     *
     * Sao tres passos, e a ordem e o que importa: primeiro o centro da
     * TELA, depois o zoom, e so entao o jogador para a origem do mundo.
     *
     * Com zoom 1 os dois primeiros `translate` se cancelam e sobra
     * exatamente o `translate(width/2 - player.x, ...)` de antes — o
     * enquadramento do vale nao muda em nada
     *
     * O zoom e aplicado ANTES do jogador virar a origem para que o
     * `scale` gire em torno do ponto que esta no centro da tela. Se o
     * `scale` viesse antes do `translate`, ele giraria em torno do canto
     * do canvas e o mundo andaria junto com o zoom
     */
    const z = this.cameraZoom;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.clearRect(0, 0, width, height);

    context.fillStyle = "#080c10";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(width / 2, height / 2);

    if (z !== 1) {
      context.scale(z, z);
    }

    context.translate(-player.x, -player.y);

    this.drawMap(context);
    this.drawAim(context);
    this.drawSelectedTarget(context);
    this.drawWorldSorted(context);
    this.effects.draw(context);
    this.drawEnemyHpBar(context);

    context.restore();

    if (this.input.pointer.inside) {
      this.drawCrosshair(context);
    }

    this.drawMinimap(context, width, height);
  }

  drawWorldSorted(context) {
    const list = this.world.sort;
    list.length = 0;

    if (this.props.isReady()) {
      for (const prop of this.props.collectVisible(
        this.world.props,
        this.getViewBounds(),
      )) {
        list.push({ y: prop.y, kind: 1, ref: prop });
      }
    }

    /**
     * Os NPCs entram com a PROPRIA linha de ordenacao.
     *
     * E o que faz o jogador passar ATRAS do mercador: a lista e
     * ordenada por `y`, e o NPC entra com o `y` do PE dele. Com o
     * jogador abaixo, o NPC e desenhado primeiro e o boneco passa por
     * cima; com o jogador acima, o NPC tapa a barra de pocoes — que e o
     * que um cenario com altura tem de fazer
     *
     * Um NPC nao e prop e nao e inimigo, entao precisa do proprio
     * `kind` para saber desenhar do jeito certo
     */
    for (const npc of this.npcs.collectVisible(
      this.world.npcs,
      this.getViewBounds(),
    )) {
      list.push({ y: npc.y, kind: 5, ref: npc });
    }

    for (const drop of this.world.drops) {
      list.push({ y: drop.y, kind: 2, ref: drop });
    }

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      list.push({ y: enemy.y, kind: 3, ref: enemy });
    }

    const player = this.world.player;

    if (player.hp > 0) {
      list.push({
        y: player.y,
        kind: 4,
        ref: player,
      });
    }

    list.sort((a, b) => a.y - b.y);

    for (const entry of list) {
      if (entry.kind === 1) {
        this.props.drawShadow(context, entry.ref);
        this.props.drawProp(context, entry.ref);
        continue;
      }

      if (entry.kind === 2) {
        this.drawDrop(context, entry.ref);
        continue;
      }

      if (entry.kind === 3) {
        this.drawEnemy(context, entry.ref);
        continue;
      }

      if (entry.kind === 5) {
        /**
         * O `hover` e o id que o `atualizarHoverDeNpc` guardou, e nao um
         * booleano calculado aqui: o `pickAt` e caro e ele ja rodou neste
         * quadro. E comparar id e o que sobrevive ao snapshot da rede,
         * que recria a lista de NPCs a cada pacote
         */
        const hover = this.npcHover === entry.ref.id;

        this.npcs.drawShadow(context, entry.ref, hover);
        this.npcs.drawNpc(context, entry.ref, hover, this.drawClock);
        continue;
      }

      this.drawPlayer(context);
    }

    this.drawProjectiles(context);
  }

/**
 * O APROXIMACAO DA CAMERA NESTE MAPA.
 *
 * O hub pede `1 / 0.7`: a camera fica 30% mais perto e o que cabe na
 * tela e 70% do que cabia. O vale pede `1` e fica como sempre
 *
 * E o que encolhe a TELA, nao o personagem. O boneco continua com
 * 128px no mundo; ele so parece maior porque a camera esta mais perto.
 * A diferenca importa: mexer na arte dele mudaria o COLISOR DE CLIQUE
 * e o alcance das habilidades, que sao medidas em unidades do mundo
 *
 * O `?? 1` e o que faz um mapa novo, sem o campo, nascer no
 * enquadramento normal
 */
get cameraZoom() {
  return this.world.map?.cameraZoom ?? 1;
}

/**
 * QUANTO DO MUNDO CABE NA TELA.
 *
 * Com zoom, a tela mostra `viewport / zoom` unidades de mundo. E este
 * retangulo e o que o culling consome — o mesmo usado por
 * `getViewBounds`, pelo terreno e pelas props
 *
 * Um zoom maior encolhe este retangulo: a camera ve menos mundo, entao
 * menos coisa precisa ser desenhada. Deixar o retangulo no tamanho da
 * tela nao quebraria a imagem, so faria o motor percorrer props que
 * estao fora da vista
 */
get visibleWorldSize() {
  const { width, height } = this.viewport;
  const z = this.cameraZoom;

  return {
    width: width / z,
    height: height / z,
  };
}

getViewBounds() {
  const { width, height } = this.visibleWorldSize;
  const player = this.world.player;

  return {
    x: player.x - width / 2,
    y: player.y - height / 2,
    width,
    height,
  };
}


  /**
 * O PORTAL EM QUE O JOGADOR ESTA EM CIMA.
 *
 * Devolve o portal com `destino`, ou `null`. Sao as tres condicoes que
 * a box da tela usa para aparecer:
 *
 * 1. **o portal tem destino.** Os dois do vale ainda nao tem, e por isso
 *    nao mostram box nenhuma. Um portal sem destino e um enfeite, e
 *    oferecer "ir para algum lugar" seria mentir
 * 2. **o jogador esta em cima.** O teste e um circulo de raio
 *    `size / 2` em volta do centro do portal. O raio e metade do lado do
 *    desenho, e nao a diagonal: a arte e redonda, e um quadrado
 *    incluiria os quatro cantos vazios
 * 3. **o destino existe no registro.** Um `destino` apontando para um id
 *    apagado faria a box prometer um mapa que o mundo nao tem
 */
portalSobOsPes() {
    const player = this.world.player;

    if (!player) return null;

    /**
     * `?? []` e obrigatorio, e nao defensiva a toa.
     *
     * O construtor chama o `sendSnapshot` ANTES de qualquer `setMap`, e
     * e `setMap` que monta `world.portals`. Sem isto, o primeiro painel
     * de um motor recem-construido estouraria em `not iterable` — e o
     * servidor engole excecao de painel de proposito, entao o sintoma
     * seria um painel que nunca chega, sem erro nenhum na tela
     */
for (const portal of this.world.portals ?? []) {
      if (!portal.destino) continue;

      /**
       * `findMap`, e nao `getMap`.
       *
       * O `getMap` cai no hub quando o id nao existe, e isso e o
       * comportamento certo para ENTRAR no mundo. Num destino de portal
       * seria um defeito silencioso: um `destino` apagado viraria
       * "volte para o hub", e a box prometeria uma viagem que ninguem
       * pediu. Com `findMap` o id errado vira `null` e a box nao aparece
       */
      const destino = findMap(portal.destino);

      if (!destino) continue;

    const raio = portal.size / 2;

    const dx = player.x - portal.x;
    const dy = player.y - portal.y;

    if (dx * dx + dy * dy > raio * raio) continue;

    return {
      portal,

      /** o texto da box vem do MAPA, e nao de uma copia no portal */
      nome: destino.name,
      destino,
    };
  }

  return null;
}

/**
 * ATRAVESSA O PORTAL EM QUE O JOGADOR ESTA.
 *
 * Este e o caminho do SINGLE PLAYER. Na rede quem manda e o servidor, e
 * ele refaz a mesma conferencia — o `portalSobOsPes` dele — antes de
 * trocar o mapa. Confiar no cliente seria aceitar teletransporte para
 * qualquer lugar
 *
 * Devolve `false` quando nao ha portal ligando o jogador a lugar nenhum
 */
/**
 * O PONTO DE CHEADA de um portal no mapa de destino.
 *
 * O portal declara o `id` do portal de chegada, e este procura esse
 * portal no mapa de destino e devolve o ponto. Devolve `null` quando o
 * portal nao declara chegada, ou quando o id declarado nao existe la —
 * e o chamador cai no spawn do mapa
 *
 * E o `id` do portal, e nao uma coordenada, para o ponto acompanhar o
 * portal se ele for movido
 */
chegadaDe(portal, destino) {
  if (!portal.chegada) return null;

  const alvo = (destino.portals ?? []).find(
    (p) => p.id === portal.chegada,
  );

  if (!alvo) return null;

  return { x: alvo.x, y: alvo.y };
}

travessarPortal() {
  const emCima = this.portalSobOsPes();

  if (!emCima) return false;

  const chegada = this.chegadaDe(
    emCima.portal,
    emCima.destino,
  );

  this.setMap(emCima.destino, { chegada });

  return true;
}

/**
 * O PORTAL EM BAIXO DO JOGADOR, no formato do PAINEL.
 *
 * Tres campos e nada mais: `id` para o botao pedir a travessia, `nome`
 * para a box mostrar o texto, e `destino` para o teste e para o log
 * dizerem aonde o portal leva
 *
 * A separacao existe porque o `portalSobOsPes` acima devolve o mapa
 * inteiro — o motor precisa dele para o `setMap`, e o cliente nao tem
 * como usar um mapa do servidor. O que cruza o socket e este objeto
 */
dadosDoPortalNoPe() {
  const emCima = this.portalSobOsPes();

  if (!emCima) return null;

  return {
    id: emCima.portal.id,
    destino: emCima.portal.destino,
    nome: emCima.nome,
  };
}

/**
 * A VISTA DE GUILDA do jogador em foco.
 *
 * Chamar `sincronizarPontos` AQUI, e no clique do painel, e o que faz o
 * accrue de uma hora chegar sem ninguem de guarda: o painel vai 4x por
 * segundo, entao o jogador ve o ponto na primeira linha depois de
 * voltar, sem precisar clicar em nada
 *
 * Sem store — no single player — devolve a arvore bloqueada e nada
 * mais, que e o que o painel sabe mostrar sem guilda nenhuma
 */
/**
 * A PARTY VAZIA, para quando nao ha `PartyStore`.
 *
 * E o estado do single player: uma box com "Criar party" que nao faz
 * nada. `null` seria o terceiro estado, e a tela teria de tratar "sem
 * party" e "sem party porque nao ha ninguem" como duas coisas
 *
 * O `max` vem do pedido de tres, e e o mesmo numero do `PartyStore`.
 * Estar escrito aqui tambem e o que faz o botao de convidar sumir sozinho
 * quando a party chega no limite
 */
partySnapshot() {
  if (!this.partyStore) return EMPTY_PARTY_SNAPSHOT;

  return this.partyStore.snapshot(this.world.session?.id, this.world);
}

guildaSnapshot() {
  const sessao = this.world.session;

  if (!this.guildStore) {
    return EMPTY_GUILD_SNAPSHOT;
  }

  const pontos = this.guildStore.sincronizarPontos(sessao);

  return this.guildStore.snapshotPara(
    chaveDaSessao(sessao),
    pontos,
  );
}

getLiveTarget() {
    if (this.selectedTargetId === null) {
      return null;
    }

    return (
      this.world.enemies.find(
        (enemy) =>
          enemy.id === this.selectedTargetId &&
          enemy.alive,
      ) ?? null
    );
  }

  hasLiveTarget() {
    return this.getLiveTarget() !== null;
  }

  /** inimigo debaixo do cursor, usando a mesma tolerancia do clique */
  getHoveredEnemy() {
    const pointer = this.input.pointer;

    if (!pointer?.inside) return null;

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      const reach = enemy.radius + 18;
      const distance =
        (enemy.x - pointer.x) ** 2 +
        (enemy.y - pointer.y) ** 2;

      if (distance > reach * reach) continue;

      // sobrepostos: o alvo atual tem prioridade para a barra nao pular
      if (enemy.id === this.selectedTargetId) {
        return enemy;
      }

      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }

    return best;
  }

  /** o que a barra de vida deve descrever: cursor primeiro, alvo depois */
  getInspectedEnemy() {
    return this.getHoveredEnemy() ?? this.getLiveTarget();
  }

  /** topo visual do mob, seja sprite seja corpo de fallback */
  enemyHeadTop(enemy) {
    // o outro jogador usa a folha da CLASSE dele, que tem outra
    // ancora e outra escala que a do mob. usar a do mob deixaria a
    // barra de vida e o nome flutuando no lugar errado
    const definition = enemy.isRemote
      ? getClassSprite(enemy.classId)
      : this.enemySprites.get(enemy.id)?.definition;

    if (!definition) return enemy.y - enemy.radius;

    return (
      enemy.y +
      (definition.footOffset ?? 0) -
      definition.anchorY * definition.scale
    );
  }

  drawMinimap(context, width, height) {
    if (!this.world.map) return;

    const panelWidth = Math.min(
      MINIMAP_WIDTH,
      width - MINIMAP_RIGHT * 2,
    );

    const panelHeight = Math.min(
      MINIMAP_HEIGHT,
      height - MINIMAP_TOP_IDLE - MINIMAP_RIGHT,
    );

    if (panelWidth < 80 || panelHeight < 60) {
      return;
    }

    const resting = this.hasLiveTarget()
      ? MINIMAP_TOP_TARGETED
      : MINIMAP_TOP_IDLE;

    const blend = 1 - Math.pow(
      1 - MINIMAP_SLIDE,
      this.frameDelta * 60,
    );

    this.minimapY += (resting - this.minimapY) * blend;

    if (Math.abs(resting - this.minimapY) < 0.5) {
      this.minimapY = resting;
    }

    const originX = width - MINIMAP_RIGHT - panelWidth;
    const originY = Math.round(this.minimapY);

    drawMinimap(context, {
      map: this.world.map,

      /**
       * As zonas do mapa que esta carregado.
       *
       * Antes eram as do vale, fixas. O hub tem `zones: []`, entao
       * o minimap dele fica sem nenhuma area pintada — que e o
       * correto: nao ha zona de mob no hub
       */
      zones: this.world.map.zones ?? [],
      player: this.world.player,
      enemies: this.world.enemies,
      /**
       * A FAIXA QUE A CAMERA VE, no minimapa.
       *
       * Sao as medidas do MUNDO que cabem na tela, e nao as medidas da
       * tela: com a camera mais perto, a faixa e menor e o retangulo
       * do minimapa encolhe junto. Passar o `viewport` direto faria o
       * minimapa mostrar uma area maior do que a tela mostra — o
       * jogador veria no mapa coisas que nao estao a vista
       */
      viewport: this.visibleWorldSize,
      width: panelWidth,
      height: panelHeight,
      originX,
      originY,
      transform: this.getMinimapTransform(
        panelWidth,
        panelHeight,
      ),
    });
  }

/**
 * A TRANSFORMACAO do minimapa: mundo -> painel.
 *
 * O resultado e memoizado porque `Math.min` e uma divisao por quadro, e
 * o cache evita as duas. A chave tem TRES partes, e o mapa e a mais
 * importante das tres
 *
 * Antes a chave era so o tamanho do painel. O painel e 240x146 em
 * qualquer mapa, entao o cache ACERTAVA na travessia e a escala do hub
 * ia para o vale: 0,124 em vez de 0,035. O resultado era o minimapa
 * mostrando o vale no tamanho do hub, e o jogador em (5799, 3981) a
 * 719px do canto — bem fora dos 240px do painel, ou seja, invisivel
 *
 * A comparacao e por IDENTIDADE, e nao por `map.id`. Dois mapas com o
 * mesmo id nao fazem sentido, mas o mesmo mapa em duas referencias
 * diferentes daria transformacoes iguais e so gastaria uma conta — e a
 * identidade garante que qualquer troca de mapa invalida, sem o
 * `setMap` ter que lembrar de limpar isto
 */
getMinimapTransform(panelWidth, panelHeight) {
  const map = this.world.map;
  const cache = this.minimapCache;

  if (
    cache &&
    cache.map === map &&
    cache.panelWidth === panelWidth &&
    cache.panelHeight === panelHeight
  ) {
    return cache.transform;
  }

  const transform = computeMinimapTransform(
    map,
    panelWidth,
    panelHeight,
  );

  this.minimapCache = {
    map,
    panelWidth,
    panelHeight,
    transform,
  };

  return transform;
}


  drawMap(context) {
    const map = this.world.map;

    /**
     * A janela visivel, em coordenada de mundo.
     *
     * Fica num variavel porque o terreno e o portal usam a MESMA, e as
     * duas chamadas usam os numeros repetidos. Duas copias da conta
     * divergiriam na largura ou na altura e o portal sairia meio tile
     * fora do lugar em uma das telas
     */
    const view = {
      x: this.world.player.x - this.viewport.width / 2,
      y: this.world.player.y - this.viewport.height / 2,
      width: this.viewport.width,
      height: this.viewport.height,
    };

    if (this.terrain.isReady()) {
      this.terrain.draw(
        context,
        map,
        map.zones ?? [],
        view,
      );
    } else {
      context.fillStyle = map.background;
      context.fillRect(0, 0, map.width, map.height);
    }

    /**
     * O PORTAL, logo depois do terreno.
     *
     * A ordem e o que faz o portal parecer deitado no chao:
     *
     * 1. **Depois do terreno** para nao cobrir a grama nem o ladrilho de
     *    terra das areas de mob — o portal esta no Pantano Profundo, e
     *    ele precisa ficar SOBRE a terra
     * 2. **Antes dos rotulos de zona**, porque o texto da zona e
     *    informacao de interface e nao faz parte do chao
     * 3. **Antes do `drawWorldSorted`**, que vem depois de `drawMap`:
     *    e o que faz os monstros passarem POR CIMA do portal em vez de
     *    sumirem debaixo dele
     */
    if (this.portals.isReady()) {
      this.portals.draw(
        context,
        portalsOf(map),
        view,
      );
    }

    for (const zone of map.zones) {
      context.fillStyle = zone.color;
      context.fillRect(
        zone.x,
        zone.y,
        zone.width,
        zone.height,
      );

      context.fillStyle = "rgba(255,255,255,0.17)";
      context.font = "600 16px Inter, sans-serif";
      context.textAlign = "center";
      context.fillText(
        zone.label,
        zone.x + zone.width / 2,
        zone.y + 35,
      );
    }

    /**
     * A LINHA CINZA DA BORDA FOI DESPENSADA.
     *
     * Era um `strokeRect` de 8px em `#647064` desenhado em cima de
     * `map.bounds`, e ele existia para mostrar onde o mapa acabava. Com
     * a sebe de arbusto fechando as quatro bordas — `BORDAS`, em
     * `src/data/maps/index.js` — a linha virou parede pintada de cinza
     * por cima da parede de verdade
     *
     * A `setMap`/`clampToBounds` continuam sendo o limite do mundo: so
     * deixou de haver uma linha na tela dizendo onde ele esta
     */
  }

  drawAim(context) {
    if (!this.input.pointer.inside) return;

    /**
     * O ALCANCE E A LINHA, e os dois somem na base.
     *
     * O circulo tracejado e o alcance do golpe e a linha tracejada e o
     * caminho da mira ate o ponteiro. Nenhum dos dois faz sentido no hub,
     * e o circulo e o mais errado dos dois: ele anuncia "voce acerta o
     * que estiver a esta distancia", e na base o golpe esta barrado. Era
     * um contradito com o portao do turno anterior, desenhado na tela
     *
     * A regra e a mesma de `useBasicAttack`, pelo mesmo metodo
     */
    if (!this.emZonaDeCombate()) return;

    const player = this.world.player;

    context.save();
    context.setLineDash([5, 8]);
    context.strokeStyle = "rgba(255,255,255,0.11)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(
      player.x,
      player.y,
      player.range,
      0,
      Math.PI * 2,
    );
    context.stroke();

    context.setLineDash([3, 10]);
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(
      this.input.pointer.x,
      this.input.pointer.y,
    );
    context.stroke();

    context.restore();
  }

  drawSelectedTarget(context) {
    const target = this.getLiveTarget();

    if (!target) return;

    context.save();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.setLineDash([7, 5]);
    context.beginPath();
    context.arc(
      target.x,
      target.y,
      target.radius + 10,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

  drawDrop(context, drop) {
    const color =
      drop.kind === "coins"
        ? COIN_COLOR
        : (rarityOf(getItem(drop.itemId))?.color ??
          "#ffffff");

    const bob = Math.sin(drop.age * 3 + drop.x) * 2;
    const size = drop.kind === "coins" ? 7 : 9;

    context.save();

    context.globalAlpha = 0.22;
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(
      drop.x,
      drop.y + 6,
      size * 1.5,
      size * 0.6,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.globalAlpha = 0.95;
    context.fillStyle = color;
    context.strokeStyle = "rgba(6, 10, 14, 0.9)";
    context.lineWidth = 2;

    context.beginPath();
    context.arc(drop.x, drop.y + bob, size, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(10, 14, 19, 0.9)";
    context.font = `700 ${drop.kind === "coins" ? 8 : 10}px Inter, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      drop.kind === "coins"
        ? String(drop.coins)
        : (getItem(drop.itemId)?.icon ?? "â€¢"),
      drop.x,
      drop.y + bob,
    );

    context.restore();
  }

  drawEnemy(context, enemy) {
    // um outro jogador esta na lista de inimigos, mas e desenhado
    // como JOGADOR: folha da classe dele e animacao de jogador.
    // sem este desvio, ele sairia com a figura de um mob
    if (enemy.isRemote) {
      this.drawJogadorRemoto(context, enemy);
      return;
    }

    const sheet = this.enemySprites.get(enemy.id);

    const drawn = sheet
      ? sheet.drawCreature(
          context,
          enemy,
          this.spriteTime + enemy.spriteOffset,
        )
      : false;

    if (!drawn) {
      this.drawEnemyBody(context, enemy);
    }
  }

  /**
   * barra de vida no estilo OSRS: nome, barra e numeros.
   * so aparece no mob sob o cursor ou no alvo, entao some com o clique.
   */
  drawEnemyHpBar(context) {
    const enemy = this.getInspectedEnemy();

    if (!enemy) return;

    const definition =
      this.enemySprites.get(enemy.id)?.definition;

    const barWidth = Math.max(
      78,
      (definition?.frameWidth ?? 32) *
        (definition?.scale ?? 1),
    );
    const barHeight = 9;

    const left = enemy.x - barWidth / 2;
    const top = this.enemyHeadTop(enemy) - 9;

    const maxHp = Math.max(1, Math.ceil(enemy.maxHp));
    const hp = Math.max(0, Math.ceil(enemy.hp));
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const filled = barWidth * ratio;

    context.save();
    context.textAlign = "center";
    context.lineJoin = "round";

    // moldura preta da barra
    context.fillStyle = "rgba(4, 6, 9, 0.92)";
    context.fillRect(
      left - 2,
      top - 2,
      barWidth + 4,
      barHeight + 4,
    );

    context.strokeStyle = "rgba(0, 0, 0, 0.9)";
    context.lineWidth = 1;
    context.strokeRect(
      left - 2.5,
      top - 2.5,
      barWidth + 5,
      barHeight + 5,
    );

    // preenchimento
    if (filled > 0) {
      context.fillStyle =
        ratio > 0.35 ? "#c1160f" : "#8f0f0a";
      context.fillRect(left, top, filled, barHeight);

      context.fillStyle = "rgba(255, 255, 255, 0.24)";
      context.fillRect(left, top, filled, 2);
    }

    // faixa de comportamento das criaturas
    if (enemy.isCreature) {
      context.fillStyle =
        BEHAVIOR_COLORS[enemy.behavior] ?? "#8d97a3";
      context.fillRect(
        left,
        top + barHeight + 3,
        filled,
        2,
      );
    }

    // nome
    context.font = "700 11px Inter, sans-serif";
    context.textBaseline = "bottom";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0, 0, 0, 0.85)";
    context.strokeText(enemy.name, enemy.x, top - 6);
    context.fillStyle = "#f0e6d2";
    context.fillText(enemy.name, enemy.x, top - 6);

    // numeros: nivel a esquerda e vida a direita, ancorados na barra
    // (sem measureText: os proxies de teste nao devolvem metricas)
    const level = Math.max(1, Math.round(enemy.level ?? 1));
    const textY = top + barHeight + 8;

    context.font = "700 9px Inter, sans-serif";
    context.textBaseline = "top";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0, 0, 0, 0.85)";

    const levelLabel = `Nv.${level}`;

    context.textAlign = "left";
    context.strokeText(levelLabel, left, textY);
    context.fillStyle = "#e5bb68";
    context.fillText(levelLabel, left, textY);

    const hpLabel = `${hp} / ${maxHp}`;

    context.textAlign = "right";
    context.strokeText(hpLabel, left + barWidth, textY);
    context.fillStyle = "#cfc3ae";
    context.fillText(hpLabel, left + barWidth, textY);

    context.textAlign = "center";

    // efeitos de status
    const dots = Math.min(4, enemy.statusEffects.length);

    for (let index = 0; index < dots; index += 1) {
      const effect = enemy.statusEffects[index];

      context.fillStyle = this.getStatusColor(effect.type);

      context.beginPath();
      context.arc(
        enemy.x - (dots - 1) * 5 + index * 10,
        top + barHeight + 22,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.restore();
  }

  drawEnemyShadow(context, enemy) {
    context.save();

    context.fillStyle = "rgba(0,0,0,0.28)";
    context.beginPath();
    context.ellipse(
      enemy.x,
      enemy.y + enemy.radius * 0.75,
      enemy.radius * 1.1,
      enemy.radius * 0.55,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.restore();
  }

  drawEnemyBody(context, enemy) {
    this.drawEnemyShadow(context, enemy);

    context.save();

    // o mesmo tremor do jogador: o flash abaixo ja existia, e sem o
    // deslocamento o golpe era so uma cor mudando num corpo parado
    const tremor = resolveHurtShake(enemy.hitFlash);

    if (tremor.x !== 0 || tremor.y !== 0) {
      context.translate(tremor.x, tremor.y);
    }

    context.fillStyle =
      enemy.hitFlash > 0 ? "#ffffff" : enemy.color;

    context.strokeStyle = "#2c2018";
    context.lineWidth = 4;

      context.beginPath();
      context.arc(
        enemy.x,
        enemy.y,
        enemy.radius,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();

      context.fillStyle = "#493424";
      context.fillRect(
        enemy.x - 5,
        enemy.y - 8,
        4,
        4,
      );
      context.fillRect(
        enemy.x + 3,
        enemy.y - 8,
        4,
        4,
      );

      context.strokeStyle = "#493424";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(enemy.x - 7, enemy.y + 10);
      context.lineTo(enemy.x + 8, enemy.y + 10);
      context.stroke();

    context.restore();
  }


  /**
   * O tiro do arquero zumbi.
   *
   * Ele vai para o MESMO `world.projectiles` do jogador, e nao para
   * uma lista nova, por um motivo pratico: o `estadoProjetis` do
   * servidor, o `WorldState` do cliente e o `drawProjectiles` ja
   * sabem ler dessa lista, mandando `action.projectileStyle` e
   * `action.color`. Um array separado obrigaria a reescrever as
   * tres pontas para o mesmo desenho de uma flecha.
   *
   * O que muda e o `hostile: true`: o alvo e um JOGADOR, nao um
   * mob, e quem leva o dano e quem estava em foco no `SkillSystem`
   * nao serve aqui.
   */
  dispararFlechaHostil(enemy, alvo) {
    if (!enemy?.ranged || !alvo) return false;

    const velocidade = enemy.projectileSpeed ?? 420;
    const direcao = normalize(alvo.x - enemy.x, alvo.y - enemy.y);

    if (direcao.x === 0 && direcao.y === 0) return false;

    if (this.world.projectiles.length >= MAX_FLECHAS) {
      return false;
    }

    this.world.projectiles.push({
      id: `${enemy.id}_flecha_${this.world.time}`,
      hostile: true,
      sourceId: enemy.id,
      targetId: alvo.id ?? null,

      x: enemy.x,
      y: enemy.y,
      radius: enemy.projectileRadius ?? 8,

      velocityX: direcao.x * velocidade,
      velocityY: direcao.y * velocidade,
      speed: velocidade,
      directionX: direcao.x,
      directionY: direcao.y,

      damage: enemy.damage,

      // o formato e o mesmo que o do jogador. `drawProjectiles` le o
      // estilo em `action.projectileStyle` e a cor em `action.color`,
      // e o `estadoProjetis` do servidor so manda esses dois campos
      action: {
        projectileStyle: enemy.projectileStyle ?? "arrow",
        color: enemy.projectileColor ?? enemy.color,
      },

      remaining: enemy.projectileLife ?? 2.5,
    });

    return true;
  }

  /**
   * Move as flechas do inimigo e resolve o acerto.
   *
   * Roda uma vez por tick, na parte compartilhada. O dano entra
   * dentro do `withPlayer` de quem foi atingido: e o escudo, o
   * status e o inventario que sao por sessao, e sem trocar o foco a
   * flecha do Bento abatia o escudo da Ana.
   */
  updateFlechasHostis(deltaTime) {
    const flechas = this.world.projectiles;

    for (
      let indice = flechas.length - 1;
      indice >= 0;
      indice -= 1
    ) {
      const flecha = flechas[indice];

      if (!flecha.hostile) continue;

      flecha.remaining -= deltaTime;

      flecha.x += flecha.velocityX * deltaTime;
      flecha.y += flecha.velocityY * deltaTime;

      const cor = flecha.action.color;

      const bateuNoChao =
        flecha.remaining <= 0 ||
        this.world.collision.circleHitsSolid(
          flecha,
          flecha.radius,
        );

      if (bateuNoChao) {
        flechas.splice(indice, 1);
        this.world.effects.burst(flecha.x, flecha.y, cor);
        continue;
      }

      const alvo = this.jogadorSobFlecha(flecha);

      if (!alvo) continue;

      // a flecha e consumida no acerto: sem este `splice` ela
      // atravessava o jogador e voltava a bater no tick seguinte
      flechas.splice(indice, 1);

      const atirante = this.world.enemies.find(
        (enemy) => enemy.id === flecha.sourceId,
      );

      this.withPlayer(alvo.sessao.id, () => {
        this.damage.applyDamage(atirante, alvo.player, {
          id: `${flecha.sourceId}_flecha`,
          damage: flecha.damage,
          damageType: "physical",
          color: cor,
        });
      });

      this.world.effects.burst(flecha.x, flecha.y, cor);
    }
  }

  /** o primeiro jogador vivo que a flecha esta tocando */
  jogadorSobFlecha(flecha) {
    for (const sessao of this.world.players.values()) {
      const player = sessao.player;

      if (!player || player.hp <= 0) continue;

      const dx = player.x - flecha.x;
      const dy = player.y - flecha.y;
      const alcance = flecha.radius + (player.radius ?? 20);

      if (dx * dx + dy * dy <= alcance * alcance) {
        return { sessao, player };
      }
    }

    return null;
  }

  drawProjectiles(context) {
    for (const projectile of this.world.projectiles) {
      const action = projectile.action;
      const color =
        action.color ??
        this.classDefinition.accent;

      context.save();

      context.translate(projectile.x, projectile.y);
      context.rotate(
        Math.atan2(
          projectile.velocityY,
          projectile.velocityX,
        ),
      );

      context.shadowColor = color;
      context.shadowBlur = 18;
      context.fillStyle = color;

      const style = action.projectileStyle;

      if (style === "arrow" || action.rain) {
        context.fillRect(
          -13,
          -2,
          22,
          4,
        );

        context.beginPath();
        context.moveTo(10, 0);
        context.lineTo(1, -6);
        context.lineTo(1, 6);
        context.closePath();
        context.fill();
      } else if (style === "blade") {
        context.rotate(Math.PI / 2);

        context.beginPath();
        context.moveTo(16, 0);
        context.lineTo(-12, -6);
        context.lineTo(-6, 0);
        context.lineTo(-12, 6);
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(0, 0, projectile.radius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(255,255,255,0.75)";
        context.beginPath();
        context.arc(
          -3,
          -3,
          projectile.radius * 0.32,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.restore();
    }
  }

  drawPlayer(context) {
    const player = this.world.player;

    if (player.hp <= 0) return;

    const cloaked = this.statuses.has(player, "cloak");

    context.save();
    context.globalAlpha = cloaked ? 0.45 : 1;

    context.fillStyle = "rgba(0,0,0,0.38)";
    context.beginPath();
    context.ellipse(
      player.x,
      player.y + 17,
      25,
      12,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    const drawnSprite =
      this.spriteSheet?.draw(
        context,
        player,
        this.spriteTime,
      ) ?? false;

    if (!drawnSprite) {
      this.drawPlayerBody(context, player);
    }

    context.restore();

    if (player.shield > 0) {
      context.save();
      context.strokeStyle = "rgba(109,197,255,0.75)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(
        player.x,
        player.y,
        31,
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.restore();
    }
  }

  drawPlayerBody(context, player) {
    const bob = player.isMoving
      ? Math.sin(player.animationTime) * 2
      : Math.sin(player.animationTime * 0.55) * 0.8;

    context.save();

    // O mesmo tremor do sprite. O corpo vetorial e o desenho de
    // quem nao tem arte, e sem o tremor essa reacao existiria so
    // para as classes com sprite: o golpe em um boneco de treino
    // seria invisivel
    const tremor = resolveHurtShake(player.hitFlash);

    if (tremor.x !== 0 || tremor.y !== 0) {
      context.translate(tremor.x, tremor.y);
    }

    context.translate(player.x, player.y);
    context.rotate(
      Math.atan2(
        player.facing.y,
        player.facing.x,
      ),
    );

    context.fillStyle = "#222b38";
    context.beginPath();
    context.ellipse(
      0,
      5 + bob,
      21,
      17,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.strokeStyle = this.classDefinition.accent;
    context.lineWidth = 4;

    context.beginPath();
    context.arc(
      0,
      5 + bob,
      18,
      0,
      Math.PI * 2,
    );
    context.stroke();

    context.fillStyle =
      player.hitFlash > 0
        ? "#ffffff"
        : this.classDefinition.accent;

    context.beginPath();
    context.arc(
      7,
      0 + bob,
      9,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.fillStyle = "#e7c7a2";
    context.beginPath();
    context.arc(
      10,
      0 + bob,
      5,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (player.attackAnimation > 0) {
      const weaponLength =
        player.definition.id === "arbalist"
          ? 35
          : 29;

      context.strokeStyle = "#e4e8ef";
      context.lineWidth =
        player.definition.id === "warrior"
          ? 7
          : 4;

      context.beginPath();
      context.moveTo(16, 12);
      context.lineTo(weaponLength, 12);
      context.stroke();
    }

    context.restore();
  }

  drawCrosshair(context) {
    /**
     * A MIRA NAO EXISTE NA BASE.
     *
     * A mira e desenhada em COORDENADA DE TELA`, colada no ponteiro, e
     * nao e a arte do cursor do navegador: sao duas coisas diferentes que
     * o jogador ve no mesmo pixel. Trocar o cursor para a mao de armadura
     * nao tirou nada, porque esta continua aparecendo por cima
     *
     * E o lugar dela e o mesmo do golpe: onde nao ha combate, nao ha o
     * que mirar. Um reticulo de alvo desenhado no hub seria a mesma
     * promessa que a mira de combate fazia — "aqui e um alvo" — sem
     * nenhum alvo possivel
     */
    if (!this.emZonaDeCombate()) return;

    const screenX =
      this.input.pointer.x -
      this.world.player.x +
      this.viewport.width / 2;

    const screenY =
      this.input.pointer.y -
      this.world.player.y +
      this.viewport.height / 2;

    context.save();
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(screenX, screenY, 8, 0, Math.PI * 2);
    context.moveTo(screenX - 13, screenY);
    context.lineTo(screenX - 5, screenY);
    context.moveTo(screenX + 5, screenY);
    context.lineTo(screenX + 13, screenY);
    context.moveTo(screenX, screenY - 13);
    context.lineTo(screenX, screenY - 5);
    context.moveTo(screenX, screenY + 5);
    context.lineTo(screenX, screenY + 13);
    context.stroke();
    context.restore();
  }

  getStatusColor(type) {
    return STATUS_COLORS[type] ?? "#ffffff";
  }
}

/**
 * A CHAVE do jogador, que e estavel entre conexoes.
 *
 * E a `donoKey` — o nome normalizado — e nao o `id` da sessao, que e
 * `p_<uuid>` e muda a cada entrada. Ler a guilda pelo id da sessao
 * fazia o bonus do talento sumir ao reconectar, mesmo com a guilda
 * intacta no servidor
 *
 * O `?? sessao.id` cobre o single player, onde nao ha `donoKey`
 */
function chaveDaSessao(sessao) {
  return sessao?.donoKey ?? sessao?.id ?? null;
}
