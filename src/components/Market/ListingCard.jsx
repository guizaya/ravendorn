import { useState } from "react";

import ItemCard from "../UI/ItemCard.jsx";
import IconeMoeda from "../UI/IconeMoeda.jsx";
import {
  lanceMinimoAtual,
  MODO_VENDA,
  MODO_VENDA_LABEL,
  precoUnitario,
} from "../../data/market/index.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { classesOfItem } from "../../data/craft/craftPorClasse.js";
import { formatarMoedas } from "../../data/guild/index.js";
import BarraTempo from "./MarketPanel.jsx";

/**
 * O CARD DE UM ANÚNCIO.
 *
 * ## POR QUE ELE VAI DENTRO DO `ItemCard` E NAO SUBSTITUI ELE
 *
 * Porque o `ItemCard` é o componente que o inventario e o encantar ja usam
 * para mostrar um item, e ele ja resolve a parte difícil: o `--rarity` da
 * cor, o `data-rarity`, o `ItemIcon` com a arte da raridade certa, a
 * quantidade e o nome. Reescrever isso aqui seria uma terceira versão da
 * mesma peça, e a primeira vez que a raridade mudasse de lugar o mercado
 * mostraria uma cor e o inventario outra
 *
 * ## O QUE ESTE CARD ADICIONA SOBRE O ITEM
 *
 * Só o que é do anúncio e não do item: o preço, o vendedor e o prazo. E a
 * restrição de classe, que hoje NENHUM componente do projeto exibe — o dado
 * existe em `item.classes`, e `ItemTooltip` nunca leu esse campo
 */
export default function ListingCard({
  listing,
  onBuy,
  onBid,
  podeComprar = true,
  motivoBloqueio = null,
}) {
  /**
   * O ESTADO DO CAMPO DE LANCE.
   *
   * Vive aqui porque o campo SO EXISTE em leilao: um `useState` no card, e nao
   * no painel, porque o painel lista varios anuncios e o texto digitado em um
   * nao pode vazar para o lance do outro
   */
  const [lanceTexto, setLanceTexto] = useState("");

  /**
   * O LEILÃO E A VENDA DIRETA, e o card é o mesmo.
   *
   * Porque o `ItemCard` ja resolve o item, a raridade e o nome. O que muda
   * entre os dois modos é o preço, a etiqueta e o botão — e um card separado
   * para o leilão seria uma segunda copia de tudo isso
   */
  const leilao = listing.modo === MODO_VENDA.LEILAO;

  /**
   * O MENOR LANCE ACEITO AGORA.
   *
   * Vem de `lanceMinimoAtual`, que e a MESMA funcao que o servidor usa no
   * `market.bid`. Escrever o piso aqui de novo daria um campo com 100 e um
   * servidor recusando 100 — o jogador perderia a diferenca de uma moeda sem
   * entender o motivo
   */
  const piso = leilao ? lanceMinimoAtual(listing) : 0;

  const lance = Number(lanceTexto.replace(/\D/g, "")) || 0;
  const lanceOk = lance >= piso && lance > 0;

  const podeLancar = podeComprar && leilao && lanceOk;

  /**
   * O RESTRIÇÃO DE CLASSE do item, em nome de exibição.
   *
   * E a PRIMEIRA coisa do projeto que le isto. O dado alimenta o
   * `canClassUseItem` desde sempre, e aparecia no mundo so como um "não pode
   * usar" DEPOIS da tentativa — agora o jogador lê ANTES de comprar, que é
   * quando a informação vale
   *
   * E sai de `classesOfItem`, e nao de `item.classes`, por causa das ARMAS:
   * elas nao tem `classes`, tem `kind`, e e o `kind` que diz que espada é de
   * Warrior. Lendo o campo errado, todo arma apareceria sem restrição — que
   * e o item mais restrito do jogo aparecendo como o mais livre
   */
  const restritoA = classesDe(listing.itemId);

  return (
    <ItemCard entry={listing} className="mkt-listing">
      {restritoA && (
        <span className="mkt-listing__restricao">
          {`Somente ${restritoA}`}
        </span>
      )}

      {/*
        A ETIQUETA DO MODO, e ela vem ANTES do preço.

        Porque o número sozinho não diz o que ele é: 350.000 num leilão é o
        piso, e 350.000 na venda direta é o pagamento. Quem lê de baixo para
        cima veria um preço que não vai ser cobrado
      */}
      {leilao && (
        <span className="mkt-listing__modo">
          {MODO_VENDA_LABEL[listing.modo]}
        </span>
      )}

      {/*
        O PREÇO. A unidade so aparece quando o anúncio tem mais de uma peça,
        porque com uma peça "350.000/un" e "350.000" sao o mesmo numero dito
        duas vezes — e o "/un" faz o jogador reler o valor maior
      */}
      <span className="mkt-listing__preco">
        <IconeMoeda moeda={listing.currency} lado={16} />
        <strong>{formatarMoedas(listing.price)}</strong>

        {listing.count > 1 && (
          <small>
            {formatarMoedas(precoUnitario(listing.price, listing.count))}
            /un
          </small>
        )}
      </span>

      {/*
        O MAIOR LANCE, quando existe. E a informação que faz um leilão ser um
        leilão: sem o valor atual, o jogador não sabe se o piso que ele vê
        é o primeiro lance ou um dispute já begun
      */}
      {leilao && listing.maiorLance != null && (
        <span className="mkt-listing__maior">
          {`Maior lance: ${formatarMoedas(listing.maiorLance)}`}
          {listing.maiorLanceBuyer?.name
            ? ` — ${listing.maiorLanceBuyer.name}`
            : ""}
        </span>
      )}

      <BarraTempo restanteMs={listing.restanteMs} />

      <span className="mkt-listing__rodape">
        <span
          className="mkt-listing__vendedor"
          data-tip={listing.sellerName}
        >
          {listing.sellerName}
        </span>
      </span>

      {leilao ? (
        <div className="mkt-listing__lance">
          <input
            type="text"
            inputMode="numeric"
            className="lst-campo lst-campo--narrow"
            placeholder={formatarMoedas(piso)}
            value={lanceTexto}
            onChange={(event) =>
              setLanceTexto(event.target.value.replace(/\D/g, ""))
            }
            data-tip={`Mínimo agora: ${formatarMoedas(piso)}`}
            aria-label={`Lance mínimo ${formatarMoedas(piso)}`}
          />

          <button
            type="button"
            className="mkt-item__buy mkt-listing__comprar"
            onClick={() => onBid?.(listing.id, lance)}
            disabled={!podeLancar}
            data-tip={
              podeComprar
                ? "Dar lance"
                : (motivoBloqueio ?? "Indisponível")
            }
          >
            Lance
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mkt-item__buy mkt-listing__comprar"
          onClick={() => onBuy?.(listing.id)}
          disabled={!podeComprar}
          data-tip={
            podeComprar
              ? "Comprar"
              : (motivoBloqueio ?? "Indisponível")
          }
        >
          Comprar
        </button>
      )}
    </ItemCard>
  );
}

/**
 * OS NOMES DE EXIBIÇÃO das classes que o item restringe, ou `null`.
 *
 * ## POR QUE ISSO NAO ESTA EM `ItemTooltip`
 *
 * Porque o `ItemTooltip` mostra o que o jogador PODE fazer com o item: nome,
 * raridade, afixo, skill do livro, e se ele tem os materiais. A restrição de
 * classe so interessa QUANDO VOCE ESTA OLHANDO PARA O MERCADO — no
 * inventário, todo item ali é seu, e a restrição não muda nada. Colocá-la no
 * tooltip faria ela aparecer em todo hover de todo item do jogo
 *
 * ## POR QUE A LISTA INTEIRA DE CLASSES some
 *
 * Porque `classesOfItem` devolve todas as classes quando o item não tem dona
 * declarada — relíquia, poção, livro. Mostrar "Somente Arbalist, Lancer,
 * Sorcerer e Warrior" seria verdade literal e mentira de leitura: o jogador
 * leria como restrição e o item não tem nenhuma
 */
function classesDe(itemId) {
  const ids = classesOfItem(itemId);

  if (!Array.isArray(ids) || ids.length === 0) return null;

  const nomes = ids
    .map((id) => CHARACTER_CLASSES.find((c) => c.id === id)?.name)
    .filter(Boolean);

  if (nomes.length === 0) return null;

  // cobre o item sem restrição: todas as classes não são restrição nenhuma
  if (nomes.length === CHARACTER_CLASSES.length) return null;

  // uma classe so fica no singular; duas ou mais viram "A e B", que é como o
  // jogador falaria em voz alta
  if (nomes.length === 1) return nomes[0];

  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}