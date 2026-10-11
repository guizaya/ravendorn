import { useState } from "react";

import { RARITY_STYLE, getItem } from "../../data/items/index.js";
import ItemIcon from "../UI/ItemIcon.jsx";
import SlotMenuFloat from "../UI/SlotMenuFloat.jsx";
import PermanentBonus from "../UI/PermanentBonus.jsx";

/**
 * O CARD DE UMA COLECAO, com uma parcela por icone.
 *
 * ## POR QUE UM COMPONENTE NOVO E NAO O `ItemCard` QUE JA EXISTE
 *
 * Porque o `ItemCard` e VERTICAL: o slot em cima, o nome e a raridade
 * embaixo. Ele serve a mochila e ao encantar, onde o slot e o que se
 * compara e o nome so identifica. A colecao e o contrario — o que
 * identifica a entrega e o TITULO e o RESUMO
 *
 * ## A ENTREGA E POR PARCELA
 *
 * Cada icone e uma parcela, e cada parcela paga o seu bonus. Um icone pago
 * fica marcado e perde a contagem; entregar as duas completa o card
 *
 * ## DE ONDE VEM CADA CAMPO
 *
 * Nada aqui e inventado. O `entry` e o que o `Collection.snapshot` monta:
 *
 * - `name`, `summary` — do catalogo de colecoes
 * - `needs` — as parcelas ja normalizadas, com `have`, `need`, `indice`,
 *   `entregue` e `rewards` por linha
 * - `done`, `pronta` — o estado, calculado pelo motor
 */
export default function CollectionCard({
  entry,
  onDeliver = null,
  className = "",
}) {
  /**
   * AS PARCELAS, uma por icone.
   *
   * ## POR QUE CADA PARCELA TEM O SEU ICONE
   *
   * Porque as parcelas sao doses CRESCENTES do mesmo item — 20 e depois 40.
   * Juntas em um "60 de 60" unico o jogador nao saberia quantos faltam
   * para a proxima parcela fechar, nem qual delas ele ja pagou
   *
   * Com um icone por parcela, o "0/20" e o "0/40" ficam embaixo dos icones
   * que eles descrevem, e cada uma some quando e paga
   */
  const parcelas = (entry.needs ?? []).map((need, indice) => {
    const item = need.itemId ? getItem(need.itemId) : null;

    return {
      indice,
      item,
      itemId: need.itemId ?? null,
      nome: item?.name ?? need.label ?? "Item",
      raridade: item?.rarity ?? need.rarity ?? null,
      tem: need.have ?? 0,
      precisa: need.need ?? 0,
      entregada: Boolean(need.entregue),

      /**
       * O APRIMORAMENTO PEDIDO, para o badge no icone.
       *
       * E `null` quando a entrega nao tem exigencia de aprimoramento — que
       * e o caso de todo material. O zero seria outra coisa: "qualquer
       * aprimoramento serve", e isso nao e a mesma ausencia de exigencia
       */
      enhance: need.enhance ?? null,
    };
  });

  /**
   * O ITEM QUE ABRE A COR DO CARD.
   *
   * E o primeiro, e nao a soma: o anel de raridade marca o material da
   * entrega, e todas as parcelas de uma colecao sao do mesmo grau
   */
  const primeiro = parcelas[0] ?? null;

/**
 * O BONUS QUE ESTA NA MESA.
 *
 * ## POR QUE SOMA SO O QUE NAO FOI PAGO
 *
 * Porque o rotulo e "Vai receber". Uma parcela ja entregue ja pagou: o
 * card mostrando de novo diria ao jogador que ele vai receber +2 VIT de
 * novo quando entregar a segunda parcela
 *
 * E o que separa este campo do bonus do motor: o motor sabe o que foi
 * DADO, o card sabe o que FALTA
 *
 * ## E POR QUE UM CARD COMPLETO SOMA TUDO
 *
 * Porque o filtro acima esvaziava o objeto no instante em que a ultima
 * parcela era paga: nada faltando, nada a mostrar, e os atributos
 * desapareciam do card que o jogador acabou de completar. Ele entregou
 * material de proposito e a tela parou de dizer o que aquilo rendeu
 *
 * O `entry.done` e a condicao: com a colecao inteira fechada nao existe
 * "vai receber" para enganar — so o que foi ganho
 */
  const restante = parcelas
    .filter((parcela) => entry.done || !parcela.entregada)
    .flatMap((parcela) =>
      Object.entries(
        (entry.needs ?? [])[parcela.indice]?.rewards ?? {},
      ),
    )
    .reduce((total, [stat, valor]) => {
      total[stat] = (total[stat] ?? 0) + Number(valor);
      return total;
    }, {});

  /**
   * O MENU ABERTO, guardado como o ELEMENTO do clique.
   *
   * E o elemento e nao um id porque o `SlotMenuFloat` se gruda nele para
   * medir onde a caixa vai cair. Guardar so "qual card esta aberto" nao
   * bastaria: dois cards abertos ao mesmo tempo no mesmo lugar dariam a
   * mesma posicao
   */
  const [menu, setMenu] = useState(null);

  return (
    <article
      className={[
        "col-card",
        entry.done ? "is-done" : "",
        entry.pronta ? "is-ready" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--rarity":
          RARITY_STYLE[primeiro?.raridade]?.color ?? "#c3ccd6",
      }}
    >
      {/*
        A COLUNA DO MEIO: o nome com o bonus embaixo, e os itens a direita.

        ## POR QUE O BONUS FICA SOB O NOME E NAO EMBAIXO DE TUDO
        Porque o bonus e a resposta de "esta entrega paga o que?", e a
        pergunta mora no nome. Empurrado para o fim do card, ele ficava
        longe do nome — e o jogador lia a entrega inteira antes de achar o
        que ela rende

        ## POR QUE O VALOR SAI SO ATE O ITEM
        Porque o valor e a resposta e os numeros precisam cair na mesma
        coluna para serem comparaveis. Esticado ate a direita do card, o
        `+40` ficaria longe do nome do stat
      */}
<div className="col-card__info">
        {/*
          O NOME E, SOB ELE, O BONUS.

          ## POR QUE FICA A ESQUERDA DO CARD
          Porque o nome e o que identifica a entrega, e ele abre a linha.
          Com uma parcela so, o icone ficaria sozinho no meio do card se
          fosse o primeiro a ocupar espaco

          O nome ocupa o que sobrar e o bonus fica logo abaixo, com a
          mesma largura. E o `space-between` do CSS que segura a coluna
          dos valores longe da coluna dos icones

          ## E O BONUS FICOU FORA DO `__info` DEPOIS

          Porque `is-done` escurece este bloco inteiro — `.col-card.is-done
          .col-card__info { opacity: 0.62 }`. Com o bonus aqui dentro, o
          numero que o jogador ganhou aparecia apagado no exato instante em
          que ele entregava tudo, que e quando ele mais olha para conferir
          o que recebeu. Ele virou IRMAO do `__info`, e o card entregue
          escurece o nome sem tocar no numero
        */}
        <div className="col-card__esquerda">
          <h3 className="col-card__title">{entry.name}</h3>

          {/*
            O BONUS, LOGO ABAIXO DO NOME, SEM CAIXA.

            ## POR QUE A CAIXA SAIU
            Porque ela era uma moldura em volta de um ACORDO entre o jogador
            e o jogo: material por atributo. Com borda, fundo e borda
            esquerda, o bonus virava um bloco que competia com o nome — e o
            nome e o que identifica a entrega

            ## POR QUE some SO O QUE NAO FOI ENTREGUE
            Porque ver o bonus de uma parcela ja paga diria ao jogador que
            ele vai receber aquele stat de novo
          */}
          <div className="col-card__premio">
            <PermanentBonus bonuses={restante} layout="lista" />
          </div>
        </div>
      </div>

        {/*
          OS ITENS, A DIREITA.

          ## POR QUE `align-self: flex-start` E NAO `flex-end`
          Porque com `flex-end` uma colecao de uma parcela so deixa o icone
          grudado na borda direita, com um vazio grande entre ele e o nome.
          No `start`, os icones comecam no canto do bloco deles e ficam
          juntos quando ha mais de um

          O `start` aqui e o do BLOCO dos icones, e nao o do card: o card
          continua com nome a esquerda e icones a direita
        */}
        <ul className="col-card__parcelas">
          {parcelas.map((parcela) => (
            <Parcela
              key={parcela.indice}
              parcela={parcela}
              entry={entry}
              onDeliver={onDeliver}
              abrirMenu={setMenu}
            />
          ))}
        </ul>

      {menu && (
        <SlotMenuFloat
          entry={{ uid: primeiro?.itemId ?? entry.id }}
          actions={menu.acoes}
          ancora={menu.elemento}
          fechar={() => setMenu(null)}
        />
      )}
    </article>
  );
}

/**
 * UMA PARCELA: o icone e a conta que some quando e paga.
 *
 * ## POR QUE O ICONEsome INTEIRO E NAO SÓ A CONTA
 *
 * Porque a parcela entregue nao tem mais nada a dizer. Com o icone la e a
 * conta "20/20" embaixo, o jogador leria um item pronto para entregar de
 * novo — e o clique abriria um menu com "Já entregue". Sem o icone, o card
 * mostra o que falta e nada mais
 *
 * E o espaco em branco que fica e o registro do que ele fez: o card
 * encolhe a cada parcela paga
 */
function Parcela({
  parcela,
  entry,
  onDeliver,
  abrirMenu,
}) {
  /**
   * AS ACOES DO MENU DESTA PARCELA.
   *
   * Sao tres estados e nao um item desabilitado, porque um item cinza e
   * ambiguo: o jogador nao sabe se e "nao pode agora" ou "ja foi feito"
   */
  const acoes = parcela.entregada
    ? [{ id: "paga", label: "Já entregue", desativada: true }]
    : parcela.tem >= parcela.precisa
      ? [
          {
            id: "entregar",
            label: `Entregar ${parcela.nome}`,
            run: () => onDeliver?.(entry.id, parcela.indice),
          },
        ]
      : [
          {
            id: "falta",
            label: `Faltam ${parcela.precisa - parcela.tem}`,
            desativada: true,
          },
        ];

  const abrir = (event) => {
    abrirMenu({ elemento: event.currentTarget, acoes });
  };

  return (
    <li
      className={[
        "col-card__parcela",
        parcela.entregada ? "is-paga" : "",
        !parcela.entregada && parcela.tem >= parcela.precisa
          ? "is-ok"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >


          {/*
            O ICONE ABRE O MENU DE ENTREGAR.

            ## POR QUE UM MENU E NAO UMA ACAO DIRETA

            Porque entregar tira material da mochila e soma bonus no
            personagem. E o tipo de coisa que a mochila e o craft ja tratam
            com um menu: um clique em um alvo pequeno nao pode custar recurso
            sem o jogador ter visto o que ia perder
          */}
          <button
            type="button"
            className="col-card__parcela-icone"
            onClick={abrir}
            aria-label={`Opções para ${parcela.nome}`}
            aria-haspopup="menu"
          >
            {parcela.item ? (
              <ItemIcon
                itemId={parcela.item.id}
                rarity={parcela.raridade}
              />
            ) : (
<span className="col-card__glifo-grande">
                  {entry.icon ?? "⛁"}
                </span>
              )}

              {/*
                A BOLINHA NO CANTO, e ela e o "pronta para entregar".

                ## POR QUE SUBSTITUIU A BORDA VERDE

                Porque a borda verde marcava a COLECAO inteira, e nao a
                parcela: o card ficava verde quando UMA das suas parcelas
                estava pronta, e o jogador lia "esta entrega esta feita"
                numa colecao que ainda tinha o que entregar

                ## POR QUE NO CANTO DO ICONE

                Porque e a unica ancora que nao se move: o numero da parcela
                some quando ela e paga e a borda do card pertence a colecao
                inteira. O canto do icone esta sempre ali, e o que ele
                significa nao muda

                ## POR QUE SO QUANDO ESTA PRONTA E NAO ENTREGUE

                Porque depois de entregue a parcela inteira vira a barrinha de
                4px — o icone nao existe mais, e nao ha onde pendurar nada
              */}
              {!parcela.entregada &&
                parcela.tem >= parcela.precisa && (
                  <span className="col-card__parcela-ponto" />
                )}

              {/*
                O BADGE DO APRIMORAMENTO, SOBRE O ICONE.

                ## POR QUE UM BADGE E NAO SO O TEXTO DA CONTA

                Porque "Aljava de Arqueiro +5" numa linha de 11px nao e um
                numero que o jogador le de relance, e a exigencia da entrega
                e o numero: ele precisa saber se a peca da mochila serve.
                O badge pega a mesma informacao e a grande

                ## POR QUE FICA SOBRE O ICONE E NAO DEBAIXO

                Porque a conta embaixo e a do QUANTIDADE, e o badge e a
                CONDICAO. Sao coisas diferentes, e uma embaixo da outra
                fariam o jogador ler o +5 como parte da conta
              */}
              {parcela.enhance > 0 && (
                <span className="col-card__parcela-enhance">
                  +{parcela.enhance}
                </span>
              )}
            </button>

            {/*
              A CONTA DA PARCELA, DEBAIXO DO ICONE.

              E "tem/precisa" e nao so o quanto falta: o jogador precisa das
              duas metades da conta para saber se volta a cacar ou so falta o
              ultimo tanto

              ## E POR QUE UMA PARCELA ENTREGUE CONTA COMO CHEIA

              Porque `tem` e o que o jogador TEM na mochila agora, e o material
              entregue ja saiu de la. A conta lia "0/20" numa parcela que o
              jogador acabou de pagar — ele entregou 20 e a tela dizia que
              nao tinha nenhum

              A entrega e um feito, nao uma falta. Depois de paga, a conta
              fecha em "precisa/precisa", que e o que o jogador ve se olhar
              para o icone e lembrar do que pagou

              E so a parcela: enquanto a colecao estiver pela metade, a que
              falta continua contando o que ha na mochila, porque e ela que
              o jogador ainda tem que caçar
            */}
          <span className="col-card__parcela-conta">
            {parcela.entregada ? parcela.precisa : parcela.tem}/
            {parcela.precisa}
          </span>
    </li>

  );
}