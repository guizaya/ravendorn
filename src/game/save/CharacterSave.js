import { MAX_LEVEL } from "../progression/Levels.js";
import { getItem } from "../../data/items/index.js";
import { normalizeLootFilter } from "../loot/lootFilter.js";
import { isEnchant } from "../../data/enchant/index.js";
import { getQuest, normalizeRewards, questScopeOf } from "../../data/quests/index.js";
import { GUILD_PONTOS_MAX } from "../../data/guild/index.js";

/**
 * O personagem em um arquivo: tirar e devolver.
 *
 * Este modulo e o UNICO lugar que sabe o que de uma sessao vira
 * arquivo. Ele nao toca em disco (isso e do servidor) e nao sabe de
 * nome de arquivo: so converte sessao em dado puro e dado puro em
 * sessao. Separar as duas coisas deixa o round trip testavel sem
 * subir servidor nem tocar em disco.
 *
 * A REGRA que guia o que entra: entra o que o jogador TRABALHOU
 * para conquistar, e nao o que o motor calculou. Nivel, xp, ouro,
 * inventario, equipamento, missoes e bestiario entram. Os stats
 * derivados (ataque, defesa, vida maxima) NAO entram: sao a soma da
 * classe com o nivel, o equipamento e o bonus do bestiario. Guardar
 * o resultado alem do resultado abriria um caminho para escrever
 * stat inventado a mao no arquivo.
 *
 * Vida e recurso NAO sao salvos de proposito: quem entra volta
 * com o barulho cheio. Salvar a vida faria o jogador reaparecer com
 * 3 de vida maxima e sair da tela sem entender o que aconteceu.
 */
export const SAVE_VERSION = 1;

/** teto de seguranca para numero que veio de fora */
const NUMERO_MAX = 1_000_000_000;

const numero = (valor, padrao = 0) => {
  const n = Number(valor);

  if (!Number.isFinite(n)) return padrao;

  return Math.min(NUMERO_MAX, Math.max(0, Math.trunc(n)));
};

const inteiro = (valor, padrao = 0) => numero(valor, padrao);

const texto = (valor, tamanho = 64) => {
  if (typeof valor !== "string") return null;

  const limpa = valor.slice(0, tamanho);

  return limpa.length > 0 ? limpa : null;
};

const lista = (valor) => (Array.isArray(valor) ? valor : []);

const objeto = (valor) =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor
    : {};

/**
 * O afixo no arquivo, ou `null`.
 *
 * So o `isEnchant` decide o que e afixo de verdade. Um save com
 * `{stat: "attack", rarity: "rare", power: 0.02}` passa; um com
 * `power: 999`, `stat: "inventado"` ou `rarity: "comum"` nao, e vira
 * `null` — a peca volta sem afixo em vez de colocar um numero
 * inventado dentro do stat do jogador
 *
 * O `null` e `null` e nao omitido: um afixo ausente e um afixo
 * "sem afixo" sao a mesma coisa, e o arquivo fica legivel
 */
const enchantParaSalvar = (bruto) => {
  if (!isEnchant(bruto)) return null;

  return {
    stat: bruto.stat,
    rarity: bruto.rarity,
    power: bruto.power,
  };
};

/**
 * O afixo lido do arquivo.
 *
 * E o `enchantParaSalvar` de novo, e nao um `toEqual` solto: o mesmo
 * arquivo passa pelo mesmo filtro nas duas pontas, entao um afixo que
 * o save aceita de volta e exatamente o que ele gravou
 */
const enchantDoArquivo = (bruto) => {
  const afixo = objeto(bruto);

  return enchantParaSalvar(afixo);
};

/**
 * Tira o personagem da sessao.
 *
 * `sessao` e a `PlayerSession` do servidor. O resultado e JSON
 * puro, pronto para `JSON.stringify`.
 */
export function snapshotSession(sessao) {
  const { player, inventory, equipment, quests, bestiary, collection } =
  sessao;

  return {
    version: SAVE_VERSION,
    name: sessao.name,
    classId: sessao.classId,
    savedAt: Date.now(),

    player: {
      level: player.level,
      xp: Math.floor(player.xp ?? 0),
      x: Math.round(player.x),
      y: Math.round(player.y),
    },

    inventory: {
      coins: Math.floor(inventory.coins ?? 0),
      overflow: Math.floor(inventory.overflow ?? 0),
      stacks: inventory.stacks.map((pilha) => ({
        itemId: pilha.itemId,
        rarity: pilha.rarity,
        count: pilha.count,

        /**
         * O afixo da peca, ou `null`.
         *
         * A peca enchanted e a MESMA peca: o `itemId`, a `raridade` e a
         * `count` nao mudam quando ela ganha um afixo, entao o save
         * precisa de um campo a parte para nao ter duas entradas do
         * mesmo item no arquivo
         *
         * Ele vai pelo `enchantParaSalvar`, e nao cru: um afixo com
         * `stat` desconhecido no arquivo lido voltaria como numero
         * invalido dentro do stat do jogador
         */
        enchant: enchantParaSalvar(pilha.enchant),
      })),
    },

    // so os slots OCUPADOS: um slot vazio e o estado inicial de todo
    // mundo e nao vale uma linha no arquivo
    equipment: equipment.slots
      .filter((slot) => slot.itemId)
      .map((slot) => ({
        slotId: slot.id,
        itemId: slot.itemId,
        rarity: slot.rarity,
        tier: slot.tier,
        enhance: slot.enhance,
        enchant: enchantParaSalvar(slot.enchant),
      })),

    quests: {
      mainIndex: quests.mainIndex,
      mainProgress: quests.mainProgress,
      mainDone: quests.mainDone,
      sideId: quests.sideId,
      sideProgress: quests.sideProgress,
      sideCompleted: quests.sideCompleted,
      completedSide: [...quests.completedSide],

      /**
       * A missao concluida e a recompensa NAO RESGATADA. sem isto,
       * um abate que fecha a missao no mesmo instante em que o
       * jogador fecha o navegador perderia a recompensa
       *
       * O `questId` viaja com a linha porque e ele que o painel usa
       * para desenhar o botao [RECEBER] e para garantir que o resgate
       * acontece uma vez so
       */
      pending: quests.pending.map((p) => ({
        questId: p.questId,
        scope: p.scope,
        reward: p.reward,
      })),
    },

    bestiary: {
      kills: [...bestiary.kills.entries()],
      completed: [...bestiary.completed],
    },

    /**
     * As COLECOES entregues e o bonus de stat que elas deram.
     *
     * `done` e o que o jogador viu; `bonus` e o que ele ganhou. Os
     * dois entram, e o `Collection.fromSave` reconstroi um a partir do
     * outro quando o campo novo ainda nao existe num save antigo — o
     * bonus das colecoes entregues nao pode evaporar por causa de uma
     * migracao
     *
     * A `pending` das colecoes foi embora com a recompensa em item:
     * ela so existia para o item que nao coubesse na mochila, e nao ha
     * o que nao couba numa recompensa de stat
     */
    collection: {
      done: [...collection.done],
      bonus: collection.bonus,
    },

    /**
     * O filtro de coleta do jogador.
     *
     * `null` e "pega tudo", e e o estado inicial de uma sessao nova.
     * O save guarda o filtro para o jogador nao abrir o jogo e
     * receber o loot todo de novo sem ter ajustado nada
     */
    lootFilter: sessao.lootFilter ?? null,

    /**
     * Os pontos de guilda, e o relogio deles.
     *
     * Guardar o `ultimoPontoEm` no save e o que faz o accrue offline
     * sobreviver a uma conexao que caiu: sem ele, o jogador que passou
     * a noite junta os pontos e, ao reconectar, comecaria a contar de
     * novo do zero e perderia a noite
     *
     * O save NAO guarda a qual guilda o jogador pertence. Quem guarda e
     * o `GuildStore`, no servidor: e estado compartilhado, e duas copias
     * permitiriam o jogador estar em duas guildas depois de reconectar
     */
    guilda: {
      pontos: sessao.guilda?.pontos ?? 0,
      ultimoPontoEm: sessao.guilda?.ultimoPontoEm ?? null,
    },
  };
}

/**
 * Devolve o personagem para a sessao.
 *
 * Tudo que vem de fora e tratado como nao confiavel, mesmo o arquivo
 * tendo sido escrito pelo servidor: arquivo editado a mao, de uma
 * versao futura, ou pela metade. Um `level: 9999` ou um `x: "abc"`
 * nao pode derrubar o servidor nem criar um personagem impossivel.
 *
 * A posicao entra no fim porque e o unico dado que depende de onde
 * o personagem esta no mapa, e a sessao ainda nao sabe: quem sabe e
 * o motor, que passa os limites.
 */
/**
 * Um personagem salvo em OUTRO mapa.
 *
 * A posicao do arquivo e uma coordenada do mapa em que ele foi gravado,
 * e nao do mapa em que ele esta entrando. Um personagem que jogou no
 * vale tem (3000, 2000) salvo; esse ponto fica em (3000, 2000) na base,
 * que so vai ate (1640, 1136) — o jogador nascia no vazio, invisivel e
 * sem saida, exatamente o que o clamp existia para impedir
 *
 * A saida e o SPAWN do mapa, e nao a borda: o limite cumpre o seu papel
 * de nao deixar ninguem fora, mas escolher o meio e o que faz o
 * personagem aparecer no chao em vez de encostado na parede
 */
export function applyCharacterSave(
  sessao,
  dados,
  { limites = null, spawn = { x: 1200, y: 800 } } = {},
) {
  const bruto = objeto(dados);

  const { player, inventory, equipment, quests, bestiary, collection } =
  sessao;

  // --- personagem ---
  //
  // `MAX_LEVEL` e o teto de verdade do jogo. Respeitar esse teto e o
  // que impede um arquivo adulterado de virar um personagem com
  // nivel 9999, cujo crescimento de stat quebraria o calculo de
  // vida maxima
  const p = objeto(bruto.player);

  player.level = Math.min(MAX_LEVEL, Math.max(1, inteiro(p.level, 1)));
  player.xp = inteiro(p.xp, 0);

  // --- inventario ---
  const inv = objeto(bruto.inventory);

  inventory.stacks = [];
  inventory.coins = inteiro(inv.coins, 0);
  inventory.overflow = inteiro(inv.overflow, 0);

  for (const pilha of lista(inv.stacks)) {
    const item = objeto(pilha);
    const itemId = texto(item.itemId, 64);

    // item fora do catalogo e descartado: um id forjado viraria um
    // item invisivel ocupando espaco do inventario
    if (!itemId || !getItem(itemId)) continue;

    const count = inteiro(item.count, 0);

    if (count <= 0) continue;

    // o `add` respeita a capacidade e o maximo de pilha: um arquivo
    // com 300 stacks volta truncado em vez de estourar o inventario
    inventory.add(itemId, count, texto(item.rarity, 32));

    /**
     * O afixo volta NA PILHA que o `add` acabou de criar.
     *
     * O `add` monta uma pilha nova com `uid` novo, entao o afixo nao
     * pode ser aplicado pelo `itemId` do arquivo: duas pecas iguais do
     * mesmo item e mesma raridade sao DUAS pilhas, e o afixo da segunda
     * acabaria na primeira
     *
     * Por isso o afixo e lido DEPOIS do `add`, da ultima pilha criada
     * para este `itemId` e `raridade`. Nao ha indice de pilha no save
     * para casar, entao este e o melhor que o formato permite
     */
    if (!enchantDoArquivo(item.enchant)) continue;

    const criado = inventory.findStack(
      itemId,
      texto(item.rarity, 32),
    );

    if (criado) criado.enchant = enchantDoArquivo(item.enchant);
  }

  // --- equipamento ---
  for (const slot of equipment.slots) {
    slot.itemId = null;
    slot.rarity = null;
    slot.tier = 0;
    slot.enhance = 0;
    slot.enchant = null;
  }

  for (const salvo of lista(bruto.equipment)) {
    const item = objeto(salvo);
    const slot = equipment.getSlot(texto(item.slotId, 32) ?? "");

    if (!slot) continue;

    const itemId = texto(item.itemId, 64);

    if (!itemId || !getItem(itemId)) continue;

    slot.itemId = itemId;
    slot.rarity = texto(item.rarity, 32);
    slot.tier = inteiro(item.tier, 0);
    slot.enhance = inteiro(item.enhance, 0);

    // o `restore` do Equipment ja valida o afixo pelo `isEnchant`, e
    // passa `null` quando o arquivo trouxer algo invalido
    slot.enchant = enchantDoArquivo(item.enchant);
  }

  // --- missoes ---
  const q = objeto(bruto.quests);

  quests.mainIndex = inteiro(q.mainIndex, 0);
  quests.mainProgress = inteiro(q.mainProgress, 0);
  quests.mainDone = q.mainDone === true;
  quests.sideCompleted = inteiro(q.sideCompleted, 0);
  quests.completedSide = new Set(
    lista(q.completedSide)
      .map((id) => texto(id, 64))
      .filter(Boolean),
  );

  // so uma secundaria ativa, e so uma que existe no catalogo: um id
  // forjado deixaria a caixa mostrando uma missao que ninguem
  // conseguiria completar
  const sideId = texto(q.sideId, 64);

  quests.sideId =
    sideId && quests.acceptsSide(sideId) ? sideId : null;

  quests.sideProgress = quests.sideId
    ? inteiro(q.sideProgress, 0)
    : 0;

  /**
   * As recompensas nao resgatadas voltam para a fila de resgate.
   *
   * Duas defesas, e as duas importam:
   *
   * 1. O `questId` precisa existir no catalogo. Um id forjado faria o
   *    painel mostrar um botao [RECEBER] para uma missao que ninguem
   *    conhece, e o resgate pagaria um numero que veio do arquivo
   *
   * 2. A recompensa e relida do CATALOGO, e nao do arquivo. O
   *    `reward` salvo e apenas a referencia de qual missao e: os
   *    numeros que o jogador recebe saem sempre de `data/quests`, e
   *    nao de um campo editavel a mao
   *
   * O filtro tambem tira o DUPLICADO pelo `questId`. Um arquivo com
   * a mesma missao duas vezes pagaria duas vezes, e o `splice` do
   * `claim` nao impediria: ele impede o segundo clique, nao um
   * arquivo adulterado
   */
  quests.pending = [];
  const vistas = new Set();

  for (const bruto of lista(q.pending)) {
    const p = objeto(bruto);
    const questId = texto(p.questId, 64);
    const quest = questId ? getQuest(questId) : null;

    if (!quest) continue;

    if (vistas.has(quest.id)) continue;

    vistas.add(quest.id);

    quests.pending.push({
      questId: quest.id,
      scope: questScopeOf(quest.id),
      reward: normalizeRewards(quest.rewards),
    });
  }

  // --- bestiario ---
  const b = objeto(bruto.bestiary);

  bestiary.kills = new Map();

  for (const par of lista(b.kills)) {
    if (!Array.isArray(par) || par.length !== 2) continue;

    const [creatureId, abates] = par;
    const id = texto(creatureId, 64);

    if (!id) continue;

    bestiary.kills.set(id, inteiro(abates, 0));
  }

  bestiary.completed = new Set(
    lista(b.completed)
      .map((id) => texto(id, 96))
      .filter(Boolean),
  );

  // --- colecoes ---
  //
  // Mesmo cuidado do bestiario: o `done` e um conjunto de id, e um id
  // forjado aqui faria uma colecao aparecer como entregue para quem
  // nao entregou. O `fromSave` do `Collection` e quem filtra pelo
  // catalogo de verdade, entao um id inventado e descartado em vez de
  // ressuscitar
  const c = objeto(bruto.collection);

  collection.fromSave({
    done: lista(c.done)
      .map((id) => texto(id, 64))
      .filter(Boolean),

    /**
     * O bonus de stat do arquivo.
     *
     * Os numeros entram por `numero` e as chaves sao filtradas pelo
     * CATALOGO, dentro do `Collection.fromSave`. Sem isso um save
     * editado colocaria `vit: Infinity` ou um stat inventado no
     * personagem do jogador no proximo login
     */
    bonus: objeto(c.bonus),
  });

  // --- filtro de coleta ---
  //
  // `null` volta como "pega tudo". Um arquivo sem o campo, ou com
  // algo que nao seja objeto, tambem: e assim que um save antigo,
  // escrito antes do filtro existir, continua carregando
  const f = objeto(bruto.lootFilter);
  const filtroVazio =
    Object.keys(f).length === 0;

  sessao.lootFilter = filtroVazio
    ? null
    : normalizeLootFilter(f);

  // --- pontos de guilda ---
  //
  // Tratados como nao confiaveis como o resto: um `ultimoPontoEm`
  // escrito a mao no futuro faria o accrue dar pontos sem passar uma
  // hora. O `numero` corta o `NaN` e o `Infinito`, e o piso do tempo
  // impede o "da 24 pontos agora"
  //
  // Um save antigo, sem o campo, recomeca em zero com o relogio em
  // `null` — e o que `sincronizarPontos` entende como "conta a partir
  // de agora"
  const g = objeto(bruto.guilda);

  sessao.guilda = {
    pontos: Math.min(
      GUILD_PONTOS_MAX,
      Math.max(0, Math.floor(numero(g.pontos) || 0)),
    ),

    ultimoPontoEm:
      numero(g.ultimoPontoEm, null) === null
        ? null
        : Math.floor(numero(g.ultimoPontoEm)),
  };

  // --- onde ---
  //
  // Um personagem salvo fora do mapa reaparece no vazio, invisivel
  // e sem saida. Os limites do mapa sao a rede de seguranca contra
  // isso, e quem passa eles e o motor — que e quem sabe em que mapa o
  // jogador esta
  //
  // Fora dos limites a resposta e o SPAWN, e nao a borda: o limite
  // existe para o personagem nao nascer no vazio, e o meio do mapa e
  // onde ele tem piso em volta. Prender o personagem na parede seria
  // trocar um defeito por outro
  const dentro = (valor, padrao, min, max) => {
    const n = Math.round(Number(valor));

    if (!Number.isFinite(n)) return padrao;

    if (min === undefined || max === undefined) return n;

    if (n < min || n > max) return padrao;

    return n;
  };

  player.x = dentro(
    p.x,
    spawn.x,
    limites?.minX,
    limites?.maxX,
  );

  player.y = dentro(
    p.y,
    spawn.y,
    limites?.minY,
    limites?.maxY,
  );

  return sessao;
}

/**
 * Deixa a vida cheia depois que os stats foram recalculados.
 *
 * O `applyEquipment` do motor e que fecha a conta: ele soma classe,
 * nivel, equipamento e bestiario e define o `maxHp`. So DEPOIS dele
 * que a vida pode ser preenchida, senao o valor seria limitado pelo
 * `maxHp` antigo, o da classe sem equipamento.
 */
export function refillVitals(sessao) {
  const { player } = sessao;

  player.hp = player.maxHp;
  player.resource = player.maxResource;
  player.shield = 0;

  // status, cooldown e cast NAO sao progresso: sao o que estava
  // acontecendo no ultimo instante. Recarregar envenenado ou com o
  // arco em recarga seria estranho
  player.statusEffects = [];
  player.cooldowns = {};
  player.cast = null;
  player.attackAnimation = 0;
  player.firingTargetId = null;
  player.hitFlash = 0;
}

/** a classe do personagem salvo, se o arquivo tem uma valida */
export function saveClassOf(dados) {
  return texto(objeto(dados).classId, 32);
}

/** o arquivo e de um formato que este servidor sabe ler? */
export function isReadableSave(dados) {
  const bruto = objeto(dados);

  if (bruto.version !== SAVE_VERSION) return false;

  return typeof bruto.name === "string" && bruto.name.length > 0;
}
