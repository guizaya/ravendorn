import { ITEM_TYPE, ITEM_TYPE_LABEL } from "../../data/items/index.js";

/**
 * A COLUNA DE CATEGORIAS.
 *
 * ## POR QUE A LISTA VEM DO `ITEM_TYPE` E NAO E ESCRITA AQUI
 *
 * Porque `ITEM_TYPE` tem os SEIS tipos que o catalogo inteiro usa, e cada
 * anuncio ja chega classificado por um deles (`tipoDoAnuncio`). Uma lista
 * escrita aqui teria seis linhas que so bateriam com a fonte enquanto ninguem
 * adicionasse um tipo novo — e quando adicionassem, o filtro continuaria
 * mostrando a categoria antiga e o item novo sumiria dela
 *
 * O briefing pede "Equipamentos, Armas, Armaduras, Acessórios, Consumíveis,
 * Materiais, Itens especiais, Sombras". Duas dessas nao existem no projeto
 * (`Sombras` nao e uma categoria de item) e as outras sao subdivisoes de um
 * tipo so. Virar um `ITEM_TYPE` em varios rotulos de briefing seria inventar
 * taxonomia, entao o que existe e o que aparece
 *
 * ## POR QUE "TODOS" PRIMEIRO
 *
 * Porque e o estado padrao e o que mostra mais resultado. Um filtro que
 * comeca marcado esconde anuncios e o jogador le o mercado como vazio
 */
export default function CategorySidebar({ ativa, onTrocar, total }) {
  const categorias = [
    { id: "", label: "Todos", tipo: null },
    ...Object.keys(ITEM_TYPE).map((tipo) => ({
      id: tipo,
      label: ITEM_TYPE_LABEL[tipo] ?? tipo,
      tipo,
    })),
  ];

  return (
    <nav className="mkt-cats" aria-label="Categorias">
      <h3 className="mkt-cats__titulo">CATEGORIAS</h3>

      <ul className="mkt-cats__lista">
        {categorias.map((categoria) => {
          const ativaAqui = categoria.id === ativa;

          return (
            <li key={categoria.id || "todos"}>
              <button
                type="button"
                className={[
                  "mkt-cats__item",
                  ativaAqui ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={ativaAqui}
                onClick={() => onTrocar(categoria.id)}
              >
                {categoria.label}

                {/*
                  A CONTAGEM so aparece na categoria ativa.

                  Nos outrosAnnúncios de cada tipo mudam a cada compra e a cada
                  listagem de qualquer jogador do mundo, e um numero que se
                  move sozinho distrai de quem esta lendo o preco. Na ativa, ele
                  responde "quantos sobraram depois do meu filtro"
                */}
                {ativaAqui && total !== null && (
                  <span className="mkt-cats__conta">{total}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}