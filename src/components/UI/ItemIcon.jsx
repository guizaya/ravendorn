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

  /**
   * `loading="lazy"` E `decoding="async"`, E O MOTIVO DE ESTAR AQUI.
   *
   * ## O QUE ACONTECIA SEM
   *
   * O painel de craft lista os itens numa grade que rola. Cada `<img>` sem
   * `loading` e baixado no instante em que entra no DOM — inclusive o que esta
   * seis telas abaixo da dobra. Sao 83 icones no `dist/`, somando 2,2 MB, e o
   * painel abria esperando tudo isso ao mesmo tempo
   *
   * O sintoma era o jogador entrando pela primeira vez e vendo a tela de craft
   * "demorar para carregar", sem nenhum erro: era rede, e a rede estava certa
   *
   * ## POR QUE NAO ATRASAR O PAINEL INTEIRO
   *
   * Porque o painel ainda tem que aparecer na hora. O `lazy` nao esconde o
   * painel: ele so diz ao navegador para pegar PRIMEIRO o que esta visivel e ir
   * buscar o resto conforme o jogador rola. Quem esta na tela aparece na hora,
   * que e o que importa
   *
   * ## E POR QUE `decoding="async"`
   *
   * Porque o decodificar imagem trava a thread principal. Com uma tela cheia
   * de icones, o decode em serie segura o `requestAnimationFrame` e o jogo
   * engasga no meio da rolagem — a arte chegava, mas o canvas parava
   */
  return (
    <span className={classNames}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
