import { useMemo, useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import {
  POCAO_MAX_POR_COMPRA,
  POCOES,
  pocaoLiberada,
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
 * Nem o preco, nem se cabe na mochila, nem se o saldo basta, nem se o
 * nivel abre a linha. Tudo isso e do servidor, e o painel so DESENHA o
 * catalogo e manda o `itemId` e a quantidade. O preco que aparece na
 * tela vem do catalogo, e e o mesmo numero que o servidor cobra — mas e
 * o servidor que cobra, e nao este numero
 *
 * O botao fica desligado quando o saldo nao alcanca ou quando a linha
 * esta trancada por nivel, e isso e conveniencia, e nao seguranca: um
 * cliente ignorando o `disabled` receberia a recusa do servidor de
 * qualquer jeito
 *
 * ## O CARD E O MESMO DO MESTRE
 *
 * `pocao-linha`, `pocao-linha__art`, `__preco`, `__unit` e
 * `pocao-comprar` sao as mesmas classes do `HabilidadesPanel`. Os dois
 * paineis sao a mesma vitrine com conteudo diferente, e refazer o card
 * aqui criaria duas linhas de loja com espacamento, sombra e ritmo
 * diferentes na mesma tela
 */


/** o panel aguenta `coins` indefinido enquanto o primeiro pacote nao chega */
const VAZIO = {
  coins: 0,
};

export default function PotionPanel({
  coins = null,
  level = null,
  onBuy,
  onClose,
}) {
  const [quantidade, setQuantidade] = useState(1);

  /**
   * O saldo, ou `null` enquanto nao chegou.
   *
   * `null` e DIFFERENTE de `0`: com o saldo desconhecido o painel mostra
   * "—" no lugar do preco e nao desliga nenhum botao, porque nao ha
   * informacao para desabilitar. Tratar `null` como zero desligaria
   * tudo no primeiro quadro e o jogador acharia que esta quebrado
   */
  const saldo = coins === null || coins === undefined ? null : coins;

  /**
   * O nivel do jogador, ou `null` enquanto nao chegou.
   *
   * O mesmo tratamento do saldo, e pelo mesmo motivo: com o nivel
   * desconhecido nenhuma linha fica trancada, porque nao ha informacao
   * para trancar. A trava real acontece no servidor, e este numero so
   * evita o jogador descobrir ela tentando
   */
  const nivel = level === undefined ? null : level;

  /**
   * A ORDEM DA VITRINE, E POR QUE ELA E AQUI E NAO NO CATALOGO
   *
   * O `POCOES` e a ordem do MERCADOR — a ordem em que as pocoes estao no
   * mundo, e ela nao muda com o jogador. Reordenar o catalogo para caber
   * numa tela resolveria o problema de um jogador e bagunçaria o dado de
   * todos os outros, alem de mexer na ordem que o `POCA_IDS` publica
   *
   * E o que muda com o jogador e a ORDEM NA TELHA. Por isso a conta e
   * aqui, num `useMemo`, e o catalogo fica intocado
   *
   * ## TRANCADA VAI PARA O FIM, E SO TRANCADA
   *
   * O unico criterio e a trava de nivel. "Sem moedas" NAO entra na conta
   * de proposito: sem moedas e um estado que muda a cada compra, e
   * ordenar por ele faria a vitrine inteira pular de lugar enquanto o
   * jogador gasta. E o preco, nao a disponibilidade, que diria "voce
   * pode, mas nao hoje"
   *
   * ## POR QUE A TRAVA E CALCULADA AQUI E PASSADA PARA A LINHA
   *
   * Porque a ordem e o desenho precisam concordar sobre a mesma frase.
   * Se cada um chamasse `pocaoLiberada` por conta propria, bastava o
   * nivel chegar entre a conta e o desenho para uma linha trancada
   * aparecer no grupo de cima. Calculando uma vez e descendo o resultado,
   * os dois lados sao o mesmo objeto por construcao
   */
  const linhas = useMemo(
    () =>
      POCOES.map((pocao, ordem) => ({
        pocao,
        ordem,
        trava: pocaoLiberada(nivel, pocao),
      })).sort((a, b) => {
        if (a.trava.ok !== b.trava.ok) return a.trava.ok ? -1 : 1;

        // desempate pela ordem do catalogo, e nao pelo preco: duas
        // pocoes do mesmo grupo continuam na ordem em que o mercador as
        // lista, e nao por menor preco
        return a.ordem - b.ordem;
      }),
    [nivel],
  );


  return (
    <section className="inv-panel pocao-panel">
      <nav className="inv-tabs">
        <span className="inv-tab is-active pocao-tab">
          <span className="pocao-tab__icon">⚗</span>
          <small>Mercador</small>
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
          O mercador vende consumiveis. A cura vale a pena antes de
          entrar em uma cacada, e nao durante; o pergaminho e para
          quando o caminho ate o destino ja esta longo demais.
        </p>

        {/*
          A ORDEM DA VITRINE: o que da para comprar primeiro.

          Ver `linhas`, mais acima. O que importa e que a lista e
          recalculada quando o nivel muda e nao quando o preco muda
        */}
        {linhas.map(({ pocao, trava }) => (
          <Linha
            key={pocao.id}
            pocao={pocao}
            trava={trava}
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
 *
 * ## POR QUE ELA RECEBE A TRAVA E NAO O NIVEL
 *
 * Porque quem chama `pocaoLiberada` e o painel, uma vez, e o resultado
 * desce pronto. E o que garante que a posicao da linha na vitrine e o
 * desenho dela concordem: se esta chamasse a funcao de novo, os dois
 * lados seriam contas separadas sobre o mesmo numero
 */
function Linha({ pocao, trava, saldo, quantidade, onQuantidade, onBuy }) {
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

  /**
   * A TRAVA, calculada pelo painel e descida aqui.
   *
   * O `motivo` e o mesmo texto que o servidor manda no aviso de recusa,
   * e ele aparece no `title` do botao. Uma segunda traducao aqui
   * divergiria do servidor na primeira edicao
   *
   * A linha continua DESENHADA, com nome, arte e descricao. E o mesmo
   * tratamento do card "Aprendida" do Mestre: o jogador precisa ver o
   * que ainda nao tem para saber o que vem depois
   */
  const trancada = !trava.ok;

  const empilha = isStackable(item);

  /**
   * O ROTULO E O MOTIVO DO BOTAO.
   *
   * Tratar "trancada" como "sem moedas" diria ao jogador que o problema
   * e o saldo, que e uma coisa que ele resolve descendo de mob — e a
   * verdade e que so se resolve subindo de nivel. Sao problemas
   * diferentes e o texto precisa diferenciar os dois
   *
   * A prioridade e do nivel primeiro, porque e o que nao muda com o
   * tempo da partida: quem nao tem nivel suficiente nao vai ter moedas
   * por muito tempo mesmo
   *
   * O `motivoBotao` da linha trancada nunca chega no botao ligado, entao
   * o `Comprar ${item.name}` so existe no caminho liberado
   */
  const rotuloBotao = trancada
    ? "Trancada"
    : semSaldo
      ? "Sem moedas"
      : "Comprar";

  const motivoBotao = trancada
    ? trava.motivo
    : semSaldo
      ? "Moedas insuficientes"
      : `Comprar ${item.name}`;

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
                data-tip={`Comprar ${n}`}
              >
                ×{n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/*
        O BLOCO DA COMPRA TEM DOIS ESTADOS, E O SEGUNDO E O PADRAO DO JOGO

        A linha trancada troca o preco pela marca do estado, e e
        exatamente o que o card do Mestre faz com "Aprendida": um
        `<strong>` com o glifo, um `<small>` com a palavra do estado e um
        botao desligado com o estado no rotulo

        ## POR QUE O PRECO SOME

        Porque numero de preco e um convite. Um "250" em dourado ao lado
        de um botao cinza diz "isto aqui custa 250 e voce nao pode", e o
        jogador guarda a primeira metade. Trocado pelo numero do nivel, o
        bloco diz a outra coisa: "a 11 voce compra"

        ## POR QUE O `✕` E NAO UM CADEADO

        E o glifo que o projeto ja usa para trancado, no
        `skill-slot__lock`. Um emoji de cadeado viria na propria
        codificacao da fonte e apareceria colorido ou quadrado no meio
        dos numeros da coluna

        ## POR QUE O NIVEL NO `small` E O MOTIVO NO `title`

        O `small` e o que se le sem passar o mouse, e precisa caber em
        duas palavras: "nivel 11". A frase completa vive no `title`, que
        vem do mesmo `motivo` que o servidor manda — duas tradicoes do
        mesmo texto divergiriam na primeira edicao
      */}
      <div className="pocao-linha__compra">
        {trancada ? (
          <>
            {/*
              A COR DO GLIFO, E POR QUE ESTA E NAO OUTRA

              Este e o mesmo `#6b7486` que o `.pocao-comprar:disabled`
              usa nesta mesma folha, e a escolha e essa: o glifo e o botao
              estao dizendo a mesma coisa — "voce nao compra esta linha" —
              e quando os dois usam cores diferentes a linha fica com
              tres tons de cinza competindo, sem que nenhum deles seja o
              estado

              A primeira versao deste card usava `#b9c4d4`, que nao
              aparecia em lugar nenhum do projeto. Uma cor que so existe
              num lugar e sempre o primeiro sinal de que o padrao ali foi
              furado

              E e `inline` por causa do card do Mestre: la o "Aprendida"
              tambem e `style={{ color }}`, e os dois cards sao a mesma
              vitrine. Um por classe e o outro por inline os deixaria
              igual no desenho e diferente no codigo
            */}
            <strong
              className="pocao-linha__preco"
              style={{ color: "#6b7486" }}
            >
              ✕
            </strong>

            <small className="pocao-linha__unit">
              nível {pocao.nivelMinimo}
            </small>

            <button
              type="button"
              className="pocao-comprar"
              disabled
              data-tip={motivoBotao}
            >
              {rotuloBotao}
            </button>
          </>
        ) : (
          <>
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
              data-tip={motivoBotao}
            >
              {rotuloBotao}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
