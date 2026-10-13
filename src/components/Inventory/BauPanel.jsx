/**
 * `useEffect` NAO ESTA IMPORTADO, e a ausencia e o ponto.
 *
 * Havia um efeito que limpava a selecao quando `inventory` ou `bau`
 * mudavam, e ele era o que fechava o painel na cara do jogador: o servidor
 * reconstroi os dois objetos a cada pacote, entao o efeito rodava umas
 * quatro vezes por segundo. Ver o comentario do `Transferencia`
 */
import { useState } from "react";

import InvSlotView from "../UI/InvSlotView.jsx";
import { getItem } from "../../data/items/index.js";

/**
 * O PAINEL DO BAU DA BASE.
 *
 * ## UM LADO POR VEZ, COMO O COFRE DA GUILDA
 *
 * Este painel mostrava a mochila e o bau lado a lado, com uma seta no meio.
 * Hoje sao duas abas — Guardar e Retirar — e so um lado aparece, que e
 * exatamente o desenho do cofre da guilda (`AbaCofre` + `PainelCofre`):
 * as duas acoes viraram abas, e a grade que estava sempre na tela passou a
 * ser a grade do lado escolhido
 *
 * As duas colunas faziam sentido quando o painel era um arrastar e soltar:
 * o jogador via o destino enquanto segurava a peca. O gesto real e
 * escolher, marcar a quantidade e apertar um botao, e nesse gesto as duas
 * colunas custavam uma largura que nao comprava informacao: com a peca
 * escolhida, o que interessa e "onde ela esta", e a aba ja diz isso no
 * nome. De quebra, a aba de Retirar deixa de ser uma segunda coluna com
 * metade da tela vazia quando o bau esta quase vazio
 *
 * ## O QUE NAO MUDOU
 *
 * `onMover(acao, { uid, quantidade })` continua igual, com o mesmo
 * `depositar` e o mesmo `retirar`, porque quem consome e o motor e ele nao
 * sabe de painel. O campo de quantidade continua vazio significando "a
 * pilha inteira", que e o que o motor le como ausencia
 */

/**
 * UM LADO: o que o jogador ve depois de escolher Guardar ou Retirar.
 *
 * ## POR QUE UM COMPONENTE E NAO DOIS
 *
 * Porque e o MESMO formulario nos dois sentidos, e o que muda e de onde vem
 * a lista. Duas copias divergiriam na primeira regra que alguem mudar, e a
 * divergencia seria "guardar funciona mas retirar nao" — que e o defeito
 * mais caro de achar, porque so aparece depois que o jogador ja usou o
 * bau
 *
 * ## O ESTADO ESTA AQUI, E O `key` NO CHAMADOR FAZ A TROCA LIMPA
 *
 * A selecao e a quantidade sao locais a este componente. Com um `key` no
 * `lado`, o React remonta o componente ao trocar de aba, e o item marcado
 * de "Guardar" nao vaza para "Retirar" — o jogador veria "Osso Amaldicoado
 * (5)" selecionado do outro lado, num item que nem esta na tela
 *
 * E `key` resolve tambem o problema antigo do `useEffect`: nao ha efeito
 * para limpar a selecao quando `inventory` muda, porque a selecao e
 * procurada na lista do lado, e se a peca sumiu de la o jogador nao tem
 * mais nada marcado. O servidor pode reconstruir os dois objetos a cada
 * pacote que quiser
 */
function Transferencia({
  lado,
  titulo,
  dica,
  itens,
  conta,
  cheio,
  vazio,
  onMover,

  /**
   * COMO MONTAR O PEDIDO, quando o chamador usa um nome de campo diferente.
   *
   * O bau da base pede `uid`, e o cofre da guilda pede `item` no deposito.
   * Sem este campo o `enviar` assumia `uid` sempre, e o deposito no cofre
   * era recusado como `cofreInvalido`
   *
   * Ausente, o padrao e `{ uid, quantidade }` — que e o que o bau da base
   * quer e o que todo painel novo recebe sem mudar nada
   */
  montarItem,
}) {
  const [escolha, setEscolha] = useState(null);

  /**
   * A QUANTIDADE, como texto e nao como numero.
   *
   * Porque o campo aceita digitos enquanto o jogador digita: um
   * `Number("")` e `0`, e o `"0"` no meio da digitacao travaria o `input`
   * no primeiro `backspace`. A conversao para numero acontece no envio, e
   * um campo vazio e o pedido de "a pilha inteira"
   */
  const [quantidade, setQuantidade] = useState("");

  /**
   * A PECA ESCOLHIDA.
   *
   * E o `uid` e nao o `itemId` por causa do par: a mesma peca pode estar na
   * mochila E no bau ao mesmo tempo — o jogador depositou uma e ainda tem
   * outra. Com o `itemId` a aba errada marcaria a pilha errada
   *
   * A busca acontece na lista do lado aberto. Se a peca nao esta mais la —
   * o servidor confirmou o deposito e ela sumiu da mochila — o `achado` e
   * `null` e a barra de acao some. A peca que saiu de verdade tira a barra
   * sozinha, que e o que tem que acontecer
   */
  const achado =
    itens.find((entrada) => entrada.uid === escolha) ?? null;

  const nomeDaPeca = achado
    ? (getItem(achado.itemId)?.name ?? achado.itemId)
    : null;

  const enviar = () => {
    if (!achado || !onMover) return;

    const texto = quantidade.trim();
    const numero = texto === "" ? undefined : Number(texto);

    if (numero !== undefined && (!Number.isFinite(numero) || numero < 1)) {
      return;
    }

    /**
     * O NOME DO CAMPO E DE QUEM CHAMA.
     *
     * O `montarItem` existe para isso: o bau da base pede `uid`, e o cofre
     * da guilda pede `item` no deposito e `uid` no saque. Sao nomes
     * diferentes para a MESMA informacao porque quem decide o sentido do
     * pedido e o servidor, e ele le um ou o outro
     *
     * Antes o `enviar` montava `{ uid }` direto e o `montarItem` ficava
     * declarado e sem uso. O bau da base funcionava — ele quer `uid` — e o
     * deposito de item no cofre da guilda era recusado com
     * `cofreInvalido`, porque chegava `uid` onde o servidor esperava `item`
     */
    const dados = montarItem
      ? montarItem(escolha, numero)
      : { uid: escolha, quantidade: numero };

    onMover(lado, dados);

    setQuantidade("");
    setEscolha(null);
  };

  return (
    <section className="bau-lado">
      {/*
        O CABECALHO: o que esta sendo feito, de onde vem e para onde vai,
        e quantos slots o lado esta usando.

        A dica e o que substitui a seta do meio do desenho antigo. Com as
        duas colunas visiveis, o "> " era o que dizia o sentido do gesto;
        com uma aba so, o texto tem de dizer, porque o nome da aba diz a
        acao mas nao o caminho
      */}
      <header className="bau-lado__topo">
        <span className="eyebrow">{titulo}</span>

        <span
          className={cheio ? "bau-lado__conta is-full" : "bau-lado__conta"}
        >
          {conta}
        </span>
      </header>

      <p className="bau-lado__dica">{dica}</p>

      {itens.length === 0 ? (
        <p className="inv-panel__empty">{vazio}</p>
      ) : (
        <div className="inv-grid bau-lado__grade">
          {itens.map((entrada) => {
            const id = entrada.uid;

            return (
              <div key={id} className="inv-cell">
                <InvSlotView
                  entry={{
                    uid: id,
                    itemId: entrada.itemId,
                    rarity: entrada.rarity,
                    count: entrada.count,
                    enchant: entrada.enchant ?? null,
                    enhance: entrada.enhance ?? 0,
                  }}
                  selected={escolha === id}
                  onSelect={() => {
                    setEscolha(escolha === id ? null : id);
                    setQuantidade("");
                  }}
                />

                <span className="inv-cell__name">
                  {getItem(entrada.itemId)?.name ?? entrada.itemId}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/*
        A BARRA DE ACAO, que so existe com uma peca escolhida.

        ## POR QUE NAO UM BOTAO EM CADA SLOT

        Porque a acao tem TRES estados que dependem do que e da mochila e do
        que e do espaco: guardar cabe, retirar cabe, e a quantidade. Um
        botao por slot repetiria a mesma decisao 40 vezes na tela e o
        jogador teria de ler uma delas para saber se pode agir nas outras

        E por isso que o botao fica numa barra so: ele pertence a ESCOLHA,
        nao a peca
      */}
      {achado && (
        <footer className="bau__acao">
          <span className="bau__escolhido">
            {nomeDaPeca}
            {" ("}
            {achado.count}
            {")"}
          </span>

          <input
            className="bau__campo"
            type="number"
            min="1"
            max={achado.count}
            value={quantidade}
            placeholder="tudo"
            onChange={(evento) => setQuantidade(evento.target.value)}
            aria-label={`Quantidade de ${nomeDaPeca}`}
          />

          <button
            type="button"
            className="bau__botao"
            onClick={enviar}
            disabled={!onMover}
          >
            {lado === "depositar" ? "Guardar" : "Retirar"}
          </button>
        </footer>
      )}
    </section>
  );
}

export default function BauPanel({
  inventory = null,
  bau = null,
  onMover = null,

  /**
   * COMO MONTAR O PEDIDO, E POR QUE AQUI ELE E `null`.
   *
   * ## POR QUE ESTE PROP PRECISAVA EXISTIR
   *
   * Porque o `Transferencia` passa `montarItem` para o `enviar`, e o
   * `BauPanel` repassava a referencia SEM nunca declara-la. O `montarItem`
   * saia do componente como `ReferenceError: montarItem is not defined` —
   * e nao no clique, e na hora de ABRIR o painel, porque o JSX e avaliado
   * no render. Um painel de bau inteiro fora da tela por causa de uma
   * variavel de um caractere
   *
   * ## E POR QUE O PADRAO E `null`, E NAO UMA FUNCAO
   *
   * Porque o bau da base pede `uid`, e o `Transferencia` ja cai em
   * `{ uid, quantidade }` quando o prop vem ausente. Declarar o prop resolve
   * o erro sem inventar comportamento: nenhum chamador precisa passar nada
   *
   * O `null` como padrao, e nao uma funcao que monta `{ uid }`, e para o
   * `Transferencia` continuar sendo quem decide o formato — e porque quem
   * precisa do outro nome (`item`, no cofre da guilda) passa a funcao dele
   * por conta propria
   */
  montarItem = null,
  onClose,
}) {
  const [lado, setLado] = useState("depositar");

  const contaMochila = `${inventory?.used ?? 0}/${inventory?.capacity ?? 0}`;

  const contaBau = `${bau?.used ?? 0}/${bau?.capacity ?? 0}`;

  return (
    <section className="inv-panel pocao-panel bau" aria-label="Baú">
      <nav className="inv-tabs">
        <span className="inv-tab is-active pocao-tab">
          <span className="pocao-tab__icon">▣</span>
          <small>Baú</small>
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

      {/*
        AS DUAS ABAS DO GESTO, e nao duas colunas.

        E o mesmo desenho do cofre da guilda, com `role="tablist"` e
        `aria-selected` porque sao abas de verdade e nao dois botoes
        decorados: o leitor de tela tem que anunciar qual lado esta aberto,
        senao ele anuncia "Guardar, botao" e "Retirar, botao" sem dizer qual
        dos dois age

        Os valores sao os mesmos que o motor recebe em `onMover` —
        `depositar` e `retirar` — e nao "guardar" e "retirar": quem consome
        o pedido e o motor, e ele nao sabe de painel. O texto da aba e o
        verbo do jogador, e o valor do estado e o termo do servidor
      */}
      <div className="bau__abas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={lado === "depositar"}
          className={[
            "bau__aba",
            lado === "depositar" ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setLado("depositar")}
        >
          Guardar
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={lado === "retirar"}
          className={[
            "bau__aba",
            lado === "retirar" ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setLado("retirar")}
        >
          Retirar
        </button>
      </div>

      {/*
        O `key` E O QUE TROCA UM LADO LIMPO.

        Sem ele o React reaproveita a instancia do `Transferencia` entre as
        abas, e a peca marcada em "Guardar" continuaria marcada em
        "Retirar" — inclusive com o campo de quantidade preenchido
      */}
      <Transferencia
        key={lado}
        lado={lado}
        titulo={lado === "depositar" ? "Guardar" : "Retirar"}
        dica={
          lado === "depositar"
            ? "Da mochila para o baú"
            : "Do baú para a mochila"
        }
        itens={lado === "depositar" ? (inventory?.items ?? []) : (bau?.items ?? [])}
        conta={lado === "depositar" ? contaMochila : contaBau}
        cheio={
          lado === "depositar"
            ? Boolean(inventory?.isFull)
            : Boolean(bau?.isFull)
        }
        vazio={
          lado === "depositar"
            ? "A mochila está vazia."
            : "Nada guardado ainda."
        }
        onMover={onMover}
        montarItem={montarItem}
      />
    </section>
  );
}