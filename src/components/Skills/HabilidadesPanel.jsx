import ItemIcon from "../UI/ItemIcon.jsx";
import { livrosDaClasse } from "../../data/skills/books.js";
import { getItem } from "../../data/items/index.js";

/**
 * A LOJA DE LIVROS do Mestre de Habilidades.
 *
 * ## POR QUE UM CATALOGO POR CLASSE
 *
 * O `livrosDaClasse` ja resolve a classe de dentro do catalogo: o painel
 * pede os livros de `classId` e recebe so os dela. E por isso que um
 * Arbalist ve o livro de Quick Shot e um Guerreiro nao ve aquele livro —
 * nao e o painel escondendo, e o catalogo da classe nao ter
 *
 * O painel NUNCA decide o preco nem se o jogador pode comprar. Ele
 * desenha o catalogo e manda o `itemId`, e o servidor cobra — o mesmo
 * acordo do `PotionPanel`. O botao desligado por falta de saldo e
 * conveniencia, nao seguranca
 *
 * ## POR QUE O ITEM TEM `use`
 *
 * A loja ENTREGA o livro na mochila, e ele ensina quando o jogador usa.
 * Nao Teaching direto na compra porque o livro e um item de verdade:
 * entra na mochila, aparece no inventario, e o jogador e quem decide
 * quando aprender
 */

export default function HabilidadesPanel({
  classId,
  coins = null,
  habilidadesAprendidas = null,
  onBuy,
  onClose,
}) {
  const saldo = coins === null || coins === undefined ? null : coins;

  /**
   * O CATALOGO DESTA CLASSE.
   *
   * `classId` undefined da lista vazia, e uma lista vazia e um estado
   * valido: enquanto o painel abre antes do pacote do jogador, ou para
   * uma classe que ainda nao tem livro escrito, o painel mostra o
   * recado de "nenhum livro" em vez de quebrar
   */
  const livros = livrosDaClasse(classId);

  /**
   * O QUE O JOGADOR JA SABE.
   *
   * `null` e "ainda nao chegou", e nao `[]`: com a lista vazia o painel
   * mostraria todo mundo sem habilidade no primeiro quadro e o jogador
   * acharia que perdeu tudo. Enquanto nao sabe, nenhum livro aparece como
   * aprendido
   */
  const conhecidas =
    habilidadesAprendidas === null ||
    habilidadesAprendidas === undefined
      ? null
      : new Set(habilidadesAprendidas);

  return (
    <section className="inv-panel pocao-panel" aria-label="Habilidades">
      <nav className="inv-tabs">
        <span className="inv-tab is-active pocao-tab">
          <span className="pocao-tab__icon">✧</span>
          <small>Mestre de Habilidades</small>
        </span>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar"
        >
          ✕
        </button>
      </nav>

      <div className="pocao-panel__body">
        <p className="pocao-panel__intro">
          Livros ensinam habilidades. O livro vai para a mochila e a
          habilidade so entra no personagem quando voce o usar. A
          ultimate nao esta aqui: ela libera no nivel 6.
        </p>

        {livros.length === 0 ? (
          <p className="inv-panel__empty">
            Nenhum livro para a sua classe ainda.
          </p>
        ) : (
          livros.map((livro) => (
            <Linha
              key={livro.itemId}
              livro={livro}
              saldo={saldo}
              aprendida={
                conhecidas?.has(livro.skillId) ?? null
              }
              onBuy={onBuy}
            />
          ))
        )}
      </div>
    </section>
  );
}

/**
 * Um livro a venda: arte, o que ele ensina, o preco e o botao.
 *
 * O botao tem TRES estados e nao dois, e o terceiro e o importante: um
 * livro que o jogador ja aprendeu mostra "Aprendida" e nao "Comprar",
 * porque vender de novo seria cobrar por nada
 */
function Linha({ livro, saldo, aprendida, onBuy }) {
  const item = getItem(livro.itemId);

  /**
   * O item tem de existir no catalogo.
   *
   * `validarLivros` ja descarta um livro cujo `itemId` nao existe, entao
   * esta e uma segundaRede. Fica porque o catalogo de itens e o de
   * livros sao arquivos separados e um dia podem divergir: uma linha sem
   * nome e sem imagem nao diz ao jogador que houve um erro
   */
  if (!item) return null;

  const semSaldo = saldo !== null && saldo < livro.preco;

  const compravel = !aprendida && !semSaldo;

  return (
    <article className="pocao-linha">
      <div className="pocao-linha__art">
        <ItemIcon item={item} rarity={item.rarity} />
      </div>

      <div className="pocao-linha__texto">
        <h3 className="pocao-linha__nome">{item.name}</h3>

        <p className="pocao-linha__desc">
          {item.description ??
            "Ensina uma habilidade para sempre."}
        </p>

        <p className="pocao-linha__nota">
          Entra na mochila. Use o livro para aprender.
        </p>
      </div>

      <div className="pocao-linha__compra">
        {aprendida ? (
          <>
            <strong
              className="pocao-linha__preco"
              style={{ color: "#d3bd90" }}
            >
              ✓
            </strong>

            <small className="pocao-linha__unit">aprendida</small>

            <button
              type="button"
              className="pocao-comprar"
              disabled
              data-tip="Voce ja sabe esta habilidade"
            >
              Aprendida
            </button>
          </>
        ) : (
          <>
            <strong
              className="pocao-linha__preco"
              style={{ color: "#e8c96a" }}
            >
              {livro.preco}
            </strong>

            <small className="pocao-linha__unit">moedas</small>

            <button
              type="button"
              className="pocao-comprar"
              disabled={semSaldo}
              onClick={() => onBuy(livro.itemId)}
              data-tip={
                semSaldo
                  ? "Moedas insuficientes"
                  : `Comprar ${item.name}`
              }
            >
              {semSaldo ? "Sem moedas" : "Comprar"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}