import { useMemo, useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import {
  PASSES,
  PASSE_PADRAO,
  PASSE_PREMIUM_DIAMANTES,
  estadoDoDia,
  ESTADO_TEXTO,
  pontosDoPasse,
} from "../../data/passes/index.js";
import { getItem, RARITY_STYLE } from "../../data/items/index.js";
import { useArrastarScroll } from "../../game/ui/arrastarScroll.js";

/**
 * O PAINEL DE PASSE.
 *
 * ## A FORMA: LISTA A ESQUERDA, TRILHA A DIREITA
 *
 * A lista e a CHAVE e a trilha e a CONTEUDO, e as duas sao o que o jogador
 * precisa ver ao mesmo tempo: qual evento ele escolheu e o que tem nesse.
 * Uma lista em cima com a trilha embaixo faria o jogador rolar a tela
 * inteira para comparar dois passes, e comparar e a razao de haver mais de
 * um
 *
 * ## POR QUE O PRIMEIRO PASSE ABRE SELECIONADO
 *
 * Porque um painel de passe com a lista a esquerda e a direita vazia parece
 * quebrado: o jogador ve seis botoes e um retangulo escuro, e nao sabe se
 * e para clicar em algum. `PASSE_PADRAO` resolve isso sem estado — e o
 * primeiro da lista, que e o evento mais recente na ordem em que foram
 * escritos
 *
 * ## POR QUE O ESTADO E DO PAINEL E NAO DO SERVIDOR
 *
 * Porque nao ha servidor de passe ainda, e um resgate que finge ter dado o
 * item seria pior que um resgate que nao existe: o jogador veria o dia
 * virar "resgatado" e o item nao apareceria na mochila. O `useState` marca
 * o dia como pego NA TELHA, e o dia seguinte em que isso virar protocolo e
 * ele sai daqui sem mudar nada no que o jogador ve
 */
export default function PassePanel({ estado, onClaim, onPremium, onClose }) {
  /**
   * O ESTADO NAO E LOCAL.
   *
   * ## POR QUE O `useState` DE RESGATE SUMIU
   *
   * Porque resgate e um item que o jogador JA TEM na mochila, e nao um
   * desenho da tela. Com estado local, fechar o painel apagava a lista e o
   * jogador resgatava o dia 3 de novo toda vez que abria — e ganhava o
   * mesmo item quantas vezes quisesse
   *
   * E o motor da tela nao resolvia: online quem paga e o servidor, entao o
   * clique no `useState` da tela marcava o dia e nao entregava nada
   *
   * ## E POR QUE O PREMIUM TAMBEM VEIO DE FORA
   *
   * Porque `premium` decide QUEM pode resgatar. Se ele fosse local, o painel
   * desenharia "Resgatar" num dia premium e o servidor recusaria o clique: o
   * botao apareceria, o jogador apertaria, e nada aconteceria
   *
   * ## E O QUE ACONTECE ANTES DO PRIMEIRO SNAPSHOT
   *
   * O `estado` chega `undefined` ate o servidor responder, e o `?? {}` com o
   * `?? []` segura: sem isso o painel abriria quebrado no primeiro quadro
   */
const resgatadosPorPasse = estado?.resgatados ?? {};

  const [passId, setPassId] = useState(PASSE_PADRAO.id);

  /**
  * O PREMIUM E DO PASSE QUE ESTA ABERTO, e nao do painel.
  *
  * O estado virou `{ praga: true, cripta: true }`: o premium e uma compra por
  * passe, e 100 diamantes pagam UM passe. Ler `estado?.premium === true`
  * devolveria `false` para sempre — o valor agora e um objeto — e o
  * interruptor apareceria desligado mesmo com o passe pago
  *
  * E o MESMO formato do `resgatados` logo acima, que ja era mapa por passe.
  * Os dois campos respondem "o que o jogador fez com este passe", e ler um
  * como booleano e o outro como objeto obrigaria o painel a saber dois
  * formatos para a mesma pergunta
  *
  * A leitura vem DEPOIS do `passId` do `useState`: antes dela, `passId`
  * ainda nao existiria e o acesso daria `undefined` — que leria como
  * "passe nao pago" no primeiro quadro, com o passe correto aberto
  */
const premiumPorPasse = estado?.premium ?? {};
const premiumAtivo = premiumPorPasse[passId] === true;

  /**
   * OS DOIS ARRESTOS, COM O MESMO HOOK.
   *
   * A trilha e horizontal e a lista e vertical, mas as duas sao "um container
   * com conteudo maior que ele". O hook descobre o eixo sozinho pelo
   * `scrollWidth` contra `clientWidth`, entao a lista que vira barra
   * horizontal no `@media` de tela estreita passa a arrastar na direcao
   * certa sozinha, sem nenhum codigo de "qual eixo estou" espalhado pelo
   * painel
   */
  const trilha = useArrastarScroll();
  const lista = useArrastarScroll();

  const passe = PASSES.find((p) => p.id === passId) ?? PASSE_PADRAO;

  const meus = resgatadosPorPasse[passe.id] ?? [];
  const pontos = pontosDoPasse(passe);

  /**
   * O ULTIMO DIA, separado da trilha rolavel.
   *
   * Ele fica FORA do container que rola porque e o premio que o jogador
   * passou catorze dias tentando ver. Se ele entrasse na rolagem, estaria
   * na ponta de uma lista que so aparece quando o jogador chega no fim —
   * e a maioria abre o passe no dia 1 e nunca ve a recompensa final
   */
  const diaFinal = passe.dias[passe.dias.length - 1];
  const diasRolaveis = useMemo(
    () => passe.dias.slice(0, -1),
    [passe],
  );

  /**
   * O CLIQUE DE RESGATAR.
   *
   * E SO UM PEDIDO. O `if` nao esta aqui para impedir o resgate duplo — a
   * trava de verdade esta no servidor, que confere a lista antes de pagar. O
   * `if` existe so para o botao nao virar uma maquina de pedir: entre o
   * clique e o snapshot voltar, o dia ainda aparece como `disponivel`, e sem
   * isso o jogador clicaria duas vezes no mesmo tique
   *
   * ## E POR QUE NAO HAI OTIMISMO AQUI
   *
   * Porque marcar o dia na hora da resposta seria mentir para o servidor:
   * se ele recusar — dia ainda nao chegou, premium desligado, mochila cheia —
   * o painel teria que desfazer. O unico lugar que decide e o motor, entao o
   * painel so espera o snapshot
   */
  const resgatar = (dia) => {
    if (meus.includes(dia.dia)) return;

    onClaim?.(passe.id, dia.dia);
  };

  return (
    <section className="inv-panel pss-panel">
      <header className="inv-close-row">
        <h2>Passe</h2>

        {/*
          O X NO FIM DA LINHA.

          O `margin-left: auto` que o joga para a direita so vale para o
          ultimo filho. Nos paineis em que o botao era o primeiro ele abria
          a ESQUERDA do titulo — ao contrario do bestiario, da colecao e das
          missoes. Mesmo painel, mesmo lugar do X
        */}
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar"
        >
          ✕
        </button>
      </header>

      <div className="pss-panel__grid">
        {/*
          A LISTA DE PASSES, rolavel na vertical.

          O `overflow-y` e o que mantem a lista do tamanho da janela mesmo
          com seis passes: sem ele o painel esticava para baixo e a janela
          ficava sem rolagem util. A barra fica visivel de proposito —
          `scrollbar` sem estilo some em alguns navegadores, e o jogador
          perde a unica pista de que tem mais passes embaixo
        */}
        <nav
          className="pss-list"
          aria-label="Passes"
          ref={lista.ref}
          {...lista.evento}
        >
          <ul className="pss-list__items">
            {PASSES.map((p) => {
              const escolhido = p.id === passe.id;
              const prog = pontosDoPasse(p);

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={[
                      "pss-list__item",
                      escolhido ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setPassId(p.id)}
                    aria-current={escolhido ? "true" : undefined}
                  >
                    {/*
                      O ICONE DO PASSE, e nao o `❖` da prateleira.

                      O `❖` e o que identifica o PASSE como categoria — ele
                      diz "existe passe". Cada passe precisa do seu icone
                      para dizer QUAL: `⌇` rata, `☗` osso, `🏹` arco. E o
                      emoji do arco e de proposito aqui, porque nesta lista
                      os icones sao ilustracoes grandes e nao os circulos
                      pequenos da prateleira, onde um emoji colorido
                      destoaria
                    */}
                    <span className="pss-list__icon" aria-hidden="true">
                      {p.icone}
                    </span>

                    <span className="pss-list__text">
                      <strong>{p.nome}</strong>
                      <small>{p.origem}</small>
                    </span>

                    {/*
                      A MARQUINHA DO DIA, e nao a barra de progresso.

                      Na lista cabe um numero, e nao cabe uma barra: sete
                      barras de 20px empilhadas viram um muro listrado que
                      o jogador nao le. O "6/14" diz o mesmo que uma barra
                      de 43% em tres caracteres, e o jogador le os tres
                    */}
                    <span className="pss-list__day">
                      {p.diaAtual}/{p.totalDias}
                    </span>

                    {/*
                      A FAIXA DE FUNDO e a barra de progresso do passe
                      escolhido. E a unica barra da lista, e so na ultima
                      linha dela: e a leitura do item selecionado, nao de
                      todos. `aria-hidden` porque o numero ao lado ja diz
                      o mesmo para o leitor de tela
                    */}
                    {escolhido && (
                      <span
                        className="pss-list__fill"
                        style={{ width: `${prog.percentual}%` }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="pss-main">
          <header className="pss-main__head">
            <div className="pss-main__title">
              <h3>{passe.nome}</h3>
              <p className="pss-main__desc">{passe.descricao}</p>
            </div>

            {/*
              A BARRA DE PONTOS.

              O numero vai como `600 / 1400` e nao como "43%": o jogador
              precisa saber quantos pontos FALTAM, e o percentual e o que ele
              teria de converter de cabeca para descobrir
            */}
            <div className="pss-prog">
              <div className="pss-prog__nums">
                <b>{pontos.feitos}</b>
                <span>/ {pontos.total} pontos</span>
                <small>{pontos.diasRestantes} dias restantes</small>
              </div>

              <div
                className="pss-prog__bar"
                role="progressbar"
                aria-valuenow={pontos.feitos}
                aria-valuemin={0}
                aria-valuemax={pontos.total}
                aria-label="Progresso do passe"
              >
                <span
                  className="pss-prog__fill"
                  style={{ width: `${pontos.percentual}%` }}
                />
              </div>
            </div>
          </header>

          {/*
            A TRILHA: DIAS 1 A 13 ROLAVEIS, DIA 14 FIXO.

            O dia final fica FORA do `pss-track__roll` de proposito. Se ele
            entrasse na rolagem, estaria na ponta de uma lista que so
            aparece quando o jogador chega no fim — e a maioria abre o passe
            no dia 1. Aqui ele e irmao da rolagem e nao filho dela, entao a
            rolagem do container nunca o arrasta
          */}
          <div className="pss-track">
            <div
              className="pss-track__roll"
              ref={trilha.ref}
              {...trilha.evento}
            >
              {diasRolaveis.map((dia) => (
                <DiaCard
                  key={dia.dia}
                  dia={dia}
                  estado={estadoDoDia(dia, {
                    resgatado: meus.includes(dia.dia),
                    premiumAtivo,
                    diaAtual: passe.diaAtual,
                  })}
                  onResgatar={() => resgatar(dia)}
                />
              ))}
            </div>

            {diaFinal && (
              <DiaCard
                dia={diaFinal}
                estado={estadoDoDia(diaFinal, {
                  resgatado: meus.includes(diaFinal.dia),
                  premiumAtivo,
                  diaAtual: passe.diaAtual,
                })}
                onResgatar={() => resgatar(diaFinal)}
                final
              />
            )}
          </div>

          {/*
            O BOTAO DE ATIVAR, DEPOIS DA TRILHA.

            ## E ELE SUME QUANDO O PASSE ESTA ATIVO

            Porque o premium e uma COMPRA, e uma compra nao tem botao de
            desfazer. O painel offering "Desligar passe" depois de cobrar os
            100 diamantes seria convidar o jogador a tocar no botao sem
            querer — e o motor aceitaria, porque desligar e de graca, e o
            jogador perderia os dias pagos sem nenhum aviso

            Some inteiro, e nao vira texto "Ativo": um texto ali seria uma
            confirmacao de que algo aconteceu la, e o que importa depois do
            pagamento sao os cards da trilha — que abrem sozinhos

            ## POR QUE ELE SAIU DA HEADER

            Porque na header ele disputava o X com o titulo, e o jogador lia
            "Passe | Premium 100 ◆ | ✕" como tres coisas sem relacao. O preco
            e a MESMA informacao para todo passe, entao ele nao pertencia ao
            cabecalho do painel: agora ele fica embaixo da trilha rolavel,
            que e a unica regiao da tela que pertence ao passe aberto

            ## E O PRECO ACIMA DO BOTAO, E NAO AO LADO NEM DENTRO

            Porque o preco e a CONDICA da acao, e condicoes se leem antes:
            quanto custa, e so depois o que se clica. Na mesma linha os dois
            viram uma frase so — "Ativar passe 100" — e o numero gruda no
            rotulo. Acima, o olho pega o valor, desce, e encontra o botao ja
            com o valor na memoria
          */}
          {!premiumAtivo && (
            <div className="pss-activate">
              <span className="pss-activate__price">
                {PASSE_PREMIUM_DIAMANTES} ◆
              </span>

              <button
                type="button"
                className="pss-activate__btn"
                onClick={() => onPremium?.(true, passId)}
                data-tip={`Ativar o premium deste passe por ${PASSE_PREMIUM_DIAMANTES} diamantes`}
              >
                Ativar passe
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * UM DIA DA TRILHA.
 *
 * ## POR QUE O CARD SABE O QUE O DIA E, E O PAINEL NAO PASSA O NOME
 *
 * Porque o nome do item tem que vir do CATALOGO, e o catalogo e o unico
 * lugar onde o nome existe. Passar `nome` pelo painel seria copiar o
 * catalogo para dentro do painel, e a copia envelhece: o item muda de nome
 * no catalogo e o passe continua mostrando o nome velho
 *
 * ## POR QUE O CARD TEM UM `title` COM TUDO
 *
 * Porque o card e pequeno e o nome do item nao cabe. `Poção Grande` em 96px
 * de largura vira tres linhas de 10px e empurra o numero do dia para fora.
 * O nome completo fica no `title`, e o `title` tambem diz o ESTADO — que e
 * a informação que o jogador mais precisa e a que nao cabe em lugar nenhum
 */
function DiaCard({ dia, estado, onResgatar, final = false }) {
  const item = getItem(dia.itemId);
  const raridade = RARITY_STYLE[dia.rarity] ?? RARITY_STYLE[item?.rarity];
  const resgatado = estado === "resgatado";
  const podeResgatar = estado === "disponivel";

  const nomeItem = item?.name ?? dia.itemId;

  const title = [
    `Dia ${dia.dia}`,
    nomeItem,
    dia.rarity ? raridade?.label : null,
    `x${dia.quantidade}`,
    dia.premium ? "premium" : "gratuito",
    ESTADO_TEXTO[estado],
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <article
      className={[
        "pss-day",
        `is-${estado}`,
        dia.premium ? "is-premium" : "is-free",
        final ? "pss-day--final" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={raridade ? { "--rarity": raridade.color } : undefined}
    >
      <header className="pss-day__head">
        <span className="pss-day__num">Dia {dia.dia}</span>

        {/*
          A FAIXA DE FREE OU PREMIUM, sempre visivel e nunca no lugar do
          estado. Sao informacoes diferentes: o dia 7 pode ser premium e
          bloqueado, premium e disponivel, free e resgatado. Uma cor so
          teria que escolher entre as duas, e a que se perde e a do resgate
        */}
        <span className="pss-day__track">
          {dia.premium ? "Premium" : "Free"}
        </span>
      </header>

      {/*
        O ITEM, com a arte do catalogo e na raridade do DIA.

        A raridade entra pela prop e nao pelo `item.rarity`: `peito_warrior`
        e comum no catalogo e o dia 14 o entrega lendario. Ler o catalogo
        mostraria a arte comum num premio que o texto do dia diz que e
        lendario
      */}
      <div className="pss-day__icon">
        <ItemIcon
          item={item}
          itemId={dia.itemId}
          rarity={dia.rarity ?? null}
          alt=""
        />
      </div>

      <p className="pss-day__name">{nomeItem}</p>

      <span className="pss-day__qtd">
        {dia.quantidade > 1 ? `x${dia.quantidade}` : ""}
      </span>

      {/*
        O ICONE DE CADEADO, e nao so o texto "bloqueado".

        O cadeado diz QUE falta, e o texto embaixo diz DO QUE. Um cartao que
        so escrevesse "Premium" deixaria o jogador sem saber se ele precisa
        pagar, esperar o dia ou abrir o passe premium — que sao tres acoes
        diferentes
      */}
      {estado === "bloqueado" && (
        <span className="pss-day__lock" aria-hidden="true">
          🔒
        </span>
      )}

      {estado === "premium" && (
        <span className="pss-day__lock" aria-hidden="true">
          🔒
        </span>
      )}

      {resgatado ? (
        <span className="pss-day__state">
          <i aria-hidden="true">✓</i> Resgatado
        </span>
      ) : podeResgatar ? (
        <button
          type="button"
          className="pss-day__claim"
          onClick={onResgatar}
          data-tip={`Resgatar ${nomeItem}`}
        >
          Resgatar
        </button>
      ) : (
        <span className="pss-day__state is-muted">
          {estado === "premium" ? "Premium" : "Bloqueado"}
        </span>
      )}
    </article>
  );
}