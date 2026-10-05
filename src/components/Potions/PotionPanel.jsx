import { useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import {
  POCAO_MAX_POR_COMPRA,
  POCOES,
} from "../../data/potions/index.js";
import { getItem, isStackable } from "../../data/items/index.js";

/**
 * A LOJA DE POCOES do mercador.
 *
 * ## POR QUE ESTE NAO E O `MarketPanel`
 *
 * Sao dois paineis com sentidos opostos, e a distincao aparece no que
 * cada um FAZ com o dinheiro do jogador:
 *
 * - o mercado ENTRE jogadores e uma troca: o preco vem de quem vendeu,
 *   e o item vem da mochila de outro jogador;
 * - a loja e um catalogo: o preco vem do mercador, e o item vem do
 *   catalogo dele.
 *
 * Reusar o `MarketPanel` aqui mostraria a vitrine vazia — o mercador
 * nao tem oferta nenhuma — e o jogador clicaria no NPC e nao veria a
 * pocao que foi comprar
 *
 * ## O QUE O PAINEL NAO DECIDE
 *
 * Nem o preco, nem se cabe na mochila, nem se o saldo basta. Tudo isso e
 * do servidor, e o painel so DESENHA o catalogo e manda o `itemId` e a
 * quantidade. O preco que aparece na tela vem do catalogo, e e o mesmo
 * numero que o servidor cobra — mas e o servidor que cobra, e nao este
 * numero
 *
 * O botao fica desligado quando o saldo nao alcanca, e isso e
 * conveniência, e nao seguranca: um cliente ignorando o `disabled`
 * receberia a recusa do servidor de qualquer jeito
 */

/** o panel aguenta `coins` indefinido enquanto o primeiro pacote nao chega */
const VAZIO = {
  coins: 0,
};

export default function PotionPanel({
  coins = null,
  onBuy,
  onClose,
}) {
  const [quantidade, setQuantidade] = useState(1);

  /**
   * O saldo, ou `null` enquanto nao chegou.
   *
   * `null` e DIFFERente de `0`: com o saldo desconhecido o painel mostra
   * "—" no lugar do preco e nao desliga nenhum botao, porque nao ha
   * informacao para desabilitar. Tratar `null` como zero desligaria
   * tudo no primeiro quadro e o jogador acharia que esta quebrado
   */
  const saldo = coins === null || coins === undefined ? null : coins;

  return (
    <section className="inv-panel pocao-panel">
      <nav className="inv-tabs">
        <span className="inv-tab is-active pocao-tab">
          <span className="pocao-tab__icon">⚗</span>

          <small>Mercador</small>

          <i className="pocao-tab__coins">
            {saldo === null ? "—" : `${saldo}`}
          </i>
        </span>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar"
        >
          ✕
        </button>
      </nav>

      <div className="pocao-panel__body">
        <p className="pocao-panel__intro">
          O mercador vende poucoes. A cura vale a pena antes de entrar
          em uma cacada, e nao durante.
        </p>

        {POCOES.map((pocao) => (
          <Linha
            key={pocao.id}
            pocao={pocao}
            saldo={saldo}
            quantidade={quantidade}
            onQuantidade={setQuantidade}
            onBuy={onBuy}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Uma pocao a venda: o icone, o texto, o preco e o botao.
 *
 * Fica separado do `PotionPanel` porque cada linha carrega o PRECO
 * DELA, e nao o preco do painel: com uma pocao so as duas coisas
 * coincidem, e o preco por linha e o que deixa a lista crescer sem
 * este componente saber nada sobre "a proxima pocao"
 */
function Linha({ pocao, saldo, quantidade, onQuantidade, onBuy }) {
  const item = getItem(pocao.id);

  /**
   * O item tem de existir no catalogo de itens.
   *
   * A loja guarda o `id`, e o nome, o icone e a cura vem de la. Um id
   * errado na loja daria uma linha sem nome e sem imagem, e o jogador
   * veria uma linha vazia sem nenhuma pista do erro
   */
  if (!item) return null;

  const total = pocao.preco * quantidade;

  /**
   * O botao esta desligado quando o saldo NAO alcanca.
   *
   * Com o saldo desconhecido (`null`) o botao fica ligado: e melhor
   * deixar o jogador tentar e receber a recusa do servidor do que
   * desabilitar um botao por falta de informacao
   */
  const semSaldo = saldo !== null && saldo < total;

  const empilha = isStackable(item);

  return (
    <article className="pocao-linha">
      <div className="pocao-linha__art">
        <ItemIcon item={item} rarity={item.rarity} />
      </div>

      <div className="pocao-linha__texto">
        <h3 className="pocao-linha__nome">{item.name}</h3>

        <p className="pocao-linha__desc">{pocao.descricao}</p>

        {empilha && (
          <p className="pocao-linha__nota">
            Ocupa um espaço, e quantas quiser na mesma pilha.
          </p>
        )}

        {empilha && (
          <div className="pocao-qtd">
            {[1, POCAO_MAX_POR_COMPRA].map((n) => (
              <button
                key={n}
                type="button"
                className={[
                  "pocao-qtd__btn",
                  quantidade === n ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onQuantidade(n)}
                title={`Comprar ${n}`}
              >
                ×{n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pocao-linha__compra">
        <strong
          className="pocao-linha__preco"
          style={{ color: pocao.corPreco }}
        >
          {total}
        </strong>

        <small className="pocao-linha__unit">
          {quantidade > 1 ? `${pocao.preco} cada` : "moedas"}
        </small>

        <button
          type="button"
          className="pocao-comprar"
          disabled={semSaldo}
          onClick={() => onBuy(pocao.id, quantidade)}
          title={semSaldo ? "Moedas insuficientes" : `Comprar ${item.name}`}
        >
          {semSaldo ? "Sem moedas" : "Comprar"}
        </button>
      </div>
    </article>
  );
}
