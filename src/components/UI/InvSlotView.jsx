import { useState } from "react";
import ItemIcon from "./ItemIcon.jsx";
import ItemTooltip from "./ItemTooltip.jsx";
import {
  RARITY_STYLE,
  getItem,
  isStackable,
} from "../../data/items/index.js";

/**
 * O SLOT de um item, so a apresentacao.
 *
 * Extraido do `InventoryPanel` para que o mercado use o MESMO desenho da
 * mochila. A alternativa — copiar o `<div class="inv-slot">` para dentro
 * do `MarketPanel` — parece mais rapida e cobra o pedagogo depois: uma
 * correcao no slot da mochila (uma badge nova, um ajuste de cor) chega so
 * em um dos dois, e o jogador ve a mesma peca com duas aparencias no
 * mesmo jogo
 *
 * Este componente nao sabe o que e um `uid`, nem de onde veio a entrada:
 * ele desenha. Quem decide o que acontece no clique e o `ItemSlot` do
 * inventario (menu de equipar/encantar/descartar) e o seletor do mercado
 * (escolher o que anunciar)
 *
 * A CAIXA DE INFORMACOES fica no `ItemTooltip`, e este componente so
 * avisa que o mouse entrou. Ela e parte do slot para o jogador, e nao
 * parte do desenho: vive num portal por causa do `overflow: hidden` do
 * painel, e a leitura dela esta no proprio `ItemTooltip`
 */
export default function InvSlotView({
  entry,
  compact = false,
  area,
  className = "",
  children = null,
  onSelect = null,
  selected = false,
}) {
  const item = getItem(entry.itemId);

  if (!item) return null;

  /**
   * A raridade do SLOT e a da variante na mochila, e nao a do catalogo.
   *
   * O catalogo tem uma raridade so, e ela e a "natural" do item: o
   * craft entrega o mesmo arco nas cinco, entao um `willow_bow` guardado
   * pode ser lendario. Ler `item.rarity` pintaria o slot com a cor da
   * raridade base enquanto o `title` diz outra coisa
   */
  const raridadeId = entry.rarity ?? item.rarity;

  const rarity = RARITY_STYLE[raridadeId] ?? null;

  const unique = !isStackable(item);

  const nome = item.name;

  /**
   * A CAIXA DE INFORMACOES, e o que o `title` fazia antes.
   *
   * ## POR QUE O ESTADO E O `elemento` E NAO UM `true`
   *
   * A caixa precisa do retangulo do slot para saber onde se posicionar, e
   * o `event.currentTarget` do `pointerenter` e exatamente esse elemento.
   * Guardar so um booleano obrigaria a medir de novo dentro de um
   * `useEffect`, com um segundo layout para chegar no mesmo lugar
   *
   * ## O FOCO CONTA COMO PASSAR O MOUSE
   *
   * Quem navega pelo teclado tabula nos slots, e um item focado que nao
   * abre a caixa fica sem informacao nenhuma. E o `onBlur` fecha, entao
   * o `title` nativo sumiu sem perda de acessibilidade
   */
  const [ancora, setAncora] = useState(null);

  const abrirDica = (event) => setAncora(event.currentTarget);

  const fecharDica = () => setAncora(null);

  const slot = (
    <div
      /**
       * O `data-uid` do slot.
       *
       * Existe para o `direcaoDoMenu` do inventario encontrar o retangulo
       * deste item pelo `uid` da pilha. A medicao decide se a caixa de
       * opcoes abre para cima ou para baixo, e ela precisa saber ONDE este
       * slot esta — sem isto so dava para medir o container inteiro, e o
       * item do meio da lista receberia a direcao do ultimo
       *
       * `uid` e nao `itemId`: duas pilhas do mesmo item em raridades
       * diferentes sao dois slots, e a caixa errada abriria sobre a outra
       */
      data-uid={entry.uid ?? undefined}
      className={[
        "inv-slot",
        `inv-slot--${raridadeId}`,
        entry.equipped ? "is-equipped" : "",
        compact ? "is-compact" : "",
        selected ? "is-selected" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--rarity": rarity?.color ?? "#c3ccd6",
        ...(area ? { gridArea: area } : null),
      }}
    >
      <button
        type="button"
        className="inv-slot__hit"
        /**
         * O `event` vai como SEGUNDO argumento, e nao no lugar do `entry`.
         *
         * Quem chama precisa do `entry` para saber o que foi clicado, e
         * alguns precisam tambem do `event` para saber ONDE o slot esta:
         * uma caixa de opcoes que abre para baixo e cortada pela borda do
         * painel quando o item esta na ultima linha
         *
         * O seletor do mercado, que e o outro usuario deste componente,
         * recebe o segundo argumento e ignora — e por isso que ele vem
         * depois do `entry` e nao antes
         */
        onClick={(event) => onSelect?.(entry, event)}
        onPointerEnter={abrirDica}
        onPointerLeave={fecharDica}
        onFocus={abrirDica}
        onBlur={fecharDica}
        aria-label={nome}
        aria-pressed={onSelect ? Boolean(selected) : undefined}
      >
        <ItemIcon
          className="inv-slot__icon"
          item={item}
          rarity={raridadeId}
        />
      </button>

      {entry.equipped && (
        <span className="inv-slot__badge inv-slot__badge--equipped">
          E
        </span>
      )}

      {item.tier > 0 && (
        <span className="inv-slot__badge inv-slot__badge--tier">
          T{item.tier}
        </span>
      )}

      {unique && (
        <span className="inv-slot__mark" title="Item único" />
      )}

      {entry.count > 1 && (
        <span className="inv-slot__count">{entry.count}</span>
      )}

      {children}
    </div>
  );

  /**
   * A CAIXA VAI DEPOIS DO `return` DO SLOT, e nao dentro dele.
   *
   * Ela nao pode ser filha do `.inv-slot`: o painel tem `transform` e
   * `overflow: hidden`, entao qualquer coisa dentro dele e cortada na
   * borda. E ela nao precisa estar no lugar — o portal pendura no `body`
   * e se posiciona pela tela
   */
  return (
    <>
      {slot}

      <ItemTooltip entry={entry} ancora={ancora} />
    </>
  );
}