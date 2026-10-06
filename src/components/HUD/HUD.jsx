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
import EnchantPanel, {
  chave,
} from "../Enchant/EnchantPanel.jsx";
import MarketPanel from "../Market/MarketPanel.jsx";
import PotionPanel from "../Potions/PotionPanel.jsx";
import HabilidadesPanel from "../Skills/HabilidadesPanel.jsx";

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
import BossBox from "./BossBox.jsx";
import TravelBox from "./TravelBox.jsx";
import DeathPanel from "./DeathPanel.jsx";
import {
  MINIMAP_HEIGHT,
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
} from "../../game/ui/minimap.js";
import { DEFAULT_LOOT_FILTER } from "../../game/loot/lootFilter.js";
import { RANK_CRITERIO } from "../../game/ranking/rank.js";
import { digitandoEm } from "../../game/ui/typing.js";

/**
 * O ID DA ARENA, para o botao saber se o clique entra ou sai.
 *
 * Vem do registro de mapas e nao de um literal aqui: o mesmo id e usado
 * pelo servidor para escolher o destino, e um `const` solto no HUD
 * permitiria que um deles mudasse sem o outro
 */
import { ARENA_ID, findMap } from "../../data/maps/index.js";
import { CREATURE_TYPES } from "../../data/enemies/index.js";
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

  /**
   * O PAINEL DE HABILIDADES, do mestre da base.
   *
   * Nao tem tecla, como a loja do mercador: os dois abrem por clique no
   * NPC, e nenhum outro painel do jogo depende de o jogador estar perto
   * de uma coisa. Um painel preso a um NPC e um painel que ninguem
   * encontra
   */
  HABILIDADES: "habilidades",
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
      {/*
        O NIVEL E A BARRA DE XP SAIRAM DO CABECALHO.

        Eles foram para o rodape da tela (`Rodape`), colados na
        borda. Cabiam aqui e a leitura era boa, mas disputavam espaco com
        a linha da missao — que e o que o jogador precisa ler enquanto
        joga, e o nivel so importa de vez em quando
      */}
      <button
        type="button"
        className="qst-tracker__head"
        onClick={onOpen}
        title="Abrir missões (Q)"
      >
        {/*
          O QUE FICOU NO BOTAO.

          Sem texto, o botao fica com a altura de um cabecalho vazio. E
          por isso que ele existe ainda: e a AREA CLICAVEL que abre o
          painel de missoes, e remover o texto sem remover o botao
          deixaria um espaco morto no topo da box
        */}
        <span className="qst-tracker__head-mark">✧</span>
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
      title={`${rotulo}: ${atual}/${maximo}`}
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
      title={
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
function Atributos({ player }) {
  return (
    <span className="rodape__atributos">
      <span className="rodape__atributo">
        <small>ATQ</small>
        {player?.attack ?? 0}
      </span>

      <span className="rodape__atributo">
        <small>DEF</small>
        {player?.defense ?? 0}
      </span>

      <span className="rodape__atributo">
        <small>VEL</small>
        {player?.speed ?? 0}
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
        <Atributos player={player} />

        <BarraInterna
          percent={hpPercent}
          atual={hp}
          maximo={maxHp}
          cor="var(--hp, #e8655e)"
          rotulo="Vida"
        />

        <BarraInterna
          percent={recursoPercent}
          atual={recurso}
          maximo={maxRecurso}
          cor={player?.resourceColor ?? "#6f8fe0"}
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
 * O JOGADOR ESTA NA ARENA?
 *
 * E a unica coisa que o botao precisa saber, e ele compara o `mapa` do
 * estado com o id da arena. O id vem do proprio pacote do servidor — nao
 * de um `if` escrito no HUD — entao trocar o nome do mapa no registro e o
 * unico lugar que precisa mudar
 */
const naArena = mapa === ARENA_ID;

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
      if (!iaParar) {
        setPainelAberto((atual) =>
          atual === PAINEL.BESTIARIO ? null : atual,
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

      setPainelAberto(PAINEL.ENCHANT);
    },
    [],
  );

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
   * vazio o jogador veria as cinco trancadas no primeiro quadro e
   * acharia que perdeu o repertorio inteiro
   */
  const habilidadesAprendidas = useMemo(() => {
    const lista = snapshot?.habilidadesAprendidas;

    if (!Array.isArray(lista)) return null;

    return new Set(lista);
  }, [snapshot?.habilidadesAprendidas]);

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
        {/*LOC AQUI*/}
        {/* {Number.isFinite(player.x) &&
          Number.isFinite(player.y) && (
            <output className="hud-coords">
              X {player.x} · Y {player.y}
            </output>
          )} */}
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
          onClick={alternarEncantar}
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
          {/*
          A ARENA DO CHEFE, ao lado do bestiario.

          ## ESTE BOTAO SO EXISTE FORA DA ARENA

          Ele ENTRA, e dentro da arena ele simplesmente nao esta na tela.
          Quem esta la sai pela `BossBox`, embaixo do minimapa

          Some, e nao desliga. Um botao desligado ainda ocupa o espaco do
          icone, ainda parece a acao principal daquela fileira e ainda
          obriga o jogador a passar o mouse por cima para descobrir que
          nao faz nada. Hiding e o que faz a fileira dizer a verdade: la
          fora existe "entrar na arena", e dentro nao existe nada porque
          nao ha o que entrar

          Antes ele fazia os dois sentidos, conforme o `mapa`. O icone
          ficava a meia tela do minimapa e o jogador tinha de lembrar em
          que mapa estava para saber se o clique tirava ele de la ou
          jogava ele dentro. Um botao que muda de-como-funciona conforme
          o lugar e um botao que o jogador precisa ler antes de clicar —
          e agora ele nem existe no lugar onde isso seria confuso

          ## SEM O `intencao`, O BOTAO NAO FALA COM O MOTOR LOCAL

          A arena e uma viagem entre mapas, e a viagem de rede e do
          SERVIDOR. Nao existe caminho offline para ela, e um botao que
          fingisse que existe trocaria o mapa do jogador sem o mundo do
          outro lado saber
        */}
        {!naArena && (
          <button
            type="button"
            className={["hud-btn", "hud-btn--arena"].join(" ")}
            onClick={handleArena}
            disabled={!intencao}
            title="Entrar na arena do chefe"
            aria-label="Entrar na arena do chefe"
          >
            <HudIcon iconId="arena" />
          </button>
        )}

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
          <div className="hud-actionbar__pilha">
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
              <span className="hud-ability__text">auto</span>
            </button>

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

      {/*
        A SAIDA DA ARENA, no mesmo lugar da box do portal.

        As duas nao aparecem juntas — a arena nao tem portal, e o
        `dadosDoPortalNoPe` do motor nao acha nenhum la. Mas a POSICAO e
        a mesma de proposito: as duas sao "a saida do lugar em que voce
        esta", embaixo do minimapa, e o olho do jogador ja esta ali

        E a mesma `handleArena` do icone do HUD. O pedido e o mesmo
        (ENTRAR ou SAIR), e quem decide o sentido e o servidor, que le o
        mapa em que o jogador esta. Um botao local que so soubesse sair
        teria de inventar um pedido novo para o mesmo servidor
      */}
      <BossBox
        naArena={naArena}
        nomeChefe={nomeChefeDaArena}
        minimapTop={
          snapshot?.selectedTarget
            ? MINIMAP_TOP_TARGETED
            : MINIMAP_TOP_IDLE
        }
        minimapHeight={MINIMAP_HEIGHT}
        onSair={handleArena}
      />

      {/*
        O ATALHO DO DESLOCAMENTO LONGO.

        Terceira box no mesmo canto: a saida da arena e o atalho da
        caminhada. As tres nao coexistem — a arena nao tem viagem longa,
        e o portal da para chegar antes de a caminhada ficar longa — mas
        elas dividem a posicao de proposito, porque dividem o sentido:
        "o que a tela oferece sobre onde voce esta"

        Ela decide se existe lendo `teleporte` do painel, e `null` e o
        estado de "nao ha viagem longa". Nenhum `if` sobre a posicao do
        jogador mora aqui: quem tem o plano de viagem e o motor
      */}
      <TravelBox
        teleporte={snapshot?.teleporte ?? null}
        minimapTop={
          snapshot?.selectedTarget
            ? MINIMAP_TOP_TARGETED
            : MINIMAP_TOP_IDLE
        }
        minimapHeight={MINIMAP_HEIGHT}
        onTeleportar={handleTeleportar}
      />

      <div className="hud-stack">
        {/*
          A BOX DE MISSOES SOME DENTRO DA ARENA.

          ## POR QUE

          A arena nao tem zona de mob, nao tem NPC e nao tem portal: e
          um lugar sem nada para fazer la dentro. O que a box mostraria
          ali e o tracker de uma campanha que o jogador NAO esta
          fazendo — e o pior tipo de convite: a missao aparece
          acompanhada, o jogador sobe um degrau que ele nao pode
          dar aqui, e a barra de progresso dele nao anda

          ## E O PAINEL CONTINUA ABRINDO

          So a BOX some. O botao de missoes no HUD e o `QuestPanel`
          continuam como estao: quem quiser ver o que tem para fazer
          ainda pode, e o atalho continua valendo. Esconder a caixa e o
          que tira o convite da frente; esconder o acesso seria tirar o
          jogador do jogo
        */}
        {!naArena && (
          <QuestTracker
            quests={snapshot?.quests}
            player={player}
            onOpen={() => abrirPainel(PAINEL.MISSOES)}
            onFocus={handleFocusQuest}
          />
        )}

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
          /**
           * A PECA QUE ENTRA JA ESCOLHIDA.
           *
           * Vem do "Encantar" da caixa do item. Sem isto, o painel abriria
           * com a lista inteira e o jogador teria que achar a peca de novo
           */
          selecaoInicial={alvoEncantar}
          onEnchant={handleEnchantItem}
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
          onEnchant={handleOpenEnchant}
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
          </div>
        </div>
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
    </div>
  );
}
