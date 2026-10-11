import { createTrainingDummies } from "../entities/TrainingDummy.js";
import {
  BAU_CAPACITY,
  createPlayerSession,
} from "./PlayerSession.js";
import {
  AUTO_POCAO_LIMIAR_PADRAO,
  AUTO_POCAO_LIMIAR_MIN,
  AUTO_POCAO_LIMIAR_MAX,
} from "../../data/potions/index.js";
import { PARTY_MAX } from "../../shared/protocol.js";
import { EnemyAI } from "../enemies/EnemyAI.js";
import {
  grantXp,
  loseXp,
  statsForLevel,
  xpForKill,
  xpPerdidoNaMorte,
  xpToNext,
} from "../progression/Levels.js";
import { reviveCost, BALANCE } from "../balance.js";
import { CRAFT_RESULT } from "../craft/Craft.js";
import { DELIVER_RESULT as COLLECTION_RESULT } from "../collection/Collection.js";
import { isAutoCompletable } from "../../data/quests/index.js";
import {
  canEnchantItem,
  enchantCost,
  enhanceBloqueio,
  enhanceCost,
  enhanceRisco,
  enhanceSteelCost,
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
import TileMapRenderer from "../maps/TileMapRenderer.js";
import { temCamadaDeTile, tiledDoMapa, colisaoDoMapa, zonasDoMapa } from "../maps/registroDeTiles.js";
import { prepararMinimapa, minimapaDe } from "../maps/minimapaTiled.js";
import { PropRenderer } from "../props/PropRenderer.js";
import { NpcRenderer } from "../npc/NpcRenderer.js";
import { getNpcType } from "../../data/npc/index.js";
import { PortalRenderer } from "../portais/PortalRenderer.js";
import { TelegraphSystem } from "../enemies/TelegraphSystem.js";
import { TelegraphRenderer } from "../enemies/TelegraphRenderer.js";
import {
  TECLAS_DO_NAVEGADOR,
  TECLAS_ORDEM_PADRAO,
  acaoDaTecla,
  vetorDeMovimento,
} from "../input/keybinds.js";
import { portalsOf } from "../../data/portais/index.js";
import {
  MIRA,
  MIRA_TAMANHO,
  MIRA_OFFSET,
} from "../../data/cursor/index.js";
import {
  dadosDaTrava,
  portalLiberado,
} from "../../data/quests/index.js";
import {
  ARENA_ID,
  findMap,
  getMap,
} from "../../data/maps/index.js";
import {
  getItem,
  ITEM_TYPE,
  rarityOf,
  valueAt,
} from "../../data/items/index.js";
import {
  ULTIMATE_NIVEL,
  ultimateLiberada,
} from "../../data/skills/index.js";
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

/**
 * O BAU de quem nao tem bau nenhum.
 *
 * Existe pelo mesmo motivo do `EMPTY_PARTY_SNAPSHOT`: o painel do bau e
 * montado para TODO jogador a cada pacote, e ele precisa de uma lista
 * vazia e nao de `undefined` quando a sessao ainda nao foi montada — o
 * `bauSnapshot` roda antes do `withPlayer` na primeira entrada
 *
 * O `capacity` e o `BAU_CAPACITY` de verdade e nao `0`: o painel mostra
 * "0/60" nessa janela, e um "0/0" diria que o baU esta cheio
 */
const BAU_VAZIO = Object.freeze({
  used: 0,
  capacity: BAU_CAPACITY,
  isFull: false,
  items: Object.freeze([]),
});

const EMPTY_GUILD_SNAPSHOT = {
  guilda: null,  ehLider: false,
  ehDiretoria: false,
  pontos: 0,
  pontosMax: GUILD_PONTOS_MAX,
  cofre: null,
  busca: [],

  /**
   * A ARVORE de quem nao tem guilda: sete nos no Nv. 0.
   *
   * Montada com `talentProgresso` e um `Map` vazio, e nao com um objeto
   * escrito a mao como era antes. A lista de campos do no mudou (saiu
   * `custo` e `tier`, entraram `nivel`, `percentual`, `coluna`), e um
   * objeto escrito a mao passaria em tudo que so olha o `nome` enquanto
   * o painel quebraria no primeiro no que ele desenha de verdade
   *
   * O `percentual` e 0 porque o jogador nao tem guilda e logo nao tem
   * pontos de guilda para comparar — o `pontos` deste snapshot e 0
   */
  arvore: GUILD_TALENTS.map((node) =>
    talentProgresso(node.id, new Map(), 0)),
};

import {
  GUILD_PONTOS_MAX,
  GUILD_TALENTS,
  talentBonuses,
  talentProgresso,
} from "../../data/guild/index.js";
import { SpriteSheet } from "../sprites/SpriteSheet.js";
import {
  resolveHurtShake,
  resolveDeathElapsed,
} from "../sprites/animation.js";
import {
  getClassSprite,
  ARBALIST_FLECHA,
} from "../../data/sprites/index.js";
import { getEnemySprite } from "../../data/sprites/enemies.js";
import { temMorte } from "../../data/sprites/enemyLayout.js";
import { getPropType } from "../../data/props/index.js";
import {
  MINERACAO_TRAVA_S,
  RECALCULA_CAMINHO_S,
  batidasDe,
  distanciaAteArte,
  encostadoNaPedida,
  mineravel,
  steelMaximoDe,
  superficieDaArte,
} from "../../data/props/mineracao.js";
import {
  ESTADO_TEXTO,
  estadoDoDia,
  getDiaDoPasse,
  getPasse,
  PASSE_PADRAO,
  PASSE_PREMIUM_DIAMANTES,
} from "../../data/passes/index.js";
import {
  diaResgatado,
  desligarPremium,
  ligarPremium,
  premiumAtivo,
  resgatarDia,
} from "../pass/passLog.js";
import { digitandoEm } from "../ui/typing.js";
import {
  computeMinimapTransform,
  drawMinimap,
  MINIMAP_BOTTOM,
  MINIMAP_HEIGHT,
  MINIMAP_LEFT,
  MINIMAP_TOP_IDLE,
  MINIMAP_WIDTH,
} from "../ui/minimap.js";
import { getZoneById } from "../../data/maps/index.js";
import { NavGrid } from "../nav/NavGrid.js";
import { rotaDeMapas } from "../nav/rotaDeViagem.js";
import {
  BEHAVIOR,
  createCreature,
  createCreatureRoster,
  rosterOf,
} from "../../data/enemies/index.js";

/**
 * OS CHEFES DE UM MAPA, na posicao que o mapa escreveu.
 *
 * Cada entrada de `map.bosses` e `{ creature, x, y }`, e o que sai dela
 * e uma criatura no `createCreature` — o MESMO construtor do roster, e
 * nao um objeto montado a mao
 *
 * ## POR QUE REUSAR O `createCreature`
 *
 * E o que garante que um chefe tenha o mesmo formato de qualquer mob:
 * `maxHp` escalado, `loot`, `xp`, `spriteScale`, `alive`. Um objeto
 * escrito a mao no mapa esqueceria um desses campos e o chefe quebraria
 * em algum canto do motor — o `onKill` leria um `undefined` e a
 * recompensa nunca sairia
 *
 * O `index` comeca em 9000 e nao em 0: o `id` final e
 * `<tipo>_<index>`, e o roster do mesmo mapa ja usou os indices
 * baixos. Um chefe com indice baixo poderia receber o mesmo id de um
 * mob comum da arena, e os dois entrariam no `world.enemies` com o
 * mesmo nome
 *
 * O `level` nao e passado: o chefe usa o `level` do catalogo. Passar
 * `boss.level` aqui faria o `scaleForLevel` crescer o numero de novo em
 * cima do que ja foi escalado
 */
function createBosses(map) {
  const entradas = map.bosses ?? [];

  return entradas
    .map((chefe, ordem) => {
      try {
        return createCreature(
          chefe.creature,
          { x: chefe.x, y: chefe.y },
          9000 + ordem,
          null,
        );
      } catch {
        /**
         * UM CHEFE COM NOME ERRADO NAO DERRUBA O MAPA.
         *
         * O resto do `montarContexto` tambem engole entrada invalida (e
         * os NPCs que nao existem sao filtrados em silencio). Um `throw`
         * aqui derrubaria o `setMap` do jogador e ele cairia na tela
         * preta — o pior jeito de avisar que um id esta errado no
         * catalogo
         */
        console.warn(
          `chefe ignorado em ${map.id}: ` +
            `${chefe.creature} nao existe no catalogo`,
        );

        return null;
      }
    })
    .filter(Boolean);
}

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
 * O ID DO PERGAMINHO, e uma constante porque o motor usa em tres lugares.
 *
 * A contagem que desliga o botao, o gasto que paga o teleporte e a
 * recusa quando o jogador nao tem. Tres lugares lendo a mesma string
 * e um lugar para trocar o id
 *
 * O id em si e o do catalogo de itens, e nao um enum: a loja do
 * mercador tambem o nomeia, e um enum aqui seria uma segunda fonte que
 * so o motor conhece
 */
const PERGAMINHO_TELEPORTE_ID = "pergaminho_teleporte";

/**
 * O RAIO DO JOGADOR, e a margem da conferida de borda.
 *
 * A mesma conta que o `GameServer.moverParaMapa` faz antes de entrar em
 * um mapa: o ponto de chegada precisa caber INTEIRO, e nao so o centro.
 * Um destino no ultimo pixel do mapa aceitaria um jogador cuja metade
 * ficaria fora da borda
 *
 * E o `16` que o servidor tambem usa. Aqui esta em copia, e nao
 * importado de la: o `GameServer` importa o motor, e o motor nao pode
 * importar o servidor. Sao duas linhas com o mesmo numero em dois
 * lugares, e um comentario em cada uma apontando para a outra
 */
const RAIO_DO_JOGADOR = 16;

/**
 * A DISTANCIA PERTO DA QUAL A BOX SAI.
 *
 * ## O UNICO MOTIVO DE A BOX SUMIR
 *
 * O jogador chegou. E a unica condicao que esconde a box: enquanto o
 * deslocamento automatico estiver ligado e o destino nao estiver logo ali,
 * ela aparece — inclusive com o auto recem-ligado e com o destino do
 * outro lado de um portal
 *
 * ## POR QUE 1800, E NAO O `TRAVEL_CHEGADA` DE 24
 *
 * `TRAVEL_CHEGADA` e o raio de chegada de UMA etapa, e a pergunta aqui
 * e outra: "o jogador ja esta vendo o destino". Quem abriu o pergaminho
 * a 500px do ponto final gastaria o item para atravessar o comprimento
 * de uma arvore
 *
 * E POR QUE NAO 600
 *
 * Porque a box nao e mais sobre "chegou", e sobre "vale a pena teleportar".
 * A 600px o destino ja esta visivel na tela e o auto caminha em poucos
 * segundos: a box此时 era um aviso de algo que ja estava acontecendo. A
 * 1800px o destino ainda esta longe o bastante para a box justificar o
 * botao, e perto o bastante para a conta nao ser absurda
 */
/**

  this.effects.line(
    player.x,
    player.y,
    angulo,
    DASH_DISTANCIA,
    14,
    "#9fd8ff",
    DASH_DURACAO_S + 0.1,
  );

  this.effects.burst(
    player.x,
    player.y,
    "#9fd8ff",
    DASH_DURACAO_S,
  );
}

/**
 * O COOLDOWN DO CHEFE, E NAO O `TELEPORTE_PERTO`.
 *
 * A 1800px o auto para quando a box do teleporte aparece, e a box estava
 * ligada ao auto e nao ao dash. Sao numeros de coisas diferentes: um e
 * "quando a distancia a mais avise o jogador", o outro e "quando o dash
 * recarrega"
 */
const TELEPORTE_PERTO = 1800;

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

/**
 * As teclas que o motor CANCELA no navegador.
 *
 * ## POR QUE NAO E O MAPA DE BINDS
 *
 * Porque esta lista nao e sobre o jogo: e sobre o NAVEGADOR. `Space` rola
 * a pagina, as setas movem o cursor, `Backspace` volta. Essas teclas
 * precisam ser canceladas INDEPENDENTEMENTE de quem tem bind para elas
 *
 * Se a lista fosse o mapa de binds, trocar `atacar` de `Space` para `KeyF`
 * tiraria o `Space` daqui — e o `Space` voltaria a rolar a pagina, sem
 * nenhuma acao de jogo nele
 *
 * ## E POR QUE VEM DO `keybinds`
 *
 * Porque o `TECLAS_DO_NAVEGADOR` do modulo e a fonte unica. Duplicar a
 * lista aqui seria o caminho para as duas divergirem — e a segunda a
 * divergir e sempre a que o jogador nao lembra de mexer
 */
const CONTROLLED_CODES = new Set([
  ...TECLAS_DO_NAVEGADOR,
  ...TECLAS_ORDEM_PADRAO,
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

const ACTIVE_RANGE = 1700;

/**
 * A DISTANCIA QUE AINDA CONTA COMO "MESMO CAMPO".
 *
 * E menor que o `ACTIVE_RANGE` de proposito. O `ACTIVE_RANGE` e o
 * alcance do AGRO: e a distancia em que o mob ainda repara no jogador,
 * e por isso ele e generoso. Para dividir loot — e para o last hit
 * valer — o criterio e outro, mais apertado: quem esta a mais de um km
 * do mob nao esta na sua luta, por mais que o mob fosse capaz de
 * persegui-lo ate la
 */
const ALCANCE_DIVISAO_LOOT = 1100;

/**
 * QUANTO TEMPO UM GOLPE CONTINUA SENDO O "ULTIMO GOLPE".
 *
 * O `lastHitBy` e um campo que o DamageSystem grava a CADA dano e que
 * NINGUEM limpa. Sem esta janela, um jogador que acertou um mob ha dez
 * minutos continua sendo o dono do abate dele: o rastro do servidor
 * mostrava `killer=teste | auto=0 | alvo=- | dist=971` — um "last hit"
 * de alguem que estava com o autoplay DESLIGADO, sem alvo nenhum, a
 * quase mil pixels do mob
 *
 * O prazo e generoso de proposito: um DoT de veneno leva segundos para
 * matar e o abate por veneno e do envenenador. Passou disso, o abate
 * nao paga ninguem — perder um drop e melhor do que um jogador que foi
 * para a base receber o loot de quem ficou
 */
const JANELA_DO_LAST_HIT_MS = 10_000;

/**
 * A DISTANCIA EM QUE UM GOLPE ANTIGO AINDA CONTA COMO LAST HIT.
 *
 * ## POR QUE NAO E O `ALCANCE_DIVISAO_LOOT`
 *
 * Sao duas perguntas diferentes e a confusao entre elas e o que deixou
 * o bug passar:
 *
 * - `ALCANCE_DIVISAO_LOOT` (1100) responde "esse parceiro ainda conta
 *   como quem esta comigo na caca?". E generoso de proposito: numa
 *   party grande, o mateiro fica um pouco para tras e mesmo assim e
 *   companion
 *
 * - Esta e "esse jogador ainda esta BATENDO neste mob?". E apertada,
 *   porque o alcance de ataque das classes do projeto fica em 105-115px
 *   (`CHARACTER_CLASSES`): um golpe nao chega a mil pixels
 *
 * Usar o numero generoso aqui dava o seguinte no rastro:
 *
 *     killer=teste | auto=0 | alvo=- | eng=- | dist=971
 *
 * O jogador estava a 971px do mob, com o autoplay DESLIGADO e sem alvo
 * nenhum — e passava nos dois filtros, porque 971 < 1100. O
 * `lastHitBy` era um golpe antigo de quando ele ainda caçava ali
 *
 * 320 e tres vezes o alcance de melee: sobra para o jogador estar
 * correndo ou lungando, e nao sobra para alguem que foi embora
 */
const ALCANCE_CREDITO_ABATE = 320;
const EMPTY_LIST = [];

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

  return partes.length > 0 ? partes.join(" — ") : "nada";
}

export class GameEngine {
  /**
    /**
     * O DASH: o empurrao, e o que dura.
     *
     * ## POR QUE 220 E NAO A VELOCIDADE DE ANDAR
     *
     * Porque o dash nao e "andar mais rapido por um instante" — e um
     * DESLOCAMENTO, e o que o jogador sente e o espaco coberto. Andar a
     * velocidade normal durante os 0,18s do dash daria 27px: menos que o
     * raio do proprio jogador, e o boneco nao sairia do lugar
     *
     * ## POR QUE `pushVelocity` E NAO `x`/`y` DIRETO
     *
     * Porque `pushVelocity` e o MESMO campo que o golpe do inimigo usa, e ele e
     * consumido pelo `update` a cada quadro com o decaimento certo. Escrever
     * `player.x += 220` moveria o boneco mas deixaria a colisao e o rastro
     * para tras — e o dash pararia de sentir como um golpe no instante em que
     * o inimigo empurrasse o jogador junto
     */
    DASH_DISTANCIA = 220;
    DASH_DURACAO_S = 0.18;

    /**
     * O COOLDOWN DO DASH, EM SEGUNDOS.
     *
     * ## POR QUE 4 E NAO 3
     *
     * Porque o dash de 0,18s precisa de um tempo de recarga que o jogador
     * consiga CONFERIR. Com 4s, sao 22 usos possiveis em um minuto de briga; com
     * 1s, o botao quase nunca aparecia na tela e o jogador parava de olhar
     * para ele. A 4s ele raramente esta pronto — que e o que faz o icone valer
     * o lugar que ocupa ao lado do auto
     *
     * E o mesmo numero para todas as classes: o dash nao e uma habilidade de
     * classe, e um recurso de locomocao. A classe muda QUANTO voce corre e se
     * atravessa, nunca QUANDO pode
     */
    DASH_COOLDOWN_S = 4;

    /**
     * O DASH EXECUTADO.
     *
     * ## POR QUE O COOLDOWN E UM CAMPO DA SESSAO E NAO UM LOCAL
     *
     * Porque o icone da HUD le o numero de quatro em quatro tiques, e um
     * contador dentro deste metodo sumiria assim que o jogador andasse para
     * outro mapa. O `sessao.dashAte` e o mesmo relogio do servidor que decide
     * o resto do estado privado, entao o botao e o motor nunca discordam
     *
     * ## POR QUE RECUSA INSTEAD DE ESPERAR
     *
     * Porque apressar `E` nao pode contar como o proximo dash: o jogador
     * segurando a tecla testaria a recarga e o cooldown de 4s viraria
     * milliseconds. Recusar e o que mantem os 4s
     */
    useDash() {
      const player = this.world.player;

      if (!player || player.hp <= 0) return false;

      const agora = this.world.time;

      if ((this.world.session?.dashAte ?? 0) > agora) return false;

      this.world.session.dashAte = agora + this.DASH_COOLDOWN_S;

      /**
       * A MIRA JA VEM PRONTA no `input.aim`, e o mesmo vetor que a skill
       * atira. Reutilizar ele e o que garante que o dash saia para onde o
       * tiro sairia
       */
      /**
       * A MIRA VEM DO `pointer`, e nao de um campo `aim`.
       *
       * O input da sessao tem `keys` e `pointer`, e nao `aim`. Um `aim`
       * inexistente seria `undefined`, a soma daria `NaN`, e o boneco
       * sumiria do mapa — o dash mais teimoso do jogo
       *
       * E no online o `pointer` e preenchido pelo `INPUT` a 45Hz, com o
       * servidor convertendo a mira do cliente em um ponto no mundo. Por
       * isso o dash nao precisa de vetor no pedido: o servidor JA sabe para
       * onde o jogador esta olhando
       */
      const ponteiro = this.input?.pointer ?? {
        x: 0,
        y: 0,
        inside: false,
      };

      const jogador = this.world.player;

      const dx = ponteiro.x - (jogador?.x ?? 0);
      const dy = ponteiro.y - (jogador?.y ?? 0);

      const distancia = Math.hypot(dx, dy);

      /**
       * A ZONA MORTA, e ela e a mesma do `aimFromPointer` do cliente: 6px.
       *
       * Sem ela, o ponteiro em cima do boneco daria um vetor de comprimento
       * qualquer e de direcao instavel — dois pixels de tremor mudariam o
       * dash de lado. E dividir por zero daria `NaN`
       */
      const mira =
        ponteiro.inside && distancia > 6
          ? { x: dx / distancia, y: dy / distancia }
          : { x: 0, y: 0 };

      const olhou = distancia > 6;

      /**
       * SEM MIRA, O DASH VAI PARA ONDE O JOGADOR OLHA.
       *
       * O ponteiro em cima do boneco e a zona morta de 6px, e ali nao ha
       * direcao para escolher. O `facing` e a ultima direcao real do
       * boneco, entao o dash sai para frente em vez de sumir
       */
      const ux = olhou ? mira.x : Math.cos(player.facing ?? 0);
      const uy = olhou ? mira.y : Math.sin(player.facing ?? 0);

      /**
       * A VELOCIDADE E DISTANCIA / DURACAO, e nao a distancia.
       *
       * Porque o `pushVelocity` e uma VELOCIDADE: o `update` multiplica por
       * `deltaTime` a cada quadro. Escrever 220 ali daria um arranhao de 2px no
       * primeiro quadro e o cooldown de 4s para um dash de 0,18s
       */
      const velocidade = this.DASH_DISTANCIA / this.DASH_DURACAO_S;

      player.pushVelocity.x += ux * velocidade;
      player.pushVelocity.y += uy * velocidade;

      if (!olhou) {
        player.facing = Math.atan2(uy, ux);
      }

      this.mostrarRastroDoDash(ux, uy);

      this.sendSnapshot();

      return true;
    }

    /**
     * O RASTRO DO DASH.
     *
     * E o que o jogador ve de si mesmo, e sem ele o dash e um teletransporte
     * silencioso: o boneco sai de um ponto e aparece em outro, e o jogador nao
     * sabe se foi o jogo ou ele
     *
     * ## POR QUE UM RISO E NAO UM BORDAO
     *
     * Porque o rastro do dash e a DIRECAO, e um risco circular nao diz para
     * onde. O `line` nasce no jogador e corre para a frente pelo comprimento do
     * dash — o jogador le o movimento antes de o boneco chegar nele
     *
     * ## POR QUE O EFEITO E DO MOTOR E NAO DO CLIENTE
     *
     * Porque o dash acontece no servidor. Um rastro desenhado pelo cliente
     * chegaria sempre um pacote atrasado, e o jogador veria o boneco andar SO
     * e o rastro aparecer depois — o oposto do que o efeito deveria provar
     */
    mostrarRastroDoDash(dx, dy) {
      const player = this.world.player;

      this.effects.dash(
        player.x,
        player.y,
        Math.atan2(dy, dx),
        this.DASH_DISTANCIA,
        "#9fd8ff",
        this.DASH_DURACAO_S + 0.12,
      );
    }

    /**
     * O EFEITO DO DASH ACOMPANHA O JOGADOR, e nao nasce parado.
     *
     * ## POR QUE ESTA ATUALIZACAO AQUI E NAO DENTRO DO `EffectSystem`
     *
     * Porque o `EffectSystem` nao conhece o jogador: ele desenha o que
     * recebe, e um efeito que se move sozinho precisaria de um alvo. O
     * `update` deste metodo ja e o lugar onde o mundo se resolve, entao e
     * ele que reposiciona o efeito do dash no boneco
     *
     * Sem esta linha o rastro ficaria no ponto de origem, e o boneco
     * correria para fora de uma marca parada — o oposto do que o efeito
     * existe para provar
     *
     * ## E POR QUE O FILTRO E SO PELO `kind`
     *
     * Porque "dash" e um tipo unico: nenhum outro efeito cria `rastro`, e
     * nenhum outro precisa de um alvo. A passagem pela lista de 400 efeitos
     * e um comparacao de string por quadro, e o mais barato que da para
     * fazer aqui
     */
    acompanharDash() {
      const player = this.world.player;

      if (!player) return;

      for (const effect of this.effects.effects) {
        if (effect.kind !== "dash") continue;

        effect.x = player.x;
        effect.y = player.y;
      }
    }

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
   * E uma lista nova a cada chamada de proposito. Sao cinco
   * acoes por jogador — o basico mais as quatro habilidades de slot, num
   * metodo que roda umas 20 vezes por
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
     * O motor so Lá. Ele pergunta "quem mais esta na party deste
     * jogador" e divide o abate; quem cria, quem entra e quem sai e o
     * `PartyStore`, no servidor
     *
     * `null` no single player, e o jogo segue sem divisao de loot — que e
     * o que ja acontecia antes de a party existir
     */
    this.partyStore = opcoes.partyStore ?? null;

    /**
     * OS PERSONAGENS EM DISCO, para o rank.
     *
     * Uma funcao e nao a lista: o painel e montado varias vezes por
     * segundo para cada jogador, e o motor nao pode ler o disco nesse
     * intervalo. Quem abre a pasta e o SERVIDOR; o motor so recebe os
     * dados ja prontos
     *
     * `null` no single player, onde nao existe pasta de saves — e o
     * rank fica so com quem esta na partida, como antes
     */
    this.personagensSalvos = opcoes.personagensSalvos ?? null;

    /**
     * O MOTOR NAO TEM O ESTADO DAS PEDIDAS, E POR ISSO PERGUNTA.
     *
     * O contador de batidas e do servidor — o `minasPorMapa` dele. O motor
     * monta o painel do jogador e precisa mostrar `3/5`, entao pergunta
     * quem sabe, em vez de manter uma segunda copia que so se desincroniza
     *
     * Com o gancho ligado, `null` no cliente: la o estado vem no pacote de
     * 20Hz e o painel ja chega pronto, sem passar por aqui
     */
    this.lerPedida = opcoes.lerPedida ?? null;

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

  /**
   * QUANDO UM CHEFE CAI, quem reage.
   *
   * `null` por padrao: o motor roda igual nos dois lugares, e quem tem a
   * arena — so o servidor — e que liga. Um motor sem arena nunca dispara
   * isto, porque o mapa dele nao declara nenhum `bosses`
   */
  this.onChefeDerrotado = null;

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
     * AS PEDRAS FORAS DE CADA MAPA, e a VISTA do mapa em foco.
     *
     * `pedidasPorMapa` e o dono: um `Set` por mapa, nunca substituido. E
     * `pedidasForaDoMapa` e a referencia para o do mapa em foco, a mesma que
     * o `CollisionSystem` em uso carrega — entao desenho, minimapa e colisao
     * leem sempre a mesma lista e nunca podem discordar
     *
     * O veiculo e o SERVIDOR: e ele que sabe que a pedra caiu, e o cliente
     * recebe a lista pelo pacote de 20Hz
     */
    this.pedidasPorMapa = new Map();
    this.pedidasForaDoMapa = new Set();

    /**
     * QUANTO RESTA DE UMA PEDIDA. Vem do servidor; no cliente e `null`.
     *
     * O contador de batidas e do MUNDO, nao do motor: o motor nao anda o
     * jogador e nao sabe o que o servidor ja concessionou a outro jogador
     * na mesma pedra. `onSnapshot`, `onNpcClick` e `onTargetClick` sao o
     * mesmo desenho — um gancho que o dono do dado escreve
     */
    this.lerPedida = opcoes.lerPedida ?? null;

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

    /**
     * `true` quando QUEM DISPARA o painel e o dono do motor, e nao o
     * timer de 10Hz do `update`.
     *
     * O offline precisa do timer: e o proprio motor que monta o painel
     * da HUD. O servidor nao — la quem monta e `GameServer.enviarPainel`,
     * que sabe de QUE CLIENTE e o painel. Com o timer ligado no servidor,
     * `update()` montava o painel inteiro 10 vezes por segundo fora de
     * qualquer jogador em foco, e o `onSnapshot` jogava fora por nao ter
     * dono (`GameServer.js:287`)
     *
     * O que essa wasted work custava, por segundo, com 50 saves em disco:
     * 10 paineis de ~154KB remontados do zero, mais 10 `readdirSync` e
     * 500 `readFileSync`+`JSON.parse` **sincronos** dentro do event loop
     * do `setInterval` de 20Hz. Isso segura o servidor inteiro: HTTP,
     * WebSocket e o proprio tick
     *
     * O jogo online REAIS usa isto, entao o desperdicio era real e nao
     * uma otimizacao preventiva
     */
    this.painelExterno = false;

    /**
     * `true` SO durante a chamada que o dono do painel fez de proposito.
     *
     * E o que separa "monta porque algacao aconteceu" de "monta porque
     * alguem vai ler". Sem ele, `painelExterno` sozinho nao daria para
     * distinguir o painel que o `enviarPainel` quer do painel que uma
     * acao de combate dispara por efeito colateral
     */
    this.painelSolicitado = false;

    /**
     * A TAG DA GUILDA DO JOGADOR LOCAL, para o desenho no canvas.
     *
     * Comeca `null` e nao `{}` porque o primeiro quadro acontece antes do
     * primeiro pacote de painel: o jogador ve o boneco andando por um instante
     * sem placa nenhuma, e o que ele veria e um objeto vazio desenhando
     * "[]" no lugar do nome
     *
     * E escrita pelo `sendSnapshot`, que e o unico lugar do codigo que ja
     * tem a guilda na ma. Ver `guildaDoJogadorLocal`
     */
    this.tagLocal = null;

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

      /**
       * OS TELEGRAPHS VIVOS, e a lista que o `TelegraphSystem` avanca.
       *
       * Vive no `world` e nao no `TelegraphSystem` porque e o MESMO estado
       * que o servidor serializa e o cliente reproduz: a lista esta aqui
       * para que o `estadoInimigos` e o desenho leiam a mesma fonte, sem
       * duas copias que podem divergir
       *
       * E lista vazia em vez de `undefined`: o `update` percorre com `for` e
       * conta `.length`, que e o estado que o resto do motor ja sabe tratar
       */
      telegraphs: [],

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

      /**
       * O PASSE do jogador em foco.
       *
       * ## POR QUE ESTE GETTER PRECISAVA EXISTIR
       *
       * Porque o `world` nao guarda o estado de ninguem: ele tem os inimigos,
       * o mapa e uma sessao em foco, e cada estado privado e lido de la por
       * um getter. Sem esta linha, `this.world.passe` era `undefined` e o
       * painel quebrava com "Cannot read properties of undefined" ao montar —
       * e o erro aparecia no painel, longe da causa, que e uma linha a mais
       * nesta lista
       *
       * ## E POR QUE ELE E `?? null` E NAO UM OBJETO VAZIO
       *
       * Pelos mesmos motivos dos outros sete: antes de existir sessao em foco
       * nao ha passe de ninguem. Um objeto vazio aqui fingiria um passe
       * inteiro e o resgate aceitaria um dia de um passe que nao existe
       */
      get passe() {
        return this.session?.passe ?? null;
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

    /**
     * O `onHeal` do StatusSystem.
     *
     * ## POR QUE O `?.` E POR QUE A ARROW
     *
     * Porque o `this.damage` e construido DEPOIS desta linha. A arrow
     * fecha sobre o `this` do MOTOR e nao sobre o objeto de agora, entao
     * quando o tick rodar — muito depois do construtor — ela ja enxerga o
     * `DamageSystem` pronto. O `?.` cobre o intervalo em que um tique
     * dispara antes de o motor terminar de montar
     *
     * A alternativa seria reordenar os dois construtores, e nao da: o
     * `DamageSystem` recebe `statuses: this.statuses`, entao o
     * `StatusSystem` precisa existir primeiro
     */
    this.statuses = new StatusSystem({
      onHeal: (entity, amount) => {
        this.damage?.heal(entity, amount);
      },
    });

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
        /**
         * A MORTE DE UM JOGADOR NAO E UM ABATE.
         *
         * O `DamageSystem` dispara `onDeath` para qualquer alvo que
         * zera a vida, e o jogador e um alvo como qualquer outro. Sem
         * este desvio, matar um jogador rodava `killEnemy` nele: o
         * motor marcava `rewardGranted`, botava `respawnTimer = 5` e
         * chamava o `handleKill` — que credita loot, XP, missao e
         * bestiario para quem "matou". Um guild killing outro par de
         * jogadores passaria a receber recompensa de abate
         *
         * A morte do jogador tem dono proprio: e o `updatePlayer` que
         * ve o `hp <= 0` e abre o painel, no tick seguinte
         */
        if (target.isPlayer) return;

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

    /**
     * O INICIO DE UM TELEGRAPH, e a ponte entre a IA e o sistema.
     *
     * E o `EnemyAI` que decide QUANDO comeca, e o `TelegraphSystem` que sabe
     * o QUE acontece ate o impacto. O motor so carrega a referencia para um
     * dos dois: sem este campo o `EnemyAI` teria que conhecer a classe do
     * sistema, e o `TelegraphSystem` conhecer a IA
     *
     * ## E POR QUE O ALVO ENTRA AQUI, E NAO DENTRO DO `TelegraphSystem`
     *
     * Porque a escolha do alvo e uma DECISAO de IA — "quem eu marco" — e nao
     * uma conta de geometria. O sistema recebe o alvo ja escolhido e so
     * resolve a forma em volta dele
     */
    this.world.onIniciarTelegraph = (
      enemy,
      habilidade,
      agora,
      alvo,
    ) => this.telegraphs.iniciar({
      inimigo: enemy,
      habilidade,
      agora,
      alvo,
    });

    /**
     * O DANO DE UM TELEGRAPH, no MESMO `applyDamage` do golpe comum.
     *
     * ## E POR QUE NAO UM CAMINHO NOVO
     *
     * Porque o pedido e explicito: "aplique dano apenas aos alvos validos,
     * conforme as regras de combate existentes". Um segundo caminho de dano
     * seria o lugar onde a mitigacao, a esquiva, os status e o numero que
     * sobe na tela ficam de fora — e o chefe passaria a ignorar as proprias
     * regras de defesa do jogo
     *
     * O `id` do golpe carrega o `execucaoId` do telegraph. E o que impede o
     * mesmo impacto de contar duas vezes: o `DamageSystem` deduplica por id,
     * entao uma execucao reprocessada nao gera um segundo numero na tela
     */
    this.world.onDanoDoChefe = (
      inimigo,
      dano,
      jogador,
      execucao,
    ) => {
      this.damage.applyDamage(inimigo, jogador, {
        id: `${execucao.id}_telegraph`,
        damage: dano,
        damageType: execucao.habilidadeId === "energy_beam" ? "energy" : "physical",
        color: execucao.cor,
      });

      /**
       * O EMPURRAO, e ele e do MESMO `pushVelocity` do resto do motor.
       *
       * O `shock_ring` com 320 de empurrao e a habilidade que existe para
       * empurrar: sem isto a onda acerta e nao afasta, e o jogador fica
       * parado dentro de um ataque que so serve para tirar vida
       */
      const knockback = execucao.knockback ?? 0;

      if (knockback > 0) {
        const dx = jogador.x - execucao.x;
        const dy = jogador.y - execucao.y;
        const tamanho = Math.hypot(dx, dy) || 1;

        jogador.pushVelocity = jogador.pushVelocity ?? { x: 0, y: 0 };
        jogador.pushVelocity.x += (dx / tamanho) * knockback;
        jogador.pushVelocity.y += (dy / tamanho) * knockback;
      }
    };

    /**
     * O IMPACTO VISUAL, que o `EffectSystem` desenha no mundo do cliente.
     *
     * E a unica coisa que o motor anuncia do telegraph no lado do servidor:
     * o resto da apresentacao e reproduzida pelo pacote de inimigos
     */
    this.world.onImpactoDoTelegraph = (execucao, inimigo) => {
      this.effects?.registrarImpactoTelegraph?.(execucao);
    };

    this.skillSystem = new SkillSystem(
      this.world,
      (message) => this.showMessage(message, true),
    );

    this.spriteSheet = null;
    this.spriteTime = 0;
    this.minimapCache = null;

    /**
     * O INDICE DE INIMIGOS, espelhado no `world`.
     *
     * O indice e do MOTOR (`this.indiceInimigos`), montado no `setMap`, e
     * ele serve para `findEnemyById` e `getLiveTarget`. O `TelegraphSystem`
     * tambem precisa dele — para achar o dono de uma execucao e soltar a
     * trava `telegraphAtivo` quando o golpe termina — e ele e criado com o
     * `world`, nao com o motor
     *
     * Sem este espelho, o telegraph buscava o chefe num `world.byId` que
     * nunca existiu, devolvia `null` sempre, e a trava ficava ligada para
     * sempre: o chefe ficava em `attack` sem se mover e sem atacar de novo
     *
     * E uma REFERENCIA, nao uma copia: o `setMap` troca o `Map` inteiro, e
     * o espelho e apontado de novo logo abaixo, no mesmo lugar onde o motor
     * guarda o seu
     */
    this.world.indiceInimigos = this.indiceInimigos;
    this.terrain = new TerrainRenderer();
    this.tiles = new TileMapRenderer();
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

    /**
     * O SISTEMA DE TELEGRAPH DO CHEFE, e o dono das execucoes vivas.
     *
     * Ele roda aqui, no motor, e nao no `EnemyAI`: o `EnemyAI` escolhe QUANDO
     * comeca uma habilidade, e este sistema responde O QUE acontece entre o
     * começo e o impacto. Sao papeis distintos, e a separacao deixa o
     * `EnemyAI` sem nenhuma referencia ao tempo de preparo
     *
     * E o motor e o lugar porque o `GameServer` instancia este mesmo motor:
     * o telegraph nasce no servidor, o dano e aplicado no servidor, e o
     * cliente so recebe o estado pronto para desenhar
     */
    this.telegraphs = new TelegraphSystem(this.world);

    /**
     * O RENDERIZADOR dos telegraphs, no mesmo lugar dos outros.
     *
     * Fica aqui para o motor poder desenhar na ordem do mapa sem que o
     * `TelegraphSystem` saiba que existe canvas
     */
    this.telegraphRenderer = new TelegraphRenderer();

    /**
     * A MIRA, CARREGADA UMA VEZ POR CONEXAO.
     *
     * E uma `Image` solta e nao um renderer: nao ha cull, nao ha estado e
     * nao ha o que variantar. Um `CrosshairRenderer` seria uma classe com
     * um metodo e uma imagem dentro
     *
     * Comeca em `null` e so vira imagem depois do `onload`. A `drawCrosshair`
     * e chamada em TODO quadro, e um `drawImage` de uma imagem a meio
     * caminho laneca `InvalidStateError` no meio do `render` — o quadro
     * morre, e o `render` seguinte tenta de novo, para sempre
     *
     * O `typeof Image` e o mesmo guarda do `PortalRenderer`: o motor
     * tambem roda no Node, nos testes e no servidor, onde nao existe
     * `Image`, e o `new` Lancaria ReferenceError na construcao
     */
    this.mira =
      typeof Image === "undefined" ? null : new Image();

    if (this.mira) {
      this.mira.src = MIRA;
    }

    this.world.sort = [];
    this.frameErrors = 0;
    this.frameDelta = 1 / 60;

    const spriteDefinition = getClassSprite(
      classDefinition.id,
    );

    if (spriteDefinition) {
      this.spriteSheet = new SpriteSheet(
        spriteDefinition,
      );
    }

    /**
     * A FLECHA DO ARBALIST, quando a classe e a dele.
     *
     * E uma imagem SEPARADA da folha do boneco, porque a folha e uma grade
     * direcional de 84x84 e a flecha e um retangulo de 256x120 — nao ha como
     * espremer um no outro
     *
     * O `typeof Image` e o mesmo guarda da mira acima, pelo mesmo motivo: o
     * motor roda no Node, nos testes e no servidor, onde `Image` nao existe.
     * Sem este guarda o `new Image()` derrubaria a construcao do motor inteiro
     * no servidor — que e o que o `new URL` de `data/sprites/index.js` ja
     * tentar abrir um asset de cliente
     */
    this.flechaSprite =
      classDefinition.id === ARBALIST_FLECHA.classId &&
      typeof Image !== "undefined"
        ? new Image()
        : null;

    if (this.flechaSprite) {
      this.flechaSprite.src = ARBALIST_FLECHA.src;
    }

    this.enemySprites = new Map();

    /**
     * O CONTEXTO CUJAS FOLHAS ESTAO EM `enemySprites`.
     *
     * `null` e o estado inicial de proposito: o construtor chama
     * `buildEnemySprites` direto, para o elenco do mapa inicial, e assim
     * a primeira `aplicarContexto` tem `null` para comparar e constroi as
     * folhas do mapa certo
     */
    this.contextoAplicado = null;

    /**
     * O INDICE POR ID do contexto aplicado, e `null` antes do primeiro.
     *
     * `null` e o que faz o `findEnemyById` cair na varredura da lista —
     * que e o comportamento antigo, e o correto enquanto nao ha contexto.
     * Declarar aqui em vez de deixar `undefined` deixa essa distincao
     * explícita em vez de depender de `?.`
     */
    this.indiceInimigos = null;

    // Os sprites de CLASSE dos OUTROS jogadores, por `classId`.
    //
    // E um mapa por classe, e nao por jogador, de proposito: dois
    // Arbalist na tela compartilham a MESMA imagem, e nao baixam
    // duas copias. E o que mantem a animacao deles igual a do
    // jogador local, em vez de virarem uma figura generica.
    this.playerSprites = new Map();

    /**
     * A ESCALA DAS FOLHAS DO MAPA INICIAL, agora que elas existem.
     *
     * O `aplicarContexto` do comeco do construtor rodou ANTES deste ponto:
     * nao havia `spriteSheet` nem `playerSprites` para aplicar, entao a
     * escala do primeiro mapa se perderia. O jogador entraria no hub com o
     * arquiro no tamanho do vale e so corrigiria ao atravessar um portal e
     * voltar
     */
    this.aplicarEscalaDosSprites(this.world.map);

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
montarContexto(mapa) {
      /**
       * AS ZONAS VEM DO TILED, E O MAPA QUE O RESTO DO MOTOR VAI LER.
       *
       * ## POR QUE UM MAPA NOVO, E NAO UM ARRAY NO LUGAR
       *
       * Porque `map.zones` e lido por um monte de gente: o roster que sorteia
       * as criaturas, o minimapa, a busca de zona por nome. Mexer no array do
       * mapa exigiria lembrar de cada um desses leitores, e o primeiro que
       * ficasse de fora mostraria o retangulo antigo
       *
       * Trocando o MAPA, todos leem a versao nova sem nenhum deles mudar
       *
       * ## POR QUE UM MAPA NOVO E NAO MUTAR O `MAP_1`
       *
       * Porque `MAP_1` e um objeto de modulo, compartilhado por todos os
       * contextos e pelo servidor inteiro. Alterar as zonas dele mudaria o
       * mapa para todo mundo que ja tivesse uma referencia — e nao ha como
       * desfazer, porque ninguem guardou a versao antiga
       *
       * ## POR QUE O JOGO CONTINUA DECIDINDO QUEM
       *
       * Porque o retangulo e do mapa, mas quantos esqueletos e de que nivel
       * continua sendo do `ZONE_ROSTER`. O `.tmj` decide onde, o codigo
       * decide quem. Sao duas perguntas diferentes e nao se misturam
       *
       * ## E SE O MAPA NAO TIVER CAMADA
       *
       * O mapa 2, o hub e a base nao tem `.tmj`, entao `zonasDoMapa` devolve
       * lista vazia e o mapa segue com as zonas escritas no codigo. E o que
       * mantem os outros mapas intactos sem nenhum ramo que so exista para
       * eles
       */
      const zonasDoTiled = zonasDoMapa(
        mapa.id,
        rosterOf(mapa).map((linha) => linha.zone),
      );

      const zonas = zonasDoTiled.length
        ? [
            ...(mapa.zones ?? []).filter(
              (zona) => !zonasDoTiled.some((doTiled) => doTiled.id === zona.id),
            ),
            ...zonasDoTiled,
          ]
        : mapa.zones;

      const map = zonas === mapa.zones ? mapa : { ...mapa, zones: zonas };

      const npcs = (map.npcs ?? []).map((npc) => {
        const tipo = getNpcType(npc.typeId);

        if (!tipo) return null;

        return {
          ...npc,
          ...tipo,
          typeId: tipo.typeId,
        };
      }).filter(Boolean);

      /**
       * O `CollisionSystem` NASCE COM O `Set` COMPARTILHADO DO MAPA.
       *
       * Sao os MESMOS objetos, e nao uma copia: este `Set` e reatribuido a
       * cada `aplicarContexto`, e `aplicarContexto` roda a cada
       * `focusPlayer` — que e a cada jogador, a cada tique. Um `Set` novo a
       * cada vez zeraria a lista de pedras foras no primeiro jogador que
       * entrasse em foco depois de uma pedra cair, e o cristal invisivel
       * voltaria a barrar o caminho
       */
      const collision = new CollisionSystem(
        map,
        [
          /**
           * AS PAREDES DESENHADAS NO TILED.
           *
           * Elas entram como `extraSolids` e se somam aos solidos do mapa. O
           * caminho e o mesmo que as arvores usam, e nao um novo: a
           * `CollisionSystem` so conhece retangulo, e parede pintada no mapa
           * e um retangulo como qualquer outro
           *
           * Vem do REGISTRO e nao de `map.solids` porque o arquivo do Tiled
           * nao e importavel pelo motor: o servidor roda em Node, onde o
           * plugin do Vite que le `.tmj` nao existe. O servidor registra o
           * mesmo arquivo lendo do disco, e este trecho e o caminho unico
           * para os dois lados
           */
          ...colisaoDoMapa(map.id),
          ...npcs
            .filter((npc) => npc.blocking)
            .map((npc) => this.npcs.blockBoxOf(npc)),
        ],
      );

      collision.pedidasFora = this.pedidasForaDoMapaDe(map.id);

    /**
     * O ELENCO vai para uma variavel so porque ele e usado duas vezes:
     * na lista que o `world` le e no indice por id. A alternativa era
     * percorrer `contexto.enemies` depois de montado, e ai o indice
     * seria um segundo O(E) sempre que um mapa aparecesse
     */
    const inimigos = [
      ...createTrainingDummies(map),
      ...createCreatureRoster(map, map.seed),

      /**
       * Os CHEFES, que nao vem do roster.
       *
       * O roster espalha criaturas numa GRADE dentro de cada zona, e
       * ele serve para o campo de mob — sete bichos por zona, todos
       * iguais. Um chefe nao cabe nesse desenho: ele e UM, em um
       * PONTO, e o lugar dele e o centro da arena
       *
       * Por isso `bosses` e um campo separado do mapa, com uma posicao
       * escrita a mao. O `index` e um numero separador por tipo para
       * que dois chefes do mesmo tipo em mapas diferentes nao
       * colidissem no id
       */
      ...createBosses(map),
    ];

    /**
     * MARCA OS CHEFES, UMA VEZ POR MAPA.
     *
     * ## POR QUE MARCAR AQUI E NAO CONSULTAR `map.bosses` A CADA QUADRO
     *
     * O resto do motor descobre chefe por `map.bosses.some(...)` — o
     * minimapa e o `onChefeDerrotado` fazem isso. Para a HUD, nao: ela
     * precisa da resposta em TODO quadro do snapshot, e um `some` com
     * closure por inimigo por quadro e trabalho jogado fora para o mesmo
     * resultado
     *
     * ## POR QUE `map.bosses` E NAO UM `boss: true` NA CRIATURA
     *
     * Porque quem e chefe e uma propriedade do MAPA. O mesmo bicho pode
     * ser um mob comum no vale e o guardian da arena, e o catalogo nao
     * pode saber disso
     *
     * O campo e `chefe`, e nao `boss`, para nao colidir com nada que o
     * catalogo ja traga no inimigo
     */
    for (const chefe of map.bosses ?? []) {
      for (const inimigo of inimigos) {
        if (inimigo.typeId === chefe.creature) {
          inimigo.chefe = true;
        }
      }
    }

    return {
      map,
      collision,
      npcs,
      props: map.props ?? [],
      portals: portalsOf(map),
      enemies: inimigos,

      /**
       * O MESMO ELENCO, POR ID.
       *
       * `findEnemyById` e `getLiveTarget` procuravam por id com um
       * `Array.find` sobre os ~93 inimigos do mapa, e sao chamados varias
       * vezes por jogador por tick — o `updatePlayer` resolve o alvo do
       * tiro, o auto-hunt e o engaged chamam, e o `getLiveTarget` roda
       * uma vez por montagem de painel. Com n jogadores, isso e O(n x E):
       * 50 x 93 = 4650 comparacoes por tick, so para descobrir o que ja
       * estava no indice
       *
       * O indice vive no CONTEXTO, e nao no motor, pelo mesmo motivo da
       * grade: a lista e do mapa. Um indice global seria consultado com
       * o `world` virado para o mapa errado e devolveria o chefe de outro
       * mapa
       *
       * Nao precisa de manutencao: o elenco de um contexto e fixo e o
       * respawn ressuscita o mesmo objeto. Por isso e um `Map` construido
       * uma vez e nunca reescrito
       */
      indiceInimigos: new Map(
        inimigos.map((inimigo) => [inimigo.id, inimigo]),
      ),

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
/**
   * A LISTA DE PEDRAS FORAS DE UM MAPA, sempre o MESMO `Set`.
   *
   * ## POR QUE UM `Set` POR MAPA E NAO UM SO
   *
   * Porque o servidor tem um motor so para todos os jogadores e todos os
   * mapas, e cada jogador pode estar num mapa diferente. Uma lista unica
   * misturaria as pedras do vale com as da base
   *
   * ## POR QUE NUNCA E SUBSTITUIDO, SO ALTERADO
   *
   * Porque o `CollisionSystem` e RECONSTRUIDO a cada `aplicarContexto`, e
   * o `focusPlayer` roda por jogador dentro do tique. Se este metodo
   * devolvesse um `Set` novo, cada reconstrucao perderia a lista e o
   * cristal invisivel voltaria a barrar o caminho — de forma intermitente,
   * que e o tipo de defeito mais dificil de ver
   *
   * Quem escreve nele: o servidor, quando demole e quando ressuscita; e o
   * cliente, pelo `aplicarPedidasFora` do pacote de 20Hz
   */
  pedidasForaDoMapaDe(mapId) {
    let lista = this.pedidasPorMapa.get(mapId);

    if (!lista) {
      lista = new Set();
      this.pedidasPorMapa.set(mapId, lista);
    }

    return lista;
  }

  /**
   * TROCA O CONTEUDO DA LISTA DE PEDRAS FORAS DE UM MAPA.
   *
   * Altera o `Set` existente em vez de trocar o objeto, pelo motivo do
   * `pedidasForaDoMapaDe`. E o que os dois lados usam para escrever a mesma
   * verdade: o servidor quando uma pedra cai, o cliente quando o pacote
   * chega
   */
  sincronizarPedidasFora(mapId, ids) {
    const lista = this.pedidasForaDoMapaDe(mapId);

    lista.clear();

    for (const id of ids ?? []) lista.add(id);

    return lista;
  }

  aplicarContexto(contexto) {
      this.world.map = contexto.map;
      this.world.collision = contexto.collision;

      /**
       * A LISTA DE PEDRAS FORAS PASSA A SER A DO MAPA EM FOCO.
       *
       * E o MESMO `Set` que o `CollisionSystem` recebeu no `montarContexto`,
       * entao o desenho e a colisao leem sempre a mesma lista. Trocar por
       * um objeto novo aqui deslinkaria os dois: o cristal sumia da tela e
       * continuava barrando o jogador — que era exatamente o sintoma
       */
      this.pedidasForaDoMapa = this.pedidasForaDoMapaDe(contexto.map.id);

      /**
       * O TAMANHO DOS SPRITES NESTE MAPA.
       *
       * E lido do mapa e aplicado as folhas do JOGADOR, que sao as que o
       * `escalaSprites` do mapa governa. Os mob nao entram: o mapa declara
       * por classe de JOGADOR, e um `escalaSprites: { arbalist }` reachando
       * um slime nao faria sentido nenhum
       *
       * A folha local e a folha da classe em `playerSprites` recebem as
       * duas. Deixar so uma delas e o defeito que nao apareceria em quem
       * esta sozinho: o outro jogador da sala apareceria com o tamanho velho
       *
       * E o valor e aplicado na TROCA de mapa, e nao a cada quadro. A
       * camera ja e lida por `getter` todo quadro, mas isso aqui e uma
       * escrita em duas folhas, e refazer 60 vezes por segundo seria
       * trabalho sem motivo
       */
      this.aplicarEscalaDosSprites(contexto.map);

      this.world.npcs = contexto.npcs;
    this.world.props = contexto.props;
    this.world.portals = contexto.portals;
    this.world.enemies = contexto.enemies;

    /**
     * O INDICE POR ID viaja com a lista.
     *
     * Sem esta linha o `findEnemyById` cairia no `Array.find` de sempre
     * quando o contexto ainda nao foi aplicado, e o primeiro `withPlayer`
     * do tick pagaria o preco de O(E) duas vezes
     */
    this.indiceInimigos = contexto.indiceInimigos ?? null;

    /**
     * O ESPELHO no `world` anda junto, e e obrigatorio.
     *
     * O `TelegraphSystem` foi criado com o `world` e usa este indice para
     * achar o dono de uma execucao. O indice e um `Map` NOVO a cada
     * `setMap` — entao o espelho precisa apontar para o novo, ou o telegraph
     * ficaria olhando para o elenco do mapa anterior
     */
    this.world.indiceInimigos = this.indiceInimigos;
    this.world.drops = contexto.drops;
    this.world.projectiles = contexto.projectiles;
    this.world.pendingPulses = contexto.pendingPulses;
    this.world.delayedEffects = contexto.delayedEffects;

    this.navGrid = contexto.navGrid;

    /**
     * AS FOLHAS ANDAM COM O ELENCO, E O ELENCO NAO MUDA.
     *
     * O `focusPlayer` roda `aplicarContexto` a CADA jogador em foco, o
     * que no servidor sao tres vezes por jogador por tick: uma na
     * simulacao, uma no broadcast e uma no painel. Cada uma chamava
     * `buildEnemySprites` e realocava uma folha para cada um dos ~93
     * inimigos do mapa, mesmo com o contexto ja aplicado
     *
     * A guarda e pela IDENTIDADE do contexto, e funciona porque o elenco
     * de um contexto e fixo: `montarContexto` cria os inimigos uma vez e
     * nada entra na lista depois. O respawn nao quebra isso — `reviveEnemy`
     * ressuscita o MESMO objeto, com o mesmo id, e nao cria inimigo novo
     *
     * E por isso que o `clear` vem junto: trocando de contexto, as folhas
     * do anterior nao servem para o novo, e ficar com elas era um vazamento
     * que so cresceva conforme o servidor visited mapas
     */
    if (this.contextoAplicado === contexto) return;

    this.contextoAplicado = contexto;

    this.enemySprites.clear();
    this.buildEnemySprites();
  }

  /**
   * O FATOR DE `escalaSprites` DESTA CLASSE NO MAPA QUE ESTA NA TELA.
   *
   * ## POR QUE UM METODO, E NAO A LEITURA DIRETA NOS DOIS LUGARES
   *
   * Porque o fator e lido em dois momentos e eles nao podem discordar: na
   * troca de mapa, para as folhas que ja existem, e na criacao de uma folha
   * nova, quando alguem de outra classe entra na sala. A regra do "numero
   * quebrado vira 1" tambem mora so aqui
   */
  fatorDeEscalaDaClasse(classId) {
    if (!classId) return 1;

    const fatores = this.world.map?.escalaSprites ?? null;
    const fator = fatores?.[classId];

    return typeof fator === "number" && fator > 0 ? fator : 1;
  }

  /**
   * A ESCALA DE CADA FOLHA NESTE MAPA.
   *
   * `escalaDoMapa` na folha e `1` por padrao, entao um mapa sem
   * `escalaSprites` deixa o personagem no tamanho da definicao — que e o
   * comportamento de antes desta propriedade existir
   *
   * ## O QUE ESTA ERRADO NESTA REGRA, E O QUE O JOGADOR VIU
   *
   * Ela pegava o fator da classe do JOGADOR LOCAL e aplicava so na folha
   * local e na folha daquela mesma classe. Com duas pessoas na base, cada uma
   * via a outra grande: o Arbalist via o Sorcerer sem o fator de 0.7, e o
   * Sorcerer via o Arbalist sem o dele — e cada um via o outro 43% maior,
   * sem nenhum dos dois notar que o proprio boneco estava certo
   *
   * A razao do defeito era o comentario de cima dizer que a folha da classe
   * resolvia os remotos. Resolvia so quando o remoto era DA MESMA classe do
   * local, que e o caso em que nao se ve nada de errado
   *
   * ## E POR QUE AGORA SAO TODAS
   *
   * Porque o fator e POR CLASSE, e cada folha do `playerSprites` tem a chave
   * da sua. Um mapa que encolhe duas classes encolhe as duas, para quem
   * entrou antes e para quem entrar depois
   */
  aplicarEscalaDosSprites(mapa) {
    const fatores = mapa?.escalaSprites ?? null;
    const classeLocal = this.classDefinition?.id ?? null;

    if (this.spriteSheet) {
      this.spriteSheet.escalaDoMapa = fatores?.[classeLocal] ?? 1;
    }

    /**
     * O `playerSprites` pode nao existir ainda: o `aplicarContexto` do começo
     * do construtor roda antes dele ser criado, e sem este guarda a construcao
     * do motor cairia num `undefined.get`
     */
    if (this.playerSprites) {
      for (const [id, sheet] of this.playerSprites) {
        sheet.escalaDoMapa = fatores?.[id] ?? 1;
      }
    }
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
   *
   * ## A FOLHA NASCE JA COM O FATOR DO MAPA
   *
   * Porque as folhas sao criadas a DEMORA, quando alguem de outra classe
   * entra na sala, e nao na troca de mapa. Uma folha criada depois do
   * `aplicarEscalaDosSprites` nascia com `escalaDoMapa` em 1 e ficava assim
   * para sempre: o jogador aparecia do tamanho errado e so voltava ao certo
   * ao atravessar um portal
   *
   * Era o mesmo furo do `aplicarEscalaDosSprites`, pelo outro lado: um
   * corrigia as folhas que ja existiam e o outro cuidava das que iam
   * nascer. Com os dois, o fator vale para quem entrou antes e depois
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

    sheet.escalaDoMapa = this.fatorDeEscalaDaClasse(classId);

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

    /**
     * A PLACA SOME QUANDO O PLAYER ESTA APONTANDO PARA ESTE BONECO.
     *
     * E o que resolve a duplicata sem mexer em nenhuma coordenada. A placa
     * fixa e a barra do hover sempre Bennyaram pela mesma faixa, e o jeito
     * de nao ter duas e nao勝 empilhar as duas — e sim deixar uma delas
     * assumir o lugar da outra
     *
     * Quem assume e a BARRA, porque ela so aparece com o mouse em cima e
     * some sozinha quando o mouse sai. A placa faz o contrario: e o que o
     * jogador ve o tempo todo, sem o mouse. E o que some na hora e o que
     * estava competindo com ela
     *
     * E a comparacao e pelo `id` e nao por `isRemote`: sao os dois
     * discriminadores do MESMO jogador, e comparar o id garante que some a
     * placa deste boneco — e nao a de outro remoto que o jogador esteja
     * olhando ao mesmo tempo
     */
    if (this.getInspectedEnemy()?.id === remoto.id) return;

    const base = this.enemyHeadTop(remoto);

    /**
     * A TAG empurra o NOME PARA BAIXO.
     *
     * E e o unico jeito de as duas linhas caberem sem uma ficar em cima da
     * outra: a tag ocupa a posicao de sempre, e o nome desce para a linha
     * seguinte. Sem isto, o nome em `base - 6` ficaria exatamente onde a tag
     * foi desenhada
     */
    const temTag = Boolean(remoto.guilda?.tag);

    context.save();
    context.textAlign = "center";
    context.font = "700 11px Inter, sans-serif";

    // um contorno grosso porque o texto passa por cima de
    // qualquer sprite, incluindo o escuro
    context.lineWidth = 3;
    context.lineJoin = "round";

    if (temTag) {
      const texto = `[${remoto.guilda.tag}]`;

      /**
       * A TAG NA COR DA GUILDA, e a unica coisa da placa que usa a cor.
       *
       * E a cor que o LIDER escolheu, e ela vem do servidor validada contra
       * o catalogo. O contorno preto atras e obrigatorio: sem ele, uma tag
       * de cor clara em cima de um sprite claro vira um borrão, e o jogador
       * do outro lado nao le nada
       */
      context.strokeStyle = "rgba(0,0,0,0.85)";
      context.strokeText(texto, remoto.x, base - 17);

      context.fillStyle = remoto.guilda.cor ?? "#e5bb68";
      context.fillText(texto, remoto.x, base - 17);
    }

    context.strokeStyle = "rgba(0,0,0,0.75)";
    context.strokeText(remoto.name, remoto.x, base - 6);

    context.fillStyle = "#e8f4ff";
    context.fillText(remoto.name, remoto.x, base - 6);

    context.restore();
  }

  /**
   * A PLACA DE NOME DO JOGADOR LOCAL.
   *
   * ## POR QUE ESTA FUNCAO EXISTE AGORA
   *
   * Porque ate aqui o jogador local nao tinha NENHUM nome desenhado sobre o
   * boneco dele: o `drawPlayer` nao escreve texto nenhum. O unico nome no
   * mundo era o de quem estava longe, no `drawNomeDeRemoto`
   *
   * ## E POR QUE O LOCAL E DIFERENTE DO REMOTO
   *
   * Por tres razoes que nenhuma delas e "porque e o dono":
   *
   * 1. a placa so aparece se o jogador LIGAR a tag. Sem isso, ele teria o
   *    proprio nome flutuando na tela o tempo todo, e o nome dele ja esta
   *    na caixa de vitais do canto
   * 2. a tag e a cor da guilda, na cor que o LIDER escolheu
   * 3. quando a tag esta ligada, o nome tambem desce uma linha, para a
   *    posicao que o remoto usa — senao os dois bonecos lado a lado
   *    mostrariam o nome em alturas diferentes
   *
* ## POR QUE NAO REAPROVEITAR O `drawNomeDeRemoto`
     *
     * Porque ele exige `remoto.isRemote` para a ancora da cabeca
     * (`enemyHeadTop` usa a folha da classe do remoto). O jogador local tem
     * `player.definition` e o caminho dele ja estava certo no `drawPlayer`
     *
     * ## E POR QUE O NOME LOCAL DESCE NESTE CASO E NO REMOTO TAMBEM
     *
     * Porque os dois bonecos precisam do nome na MESMA altura quando os dois
     * estao com tag. Se o local usasse `base - 6` com a tag em cima e o
     * remoto usasse outra coisa, os dois nomes andariam em alturas
     * diferentes ao lado um do outro
     */
  drawNomeDoLocal(context) {
    const player = this.world.player;

    if (!player?.name || player.hp <= 0) return;

    /**
     * A TAG do local vem do SNAPSHOT DA GUILDA, e nao do payload de
     * jogadores.
     *
     * Porque o payload de jogadores nao tem o jogador local: ele e o `eu`,
     * que entra pelo `aplicarJogador` — e aquele la le de proposito so o que
     * e movimento. A guilda do jogador e uma coisa de PAINEL, a 4Hz, e e de
     * la que vem a preferencia dele
     */
    const guilda = this.guildaDoJogadorLocal();

    if (!guilda?.tag) return;

    const base = this.ancoraDaCabecaLocal();

    context.save();
    context.textAlign = "center";
    context.font = "700 11px Inter, sans-serif";
    context.lineWidth = 3;
    context.lineJoin = "round";

    const texto = `[${guilda.tag}]`;

    context.strokeStyle = "rgba(0,0,0,0.85)";
    context.strokeText(texto, player.x, base - 17);

    context.fillStyle = guilda.cor ?? "#e5bb68";
    context.fillText(texto, player.x, base - 17);

    /**
     * O NOME DO LOCAL e mais apagado que o do remoto.
     *
     * Porque o nome do jogador local ele ja sabe de cor, e o que importa ali
     * e a tag. O remoto precisa do nome destacado, porque e a unica
     * informacao que diz QUEM e aquele boneco na tela
     */
    context.strokeStyle = "rgba(0,0,0,0.7)";
    context.strokeText(player.name, player.x, base - 6);

    context.fillStyle = "#b9c2ce";
    context.fillText(player.name, player.x, base - 6);

    context.restore();
  }

  /**
   * A GUILDA DO JOGADOR LOCAL, com a opcao dele.
   *
   * ## POR QUE ISTO LE DO `this.tagLocal` E NAO DO PAINEL
   *
   * Porque o canvas precisa da tag a CADA QUADRO, e o painel so existe no
   * instante em que o pacote e montado — a 4Hz. Se o desenho pedisse o
   * painel, ele chamaria `guildaSnapshot`, que dispara
   * `sincronizarPontos`: a regra de pontos por tempo decorrido, sessenta
   * vezes por segundo
   *
   * O `tagLocal` e escrito uma vez por pacote, no `sendSnapshot`, que e o
   * unico lugar do codigo que ja tinha a guilda na ma
   *
   * ## E POR QUE ELE E `null` E NAO UM OBJETO VAZIO
   *
   * Porque "sem guilda" e "com guilda mas sem a opcao ligada" dao o mesmo
   * desenho: nada. Um objeto vazio faria o desenho testar `.tag` em duas
   * linhas para chegar no mesmo lugar
   */
  guildaDoJogadorLocal() {
    return this.tagLocal ?? null;
  }

  /**
   * O TOPO DA CABECA do boneco local.
   *
   * E o mesmo calculo do `enemyHeadTop`, pela mesma definicao: a ancora da
   * arte da classe, com o `scale` do desenho aplicado. Sem o `scale`, a
   * placa subiria ou desceria conforme o tamanho do sprite da classe — e as
   * seis classes nao tem o mesmo tamanho
   */
  ancoraDaCabecaLocal() {
    const player = this.world.player;

    const definition = player?.definition;

    if (!definition) return (player?.y ?? 0) - (player?.radius ?? 12);

    return (
      player.y +
      (definition.footOffset ?? 0) -
      definition.anchorY * definition.scale
    );
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

    /**
     * A PEDIDA DE STEEL, e SO DEPOIS DO INIMIGO.
     *
     * A ordem e deliberada e invertida em relacao ao tamanho da arte. O
     * cristal lendario tem 139x180 de desenho, entao a caixa dele passa por
     * cima de qualquer inimigo que esteja perto. Se a pedra ganhasse, um
     * mob encostado nela viraria mineracao em um clique — e atacar e a
     * acao urgente, com o machado
    
     * O que vem depois nao e do mesmo tipo: o inimigo e o jogador remoto
     * tem RADIUS de acerto, e a pedra tem CAIXA de arte
     */
    if (!target) {
      const pedida = this.pedidaEm(point);

      if (pedida) {
        this.onMineClick?.(pedida);
        return;
      }
    }

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

    if (this.networked) return;


    // ONLINE, as teclas de ORDEM nao sao do motor.
    //
    // `Space`, `1`-`8`, `R` e `T` sao pedidos, e quem executa pedido e
    // o servidor. O `GameCanvas` as transforma em pacote. Se o motor
    // tambem as tratasse aqui, ele mexeria num estado local que ninguem
    // le: a `T` ligaria um auto play que so existe na tela, e o jogador
    // acharia que o botao nao fez nada.
    if (this.networked) return;

    /**
     * A ACAO DESTA TECLA, resolvida pelo `keybinds`.
     *
     * ## O QUE MUDA
     *
     * Antes eram cinco `if (event.code === "...")`, com a tecla escrita no
     * codigo. Agora a tecla e resolvida por QUEM A DETENTA, e o jogador
     * pode trocar essa dona pelo painel de pausa
     *
     * O movimento (`this.input.keys`) continua lido por `code`: ele precisa
     * saber "o W esta apertado AGORA" a cada quadro, e um mapa de teclas por
     * acao nao serve para isso
     */
    const acao = acaoDaTecla(event.code);

    if (!acao) return;

    if (acao === "atacar") {
      this.useBasicAttack();
      return;
    }

    if (acao === "dash") {
      this.useDash();
      return;
    }

    if (acao.startsWith("slot")) {
      this.useSkillSlot(Number(acao.slice(4)));
      return;
    }

    if (acao === "ultimate") {
      this.useUltimate();
      return;
    }

    if (acao === "auto") {
      this.toggleAutoPlay();
      return;
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

  /**
   * ANDAR NA MAO DESLIGA O AUTO.
   *
   * ## O QUE ESTA REGULA FAZ
   *
   * Quando o jogador aperta W, A, S ou D — ou as setas — enquanto ha
   * piloto ligado, viagem automatica ou waypoint, tudo isso e solto na
   * mesma hora. Ele volta a ser dono do boneco
   *
   * ## POR QUE ISTO VIVE AQUI E NAO NO `handleKeyDown`
   *
   * Porque e o unico lugar que ve os DOIS jeitos de andar:
   *
   * - OFFLINE, o motor le `input.keys` e o `handleKeyDown` popula o set
   * - ONLINE, o `keys` do motor fica VAZIO de proposito. Quem manda e o
   *   pacote `INPUT`, que chega como `moveX`/`moveY` e sobrescreve o
   *   que o teclado calculou
   *
   * Se a regra ficasse no `handleKeyDown`, o auto so pararia no modo
   * offline, e o jogador online seguraria o W vendo o boneco do piloto
   * continuar andando
   *
   * ## POR QUE CHECA "HA ALGO LIGADO" ANTES
   *
   * Porque isto roda em TODO quadro em que a tecla estiver pressionada.
   * `soltarPiloto` mexe em oito campos da sessao, e fazer isso sessenta
   * vezes por segundo sem necessidade seria trabalho jogado fora
   *
   * ## POR QUE `soltarPiloto` E NAO SO `setAutoPlay(false)`
   *
   * Porque o auto de ATAQUE e o de DESLOCAMENTO sao coisas diferentes:
   * `setAutoPlay` cuida do flag e do piloto, e o waypoint e o plano de
   * viagem vivem fora dele. Sem o `soltarPiloto`, apertar W parava o
   * ataque mas deixava o boneco seguindo o ponto no mapa — o pior
   * resultado possivel, porque o jogador acha que eiou o auto e ele
   * continua andando sozinho
   */
  soltarAutoAoAndar() {
    /**
     * O AUTO LIGADO PELO BOTAO NAO E SOLTO ANDANDO.
     *
     * ## O QUE O JOGADOR PEDIU
     *
     * Ligou o auto pelo botao acima da ultimate e, andando com WASD, o
     * personagem desligava o auto sozinho. Quem liga algo espera que ele
     * fique ligado: o cancelamento de um autoplay e um clique no MESMO botao,
     * e nao um esbarrao de dedo numa tecla que o jogador usa para tudo
     *
     * ## POR QUE SO O `autoPlay`, E NAO TODO AUTO
     *
     * Porque o `autoPlay` e o unico que o jogador liga com UM BOTAO
     * CAHOLHO. Os outros — auto da missao, do bestiario, seguir alguem —
     * sao consequences de uma ordem anterior (aceitar a missao, clicar em
     * "ir cacar", clicar em seguir), e andar cancelando esses continua
     * fazendo sentido: caçar e seguir sao estados de INTENCAO, e o dedo no
     * teclado e o jogador dizendo "muda de ideia"
     *
     * ## E POR QUE O AUTO DA MISSAO TAMBEM CAI AQUI
     *
     * Porque `soltarPiloto` limpa os campos de sessao, e a missao escreve em
     * `world.quests` — separado. O `setAuto(false)` da ultima linha existe
     * justo para isso: sem ele, o `runTravelPlan` reconstruia o caminho no
     * quadro seguinte e o boneco voltava a andar sozinho, que e o bug
     * descrito no bloco acima. As DUAS linhas continuam, e sao o que garante
     * que "andar cancela" continue valendo para a missao
     */
    if (this.autoPlay) return;

    /**
     * A GUARDA E `isAutoActive`, E NAO UMA LISTA DE CAMPOS.
     *
     * A primeira versao desta regra olhava `autoPlay`, `autoWaypoint`,
     * `autoMoveDirection` e `travelPlan`. Era a lista ERRADA, e o erro
     * custou o auto de deslocamento inteiro
     *
     * `isAutoActive` responde "algum auto esta mandando no boneco", e ele
     * vale como esta: `autoPlay`, `engagedTargetId`, `bestiaryTargetType`
     * e o objetivo da missao. A lista antiga cobria dois desses quatro e
     * ainda usava campos de estado — `autoWaypoint` e `travelPlan` mudam
     * a cada quadro e nao dizem se ha auto ligado
     *
     * ## O BUG QUE A LISTA ERRADA DEIXOU PASSAR
     *
     * Com o auto da MISSAO ligado, `getQuestObjective()` mantinha
     * `isAutoActive()` verdadeiro. Apos limpar o plano, o proximo quadro
     * o `runTravelPlan` via `travelPlan.length === 0` e refazia o caminho
     * do zero com `travelPlanParaObjetivo()`. O jogador apertava W e o
     * boneco voltava a andar sozinho, porque o plano nunca ficava
     * vazio tempo suficiente para o auto se desligar
     *
     * So que o auto da missao também precisa cair, e `setAuto(false)`
     * e o mesmo par que `setAutoPlay(true)` ja usa para "eu assumo o
     * comando" — ver a linha logo acima desta
     */
    if (!this.isAutoActive()) return;

    this.setAutoPlay(false);
    this.soltarPiloto();

    /**
     * O AUTO DA MISSAO TAMBEM SAI, e e o que fecha o caso.
     *
     * `soltarPiloto` limpa `autoPlay`, `engagedTargetId` e
     * `bestiaryTargetType`. Faltava a missao: com ela ligada, o
     * `runTravelPlan` reconstruia o plano no quadro seguinte e o
     * deslocamento voltava sozinho
     */
    this.world.quests.setAuto(false);
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
        "Esta missão precisa ser feita manualmente.",
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
          "Nenhuma missão automática disponível.",
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
        "Termine a missão secundária atual primeiro.",
        true,
      );

      return false;
    }

    this.showMessage(
      "Missão secundária aceita.",
    );

    this.sendSnapshot();

    return true;
  }

  abandonSideQuest() {
    const dropped = this.world.quests.abandonSide();

    if (dropped) {
      this.showMessage(
        "Missão secundária abandonada.",
      );
    }

    this.sendSnapshot();

    return dropped;
  }

  getSkillAuto(skillId) {
    return Boolean(this.sessaoDeJogador?.skillAuto?.has(skillId));
  }

  /**
   * O USO AUTOMATICO DA POCAO: liga, desliga, escolhe a pocao e o limiar.
   *
   * E um metodo so para as tres coisas porque elas nao sao independentes:
   * trocar a pocao com o automatico desligado, ou mexer no limiar com o
   * automatico desligado, sao ajustes que o jogador faz ANTES de ligar e
   * que o painel precisa poder salvar. Tres metodos transformariam o painel
   * em tres pedidos, e um pedido que pela metade e um painel que parece
   * ter gravado
   *
   * ## O QUE ELE RECUSA, E POR QUE
   *
   * - sem `sessao`, nao ha jogador: e o `if` de todos os metodos de intencao
   * - um `itemId` que nao e pocao de cura: o slot da HUD passaria a mostrar
   *   um item que o automatico nunca ia beber
   * - um limiar fora de 5 a 95: em 100 a pocao nunca entra, e em 0 ela entra
   *   com a vida cheia e gasta o item sem curar nada
   *
   * O `limiar` e CLAMPADO em vez de recusado: o jogador arrastando o botao
   * passa por 100 e por 0 o tempo todo, e um painel que so aceita de 5 a 95
   * teria que recusar o arraste inteiro
   */
  configurarAutoPocao({
    ligado = null,
    limiar = null,
    itemId = undefined,
  } = {}) {
    const sessao = this.sessaoDeJogador;

    if (!sessao) return null;

    const atual = sessao.autoPocao;

    /**
     * O ITEM_ID AUSENTE E "TIRAR A POCAO", e nao "nao mexer".
     *
     * Sao tres estados num parametro, e o `undefined` e o terceiro. Sem
     * essa distincao o painel nunca conseguiria esvaziar o slot: passar
     * `null` seria lido como "deixa como esta", que e o que o `ligado` e o
     * `limiar` NAO fazem — os dois usam `null` para "nao mexeu"
     */
    if (itemId !== undefined) {
      const escolhido = itemId === null ? null : String(itemId);

      if (escolhido !== null && !this.isPocaoDeCura(escolhido)) {
        return null;
      }

      atual.itemId = escolhido;

      /**
       * ESCOLHER POCAO DESLIGA O AUTOMATICO, E ISSO E REGRA.
       *
       * Porque o painel liga e desliga sao coisas separadas, e o jogador
       * que troca a pocao ligada vai ver o slot mudar E o automatico
       * desligar. Um slot automatico vazio que bebe sozinha seria o pior
       * estado possivel: o painel diria "ligado" e nada aconteceria, e o
       * jogador culparia a pocao errada
       *
       * Vale para REESCOLHER a mesma pocao tambem: o jogador que abriu o
       * painel para trocar e endeda no mesmo item nao estava pedindo para
       * desligar o automatico, e o que ele estava fazendo e configurando
       * antes de ligar
       */
      atual.ligado = false;
    }

    if (typeof ligado === "boolean") {
      /**
       * LIGAR SEM POCAO NAO LIGA.
       *
       * E a mesma razao do paragrafo acima pelo outro lado: o painel
       * mostraria "ligado" com o slot vazio, e o automatico nao teria o
       * que beber
       */
      atual.ligado = ligado && atual.itemId !== null;
    }

    if (limiar !== null && limiar !== undefined) {
      const numero = Number(limiar);

      if (Number.isFinite(numero)) {
        atual.limiar = Math.max(
          AUTO_POCAO_LIMIAR_MIN,
          Math.min(
            AUTO_POCAO_LIMIAR_MAX,
            Math.round(numero),
          ),
        );
      }
    }

    this.sendSnapshot();

    return { ...atual };
  }

  /**
   * O ITEM E UMA POCAO DE CURA?
   *
   * E o que separa "poção" de "poção de cura". O catalogo hoje so tem as
   * tres de cura, mas quando aparecer a pocao de recurso ela vai entrar pelo
   * mesmo `ITEM_TYPE.POTION`, e o slot do automatico de cura nao pode
   * aceitar uma pocao que nao cura
   */
  isPocaoDeCura(itemId) {
    const item = getItem(itemId);

    if (item?.type !== ITEM_TYPE.POTION) return false;

    const uso = item.use ?? {};

    return Boolean(uso.heal || uso.regeneration);
  }

  /**
   * BEBE A POCAO EQUIPADA, se a vida caiu abaixo do limiar.
   *
   * ## POR QUE ITEM_ID E RESOLVIDO AQUI, E NAO GUARDADO
   *
   * A sessao guarda o `itemId`, e o `uid` da pilha e procurado aqui, no
   * momento de beber. A pilha muda de `uid` quando o jogador muda de mapa,
   * deposita no bau ou pega de volta, e um `uid` guardado seria um ponteiro
   * para o nada depois da primeira dessas coisas
   *
   * ## POR QUE O `>=` NAO E `>`
   *
   * Porque o limiar e o ponto ONDE a pocao entra. Com `>`, o jogador que
   * puser 40 teria que chegar a 39 para beber, e a barra mostraria 40 com a
   * pocao parada do lado
   *
   * ## E ELE CHAMA O `usarItem`, E NAO REAPLICA O EFEITO
   *
   * Porque o `usarItem` e o caminho de uso do item, e ele ja recusa em vida
   * cheia, ja consome a pilha so depois do efeito e ja devolve o que
   * aplicou. Beber a pocao por fora desse caminho gastaria o item sem
   * aplicar o efeito, ou aplicaria duas vezes
   */
  tryBeberAutoPocao() {
    const sessao = this.sessaoDeJogador;

    if (!sessao?.autoPocao?.ligado) return false;

    const config = sessao.autoPocao;

    if (!config.itemId) return false;

    const jogador = this.world.player;

    if (!jogador || jogador.hp <= 0) return false;

    const maxHp = jogador.maxHp ?? 0;

    if (maxHp <= 0) return false;

    const percentual = (jogador.hp / maxHp) * 100;

    if (percentual > config.limiar) return false;

    /**
     * A PILHA SOME E O AUTOMATICO SEGUE LIGADO.
     *
     * Sem esta guarda, o jogador que tinha a ultima pocao bebia uma, o
     * `usarItem` gastava, e a tentativa seguinte ia rodar de novo a cada
     * quadro pelo resto da luta — um `findStack` por quadro atando nada.
     * Aqui o slot vazio e um estado, e o painel e quem mostra
     */
    const pilha = this.world.inventory.findStack(config.itemId);

    if (!pilha || pilha.count <= 0) return false;

    /**
     * JA TEM REGENERACAO CORRENDO: NAO BEBE.
     *
     * E a regra que impede o automatico de mudar de TRES Pocoes para
     * TRINTA por segundo.
     *
     * As tres pocoes do catalogo nao curam na hora: elas aplicam
     * regeneracao, que vai curando aos poucos durante 10 segundos. O
     * `tryBeberAutoPocao` roda por quadro, e o efeito novo so devolve a
     * vida no primeiro tick, 2 segundos depois. Entre a bebida e o
     * primeiro tick a vida continua abaixo do limiar, e sem esta guarda o
     * motor beberia uma poção POR QUADRO ate a bolsa inteira sumir
     *
     * E por que `apply` nao resolve: o `StatusSystem.apply` renova o
     * efeito do mesmo tipo em vez de empilhar, e renovar nao cura nada
     * naquele instante. Cada pocao bebida assim seria um item jogado fora
     *
     * O nome do efeito vem do `use` da propria pocao, e nao de uma
     * constante solta aqui: quando existir a pocao de recurso, ela vai ter
     * outro tipo, e o automatico de cura nao pode passar a checar o
     * efeito errado
     */
    const efeitoDaPocao = getItem(config.itemId)?.use?.regeneration;

    if (!efeitoDaPocao) return false;

    const regenerando = (jogador.statusEffects ?? []).some(
      (efeito) => efeito.type === efeitoDaPocao.type,
    );

    if (regenerando) return false;

    return this.usarItem(pilha.uid);
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

    /**
     * SEM SLOT NO PEDIDO, O MOTOR ESCOLHE.
     *
     * O `slotId` chega nulo quando o pedido veio do "Equipar" da caixa de
     * opcoes do inventario: quem montou o pedido tem o `itemId` mas nao
     * tem um `Equipment` para perguntar, e adivinhar o slot no cliente
     * seria duplicar a regra do catalogo aqui
     *
     * E o `slotForItem` que e a MESMA funcao que decide a posicao em todo
     * o resto do jogo — o item manda no slot quando declara, e o
     * `canEquip` abaixo continua conferindo. Um `slotId` forjado num
     * pedido continua sendo recusado pelo `canEquip`
     */
    const destino =
      slotId ?? equipment.slotForItem(stack.itemId);

    if (!destino) return false;

    if (!equipment.canEquip(stack.itemId, destino)) {
      return false;
    }

    const previous = equipment.equip(
      stack.itemId,
      destino,
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

      /**
       * O APRIMORAMENTO da peca que ENTRA, pelo mesmo motivo do afixo.
       *
       * Sem este quinto argumento o slot receberia `0`, e uma espada
       * aprimorada tres vezes perderia os tres niveis no instante em que
       * o jogador vestisse: o numero estaria na mochila, o slot nao
       * saberia, e o badge sumiria da tela
       */
      stack.enhance,
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

      /**
       * E VOLTA COM O APRIMORAMENTO, pela mesma razao e pelo mesmo `uid`.
       *
       * O `if` cobre o `0` de proposito: gravar zero numa pilha que ja
       * tinha nivel seria apagar o aprimoramento de uma peca IGUAL que
       * ja estava na mochila
       */
      if (devolvida && previous.enhance > 0) {
        devolvida.enhance = previous.enhance;
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
   * catalogo diz O QUE o item faz (`use: { heal: 120 }` ou
   * `use: { regeneration: {...} }`) e este metodo aplica qualquer efeito
   * declarado ali. Uma pocao de mana entra acrescentando
   * `restoreResource`, e um item que da dano pessoal entra com `heal`
   * negativo — sem tocar neste arquivo de novo
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
      } else if (efeito === "regeneration") {
        /**
         * A POCAO VIRA UM EFEITO, E NAO UMA CURA NA HORA.
         *
         * ## POR QUE ISTO E UM `else if` E NAO UM NOVO `use`
         *
         * Porque `use` e o que o JOGADOR escolhe e o motor aplica. Um
         * item que aplica status e um item que faz efeito imediato sao o
         * mesmo caminho, e o `valor` do efeito ja carrega a forma do que
         * ele faz — o `DamageSystem.heal` acima e o `healPerTick` deste
         *
         * ## POR QUE A PECA SE CONSOME MESMO COM A VIDA CHEIA
         *
         * Porque e um efeito com DURACAO: beber na vida cheia nao
         * desperdiça a pocao, deixa o efeito pronto para o golpe que vem.
         * O `apply` devolve `true` mesmo sem curar nada agora, e e esse
         * `true` que faz o item sair da mochila
         *
         * Beber duas vezes renova em vez de empilhar: o `StatusSystem`
         * guarda o maior `remaining`, entao a segunda pocao estende o
         * buff em vez de criar dois com o dobro da cura
         */
        const aplicado = this.statuses.apply(jogador, valor);

        if (aplicado) aplicou = true;
      } else if (efeito === "teachSkill") {
        /**
         * O LIVRO ENSINA A HABILIDADE.
         *
         * E o unico caminho pelo qual o jogador ganha skill: o
         * personagem nasce com zero, e o `useSkillSlot` recusa tudo que
         * nao estiver no `habilidadesAprendidas` da sessao
         *
         * As tres recusas sao o que impede o item virado de container:
         *
         * - a skill tem que ser DA CLASSE do jogador. Sem esta conferida
         *   um livro de Arbalist ensinaria a um Guerreiro, e o
         *   `useSkillSlot` dele nao acharia o slot — o livro sumia e
         *   nada aparecia
         * - a skill tem que EXISTIR. Um id escrito errado no catalogo de
         *   itens viraria um livro que se consome sem ensinar
         * - a skill nao pode ja estar aprendida. Sem esta, o jogador
         *   gasta moedas e um livro para nada, e o `Set` nao cresceria
         *   — o dinheiro sumiria sem troca
         *
         * As tres conferem e devolvem `false`, e o `aplicou` fica falso,
         * o que faz o item NAO ser consumido. E o que o jogador espera:
         * um livro recusado continua na mochila
         */
        const aprendida = this.aprenderHabilidade(valor);

        if (aprendida) aplicou = true;
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

  /**
   * ENSINA UMA HABILIDADE AO JOGADOR EM FOCO.
   *
   * Devolve `true` so quando a skill foi de fato aprendida. O
   * `usarItem` usa este booleano para decidir se gasta o livro, entao
   * um `false` aqui significa "o livro continua na mochila"
   *
   * ## POR QUE ISTO VIVE NO MOTOR E NAO NO CATALOGO
   *
   * Porque a regra e do SERVIDOR: quem decide o que o jogador pode
   * aprender e a mesma autoridade que decide o dano, e as duas mora no
   * motor. Se a conferida de classe estivesse no `books.js`, ela rodaria
   * no cliente tambem, e um cliente modificado ensinaria qualquer skill
   * a qualquer classe
   */
  aprenderHabilidade(skillId) {
    const sessao = this.sessaoDeJogador;

    const jogador = this.world.player;

    if (!sessao || !jogador) return false;

    /**
     * A SKILL PRECISA SER DESTA CLASSE.
     *
     * E o `classeDoJogador` e nao o `classDefinition` do motor: em rede
     * o motor e um so e cada sessao tem a sua classe. Usar a do motor
     * faria um Arbalist no servidor aprender pelas skills do Warrior
     */
    const classeDoJogador = this.classeDoJogador;

    const skill = classeDoJogador?.skills?.find(
      (item) => item.id === skillId,
    );

    if (!skill) {
      /**
       * O id existe, mas nao nesta classe. A mensagem distingue os dois
       * casos de proposito: "nao e sua skill" e "esse livro nao existe"
       * sao defeitos de escrita diferentes, e o jogador nao pode
       * consertar nenhum dos dois
       */
      this.showMessage(
        "Esse livro nao ensina nada para a sua classe.",
        true,
      );

      return false;
    }

    if (sessao.habilidadesAprendidas.has(skillId)) {
      this.showMessage(`Voce ja sabe ${skill.name}.`, true);

      return false;
    }

sessao.habilidadesAprendidas.add(skillId);

      this.showMessage(`Voce aprendeu ${skill.name}!`);

      /**
       * A HABILIDADE CONTA PARA O TUTORIAL.
       *
       * Aqui e nao no `usarItem`: e este metodo que sabe se a skill era
       * DA CLASSE do jogador. Contar no `usarItem` faria o tutorial fechar
       * com o livro de outra classe, que o jogador gasta ouro para ler e nao
       * ensina nada — e ele sairia da missao sem ter aprendido uma skill
       */
      this.resolveQuestProgress(this.world.quests.onAcao("learnSkill"));

      /**
       * O `sendSnapshot` aqui e o que a tela ve.
       *
       * O `usarItem` chama `sendSnapshot` no fim de novo, entao este e
       * redundante para o SERVIDOR — mas o motor tambem roda sozinho no
       * navegador, e sem ele o jogador usaria o livro e a barra so
       * atualizaria no proximo painel
       */
      return true;
  }

  /**
   * ESTE JOGADOR JA APRENDEU ESTA HABILIDADE?
   *
   * E o portao do servidor. A HUD tem a mesma pergunta com uma tranca
   * visual, e as duas leem ESTE metodo — se a tela decidisse sozinha, um
   * jogador digitaria o numero da skill na barra e o motor usaria o que
   * ele nao deveria
   */
  habilidadeAprendida(skillId) {
    return Boolean(
      this.sessaoDeJogador?.habilidadesAprendidas?.has(skillId),
    );
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

    /**
     * E VOLTA COM O APRIMORAMENTO, pelo mesmo motivo do afixo acima.
     *
     * Sem esta linha o jogador perderia os niveis pagos no instante em
     * que tirasse a armadura das costas — e o `unequip` zera o slot, entao
     * nao haveria de onde recuperar o numero
     */
    if (devolvida && previous.enhance > 0) {
      devolvida.enhance = previous.enhance;
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
   * APRIMORA uma peca — da mochila OU do corpo.
   *
   * ## POR QUE UM METODO SO, E NAO DOIS
   *
   * Porque o `enhance` passou a morar na PECA e nao no slot. Os dois
   * caminhos differem so em ONDE o numero esta guardado, entao existem
   * dois metodos com o mesmo preco e a mesma validacao — e assim que um
   * deles divergiria do outro o jogador pagaria um preco na caixa e
   * receberia outro
   *
   * ## POR QUE `applyEquipment` SO NO CAMINHO DO CORPO
   *
   * Porque o ganho so vale enquanto a peca esta vestida: `bonuses` le a
   * lista de equipadas. Aprimorar na mochila nao muda nenhum stat AGORA,
   * e o numero aparece no badge e viaja com a peca quando ela for vestida
   *
   * ## OS TRES DESFECHOS
   *
   * Ate o +5 o degrau e certo. Do +6 para cima o sorteio pode dar tres
   * coisas — subir o nivel, falhar e deixar a peca como esta, ou QUEBRAR
   * a peca. Os tres estao em `enhanceRisco`, e e a tabela que a aba
   * mostra antes do jogador confirmar
   *
   * O `gravar` e o `quebrar` sao os dois lados do risco, e quem os
   * passes e o metodo publico da peca: a mochila apaga a pilha, o corpo
   * esvazia o slot sem devolver
   */
  enhancePeca({ itemId, rarity = null, nivel = 0 }, gravar, quebrar) {
    const bloqueio = enhanceBloqueio(nivel);

    if (bloqueio) {
      return { ok: false, reason: bloqueio };
    }

    const custo = enhanceCost(itemId, nivel, rarity);

    /**
     * O STEEL DO MESMO DEGRAU, pela MESMA tabela do painel.
     *
     * E um preco ADICIONAL ao ouro, nao um substituto: os dois sao
     * debitados no mesmo passo porque e a mesma acao. Quem decide o preco e
     * `enhanceSteelCost`, e nao esta linha — pelo mesmo motivo do
     * `enhanceCost`: se o painel e o motor tivessem numeros separados, o
     * jogador veria um preco na caixa e pagaria outro
     *
     * ## POR QUE A ORDEM E OURO DEPOIS DE STEEL
     *
     * E o que o jogo ja faz com `spendCoins`, entao o steel vem primeiro
     * para nao gerar a situacao de "o ouro saiu e o steel nao cobriu". Num
     * preco de duas moedas, debitar a que mais provavelmente falha por
     * ultimo e o que evita ter que devolver — e nenhum dos dois saldos
     * volta hoje, porque o preco nao volta nem quando o aprimorar FALHA
     */
    const custoSteel = enhanceSteelCost(nivel);

    /**
     * O DEBITO E A UNICA GAREGA DO OURO, pelo `spendCoins`.
     *
     * E nao `addCoins(-custo)`: `addCoins` so ADICIONa, tem
     * `if (amount <= 0) return 0` na primeira linha, entao um valor
     * negativo nao debita nada e nao reclama. O aprimorar ficava de graca
     * — o preco aparecia na caixa e a carteira nunca mudava
     *
     * O `spendCoins` tambem evita a checagem `coins < custo` antes dele:
     * ele ja devolve `false` sem mexer no saldo quando o ouro nao chega,
     * e uma segunda guarda aqui so repetiria a mesma mensagem em dois
     * lugares — um deles acabaria com o texto errado depois de uma
     * mudanca de preco
     */
    /**
     * OS DOIS SALDOS CONFIRMADOS ANTES DE DEBITAR QUALQUER UM.
     *
     * ## POR QUE CONFERIR ANTES, E NAO DEBITAR UM E DEPOIS TESTAR O OUTRO
     *
     * Porque debitar o ouro primeiro e so entao testar o steel perde a moeda
     * do jogador num caminho que ele nao escolheu: com 300 de ouro e 1 de
     * steel num degrau que custa 4, o `spendCoins` passava, o `spendSteel`
     * recusava, e o ouro ja tinha saido da carteira. O jogador clicava para
     * conectar o steel, fracassava, e abria o painel com o ouro a menos e
     * nenhuma explicacao — e a devolucao exigiria um caminho de volta que
     * nenhum dos dois metodos tem
     *
     * Conferir os dois e o que faz o preco ser tudo-ou-nada: ou os dois
     * saldos pagam, ou nenhum deles toca
     *
     * ## POR QUE O STEEL E O PRIMEIRO A SER CITADO
     *
     * Porque ele e o recurso ESCASSO: o ouro vem de missao, venda e bau, e o
     * steel so de bater pedra no Vale 1. Dizer "Ouro insuficiente" para um
     * jogador com ouro de sobra e steel nenhum mandaria atras da moeda errada
     */
    if (this.world.inventory.steel < custoSteel) {
      return {
        ok: false,
        reason: `Steel insuficiente: ${custoSteel} necessários.`,
      };
    }

    if (this.world.inventory.coins < custo) {
      return {
        ok: false,
        reason: `Ouro insuficiente: ${custo} necessários.`,
      };
    }

    /**
     * AGORA SIM, OS DEBITOS.
     *
     * Os dois `spend` vem DEPOIS das duas conferencias, e por isso nenhum
     * deles pode falhar: o saldo ja foi lido acima e nada roda entre a
     * leitura e a escrita. Eles continuam sendo `spend` e nao `addCoins(-x)`
     * pelo motivo do `addCoins` — que so ADICIONa, e um valor negativo nao
     * debita nada e nao reclama
     */
    this.world.inventory.spendCoins(custo);
    this.world.inventory.spendSteel(custoSteel);

    /**
     * O DEGRAU, e o risco dele.
     *
     * `null` ate o +5, e e o que mantem a escada inicial sem surpresa:
     * o jogador aprende o preco nos primeiros seis niveis e so depois
     * precisa se preocupar em perder a peca
     */
    const risco = enhanceRisco(nivel);

    /**
     * UM SORTEIO SO, COMPARADO COM DOIS LIMITES.
     *
     * E o que mantem a razao entre quebrar e falhar igual a da tabela.
     * Dois sorteios — um para quebrar, outro para falhar — fariam a
     * proporcao variar de tentativa para tentativa, e o painel pararia de
     * estar certo depois da primeira peca perdida
     *
     * A ordem dos `if` e a ordem da tabela: `quebra` primeiro porque e o
     * limite menor, e os intervalos somam `falha` sem sobra
     */
    if (risco) {
      const sorteio = Math.random();

      if (sorteio < risco.quebra) {
        this.quebrarPeca(quebrar, itemId, nivel);

        return { ok: true, quebrou: true, nivel };
      }

      if (sorteio < risco.falha) {
        /**
         * FALHOU E A PECA FICOU.
         *
         * O preco JA foi debitado e nao volta: essa e a metade da falha
         * que existe para o jogador ter uma perda menor que a peca. O
         * numero continua no mesmo nivel, entao o proximo clique tenta de
         * novo com a mesma tabela
         */
        this.showMessage(
          `Aprimoramento falhou: ${itemId} continua em +${nivel}.`,
          true,
        );

        return { ok: true, falhou: true, nivel };
      }
    }

    if (!gravar()) {
      /**
       * O DEBITO SEM O CREDITO.
       *
       * Atinge so se a peca sumisse entre a leitura e a escrita, o que
       * nao acontece num tick. A guarda existe para o caso inverso
       * acontecer — e devolver o ouro e mais honesto do que sumir com ele
       */
      this.world.inventory.addCoins(custo);

      return { ok: false, reason: "Não foi possível aprimorar." };
    }

    /**
     * O SNAPSHOT, E O QUE FAZ O JOGADOR VER O RESULTADO.
     *
     * Sem esta linha o numero e do SERVIDOR e o cliente nunca fica
     * sabendo: o preco sai da carteira na tela seguinte, o `applyEquipment`
     * roda no motor local, e o badge continua escondido porque o
     * `snapshot` que o alimentaria nunca foi enviado
     *
     * ONLINE esta chamada e um no-op, e isso e esperado: com
     * `painelExterno` ligado o `sendSnapshot` volta cedo a nao ser que
     * `painelSolicitado` esteja alta. Quem manda o painel do pedido de
     * aprimorar e o `aplicarPainel` do `GameServer`, no fim do `case`
     *
     * OFFLINE e onde ela conta: sem `painelExterno` a guarda nao existe,
     * e este `sendSnapshot` e o unico que atualiza a tela local
     */
this.sendSnapshot();

      /**
       * O APRIMORAMENTO CONTA PARA O TUTORIAL.
       *
       * Aqui e nao no `enhanceItem`: os DOIS caminhos — a peca da mochila e
       * a vestida — passam por este metodo, entao e o unico lugar que ve os
       * dois
       *
       * E ele vem DEPOIS do `sendSnapshot`, e nao antes: o tutorial de
       * aprimorar pede +5, e a missao so se cumpre quando a peca chega
       * la. Contar no `enhanceItem` faria o tutorial fechar no primeiro
       * clique, com a peca em +1
       *
       * ## O QUE O `count: 5` CONTA
       *
       * Cinco aprimoramentos BEM-SUCEDIDOS, e nao "chegar no +5". Um
       * clique pode falhar — o `enhanceRisco` devolveu `falhou` e o preco
       * ja foi debitado — e esse clique nao chega ate aqui: o metodo
       * retorna antes. O contador so anda quando a peca subiu de nivel
       *
       * Contar assim e o que faz o tutorial fechar para o jogador que
       * começou com uma peca em +2: ele precisa de mais tres degraus, e o
       * texto da missao diz "aprimore 5 vezes" em vez de prometer um +5 que
       * nao depende so do que ele fez
       */
      this.resolveQuestProgress(
        this.world.quests.onAcao("enhance"),
      );

      return { ok: true, nivel: nivel + 1 };
    }

  /**
   * EXECUTA a quebra de uma peca, e avisa o jogador.
   *
   * ## POR QUE UM METODO E NAO DUAS LINHAS NO `enhancePeca`
   *
   * Porque a mensagem e a parte que o jogador precisa ler, e ela e a
   * mesma nos dois caminhos. So o `quebrar` muda: a mochila apaga a
   * pilha, o corpo esvazia o slot. Deixar a frase num lugar so evita a
   * mensagem dizer "quebrou" num caminho e sumir no outro
   *
   * O nome da peca vai na mensagem de proposito: "quebrou" sozinho nao
   * diz QUEM quebrou, e com a mochila e o corpo na tela ao mesmo tempo o
   * jogador nao teria como saber o itemId que someu
   */
  quebrarPeca(quebrar, itemId, nivel) {
    const destruida = quebrar?.();

    this.showMessage(
      `${itemId} +${nivel} QUEBROU no aprimoramento e foi perdido.`,
      true,
    );

    this.sendSnapshot();

    return destruida;
  }

  /**
   * APRIMORA a peca da MOCHILA, por `uid`.
   *
   * E o caminho que o painel usa quando a selecao veio da aba "Aprimorar"
   * com a peca nao vestida
   *
   * ## POR QUE A QUEBRA SAI PELO `takeUid`
   *
   * Porque o `takeUid` com a contagem INTEIRA da pilha e o unico jeito
   * de o `Inventory` esquecer a pilha. Nao ha `removeUid`, e criar um so
   * para isto duplicaria o splice que o `takeUid` ja faz — com o risco
   * de os dois divergirem e um item quebrado continuar na mochila
   *
   * O `count` e lido ANTES, porque e a propria pilha que some: ler
   * `stack.count` de dentro do callback encontraria a pilha ja removida
   */
  enhanceItem(uid) {
    const stack = this.world.inventory.findByUid(uid);

    if (!stack) {
      return { ok: false, reason: "Item não encontrado." };
    }

    const total = stack.count;

    return this.enhancePeca(
      {
        itemId: stack.itemId,
        rarity: stack.rarity,
        nivel: stack.enhance ?? 0,
      },
      () => {
        stack.enhance = (stack.enhance ?? 0) + 1;

        return true;
      },

      /**
       * QUEBRAR NA MOCHILA E APAGAR A PILHA INTEIRA.
       *
       * O `count` inteiro, e nao 1: a peca quebrada e a pilha, e deixar
       * as outras copias ali seria o jogador ver o item "quebrado" ainda
       * na mochila com o mesmo nome e a mesma arte
       */
      () => this.world.inventory.takeUid(uid, total),
    );
  }

  /**
   * APRIMORA a peca VESTIDA de um slot.
   *
   * ## POR QUE `applyEquipment` NO FIM
   *
   * Porque o ganho e um MULTIPLICADOR sobre os stats que a peca ja tem
   * (ver `Equipment.bonuses`). Sem recalcular, o `player.attack`
   * continuaria com o numero do nivel anterior e a melhoria so apareceria
   * no proximo `applyEquipment` — o jogador pagaria e nao veria nada
   *
   * A ordem importa: o preco e conferido ANTES do `applyEquipment`,
   * porque e ele que muta o estado dos slots
   */
  enhanceSlot(slotId) {
    const slot = this.world.equipment.getSlot(slotId);

    if (!slot?.itemId) {
      return { ok: false, reason: "Slot vazio." };
    }

    const resultado = this.enhancePeca(
      {
        itemId: slot.itemId,
        rarity: slot.rarity,
        nivel: slot.enhance ?? 0,
      },
      () => this.world.equipment.enhanceSlot(slotId),

      /**
       * QUEBRAR NO CORPO E VAZIO, E NAO DEVOLVER.
       *
       * O `breakSlot` limpa o slot e nao entrega a peca para ninguem
       * devolver. Passar pelo `unequip` aqui colocaria o item de volta na
       * mochila no mesmo instante em que a mensagem diz que ele foi
       * perdido
       */
      () => this.world.equipment.breakSlot(slotId),
    );

    /**
     * SO O CAMINHO DO CORPO RECALCULA OS STATS.
     *
     * Porque `bonuses` le a lista de vestidas, e uma peda na mochila nao
     * esta nela. Sem este `if`, aprimorar na mochila custaria ouro sem
     * mudar um numero na tela — e o jogador culparia o jogo
     *
     * O recalculo tambem roda na QUEBRA, e e obrigatorio: a peca saiu do
     * corpo, entao os stats tem que DESCER sem esperar o proximo
     * `applyEquipment`. Sem isso o ATQ da tela continuaria contando uma
     * peca que o jogo ja destruiu
     */
    if (resultado.ok) {
      this.applyEquipment();
    }

    return resultado;
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

      /**
       * O ENCANTAMENTO CONTA PARA O TUTORIAL.
       *
       * Aqui e nao no `enchantItem`: os DOIS caminhos — a peca da mochila e
       * a que esta vestida — passam por este metodo, entao e o unico lugar
       * que ve os dois. Contar no `enchantItem` faria o tutorial de encantar
       * funcionar so para o que estava na mochila
       */
      this.resolveQuestProgress(this.world.quests.onAcao("enchant"));

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

  /** remove a peça do inventário sem qualquer contrapartida */
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

    /**
     * A TRANCA DO SERVIDOR.
     *
     * O personagem nasce sem nenhuma habilidade e so ganha com o livro.
     * A HUD mostra as trancadas, entao parece decorativo: e por isso que
     * esta conferida esta AQUI e nao so na tela. Um jogador pode digitar
     * o numero da skill, ou um cliente modificado pode pedir o slot direto
     * pelo protocolo, sem passar por nenhum botao
     *
     * Sem esta linha, o trinco visual seria a UNICA trava, e ela estaria
     * no cliente — que e exatamente onde nao se pode colocar trava de
     * coisa que o cliente decide
     */
    if (!this.habilidadeAprendida(action.id)) {
      this.showMessage(
        `Voce ainda nao aprendeu ${action.name}.`,
        true,
      );

      return false;
    }

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
    /**
     * A ULTIMATE LIBERA POR NIVEL, e nao por livro.
     *
     * Ver `ULTIMATE_NIVEL` em `data/skills/index.js`. A tela usa o mesmo
     * numero para pintar o botao, e aqui e a copia que vale: se so a
     * tela conferisse, um jogador de nivel 1 usaria a ultimate o quanto
     * quisesse
     */
    if (!ultimateLiberada(this.world.player?.level)) {
      this.showMessage(
        `A ultimate libera no nivel ${ULTIMATE_NIVEL}.`,
        true,
      );

      return false;
    }

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
  /**
 * O MAPA ATUAL E DE COMBATE?
 *
 * ## POR QUE `combat` E NAO O ID
 *
 * A versao anterior era `this.world.map?.id !== "base"`: o motor sabia o
 * nome de um mapa especifico e tratava todo o resto como de combate por
 * padrao. Funcionava, mas a regra estava no lugar errado — e o jeito de
 * um mapa NAO ter briga era ter o id certo, que nao e uma coisa que se
 * possa ler de um mapa
 *
 * `combat` e declarado pelo mapa: o hub tem `false`, a arena tem `true`,
 * e um mapa novo que esquecer o campo e peaceful por padrao. Esse e o
 * lado certo de errar — um mapa sem `combat` nao derruba o jogador no
 * meio de uma briga que ninguem pediu
 */
  emZonaDeCombate() {
    return this.world.map?.combat !== false;
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
        text: `${sessao.message.text}  —  ${text}`,
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

      /**
       * O CRAFT CONTA PARA O TUTORIAL.
       *
       * E logo DEPOIS do aviso, e nao antes: o `onAcao` pode concluir a
       * missao, e a concludeda chama `resolveQuestProgress`, que manda
       * mensagem. Se o tutorial fosse contado antes do aviso, o jogador
       * leria "Osso Quebrado criado" e DEPOIS "missao concluida", que e a
       * ordem certa. Invertido, a missao aparece concluida antes de o
       * jogador ver o que ele criou
       */
      this.resolveQuestProgress(this.world.quests.onAcao("craft"));

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
deliverCollection(collectionId, indice = null) {
    const resultado = this.world.collection.deliver(
      collectionId,
      indice,
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
     * ordem importa: sem ele, o painel mostraria a parcela como paga e os
     * stats ainda sem o valor novo, no exato instante em que o jogador olha
     * para os dois
     */
    this.applyEquipment();

    /**
     * O AVISO DIZ O ITEM, E NAO A COLECAO.
     *
     * Com entrega por parcela, "Colecao entregue" lie: so uma das duas
     * saiu da mochila, e o jogador veria o card completo num instante em
     * que ainda tem material para buscar
     */
this.showMessage(
        resultado.itemLabel
          ? `${resultado.itemLabel} entregue. ` +
              describeStatBonus(resultado.reward)
          : `Colecao entregue: ${resultado.collection.name}. ` +
              describeStatBonus(resultado.reward),
      );

      /**
       * A ENTREGA CONTA PARA O TUTORIAL.
       *
       * Aqui e nao dentro do `deliver`: o `Collection` nao conhece a
       * `QuestLog`, e o que ele devolve e o resultado da entrega, nao a
       * lista de missoes que ela concluiu. Ligar os dois la dentro criaria
       * uma dependencia do `Collection` no log de missoes, e ele ja depende
       * do inventario e do equipamento
       */
      this.resolveQuestProgress(this.world.quests.onAcao("deliver"));

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

  /**
   * O PAINEL DO BAU: o que esta guardado, e quanto cabe.
   *
   * ## POR QUE `sessaoDeJogador` E NAO `this.world.bau`
   *
   * Porque `this.world` e o ACESSOR que troca com o `withPlayer`: um
   * `this.world.bau` leria o baU de quem o motor esta focando, e o painel
   * e montado pelo `enviarPainel` de UM cliente. A sessao e o lugar do
   * estado privado, pelo mesmo motivo de `lootFilter`, da guilda e da
   * `collection`
   *
   * ## POR QUE O `summary` SEM `equipment`
   *
   * O primeiro argumento do `summary` e o EQUIPAMENTO, usado para marcar
   * `is-equipped` nas pilhas. Passando a mochila ali, o `Inventory` chamava
   * `mochila.isEquipped` e o snapshot inteiro quebrava — o baU e lido a
   * cada pacote, entao isso derrubaria o painel do servidor inteiro
   *
   * E nao ha o que marcar: uma peca guardada esta NO BAU por definicao,
   * e o `equipped: false` que o `summary` devolve sem equipamento e a
   * resposta certa. O painel do inventario e que precisa da marca, e ele
   * recebe o `equipment` de verdade
   */
  bauSnapshot() {
    const bau = this.sessaoDeJogador?.bau;

    if (!bau) return BAU_VAZIO;

    const { coins, ...resto } = bau.summary();

    /**
     * O `coins` SAI do pacote.
     *
     * O `Inventory` sempre teve moedas, e o bau ainda nao decidiu o que
     * fazer com elas. Repassar o campo faria o painel receber um numero
     * que ele nao tem onde mostrar, e o primeiro uso dele seria o jogador
     * achando que da para guardar ouro
     */
    void coins;

    return resto;
  }

  /**
   * DEPOSITA OU RETIRA do bau, conforme a acao.
   *
   * ## POR QUE ESTE METODO E NO MOTOR, E NAO NO `GameServer`
   *
   * Porque o bau e do NPC da BASE, e a base existe no single player. O
   * cofre de guilda mora no `GameServer` porque precisa do `GuildStore`,
   * que so existe online; o bau nao depende de store nenhum, entao a
   * logica dele roda nos dois modos sem `if (online)`
   *
   * O `GameServer` so traduz o pedido em `bauAcao` e chama isto — igual
   * ao `equipItem`, que tambem e do motor e nao do servidor
   *
   * ## POR QUE UM METODO SO PARA OS DOIS SENTIDOS
   *
   * Porque os dois sao o MESMO movimento em direcoes opostas, e as tres
   * coisas que dao errado neles sao as mesmas: item que nao existe, item
   * que nao cabe no destino e afixo/aprimoramento que se perde na volta.
   * Duas metodos teriam duas listas para lembrar de acertar as tres
   *
   * ## O QUE ESTE METODO NAO FAZ
   *
   * Nao decide se o jogador esta perto do bau. Quem decide e o `GameServer`
   * online — la o painel so abre com o NPC da base na tela. No single
   * player o painel abre pelo mesmo clique, entao a proximidade e a
   * distancia de um clique, e forcar isso aqui exigiria saber onde o NPC
   * esta no mapa
   */
  mexerNoBau(bauAcao, uid, quantidade) {
    const sessao = this.sessaoDeJogador;

    if (!sessao?.bau) {
      return { ok: false, reason: "Sem bau." };
    }

    return bauAcao === "depositar"
      ? this.depositarNoBau(uid, quantidade)
      : this.retirarDoBau(uid, quantidade);
  }

  /**
   * A METADE QUE DEPOSITA: mochila -> bau.
   *
   * ## A ORDEM DAS TRES LINHAS
   *
   * Confere espaco, tira da mochila, poe no bau. Inverter a ordem
   * deixaria o item num espaco que ja estava cheio e o `add` jogaria o
   * excedente no `overflow` do bau — o item sumiria da mochila e nao
   * apareceria em lugar nenhum
   *
   * O `cabe` e uma PREDICAO, e ela e o que fecha o caso de boa: entre a
   * conferencia e o `add` nada muda num tick, entao a previsao nunca erra
   * aqui. O que protege o online e o `add` logo abaixo checando o
   * `added`, porque ali quem manda e o estado do servidor
   */
  depositarNoBau(uid, quantidade) {
    const sessao = this.sessaoDeJogador;
    const inventory = this.world.inventory;
    const stack = inventory.findByUid(uid);

    if (!stack) {
      return { ok: false, reason: "Item nao encontrado na mochila." };
    }

    const total = this.quantidadeDoBau(quantidade, stack.count);

    if (total === null) {
      return { ok: false, reason: "Quantidade invalida." };
    }

    if (total > stack.count) {
      return { ok: false, reason: "A pilha nao tem essa quantidade." };
    }

    if (!sessao.bau.cabe(stack.itemId, total, stack.rarity)) {
      return { ok: false, reason: "O bau esta cheio." };
    }

    const guardado = inventory.takeUid(uid, total);

    if (!guardado) {
      return { ok: false, reason: "Nao deu para tirar da mochila." };
    }

    const destino = sessao.bau.add(
      guardado.itemId,
      guardado.count,
      guardado.rarity,
    );

    /**
     * O AFIXO E O APRIMORAMENTO VOLTAM PARA A PILHA CERTA.
     *
     * O `add` cria a pilha do zero, com `enchant` e `enhance` zerados e
     * um `uid` novo. Sem estas duas linhas uma peca guardada voltaria da
     * base sem o afixo que o jogador pagou para colocar, e sem o +12 que
     * ele comprou — e o jogador so descobriria isso quando vestisse a
     * peca de novo, na outra ponta do mapa
     *
     * E o `findStack` e por item e raridade porque e assim que o `add`
     * decide fundir: se a peca entrar numa pilha que ja existia, o
     * afixo que estava naquela pilha e o que o jogador tem
     */
    const pilha = sessao.bau.findStack(guardado.itemId, guardado.rarity);

    if (pilha) {
      if (guardado.enchant) pilha.enchant = guardado.enchant;
      if (guardado.enhance > 0) pilha.enhance = guardado.enhance;
    }

    /**
     * O QUE SOBROU NO BAU VOLTA PARA A MOCHILA.
     *
     * A previsao do `cabe` deveria tornar isso impossivel, e por isso o
     * bloco e um caminho de volta e nao o caminho normal: ele existe
     * porque um item guardado em silencio e o pior resultado que um baU
     * pode dar. Se o `add` recusou parte, o jogador precisa ter o item
     * na mao, e precisa de um aviso
     */
    const devolvido = destino.dropped ?? 0;

    if (devolvido > 0) {
      inventory.add(guardado.itemId, devolvido, guardado.rarity);
    }

    this.sendSnapshot();

    if (devolvido > 0) {
      return {
        ok: true,
        parcial: true,
        guardado: guardado.count - devolvido,
        devolvido,
      };
    }

    return { ok: true, guardado: guardado.count };
  }

  /**
   * A METADE QUE RETIRA: bau -> mochila.
   *
   * A espelhar a deposicao, e o espelhamento e exato: o espaco e conferido
   * no destino, o item sai do bau e volta para a mochila pelo `add`, que
   * refaz o `uid`.
   *
   * A diferenca e o `findStack` do destino: aqui ele e NECESSARIO e nao
   * so porBear afixo, porque o `uid` da pilha do bau e destruido no
   * `add` da mochila. E o `add` funde por item e raridade, entao uma peca
   * recem-retirada pode acabar dentro de uma pilha que ja existia — e e
   * nessa pilha que o afixo tem que ficar
   */
  retirarDoBau(uid, quantidade) {
    const sessao = this.sessaoDeJogador;
    const inventory = this.world.inventory;
    const stack = sessao.bau.findByUid(uid);

    if (!stack) {
      return { ok: false, reason: "Item nao encontrado no bau." };
    }

    const total = this.quantidadeDoBau(quantidade, stack.count);

    if (total === null) {
      return { ok: false, reason: "Quantidade invalida." };
    }

    if (total > stack.count) {
      return { ok: false, reason: "A pilha nao tem essa quantidade." };
    }

    if (!inventory.cabe(stack.itemId, total, stack.rarity)) {
      return { ok: false, reason: "A mochila esta cheia." };
    }

    const retirado = sessao.bau.takeUid(uid, total);

    if (!retirado) {
      return { ok: false, reason: "Nao deu para tirar do bau." };
    }

    const destino = inventory.add(
      retirado.itemId,
      retirado.count,
      retirado.rarity,
    );

    const pilha = inventory.findStack(retirado.itemId, retirado.rarity);

    if (pilha) {
      if (retirado.enchant) pilha.enchant = retirado.enchant;
      if (retirado.enhance > 0) pilha.enhance = retirado.enhance;
    }

    const devolvido = destino.dropped ?? 0;

    if (devolvido > 0) {
      sessao.bau.add(retirado.itemId, devolvido, retirado.rarity);
    }

    this.sendSnapshot();

    if (devolvido > 0) {
      return {
        ok: true,
        parcial: true,
        guardado: retirado.count - devolvido,
        devolvido,
      };
    }

    return { ok: true, guardado: retirado.count };
  }

  /**
   * O PEDIDO DE QUANTIDADE, normalizado.
   *
   * Devolve `null` para um pedido quebrado, e nao o numero como veio.
   * E o que impede o `total` de chegar negativo: `takeUid` com numero
   * negativo nao remove nada e devolve a pilha inteira, o que faria o
   * deposito de "-3" guardar 3 a mais em vez de recusar
   *
   * Sem quantidade e a pilha INTEIRA, e nao 1: e o que o jogador quer
   * quando clica num botao sem numero, e o que o `listarNoMarket` faz
   * pelo mesmo motivo
   */
  quantidadeDoBau(quantidade, count) {
    if (quantidade === null || quantidade === undefined) return count;

    const inteiro = Math.floor(Number(quantidade));

    if (!Number.isFinite(inteiro) || inteiro < 1) return null;

    return inteiro;
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

  /* ------------------------------------------------------------------
     A MORTE DO JOGADOR
     ------------------------------------------------------------------
     Duas saidas, e as duas cobram alguma coisa: reviver na hora custa
     ouro, voltar para a base custa XP. Mais um prazo de 20s, e o prazo
     e o MOTOR que conta — um cliente que calculasse o tempo dele
     mostraria "5s" com os botoes liberados enquanto o servidor ja
     tinha puxado o jogador para o acampamento. */

  /**
   * O JOGADOR ESTA MORTO?
   *
   * E o unico estado que decide se o `DeathPanel` existe, e ele vem do
   * SERVIDOR pelo painel, nunca de um `hp === 0` lido no componente. Um
   * painel que decidisse sozinho teria uma segunda fonte da verdade, e
   * ela divergiria do servidor assim que um dos dois numeros mudasse
   */
  jogadorMorto() {
    return this.world.session?.morte?.ativo === true;
  }

  /**
   * ABRE A MORTE: painel na tela e o prazo rodando.
   *
   * E chamado no tick em que a vida zera, e nao no `DamageSystem`: o
   * mesmo golpe pode matar de dano direto, de veneno, de reflexo ou de
   * qualquer combinacao, e o `hp <= 0` e o unico sinal que todos esses
   * caminhos compartilham
   *
   * A guarda `ativo` evita que o prazo recomece a cada quadro. Sem ela,
   * o jogador nunca sairia do painel: o contador zeraria, o automatico
   * devolveria o jogador a base, e o proximo `updatePlayer` veria
   * `hp <= 0` de novo e abriria uma segunda morte em cima da primeira
   */
  registrarMorte() {
    const sessao = this.world.session;

    if (!sessao || sessao.morte.ativo) return;

    sessao.morte.ativo = true;
    sessao.morte.restante = BALANCE.morte.prazoSegundos;

    /**
     * TUDO QUE ANDA OU BATE SOZINHO DESLIGA AQUI.
     *
     * O `updatePlayer` ja retorna cedo com `hp <= 0`, entao nada se MOVE
     * com o jogador morto. O que continuava ligado era o ESTADO: os flags
     * que dizem "este jogador esta cacando", "esta minerando", "esta
     * seguindo alguem". Sem derruba-los, o jogador ficava parado no chao
     * com o auto marcado como ligado, e ao reviver voltaria cacando o
     * fantasma do alvo, andando sozinho para a mina que ele nao estava
     * mais encostado, ou perseguindo o outro jogador que ele ja nao
     * seguia
     *
     * ## POR QUE NAO BASTAVA DESLIGAR O `autoPlay`
     *
     * Porque o auto nao e um so. Sao cinco modos independentes, e cada um
     * tem o seu flag:
     *
     * - `autoPlay` — o auto que escolhe alvo proprio
     * - `bestiaryTargetType` — a cacada de bestiario, que escolhe a
     *   CRIATURA e nao o bicho: sobrevive ao `autoPlay` desligado
     * - `skillAuto` — as skills arrastadas para a barra de auto, que
     *   batem em qualquer coisa que entre no alcance
     * - `mineracao` — a mineração, com o caminho ate a pedida
     * - `seguindoId` — o auto que persegue outro jogador
     *
     * Cada um e desligado abaixo, e na ordem de quem manda no
     * movimento: o alvo, a viagem, o caminho da mina, e por ultimo os
     * flags que o jogador teria de religar na mao
     *
     * ## E POR QUE ISSO NAO E UM PREJUIZO PARA O JOGADOR
     *
     * Porque nada disso volta ligado depois do respawn. O revive e o
     * `voltarParaBase` nao restauram nenhum destes campos, e cada modo
     * so volta com o comando que o liga: apertar T de novo, arrastar a
     * skill de volta, clicar na pedida. Um jogador que morre no meio de
     * uma mineracao longa tem de clicar na pedra outra vez — e e o
     * comportamento certo: ele morreu, e o servidor nao vai minerar no
     * nome de um corpse
     */
    // o alvo e a viagem: e o que faz o auto escolher bicho e andar ate ele
    this.engagedTargetId = null;
    this.bestiaryTargetType = null;
    this.selectedTargetId = null;
    this.autoWaypoint = null;
    this.travelPlan = [];
    this.travelParado = 0;

    /**
     * O CAMINHO DA CACADA, e o relogio que o recalcula.
     *
     * Sao o par que o `updateAutoPlay` reescreve a cada 0.25s com o caminho
     * do bicho ate o alvo. Como `bestiaryTargetType` acima ja foi para
     * `null`, o auto nao escolhe ninguem e nao recalcula — mas o caminho
     * antigo ficava guardado, e era ele que sobrava quando o jogador
     * religava o auto no respawn: o boneco ia direto para o ultimo spot
     * do mob morto em vez de recalcular
     */
    this.cacadaCaminho = null;
    this.cacadaRelogio = 0;

    /**
     * O CAMINHO DA MINERACAO.
     *
     * E um caminho de verdade, uma fila de pontos ate a pedida, e ele
     * sobrevive a `setMap` justamente por isso. Sem esta linha o
     * jogador voltaria a andar ate a pedra no respawn, e o `runMineracao`
     * — que so tem `player.hp <= 0` como guarda, e nao checa se a
     * sessao ainda QUER minerar — continuaria contando o relogio
     *
     * O `sessao` e o do topo do metodo, e nao `sessaoDeJogador`: os dois
     * apontam para a mesma sessao em foco, e declarar os dois aqui daria
     * "Identifier 'sessao' has already been declared" e derrubaria o motor
     * inteiro no primeiro `registrarMorte`
     */
    if (sessao) {
      sessao.mineracao = null;
      sessao.mineracaoCaminho = [];
      sessao.mineracaoRecalcula = 0;
      sessao.mineracaoTravado = 0;
      sessao.mineracaoMelhor = Infinity;
      sessao.mineracaoRandom = null;
      sessao.mineracaoSteelNoTique = 0;
      sessao.mineracaoSteelEm = 0;
    }

    /**
     * O AUTO QUE PERSEGUE OUTRO JOGADOR.
     *
     * Este e o unico dos cinco que NAO passa por um getter do motor:
     * `seguindoId` vive na sessao e e escrito direto por
     * `comecarSeguir`/`pararDeSeguir`, sem acessorio. O `this.seguindoId = null`
     * que estava aqui criava um campo NO MOTOR — um `seguindoId` propio,
     * paralelo ao da sessao, que ninguem lia. O auto continuava seguindo o
     * outro jogador depois do respawn, porque o auto le
     * `sessao.seguindoId`
     */
    if (sessao) sessao.seguindoId = null;

    // a direcao e o rosto automaticos: sao reescritos a cada tique, mas
    // um frame com eles dentro ja desloca o boneco morto pelo mapa
    this.autoMoveDirection = null;
    this.autoFacing = null;
    this.autoDecisionTimer = 0;

    // e os dois flags que o jogador teria de religir na mao
    this.autoPlay = false;

    /**
     * AS SKILLS DE AUTO, e o `Set` inteiro.
     *
     * Uma a uma seria `setSkillAuto(id, false)` para cada item, e o
     * `Set` nao tem o que percorrer aqui: ele e por sessao justamente
     * para nao ser compartilhado. Limpar e o que desliga as skills
     * arrastadas, e o jogador as arrasta de volta
     */
    if (sessao) sessao.skillAuto.clear();
  }

  /**
   * CONTA O PRAZO, e volta para a base quando ele acaba.
   *
   * O relogio vive na sessao e anda no `update` de cada jogador. E o
   * motor que decide o fim, e nao o painel: quando o prazo zera, a
   * saida padrao acontece sozinha e o `morte.ativo` vai para o proximo
   * pacote, o que fecha o `DeathPanel` pelo caminho normal
   */
  atualizarMorteDoJogador(deltaTime) {
    const sessao = this.world.session;

    if (!sessao || !sessao.morte.ativo) return;

    sessao.morte.restante -= deltaTime;

    if (sessao.morte.restante > 0) return;

    sessao.morte.restante = 0;

    this.voltarParaBase();
  }

  /**
   * REVIVER NA HORA, pagando ouro.
   *
   * ## O PRECO E O DO SERVIDOR, NAO O DO PAINEL
   *
   * O painel mostra `reviveCost(level)` porque o jogador precisa saber
   * antes de clicar, mas quem COBRA e este metodo, contra a mochila de
   * quem pediu. Se o painel mandasse o preco, um cliente modificado
   * pagaria zero — e o ouro do jogo inteiro nao valeria mais nada
   *
   * ## SEM OURO, O BOTAO JA ESTAVA DESLIGADO
   *
   * O `DeathPanel` desliga o botao quando o preco e 0 ou nao ha prazo.
   * Aqui a recusa e silenciosa pelo mesmo motivo do servidor: um painel
   * que sumisse sozinho ensinaria o jogador com a animação do botao, e
   * ele perderia o preco no meio da tela
   *
   * ## FICA ONDE ESTA, E E O QUE DIFERENCA DAS DUAS SAIDAS
   *
   * O revive NAO troca de mapa. O jogador volta a levantar no mesmo
   * ponto onde caiu, com a vida cheia e a luta continuando — que e
   * exatamente o que o painel promete no botao ("Volta aqui mesmo, com
   * vida cheia") e o motivo de ele custar ouro
   *
   * A outra saida, `voltarParaBase`, e a que teleporta: ela troca o mapa
   * e tira o XP. Se as duas fossem para o acampamento, a escolha do
   * jogador seria entre dois precos para o mesmo destino, e pagar ouro
   * nao valeria nada
   *
   * A posicao nao e restaurada a mao porque ela nunca saiu: o
   * `setMap` nao roda, entao `player.x`/`player.y` continuam onde a
   * morte os deixou
   */
  reviverComOuro() {
    const sessao = this.world.session;

    if (!sessao || !sessao.morte.ativo) return false;

    const player = this.world.player;
    const custo = reviveCost(player.level);

    if (custo <= 0) return false;

    if (!this.world.inventory.spendCoins(custo)) {
      return false;
    }

    this.encerrarMorte();

    player.hp = player.maxHp;
    player.alive = true;
    player.hitFlash = 0;
    player.pushVelocity = { x: 0, y: 0 };
    player.statusEffects = [];

    /**
     * SEM `voltarParaAcampamento` AQUI, de proposito.
     *
     * O revive levanta o jogador no MESMO lugar. Chamar o `setMap`
     * teleportava para o acampamento e devolvia o jogador ao meio de um
     * mapa onde ele nunca esteve — e ainda pagava por isso. Ver o
     * comentario do metodo
     */

    this.showMessage(`Revivido por ${custo} moedas.`);

    return true;
  }

  /**
   * VOLTAR PARA A BASE, perdendo XP.
   *
   * E a saida de quem nao tem ouro, e a que o prazo vence sozinho. A
   * perda sai pelo `loseXp`, que e o unico lugar do projeto que
   * DIMINUI `player.xp` — e ele nunca derruba de nivel: a perda e um
   * valor fixo, nao o necessario para descer
   */
  voltarParaBase() {
    const sessao = this.world.session;

    if (!sessao || !sessao.morte.ativo) return false;

    const player = this.world.player;

    const perdido = loseXp(player, xpPerdidoNaMorte(player));

    this.encerrarMorte();

    player.hp = player.maxHp;
    player.alive = true;
    player.hitFlash = 0;
    player.pushVelocity = { x: 0, y: 0 };
    player.statusEffects = [];

    /**
     * A MORTE DO CHEFE VOLTA AO PORTAL, e nao ao acampamento.
     *
     * ## POR QUE O DESTINO MUDA
     *
     * Porque o jogador escolheu este mapa. Morreu na arena, e o
     * acampamento o joga num mapa onde nao ha nada do que ele precisa —
     * a campanha do mapa 1 continua la, e ele teria de andar de volta
     *
     * E o portal e o lugar onde ele apertou "Enfrentar o chefe". Voltar
     * para la deixa ele exatamente onde a tentativa comecou, e a missao do
     * chefe continua na fila: ele pode tentar de novo
     *
     * ## POR QUE SO QUANDO HA `arenaOrigem`
     *
     * Porque a arena nao tem portal dentro dela, e o `irParaArena` so grava
     * a origem quando o jogador SAI. Quem entrou por outro caminho — um
     * comando de teste, um `setMap` — nao tem de onde voltar, e nesse caso o
     * acampamento e o melhor destino disponivel
     */
    const voltouDaArena = this.voltarDaArenaParaOrigem();

    if (!voltouDaArena) {
      this.voltarParaAcampamento();
    }

    const destino = voltouDaArena ? "o portal" : "o acampamento";

    this.showMessage(
      perdido > 0
        ? `Voltou para ${destino}. Perdeu ${perdido} de XP.`
        : `Voltou para ${destino}.`,
    );

    return true;
  }

  /**
   * DEVOLVE O JOGADOR AO PORTAL DE ONDE ELE ENTROU NA ARENA.
   *
   * E o par do `irParaArena` do servidor, que grava a origem antes de
   * trocar de mapa. Aqui a troca e lida: o `arenaOrigem` vira mapa de destino
   * e posicao, e o registro e apagado para nao deixar a proxima entrada em
   * um mapa morto
   *
   * Devolve `false` — e nao faz nada — quando nao ha origem, ou quando o
   * mapa gravado nao existe mais. O chamador cai no acampamento
   */
  voltarDaArenaParaOrigem() {
    const sessao = this.world.session;

    const origem = sessao?.arenaOrigem ?? null;

    if (!origem) return false;

    const mapa = findMap(origem.mapId);

    if (!mapa) return false;

    sessao.arenaOrigem = null;

/**
     * O `setMap` chama o parametro de `chegada`, e nao de `x`/`y`.
     *
     * Passando `{ x, y }` o `setMap` ignoraria a chave e usaria o spawn do
     * mapa — que e o meio do hub. O jogador voltaria do chefe para o
     * centro da cidade, e nao para o portal de onde entrou
     */
    this.setMap(mapa, { chegada: { x: origem.x, y: origem.y } });

    return true;
  }

  /**
   * O QUE AS DUAS SAIDAS COMUM TEM: a morte acabou.
   *
   * O `morte.ativo` e a chave do painel, e esta e a unica coisa que
   * fecha o `DeathPanel` — ele nao tem botao de fechar. Se o
   * `restante` fosse zerado sem virar o `ativo` para falso, o painel
   * continuaria aberto mostrando "Voltando para a base..." para sempre
   */
  encerrarMorte() {
    const sessao = this.world.session;

    if (!sessao) return;

    sessao.morte.ativo = false;
    sessao.morte.restante = 0;
  }

  /**
   * O JOGADOR VOLTA PARA O ACAMPAMENTO.
   *
   * Separate de `voltarParaBase` porque reviver tambem usa, e as duas
   * differem so no que cobrar. O `setMap` e o do proprio motor: e ele
   * que troca o `world` de mapa, recria o contexto e posiciona o
   * jogador no spawn do destino, e um `player.x = ...` depois dele
   * deixaria o jogador no mapa novo com a posicao do mapa antigo
   *
   * E o hub pelo id, e nao por `world.map`: quando o jogador morre no
   * meio da arena, o mapa em foco e `boss_1`, e e para o acampamento
   * que ele volta
   */
  voltarParaAcampamento() {
    const acampamento = findMap("base");

    if (!acampamento) return;

    this.setMap(acampamento);
  }

  /**
   * O CAMPO `morte` DO PAINEL.
   *
   * Vai no `sendSnapshot` pelo mesmo motivo do `portal`: e uma leitura
   * de TELA, e nao estado de mundo. Sai reduzido a quatro campos porque
   * o painel vai por JSON no socket — mandar o objeto inteiro arrastaria
   * referencias que o cliente nao tem como usar
   *
   * O preco vem das MESMAS funcoes que a cobranca usa: `reviveCost` e
   * `xpPerdidoNaMorte`. Um painel que calculasse o preco mostraria um
   * numero e o servidor cobraria outro
   *
   * ## O `restante` E CEIL, E O QUE TEM
   *
   * O painel mostra o tempo que o jogador TEM, e nao o que sobrou no
   * relogio. Sem o `ceil`, o contador passaria de "1s" direto para
   * "Voltando para a base..." um quadro antes do fim, e o jogador
   * perderia o segundo em que ainda dava para clicar
   */
  morteSnapshot() {
    const sessao = this.world.session;

    if (!sessao?.morte?.ativo) return null;

    const player = this.world.player;

return {
        morto: true,
        custoReviver: reviveCost(player.level),
        custoVoltar: xpPerdidoNaMorte(player),
        restante: Math.max(0, Math.ceil(sessao.morte.restante)),

        /**
         * A MORTE FOI NA LUTA DO CHEFE?
         *
         * E o que troca o painel: sem este campo a arena usaria o painel
         * comum, que oferece "Reviver" e "Voltar para a base" — e nenhum dos
         * dois serve. Reviver aqui devolve o jogador ao meio da arena, com o
         * Hulk vivo, e o preco do ouro seria a unica coisa entre ele e uma
         * segunda derrota identica
         *
         * E `arenaOrigem` decide se ha para onde voltar: ele guarda o mapa e
         * a posicao de onde o jogador entrou. Sem origem, a arena nao tem
         * saida registrada, e o `voltarParaBase` cai no acampamento — que e o
         * melhor destino disponivel, e nao a falha que o painel descreveria
         */
        chefe:
          sessao.mapId === ARENA_ID && Boolean(sessao.arenaOrigem),
      };
  }

  /**
   * O CAMPO `mineracao` DO PAINEL, ou `null`.
   *
   * ## POR QUE O TEMPO SAI REPRIMIDO, E NAO COMO O RESTANTE
   *
   * `restante` sai em segundos inteiros de ceil, porque e uma contagem
   * que o jogador ve BAIXAR. O tempo da mineracao e diferente: o painel
   * precisa prometer "faltam 1min20" e continuar TRUE a cada 250ms ate a
   * hora, senao o numero piscaria entre 80 e 79 a cada tique
   *
   * E o `proximoGolpeEm` que vai no pacote, e nao o tempo restante. E o
   * relogio do servidor, entao o cliente faz a conta com o relogio DELE:
   * se o jogador tem o relogio adiantado, o painel mostra o tempo certo
   * mesmo assim
   *
   * ## POR QUE O `steelNoTique` VAI AQUI
   *
   * Porque e o que faz o numero do steel PISCAR na hora da batida. Sem
   * ele, o jogador veria o saldo subir na batida mas nao saberia de onde
   * veio, e com 10s entre batidas e 1 a 3 de premio, um saldo que so
   * cresce nao se distingue de um saldo que cresce sozinho
   */
  mineracaoSnapshot() {
    const sessao = this.world.session;
    const min = sessao?.mineracao;

    if (!min) return null;

    /**
     * O `encostado` E O QUE FAZ O PAINEL ABRIR.
     *
     * Sem este campo, o painel abriria no CLIQUE — e no vale com 40
     * cristais clicar no errado e comum, e o jogador andaria dez segundos
     * pelo campo com um painel de 50s na tela que nao era a pedra dele.
     * Com ele, o painel abre quando ele chega, que e onde a promessa de
     * tempo faz sentido
     *
     * E a MESMA conta do `runMineracao`, com a MESMA folga do servidor.
     * Sao tres lugares usando o mesmo numero — o dado, e nao o acaso
     *
     * ## POR QUE TAMBEM EXIGE `contando`
     *
     * Porque o relogio so arma no tique DEPOIS do lacre. Se o painel
     * abrisse no mesmo tique em que o boneco parou, ele receberia um
     * `proximoGolpeEm` que ainda valeria `null` e o
     * `(proximoGolpeEm - agora)` viraria `NaN` na tela. Exigir `contando`
     * e o que garante que o painel so existe com um relogio de verdade
     * atras — e e a MESMA condicao que o `mineracaoPainel` do servidor usa,
     * entao os dois nao podem discordar
     */
    const prop = this.pedidaMineravel(
      sessao.mapId,
      min.propId,
    );

    /**
     * O RESTANTE VEM DO MUNDO, E NAO DA SESSAO.
     *
     * O contador de batidas pertence a PEDIDA e mora no servidor. O motor
     * nao tem esse estado — e nao pode fazer a conta dele, porque ai seriam
     * duas respostas para a mesma pergunta
     *
     * E por isso que existe o `lerPedida`: o servidor escreve no motor uma
     * funcao que responde "quanto resta nesta pedra", e o motor so formata
     * o que ela devolve. Sem o gancho, a sessao seria a unica fonte e o
     * contador voltaria a morrer a cada cancelamento
     *
     * Sem o gancho — no cliente, ou se o servidor nao ligar — o motor cai
     * no `batidasDe`, que e o total cheio. E o melhor palpite disponivel:
     * o numero so aparece no painel quando o servidor ja mandou o valor
     */
    const leitura = this.lerPedida?.(min.propId) ?? null;

    const batidas = leitura?.batidas ?? batidasDe(min.type);

    const batidasRestantes =
      leitura?.batidasRestantes ?? batidas;

    const encostado =
      min.contando === true &&
      Boolean(prop) &&
      this.encostadoNaPedida(this.world.player, prop);

    return {
      propId: min.propId,
      type: min.type,
      batidas,
      batidasRestantes,
      steelMaximo: steelMaximoDe(batidas),
      proximoGolpeEm: min.proximoGolpeEm,
      steelNoTique: sessao.mineracaoSteelNoTique ?? 0,
      encostado,
    };
  }

  /**
   * O CAMPO `teleporte` DO PAINEL, ou `null`.
   *
   * E o que faz a box aparecer embaixo do minimapa. Sai reduzido porque
   * o painel vai por JSON no socket a 20Hz
   *
   * ## A FONTE E O OBJETIVO, E NAO O PLANO
   *
   * Ler a etapa `travelPlan[0]` foi o primeiro erro, e ele custou tres
   * bugs de tela. O `travelPlan` e um CACHE: ele e rebuilado as vezes e
   * fica vazio entre uma??agem e outra. ligar e desligar o auto
   * esvazia o plano, e a box sumia com ele mesmo com o auto ligado
   *
   * Quem responde "para onde este auto esta indo" e o
   * `destinoDoObjetivo`, que e a FONTE de que o plano e feito. Ele
   * responde a hora que o objetivo muda, com o plano velho ou sem plano
   *
   * ## POR QUE A DISTANCIA VAI ATE UM `Infinity`
   *
   * A distancia so existe entre duas coordenadas do MESMO mapa. Com o
   * destino do outro lado de um portal, `(5230, 3470)` no vale nao tem
   * nada a ver com `(840, 588)` no hub, e a distancia entre os dois
   * numeros e uma mentira que so serve para enganar a comparacao
   *
   * Entao ela e `Infinity`: nao ha distancia alguma, o que e a mesma
   * coisa que "longe demais para estar perto", que e a unica coisa que
   * esta comparacao decide. E o `distancia` que SAI no painel e `null`,
   * para a box nao mostrar um numero de pixel inventado
   *
   * ## SO A CHEGADA ESCONDE A BOX
   *
   * A unica condicao que apaga a box e o jogador estar perto do destino
   * final. Nao ha piso de distancia, nem exige que o destino esteja
   * neste mapa: enquanto o deslocamento automatico estiver ligado e o
   * jogador nao tiver chegado, a box existe
   *
   * ## O `pergaminhos` VEM DO INVENTARIO, E E POR JOGADOR
   *
   * E o que desliga o botao com o motivo escrito na tela. A contagem e
   * do `world.inventory` do jogador em foco, e nao de um campo do motor:
   * o pergaminho e item de alguem, e dois jogadores com mochilas
   * diferentes nao podem ver o mesmo numero
   */
  teleporteSnapshot() {
    const sessao = this.world.session;
    const player = this.world.player;

    if (!sessao || !this.isAutoActive()) return null;

    const destino = this.destinoDoObjetivo();

    if (!destino) return null;

    const mesmoMapa = destino.mapId === this.world.map.id;

    const distancia = mesmoMapa
      ? Math.hypot(destino.x - player.x, destino.y - player.y)
      : Infinity;

    if (distancia <= TELEPORTE_PERTO) return null;

    return {
      x: destino.x,
      y: destino.y,
      mapa: destino.mapId,
      distancia: mesmoMapa ? Math.round(distancia) : null,
      pergaminhos: this.world.inventory.count(
        PERGAMINHO_TELEPORTE_ID,
      ),
    };
  }

/**
   * TELEPORTA PARA O FIM DO DESLOCAMENTO, gastando um pergaminho.
   *
   * ## O DESTINO E O OBJETIVO, NOSSO MAPAS
   *
   * O mesmo do `teleporteSnapshot`, e pelo mesmo motivo: o `travelPlan`
   * e um cache e o objetivo e a fonte. Ler o plano aqui faria o
   * teleporte falhar exatamente nos casos em que a box aparece — logo
   * apos ligar o auto, quando o plano ainda esta vazio
   *
   * ## ATRAVESSAR MAPA E TROCAR DE MAPA DE VERDADE
   *
   * Com o destino do outro lado de um portal, isto chama `setMap` como
   * qualquer outra viagem: nao e um salto de coordenada, e uma entrada
   * de verdade no mapa de destino, com o `sessao.mapId` trocado e o
   * mundo remontado
   *
   * ## O PONTO FINAL E CONFERIDO ANTES
   *
   * `isInsideBounds` no contexto do mapa de DESTINO, e nao do atual. Um
   * teleporte para fora do mapa colocaria o jogador em um limbo: dentro
   * do `world`, sem chao e sem colisor, e o proximo passo do simulador
   * o empurraria para fora do mundo sem ninguem saber onde ele foi
   *
   * ## O GASTO VEM ANTES DO SALTO, E NESSE ORDEM
   *
   * Contar, tirar, e so entao mover. Se o salto falhasse e o pergaminho
   * ja tivesse saido da mochila, o jogador perderia o item sem ganhar
   * nada — e o `setMap` aqui tem como falhar, na conferida de borda
   */
  teleportarParaOFim() {
    const sessao = this.world.session;

    if (!sessao || !this.isAutoActive()) return false;

    const destino = this.destinoDoObjetivo();

    if (!destino) return false;

    if (!this.world.inventory.has(PERGAMINHO_TELEPORTE_ID)) {
      this.showMessage(
        "Voce nao tem pergaminho de teleporte.",
        true,
      );

      return false;
    }

    const mapa = findMap(destino.mapId);

    if (!mapa) return false;

    const contexto = this.contextoDoMapa(mapa);

    if (
      !contexto.collision.isInsideBounds(
        { x: destino.x, y: destino.y },
        RAIO_DO_JOGADOR,
      )
    ) {
      return false;
    }

    this.world.inventory.take(PERGAMINHO_TELEPORTE_ID);

    /**
     * O `setMap` RECEBE a chegada, e nao o spawn.
     *
     * Sem o `chegada`, um teleporte para o vale colocaria o jogador no
     * meio do mapa — a tres mil pixels da zona que ele pagou para pular
     */
    this.setMap(mapa, { chegada: { x: destino.x, y: destino.y } });

    /**
     * O PLANO ACABOU, e e ele que some.
     *
     * Sem isto o piloto continuaria andando: o `runTravelPlan` leria a
     * etapa, veria que o jogador esta em cima do destino e a concluiria
     * sozinho no proximo quadro. Funcionaria, mas deixaria o auto ligado
     * com a etapa seguinte ja montada — e o jogador que teleportou para
     * terminar a viagem receberia a proxima cacada na cara
     */
    this.travelPlan = [];
    this.travelParado = 0;
    this.autoWaypoint = null;

    return true;
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

    /**
     * O MOB VOLTA PARA O PONTO DE SPAWN, E NAO PARA ONDE MORREU.
     *
     * ## O QUE ACONTECIA ANTES
     *
     * Nada aqui mexia na posicao, e o cadaver e o mesmo objeto que
     * renasce. O goblin abatido a 300px do seu spawn voltava de pe a 300px
     * do seu spawn — o `spawnX`/`spawnY` existiam desde o `createCreature`
     * e so eram lidos pelo `EnemyAI`, como a casa do pastoreio. O
     * `wanderTarget` e zerado aqui, entao o novo alvo de passeio nascia em
     * volta de uma casa que o proprio mob nao estava mais perto
     *
     * ## POR QUE O PONTO FIXO E A REGRA, E NAO UM DETALHE
     *
     * Porque o jogador usa o spawn como referencia. Ele sabe que o goblin
     * fica do lado do Brejo, e e por isso que ele sabe onde ir caçar. Um
     * goblin que migra de sitio a cada morte quebra essa referencia e
     * manda o jogador para o Brejo findingar vazio
     *
     * E porque o spawn e o que garante o pastoreio: o `leash` do
     * `EnemyAI` mede a distancia ate o `spawnX`. Deixar o mob renascer
     * longe de casa entregava a ele um pastoreio medido a partir de um
     * ponto que ele ja tinha abandonado
     *
     * ## POR QUE A GUARDA NOS DOIS NUMEROS
     *
     * Porque `x` e `y` nao vem sempre em par. Uma criatura montada fora
     * do `createCreature` pode ter um deles e nao o outro, e escrever
     * `NaN` na posicao de um mob real o apaga da tela para sempre, sem
     * erro nenhum no console. Com a guarda, uma criatura sem ponto de
     * spawn apenas fica onde estava — o comportamento antigo, e nao um
     * buraco
     */
    if (
      Number.isFinite(enemy.spawnX) &&
      Number.isFinite(enemy.spawnY)
    ) {
      enemy.x = enemy.spawnX;
      enemy.y = enemy.spawnY;

      /**
       * O ROSTO VOLTA PARA O SUL, que e o do `createCreature`.
       *
       * O `EnemyAI` roda o `facing` todo quadro de um mob vivo, entao isto
       * so e visivel no primeiro quadro depois do renascimento. Sem ele,
       * o goblin volta de pe virado para o lado de onde morreu, olhando
       * para o jogador que o matou
       */
      enemy.facing = { x: 0, y: 1 };
    }

    /**
     * O RELOGIO DA MORTE VOLTA A ZERO JUNTO COM A VIDA.
     *
     * O goblin renascido precisa comecar em `deathDuration +
     * deathFade` de novo quando levar o proximo golpe. Deixar o valor
     * antigo — que ja estava em 0 apos a morte — faria o proximo
     * abate nao ter cadaver nenhum
     */
    enemy.deathTimer = null;
    enemy.deathFade = 0;
    enemy.deathDuration = 0;

    enemy.statusEffects = [];
    enemy.pushVelocity = { x: 0, y: 0 };
    enemy.hitFlash = 0;
    enemy.aiState = "idle";
    enemy.alerted = false;
    enemy.provoked = false;
    enemy.wanderTarget = null;

    /**
     * A TRAVA DE ALVO MORRE COM A CRIATURA.
     *
     * Sem estas duas linhas o esqueleto renasceria ja com alvo: o
     * `targetId` apontaria para o jogador que o matou, e ele atravessaria
     * o mapa perseguindo um corpse. E o `lastHitById` traria o proximo
     * alvo junto — que e pior, porque o jogador que o matou ficaria como
     * alvo valido assim que outro jogador encostasse nele
     *
     * E `provoked`/`alerted` sozinhos nao limpam nada disto: eles sao o
     * estado do mob, e o alvo travado e o estado da REGRA de retaliação
     */
    enemy.targetId = null;
    enemy.lastHitById = null;

    // o proximo abate deste mob precisa poder ser premiado de
    // novo, e o loot do ciclo anterior nao pode sobrar para
    // informar quem matou da proxima vez
    enemy.rewardGranted = false;
    enemy.lastHitBy = null;

    return enemy;
  }

  /**
   * DESFAZ O AGGRO DE UM MAPA INTEIRO, sem ressuscitar ninguem.
   *
   * ## O QUE ESTE FAZ E POR QUE EXISTE
   *
   * Ao atravessar um portal, o jogador cai em outro mapa — mas o mob que
   * estava perseguindo ele na tela ANTERIOR continua com o `targetId`
   * apontado para aquele jogador. Como o `targetId` e um id de sessao e nao
   * uma posicao, o mob nao percebeu a teleporte: ele simplesmente continuou
   * com um alvo que sumiu do mundo dele
   *
   * O sintoma era o pior dos dois: o jogador atravessava o portal e, no mapa
   * de destino, ouvia o mob perseguindo e perdia vida antes de ver a tela —
   * a morte logo apos o teleporte, sem ter feito nada
   *
   * ## E POR QUE NAO REAPROVEITA O `reviveEnemy`
   *
   * Porque o `reviveEnemy` RESSUSCITA. Estas criaturas estao VIVAS: se
   * passassem por ele, cada mob do mapa receberia `hp = maxHp` e
   * `alive = true` — e um mob que o jogador ja tinha ferido voltaria cheio
   * de vida no meio do telescopio
   *
   * E por isso que o `hp` NAO entra aqui: o reset e sobre ONDE o mob esta e
   * no QUE ele quer, nunca sobre QUANTO ele tem
   *
   * ## E POR QUE VOLTA PARA O SPAWN, E NAO SO ESQUECE O ALVO
   *
   * Porque esquecer o alvo sem voltar ao spawn deixa o mob parado no meio
   * do territorio, e o jogador que chegar no mapa acha que a zona esta vazia.
   * O spawn e a referencia que o jogador usa para saber onde caçar — ver o
   * bloco do `reviveEnemy`, que e o mesmo argumento pelo mesmo campo
   */
  resetarAggroDoMapa() {
    /**
     * OS CHEFES NAO ENTRAM.
     *
     * E o arena: o chefe tem uma sala, e o `setMap` da arena e outro caminho
     * que nao passa por aqui. Se algum dia passar, o chefe nao tem `spawnX`
     * util para voltar — ele fica onde a arena o colocou
     */
    for (const enemy of this.world.enemies ?? []) {
      if (!enemy?.alive) continue;

      if (enemy.isBoss) continue;

      enemy.targetId = null;
      enemy.lastHitById = null;
      enemy.alerted = false;
      enemy.provoked = false;
      enemy.aiState = "idle";
      enemy.wanderTarget = null;
      enemy.facing = { x: 0, y: 1 };

      /**
       * OS EFEITOS DE STATUS TAMBEM CAEM.
       *
       * Porque o jogador atravessa o portal com o que tinha: um stun de uma
       * armadilha do mapa anterior nao pode seguir ele para o proximo. E o
       * `pushVelocity` vai junto, que e o que impede um empurrao de resultado
       * de continuar depois da teleporte
       */
      enemy.statusEffects = [];
      enemy.pushVelocity = { x: 0, y: 0 };
      enemy.hitFlash = 0;

      if (
        Number.isFinite(enemy.spawnX) &&
        Number.isFinite(enemy.spawnY)
      ) {
        enemy.x = enemy.spawnX;
        enemy.y = enemy.spawnY;
      }
    }
  }

  /**
   * Um inimigo VIVO pelo id, ou `null`.
   *
   * O caminho rapido e o indice do contexto, que responde direto. O
   * indice so conhece o ELENCO do mapa, e o `alive` continua sendo
   * conferido aqui: o indice sabe que o slime 7 existe, nao que ele esta
   * de pe
   *
   * A RESERVA no `world.enemies` nao e redundancia. No cliente online,
   * `NetworkWorld` empurra os OUTROS jogadores dentro de
   * `world.enemies` — e e assim que o desenho deles reaproveita o
   * caminho de codigo dos mobs. Se alvo de jogador e uma coisa que o
   * jogo aceita, o indice do roster nunca acha esse id e a reserva e o
   * que impede o alvo selecionado de sumir
   *
   * Sem a reserva o comportamento mudaria em silencio: o alvo continuaria
   * selecionado, mas o painel e a barra de vida parariam de aparecer. E
   * um bug que so se ve com duas pessoas na tela
   */
  findEnemyById(id) {
    if (id === null || id === undefined) {
      return null;
    }

    const indice = this.indiceInimigos;
    const peloIndice = indice?.get(id) ?? null;

    if (peloIndice) {
      return peloIndice.alive ? peloIndice : null;
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

  /**
 * ONDE FICA O PORTAL QUE ABRE A ARENA, quando a missao em foco e do CHEFE.
 *
 * ## POR QUE O PORTAL E NAO A ARENA
 *
 * Porque a arena e um destino que o auto nao sabe alcancar. Nao ha `zone`
 * nela, e nao ha portal apontando para `boss_1` — a entrada dela e o botao
 * "Enfrentar o chefe" do portal selado, que e um pedido do servidor
 *
 * Apontar o auto direto para a arena faria o `rotaDeMapas` procurar um
 * portal inexistente, e o plano de viagem sairia vazio
 *
 * ## POR QUE ACHAR O PORTAL PELO DADO E NAO PELO NOME
 *
 * Porque o portal que abre a arena e o mesmo que abre o mapa 2 — o
 * `portal_floresta`, com `exigeMissaoDe: "map_1"`. E ele ja esta no
 * `portals` do mapa, e o auto pode ler de la
 *
 * A chave do mapa e `portals`, em ingles, com um "s" — e nao `portais`.
 * Escrever em portugues daria `undefined` no acesso, e o `?? []` engoliria
 * o erro: o auto simplesmente nunca acharia portal nenhum, sem nenhuma
 * pista do motivo
 *
 * A busca e pelo `exigeMissaoDe` porque e a MESMA regra que tranca o
 * portal. Um portal que nao exige nada abre para todo mundo, e nao seria a
 * porta do chefe
 *
 * ## O QUE ELE DEVOLVE
 *
 * O CENTRO do portal. E nao o `x`/`y` dele: o `destino` e um ponto dentro
 * do mapa, e o auto chega andando ate ele
 *
 * E `null` quando nao ha portal — sem chefe na frente, a missao volta ao
 * caminho normal pela zona
 */
destinoDoChefe(objective) {
      if (!objective?.chefe) return null;

      const sessao = this.world.session;

      if (!sessao) return null;

      /**
       * O MAPA E O DO OBJETIVO, E NAO O MAPA ONDE O JOGADOR ESTA.
       *
       * ## O QUE ESTAVA ERRADO
       *
       * Buscava `findMap(sessao.mapId)` — o mapa onde o jogador esta. E o
       * jogador esta na BASE quando liga o auto, e o `portal_floresta` vive
       * no `map_1`. Os dois portais estao em mapas diferentes, entao a busca
       * rodava, nao achava nenhum, e o `destinoDoChefe` devolvia `null`
       *
       * E o `null` caia no `getQuestZone`, que devolve `null` tambem (a missao
       * tem `location: "arena"`). Sem destino, `travelPlanParaObjetivo`
       * devolvia `false`, o `runTravelPlan` nao andava, e o boneco ficava
       * parado — sem mensagem, porque um destino ausente e um estado valido
       *
       * ## POR QUE E O MAPA DO OBJETIVO
       *
       * Porque a missao DIZ onde o destino esta: `chefe.arena` e `boss_1`, e
       * o portal que abre a arena esta no `map_1`, que e o mapa da campanha
       * da missao. O mapa do jogador e so onde ele esta agora — e no meio da
       * caminhada ele troca, entao procurar nele daria um destino diferente a
       * cada passo
       *
       * E a busca e por `destino === arena` OU por `exigeMissaoDe === "map_1"`,
       * e nao so pelo primeiro: o portal que abre a arena e o mesmo que abre
       * o mapa 2, entao os dois nomes descrevem o mesmo objeto
       */
      const mapaDoChefe = findMap(objective.chefe.arena);

      /**
       * O MAPA DA CAMPANHA, e nao o da arena.
       *
       * O `boss_1` e um mapa sem portais — e o destino do portal, nao a casa
       * dele. O portal fica no mapa que o jogador alcanca a pe, que e o da
       * campanha onde a missao esta
       */
      const mapaDaCampanha = findMap("map_1");

      const mapa = mapaDaCampanha ?? mapaDoChefe;

      const portal = (mapa?.portals ?? []).find(
        (p) => p.exigeMissaoDe === "map_1" || p.destino === objective.chefe.arena,
      );

      if (!portal) return null;

      return {
        x: portal.x,
        y: portal.y,
        mapId: mapa.id,
        portal,
      };
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

      /**
       * O MOB DE OUTRA PESSOA NAO ENTRA NA CONTA.
       *
       * Sem esta linha, o auto de um jogador subia no mob que o outro
       * estava batendo e o loot do abate acabava com quem clicasse por
       * ultimo. O `pickNearestCreature` tem a mesma guarda: os dois
       * caminhos precisam dela, porque um passa pelo objetivo da
       * missao e o outro nao
       */
      if (this.mobDeOutroJogador(enemy)) continue;

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

  /**
   * ESTE MOB JA ESTA SENDO BATIDO POR ALGUEM QUE NAO SOU EU?
   *
   * E a pergunta que o autoplay tinha de responder e nao respondia.
   *
   * ## O QUE ACONTECIA
   *
   * O `pickAutoTarget` pegava o mob mais proximo do MAPA, sem perguntar
   * a quem ele pertencia. Com dois jogadores na mesma regiao, o auto do
   * segundo ia direto no mob que o primeiro estava batendo: os dois no
   * mesmo bicho, e o loot do abate ia para quem desse o ultimo golpe.
   * O sintoma era "o jogador parado ficou com o loot" — ele nao estava
   * parado, o auto dele simplesmente tinha subido no mob do outro
   *
   * Isso so aparecia enquanto os dois estavam no mesmo mapa. Separados
   * por um portal, cada um tinha a sua lista de mobs e o auto nao tinha
   * o que invadir. Voltar para a base "consertava" o loot sem consertar
   * nada: so tirava o alvo de alcance
   *
   * ## A REGRA
   *
   * O mob e de quem JA LEVOU DANO nele, e o dano diz de quem: o
   * `lastHitBy`. Se for o proprio dono, o mob e dele. Se for um membro
   * da MINHA party, o mob e do meu grupo e o party hunting continua
   * funcionando: dois na party de proposito no mesmo bicho e a co-op
   * que existe. Fora dos dois casos, o mob pertence a outra pessoa e o
   * auto nao encosta
   */
  mobDeOutroJogador(enemy) {
    const dono = this.world.player;

    if (!dono) return false;

    const quemPegou = enemy.lastHitBy;

    // mob sem ninguem batendo ainda: e o primeiro a chegar nele
    if (!quemPegou) return false;

    // o proprio dono, ou o mob que EU ja estou batendo
    if (quemPegou.id === dono.id) return false;

    // companheiro de party: o mesmo grupo cacando junto e o certo
    const partyDele = this.partyStore?.partyDe(quemPegou.id);
    const minha = this.partyStore?.partyDe(dono.id);

    if (partyDele && minha && partyDele.id === minha.id) return false;

    // fora da party, ou em party diferente: o mob e dele
    return true;
  }

  pickNearestCreature() {
    const player = this.world.player;
    const leash = this.autoLeashRange;

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      // o mob de outra pessoa nao entra na conta
      if (this.mobDeOutroJogador(enemy)) continue;

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

  /**
   * A MISSAO DO CHEFE NAO TEM ZONA: ELA TEM ARENA.
   *
   * A arena nao tem zona de mob — e um retangulo com o chefe no meio, sem
   * `zones`. O `getQuestZone` abaixo devolveria `null` e o auto ficaria sem
   * destino: o jogador apertava o auto, o personagem andava ate o limite do
   * mapa e parava, sem nenhuma pista do que aconteceu
   *
   * E a arena nao e um portal: nao existe `portal` apontando para
   * `boss_1`. Quem entra nela e pelo botao "Enfrentar o chefe", que e um
   * pedido do SERVIDOR, e nao um passo de rota. Entao nao adianta apontar o
   * auto para um destino em outro mapa: o `rotaDeMapas` procuraria um portal
   * que nao existe
   *
   * O que o auto faz e levar o jogador ate o PORTAL — o `portal_floresta`,
   * que e o que abre a arena. Da la em diante o auto e o jogador seguem o
   * caminho normal
   */
  const destinoDoChefe = this.destinoDoChefe(objective);

  if (destinoDoChefe) return destinoDoChefe;

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
       *
       * ## E POR QUE O CHEFE INVERTE ESTA REGRA
       *
       * Porque o `pickAutoTarget` exige que a criatura esteja DENTRO da
       * zona do objetivo, e a missao do chefe tem `location: "arena"` — que
       * nao existe como zona. O `getQuestZone` devolvia `null`, e com a zona
       * nula o `pickAutoTarget` aceita QUALQUER criatura viva perto
       *
       * E ai esta o inverso do comportamento: o jogador ligava o auto no
       * hub, o primeiro bicho do caminho era aceito como alvo, a
       * caminhada era cancelada, e o boneco ficava parado sem se mexer
       *
       * ## POR QUE AINDA ASSIM, E NAO SIMPLESMENTE "NUNCA CACAR"
       *
       * Porque a MISSAO do chefe e `type: "kill"`, e o `target` dela e o
       * `hulk`. Quando o jogador ja tiver chegado na arena, o `hulk` sera o
       * alvo legitimo, e o `runTravelPlan` precisa devolver `false` para
       * deixar o `runAutoHunt` pegar o controle
       *
       * Entao a regra e: a cacada vence **so quando ha um alvo do tipo
       * certo**. Com a zona nula, o `pickAutoTarget` tem que recusar os
       * bichos que nao sao o hulk — e nao aceitar qualquer um
       */
      const objetivo = this.getAutoObjective();

      if (!this.world.session?.seguindoId) {
        /**
         * O ALVO PRECISA SER O DO OBJETIVO, e nao "um bicho".
         *
         * A guarda original aceitava qualquer alvo vivo, e isso era verdade
         * enquanto toda missao tinha zona: dentro dela so havia as criaturas
         * do objetivo. A missao do chefe quebrou a premissa — o
         * `location: "arena"` nao existe como zona, o `getQuestZone` devolve
         * `null`, e com a zona nula o `pickAutoTarget` aceita qualquer
         * criatura viva perto
         *
         * O sintoma era o pior possivel: o jogador ligava o auto no hub, o
         * primeiro slime do caminho servia de alvo, a caminhada era
         * cancelada, e o boneco ficava parado sem se mexer
         */
        const alvo = this.pickAutoTarget();

        const eDoObjetivo =
          alvo &&
          objetivo?.target &&
          alvo.id.replace(/_\d+$/, "") === objetivo.target;

        if (eDoObjetivo) return false;
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
      if (this.travessarPortal()) {
        this.travelPlan.shift();
        this.travelParado = 0;
  
        return true;
      }
  
      /**
       * O PORTAL ESTAVA TRANCADO, E A TRAVESSIA VAI ACONTECER SO DEPOIS.
       *
       * ## O QUE ACONTECIA
       *
       * O `return true` de cima devolvia o controle sem consumir a etapa.
       * E o plano era refeito no quadro seguinte com a MESMA etapa, porque
       * `destinoX/Y` nao tinha mudado: o piloto andava ate o portal, o
       * `travessarPortal` recusava pela trava, e o ciclo recomecava. O
       * jogador via o boneco arrivedo portal e ficar parado, indefinidamente,
       * com o auto ligado e nenhuma explicacao
       *
       * ## POR QUE A ETAPA PRECISA SER CONSUMIDA
       *
       * Porque o objetivo aqui nao e ATRAVESSAR: e CHEGAR. A arena e o
       * destino final, e a travessia dela e um pedido do servidor (o botao
       * "Enfrentar o chefe"), nao um passo de rota. O auto leva ate a porta
       * e para — quem abre a porta e o jogador
       *
       * E quando a etapa e a ultima, o plano fica vazio e o `firmar` na
       * proxima chamada monta um plano novo a partir do MESMO destino: o
       * boneco fica parado no portal ate a missao mudar, que e o estado
       * correto
       *
       * ## POR QUE NAO E SO "GASTAR A ETAPA E SAIR"
       *
       * Porque o jogador pode estar em cima de um portal que nao e o desta
       * etapa. Gastar a etapa aqui jogaria fora o resto do caminho e o
       * auto pararia longe do destino. A travessia recusada por POSICAO e
       * um caso diferente da travessia recusada por TRAVA, e as duas
       * precisam de respostas diferentes
       */
      if (this.portalDebaixoEstaTrancado(etapa)) {
        this.travelPlan.shift();
        this.travelParado = 0;
  
        /**
         * O AVISO, e ele e obrigatorio.
         *
         * Sem ele o boneco chega no portal e para, e o jogador nao distingue
         * "chegou" de "desistiu" — a duvida e a mais cara do painel, porque
         * o auto esta ligado e o boneco parado nao parece nenhuma das duas
         * coisas por si so
         *
         * E a frase diz o QUE fazer, nao so o que aconteceu: a missao do
         * chefe termina neste portal, e quem abre a arena e o botao
         */
        this.showMessage(
          "Portal selado. Use o botao para enfrentar o chefe.",
        );
      }
  
      return true;
    }

    /**
   * O PORTAL DESTA ETAPA ESTA DEBAJO DO JOGADOR E ESTA TRANCADO?
   *
   * E a distincao entre "o piloto esta no lugar errado" e "o lugar certo
   * esta fechado": a primeira repete a tentativa, a segunda consome a etapa
   *
   * Sem ela as duas respostas seriam a mesma, e o caso do portal trancado
   * seria tratado como se o boneco tivesse errado o caminho
   */
    #portalDebaixoEstaTrancado(etapa) {
      const emCima = this.portalSobOsPes();
  
      if (!emCima) return false;
  
      if (emCima.portal.id !== etapa.portalId) return false;
  
      return !portalLiberado(
        emCima.portal.exigeMissaoDe,
        this.world.quests?.mainIndex ?? 0,
      ).ok;
    }

  runEngagedTarget(player) {
    let target = this.findEnemyById(this.engagedTargetId);

    /**
     * SEM AVISO DE "ALVO ELIMINADO".
     *
     * Antes esta linha mostrava a mensagem quando o alvo morria. Era
     * redundante com a tela: a barra de vida some sozinha no mesmo quadro
     * que o alvo morre, porque a secao do alvo so existe com alvo vivo
     *
     * E o pior momento possivel para uma notificacao. A lootNotification
     * do servidor — a coleta do que o bicho dropou — aparece junto, e as
     * duas disputam a mesma posicao no alto central. O jogador matou um
     * mob, viu o "Alvo eliminado." e a coleta do drop embaixo dele, e o
     * que ele queria ler era o drop
     *
     * O silencio tambem diz a verdade: se a barra sumiu, o alvo morreu
     */
    if (!target) {
      this.engagedTargetId = null;
      this.selectedTargetId = null;
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


    /**
     * A MINERACAO: O JOGADOR INDO PARA A PEDIDA, E DEPOIS PARADO NELA.
     *
     * ## POR QUE O CAMINHO E CONSUMIDO, E NAO RECALCULADO
     *
     * O A* deste mapa e caro: a grade tem 40px de celula sobre 5920x4120,
     * e refaze-lo a cada tique de 20Hz para um jogador atravessando o vale
     * seria 20 buscas por segundo para um caminho que nao mudou. O
     * caminho entra em `mineracaoCaminho` e sai com `shift()`, igual ao
     * `travelPlan`
     *
     * ## POR QUE SO RECALCULA QUANDO O CAMINHO ACABA
     *
     * Porque enquanto o caminho dura ele e a melhor informacao que existe.
     * Refazer no meio do trajeto produziria um caminho possivelmente
     * diferente a cada tique, e o jogador andaria em zigue-zague perto da
     * pedra, visivel na tela
     */
    runMineracao(deltaTime) {
      const sessao = this.world.session;
      const min = sessao?.mineracao;

      if (!min) return;

      const player = this.world.player;

      if (player.hp <= 0) return;

      const prop = this.pedidaMineravel(sessao.mapId, min.propId);

      /**
       * A PEDIDA SUMIU DO MAPA DEBAIXO DO JOGADOR.
       *
       * Acontece quando outro jogador a demoliu por último enquanto este
       * estava encostado. O servidor fecha o painel no mesmo tique, mas o
       * motor nao pode ficar andando em direcao a uma pedra que nao esta
       * mais la
       */
      if (!prop) return;

      /**
       * JA ENCOSTOU: PARA E AVISA O SERVIDOR.
       *
       * ## POR QUE O `alcancado` SO LIGA E NUNCA DESLIGA
       *
       * Porque e um LACRE, e nao um estado. Ele responde a "o jogador ja
       * chegou nesta pedra", nao a "o jogador esta na pedra agora"
       *
       * O servidor usa este campo para decidir se a DISTANCIA manda: antes
       * de chegar, a distancia nao manda — senao o proprio tick soltava o
       * pedido antes do primeiro passo. Depois de chegar, e ela que manda,
       * e e ela que solta quando o jogador se afasta
       *
       * Se o motor limpasse o lacre ao ver o jogador longe, o servidor leria
       * `false` no tique seguinte e nao soltaria nunca: o jogador poderia
       * atravessar o vale inteiro com a mineracao aberta, sem receber steel
       * e sem o painel
       *
       * Quem zera o lacre e o `minerar` do servidor, no pedido novo
       */
      if (this.encostadoNaPedida(player, prop)) {
        min.alcancado = true;

        return;
      }

      /**
       * O JOGADOR ESTA EMPURRANDO E NAO CHEGANDO?
       *
       * Ver o `vigiarAvancoDaMineracao`. A medicao vem ANTES de escrever a
       * direcao deste tique, entao o boneco pode estar um passo atras do
       * relogio — e o que importa e que ele solte, nao que solte no tique
       * exato
       */
      if (this.vigiarAvancoDaMineracao(sessao, prop, deltaTime)) {
        return;
      }

      const alvo = superficieDaArte(
      player.x,
      player.y,
      prop,
      prop.type,
    );

      /**
       * O CAMINHO VIVE NA SESSAO, e nao em `this`.
       *
       * Uma versao anterior leu `this.mineracaoCaminho`, que nao existe:
       * o campo foi declarado no `PlayerSession`. O `undefined` era lido
       * no `.length` da linha seguinte e derrubava o `runMineracao` — o
       * jogador clicava na pedra, o boneco nao andava e o servidor soltava
       * a mineracao no mesmo tique por ele nunca ter chegado
       *
       * E `sessao.mineracaoCaminho ?? []` porque o `caminho()` da NavGrid
       * devolve `null` quando nao ha rota. Um `null` no `.shift()` da linha
       * de baixo derrubaria o tick do servidor inteiro
       */
      const caminho = sessao.mineracaoCaminho ?? [];

      if (caminho.length === 0) {
        sessao.mineracaoRecalcula -= deltaTime;

        if (sessao.mineracaoRecalcula <= 0) {
          sessao.mineracaoRecalcula = RECALCULA_CAMINHO_S;

          sessao.mineracaoCaminho =
            this.gradeDoMapa().caminho(
              { x: player.x, y: player.y },
              alvo,
            ) ?? [];
        }
      }

      const proximo = (sessao.mineracaoCaminho ?? []).shift();

      /**
       * O CAMINHO ACABOU E O JOGADOR AINDA NAO CHEGOU.
       *
       * E o caso normal dos ultimos 30px, e nao um erro. O `caminho()` da
       * NavGrid termina no ponto mais proximo que a grade deixa, que fica
       * uns 70px da arte — dentro da zona onde a celula de 40px nao cabe
       * com a folga de 8px
       *
       * ## POR QUE O ALVO E A PROPRIA SUPERFICIE DA PEDIDA
       *
       * Antes ele era um ponto DO LADO de onde o jogador ja estava, uns 48px
       * da arte. Um alvo externo so e alcancavel em linha reta, e a ultima
       * perna empurrava o jogador contra o vazio: com outra pedra no meio, o
       * `moveEntity` recusava o eixo e ele escorregava para frente e para
       * tras sem nunca travar na rocha
       *
       * Apontar para a PRÓPRIA pedra mata a classe inteira do problema: a
       * direcao e sempre para a rocha, nao depende de um ponto de fora, e quem
       * para o jogador e a colisao na borda — a 22px da arte, dentro dos 40px
       * do `encostadoNaPedida`
       */
      if (!proximo) {
        /**
         * A ULTIMA PERNA NAO USA O `walkToward`.
         *
         * Porque o `walkToward` considera "chegou" a 24px do alvo, e o alvo
         * esta SOBRE a arte: o jogador pararia a 24px da pedra, o `walkToward`
         * diria que chegou e o `encostado` — que exige 40px — nunca seria
         * verdade. O painel nunca abriria
         *
         * Aqui a chegada e o `encostadoNaPedida` do topo deste metodo, e
         * nao a proximidade do alvo. A direcao e escrita direto, sem raio de
         * chegada: quem para o jogador e o `moveEntity` na borda do solido
         */
        const dx = alvo.x - player.x;
        const dy = alvo.y - player.y;
        const comprimento = Math.hypot(dx, dy);

        if (comprimento <= 0.001) return;
        if (!this.statuses.canMove(player)) return;

        this.autoFacing = { x: dx, y: dy };
        this.autoMoveDirection = normalize(dx, dy);

        return;
      }

      this.walkToward(player, proximo);
    }

    /**
     * A PICARETA DO ARBALIST, LIGADA E DESLIGADA AQUI.
     *
     * E o unico lugar do motor que escreve `player.isMining`, e ele escreve
     * SEMPRE — `true` ou `false` — porque o campo e um estado de quadro, e
     * nao um evento. O `resolveAnimation` le o booleano a cada desenho; se
     * este metodo so ligasse, o boneco ficaria com a picareta no ar para
     * sempre no primeiro tique em que a pedra acabasse
     *
     * ## A REGRA E A MESMA DO PAINEL, DE PROPOSITO
     *
     * `contando` E `encostado`, os dois. Sao as mesmas duas condicoes que o
     * `mineracaoSnapshot` usa para decidir se o painel abre, e nao uma conta
     * nova: se o painel ainda esta aberto na tela, o boneco tem que estar
     * socando, e se o boneco esta socando o painel tem que estar aberto
     *
     * As duas sao necessarias porque cada uma cobre um caso que a outra
     * nao pega. `contando` sozinho liga a picareta no tique em que o
     * jogador e CLIQUE para andar ate a pedra, com ele ainda a metros dela.
     * So o `encostado` liga no instante em que ele chega
     *
     * ## POR QUE `!prop` APAGA TUDO
     *
     * Porque a pedra pode ter sido demolida por outro jogador enquanto este
     * estava encostado. O `runMineracao` devolve nesse caso, sem tocar no
     * booleano, e sem esta linha o boneco socaria o ar ate o servidor
     * mandar fechar a sessao
     */
    atualizaMineracaoVisual() {
      const sessao = this.world.session;
      const player = this.world.player;
      const min = sessao?.mineracao;

      if (!min) {
        player.isMining = false;
        return;
      }

      const prop = this.pedidaMineravel(sessao.mapId, min.propId);

      player.isMining =
        min.contando === true &&
        Boolean(prop) &&
        player.hp > 0 &&
        this.encostadoNaPedida(player, prop);
    }

  /**
   * O MOTOR DEIXA O JOGADOR PARADO QUANDO A PEDIDA NAO DEIXA.
   *
   * ## O PROBLEMA
   *
   * A ultima perna aponta para a pedra, e quem para o jogador e a colisao.
   * Isso resolve o caso comum, mas nao o raro: se o espaco entre o jogador e
   * a rocha for MENOR que o diametro dele, o `moveEntity` recusa os dois
   * eixos e o boneco empurra a pedra para sempre, sem chegar perto o bastante
   * para o `encostadoNaPedida` passar
   *
   * ## O QUE ESTE METODO FAZ
   *
   * Mede o AVANCO: a menor distancia a arte que o jogador ja alcanca. Cada
   * vez que a distancia cai, o relogio zera. Se passarem quatro segundos sem
   * nenhum avanco novo, o pedido e solto — o mesmo caminho que o
   * cancelamento por tecla usa
   *
   * ## POR QUE SOLTAR E MELHOR QUE INSISTIR
   *
   * Porque insistir e o sintoma que o jogador reclamou: o boneco tremendo
   * contra a pedra. Soltar devolve o controle na hora, e o jogador clica de
   * novo se quiser. Um pedido de mineracao que trava a locomocao e pior que
   * um pedido que nao atende
   */
  vigiarAvancoDaMineracao(sessao, prop, deltaTime) {
    const distancia = distanciaAteArte(
      this.world.player.x,
      this.world.player.y,
      prop,
      prop.type,
    );

    /**
     * UM `0.5px` DE TOLERANCIA, e nao `> 0`.
     *
     * Sem ela, o avanco minimo que o `moveEntity` produz em um tique de
     * 50ms seria lido como travamento. Com ela, o jogador andando a 165px/s
     * marca avanco de 8px por tique e o relogio nunca dispara
     */
    if (distancia < (sessao.mineracaoMelhor ?? Infinity) - 0.5) {
      sessao.mineracaoMelhor = distancia;
      sessao.mineracaoTravado = 0;

      return false;
    }

    sessao.mineracaoTravado = (sessao.mineracaoTravado ?? 0) + deltaTime;

    if (sessao.mineracaoTravado < MINERACAO_TRAVA_S) return false;

    sessao.mineracao = null;
    sessao.mineracaoCaminho = [];
    sessao.mineracaoRecalcula = 0;
    sessao.mineracaoTravado = 0;
    sessao.mineracaoMelhor = Infinity;

    this.autoMoveDirection = null;
    this.autoFacing = null;

    return true;
  }

    /**
     * A PEDIDA MINERAVEL DEBAIXO DO PONTEIRO, ou `null`.
     *
     * ## POR QUE A CAIXA E DA ARTE, E NAO O `radius`
     *
     * Porque e a imagem que o jogador ve. O `radius` do cristal lendario
     * e 69px — metade da largura da arte de 139px — e uma caixa circular
     * de 69px deixaria de fora a ponta da esquerda e da direita, e o
     * clique no meio da imagem nao pegaria em nada
     *
     * E a MESMA caixa que o solido cobre, de proposito: o que da para
     * clicar e exatamente o que barra o jogador. Com as duas caixas
     * diferentes haveria uma faixa onde o clique pegava numa pedra em que
     * o jogador nem podia encostar
     */
    pedidaEm(point) {
      const fora = this.pedidasForaDoMapa;

      for (const prop of this.world.props ?? []) {
        if (!mineravel(prop.type)) continue;
        if (fora instanceof Set && fora.has(prop.id)) continue;

        const type = getPropType(prop.type);

        if (!type) continue;

        const meiaLargura = (type.drawWidth ?? 0) / 2;
        const altura = type.drawHeight ?? 0;

        /**
         * A CAIXA ANCORADA NO PE DA PROPS, e nao no ponto.
         *
         * A prop esta no `y` do PE do cristal (`base: 1`), e a arte sobe
         * dali. Uma caixa centrada na prop pegaria metade do vazio que fica
         * embaixo da rocha — e o jogador mineraria clicando no chao ao lado
         */
        if (
          point.x < prop.x - meiaLargura ||
          point.x > prop.x + meiaLargura ||
          point.y < prop.y - altura ||
          point.y > prop.y
        ) {
          continue;
        }

        return prop;
      }

      return null;
    }

    /**
     * A PEDIDA MINERAVEL DESTE MAPA, PELO ID, ou `null`.
     *
     * E a MESMA consulta que o servidor faz no `minerar`, e pelos mesmos
     * motivos: a lista vem do mapa em que o jogador esta, e o id nao e
     * confiavel
     *
     * E ela que esconde a pedra ja demolida. Devolver `null` para uma
     * pedra esgotada e o que faz o `drawProps` nao desenhar aquela prop
     */
    pedidaMineravel(mapId, propId) {
      const mapa = getMap(mapId);
      const esgotadas = this.pedidasForaDoMapa;

      return (
        mapa?.props?.find(
          (prop) =>
            prop.id === propId &&
            mineravel(prop.type) &&
            !(esgotadas instanceof Set && esgotadas.has(propId)),
        ) ?? null
      );
    }

    /**
     * O JOGADOR ESTA ENCOSTADO NESTA PEDIDA?
     *
     * A MESMA conta que o servidor faz, e pelos mesmos numeros: o raio da
     * pedra, o raio do jogador, e a mesma folga de 18px. A tolerao tem de
     * ser a MESMA nos dois lados, senao o servidor veria o jogador
     * longe enquanto o motor o considerava parado na pedra, e a batida
     * cairia com o boneco a um passo de distancia
     */
    encostadoNaPedida(player, prop) {
      return encostadoNaPedida(
        player.x,
        player.y,
        prop,
        player.radius ?? 20,
      );
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
       * O RELOGIO DO TELEGRAPH, e ele e o `spriteTime`, nao o `world.time`.
       *
       * ## POR QUE NAO O `world.time`
       *
       * Porque `world.time` so avanca no ramo de SIMULACAO — a linha que
       * esta depois do `return` deste bloco. No cliente ele fica congelado em
       * zero, e um telegraph desenhado com ele nunca chegaria no instante do
       * impacto: o disco ficaria crescendo para sempre
       *
       * ## E POR QUE ISSO NAO QUEBRA A SINCRONIA ENTRE DOIS JOGADORES
       *
       * Porque os dois lados andam com o MESMO `deltaTime` por quadro, e
       * `spriteTime` e `world.time` crescem identicos no motor que simula. O
       * numero que importa — o `impactoEm` do pacote — e medido no relogio do
       * SERVIDOR, e o cliente so o reproduz. Um relogio local, parado e
       * crescente, e o que permite isso
       *
       * A divergencia entre os dois so apareceria se um dos lados pulasse
       * quadro, e ai o `progresso` se refaria pelo `impactoEm` absoluto —
       * que e a razao de o instante ser absoluto e nao um tempo restante
       */
      this.telegraphs.update(deltaTime, this.spriteTime);

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

        /**
         * A MINERACAO ENTRE O PILOTO E O MOVIMENTO, E NESSE LUGAR POR
         * UM MOTIVO CONCRETO.
         *
         * O `updateAutoPlay` ZERA o `autoMoveDirection` na primeira linha
         * e depois pode sair por qualquer um dos seus `return`. A mineracao
         * escreve no mesmo campo, entao precisa vir DEPOIS dele para o
         * passo nao ser apagado — e ANTES do `updatePlayer`, que e quem
         * transforma o `autoMoveDirection` em deslocamento de verdade
         *
         * Ela nao depende do piloto automatico ligado: quem manda e a
         * sessao, com `sessao.mineracao`, e o `updateAutoPlay` so sai
         * cedo quando o auto esta desligado, o que e o caso comum de quem
         * esta minerando
         */
this.runMineracao(deltaTime);

    /**
     * A PICARETA, E ONDE ESSE BOOLEANO NASCE.
     *
     * Fica DEPOIS do `runMineracao` e ANTES do `updatePlayer` porque e o
     * tique do desenho: o primeiro move o jogador para a pedra, o segundo
     * resolve a animacao. Sem o `updatePlayer` antes, o boneco entraria na
     * picareta um quadro atras do movimento
     *
     * E um metodo separado, e nao uma linha no fim do `runMineracao`, por
     * causa dos RETORNOS antecipados daquele: sem mineracao, com o jogador
     * morto e com a pedra demolida por outro, ele sai antes da ultima linha
     * e o booleano ficaria preso em `true` com a picareta no ar, sem pedra
     */
    this.atualizaMineracaoVisual();

    this.updatePlayer(deltaTime);

        this.skillSystem.update(deltaTime);

        // o drop no chao e por jogador: cada um recolhe o que esta
        // perto DELE, e nao o do jogador em foco
        this.coletarDropDoChao();

        this.statuses.update(
          this.world.player,
          deltaTime,
        );

        /**
         * O AUTOMATICO DA POCAO, DEPOIS DO STATUS E NAO ANTES.
         *
         * A ordem importa: o `statuses.update` e o que aplica a regeneracao
         * que a propria pocao deixa. Bebendo antes dele, a pocao seria
         * aplicada no mesmo quadro em que o efeito antigo ainda estava
         * contando, e o `heal` do jogador veria mais vida do que a barra
         * mostraria
         *
         * E dentro do `withPlayer` de proposito: o `usarItem` consome da
         * mochila do jogador em foco, e fora daqui ele gastaria da pilha do
         * jogador errado
         */
        if (this.tryBeberAutoPocao()) {
          this.sendSnapshot();
        }
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

    /**
     * OS TELEGRAPHS AVANCA UMA VEZ, e nao uma vez por jogador.
     *
     * O laço acima roda `updateEnemies` dentro de um `withPlayer` por sessao,
     * porque cada jogador tem o seu agro e o seu alvo. O telegraph nao tem
     * nada disso: a execucao pertence ao CHEFE e a um instante, e o dano
     * dela e aplicado para todo mundo que estiver na forma
     *
     * ## E POR QUE O `world.time` AQUI, E O `spriteTime` NO RAMO DE REDE
     *
     * Porque este e o ramo de SIMULACAO, e nele o `world.time` avanca (a
     * linha logo depois do `return` do ramo de rede). O `world.time` e o
     * relogio do SERVIDOR, e e nele que o `impactoEm` e medido
     *
     * No ramo de rede o relogio e o `spriteTime`, porque o `world.time` fica
     * congelado no cliente — ver o comentario da chamada no ramo de rede
     */
    this.telegraphs.update(deltaTime, this.world.time);

    this.acompanharDash();

    /**
     * O PAINEL SO SAI DAQUI SE O MOTOR FOR O DONO DELE.
     *
     * Este e o ramo da simulacao, e por isso o ramo do SERVIDOR: la quem
     * monta o painel e o `enviarPainel`, com um cliente em foco. O timer
     * de 10Hz deste bloco e o do single player, e aqui acrescentava 10
     * paineis de ~154KB por segundo ao desperdicio das acoes
     *
     * A guarda e `painelExterno` e nao `networked`: o cliente online
     * TAMBEM e `networked`, e la o painel do timer e o que alimenta a
     * HUD. Sao dois papeis diferentes e a flag precisa dizer "quem
     * dispara", nao "quem simula"
     *
     * Este bloco e a PRIMEIRA das duas formas de pedir painel; a segunda
     * sao as ~35 chamadas diretas de `sendSnapshot`. Ambas passam pela
     * guarda de dentro de `sendSnapshot`, que e a unica que importa: e
     * ela que cobre as 35. Manter a guarda aqui tambem evita que o
     * `snapshotAccumulator` fique crescendo quando ninguem esta lendo
     */
    if (!this.painelExterno) {
      this.snapshotAccumulator += deltaTime;

      if (this.snapshotAccumulator >= 0.1) {
        this.snapshotAccumulator = 0;
        this.sendSnapshot();
      }
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

    /**
     * A MORTE PRIMEIRO, e antes do `return` de `hp <= 0`.
     *
     * E o que faz o painel aparecer: o golpe que zera a vida vem do
     * `DamageSystem`, e o `hp <= 0` logo abaixo e o unico sinal que
     * dano direto, veneno e reflexo compartilham. Se a morte fosse
     * registrada depois do `return`, o jogador morto nunca passaria por
     * aqui de novo — e o prazo jamais comecaria
     *
     * O `atualizarMorte` e quem conta os 20s e dispara o retorno
     * automatico quando eles acabam
     */
    if (player.hp <= 0) {
      this.registrarMorte();
      this.atualizarMorteDoJogador(deltaTime);

      player.isMoving = false;
      return;
    }

/**
   * O EMPURRAO DO DASH E DO GOLPE, e ele e CONSUMIDO AQUI.
   *
   * ## POR QUE ESTE `if` E NO MEIO DO `updatePlayer`
   *
   * Porque o `pushVelocity` do jogador nunca foi lido em lugar nenhum do
   * motor: so o do INIMIGO tem o `damping` e a aplicacao, em `updateEnemy`.
   * O campo existia, era zerado na morte, e nao fazia nada — o golpe do
   * inimigo no jogador simplesmente nao empurrava
   *
   * Aqui o dash e esse empurrao encontrou um consumidor. E o damping e o
   * MESMO do inimigo, para que o dash pare na velocidade em que comecou em
   * vez de travar de repente no fim da duracao
   */
  if (
    player.pushVelocity.x !== 0 ||
    player.pushVelocity.y !== 0
  ) {
    const damping = Math.exp(-8 * deltaTime);

    this.world.collision.moveEntity(
      player,
      player.pushVelocity.x * deltaTime,
      player.pushVelocity.y * deltaTime,
    );

    player.pushVelocity.x *= damping;
    player.pushVelocity.y *= damping;

    /**
     * OS DOIS CAMPOS, E NAO UM OBJETO NOVO.
     *
     * O mesmo cuidado do inimigo: o `pushVelocity` nao e comparado por
     * identidade em lugar nenhum, entao trocar a referencia seria alocar um
     * objeto por quadro sem ganho nenhum
     */
    if (
      Math.abs(player.pushVelocity.x) < 0.5 &&
      Math.abs(player.pushVelocity.y) < 0.5
    ) {
      player.pushVelocity.x = 0;
      player.pushVelocity.y = 0;
    }
  }

  /**
     * O MOVIMENTO VEM DO MAPA DE BINDS, e nao mais de quatro `keys.has`.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * Aqui a tecla era lida pelo `code`: "o `KeyD` esta apertado?". Todo o
     * resto do jogo ja perguntava "quem detem esta tecla", e o movimento ficou
     * de fora. O resultado era que trocar o `D` por `H` no painel gravava o
     * `H` e nao mexia no motor — o `D` continuava andando e o `H` nao
     *
     * ## POR QUE O VETOR VEM PRONTO DO MODULO
     *
     * Porque quem sabe o que "direita" e e o catalogo, e ele ja descreve cada
     * slot de `andar` e de `mirar` com a direcao que ele move. O motor so
     * precisa somar. Se a traducao ficasse aqui, trocaria a tecla e o
     * significado ao mesmo tempo, e qualquer acao nova de movimento teria de
     * ser lembrada em dois lugares
     */
    const movimento = vetorDeMovimento(this.input.keys);

    let movementX = movimento.x;
    let movementY = movimento.y;

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

/**
       * ANDAR CANCELA A MINERACAO.
       *
       * E o pedido do usuario, e o oposto do que este codigo fazia antes.
       * A versao anterior ZERAVA o movimento e deixava o jogador preso na
       * pedra, com o cancelamento so no clique de novo — a ideia era nao
       * perder 3min20 de lendario por um esbarrao de dedo no W
       *
       * O que faz mais sentido num jogo que tem bicho te atacando e nao ha
       * como fugir: a mineracao nao pode ser mais forte que o movimento.
       * Quem precisa do machado clica de novo; quem precisa correr, corre
       *
       * ## POR QUE QUALQUER DIRECAO CONTA
       *
       * Havia uma versao que ignorava o movimento na MESMA direcao em que o
       * boneco ja estava andando, para o jogador nao se desandar sozinho
       * quando apertava a tecla para onde ja ia. Ela quebrava o caso comum:
       * apertar W com a pedra ao norte NAO cancelava, que e exatamente a
       * tecla que o jogador aperta para sair
       *
       * O resquicio de tecla que aquela guarda tentava evitar nao existe:
       * o `moveFromKeys` devolve `(0, 0)` exato sem tecla nenhuma, e o
       * `GameClient` normaliza a intencao antes de mandar. Movimento
       * diferente de zero e sempre um dedo na tecla
       *
       * ## POR QUE APAGAR A SESSAO E O CANCELAMENTO
       *
       * Porque o servidor nao tem outro canal para isso. Ele le
       * `sessao.mineracao` no `tick` seguinte e, vazio, para de contar
       * batidas e nao solta mais nada. E o mesmo caminho do
       * `engagedTargetId`, que o motor apaga sozinho quando o jogador
       * desiste de perseguir
       *
       * E o `autoMoveDirection` e zerado junto: a linha de baixo da funcao
       * da prioridade ao auto, entao sem isto o jogador daria um passo na
       * direcao da pedra no MESMO tique em que apertou a tecla, e o passo
       * para o lado errado seria visivel
       *
       * E o `alcancado` morre junto, porque e parte do objeto que some: o
       * lacre nao sobrevive ao fim da mineracao
       */
      if (
        this.world.session?.mineracao &&
        (movementX !== 0 || movementY !== 0)
      ) {
        this.world.session.mineracao = null;
        this.world.session.mineracaoCaminho = [];
        this.world.session.mineracaoRecalcula = 0;
this.autoMoveDirection = null;
          this.autoFacing = null;
        }

    /**
     * O AUTO E SOLTADO AQUI, E ANTES DA `direction`.
     *
     * A ordem e o que faz a regra funcionar: `soltarPiloto` zera o
     * `autoMoveDirection`, e e ele que a linha de baixo usa quando o auto
     * manda. Soltar depois deixaria o boneco dar o passo na direcao do
     * piloto e so no quadro seguinte obedecer ao dedo
     *
     * ## E POR QUE O `autoPlay` CHEGA ATE AQUI
     *
     * Porque ele NAO e solto: o `soltarAutoAoAndar` volta sem mexer em nada
     * quando o `autoPlay` esta ligado. E ai esta a consequencia que nao e
     * obvia: o `autoMoveDirection` continua preenchido, e a linha de baixo da
     * prioridade dele sobre o teclado. O jogador apertava W e o boneco
     * andava SO para onde o auto mandava — nao cancelava o auto, mas o dedo
     * virava tecla morta, que e pior do que cancelar
     *
     * A `direcaoDoTeclado` abaixo e o que resolve: com o auto play ligado e
     * o jogador mexendo no teclado, o dedo manda na DIRECAO e o auto
     * continua mandando no RESTO (alvo, ataque, escolha de acao)
     */
    if (movementX !== 0 || movementY !== 0) {
      this.soltarAutoAoAndar();
    }

    const direcaoDoTeclado = normalize(movementX, movementY);

    /**
     * A DIRECAO, E QUEM VENCE.
     *
     * O padrao e o que ja existia: o auto manda, e o teclado so conduz quando
     * nao ha auto. Inverter a ordem aqui quebraria o auto de deslocamento e o
     * de viagem, que existem justamente para andar sem dedo na tecla
     *
     * A EXCECAO E O `autoPlay` COM O DEDO NO TECLADO. E o unico lugar onde
     * os dois disputam de verdade: o auto de viagem tem um waypoint fixo e
     * o jogador nao esta mexendo no teclado ao mesmo tempo, mas o autoplay de
     * cacar e um botao que o jogador liga e DEPOIS anda — sem isso o
     * primeiro tique de andar cancelaria a cacada que ele acabou de pedir
     *
     * E o `autoMoveDirection` NAO E ZERADO AQUI: zerar seria o
     * `soltarAutoAoAndar` de novo, e com ele o ataque volta a ser cancelado
     * no quadro seguinte, quando o `approachTarget` reescreve a direcao. O
     * teclado vence neste quadro, o auto reescreve no proximo, e o
     * personagem vai para o alvo — que e o comportamento pedido: andar nao
     * desliga o auto
     */
    const autoManda =
      this.autoMoveDirection &&
      !(this.autoPlay && direcaoDoTeclado.x !== 0);

    const direction = autoManda
      ? this.autoMoveDirection
      : direcaoDoTeclado;

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

        /**
         * O RELOGIO DA MORTE CORRE JUNTO COM O RESPAWN.
         *
         * O cadaver e o mesmo objeto que vai renascer, entao e o mesmo
         * `updateEnemies` que gira os dois relogios. Sem este `decrement`
         * o `deathTimer` ficaria parado em `deathDuration + deathFade`
         * e o goblin morto nunca sumiria da tela
         *
         * O `Math.max` com zero importa: o relogio e lido em
         * `eMostrandoCadaver` e em `resolveDeathAlpha`, e um valor
         * negativo ali produziria alfa negativo e cadaver invisivel
         * antes da hora
         */
        if (enemy.deathTimer > 0) {
          enemy.deathTimer = Math.max(
            0,
            enemy.deathTimer - deltaTime,
          );
        }

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

      /**
     * O `push` JA ESTA ZERO, e nao um objeto novo.
     *
     * Este if e o que segura a alocacao: sem ele, todo inimigo cujo
     * empurrao estabilizou recebia um `{ x: 0, y: 0 }` novo a cada
     * tique. Sao ~93 inimigos por mapa, ou 1860 objetos por segundo por
     * mapa povoado, jogados fora so para o `pushVelocity` voltar a zero
     *
     * Escrever os dois campos e o mesmo efeito, e nao troca a referencia:
     * `pushVelocity` nao e comparedo por identidade em lugar nenhum, e o
     * damping acima ja os deixou abaixo de 0.5
     */
      if (
        Math.abs(enemy.pushVelocity.x) < 0.5 &&
        Math.abs(enemy.pushVelocity.y) < 0.5
      ) {
        enemy.pushVelocity.x = 0;
        enemy.pushVelocity.y = 0;
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
   * estiver longe no momento da morte
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

    /**
     * O RELOGIO DA MORTE COMECA AQUI.
     *
     * Este e o UNICO lugar que liga a animacao de morte, e ele roda
     * DEPOIS do `alive = false` acima para que qualquer desenho do mesmo
     * quadro ja veja o cadaver pronto
     *
     * O `null` na primeira linha e o estado de "nao ha arte de morte":
     * um bicho sem o bloco `death` no layout continua aqui com
     * `deathTimer` em `null`, que e o valor que o `eMostrandoCadaver`
     * le para recusar o cadaver, e ele some na hora como antes
     *
     * O tempo e `duration + fade`, e nao so `duration`: os dois se
     * somam porque sao relogios diferentes. O ciclo roda em `duration`,
     * e o esmaecimento acontece nos `fade` segundos DEPOIS que ele
     * acabou, com o cadaver parado no ultimo quadro
     *
     * Os numeros vem do layout da criatura, e nao sao constantes do
     * motor: cada bicho que tiver morte no futuro declara o seu ritmo
     * junto com a arte, que e onde o ritmo tem sentido
     */
    const definition = this.enemySprites.get(enemy.id)?.definition;

    if (temMorte(definition)) {
      enemy.deathDuration = definition.deathDuration;
      enemy.deathFade = definition.deathFade;
      enemy.deathTimer =
        definition.deathDuration + definition.deathFade;
    } else {
      enemy.deathTimer = null;
      enemy.deathFade = 0;
      enemy.deathDuration = 0;
    }

    enemy.wanderTarget = null;
    enemy.alerted = false;
    enemy.provoked = false;
    enemy.stuckTimer = 0;
    enemy.sidestepTimer = 0;

    /**
     * O ALVO TRAVADO SAI JUNTO COM A CRIATURA.
     *
     * O `reviveEnemy` ja zera isso, e o `killEnemy` tambem — nao por
     * dupla paranoia, mas porque quem mata um esqueleto no meio da
     * retaliação NAO passa pelo `revive`: o `targetId` ficaria apontando
     * para o jogador que o matou durante os 5 segundos de `respawnTimer`,
     * e qualquer `provocarDuelo` nesse intervalo encontraria um alvo ja
     * travado e ignoraria quem tivesse acabado de encostar
     *
     * O `lastHitBy` (entidade) fica: e a autoria do abate, e o loot usa
     * ele. Sao campos diferentes — `lastHitBy` e ENTIDADE e nao e limpo,
     * `lastHitById` e ID de jogador e e da regra de retaliação
     */
    enemy.targetId = null;
    enemy.lastHitById = null;

    /**
     * O DONO DO ABATE, E O `killer` E O `lastHitBy` QUE SAO COISAS
     * DIFERENTES AQUI.
     *
     * O `killer` explicito vem do `onDeath` do DamageSystem, que so
     * dispara no tick em que o HP zera: o golpe e do agora, e o jogador
     * pode estar a mil pixels — um arco longo, uma animacao, um mob que
     * morreu depois de levar o golpe. Esse passa direto.
     *
     * O `lastHitBy` e o caminho do DoT e da morte por status, e e um
     * campo que NINGUEM limpa. Passa pelo `donoDoAbate`.
     *
     * Antes de resolver, cada um passa pela sua regra, e e essa
     * separacao que impede o bug de voltar pelo outro lado
     */
    const dono = this.donoDoAbate(
      enemy,
      killer ?? enemy.lastHitBy,
      killer !== null,
    );

    /**
     * A MORTE DE UM CHEFE, e so dela.
     *
     * Quem reage a uma Vitoria por chefe e o SERVIDOR: ele tem que tirar
     * todo mundo da arena, e o motor nao sabe da arena
     *
     * O gancho e por MAPA e nao por criatura: um mapa novo com um chefe
     * nao precisa declarar mais nada aqui, e um mob comum nao dispara
     * nada porque o mapa dele nao lista nenhum
     */
    if (this.world.map?.bosses?.some((b) => b.creature === enemy.typeId)) {
      this.onChefeDerrotado?.({
        enemy,
        dono,
        map: this.world.map,
      });
    }

    this.handleKill(enemy, dono);
  }

  /**
   * O DONO DO ABATE, se ainda valer a pena creditar.
   *
   * ## POR QUE ISTO EXISTE
   *
   * `lastHitBy` responde QUEM deu o ultimo golpe, e nao QUEM esta
   * dando o ultimo golpe AGORA. O campo e gravado a cada dano e nunca
   * limpo: um mob que levou um golpe, cujo jogador foi caçar outro, e
   * morreu de DoT quatro minutos depois continua apontando para ele
   *
   * No rastro do servidor isso apareceu assim:
   *
   *     killer=teste | auto=0 | alvo=- | eng=- | dist=971
   *
   * O jogador com o autoplay DESLIGADO, sem alvo nenhum, a quase mil
   * pixels do mob — e o loot foi para ele e dividiu com a party. Ele
   * nao estava farmando ali: so tinha acertado aquele mob uma vez
   *
   * ## O QUE O `lastHitBy` PRECISA PASSAR
   *
   * 1. **TEM SESSAO.** Precisa estar no mundo. Um desconectado nao tem
   *    inventario para receber
   *
   * 2. **O GOLPE E RECENTE.** O `lastHitAt` dentro da janela. E o que
   *    separa "acertou esse mob agora" de "acertou esse mob quando
   *    passou aqui"
   *
    * 3. **ESTA BATENDO NESSE MOB AGORA.** E o filtro que fecha o relato.
   *    Nao basta estar perto: o jogador precisa estar com o autoplay
   *    ligado ou com alvo travado, e dentro do alcance de golpe
   *
   *    Sem o item 3, um jogador com o auto DESLIGADO, sem alvo nenhum e
   *    a 971px do mob — parado, so esperando — continuava sendo o dono
   *    do abate, porque o `lastHitBy` guardava o golpe que ele deu
   *    quando ainda estava caçando ali. No rastro:
   *
   *        killer=teste | auto=0 | alvo=- | eng=- | dist=971
   *
   *    O `auto=0` e o `alvo=-` dizem que ele nao estava atacando nada.
   *    Estar perto nao e estar batendo
   *
   * O `killer` explicito pula tudo: ele so existe porque o DamageSystem
 * acabou de resolver o golpe neste tick
   */
  donoDoAbate(enemy, killer, explicito) {
    const sessao = killer ? this.world.players.get(killer.id) : null;

    if (!sessao) return null;

    if (explicito) return sessao;

    // o golpe e velho: o dono de antes nao e o dono de agora
    const recente = Date.now() - (enemy.lastHitAt ?? 0);

    if (recente > JANELA_DO_LAST_HIT_MS) return null;

  /**
   * O ABATE ESTA SENDO MATO POR VENENO? Entao o dono e o autor.
   *
   * Este e o caso que o filtro de "esta batendo agora" NAO pode
   * cobrir. Quem envenenou o mob aplicou o golpe, e muitas vezes foi
   * embora no meio: o last hit e dele mesmo assim, e o
   * `lastHit.test.js` exige isso — "o loot do DoT vai para quem
   * aplicou o veneno"
   *
   * A diferenca para o `lastHitBy` solto e que aqui nao ha nada velho:
   * o `lastHitPorDoT` foi marcado pelo `StatusSystem` no mesmo tick
   * em que o veneno tirou o HP, entao o abate e de quem esta queimando
   * o mob AGORA
   *
   * A flag precisa existir porque o `StatusSystem` remove o efeito do
   * `statusEffects` assim que o HP zera — dentro do `update`, antes do
   * `killEnemy`. Ler o array no abate não encontraria mais o veneno
   */
  if (enemy.lastHitPorDoT) {
    const autor = enemy.lastHitBy
      ? this.world.players.get(enemy.lastHitBy.id)
      : null;

    if (autor) return autor;
  }

  /**
     * ESTE JOGADOR ESTA BATENDO EM ALGUMA COISA?
     *
     * E a pergunta que faltava. O auto ligado e o auto de cacar: o
     * jogador esta atirando em mob. O alvo travado e o clique dele. Sem
     * nenhum dos dois, ele nao esta atacando — e um jogador que nao
     * ataca nao pode ser o last hit de nada
     *
     * Isto e o que separa "esta na mesma caca" de "esta na mesma
     * regiao". O `dist` sozinho nao separava: 971px passa em
     * qualquer limite generoso, e era exatamente o que o rastro
     * mostrava
     */
    if (!sessao.autoPlay && !sessao.selectedTargetId && !sessao.engagedTargetId) {
      return null;
    }

    // e o alvo dele e ESTE mob, ou o auto e que disparou o golpe
    if (
      sessao.selectedTargetId &&
      sessao.selectedTargetId !== enemy.id
    ) {
      const mesmoTipo =
        sessao.selectedTargetId.replace(/_\d+$/, "") ===
        enemy.id.replace(/_\d+$/, "");

      if (!mesmoTipo) return null;
    }

    // dentro do alcance de golpe, que e onde um golpe de verdade chega
    const dx = sessao.player.x - enemy.x;
    const dy = sessao.player.y - enemy.y;

    if (dx * dx + dy * dy > ALCANCE_CREDITO_ABATE * ALCANCE_CREDITO_ABATE) {
      return null;
    }

    return sessao;
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
    // O `killer` que chega aqui ja passou pelo `donoDoAbate`: e a
    // SESSAO do dono, ja validada. Sem dono, nao ha o que creditar
    const owner = killer;
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
    /**
     * A LISTA DE QUEM DIVIDE E `parceirosDeLoot`, e nao `partnersDe`.
     *
     * A party e o grupo; quem divide o loot e o grupo FILTRADO pelo
     * mesmo campo, pela distancia e pela vida. Um parceiro a 4km ou em
     * outro mapa fica na party — ele continua no `PartyBox`, ainda
     * recebe convite — mas nao entra na divisao
     *
     * Quando o filtro deixa a lista vazia, o comportamento e o de quem
     * esta sozinho: o dono fica com o total inteiro
     */
    const membrosDaParty = this.parceirosDeLoot(
      sessao.id,
      enemy,
    );

    const temParty = membrosDaParty.length > 0;

    /**
     * TUDO ACONTECE COM O DONO EM FOCO.
     *
     * O sorteio, a entrega e a missao do dono rodam dentro do
     * `withPlayer` dele. Antes eles rodavam fora, e "fora" aqui e o
     * jogador em foco do fim do tick — que no servidor e o ultimo da
     * fila. Era essa janela que fazia o loot aparecer na pessoa errada
     *
     * `collected` e declarado fora porque o `repartirAbatePorParty` o
     * usa depois, e ele ja faz o `withPlayer` de cada membro
     */
    let collected = null;

    this.withPlayer(sessao.id, () => {
      collected = temParty
        ? this.loot.roll(enemy, sessao.lootFilter ?? this.loot.filter)
        : this.loot.collectFrom(enemy, sessao);

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
   * QUEM DIVIDE O LOOT COM O DONO: o mesmo campo, perto, e vivo.
   *
   * ## POR QUE ISTO EXISTE
   *
   * Ser da mesma party NAO e o bastante para receber uma fração. A
   * party atravessa mapa: um parceiro no Pantano e outro na Cripta
   * Esquelética estao no mesmo grupo e nao se veem. Sem esta lista, o
   * abate no Pantano dava metade do loot para quem estava na Cripta, a
   * 4000px e em outro mapa — o jogador que nem estava vendo o mob
   * ganhava metade do ouro dele
   *
   * Sao quatro filtros, e cada um e uma regra do MMO:
   *
   * 1. **MESMO MAPA.** Sem excecao. Um parceiro em outro mapa nao
   *    divide, nem que esteja a dois pixels da fronteira
   *
   * 2. **O MESMO CAMPO DE MOBS.** E o filtro que resolve o pedido
   *    literal: "para compartilhar os ganhos tem que estar no mesmo
   *    campo de inimigos de quem esta matando". O campo e a `zone` do
   *    mapa — o Brejo, o Pantano, a Cripta — e nao um circulo em volta
   *    do mob. Dois jogadores no mesmo mapa, a 900px um do outro e com
   *    o Brejo entre os dois, NAO estao no mesmo campo
   *
   * 3. **DENTRO DO ALCANCE.** A zona define o campo, e a distancia
   *    aperta: uma zona e um retangulo grande, e as pontas opostas
   *    dela podem estar a 3km
   *
   * 4. **VIVO.** Um parceiro que morreu no meio da luta nao pode
   *    receber a fração dele: ele esta vendo o painel de morte
   *
   * As zonas vem do mapa do DONO, resolvido pelo `mapId` da sessao, e
   * nao do `this.world.map`: o `world` aponta para o mapa do jogador EM
   * FOCO, e o abate chega aqui de dentro do laco de inimigos, que roda
   * com o foco de algum jogador daquele mapa
   */
  parceirosDeLoot(sessionId, enemy) {
    const candidatos = this.partnersDe(sessionId);

    if (candidatos.length === 0) return [];

    const dono = this.world.players.get(sessionId);

    if (!dono) return [];

    const mapaDoAbate = getMap(dono.mapId);

    const zonasDoMob = this.zonasDoPonto(mapaDoAbate, enemy.x, enemy.y);

    const alcance = ALCANCE_DIVISAO_LOOT;
    const alcanceQuadrado = alcance * alcance;

    const perto = [];

    for (const id of candidatos) {
      const sessao = this.world.players.get(id);

      if (!sessao) continue;

      // 1. o mesmo mapa, obrigatorio
      if (sessao.mapId !== dono.mapId) continue;

      // 4. vivo. o painel de morte nao conta como presenca
      if (sessao.player.hp <= 0) continue;

      // 2. o mesmo campo de mobs do abate
      if (zonasDoMob.length > 0) {
        const zonasDele = this.zonasDoPonto(
          mapaDoAbate,
          sessao.player.x,
          sessao.player.y,
        );

        const mesmoCampo = zonasDele.some((zona) =>
          zonasDoMob.some((doMob) => doMob.id === zona.id),
        );

        if (!mesmoCampo) continue;
      }

      // 3. dentro do alcance, que e o que aperta as pontas da zona
      const dx = sessao.player.x - enemy.x;
      const dy = sessao.player.y - enemy.y;

      if (dx * dx + dy * dy > alcanceQuadrado) continue;

      perto.push(id);
    }

    return perto;
  }

  /**
   * As `zones` do mapa que contem o ponto.
   *
   * Uma zona e um retangulo (`x`, `y`, `width`, `height`) e as zonas
   * podem se SOBREPOR: o campo de provas fica dentro do Brejo, e um
   * ponto ali pertence as duas. Por isso isto devolve uma lista e nao
   * um id — a comparacao de "mesmo campo" pergunta se as duas listas
   * tem alguma zona em comum
   */
  zonasDoPonto(mapa, x, y) {
    const zonas = mapa?.zones;

    if (!Array.isArray(zonas) || zonas.length === 0) return EMPTY_LIST;

    const dentro = [];

    for (const zona of zonas) {
      if (x < zona.x || x > zona.x + zona.width) continue;
      if (y < zona.y || y > zona.y + zona.height) continue;

      dentro.push(zona);
    }

    return dentro;
  }

  /**
   * O MESMO ABATE PARA TODOS OS MEMBROS QUE ESTAO NO CAMPO.
   *
   * Quem entra na divisao ja passou por `parceirosDeLoot`: e o mesmo
   * mapa, a mesma zona de mobs, dentro do alcance e vivo. A lista que
   * chega aqui nao e a party inteira, e a party que estava vendo o mob
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
   * - ITEM e MATERIAL vao para o DONO do abate, sem sorteio. Quem deu o
   *   last hit fica com o drop e quem nao deu fica sem nada: e a regra
   *   que da sentido ao last hit, e o item sorteado entre o grupo
   *   deixaria o dono poder perder o loot que ele mesmo matou
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

    const itens = collected.items ?? [];

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

        /**
         * O ITEM ENTRA NA MOCHILA DO DONO DO LAST HIT.
         *
         * Os itens ja foram sorteados uma vez, no `handleKill`, com o
         * filtro do dono. Aqui eles vao para a mochila DELE, e o que
         * nao cabe e descartado — nao cai no chao
         */
        const ehDono = sessionId === owner?.id;

        const dados = ehDono
          ? this.loot.grantItems(enemy, sessao, itens)
          : { items: [], descartados: 0 };

        if (
          dados.items.length > 0 ||
          moedasDele > 0 ||
          xpDele > 0
        ) {
          this.announceLoot({
            coins: moedasDele,
            items: dados.items,
            descartados: dados.descartados,
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

    /**
     * E A MESMA COISA PARA O TUTORIAL DE HABILIDADE.
     *
     * O tutorial de skill era contado so por `onAcao("learnSkill")`, e o
     * `habilidadesAprendidas` da sessao e a prova de que ele ja pode ter
     * sido cumprido antes de a missao virar a atual — um save antigo, um
     * jogador que voltou, ou um `onAcao` perdido num carregamento. Nos tres
     * casos o tutorial era um no permanente: objetivo cumprido, painel
     * mostrando 0 de 1, e nenhuma `learnSkill` para acontecer de novo
     *
     * O `Set` vira array porque o metodo do `QuestLog` nao conhece a
     * sessao: ele compara o que esta pronto contra uma lista, e quem sabe
     * traduzir o `Set` e o motor
     */
    const novasSkills = this.world.quests.syncHabilidades([
      ...(this.world.session?.habilidadesAprendidas ?? []),
    ]);

    if ((novasSkills ?? []).length > 0) {
      quests = [...(quests ?? []), ...novasSkills];
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
    this.showMessage(`Nível ${level} alcançado!`);
  }

  /**
   * Liga ou desliga o passe premium deste jogador.
   *
   * ## POR QUE ISTO VIVE NO MOTOR E NAO NO PAINEL
   *
   * Porque `premium` decide QUEM pode resgatar. Se ele morasse no
   * `PassePanel`, o painel desenharia "Resgatar" num dia premium e o
   * `claimPassReward` recusaria o clique — o botao ficaria la, aparecia
   * clicavel, e nao faria nada. Os dois precisam ler o mesmo interruptor
   *
   * ## E POR QUE O PEDIDO TRAZ O VALOR E NAO UM "INVERTER"
   *
* Porque dois cliques rapidos chegam ao servidor em qualquer ordem, e cada
   * inversao leria o valor anterior. Mandando o valor novo, os dois pedidos
   * produzem o mesmo estado final — o botao fica onde o jogador deixou
   */
setPassPremium(ativo, passeId = PASSE_PADRAO.id) {
      const premium = ativo === true;
  
      const alvo = passeId ?? PASSE_PADRAO.id;
  
      /**
       * O PREMIUM E POR PASSE, E CADA UM CUSTA 100 DIAMANTES.
       *
       * ## POR QUE O `passId` ENTRA NO PEDIDO
       *
       * Porque o painel tem tres passes, e ligar o premium da Praga nao
       * pode abrir os dias pagos da Cripta. Com um `premium: true` so, os
       * tres passes se abriam de uma vez, e o preco de 100 diamantes so
       * pagava um deles
       *
       * E o `passId` vem do catalogo, no servidor: o pedido traz o id, e o
       * motor descobre o passe por ele. Um id forjado cai em
       * `getPasse(null)` e nao cobra nem liga nada
       *
       * ## POR QUE DESLIGAR E DE GRAÇA
       *
       * Porque o premium e uma COMPRA, e cancelar uma compra nao pode
       * custar mais que ela — senao o preco do cancelamento seria o dobro
       * do da compra, e o jogador pagaria para desistir
       */
      if (premiumAtivo(this.world.passe.premium, alvo) === premium) {
        return false;
      }
  
      if (premium) {
        if (!this.world.inventory.spendDiamonds(PASSE_PREMIUM_DIAMANTES)) {
          this.showMessage(
            `Diamantes insuficientes: ${PASSE_PREMIUM_DIAMANTES} sao necessarios.`,
            true,
          );
  
          this.sendSnapshot();
  
          return false;
        }
      }
  
      this.world.passe.premium = premium
        ? ligarPremium(this.world.passe.premium, alvo)
        : desligarPremium(this.world.passe.premium, alvo);
  
      const nome = getPasse(alvo)?.nome ?? "Passe";
  
      this.showMessage(
        premium
          ? `${nome} Premium ativado por ${PASSE_PREMIUM_DIAMANTES} diamantes.`
          : `${nome} Premium desativado.`,
      );
  
      this.sendSnapshot();
  
      return true;
    }

  /**
   * Paga UM dia do passe.
   *
   * E o unico lugar do motor que entrega premio de passe. O pedido traz
   * `passId` e `dia` e nada mais: o item e a quantidade sao lidos do
   * CATALOGO, entao um cliente que mandasse `quantidade: 999` seria ignorado
   *
   * ## A ORDEM DAS CONFERENCIAS, E POR QUE ELA E ESTA
   *
   * O catalogo vem primeiro, porque e ele que diz se o par existe. Depois o
   * resgate, porque e a unica conferenca que impede pagamento dobrado. E o
   * estado vem por ultimo, porque e o mais caro: `estadoDoDia` so precisa ser
   * chamado quando o dia existe e ainda nao foi pego
   *
   * ## E POR QUE A MOCHILA CHEIA NAO DESFAZ O RESGATE
   *
   * Porque o dia que nao coube continua resgatado. O jogador viu "Resgatar",
   * apertou, e o item esta no `overflow` esperando lugar — voltar o dia para
   * `disponivel` faria o botao reaparecer e ele poderia apertar de novo, e
   * cada aperto empurraria mais item para fora da mochila. O aviso de
   * overflow diz o que aconteceu, que e a mesma resposta que a recompensa de
   * missao ja dá
   *
   * Devolve `true` quando pagou e `false` quando recusou
   */
  claimPassReward(passId, dia) {
    const passe = getPasse(passId);
    const premio = getDiaDoPasse(passId, dia);

    if (!passe || !premio) {
      this.showMessage("Esse dia de passe não existe.", true);
      return false;
    }

    if (diaResgatado(this.world.passe.resgatados, passId, premio.dia)) {
      this.showMessage("Esse prêmio já foi resgatado.", true);
      return false;
    }

      const estado = estadoDoDia(premio, {
        resgatado: false,

        /**
         * O PREMIUM DESTE PASSE, e nao o global.
         *
         * Era `this.world.passe.premium`, e o resgate da Praga abria os dias
         * pagos da Cripta. A conferencia tem que usar o MESMO passe que o
         * painel desenhou, senao a tela e o motor discordam
         */
        premiumAtivo: premiumAtivo(this.world.passe.premium, passId),
        diaAtual: passe.diaAtual,
      });

    if (estado !== "disponivel") {
      this.showMessage(ESTADO_TEXTO[estado] ?? "Esse dia ainda não abriu.", true);
      return false;
    }

    const item = getItem(premio.itemId);
    const entrada = this.world.inventory.add(
      premio.itemId,
      premio.quantidade ?? 1,
      premio.rarity ?? null,
    );

    /**
     * O DIA SO MARCA DEPOIS DE O ITEM ENTRAR.
     *
     * A ordem e o que impede o item sumir: se o `add` falhar, marcar o dia
     * como pego diria "ja resgatado" para um item que o jogador nunca recebeu,
     * e ele nao teria nem o item nem o botao para pedir de novo
     */
    if (entrada.added <= 0) {
      this.showMessage("Mochila cheia: o prêmio não coube.", true);
      return false;
    }

    this.world.passe.resgatados = resgatarDia(
      this.world.passe.resgatados,
      passId,
      premio.dia,
    );

    const nome = item?.name ?? premio.itemId;

    this.showMessage(
      `Prêmio do dia ${premio.dia}: ${nome} x${entrada.added}.`,
    );

    this.sendSnapshot();

    return true;
  }

  announceLoot(collected) {
    /**
     * A MOEDA NAO ENTRA NO AVISO.
     *
     * O texto era `+16 moedas · Pocao x2`, e a moeda ocupava o primeiro
     * lugar. E o contrario do que o jogador procura quando mata um bicho:
     * ele quer saber o que dropou de ITEM. A moeda e a informacao menos
     * util, e a unica que ele ja tem em outro lugar da tela
     *
     * O item continua aparecendo, porque item nao tem leitura em lugar
     * nenhum — nao tem contador, nao aparece na barra, e a notificacao e
     * a unica prova de que entrou na mochila
     */
    const parts = [];

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
      this.showMessage(parts.join(" · "));
    }

/**
       * O AVISO DE MOCHILA CHEIA.
       *
       * ## O TEXTO MUDOU PORQUE O COMPORTAMENTO MUDOU
       *
       * Era "Inventário cheio: o excedente ficou no chão." — e o item nao
       * fica mais no chão. O `LootSystem` agora pergunta `cabe()` antes do
       * `add` e o que nao cabe simplesmente nao e criado
       *
       * E o texto novo diz a coisa que o jogador precisa: o loot foi
       * PERDIDO. Um aviso que so dissesse "mochila cheia" deixaria o jogador
       * procurando o item no chao, porque e o que ele fazia antes
       */
      if (collected.descartados > 0) {
        this.showMessage(
          `Inventário cheio: ${collected.descartados} item(ns) perdido(s).`,
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

    /**
     * A MOEDA NAO ENTRA NO AVISO AQUI TAMBEM.
     *
     * Esta e a segunda rota de coleta: `announceLoot` cuida da morte do
     * mob, e esta cuida de pegar o que ja estava no chao. As duas
     * montavam o mesmo texto, entao tirar a moeda so de uma deixaria o
     * "+16 moedas" aparecendo quando o jogador passesava por cima do drop
     *
     * O `coins <= 0` da guarda de cima ja cobre o caso de so ter moeda:
     * com moedas e nenhum item, os dois avisos ficam vazios e nada e
     * mostrado
     */
    const parts = [];

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
      this.showMessage(parts.join(" ? "));
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

    /**
     * QUEM OUV ESTE PAINEL?
     *
     * Com `painelExterno`, o dono do painel e quem CHAMOU, e nao o motor:
     * no servidor, so o `GameServer.enviarPainel` sabe de qual cliente
     * o painel e, e ele levanta `painelSolicitado` em volta da chamada
     *
     * Sem esta guarda, cada uma das ~35 chamadas diretas de
     * `sendSnapshot` — uma por acao de combate, loot, missao, level up —
     * montava o painel INTEIRO de ~154KB e o `onSnapshot` jogava fora,
     * porque `clienteAtual` so existe dentro do `enviarPainel`
     *
     * O custo era por ACAO, e nao por tique: num servidor com gente
     * lutando, eram centenas de paineis de 154KB montados e descartados
     * por segundo. Este e o motivo de a flag existir, e o timer de 10Hz
     * do `update` era so uma das varias fontes
     *
     * A guarda esta AQUI e nao em cada chamada porque e a unica forma de
     * cobrir as 35 sem depender de ninguem lembrar
     */
    if (this.painelExterno && !this.painelSolicitado) return;

    const player = this.world.player;
    const selectedTarget = this.getLiveTarget();

    /**
     * A TAG DO LOCAL, gravada AQUI e antes do `onSnapshot`.
     *
     * E o unico ponto do codigo onde a guilda deste jogador ja foi montada
     * e ainda esta em ma. O canvas precisa dela a cada quadro e nao pode
     * pedir: pedir significaria chamar `guildaSnapshot` de novo, e isso
     * dispara `sincronizarPontos` — a regra de pontos por tempo decorrido —
     * sessenta vezes por segundo
     *
     * E ela fica como `null` quando o jogador nao ligou a opcao, e nao como
     * um objeto com `mostrarTag: false`: o desenho so precisa saber se ha
     * alguma coisa para pintar
     */
    const guildaDoPainel = this.guildaSnapshot();

    const membroEu = guildaDoPainel?.guilda?.membros?.find?.((m) => m.eu);

    this.tagLocal =
      guildaDoPainel?.guilda && membroEu?.mostrarTag === true
        ? {
            tag: guildaDoPainel.guilda.tag,
            cor: guildaDoPainel.guilda.cor,
          }
        : null;

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

      /**
       * A MORTE, ou `null`.
       *
       * E o unico campo que decide se o `DeathPanel` existe. Sem ele o
       * componente vivia fechado sem erro nenhum — o arquivo estava no
       * disco e o HUD o renderizava, mas o motor nunca produziu o
       * estado que ele le
       *
       * Sai por aqui e nao pelo snapshot do mundo pelo mesmo motivo do
       * portal: e uma leitura de tela, e o painel ja e por jogador
       */
      morte: this.morteSnapshot(),

      /**
       * A MINERACAO, ou `null`.
       *
       * Sai pelo mesmo caminho da morte: e uma leitura de tela, e o painel
       * ja e por jogador. A pedra em si e do MUNDO e vem no snapshot de
       * 20Hz; isto e o que o jogador encostado nela precisa ler
       *
       * O motor nao decide nada disto. Quem escreve `session.mineracao` e
       * o servidor, e o que o `GameEngine` faz e dar forma para a HUD
       */
      mineracao: this.mineracaoSnapshot(),

      /**
       * A BOX DO TELEPORTE, ou `null`.
       *
       * Aparece quando o jogador esta no meio de uma caminhada longa e
       * some quando ele ja chegou perto. O motor decide as tres coisas
       * que a box mostra: se ela existe, para ONDE, e se ha pergaminho
       *
       * O botao da box nao decide nada disso — ele so avisa que foi
       * apertado. Um componente que calculasse a distancia leria uma
       * posicao que ele nao tem, e mostraria um atalho para um lugar que
       * o jogador ja tinha alcancado
       */
      teleporte: this.teleporteSnapshot(),

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
     * A LOJA, e so os PRODUTOS JA COMPRADOS.
     *
     * ## POR QUE SO ISSO
     *
     * Porque o catalogo da loja e arquivo estatico, e o cliente ja o tem: o
     * `LojaPanel` importa `LOJA_PACOTES` direto. Mandar os 15 produtos pelo
     * snapshot a cada 4Hz seria 15 objetos repetidos 4 vezes por segundo
     * para o cliente jogar fora
     *
     * O unico dado que ele NAO tem e quais o jogador ja pagou — e esse e
     * estado de sessao, mora no servidor, e e o que desativa o card
     *
     * ## POR QUE UM ARRAY E NAO O SET
     *
     * Porque `Set` nao sobrevive a serializacao: o `JSON.stringify` de um
     * Set da `{}`. O `[...set]` e o que faz o `lojaComprados.has()` do
     * servidor virar um `.includes()` no cliente
     */
    loja: {
      comprados: [
        ...(this.world.session?.lojaComprados ?? []),
      ],
    },

      /**
       * O BAU, logo depois da mochila e do equipamento.
       *
       * A ordem nao e estetica: os tres descrevem ONDE o item esta, e o
       * painel do bau le a mochila e o bau na mesma tela para mostrar o
       * item nos dois lados. Mandar o baU colado na mochila evita que o
       * painel precise de um indice solto no objeto
       */
      bau: this.bauSnapshot(),

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

              /**
               * OS SLOCATS LIVRES DA MOCHILA, para o painel do mercado
               * avisar que um anuncio nao cabe ANTES de o jogador
               * clicar. E o mesmo `freeSlots` que o servidor usa na
               * compra, entao o numero da tela e o numero que vale
               */
              mochila: {
                livres: this.world.inventory.freeSlots,
                capacity: this.world.inventory.capacity,
              },
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
      rank: montarRank(
        [...this.world.players.values()],
        this.personagensSalvos?.() ?? [],
      ),

      /**
       * O PASSE, e so o estado que o painel nao tem como deduzir.
       *
       * O catalogo (dias, icones, descricao) ja e o mesmo para todo mundo e
       * nao precisa vir no pacote a 4Hz. O que muda por jogador e o
       * `resgatados` e o `premium`, e sem os dois o painel abriria mostrando
       * todo dia como "Resgatar" — inclusive os que o jogador ja pegou
       */
      passe: {
        /**
         * O PREMIUM VAI POR PASSE, e nao como um booleano.
         *
         * O painel abre em um passe por vez, e cada um tem o seu
         * interruptor. Mandar um `premium: true` unico faria o painel
         * Mostrar o interruptor ligado em todos os tres, e o jogador nao
         * saberia qual ele pagou
         *
         * E o `resgatados` logo abaixo tem o MESMO formato — mapa de
         * `passId` para a lista. Os dois campos sao "o que o jogador fez
         * com este passe", e divir o formato entre eles obrigaria o painel a
         * ler dois formatos para a mesma pergunta
         */
        premium: { ...this.world.passe.premium },
        resgatados: { ...this.world.passe.resgatados },
      },

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
         * A lista vem do servidor por `sessao.guildaBusca`, e nao de um
         * `buscar()` local: as guildas sao do servidor, e refazer a
         * busca no cliente mostraria um mundo que so existe na tela
         *
         * E da SESSAO, e nao deste motor. No `searchResults` do motor a
         * busca da Ana aparecia no painel do Bento: o motor e
         * compartilhado por todo mundo conectado, entao um campo dele e
         * a ultima busca que alguem fez
         */
        busca: this.sessaoDeJogador?.guildaBusca ?? [],
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

      /**
       * O DASH: QUANTO FALTA, em segundos.
       *
       * ## POR QUE SEGUNDOS E NAO O RELOGIO ABSOLUTO
       *
       * Porque a HUD mostra um numero que BAIXA, e o relogio absoluto seria
       * um timestamp de 1783 seconds que o painel teria que subtrair do
       * relogio DELE. O cliente nao tem o mesmo relogio do servidor, entao
       * a conta sairia errada em maquina adiantada
       *
       * O `Math.max(0, ...)` e o que impede o negativo: quando o dash recarrega,
       * `dashAte` fica no passado e a subtracao daria menos que zero. O icone
       * receberia um numero negativo e o anel de recarga giraria ao contrario
       */
      dashRestante: Math.max(
        0,
        (this.world.session?.dashAte ?? 0) - this.world.time,
      ),

      // quais skills estao em automatico. o HUD le isto para
      // acender o `AUTO`; sem o campo, arrastar a skill funcionava
      // e nao sinalizava nada
      skillAuto: [...(this.sessaoDeJogador?.skillAuto ?? [])],

      /**
       * O USO AUTOMATICO DA POCAO, e o que o painel de configuracao
       * desenha e o que o slot da HUD mostra.
       *
       * Sao TRES campos porque o painel precisa desenh-los e o HUD precisa
       * saber qual arte colocar no slot: o `ligado` acende o realce, o
       * `itemId` escolhe a arte da pocao e o `limiar` e o texto do titulo.
       *
       * Sem o `contagem` o slot mostraria uma pocao que o jogador ja bebeu
       * todas: ele continuaria com a arte, sem rastro de que acabou
       */
      autoPocao: {
        ligado: Boolean(this.sessaoDeJogador?.autoPocao?.ligado),
        limiar:
          this.sessaoDeJogador?.autoPocao?.limiar ??
          AUTO_POCAO_LIMIAR_PADRAO,
        itemId: this.sessaoDeJogador?.autoPocao?.itemId ?? null,
        contagem:
          this.sessaoDeJogador?.autoPocao?.itemId
            ? this.world.inventory.count(
                this.sessaoDeJogador.autoPocao.itemId,
              )
            : 0,
      },

      /**
       * AS HABILIDADES APRENDIDAS, e o nivel que abre a ultimate.
       *
       * A HUD usa os dois para pintar a tranca da barra: o slot mostra o
       * nome da habilidade mesmo quando ela ainda nao foi aprendida, e e
       * a tranca que diz que falta o livro
       *
       * O `nivelDaUltimate` vai separado do `ULTIMATE_NIVEL` do catalogo
       * porque a tela precisa saber se LIBEROU, e nao qual e o numero.
       * Comprimir a conta no servidor, o painel vira um numero que
       * ninguem precisa recalcular no cliente — e assim nenhum dos dois
       * lados pode discordar sobre o estado da ultimate
       */
      habilidadesAprendidas: [
        ...(this.sessaoDeJogador?.habilidadesAprendidas ?? []),
      ],
      ultimateLiberada: ultimateLiberada(player.level),

      /**
       * O FARM OFFLINE, em duas coisas separadas.
       *
       * `ativo` e o que a pausa usa para mostrar que o relogio esta
       * correndo; `relatorio` e o que o modal do jogador desenha quando
       * ele volta
       *
       * O relatorio viaja inteiro — itens, mobs, numeros — e ele some da
       * sessao assim que o jogador confirma que viu (`FARM_OFFLINE_VISTO`).
       * Sem isso ele ocuparia o `PLAYER_STATE` a 4Hz para todo mundo
       * online, que e onde o painel pesa
       *
       * E o `sanear` nao roda aqui: o estado ja foi sanado na
       * restauracao do save e reescrito pelo accrue. O painel so copia
       */
      farmOffline: {
        ativo: this.sessaoDeJogador?.farmOffline?.ativo === true,
        relatorio: this.sessaoDeJogador?.farmOffline?.relatorio ?? null,
      },

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
       * Quem pé o `attackAnimation` do mob e o pacote do servidor,
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

      /**
       * O RELOGIO DA MORTE, e ele roda AQUI no modo rede.
       *
       * O `updateEnemies` que decrementa o `deathTimer` e a SIMULACAO, e a
       * simulacao e do servidor: o cliente so desenha. Sem este decremento o
       * relogio que o `aplicarInimigos` ligou no primeiro pacote ficaria
       * parado no total, e o cadaver ficaria no primeiro quadro da animacao
       * de morte para sempre, opaco, sem sumir
       *
       * E o `Math.max` com zero porque o `resolveDeathAlpha` divide por ele:
       * um valor negativo ali daria alfa negativo, e o cadaver viraria um
       * retangulo invisivel antes da hora
       *
       * O `alive === false` e o guarda que separa os dois modos: no offline o
       * `updateEnemies` ja decrementou, e decrementar duas vezes gastaria o
       * cadaver em metade do tempo
       */
      if (!enemy.alive && enemy.deathTimer > 0) {
        enemy.deathTimer = Math.max(
          0,
          enemy.deathTimer - deltaTime,
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
    this.drawTelegraphs(context);
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

  /**
   * OS TELEGRAPHS, desenhados NO CHAO.
   *
   * ## A POSICAO NA ORDEM DE DESENHO
   *
   * Entre o `drawMap` e o `drawWorldSorted`, e e o unico lugar que serve:
   * abaixo do mapa a area ficaria escondida pelo ladrilho, e acima do
   * `drawWorldSorted` ela cobriria o jogador, os mobs e o proprio chefe — que
   * e o oposto do que o pedido quer, onde o indicador e informacao de fundo
   * e nunca esconde quem esta sendo atacado
   *
   * ## E O CULLING
   *
   * E o mesmo `getViewBounds` que o `PropRenderer` usa, pelo mesmo motivo:
   * um telegraph a 2000px do jogador nao precisa ser desenhado, e o teste e
   * uma comparacao por execucao viva — normalmente zero ou uma
   */
drawTelegraphs(context) {
  const execucoes = this.world.telegraphs;

  if (!execucoes?.length) return;

  const limites = this.getViewBounds();

  for (const execucao of execucoes) {
    // o teste de visibilidade e o retangulo da execucao, e nao um raio
    // solto: um cone e um anel tem forma diferente, e um cull por raio
    // deixaria de fora um cone longo apontando para fora da tela
    if (!this.telegraphVisivel(execucao, limites)) continue;

    /**
     * O TEMPO RESTANTE, e ele e lido no RELOGIO DO SERVIDOR, traduzido
     * para o relogio do cliente.
     *
     * ## POR QUE NAO DIRETO
     *
     * Porque `impactoEm` e um numero do `world.time` do servidor, e o
     * cliente conta em `spriteTime`. Sao escalas sem nenhuma relacao: o
     * servidor pode estar em 340 e o cliente em 12, e a conta direta dava
     * `restante: 330` num telegraph de preparo 2.0s. O `progresso` ficava
     * `1 - 330/2`, um numero muito negativo cortado em zero pelo `Math.max`
     *
     * O sintoma era a AREA aparecia parada: a camada base e desenhada com o
     * progresso zero, entao o jogador via o aviso, mas a frente luminosa
     * nunca crescia e o pulso nunca rodava. Sem nenhuma sensacao de quando o
     * golpe comeca e quando acaba
     *
     * ## A CORRECAO
     *
     * O pacote traz `servidorEm`, o `world.time` do servidor no instante em
     * que ele foi enviado. O `aplicarTelegraph` do cliente guarda a
     * diferenca em `deslocamento`, e aqui o tempo do servidor e reconstruido
     * com o relogio local
     *
     * ## E POR QUE RECONSTRUIR, E NAO CONFIAR NO INSTANTE RECEBIDO
     *
     * O pacote chega a cada 100ms, e o telegraph nasce em um instante que
     * pode ser ate 100ms antes de o pacote sair. Confiar no "agora do
     * recebimento" comecaria a barra sempre atrasada, e com preparo de 1.2s
     * isso e um quinto da animacao errada
     */
    const agoraNoServidor =
      this.spriteTime + (execucao.deslocamento ?? 0);

    const restante = execucao.impactoEm - agoraNoServidor;

    const progresso = Math.min(
      1,
      Math.max(0, 1 - restante / execucao.duracao),
    );

    /**
     * O TELEGRAPH QUE JA PASSOU DO IMPACTO E DESCARTADO AQUI.
     *
     * E o que fecha o buraco do relogio: se o pacote chegou atrasado e o
     * instante do impacto ja passou, o indicador some em vez de ficar
     * congelado no chao. Sem esta linha, um telegraph que o cliente recebeu
     * 300ms depois do golpe ficaria visivel por um tempo indeterminado
     */
    if (restante <= 0) continue;

    this.telegraphRenderer.desenharTelegraph(
      context,
      execucao,
      progresso,
      restante,
    );
  }
}

/**
 * O TELEGRAPH ESTA DENTRO DA TELA?
 *
 * ## O QUE ESTAVA ERRADO
 *
 * O teste usava `execucao.x/y` — que e a PONTO DE ORIGEM da forma — como se
 * fosse o centro da area. Para o circulo e o anel as duas coisas sao a mesma,
 * mas para a `line`, a `charge` e o `cone` a origem e um PONTO na borda e a
 * area vai 620px na direcao do golpe
 *
 * O efeito era o `ground_slam` sumindo com o chefe na tela: o circulo tem
 * raio 300, a origem e o centro, e o teste passava. Ja a `charge`, com
 * 620 de alcance para um lado so, era desenhada ou nao conforme a POSICAO
 * do chefe na tela, e nao conforme o alcance — o inverso do que importa
 *
 * ## A CAIXA DE CADA FORMA
 *
 * Cada tipo tem uma extensao propria, e o cull usa a dela:
 *
 * - `circle` e `targeted`: um quadrado em torno do centro, de lado 2x o raio
 * - `ring`: o quadrado do `raioExterno`
 * - `line`, `charge` e `cone`: a caixa e montada no sentido do golpe, com o
 *   comprimento do alcance somado a direcao e a largura somada de lado
 *
 * ## E A MARGEM DE 40
 *
 * Porque o contorno tem 4px e o glow chega a 9px, e um telegraph que entra
 * so pela borda da tela e desenhado em parte — sem a margem, ele apareceria
 * ja no proximo quadro
 */
telegraphVisivel(execucao, limites) {
  const meiaLargura = (execucao.largura ?? 0) / 2;

  let minX = execucao.x;
  let maxX = execucao.x;
  let minY = execucao.y;
  let maxY = execucao.y;

  if (execucao.tipo === "circle" || execucao.tipo === "targeted") {
    const r = execucao.raio ?? 0;

    minX -= r; maxX += r;
    minY -= r; maxY += r;
  } else if (execucao.tipo === "ring") {
    const r = execucao.raioExterno ?? 0;

    minX -= r; maxX += r;
    minY -= r; maxY += r;
  } else if (execucao.alcance !== undefined) {
    /**
     * A CAIXA NO SENTIDO DO GOLPE, e nao um quadrado em volta da origem.
     *
     * A origem e um ponto na BORDA da area — o ponto de onde o golpe sai — e
     * a area cresce para o lado que o chefe esta virado. Um quadrado em volta
     * da origem deixaria de fora metade do alcance
     */
    const alc = execucao.alcance;

    minX = Math.min(execucao.x, execucao.x + execucao.dirX * alc) - meiaLargura;
    maxX = Math.max(execucao.x, execucao.x + execucao.dirX * alc) + meiaLargura;
    minY = Math.min(execucao.y, execucao.y + execucao.dirY * alc) - meiaLargura;
    maxY = Math.max(execucao.y, execucao.y + execucao.dirY * alc) + meiaLargura;
  }

  const margem = 40;

  return (
    maxX + margem >= limites.x &&
    minX - margem <= limites.x + limites.width &&
    maxY + margem >= limites.y &&
    minY - margem <= limites.y + limites.height
  );
}

drawWorldSorted(context) {
    const list = this.world.sort;
    list.length = 0;

    if (this.props.isReady()) {
      /**
       * A PEDIDA DEMOLIDA NAO ENTRA NEM NA LISTA DE DESENHO.
       *
       * E aqui, e nao dentro do `PropRenderer`, porque a lista e ordenada
       * por `y` junto com inimigos, NPCs e o jogador. Filtrar la dentro
       * deixaria a pedra na lista de ordenacao sem ser desenhada, e o
       * espaco dela na ordenacao nao mudaria nada — mas a checagem
       * rodaria para as 40 props de todo quadro, dentro do `drawProp`
       *
       * E o filtro e do SERVIDOR: `pedidasForaDoMapa` e a lista de ids que
       * o servidor mandou neste pacote. Uma pedra que o servidor nao
       * declarou continua no mapa, porque quem decide o que existe no
       * mundo e ele
       */
      const fora = this.pedidasForaDoMapa;

      for (const prop of this.props.collectVisible(
        this.world.props,
        this.getViewBounds(),
      )) {
        if (fora instanceof Set && fora.has(prop.id)) continue;

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
      /**
       * O CADAVER CONTINUA SENDO DESENHADO.
       *
       * Antes, um inimigo morto era pulado aqui e sumia no mesmo quadro
       * em que o HP zerava. Com arte de morte, o cadaver precisa ficar
       * em cena ate o relogio acabar: e o que faz o jogador ver o golpe
       * que matou e o corpo caindo, em vez de um mob que apaga
       *
       * `eMostrandoCadaver` ja devolve `false` para quem nao tem arte de
       * morte, entao os outros bichos continuam sumindo na hora — que e o
       * que o `alive === false` ja fazia
       */
      if (!enemy.alive && !this.eMostrandoCadaver(enemy)) continue;

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
        // o mapa decide a folha da prop e se ela tem sombra
        this.props.drawShadow(context, entry.ref, this.world.map);
        this.props.drawProp(context, entry.ref, this.world.map);
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

    /**
     * A TRAVA, conferida aqui tambem.
     *
     * O `GameServer` ja recusou antes de chegar aqui na rede, mas este
     * metodo tambem e o caminho do SINGLE PLAYER, e ele nao tem o
     * `GameServer` para perguntar. Sem esta conferida, o jogo offline
     * atravessaria a Floresta Sombria no minuto um — a trava existiria
     * so no online, que e o jeito de uma regra parecer implementada e
     * nao estar
     */
    const trava = portalLiberado(
      emCima.portal.exigeMissaoDe,
      this.world.quests?.mainIndex ?? 0,
    );

    if (!trava.ok) return false;

    const chegada = this.chegadaDe(
      emCima.portal,
      emCima.destino,
    );

    this.setMap(emCima.destino, { chegada });

    /**
     * O AGGRO DO MAPA DE DESTINO E ZERADO AQUI.
     *
     * ## POR QUE DEPOIS DO `setMap` E NAO ANTES
     *
     * Porque `resetarAggroDoMapa` trabalha em `world.enemies`, e o `setMap` e
     * quem troca essa lista pela do mapa novo. Limpar antes de trocar
     * zeraria o aggro do mapa que o jogador ESTAVA DEIXANDO — e o aggro do
     * mapa de destino, que e o que faz o mob atacar o jogador recem-chegado,
     * continuaria inteiro
     *
     * ## POR QUE O AGGRO SOBREVIVE A TELEPORTE
     *
     * Porque `targetId` e um ID DE SESSAO, nao uma posicao. O mob guarda
     * "estou atacando o jogador Ana" e nao "estou a 40px daquele ponto". O
     * teleporte muda o lugar do jogador, mas nao diz nada ao mob — que
     * continua com o alvo, agora em outro mapa, e persegue a distancia pelo
     * id
     */
    this.resetarAggroDoMapa();

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

      /**
       * A TRAVA, no painel.
       *
       * Vem do mesmo `dadosDaTrava` que decide a travessia, entao a box
       * nao pode prometer uma viagem que o servidor vai recusar. E o
       * `mainIndex` do log de missoes do jogador em foco — o unico
       * estado que a trava consulta
       */
      ...dadosDaTrava(
        emCima.portal.exigeMissaoDe,
        this.world.quests?.mainIndex ?? 0,
      ),
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

/**
   * O alvo SELECIONADO, vivo, ou `null`.
   *
   * E o `selectedTargetId` resolvido pelo mesmo indice de
   * `findEnemyById`. Antes era um `Array.find` proprio, e esta funcao
   * roda uma vez por montagem de painel — que sao 4 por segundo por
   * jogador online. Com 50 jogadores, eram 200 varreduras de 93 inimigos
   * por segundo para descobrir o alvo que ja estava indexado
   */
  getLiveTarget() {
    if (this.selectedTargetId === null) {
      return null;
    }

    return this.findEnemyById(this.selectedTargetId);
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

      /**
       * O MAIS PERTO DO PONTEIRO, e nao o ALVO.
       *
       * Este loop voltava imediatamente quando encontrava o alvo
       * selecionado, com o argumento de que a barra "nao pulava" entre
       * dois mobs sobrepostos. Hoje isso atrapalha: a barra sobre o alvo
       * nao aparece mais (ver `getInspectedEnemy`), entao devolver o alvo
       * aqui so faria o inspetor SUMIR enquanto o jogador aponta para o
       * outro mob que estava embaixo dele
       *
       * Distancia pura resolve o caso sem regra especial: o inimigo que
       * o jogador esta apontando e o mais proximo do ponteiro
       */
      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }

    return best;
  }

  /**
   * A BARRA FLUTUANTE: so a do mob que o jogador esta APONTANDO.
   *
   * ## POR QUE NAO CAI NO ALVO
   *
   * Era `hover ?? liveTarget`, e essa segunda parte e o que mantinha a
   * barra presa em cima do alvo depois do clique. O alvo ja tem a
   * informacao no `target-panel` do topo da tela — nivel, barra e HP, os
   * tres campos daqui — entao repetir a mesma coisa em cima do mob era a
   * mesma leitura duas vezes na tela
   *
   * ## POR QUE SOME QUANDO O PONTEIRO ESTA NO ALVO
   *
   * E o `enemy.id === this.selectedTargetId` abaixo. Passar o mouse pelo
   * alvo tem que ser um NAO, e nao um "mostra a mesma informacao em outro
   * lugar": o painel do topo ja responde pelo alvo, e a barra flutuante
   * existe para o mob que ele ainda NAO escolheu
   *
   * E o mesmo que move o mouse para outro mob mostrar a barra DELE: o
   * hovered e outro, e a comparacao com o alvo nao bate
   */
  getInspectedEnemy() {
    const hovered = this.getHoveredEnemy();

    if (!hovered) return null;

    // o alvo ja esta descrito no topo da tela
    if (hovered.id === this.selectedTargetId) return null;

    return hovered;
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

  /**
   * OS INIMIGOS QUE O MINIMAPA DESENHA.
   *
   * O minimapa existe para achar o que esta longe, entao o chefe fica de
   * fora: ele esta no centro de uma arena que o jogador esta vendo, e o
   * marcador dele — do tamanho do raio, o maior do jogo — virava uma
   * mancha vermelha do tamanho de um boneco
   *
   * ## POR QUE O CHEFE E O UNICO QUE SAI
   *
   * Nao e estetica de mob grande: e que o `radius` do chefe e 46 e o
   * marcador cresce com ele. Um slime de raio 21 e um ponto util; um
   * chefe de 46 e um quadrado que tapa o centro do mapa
   *
   * E o filtro e pelo `bosses` do MAPA, e nao por criatura. Quem e chefe
   * e uma propriedade do mapa, entao um chefe novo em um mapa novo
   * desaparece do minimapa sem ninguem mexer aqui
   *
   * ## A LISTA ORIGINAL, NO CASO DE NAO HAVER CHEFE
   *
   * Sem o `early return`, o mapa sem chefe pagaria um `filter` a cada
   * quadro (60 no navegador, 20 no servidor) para devolver exatamente a
   * lista que ja estava la. Nos mapas do vale, essa e a lista inteira
   */
  inimigosDoMinimapa() {
    const bosses = this.world.map?.bosses;

    if (!bosses?.length) return this.world.enemies;

    return this.world.enemies.filter(
      (enemy) => !bosses.some((b) => b.creature === enemy.typeId),
    );
  }

  drawMinimap(context, width, height) {
    if (!this.world.map) return;

    const panelWidth = Math.min(
      MINIMAP_WIDTH,
      width - MINIMAP_LEFT - MINIMAP_BOTTOM,
    );

    const panelHeight = Math.min(
      MINIMAP_HEIGHT,
      height - MINIMAP_TOP_IDLE - MINIMAP_BOTTOM,
    );

    if (panelWidth < 80 || panelHeight < 60) {
      return;
    }

    /**
     * A COLUNA ESQUERDA, E O MINIMAPA SEM ANIMACAO.
     *
     * ## POR QUE O MINIMAPA NAO SE MEXE MAIS
     *
     * Havia uma descida: com alvo vivo, o painel saltava de
     * `MINIMAP_TOP_IDLE` para `MINIMAP_TOP_TARGETED`, interpolado por
     * `MINIMAP_SLIDE`, e `this.minimapY` guardava a posicao do quadro.
     * O motivo era o painel de alvo dividir o mesmo slot do minimapa, e
     * os dois se escondiam na mesma faixa
     *
     * Hoje o painel de alvo e o `hud-topo`, no alto central, e o minimapa
     * esta na coluna esquerda. Eles nunca mais se cruzam, entao a descida
     * nao desviava de nada: era o minimapa andando sozinho a cada
     * clique num inimigo
     *
     * ## POR QUE SUMIU O `this.minimapY`
     *
     * Porque ele existia SO para guardar o meio da interpolacao. Sem
     * animacao nao ha meio: o `top` e uma constante, entao ler
     * `MINIMAP_TOP_IDLE` direto diz a mesma coisa sem estado que o
     * motor precisa manter
     */
    const originX = MINIMAP_LEFT;
    const originY = MINIMAP_TOP_IDLE;

drawMinimap(context, {
        map: this.world.map,

        /**
         * O MAPA DO TILED NO MINIMAPA.
         *
         * O canvas fora de tela e desenhado uma vez, quando a folha de tiles
         * carrega. Aqui so se pergunta se ele existe — o desenho de 6204
         * tiles por quadro custaria mais que o resto da tela junta
         *
         * E `null` para quem nao tem `.tmj`: o hub, o mapa 2 e o vale 1
         * continuam desenhando as zonas, que e o que eles tem para mostrar
         */
        imagemDoMapa: this.minimapaDoMapaTiled(panelWidth, panelHeight),

        /**
         * AS PEDRAS QUE O SERVIDOR TIROU DO MAPA.
         *
         * Sem este campo o minimapa continuava desenhando um ponto cinza
         * onde a pedra demolida estava, e era o unico lugar da tela que
         * ainda mostrava uma coisa que nao existe mais
         */
        pedidasFora: this.pedidasForaDoMapa,

      /**
       * As zonas do mapa que esta carregado.
       *
       * Antes eram as do vale, fixas. O hub tem `zones: []`, entao
       * o minimap dele fica sem nenhuma area pintada — que e o
       * correto: nao ha zona de mob no hub
       */
      /**
       * As zonas do mapa que esta carregado.
       *
       * Antes eram as do vale, fixas. O hub tem `zones: []`, entao
       * o minimap dele fica sem nenhuma area pintada — que e o
       * correto: nao ha zona de mob no hub
       *
       * E o mapa 1 tambem nao pinta mais: ele tem o mapa de verdade, e as
       * zones desenhadas por cima dele eram um esquema de balanceamento
       * visivel por cima da arte. O `drawMinimap` so usa esta lista quando
       * NAO tem imagem de mapa
       */
      zones: this.world.map.zones ?? [],
      player: this.world.player,

      /**
       * OS INIMIGOS DO MINIMAPA, SEM O CHEFE.
       *
       * O marcador do chefe e um quadradinho vermelho do tamanho do
       * RAIO dele — e o raio do chefe e o maior do jogo, entao o que
       * aparecia era uma mancha vermelha de 46px no meio da arena, do
       * tamanho de um personagem inteiro. Nao ajudava a ninguem: o
       * jogador esta DENTRO da arena, o chefe esta no centro, e os dois
       * se vendo. O minimapa serves para achar o que esta longe, e o
       * chefe nunca esta longe
       *
       * O filtro e por MAPA, e nao por criatura: e o proprio mapa que
       * diz quem e chefe (o `bosses`), entao um chefe novo em um mapa
       * novo nao precisa deste codigo saber o nome dele
       */
      enemies: this.inimigosDoMinimapa(),

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
 * O CANVAS COM O MAPA DO TILED PRONTO PARA O MINIMAPA, ou `null`.
 *
 * ## POR QUE ESTE METODO PREGUNTA, E NAO DESENHA
 *
 * Porque desenhar o mapa e trabalho de uma vez. Aqui so se pergunta se ja
 * esta pronto — e o `prepararMinimapa` e quem decide, devolvendo `false`
 * enquanto a folha de tiles ainda esta baixando
 *
 * ## E POR QUE ELE PRECISA DA LARGURA DO PAINEL
 *
 * Porque o canvas fora de tela nasce do tamanho que o minimapa vai ter. E o
 * HUD decide esse tamanho pelo tamanho da janela, entao o canvas so pode
 * nascer depois do `panelWidth`
 *
 * ## E POR QUE A FOLHA PRECISA ESTAR CARREGADA
 *
 * Porque sem a imagem nao ha o que desenhar. A `TileMapRenderer` ja sabe
 * disso — e a mesma imagem, a mesma promessa de `onload`
 */
minimapaDoMapaTiled(larguraPainel, alturaPainel) {
  const mapa = this.world.map;

  if (!mapa) return null;

  const tiled = tiledDoMapa(mapa.id);

  if (!tiled) return null;

  const tileset = tiled.tileset;

  if (!tileset?.url) return null;

  const imagem = this.tiles.imagens.get(tileset.url);

  if (!imagem?.complete || !imagem.naturalWidth) return null;

  prepararMinimapa(mapa.id, tiled, tileset, imagem, larguraPainel, alturaPainel);

  return minimapaDe(mapa.id);
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
      /**
       * O TERRENO SO DESENHA QUANDO O MAPA NAO TEM CHAO NO TILED.
       *
       * ## POR QUE ISTO EXISTE, E O QUE TROCA
       *
       * Antes o terreno era desenhado sempre e o Tiled por cima dele. Com um
       * mapa que tem os dois, o terreno vira trabalho jogado fora: uma
       * textura de 64px pintada em 6016x4224 e imediatamente coberta por
       * cima, sessenta vezes por segundo
       *
       * ## E POR QUE O MAPO COM TILED FICA PRECISO DE TER O TERRENO
       *
       * Nao fica. Ele tem a mesma area, o mesmo tamanho de tile e cobre
       * todas as celulas — entao "nao tem chao embaixo" e a verdade, e o que
       * se ve e so o desenho do Tiled
       *
       * ## E A IMAGEM QUE AINDA NAO CHEGOU
       *
       * Aperto do `isReady` abaixo: com a folha carregando, este bloco
       * tambem nao desenha, e o que aparece e a cor de fundo do mapa. Uma
       * textura faltando viraria um retangulo coloridon a tela
       */
      if (!temCamadaDeTile(map.id)) {
        this.terrain.draw(
          context,
          map,
          map.zones ?? [],
          view,
        );
      }
    } else if (!temCamadaDeTile(map.id)) {
      context.fillStyle = map.background;
      context.fillRect(0, 0, map.width, map.height);
    }

    /**
 * AS CAMADAS DO TILED, AGORA SEM A PROPRIEDADE NO MAPA.
 *
 * A camada vem de `tiledDoMapa(map.id)`, e nao de `map.tiled`: o objeto
 * lido carrega dois `Int32Array` de 6204 celulas, e o servidor importa o
 * mesmo arquivo de mapa em Node puro, onde o plugin do Vite que le o
 * `.tmj` nao existe. Deixar a camada fora do mapa e o que mantem o servidor
 * de pe
 *
 * O resto do bloco e o mesmo desenho: depois do terreno, antes do portal
 */
const tiled = tiledDoMapa(map.id);

if (tiled) {
      this.tiles.load(tiled);

      if (this.tiles.isReady(tiled)) {
        this.tiles.draw(context, tiled, view);
      }
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

    /**
 * AS ZONAS DESENHADAS POR CIMA DO CHAO: o campo com opacidade e o nome.
 *
 * ## POR QUE ESTAO DESLIGADAS
 *
 * Porque o mapa 1 passou a ter arte propria. A tela do vale era uma grade de
 * areas coloridas com o nome escrito em cima — um esquema de balanceamento
 * desenhado na tela. Com o dungeon do Tiled, essa grade atrapalha: ela tapa o
 * que voce pintou e escreve "Vale das Cinzas" no meio de um corredor
 *
 * ## POR QUE O CODIGO CONTINUA AQUI, E SO COM A FLAG DESLIGADA
 *
 * Porque o mapa de teste e o mapa 2 nao tem essa arte. O `mapa_teste` tem
 * 40 cristais espalhados e precisa da zona pintada para o jogador saber onde
 * estao, e sem o rotulo o minimo nao tem nenhuma area colorida
 *
 * Apagar os dois trechos faria o mapa de teste perder a orientacao, que e a
 * unica coisa que ele tem. Entao o desenho vira opcao: cada mapa decide se
 * quer, por `mapaDesenhaZonas`
 */
const ZONAS_COM_CAMPO_E_NOME = false;

/**
 * O MAPA DESENHA AS ZONAS POR CIMA DO CHAO?
 *
 * O padrao e `false`: a maioria dos mapas tem arte propria e nao quer um
 * retangulo colorido em cima. Quem precisa — o mapa de teste — declara o
 * contrario no proprio mapa, e o `drawMap` so pergunta
 */
function mapaDesenhaZonas(map) {
  return map.desenhaZonas ?? ZONAS_COM_CAMPO_E_NOME;
}

if (mapaDesenhaZonas(map)) {
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
  }

    /**
     * A LINHA CINZA DA BORDA.
     *
     * ## POR QUE ELA VOLTOU, E SO PARA ALGUNS MAPAS
     *
     * Ela foi despensada porque a sebe de arbusto passou a fechar as
     * quatro bordas do vale: com parede de verdade na tela, a linha era
     * parede pintada de cinza por cima da parede de verdade
     *
     * O mapa de teste nao tem sebe — e um mapa vazio, sem prop
     * nenhuma. Sem a linha, o jogador sai andando do nada: o
     * `clampToBounds` segura ele, mas nao ha nada dizendo onde o mundo
     * acaba
     *
     * Por isso ela volta com `map.limiteVisivel`, e NAO como uma regra
     * de todo mapa. O vale e o hub tem a sebe; se a linha voltasse para
     * todos, seria a mesma parede pintada de volta
     *
     * ## POR QUE O RETANGULO, E NAO A FORMA DESENHADA
     *
     * Houve uma tentativa de trocar o retangulo pelo contorno irregular
     * do desenho, e ela voltou atras. O traço da imagem e um rascunho em
     * papel: semeado em pixel de mundo ele dava segmentos de um pixel de
     * lado e cantos que nao fechavam, e a linha saia serrilhada em vez de
     * reta
     *
     * O retangulo e a forma que o desenho QUERIA, e ele ja resolve o
     * que a linha tem de resolver: mostrar onde o mundo acaba. O que
     * faltava era ela existir
     *
     * E 8px em `#647064`, as medidas de antes: a cor e a espessura que
     * `src/data/maps/index.js` documenta quando fala da arte ficando
     * fora da linha
     */
    if (map.limiteVisivel && map.bounds) {
      const limite = map.bounds;

      context.save();
      context.strokeStyle = "#647064";
      context.lineWidth = 8;
      context.strokeRect(
        limite.x,
        limite.y,
        limite.width,
        limite.height,
      );
      context.restore();
    }
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
        : (getItem(drop.itemId)?.icon ?? "•"),
      drop.x,
      drop.y + bob,
    );

    context.restore();
  }

  /**
   * O CADAVER AINDA ESTA EM CENA?
   *
   * A condicao e tripla e cada parte existe por um motivo:
   *
   * - `deathTimer > 0` e o relogio. Ele comeca em
   *   `deathDuration + deathFade` quando o bicho morre, e e o que
   *   segura o corpo no lugar depois do golpe
   * - `temMorte` garante que existe arte de morte. Sem o bloco
   *   `death` no layout, o `resolveFrameRect` cairia no `idle` e o
   *   cadaver apareceria DE PE no lugar dele
   * - `!enemy.alive` garante que o vivo nunca entre por aqui. Sem
   *   este, um goblin de pe com `deathTimer` positivo — o que acontece
   *   no quadro entre o `reviveEnemy` e a proxima limpeza — desenharia
   *   a animacao de morte em vez do idle
   *
   * E o unico lugar que decide se o morto aparece, e ele e chamado tanto
   * pela lista de desenho quanto pelo `drawEnemy`, para que os dois
   * concordem sobre quem esta em cena
   */
  eMostrandoCadaver(enemy) {
    if (enemy.alive) return false;
    if (!(enemy.deathTimer > 0)) return false;

    const definition = this.enemySprites.get(enemy.id)?.definition;

    return temMorte(definition);
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

    /**
     * O TEMPO DA MORTE E O PROPRIO RELOGIO, e nao o relogio do mundo.
     *
     * O `spriteTime` do motor e um contador continuo, entao um cadaver
     * cairia no meio de qualquer quadro da animacao de morte: dois
     * goblins mortos no mesmo instante mostrariam quadros diferentes.
     *
     * Aqui o tempo que chega no desenho e o quanto o relogio JA
     * andou, e ele comeca em zero no golpe. E o
     * `resolveDeathElapsed` que trava o tempo no fim do ciclo quando a
     * animacao acaba, e sem esse piso o `resolveFrame` faria o ciclo
     * recomecar e o cadaver voltaria ao primeiro quadro
     */
    const cadaver = this.eMostrandoCadaver(enemy);

    const tempo = cadaver
      ? resolveDeathElapsed(enemy, enemy.deathDuration)
      : this.spriteTime + enemy.spriteOffset;

    const drawn = sheet
      ? sheet.drawCreature(context, enemy, tempo, cadaver)
      : false;

    /**
     * O FUNDO NAO DESCE PARA O CORPO VETORIAL.
     *
     * Todo bicho sem folha cai no corpo desenhado a mao. Esse corpo
     * nao tem animacao de morte, e sem este desvio o cadaver do
     * goblin que ainda nao carregou a imagem apareceria como um boneco
     * de pe, parado, no meio da animacao que sumiria logo depois
     */
    if (!drawn && !cadaver) {
      this.drawEnemyBody(context, enemy);
    }
  }

  /**
   * barra de vida no estilo OSRS: nome, barra e numeros.
   *
   * ## O QUE ELA DESCREVE, E SO ISSO
   *
   * O mob sob o cursor, e NADA mais. Antes eram dois: o do cursor OU o
   * alvo selecionado, e a segunda parte segurava a barra em cima do alvo
   * depois do clique — o jogador clicava num mob e a informacao nao
   * saia de cima dele, so mudava de lugar para o topo da tela
   *
   * Agora sao tres estados, e o terceiro e o que o jogador pediu:
   *
   * - mouse em cima de um mob QUE NAO e o alvo: a barra aparece
   * - mouse em cima do alvo: nada, porque o `target-panel` do topo ja
   *   mostra nivel, barra e HP — os mesmos tres campos
   * - mouse fora de qualquer mob: nada
   *
   * A regra esta em `getInspectedEnemy`, e o desenho aqui nao decide nada:
   * ele so desenha o que aquele metodo devolveu
   */
drawEnemyHpBar(context) {
    const enemy = this.getInspectedEnemy();

    if (!enemy) return;

    /**
     * A PLACA DE VIDA, em UMA LINHA.
     *
     * ## POR QUE CABE TUDO NUMA LINHA SO
     *
     * Antes eram tres: a barra, e abaixo dela uma linha com `Nv.X` a esquerda
     * e `hp / max` a direita, e abaixo ainda os pontos de status. Tres linhas
     * de texto e barra em cima de um boneco ocupavam mais espaco vertical do
     * que o proprio mob
     *
     * Aqui e uma faixa so: o nivel em um numero a esquerda, a barra no meio e
     * o hp a direita. O que mudou nao e o que se mostra — sao as mesmas tres
     * informacoes — e quantas linhas elas ocupam
     *
     * ## E POR QUE O NUMERO DO NIVEL FICA DENTRO DE UM RETANGULO
     *
     * Porque um numero solto na esquerda da barra parece parte do valor do
     * hp: o jogador le "12 ......... 40/80" e nao sabe onde um termina e o
     * outro comeca. O retangulo e o que separa as duas leituras sem texto
     * entre elas
     */
    const definition =
      this.enemySprites.get(enemy.id)?.definition;

    const maxHp = Math.max(1, Math.ceil(enemy.maxHp));
    const hp = Math.max(0, Math.ceil(enemy.hp));
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const level = Math.max(1, Math.round(enemy.level ?? 1));

/**
     * A BARRA TEM LARGURA PROPRIA, e nao a largura do sprite.
     *
     * Antes ela era `Math.max(78, frameWidth * scale)` — a largura do
     * desenho do mob. Um boss de 200px de quadro ganhava uma barra de 200px,
     * e o hp ficava a 200px do nome, longe demais para os dois numeros serem
* lidos como um par
     */
    /**
     * A LARGURA DA PLACA, e ela perdeu 44px nesta versao.
     *
     * ## POR QUE O `wHp` SUMIU
     *
     * Porque o numero do hp foi para DENTRO da barra. A coluna de 44px que
     * existia para hospedar `840/1200` na ponta direita nao tem mais o que
     * segurar, e deixar um vao de 44px vazio no meio da placa faria o nivel
     * e a barra ficarem colados a esquerda de um buraco
     *
     * E a barra CRESCEU de 62 para 84px para compensar: o numero do hp vai
     * ficar em cima dela, e um numero de quatro algarismos precisa de largura
     * para caber com o contorno preto em volta
     */
/**
     * A COLUNA DO NIVEL CRESCEU, PORQUE O NUMERO GANHOU O PREFIXO.
     *
     * Antes eram 20px para caber "12". Sao 34px agora porque o texto e
     * `NV.12`: quatro caracteres a 10px com o contorno de 3px de cada lado.
     * Deixar nos 20 faria o prefixo passar por cima do nome, e os dois textos
     * da linha se encostariam com o "NV." cortado no meio
     */
const wNivel = 34;

    const vao = 6;

    const barWidth = 74;

    /**
     * A PLACA TEM DUAS LINHAS: O PAR (NIVEL E NOME) E A BARRA.
     *
     * ## O QUE O PEDIDO MUDOU
     *
     * Antes era uma faixa so: nivel, barra e hp lado a lado, com o nome
     * ACIMA do nivel e da barra. Agora o nivel e o nome dividem a linha de
     * cima — nivel a ESQUERDA, nome a DIREITA — e a barra desce para baixo
     * dos dois, ocupando a largura inteira da placa
     *
     * ## POR QUE A PLACA FICOU MAIS ESTREITA
     *
     * Porque o pedido foi encurtar: `barWidth` foi de 84 para 74, e a placa
     * saiu de 110px para 100px. A barra e a linha de cima dividem essa largura,
     * entao encurtar `barWidth` encurta a placa inteira sem mexer na posicao
     * do nivel nem na da ponta do nome
     *
     * ## E POR QUE A BARRA FICOU MAIS ALTA
     *
     * Porque 7px de vermelho com uma borda de 2px deixava so 3px de preenchimento
     * visivel — a barra lia como um risco. Agora sao 9px de altura, e o
     * preenchimento enche a borda em vez de encostar nela
     *
     * ## A ALTURA DA PLACA
     *
     * Sao duas linhas: 12px do par de cima + a barra. E `alturaTotal` nao e
     * lida para desenhar a barra — ela serve para o bloco de status que vem
     * DEPOIS, que se apoia nela para saber onde a placa termina
     */
    const hLinha = 16;
    const barHeight = 14;

    /**
     * OS 3px ENTRE A LINHA DE CIMA E A BARRA.
     *
     * Sem eles as duas linhas se encostavam: o contorno preto de 3px do nivel
     * e do nome chegava na borda preta de 2px da barra, e as duas se fundiam
     * num traco so. Com o vao, a barra se lê como uma coisa separada da linha
     * de cima — que e o que o jogador precisa ver para comparar "12, Goblin"
     * com o preenchimento de baixo
     */
    const vaoBarra = 3;

    const larguraTotal = wNivel + vao + barWidth;
    const alturaTotal = hLinha + barHeight;

    const esquerda = enemy.x - larguraTotal / 2;
    /**
     * A PLACA SOBE 18px, E TODA ELA JUNTO.
     *
     * A barra estava em cima do mob: `enemyHeadTop` devolve o topo da arte,
     * que ja e o ponto mais alto do desenho, e a placa comecava 9px ACIMA
     * dele — mas a placa tem 28px de altura, entao 21px dela caíam por cima
     * da cabeca e do tronco
     *
     * O deslocamento e do `topo`, e nao de cada elemento: nivel, nome e barra
     * leem todos a mesma `topo`, entao subir ela sobe o bloco inteiro e
     * mantem o vao de 3px e a borda da barra onde estavam
     */
    const topo = this.enemyHeadTop(enemy) - 27;

    context.save();
    context.textBaseline = "alphabetic";
    context.textAlign = "center";

    /**
     * A PLACA, SEM FUNDO.
     *
     * ## POR QUE NAO TEM `fillRect` NEM `strokeRect`
     *
     * Porque a placa virou so a BARRA. Ela deixou de ser um retangulo com
     * nivel, barra e hp dentro, e passou a ser a barra em si — o nivel esta
     * a esquerda dela e o hp por cima. Desenhar um fundo embaixo seria um
     * retangulo vazio de 110x15px ao redor da barra, e o jogador veria uma
     * caixa que nao guarda nada
     *
     * ## E O QUE SEGURA A LEGIBILIDADE SEM O FUNDO
     *
     * O contorno preto de cada texto. O numero do nivel e o do hp tem
     * `strokeText` antes do `fillText`, e cada um carrega o proprio contorno
     * sobre o que estiver atras — sprite, mapa ou nada. O fundo da placa era
     * redundante com isso: ele protegia o texto em bloco, e o contorno
     * protege letra por letra
     */

    /* ---------------- o nivel ---------------- */

    /**
     * O NIVEL, e ele NAO E DIVIDIDO POR DEZ.
     *
     * ## O QUE ESTAVA AQUI
     *
     * Era `Math.round(level / 10)`, com o piso `Math.max(1, ...)`. A ideia
     * era mostrar as DEZENAS porque a coluna tem 20px e "40" lia melhor que
     * "4", ja que as dezenas sao o que separa um mob fraco de um boss
     *
     * ## POR QUE ISSO VIROU "1" EM TODA PARTE
     *
     * Porque a regra foi escrita para bichos de nivel alto e o mapa tem
     * quase nenhum. O goblin da pedreira vai do nivel 8 ao 12, e o do Campo
     * de Provas e o 7:
     *
     * ```
     *   nivel 7  ->  7 / 10 = 0.7  ->  round = 1  ->  piso = 1
     *   nivel 8  ->  8 / 10 = 0.8  ->  round = 1  ->  piso = 1
     *   nivel 9  ->  9 / 10 = 0.9  ->  round = 1  ->  piso = 1
     *   nivel 12 -> 12 / 10 = 1.2  ->  round = 1  ->  piso = 1
     * ```
     *
     * Todos os onze bichos do mapa 1 estao abaixo do nivel 20, entao TODOS
     * apareciam como 1. O numero nao distinguia nada: era a mesma leitura
     * para o esqueleto de nivel 1 e para o goblin de nivel 12
     *
     * ## POR QUE O NIVEL INTEIRO E O CERTO AGORA
     *
     * Porque e o que o jogador precisa comparar. Ele esta olhando para o
     * mob nao para saber a dezena dele, e sim se aquele e mais forte ou
     * mais fraco que o ultimo. Com o numero inteiro, o goblin de nivel 7 do
     * Campo de Provas e o de nivel 12 da floresta se distinguem na placa
     *
     * E cabe em 20px: sao dois algarismos a 10px de fonte, e o `strokeText`
     * com `lineWidth: 3` e o contorno preto que garante a leitura sobre o
     * sprite, entao nao ha o que se perder
     */
    const nivelCurto = `NV.${level}`;

    context.font = "700 10px Inter, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    /**
     * O NIVEL NA PONTA ESQUERDA DA LINHA DE CIMA.
     *
     * E o centro dos `wNivel` de 34px, e nao mais o centro da placa. Com o
     * nome a direita e a barra embaixo, o numero fica sozinho no canto
     * esquerdo do par — e o `center` evita que ele cole na borda
     */
    const nivelCentro = esquerda + wNivel / 2;

    const nivelBase = topo + 12;

    context.lineWidth = 3;
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0, 0, 0, 0.92)";
    context.strokeText(nivelCurto, nivelCentro, nivelBase);

    context.fillStyle = "#e5bb68";
    context.fillText(nivelCurto, nivelCentro, nivelBase);

    /* ---------------- a barra ---------------- */

    /**
     * A BARRA DESCE PARA DEPOIS DO NIVEL E DO NOME.
     *
     * `yBarra` e `topo + hLinha`: a linha de cima tem 12px, e a barra comeca
     * logo abaixo dela. Ela ocupa a largura INTEIRA da placa, e nao so os
     * `barWidth`: o nome esta na direita agora, entao a barra precisa
     * passar por baixo dos dois para nao ficar um vao vazio embaixo do nome
     */
    const xBarra = esquerda;
    const yBarra = topo + hLinha + vaoBarra;

    /**
     * O FUNIL DA BARRA, desenhado ANTES do preenchimento.
     *
     * Porque e o fundo que o preenchimento corta. Um fundo so no
     * `fillStyle` do preenchimento deixaria a parte vazia transparente e o
     * boneco apareceria dentro da barra
     */
    context.fillStyle = "#1a1410";
    context.fillRect(xBarra, yBarra, larguraTotal, barHeight);

    if (ratio > 0) {
      /**
       * O VERMELHO VIVO, e nao um vermelho de tom.
       *
       * ## POR QUE `#FF0000` E NAO UM TOM ESCURIDO
       *
       * Porque era esse o pedido, e o vermelho puro e o que o jogador
       * associou a vida em todo MMORPG: ele le "vermelha = perigo" sem
       * traduzir nada
       *
       * ## E O BRILHO DE CIMA, que o vermelho puro sozocoa
       *
       * Porque `#FF0000` puro e chapado: um retangulo de 7px de altura em cor
       * pura parece um bloco de tinta. A faixa clara de 2px no topo e o que da
       * volume e a sensacao de liquido, e e ela que impede a barra de virar
       * um quadrado chapado
       */
      context.fillStyle = "#ff0000";
      context.fillRect(xBarra, yBarra, larguraTotal * ratio, barHeight);

      /**
       * O BRILHO DO TOPO, e sao 2px.
       *
       * E branco puro e nao o `rgba(255,255,255,0.2)` de antes: sobre o
       * vermelho puro, um branco a 20% ficava rosa-claro e nao lia como
       * reflexo. O branco de verdade e o que produz o brilho
       */
      context.fillStyle = "rgba(255, 255, 255, 0.45)";
      context.fillRect(xBarra, yBarra, larguraTotal * ratio, 2);
    }

    /**
     * A BORDA PRETA DA BARRA, e ela fecha a placa.
     *
     * ## POR QUE PRETA E NAO DA COR DO FUNIL
     *
     * Porque o funil e `#1a1410`, um marrom quase igual ao mapa do vale. A
     * barra vazia sumia no chao e o jogador perdia de vista onde ela acaba.
     * O preto e o unico traço que se destaca de qualquer mapa do jogo
     *
     * ## E POR QUE O DESLOCAMENTO E A METADE DA ESPESSURA
     *
     * Porque em pixel inteiro o `strokeRect` cai entre dois pixels e o
     * navegador o pinta em dois tons, deixando a borda falha. O deslocamento
     * de meia espessura joga a linha no centro dos pixels, e ela sai cheia —
     * e ele precisa acompanhar a espessura: com 2px de borda o
     * deslocamento e 1, e nao mais 0.5, senao a borda de cima encosta no
     * pixel de cima e a de baixo nao fecha
     *
     * ## E POR QUE ELA VEM DEPOIS DO BRILHO
     *
     * Porque o `strokeRect` escreve em cima. Desenhado antes, o brilho de 2px
     * do topo cobriria a borda no trecho preenchido e a barra perderia o
     * contorno justamente onde tem cor embaixo
     */
    const borda = 2;

    context.lineWidth = borda;
    context.strokeStyle = "#000000";
    context.strokeRect(
      xBarra + borda / 2,
      yBarra + borda / 2,
      larguraTotal - borda,
      barHeight - borda,
    );

    /**
 * O HP DENTRO DA BARRA, e nao na ponta dela.
 *
 * ## POR QUE O NUMERO SAI DA COLUNA DE 44px
 *
 * Porque ele estava la para nao cobrir o preenchimento, e essa e a razao
 * errada: o numero da vida e a informacao mais importante da placa, e ele
 * ficava na posicao mais不易 de ler — na ponta direita, sobre fundo escuro
 * quando a barra esta cheia, e sobre o preenchimento quando ela esta
 * quase vazia, o que e o oposto de quando o jogador precisa do numero
 *
 * ## E POR QUE ISSO E O QUE TODO MMORPG FAZ
 *
 * Porque e o padrao aprendido: o numero vive DENTRO da barra e a barra
 * cresce por tras dele. O jogador le "1200" no meio e o preenche como o
 * fundo, e nao precisa ir ate a ponta
 *
 * ## E O QUE RESOLVE O COLISOR DE TEXTO
 *
 * A barra e o fundo, e o preenchimento passa por baixo. Por isso a
 * legibilidade vem do CONTORNO preto do texto e nao de escolher uma cor
 * clara ou escura: o contorno garante contraste nas duas metades, cheia e
 * vazia, e o numero pode ficar creme em qualquer uma delas
 */
    context.font = "700 10px Inter, sans-serif";
    context.textAlign = "center";

    /**
     * O NUMERO com o contorno, e o preenchimento por baixo.
     *
     * E nesta ordem de proposito: o `strokeText` antes do `fillText` faz o
     * contorno nao comer a propria letra, e o preenchimento depois faz o
     * numero ficar por cima da barra colorida. Invertido, o numero fica
     * atras da barra e some
     */
    const hpCentro = xBarra + larguraTotal / 2;

    /**
     * A BASE DO HP, e ela e o CENTRO DA BARRA MAIS A METADE DA FONTE.
     *
     * ## POR QUE NAO E `yBarra + barHeight - 1.5`
     *
     * Porque essa conta gruda o texto na BORDA de baixo. Com a barra em 14px,
     * ela punha a base 12.5px abaixo do topo, e o texto — que tem 10px de
     * altura e cerca de 7px acima da base — aparecia de y+5 a y+12, deixando
     * 2px vazios em cima e nenhum embaixo. O jogador lia o numero "afundado"
     * na barra
     *
     * ## POR QUE `+ 3.5`, E NAO `+ 5`
     *
     * Porque `textBaseline` e `alphabetic`: a base e o pe do texto, e o olho
     * le o meio do glifo, nao a base. Uma fonte de 10px tem cerca de 3.5px de
     * altura visivel ACIMA da base, e e isso que o `+ 3.5` empurra para
     * baixo. Somar a altura inteira da fonte desceria o numero mais 1.5px
     *
     * E a conta e escrita em `barHeight / 2` para o texto continuar no centro
     * se a barra mudar de altura de novo
     */
    const hpBase = yBarra + barHeight / 2 + 3.5;

    /**
     * `atual / maximo`, e nao so o atual.
     *
     * Porque "840" sozinho nao diz se o mob esta quase morto ou quase
     * inteiro: um goblin com 840 de 1200 e um boss com 840 de 840 sao o
     * MESMO numero. O maximo e o que da a escala, e a barra sozinha e uma
     * leitura visual que o jogador teria de converter de cabeca
     */
    const hpTexto = `${hp}/${maxHp}`;

    context.lineWidth = 3;
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0, 0, 0, 0.92)";
    context.strokeText(hpTexto, hpCentro, hpBase);

    context.fillStyle = "#f4ece0";
    context.fillText(hpTexto, hpCentro, hpBase);

    /* ---------------- o hp ---------------- */

    /**
     * A TAG DO JOGADOR, acima do nome.
     *
     * ## POR QUE SO AQUI E NAO EM TODO LUGAR
     *
     * Porque a placa fixa — a de `drawNomeDeRemoto` — ja desenha a tag, e
     * ela sai de cena quando o jogador aponta para o boneco. Nao ha por que
     * repetir a tag em duas linhas diferentes: aqui e a MESMA informacao,
     * no lugar que a placa liberou
     *
     * ## E POR QUE NAO NA PLACA
     *
     * Porque a placa se apaga. Se a tag ficasse so aqui, o boneco ficaria
     * sem identificacao alguma quando o mouse estivesse em cima — e o
     * jogador nao saberia de quem e a barra que acabou de aparecer
     *
     * ## A POSICAO
     *
     * E `topo - 4`, e nao mais `top - 20` da versao antiga: a placa ficou
     * 13px mais baixa, entao o texto inteiro subiu junto. O nome fica em
     * `topo - 17` e a tag em `topo - 30`, com os dois textos de 10-11px e
     * 3px de folga entre eles
     */
    if (enemy.isRemote && enemy.guilda?.tag) {
      const texto = `[${enemy.guilda.tag}]`;

      context.font = "700 10px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.lineWidth = 3;

      /**
       * O MESMO CONTORNO do nome logo abaixo, e pela MESMA razao: o texto
       * passa por cima de qualquer sprite, e um sem contorno vira um borrão
       * em cima de um boneco claro
       */
      context.strokeStyle = "rgba(0,0,0,0.85)";
      context.strokeText(texto, hpCentro, topo - 3);

      context.fillStyle = enemy.guilda.cor ?? "#e5bb68";
      context.fillText(texto, hpCentro, topo - 3);
    }

    /**
     * O NOME DE QUEM ESTA SENDO APONTADO, remoto ou mob.
     *
     * Para o remoto, e o mesmo nome da placa que sumiu acima — entao o que
     * o jogador ve no hover e a MESMA informacao que ele via parado, so que
     * com a barra de vida em vez da placa
     */
    /**
     * O NOME, no MESMO eixo da barra.
     *
     * ## POR QUE `centroDoTexto` E NAO `enemy.x`
     *
     * Porque o chip de nivel ocupa os 20px da esquerda da placa, e empurra a
     * barra 26px para a direita do boneco: o centro dela fica em `enemy.x + 13`.
     * Com o nome em `enemy.x`, ele ficava 13px a esquerda do centro da barra
     * que esta logo abaixo dele — dois textos que o jogador le como um bloco
     *so, desalinhados dentro dele
     *
     * E o `hpCentro` ja e exatamente isso: o centro da barra. O numero do
     * hp, o nome e a tag passam a dividir a mesma coluna, e o chip de nivel
     * fica ao lado como uma etiqueta em vez de puxar o bloco para a direita
     */
    context.font = "700 11px Inter, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "alphabetic";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0,0,0,0.85)";

    /**
     * O NOME ALINHADO A DIREITA, na ponta da linha de cima.
     *
     * E o `right` com a borda direita da placa como ancora: o nome acaba
     * encostado nela e cresce para a esquerda ate encontrar o numero do
     * nivel. E o que faz o bloco ler como "12 .... Goblin da Pedreira" em vez
     * de dois textos soltos com um vao no meio
     *
     * Com `center` o nome ficaria no meio da placa e o nivel na esquerda, com
     * um buraco entre os dois que parece erro de alinhamento. Alinhar os dois
     * pelas pontas opposite e o que fecha a linha
     */
    const nomeDireita = esquerda + larguraTotal;

    const nomeBase = topo + 12;

    context.strokeText(enemy.name, nomeDireita, nomeBase);
    context.fillStyle = "#f0e6d2";
    context.fillText(enemy.name, nomeDireita, nomeBase);

    /**
     * OS EFEITOS DE STATUS.
     *
     * ## POR QUE O `?? []` E OBRIGATORIO AQUI
     *
     * Porque um jogador REMOTO nao tem `statusEffects`. O `criarRemoto`
     * monta o objeto com os campos que o desenho do boneco usa, e esse nao
     * estava entre eles — o `enemy.statusEffects.length` estourava com
     * `Cannot read properties of undefined` toda vez que o jogador passava o
     * mouse sobre outro jogador, e o resto do quadro nao era desenhado
     *
     * E o `?? []` e nao um array fixo no `criarRemoto`: o remoto nao tem
     * efeito nenhum, e um array vazio aqui e a representacao correta disso
     *
     * ## E POR QUE FICAM ABAIXO DA PLACA, e nao dentro dela
     *
     * Porque sao ate quatro, e quatro pontos dentro de 15px de altura nao
     * cabem sem encolher a barra. A linha de baixo e o que mantem a placa
     * compacta
     */
    const efeitos = enemy.statusEffects ?? [];
    const dots = Math.min(4, efeitos.length);

    for (let index = 0; index < dots; index += 1) {
      const effect = efeitos[index];

      context.fillStyle = this.getStatusColor(effect.type);

      context.beginPath();
      context.arc(
        enemy.x - (dots - 1) * 5 + index * 10,
        topo + alturaTotal + 6,
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

        /**
         * A IDADE, com o mesmo motivo do projetil do jogador: e o tempo que a
         * arte do tiro usa para escolher o quadro, e ela nao pode sair do
         * `remaining` que o `updateProjectiles` decrementa
         */
        age: 0,

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

        /**
         * A FLECHA DO ARBALIST, COM ARTE.
         *
         * E o primeiro `if` porque e o caso com imagem: as classes abaixo
         * continuam no vetorial, e nenhuma delas tem folha de tiro
         *
         * ## POR QUE UM QUADRO DA FOLHA E NAO A FOLHA INTEIRA
         *
         * Porque o tiro e um INSTANTE, e a arte do rastro dura uma fração de
         * segundo. Desenhar a folha inteira faria o jogador ver os oito
         * quadros sobrepostos ao mesmo tempo — o rastro viraria um borrão
         * verde em vez de uma flecha
         *
         * ## POR QUE O QUADRO SAI DO TEMPO DO PROJETIL E NAO DO GLOBO
         *
         * Porque o projetil atravessa a tela em cerca de meio segundo, e a
         * arte dura 0,64s. Se o quadro viesse do tempo do projetil, a flecha
         * mostraria so os primeiros quadros e o rastro nunca cresceria — que e
         * justamente a metade da animacao
         */
        if (style === "arrow" && this.flechaSprite?.complete) {
          const quadro = this.drawFlechaArbalista(
            context,
            projectile,
            color,
          );

          if (quadro) {
            context.restore();

            continue;
          }
        }

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

  /**
   * Desenha UM QUADRO da folha da flecha, no ponto do projetil.
   *
   * Devolve `false` sem desenhar nada quando a arte nao esta pronta, para
   * quem chamou cair no tiro vetorial. Esse e o caminho que mantem o jogo
   * jogavel no primeiro quadro depois do load: a imagem ainda esta baixando e
   * o tiro continua saindo, so que no estilo antigo
   */
  drawFlechaArbalista(context, projectile, color) {
    const arte = this.flechaSprite;

    if (!arte?.complete || !arte.naturalWidth) return false;

    /**
     * A ACAO DO TIRO, e nao a do sprite.
     *
     * O efeito de velocidade pertence a `Quick Shot`, nao a arte da flecha: as
     * outras duas flechas do arquiro usam a MESMA imagem e nao podem esticar.
     * Ler `projectile.action` e o que separa as duas coisas
     */
    const action = projectile.action ?? {};

    const { frameWidth, frameHeight, frames, fps, anchorX, anchorY, scale } =
      ARBALIST_FLECHA;

    /**
     * O TEMPO DA FLECHA, e nao o do projetil.
     *
     * O `projectile.age` cresce enquanto ele voa e zera quando nasce. Como o
     * rastro e uma animacao de um ciclo so, ele e a leitura direta do quadro:
     * o primeiro quadro e o rastro pequeno e o ultimo e o rastro cheio
     */
    const tempo = Math.max(0, projectile.age ?? 0);

    const quadro = Math.min(
      frames - 1,
      Math.floor(tempo * fps) % frames,
    );

    /**
     * O ESTICAMENTO DO TIRO RAPIDO.
     *
     * E o que faz a flecha parecer ANDAR em vez de deslizar. Uma seta rapida
     * em movimento real aparece alongada na direcao do curso, e o game
     * comunica isso de um jeito so: esticando no eixo do tiro
     *
     * ## POR QUE SO NO EIXO DO TIRO
     *
     * O `context` ja esta girado pelo `atan2` do projetil antes de chegar
     * aqui. Então o eixo X do canvas JA e a direcao da flecha, e esticar em X
     * alonga no sentido do movimento sem nenhuma conta de angulo
     *
     * ## POR QUE `1 + chegada` E NAO UM NUMERO FIXO
     *
     * Porque um tiro que nasceu nao deve parecer rapido. O efeito cresce nos
     * primeiros `CHEGADA_EM` segundos e depois assenta em `FATOR`, e o que o
     * jogador ve e a flecha acelerando ao sair da mao — que e exatamente o que
     * `projectileSpeed` faz no jogo
     */
    const CHEGADA_EM = 0.09;
    const FATOR = 1.45;

    const chegada = Math.min(1, tempo / CHEGADA_EM);

    const estica = action.speedEffect
      ? 1 + (FATOR - 1) * chegada
      : 1;

    const largura = frameWidth * scale * estica;
    const altura = frameHeight * scale;

    /**
     * OS RISCOS DE VELOCIDADE, ATRAS DA FLECHA.
     *
     * ## POR QUE DESENHADOS ANTES DA ARTE
     *
     * Porque eles sao o QUE FICOU ATRAS. Desenhados depois, ficariam por cima
     * da flecha e pareceriam um arranhao
     *
     * ## POR QUE SAO LINHAS E NAO MAIS QUADROS DA FOLHA
     *
     * Porque a folha tem UM quadro agora. E um efeito de velocidade precisa ser
     * continuo nao-vetor — linhas finas e baratas, sem textura nova
     *
     * ## POR QUE A COR VEM DA ACAO
     *
     * Porque a `Quick Shot` e a unica com o efeito, e a cor dela e o verde do
     * arqueiro. Um branco fixo destoaria do resto do tiro
     */
    if (action.speedEffect) {
      const comprimento = largura * 1.1;

      context.strokeStyle = color;
      context.globalAlpha = 0.5 * chegada;
      context.lineWidth = Math.max(1, altura * 0.16);

      context.beginPath();

      /* tres riscos atras da flecha: um no eixo e dois deslocados, que e o
         que da volume. O `x0` e a traseira do corpo desenhado, e `x1` e onde
         o risco começa a sumir */
      const x0 = -anchorX * scale;

      for (const deslocamento of [-0.42, 0, 0.42]) {
        const y = deslocamento * altura;

        context.moveTo(x0 - comprimento, y);
        context.lineTo(x0, y);
      }

      context.stroke();

      context.globalAlpha = 1;
    }

    context.drawImage(
      arte,
      quadro * frameWidth,
      0,
      frameWidth,
      frameHeight,

      // o canto de cima esquerdo da arte, alinhado no ponto que voa
      -anchorX * scale,
      -anchorY * scale,
      largura,
      altura,
    );

    /**
     * O BRILHO DO RASTRO, e nao da arte.
     *
     * O rastro verde ja vem pintado no PNG. Esta sombra e o que separa a
     * flecha do fundo quando ela passa por cima de um mob de cor parecida, e
     * ela usa a cor da ACAO — a mesma que o tiro vetorial usava — para o
     * efeito combinar com o resto
     */
    context.shadowColor = color;
    context.shadowBlur = 18;

    return true;
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

    /**
     * A PLACA DE NOME, DEPOIS do `restore`.
     *
     * Porque o `restore` fecha o `save` que aplicava o `globalAlpha` do
     * cloaking: dentro dele a placa sairia a 45% de opacidade junto com o
     * boneco, e o jogador veria a propria tag apagada enquanto estava
     * invisivel — que e o oposto do que o cloaking deveria fazer
     */
    this.drawNomeDoLocal(context);

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
     * A mira e desenhada em COORDENADA DE TELA, colada no ponteiro, e
     * nao e a arte do cursor do navegador: sao duas coisas diferentes que
     * o jogador ve no mesmo pixel. Trocar o cursor para a mao de armadura
     * nao tirou nada, porque esta continua aparecendo por cima
     *
     * E o lugar dela e o mesmo do golpe: onde nao ha combate, nao ha o
     * que mirar. Um reticulo de alvo desenhado no hub seria a mesma
     * promessa que a mira de combate fazia — "aqui e um alvo" — sem
     * nenhum alvo possivel
     *
     * E por isso que o portao e o `emZonaDeCombate`, o MESMO metodo que
     * barra o `useBasicAttack`: a regra de "onde tem mira" e a regra de
     * "onde tem golpe", e nao uma lista de mapas. Um mapa novo entra na
     * mira pelo padrao, e a base fica sem mira sem ninguem mexer nela
     */
    if (!this.emZonaDeCombate()) return;

    /**
     * SEM IMAGEM CARREGADA, NAO HÁ O QUE DESENHAR.
     *
     * Sem este `return`, o `drawImage` abaixo seria chamado com `null` nos
     * primeiros quadros, que sao exatamente os quadros em que o jogador
     * entra no vale
     */
    if (!this.mira || !this.mira.complete || !this.mira.naturalWidth) {
      return;
    }

    const screenX =
      this.input.pointer.x -
      this.world.player.x +
      this.viewport.width / 2;

    const screenY =
      this.input.pointer.y -
      this.world.player.y +
      this.viewport.height / 2;

    /**
     * A arte e um PNG de 1254x1254 e entra no `dist` com 1,1 MB. O
     * `drawImage` recebe o LADO, nao a largura: e o retangulo de destino
     * quadrado de `MIRA_TAMANHO`, e ele cobre o que sobrar da proporcao
     * original
     */
    const half = MIRA_TAMANHO / 2;

    context.save();
    context.drawImage(
      this.mira,
      screenX - half + MIRA_OFFSET.x,
      screenY - half + MIRA_OFFSET.y,
      MIRA_TAMANHO,
      MIRA_TAMANHO,
    );
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
