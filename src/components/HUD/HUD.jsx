import { useCallback, useEffect, useMemo, useState } from "react";
import SkillSlot from "../Skills/SkillSlot.jsx";
import HudIcon from "../UI/HudIcon.jsx";
import InventoryPanel from "../Inventory/InventoryPanel.jsx";
import QuestPanel from "../Quests/QuestPanel.jsx";
import PartyBox from "./PartyBox.jsx";
import CodexPanel from "../Codex/CodexPanel.jsx";
import RankingPanel from "../Rank/RankingPanel.jsx";
import CraftPanel from "../Craft/CraftPanel.jsx";
import CollectionPanel, {
  StatusPanel,
} from "../Collection/CollectionPanel.jsx";
import EnchantPanel, {
  chave,
} from "../Enchant/EnchantPanel.jsx";
import MarketModal from "../Market/MarketModal.jsx";
import PotionPanel from "../Potions/PotionPanel.jsx";
import HabilidadesPanel from "../Skills/HabilidadesPanel.jsx";
import BauPanel from "../Inventory/BauPanel.jsx";
import ConfigPanel from "../Settings/ConfigPanel.jsx";
import KeyBindsPanel from "../UI/KeyBindsPanel.jsx";
import IndicativoTecla, { useTeclaDaAcao } from "../UI/IndicativoTecla.jsx";
import ItemIcon from "../UI/ItemIcon.jsx";
import { ROTULO_DO_PAINEL as ROTULO_DO_PAINEL_DA_BOX } from "../Quests/QuestPanel.jsx";
import {
  ICONE_SLOT_DIREITA,
} from "../../data/cursor/index.js";
import { useArrastoSlot } from "../UI/useArrastoSlot.js";
import { getItem } from "../../data/items/index.js";
import { AUTO_POCAO_LIMIAR_PADRAO } from "../../data/potions/index.js";

/**
 * O ICONE DO TIRO RAPIDO, ao lado da primeira skill.
 *
 * ## POR QUE O `new URL` AQUI E NAO NO `hudIcons.js`
 *
 * Porque ele nao e um icone de PAINEL. O `hudIcons.js` e a lista dos
 * botoes que ABREM uma tela — bestiario, mercado, craft — e cada um deles
 * precisa de id, glifo de reserva e nome de arquivo, porque o `HUDIcon`
 * procura por id e precisa saber o que mostrar quando a arte nao vier
 *
 * Este nao abre nada. E um desenho de apoio na barra de skills: o mesmo
 * botao de tiro, do jeito que o jogador ve no inventario. Nao tem id, nao
 * tem glifo e nao tem onde faltar — se o arquivo sumir, o `img` fica com o
 * `src` quebrado e some, e a barra volta a ser so os slots. O
 * `HUD_ICON_IDS` gaining uma entrada para ele faria o `hudIcons.test.js`
 * exigir um painel que nao existe
 *
 * O caminho e literal pelo mesmo motivo de sempre: e o Vite que so empacota
 * o `new URL` com caminho escrito por extenso
 */
const SHOT_ICON_URL = new URL(
  "../../assets/icons/icon_shot.png",
  import.meta.url,
).href;

/**
 * O ICONE DO BOTAO DE AUTO.
 *
 * ## POR QUE A PALAVRA "auto" SUMIU
 *
 * Porque quatro letras dentro de um circulo de 36px ficam ilegiveis: o
 * jogador tinha que saber ler para saber o que o botao faz, e o botao e
 * "ligar e deixar o jogo jogar por mim" — que e o que um icone diz sem
 * traducao
 *
 * ## E POR QUE O CAMINHO E LITERAL
 *
 * O mesmo motivo do `SHOT_ICON_URL` acima: e o Vite que so empacota o
 * `new URL` com caminho escrito por extenso. Um `import auto from
 * "../../assets/icons/auto.png"` passaria pelo Vite tambem, mas as duas
 * forms nao convivem no mesmo arquivo, e o `new URL` ja estava aqui
 */
const AUTO_ICON_URL = new URL(
  "../../assets/icons/auto.png",
  import.meta.url,
).href;

/*
 * O painel de desempenho do servidor esta commented no corpo do `HUD`,
 * junto com o motivo. O import volta na mesma hora em que ele.
 *
 * While commented, o ESLint nao reclama de import sem uso porque este
 * NAO e um import: e um bloco de comentario. O `ServerPerf.jsx`
 * continua existindo e continua com o mesmo nome.
 */
import GuildPanel from "../Guild/GuildPanel.jsx";
import PortalBox from "./PortalBox.jsx";
import TravelBox from "./TravelBox.jsx";
import DeathPanel from "./DeathPanel.jsx";
import MineracaoPanel from "../Mineracao/MineracaoPanel.jsx";
import PassePanel from "../Pass/PassePanel.jsx";
import LojaPanel from "../Shop/LojaPanel.jsx";

import {
  MINIMAP_HEIGHT,
  MINIMAP_LEFT,
  MINIMAP_TOP_IDLE,
  MINIMAP_WIDTH,
} from "../../game/ui/minimap.js";
import { DEFAULT_LOOT_FILTER } from "../../game/loot/lootFilter.js";
import { digitandoEm } from "../../game/ui/typing.js";

/**
 * O ID DA ARENA, para o botao saber se o clique entra ou sai.
 *
 * Vem do registro de mapas e nao de um literal aqui: o mesmo id e usado
 * pelo servidor para escolher o destino, e um `const` solto no HUD
 * permitiria que um deles mudasse sem o outro
 */
import {
  ARENA_ID,
  MAP_TESTE_ID,
  findMap,
} from "../../data/maps/index.js";
import { CREATURE_TYPES } from "../../data/enemies/index.js";
import { NPC_ACAO } from "../../data/npc/index.js";
import OfflineFarmModal from "../Farm/OfflineFarmModal.jsx";

/**
 * Os paineis da HUD, e UM so por vez.
 *
 * Antes cada painel tinha o seu `boolean` e cada botao fechava na mao
 * dois ou tres dos outros: o do bestiario fechava o rank, o da colecao
 * fechava o rank e o bestiario, o do craft fechava o market. Duas
 * consequencias: a lista de fechamentos estava sempre incompleta —
 * bestiario + colecao abertos pelo TECLADO ficavam empilhados, porque
 * os atalhos nao fechavam nada — e cada painel novo exigia lembrar de
 * fechar os outros em todo lugar.
 *
 * Com UM estado so, a exclusivity vem da propria forma: abrir e
 * atribuir, e nao ligar um `true` ao lado de outro. Nao existe
 * combinacao de dois paineis abertos para representer, entao nao existe
 * lista de fechamentos para esquecer
 *
 * O `null` e "nenhum aberto", e `alternarPainel` continua sendo o
 * botao e a tecla: clicar no botao do painel que ja esta aberto
 * fecha
 */
/**
 * QUANTO TEMPO A MOEDA ESPERA PARA VOLTAR.
 *
 * E o tempo entre o alvo sumir e a moeda reaparecer no alto central.
 * Dois segundos porque e o intervalo tipico entre matar um bicho e mirar
 * o proximo numa fila de cacada: menos que isso e a tela pisca a cada
 * morte, mais que isso e o jogador fica sem saber quanto tem
 */
const MOEDAS_VOLTAM_EM_MS = 2000;

const PAINEL = {
  INVENTARIO: "inventario",
  MISSOES: "missoes",
  BESTIARIO: "bestiary",
  RANK: "rank",
  CRAFT: "craft",
  COLECAO: "collection",
  STATUS: "status",
  ENCHANT: "enchant",
  MARKET: "market",
  GUILD: "guild",

  /**
   * A LOJA DO MERCADOR.
   *
   * Separate do `MARKET` de proposito. `MARKET` e o mercado entre
   * jogadores, que e de oferta e proposta; a loja e um catalogo que o
   * mercador vende. Sao dois paineis com dois sentidos, e um botao que
   * abre o errado mostra o jogo inteiro vazio
   *
   * Nao tem tecla. A loja se abre pelo clique no NPC, e nao por atalho:
   * nenhum outro painel do jogo depende de estar perto de uma coisa, e
   * esta precisa. Um atalho abriria uma loja de um NPC que pode estar
   * em outro mapa
   */
  POCOES: "pocoes",

  /**
   * A LOJA, que abre pelo botao da prateleira em vez de pelo NPC.
   *
   * ## POR QUE ESTA E A `POCOES` NAO AO REVES
   *
   * Porque sao coisas diferentes. A `POCOES` e a LOJA DO MERCADOR: o
   * catalogo de pocoes que ele vende em cima do balcao, e ela so abre
   * com ele na tela porque o balcao e dele
   *
   * Esta e a loja GERAL: o lugar onde o jogador compra o que o jogo
   * vende, sem depender de estar perto de ninguem. E a diferenca que
   * justifica o botao — umatalho ou uma vitrine que so aparece com o
   * NPC em frente e um lugar que o jogador procura quando nao esta com
   * o mercador a vista
   *
   * O painel nasce VAZIO, sem catalogo e sem preco, porque nada disso
   * foi decidido. Vazio e honesto; um painel com meia duzia de itens
   * escritos a mao seria um catalogo falso que o jogador leria como
   * verdade
   */
  LOJA: "loja",

  /**
   * O PASSE.
   *
   * Sem tecla por enquanto. Os paineis com tecla sao os que o jogador abre
   * varias vezes por sessao, e o passe vai ser consultado uma vez por
   * temporada — dar uma tecla a ele tira uma letra das que o `GameEngine`
   * le para andar ou de atirar. Quando ele tiver conteudo e passar a ser
   * consultado assim que o jogador entra, a tecla entra junto
   */
  PASSE: "passe",

  /**
   * A CONFIGURACAO, o painel que a engrenagem da prateleira abre.
   *
   * ## POR QUE ELA EXISTE SENDO QUE A ENGRENAGEM JA ABRI O PAUSE
   *
   * Porque sao coisas diferentes. O pause e sobre o PERSONAGEM: sair, ou
   * continuar. A configuracao e sobre o JOGO que roda em volta: volume,
   * tela cheia, resolucao. O pause virou o lugar errado para as duas coisas,
   * e o painel de configuracao que nao existia era a razao de a engrenagem
   * nao ter onde levar o jogador
   *
   * ## POR QUE A ESC CONTINUA SENDO DO PAUSE, E NAO DESTE
   *
   * Porque a ESC e a saida de emergencia. O jogador que aperta ESC no meio
   * de uma cacada quer sair do personagem, nao abrir um menu para mudar o
   * volume. Um painel de configuracao que toma a ESC seria aberto sem o
   * jogador pedir, e a primeira opcao dele seria fechar o painel
   *
   * ## SEM TECLA
   *
   * Como o passe: as teclas sao para o que o jogador abre varias vezes por
   * sessao, e as opcoes de tela e audio sao para quando algo esta errado.
   * Nenhuma letra do `GameEngine` entra aqui
   */
  CONFIG: "config",

  /**
   * O PAINEL DE HABILIDADES, do mestre da base.
   *
   * Nao tem tecla, como a loja do mercador: os dois abrem por clique no
   * NPC, e nenhum outro painel do jogo depende de o jogador estar perto
   * de uma coisa. Um painel preso a um NPC e um painel que ninguem
   * encontra
   */
  HABILIDADES: "habilidades",

  /**
   * O PAINEL DO BAU, do bau da base.
   *
   * Sem tecla, como os dois anteriores: ele so existe para quem esta de
   * pe em frente ao bau. Um atalho abriria o bau de qualquer mapa, e o
   * baU de outro mapa nao e o mesmo baU — a leitura de "guardar coisas
   * aqui" quebraria
   */
  BAU: "bau",
};

/**
 * A tecla de cada painel.
 *
 * O mapa e declarado aqui, e nao espalhado em `if` dentro do
 * `keydown`, porque e ele que garante que a tecla e o botao cheguem ao
 * MESMO lugar: um `if (event.code === "KeyB")` ao lado de um `onClick`
 * do botao sao dois lugares para lembrar quando um painel entra
 */
const ATALHO_PAINEL = {
  KeyI: PAINEL.INVENTARIO,
  KeyQ: PAINEL.MISSOES,
  KeyB: PAINEL.BESTIARIO,
  KeyC: PAINEL.CRAFT,

  /**
   * O RANK FOI PARA O `L`, E O `R` VOLTOU PARA A ULTIMATE.
   *
   * ## O QUE ESTAVA ACONTECENDO
   *
   * A `R` estava em DUAS listas ao mesmo tempo: aqui como painel, e no
   * `keybinds` como `ultimate`. Os dois `keydown` estao na `window` e nenhum
   * dos dois chama `stopImmediatePropagation`, entao um aperto de `R` fazia as
   * DUAS coisas: a ultimate saia e o rank abria por cima
   *
   * ## POR QUE O JOGADOR SO VIU AGORA
   *
   * A colisao e antiga — a `R` da ultimate veio antes do painel de teclas. O
   * que mudou e que agora existe UM lugar que responde por todas as teclas,
   * e ele mostrou que duas actions estavam disputando a mesma
   *
   * ## E POR QUE `L`, E NAO OUTRA LETRA
   *
   * Porque `L` e de "leaderboard", que e o nome que o painel inteiro
   * classement usa. Perde-se a mnemonica do `R` de "rank", e ganha-se uma
   * tecla que significa a mesma coisa em qualquer jogo de classificacao
   *
   * ## E POR QUE NAO `N`, `V`, `F` OU `Z`
   *
   * Porque sao as letras que sobram para quando aparecer um painel novo, e
   * um painel novo colado no `L` seria pior do que este aqui. `KeyL` nao e
   * usada por nenhuma acao do `keybinds`, nem pelo motor, nem pelo `GameCanvas`
   */
  KeyL: PAINEL.RANK,

  // A colecao ficou em K. As teclas livres antes eram I, Q, B, R, C e
  // T, e K nao e usada por nenhuma outra acao nem pelo `GameCanvas`
  KeyK: PAINEL.COLECAO,

  /**
   * O status e a `P`.
   *
   * Era a `S`, e a `S` e uma das quatro de MOVIMENTO: o `GameEngine`
   * le `keys.has("KeyS")` para andar para baixo, e o `intent.js` do
   * online le a mesma tecla. O `keydown` desta HUD esta no `window` e
   * nao chama `preventDefault`, entao as duas coisas aconteciam no
   * mesmo aperto: o painel abria E o personagem andava para baixo, e
   * o jogador achava que o painel tinha comido o movimento
   *
   * E por isso que o painel nao pode ficar em W, A, S ou D: sao as
   * quatro de andar, e as setas tem o mesmo papel. A `P` nao e usada
   * por nenhuma outra acao do jogo
   */
  KeyP: PAINEL.STATUS,

  // O encantamento. `KeyT` ja era do AUTO PLAY, entao ficou em `KeyX`:
  // o auto e o T do "turn on" e mover a tecla dele seria trocar um
  // atalho que o jogador ja usa por um painel vazio
  KeyX: PAINEL.ENCHANT,

  /**
   * A GUILDA, no `G` logo depois do `X` do Encantar.
   *
   * A tecla e ao lado do botao de proposito: sao os dois paineis que
   * mudam o STAT do personagem, entao ficam vizinhos na barra e
   * vizinhos no teclado. `KeyG` nao e usada por nenhuma outra acao
   */
  KeyG: PAINEL.GUILD,

  // O market. `KeyM` nao e usada por nenhuma outra acao, e `KeyB`,
  // `KeyC` e `KeyL` ja sao de painel
  KeyM: PAINEL.MARKET,
};

function chunk(items, size) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) =>
      items.slice(index * size, index * size + size),
  );
}

const STATUS_GLYPHS = {
  regeneration: "✚",
  burning: "🔥",
  poison: "☠",
  stun: "⚡",
  freeze: "❄",
  root: "⛓",
  silence: "🔇",
  cloak: "◐",
  slow: "🐌",
  power: "⚔",
  attackSpeed: "⚡",
  resistance: "🛡",
  damageReduction: "🛡",
  invulnerability: "✦",
  speedBoost: "➤",
  reflect: "↺",
  damageTaken: "",
  curse: "☠",
  weaken: "↓",
  controlResistance: "⛊",
  shieldMaintenance: "◈",
  lifesteal: "❤",
  defenseBoost: "⬟",
  resourceDrain: "▼",
  projectileBlock: "⛨",
  asura: "☸",
  elementalAffinity: "✵",
};

function Vitals({ player, resourceColor }) {
  const hpPercent = Math.max(
    0,
    Math.min(100, (player.hp / player.maxHp) * 100),
  );

  const resourcePercent = Math.max(
    0,
    Math.min(
      100,
      (player.resource / player.maxResource) * 100,
    ),
  );

  return (
    <div className="hud-vitals__bars">
      <div className="hud-gauge">
        <span className="hud-gauge__label">HP</span>
        <div className="hud-gauge__track">
          <i
            className="hud-gauge__fill hud-gauge__fill--hp"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <span className="hud-gauge__value">
          {Math.ceil(player.hp)}
          <small>/{player.maxHp}</small>
        </span>
      </div>

      <div className="hud-gauge">
        <span className="hud-gauge__label">
          {player.resourceName}
        </span>
        <div className="hud-gauge__track">
          <i
            className="hud-gauge__fill"
            style={{
              width: `${resourcePercent}%`,
              color: resourceColor,
            }}
          />
        </div>
        <span className="hud-gauge__value">
          {player.resource}
          <small>/{player.maxResource}</small>
        </span>
      </div>
    </div>
  );
}

function BuffStrip({ effects }) {
  if (effects.length === 0) return null;

  return (
    <div className="hud-buffs">
      {effects.slice(0, 10).map((effect) => (
        <span
          key={effect.type}
          className={`hud-buff hud-buff--${effect.type}`}
          data-tip={`${effect.type}: ${effect.remaining.toFixed(1)}s`}
        >
          <span className="hud-buff__glyph">
            {STATUS_GLYPHS[effect.type] ?? "•"}
          </span>
          <span className="hud-buff__time">
            {Math.ceil(effect.remaining)}
          </span>
        </span>
      ))}
    </div>
  );
}

function BestiaryAutoBox({ hunt, onStop }) {
  if (!hunt) return null;

  return (
    <button
      type="button"
      className="bst-auto"
      onClick={onStop}
      data-tip="Parar a caça automática"
    >
      <span
        className="bst-auto__icon"
        style={{ color: hunt.color }}
      >
        {hunt.icon}
      </span>

      <span className="bst-auto__text">
        <small className="bst-auto__tag">
          AUTO
        </small>

        <strong>
          Caçando {hunt.name}
        </strong>

        <span className="bst-auto__zone">
          {hunt.zoneName ?? "Procurando"}
        </span>
      </span>

      <span className="bst-auto__stop">
        Parar
      </span>
    </button>
  );
}

function QuestTracker({
    quests,
    player,
    bloqueada = false,
    onOpen,
    onFocus,
    aoAbrirPainelTutorial,
  }) {
  const main = quests?.main?.current ?? null;
  const side = quests?.side?.current ?? null;
  const auto = quests?.auto ?? null;

  const autoObjectiveId = auto?.objectiveId ?? null;
  const autoOn = Boolean(auto?.enabled);

  /**
   * A BOX NUNCA SAI.
   *
   * Antes havia `if (!main && !side) return null`, e era a unica coisa
   * da tela capaz de sumir sozinha. O sintoma era o jogador morrer e a
   * box de missoes deixar de existir: o `return null` responde a um
   * snapshot sem `quests`, e um snapshot momentaneamente sem quests
   * acontece — no instante entre a morte e o proximo pacote do
   * servidor, por exemplo
   *
   * E o pior tipo de sumir: a box e a unica pista de onde ir quando o
   * jogador morre. Ele volta, olha a tela para se orientar, e a unica
   * coisa que responderia "va para o Pantano" esta ausente
   *
   * ## POR QUE UM ESTADO VAZIO E MELHOR QUE NADA
   *
   * O cabecalho da box tem o nivel e a barra de XP, que valem sempre.
   * So as linhas de missao dependem do snapshot, e elas entram com o
   * que houver — inclusive nada, com o aviso embaixo
   */
return (
      <section
        className={[
          "qst-tracker",
          bloqueada ? "is-bloqueada" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
      {/*
        O NIVEL E A BARRA DE XP SAIRAM DO CABECALHO.

        Eles foram para o rodape da tela (`Rodape`), colados na
        borda. Cabiam aqui e a leitura era boa, mas disputavam espaco com
        a linha da missao — que e o que o jogador precisa ler enquanto
        joga, e o nivel so importa de vez em quando
      */}
      {/*
        O CABECALHO: o nome da box e o "VER TUDO", em uma linha so.

        ## POR QUE O "✧" SUMIU

        O glifo era a unica pista de que aquela area clicava. Com o texto
        ao lado ele nao acrescentava nada e ainda competia com o nome da
        box pela atencao, entao saiu. O que fez o papel de aviso foi o
        `cursor: pointer` e o `title`, que ja estavam no botao

        ## POR QUE O NOME E UM `span`, E NAO UM `strong`

        Porque o nome da box e um rotulo, e nao a missao. O `strong` nesta
        fonte tem o mesmo peso do texto de missao, e a hierarquiaerraria:
        a missao da lista pareceria um detalhe e o rotulo, o assunto

        ## POR QUE "VER TUDO" E UM `span`, E NAO OUTRO BOTAO

         Porque so o "VER TUDO" e clicavel. O cabecalho ja era um botao
         porque nao havia texto, e agora ha: com o rotulo "Missoes" dentro
         de um `button`, o `cursor: pointer` da area inteira seria uma
         mentira — o jogador passaria o mouse sobre o nome esperando uma
         acao que so o "VER TUDO" faz
       */}
      <div className="qst-tracker__head">
        <span className="qst-tracker__head-name">Missões</span>

        <button
          type="button"
          className="qst-tracker__head-all"
          onClick={onOpen}
          data-tip="Abrir missões (Q)"
        >
          Ver tudo
        </button>
      </div>

      {main && (
        <button
          type="button"
          className={[
            "qst-tracker__row",
            /**
             * O TUTORIAL E CLICAVEL, e ele e o unico que nao usa o AUTO.
             *
             * O `autoCompletable` e falso em todos os sete tutorials, porque
             * nenhum deles e "mate N bicho": sao acoes de sistema, e o auto
             * nao abre aba nenhuma. O botao ficava `disabled` e a caixa
             * inteira parecia morta — o jogador via "aguardando" e nenhuma
             * forma de sair dali
             *
             * Mas o clique ainda tem que FAZER algo, e nao pode ser o
             * `onFocus`: o `onFocus` marca o objetivo para o auto, e o auto
             * nao sabe forjar. Para o tutorial o clique ABRE o painel certo
             */
            main.tutorial
              ? "is-clickable"
              : main.autoCompletable
                ? "is-clickable"
                : "is-manual",
            autoObjectiveId === main.id
              ? "is-auto"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            if (main.tutorial) {
              if (main.painel) aoAbrirPainelTutorial?.(main.painel);
              return;
            }

            if (main.autoCompletable) onFocus?.(main.id);
          }}
          disabled={!main.autoCompletable && !main.tutorial}
          data-tip={
            main.tutorial
              ? "Abrir o tutorial"
              : main.autoCompletable
                ? "Completar automaticamente"
                : "Conclua manualmente"
          }
        >
          <span className="qst-tracker__tag">
            {main.tutorial ? "T" : "P"}
          </span>

          <div className="qst-tracker__txt">
            <strong>{main.name}</strong>
            <small>
              {main.progress}/{main.count}
              {main.tutorial
                ? " · abra para aprender"
                : main.autoCompletable
                  ? ""
                  : " · aguardando"}
            </small>

            {/*
              O BOTAO "ABRIR CRAFT", DEPOIS DA DESCRICAO.

              ## POR QUE ABAIXO E NAO AO LADO DO NOME

              Porque ao lado ele disputava o espaco com a propria missao: a
              caixa tem 220px e o nome ja e truncado, entao o botao comia a
              largura que o nome precisava. E embaixo da linha a leitura fica
              na ordem do painel: o QUE e, o COMO esta, e o BOTAO que abre.

              ## POR QUE UM `span` E NAO UM `button`

              Porque a linha toda ja e um `<button>`: o tutorial abre o
              painel pelo clique na missao. E um `<button>` dentro de outro e
              proibido pelo HTML, e o navegador pode fechar um dos dois ao
              clicar

              O `role="button"` com o `onClick` no `stopPropagation` faz o
              mesmo trabalho sem aninhar. E o `aria-hidden` porque o botao de
              fora ja e acionavel pelo teclado e ja anuncia o painel no
              `title` — um segundo alvo seria dois lugares para a mesma aba
            */}
            {main.tutorial && main.painel && (
              <span
                className="qst-tracker__abrir"
                role="button"
                aria-hidden="true"
                onClick={(event) => {
                  event.stopPropagation();
                  aoAbrirPainelTutorial?.(main.painel);
                }}
              >
                {ROTULO_DO_PAINEL_DA_BOX[main.painel] ?? "ABRIR"}
              </span>
            )}
          </div>

          {autoObjectiveId === main.id && autoOn && (
            <span className="qst-tracker__auto">AUTO</span>
          )}
        </button>
      )}

      {side && (
        <button
          type="button"
          className={[
            "qst-tracker__row",
            "is-side",
            "is-clickable",
            autoObjectiveId === side.id ? "is-auto" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onFocus?.(side.id)}
          data-tip="Completar automaticamente"
        >
          <span className="qst-tracker__tag">S</span>

          <div className="qst-tracker__txt">
            <strong>{side.name}</strong>
            <small>
              {side.progress}/{side.count}
            </small>
          </div>

          {autoObjectiveId === side.id && autoOn && (
            <span className="qst-tracker__auto">AUTO</span>
          )}
        </button>
      )}

      {/*
        O AVISO DE "SEM MISSAO", e nao um bloco vazio.

        Uma box vazia parece quebrada. O aviso diz o que aconteceu: o
        jogador esta no hub, a campanha acabou, ou o snapshot ainda nao
        chegou — e o cabecalho com nivel e XP continua ali em cima
      */}
      {!main && !side && (
        <p className="qst-tracker__vazio">
          Nenhuma missão ativa
        </p>
      )}
    </section>
  );
}

/**
 * UM RECURSO COM O NUMERO DENTRO DA BARRA.
 *
 * O `Vitals` da HUD tambem mostra HP e recurso, mas com o numero DO
 * LADO da barra, num bloco que fica no alto da tela. Aqui o numero vai
 * DENTRO: a faixa e baixa, e um numero ao lado empurraria o trilho para
 * fora dela
 *
 * O espaco entre o trilho e o preenchimento e o que segura a leitura:
 * com o texto sobre a barra, ele ficaria legivel so na parte vazia — e
 * a parte vazia e justamente onde o jogador olha quando o recurso esta
 * cheio
 */
function BarraInterna({ percent, atual, maximo, cor, rotulo }) {
  return (
    <span
      className="rodape__barra"
      data-tip={`${rotulo}: ${atual}/${maximo}`}
    >
      <i
        className="rodape__barra-fill"
        style={{
          width: `${percent}%`,
          background: cor,
        }}
      />

      <span className="rodape__barra-num">
        {Math.ceil(atual)}
        <small>/{maximo}</small>
      </span>
    </span>
  );
}

/**
 * O TRILHO DOURADO DO XP, EMBAIXO DA LINHA INTEIRA.
 *
 * ## POR QUE ELE SAIU DO RODAPE
 *
 * Porque a barra de XP e a unica barra da tela que nao pertence a um
 * personagem especifico: o progresso do nivel vale para a sessao toda,
 * enquanto o HP e o recurso sao numeros que mudam a cada golpe. Dentro
 * do rodape ele parava na coluna das barras de 300px; como linha da
 * barra de acoes, ele atravessa do nivel ate o ultimo botao da direita
 *
 * ## POR QUE A CONTA FICA AQUI E NAO NO RODAPE
 *
 * O rodape calcula a porcentagem do XP porque e quem sabe do nivel. O
 * `percent` desce por prop, e este componente so desenha — se ele
 * recalculasse, a mesma conta estaria em dois lugares e os dois
 * divergiriam no primeiro ajuste
 */
/**
 * A PORCENTAGEM DE XP DE UM JOGADOR.
 *
 * ## POR QUE E UMA FUNCAO E NAO UM `useState` PASSADO POR PROP
 *
 * Porque o numero e usado em DOIS lugares: na porcentagem escrita ao lado
 * do nivel, e no preenchimento do trilho que atravessa a linha da barra
 * de acoes. Sao elementos distantes no DOM e nao podem ser irmaos
 *
 * Com a conta em um lugar so, os dois nao podem divergir — e se
 * divergissem, o sintoma seria o numero dizendo 43% com a barra em 41%,
 * que e o tipo de defeito que so aparece depois de horas de jogo
 */
function percentualXp(player) {
  const xp = player?.xp ?? 0;
  const needed = player?.xpToNext ?? 0;

  /**
   * `needed` que NAO E NUMERO e o jogo dizendo que o personagem chegou
   * ao fim. Dividir por isso daria `NaN` na largura, e a barra sumiria
   * com o numero em 100% na tela
   */
  const noMaximo = !Number.isFinite(needed) || needed <= 0;

  return {
    noMaximo,
    percent: noMaximo
      ? 100
      : Math.min(100, (xp / needed) * 100),
    xp,
    needed,
  };
}

/**
 * O TRILHO DOURADO DO XP, NA SEGUNDA LINHA DA BARRA DE ACOES.
 *
 * ## POR QUE ELE VIVE AQUI E NAO NO RODAPE
 *
 * Porque a barra de XP e a unica barra da tela que nao pertence a um
 * bloco so: o progresso do nivel vale para a sessao inteira, enquanto o
 * HP e o recurso sao numeros que mudam a cada golpe. Dentro do rodape
 * ele parava na coluna das barras de 300px; como linha da barra de
 * acoes, ele atravessa do nivel ate o ultimo botao da direita
 *
 * ## POR QUE ELE CALCULA SOZINHO
 *
 * Pela funcao `percentualXp`, que e a mesma que escreve o numero ao lado
 * do nivel. Os dois leem o mesmo `player` e chegam ao mesmo numero
 */
function TrilhoXp({ player }) {
  const { percent, noMaximo, xp, needed } = percentualXp(player);

  return (
    <span
      className="rodape__track"
      data-tip={
        noMaximo
          ? "Nível máximo"
          : `${xp}/${needed} XP para o próximo nível`
      }
      aria-hidden="true"
    >
      <i style={{ width: `${percent}%` }} />
    </span>
  );
}

/**
 * OS TRES NUMEROS DO PERSONAGEM, ACIMA DAS BARRAS.
 *
 * ## POR QUE ELES VEM DO MOTOR E NAO SAO CALCULADOS AQUI
 *
 * `player.attack`, `defense` e `speed` chegam prontos no painel: sao os
 * mesmos numeros que o motor usou para calcular o golpe e o dano. O
 * `StatusPanel` faz o mesmo pelo mesmo motivo — e o painel de status
 * que o teste `hudStatus.test.jsx` cobre quando ele diz "o ATK da tela
 * e o mesmo ataque que o motor usa"
 *
 * Recalcular aqui daria um numero na tela que o golpe nunca usou, e a
 * diferenca apareceria so depois que o jogador notasse que o ATK da
 * ficha e o ATQ do rodape nao batem
 *
 * ## POR QUE SO TRES, E NAO OS VINTE E SEIS
 *
 * Sao os tres que mudam a DECISAO do jogador: o que ele bate, o que ele
 * aguenta e a que velocidade ele chega primeiro. Os outros vao no painel
 * de status, que existe para o numero que so importa quando o jogador
 * abre o painel
 */
/**
 * OS TRES ATRIBUTOS DO PERSONAGEM, COM ICONE EM VEZ DO TEXTO.
 *
 * ## POR QUE ICONE E NAO "ATQ", "DEF", "VEL"
 *
 * Porque o rotulo e o que ocupa espaco, e o espaco aqui e o do numero:
 * em 180px de barra, "ATQ 45" repetido tres vezes empurrava a leitura
 * para longe do numero que importa. O icone ocupa uma caixa e o numero
 * fica sozinho, com o espaco que sobrar para o digito crescer
 *
 * ## POR QUE O ICONE E DO SISTEMA `HudIcon`
 *
 * E o mesmo componente que os botoes da barra usam, entao a regra de
 * "arte primeiro, glifo quando nao ha arquivo" e a mesma. Hoje os tres
 * caem no glifo — `ataque`, `defesa` e `velocidade` estao no
 * `HUD_ICON_GLYPH` mas fora do `HUD_ICON_IDS`, porque aquela lista exige
 * PNG no disco. Quando a arte existir, eles entram nas duas listas e o
 * rodape troca de glifo sozinho
 *
 * ## POR QUE O NOME CONTINUA NO `title`
 *
 * Porque o icone sozinho nao diz o que e o numero. O `title` e o `aria`
 * devolvem a palavra, entao o mouse em cima do glifo ensina e o leitor
 * de tela anuncia
 *
 * ## OS NUMEROS VEM DO MOTOR
 *
 * `player.attack`, `defense` e `speed` chegam prontos no painel: sao os
 * mesmos numeros que o motor usou para calcular o golpe e o dano.
 * Recalcular aqui daria um numero na tela que o golpe nunca usou
 */
/**
 * OS TRES ATRIBUTOS DO PERSONAGEM, COM ICONE EM VEZ DO TEXTO.
 *
 * ## POR QUE ICONE E NAO "ATQ", "DEF", "VEL"
 *
 * Porque o rotulo e o que ocupa espaco, e o espaco aqui e o do numero:
 * em 180px de barra, "ATQ 45" repetido tres vezes empurrava a leitura
 * para longe do numero que importa. O icone ocupa uma caixa e o numero
 * fica sozinho, com o espaco que sobrar para o digito crescer
 *
 * ## O NOME APARECE NO HOVER, E POR TRES CAMADAS
 *
 * - `data-nome` alimenta o `::after`, que e o que o jogador ve. E CSS
 *   puro, entao nao custa um render por hover
 * - `title` e o fallback do navegador quando o CSS nao carrega
 * - `aria-label` e o que o leitor de tela anuncia, e o unico dos tres que
 *   existe sem o mouse
 *
 * Sem o `aria-label` o leitor de tela anunciaria so "45", e o jogador
 * nao saberia se era ataque ou defesa
 *
 * ## POR QUE `tabIndex: 0`
 *
 * Porque sao tres informacoes que o jogador pode querer ler, e o
 * indicador do hover e do `:focus-visible` — entao sem `tabIndex` o
 * `Tab` passaria direto e ninguem veria o nome pelo teclado
 *
 * ## POR QUE NAO E UM `<button>`
 *
 * Porque nao ha acao nenhuma: e leitura. Um botao sem clique e um
 * botao que o jogador aperta esperando algo, e o `cursor: help` no CSS
 * diz que ali so tem informacao
 *
 * ## OS NUMEROS VEM DO MOTOR
 *
 * `player.attack`, `defense` e `speed` chegam prontos no painel: sao os
 * mesmos numeros que o motor usou para calcular o golpe e o dano.
 * Recalcular aqui daria um numero na tela que o golpe nunca usou
 */
/**
 * O INDICATIVO DE CURA ATIVA, em cima dos atributos.
 *
 * ## POR QUE UM COMPONENTE E NAO MAIS UM `span` NO LUGAR
 *
 * Porque ele le `player.statusEffects`, e esse array tambem carrega veneno,
 * stun e lentidao. A tela aqui embaixo ja tem uma faixa de buffs
 * (`BuffStrip`) para esses; o que o jogador precisa saber ENQUANTO olha
 * para a barra de vida e se aquela barra esta subindo sozinha
 *
 * ## POR QUE SO A CURA
 *
 * Porque e o unico efeito que muda a leitura da barra de HP. Veneno e
 * queimadura ja tem glifo proprio na `BuffStrip`, e stun tem o icone na
 * barra de skills. Um glifo "você esta se curando" do lado do numero de
 * vida e a mesma informacao que o tooltip da barra daria
 *
 * ## POR QUE `data-nome` E NAO `title`
 *
 * Pelo mesmo motivo dos atributos: o `title` nativo demora um segundo,
 * usa a fonte do navegador e some quando o mouse corre. A caixa da
 * regua precisa mostrar "+25 a cada 2s" e o tempo que resta, e o
 * `::after` faz isso com a cara do jogo
 */
function IndicativoCura({ effects }) {
  const cura = effects?.find((efeito) => efeito.regeneracaoCura);

  if (!cura) return null;

  const { porTick, intervalo, rotulo } = cura.regeneracaoCura;

  return (
    <span
      className="rodape__cura"
      data-nome={`${rotulo} · +${porTick} a cada ${intervalo}s · ${Math.ceil(
        cura.remaining,
      )}s`}
      data-tip={`${rotulo}: +${porTick} de vida a cada ${intervalo}s`}
      aria-label={`${rotulo} ativa: ${porTick} de vida a cada ${intervalo} segundos`}
      tabIndex={0}
    >
      <span className="rodape__cura-glyph">✚</span>

      <span className="rodape__cura-num">
        {`+${porTick}/${intervalo}s`}
      </span>
    </span>
  );
}

function Atributos({ player }) {
  /**
   * O NUMERO ARREDONDADO, e nao o cru.
   *
   * ## POR QUE O `.56` NO MEIO DA FAIXA
   *
   * Porque o `enhance` e um MULTIPLICADOR sobre o stat, entao um +12 em
   * qualquer peca deixa o ataque em `103.5648...`. Mostrar isso dava um
   * numero de cinco caracteres que muda sozinho quando o jogador recebe
   * meio ponto de bonus — e o que ele esta lendo ali e o ATQ, nao a conta
   * por tras dele
   *
   * ## POR QUE ARREDONDAR E NAO CORTAR
   *
   * `Math.floor` num `103.56` mostraria 103, e o golpe de 103.6 curaria
   * um inimigo que o 103 nao curaria: a tela mentiria para baixo, que e a
   * direcao errada. `Math.round` mostra o golpe mais proximo do que vai
   * sair
   *
   * ## POR QUE NAO `toFixed(0)`
   *
   * Porque ele devolve uma string, e estes numeros alimentam o `title` e o
   * `aria-label` que o leitor de tela le. O arredondamento em um `round()`
   * tira o flutuante na hora em que ele aparece
   *
   * ## E O `Number()` ANTES
   *
   * Porque `Math.round(undefined)` e `NaN`, e um `?? 0` DEPOIS do round
   * nao pegaria esse caso. O `Number` garante que o round receba um
   * numero, e o `|| 0` cobre o `NaN` do `Number(undefined)`
   */
  const inteiro = (valor) => Math.round(Number(valor) || 0);

  return (
    <span className="rodape__atributos">
      <span
        className="rodape__atributo"
        data-nome="Ataque"
        data-tip="Ataque"
        aria-label="Ataque"
        tabIndex={0}
      >
        <HudIcon
          iconId="ataque"
          className="rodape__atributo-icon"
        />

        {inteiro(player?.attack)}
      </span>

      <span
        className="rodape__atributo"
        data-nome="Defesa"
        data-tip="Defesa"
        aria-label="Defesa"
        tabIndex={0}
      >
        <HudIcon
          iconId="defesa"
          className="rodape__atributo-icon"
        />

        {inteiro(player?.defense)}
      </span>

      <span
        className="rodape__atributo"
        data-nome="Velocidade"
        data-tip="Velocidade"
        aria-label="Velocidade"
        tabIndex={0}
      >
        <HudIcon
          iconId="velocidade"
          className="rodape__atributo-icon"
        />

        {inteiro(player?.speed)}
      </span>
    </span>
  );
}

/**
 * O RODAPE: NIVEL, HP E RECURSO.
 *
 * As tres informacoes juntas porque elas respondem a uma pergunta so —
 * "como esta o meu personagem agora" — e separadas em tres lugares da
 * tela o jogador passa a varrer o rodape para achar o numero que mudou
 *
 * ## A ORDEM DE LEITURA
 *
 * Nivel em cima, porcentagem embaixo. E a ordem em que a informacao
 * chega: primeiro QUEM voce e, depois QUANTO falta
 *
 * HP e recurso vao AO LADO do nivel: sao os numeros que mudam a cada
 * golpe, e empilhados abaixo deles empurrariam o nivel para fora da
 * linha. Empilhados a direita, o nivel continua sendo o maior numero da
 * tela — que e o que faz ele ler como titulo
 *
 * ## O RECURSO E DO SERVIDOR, E NAO UM NOME FIXO
 *
 * Vem de `player.resourceName`: e "Chi" no Guerreiro, "Foco" no
 * Arbalist, "Furia" no Lancer. Escrever "Foco" aqui deixaria o Guerreiro
 * com uma barra mentindo o nome do recurso dele
 */
function Rodape({ player }) {
  const { percent } = percentualXp(player);

  /**
   * A PORCENTAGEM COM QUATRO CASAS.
   *
   * Com uma casa o numero ficava parado em 99,9% por varios abates no
   * fim de um nivel longo, e a barra parecia travada. Quatro casas
   * resolvem, e sao justas num numero que o jogador ve o tempo todo
   *
   * A VIRGULA e do `replace`, e nao do `toFixed`: o `toFixed` escreve
   * ponto, que e o separador de milhar em pt-BR e de casas nos Estados
   * Unidos. Escrever o ponto seria o numero errado na tela de um jogo
   * todo em portugues
   */
  const texto = percent.toFixed(4).replace(".", ",");

  const hp = player?.hp ?? 0;
  const maxHp = player?.maxHp ?? 1;

  const recurso = player?.resource ?? 0;
  const maxRecurso = player?.maxResource ?? 1;

  const hpPercent = Math.max(
    0,
    Math.min(100, (hp / maxHp) * 100),
  );

  const recursoPercent = Math.max(
    0,
    Math.min(100, (recurso / maxRecurso) * 100),
  );

  return (
    <div className="rodape">
      <span className="rodape__id">
        <span className="rodape__lvl">
          {player?.level ?? 1}
        </span>

        <span className="rodape__pct">
          {texto}%
        </span>
      </span>

      <span className="rodape__vitals">
        {/*
          O INDICATIVO EM CIMA DOS ATRIBUTOS, e nao dentro deles.

          Sao coisas diferentes: os atributos sao o QUANTO o jogador
          tem, e o indicativo e o que esta acontecendo AGORA com esse
          numero. Dentro do `Atributos` ele entraria na mesma fileira dos
          tres, e o "+25/2s" leria como um quarto atributo

          E antes das barras pela mesma razao: a cura muda o HP, e o
          indicativo tem que estar colado na barra que ele esta mexendo
        */}
        <IndicativoCura effects={player?.statusEffects} />

        <Atributos player={player} />

        <BarraInterna
          percent={hpPercent}
          atual={hp}
          maximo={maxHp}
          cor="var(--hp, #ff2f3d)"
          rotulo="Vida"
        />

        <BarraInterna
          percent={recursoPercent}
          atual={recurso}
          maximo={maxRecurso}
          cor={player?.resourceColor ?? "#0a84ff"}
          rotulo={player?.resourceName ?? "Recurso"}
        />
      </span>
    </div>
  );
}

export default function HUD({
  classDefinition,
  characterName,
  snapshot,
  engineRef,
  onBack = null,
  intencao = null,

  /**
   * O MAPA ATUAL, por fora do `snapshot`.
   *
   * O painel privado nao carrega o mapa: ele viaja no `SNAPSHOT` do
   * mundo. Sem este prop o HUD nao sabe em que mapa esta, e o botao da
   * arena ficaria sem saber se o clique entra ou sai
   */
  mapa = null,
  /**
   * O CONVITE DE PARTY que chegou pelo EVENTO do servidor.
   *
   * Vive aqui e nao dentro do `snapshot` porque e um instante: o painel
   * chega alguns segundos depois, e a caixa de cinco segundos nao pode
   * esperar por ele
   */
conviteParty = null,

  /**
   * LIGA O FARM OFFLINE, e devolve uma PROMISE.
   *
   * E o `useGameClient` que a entrega, e ela tem de ser uma promise: o
   * botao da pausa espera o servidor confirmar antes de navegar, porque
   * navegar desmonta o cliente e joga o pedido fora
   */
  iniciarFarmOffline = null,
  }) {
  const skillPages = useMemo(
    () => chunk(classDefinition.skills, 8),
    [classDefinition],
  );

  const [page, setPage] = useState(0);

  /**
   * O painel aberto, ou `null`. Ver `PAINEL` acima: um so por vez, e
   * o `null` e "nenhum"
   */
  const [painelAberto, setPainelAberto] = useState(null);

  /**
   * A PECA QUE O "ENCANTAR" DA CAIXA PEDIU, como chave.
   *
   * Vive no `HUD` e nao dentro do `EnchantPanel` porque o pedido nasce na
   * mochila e o painel pode nem estar montado: e o `HUD` que recibe o
   * clique, troca de painel e entrega a peca ja pronta
   *
   * `null` quando o painel foi aberto pelo botao, sem peca nenhuma. E o
   * estado normal do painel, que abre com a lista vazia de selecao
   */
  const [alvoEncantar, setAlvoEncantar] = useState(null);

  /**
   * A ABA QUE O MENU DO ITEM PEDIU, e nao a que o painel esta mostrando.
   *
   * Sao coisas diferentes: o painel tem a aba dele para o jogador trocar com
   * um clique, e este estado e o PEDIDO do "Encantar"/"Aprimorar" da caixa do
   * item. O painel recebe os dois e o pedido e zerado ao fechar, entao
   * abrir pelo botao da HUD volta sempre na aba de encantar
   */
  const [abaEncantar, setAbaEncantar] = useState(null);

  /**
   * O JOGADOR MIRADO, e o menu que aparece em cima dele.
   *
   * Vive aqui e nao no motor porque e estado de INTERFACE: o motor so
   * entrega o id do que foi clicado, e quem decide mostrar um menu e o
   * React
   */
  const [alvoConvite, setAlvoConvite] = useState(null);

  /**
   * Abre, ou fecha se ja era esse.
   *
   * A atribuicao e o que fecha os outros: nao existe um "os outros"
   * para listar, o estado anterior e substituido
   */
  const alternarPainel = useCallback((id) => {
    setPainelAberto((atual) => (atual === id ? null : id));
  }, []);

  /**
   * Abre sem alternar.
   *
   * Para o clique no cabecalho do rastreador de missoes: clicar ali
   * nao e um botao de fechar, e um "va para as missoes". Com
   * `alternarPainel`, clicar duas vezes abriria e fecharia em vez de
   * manter aberto
   */
  const abrirPainel = useCallback((id) => {
    setPainelAberto(id);
  }, []);

  /**
   * O FILTRO QUE O MENU DO ITEM DEIXA PARA TRAS.
   *
   * E o que faz o atalho "Ver na Colecao" abrir a colecao JA filtrada no item
   * que o jogador clicou, em vez de na lista inteira. Guarda o `itemId`, e nao
   * a lista de entradas: o painel e quem decide o que filtrar, e o filtro tem
   * de valer para o `snapshot` que chegar depois, nao para a copia congelada
   * no momento do clique
   *
   * E um estado so para os dois paineis porque os dois filtros sao mutually
   * exclusive na pratica: um item ou esta na colecao, ou vem do codex, e abrir
   * um depois do outro sem filtro mostraria ao jogador que o atalho funciona
   */
  const [focoItem, setFocoItem] = useState(null);

  /**
   * ABRE A COLECAO JA NO ITEM.
   *
   * Zera o filtro anterior antes de abrir, porque o filtro e do item clicado e
   * nao pode vazar de uma abertura para a seguinte
   */
  const abrirColecaoNoItem = useCallback((itemId) => {
    setFocoItem(itemId);
    setPainelAberto(PAINEL.COLECAO);
  }, []);

  /**
   * ABRE O CODEX JA NAS CRIATURAS QUE DROPAM O ITEM.
   *
   * O `criaturas` chega pronto do `destinosDoItem`: e a lista de `typeId` que
   * o filtro do codex consome, e recalcular aqui seria refazer a mesma busca
   */
  const abrirCodexNoItem = useCallback((itemId, criaturas) => {
    setFocoItem({ itemId, criaturas });
    setPainelAberto(PAINEL.BESTIARIO);
  }, []);

  /**
   * O FILTRO E SOME QUANDO O PAINEL FECHA.
   *
   * Sem isto, o jogador abre a colecao pelo botao da HUD depois de usar um
   * atalho e ainda ve o filtro antigo, sem nenhuma explicacao na tela. O
   * filtro e uma consequencia do clique que o abriu, e nao um estado do painel
   */
  const fecharColecao = useCallback(() => {
    setFocoItem(null);
    alternarPainel(PAINEL.COLECAO);
  }, [alternarPainel]);

  const fecharCodex = useCallback(() => {
    setFocoItem(null);
    alternarPainel(PAINEL.BESTIARIO);
  }, [alternarPainel]);

  /**
   * O PAUSE.
   *
   * A tecla ESC abre uma cortina sobre o jogo com o botao de sair. O
   * botao de voltar para as classes saiu da barra justamente por isso:
   * ficar na beirada da tela e um convite a sair sem querer, e e uma
   * acao que nao se desfaz. No pause ela fica onde o jogador a procura
   * quando realmente quer — parado, com a tela escurecida
   *
   * O `pauseOpen` fecha ao pressionar ESC de novo, e nao ao clicar
   * fora: um clique perdido no meio de uma fight nao pode custar o
   * alvo, e o jogador precisa de um caminho de volta sem mouse
   */
  const [pauseOpen, setPauseOpen] = useState(false);

  /**
   * O PAINEL DE TECLAS, que mora DENTRO do pause.
   *
   * ## POR QUE ELE E UM ESTADO SEPARADO DO `pauseOpen`
   *
   * Porque os dois nao fecham pelo mesmo motivo. O pause fecha por `ESC` e
   * pelo botao de sair; o painel de teclas fecha pela `ESC` dele mesmo e
   * pelo "Voltar". Sao duas camadas, e cada uma escuta a mesma tecla com um
   * destino diferente
   *
   * Sem este estado, a `ESC` do painel fecharia o PAUSE inteiro por baixo —
   * o jogador mudaria a tecla de ataque e perderia a tela de pausa junto
   */
  const [teclasOpen, setTeclasOpen] = useState(false);

  /**
   * Abrir o PAUSE, e o que ele faz com os paineis.
   *
   * Fechar o painel aberto nao e detalhe: sao duas camadas na mesma
   * tela, e o jogador que abriu o menu para sair nao deveria encontrar
   * a colecao por cima dele
   *
   * ## POR QUE DOIS METODOS DE NOVO
   *
   * Porque ha DOIS botoes que levam ao pause: a tecla ESC, que precisa
   * poder FECHAR, e a engrenagem da prateleira, que nao tem por que ter
   * esse poder — o veu cobre a tela e o jogador quase nunca chega nela com
   * o cursor. Um botao que fechasse e abrisse o pause pareceria travado
   *
   * A configuracao que abre o `PAINEL.CONFIG` e a engrenagem da BARRA DE
   * SKILLS, que e outra coisa: aquela e sobre o jogo rodando, esta e sobre
   * o personagem
   */
  const abrirPause = useCallback(() => {
    setPainelAberto(null);
    setPauseOpen(true);
  }, []);

  const alternarPause = useCallback(() => {
    setPauseOpen((current) => {
      if (!current) {
        setPainelAberto(null);
      }

      return !current;
    });
  }, []);

  /**
   * O FARM OFFLINE: o botao da pausa, e o que ele faz em tres tempos.
   *
   * ## POR QUE UM ESTADO PROPRIO E NAO O `pauseOpen`
   *
   * Porque sao duas coisas diferentes com duas duracoes diferentes.
   * `pauseOpen` dura ate o jogador escolher; `ligandoFarm` dura ate o
   * servidor responder. Usar o mesmo estado deixaria o "Continuar"
   * funcionando durante a espera, e o jogador poderia sair por ali sem
   * ter ligado nada
   */
  const [ligandoFarm, setLigandoFarm] = useState(false);

  /**
   * O FARM JA ESTA LIGADO?
   *
   * O painel e a resposta do servidor, e nao um estado local: quem liga
   * o relogio e o servidor, e so ele sabe. Guardar um `true` no cliente
   * faria o botao dir "ligado" para quem cancelou pelo outro caminho
   */
  const farmAtivo = snapshot?.farmOffline?.ativo === true;

  /**
   * LIGA O FARM E SAI PARA A SELECAO DE CLASSE.
   *
   * ## A ORDEM DAS TRUCO CASO
   *
   * 1. trava o botao
   * 2. `await` o servidor confirmar
   * 3. so entao `onBack()`
   *
   * Se o `onBack` viesse primeiro, o `TestMapScene` desmontaria, o
   * `useGameClient` rodaria o cleanup e chamaria `desconectar()` — que
   * faz `this.fila = []` e joga fora o pedido do farm. O jogador voltaria
   * sem relogio nenhum e sem nenhuma mensagem dizendo isso
   *
   * ## E SE O SERVIDOR NAO CONFIRMAR
   *
   * O `GameClient` resolve com `false` depois do prazo, e aqui isso e o
   * mesmo que confirmei: o jogador sai do mesmo jeito, porque a tela de
   * selecao e o que ele pediu ao clicar. Mas o `pause` fica aberto com o
   * botao destravado, para ele poder tentar de novo em vez de sumir sem
   * retorno
   */
  const handleIniciarFarmOffline = useCallback(async () => {
    if (ligandoFarm) return;

    if (!iniciarFarmOffline) return;

    setLigandoFarm(true);

    try {
      const confirmado = await iniciarFarmOffline();

      setPauseOpen(false);

      if (confirmado) {
        onBack?.();
      }
    } finally {
      setLigandoFarm(false);
    }
  }, [ligandoFarm, iniciarFarmOffline, onBack]);

  const bestiary = snapshot?.bestiary ?? null;
  const craft = snapshot?.craft ?? null;
  const collection = snapshot?.collection ?? null;
  const market = snapshot?.market ?? null;
  const guilda = snapshot?.guilda ?? null;

  /**
   * Abre o inventario, e antes tira do corpo o que esta no slot errado.
   *
   * Quem tem peca vestida na posicao errada vem de um save antigo:
   * antes de a peca declarar posicao, `head`, `chest` e `legs`
   * aceitavam qualquer `ARMOR`, e o arquivo guardava o que o jogador
   * vestiu. Sem esta correcao o painel mostraria um capuz no peito
   * para sempre, e nenhuma regra de `equip` corrigiria sozinha: ela
   * so roda quando o jogador veste alguma coisa
   *
   * A peca volta para a mochila na MESMA raridade, e nao e vestida no
   * slot certo: o pedido foi "desequipar o que esta errado", e mudar
   * o equipamento do jogador sem ele pedir seria decisao demais
   */
  const openInventory = useCallback(() => {
    if (intencao) {
      intencao.consertarEquipamento();
    } else {
      engineRef.current?.fixMisplacedEquipment();
    }

    alternarPainel(PAINEL.INVENTARIO);
  }, [engineRef, intencao, alternarPainel]);

  /**
   * O clique num NPC abre o painel que ELE vende.
   *
   * O motor entrega a entidade inteira e nao um id, porque o que o NPC
   * faz viaja com ele: `acao` vem do catalogo do tipo. Passar so o id
   * obrigaria a tela a voltar ao motor para perguntar de novo o que
   * aquele NPC faz — e o motor nao sabe de painel, so tem o dado
   *
   * O hook e instalado AQUI, e nao no `GameCanvas`, porque quem tem o
   * `painelAberto` e quem tem de reagir a ele. O `GameCanvas` cria o
   * motor mas nao sabe o que existe dentro
   */
  const handleNpcClick = useCallback(
    (npc) => {
      /**
       * A LOJA do mercador, e nao o mercado entre jogadores.
       *
       * Esta era a linha que abria `PAINEL.MARKET`: o mercador da base
       * nao tem oferta nenhuma para propose, entao o jogador clicava
       * nele e via um painel de mercado vazio, com o sentido errado e
       * sem a pocão que ele foi comprar
       *
       * E `abrirPainel`, e nao `alternarPainel`: a loja e um lugar
       * para onde se vai. Clicar no mercador com a loja aberta deve
       * mostrar a loja de novo, e nao fechar o que o jogador acabou de
       * abrir — ele pode ter clicado sem querer no boneco atras do
       * painel
       */
      if (npc.acao === NPC_ACAO.POCOES) {
        abrirPainel(PAINEL.POCOES);
        return;
      }

      /**
       * O PAINEL DE HABILIDADES, e por que ele e um `if` e nao uma
       * tabela.
       *
       * Sao duas acoes, e a lista com dois casos seria um mapa com duas
       * entradas que existe so para caber num `switch`. O `if` cresce
       * para o terceiro caso — e um painel de habilidades com conteudo
       * vai ter mais de um
       */
      if (npc.acao === NPC_ACAO.HABILIDADES) {
        abrirPainel(PAINEL.HABILIDADES);
        return;
      }

      /**
       * O BAU, e por que ele e o TERCEIRO `if` e nao o fim.
       *
       * O comentario acima deste bloco diz que o `if` cresce para o
       * terceiro caso. Este e ele: o bau responde ao clique abrindo o
       * painel dele, com o mesmo `abrirPainel` e pelo mesmo motivo da
       * loja — o bau e um lugar para onde se vai, e clicar nele com o
       * painel aberto tem que mostrar o painel de novo
       */
      if (npc.acao === NPC_ACAO.BAU) {
        abrirPainel(PAINEL.BAU);
      }
    },
    [abrirPainel],
  );

  /**
   * O CLIQUE EM CIMA DE OUTRO JOGADOR.
   *
   * Abre o MENU com a opcao de convidar. O menu e local do jogador que
   * cliqueou: e uma intencao de um instante, e o convite em si so sai
   * quando ele escolhe a opcao
   */
  const handlePlayerClick = useCallback(
    (alvoId, jogador) => {
      setAlvoConvite({
        id: alvoId,
        nome: jogador?.name ?? "?",
        classe: jogador?.classId ?? null,
      });
    },
    [],
  );

  /**
   * FECHAR O MENU do jogador mirado.
   *
   * Fecha com o mesmo clique que abriu a barra de skills, e nao com o
   * clique fora: um clique perdido no meio de uma briga nao pode
   * custar o convite que o jogador acabou de mirar
   */
  const fecharAlvoConvite = useCallback(() => {
    setAlvoConvite(null);
  }, []);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) return undefined;

    engine.onNpcClick = handleNpcClick;

    /**
     * O MESMO EFEITO para o clique em OUTRO JOGADOR.
     *
     * O motor e quem sabe converter tela para mundo, entao e ele quem
     * entrega o id do jogador mirado. Aqui o id vira um pedido de
     * convite — e nada mais: clicar num colega abre o menu, e nao um
     * combate contra ele
     */
    engine.onPlayerClick = handlePlayerClick;

    return () => {
      // sem esta limpeza, o motor guardaria um callback de uma tela
      // desmontada, e clicar no NPC de outra tela abriria um painel
      // que nao existe mais
      engine.onNpcClick = null;
      engine.onPlayerClick = null;
    };
  }, [engineRef, handleNpcClick, handlePlayerClick]);

  /**
   * O rank de quem esta conectado.
   *
   * A lista vem ordenada do servidor; a tela nao reordena nada.
   */
  const rank = snapshot?.rank ?? null;

  useEffect(() => {
    const onKey = (event) => {
      /**
       * COM O FOCO NUM CAMPO, o atalho nao existe.
       *
       * O `keydown` esta no `window` e nao.preventDefault, entao sem
       * esta guarda o jogador digitava `b` no nome da guilda e o
       * bestiario abria por cima do campo — e `x` e `g`, que sao as
       * teclas da guilda, abriam e fechavam o painel que o jogador
       * estava preenchendo
       *
       * E o que segura o painel aberto enquanto o jogador escreve,
       * sem fechar o que ele nao pediu para fechar
       */
      if (digitandoEm(event)) return;

      const alvo = ATALHO_PAINEL[event.code];

      /**
       * A cortina e MODAL.
       *
       * Com o pause na tela, nenhum atalho de painel pode abrir painel
       * por baixo. Sem esta guarda o `S` abria o status atras do veu:
       * o jogador apertava Continuar e dava de cara com um painel que
       * nao tinha pedido, e nao tinha como saber que a tecla fora a
       * culpada
       *
       * A ESC continua valendo por aqui, e e o unico caminho de volta
       * sem mouse: com o painel sobre a tela, o cursor nem sempre
       * alcanca o "Continuar"
       */
      if (pauseOpen) {
        /**
         * A `ESC` DO PAINEL DE TECLAS NAO FECHA O PAUSE.
         *
         * E por isso que a guarda existe aqui e nao dentro do painel: o painel
         * ja treats a `ESC` dele, e se este `if` a obeyedesse junto, um
         * `keydown` viraria dois fechamentos — o painel fechando e o pause
         * fechando. O jogador voltaria direto para o jogo
         *
         * Quem fica com a `ESC` e o painel e o `stopImmediatePropagation` dele:
         * com o painel aberto, ele barra o evento antes de este ouvinte rodar
         */
        if (event.code === "Escape" && !teclasOpen) {
          alternarPause();
        }

        return;
      }

      if (alvo) {
        // o inventario e o unico com trabalho alem de abrir: ele
        // conserta a peca no slot errado antes de mostrar a mochila
        if (alvo === PAINEL.INVENTARIO) {
          openInventory();
        } else {
          alternarPainel(alvo);
        }

        return;
      }

      if (event.code === "Escape") {
        alternarPause();
      }
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener("keydown", onKey);

    // `openInventory` no lugar do `painelAberto` cru: o atalho tem
    // que passar pela mesma correcao do botao, senao abrir pelo `I`
    // mostraria a peca no slot errado e abrir pelo clique ja teria
    // tirado.
    //
    // `pauseOpen` e dependencia de PROP: sem ele a guarda do modal
    // leria o `false` do primeiro render e nunca entraria
  }, [openInventory, alternarPainel, alternarPause, pauseOpen, teclasOpen]);

  // OFFLINE o estado mora no motor. ONLINE ele volta no painel, e
  // e o painel que manda: o arrasto vira pedido, o servidor decide e
  // o proximo pacote traz a lista. Ler o store local online era o
  // que deixava a skill sem sinalizar.
  const [autoSkillsLocais, setAutoSkillsLocais] = useState(() => {
    const initial = {};

    for (const skill of classDefinition.skills) {
      initial[skill.id] = Boolean(engineRef.current?.getSkillAuto?.(skill.id));
    }

    return initial;
  });

  useEffect(() => {
    setPage(0);
  }, [classDefinition.id]);

  useEffect(() => {
    if (intencao) return;

    setAutoSkillsLocais(() => {
      const next = {};

      for (const skill of classDefinition.skills) {
        next[skill.id] = Boolean(engineRef.current?.getSkillAuto?.(skill.id));
      }

      return next;
    });
  }, [classDefinition, engineRef, intencao]);

  const autoSkillsDoPainel = useMemo(() => {
    if (!intencao) return null;

    const lista = snapshot?.skillAuto;

    return new Set(Array.isArray(lista) ? lista : []);
  }, [intencao, snapshot]);

  const autoSkills = useMemo(() => {
    if (!autoSkillsDoPainel) return autoSkillsLocais;

    const next = {};

    for (const skill of classDefinition.skills) {
      next[skill.id] = autoSkillsDoPainel.has(skill.id);
    }

    return next;
  }, [autoSkillsDoPainel, autoSkillsLocais, classDefinition]);

  const handleToggleAuto = useCallback(
    (skillId, enabled) => {
      // online, quem guarda o "esta em automatico" e o servidor.
      // o botao vira um pedido e o estado volta no painel
      if (intencao) {
        intencao.marcarAuto(skillId, enabled);
        return;
      }

      const next = Boolean(engineRef.current?.setSkillAuto?.(skillId, enabled));

      setAutoSkillsLocais((current) => ({
        ...current,
        [skillId]: next,
      }));
    },
    [engineRef, intencao],
  );

  const handleToggleAutoPlay = useCallback(() => {
    if (intencao) {
      intencao.alternarAutoPlay();
      return;
    }

    engineRef.current?.toggleAutoPlay();
  }, [engineRef, intencao]);

  /**
   * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
   *
   * O mesmo desenho do `handleToggleAutoPlay`: com rede o pedido vai para o
   * servidor, que confere o item e o limiar; sem rede o motor local responde.
   *
   * O painel manda SO o campo que mudou, e nao a configuracao inteira. E o
   * que faz o clique em "escolher pocao" desligar o automatico sem que o
   * painel precise saber disso: o motor tem essa regra, e repetir a regra
   * aqui criaria um segundo lugar onde ela poderia estar errada
   */
  const handleConfigurarAutoPocao = useCallback(
    (mudanca) => {
      if (intencao) {
        intencao.configurarAutoPocao(mudanca);
        return;
      }

      engineRef.current?.configurarAutoPocao(mudanca);
    },
    [engineRef, intencao],
  );

  /**
   * O GESTO DO SLOT DA POCAO: O MESMO ARRASTE DA SKILL.
   *
   * Puxa para baixo liga o automatico, puxa para cima desliga. E o
   * `useArrastoSlot`, o mesmo que o `SkillSlot` usa, com a mesma deadzone e
   * o mesmo limiar — e por isso que o slot da pocao e o da skill teaches a
   * mesma coisa em dois lugares em vez de duas regras
   *
   * O arrasto so comeca com pocao equipada. Sem pocao no slot nao ha o que
   * ligar, e o motor recusaria do mesmo jeito; comecar o gesto ai seria o
   * jogador arrastando e nada acontecer, que e pior do que um slot que
   * mostra que ainda nao esta configurado
   */
  const {
    drag: dragPocao,
    handlePointerDown: pocaoPointerDown,
    handlePointerMove: pocaoPointerMove,
    handlePointerUp: pocaoPointerUp,
    handlePointerCancel: pocaoPointerCancel,
    deixaClicar: deixaClicarPocao,
  } = useArrastoSlot({
    onAlternar: (ligado) => handleConfigurarAutoPocao({ ligado }),
    habilitado: Boolean(snapshot?.autoPocao?.itemId),
  });

  /**
   * O CLIQUE ABRE O PAINEL, e o arrasto e o do automatico.
   *
   * Sao duas acoes diferentes no mesmo botao: o arrasto troca o LIGADO sem
   * sair da luta, e o clique leva a escolha da pocao — que e onde ela
   * vive. Sem o clique o botao seria um botao que nao faz nada no caminho
   * curto, e o `deixaClicar` e o que garante que um arrasto terminado nao
   * abra o painel junto
   */
  const abrirAutoPot = useCallback(() => {
    if (!deixaClicarPocao()) return;

    alternarPainel(PAINEL.CONFIG);
  }, [deixaClicarPocao, alternarPainel]);

  /**
   * ATRAVESSAR O PORTAL.
   *
   * O mesmo desenho dos outros botoes do HUD: com rede, o pedido vai
   * para o servidor, que e quem decide; sem rede, o motor local troca o
   * mapa. Nos dois casos quem decide e quem tem o estado do mundo
   */
  /**
 * A GUILDA: os oito handlers do painel.
 *
 * Todos com o mesmo desenho dos outros botoes: com rede, o pedido vai
 * para o servidor; sem rede, o motor local responde. E o servidor quem
 * decide papel, saldo e limite — o `guildStore` do motor so existe no
 * single player, e la o resultado nunca sai pela tela mesmo
 *
 * Os nomes batem com os do `useGameClient`: um nome divergente aqui
 * levanta `TypeError` DENTRO do handler do React, e o clique nao faz
 * nada sem erro na tela. O `useGameClient.test.jsx` mede esse contrato
 */
const handleGuildCreate = useCallback(
(nome, tag, estilo) => {
      if (intencao) {
        intencao.criarGuilda(nome, tag, estilo);
      }
    },
[intencao],
  );

  /**
   * O EMBLEMA e A COR, da aba de Ajustes.
   *
   * ## POR QUE NAO HAI FALLBACK OFFLINE
   *
   * Porque `handleGuildCreate` tambem nao tem: sem `intencao` nao ha
   * servidor, e quem tem guilda e o `GuildStore` — que no single player e o
   * mesmo store, alimentado por `criarGuilda`. Como as duas acoes novas so
   * existem depois que a guilda foi criada, elas nunca aparecem no caminho
   * sem rede
   */
  const handleGuildStyle = useCallback(
    (icone, cor) => {
      if (intencao) {
        intencao.definirEstiloGuilda(icone, cor);
      }
    },
    [intencao],
  );

  /**
   * A TAG sobre o boneco de quem pediu.
   *
   * Leva o valor novo e nao um "inverter": dois cliques rapidos chegam ao
   * servidor em qualquer ordem. E a unica acao de guilda que um membro
   * comum pode fazer sobre si mesmo
   */
  const handleGuildTag = useCallback(
    (mostrar) => {
      if (intencao) {
        intencao.definirMostrarTag(mostrar);
      }
    },
[intencao],
  );

  /**
   * A PARTY.
   *
   * Os quatro pedidos sao guardas de `intencao`: sem rede nao ha ninguem
 * para convidar, e o botao aparece desabilitado em vez de sumir — sumir
 * faria o jogador procurar o botao e nao acha-lo
 */
const handlePartyCreate = useCallback(() => {
  if (!intencao) return;

  intencao.criarParty();
}, [intencao]);

const handlePartyInvite = useCallback(
  (nome) => {
    if (!intencao) return;

    intencao.convidarPartyPorNome(nome);
  },
  [intencao],
);

const handlePartyAccept = useCallback(() => {
  if (!intencao) return;

  intencao.aceitarConviteParty();
}, [intencao]);

const handlePartyLeave = useCallback(() => {
  if (!intencao) return;

  intencao.sairDaParty();
}, [intencao]);

/**
 * A EXPULSAO de um membro.
 *
 * E o mesmo pedido para qualquer alvo: quem pode expulsar e o servidor,
 * e o `alvoId` e so "quem"
 */
const handlePartyKick = useCallback(
  (alvoId) => {
    if (!intencao) return;

    intencao.expulsarDaParty(alvoId);
  },
  [intencao],
);

/**
 * SEGUIR UM MEMBRO.
 *
 * O botao e um interruptor e o servidor e quem sabe: se o jogador ja
 * esta seguindo alguem, o pedido CANCELA em vez de trocar de alvo
 */
const handlePartyFollow = useCallback(
  (alvoId) => {
    if (!intencao) return;

    intencao.seguirPartyMember(alvoId);
  },
  [intencao],
);

/**
 * LIGA OU DESLIGA O FOCO DO ALVO DO LIDER.
 *
 * Manda o estado contrario ao que esta na tela, e nao um "inverter": o
 * botao e um interruptor, e a tela ja sabe o estado atual
 */
const handlePartyFocus = useCallback(
  (ligado) => {
    if (!intencao) return;

    intencao.focarAlvoDoLider(ligado);
  },
  [intencao],
);

/**
 * PASSAR A LIDERANCA.
 *
 * O servidor decide se o pedido vale: so o lider atual pode passar, e
 * so para quem esta na party
 */
const handlePartyTransfer = useCallback(
  (alvoId) => {
    if (!intencao) return;

    intencao.passarLideranca(alvoId);
  },
  [intencao],
);

/**
 * O CONVITE PELO CLIQUE no personagem.
 *
 * O id do jogador mirado vem do canvas, que e o unico que sabe converter
 * tela para mundo. Aqui so vira um pedido
 */
const handlePartyInviteByClick = useCallback(
  (alvoId) => {
    if (!intencao) return;

    intencao.convidarParty(alvoId);
  },
  [intencao],
);

const handleGuildSearch = useCallback(
  (termo) => {
    if (intencao) {
      intencao.buscarGuilda(termo);
    }
  },
  [intencao],
);

const handleGuildRequest = useCallback(
  (guildaId) => {
    if (intencao) {
      intencao.pedirGuilda(guildaId);
    }
  },
  [intencao],
);

const handleGuildAccept = useCallback(
  (guildaId, alvoId) => {
    if (intencao) {
      intencao.aceitarGuilda(guildaId, alvoId);
    }
  },
  [intencao],
);

const handleGuildDeny = useCallback(
  (guildaId, alvoId) => {
    if (intencao) {
      intencao.negarGuilda(guildaId, alvoId);
    }
  },
  [intencao],
);

const handleGuildLeave = useCallback(() => {
  if (intencao) {
    intencao.sairDaGuilda();
  }
}, [intencao]);

const handleGuildTalent = useCallback(
  (talentId) => {
    if (intencao) {
      intencao.destravarTalent(talentId);
    }
  },
  [intencao],
);

/**
 * O COFRE: o terceiro argumento e o QUE vai mexer.
 *
 * O painel manda `{ moeda }`, `{ item, quantidade }` ou
 * `{ uid, quantidade }` — e o terceiro argumento e repassado inteiro,
 * em vez de o painel ter que escolher o metodo certo. Sao tres metodos no
 * cliente (`mexerNoCofre` e um so, com o objeto) e o espelhar aqui seria
 * tres callbacks identicos
 */
const handleGuildCofre = useCallback(
  (guildaId, acao, dados) => {
    if (intencao) {
      intencao.mexerNoCofre(guildaId, acao, dados);
    }
  },
  [intencao],
);

/**
 * O BOTAO DA ARENA.
 *
 * Sem argumento: o sentido e o destino sao do SERVIDOR, e ele le o mapa
 * em que o jogador esta. O pedido e o mesmo tanto para entrar quanto para
 * sair, e e por isso que o botao nunca fica sem acao
 */
const handleArena = useCallback(
  () => {
    if (intencao) {
      intencao.irParaArena();
    }
  },
  [intencao],
);

/**
 * O MAPA DE TESTE, o botao de ir e voltar.
 *
 * Sem argumento, pela mesma razao da arena: o sentido e o destino sao do
 * SERVIDOR. Ele e quem guarda de onde o jogador veio e quem devolve ele
 * para la, entao o botao nunca fica sem acao
 */
const handleTeste = useCallback(
  () => {
    if (intencao) {
      intencao.irParaTeste();
    }
  },
  [intencao],
);

/**
 * O JOGADOR ESTA NA ARENA?
 *
 * E a unica coisa que o botao precisa saber, e ele compara o `mapa` do
 * estado com o id da arena. O id vem do proprio pacote do servidor — nao
 * de um `if` escrito no HUD — entao trocar o nome do mapa no registro e o
 * unico lugar que precisa mudar
 *
 * ## A ARENA E O MAPA DO CHEFE, COM DOIS NOMES
 *
 * `ARENA_ID` e um `export { BOSS_1_ID as ARENA_ID }`: os dois apontam
 * para `boss_1`. Quem le `naArena` no HUD esta lendo "esta no chefe", e
 * nao e coincidencia das duas coisas terem o mesmo mapa — e o mesmo mapa
 *
 * As duas caixas que somem por causa desta linha — a de missoes e a de
 * party — somem no chefe por essa razao, e nao por causa de "arena". Um
 * segundo mapa de boss novo entra na regra de graca, pelo mesmo motivo
 * que um mapa sem `combat` ja e peaceful sem perguntar nada
 */
const naArena = mapa === ARENA_ID;

/**
 * O JOGADOR ESTA NO VALE 1?
 *
 * E o que faz o botao trocar de rotulo: "Entrar no Vale 1" e "Voltar para
 * onde eu estava". O sentido do clique nao vem daqui — vem do servidor,
 * que le o mesmo id — mas o TEXTO do botao e do cliente, e ele precisa
 * saber em que mapa esta para escrever a frase certa
 *
 * O nome do rotulo NAO vem de `map.name`: vem escrito aqui. Sao coisas
 * diferentes, e o rotulo esta escrito para caber em duas linhas de
 * tooltip — `Vale 1` cabe, o nome completo do mapa nao
 *
 * O `id` vem do proprio pacote do servidor (`mapa`), e nao de um valor
 * escrito aqui: trocar o nome no registro de mapas muda os dois lados de
 * uma vez
 */
const naTeste = mapa === MAP_TESTE_ID;

/**
 * ESTE MAPA TEM CRIATURA PARA CAÇAR?
 *
 * O Vale 1 nao tem. E nao e um mapa vazio por descuido: ele declara
 * `zones: []`, e o elenco de criaturas do mundo inteiro sai das zonas. Sem
 * zona nao ha mob, e sem mob nao ha o que o bestiario registre, o que a
 * missao de caca conte e o que a colecao guarde
 *
 * ## POR QUE ISSO ESCONDE TRÊS COISAS E NAO UMA
 *
 * Porque as tres leem a mesma coisa que nao existe. Deixar a box de missoes
 * na tela do Vale 1 mostraria uma lista de objetivos que nenhum mob do mapa
 * cumpre; deixar o botao de bestiario mostraria um painel de criaturas que
 * nunca vao aparecer ali; e a colecao mostraria itens que so se juntam
 * depois de uma caca que nao tem como acontecer
 *
 * ## POR QUE O NOME E SOBRE O DADO E NAO SOBRE O MAPA
 *
 * Porque `naArena` tambem esconde as tres, e o motivo dela e diferente — o
 * chefe e a luta, e a coluna fica limpa para o jogador olhar o combate.
 * Une as duas num `soNaArena` so e um nome que mente para as duas situaçoes,
 * e da proxima vez que um terceiro mapa aparecer sem zona ninguem lembra de
 * acrescentar o id
 */
const semCriaturas = naTeste;

  /**
   * ONDE A PRATELEIRA DESLIGA, sem sumir.
   *
   * ## POR QUE EXISTE
   *
   * Porque os botoes sumiam — `{!naArena && !semCriaturas && (...)}` — e
   * a coluna e uma PRATELEIRA FIXA. Esconder um botao fazia todos os outros
   * subirem de lugar no instante em que o jogador entrava na arena, e ele
   * reaprendia a coluna inteira do zero, no meio da luta
   *
   * ## POR QUE E "DESLIGA" E NAO "ESCOLHE O ALVO"
   *
   * Porque o `title` precisa de uma frase, e a frase muda: na arena o texto
   * e "o bestiario nao abre aqui", no Vale 1 e "o bestiario nao tem o que
   * mostrar aqui". Um so booleano escreveria a frase errada em um dos dois
   * casos
   *
   * E o por que dos dois motivos estao juntos: na arena NAO ha o que fazer,
   * e no Vale 1 ha coisas para fazer que aquele mapa nao cumpre
   */
  const foraDaArena = naArena || naTeste;

/**
 * O NOME DO CHEFE, para a box de saida.
 *
 * Vem do catalogo pelo id que a ARENA declara, e nao e um texto escrito
 * aqui: se o chefe mudar de nome no catalogo, a box passa a dizer o nome
 * novo sem ninguem editar o HUD
 *
 * E `useMemo` com dependencia VAZIA de propósito: o chefe da arena e um
 * dado de CATALOGO, e nao de estado. Nao ha `mapa` aqui dentro porque o
 * `useMemo` guardaria o primeiro nome para sempre, e a box mostraria o
 * chefe de outra arena se o registro mudasse
 */
const nomeChefeDaArena = useMemo(() => {
  const idChefe = findMap(ARENA_ID)?.bosses?.[0]?.creature;

  return CREATURE_TYPES[idChefe]?.name ?? "Chefe";
}, []);

/**
   * TELEPORTAR para o fim da caminhada.
   *
   * O mesmo arranjo do portal e do revive: online quem decide e o
   * servidor. Offline nao ha `intencao`, e um teleporte local moveria o
   * boneco na tela sem gastar o pergaminho — o jogador assistiria ao
   * salto e voltaria com o item inteiro na mochila
   */
  const handleTeleportar = useCallback(
    () => {
      if (intencao) {
        intencao.teleportar();
      }
    },
    [intencao],
  );

  const handleTravelPortal = useCallback(
  (portalId) => {
      if (intencao) {
        /**
         * `atravessarPortal`, com o A.
         *
         * O nome do metodo do objeto de intencao e o do `GameClient`, e
         * nao o deste callback. Escrever `travessarPortal` aqui levanta
         * um `TypeError` DENTRO do handler do React: o erro aparece no
         * console e o clique nao faz nada, sem nenhuma falha na tela
         */
        intencao.atravessarPortal(portalId);
        return;
      }

      engineRef.current?.travessarPortal();
    },
    [engineRef, intencao],
  );

  /**
   * AS DUAS SAIDAS DA MORTE, pelo mesmo caminho do portal.
   *
   * Online quem decide e o servidor; offline quem decide e o motor da
   * tela. Nos dois casos o painel NAO fecha sozinho: quem apaga o
   * painel e o proximo `snapshot`/`sendSnapshot`, com `morte.morto`
   * falso. Fechar aqui seria mentir — se o servidor recusar por falta de
   * ouro, o painel sumiria e o jogador nao saberia por que
   */
const handleReviver = useCallback(
      () => {
      if (intencao) {
      intencao.reviver();
      return;
      }

      engineRef.current?.reviverComOuro();
      },
      [engineRef, intencao],
    );

  /**
   * O RELATORIO DO FARM, e o "Guardar" que fecha.
   *
   * ## POR QUE O RELATORIO SAI DA TELHA AQUI E NAO NO AO VIVO
   *
   * Porque o relatorio precisa sobreviver ao reload do painel. Ele esta no
   * painel, e o painel chega a 4Hz: se o modal escondesse o `relatorio`
   * assim que o jogador fechasse, o proximo painel viria com ele de novo
   * e o modal reabriria sozinho — tres vezes por segundo, para sempre
   *
   * Sao duas fontes controladas pelo MESMO servidor: o painel e a sessao.
   * Esconder o primeiro e pedir para o segundo esquecer sao o mesmo
   * movimento, e so um deles e suficiente
   *
   * ## E POR QUE O `intencao` VEM PRIMEIRO
   *
   * Porque online quem apaga e o servidor, pelo `FARM_OFFLINE_VISTO`.
   * No offline nao ha servidor, e o relatorio simplesmente nao existe: o
   * painel nunca trouxe um. O `intencao` ausente e o sinal de que o
   * caminho online esta em uso
   */
  const [relatorioVisto, setRelatorioVisto] = useState(null);

  const relatorioFarm =
    relatorioVisto ? null : (snapshot?.farmOffline?.relatorio ?? null);

  const handleFecharFarm = useCallback(() => {
    setRelatorioVisto(true);

    /**
     * O NOME CERTO, e ele ja esteve errado uma vez.
     *
     * Esta chamada era `intencao.farmOfflineVisto()`, e o `useGameClient`
     * exporta `viuFarmOffline`. O resultado era `undefined()` — um
     * TypeError dentro do `onClick`, que o React engole — e o servidor nunca
     * recebia o `FARM_OFFLINE_VISTO`
     *
     * O `setRelatorioVisto(true)` vem ANTES, entao o modal fechava na tela
     * e o jogador achava que tinha resolvido. O relatorio continuava na
     * sessao do servidor, e a tela seguinte mostrava de novo — uma vez por
     * login, para sempre
     *
     * E o espelho do bug: fechar o modal e falar "ja vi" para o servidor
     * sao o MESMO gesto. Nao ha estado local que substitua o pedido, porque
     * quem sabe que o jogador viu e o servidor
     */
    if (intencao) {
      intencao.viuFarmOffline?.();
    }
  }, [intencao]);

  const handleVoltarBase = useCallback(
    () => {
      if (intencao) {
        intencao.voltarBase();
        return;
      }

      engineRef.current?.voltarParaBase();
    },
    [engineRef, intencao],
  );

  const handleEquip = useCallback(
    (entry, slotId) => {
      if (intencao) {
        intencao.equipar(entry.uid, slotId);
        return;
      }

      engineRef.current?.equipItem(entry.uid, slotId);
    },    [engineRef, intencao],
  );

  const handleUnequip = useCallback(
    (slotId) => {
      if (intencao) {
        intencao.desequipar(slotId);
        return;
      }

      engineRef.current?.unequipItem(slotId);
    },
    [engineRef, intencao],
  );

  const handleDiscardItem = useCallback(
    (uid) => {
      if (intencao) {
        intencao.descartar(uid);
        return;
      }

      engineRef.current?.discardItem(uid);
    },
    [engineRef, intencao],
  );

  const handleDiscardEquipped = useCallback(
    (slotId) => {
      if (intencao) {
        intencao.descartar(slotId);
        return;
      }

      engineRef.current?.discardEquipped(slotId);
    },
    [engineRef, intencao],
  );

  const handleFilterChange = useCallback(
    (key, value) => {
      const proximo = {
        ...(snapshot?.lootFilter ?? {}),
        [key]: value,
      };

      // Online o filtro e do SERVIDOR: o loot e sorteado la, e o
      // painel volta com o valor do dono. Chamar o motor da tela
      // ajustava um filtro que ninguem lia, e a tela voltava ao
      // normal no proximo pacote
      if (intencao) {
        intencao.filtroDeLoot(proximo);
        return;
      }

      engineRef.current?.setLootFilter(proximo);
    },
    [engineRef, intencao, snapshot],
  );

  const handleFilterReset = useCallback(() => {
    if (intencao) {
      intencao.filtroDeLoot(DEFAULT_LOOT_FILTER);
      return;
    }

    engineRef.current?.setLootFilter(DEFAULT_LOOT_FILTER);
  }, [engineRef, intencao]);

  const handleFilterPrune = useCallback(() => {
    if (intencao) {
      intencao.podarMochila();
      return;
    }

    engineRef.current?.pruneInventory();
  }, [engineRef, intencao]);

  const handleAcceptQuest = useCallback(
    (questId) => {
      // online, o `QuestLog` esta no servidor. aceitar pelo motor da
      // tela nao valeria: o cliente nao tem sessao nem simula, o
      // clique morria aqui e a caixa continuava vazia
      if (intencao) {
        intencao.aceitarMissaoSecundaria(questId);
        return;
      }

      engineRef.current?.acceptSideQuest(questId);
    },
    [engineRef, intencao],
  );

  const handleAbandonQuest = useCallback(() => {
    // mesma razao do aceite
    if (intencao) {
      intencao.abandonarMissaoSecundaria();
      return;
    }

    engineRef.current?.abandonSideQuest();
  }, [engineRef, intencao]);

  const handleFocusQuest = useCallback(
    (questId) => {
      // online, quem guarda o objetivo do piloto e o servidor.
      // chamar o motor da tela nao faria nada: o cliente nao tem
      // sessao nem simula, e o clique morria aqui
      if (intencao) {
        intencao.focarMissao(questId);
        return;
      }

      engineRef.current?.focusQuest(questId);
    },
    [engineRef, intencao],
  );

  const handleToggleQuestAuto = useCallback(() => {
    if (intencao) {
      intencao.alternarAutoMissao();
      return;
    }

    engineRef.current?.toggleQuestAuto();
  }, [engineRef, intencao]);

  /**
   * O [RECEBER] do painel de missoes.
   *
   * Mesmo caminho do aceite e do abandono: online quem paga e o
   * servidor. E o `questId` vai sozinho, porque e ele que localiza a
   * recompensa na fila — o painel nao sabe quanto tem de gold, xp ou
   * item a entregar, e nao deveria saber
   */
  const handleClaimQuestReward = useCallback(
    (questId) => {
      if (intencao) {
        intencao.resgatarRecompensaMissao(questId);
        return;
      }

      engineRef.current?.claimQuestReward(questId);
    },
    [engineRef, intencao],
  );

  /**
   * O RESGATE DE UM DIA DO PASSE.
   *
   * Mesmo caminho do [RECEBER] da missao, e pelo mesmo motivo: quem tem a
   * mochila e a lista de resgates e o motor. Online ele e o do servidor, e
   * sem rede e o da tela
   *
   * O par `passId`/`dia` viaja sozinho. O painel sabe qual dia e de qual
   * passe, mas nao sabe o item nem a quantidade — e nao deve saber, porque
   * quem decide o que o dia paga e o catalogo do servidor
   */
  const handleClaimPassReward = useCallback(
    (passId, dia) => {
      if (intencao) {
        intencao.resgatarDiaDoPasse(passId, dia);
        return;
      }

      engineRef.current?.claimPassReward(passId, dia);
    },
    [engineRef, intencao],
  );

  /**
   * O INTERRUPTOR DO PASSE PREMIUM.
   *
   * O painel manda o valor que ele quer, e nao um "inverter": o botao pode
   * ser apertado duas vezes antes de o primeiro pedido voltar, e inverter os
   * dois deixaria o interruptor como estava
   */
const handleDash = useCallback(
      () => {
        if (intencao) {
          intencao.dash?.();
          return;
        }

        engineRef.current?.useDash();
      },
      [engineRef, intencao],
    );

    /**
     * O TEMPO QUE FALTA PARA O DASH.
     *
     * E o que apaga o icone: o jogador precisa VER o botao apagado, senao ele
     * aperta e nada acontece e conclui que o dash quebrou
     */
    const dashRestante = Math.max(
      0,
      snapshot?.dashRestante ?? 0,
    );

    /**
     * AS TECLAS QUE A HUD ANUNCIA, e elas mudam sozinhas.
     *
     * ## POR QUE SO O DASH E O AUTO AQUI
     *
     * Porque o `SkillSlot` cuida das oito habilidades e da ultimate dentro do
     * proprio componente. Aqui sao dois botoes escritos direto na HUD, e sem
     * esta leitura eles anunciariam a tecla do padrao para sempre
     *
     * O nome longo vai no `data-tip` e o curto vai no quadrado. Sao dois
     * formatos porque o tooltip aceita frase e o quadrado aceita glifo
     */
    const teclaDash = useTeclaDaAcao("dash");

    const teclaAuto = useTeclaDaAcao("auto");

    const handleSetPassPremium = useCallback(
      (ativo, passId = null) => {
        if (intencao) {
          intencao.definirPassePremium(ativo, passId);
          return;
        }

        engineRef.current?.setPassPremium(ativo, passId);
      },
      [engineRef, intencao],
    );

  const handleHuntCreature = useCallback(
    (creatureId) => {
      /**
       * O BOTAO E UM INTERRUPTOR, entao este clique pode ser uma coisa
       * ou a outra.
       *
       * O mesmo botao vira "Parar" quando a criatura ja e o objetivo da
       * cacada, e ai o painel NAO fecha: quem clicou em "Parar" estava
       * olhando o bestiario para gerenciar as cacadas, e fechar embaixo
       * do dedo dele seria uma resposta a um clique que ele nao deu
       *
       * E o `snapshot` que diz qual das duas e, e nao o rotulo do
       * botao: o rotulo e desenho, e o `bestiaryAuto.creatureId` e o
       * que o servidor esta cacando de verdade
       */
      const iaParar = snapshot?.bestiaryAuto?.creatureId === creatureId;

      // online, a cacada mora na SESSAO do servidor. chamar o motor
      // da tela nao valeria: o cliente nao tem sessao nem simula, o
      // clique morria aqui e o piloto nunca ia atras da criatura
      if (intencao) {
        intencao.cacarCriatura(creatureId);
      } else {
        engineRef.current?.toggleBestiaryAuto(creatureId);
      }

      /**
       * "IR MATAR" FECHA O PAINEL, e e o que o jogador quer.
       *
       * Ele acabou de pedir para o personagem andar ate uma zona e
       * comecar a cacar. O painel do bestiario cobre o centro da tela,
       * entao o boneco nao da para ser acompanhado — e a cacada que
       * comeca e o motivo de ter clicado, nao a leitura da lista de
       * criaturas
       *
       * Quem continua sabendo o que esta acontecendo e a
       * `BestiaryAutoBox`, que fica na coluna da esquerda com o nome da
       * criatura e o botao de parar. Fechar o catalogo nao fecha a
       * cacada, e o jogador nao perde o controle
       *
       * O `setPainelAberto` direto e nao o `alternarPainel`: alternar
       * depende de o painel estar aberto, e a garantia de que esta
       * aberto e o proprio `onHunt`. Um `alternar` aqui fecharia o
       * painel errado no dia em que algum outro caminho chamasse o
       * mesmo handler com o bestiario fechado
       */
      /**
       * ESTE PANEL FECHA TAMBEM, E PELO MESMO MOTIVO.
       *
       * O "cacar" chega de dois lugares: o botao do bestiario e o menu do
       * ingrediente no craft. Nos dois o jogador pediu para o boneco andar
       * e comecar a matar, e o painel de craft cobre o centro da tela
       * tanto quanto o de bestiario — o boneco nao da para ser
       * acompanhado em nenhum dos dois
       *
       * E nao fecha em TODO caso: quando o clique e em "Parar", a cacada
       * ja estava rodando e o jogador nao pediu para o boneco ir a lugar
       * nenhum. Fechar o painel embaixo dele seria resposta a um clique
       * que ele nao deu
       *
       * O "ver a receita" NAO passa por aqui: ele navega dentro do craft
       * e o painel tem que continuar aberto
       */
      if (!iaParar) {
        setPainelAberto((atual) =>
          atual === PAINEL.BESTIARIO || atual === PAINEL.CRAFT
            ? null
            : atual,
        );
      }
    },
    [engineRef, intencao, snapshot],
  );

  const handleStopBestiaryAuto = useCallback(() => {
    // mesma razao do pedido de cacada
    if (intencao) {
      intencao.pararCacada();
      return;
    }

    engineRef.current?.clearBestiaryAuto();
  }, [engineRef, intencao]);

  const handleCraftItem = useCallback(
    (recipeId, rarity) => {
      if (intencao) {
        // A raridade vai junto. Ela e o PEDIDO do jogador, e o
        // servidor decide: confere se a receita tem variante
        // naquela raridade e cobra o ingredients e as moedas que
        // ela custa. Antes ela era descartada aqui, e o servidor
        // criava na raridade natural da receita: escolher "rara" na
        // tela produzia um item comum
        intencao.criar(recipeId, rarity);
        return;
      }

      engineRef.current?.craftItem(recipeId, rarity);
    },
    [engineRef, intencao],
  );

  /**
   * Entrega uma colecao.
   *
   * Online vira PEDIDO e nao acao: o motor da tela nao tem sessao
   * para este jogador, entao chamar `deliverCollection` aqui
   * consumiria material de um motor vazio e o servidor nunca receberia
   * a entrega. E o mesmo furo que a missao secundaria e a cacada do
   * bestiario tinham
   */
const handleDeliverCollection = useCallback(
        /**
         * O `indice` e a PARCELA que esta sendo entregue.
         *
         * Sem ele a entrega seria a colecao inteira, e nenhuma parcela poderia
         * ser paga sozinha — que e o que o card faz: cada icone e uma
         * entrega
         */
        (collectionId, indice = null) => {
          if (intencao) {
            intencao.entregarColecao(collectionId, indice);
            return;
          }

          engineRef.current?.deliverCollection(collectionId, indice);
        },
      [engineRef, intencao],
    );

  /**
     * COMPRA um produto da loja.
     *
     * E so REDE, e nao tem a segunda perna que as outras acoes tem.
     *
     * `engineRef.current?.deliverCollection` existe porque a colecao mora no
     * motor, e ele roda no navegador. A loja e diferente: comprar exige
     * cobrar o preco de alguem, conferir o espaco e entregar o conjunto, e
     * o preco vem do catalogo do SERVIDOR. Um `comprarProduto` no motor
     * seria um preco que o cliente escolhe
     *
     * Sem `GameClient` nao ha compra, e o `LojaPanel` nao marca nada — o
     * card continua clicavel e nada acontece. E a resposta honesta para
     * "nao ha loja single player": melhor um botao que nao faz nada do que
     * um botao que finge que vendeu
     */
  const handleComprarLoja = useCallback(
    (produtoId) => {
      if (!intencao) return;

      intencao.comprarProduto(produtoId);
    },
    [intencao],
  );

/**
   * Encanta a peca escolhida.
   *
   * Online vira PEDIDO e nao acao, pelo mesmo motivo da missao
   * secundaria e da cacada do bestiario: o motor da tela nao tem sessao
   * deste jogador, entao chamar `enchantItem` aqui consumiria o ouro de
   * um motor vazio e o servidor nunca receberia o pedido
   *
   * O `alvo` chega `{uid}` para a peca da mochila e `{slotId}` para a
   * que esta vestida. O painel monta o objeto porque ele sabe de onde
   * veio a peca, e o motor escolhe o metodo certo a partir dele
   */
  const handleEnchantItem = useCallback(
    (alvo) => {
      if (intencao) {
        intencao.encantar(alvo);
        return;
      }

      const engine = engineRef.current;

      if (alvo?.slotId) {
        engine?.enchantSlot(alvo.slotId);
        return;
      }

      engine?.enchantItem(alvo?.uid);
    },
    [engineRef, intencao],
  );

  /**
   * O "APRIMORAR" do painel, espelhando o `handleEnchantItem`.
   *
   * ## POR QUE SO `slotId`
   *
   * Porque o `enhance` mora no SLOT. Uma peca da mochila nao tem onde
   * guardar o nivel, entao nao ha caminho de mochila para este botao — a
   * aba lista so o que esta vestido
   *
   * O fallback offline existe pelo mesmo motivo do do encantar: sem
   * `intencao` nao ha servidor, e quem cobra o preco e quem muta o slot
   */
  const handleEnhance = useCallback(
    (alvo) => {
      if (intencao) {
        intencao.aprimorar(alvo);
        return;
      }

      const engine = engineRef.current;

      if (alvo?.slotId) {
        engine?.enhanceSlot(alvo.slotId);
        return;
      }

      engine?.enhanceItem(alvo?.uid);
    },
    [engineRef, intencao],
  );

  /**
   * O "ENCANTAR" da caixa do item: abre o painel JA COM A PECA ESCOLHIDA.
   *
   * E o inverso do caminho normal. Ate aqui o painel de encantar so
   * abria pelo botao do HUD, e o jogador tinha de procurar a peca na
   * lista — que e a lista de tudo que aceita afixo, e nao a peca que ele
   * acabou de apontar com o dedo
   *
   * ## POR QUE A CHAVE VEM DO PROPRIO PAINEL DE ENCANTAR
   *
   * `chave` e exportada de la, e o `HUD` nao reescreve o formato
   * `slot:<id>`/`mochila:<uid>`. Duas copias do mesmo formato divergem no
   * primeiro dia em que alguem mudar, e a falha seria silenciosa: o painel
   * abriria sem nenhuma peca selecionada e o jogador acharia que o
   * "Encantar" nao funciona
   *
   * ## POR QUE O PAINEL DE ENCANTAR ABRE SO, E NAO OS DOIS
   *
   * Inventario e encantar sao o mesmo `PAINEL`: abrir um fecha o outro.
   * O `setPainelAberto` e por isso `PAINEL.ENCHANT` explicito, e nao um
   * alternar — um alternar abriria o encantar e fecharia o inventario
   * nesse mesmo clique, que e o oposto do pedido
   */
  const handleOpenEnchant = useCallback(
    (entry) => {
      setAlvoEncantar(entry ? chave(entry) : null);

      setAbaEncantar("encantar");

      setPainelAberto(PAINEL.ENCHANT);
    },
    [],
  );

  /**
   * O "APRIMORAR" da caixa do item: abre o painel JA COM A PECA ESCOLHIDA E
   * NA ABA DE APRIMORAR.
   *
   * ## POR QUE ELE EXISTE SEPARADO DO `handleOpenEnchant`
   *
   * Porque os dois vao para o MESMO painel e para a MESMA peca — e so a aba
   * que muda. Um handler unico com um parametro "aba" pareceria mais
   * elegante, e criaria uma segunda fonte de verdade: o nome da aba passaria
   * a ser uma string escrita em dois lugares, e trocar o nome de uma delas
   * deixaria o "Aprimorar" do menu abrindo a aba "Encantar" sem erro nenhum
   *
   * ## E POR QUE A ABA VIAJA EM UM ESTADO SEPARADO DA PECA
   *
   * Porque `alvoEncantar` e a PECA e `abaEncantar` e a TELA, e os dois
   * precisam ser limpos juntos ao fechar. Juntar os dois num objeto so faria
   * o `setAlvoEncantar(null)` do `alternarEncantar` deixar a aba pendurada
   */
  const handleOpenEnhance = useCallback((entry) => {
    setAlvoEncantar(entry ? chave(entry) : null);

    setAbaEncantar("aprimorar");

    setPainelAberto(PAINEL.ENCHANT);
  }, []);

  /**
   * O BOTAO DO PAINEL DE ENCANTAR, e o X DELE.
   *
   * ## UM SO METODO PARA OS DOIS, E ELE ALTERNA
   *
   * Este metodo nasceu como `fecharEncantar`, que so sabia fechar — e o
   * botao do HUD deixou de ABRIR o painel. O `setPainelAberto` recebia
   * `atual === PAINEL.ENCHANT ? null : atual`, entao com o painel fechado
   * (`atual` nulo) o ternario devolvia `atual` e o clique nao fazia nada.
   * O painel nao abriu mais e nao dava erro nenhum
   *
   * Alternar e o que resolve os dois usos, porque eles sao o mesmo gesto:
   * clicar no botao com o painel fechado abre, com ele aberto fecha, e o
   * X do painel cai no mesmo caso de "aberto". Um metodo so e a forma de
   * os dois nunca divergirem
   *
   * ## POR QUE LIMPAR A PECA PEDIDA
   *
   * O `setAlvoEncantar(null)` e o que impede a peca do ultimo "Encantar"
   * de ficar guardada no `HUD` e reaparecer na abertura seguinte pelo
   * botao — que nao tem peca nenhuma. O jogador veria uma selecao que
   * nao fez
   */
  const alternarEncantar = useCallback(() => {
    setAlvoEncantar(null);

    setAbaEncantar(null);

    setPainelAberto((atual) =>
      atual === PAINEL.ENCHANT ? null : PAINEL.ENCHANT,
    );
  }, []);

  /**
   * As tres acoes do MARKET.
   *
   * Online todas vao por pedido, e SEMPRE: o mercado e o unico lugar
   * onde o dinheiro de um jogador muda de mao, e isso tem de passar pelo
   * servidor. No single player nao ha `marketStore` no motor, entao o
   * caminho offline nao existe — e o painel vem vazio, o que o jogador
   * ve na aba de comprar
   */
  /**
   * Anunciar um item da mochila.
   *
   * O `MarketPanel` chama o `onList` com UM OBJETO (`{ uid, price,
   * count }`), e nao com argumentos soltos. Os tres campos agora viajam
   * juntos, e um pedido com tres posicoais quebraria no primeiro campo
   * novo — que e exatamente o que aconteceu: o `uid` chegava como
   * objeto, o `parsePanel` o descartava, e o servidor respondia "Voce nao
   * tem esse item" para um item que o jogador estava vendo na mochila
   *
   * A quebra de linha e a traducao para os argumentos posicionais do
   * `GameClient`, que e quem escreve no socket
   */
  const handleListItem = useCallback(
    (pedido) => {
      if (intencao) {
        intencao.listarNoMarket(
          pedido?.uid,
          pedido?.price,
          pedido?.count,
        );
      }
    },
    [intencao],
  );

  const handleBuyItem = useCallback(
    (listingId) => {
      if (intencao) {
        intencao.comprarNoMarket(listingId);
      }
    },
    [intencao],
  );

  const handleCancelListing = useCallback(
    (listingId) => {
      if (intencao) {
        intencao.cancelarNoMarket(listingId);
      }
    },
    [intencao],
  );

  /**
   * COMPRA uma pocao na loja do mercador.
   *
   * So online. Offline nao ha `intencao`, e o painel aparece do mesmo
   * jeito — o que significa que o botao fica sem efeito no offline.
   * E o mesmo arranjo dos outros handlers acima, e pelo mesmo motivo:
   * quem cobra e o servidor, e um motor local aqui inventaria uma
   * compra que ninguem pagou
   */
  const handleBuyPotion = useCallback(
    (itemId, count) => {
      if (intencao) {
        intencao.comprarPocao(itemId, count);
      }
    },
    [intencao],
  );

  /**
   * COMPRA um livro de habilidade com o Mestre.
   *
   * Manda o `itemId` do LIVRO e nao o da skill: e o livro que tem preco,
   * e o servidor e quem descobre a skill por ele. Sem preco no pedido
   * pelo mesmo motivo do `handleBuyPotion` — o cliente nao escolhe quanto
   * paga
   */
  const handleBuySkillBook = useCallback(
    (itemId) => {
      if (intencao) {
        intencao.comprarLivro(itemId);
      }
    },
    [intencao],
  );

  /**
   * GUARDA OU RETIRA um item do bau.
   *
   * ## POR QUE UM HANDLER E NAO DOIS
   *
   * Porque os dois botoes do painel mandam a MESMA informacao com a acao
   * trocada, e o `acao` ja vem pronto do painel: ele quem sabe de que lado
   * a peca esta, olhando a coluna de onde o jogador clicou. Um
   * `handleGuardar` e um `handleRetirar` seriam o mesmo codigo duas vezes
   *
   * ## E POR QUE SO ONLINE
   *
   * Porque o `intencao` e o que existe quando ha servidor. No single
   * player o painel do bau nao abre: o bau e um NPC do mapa da base, e o
   * modo offline nao tem o `PAINEL.BAU` ligado a um botao. Se um dia
   * abrir, e este bloco que ganha o `engineRef` do lado de la
   *
   * O `dados` chega como `{ uid, quantidade }`, e o `undefined` de
   * quantidade e o pedido de "a pilha inteira". O motor le assim, e
   * converter para `0` aqui faria todo deposito ser recusado
   */
  const handleMoverNoBau = useCallback(
    (acao, dados) => {
      if (intencao) {
        intencao.mexerNoBau(acao, dados);
      }
    },
    [intencao],
  );


  /**
   * USA um consumivel da mochila: a pocao.
   *
   * O `uid` vem do slot, e nunca do item. Duas pocoes de raridades
   * diferentes sao DUAS pilhas com o mesmo `itemId`, e um pedido
   *mandando o id curaria a pilha errada
   */
  const handleUseItem = useCallback(
    (entry) => {
      const uid = entry?.uid ?? entry;

      if (!uid || !intencao) return;

      intencao.usarItem(uid);
    },
    [intencao],
  );

  /**
   * Equipa o item no slot onde ele tem que ficar.
   *
   * Antes isto escolhia "o primeiro slot que aceita o tipo". Com
   * `head`, `chest` e `legs` aceitando todos `ARMOR`, isso vestia
   * uma bota na cabeca e um gibao num slot de cabeca, conforme a
   * ordem do boneco. E o destino passou a ser o slot que o proprio
   * item declara
   */
  const equipInItsSlot = useCallback(
    (entry) => {
      /**
       * ONLINE, O SERVIDOR ESCOLHE O SLOT.
       *
       * Este handler era o UNICO do inventario sem o caminho de rede:
       * os outros quinze pedem ao servidor primeiro e so usam o motor da
       * tela quando nao ha `intencao`. Aqui nao havia nenhum dos dois, e
       * o motor do cliente nao simula nada — `slotFor` devolvia um id e o
       * `equipItem` nao tinha mundo para colocar a peca. Online, "Equipar"
       * nao fazia nada e nao dava erro nenhum
       *
       * O slot vai no pedido porque o CLIENTE nao pode escolher: aceitar
       * um `slotId` de fora deixaria qualquer um vestir uma peca em um
       * slot que ela nao aceita. O servidor confere contra o catalogo e
       * decide — e o mesmo caminho do `unequip`
       */
      if (intencao) {
        intencao.equipar(entry.uid, entry.slotId ?? null);
        return;
      }

      const engine = engineRef.current;

      if (!engine) return;

      const destino = engine.slotFor(entry.itemId);

      if (!destino) return;

      engine.equipItem(entry.uid, destino);
    },
    [engineRef, intencao],
  );

  const player = snapshot?.player ?? {
    name: characterName ?? classDefinition.name,
    className: classDefinition.name,
    level: 1,
    hp: classDefinition.stats.hp,
    maxHp: classDefinition.stats.hp,
    resource: classDefinition.stats.resource,
    maxResource: classDefinition.stats.resource,
    resourceName: classDefinition.resource.name,
    resourceColor: classDefinition.resource.color,
    shield: 0,
    attack: classDefinition.stats.attack,
    defense: classDefinition.stats.defense,
    speed: classDefinition.stats.speed,
    statusEffects: [],
    casting: false,
  };

  const cooldowns = snapshot?.cooldowns ?? {};
  const visibleSkills = skillPages[page] ?? [];

  /**
   * AS HABILIDADES QUE O PERSONAGEM APRENDEU, como `Set`.
   *
   * Vem do painel do servidor. `null` enquanto nao chegou, e um `Set`
   * depois — e a distincao importa: `null` quer dizer "a tela ainda nao
   * sabe", e nenhum slot aparece trancado nesse estado. Com um array
   * vazio o jogador veria as quatro trancadas no primeiro quadro e
   * acharia que perdeu o repertorio inteiro
   */
  const habilidadesAprendidas = useMemo(() => {
    const lista = snapshot?.habilidadesAprendidas;

    if (!Array.isArray(lista)) return null;

    return new Set(lista);
  }, [snapshot?.habilidadesAprendidas]);

  /**
   * A POCAO EQUIPADA NO SLOT DA BARRA.
   *
   * E o `getItem` do catalogo pelo `itemId` que o servidor mandou, e nao a
   * arte guardada no inventario. A diferenca importa quando o jogador larga
   * a pocao no bau: o `itemId` continua no `autoPocao`, e o slot continua
   * mostrando qual era. Se o slot procurasse a pitha no inventario, ele
   * esvaziaria do nada e o jogador acharia que perdeu a configuracao
   *
   * O `getItem` devolve `null` para um id que nao existe, e e por isso que
   * `itemDaPocao` pode ser `null`: um save antigo ou um arquivo editado a
   * mao com `itemId: "arco"` mostraria o slot vazio em vez de uma arte
   * quebrada
   */
  const itemDaPocao = useMemo(() => {
    const itemId = snapshot?.autoPocao?.itemId;

    if (!itemId) return null;

    return getItem(itemId) ?? null;
  }, [snapshot?.autoPocao?.itemId]);

  const pocaoEquipada = itemDaPocao !== null;

  const nomeDaPocao = itemDaPocao?.name ?? "Poção";

  const summary = snapshot?.inventory ?? {
    coins: 0,
    used: 0,
    capacity: 20,
    isFull: false,
    items: [],
  };

  const autoOn = Boolean(snapshot?.autoPlay);
  const engaged = Boolean(snapshot?.engaged);

  const temAlvo = Boolean(snapshot?.selectedTarget);

  /**
   * A MOEDA ESPERA 2 SEGUNDOS DEPOIS DO ALVO SUMIR.
   *
   * ## POR QUE ESPERA
   *
   * Porque durante uma luta o alvo pisca. Ele morre, o alvo some, e o
   * jogador mira o proximo bicho no meio dessa fresta — normalmente em
   * menos de um segundo. Sem a espera, a moeda apareceria e desapareceria
   * varias vezes numa luta so, e o alto da tela piscaria a cada morte
   *
   * ## POR QUE A MOEDA ESCONDE NA HORA E A ESPERA SÓ NO VOLTA
   *
   * O outro sentido e o que importa: quando ha alvo, a moeda some
   * IMEDIATAMENTE. O alvo e a informacao urgente e o dinheiro nao e, e
   * esperar 2s para tirar a moeda mostraria as duas empilhadas no alto da
   * tela durante a troca
   *
   * ## POR QUE O EFEITO USA `temAlvo` E NAO O ALVO
   *
   * `selectedTarget` e um objeto novo a cada snapshot, e um objeto no
   * array de dependencia reinicia o timer a 20 quadros por segundo. O
   * booleano so muda quando a presenca do alvo muda, que e o que a regra
   * quer
   */
  const [moedasVisiveis, setMoedasVisiveis] = useState(false);

  useEffect(() => {
    if (temAlvo) {
      setMoedasVisiveis(false);
      return undefined;
    }

    const timer = setTimeout(
      () => setMoedasVisiveis(true),
      MOEDAS_VOLTAM_EM_MS,
    );

    return () => clearTimeout(timer);
  }, [temAlvo]);

  return (
    <div className="hud">
      <section className="hud-vitals">
        <header className="hud-vitals__head">
          <span className="hud-lv">
            Lv.{player.level}
          </span>

          {/*
            O NOME EM CIMA E A CLASSE EMBAIXO, e as duas coisas em bloco.

            ## POR QUE BLOCO E NAO LINHA

            Porque sao duas informacoes de naturezas diferentes: o nome e
            de identidade — quem voce e — e a classe e de papel — o que voce
            faz. Na mesma linha o jogador le "ArbalistFantasma" e nao sabe
            onde acaba um e comeca o outro, porque nao ha separacao entre as
            palavras alem do espaco

            Em dois blocos o olho le de cima para baixo: primeiro QUEM, so
            depois O QUE. E o espaco entre o nivel e os dois e o que separa
            o numero do personagem do nome dele — sem ele, `Lv.3` e
            `Arbalista` parecem a mesma informacao emeca

            ## POR QUE A CLASSE CONTINUA DENTRO DO `span` DO NOME

            Porque o `title` precisa dos dois, e o `title` esta no `span`
            de fora. Se a classe saisse do elemento, o `title` passaria a
            mostrar so o nome, e o jogador que passasse o mouse veria menos
            do que ve hoje

            ## POR QUE O `small` E O ELEMENTO DA CLASSE

            Porque o navegador ja diminui e clareia o `small`, e a classe e
            mesmo uma informacao secundaria do mesmo sujeito. O `strong`
            por cima deixa claro qual dos dois e o nome, sem precisar de
            nenhuma classe nova
          */}
          <span
            className="hud-vitals__name"
            data-tip={`${player.name} · ${player.className}`}
          >
            <strong>{player.name}</strong>
            <small>{player.className}</small>
          </span>
        </header>

        {/*
          ATQ, DEF E VEL SAIRAM DAQUI.

          Eles foram para o rodape, acima das barras de HP e recurso. Sao
          os mesmos tres numeros, com o mesmo valor do motor — a unica
          mudanca e onde o jogador os le

          O `Vitals` de cima continua com HP e recurso: sao numeros que
          mudam a cada golpe e ficam bem ao lado do bloco de vida. Nao
          havia razao para duplica-los no rodape tambem
        */}

        <button
          type="button"
          className={[
            "hud-pouch",
            summary.isFull ? "is-full" : "",
            painelAberto === PAINEL.INVENTARIO ? "is-open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => openInventory()}
          data-tip="Inventário (I)"
        >
        {/*
          A MOEDA SAIU DA BOLSA.

          Era aqui que o dinheiro aparecia, dentro do botao da mochila ao
          lado dos slots. O pedido e levar para o alto central, no lugar do
          alvo

          ## POR QUE FICOU "MOCHILA" E OS SLOTS, E NAO SO OS SLOTS

          Com a moeda fora, o numero `3/20` ficava sozinho e nao dizia o
          que era. O rotulo e o nome da coisa: e o contador de espaco da
          mochila

          ## POR QUE SAO DOIS FILHOS DIRETOS, E NAO UM BLOCO SO

          Porque o `.hud-pouch` ja e `flex` com `justify-content:
          space-between`, feito para dois filhos — a moeda a esquerda e os
          slots a direita. Com o rotulo a esquerda e o contador a direita,
          o proprio botao faz o espacamento e nenhum `margin-left: auto` e
          preciso
        */}
        <span className="hud-pouch__label">Mochila</span>

        <span className="hud-pouch__slots">
          {summary.used}/{summary.capacity}
        </span>
      </button>

        {player.shield > 0 && (
          <span className="hud-vitals__shield">
            ESCUDO {player.shield}
          </span>
        )}

        {/*
          A POSICAO NO MAPA, na coluna da esquerda.

          Fica DENTRO do bloco de vida, e nao como irmao dele, por uma
          razao pratica: o bloco e `position: absolute` com `top: 12px` e
          a altura dele muda conforme o que tem dentro — nome, barras, a
          linha de ATQ/DEF/VEL, a bolsa e o escudo. Como irmao, este
          mostrador precisaria de um `top` com numero magico para passar
          por baixo do card, e esse numero estari errado na hora que
          alguem adicionasse uma linha la dentro

          Dentro, ele acompanha o reflow sozinho e some nunca. E a linha
          do ATQ/DEF/VEL ja e um bloco de numeros do personagem entao,
          entao a posicao fica no mesmo lugar sem parecer adesivo
          * colado por cima

          E um `<output>`, e nao um `<div>` com texto: e um valor, e um
          leitor de tela anuncia a mudanca sem interromper o jogador

          Some quando nao ha coordenada: o painel pode chegar antes do
          primeiro `snapshot` com posicao, e "X undefined" e pior do que
          nada
        */}
        {/*LOC AQUI*/}
        {/* {Number.isFinite(player.x) &&
          Number.isFinite(player.y) && (
            <output className="hud-coords">
              X {player.x} · Y {player.y}
            </output>
          )} */}
</section>

{/*
          O STATUS, PRIMEIRO DA COLUNA, E A ARENA AO LADO DELE.

          ## POR QUE A ARENA ABRE AQUI E NAO DEPOIS DA COLECAO

          E o pedido, e porque ela e o unico botao desta coluna que VIRA DE
          MAPA. Status, Encantar, Bestiario e Colecao sao paineis: clicou,
          abriu, e o lugar nao importa. A arena e viagem — o clique leva
          para outro mapa — e e o botao que mais precisa de um lugar FIXO
          na tela, porque o jogador procura "onde eu clico para sair daqui"
          e um botao que troca de linha conforme os outros somem obriga ele
          a procurar de novo

          ## POR QUE A ORDEM E STATUS, ENCANTAR, BESTIARIO, COLECAO

          E do mais interno para o mais externo: Status e o numero do
          personagem, Encantar e a transformacao da peca, Bestiario e o que
          eu cacei, Colecao e o que eu entreguei. Nao e alfabetico nem de
          frequencia de uso

          O `✧` do Encantar e o glifo escrito a mao, e nao um `HudIcon`,
          porque o botao nasceu com ele e so falta a arte: um id no
          `hudIcons.js` sem PNG faria o teste de catalogo ler um arquivo que
          nao existe
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--status",
            painelAberto === PAINEL.STATUS ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.STATUS)}
          data-tip="Status (P)"
          aria-label="Abrir o painel de status"
        >
          <HudIcon iconId="stats" />
        </button>

        {/*
          A OFICINA, NA SEGUNDA COLUNA, ACIMA DO CHEFE.

          ## POR QUE DUAS COLUNES E NAO UMA

          Porque sao sete botoes e a box do personagem tem um lado livre de
          uma so fileira. Duas colunas de tres e quatro cabem na mesma faixa
          de altura que uma de sete — e sete botoes empilhados chegariam
          quase na barra de acoes

          A coluna da esquerda e a ORDEM DE LEITURA do pedido: Status,
          Encantar, Bestiario, Colecao. A da direita e a de quem faz e de
          onde se chega: Oficina, Chefe, Guilda

          ## POR QUE A OFICINA E O CHEFE ESTAO JUNTOS

          Porque os dois sao o que o jogador FAZ: a oficina transforma
          material em peca, e a arena e a luta. Ficando vizinhos, o jogador
          le "onde eu produzo" e "onde eu uso" como o mesmo par de coisas,
          e nao como botoes soltos no meio da tela
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--craft",
            painelAberto === PAINEL.CRAFT ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.CRAFT)}
          data-tip="Craft (C)"
          aria-label="Abrir o craft"
        >
          <HudIcon iconId="craft" />

          {/*
            O PONTO VERMELHO, e nao o numero de receitas.

            A condicao e a mesma que era: `craft.ready > 0`. O que muda
            e o que o jogador le no canto do botao. O numero dizia QUANTAS
            receitas estao prontas, e essa quantidade e uma informacao que
            o jogador so usa dentro do painel — no icone ela vira um
            numero pequeno que da para ler de relance e nao ajuda em nada

            O ponto responde a uma pergunta mais curta, que e a unica que
            faz sentido fora do painel: "tem alguma coisa pra eu fazer
            aqui?". Um, tres ou doze itens nao muda a decisao do jogador,
            entao o numero sumiu e sobrou o sinal

            ## O PORQUE DE SER VERMELHO, E NAO DOURADO

            O dourado da fileira e o `--gold`, e ele marca ESTADO DE
            PAINEL: o `is-active` de um botao aberto usa a mesma cor. Um
            aviso novo com a cor de "voce ja esta aqui" se confunde com o
            botao aberto, e o vermelho nao e usado em lugar nenhum da HUD
            — e a cor que sobrou para "algo te esperando"
          */}
          {craft && craft.ready > 0 && <i className="hud-btn__dot" />}
        </button>

        {/*
          A ARENA DO CHEFE SAIU DA PRATELEIRA.

          ## POR QUE

          Porque o chefe virou a ultima missao do mapa 1, e a `PortalBox` ja
          oferece "Enfrentar o chefe" no portal selado. Um botao na prateleira
          seria a segunda porta para a mesma arena, e as duas iam aparecer em
          mapas diferentes: a do portal so enquanto o portal esta selado, e
          esta aqui sempre

          O jogador clica num lugar e o jogo responde. Com os dois, ele clicava
          aqui e a campanha ainda nao servia de nada — a arena estava vazia de
          conteudo util ate a missao do chefe ser a proxima

          E a volta: la dentro nao ha portal, e antes deste botao o `BossBox`
          era a saida. Quem entra pelo portal e trava, a nao ser morrendo
        */}

        {/*
          A GUILDA, ABAIXO DO CHEFE.

          ## POR QUE VOLTOU PARA A COLUNA DO PERSONAGEM

          A guilda estava aqui antes de ir para a prateleira, e agora ela
          fecha a segunda coluna. Os sete botoes das duas colunas sao
          entao: os quatro da esquerda respondem "como eu estou" e os
          tres da direita respondem "o que eu faco e com quem" — e a guilda
          e a ponte entre os dois, porque o talento dela muda o stat do
          personagem

          Nao leva `!semCriaturas`: o Vale 1 nao tem criatura, mas tem
          gente, e esconder o escudo de quem o jogador e parte nao faria
          nenhum sentido
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--guild",
            painelAberto === PAINEL.GUILD ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.GUILD)}
          data-tip="Guilda (G)"
          aria-label="Abrir o painel de guilda"
        >
          <HudIcon iconId="guild" />
        </button>

        <button
            type="button"
            className={[
              "hud-btn",
              "hud-btn--teste",
              naTeste ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={handleTeste}
            disabled={!intencao}
            data-tip={
              naTeste
                ? "Voltar para onde eu estava"
                : "Entrar no Vale 1"
            }
            aria-label={
              naTeste
                ? "Voltar do Vale 1"
                : "Entrar no Vale 1"
            }
          >
            {/*
              A ARTE MUDA COM O SENTIDO DO BOTAO.

              `naTeste` vem do pacote do servidor: dentro do Vale 1 o
              botao vira SAIR, e ele mostra a `sair`. Fora dele mostra a
              `teste`, a prancheta de entrar

              E o `is-active` que pinta a cor: roxo fora, vermelho dentro. A cor
              segue o sentido do glifo em vez de contradize-lo
            */}
            <HudIcon iconId={naTeste ? "sair" : "teste"} />
          </button>

        {/* O ENCANTAMENTO, SEGUNDO DEGRAU DA PRIMEIRA COLUNA. */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--test",
            painelAberto === PAINEL.ENCHANT ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={alternarEncantar}
          data-tip="Encantar (X)"
          aria-label="Abrir o painel de encantamento"
        >
          ✧
        </button>

        <BuffStrip effects={player.statusEffects} />

        {/*
          O BESTIARIO E A COLECAO, OS DOIS ULTIMOS DEGRAUS.

          ## POR QUE OS DOIS SOMEM NO VALE 1 E NA ARENA PELA MESMA REGRA

          Porque `ARENA_ID` e `BOSS_1_ID`, e porque o Vale 1 nao tem
          `zones`. Nos tres lugares nao ha criatura: dentro da arena o
          jogador esta na luta, e no Vale 1 nao ha nem mob nem zona. O
          bestiario apontaria para um catalogo que o jogador nao consegue
          encontrar ali, e a box de missoes — que ja some pela mesma regra —
          e o mesmo convite sem resposta

          ## POR QUE A COLECAO FICOU NESTA COLUNA E NAO NA PRATELEIRA

          Porque os quatro botoes daqui sao "o que eu sou e o que eu
          tenho", e a colecao era a unica dessa lista que ainda estava na
          prateleira da direita. Com ela aqui, a coluna do personagem fica
          com os quatro paineis de leitura propria, e a prateleira sobra
          so para consulta de fora
        */}
          {/*
            O BESTIARIO, pelo mesmo motivo da arena: desabilitado e nao
            escondido. O mapa sem criaturas e o unico caso em que ele nao
            abre, e a prateleira nao pode pular por causa disso
          */}
          <button
            type="button"
            className={[
              "hud-btn",
              "hud-btn--bestiary",
              painelAberto === PAINEL.BESTIARIO ? "is-active" : "",
              foraDaArena ? "is-bloqueado" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => alternarPainel(PAINEL.BESTIARIO)}
            disabled={foraDaArena}
            data-tip={
              foraDaArena
                ? "O bestiario nao abre dentro da arena"
                : "Bestiario (B)"
            }
            aria-label="Abrir o bestiario"
          >
            <HudIcon iconId="bestiario" />
          </button>

          {/*
            A COLECAO, desabilitada em vez de escondida, pelo mesmo motivo
            dos outros dois. E o ponto vermelho some junto com o clique: um
            sinal em cima de um botao que nao faz nada e o jogador seguindo
            uma promessa quebrada
          */}
          <button
            type="button"
            className={[
              "hud-btn",
              "hud-btn--collection",
              painelAberto === PAINEL.COLECAO ? "is-active" : "",
              foraDaArena ? "is-bloqueado" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => alternarPainel(PAINEL.COLECAO)}
            disabled={foraDaArena}
            data-tip={
              foraDaArena
                ? "A colecao nao abre dentro da arena"
                : "Colecao (K)"
            }
            aria-label="Abrir a colecao"
          >
<HudIcon iconId="collection" />

              {/*
                O PONTO VERMELHO, e e o MESMO `hud-btn__dot` do craft.

                ## A MESMA REGRA, E O MESMO SINAL

                O craft pergunta "tem alguma coisa pra eu fazer aqui?" e o
                ponto vermelho responde. A colecao faz a MESMA pergunta com
                outra palavra: "tem alguma entrega que eu posso fechar?". Um,
                tres ou doze itens nao muda a decisao, entao o sinal e o mesmo
                e nao um numero

                ## POR QUE O `pronta` DO CARD SERVE AQUI

                Porque `pronta` ja e a pergunta certa, calculada no motor: a
                colecao tem ALGUMA parcela com material suficiente e nenhuma
                entrega feita nela. E o que evita a HUD contar parcela por
                parcela — a contagem ficaria com dois lugares que podem
                divergir, e o ponto sumiria ou apareceria sozinho

                E nao e `done`: uma colecao entregue nao tem nada a oferecer,
                e o `done` e exatamente o oposto do que o ponto avisa
              */}
                {!foraDaArena &&
                  collection?.entries?.some((e) => e.pronta) && (
                    <i className="hud-btn__dot" />
                  )}
            </button>

        {/*
          A COLUNA DA DIREITA COMECA AQUI.

          ## POR QUE NAO ABRE ANTES DOS BOTOES DO PERSONAGEM

          Porque Status, Encantar, Bestiario, Colecao e a arena NAO
          pertencem a esta coluna. Eles ficam na esquerda, ao lado da box de
          nivel, nick e classe, e se posicionam por `left` e `top`
          calculados com `--vitals-w`. A prateleira e flex, e um botao
          `absolute` dentro dela nao encontraria lugar
        */}
        <div className="hud-coluna-dir">
          <nav className="hud-menu">
        {/*
          O MARKET, primeira caixa da prateleira de consulta.

          ## POR QUE E A PRIMEIRA

          Porque troca e o que o jogador faz mais no mercado: comprar e
          vender sao as duas acoes de sempre. A colecao que ficava aqui
          saiu para a coluna do personagem, e a guilda entrou no lugar dela

          A prateleira e o que o jogador CONSULTA fora de si mesmo. O que
          responde "como eu estou" — Status, Encantar, Bestiario, Colecao —
          mora ao lado do personagem, na coluna da esquerda
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--market",
            painelAberto === PAINEL.MARKET ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.MARKET)}
          data-tip="Market (M)"
          aria-label="Abrir o mercado"
        >
          <HudIcon iconId="market" />
        </button>

        {/*
          A LOJA, AO LADO DO MERCADO.

          ## POR QUE VIZINHA E NAO EM QUALQUER OUTRO LUGAR

          E o pedido, e porque as duas sao "onde eu compro e vendo". Com os
          dois na mesma ponta da prateleira, o jogador que quer comprar
          olha para um lado e ve as duas vitrines — sem isso, a loja numa
          ponta e o mercado na outra obrigariam ele a varrer a tela
          comparando duas coisas que ele ja sabe que sao diferentes

          ## POR QUE ESTA E NAO A `PAINEL.POCOES`

          Porque a loja do mercador so existe com o NPC na tela: e o
          catalogo de pocoes em cima do balcao. Esta e a loja geral, e
          existe justamente para o jogador comprar sem depender de ninguem
          estar de pe na frente

          ## POR QUE `is-active` E NAO O `disabled` DA INTENCAO

          Porque abrir painel e acao LOCAL: nao viaja, nao fala com o
          servidor, e funciona offline. Os botoes que precisam de rede
          carregam `disabled={!intencao}`; este nao tem por que — pelo
          mesmo motivo do mercado, que tambem nao usa
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--loja",
            painelAberto === PAINEL.LOJA ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.LOJA)}
          data-tip="Loja"
          aria-label="Abrir a loja"
        >
          <HudIcon iconId="loja" />
        </button>

        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--rank",
            painelAberto === PAINEL.RANK ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.RANK)}
          data-tip="Rank (L)"
          aria-label="Abrir o rank"
        >
          <HudIcon iconId="rank" />
        </button>

        {/*
          A CONFIGURACAO, no fim da fila.

          E o botao da engrenagem, e ele ABRE o pause — a mesma cortina
          que a ESC abre. Nao ha um painel de configuracao proprio:
          quem sai do personagem e quem continua esta no pause, e fazer
          um segundo menu com as mesmas duas opcoes seria uma escolha
          sem motivo

          E O MAPA DE TESTE, AO LADO DO DE ENCANTAR

          Ate a coluna do personagem tinha sete botoes; este e o oitavo, e
          o unico dos dois lados da prateleira que NAO abre painel. Ele so
          existe porque da para precisar de um mapa vazio com o tamanho
          do vale, e um mapa sem portal so e alcancavel por um botao

          Sem `position` no grupo de cima de proposito: os botoes de
          painel ficam no fluxo, e os da coluna usam `left`/`top` com
          `--vitals-w`. Este nao usa nenhum dos dois, porque esta no fluxo
          da prateleira e nao na coluna do personagem

          E o ULTIMO da fila de proposito. Os botoes da frente sao
          consulta de progresso — o que eu cacei, o que eu tenho, o que
          eu virei — e a engrenagem e acao sobre o jogo. Um botao de
          acao no meio da fila de consulta faria o jogador abrir um
          menu para sair no meio de um numero de badge

          Nao alterna: ele ABRE. Fechar e o "Continuar" dentro do
          pause, e a ESC. Um botao que fechasse e abrisse o pause
          pareceria travado, ja que o veu cobre a tela e o jogador
          quase nunca chega nele com o cursor
        */}

          {/*
            O PASSE, AO LADO DA CONFIGURACAO.

            ## POR QUE VIZINHO DA ENGRENAGEM

            E o pedido. A engrenagem e o botao de ACAO sobre o jogo — pausa,
            ajusta e sai — e o passe e o painel que mais se parece com ela
            entre os que nao mexem no personagem: os dois sao coisas de
            SISTEMA, e nao de progresso nem de viagem

            ## POR QUE ANTES DO VALE 1 E NAO DEPOIS

            Porque o Vale 1 e o botao que troca de glifo e de cor conforme o
            mapa: `⌗` roxo fora, `⇥` vermelho dentro. Ele fica na ponta da
            prateleira de proposito, e um botae que muda de aparencia no
            meio da fila faz o olho procurar o que mudou. Entre a
            configuracao e ele, o passe e a constante

            ## POR QUE ELE APARECE EM TODOS OS MAPAS

            Porque a temporada nao e de lugar nenhum: ela vale no Vale 1 tanto
            quanto no campo e na arena. Um botae que sumisse no Vale 1 faria
            o jogador pensar que o passe era do mapa, e ele nao e

            ## POR QUE `is-active` E NAO O `disabled` DA INTENCAO

            Porque abrir painel e acao LOCAL: nao viaja, nao fala com o
            servidor, e funciona offline. Os botoes que precisam de rede
            carregam `disabled={!intencao}`; este nao tem por que
          */}
          <button
            type="button"
            className={[
              "hud-btn",
              "hud-btn--passe",
              painelAberto === PAINEL.PASSE ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => alternarPainel(PAINEL.PASSE)}
            data-tip="Passe"
            aria-label="Abrir o passe"
          >
            <HudIcon iconId="passe" />
          </button>

          {/*
            O VALE 1, AO LADO DA CONFIGURACAO.
            ## POR QUE VIZINHO E NAO EMPILHADO

            Porque e o pedido, e porque os dois botoes ficam do mesmo tipo
            lado a lado na prateleira. Empilhar os dois exigia um container
            vertical no meio de um flex na horizontal, e essa parede ficava
            comvida conforme os botoes de consulta sumiam — na arena e no
            Vale 1 a prateleira encurta, e a parede mudava de lugar na tela
            sem ninguem mexer nela

            ## POR QUE AO LADO DA ENGRENAGEM E NAO NO MEIO

            A configuracao e o botao de ACAO sobre o jogo — pausa, ajusta e
            sai — e o Vale 1 e a unica viagem que existe. Os dois ficam na
            ponta direita da prateleira, e a de consulta (bestiario, mercado,
            colecao, oficina, rank) fica antes deles

            ## POR QUE ELE NAO E UM PAINEL

            Porque ele vai para um mapa e volta. Os outros botoes desta
            prateleira abrem painel, e nao ha `PAINEL` para este nem painel
            para fechar. Ele tambem nao tem atalho: os onze botoes com tecla
            sao painel, e dar uma tecla a um botao de viagem faz o jogador
            esperar painel onde nao ha nenhum

            ## O ROTULO MUDA, E E O MAPA QUE DECIDE

            `naTeste` vem do pacote do servidor. Ver o mesmo botao dizer
            "Entrar" e "Voltar" e o que diz que o segundo clique tem
            destino: sem a frase trocada, um botao que faz duas coisas
            parece um botao quebrado
          */}
          

          {/*
            A CONFIGURACAO DA PRATELEIRA, e ela ABRE O PAUSE de novo.

            ## POR QUE ISTO VOLTOU AO PAUSE

            Porque a configuracao que o jogador procura — volume, tela cheia,
            resolucao — e a que fica na barra de skills, ao lado do tiro. Sao
            DUAS engrenagens que se confundem, e elas nao podem abrir a mesma
            coisa

            A de cima e sobre o PERSONAGEM: sair do personagem, ou continuar.
            Quem clica nela quer sair do jogo, e a cortina escura do pause e
            a resposta certa. Levar essa para um painel com "Nada aqui ainda"
            seria trocar uma saida que funciona por um painel vazio

            E o titulo volta a dizer "(ESC)", porque volta a ser verdade: a
            tecla ESC abre o pause, e a engrenagem e o caminho do mouse para
            a mesma tela
          */}
          <button
            type="button"
            className={[
              "hud-btn",
              "hud-btn--settings",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={abrirPause}
            data-tip="Configuracao (ESC)"
            aria-label="Abrir o menu de configuracao"
          >
            <HudIcon iconId="settings" />
          </button>
        </nav>
        {/*
          MISSOES E PARTY, COM AS BOXES DE "ONDE VOCE ESTA" DEPOIS.

        ## POR QUE ESTE `div` AINDA EXISTE

        Ele era o container da coluna esquerda e posicionava os filhos por
        `top: 105px`. Com a coluna virando pilha de verdade, quem empilha
        e o `.hud-coluna-dir`; o `gap` dele e que da o espacamento

        ## POR QUE `.hud-stack` E NAO `.hud-coluna-dir` DIRETO

        Porque os filhos nao formam um grupo so: o tracker de missoes, a
        caixa de party e o auto do bestiario empilham entre si, e agora as
        boxes de saida tambem moram aqui

        ## POR QUE AS BOXES DE SAIDA ENTRARAM NESTE `div`

        O pedido e que a box do portal aparecesse DEBAIXO da de party. Com
        o portal e a arena como irmas diretas da coluna, elas nasciam
        ACIMA de todo o `.hud-stack` — e nao tinha `top` para empurra-las
        para baixo sem tambem empurrar as missoes

        Dentro do `hud-stack`, a ordem e a de leitura: missoes, party, e
        so depois o que o jogador pode fazer com o lugar onde ele esta
      */}
      <div className="hud-stack">
          {/*
            A BOX DE MISSOES: DESABILITADA DENTRO DA ARENA, nao escondida.

            ## POR QUE AINDA NAO FAZ SENTIDO CAÇAR LA

            A arena nao tem zona de mob, nao tem NPC e nao tem portal: e um
            lugar sem nada para fazer. O que a box mostraria ali e o tracker
            de uma campanha que o jogador NAO esta fazendo, e o pior tipo de
            convite: a missao aparece acompanhada, o jogador sobe um degrau
            que ele nao pode dar aqui, e a barra dele nao anda

            ## POR QUE DESABILITADA E NAO ESCONDIDA

            Porque o `QuestTracker` e a PRIMEIRA coisa da coluna. Escondelo
            fazia a party e a minacao pularem para o topo no instante em que
            o jogador entrava na arena — no meio da luta, que e quando ele
            mais olha a coluna procurando o que pode usar

            Desabilitada, a coluna fica parada. O texto esmaece, o clique nao
            faz nada, e o conteudo continua legivel para quem quiser conferir
            o progresso

            E o conteudo legivel e o que salva a decisao: esconder a caixa
            tirava o convite da frente, e desabilitar tira o convite sem
            apagar a informacao
          */}
          <QuestTracker
            quests={snapshot?.quests}
            player={player}
            bloqueada={foraDaArena}
            onOpen={() => abrirPainel(PAINEL.MISSOES)}
            onFocus={handleFocusQuest}
            aoAbrirPainelTutorial={(id) => alternarPainel(id)}
          />

      {/*
        A MINERACAO, AGORA NA COLUNA QUE LEVA SO ELA.

        ## POR QUE PRIMEIRA DA PILHA

        Porque a party saiu daqui para baixo do minimapa, e a mineracao e a
        unica que sobrou na coluna do "o que eu tenho para fazer" na linha
        de cima. A ordem que existia antes — missoes, party, mineracao —
        nao existe mais: as missoes continuam no topo da pilha e a party
        virou vizinha do minimapa

        ## POR QUE AQUI E NAO NO RODAPE

        Porque a coluna da direita e a prateleira de CONSULTA: mercado,
        alvo, missoes, saida. A mineracao e consulta — o jogador olha para
        ela para decidir se fica ou larga a pedra. No rodape ela competia
        com a barra de acoes e com o botao de auto, que sao as duas coisas
        que ele precisa usar AGORA

        E FORA DO `!naArena`, porque o pedido de arena nao tem nada a ver
        com minerar. A `PartyBox` some la porque o chefe e a luta; a
        mineracao acontece no vale 1 e nao na arena
      */}
      <MineracaoPanel mineracao={snapshot?.mineracao} />


        {/*
          A BOX DO PORTAL, DEPOIS DA PARTY.

          ## POR QUE AQUI E NAO COMO IRMA DAS MISSOES

          O pedido e que ela aparecesse abaixo da box de party. Antes ela
          era filha direta da coluna da direita, e como coluna nasce
          primeiro, ela ficava ACIMA de todo o `hud-stack` — nao havia
          `top` que a colocasse depois da party sem empurrar as missoes
          junto

          ## POR QUE NAO DEPOIS DO AUTO DO BESTIARIO

          Porque o `gap: 8px` deste `div` separa caixa de caixa sem
          ninguem saber a altura da anterior. Se o portal viesse primeiro
          e o auto depois, o auto cairia logo abaixo do portal — e o
          jogador veria a ordem invertida do que ele esperava
        */}
          <PortalBox
            portal={snapshot?.portal ?? null}
            onTravel={handleTravelPortal}
            onChefe={handleArena}
          />

        {/*
          A `BossBox` SAIU DA HUD.

          A saida da arena e a MESMA `handleArena` que o botao do portal usa
          agora, e as duas caixas nunca apareciam juntas: a arena nao tem
          portal, e o `dadosDoPortalNoPe` do motor nao acha nenhum la

          Com o chefe virando a ultima missao do mapa 1, o jogador chega na
          arena pelo PORTAL. La dentro nao ha portal, e a `BossBox` era o unico
          lugar que dizia "sair"

          Quem assume o papel e a `PortalBox`: do lado de fora, o portal
          selado e o que oferece "Enfrentar o chefe"
        */}
        <BestiaryAutoBox
          hunt={snapshot?.bestiaryAuto ?? null}
          onStop={handleStopBestiaryAuto}
        />

        {/*
          O ATALHO DO DESLOCAMENTO LONGO, no fim da coluna.

          ## POR QUE DEPOIS DA PARTY E NAO COMO IRMA DA BOX DO PORTAL

          As tres caixas de "onde voce esta" — portal, saida da arena e
          viagem longa — dividiam o mesmo canto e se escondiam por um `top`
          calculado a partir das constantes do minimapa. Isso so funcionava
          porque nunca apareciam juntas: o portal sai quando existe
          deslocamento longo disponivel, e a arena nao tem viagem longa

          ## POR QUE AQUI E NAO LÁ

          Porque a ordem que o jogador le e: o que eu tenho para fazer
          (missoes), com quem eu estou (party), e so entao a viagem. A
          box de viagem e uma acao sobre o mundo, e ela embaixo da party
          fica onde o olho ja esta, sem pular a informacao que importa
          primeiro

          ## POR QUE DENTRO DO `.hud-stack` E NAO IRMA DELE

          Porque o `.hud-stack` e a coluna de "meu andamento": missoes,
          party e o auto do bestiario. A viagem longa e andamento tambem —
          e o jogador precisa saber que ela existe antes de gastar o
          pergaminho. Como filha do mesmo container, ela herda a largura
          da coluna e o `gap` de 8px, sem repetir nenhum numero

          Ela decide se existe lendo `teleporte` do painel, e `null` e o
          estado de "nao ha viagem longa". Nenhum `if` sobre a posicao do
          jogador mora aqui: quem tem o plano de viagem e o motor
        */}
        <TravelBox
          teleporte={snapshot?.teleporte ?? null}
          onTeleportar={handleTeleportar}
        />

        {/*
          O MENU DO JOGADOR MIRADO.
          *
          * Fica dentro da coluna, e nao sobre o personagem, porque o
          * mundo se move sob o menu: um menu ancorado no sprite sai de
          * lugar no primeiro quadro de caminhada. O nome do jogador vem
          * do clique, e e ele que diz a quem o convite vai
        */}
        {alvoConvite && (
          <div className="pty-target">
            <strong>{alvoConvite.nome}</strong>

            <button
              type="button"
              className="pty-btn pty-btn--invite-target"
              onClick={() => {
                handlePartyInviteByClick(alvoConvite.id);
                fecharAlvoConvite();
              }}
              data-tip="Convidar para a party"
            >
              Convidar para party
            </button>

            <button
              type="button"
              className="pty-btn pty-btn--close"
              onClick={fecharAlvoConvite}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
      </div>

      {/*
        A PILHA CENTRAL DO ALTO.

        ## POR QUE UM CONTAINER E NAO DOIS `left: 50%`

        Porque os dois se SEPARAM sozinhos: o aviso de coleta entra e sai
        o tempo todo, e o alvo depende de ter um inimigo mirado. Com cada
        um em `top` proprio — 12px e 56px — o alvo crescia ate invadir os
        56px do aviso, e os dois se escondiam

        Aqui quem empilha e o flex column. O alvo e sempre o primeiro filho
        e o aviso o segundo, entao o aviso desce sozinho quando o alvo
        aparece e sobe sozinho quando ele sai. Nenhum dos dois sabe do
        outro, e nenhum deles escreve um numero de altura do outro

        ## POR QUE `left: 50%` E `translateX(-50%)` AQUI E NAO EM CADA UM

        A pilha e uma caixa so, entao e ela que se centraliza. Os filhos
        ficam `static` dentro dela e herdam o alinhamento. Centrar cada
        filho separado daria dois `translateX(-50%)` para manter em
        sincronia, e um deles errado so desalinharia o alvo ou o aviso
      */}
      <div className="hud-topo">
        {snapshot?.selectedTarget && (
          <section
            className={[
              "target-panel",
              snapshot.selectedTarget.chefe
                ? "target-panel--chefe"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`Alvo: ${snapshot.selectedTarget.name}`}
          >
            {/*
              ## POR QUE O CHEFE TEM BARRA DE 320px

              Porque ele e a luta, nao a caca. O `chefe` vem do MAPA
              (ver `GameEngine`), e o gancho e o mapa justamente para que
              um chefe novo em um mapa novo nao precise declarar nada em
              lugar nenhum

              ## POR QUE SO O CHEFE GANHA NUMERO EXATO

              Nos 220px do mob comum, o numero nao cabe na ponta sem comer
              o nome. No chefe ha 100px a mais, entao ele entra
            */}
            {/*
              O NIVEL E O NOME, ACIMA DA BARRA.

              ## POR QUE ACIMA E NAO SOBRE A BARRA

              Porque o nome e o nivel sao IDENTIDADE — quem e o alvo — e a
              barra e MEDIDA. Sao coisas diferentes, e elas nao se misturam
              na mesma linha

              Dentro da barra, o nome ficava vermelho quando a vida estava
              alta e apagado quando estava baixa, porque ele herdava o
              fundo do preenchimento. Acima, o nome e sempre o mesmo
              texto sobre o mapa, e a barra e a unica coisa que muda

              ## POR QUE O NIVEL VEM PRIMEIRO

              O nivel classifica o alvo antes de voce saber o nome dele:
              "Nv.20 Hulk" diz mais do que "Hulk Nv.20"
            */}
            <div className="target-panel__rotulo">
              <span className="target-panel__level">
                Nv.{snapshot.selectedTarget.level ?? 1}
              </span>

              <strong>
                {snapshot.selectedTarget.name}
              </strong>
            </div>

            <div
              className="target-panel__bar"
              role="meter"
              aria-valuenow={snapshot.selectedTarget.hp}
              aria-valuemin={0}
              aria-valuemax={snapshot.selectedTarget.maxHp}
              aria-label={`Vida de ${snapshot.selectedTarget.name}`}
            >
              <div
                className="target-panel__fill"
                style={{
                  width: `${
                    (snapshot.selectedTarget.hp /
                      snapshot.selectedTarget.maxHp) *
                      100
                  }%`,
                }}
              />

              {/*
                OS NUMEROS, DENTRO DA BARRA E CENTRALIZADOS.

                ## POR QUE CENTRALIZADOS E NAO NA PONTA

                Porque o rotulo subiu e o meio da barra ficou livre de
                novo. Na ponta eles disputavam espaco com o nome, e era o
                numero que perdia: nome de criatura e sempre mais longo
                que "700 / 1500"

                ## POR QUE BRANCO SOBRE O VERMELHO

                O numero passa por cima do preenchimento quando ha vida e
                por cima do fundo escuro quando esta quase vazio. Nenhuma
                cor de tema sobrevive as duas
              */}
              <span className="target-panel__hp">
                {snapshot.selectedTarget.hp} /{" "}
                {snapshot.selectedTarget.maxHp}
              </span>
            </div>
          </section>
        )}

        {/*
          A MOEDA, NO LUGAR DO ALVO.

          ## POR QUE COMPARTILHAM O MESMO ESPACO

          Porque as duas sao a leitura do alto central: uma diz o que voce
          esta olhando, a outra diz o que voce tem. Sao diferentes, mas
          competem pelo mesmo lugar e pelo mesmo instante — e o alvo ganha
          sempre, porque e a informacao urgente

          ## POR QUE `moedasVisiveis` E NAO SO `!temAlvo`

          Porque o alvo pisca. Ver o `useEffect` acima: a moeda espera 2s
          depois que o alvo some, e nao volta no mesmo quadro

          ## POR QUE `<output>` E NAO UM `<span>`

          Porque e um valor, e um leitor de tela anuncia a mudanca do
          numero sem interromper quem esta lutando. E a barra de vida do
          alvo, no mesmo espaco, pelo mesmo motivo
        */}
        {/*
          AS DUAS MOEDAS, JUNTAS E HORIZONTAIS.

          ## POR QUE UM WRAPPER E NAO DOIS IRMAOS DIRETOS

          Porque a `.hud-topo` e `flex-direction: column`. Dois `<output>`
          como filhos diretos ficariam um embaixo do outro, e o pedido foi
          AO LADO do gold. O wrapper e a unica forma de ter uma linha sem
          mudar o `flex-direction` do pai — que mudaria tambem onde o alvo e
          o aviso de coleta caem, e os dois dependem da coluna

## POR QUE OS DOIS USAM `moedasVisiveis`

            Porque o pedido e o mesmo efeito de 2 segundos para os dois, e o
            `moedasVisiveis` e exatamente isso: o alvo some, a linha espera
            `MOEDAS_VOLTAM_EM_MS` e volta

            Antes o steel usava so `!temAlvo` e aparecia na hora em que o
            alvo sumia — ao lado de uma linha que ia demorar 2s, e o par
            piscava fora de compasso. Duas moedas na mesma linha com dois
            relogios diferentes nao e "o mesmo efeito"
          */}
          <div className="hud-moedas-linha">
            {!temAlvo && moedasVisiveis && (
              <output
                className="hud-moedas"
                aria-label={`Moedas: ${summary.coins}`}
              >
                <i aria-hidden="true">◉</i>

                {summary.coins}
              </output>
            )}

            {/*
              O STEEL, AO LADO DO GOLD.

              E `summary.steel`, e nao um prop separado: o `summary` do
              inventario e o pacote que ja vai a 4Hz, e um campo a mais ali
              custa menos que um pacote novo
            */}
{!temAlvo && moedasVisiveis && (
                <output
                  className="hud-steel"
                  aria-label={`Steel: ${summary.steel}`}
                >
                  <i aria-hidden="true">◈</i>

                  {summary.steel}
                </output>
              )}

              {/*
                O DIAMANTE, AO LADO DO STEEL.

                E `summary.diamonds`, pelo mesmo motivo do steel: o `summary`
                do inventario ja vai a 4Hz, e um campo a mais ali custa menos
                que um pacote novo da rede

                Fica depois do steel e nao em outra linha porque as tres
                moedas sao a MESMA informacao — dinheiro guardado — e separadas
                o jogador as le como tres numeros soltos em vez de um total
                que ele esta comparando com o preco do mercado
              */}
              {!temAlvo && moedasVisiveis && (
                <output
                  className="hud-diamonds"
                  aria-label={`Diamantes: ${summary.diamonds ?? 0}`}
                >
                  <i aria-hidden="true">◇</i>

                  {summary.diamonds ?? 0}
                </output>
              )}
          </div>
        </div>

      {/*
        A COLUNA DO MINIMAPA: A PARTY E O AVISO DE COLETA, EMBAIXO DELE.

        ## POR QUE A PARTY VIROU VIZINHA DO MINIMAPA

        E o pedido. E o motivo que faz sentido: minimapa e party sao as
        duas coisas que o jogador consulta OLHANDO O LUGAR, e nao olhando a
        si mesmo. A party estava na pilha da direita, entre missoes e
        mineracao, competing com tres caixas que competem entre si

        ## POR QUE UM CONTAINER E NAO DOIS `position: absolute`

        Porque o aviso de coleta ja morava embaixo do minimapa e a party
        precisa morar no mesmo lugar. Dois `absolute` com o mesmo `top`
        empilhariam um sobre o outro: o jogador mataria um bicho, o aviso de
        loot apareceria, e a party some embaixo dele. Com um container, a
        party vem PRIMEIRA e o aviso desce para o que sobrar abaixo dela

        E o que da o comportamento certo sem nenhum numero novo: o aviso
        fica logo abaixo da party, e quando o convite de party abre — que
        cresce a caixa — o aviso desce junto em vez de ficar por cima

        ## POR QUE O `top` VEM DAS CONSTANTES DO MINIMAPA

        Porque o minimapa NAO e DOM: e pintado no canvas por
        `GameEngine.drawMinimap`, e quem decide onde ele nasce sao o
        `MINIMAP_TOP_IDLE` e o `MINIMAP_HEIGHT` de `minimap.js`

        Numero escrito a mao aqui apareceria embaixo de um lugar enquanto o
        minimapa desenhasse em outro, e so quando alguem mexesse na altura
        do minimapa — que e exatamente o que o `minimap.test.js` mede

        ## POR QUE A LARGURA VEM DE `MINIMAP_WIDTH`

        Para a party ter exatamente a largura do minimapa acima dela. Com a
        largura antiga da coluna direita (210px) ela ficaria 30px mais
        estreita que o minimapa, e duas caixas empilhadas com larguras
        diferentes parecem dois paineis que nao conversam

        ## E A PARTY AINDA SOME NA ARENA

        A mesma regra de antes, e o mesmo motivo: o chefe e a luta, e a
        caixa com barras de vida de outros jogadores no meio do combate e a
        informacao que o jogador mais precisa e menos consegue usar. O grupo
        continua existindo — e so a caixa que some
      */}
      <div
        className="hud-coluna-mini"
        style={{
          top: MINIMAP_TOP_IDLE + MINIMAP_HEIGHT + 8,
          left: MINIMAP_LEFT,
          width: MINIMAP_WIDTH,
        }}
      >
        {!naArena && (
          <PartyBox
            party={snapshot?.party}
            /**
             * O CONVITE CHEGOU PELO EVENTO, e nao pelo painel.
             *
             * O servidor manda `PARTY_INVITE_RECEIVED` na hora, e o painel
             * so no proximo pacote — que pode levar segundos. A caixa de
             * cinco segundos esperando o painel perderia a maior parte do
             * prazo, e o jogador nunca veria o convite
             */
            convite={conviteParty}
            /**
             * O ID DE QUEM ESTA OLHANDO.
             *
             * Sem ele a caixa nao sabe se quem ve e o lider, e o botao de
             * expulsar apareceria para todo mundo
             */
            meuId={player?.id ?? null}
            onCreate={handlePartyCreate}
            onInvite={handlePartyInvite}
            onAcceptInvite={handlePartyAccept}
            onKick={handlePartyKick}
            onFollow={handlePartyFollow}
            onFocus={handlePartyFocus}
            onTransfer={handlePartyTransfer}
            onLeave={handlePartyLeave}
          />
        )}

        {/*
          O AVISO DE COLETA, DEPOIS DA PARTY.

          ## POR QUE SAIU DA PILHA CENTRAL

          A `.hud-topo` era o par do alvo: alvo em cima, aviso embaixo. O
          alvo continua no alto central, e o aviso foi para baixo do
          minimapa — assim o loot aparece onde o jogador estava olhando
          quando matou o bicho, e a barra de vida do alvo fica com a tela
          inteira para ela

          E ele e o ULTIMO filho do container, e nao o primeiro: o loot e o
          que some depois de alguns segundos, e a party e o que fica. Se o
          aviso viesse primeiro, cada loot empurraria a party para baixo
          durante o tempo que ele fica na tela
        */}
        {snapshot?.message && (
          <div
            className={[
              "game-message",
              snapshot.message.bad ? "is-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {snapshot.message.text}
          </div>
        )}
      </div>

      {/*
        A BARRA DE BAIXO, em tres PECAS: as skills, a coluna com o auto
        em cima da ultimate, e a dica.

        ## O QUE MUDOU DE LUGAR

        Antes a ultimate ficava no meio da fileira, com o botao de auto
        solto no canto inferior direito, posicionado por `absolute` e
        fora da barra. Agora:

        - a ULTIMATE ocupa o lugar onde o botao de auto estava, no canto
        inferior direito;
        - as skills ficam do lado dela, a esquerda;
        - o botao de auto fica ACIMA da ultimate, na mesma coluna

        ## POR QUE O AUTO EM CIMA DA ULT

        Sao os dois botoes que o jogador aperta SEM mirar: o auto liga e
        desliga o piloto, e a ultimate e a skill que nao precisa de alvo.
        Os dois no mesmo canto, empilhados, e o que faz o canto ser a
        "mao do piloto" em vez de ter o auto perdido num canto e a
        ultimate perdida no meio da fileira

        ## A BARRA PAROU DE RESERVAR ESPACO PARA O BOTAO

        O `padding-right: 104px` existia porque o `.hud-ability` era
        `absolute` e a fileira de skills precisava sair da frente dele.
        Com o botao no fluxo da barra, quem reserva espaco e o proprio
        `flex` — e a fileira esta no lugar dela, encostada na coluna da
        ultimate, sem um numero magico de 104px que so significava
        "84 do botao + 22 da margem"
      */}
      <footer className="hud-actionbar">
        {/*
          O RODAPE COMO PRIMEIRO ITEM DA BARRA, E NAO COMO UM ELEMENTO
          SOLTO.

          Ele era um `absolute` de `100vw` na base da tela, e a barra de
          acoes andava por cima. Com as barras de HP e recurso do lado do
          nivel, os dois precisam dividir a MESMA linha: o rodape em 300px
          a esquerda e as skills emcolando no que sobra

          Aqui dentro, a ordem e a de leitura: identidade, recursos,
          habilidades. E o espaco entre eles passa a ser um `gap` do flex,
          e nao dois posicionamentos absolutos que concordam por sorte
        */}
        <Rodape player={player} />

        <div className="hud-actionbar__group">
          <div className="hud-actionbar__skills">
            {/*
              O ICONE DO ATALHO, antes da primeira skill.

              E o desenho do botao de tiro rapido que fica ao lado dos slots,
              e ele entra AQUI — dentro do `hud-actionbar__skills` — e nao
              como irmao do grupo: o container ja e `display: flex` com
              `align-items: center` e `gap: 9px`, entao colocar o icone como
              primeiro filho faz ele ser centralizado na MESMA linha dos
              slots sem uma posicao absolute e sem acertar a altura a mao

              E ele e o primeiro filho porque o desenho indica a acao que vem
              a seguir. No fim da fileira ele leria como a ultima skill do
              repertorio
            */}

            {/*
              O SLOT VAZIO, DO OUTRO LADO DO ICONE DO TIRO.

              ## ONDE ELE FICA, E POR QUE ESSE LUGAR

              E o pedido: ao lado do `icon_shot`, do lado OPOSTO ao das
              skills. A fileira comeca pela vaga, vem o tiro, e so depois
              comecam os slots de skill — o tiro divide a vaga do repertorio
              dele

              ## O QUE ELE E

              Um circulo do tamanho da skill com nada dentro, e ele NAO E
              CLICAVEL ainda. E a vaga onde entra a proxima acao do
              personagem — e um slot vazio desenhado como os outros diria
              que ali vai caber uma skill, sem o jogo inventar o que ela e

              ## POR QUE NAO E O `SkillSlot`

              Porque o `SkillSlot` sabe fazer coisa que este nao sabe ainda:
              arrasto para auto, cadeado de nao aprendida, cooldown, e ele le
              o `icon` e o `id` da skill do `SKILL_PACKS`. Passando um objeto
              vazio, ele cairia no glifo `null` e no `skill.cooldown` de `NaN`
              — a tela mostraria `NaN` no timer e um circulo vazio sem nenhuma
              das bordas de estado que fazem o slot parecer slot
            */}
            <button
              type="button"
              className={[
                "hud-vaga",
                pocaoEquipada ? "is-preenchida" : "",
                snapshot?.autoPocao?.ligado ? "is-ligada" : "",
                pocaoEquipada ? "is-draggable" : "",
                dragPocao ? "is-dragging" : "",
                dragPocao?.direction === 1 ? "is-drag-on" : "",
                dragPocao?.direction === -1 ? "is-drag-off" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                dragPocao
                  ? { transform: `translateY(${dragPocao.offset}px) scale(1.06)` }
                  : undefined
              }
              onPointerDown={pocaoPointerDown}
              onPointerMove={pocaoPointerMove}
              onPointerUp={pocaoPointerUp}
              onPointerCancel={pocaoPointerCancel}
              onClick={abrirAutoPot}
              data-tip={
                pocaoEquipada
                  ? `${nomeDaPocao} — ${
                      snapshot?.autoPocao?.ligado
                        ? `automático em ${snapshot?.autoPocao?.limiar ?? AUTO_POCAO_LIMIAR_PADRAO}%`
                        : "automático desligado"
                    }\nArraste para baixo: automático\nClique: abrir o painel`
                  : "Nenhuma poção equipada — clique para abrir o painel"
              }
              aria-label={
                pocaoEquipada
                  ? `${nomeDaPocao} — automático ${
                      snapshot?.autoPocao?.ligado ? "ligado" : "desligado"
                    }`
                  : "Abrir o painel de Auto Pot"
              }
              aria-pressed={Boolean(snapshot?.autoPocao?.ligado)}
            >
              {/*
                A POCAO EQUIPADA, e o `ItemIcon` com a arte do catalogo.

                A ESCOLHA da pocao continua sendo no painel: o arrasto aqui
                e o do LIGADO, e o clique so ABRE o painel. Sao tres coisas
                em tres lugares, e cada uma em um so
              */}
              {pocaoEquipada && (
                <>
                  <ItemIcon
                    className="hud-vaga__icone"
                    item={itemDaPocao}
                    itemId={snapshot?.autoPocao?.itemId}
                  />

                  {/*
                    A CONTAGEM, e o que avisa que a bolsa esta acabando.

                    Sem o numero, o slot mostraria o mesmo desenho com 50
                    pocas e com 1, e o jogador descobriria que a pocao acabou
                    no meio da luta pelo jeito pior
                  */}
                  <span className="hud-vaga__conta">
                    {snapshot?.autoPocao?.contagem ?? 0}
                  </span>
                </>
              )}

              {/*
                A DICA DO ARRASTE, a mesma da skill.

                O texto e o que o jogador le NO MOMENTO do gesto, e ele so
                faz sentido ali. Fora do arraste o slot mostra o estado pelo
                anel verde, que e o que se ve na luta
              */}
              {dragPocao?.direction !== 0 && dragPocao && (
                <span className="hud-vaga__hint">
                  {dragPocao.direction > 0 ? "AUTO" : "MAN"}
                </span>
              )}
            </button>

            {visibleSkills.map((skill) => {
              /**
               * A TRANCA DA SKILL.
               *
               * O slot continua SENDO DESENHADO, e nao some: e o
               * `useSkillSlot` do servidor que recusa, e o jogador precisa
               * ver o nome do que ainda nao tem para saber o que comprar
               * com o Mestre. Esconder traria duas consequencias ruins — o
               * `slot` do array deixaria de bater com a posicao, e o
               * jogador perderia a noção do repertorio da classe
               *
               * `null` e "ainda nao chegou do servidor": sem essa
               * distincao o primeiro quadro mostraria tudo trancado e o
               * jogador acharia que perdeu as habilidades
               */
              const aprendida =
                habilidadesAprendidas === null ||
                habilidadesAprendidas === undefined
                  ? null
                  : habilidadesAprendidas.has(skill.id);

              return (
                <>
{skill.slot === 1 && (
                    <button
                      key="config"
                      type="button"
                      
                      className={[
                        "hud-ability_meu",
                        "hud-ability--config",
                        painelAberto === PAINEL.CONFIG ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => alternarPainel(PAINEL.CONFIG)}
                      data-tip="Auto Pot"
                      aria-label="Abrir o painel de Auto Pot"
                      aria-pressed={painelAberto === PAINEL.CONFIG}
                    >
                      <span className="hud-ability__text" style={{fontSize: 25}}>⚙</span>
                    </button>
                  )}

                  <SkillSlot
                    key={skill.id}
                    skill={skill}
                    cooldown={cooldowns[skill.id] ?? 0}
                    draggable
                    auto={Boolean(autoSkills[skill.id])}
                    trancada={aprendida === false}
                    onToggleAuto={(enabled) =>
                      handleToggleAuto(skill.id, enabled)
                    }
                    onClick={() =>
                      engineRef.current?.useSkillSlot(skill.slot)
                    }
                  />
                </>
              );
            })}

            {/*
              A DICA DE ARRASTAR, pendurada ABAIXO das skills e
              CENTRALIZADA nelas.

              ## POR QUE ESTA DENTRO DO BLOCO DE SKILLS

              Para centralizar no meio DAS SKILLS — e nao no meio da
              linha inteira, que tem a divisoria e a coluna do auto do
              lado direito — a dica precisa medir o bloco de skills. So
              quem esta dentro dele sabe disso

              Centralizar na linha inteira daria um texto deslocado para
              a direita, uns 35px do meio das skills, porque a coluna do
              auto e da ultimate entra na conta

              ## POR QUE `absolute` E NAO UM BLOCO DEBAIXO

              Como item normal, a dica pusharia a altura do bloco de
              skills, e o `align-items: flex-end` da linha alinharia a
              BASE DA DICA com a base da ultimate — o que levantaria as
              skills para fora do alinhamento. Ou seja: a dica ficaria de
              baixo, mas desalinharia tudo acima dela

              Pendurada, ela sai do fluxo: a altura do bloco continua
              sendo a dos slots, o alinhamento da base fica intacto, e
              o texto aparece logo abaixo

              E por isso que o `padding-bottom` do rodape e maior que o
              das outras bordas: e ali que a dica pendurada aparece
            */}
             {/*<p className="hud-actionbar__hint">
              Arraste a skill ↓ para auto · ↑ para manual
            </p> */}
          </div>

          <span className="hud-actionbar__divider" />

          {/*
            A COLUNA: o auto em cima, a ultimate embaixo.

            E o `div` que faz a empilhagem. Sem ele, os dois botoes
            ficariam lado a lado no `flex` da linha — que e exatamente o
            layout antigo, so que trocado de lugar
          */}
          <div className="hud-actionbar__grupo">
            {/*
            {/*
              O BOTAO DE AUTO, ACIMA DOS SLOTS.

              ## POR QUE ELE VOLTOU PARA CIMA

              A coluna e a do ultimate, e a leitura de cima para baixo e:
              acao, depois recurso. O auto e a acao que se liga e se desliga
              a cada momento; a ultimate e a que espera o nivel 6. A ordem
              invertida punha embaixo o botao que o jogador mais aperta, e
              em cima o que quase nunca esta pronto

              ## E POR QUE OS SLOTS VAO LADO A LADO, E NAO ACROSS

              Porque sao dois, e a coluna ja e estreita — a ultimate e um
              quadrado de 84px. Tres quadrados de 30px em linha ainda cabem;
              empilhados eles desceriam alem da ultimate, o rodape cresceria
              e o trilho do XP perderia a linha reta
            */}
            {/*
              O BOTAO DE AUTO, que era um circulo de 84px com tres
              textos dentro.

              ## O QUE ELE DIZ AGORA: SO "auto"

              Antes escrevia `AUTO`, `ALVO` ou `OFF` conforme o estado.
              Os tres textos competiam pelo mesmo espaco de 84px com o
              "T" da tecla embaixo, e o botao tinha que mudar de largura
              de leitura conforme o que acontecia no jogo — o jogador
              aprendia a ler o auto pelo TEXTO, e nao pela cor

              ## O ESTADO CONTINUA VISIVEL, E SEM TEXTO

              A classe `is-on` pinta a borda e o fundo de verde e liga
              o pulso; a `is-engaged` pinta de dourado. E o que o jogador
              le agora, e e melhor do que a palavra: verde pulsando
              diz "ligado" de relance, sem focar a tela
            */}
            <div className="hud-actionbar__par">
            <button
              type="button"
              className={[
                "hud-ability",
                autoOn ? "is-on" : "",
                engaged ? "is-engaged" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handleToggleAutoPlay}
              data-tip={`Auto play (${teclaAuto.nome || "sem tecla"})`}
            >
              <img
                className="hud-ability__icone"
                src={AUTO_ICON_URL}
                alt=""
              />
            </button>

            {/*
              O BOTAO DO DASH, do lado do auto.

              ## POR QUE NAO NUM SLOT COMO OS OUTROS

              Porque slot vazio e lugar de ITEM, e o dash nao e um item: e um
              recurso de locomocao das quatro classes. Ele nao sai do
              catalogo, nao tem quantidade, e nao se esgota no inventario

              E porque o auto e o dash sao as DUAS acoes que o jogador liga
              e desliga a qualquer momento. Deixados em linhas separadas, com
              a ultimate entre eles, o olho tinha de descer e subir para
              encontrar o segundo

              ## E POR QUE O DASH FICOU MENOR

              Porque o auto e o que se liga sozinho e precisa de area para
              o pulso e a cor de estado. O dash e um botao comum com um
              cooldown, e encolhe-lo deixa a hierarquia certa: o auto manda,
              o dash acompanha

              ## E POR QUE UM `button` E NAO UM `span`

              Porque ele tem que apertar. Um `span` com `cursor: pointer`
              faz o jogador clicar e nada acontecer, e o clique que nao
              funciona e pior que o botao que nao existe: o jogador conclui
              que o dash quebrou, e nao que ele precisa apertar de outro jeito

              ## E POR QUE O COOLDOWN DESLIGA O BOTAO

              Porque o `disabled` diz o que vai acontecer. Ativo e recusado
              no clique, o jogador aprende que o botao existe apertando
              varias vezes ate descobrir o tempo

              E o `title` com o tempo em segundos: o icone apaga, mas o
              numero da para QUANDO vale apertar de novo, e e a segunda
              informacao que o jogador precisa — a primeira e que o dash
              existe
            */}
            <button
type="button"
      className="hud-actionbar__slot"
      onClick={handleDash}
              disabled={dashRestante > 0}
              data-tip={
                dashRestante > 0
                  ? `Dash recarrega em ${dashRestante.toFixed(1)}s`
                  : `Dash (${teclaDash.nome || "sem tecla"})`
              }
              aria-label="Usar dash"
            >
              <img
                src={ICONE_SLOT_DIREITA}
                alt=""
                draggable={false}
              />

              <IndicativoTecla
                acao="dash"
                className="hud-actionbar__tecla"
              />
            </button>
          </div>

          {/*
              A ULTIMATE, trancada ate o nivel 6.

              Diferente das skills de slot, ela nao vem de livro: e o
              `ultimateLiberada` que o servidor ja calculou contra
              `ULTIMATE_NIVEL`. A tela mostra o estado pronto em vez de
              recalcular o nivel — assim nenhum dos dois lados pode
              discordar sobre quando ela abre

              `false` e o unico valor que tranca: `null` (ainda nao
              chegou) deixa o botao normal, porque trancar sem informacao
              seria mentir para o jogador
            */}
            <SkillSlot
              ultimate
              skill={classDefinition.ultimate}
              cooldown={
                cooldowns[classDefinition.ultimate.id] ?? 0
              }
              trancada={snapshot?.ultimateLiberada === false}
              onClick={() =>
                engineRef.current?.useUltimate()
              }
            />
          </div>
        </div>

        {/*
          O TRILHO DOURADO DO XP, ATRAVESSANDO A LINHA INTEIRA.

          Ele fecha a barra de acoes e nao fica dentro do rodape porque
          o progresso do nivel e a unica barra da tela que vale para a
          sessao toda: dentro do rodape ele parava na coluna das barras de
          HP. Aqui ele comeca no nivel e vai ate o ultimo botao da direita

          E o ultimo filho de proposito: com `grid-row: 2` e
          `grid-column: 1 / -1`, a posicao dele nao depende de quantos
          botoes a barra tem nem de quantas paginas de skill existem
        */}
<TrilhoXp player={player} />
        </footer>

        {/*
          O PASSE ABRE EM QUALQUER MAPA, e sem `disabled={!intencao}`

          A diferenca para a loja, para as habilidades e para o bau — que
          todos carregam `!intencao` — e que estes tres dependem do jogador
          estar PERTO de um NPC. O passe nao depende de nada: e a temporada,
          que vale em qualquer lugar

          `onClose` vai para `alternarPainel`, e nao para `setPainelAberto(null)`
          como nos paineis com NPC. Com `!intencao`, fechar o painel e
          diferente de fechar o veu: o painel fecha e o veu continua, e o
          `ESC` e o no que sobra
        */}
        {painelAberto === PAINEL.PASSE && (
          <PassePanel
            estado={snapshot?.passe}
            onClaim={handleClaimPassReward}
            onPremium={handleSetPassPremium}
            onClose={() => alternarPainel(PAINEL.PASSE)}
          />
        )}

        {/*
          A CONFIGURACAO, o painel que a engrenagem abre.

          Fica aqui do lado do passe porque e o que a prateleira tem de
         ACAO SOBRE O JOGO, ao lado da acao sobre a conta — e nao perto do
          pause, que agora so a ESC abre
        */}
        {painelAberto === PAINEL.CONFIG && (
          <ConfigPanel
            snapshot={snapshot}
            onClose={() => alternarPainel(PAINEL.CONFIG)}
            onConfigurarAutoPocao={handleConfigurarAutoPocao}
          />
        )}


      {painelAberto === PAINEL.MISSOES && (
<QuestPanel
            quests={snapshot?.quests}
            onClose={() => alternarPainel(PAINEL.MISSOES)}
            onAccept={handleAcceptQuest}
            onAbandon={handleAbandonQuest}
            onFocus={handleFocusQuest}
            onToggleAuto={handleToggleQuestAuto}
            onClaim={handleClaimQuestReward}
            aoAbrirPainel={(id) => alternarPainel(id)}
          />
      )}

{painelAberto === PAINEL.BESTIARIO && (
  <CodexPanel
                snapshot={bestiary}
                hunting={snapshot?.bestiaryAuto?.creatureId ?? null}
                onHunt={handleHuntCreature}
                onClose={fecharCodex}
                filtroDrop={focoItem?.criaturas ?? null}
              />
        )}

      {painelAberto === PAINEL.RANK && (
        <RankingPanel
          rank={rank}
          meuNome={player.name}
          onClose={() => alternarPainel(PAINEL.RANK)}
        />
      )}

      {painelAberto === PAINEL.CRAFT && (
<CraftPanel
            craft={craft}
            onCraft={handleCraftItem}
            onHunt={handleHuntCreature}
            onClose={() => alternarPainel(PAINEL.CRAFT)}
            equipment={snapshot?.equipment}
          />
      )}

{painelAberto === PAINEL.COLECAO && (
  <CollectionPanel
              collection={collection}
              onDeliver={handleDeliverCollection}
              onClose={fecharColecao}
              filtroItemId={focoItem?.itemId ?? null}
            />
        )}

      {painelAberto === PAINEL.STATUS && (
        <StatusPanel
          stats={player?.stats ?? null}
          className={player?.className ?? null}
          level={player?.level ?? null}
          onClose={() => alternarPainel(PAINEL.STATUS)}
        />
      )}

      {painelAberto === PAINEL.ENCHANT && (
        <EnchantPanel
          inventory={snapshot?.inventory}
          equipment={snapshot?.equipment}
          /**
           * A PECA QUE ENTRA JA ESCOLHIDA.
           *
           * Vem do "Encantar" da caixa do item. Sem isto, o painel abriria
           * com a lista inteira e o jogador teria que achar a peca de novo
           */
selecaoInicial={alvoEncantar}
            abaInicial={abaEncantar}
            onEnchant={handleEnchantItem}
        onEnhance={handleEnhance}
          onClose={alternarEncantar}
        />
      )}

      {/*
        A LOJA DO MESTRE.

        O `classId` vem da definicao de classe da tela, e e o que separa o
        shop por classe: o painel pede os livros daquela classe e so
        recebe os dela. Os `habilidadesAprendidas` e o `coins` sao do
        painel do servidor — o painel so desenha
      */}
      {/*
        O DESEMPENHO DO SERVIDOR, no canto.

        COMENTADO POR ENQUANTO, e o componente, o import e o CSS estao
        todos de pe: e so isto aqui que volta.

        ## POR QUE COMENTAR E NAO APAGAR
        *
        * A medicao vale mais que o codigo que a mostra. O `/health/laco`
        * ja responde `duracaoRecenteMs` e `duracaoPiorMs`, e eles
        * continuam funcionando com o painel fora da tela — para conferir
        * durante uma otimizacao basta abrir o endpoint no navegador
        *
        * Manter o `ServerPerf` em vez de reescrever depois e o que faz
        * reativar custar uma linha, e nao meia hora de remontagem: o
        * `fetch`, o tratamento de `null` e o layout do canto ja estao
        * testados
        *
        * ## PARA VOLTAR
        *
        * Sao duas linhas e o comentario de cima: o `import` de
        * `ServerPerf` e o `<ServerPerf />` no lugar deste bloco
        *
        * Os numeros vem prontos do servidor: `duracaoRecenteMs`,
        * `duracaoPiorMs` e `orcamentoMs` no `/health/laco`. Se voce mexer
        * no `tickSeconds`, a barra acompanha — o orcamento sobe com ele
        * em vez de ficar preso num 50 escrito a mao
        */}

      {painelAberto === PAINEL.HABILIDADES && (
        <HabilidadesPanel
          classId={classDefinition?.id}
          coins={summary.coins}
          habilidadesAprendidas={
            summary.habilidadesAprendidas ?? null
          }
          onBuy={handleBuySkillBook}
          onClose={() => alternarPainel(PAINEL.HABILIDADES)}
        />
      )}

      {/*
        O BAU.

        Os dois lados do dado: a `inventory` e a `summary` de sempre — a
        mochila que o jogador carrega — e o `bau` que veio no mesmo
        pacote. O painel precisa dos dois para mostrar o item nos dois
        lados, e e por isso que ele recebe `onMover` em vez de dois
        callbacks: o painel decide o que e guardar e o que e retirar
      */}
      {painelAberto === PAINEL.BAU && (
        <BauPanel
          inventory={summary}
          bau={snapshot?.bau ?? null}
          onMover={handleMoverNoBau}
          onClose={() => alternarPainel(PAINEL.BAU)}
        />
      )}

      {/*
        A GUILDA.

        O `guilda` vem inteiro do painel: nome, membros, pedidos, arvore
        e saldo de pontos. A tela nao deduce papel nem calcula custo —
        quem sabe disso e o servidor, e a tela so mostra e pede
      */}
      {painelAberto === PAINEL.GUILD && (
        <GuildPanel
          guilda={guilda}
          moedas={summary.coins}

          /**
           * A mochila inteira, e nao so as moedas.
           *
           * O cofre deposita ITEM, e o item vem da mochila: sem o
           * `inventory` completo o painel de deposito mostraria uma lista
           * vazia e o jogador nao teria de onde guardar nada
           */
          inventory={summary}
          onCriar={handleGuildCreate}
          onBuscar={handleGuildSearch}
          onPedir={handleGuildRequest}
          onAceitar={handleGuildAccept}
          onNegar={handleGuildDeny}
          onSair={handleGuildLeave}
          onTalent={handleGuildTalent}
          onCofre={handleGuildCofre}
          onEstilo={handleGuildStyle}
          onMostrarTag={handleGuildTag}
          onClose={() => alternarPainel(PAINEL.GUILD)}
        />
      )}

      {painelAberto === PAINEL.MARKET && (
<MarketModal
          market={market}
          inventory={snapshot?.inventory}
          onBuy={handleBuyItem}
          onCancel={handleCancelListing}
          onList={handleListItem}
          onClose={() => alternarPainel(PAINEL.MARKET)}
        />
      )}

      {/*
        A LOJA, LOGO DEPOIS DO MERCADO.

        ## POR QUE ESTE LUGAR E NAO PERTO DO BOTAO

        Porque todo painel da prateleira e renderizado aqui, e nao junto do
        botao que o abre. O `.inv-panel` se posiciona por `top: 50%` e
        `left: 50%` com `position: absolute`, e o `absolute` e resolvido
        pelo primeiro ancestral POSICIONADO, nao pela janela. Dentro do
        `.hud-coluna-dir` — que e `absolute` e ocupa a ponta direita — o
        painel se centralizava DENTRO DA COLUNA e subia por cima dos botoes

        Foi o que aconteceu quando eu deixei o render logo abaixo do
        `<nav>`, que e onde o botao da loja esta. O botao e o painel sao
        irmaos de leitura, nao de lugar

        ## E A `POCOES` DO MERCADOR CONTINUA ABAIXO

        Os dois nao abrem um pelo outro: sao catalogos diferentes, e o
        motivo esta no enum. A loja do mercador so existe com o NPC na tela
        — e o balcao e dele
      */}
{/*
          A LOJA, com a compra de verdade.

          `comprados` vem do `snapshot.loja.comprados` e nao de estado local:
          o servidor so escreve essa lista depois de cobrar e entregar o
          pacote. Era um `useState` aqui dentro que desativava o card sem
          nada ter entrado na mochila

          E o `handleComprarLoja` e a rede, pelo mesmo motivo da colecao: no
          single player sem `GameClient` o `comprarProduto` devolve `false`
          e o card nao desativa — que e o comportamento certo, porque sem
          servidor nao ha preco para cobrar nem espaco para conferir
        */}
        {painelAberto === PAINEL.LOJA && (
          <LojaPanel
            onClose={() => alternarPainel(PAINEL.LOJA)}
            comprados={snapshot?.loja?.comprados ?? []}
            onComprar={handleComprarLoja}
          />
        )}

      {painelAberto === PAINEL.POCOES && (
        <PotionPanel
          coins={summary.coins}
          level={player?.level ?? null}
          onBuy={handleBuyPotion}
          onClose={() => alternarPainel(PAINEL.POCOES)}
        />
      )}

      {painelAberto === PAINEL.INVENTARIO && (
        <InventoryPanel
          inventory={summary}
          equipment={snapshot?.equipment}
          player={player}
          lootFilter={snapshot?.lootFilter}
          onClose={() => alternarPainel(PAINEL.INVENTARIO)}
          onEquip={(entry) => equipInItsSlot(entry)}
          onUnequip={handleUnequip}
          onDiscardItem={handleDiscardItem}
onDiscardEquipped={handleDiscardEquipped}
        onUseItem={handleUseItem}
onEnchant={handleOpenEnchant}
            onEnhance={handleOpenEnhance}
            onOpenCollection={abrirColecaoNoItem}
            onOpenCodex={abrirCodexNoItem}
            onFilterChange={handleFilterChange}
          onFilterReset={handleFilterReset}
          onFilterPrune={handleFilterPrune}
        />
      )}

      {/*
  O PAUSE.
  A cortina cobre a tela inteira e escurece o jogo: e o que separa
  "estou olhando um painel" de "parei". O botao de sair fica AQUI,
  e nao na barra — sair nao e um atalho, e uma decisao

  O botao de auto NAO esta mais aqui: ele subiu para dentro da barra de
  baixo, empilhado em cima da ultimate. Este bloco era o que o mantinha
  `absolute` no canto inferior direito
*/}
      {pauseOpen && (
        <div className="pause" role="dialog" aria-modal="true">
          <div className="pause__veil" />

          <div className="pause__panel">
            <h2 className="pause__title">Pausado</h2>

            <p className="pause__hint">
              O jogo continua rodando: quem estiver jogando online
              ve voce normalmente.
            </p>

            <button
              type="button"
              className="pause__btn pause__btn--primary"
              onClick={() => setPauseOpen(false)}
            >
              Continuar
            </button>

            {onBack && (
              <button
                type="button"
                className="pause__btn"
                onClick={() => {
                  setPauseOpen(false);
                  onBack();
                }}
              >
                Voltar para as classes
              </button>
            )}

            {/*
    O BOTAO DAS TECLAS.

    ## POR QUE ELE NAO ABRE UM PAINEL E SIM UMA SEGUNDA CAMADA

    Porque o painel de teclas e largo — quatorze acoes com ate quatro slots
    cada — e a caixa do pause e estreita. Caber na mesma caixa significaria
    encolher os botoes de sair, que sao os que o jogador realmente veio usar

    ## E POR QUE FICA DEPOIS DO "VOLTAR PARA AS CLASSES"

    Porque ele e o botao de mexer no jogo, e nao o de sair dele. A leitura da
    lista e: sair, voltar, e agora as preferencias
  */}
            <button
              type="button"
              className="pause__btn"
              onClick={() => setTeclasOpen(true)}
            >
              Trocar teclas
            </button>

            {/*
              O FARM OFFLINE, e ele e a UNICA saida que nao e so fechar.

              ## POR QUE FICA DEPOIS DE "VOLTAR PARA AS CLASSES"

              Porque as duas coisas levam ao mesmo lugar: a tela de seleção
              de classe. A diferenca e que uma volta vazia e a outra sai
              com o relogio ligado no servidor. A ordem deixa a saida
              simples no topo e a que tem consequencia embaixo — que e como
              um botao de "sair e perder" deve estar em qualquer tela

              ## E POR QUE O `await` ANTES DO `onBack`

              Porque o proximo passo e DESCONECTAR, e o `desconectar` do
              cliente esvazia a fila de comandos pendentes. Sem esperar, a
              navegacao poderia desmontar a tela antes do pedido sair, e o
              jogador voltaria de maos vazias sem nenhuma pista do motivo

              O botao fica travado durante a espera: o jogador clica uma
              vez, ve "Ligando..." e espera meio segundo. Um clique
              duplo geraria dois pedidos e dois relogios

              ## E POR QUE SO APARECE COM `onBack`

              Porque sem ele nao ha para onde ir, e o "farm offline" sem
              saida seria um relogio rodando com o jogador ainda no jogo —
              o accrue contaria tempo em que ele esteve online, que e o
              oposto de offline
            */}
            {onBack && (
              <button
                type="button"
                className="pause__btn pause__btn--farm"
                onClick={handleIniciarFarmOffline}
                disabled={ligandoFarm}
                data-tip={
                  farmAtivo
                    ? "O farm offline ja esta ligado. Religue quando quiser."
                    : "Sai do jogo e deixa o servidor contando por voce. Volta depois para ver o que rendeu."
                }
              >
                {ligandoFarm ? "Ligando..." : "Iniciar farm offline"}
              </button>
            )}

            {farmAtivo && (
              <p className="pause__farm-nota">
                Farm offline ligado. Sair pela tela de classes começa a
                contar.
              </p>
            )}
          </div>
        </div>
      )}

      {/*
  O PAINEL DE TECLAS, e ele e IRMÃO do pause: mesma cortina, mesmo lugar.

  ## POR QUE ELE FICA FORA DO BLOCO ACIMA

  Porque e uma camada SEPARADA, e nao um botao a mais dentro da caixa. O
  painel tem altura propria e precisa passar por cima do pause — se ele
  morasse dentro de `.pause__panel`, a cortina e o fundo teriam que ser
  reescritos, e o pause voltaria a ser responsavel por um conteudo que nao
  e dele

  ## E POR QUE ELE NAO FECHA O PAUSE ATRAS

  Porque o jogador trocou duas teclas e apertou "Voltar": ele espera voltar
  ao menu de pausa, com a opcao de sair ainda la. Fechar os dois seria
  obrigar a abrir o pause de novo para sair, e ele nem estava pensando em
  sair
*/}
      {teclasOpen && (
        <KeyBindsPanel onFechar={() => setTeclasOpen(false)} />
      )}

      {/*
        A MORTE.
        Vem DEPOIS do pause e nao antes, porque o z-index dele e maior: o
        jogador que morreu com o pause aberto precisa ver a morte, e nao
        um "Continuar" que o colocaria de volta num mundo em que ele
        esta morto

        O painel nao tem como fechar. Quem o apaga e o proximo painel do
        servidor, com `morte.morto` falso — e ele so fica falso depois
        que uma das duas saidas deu certo
      */}
      <DeathPanel
        morte={snapshot?.morte}
        onReviver={handleReviver}
        onVoltarBase={handleVoltarBase}
      />

      {/*
        O RELATORIO DO FARM OFFLINE.

        Vem DEPOIS da morte, e o `z-index` dele e o maior de todos: um
        jogador que voltou de doze horas offline e morreu no caminho para
        ver o resultado precisa ler que MORREU primeiro. O accrue ja foi
        creditado e o relatorio continua esperando na proxima entrada — o
        que e melhor do que um modal sobre um personagem morto

        E `relatorioFarm`, que ja vem com o "eu ja vi" aplicado: sem isso
        o modal reabriria a cada painel, a 4Hz
      */}
      <OfflineFarmModal
        relatorio={relatorioFarm}
        onFechar={handleFecharFarm}
      />
    </div>
  );
}
