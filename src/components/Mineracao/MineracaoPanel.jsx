/**
 * O PAINEL DA MINERACAO.
 *
 * Aparece quando o jogador encosta na pedra, e mostra as tres coisas que
 * o pedido pediu: quantas batidas faltam, quanto tempo falta, e o steel da
 * ultima batida. E o unico lugar do jogo onde um recurso CRESCE na tela
 *
 * ## POR QUE UM COMPONENTE E NAO MAIS UM BLOCO DENTRO DO `HUD`
 *
 * Porque o `HUD.jsx` tem 3880 linhas e ja carrega inventario, guilda,
 * mercado, craft, collection e bestiario. Um painel novo dentro dele seria
 * a septima leitura de 400 linhas de JSX procurando o que o jogador quer
 * saber enquanto esta de machado na mao
 *
 * ## POR QUE ELE NAO CONTA O TEMPO SOZINHO
 *
 * Porque o painel chega a 4Hz. Se ele descontasse um segundo por tique, o
 * numero passaria 250ms parado entre "1min20" e "1min19" e a barra
 * andaria aos trancos. O componente recebe o `proximoGolpeEm` do SERVIDOR e
 * faz a conta com o relogio dele, entao o tempo anda sozinho e o numero de
 * batidas continua vindo pronto — esse e inteiro e nao muda entre tiques
 */

import { useEffect, useState } from "react";

import {
  SEGUNDOS_POR_BATIDA,
  formatarTempo,
} from "../../data/props/mineracao.js";

/**
 * A COR DE CADA RARIDADE, que e a mesma do `tint` do tipo no catalogo de
 * props.
 *
 * Sao as MESMAS cores da arte, e nao cores de texto: um painel com fundo
 * roxo sobre uma pedra roxa parece interface; com a cor da pedra, parece
 * que a tela esta falando da pedra
 */
const COR_DA_RARIDADE = {
  cristal_comum: "#8a8f96",
  cristal_raro: "#2f8fd0",
  cristal_epico: "#c02b3f",
  cristal_lendario: "#d8a93a",
};

const NOME_DA_RARIDADE = {
  cristal_comum: "Comum",
  cristal_raro: "Raro",
  cristal_epico: "Epico",
  cristal_lendario: "Lendario",
};

/**
 * QUANDO O GANHO DA BATIDA SAI DA TELA.
 *
 * Um segundo e meio. E o tempo de duas batidas — a batida cai a cada 10s, e
 * um numero que fica 10s parado na tela vira parte do cenario. O `+2`
 * depois do numero conta o ultimo steel ganho, e nao o saldo
 */
const GANHO_VISIBLE_MS = 1500;

/**
 * O PAINEL DA MINERACAO, e QUANDO ELE ABRE.
 *
 * ## POR QUE ABRE SO ENCOSTADO, E NAO NO CLIQUE
 *
 * Porque o pedido foi "quando comecar a minerar deve abrir uma". Clicar na
 * pedra e um gesto que o jogador pode mudar de ideia — e o vale tem 40
 * cristais, entao clicar no errado e comum. O painel abre quando o jogador
 * CHEGOU, e e ai que a promessa de tempo faz sentido
 *
 * ## POR QUE O PAINEL E OUTRO LUGAR, E NAO SOBRE O CRISTAL
 *
 * Porque o cristal esta no meio da tela e o jogador esta olhando para ele.
 * Um numero desenhado em cima da arte esconderia exatamente o que ele esta
 * olhando, e mudaria de lugar conforme a camera andasse
 */
export default function MineracaoPanel({ mineracao }) {
  const [agora, setAgora] = useState(() => Date.now());

  /**
   * O `+2` SOME SOZINHO, e o tempo de vida dele mora AQUI e nao no
   * render.
   *
   * A primeira versao comparava `agora - Date.now()`, que e negativo para
   * sempre: o `agora` e o ultimo valor do `setInterval` e o `Date.now()`
   * e o instante da renderizacao. A conta nunca passava do limite, o que
   * fazia o numero piscar em vez de sumir
   */
  const [ganhoVisivel, setGanhoVisivel] = useState(false);

  /**
   * O RELOGIO LOCAL SOBE A CADA SEGUNDO, e nao a cada tique do painel.
   *
   * A conta do tempo que resta nao muda — quem a faz e o `proximoGolpeEm`
   * do servidor. O que este efeito da e um gancho para o numero mudar de
   * 1 em 1 segundo, e nao a cada 250ms, quando chegaria o pacote
   *
   * ## POR QUE A DEPENDENCIA E O ID DA PEDIDA, E NAO O OBJETO
   *
   * Porque o painel chega a 4Hz, e cada pacote traz um objeto NOVO. Com
   * `[mineracao]` na dependencia, o efeito era desmontado e remontado a cada
   * 250ms — e um `setInterval` desmontado antes de completar 1 segundo NUNCA
   * dispara. O relogio ficava congelado no instante em que o painel abriu: a
   * barra da batida nunca enchia e o tempo restante nunca contava para baixo
   *
   * Com o `propId`, a dependencia so muda quando o jogador troca de pedra, e
   * o intervalo vive enquanto ela existir
   *
   * E ele para quando o painel fecha, senao cada mineracao deixaria um
   * `setInterval` correndo para sempre na tela
   */
  const pedidaId = mineracao?.propId ?? null;

  /**
 * DE QUANTO EM QUANTO O RELOGIO LOCAL AVANCA.
 *
 * ## POR QUE 100ms E NAO 1000ms
 *
 * Porque a barra da batida tem 10 segundos de duracao e precisa andar. A
 * cada segundo ela daria DEZ degraus de 10% — visivel, e nao liso. A 100ms
 * sao 100 degraus e a barra parece cheiaContinua
 *
 * O numero de segundos que aparece embaixo e inteiro, entao ele so muda uma
 * vez por segundo de qualquer jeito: o `Math.ceil` faz o mesmo trabalho. O
 * que ganha com o passo curto e so a barra
 *
 * E 10 renderizados por segundo de um componente de 150 linhas que so
 * existe enquanto o jogador esta na pedra. O resto da HUD nao re-renderiza
 * com ele: e um `<section>` proprio
 */
const PASSO_RELOGIO_MS = 100;

useEffect(() => {
    if (pedidaId === null) return undefined;

    const intervalo = setInterval(
      () => setAgora(Date.now()),
      PASSO_RELOGIO_MS,
    );

    return () => clearInterval(intervalo);
  }, [pedidaId]);

  /**
   * CADA BATIDA ACENDE O `+N` POR UM SEGUNDO E MEIO.
   *
   * O efeito depende do `steelNoTique`, que o servidor ZERA a cada tique e
   * preenche so no tique em que a batida caiu. E por isso que ele roda uma
   * vez por batida e nao a cada quadro: `0 -> 3` e uma mudanca, e `3 -> 0`
   * logo depois e outra
   */
  useEffect(() => {
    if (!mineracao?.steelNoTique) return undefined;

    setGanhoVisivel(true);

    const tempo = setTimeout(
      () => setGanhoVisivel(false),
      GANHO_VISIBLE_MS,
    );

    return () => clearTimeout(tempo);
  }, [mineracao?.steelNoTique]);

  if (!mineracao || !mineracao.encostado) return null;

  const {
    type,
    batidas,
    batidasRestantes,
    proximoGolpeEm,
    steelNoTique,
  } = mineracao;

  const cor = COR_DA_RARIDADE[type] ?? "#8a8f96";
  const nome = NOME_DA_RARIDADE[type] ?? "Cristal";

  /**
   * O TEMPO QUE FALTA E A SOMA DE DUAS COISAS, e nao so das batidas.
   *
   * As batidas que ainda NAO CAIRAM custam `restantes * 10s`. A batida que
   * ja esta em curso custa o que falta para ela — e sem essa parte o
   * painel prometeria "faltam 3 batidas = 30s" enquanto o jogador esta a 1s
   * de receber a primeira, e ele contaria mentalmente errado
   */
  const emCurso = Math.max(
    0,
    (proximoGolpeEm - agora) / 1000,
  );

  const segundos = Math.ceil(
    batidasRestantes * SEGUNDOS_POR_BATIDA - (SEGUNDOS_POR_BATIDA - emCurso),
  );

  const feitas = batidas - batidasRestantes;

  /**
   * A BARRA DAS BATIDAS FEITAS, e nao do tempo.
   *
   * Sao o mesmo numero em divisao, e nao a mesma coisa na tela: com 20
   * batidas e 200s, uma batida a cada 10s move a barra em 5%. Se a barra
   * fosse do tempo, ela andaria junto com o relogio local e nao diria nada
   * que o numero de batidas nao dissesse
   */
  const progresso = batidas > 0 ? feitas / batidas : 0;

  /**
   * O AVANCO DA BATIDA QUE ESTA EM CURSO, de 0 a 1.
   *
   * E a barra nova: enquanto a de cima diz QUANTAS batidas a pedra aguenta,
   * esta diz QUANDO cai a proxima. Sao duas perguntas diferentes, e o
   * jogador faz as duas — a primeira para decidir se vale a pena, a
   * segunda para saber se ja pode mexer no teclado
   *
   * ## POR QUE `1 - emCurso / 10` E NAO `emCurso / 10`
   *
   * Porque `emCurso` e o que FALTA. No instante em que a batida comeca, ela
   * vale 10 e a barra esta vazia; um segundo depois vale 9 e a barra tem 10%.
   * Invertido, a barra enche — que e o que "batendo" quer dizer
   *
   * E o `travado` no limite: no instante em que a batida cai, o servidor ja
   * mandou o proximo `proximoGolpeEm`, e sem travar a barra dava um pulo
   * para 100% e voltava a 0 no mesmo quadro, piscando
   */
  const avancoBatida = Math.min(
    1,
    Math.max(0, 1 - emCurso / SEGUNDOS_POR_BATIDA),
  );

  return (
    <section
      className="mineracao"
      style={{ "--mineracao-cor": cor }}
      aria-label={`Minerando cristal ${nome.toLowerCase()}`}
    >
      <header className="mineracao__topo">
        <span className="mineracao__nome">{nome}</span>

        {/*
          AS BATIDAS COMO FRACAO, `3/5`, e nao como "3 batidas".

          A fracao e a unica forma que mostra o DUPLO de uma vez: quantas
          faltam e de quantas a pedra tem. Com "3 batidas" o jogador nao
          descobre o tamanho da pedra sem remember de uma mineracao
          anterior, e o lendario — 20 batidas de 3min20 — e o que mais
          precisa da comparacao

          E o `strong` so no numerador: o denominador e contexto e nao deve
          pesar igual. O tamanho do numero cai de 15px para 11px, e o
          `tabular-nums` mantem a barra nao pular quando o numerador troca
          de um digito para outro
        */}
        <span className="mineracao__batidas">
          <strong>{batidasRestantes}</strong>/{batidas}
        </span>

        {/*
          O `+N` DA BATIDA QUE CAIU, ao lado da fracao.

          Ele ficava na linha do tempo, e essa linha agora e do "Tempo" e do
          countdown — sao dois numeros de coisa diferente e o ganho nao
          pertencia a nenhum dos dois

          E aqui porque e o lugar de onde o jogador esta olhando: a fracao
          acaba de cair de 5 para 4, e o `+2` e a resposta para "quanto veio
          junto com isso"
        */}
        {ganhoVisivel && steelNoTique > 0 && (
          <span className="mineracao__ganho">+{steelNoTique}</span>
        )}
      </header>

      <div
        className="mineracao__trilho"
        role="progressbar"
        aria-valuenow={feitas}
        aria-valuemin={0}
        aria-valuemax={batidas}
        aria-label="Batidas dadas"
      >
        <div
          className="mineracao__barra"
          style={{ width: `${Math.round(progresso * 100)}%` }}
        />
      </div>

      {/*
        A BARRA DA BATIDA EM CURSO.

        Fica ABAIXO da das batidas e ACIMA do tempo previsto, e a ordem e o
        que faz as tres linhas se lerem: quantas batidas faltam (numero),
        o quanto falta para a proxima cair (barra que anda sozinha), e o
        total da pedra (promessa). O tempo previsto embaixo das duas barras
        e o unico dos tres que NAO anda durante a batida, e e por isso que
        ele fica no fim: e o resumo, nao o andamento
      */}
      <div
        className="mineracao__trilho mineracao__trilho--batida"
        role="progressbar"
        aria-valuenow={Math.round(avancoBatida * SEGUNDOS_POR_BATIDA)}
        aria-valuemin={0}
        aria-valuemax={SEGUNDOS_POR_BATIDA}
        aria-label="Próxima batida"
      >
        <div
          className="mineracao__barra mineracao__barra--batida"
          style={{ width: `${Math.round(avancoBatida * 100)}%` }}
        />
      </div>

      <footer className="mineracao__baixo">
        {/*
          O TEMPO RESTANTE E O QUE O JOGADOR PLANEJA COM.

          E a soma do que falta para a batida em curso e das que ainda nao
          cairam. O `formatarTempo` esta no modulo de mineracao e nao aqui:
          a regra de escrever "1min20" em vez de "80s" pertence com o resto
          das regras de mineracao

          O rotulo "Tempo" e o que segura a leitura da linha: sem ele, o
          numero solto embaixo das barras parece parte do grafico. E o
          `justify-content: space-between` do `baixo` e o que joga o
          countdown para o outro lado — o rotulo na esquerda, o numero na
          direita, e a espaco entre eles
        */}
        <span className="mineracao__rotulo">Tempo</span>

        <span className="mineracao__tempo">
          {formatarTempo(segundos)}
        </span>
      </footer>
    </section>
  );
}