import { MAX_LEVEL } from "../progression/Levels.js";
import { getItem, ITEM_TYPE } from "../../data/items/index.js";
import { SKILL_PACKS } from "../../data/skills/index.js";
import {
  custoTotalDaArvore,
  nosConfiaveis,
} from "../../data/skills/tree.js";
import { normalizeLootFilter } from "../loot/lootFilter.js";
import { isEnchant } from "../../data/enchant/index.js";
import { getQuest, normalizeRewards, questScopeOf } from "../../data/quests/index.js";
import { GUILD_PONTOS_MAX } from "../../data/guild/index.js";
import { poderDe } from "../ranking/rank.js";
import {
  AUTO_POCAO_LIMIAR_PADRAO,
  AUTO_POCAO_LIMIAR_MIN,
  AUTO_POCAO_LIMIAR_MAX,
} from "../../data/potions/index.js";
import {
  passLogDoSave,
  premiumLogDoSave,
} from "../pass/passLog.js";
import { PASSE_PADRAO } from "../../data/passes/index.js";
import { sanear as sanearFarmOffline } from "../progression/OfflineFarm.js";
import { capacidadeConfiavel } from "../../data/inventory/capacidade.js";

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
  const {
    player,
    inventory,
    equipment,
    quests,
    bestiary,
    collection,
    bau,
  } = sessao;

  return {
    version: SAVE_VERSION,
    name: sessao.name,
    classId: sessao.classId,
    savedAt: Date.now(),

/**
       * O PODER, no RAIZ do save e nao dentro de `player`.
       *
       * E uma medida, e nao um atributo do personagem: ele nao muda quando o
       * jogador sobe de nivel, nao e equipavel e nao volta de uma morte.
       * Guardar dentro de `player` diria que ele e parte da ficha
       *
       * ## POR QUE ELE E GRAVADO E NAO RECALCULADO NA LEITURA
       *
       * Porque o save nao guarda os stats de combate, entao recalcular
       * devolveria zero para todo mundo que nao esta conectado. E o poder
       * e medido com uma tabela de pesos: se ela mudar amanha, quem foi medido
       * com a tabela antiga continua com o numero antigo
       */
      poder: poderDe(player),

      player: {
        level: player.level,
        xp: Math.floor(player.xp ?? 0),
        x: Math.round(player.x),
        y: Math.round(player.y),
      },

    inventory: {
      coins: Math.floor(inventory.coins ?? 0),

      /**
       * O STEEL ENTRA JUNTO DO GOLD, E O `?? 0` NAO E EXCESSO
       *
       * E o que faz um save antigo — gravado antes de existir a
       * mineracao — carregar steel em 0 sem precisar de migracao. Sem o
       * `??`, o `inteiro` de `undefined` seria `NaN`, e o `NaN` no steel
       * quebraria o badge da HUD para sempre, porque `NaN + 1` e `NaN`
       */
      steel: Math.floor(inventory.steel ?? 0),

      /**
       * O DIAMANTE ENTRA DO MESMO JEITO, E O MOTIVO E O MESMO
       *
       * Todo save anterior a moeda carrega 0 sem migracao, pelo mesmo `?? 0`
       * do `steel`. Sem ele o `inteiro` de `undefined` seria `NaN`, e um saldo
       * em `NaN` na barra de saldo do mercado mostraria "NaN" em vez de "0"
       */
      diamonds: Math.floor(inventory.diamonds ?? 0),

      /**
       * A CAPACIDADE DA MOCHILA, e ela e o que o jogador COMPROU.
       *
       * ## POR QUE O CAMPO PRECISA EXISTIR
       *
       * Porque sem ele a expansao vive so enquanto a sessao esta de pe. A
       * `capacity` nasce em 20 no construtor do `Inventory`, entao um save que
       * nao a guarda devolve o jogador para 20 slots no proximo login — com o
       * diamante ja debitado e o espaco sumido
       *
       * E ela passa por `capacidadeConfiavel` de novo na escrita, e nao so na
       * leitura: `snapshotSession` tambem e chamada em teste e em script, e um
       * `capacity: 99999` gravado por la voltaria cortado na leitura
       */
      capacity: capacidadeConfiavel(inventory.capacity),

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

        /**
         * O APRIMORAMENTO da peca na mochila.
         *
         * Pelo mesmo motivo do afixo: e um campo da PECA e nao do slot,
         * entao precisa de uma linha a parte no arquivo. Sem ela o
         * jogador reconectava e perdia todos os niveis pagos
         *
         * Vai cru e nao por um validador, diferente do afixo: o
         * `enhance` e um INTEIRO de contagem, nao um objeto com schema.
         * O `inteiro` abaixo e o que garante que um arquivo editado a mao
         * nao trave o `bonuses` com uma string
         */
        enhance: Math.max(0, Math.trunc(Number(pilha.enhance) || 0)),

    /**
     * A COMERCIALIZAVEL, ou `false`.
     *
     * Vem crua e nao por um `Boolean()` sem filtro: um save antigo, de antes
     * desta regra, nao tem o campo, e o `|| false` e o que faz esse arquivo
     * continuar carregando com a peca nao comercializavel em vez de quebrar
     * a leitura inteira
     */
    comercializavel: pilha.comercializavel === true,
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
     * O PASSE: os resgates e o interruptor do premium.
     *
     * ## POR QUE ISSO PRECISA DE SAVE E O RESTO DO PAINEL NAO
     *
     * Porque o resto do painel e VISUAL: fechar e abrir o passe redesenha a
     * mesma tela a partir do catalogo. Um resgate nao e visual — e um item
     * que o jogador JA TEM na mochila. Sem este campo, fechar o navegador
     * depois de resgatar o dia 3 devolveria o dia 3, e o jogador ganharia
     * o mesmo item todas as vezes que logasse
     *
     * ## POR QUE O PREMIUM VEM JUNTO
     *
     * Porque ele muda QUEM pode resgatar: com ele ligado, os dias premium
     * entram em `disponivel`. Guardar os resgates sem o interruptor daria um
     * personagem que nao consegue pegar o premio que a propria tela mostra
     * como disponivel
     */
passe: {
    premium: { ...sessao.passe.premium },
    resgatados: { ...sessao.passe.resgatados },
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
 * ## E AS PARCELAS, EM `entregues`
 *
 * `done` sozinho NAO GUARDA uma entrega parcial. Ele so vira `true`
 * quando a colecao INTEIRA fecha — entao um card de duas parcelas com
 * uma paga e uma nao era gravado como nada, e o relog mostrava as duas
 * de novo para entregar
 *
 * E o `entregues` e um objeto de `colecaoId -> [indices]`, que e o
 * formato que o `Collection.fromSave` ja le (e que o `Collection`
 * valida contra o catalogo). `done` continua indo junto porque e o
 * que um save antigo tem, e o `fromSave` precisa dele para refazer o
 * bonus
 *
 * A `pending` das colecoes foi embora com a recompensa em item:
 * ela so existia para o item que nao coubesse na mochila, e nao ha
 * o que nao couba numa recompensa de stat
 */
  collection: {
    ...collection.toSave(),
  },

    /**
     * O QUE ESTA GUARDADO NO BAU.
     *
     * ## POR QUE UM CAMPO DE TOPO E NAO DENTRO DO `inventory`
     *
     * Porque sao dois espacos com regras diferentes. A mochila tem 20 slots
     * e e o que o jogador carrega lutando; o bau tem 60 e e o que ele
     * deixou na base. Se os dois dividissem o campo, o save nao saberia
     * dizer em qual espaco cada pilha estava, e restaurar tudo na mochila
     * daria ao jogador um personagem que nao cabe em lugar nenhum
     *
     * ## POR QUE O `uid` NAO ENTRA
     *
     * Porque o `uid` e um contador de instancia, e o arquivo nao deve
     * prometer que o mesmo `uid` volta. O `add` gera um novo do mesmo
     * jeito — e e o `player.attack` do equipment que depende do numero,
     * nao o `uid`. Salvar o `uid` faria dois saves do mesmo personagem
     * terem ids diferentes para a mesma peca, e o id nao e consulted por
     * nada depois do restore
     *
     * O `enchant` e o `enhance` entram pelo mesmo caminho do inventario:
     * o `add` do baU nao sabe deles, entao sao religados na linha de baixo
     */
    bau: {
      stacks: (bau?.stacks ?? []).map((pilha) => ({
        itemId: pilha.itemId,
        rarity: pilha.rarity,
        count: pilha.count,
        enchant: enchantParaSalvar(pilha.enchant),
        enhance: Math.max(0, Math.trunc(Number(pilha.enhance) || 0)),

    /**
     * A COMERCIALIZAVEL, ou `false`.
     *
     * Vem crua e nao por um `Boolean()` sem filtro: um save antigo, de antes
     * desta regra, nao tem o campo, e o `|| false` e o que faz esse arquivo
     * continuar carregando com a peca nao comercializavel em vez de quebrar
     * a leitura inteira
     */
    comercializavel: pilha.comercializavel === true,
      })),
    },

    /**
 * As HABILIDADES QUE O PERSONAGEM APRENDEU.
 *
 * ## POR QUE ESTE CAMPO E OBRIGATORIO NO SAVE
 *
 * O `useSkillSlot` no servidor recusa qualquer skill que nao esteja na
 * lista. Sem isto no arquivo, o jogador que gastou 150 moedas e um livro
 * para aprender a Quick Shot perderia a habilidade no proximo login — e
 * o livro ja foi consumido, entao nao haveria como recuperar
 *
 * ## POR QUE SO O ID, E NAO O SLOT
 *
 * O `slot` e a posicao no array da classe. Reordenar o catalogo de
 * habilidades mudaria o slot de uma skill ja aprendida, e o save antigo
 * apontaria para a habilidade errada. O id (`arbalist_quick_shot`) e
 * estavel
 *
 * ## POR QUE VAI UM ARRAY E NAO O `Set`
 *
 * Porque o `Set` e um `Set` na memoria e um array no arquivo. O
 * `fromSave` reconstrói o `Set` ao ler, e e ele que filtra os ids contra
 * o pack da classe — um id forjado no arquivo nao vira habilidade
 */
    habilidades: [...(sessao.habilidadesAprendidas ?? [])],

    /**
     * OS PONTOS DE HABABILIDADE QUE AINDA NAO FORAM GASTOS.
     *
     * ## POR QUE FICA NO RAIZ E NAO DENTRO DE `player`
     *
     * Pelo mesmo motivo do `poder`: e uma carteira, e nao um atributo. Nao
     * morre com a vida, nao some quando o equipamento quebra, e nao cresce
     * com o nivel — ele cresce porque o jogador subiu de nivel, e so entao
     * vira numero guardado
     */
    pontosHabilidade: inteiro(sessao.pontosHabilidade),

    /**
     * OS NOS DA ARVORE QUE O PERSONAGEM INVESTIU.
     *
     * ## POR QUE UM ARRAY E NAO UM `Set` COMO AS HABILIDADES
     *
     * Pelo mesmo motivo: o `Set` e em memoria, o arquivo e JSON. E por isso
     * que ele passa pelo `nosConfiaveis` na leitura, que e o filtro que
     * confere o id contra a arvore DA CLASSE e exige que o no anterior
     * tambem esteja salvo
     *
     * ## E POR QUE E SEPARADO DAS `habilidades`
     *
     * Porque os dois se escrevem juntos mas nao sao a mesma coisa: um no pode
     * dar so bonus, sem skill nenhuma. Colar os dois num campo so faria o
     * bonus ser reconstruido pelo id da skill, e o bonus sumiria no primeiro
     * no passivo
     */
    nosArvore: [...(sessao.nosArvore ?? [])],

    /**
     * O filtro de coleta do jogador.
     *
     * `null` e "pega tudo", e e o estado inicial de uma sessao nova.
     * O save guarda o filtro para o jogador nao abrir o jogo e
     * receber o loot todo de novo sem ter ajustado nada
     */
    lootFilter: sessao.lootFilter ?? null,

    /**
     * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
     *
     * E a unica preferencia do painel de configuracao, e ela entra no save
     * pelo mesmo motivo do `lootFilter`: e uma escolha do jogador que ele
     * fez de proposito, e nao um estado de partida
     *
     * Um save antigo, sem o campo, recomeca em `null` — e o painel mostra
     * "escolha uma pocao" em vez de ligar o automatico sozinho
     */
    autoPocao: {
      ligado: Boolean(sessao.autoPocao?.ligado),
      limiar: sessao.autoPocao?.limiar ?? AUTO_POCAO_LIMIAR_PADRAO,
      itemId: sessao.autoPocao?.itemId ?? null,
    },

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

    /**
     * O FARM OFFLINE: o relogio e o relatorio que o jogador ainda nao viu.
     *
     * E o mesmo desenho da guilda acima, e pelo mesmo motivo: guardar o
     * `ultimoEm` e o que faz o accrue sobreviver a uma conexao que caiu.
     * Sem ele, quem ligou o farm e reconectou com o servidor no meio
     * recomecaria a contar do zero
     *
     * O `relatorio` tambem vai no save, e nao so na sessao, por um motivo
     * diferente: o accrue acontece ANTES do primeiro pacote, e o modal so
     * aparece depois. Entre um e outro o relatorio passa pelo `disconnect`
     * e pelo autosave de 30s — se ele so vivesse na sessao em memoria,
     * um servidor que reiniciasse nesse meio perderia a tela de "voce
     * voltou e ganhou isto" sem que o jogador pudesse mais ver
     */
    farmOffline: {
      ativo: sessao.farmOffline?.ativo === true,
      ultimoEm: sessao.farmOffline?.ultimoEm ?? null,
      mapaId: sessao.farmOffline?.mapaId ?? null,
      relatorio: sessao.farmOffline?.relatorio ?? null,
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
      {
        limites = null,
        spawn = { x: 1200, y: 800 },

        /**
         * O RELOGIO, e ele e injetavel pelo mesmo motivo do resto do jogo.
         *
         * O `sanear` do farm offline precisa do "agora" para CORTAR um
         * `ultimoEm` escrito no futuro. Usar `Date.now()` aqui punha o
         * servidor com o relogio proprio do motor, que e o `config.agora`
         * dele: um teste que mexe no relogio e um servidor de producao
         * leriam relogios diferentes na mesma restauracao
         *
         * O padrao continua `Date.now()` para quem chama sem relogio
         */
        agora = Date.now(),
      } = {},
    ) {
  const bruto = objeto(dados);

  const {
    player,
    inventory,
    equipment,
    quests,
    bestiary,
    collection,
    bau,
    passe,
  } = sessao;

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

  /**
   * O STEEL VOLTA COM 0 QUANDO O SAVE E ANTIGO.
   *
   * O `inteiro(..., 0)` e o mesmo do `coins`: um save sem o campo devolve
   * zero em vez de `NaN`. E `Math.max(0, ...)` porque um save editado a mao
   * com steel negativo mostraria um saldo negativo no badge, e nao ha
   * caminho no jogo que produza steel negativo
   */
  inventory.steel = Math.max(0, inteiro(inv.steel, 0));

    /**
     * O DIAMANTE VOLTA COM 0 QUANDO O SAVE E ANTIGO.
     *
     * Pelo mesmo motivo e pelo mesmo `Math.max` do `steel`: nenhum caminho do
     * jogo produz diamante negativo, e um save antigo nao tem o campo
     */
    inventory.diamonds = Math.max(0, inteiro(inv.diamonds, 0));

  /**
   * A CAPACIDADE VOLTA, E O SAVE ANTIGO VOLTA COM A BASE.
   *
   * E `capacidadeConfiavel` e nao `inteiro(inv.capacity, 20)` porque o
   * `inteiro` so devolve 0 para o que nao e numero: um `capacity: 10000` num
   * arquivo editado a mao passaria inteiro, viraria uma mochila de 10.000
   * slots sem um diamante pago, e o `Math.min` do teto e o que fecha isso
   *
   * E a expansao que COMPRA e a unica forma de passar de 20, entao o piso
   * aqui e o que garante que um save com `capacity: 0` ou `capacity: 12` nao
   * encolha a mochila do jogador
   */
  inventory.capacity = capacidadeConfiavel(inv.capacity);

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
    /**
     * O AFIXO E O APRIMORAMENTO voltam NA PILHA que o `add` criou.
     *
     * O `add` monta uma pilha nova com `uid` novo, entao nenhum dos dois
     * pode ser aplicado pelo `itemId` do arquivo: duas pecas iguais do
     * mesmo item e mesma raridade sao DUAS pilhas, e o dado da segunda
     * acabaria na primeira
     *
     * Por isso os dois sao lidos DEPOIS do `add`, da ultima pilha criada
     * para este `itemId` e `raridade`. Nao ha indice de pilha no save
     * para casar, entao este e o melhor que o formato permite
     *
     * ## POR QUE O `continue` VIROU UM `if`
     *
     * Antes ele era `if (!afixo) continue`, e isso pulava a pilha INTEIRA
     * quando a peca nao tinha afixo. Com o aprimoramento na mesma volta,
     * o `continue` teria deixado de fora toda peca aprimorada e sem afixo
     * — que e a maioria depois de usar a aba
     */
/**
         * O `add` RECEBE O APRIMORAMENTO E O AFIXO, E NAO SO O `itemId`.
         *
         * ## O QUE ESTAVA QUEBRADO
         *
         * A chamada era `add(itemId, count, rarity)` e o `enhance` e o
         * `enchant` eram colados DEPOIS, na pilha que o `add` achasse. Com
         * peca sem aprimoramento — o caso comum — isso funcionava.
         *
         * Com peca APRIMORADA, nao: o `add` nao sabia do nivel e FUNDEU a
         * peca numa pilha existente do mesmo item e mesma raridade. As duas
         * viravam UMA, e o afixo acabava na pilha errada — a que o jogador
         * ja tinha
         *
         * ## POR QUE IMPORTA
         *
         * Duas pecas iguais do mesmo item e mesma raridade sao DUAS pilhas, e
         * cada uma tem o seu afixo e o seu nivel. O `findStack` devolve a
         * primeira, e o afixo da segunda era aplicado na primeira. Depois de
         * recarregar, a peca encantada aparecia sem afixo e a errada com o
         * afixo dos dois
         *
         * E o `add` ja sabia fazer isso: ele cria uma pilha SO quando o
         * `enhance` e maior que zero, justamente para o afixo nao ser
         * compartilhado. Bastava passar o numero
         */
      const nivel = Math.max(0, Math.trunc(Number(item.enhance) || 0));

      const afixo = enchantDoArquivo(item.enchant);

      /**
       * A COMERCIALIZAVEL VOLTA NO `add`, E O RESTO DO BLOCO DEPENDE DISSO.
       *
       * ## O QUE FALTAVA AQUI
       *
       * O `toCharacterSave` grava `comercializavel: pilha.comercializavel ===
       * true` em cada pilha do arquivo — o dado estava sendo salvo desde sempre.
       * Mas o `add` desta linha recebia so `enhance` e `enchant`, e o
       * `comercializavel` ficava no `false` do default
       *
       * O sintoma era: o jogador dropar uma peca comercializavel, ver o selo
       * na mochila, recarregar, e a peca voltar sem o selo. O item estava
       * intacto — o que se perdia era a PERMISSAO de vender, e ela nao tem
       * visivel nenhum alem do selo
       *
       * ## POR QUE NAO BASTAVA REAPLICAR DEPOIS, COMO O AFIXO
       *
       * Porque o `add` funde pilhas de material, e o bloco de reforco aqui
       * (linha 596) so reescreve `enchant` e `enhance`. Um
       * `criado.comercializavel = ...` depois do `add` apareceria no codigo
       * como conserto de uma coisa que o `add` ja resolve certo
       *
       * ## E POR QUE O `=== true` E REPETIDO AQUI
       *
       * Porque um arquivo editado a mao pode ter `comercializavel: "sim"`, e
       * um truthiness solto aceitaria a string. A regra e do SERVIDOR: so
       * `true` de verdade, igual ao `toCharacterSave`
       */
      const comercializavel = item.comercializavel === true;

      inventory.add(itemId, count, texto(item.rarity, 32), {
        comercializavel,
        enhance: nivel,
        enchant: afixo,
      });

      /**
       * O REFORCO, e ele e quase sempre desnecessario.
       *
       * O `add` ja recebeu o afixo e o nivel, entao a pilha esta correta.
       * Este bloco existe para o caso em que o `add` FUDIU a peca numa pilha
       * que ja existia — e, depois da correcao acima, isso so acontece quando
       * a peca NAO tem aprimoramento, caso em que o `add` ja levou o afixo
       *
       * E ele nao pode mais ser um `continue`: um `continue` aqui pularia a
       * pilha INTEIRA, e com ele o `count` que o `add` acabou de gravar. A
       * pilha sumiria do inventario
       */
      const criado = inventory.findStack(
        itemId,
        texto(item.rarity, 32),
      );

      if (!criado) continue;

      if (afixo && !criado.enchant) criado.enchant = afixo;

      if (nivel && !criado.enhance) criado.enhance = nivel;
  }

    /**
     * --- bau ---
     *
     * O bloco INTEIRO do inventario acima, repetido com `bau` no lugar
     * de `inventory`. E a repeticao que o projeto aceita de proposito:
     *
     * `bau` e um `Inventory` como o outro, com as mesmas tres coisas que
     * um arquivo pode adulterar — `itemId` fora do catalogo, `count`
     * negativo e afixo com `stat` desconhecido. Um `helper` que fizesse
     * `restaurarPilha(alvo, dados)` resolveria as duas metades em uma
     * funcao, e o `bau` e a coisa que mais vai crescer no jogo: quando
     * vier o bau de conta compartilhada, esse helper e o que precisa
     * ganhar o parametro
     *
     * O `bau.stacks = []` comeca zerado porque a sessao pode ja ter
     * recebido um `add` antes do restore: o `entrar` monta a sessao,
     * chama `applyCharacterSave` e so depois da o primeiro pacote. Sem
     * esta linha, um restore em uma sessao reaproveitada somaria as duas
     * listas
     */
    const bauSalvo = objeto(bruto.bau);

    if (bau) {
      bau.stacks = [];

      for (const pilha of lista(bauSalvo.stacks)) {
        const item = objeto(pilha);
        const itemId = texto(item.itemId, 64);

        /**
         * As MESMAS TRES RECUSAS do inventario acima, e pelas MESMAS
         * razoes: id fora do catalogo viraria um item invisivel ocupando
         * slot do bau, e `count` negativo faria o `add` receber um numero
         * que ele nao sabe tratar
         */
        if (!itemId || !getItem(itemId)) continue;

        const count = inteiro(item.count, 0);

        if (count <= 0) continue;

        /**
         * O BAU LEVA A MESMA COERENCIA DO INVENTARIO: os tres campos
         * que o arquivo guarda, os tres no `add`.
         *
         * O `add` do bau recebia os tres argumentos de posicao e NADA mais —
         * a comercializavel ficava no `false` do default, pelo mesmo motivo
         * do inventario acima
         */
        bau.add(itemId, count, texto(item.rarity, 32), {
          comercializavel: item.comercializavel === true,
          enhance: Math.max(0, Math.trunc(Number(item.enhance) || 0)),
          enchant: enchantDoArquivo(item.enchant),
        });
      }
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

  // --- passe ---
  //
  // O resgate e o que impede o jogador de pegar o MESMO item de novo, e o
  // save e a unica coisa que sobrevive ao relogin: se um resgate nao
  // voltasse, fechar o navegador devolveria o dia inteiro. O `passLogDoSave`
  // descarta o que nao for lista de dias e tira o dia repetido, entao um
  // arquivo adulterado nao vira resgate repetido em memoria
  const pv = objeto(bruto.passe);

  /**
  * O PREMIUM E POR PASSE, e o save antigo nao sabe disso.
  *
  * Um `premium: true` de quando o campo era global nao tem passe nenhum
  * junto. Ele vira o passe PADRAO ligado: e o passe que o jogador ve aberto
  * quando entra no painel, entao dar o premium a ele e a leitura que menos
  * o engana — em vez de dar os dias pagos dos tres passes de graca, ou de
  * perder o que o jogador pagou
  */
  passe.premium = premiumLogDoSave(
    objeto(pv.premium) ? pv.premium : pv.premium === true
      ? { [PASSE_PADRAO.id]: true }
      : null,
  );
  passe.resgatados = passLogDoSave(pv.resgatados);

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
     * AS PARCELAS JA PAGAS.
     *
     * Sem esta linha o `done` sozinho devolvia a colecao INTEIRA, e uma
     * entrega parcial — a primeira de duas — se perdia: o relog mostrava
     * as duas parcelas de novo, e o jogador entregava o mesmo material
     * duas vezes para receber o mesmo stat
     *
     * O `fromSave` e quem valida: ele confere o id contra o catalogo e
     * o indice contra o total de requisitos, e descarta o que nao bate
     */
    entregues: objeto(c.entregues),

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

  // --- habilidades aprendidas ---
  //
  // O `Set` e recriado do zero, e nao acrescido: um save editado nao
  // pode acrescentar nada ao que a sessao ja tinha
  //
  // O FILTRO e o ponto. O id salvo precisa ser uma skill do pack DESTA
  // classe: sem esta conferida, um arquivo com
  // `"warrior_void_slash"` num Arbalist ensinaria uma habilidade que o
  // `useSkillSlot` dele nem acha por slot — e o jogador entraria com uma
  // skill invisivel na barra
  //
  // A ULTIMATE NAO PASSA AQUI. Ela nao esta no `Set` e nunca entra: e
  // liberada pelo nivel, que ja foi lido e limitado no topo desta funcao
  sessao.habilidadesAprendidas = new Set(
    lista(bruto.habilidades)
      .map((id) => texto(id, 64))
      .filter((id) =>
        SKILL_PACKS[sessao.classId]?.skills?.some(
          (skill) => skill.id === id,
        ),
      ),
  );

  // --- arvore de habilidade ---
  //
  // O `nosConfiaveis` ja faz o trabalho sujo: confere cada id contra a
  // arvore da CLASSES e descarta o no cujo pre-requisito nao veio junto. Um
  // save forjado com `"sorcerer_orb"` num Warrior entra vazio, e o bonus
  // simplesmente nao existe — que e a resposta certa para arquivo nao
  // confiavel, e nao uma excecao
  sessao.nosArvore = nosConfiaveis(
    sessao.classId,
    lista(bruto.nosArvore)
      .map((id) => texto(id, 64))
      .filter(Boolean),
  );

  /**
   * OS PONTOS QUE SOBRARAM, E O TETO DE CIMA DELES.
   *
   * O `custoTotalDaArvore` e o teto porque o save nao confia no numero: um
   * arquivo com `pontosHabilidade: 9000` daria pontos infinitos e o jogador
   * maxaria a arvore no nivel 1. Ja investidos sao descontados porque eles
   * foram GASTOS de pontos que o jogador tinha — um save honesto nunca passa
   * do total, mas um save antigo, ou um que veio de antes da arvore existir,
   * pode
   */
  const pontosDoArquivo = inteiro(bruto.pontosHabilidade);

  sessao.pontosHabilidade = Math.max(
    0,
    Math.min(
      pontosDoArquivo,
      Math.max(
        0,
        custoTotalDaArvore(sessao.classId) - sessao.nosArvore.size,
      ),
    ),
  );

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

  // --- uso automatico da pocao ---
  //
  // Os tres campos do arquivo sao nao confiaveis como o resto. O `itemId`
  // passa pelo catalogo, e nao pela lista de pocoes de cura do motor: o
  // `getItem` devolve `null` para um id que nao existe, e e esse `null` que
  // recusa o item. Um arquivo com `itemId: "arco"` nao viraria uma pocao
  // magica
  //
  // E o `ligado` so sobrevive COM pocao: um save escrito a mao com
  // `ligado: true` e `itemId: null` deixaria o automatico ligado sem nada
  // para beber, e o painel mostraria "ligado" com o slot vazio
  const autoPocao = objeto(bruto.autoPocao);

  const itemIdDaPocao = texto(autoPocao.itemId, 64);

  const ePocaoDeCura =
    itemIdDaPocao !== null &&
    (() => {
      const item = getItem(itemIdDaPocao);

      if (item?.type !== ITEM_TYPE.POTION) return false;

      return Boolean(item.use?.heal || item.use?.regeneration);
    })();

  const limiarDaPocao = Math.round(
    numero(autoPocao.limiar, AUTO_POCAO_LIMIAR_PADRAO),
  );

  sessao.autoPocao = {
    ligado: ePocaoDeCura && autoPocao.ligado === true,
    limiar: Math.max(
      AUTO_POCAO_LIMIAR_MIN,
      Math.min(AUTO_POCAO_LIMIAR_MAX, limiarDaPocao),
    ),
    itemId: ePocaoDeCura ? itemIdDaPocao : null,
  };

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

  // --- farm offline ---
  //
  // O `sanear` do `OfflineFarm` e quem valida isto, e nao uma sequencia de
  // `numero()` espalhada aqui: ele ja sabe o que e um relogio absurdo, e
  // a lista de itens do relatorio tem um teto de tamanho que o painel
  // respeita. Duplicar essas regras neste arquivo faria as duas
  // versao divergirem — e a que diverge e a que o jogador ve
  //
  // Um save antigo, sem o campo, entra com `estadoInativo`: farm desligado,
  // relogio `null`, sem relatorio. Que e o mesmo estado de quem nunca
  // tocou no botao
  sessao.farmOffline = sanearFarmOffline(
    bruto.farmOffline,
    agora,
    sessao.mapId ?? null,
  );

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

  /**
   * O GOLPE EM LOOP TAMBEM NAO E PROGRESSO.
   *
   * E a mesma razao das duas linhas acima: `attackAnimation` e
   * `firingTargetId` sao "o que estava acontecendo no ultimo instante", e o
   * `attackLoop` e a terceira face da mesma coisa
   *
   * Sem esta linha o jogador abriria o jogo ja com o personagem em pose de
   * ataque, parado no meio de um combate que nao existe mais — e o motor so
   * reescreve o booleano no primeiro update, o que deixaria um quadro errado
   * no primeiro paint
   */
  player.attackLoop = false;
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
