import { useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import { getItem } from "../../data/items/index.js";
import { QUEST_SCOPE } from "../../data/quests/index.js";
import { MAP_1, MAP_1_META, MAP_2, MAP_2_ZONES } from "../../data/maps/index.js";

/**
 * OS MAPAS QUE TEM MISSAO.
 *
 * ## A BASE FICA DE FORA
 *
 * O registro `MAPS` tem tres mapas: `base` (o hub), `map_1` (o vale) e
 * `map_2`. A base fica de fora — e onde o jogador nasce, nao tem
 * criatura e nao vai ter missao. Uma aba de mapa sem nada e um item de
 * menu que so leva a uma tela vazia
 *
 * ## POR QUE MAPA 1 E MAPA 2 ESTAO JUNTOS NESTA LISTA
 *
 * A campanha e uma escada so: o `QuestLog` tem um `mainIndex` unico que
 * caminha do degrau 1 ao 24. O mapa 2 nao e uma campanha separada que
 * o jogador escolhe — e a continuacao, e a aba dele so existe para o
 * jogador nao ter que rolar 24 degraus para achar o proximo
 *
 * Esta lista e a UNICA fonte de quais mapas aparecem
 */
const MAPAS_RAIL = [
  {
    id: MAP_1.id,
    name: MAP_1.name,
    cor: MAP_1_META.zones?.[0]?.terrain === "grass" ? "#5f8f4a" : "#6fbf8a",
  },
  {
    id: MAP_2.id,
    name: MAP_2.name,
    cor: MAP_2_ZONES?.[0]?.terrain === "grass" ? "#5f8f4a" : "#6fbf8a",
  },
];

/** O mapa que a barra abre: o primeiro da lista. */
const MAPO_INICIAL = MAPAS_RAIL[0].id;

/**
 * O MAPA DE UMA ZONA.
 *
 * A aba do mapa e escolhida pelo `location` de cada passo, e o mapa de
 * uma zona e o `mapId` que o registro dela carrega. As zonas do mapa 2
 * tem o prefixo `m2_` no id, mas nao no `mapId` — e o `mapId` que decide
 */
function mapaDaZona(zoneId) {
  return zoneId?.startsWith("m2_") ? MAP_2.id : MAP_1.id;
}

/**
 * Quantas missoes do mapa ainda NAO foram concluidas.
 *
 * Some as duas abas: as pendentes da principal e as secundarias que
 * faltam. Uma missao concluida some do numero, que e o que faz o
 * contador cair conforme o jogador avanca
 *
 * O `mapaId` entra no filtro pelo `location` de cada missao, que e o id
 * de zona. Uma missao de `treino` conta no mapa 1 e uma de `m2_treino`
 * conta no mapa 2
 */
function contarPendentes(data, mapaId) {
  if (!data) return 0;

  const passosPendentes = (data.main?.steps ?? []).filter(
    (step) =>
      step.state !== "done" && mapaDaZona(step.location) === mapaId,
  ).length;

  const sidePendentes = [
    ...(data.side?.available ?? []),
    ...(data.side?.current ? [data.side.current] : []),
  ].filter(
    (quest) =>
      !quest.done && mapaDaZona(quest.location) === mapaId,
  ).length;

  return passosPendentes + sidePendentes;
}

/**
 * O AVANCO DE CADA MAPA: quantas missoes ja foram feitas, de quantas.
 *
 * O mesmo par do `contarPendentes`, so que para o inverso: quantas
 * faltam e quantas existem. E daqui que sai a largura da barra do
 * trilho
 *
 * Duas fontes, porque a campanha e a secundaria contam separately:
 * os `steps` da principal e as secundarias disponiveis/ativa
 */
function contarProgresso(data, mapaId) {
  if (!data) return { feitas: 0, total: 0, percent: 0 };

  const passos = (data.main?.steps ?? []).filter(
    (step) => mapaDaZona(step.location) === mapaId,
  );

  const secundarias = [
    ...(data.side?.available ?? []),
    ...(data.side?.current ? [data.side.current] : []),
  ].filter((quest) => mapaDaZona(quest.location) === mapaId);

  const feitas =
    passos.filter((step) => step.state === "done").length +
    secundarias.filter((quest) => quest.done).length;

  const total = passos.length + secundarias.length;

  return {
    feitas,
    total,

    /**
     * A BARRA COMECA VAZIA.
     *
     * `total === 0` e 0 e nao 100: um mapa sem missao alguma nao esta
     * "completo", esta vazio — e um trilho verde cheio diria o
     * contrario
     */
    percent: total > 0 ? Math.round((feitas / total) * 100) : 0,
  };
}

const TYPE_LABEL = {
  hunt: "Caçada",
  kill: "Extermínio",
  equip: "Equipamento",
  level: "Progressão",
  locked: "Bloqueada",
};

/**
 * O bloco de RECOMPENSAS de uma missao: ouro, xp e itens.
 *
 * Fica a DIREITA do cartao, na ordem em que o jogador lida com eles:
 * moedas, xp, itens. E sempre o que a missao promete, e nao o que o
 * jogador ja recebeu — e o valor da coluna e ver antes de clicar no
 * [RECEBER]
 *
 * Cada icone e a arte do item quando ele tem (`ItemIcon` cai no
 * glifo do catalogo quando nao tem), a moeda usa o mesmo `◉` do
 * contador de ouro da HUD, e o xp e um selo de texto. Nenhum dos
 * tres e um item do catalogo, entao os tres tem tratamento proprio
 */
function Rewards({ rewards }) {
  const coins = rewards?.coins ?? 0;
  const xp = rewards?.xp ?? 0;
  const items = rewards?.items ?? [];

  if (coins <= 0 && xp <= 0 && items.length === 0) {
    return null;
  }

  return (
    <div
      className="qst-rewards"
      title="Recompensa ao concluir a missão"
    >
      {coins > 0 && (
        <span className="qst-reward qst-reward--gold">
          <i aria-hidden="true">◉</i>
          {coins}
          <span className="qst-reward__sr">
            {" "}
            moedas
          </span>
        </span>
      )}

      {xp > 0 && (
        <span className="qst-reward qst-reward--xp">
          <i aria-hidden="true">XP</i>
          {xp}
          <span className="qst-reward__sr"> de xp</span>
        </span>
      )}

      {items.map((premio) => {
        /**
         * O item do CATALOGO, e nao so o `itemId`.
         *
         * O `ItemIcon` tira a arte do `itemId` + raridade, mas o
         * glifo de quem nao tem arte vem do `item.icon`. Passando so
         * o `itemId`, os materiais da missao — que sao todos sem arte
         * desenhada — desenharia um icone VAZIO, que e pior que
         * nenhum icone
         */
        const item = getItem(premio.itemId);

        return (
          <span
            key={premio.itemId}
            className="qst-reward qst-reward--item"
            title={`${premio.count}x ${
              item?.name ?? premio.itemId
            }`}
          >
            <ItemIcon
              item={item}
              itemId={premio.itemId}
              rarity={item?.rarity ?? null}
              className="qst-reward__icon"
              alt=""
            />
            <b>{premio.count}</b>
            <span className="qst-reward__sr">
              {" "}
              {item?.name ?? premio.itemId}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** A barra e o contador `3/4` de um objetivo que anda. */
function Progress({ progress, count }) {
  const atual = Math.min(progress ?? 0, count ?? 0);
  const percent =
    count > 0 ? Math.min(100, (atual / count) * 100) : 0;

  return (
    <div className="qst-progress">
      <div className="qst-progress__track">
        <i style={{ width: `${percent}%` }} />
      </div>
      <span>
        {atual}/{count}
      </span>
    </div>
  );
}

/**
 * O cartao de uma missao.
 *
 * Tres colunas, na ordem da referencia: o que a missao e a fazer, o
 * que ela paga, e o botao. O `li` e o alvo do layout em grade, e por
 * isso que o texto fica num wrapper so: o nome nunca compete com os
 * icones por espaco
 */
function QuestRow({
  quest,
  state,
  onAccept,
  onAbandon,
  onFocus,
  onClaim,
  auto,
}) {
  const waiting = quest.autoCompletable === false;
  const claimable = Boolean(quest.claimable) || state === "claimed";

  const progresso =
    typeof quest.count === "number" && quest.count > 0;

  const classe = [
    "qst-row",
    `is-${state}`,
    claimable ? "is-claimed" : "",
    waiting && state === "active" ? "is-waiting" : "",
    auto ? "is-auto" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classe}>
      <div className="qst-row__info">
        <div className="qst-row__head">
          <strong>{quest.name}</strong>
          <span className="qst-row__type">
            {TYPE_LABEL[quest.type] ?? quest.type}
          </span>
        </div>

        <p className="qst-row__text">
          {quest.summary}
        </p>

        {progresso &&
          !waiting &&
          (state === "active" || state === "available") && (
            <Progress
              progress={quest.progress ?? 0}
              count={quest.count}
            />
          )}

        {waiting && state === "active" && (
          <span className="qst-row__waiting">
            Conclua manualmente
          </span>
        )}
      </div>

      <Rewards rewards={quest.rewards} />

      <div className="qst-row__action">
        {/*
          A ordem aqui e o que separa [RECEBER] de [CONCLUIDA].

          `claimable` vem PRIMEIRO porque e o unico estado em que a
          recompensa ainda esta na fila. O `done` sozinho quer dizer
          "o objetivo foi cumprido E o resgate ja saiu", e nesse
          caso o botao e so o rotulo
        */}
        {claimable ? (
          <button
            type="button"
            className="qst-action qst-action--claim"
            onClick={() => onClaim?.(quest.id)}
            title="Receber moedas, xp e itens"
          >
            RECEBER
          </button>
        ) : state === "available" && onAccept ? (
          <button
            type="button"
            className="qst-action qst-action--accept"
            onClick={() => onAccept(quest.id)}
          >
            Aceitar
          </button>
        ) : onFocus && state === "active" && !waiting ? (
          <button
            type="button"
            className={[
              "qst-action",
              "qst-action--auto",
              auto ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onFocus(quest.id)}
            title="Completar esta missão em modo automático"
          >
            {auto ? "AUTO" : "Completar auto"}
          </button>
        ) : state === "done" ? (
          <span className="qst-action qst-action--done">
            ✓ CONCLUÍDA
          </span>
        ) : null}

        {onAbandon && state === "active" && (
          <button
            type="button"
            className="qst-action qst-action--abandon"
            onClick={onAbandon}
          >
            Abandonar
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * A COLUNA DE DIREITO: as abas de tipo e a lista.
 *
 * A barra lateral de mapas e irma desta. O painel virou uma linha com
 * duas colunas — mapa a esquerda, trabalho a direita — em vez de uma
 * coluna so
 */
function QuestColumn({ children }) {
  return <div className="qst-panel__col">{children}</div>;
}

/**
 * A BARRA LATERAL DE MAPAS.
 *
 * ## POR QUE SO O MAPA 1
 *
 * O registro `MAPS` tem dois mapas: `base` (o hub) e `map_1` (o vale).
 * A base fica de fora de proposito — e onde o jogador spawna, nao tem
 * criatura e nao vai ter missao. Uma aba de mapa sem missao nenhuma e
 * um item de menu que so leva o jogador a uma tela vazia
 *
 * ## POR QUE MAPA 1 E NAO "VALE"
 *
 * O nome vem do proprio dado (`MAP_1.name`), e nao e escrito aqui. O
 * dia que o vale ganhar outro nome o painel acompanha sozinho, e o que
 * este arquivo nao faz e manter dois nomes do mesmo mapa
 *
 * ## O CONTADOR
 *
 * E o total de missoes que NAO estao concluidas naquele mapa: as duas
 * abas somadas. E um numero derivado do que ja esta na tela, e nao um
 * campo novo no snapshot
 */
function MapRail({ mapaAtivo, onSelect, quests }) {
  const mapas = useMapRails(quests);

  return (
    <nav
      className="qst-rail"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Mapa das missões"
    >
      <span className="qst-rail__label">Mapas</span>

      {mapas.map((mapa) => (
        <button
          key={mapa.id}
          type="button"
          role="tab"
          className={[
            "qst-rail__tab",
            mapaAtivo === mapa.id ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-selected={mapaAtivo === mapa.id}
          onClick={() => onSelect(mapa.id)}
          title={`${mapa.name} — ${mapa.pendentes} missão(ões) a fazer`}
        >
          {/*
            A BARRA DE AVANCO DO MAPA.

            Antes esta barra era a cor do chao do mapa, sempre cheia:
            uma barra de progresso que mostra 100% desde o primeiro
            segundo mente sobre o quanto da campanha foi feito. Agora e
            o quanto das missoes daquele mapa ja esta concluido, e
            nasce vazia

            O `cor` do mapa continua no `data-cor`: e a identidade do
            mapa e quem vai tingir o preenchimento
          */}
          <span
            className="qst-rail__swatch"
            style={{ "--cor-mapa": mapa.cor }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={mapa.percent}
            aria-label={`Avanço em ${mapa.name}`}
          >
            <i style={{ width: `${mapa.percent}%` }} />
          </span>

          <small>{mapa.name}</small>
        </button>
      ))}
    </nav>
  );
}

/**
 * O QUE CADA MAPA DO PAINEL SABE.
 *
 * A lista vem do dado e o contador e derivado do `quests`, que ja chega
 * no painel. Nada disso entra no snapshot: um contador por mapa no
 * servidor seria estado duplicado do que o painel tem na mao
 *
 * A cor e a do chao que o jogador ve la fora, e nao uma cor inventada
 * para o painel
 */
function useMapRails(quests) {
  return MAPAS_RAIL.map((mapa) => ({
    ...mapa,
    pendentes: contarPendentes(quests, mapa.id),
    ...contarProgresso(quests, mapa.id),
  }));
}

export default function QuestPanel({
  quests,
  onClose,
  onAccept,
  onAbandon,
  onFocus,
  onToggleAuto,
  onClaim,
}) {
  const data = quests ?? {
    main: { steps: [], current: null, total: 0 },
    side: { available: [], current: null, completed: 0 },
    auto: { enabled: false, objectiveId: null, quest: null },
    claimable: [],
  };

  const side = data.side;
  const auto = data.auto ?? {};

  /**
   * O MAPA aberto, na lateral esquerda.
   *
   * ## POR QUE COMECA NO PRIMEIRO E NAO EM NENHUM
   *
   * A lista tem so o mapa 1, entao qualquer escolha inicial seria
   * equivalente — mas "nenhum" deixaria a coluna de direita sem dono e
   * o painel apareceria quebrado. `null` aqui e um estado que o jogador
   * nunca deve ver
   *
   * ## POR QUE O MAPA VIROU PARTE DO ESTADO
   *
   * E o que o jogador escolheu, e nao um detalhe do render: quando
   * entrarem outros mapas com missoes, a coluna de direita tem de
   * mostrar o mapa que esta marcado aqui, e nao a primeira lista
   */
  const [mapa, setMapa] = useState(MAPO_INICIAL);

  // a aba segue o trabalho do jogador: com uma side ativa e uma
  // principal em andamento, a principal tem prioridade, porque e
  // ela que desbloqueia a campanha
  const [tab, setTab] = useState(() =>
    data.main?.current ? "main" : "side",
  );

  /**
   * O QUE PERTENCE A ABA ABERTA.
   *
   * A campanha e uma escada so, do degrau 1 ao 24, e as duas abas do
   * painel sao o MESMO `steps` filtrado pelo mapa. Sem o filtro, a aba do
   * mapa 2 mostraria os 24 degraus com o mapa 1 inteiro em cima
   *
   * O filtro e pelo `location` de cada passo, e nao pelo `id`: o `id` tem
   * o mapa escrito no texto (`map2_main_13_...`) e ler string para saber
   * de que mapa e um passo e o tipo de coisa que quebra quando alguem
   * renomeia o prefixo
   */
  const passosDaAba = data.main.steps.filter(
    (step) => mapaDaZona(step.location) === mapa,
  );

  const sideDaAba = side.available.filter(
    (quest) => mapaDaZona(quest.location) === mapa,
  );

  const sideAtualDaAba =
    side.current && mapaDaZona(side.current.location) === mapa
      ? side.current
      : null;

  const hasActiveSide = Boolean(sideAtualDaAba);

  // A aba escolhida pode esvaziar do nada: a campanha termina e a
  // lista de passos some do snapshot. Marcar "Principal" com
  // nada dentro e pior que trocar de aba, porque o jogador fica
  // olhando para um vazio achando que quebrou. O desvio vai para
  // a aba que tem o que mostrar.
  const mainTemAlgo = passosDaAba.length > 0;
  const sideTemAlgo = sideDaAba.length > 0 || hasActiveSide;

  const ativa =
    tab === "main"
      ? mainTemAlgo
        ? "main"
        : sideTemAlgo
          ? "side"
          : "main"
      : sideTemAlgo
        ? "side"
        : mainTemAlgo
          ? "main"
          : "side";

  const abas = [
    {
      id: "main",
      label: "Principal",
      icon: "★",
      // quantas faltam terminar: e o que importa na campanha
      count: data.main.steps.filter(
        (step) =>
          data.main.current?.id === step.id ||
          step.state !== "done",
      ).length,
    },
    {
      id: "side",
      label: "Secundárias",
      icon: "◆",
      count: sideDaAba.filter((quest) => !quest.done)
        .length,
    },
  ];

  /**
   * De onde vem a missao da aba ABERTA, que e o que o [RECEBER]
   * filtra.
   *
   * A aba e o que o jogador esta olhando, e o `scope` e o que a
   * recompensa e. Os dois andam juntos — a Principal so tem
   * recompensa de missao principal — mas quem decide a aba e o
   * snapshot, e nao o contrario
   */
  const scopeDaAba =
    ativa === "main" ? QUEST_SCOPE.MAIN : QUEST_SCOPE.SIDE;

  /**
   * As missoes com recompensa nao recebida DESTA aba.
   *
   * O filtro e pelo `scope` justamente para o [RECEBER] nao vazar
   * de uma aba para a outra: uma principal concluida apareceria duas
   * vezes, uma em cada aba, e o jogador veria o mesmo botao em dois
   * lugares
   *
   * O [RECEBER] nao e um cartao a parte: ele fica no cartao da propria
   * missao, e o que muda e o estado dela. Sem o `state: "claimed"`
   * abaixo, a principal concluida desapareceria da lista no instante
   * em que o jogador fecha o objetivo, e ele nunca veria de onde saiu
   * o gold
   */
  const resgataveis = (data.claimable ?? []).filter(
    (entrada) => entrada.scope === scopeDaAba,
  );

  const recompensaDe = (questId) =>
    resgataveis.find((entrada) => entrada.id === questId) ??
    null;

  return (
    <section className="qst-panel">
      <header className="qst-panel__head">
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (Q)"
        >
          ✕
        </button>

        <h2>Missões</h2>

        {resgataveis.length > 0 && (
          <span className="qst-panel__pending">
            {resgataveis.length}{" "}
            {resgataveis.length === 1
              ? "recompensa"
              : "recompensas"}{" "}
            a receber
          </span>
        )}

        <button
          type="button"
          className={[
            "qst-auto",
            auto.enabled ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={onToggleAuto}
          title="Completar a missão em modo automático"
        >
          {auto.enabled ? "AUTO ON" : "AUTO"}
        </button>
      </header>

      <div className="qst-panel__split">
        <MapRail
          mapaAtivo={mapa}
          onSelect={setMapa}
          quests={data}
        />

        <QuestColumn>
      <nav
        className="qst-tabs"
        role="tablist"
        aria-label="Tipo de missão"
      >
        {abas.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className={[
              "qst-tab",
              ativa === entry.id ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-selected={ativa === entry.id}
            onClick={() => setTab(entry.id)}
            title={
              entry.id === "side"
                ? hasActiveSide
                  ? "Uma secundária ativa por vez"
                  : "Escolha uma secundária"
                : entry.label
            }
          >
            <span className="qst-tab__icon">
              {entry.icon}
            </span>
            <small>{entry.label}</small>
            {entry.count > 0 && (
              <i className="qst-tab__count">
                {entry.count}
              </i>
            )}
          </button>
        ))}
      </nav>

      <div className="qst-panel__body">
        {auto.quest && (
          <div className="qst-autoinfo">
            <span className="qst-autoinfo__tag">
              AUTO
            </span>
            <div>
              <strong>{auto.quest.name}</strong>
              <small>
                {auto.quest.summary} —{" "}
                {auto.quest.progress}/{auto.quest.count}
              </small>
            </div>
          </div>
        )}

        {ativa === "main" ? (
          <section className="qst-group">
            <ul className="qst-list">
              {passosDaAba.map((step) => {
                const current =
                  data.main.current?.id === step.id;

                const base = current
                  ? data.main.current
                  : {
                      ...step,
                      /**
                       * So o passo que ainda NAO foi cumprido e
                       * "bloqueado".
                       *
                       * Marcar tambem o passo `done` como bloqueado
                       * colocava a etiqueta BLOQUEADA ao lado do
                       * [RECEBER], e o jogador lia "esta missao esta
                       * trancada" numa missao que ele acabou de
                       * terminar. O bloqueio de verdade continua no
                       * `state: "locked"`, que e a opacidade do
                       * cartao
                       */
                      type:
                        step.state === "done"
                          ? step.type
                          : "locked",
                    };

                const resgatavel = recompensaDe(step.id);

                return (
                  <QuestRow
                    key={step.id}
                    quest={{
                      ...base,
                      // a recompensa vem do passo, e o passo e
                      // sempre a linha real do catalogo. o `current`
                      // e o mesmo passo ja atualizado com progresso
                      rewards:
                        step.rewards ?? base.rewards,
                      claimable: step.claimable,
                    }}
                    state={
                      resgatavel
                        ? "claimed"
                        : current
                          ? "active"
                          : step.state
                    }
                    auto={
                      auto.enabled &&
                      auto.objectiveId === step.id
                    }
                    onFocus={
                      current ? onFocus : undefined
                    }
                    onClaim={onClaim}
                  />
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="qst-group">
            {sideAtualDaAba && (
              <ul className="qst-list">
                <QuestRow
                  quest={sideAtualDaAba}
                  state="active"
                  auto={
                    auto.enabled &&
                    auto.objectiveId === sideAtualDaAba.id
                  }
                  onAbandon={onAbandon}
                  onFocus={onFocus}
                  onClaim={onClaim}
                />
              </ul>
            )}

            <ul className="qst-list">
              {sideDaAba.map((quest) => {
                /**
                 * A missao ativa JA esta desenhada no bloco de
                 * cima, com o botao de abandonar e o de auto.
                 *
                 * Ela aparecia duas vezes: uma la e outra aqui, com
                 * dois "Abandonar" na mesma tela. A de cima e a
                 * completa; a de baixo e a lista do que da para
                 * escolher, e a ativa ja esta escolhida
                 */
                if (quest.active) return null;

                const resgatavel =
                  recompensaDe(quest.id);

                const state = resgatavel
                  ? "claimed"
                  : quest.done
                    ? "done"
                    : hasActiveSide
                      ? "locked"
                      : "available";

                return (
                  <QuestRow
                    key={quest.id}
                    quest={quest}
                    state={state}
                    onAccept={
                      state === "available" ? onAccept : null
                    }
                    onClaim={onClaim}
                  />
                );
              })}
            </ul>
          </section>
        )}
      </div>
        </QuestColumn>
      </div>
    </section>
  );
}