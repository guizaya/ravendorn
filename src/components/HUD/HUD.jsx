import { useCallback, useEffect, useMemo, useState } from "react";
import SkillSlot from "../Skills/SkillSlot.jsx";
import HudIcon from "../UI/HudIcon.jsx";
import InventoryPanel from "../Inventory/InventoryPanel.jsx";
import QuestPanel from "../Quests/QuestPanel.jsx";
import PartyBox from "./PartyBox.jsx";
import BestiaryPanel from "../Bestiary/BestiaryPanel.jsx";
import RankPanel from "../Rank/RankPanel.jsx";
import CraftPanel from "../Craft/CraftPanel.jsx";
import CollectionPanel, {
  StatusPanel,
} from "../Collection/CollectionPanel.jsx";
import EnchantPanel from "../Enchant/EnchantPanel.jsx";
import MarketPanel from "../Market/MarketPanel.jsx";
import PotionPanel from "../Potions/PotionPanel.jsx";
import GuildPanel from "../Guild/GuildPanel.jsx";
import PortalBox from "./PortalBox.jsx";
import {
  MINIMAP_HEIGHT,
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
} from "../../game/ui/minimap.js";
import { DEFAULT_LOOT_FILTER } from "../../game/loot/lootFilter.js";
import { RANK_CRITERIO } from "../../game/ranking/rank.js";
import { digitandoEm } from "../../game/ui/typing.js";
import { NPC_ACAO } from "../../data/npc/index.js";

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
   * A LOJA do mercador.
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
  KeyR: PAINEL.RANK,
  KeyC: PAINEL.CRAFT,

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
  // `KeyC` e `KeyR` ja sao de painel
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
              background: resourceColor,
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
          title={`${effect.type}: ${effect.remaining.toFixed(1)}s`}
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
      title="Parar a caça automática"
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
  onOpen,
  onFocus,
}) {
  const xp = player.xp ?? 0;
  const needed = player.xpToNext ?? 0;

  const percent =
    Number.isFinite(needed) && needed > 0
      ? Math.min(100, (xp / needed) * 100)
      : 100;

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
    <section className="qst-tracker">
      <button
        type="button"
        className="qst-tracker__head"
        onClick={onOpen}
        title="Abrir missões (Q)"
      >
        <span className="qst-tracker__lvl">
          Nv.{player.level}
        </span>

        <span className="qst-tracker__xp">
          <i style={{ width: `${percent}%` }} />
        </span>

        <small>
          {Number.isFinite(needed)
            ? `${xp}/${needed} XP`
            : "MAX"}
        </small>
      </button>

      {main && (
        <button
          type="button"
          className={[
            "qst-tracker__row",
            main.autoCompletable
              ? "is-clickable"
              : "is-manual",
            autoObjectiveId === main.id
              ? "is-auto"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() =>
            main.autoCompletable &&
            onFocus?.(main.id)
          }
          disabled={!main.autoCompletable}
          title={
            main.autoCompletable
              ? "Completar automaticamente"
              : "Conclua manualmente"
          }
        >
          <span className="qst-tracker__tag">P</span>

          <div>
            <strong>{main.name}</strong>
            <small>
              {main.progress}/{main.count}
              {main.autoCompletable
                ? ""
                : " · aguardando"}
            </small>
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
          title="Completar automaticamente"
        >
          <span className="qst-tracker__tag">S</span>

          <div>
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

export default function HUD({
  classDefinition,
  characterName,
  snapshot,
  engineRef,
  onBack = null,
  intencao = null,
  /**
   * O CONVITE DE PARTY que chegou pelo EVENTO do servidor.
   *
   * Vive aqui e nao dentro do `snapshot` porque e um instante: o painel
   * chega alguns segundos depois, e a caixa de cinco segundos nao pode
   * esperar por ele
   */
  conviteParty = null,
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
   * Abrir o PAUSE, e o que ele faz com os paineis.
   *
   * Fechar o painel aberto nao e detalhe: sao duas camadas na mesma
   * tela, e o jogador que abriu o menu para sair nao deveria encontrar
   * a colecao por cima dele
   *
   * A tecla ESC e o botao de configuracao chamam ESTE metodo, e nao
   * duas copias da mesma regra. A tecla precisa ainda poder FECHAR o
   * pause — e o unico caminho de volta sem mouse quando o painel cobre
   * a tela —, e por isso a tecla usa `alternarPause` e o botao usa
   * `abrirPause`
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
        if (event.code === "Escape") {
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
  }, [openInventory, alternarPainel, alternarPause, pauseOpen]);

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
  (nome, tag) => {
    if (intencao) {
      intencao.criarGuilda(nome, tag);
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

const handleGuildCofre = useCallback(
  (guildaId, acao) => {
    if (intencao) {
      intencao.mexerNoCofre(guildaId, acao);
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

  const handleEquip = useCallback(
    (entry, slotId) => {
      if (intencao) {
        intencao.equipar(entry.uid, slotId);
        return;
      }

      engineRef.current?.equipItem(entry.uid, slotId);
    },
    [engineRef, intencao],
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

  const handleAutoEquip = useCallback(() => {
    if (intencao) {
      intencao.equiparMelhor();
      return;
    }

    engineRef.current?.autoEquipBest();
  }, [engineRef, intencao]);

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

  const handleHuntCreature = useCallback(
    (creatureId) => {
      // online, a cacada mora na SESSAO do servidor. chamar o motor
      // da tela nao valeria: o cliente nao tem sessao nem simula, o
      // clique morria aqui e o piloto nunca ia atras da criatura
      if (intencao) {
        intencao.cacarCriatura(creatureId);
        return;
      }

      engineRef.current?.toggleBestiaryAuto(creatureId);
    },
    [engineRef, intencao],
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
    (collectionId) => {
      if (intencao) {
        intencao.entregarColecao(collectionId);
        return;
      }

      engineRef.current?.deliverCollection(collectionId);
    },
    [engineRef, intencao],
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
      const engine = engineRef.current;

      if (!engine) return;

      const destino = engine.slotFor(entry.itemId);

      if (!destino) return;

      engine.equipItem(entry.uid, destino);
    },
    [engineRef],
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
   * A posicao do jogador no rank, para o medalão do botão.
   *
   * E a posicao COMPLETA, "2/5", e nao o numero solto: com cinco
   * pessoas conectadas um "2" no botão nao diz nada, e o numero
   * solto ainda pareceria uma contagem de caçadas, que e o que o
   * medalão do bestiário mostra. So aparece com mais de uma pessoa,
   * porque "1/1" é ruido.
   */
  const minhaPosicao = (() => {
    const lista = rank?.[RANK_CRITERIO.NIVEL] ?? [];

    if (lista.length < 2) return null;

    const eu = lista.find(
      (jogador) => jogador.id === player.id,
    );

    return eu ? `${eu.posicao}/${lista.length}` : null;
  })();

  const summary = snapshot?.inventory ?? {
    coins: 0,
    used: 0,
    capacity: 20,
    isFull: false,
    items: [],
  };

  const autoOn = Boolean(snapshot?.autoPlay);
  const engaged = Boolean(snapshot?.engaged);

  return (
    <div className="hud">
      <section className="hud-vitals">
        <header className="hud-vitals__head">
          <span className="hud-lv">
            Lv.{player.level}
          </span>

          <span
            className="hud-vitals__name"
            title={`${player.name} · ${player.className}`}
          >
            {player.name}
            {/* a classe fica ao lado do nome, nao no lugar dele:
                sao coisas diferentes e so a classe aparecia
                antes */}
            <small>{player.className}</small>
          </span>
        </header>

        <Vitals
          player={player}
          resourceColor={classDefinition.resource.color}
        />

        <div className="hud-vitals__stats">
          <span>ATQ {player.attack}</span>
          <span>DEF {player.defense}</span>
          <span>VEL {player.speed}</span>
        </div>

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
          title="Inventário (I)"
        >
          <span className="hud-pouch__coins">
            <i>◉</i>
            {summary.coins}
          </span>

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
        {Number.isFinite(player.x) &&
          Number.isFinite(player.y) && (
            <output className="hud-coords">
              X {player.x} · Y {player.y}
            </output>
          )}
</section>

        {/*
          O STATUS, ao lado do bloco de vida.

          Different de qualquer outro botao da HUD: ele NAO esta dentro
          do `<section className="hud-vitals">`, e sim logo depois dele,
          como irmao. Duas razoes:

          1. dentro do bloco, o botao empurraria o conteudo dele e
             mudaria a altura da barra de vida — e o bloco e `position:
             absolute` com largura fixa, entao o estrago seria so de
             layout
          2. o botao precisa de `top`/`left` proprios para se alinhar ao
             lado do bloco. Dentro do `.hud-vitals` ele herdaria o
             contexto de posicionamento do bloco e a posicao seria
             relativa a ele, e nao a tela

          O visual e o de um `hud-btn` comum — o mesmo circulo do
          bestiario — e a cor e a da vida, porque o painel e o do
          personagem e nao acao sobre o mundo
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
          title="Status (P)"
          aria-label="Abrir o painel de status"
        >
          <HudIcon iconId="stats" />
        </button>

        {/*
          O ENCANTAMENTO, onde era o painel de teste.

          Era um painel vazio que dizia "Nada para mostrar ainda", e o
          espaco na barra era de primeira classe demais para isso. O
          `X` e o botao continuam, porque a tecla e o `X` ja eram do
          jogador antes de o painel existir
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--test",
            painelAberto === PAINEL.ENCHANT ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.ENCHANT)}
          title="Encantar (X)"
          aria-label="Abrir o painel de encantamento"
        >
          ✧
        </button>

        {/*
          A GUILDA, logo abaixo do Encantar.

          A posicao nao e estetica: a guilda e o unico painel que muda
          o personagem de verdade — o talento dela entra no
          `applyEquipment` como stat. Ficar perto do Encantar, que
          tambem mexe no personagem, e o que faz os dois botoes de
          "mudar meus numeros" ficarem juntos
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
          title="Guilda (G)"
          aria-label="Abrir o painel de guilda"
        >
          <HudIcon iconId="guild" />

          {/*
            O numero de pontos, quando ha mais de zero.

            E o que faz o jogador LEMBRAR que a guilda existe: um
            botao sem numero some na barra, e um ponto por hora so
            faz sentido se ele percebe que o ponto chegou
          */}
          {guilda?.pontos > 0 && (
            <span className="hud-btn__badge">{guilda.pontos}</span>
          )}
        </button>

        <BuffStrip effects={player.statusEffects} />

      <nav className="hud-menu">
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--bestiary",
            painelAberto === PAINEL.BESTIARIO ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.BESTIARIO)}
          title="Bestiario (B)"
          aria-label="Abrir o bestiario"
        >
          <HudIcon iconId="bestiario" />
          {bestiary &&
            bestiary.completed > 0 && (
              <i className="hud-btn__badge">
                {bestiary.completed}
              </i>
            )}
        </button>

        {/*
          O MARKET, COLADO no bestiario.

          O pedido foi "ao lado do bestiario", e ele e a vitrine entre
          os dois: o que o jogador caçou e o que ele pode vender. A
          colecao entra DEPOIS dos dois, e nao entre eles — os tres
          botoes sao progresso acumulado, com numero no badge, mas o
          par que se consulta sempre e bestiario + market
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
          title="Market (M)"
          aria-label="Abrir o mercado"
        >
          <HudIcon iconId="market" />
          {market && market.listings.length > 0 && (
            <i className="hud-btn__badge">
              {market.listings.length}
            </i>
          )}
        </button>

        {/*
          A COLECAO, depois do par bestiario + market.

          E progresso acumulado do jogador, com um numero no badge, e
          fica aqui em vez de depois do craft — que e acao, e nao
          progresso
        */}
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--collection",
            painelAberto === PAINEL.COLECAO ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => alternarPainel(PAINEL.COLECAO)}
          title="Colecao (K)"
          aria-label="Abrir a colecao"
        >
          <HudIcon iconId="collection" />
          {collection &&
            collection.total > collection.completed && (
              <i className="hud-btn__badge">
                {collection.completed}/{collection.total}
              </i>
            )}
        </button>

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
          title="Craft (C)"
          aria-label="Abrir o craft"
        >
          <HudIcon iconId="craft" />
          {craft && craft.ready > 0 && (
            <i className="hud-btn__badge">
              {craft.ready}
            </i>
          )}
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
          title="Rank (R)"
          aria-label="Abrir o rank"
        >
          <HudIcon iconId="rank" />
          {minhaPosicao && (
            <i className="hud-btn__badge">{minhaPosicao}</i>
          )}
        </button>

        {/*
          A CONFIGURACAO, no fim da fila.

          E o botao da engrenagem, e ele ABRE o pause — a mesma cortina
          que a ESC abre. Nao ha um painel de configuracao proprio:
          quem sai do personagem e quem continua esta no pause, e fazer
          um segundo menu com as mesmas duas opcoes seria uma escolha
          sem motivo

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
        <button
          type="button"
          className={[
            "hud-btn",
            "hud-btn--settings",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={abrirPause}
          title="Configuracao (ESC)"
          aria-label="Abrir o menu de configuracao"
        >
          <HudIcon iconId="settings" />
        </button>
      </nav>

      <aside className="hud-rail">
        {skillPages.map((_, index) => (
          <button
            key={index}
            type="button"
            className={[
              "hud-btn",
              "hud-btn--sm",
              page === index ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setPage(index)}
            title={`Página ${index + 1} de habilidades`}
          >
            {index + 1}
          </button>
        ))}
      </aside>

      {snapshot?.selectedTarget && (
        <section className="target-panel">
          <span className="eyebrow">ALVO</span>

          <div className="target-panel__head">
            <strong>
              {snapshot.selectedTarget.name}
            </strong>

            <span className="target-panel__level">
              Nv.{snapshot.selectedTarget.level ?? 1}
            </span>
          </div>

          <div className="target-panel__bar">
            <div
              style={{
                width: `${
                  (snapshot.selectedTarget.hp /
                    snapshot.selectedTarget.maxHp) *
                  100
                }%`,
              }}
            />
          </div>

          <small>
            {snapshot.selectedTarget.hp} /{" "}
            {snapshot.selectedTarget.maxHp} HP
          </small>
        </section>
      )}

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

      <footer className="hud-actionbar">
        <div className="hud-actionbar__slots">
          {visibleSkills.map((skill) => (
            <SkillSlot
              key={skill.id}
              skill={skill}
              cooldown={cooldowns[skill.id] ?? 0}
              draggable
              auto={Boolean(autoSkills[skill.id])}
              onToggleAuto={(enabled) =>
                handleToggleAuto(skill.id, enabled)
              }
              onClick={() =>
                engineRef.current?.useSkillSlot(skill.slot)
              }
            />
          ))}

          <span className="hud-actionbar__divider" />

          <SkillSlot
            ultimate
            skill={classDefinition.ultimate}
            cooldown={
              cooldowns[classDefinition.ultimate.id] ?? 0
            }
            onClick={() =>
              engineRef.current?.useUltimate()
            }
          />
        </div>

        <p className="hud-actionbar__hint">
          Arraste a skill ↓ para auto · ↑ para manual
        </p>
      </footer>

      <PortalBox
        portal={snapshot?.portal ?? null}
        minimapTop={
          snapshot?.selectedTarget
            ? MINIMAP_TOP_TARGETED
            : MINIMAP_TOP_IDLE
        }
        minimapHeight={MINIMAP_HEIGHT}
        onTravel={handleTravelPortal}
      />

      <div className="hud-stack">
        <QuestTracker
          quests={snapshot?.quests}
          player={player}
          onOpen={() => abrirPainel(PAINEL.MISSOES)}
          onFocus={handleFocusQuest}
        />

        {/*
          A PARTY VEM DEPOIS DA MISSÃO, e a ordem é do pedido: a box
          de party fica abaixo da de missões, na mesma coluna
        */}
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

        <BestiaryAutoBox
          hunt={snapshot?.bestiaryAuto ?? null}
          onStop={handleStopBestiaryAuto}
        />

        {/*
          O MENU DO JOGADOR MIRADO.
          *
          * Fica dentro da coluna da esquerda, e nao sobre o personagem,
          * porque o mundo se move sob o menu: um menu ancorado no sprite
          * sai de lugar no primeiro quadro de caminhada. O nome do
          * jogador vem do clique, e e ele que diz a quem o convite vai
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
              title="Convidar para a party"
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

      {painelAberto === PAINEL.MISSOES && (
        <QuestPanel
          quests={snapshot?.quests}
          onClose={() => alternarPainel(PAINEL.MISSOES)}
          onAccept={handleAcceptQuest}
          onAbandon={handleAbandonQuest}
          onFocus={handleFocusQuest}
          onToggleAuto={handleToggleQuestAuto}
          onClaim={handleClaimQuestReward}
        />
      )}

      {painelAberto === PAINEL.BESTIARIO && (
        <BestiaryPanel
          bestiary={bestiary}
          hunting={snapshot?.bestiaryAuto?.creatureId ?? null}
          onHunt={handleHuntCreature}
          onClose={() => alternarPainel(PAINEL.BESTIARIO)}
        />
      )}

      {painelAberto === PAINEL.RANK && (
        <RankPanel
          rank={rank}
          meuId={player.id}
          onClose={() => alternarPainel(PAINEL.RANK)}
        />
      )}

      {painelAberto === PAINEL.CRAFT && (
        <CraftPanel
          craft={craft}
          onCraft={handleCraftItem}
          onClose={() => alternarPainel(PAINEL.CRAFT)}
        />
      )}

      {painelAberto === PAINEL.COLECAO && (
        <CollectionPanel
          collection={collection}
          onDeliver={handleDeliverCollection}
          onClose={() => alternarPainel(PAINEL.COLECAO)}
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
          onEnchant={handleEnchantItem}
          onClose={() => alternarPainel(PAINEL.ENCHANT)}
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
          onCriar={handleGuildCreate}
          onBuscar={handleGuildSearch}
          onPedir={handleGuildRequest}
          onAceitar={handleGuildAccept}
          onNegar={handleGuildDeny}
          onSair={handleGuildLeave}
          onTalent={handleGuildTalent}
          onCofre={handleGuildCofre}
          onClose={() => alternarPainel(PAINEL.GUILD)}
        />
      )}

      {painelAberto === PAINEL.MARKET && (
        <MarketPanel
          market={market}
          inventory={snapshot?.inventory}
          onBuy={handleBuyItem}
          onCancel={handleCancelListing}
          onList={handleListItem}
          onClose={() => alternarPainel(PAINEL.MARKET)}
        />
      )}

      {/*
        A LOJA. Fica depois do mercado por ordem de leitura do arquivo,
        e nao por dependencia: os dois sao irmos, e nenhum monta o
        outro
      */}
      {painelAberto === PAINEL.POCOES && (
        <PotionPanel
          coins={summary.coins}
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
          onAutoEquip={handleAutoEquip}
          onUseItem={handleUseItem}
          onFilterChange={handleFilterChange}
          onFilterReset={handleFilterReset}
          onFilterPrune={handleFilterPrune}
        />
      )}

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
        title="Auto play (T)"
      >
        <span className="hud-ability__ring" />
        <span className="hud-ability__text">
          {autoOn ? "AUTO" : engaged ? "ALVO" : "OFF"}
        </span>
        <span className="hud-ability__key">T</span>
      </button>

      {/*
        O PAUSE.
        A cortina cobre a tela inteira e escurece o jogo: e o que separa
        "estou olhando um painel" de "parei". O botao de sair fica AQUI,
        e nao na barra — sair nao e um atalho, e uma decisao
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
          </div>
        </div>
      )}
    </div>
  );
}
