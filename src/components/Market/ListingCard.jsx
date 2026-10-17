import { useState } from "react";

import ItemCard from "../UI/ItemCard.jsx";
import IconeMoeda from "../UI/IconeMoeda.jsx";
import {
  lanceMinimoAtual,
  MODO_VENDA,
  MODO_VENDA_LABEL,
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
   * A CLASSE DO ITEM, em nome de exibição — e NÃO é uma trava.
   *
   * ## POR QUE O "SOMENTE" SAIU
   *
   * Porque não existe mais trava de classe no mercado. `podeComprar` no
   * `VitrineAba` só olha espaço no inventário e empilhamento, e o servidor
   * nunca consultou `canClassUseItem` na compra: qualquer classe compra
   * qualquer item. O texto dizia "Somente Arbalist" sobre um botão que
   * funciona para todo mundo — o jogador lia uma regra que não existe
   *
   * ## POR QUE A ETIQUETA CONTINUA
   *
   * Porque "quem usa" ainda é informação boa: ela diz para quem a arma foi
   * feita. Sem o "Somente", o rótulo é a classe do item — e não precisa mais
   * prometer nada que o botão não cumpra
   *
   * E sai de `classesOfItem`, e nao de `item.classes`, por causa das ARMAS:
   * elas nao tem `classes`, tem `kind`, e e o `kind` que diz que espada é de
   * Warrior. Lendo o campo errado, toda arma apareceria sem dono — que
   * e o item mais específico do jogo aparecendo como o mais genérico
   */
  const classeItem = classeDe(listing.itemId);

  return (
    <ItemCard entry={listing} className="mkt-listing">
      {classeItem && (
        <span
          className="mkt-listing__classe"
          style={{ "--classe": classeItem.accent }}
        >
          {classeItem.nome}
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
          className={[
            "mkt-item__buy mkt-listing__comprar",
            `mkt-listing__comprar--${listing.currency}`,
          ].join(" ")}
          onClick={() => onBuy?.(listing.id)}
          disabled={!podeComprar}
          data-tip={
            podeComprar
              ? "Comprar"
              : (motivoBloqueio ?? "Indisponível")
          }
        >
          {/*
            O PRECO NO BOTAO, E A COR DO BOTAO E A DA MOEDA.

            ## POR QUE SUMIU A LINHA DE PRECO

            Porque o preco aparecia duas vezes: na linha `.mkt-listing__preco`
            e no botao, como nome da acao. Com a arte da moeda no botao, o
            numero repetido nao acrescenta nada — o jogador lia 350.000 duas
            vezes antes de ler o que ele podia fazer com aquilo

            ## E POR QUE A COR VEM DA MOEDA

            Porque a moeda e a ultima coisa que se olha num anuncio, e a cor
            e o que chega primeiro. Um botao verde que e ouro, um que e steel
            e um que e diamante com a MESMA cor fazem o jogador clicar sem
            olhar o valor

            As tres cores nao sao escolhidas aqui: vem do `MOEDAS_ESPECIAIS`
            de `data/loja/index.js`, que ja fixa ouro `#e6c47a`, steel
            `#c9a0ff` e diamante `#8fd6f2`. O CSS so le o token `--moeda`
          */}
          <IconeMoeda moeda={listing.currency} lado={14} />
          {formatarMoedas(listing.price)}
        </button>
      )}
    </ItemCard>
  );
}

/**
 * OS NOMES DE EXIBIÇÃO das classes que o item tem, ou `null`.
 *
 * ## POR QUE ISSO NAO ESTA EM `ItemTooltip`
 *
 * Porque o `ItemTooltip` mostra o que o jogador PODE fazer com o item: nome,
 * raridade, afixo, skill do livro, e se ele tem os materiais. A classe do item
 * so interessa QUANDO VOCE ESTA OLHANDO PARA O MERCADO — no inventário, todo
 * item ali é seu, e a classe não muda nada. Colocá-la no tooltip faria ela
 * aparecer em todo hover de todo item do jogo
 *
 * ## POR QUE A LISTA INTEIRA DE CLASSES some
 *
 * Porque `classesOfItem` devolve todas as classes quando o item não tem dona
 * declarada — relíquia, poção, livro. Mostrar "Arbalist, Lancer, Sorcerer e
 * Warrior" seria verdade literal e mentira de leitura: o jogador leria como
 * aviso de classe restrita, e o item não tem dono nenhum
 *
 * ## POR QUE VOLTA O `accent`
 *
 * Porque a etiqueta precisa da COR, e a cor mora no `CHARACTER_CLASSES`.
 * Returning so o nome obrigaria o CSS a adivinhar a classe pelo texto escrito,
 * que quebra no primeiro item com duas classes. O `accent` é o mesmo valor que
 * o chip do filtro usa — as duas cores saem do mesmo lugar, entao o jogador nao
 * ve um Arbalist verde num lugar e roxo no outro
 */
function classeDe(itemId) {
  const ids = classesOfItem(itemId);

  if (!Array.isArray(ids) || ids.length === 0) return null;

  const classes = ids
    .map((id) => CHARACTER_CLASSES.find((c) => c.id === id))
    .filter(Boolean);

  if (classes.length === 0) return null;

  // cobre o item sem dono: todas as classes não são informação nenhuma
  if (classes.length === CHARACTER_CLASSES.length) return null;

  // uma classe so fica no singular; duas ou mais viram "A e B", que é como o
  // jogador falaria em voz alta
  const nome =
    classes.length === 1
      ? classes[0].name
      : `${classes
          .slice(0, -1)
          .map((c) => c.name)
          .join(", ")} e ${classes[classes.length - 1].name}`;

  return { nome, accent: classes[0].accent };
}