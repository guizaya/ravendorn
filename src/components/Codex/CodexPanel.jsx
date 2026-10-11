import { useMemo, useState } from "react";

import CodexEntryList from "./CodexEntryList.jsx";
import CodexEntryDetail from "./CodexEntryDetail.jsx";

import {
  CATEGORIAS_CODEX,
  vitrineDeCategoria,
} from "../../game/bestiary/codexView.js";

/**
 * O PAINELE DO CODEX — ESQUELETO, SO A CATEGORIA DE MONSTROS.
 *
 * ## O QUE ESTE ARQUIVO NAO E AINDA
 *
 * O `bestiario.txt` pede cinco categorias, uma toolbar com busca e dois
 * selects, e uma coluna lateral com pontos de talento e etapas do Codex.
 * Nenhum dos tres tem dado no projeto, entao o que existe aqui e a casca:
 * barra de abas, lista e detalhe, ligados ao `Bestiary.snapshot()` real
 *
 * ## POR QUE A BARRA DE ABAS JA ESTA PRONTA COM UM SLOT
 *
 * Porque a barra e a parte que decide a ARQUITETURA: se ela cresce para a
 * esquerda ou empurra o corpo, o esqueleto inteiro se decide junto. Com uma
 * aba so, a altura e a posicao da barra ja ficam medida de verdade, e as
 * outras quatro entram depois sem mexer em nada abaixo
 *
 * ## POR QUE O SNAPSHOT ENTRA POR PROP E NAO POR IMPORTE
 *
 * Porque o `Bestiary` mora dentro do `GameEngine`, e um painel que o
 * instancia por conta propria teria um bestiario diferente do jogo. Quem
 * passa o snapshot e quem sabe qual e — o mesmo motivo do `rank` vir pronto
 * do servidor
 */
export default function CodexPanel({
  snapshot = null,
  hunting = null,
  onHunt,
  onClose,
  filtroDrop = null,
}) {
    /**
   * A CATEGORIA, SEM BARRA DE ABAS.
   *
   * ## POR QUE A `CATEGORIAS_CODEX` CONTINUA AQUI
   *
   * A barra de abas saiu da tela, mas a CATEGORIA continua sendo um conceito:
   * `vitrineDeCategoria` recebe o `id` e devolve a lista, e e ela que decide o
   * que existe no Codex. Passar a letra solta aqui seria um `if (categoria ===
   * "monstros")` espalhado no componente, e o dia que a segunda categoria
   * entrar o painel precisaria ser reescrito em vez de receber uma linha na
   * lista
   */
  const categoria = CATEGORIAS_CODEX[0];

  /**
   * A LISTA E A SELECAO, NESTA ORDEM.
   *
   * A selecao precisa da lista ja filtrada para saber o que vem antes e o
   * que vem depois no `ArrowDown`. Se o `useState` da selecao viesse antes,
   * a seta usaria uma lista velha — a selecionada apontaria para uma
   * entrada que o filtro de outra categoria ja removeu
   */
  const entradas = useMemo(() => {
    const daCategoria = vitrineDeCategoria(categoria.id, snapshot);

    /**
     * O FILTRO QUE CHEGA DO MENU DO ITEM.
     *
     * O atalho abre o codex ja mostrando as criaturas que DROPAM aquele item,
     * e nao a criatura que o jogador-Imaginou: o item da mochila e a prova de
     * que ele quer saber de onde vem aquele drop
     *
     * E o `filtroDrop` que o `destinosDoItem` calculou, e nao uma busca nova
     * aqui — o filtro e calculado uma vez, no clique do menu, e chega pronto
     * para o painel nao ter de saber da tabela de `loot` das criaturas
     *
     * Sem filtro — o caso normal, quando o codex foi aberto pelo botao da HUD
     * — a lista e a da categoria, sem trabalho extra
     */
    if (!filtroDrop?.length) return daCategoria;

    const queridas = new Set(filtroDrop);

    const filtradas = daCategoria.filter((entrada) =>
      queridas.has(entrada.id),
    );

    /**
     * NENHUMA CRIATURA DESTA CATEGORIA DROPAVA O ITEM.
     *
     * O item e um material solto, e nao vem de criatura nenhuma. Deixar a lista
     * vazia seria um beco sem saida: o jogador abriu o codex por causa do item
     * e veria um painel em branco sem explicacao. A lista inteira e melhor
     * resposta do que nenhuma
     */
    return filtradas.length > 0 ? filtradas : daCategoria;
  }, [categoria.id, snapshot, filtroDrop]);

  const [selecionadaId, setSelecionadaId] = useState(null);

  const selecionada =
    entradas.find((entrada) => entrada.id === selecionadaId) ??
    entradas[0] ??
    null;

  return (
    <section className="inv-panel cdx-panel">
      <header className="inv-close-row cdx-panel__head">
        <h2>Codex</h2>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar"
        >
          ✕
        </button>
      </header>

      {/* O CORPO EM COLUNAS. A lateral (secao 5) NAO EXISTE AINDA */}
      <div className="cdx-corpo">
        <CodexEntryList
          entradas={entradas}
          selecionadaId={selecionada?.id ?? null}
          aoSelecionar={setSelecionadaId}
        />

        <CodexEntryDetail
          entrada={selecionada}
          hunting={hunting}
          onHunt={onHunt}
        />
      </div>
    </section>
  );
}