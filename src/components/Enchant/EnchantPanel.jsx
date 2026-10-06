import { useEffect, useMemo, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";
import ItemCard from "../UI/ItemCard.jsx";
import {
  canEnchantItem,
  describeEnchant,
  enchantCost,
  enchantOdds,
} from "../../data/enchant/index.js";
import {
  ITEM_TYPE_LABEL,
  RARITY_STYLE,
  getItem,
} from "../../data/items/index.js";

/**
 * O painel de ENCANTAMENTO.
 *
 * Substitui o painel de teste, que nao tinha conteudo nenhum. A tela e a
 * mesma do inventario — lista de itens numa coluna, e uma caixa ao
 * lado com o que esta selecionado — porque o jogador ja le esse
 * formato na mochila e nao deveria ter que aprender um segundo
 *
 * A lista tem DOIS grupos: a mochila e o que esta no corpo. Sao duas
 * fontes diferentes do mesmo snapshot, e o jogador precisa ver as duas
 * antes de escolher onde gastar o ouro: uma armadura encantada nas
 * costas e uma na mochila sao pecas diferentes, e so uma delas esta
 * valendo
 *
 * O AFIXO NUNCA E SORTADO AQUI. O clique manda o endereco da peca para
 * o servidor, o servidor sorteia e devolve no `SNAPSHOT`, e o painel
 * le o afixo de `inventory.items` ou de `equipment.slots`. Sortear na
 * tela mostraria ao jogador um numero que o servidor nao aceitou, e o
 * afixo mudaria sozinho quando o pacote chegasse — um numero que se
 * mexe sozinho nao serve de recompensa nem de prova
 */

/** as duas colunas do corpo, como no inventario */
const VAZIO = {
  items: [],
  coins: 0,
  used: 0,
  capacity: 0,
};

/**
 * A chave de uma peca na selecao.
 *
 * O prefixo e o que separa a mochila do corpo. Sem ele, um arco
 * equipado e um arco na mochila com o mesmo `itemId` teriam a mesma
 * chave, e selecionar um marcaria o outro
 *
 * O `uid` so existe na mochila: o slot guarda `itemId` e `raridade`,
 * e nao o `uid` da pilha de onde a peca veio. E por isso que a chave
 * do corpo usa o `slotId`, e nao um `uid` inventado
 */
/**
 * A CHAVE DE UMA PECA, e ela que identifica a peca na selecao.
 *
 * ## POR QUE ESTA SAI PARA FORA
 *
 * E o formato que o `HUD` precisa montar para abrir este painel ja com
 * uma peca escolhida. Antes desta exportacao o `HUD` tinha duas
 * possibilidades, e as duas ruins: reescrever o `slot:`/`mochila:` aqui
 * (duas copias do mesmo formato, que divergem no primeiro dia em que
 * alguem mudar) ou repassar a peca inteira e deixar este painel
 * descobrir a chave (aí o `HUD` conheceria um detalhe deste componente)
 *
 * ## O `uid` SO EXISTE NA MOCHILA
 *
 * O slot do corpo guarda `itemId` e `raridade`, e nao o `uid` da pilha de
 * onde a peca veio — e por isso que a chave do corpo usa o `slotId`, e
 * nao um `uid` inventado
 */
export const chave = (pecado) =>
  pecado.slotId ? `slot:${pecado.slotId}` : `mochila:${pecado.uid}`;

/** o texto do afixo de uma peca, ou "" */
function Afixo({ enchant }) {
  if (!enchant) return null;

  const estilo = RARITY_STYLE[enchant.rarity];

  return (
    <span
      className="enc-affix"
      style={{ color: estilo?.color }}
      title={`${estilo?.label ?? enchant.rarity} — rola de novo para trocar`}
    >
      {describeEnchant(enchant)}
    </span>
  );
}

/**
 * A CAIXA DO LADO: a peca escolhida.
 *
 * E a `aside` do inventario com outra funcao. Aqui ela e o que o
 * jogador vai encantar, e por isso ela e a unica parte do painel que
 * age: o botao de encantar mora nela, e nao na peca da lista. Se o
 * botao ficasse em cada item da lista, haveria um botao por peca e o
 * jogador teria de mirar o certo antes de saber o preco
 */
function CaixaDoLado({
  entry,
  item,
  coins,
  onEnchant,
}) {
  if (!entry || !item) {
    return (
      <div className="enc-side">
        <span className="eyebrow">Encantar</span>

        <p className="enc-side__empty">
          Escolha um item da lista para encantar.
        </p>
      </div>
    );
  }

  const custo = enchantCost(entry.itemId, entry.rarity);

  const semOuro = coins < custo;

  return (
    <div className="enc-side">
      <span className="eyebrow">Encantar</span>

      {/*
        A peca escolhida, no MESMO formato do slot do boneco: a arte
        grande, o nome embaixo e a raridade. O jogador precisa ver qual
        peca esta escolhida antes de gastar ouro, e uma linha de texto
        com um nome repetido da lista nao deixa isso claro
      */}
      <div
        className="enc-slot"
        style={{
          "--rarity": RARITY_STYLE[entry.rarity]?.color,
        }}
      >
        <ItemIcon
          item={item}
          itemId={entry.itemId}
          rarity={entry.rarity}
          className="enc-slot__icon"
        />

        <strong>{item.name}</strong>

        <small>
          {ITEM_TYPE_LABEL[item.type] ?? item.type}
          {" · "}
          {RARITY_STYLE[entry.rarity]?.label ??
            entry.rarity}
        </small>

        {/*
          De ONDE a peca veio.

          Com um arco no corpo e um arco na mochila mostrando a mesma
          arte, a caixa do lado e o unico lugar que desfaz a duvida: o
          jogador precisa ver se esta prestes a encantar a peca que esta
          valendo no jogo ou a que esta na espera
        */}
        <small className="enc-slot__where">
          {entry.rotuloDoSlot
            ? `Vestida · ${entry.rotuloDoSlot}`
            : "Na mochila"}
        </small>

        <Afixo enchant={entry.enchant} />
      </div>

      {/*
        O PRECO antes do botao, e nao dentro dele.

        O botao desabilitado sem ouro ainda precisa dizer QUANTO
        custa. Um botao cinza sem numero deixaria o jogador sem
        forma de saber o que falta, e ele iria trocar de item achando
        que a peca e cara demais
      */}
      <p className="enc-cost">
        <span className="enc-cost__label">Custo</span>

        <span
          className={[
            "enc-cost__value",
            semOuro ? "is-short" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <i>◉</i>
          {custo}
        </span>
      </p>

      <button
        type="button"
        className="enc-action"
        onClick={onEnchant}
        disabled={semOuro}
        title={
          semOuro
            ? `Ouro insuficiente: faltam ${custo - coins}`
            : "Sortear um afixo para esta peça"
        }
      >
        Encantar
      </button>
    </div>
  );
}

/** as chances de cada raridade, uma vez por painel */
const Chances = () => (
  <div className="enc-odds">
    <span className="eyebrow">Chances</span>

<ul>
        {enchantOdds().map((linha) => (
          <li key={linha.rarity}>
            <span style={{ color: linha.color }}>
              {linha.label}
            </span>

            {/*
              A CHANCE, e nao o valor do afixo.

              As duas coisas viviam no mesmo campo `percent`: o quanto o
              afixo vale e a chance de ele sair. O painel rotulava a
              coluna de "Chances" e mostrava o valor — o jogador lia
              "Lendario 6%" e podia crer que tinha 6% de chance de sair
              um lendario

              E a chance e a soma de todas as linhas fechar em 100
            */}
            <span>{linha.chance}%</span>
          </li>
        ))}
      </ul>
  </div>
);

/**
 * UM grupo da lista: o equipado, ou o da mochila.
 *
 * Sao dois grupos e nao uma lista so porque as pecas se confundem sem
 * o rotulo: um arco no corpo e um arco na mochila mostram a MESMA arte
 * e o MESMO nome, e so o grupo diz ao jogador qual dos dois esta
 * valendo no jogo
 *
 * O `key` e a `chave()`, e nao o `itemId`: sao pecas diferentes com o
 * mesmo `itemId`, e o React precisa de chaves distintas para nao
 * reaproveitar o elemento de uma na outra
 */
function Grupo({
  titulo,
  itens,
  selecionado,
  onSelect,
}) {
  return (
    <section className="enc-group">
      <span className="eyebrow">
        {titulo} · {itens.length}
      </span>

      {/*
        O MESMO CARDO DA MOCHILA, e nao um `inv-cell` proprio.
        *
        * ## POR QUE MUDAR
        *
        * O painel de encantar e a tela onde o jogador COMPARA pecas, e
        * ele mostrava menos do que a mochila: nome e afixo, sem raridade.
        * Duas pecas do mesmo item em raridades diferentes apareciam
        * identicas ao lado uma da outra — que e justo o caso que o
        * jogador abre este painel para resolver
        *
        * E sao dois paineis do mesmo jogo: o mesmo arco aparece com duas
        * aparencias dependendo de onde o jogador abriu. Um cartao
        * compartilhado (`ItemCard`) garante que um ajuste de largura ou de
        * cor chegue aos dois
      */}
      <div className="inv-grid-modern">
        {itens.map((item) => {
          const id = chave(item);
          const escolhido = id === selecionado;

          return (
            <ItemCard
              key={id}
              entry={item}
              className={escolhido ? "is-selected" : ""}
              slotProps={{
                selected: escolhido,

                /**
                 * O CLIQUE MARCA, E NAO ABRE A CAIXA DE OPCOES.
                 *
                 * Aqui o clique e a propria selecao da peca a encantar.
                 * A caixa de opcoes (equipar, excluir, encantar) e do
                 * inventario e ficaria duplicada no painel de encantar,
                 * onde nao teria o que fazer: tudo o que se pode fazer com
                 * a peca e escolher qual afixo testar nela
                 */
                onSelect: () =>
                  onSelect(escolhido ? null : id),
              }}
            >
              <Afixo enchant={item.enchant} />
            </ItemCard>
          );
        })}
      </div>
    </section>
  );
}

export default function EnchantPanel({
  inventory,
  equipment,
  onEnchant,
  onClose,

  /**
   * A PECA QUE JA ENTRA SELECIONADA, ou `null`.
   *
   * E o pedido que vem do "Encantar" da caixa do item: em vez de abrir
   * este painel com a lista inteira e o jogador ter que procurar a peca
   * de novo, ele abre com a peca ja escolhida e a CAJA DE AFIXO ja
   * mostrando o preco
   *
   * E a chave, e nao a peca: a chave e o que a selecao interna guarda,
   * e o que sobrevive ao snapshot seguinte. Passar o objeto inteiro
   * obrigaria este painel a descobrir a chave de algo que ja vem em
   * outro formato
   */
  selecaoInicial = null,
}) {
  const data = inventory ?? VAZIO;

  const [selecionado, setSelecionado] = useState(null);

  /**
   * As DUAS listas, e so o que aceita afixo.
   *
   * Material nao entra em nenhuma: e empilhavel, e uma pilha de 99 nao
   * tem um afixo por peca. Mostrar gel de slime seria uma isca sem
   * resultado — o jogador selecionaria e o botao nao teria o que fazer
   *
   * As duas listas sao SEPARADAS de proposito, e nao juntadas numa so.
   * Uma peca vestida e uma peca na mochila sao coisas diferentes: a
   * primeira esta valendo no jogo agora, e a segunda so passa a valer
   * quando o jogador a veste. Num lista unica o jogador veria dois
   * arcos iguais e nao saberia qual dos dois estava no corpo
   */
  const daMochila = useMemo(
    () =>
      data.items
        .filter((entry) => canEnchantItem(entry.itemId))
        .map((entry) => ({ ...entry, origem: "mochila" })),
    [data.items],
  );

  const doCorpo = useMemo(
    () =>
      (equipment?.slots ?? [])
        .filter(
          (slot) =>
            slot.itemId && canEnchantItem(slot.itemId),
        )
        .map((slot) => ({
          uid: null,
          slotId: slot.id,
          itemId: slot.itemId,
          rarity: slot.rarity,
          count: 1,
          equipped: true,
          enchant: slot.enchant ?? null,
          origem: "corpo",
          rotuloDoSlot: slot.name,
        })),
    [equipment],
  );

  const todas = useMemo(
    () => [...doCorpo, ...daMochila],
    [doCorpo, daMochila],
  );

  /**
   * A selecao mora por CHAVE, e nao por `itemId`.
   *
   * Duas pecas do mesmo item na mesma raridade sao DUAS entradas com
   * `uid` diferente, e podem ter afixos diferentes. Guardando o
   * `itemId`, encantar uma marcaria a outra tambem — e agora o
   * `itemId` ainda identifica uma pECA DA MOCHILA e uma DO CORPO, o
   * que duplicaria o problema
   */
  const entry = useMemo(
    () =>
      todas.find((item) => chave(item) === selecionado) ??
      null,
    [todas, selecionado],
  );

  const item = entry ? getItem(entry.itemId) : null;

  /**
   * A selecao e limpa quando a peca sai da lista.
   *
   * Encantar um arco com ouro justo faz ele ir para o chao, e o
   * snapshot seguinte ja nao tem mais aquele `uid`. Sem esta limpeza a
   * caixa do lado ficaria mostrando uma peca que o jogador nao tem
   * mais, e o botao pagaria de novo por um encantar que nao existe
   *
   * Vale para os dois grupos: tirar uma armadura do corpo tambem a
   * tira da lista, e a caixa nao pode continuar mostrando ela
   */
  useEffect(() => {
    if (selecionado === null) return;

    if (!todas.some((item) => chave(item) === selecionado)) {
      setSelecionado(null);
    }
  }, [todas, selecionado]);

  /**
   * A PECA PEDIDA, quando o painel abre.
   *
   * ## POR QUE UM `useEffect` E NAO O `useState` INICIAL
   *
   * O `useState(selecaoInicial)` so valeria na primeira montagem deste
   * componente. O `HUD` mantem o painel na tela e troca a peca pedida
   * depois: o jogador clica "Encantar" numa peca, fecha, abre o painel
   * de novo na OUTRA — e o painel nem desmontou, entao o estado inicial
   * nem seria lido de novo e a peca antiga continuaria escolhida
   *
   * ## E POR QUE SO APLICA QUANDO A PECA EXISTE
   *
   * A chave vem do `HUD`, que a montou a partir de uma peca que estava
   * na mochila do ultimo painel. Entre o clique e a abertura pode ter
   * vindo um snapshot novo, e a peca pode ter sumido. Aplicar a chave
   * sem conferir deixaria o painel aberto com o campo de afixo vazio e
   * o jogador sem entender por que — entao ela so entra se a lista a
   * reconhece, e o resto da tela segue o caminho de sempre
   */
  useEffect(() => {
    if (!selecaoInicial) return;

    if (!todas.some((item) => chave(item) === selecaoInicial)) {
      return;
    }

    setSelecionado(selecaoInicial);
  }, [selecaoInicial, todas]);

  /**
   * O que vai para o pedido.
   *
   * `uid` para a mochila, `slotId` para o corpo, e nunca os dois: o
   * servidor recusa um pedido ambiguo, porque o jogador pagaria para
   * encantar uma peca e veria outra mudar
   */
  const alvo = entry
    ? entry.slotId
      ? { slotId: entry.slotId }
      : { uid: entry.uid }
    : null;

  return (
    <section className="inv-panel enc-panel">
      <nav className="inv-tabs">
        <button
          type="button"
          className="inv-tab is-active"
          title="Encantar uma peça"
        >
          <span className="inv-tab__icon">✧</span>

          <small>Encantar</small>

          {todas.length > 0 && (
            <i className="inv-tab__count">{todas.length}</i>
          )}
        </button>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (X)"
          aria-label="Fechar o painel de encantamento"
        >
          ✕
        </button>
      </nav>

      <div className="inv-panel__body">
        <CaixaDoLado
          entry={entry}
          item={item}
          coins={data.coins}
          onEnchant={() => {
            if (alvo) onEnchant?.(alvo);
          }}
        />

        <div className="inv-main">
          {todas.length === 0 ? (
            <p className="inv-panel__empty">
              Nenhuma arma ou armadura para encantar. Equipe uma peça ou
              ache uma na mochila.
            </p>
          ) : (
            <>
              {/*
                O EQUIPADO vem ANTES da mochila.

                E a ordem que o jogador espera: a peca que esta valendo
                agora vem primeiro, e a da mochila e a alternativa. Com
                a mochila na frente, o jogador veria um arco na mochila
                e outro identico no corpo, e teria de adivinhar qual dos
                dois a arte do slot estava vestindo
              */}
              {doCorpo.length > 0 && (
                <Grupo
                  titulo="Equipado"
                  itens={doCorpo}
                  selecionado={selecionado}
                  onSelect={setSelecionado}
                />
              )}

              {daMochila.length > 0 && (
                <Grupo
                  titulo="Mochila"
                  itens={daMochila}
                  selecionado={selecionado}
                  onSelect={setSelecionado}
                />
              )}
            </>
          )}

          <Chances />
        </div>
      </div>

      <footer className="inv-status">
        <span className="inv-status__cap">
          <i>▣</i>
          {data.used}/{data.capacity}
        </span>

        <span className="inv-status__coins">
          <i>◉</i>
          {data.coins}
        </span>
      </footer>
    </section>
  );
}