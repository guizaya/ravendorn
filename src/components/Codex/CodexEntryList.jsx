import CodexEntryCard from "./CodexEntryCard.jsx";

/**
 * A COLUNA DA LISTA.
 *
 * ## POR QUE `role="listbox"` E NAO `role="list"`
 *
 * Porque a lista aqui e uma SELECAO, nao uma colecao de leitura: um card
 * selecionado troca o que a coluna central mostra. E o que o `listbox` com
 * `option` dentro diz a um leitor de tela, e o que faz o `aria-selected`
 * ter para quem ser lido
 *
 * ## A NAVEGACAO POR SETAS
 *
 * E a unica parte do `bestiario.txt` que ja funciona aqui: o esqueleto
 * ainda nao tem detalhe nem toolbar, entao as setas saem de uma lista de
 * verdade e nao de uma lista filtrada por busca
 */
export default function CodexEntryList({
  entradas = [],
  selecionadaId = null,
  aoSelecionar,
}) {
  function moverPara(indice) {
    const alvo = entradas[indice];

    if (!alvo) return;

    aoSelecionar?.(alvo.id);
  }

  return (
    <section className="cdx-col cdx-col--lista">
      {entradas.length === 0 ? (
        <p className="cdx-vazio">Nenhuma entrada encontrada</p>
      ) : (
        <ul
          className="cdx-lista"
          role="listbox"
          aria-label="Entradas do Codex"
          onKeyDown={(event) => {
            const atual = entradas.findIndex(
              (entrada) => entrada.id === selecionadaId,
            );

            if (event.key === "ArrowDown") {
              event.preventDefault();
              moverPara(atual + 1);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              moverPara(atual - 1);
            }
          }}
        >
          {entradas.map((entrada) => (
            <CodexEntryCard
              key={entrada.id}
              entrada={entrada}
              selecionada={entrada.id === selecionadaId}
              aoSelecionar={aoSelecionar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}