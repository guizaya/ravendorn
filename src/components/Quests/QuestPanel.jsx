import { useEffect, useState } from "react";

import { ROTULO_DO_PAINEL } from "./rotuloDoPainel.js";

/**
 * A WALKTHROUGH INTERATIVA DO TUTORIAL.
 *
 * ## O QUE ELA E
 *
 * Um cartao grande que abre junto com a missao de tutorial, e mostra tres
 * coisas: em qual dos SETE passos o jogador esta, o que ele tem que fazer, e
 * um botao que abre a aba certa
 *
 * ## POR QUE UM PASSO SEPARADO, E NAO MAIS UM TEXTO NO CARD
 *
 * Porque a lista de missoes e um HISTORICO de 29 linhas, e o tutorial
 * atual esta no meio dela. O jogador abre o painel, ve "Passo 2 de 7" em um
 * card separado acima da lista, e nao precisaachar qual das 29 linhas e a
 * dele — ele ja sabe, e o numero responde
 *
 * ## POR QUE SO COM TUTORIAL EM FOCO
 *
 * Porque a walkthrough e ENSINO, e nao HUD. Ela some no instante em que a
 * missao de tutorial e concluida e o proximo degrau de cacada vira o atual —
 * e e ai que ela deve sumir, porque o jogador ja sabe jogar
 *
 * ## O BOTAO E O QUE FAZ ELA SER INTERATIVA
 *
 * Porque a alternativa era o jogador ler "crie 1 item no craft" e sair
 * procurando a aba. O botao abre a aba, e o contador de passos mostra que
 * ha seis mais
 */
function Walkthrough({ passos, atual, aoAbrirPainel }) {
  const [passo, setPasso] = useState(0);

  /**
   * OS SETE PASSOS, e so os que tem `dica`.
   *
   * O filtro e o que garante que a walkthrough nao inventa um passo que nao
   * existe: um tutorial sem `dica` nao tem o que ensinar, e um degrau de
   * cacada nunca entra na conta
   */
  const trilha = passos.filter((p) => p.tutorial && p.dica);

  /**
   * O PASSO QUE ESTA EM FOCO.
   *
   * E o do tutorial atual, e nao o `passo` do `useState`. O estado e a
   * navegacao entre passos ja vistos — o botao "anterior" anda por ele — mas
   * quando a missao avanca para o proximo tutorial, o estado tem de seguir
   * o jogo e nao o ultimo clique
   *
   * Sem este `useEffect`, o jogador terminaria o tutorial do craft, o proximo
   * entraria em foco, e a walkthrough continuaria mostrando o passo 1 de 7
   * enquanto a missao em tela e a de encantar
   */
  const indiceDoAtual = trilha.findIndex((p) => p.id === atual?.id);

  useEffect(() => {
    if (indiceDoAtual >= 0) setPasso(indiceDoAtual);
  }, [indiceDoAtual]);

  /**
   * SEM TUTORIAL EM FOCO, NAO HA WALKTHROUGH.
   *
   * E o que a mantem fora da campanha de cacada, e o unico lugar que decide
   * se ela existe
   */
  if (!atual?.tutorial || trilha.length === 0) return null;

  const visivel = trilha[Math.min(passo, trilha.length - 1)];

  return (
    <div className="wt">
      <div className="wt__topo">
        <span className="wt__icone">{visivel.icone ?? "?"}</span>

        <div className="wt__titulo">
          <span className="wt__passo">
            Passo {passo + 1} de {trilha.length}
          </span>
          <strong>{visivel.name}</strong>
        </div>
      </div>

      <p className="wt__objetivo">{visivel.summary}</p>

      {visivel.dica && <p className="wt__dica">{visivel.dica}</p>}

      <div className="wt__pe">
        {visivel.painel && aoAbrirPainel ? (
          <button
            type="button"
            className="wt__ir"
            onClick={() => aoAbrirPainel(visivel.painel)}
          >
            {ROTULO_DO_PAINEL[visivel.painel] ?? "ABRIR"}
          </button>
        ) : (
          <span className="wt__sem-painel">
            Acontece no mapa, na zona em que voce esta
          </span>
        )}

        <div className="wt__pontos">
          {trilha.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={[
                "wt__ponto",
                i === passo ? "is-on" : "",
                i < passo ? "is-feito" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPasso(i)}
              data-tip={p.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
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

  /**
   * A MESMA REGRA DO `contarProgresso`: so a secundaria EM ANDAMENTO.
   *
   * Sem esta linha as duas contas discordavam: a barra dizia 61% e o
   * contador de pendencias dizia 24, porque uma lia as 12 secundarias
   * disponiveis do mapa e a outra lia so a que estava em andamento
   */
  const sidePendentes =
    data.side?.current &&
    !data.side.current.done &&
    mapaDaZona(data.side.current.location) === mapaId
      ? 1
      : 0;

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

    /**
     * A SECUNDARIA QUE CONTA E A QUE O JOGADOR ACEITOU.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * O `available` traz as 23 secundarias do jogo inteiro, ACEITAS OU NAO.
     * Elas entavam todas no total, e o mapa 1 ficava em `19/31` mesmo com as
     * 19 missoes da campanha feitas — a barra nunca chegava a 100%
     *
     * E o oposto tambem era verdade: uma secundaria que o jogador fez e
     * depois ARRASOU nao saia do total, porque `available` e o catalogo
     * inteiro e nao o que ele esta fazendo
     *
     * ## POR QUE SO A `current` E A QUE ESTA NO `done`
     *
     * Porque `current` e a secundaria em andamento, e e a unica que o
     * jogador pegou de verdade. Uma que ele fez e nao esta em andamento
     * ja foi resgatada e saiu da `current` — e a barra conta o que ele FEZ,
     * nao o que ele tem pendente
     *
     * E o `done` do `current` e lido daqui e nao do `done` de cada
     * `available`: o `available` tem o `done` de todas, e usar ele aqui
     * traria de volta o mesmo problema pelo outro lado
     */
    const secundarias = data.side?.current
      ? [data.side.current].filter(
          (quest) => mapaDaZona(quest.location) === mapaId,
        )
      : [];

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
 * O NUMERO DA MISSAO, como `mapa.missao`.
 *
 * ## DE ONDE SAI OS DOIS NUMEROS
 *
 * Do id, que ja tem os dois: `map1_main_1_limo_pantano` e
 * `map2_main_3_lanca_vale01`. O primeiro pedaco e o mapa, o terceiro e o
 * indice do degrau dentro da escada daquele mapa
 *
 * ## POR QUE LER O ID E NAO PASSAR OS DOIS COMO PROP
 *
 * Porque o id e a unica coisa que os DOIS lados tem: o painel recebe a missao
 * ja montada pelo servidor, e o servidor nao manda `mapa` nem `degrau` como
 * campos. Passar os dois como prop seria criar um segundo lugar para o mesmo
 * numero, e o primeiro lugar a divergir quando o save for antigo
 *
 * ## POR QUE VOLTA `null` E NAO UM NUMERO CHUTADO
 *
 * Porque um id fora do padrao e um save de outra versao, nao uma missao. O
 * `null` some o numero e deixa o nome sozinho, que e o que o jogador ainda
 * consegue ler. Um "0.0" no lugar seria pior que nada
 */
function numeroDaMissao(id) {
    const partes = String(id ?? "").split("_");

    /**
     * O MAPA ESTA PARTIDO EM DUAS PARTES, e nao em uma.
     *
     * O `id` e `map_1_main_1_limo_pantano`, e dividir por underscore da
     * `["map", "1", "main", "1", "limo", "pantano"]`. A expressao testava a
     * PRIMEIRA parte esperando `map_1` inteiro, e ela e so `map` — o `1` foi
     * junto com o separador
     *
     * A forma antiga do id era `map1_main_1`, que nao tinha separador entre
     * o mapa e o numero
     */
    const temSeparador = partes[0] === "map";

    const mapa = temSeparador
      ? (/^\d+$/.test(partes[1] ?? "") ? partes[1] : null)
      : (/^map(\d+)$/.exec(partes[0] ?? "")?.[1] ?? null);

    /**
     * O INDICE E REINICIADO A CADA MAPA, e nao lido do `id`.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * O numero do `id` e a POSICAO GLOBAL na campanha: o mapa 1 tem 18
     * passos, `1` a `18`, e o mapa 2 comeca em `19`. Ler o `id` direto
     * mostrava `2.19` no primeiro passo do mapa 2
     *
     *## POR QUE ISSO E ERRADO PARA O JOGADOR
     *
     * Porque o numero na tela tem que responder "onde eu to", e nao "quantas
     * coisas eu ja fiz". Quem abre o mapa 2 espera 2.1 — e `2.19` faz o
     * jogador achar que pulou dezenove degraus, ou que o mapa tem capitulo
     * anterior. O prefixo `2.` ja diz que e o segundo mapa; repetir dezenove
     * vezes o primeiro digito so polui
     *
     * ## POR QUE NAO BASTAVA DESCONTAR OS DEGRAUS DO MAPA 1
     *
     * Porque os ids sao usados como CHAVE DE SAVE. Reescrever o `id` do mapa
     * 2 para `main_1` faria todo save que guardou `map_2_main_19_...` deixar
     * de achar a missao — e o jogador perderia o progresso sem nenhum erro
     *
     * Entao o `id` continua global e inalterado. O numero da tela e calculado
     * pela POSICAO DENTRO DO MAPA, que e o que o jogador enxerga
     */
    const indiceGlobal = Number(
      partes.find((parte, i) => i > 1 && /^\d+$/.test(parte)),
    );

    if (!mapa || !Number.isInteger(indiceGlobal) || indiceGlobal < 1) {
      return null;
    }

    /**
     * O `PRIMEIRO` indice global de cada mapa, para saber quantos degraus
     * existiram antes
     *
     * E uma tabela de duas linhas e nao um calculo sobre `MAIN_QUESTS` porque
     * a funcao nao pode depender da ordem do catalogo: um passo novo
     * inserido no meio do mapa 1 mudaria o numero do mapa 2 inteiro, e o
     * numero impresso passaria a depender de um arquivo que esta a tres
     * `import` de distancia
     */
    const primeiroIndiceDoMapa = { 1: 1, 2: 19 };

    const base = primeiroIndiceDoMapa[mapa] ?? 1;

    const indice = indiceGlobal - base + 1;

    if (indice < 1) return null;

    return `${mapa}.${indice}`;
  }

/**
 * O bloco de RECOMPENSAS: ouro, xp e itens, cada um num SLOT DE ITEM.
 *
 * ## POR QUE UM SLOT E NAO UM NUMERO SOLTO
 *
 * Porque o jogador nao le "45" e "120" como duas promessas diferentes: ele le
 * uma fileira de coisas que vai receber. E o mesmo motivo do card da colecao,
 * que e a referencia visual desta tela — os dois ficam com o nome a
 * esquerda e os icones a direita, e o olho aprende o layout uma vez
 *
 * ## POR QUE UM SLOT PARA O OURO E PARA O XP
 *
 * Porque sao coisas que EXISTEM no jogo do mesmo jeito que um item. Ouro e
 * a moeda que o jogador ve na HUD, xp e a barra do rodape, e um numero
 * flutuando solto nao se liga a nenhuma das duas. Dentro do quadrado do
 * slot, o glifo ja diz sozinho o que e
 *
 * ## POR QUE NAO HÁ BONUS DE ATRIBUTO AQUI
 *
 * O card da colecao mostra os bonuses permanentes porque E de la que eles
 * vem — a entrega de material e o que sobe ataque, defesa e vida. Repetir
 * um bonus de atributo no cartao da missao ensinaria que matar o mesmo
 * numero de monstros tbem sobe stats, e o jogador passaria a contar as duas
 * coisas como uma so. A missao paga ouro, xp e material; atributo e da
 * colecao
 */
function Rewards({ rewards }) {
  const coins = rewards?.coins ?? 0;
  const xp = rewards?.xp ?? 0;
  const items = rewards?.items ?? [];

  if (coins <= 0 && xp <= 0 && items.length === 0) {
    return null;
  }

  return (
    <ul
      className="qst-row__recompensas"
      data-tip="Recompensa ao concluir a missão"
    >
      {coins > 0 && (
        <li className="qst-premio">
          <span className="inv-slot qst-premio__slot">
            <span className="inv-slot__icon qst-premio__glifo">◉</span>
          </span>

          <span className="qst-premio__conta">{coins}</span>

          <span className="qst-reward__sr"> moedas</span>
        </li>
      )}

      {xp > 0 && (
        <li className="qst-premio">
          <span className="inv-slot qst-premio__slot">
            <span className="qst-premio__selo">XP</span>
          </span>

          <span className="qst-premio__conta">{xp}</span>

          <span className="qst-reward__sr"> de xp</span>
        </li>
      )}

      {items.map((premio) => {
        /**
         * O item do CATALOGO, e nao so o `itemId`.
         *
         * O `ItemIcon` tira a arte do `itemId` + raridade, mas o glifo de
         * quem nao tem arte vem do `item.icon`. Passando so o `itemId`, os
         * materiais da missao — que sao todos sem arte desenhada —
         * desenharia um icone VAZIO, que e pior que nenhum icone
         */
        const item = getItem(premio.itemId);

        return (
          <li
            key={premio.itemId}
            className="qst-premio"
            data-tip={`${premio.count}x ${item?.name ?? premio.itemId}`}
          >
            <span className="inv-slot qst-premio__slot">
              <ItemIcon
                item={item}
                itemId={premio.itemId}
                rarity={item?.rarity ?? null}
                className="qst-premio__icone"
                alt=""
              />
            </span>

            <span className="qst-premio__conta">{premio.count}</span>

            <span className="qst-reward__sr">
              {" "}
              {item?.name ?? premio.itemId}
            </span>
          </li>
        );
      })}
    </ul>
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
    aoAbrirPainel,
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
                {/*
                  O NUMERO DA MISSAO, ANTES DO NOME.

                  ## POR QUE NAO E PARTE DO NOME

                  Porque o nome e dado pelo catalogo e o numero e a posicao na
                  escada. Sao coisas diferentes: renomear a missao no catalogo
                  nao pode renumerar a campanha, e mudar a escada nao pode
                  reescrever o nome que o jogador le no historico

                  ## POR QUE ESPAÇADO E NAO COMO UM SEPARADOR

                  Porque "1.2" colado em "Aco e Erro" leria como um numero de
                  versioning. Com o ponto e o espaco, o olho le como
                  coordenada — mapa 1, degrau 2 — que e o que o jogador precisa
                  para pedir ajuda sobre a missao certa
                */}
                {numeroDaMissao(quest.id) && (
                  <span className="qst-row__numero">
                    {numeroDaMissao(quest.id)}
                  </span>
                )}

                <strong>{quest.nameCompleto ?? quest.name}</strong>

              {/*
                A TAG DE TIPO SAIU, E O ESPACAMENTO FICOU.

                "Cacada" nao dizia nada que o titulo nao dissesse: a missao se
                chama "Aco e Erro", o resumo diz "Mate 8..." e o icone de alvo
                ja esta na recompensa. A etiqueta ocupava uma caixa entre o
                nome e a coluna de icones, e era o unico elemento da linha que
                nao respondia a pergunta "quanto eu ganho com isto"

                O que fica no lugar dela e um espaco vazio do MESMO tamanho, e
                nao um espacamento novo: o espaco era parte do que o jogador
                ja leu, entao tira-lo junto com a caixa mexeria na posicao dos
                icones e faria o card parecer quebrado em vez de limpo
              */}
            </div>

<p className="qst-row__text">
            {quest.summary}
          </p>

          {/*
            A DICA DO TUTORIAL, SO NO TUTORIAL E SO NA MISSAO ATIVA.

            E o que separa "Crie 1 item no craft" de "Abra o CRAFT (C). A
            primeira receita do Osso Quebrado usa 5 unidades e nao custa
            ouro". O `summary` e o QUE, e a dica e o COMO — e sem o como o
            jogador so descobre onde fica o craftcuando ele ja devolveu o
            tutorial sem ter clicado em nada

            Aparece so quando a missao esta em foco (`active`) ou disponivel:
            uma dica de tutorial numa missao que o jogador ainda nao pegou
            seria spoil da campanha, e uma dica na campanha inteira poluiria
            a coluna de texto

            E so em tutorial: o campo `dica` so existe neles, e o
            `quest.tutorial` e a trava — um campo vazio nao passaria aqui
            mesmo
          */}
          {quest.dica &&
            quest.tutorial &&
            (state === "active" || state === "available") && (
              <p className="qst-row__dica">{quest.dica}</p>
            )}

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
            data-tip="Receber moedas, xp e itens"
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
        ) : quest.tutorial && state === "active" && aoAbrirPainel && quest.painel ? (
          /*
            O BOTAO DO TUTORIAL, E ELE ABRE O PAINEL CERTO.

            ## POR QUE ELE SUBSTITUI O "IR" DO CARD

            Porque o "IR" marca o objetivo para o AUTO, e o AUTO nao sabe
            fazer tutorial nenhum. O jogador chega no degrau, liga o auto,
            o auto vai ate a zona e fica parado olhando um esqueleto — ele
            nao abre craft, nao encanta e nao minera. E o auto parametro
            e o comportamento CORRETO: nenhuma acao de sistema cabe em "mate
            o bicho da zona"

            ## POR QUE SO NOS TUTORIAIS

            Porque so eles precisam do painel. Uma missao de cacada tem zona
            e o auto resolve; uma de tutorial tem aba, e o que resolve e um
            clique

            ## E POR QUE A CONDIÇÃO TEM `quest.painel`

            Porque o tutorial de minerar nao tem painel nenhum: ele acontece
            no mapa, numa pedra. Sem `painel` ele cai no `onFocus` como antes,
            que e o comportamento certo — ele marca o objetivo e o auto leva
            o jogador ate a zona
          */
          <button
            type="button"
            className="qst-action qst-action--tutorial"
            onClick={() => aoAbrirPainel(quest.painel)}
            data-tip={`Abre ${ROTULO_DO_PAINEL[quest.painel] ?? "o painel"}`}
          >
{ROTULO_DO_PAINEL[quest.painel] ?? "ABRIR"}
          </button>
        ) : onFocus && state === "active" && !waiting ? (
          /*
            ESTE BOTAO E O "IR", E O AUTO DO CARD.

            ## POR QUE O ROTULO MUDOU

            Porque "Completar auto" prometia uma coisa que o botao nao faz:
            ele nao completa nada, ele APONTA. O `onFocus` marca o objetivo
            como o atual, e quem vai la e o motor da missao automatica — a
            execucao depende do AUTO do cabecalho estar ligado

            Dizer "Completar auto" num botao que so seleciona levava o
            jogador a clicar esperando ver o boneco correr, e nada acontecia
            enquanto o AUTO do cabecalho estivesse desligado

            ## E POR QUE O TUTORIAL NAO VEM AQUI

            Porque o auto nao sabe fazer tutorial: ele nao abre aba nenhuma.
            O tutorial cai no botao de cima, que abre o painel certo
          */
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
            data-tip={
              auto
                ? "Esta é a missão que o modo automático está seguindo"
                : "Seguir esta missão automaticamente"
            }
          >
            IR
          </button>
        ) : null}

        {/*
          A COLUNA DA DIREITA NAO MOSTRA NADA QUANDO A MISSAO FOI RECEBIDA.

          ## POR QUE O "✓ CONCLUÍDA" SAIU

          Porque ele e um resumo de um ESTADO INTERMEDIO que o jogador nunca ve.
          A sequencia real e: o objetivo acaba -> [RECEBER] aparece -> o jogador
          clica -> a recompensa entra. O "CONCLUÍDA" aparecia depois do clique,
          quando ja nao havia nada a fazer ali — e um carimbo nao-acao no
          lugar onde o jogador procura o proximo passo

          ## POR QUE O CARD CONTINUA NA LISTA

          Porque a lista e o HISTORICO. A missao precisa continuar visivel para
          o jogador conferir que fez, e para o numero `mapa.missao` fazer
          sentido. Some a ETIQUETA, nao o cartao

          ## POR QUE NAO TROQUEI POR "PRONTA"

          Porque "pronta" e o estado ANTES do resgate, e esse ja tem o
          [RECEBER] falando por ele. Duas etiquetas para o mesmo estado e o
          jogador tendo que decidir qual das duas e a correta
        */}

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
          data-tip={`${mapa.name} — ${mapa.pendentes} missão(ões) a fazer`}
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
  aoAbrirPainel,
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

  /**
   * A ABA, E ELA COMECA SEMPRE NA PRINCIPAL.
   *
   * ## POR QUE NAO "PRINCIPAL, OU SECUNDARIA SE NAO HOUVER PRINCIPAL"
   *
   * Era esse o codigo antes, e ele abria na aba errada. O inicializador de
   * um `useState` roda UMA vez, na primeira montagem do componente — e nessa
   * hora o `snapshot` das missoes pode ainda nao ter chegado. Com
   * `data.main.current` valendo `null` naquele instante, o painel fixava
   * `"side"` e ficava nela para sempre, mesmo depois de a campanha comecar
   *
   * O defeito era invisivel em desenvolvimento e na playteste, porque ali o
   * snapshot ja estava carregado quando o painel abria. Ele aparecia em jogo
   * online, onde a primeira abertura acontece logo apos conectar
   *
   * ## E POR QUE A PRINCIPAL E A PADRAO MESMO SEM NENHUMA
   *
   * Porque a campanha e a escada: ela e o que existe, e a secundaria e o
   * desvio. Quando a campanha acaba, a aba da principal continua sendo a
   * certaina — e mostrar uma lista de concluidas e melhor que abrir em
   * branco numa aba que o jogador nao pediu
   */
  const [tab, setTab] = useState("main");

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

{/*
    O LADO DIREITO DO CABECALHO: o AUTO e o X, COLADOS.

    ## POR QUE UM WRAPPER

    Antes o AUTO era um filho solto com `margin-left: auto`, e o X vinha
    depois. Os dois ficavam a direita, mas separados pelo `gap: 12px` do
    cabecalho — um espaco que existe para o TITULO nao encostar em nada, e
    que aqui estava empurrando o AUTO para longe do X

    ## POR QUE O X CONTINUA SENDO O ULTIMO

    Porque e a convencao de todos os outros paineis: o X fecha a coluna da
    direita e o jogador aprende a procurar ele no canto. O AUTO vem antes
    dele, no mesmo par

    ## POR QUE O AUTO FICA NA MESMA LINHA E NAO NUM SEGUNDO BLOCO

    Porque sao o mesmo tempo de leitura — acao do painel e o fim do painel.
    Um AUTO numa barra propria embaixo transformaria uma linha em duas
  */}
          <div className="qst-panel__acoes">
            <button
              type="button"
              className={[
                "qst-auto",
                auto.enabled ? "is-on" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={onToggleAuto}
              data-tip="Completar a missão em modo automático"
            >
              {auto.enabled ? "AUTO ON" : "AUTO"}
            </button>

            <button
              type="button"
              className="inv-close"
              onClick={onClose}
              data-tip="Fechar (Q)"
            >
              ✕
            </button>
          </div>
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
            data-tip={
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
                      aoAbrirPainel={aoAbrirPainel}
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
                      aoAbrirPainel={aoAbrirPainel}
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
                      aoAbrirPainel={aoAbrirPainel}
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
