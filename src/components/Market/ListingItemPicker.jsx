import { useMemo, useState } from "react";

import InvSlotView from "../UI/InvSlotView.jsx";

import { nameKey } from "../../data/characterName.js";
import {
  ITEM_TYPE_LABEL,
  RARITY_STYLE,
  getItem,
} from "../../data/items/index.js";
import {
  RARIDADES_FILTRO,
  TIPOS_VENDA,
  labelTipo,
} from "../../data/market/index.js";

/**
 * O PAINEL 1: ESCOLHA O QUE VENDER.
 *
 * ## POR QUE A GRADE E DE 12 E PAGINADA
 *
 * Porque é o que o briefing pede e porque a mochila tem 30 slots: as três
 * linhas cabem sem rolagem interna, e quem tem 40 itens vê "1/4" em vez de
 * rolar uma lista sem fim
 *
 * ## POR QUE USA O `InvSlotView` E NAO UM CARD
 *
 * Porque o `InvSlotView` é o componente que o inventário já mostra: ícone da
 * arte certa por raridade, badge de `+N` do aprimoramento, contador de
 * quantidade e tooltip. Escrever uma célula aqui seria a segunda versão da
 * mesma peça, e o marketplace mostraria um item diferente do inventário
 *
 * ## POR QUE NÃO HÁ SEGMENTED "MOCHILA / SOMBRAS"
 *
 * Porque "Sombras" não existe no projeto. Um controle com duas opções em que
 * a segunda devolve lista vazia seria um botão que não faz nada
 */
const POR_PAGINA = 12;

export default function ListingItemPicker({
  itens = [],
  selecionadoUid = null,
  aoSelecionar,
}) {
  const [busca, setBusca] = useState("");
  const [raridade, setRaridade] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim() ? nameKey(busca) : null;

    /**
     * SO O QUE PODE VIRAR ANUNCIO ENTRA NA LISTA.
     *
     * E o filtro de mais la CIMA de todos, antes da raridade, do tipo e da
     * busca: um item que nao e negociavel nao e uma opcao do formulario, e uma
     * opcao que nao existe nao pode ser filtrada nem buscada
     *
     * ## POR QUE O CAMPO E `=== true` E NAO O CONTRARIO
     *
     * Porque `comercializavel` nao e "nao comercializavel", e "ainda nao
     * sorteado". Um save de antes da regra nao tem o campo, e o `=== true` faz
     * esse item NAO aparecer — que e o comportamento correto: item sem a
     * decisao tomada nao entra no mercado
     *
     * ## POR QUE A MAIORIA SOME DA MOCHILA
     *
     * Porque so 25% do que o jogador cria e 20% do que cai e negociavel. Abrir
     * o formulario e ver quase nada seria a tela parecer quebrada, mas e a
     * regra funcionando: o mercado entre jogadores tem que ter oferta escassa,
     * senao vira a rota mais facil de ouro
     */
    const negociaveis = itens.filter(
      (entrada) => entrada.comercializavel === true,
    );

    return negociaveis.filter((entrada) => {
      if (raridade && entrada.rarity !== raridade) return false;

      if (tipo) {
        const item = getItem(entrada.itemId);

        if (!item || labelTipo(item.type) !== tipo) return false;
      }

      if (!termo) return true;

      const nome = getItem(entrada.itemId)?.name ?? "";

      return nome && nameKey(nome).includes(termo);
    });
  }, [itens, busca, raridade, tipo]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));

  /**
   * A PAGINA NUNCA PASSA DO FIM.
   *
   * Porque filtrar pode ENCOLHER a lista com a pessoa na página 4: sem este
   * piso, `filtrados.slice(36, 48)` numa lista de 8 itens devolve vazio e a
   * grade mostra "nada encontrado" com 12 anúncios na tela
   */
  const paginaSegura = Math.min(pagina, totalPaginas);

  const visiveis = filtrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA,
  );

  /**
   * TROCAR A BUSCA VOLTA PARA A PRIMEIRA PAGINA.
   *
   * E o mesmo motivo do piso acima, no sentido inverso: quem filtra com a
   * pagina em 3 e volta a limpar o filtro ve a pagina 3 de uma lista que
   * voltou a ter 40 itens
   */
  function trocarBusca(valor) {
    setBusca(valor);
    setPagina(1);
  }

  return (
    <section className="lst-painel">
      <header className="lst-painel__head">
        <span className="lst-painel__passo">1</span>
        <h2 className="lst-painel__titulo">ESCOLHA O QUE VENDER</h2>
      </header>

      <div className="lst-busca">
        <span className="lst-busca__lupa" aria-hidden="true">
          ⌕
        </span>

        <input
          type="text"
          className="lst-busca__input"
          placeholder="Buscar pelo nome"
          aria-label="Buscar item pelo nome"
          value={busca}
          onChange={(event) => trocarBusca(event.target.value)}
        />
      </div>

      <div className="lst-selects">
        <label className="lst-select">
          <span>Raridade</span>
          <select
            className="lst-select__campo"
            value={raridade}
            onChange={(event) => {
              setRaridade(event.target.value);
              setPagina(1);
            }}
          >
            <option value="">Qualquer</option>

            {RARIDADES_FILTRO.map((id) => (
              <option key={id} value={id}>
                {RARITY_STYLE[id]?.label ?? id}
              </option>
            ))}
          </select>
        </label>

        <label className="lst-select">
          <span>Tipo</span>
          <select
            className="lst-select__campo"
            value={tipo}
            onChange={(event) => {
              setTipo(event.target.value);
              setPagina(1);
            }}
          >
            <option value="">Qualquer</option>

            {TIPOS_VENDA.map((id) => (
              <option key={id} value={id}>
                {ITEM_TYPE_LABEL[id] ?? labelTipo(id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visiveis.length === 0 ? (
        <p className="lst-vazia">
          {/*
            A MENSAGEM DIZ POR QUE A LISTA ESTA VAZIA.

            Porque "nenhum item disponível" e a resposta errada na maioria das
            vezes: a lista esta vazia porque o filtro de comercializavel
            escondeu tudo, e o jogador tem uma mochila cheia na tela. Sem esta
            frase ele ia procurar o botao de busca e o filtro de tipo, que
            estao funcionando — o problema esta fora deles
          */}
          {busca || raridade || tipo
            ? "Nenhum item com esses filtros."
            : "Nenhum item na mochila pode ser anunciado."}
        </p>
      ) : (
        <div className="lst-grade" role="listbox" aria-label="Itens da mochila">
          {visiveis.map((entrada) => {
            const selecionado = entrada.uid === selecionadoUid;

            return (
              <div
                key={entrada.uid}
                className="lst-celula"
                role="option"
                aria-selected={selecionado}
                tabIndex={0}
                onClick={() => aoSelecionar(entrada)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;

                  event.preventDefault();
                  aoSelecionar(entrada);
                }}
              >
                <InvSlotView
                  entry={entrada}
                  selected={selecionado}
                />
              </div>
            );
          })}
        </div>
      )}

      <footer className="lst-rodape-grade">
        <span className="lst-total">
          {`${filtrados.length} ${filtrados.length === 1 ? "item" : "itens"}`}
        </span>

        {totalPaginas > 1 && (
          <span className="lst-paginacao">
            <button
              type="button"
              className="lst-paginacao__btn"
              disabled={paginaSegura <= 1}
              onClick={() => setPagina(paginaSegura - 1)}
              aria-label="Página anterior"
            >
              ‹
            </button>

            <span className="lst-paginacao__texto">
              {`${paginaSegura}/${totalPaginas}`}
            </span>

            <button
              type="button"
              className="lst-paginacao__btn"
              disabled={paginaSegura >= totalPaginas}
              onClick={() => setPagina(paginaSegura + 1)}
              aria-label="Próxima página"
            >
              ›
            </button>
          </span>
        )}
      </footer>
    </section>
  );
}