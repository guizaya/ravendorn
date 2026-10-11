import { RARITY_STYLE, getItem } from "../../data/items/index.js";
import InvSlotView from "./InvSlotView.jsx";

/**
 * O CARDO DE UM ITEM: o slot e, embaixo, o nome com a raridade.
 *
 * ## POR QUE ESTE COMPONENTE EXISTE
 *
 * A mochila e o painel de encantar mostram a MESMA coisa — uma peca, com
 * o nome e a raridade embaixo do icone — e antes cada um tinha a sua
 * versao. A da mochila era um `inv-item-card` com nome e raridade; a do
 * encantar era um `inv-cell` com o nome e o afixo, sem raridade nenhuma.
 *
 * Duas versoes do mesmo cartao divergem: um ajuste de largura, de
 * espaco ou de cor chegaria so em uma delas, e o jogador veria a mesma
 * peca com duas aparencias em dois paineis do mesmo jogo. E o painel de
 * encantar ainda mostrava MENOS informacao que a mochila, o que e
 * invertido: e ali que o jogador esta comparando pecas
 *
 * ## O QUE ESTE COMPONENTE NAO FAZ
 *
 * Nao decide o que o clique faz. Quem passa o `onSelect` e o dono da
 * lista: a mochila abre a caixa de opcoes, o encantar marca a peca como
 * escolhida. O cartao so desenha
 *
 * ## POR QUE O `entry` INTEIRO, E NAO SO O `itemId`
 *
 * O slot precisa da RARIDADE DA VARIANTE, e nao a do catalogo: um arco
 * guardado na mochila pode ser lendario enquanto o catalogo diz comum.
 * E precisa do `count`, que e o que desenha o "x12" da pilha
 */
export default function ItemCard({
  entry,
  className = "",

  /**
   * O QUE O SLOT FAZ AO SER CLICADO.
   *
   * E um objeto e nao uma lista de props soltas porque quem usa sao
   * paineis com nomes diferentes para a mesma coisa: a mochila chama de
   * `onToggleMenu`, o encantar de `onSelect`. Passar o objeto inteiro
   * mantem o `InvSlotView` sem saber de nenhum dos dois
   */
  slotProps = {},

  /**
   * A CAIXA DE OPCOES DO SLOT, ou `null`.
   *
   * ## POR QUE ISTO EXISTE
   *
   * O `InvSlotView` aceita `children` e sabe pendurar a caixa dentro do
   * slot, com o `position` que a faz vazar para fora do painel — que e o
   * que o `overflow: hidden` do inventario cortaria.
   *
   * Quem passa e o dono da lista, e nao o cartao: o mercado e o encantar
   * nao tem caixa nenhuma, e a mochila tem uma com acoes que so ela sabe
   * montar. O cartao so pendura o que recebeu
   */
  menu = null,

/**
 * O QUE VAI DEBAIXO DO NOME.
 *
 * E o afixo no painel de encantar, e nada na mochila. E `children`
 * porque o cartao nao deveria conhecer afixo nenhum
 */
children = null,

/**
 * DESLIGA O BLOCO DE TEXTO — nome, raridade e quantidade.
 *
 * ## POR QUE UM PROP E NAO APAGAR O BLOCO
 *
 * Porque `ItemCard` e o MESMO cartao em cinco paineis, e cada um precisa de
 * uma coisa diferente embaixo do icone. O mercado e o encantar dependem do
 * nome para o jogador comparar duas pecas; a mochila nao, porque la a grade
 * mostra tres linhas de uma vez e o texto embaixo do icone vira um bloco de
 * ruido que empurra o espaco do item para baixo
 *
 * ## POR QUE O NOME SOME E O TOOLTIP CONTINUA
 *
 * Porque o nome nao some: ele vai para o `aria-label` do slot, que ja existia,
 * e para o `ItemTooltip` que abre no mouse. O que sai e o texto VISIVEL — a
 * mochila tem tres linhas de item e o olho precisa ler o ICONE, nao tres
 * paragrafos de nome repetido
 */
mostrarTexto = true,
}) {
  const item = getItem(entry.itemId);

  if (!item) return null;

  const raridadeId = entry.rarity ?? item.rarity;

  const style = RARITY_STYLE[raridadeId] ?? null;

  return (
    <div
      className={[
        "inv-item-card",

        /*
          SEM TEXTO, O CARD DEIXA DE SER UM CARTAO.

          A regra `is-bare` tira a casca — fundo, borda, raio e padding — e o
          que sobra e o wrapper do slot. Sem ela o jogador via uma caixa
          atras do icone, com a moldura do slot desenhada DENTRO de outra
          moldura, e o icone parecia pequeno demais dentro dela
        */
        mostrarTexto ? "" : "is-bare",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-rarity={raridadeId}
      style={{ "--rarity": style?.color }}
    >
      {/*
        O `onToggleMenu` VIRA `onSelect` AQUI, e nao no dono da lista.

        ## O BUG QUE ESTA LINHA CONSERTA

        Os dois nomes significam a mesma coisa — "o slot foi clicado" — e
        o `InvSlotView` so conhece `onSelect`. A mochila mandava
        `onToggleMenu` pelo `slotProps`, ele caia num prop que o
        componente nao declara, e o `onClick` ficava `onSelect?.()` com
        `undefined`: um no-op silencioso. NENHUM item da mochila abria a
        caixa de opcoes — nao era o livro, era o item inteiro
      */}
<InvSlotView
          entry={entry}
          {...slotProps}
          marcado={slotProps.marcado ?? false}
          onSelect={slotProps.onToggleMenu ?? slotProps.onSelect}
        selected={
          slotProps.selected ?? slotProps.menuOpen ?? false
        }
      >
        {menu}
      </InvSlotView>

{/* o bloco de texto some na mochila, mas o nome continua no aria-label */}
        {mostrarTexto && (
          <div className="inv-item-info">
            <span className="inv-item-name">{item.name}</span>

            <span className="inv-item-meta">
              <span className="inv-item-rarity">{style?.label}</span>

              {entry.count > 1 && (
                <span className="inv-item-count">x{entry.count}</span>
              )}
            </span>

            {children}
          </div>
        )}

        {/*
          OS `children` TAMBEM DESAPARECEM COM O TEXTO, E ISTO E INTENCIONAL.

          O `children` do card e o afixo do painel de encantar, que e desenhado
          DENTRO do `inv-item-info`. Num painel que esconde o texto, um afixo
          solto embaixo do slot ficaria sem o bloco que o posiciona — e o
          painel que esconde o texto e a mochila, que nao tem afixo nenhum
        */}
        {!mostrarTexto && children}
    </div>
  );
}