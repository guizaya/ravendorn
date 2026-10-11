import { useMemo, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";
import {
  CATEGORIA_INICIAL,
  LOJA_CATEGORIAS,
  MOEDAS_ESPECIAIS,
  pacotesDaCategoria,
} from "../../data/loja/index.js";
import { RARITY_STYLE, getItem } from "../../data/items/index.js";

/**
 * O PAINEL DA LOJA.
 *
 * ## A FORMA: MENU A ESQUERDA, OFERTAS A DIREITA
 *
 * O menu e o QUE e a direita e o QUANTO, e o jogador precisa dos dois ao
 * mesmo tempo: ele troca de categoria para ver preco e compara com o saldo
 * que esta no rodape. Um menu em cima com a grade embaixo faria ele rolar
 * a tela inteira so para ver o que mudou
 *
 * ## POR QUE ABRE NA PRIMEIRA CATEGORIA E NAO EM NENHUMA
 *
 * Porque um menu a esquerda com a direita vazia parece quebrado. O
 * jogador ve cinco botoes e um retangulo vazio, e nao sabe se e bug ou se
 * precisa clicar. `CATEGORIA_INICIAL` e a primeira da lista
 *
 * ## POR QUE "COMPRADO" VEM DE PROP E NAO DE `useState` AQUI
 *
 * Porque o `useState` que existia marcava o pacote como comprado NA TELHA:
 * o card desativava, e nada tinha sido entregue. O jogador via o bau sumir
 * da loja e a mochila igual — e o pior dos dois, porque ele acreditou que
 * tinha comprado
 *
 * O que trocou: `comprados` chega do `snapshot.loja.comprados`, que o
 * servidor preenche. E o servidor so escreve essa lista DEPOIS de cobrar e
 * entregar. Entao "card desativado" e "voce recebeu", pela primeira vez, a
 * mesma frase
 *
 * E o F5 nao desfaz: um estado local sumiria com a pagina, e o jogador
 * pagaria a segunda copia do mesmo bau
 */
export default function LojaPanel({ onClose, comprados = [], onComprar }) {
  const [categoria, setCategoria] = useState(CATEGORIA_INICIAL);

  const pacotes = useMemo(
    () => pacotesDaCategoria(categoria),
    [categoria],
  );

  /**
   * A CATEGORIA QUE ESTA NA TELHA, lida do id.
   *
   * E a busca pelo id e nao o objeto inteiro porque `setCategoria` guarda
   * so o id: um objeto em estado mudaria de identidade a cada render, e o
   * `PacoteCard` receberia uma prop sempre nova e redesenharia inteiro
   */
  const atual = LOJA_CATEGORIAS.find((c) => c.id === categoria);

  return (
    <section className="inv-panel loj-panel">
      <header className="inv-close-row">
        <h2>Loja</h2>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar"
        >
          ✕
        </button>
      </header>

      <div className="loj-panel__grid">
        <nav className="loj-menu" aria-label="Categorias da loja">
          {LOJA_CATEGORIAS.map((c) => {
            const escolhido = c.id === categoria;
            const n = pacotesDaCategoria(c.id).length;

            return (
              <button
                key={c.id}
                type="button"
                className={[
                  "loj-menu__item",
                  escolhido ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setCategoria(c.id)}
                aria-current={escolhido ? "true" : undefined}
                data-tip={c.descricao}
              >
                <span className="loj-menu__icon" aria-hidden="true">
                  {c.icone}
                </span>

                <span className="loj-menu__text">
                  <strong>{c.nome}</strong>

                  {/*
                    A QUANTIDADE DE PACOTES, e nao a DESCRICAO.

                    A descricao cabe no `title` e nao cabe em 190px de
                    largura. E o numero diz o que o jogador precisa antes de
                    clicar: "esta aba tem tres coisas" e uma informacao que
                    ele nao tem antes de entrar
                  */}
                  <small>{n} pacote{n === 1 ? "" : "s"}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="loj-grade">
          <header className="loj-grade__head">
            <h3>{atual?.nome}</h3>
            <p className="loj-grade__desc">{atual?.descricao}</p>
          </header>

          {pacotes.length === 0 ? (
            <p className="loj-grade__vazio">
              Nenhum pacote nesta categoria ainda.
            </p>
          ) : (
            <ul className="loj-grade__lista">
              {pacotes.map((p) => (
                <li key={p.id}>
                  <PacoteCard
                    pacote={p}
                    comprado={comprados.includes(p.id)}
                    onComprar={() => onComprar?.(p.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * UM PACOTE.
 *
 * ## POR QUE A TAG E A PRIMEIRA COISA DO CARD
 *
 * Porque e o que o jogador ve PRIMEIRO, e e o unico dado do catalogo que
 * responde "isso e para mim agora?" sem o jogador ler o nome. Um evento
 * acabando em seis horas com a tag `EVENT` no topo diz tudo que a data
 * embaixo repete — e a data embaixo repete porque o jogador que QUER
 * conferir o horario precisa de um numero, nao de uma etiqueta
 *
 * ## POR QUE O CONTADOR SO APARECE QUEM TEM PRAZO
 *
 * Porque um contador em "99:59" parado e pior do que nenhum: e uma
 * contagem regressiva que nao conta, e o jogador aprende a ignorar todos os
 * outros. O pacote permanente nao mostra nada
 */
function PacoteCard({ pacote, comprado, onComprar }) {
  const itens = pacote.itens ?? [];
  const prazo = prazoRestante(pacote.terminaEmHoras);

  return (
    <article
      className={[
        "loj-pacote",
        pacote.tag ? `is-${pacote.tag}` : "",
        comprado ? "is-comprado" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="loj-pacote__head">
        <h4>{pacote.nome}</h4>

        {pacote.tag && (
          <span className="loj-pacote__tag">{pacote.tag.toUpperCase()}</span>
        )}
      </header>

      {prazo && (
        <p className="loj-pacote__prazo">
          <i aria-hidden="true">◷</i>
          Termina em {prazo}
        </p>
      )}

      {/*
        A "IMAGEM DO BUNDLE".
        *
        E o item mais caro do pacote, em tamanho grande. Nao ha arte de
        pacote no jogo, e um retangulo decorativo seria uma imagem falsa de
        um baú que o jogador nao tem. O item mais caro e o que o jogador
        olha primeiro de qualquer forma — e a raridade dele pinta a borda,
        o que faz o card inteiro dizer a raridade antes do texto
      */}
      <div className="loj-pacote__arte">
        {itens.length === 0 ? (
          <span className="loj-pacote__arte-beneficio" aria-hidden="true">
            ⛊
          </span>
        ) : (
          <ItemGrandeLeading
            pacote={pacote}
            lead={itens.reduce((maisCaro, it) =>
              pesoDe(it) > pesoDe(maisCaro) ? it : maisCaro,
            )}
          />
        )}
      </div>

      {/*
        A LISTA DO QUE VEM DENTRO.
        *
        E `itens.length === 0` que desenha o beneficio como texto, e nao um
        item: um beneficio nao cabe na mochila. A frase vem do `valorReal`
        do catalogo, porque e a descricao do beneficio e nao um preco
      */}
      {itens.length === 0 ? (
        <p className="loj-pacote__beneficio">{pacote.valorReal.texto}</p>
      ) : (
        <ul className="loj-pacote__itens">
          {itens.map((it, i) => (
            <li key={it.itemId + i} className="loj-item">
              {ehMoeda(it.itemId) ? (
                <span
                  className="loj-item__icone"
                  style={{ color: MOEDAS_ESPECIAIS[it.itemId].cor }}
                  aria-hidden="true"
                >
                  {MOEDAS_ESPECIAIS[it.itemId].icone}
                </span>
              ) : (
                <ItemIcon
                  item={getItem(it.itemId)}
                  itemId={it.itemId}
                  rarity={it.rarity ?? null}
                  className="loj-item__icone"
                  alt=""
                />
              )}

              <span className="loj-item__nome">
                {ehMoeda(it.itemId)
                  ? MOEDAS_ESPECIAIS[it.itemId].nome
                  : (getItem(it.itemId)?.name ?? it.itemId)}
              </span>

              <span className="loj-item__qtd">x{it.quantidade}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="loj-pacote__rodape">
        <div className="loj-preco">
          <span className="loj-preco__valor">
            <i aria-hidden="true">◆</i>
            {pacote.preco}
          </span>

{/*
            ## O "VALOR REAL" SUMIU DO CARD

            Era a linha "1.200 de ouro + 40 de steel" embaixo do preco. E
            ela foi embora a loja seja So por diamante: o `◆` e o unico
            preco, e uma segunda moeda escrita ao lado faz o jogador
            procurar onde se troca diamante por ouro. Nao existe essa troca

            ## E O `valorReal` CONTINUA NO CATALOGO

            Ele nao sumiu do `index.js` porque o SERVIDOR le `valorReal.ouro`
            e `valorReal.steel` para entregar as moedas que o bau vale
            (`GameServer.js:1595`). Apagar o campo tiraria do bau a moeda que
            ele promete — o card parou de mostrar, e o bau passou a entregar
            menos. E o ramo do beneficio, mais abaixo, ainda le o `.texto`

            Ou seja: o dado continua, o que parou de existir e a tela
            fingindo que a ouro e steel ainda fossem um preco
          */}
        </div>

        {/*
          O COMPRAR.
          *
            E o `is-comprado` que desliga, e nao o saldo. A loja e paga em
            DIAMANTE — o `◆` do preco acima — e o diamante nao vem de drop:
            nada no jogo produz. Desligar o botao por "saldo insuficiente"
            deixaria a tela repetindo um numero que so existe porque alguem
            escreveu no arquivo de save

            Quem recusa saldo insuficiente e o SERVIDOR, no `comprarProduto`.
            E a resposta certa: o saldo dele e o verdadeiro, e o card nao tem
            como saber
          */}
        <button
          type="button"
          className="loj-pacote__comprar"
          onClick={onComprar}
          disabled={comprado}
        >
          {comprado ? "Comprado" : "Comprar"}
        </button>
      </footer>
    </article>
  );
}

/**
 * O ITEM MAIS CARO, DESENHADO GRANDE.
 *
 * ## POR QUE UM COMPONENTE E NAO SO UM `ItemIcon` DENTRO DO MAP
 *
 * Porque o `rarity` precisa entrar pela prop e o card ja tem o `--rarity`
 * dele — os dois no mesmo lugar, e o `ItemIcon` precisa da arte da
 * RARIDADE que o pacote entrega, que pode ser lendaria num item comum do
 * catalogo
 */
function ItemGrandeLeading({ pacote, lead }) {
  const raridade =
    lead.rarity ?? getItem(lead.itemId)?.rarity ?? null;
  const estilo = RARITY_STYLE[raridade];

  return (
    <span
      className="loj-pacote__lead"
      style={estilo ? { "--rarity": estilo.color } : undefined}
    >
      <ItemIcon
        item={getItem(lead.itemId)}
        itemId={lead.itemId}
        rarity={lead.rarity ?? null}
        alt=""
      />
    </span>
  );
}

/**
 * O ITEM MAIS CARO DO PACOTE, por ORDEM DE RARIDADE e nao por quantidade.
 *
 * Porque a arte grande e "o que chama atencao", e o que chama atencao em
 * um bau e a peca mais rara — nao a pocao comum em quantidade 25. Um bau de
 * 15 pocoes e 25 geles mostrando a pocao na arte grande ensinaria o
 * jogador a ler a arte pelo item mais numeroso
 */
function pesoDe(item) {
  const ordem = ["common", "uncommon", "rare", "epic", "legendary"];
  const raridade =
    item.rarity ?? getItem(item.itemId)?.rarity ?? "common";

  return ordem.indexOf(raridade);
}

/**
 * O TEMPO RESTANTE, como texto.
 *
 * ## POR QUE DIAS E HORAS E NAO MINUTOS
 *
 * Porque o menor prazo do catalogo e de seis horas, e um contador de
 * minutos em "5:59:42" ocupa mais largura do que o card tem para a linha.
 * Com horas, "Termina em 6h" cabe em qualquer card e ainda diz o bastante:
 * o jogador que precisa do minuto exato vem no dia anterior
 *
 * `null` e "nao expira", e o `prazoRestante` devolve `null` para ele — o
 * card decide se mostra a linha, e nao o texto
 */
function prazoRestante(horas) {
  if (horas === null || horas === undefined) return null;

  const total = Math.max(0, Math.floor(horas));

  if (total >= 24) {
    const dias = Math.floor(total / 24);
    const resto = total % 24;

    return resto === 0 ? `${dias}d` : `${dias}d ${resto}h`;
  }

  return `${total}h`;
}

/**
 * O `itemId` E OURO OU STEEL?
 *
 * Sao os dois ids que NAO sao item do catalogo: os dois sao saldo no
 * `Inventory`, e nao pilha na mochila. Sem esta funcao o `ItemIcon` receberia
 * `null` de `getItem` e o card mostraria um espaco vazio onde deveria ter
 * a moeda
 */
function ehMoeda(itemId) {
  return Object.hasOwn(MOEDAS_ESPECIAIS, itemId);
}

/*
  ## `temValorReal` FOI REMOVIDO

  Existia para decidir se a linha de ouro/steel aparecia: eventos sem
  comparacao ("Exclusivo do evento") escondiam o texto, os demais mostravam.
  Sem a linha, a funcao nao tinha o que decidir — e deixar a helper ali seria
  um botao que nao faz nada
*/