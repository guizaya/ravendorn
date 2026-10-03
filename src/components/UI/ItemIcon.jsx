import { itemIconUrl } from "../../data/items/icons.js";

/**
 * O icone de um item, seja ele arte ou glifo.
 *
 * O catalogo guarda um `icon` de TEXTO (um emoji), e ele nao muda com
 * a raridade. Os itens que tem arte desenhada mostram um `<img>`
 * escolhido pela raridade. Este componente e o lugar que decide
 * entre os dois, para que nenhum painel precise saber a regra:
 *
 * - tem imagem para aquela raridade: `<img>`, com a cor da raridade
 *   continuando no `--rarity` do pai
 * - nao tem: o glifo, como sempre
 *
 * A rarity entra pela props e NAO vem do `item.rarity` do catalogo.
 * O arco de galho tem `rarity: uncommon` no catalogo, mas o craft
 * entrega o mesmo arco nas cinco raridades, e quem esta no inventario
 * pode estar com a variante lendaria. Ler o catalogo faria o arco
 * lendario mostrar a arte incomum
 */
export default function ItemIcon({
  item,
  itemId,
  rarity = null,
  className = "",
  alt = "",
}) {
  /**
   * O id do item, e o campo NAO tem o mesmo nome nos dois lados.
   *
   * O catalogo e a receita do craft usam campos diferentes: o item do
   * catalogo tem `id`, e a receita que o painel recebe tem `itemId`.
   * Ler so um dos dois resolve `null` sem erro nenhum, e o icone cai
   * no glifo em silencio: era o que acontecia no detalhe do craft, que
   * mostrava o arco com o glifo mesmo com as cinco artes prontas
   */
  const id = itemId ?? item?.itemId ?? item?.id;

  const glyph = item?.icon;
  const src = itemIconUrl(id, rarity);

  const classNames = [
    className,
    src ? "item-icon" : "item-icon--glyph",
  ]
    .filter(Boolean)
    .join(" ");

  if (!src) {
    return <span className={classNames}>{glyph}</span>;
  }

  // O `alt` vazio e deliberado: o nome do item ja esta no `title` do
  // slot e no rotulo do botao, e um leitor de tela announcing o
  // mesmo texto duas vezes enche o inventario de repeticao
  return (
    <span className={classNames}>
      <img src={src} alt={alt} draggable={false} />
    </span>
  );
}
