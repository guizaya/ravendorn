import { useEffect, useMemo, useRef, useState } from "react";

import RankingTabs from "./RankingTabs.jsx";
import ClassFilter from "./ClassFilter.jsx";
import Podium from "./Podium.jsx";
import RankingList from "./RankingList.jsx";
import MyPositionBar from "./MyPositionBar.jsx";

import { nameKey } from "../../data/characterName.js";
import {
  RANK_ABA_PADRAO,
} from "../../game/ranking/rankView.js";

/**
 * Quantos caçadores a lista mostra.
 *
 * O desenho fala em "Top 200", e o número também aparece na barra da posição
 * do jogador. São o MESMO número: se a lista mostrasse 200 e a barra
 * dissesse "no top 500", o jogador contaria a lista e veria que mentiu
 */
const TOP_N = 200;

/**
 * O PAINEL DE RANKING.
 *
 * ## A ORDEM DE LEITURA DA TELA
 *
 * Abas → filtro de classe → pódio → lista → barra da posição. Cada camada
 * responde uma pergunta, e a ordem é a ordem em que o jogador se faz elas:
 * "por qual critério", "de que classe", "quem está na frente", "e os
 * outros", "e eu"
 *
 * ## O QUE O DESENHO PEDE E O PROJETO NÃO TEM
 *
 * São três campos, e nenhum deles existe no payload do rank:
 *
 * - **badge de facção**: o jogo não tem facção nem lado. Não há campo, não
 *   há componente, e inventar uma cor por jogador seria mostrar um dado que
 *   não está no jogo
 * - **tag de guilda `[DYN]`**: a guilda de um jogador mora no `GuildStore`
 *   do servidor, keyed pelo nome normalizado. O `snapshot.rank` não a traz, e
 *   um save não a guarda — o próprio `CharacterSave` tem um comentário dizendo
 *   que guardar em dois lugares deixaria o jogador em duas guildas depois de
 *   reconectar. Levar isso ao painel exige mudar o `GameServer`, e é uma
 *   decisão de servidor, não de layout
 * - **ícone de status "!"**: não existe indicador equivalente no projeto. O
 *   `online` do rank é o estado mais próximo, e ele já tem efeito próprio:
 *   jogador offline fica esmaçado na lista
 *
 * O `Poder` foi o único campo novo que o desenho pedia e que eu CRIEI, e ele
 * não é inventado: sai dos stats que o `Player` já tinha. Está em
 * `rankView.js` e em `rank.js`
 */
export default function RankingPanel({
  rank = null,
  meuNome = null,
  onClose,
}) {
  const [aba, setAba] = useState(RANK_ABA_PADRAO);
  const [classe, setClasse] = useState(null);
  const [busca, setBusca] = useState("");

  /**
   * O CONTêINER QUE ROLA.
   *
   * ## POR QUE O RESET USA UM `ref` PRÓPRIO E NÃO O DO `useArrastarScroll`
   *
   * Porque o scroll da lista vive DENTRO do `RankingList`, e o `ref` do hook
   * é dele — o painel não tem acesso. Passar o ref para baixo como prop
   * resolveria, mas o painel não usa a lista para nada além de mostrar: ele
   * nem sabe o tamanho dela
   *
   * ## POR QUE O RESET IMPORTA
   *
   * Sem ele, o jogador filtra por "Arbalist" com a lista rolada até o fim,
   * recebe três linhas e vê um espaço vazio embaixo — sem nenhuma pista de
   * que a lista mudou. Rolagem que sobrevive a um filtro parece lista quebrada
   *
   * ## POR QUE ELE ROLA O PAINEL INTEIRO E NÃO A LISTA
   *
   * Porque o pódio está ACIMA da lista. Trocar de aba muda o pódio, e se
   * só a lista voltasse ao topo, o pódio novo ficaria fora da tela com a
   * lista no topo embaixo dele — o jogador teria de rolar para cima para
   * ver a mudança que acabou de pedir
   */
  const corpoRef = useRef(null);

  useEffect(() => {
    const alvo = corpoRef.current;

    if (alvo) alvo.scrollTop = 0;
  }, [aba, classe, busca]);

/**
   * A LISTA DA ABA, filtrada por classe — e sem a busca.
   *
   * ## POR QUE FILTRAR AQUI E NÃO DENTRO DA LISTA
   *
   * Porque a lista precisa saber o tamanho dela para escrever o total, e o
   * desenho diz que trocar o chip filtra a lista inteira. O filtro morasse
   * dentro da lista, o total do cabecalho contaria a lista sem filtro
   *
   * ## E POR QUE A BUSCA NÃO ESTÁ NESTE MEMO
   *
   * Porque a busca so age sobre a LISTA, nunca sobre o pódio.
   *
   * Buscar um nome que caia no top 3 trocava os tres primeiros jogadores da
   * tela inteira — o pódio sumia com eles e voltava com "#1" repetido, num
   * cabecalho que o jogador nao pediu para reduzir. Busca e uma pergunta
   * sobre a LISTA; o pódio e a CABECA da tabela, os tres primeiros, e ele
   * existe para dizer "quem esta na frente"
   *
   * O filtro de CLASSE continua mexendo no pódio, e e proposital: classe e
   * um recorte do UNIVERSO ("os guerreiros do mundo"), e nao uma pergunta
   * sobre a lista. Um pódio com guerreiros ao lado de uma lista so de
   * arbalists seria a "duas verdades na tela" que este filtro evita
   */
  const porClasse = useMemo(() => {
    const lista = rank?.[aba] ?? [];

    if (!classe) return lista;

    return lista.filter((jogador) => jogador?.classId === classe);
  }, [rank, aba, classe]);

  // o pódio são os três primeiros da lista por CLASSE, sem a busca
  const podio = porClasse.slice(0, 3);

/**
 * A LISTA E O 4º EM DIANTE, com a busca.
 *
 * ## POR QUE CORTAR ANTES DE FILTRAR A BUSCA
 *
 * Porque o corte é a REGRA da lista, e a busca é só um filtro. Cortando
 * depois, o jogador que busca o primeiro colocado veria uma lista
 * comecando no "#2" — e o "#1", que ele digitou, sumiria da tela logo
 * embaixo do pódio que o mostra
 *
 * ## E O LIMITE DE `TOP_N`, QUE CONTA OS ACHADOS
 *
 * Depois do corte por busca: o top 200 é a faixa do ranking, e trinta
 * achados na busca é uma lista de trinta linhas, não uma de duzentas
 */
const lista = porClasse
  .slice(3, TOP_N)
  .filter((jogador) => {
    if (!busca) return true;

    return (
      jogador?.name &&
      nameKey(jogador.name).includes(nameKey(busca))
    );
  });

  /**
   * QUANTOS JOGADORES O FILTRO ENCONTROU, e e o numero do titulo.
   *
   * ## POR QUE NAO O TOTAL DO RANK INTEIRO
   *
   * Porque o titulo fica na lista, e a lista ja foi filtrada. Com o total
   * geral, filtrar por Guerreiro escrevia "8 jogadores" acima de uma lista
   * com um — e o jogador lia a lista como quebrada, ou como o filtro nao
   * ter funcionado
   *
   * ## E POR QUE A BUSCA CONTA A PARTIR DO 1º LUGAR
   *
   * Porque quem busca um nome quer saber quantos achou, e o pódio nao é
   * filtrado pela busca. Contar so a lista daria zero para o "#1", que esta
   * a dois dedos acima na tela — o pior tipo de zero, o que parece defeito
   */
  const totalMostrado = useMemo(() => {
    if (!busca) return porClasse.length;

    return porClasse.filter(
      (jogador) =>
        jogador?.name && nameKey(jogador.name).includes(nameKey(busca)),
    ).length;
  }, [porClasse, busca]);

  /**
 * O JOGADOR LOGADO, e a CHAVE que o encontra é o NOME NORMALIZADO.
   *
   * ## POR QUE NÃO O `id`
   *
   * Porque o `id` do `dadosDoJogador` e o da SESSAO, e ele so existe para
   * quem esta online: a `dadosDoSalvo` devolve `id: null` de proposito, porque
   * o `uid` nao e gravado no arquivo. Buscando por `id`, o jogador que
   * salvou e saiu nao se encontraria nem a si mesmo na tabela
   *
   * E o `nameKey` e a MESMA chave que o `montarRank` usa para deduplicar
   * sessao contra save. Uma chave local seria uma segunda regra de "quem e
   * este jogador", e as duas divergiriam em um nome com acento
   *
   * ## POR QUE ESTA DECLARAÇÃO VEM ANTES DE `euNoRank`
   *
   * Porque `euNoRank` é um `useMemo`, e o `useMemo` roda a fábrica DURANTE o
   * render — ou seja, antes de a linha de baixo chegar na `const`. Ler
   * `minhaChave` de cima lançaria "Cannot access before initialization" na
   * primeira abertura do painel, e nenhum build acusaria isso
   */
  const minhaChave = useMemo(
    () => (meuNome ? nameKey(meuNome) : null),
    [meuNome],
  );

  /**
   * A POSIÇÃO DO JOGADOR LOGADO, no ranking TODO — antes do filtro.
   *
   * ## POR QUE ANTES DO FILTRO E NÃO DEPOIS
   *
   * Porque "#87" é a posição dele no RANKING, e o ranking tem uma ordem só.
   * Se o jogador filtrar por Arbalist e aparecesse "#3", ele acharia que é o
   * terceiro arbalist do mundo. A posição é global, e o filtro só muda o que
   * ele está olhando — não onde ele está
   *
   * ## POR QUE PODE NÃO ESTAR NA LISTA
   *
   * Porque o `rank` traz quem o servidor conhece, e o nome vem do jogador
   * local. Se os dois não casarem — servidor reiniciado, save ainda não
   * sincronizado — não há posição, e a barra mostra "—" em vez de inventar um
   * número
   */
  const euNoRank = useMemo(() => {
    const listaToda = rank?.[aba] ?? [];

    if (!minhaChave) return null;

    return (
      listaToda.find(
        (jogador) =>
          jogador?.name && nameKey(jogador.name) === minhaChave,
      ) ?? null
    );
  }, [rank, aba, minhaChave]);

  /**
   * A BARRA DA MINHA POSIÇÃO APARECE NESTE FILTRO, E NÃO EM TODOS.
   *
   * ## POR QUE SÓ NO GERAL E NA MINHA CLASSE
   *
   * Porque a posição mostrada é a GLOBAL — o comentário acima explica que
   * "#87" não vira "#3" ao filtrar por Arbalist. E essa é a informação
   * que a barra carrega
   *
   * Filtrando por outra classe, o jogador olha uma lista em que ele não
   * aparece, e a barra fixa no rodapé mostrando "#87" responde a uma
   * pergunta que ele não fez: ele não perguntou "onde eu estou", e sim
   * "como estão os guerreiros". A barra mentiria por omissão — ela
   * continua no rodapé de uma lista que deliberadamente o exclui
   *
   * ## E POR QUE ISSO NÃO É UM `slice`
   *
   * Porque a barra não é uma linha da lista: é uma referência ao mundo
   * inteiro, e ela sobrevive ao filtro de propósito. Some com o filtro
   * porque a pergunta some com ele, e não porque o dado parou de existir
   *
   * ## E POR QUE O `classId` VEM DE `euNoRank`
   *
   * Porque a linha do jogador no rank já traz `classId`, e ela é a
   * mesma fonte que o servidor usou para ordenar. Comparar o filtro com
   * o `classId` do personagem é mais seguro do que receber uma prop nova:
   * os dois lados vêm do mesmo lugar e não podem discordar
   */
  const mostrarMinhaPosicao =
    !classe || classe === (euNoRank?.classId ?? null);

  /**
   * O JOGADOR LOGADO ESTÁ NA TABELA DESTA ABA.
   *
   * E o que pinta a linha e o card do pódio dele. Sai da lista inteira da aba,
   * e não de `naAba`: se o jogador digitou o próprio nome na busca e o filtro
   * casou, o realce existe de qualquer forma — e se a busca é de outra pessoa,
   * o realce some junto com a linha, que é o que o jogador espera
   */
  const euSouEu = useMemo(() => {
    if (!minhaChave) return false;

    return (rank?.[aba] ?? []).some(
      (jogador) =>
        jogador?.name && nameKey(jogador.name) === minhaChave,
    );
  }, [rank, aba, minhaChave]);

  return (
    <section className="inv-panel rnk-panel">
      {/*
        O CABEÇALHO NO PADRÃO DOS OUTROS PAINÉIS: `h2`, o contador que empurra
        e o X por último. A classe é a `.inv-close` compartilhada de propósito
        — o jogador tem que ver o ranking como mais um painel do jogo, e não
        como um painel diferente
      */}
      <header className="inv-close-row rnk-panel__head">
        <h2>Ranking</h2>

        <span className="rnk-panel__tally">
          {rank?.[aba]?.length ?? 0} caçadores
        </span>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar (R)"
        >
          ✕
        </button>
      </header>

      <div
        className="rnk-panel__body"
        id="rnk-painel"
        ref={corpoRef}
        role="tabpanel"
        aria-label="Tabela do ranking"
      >
        <RankingTabs
          ativa={aba}
          onTrocar={setAba}
        />

        <ClassFilter ativa={classe} onTrocar={setClasse} />

        <Podium
          jogadores={podio}
          criterio={aba}
          euSouEu={euSouEu}
          carregando={!rank}
        />

        <RankingList
jogadores={lista}
      total={totalMostrado}
      temNoPodio={podio.length > 0}
      criterio={aba}
          euSouEu={euSouEu}
          busca={busca}
          onBusca={setBusca}
          carregando={!rank}
        />

        {/*
          A BARRA DA POSIÇÃO fica FORA da lista rolável e no fim do corpo.
          Dentro dela, ela rolaria junto com as linhas e sumiria assim que o
          jogador precisasse dela

          E ela so aparece no Geral e na classe do jogador — ver o
          `mostrarMinhaPosicao` acima. Num filtro de outra classe a lista
          exclui o jogador de propósito, e a barra ficaria afirmam uma
          posição que a lista ao lado não corrobora
        */}
        {mostrarMinhaPosicao && (
          <MyPositionBar
            jogador={euNoRank}
            criterio={aba}
            posicao={euNoRank?.posicao ?? null}
          />
        )}
      </div>
    </section>
  );
}