import { useEffect, useMemo, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";
import ItemCard from "../UI/ItemCard.jsx";
import IconeMoeda from "../UI/IconeMoeda.jsx";
import {
  canEnchantItem,
  describeEnchant,
  describeEnhance,
  enchantCost,
  enchantOdds,
  enhanceBloqueio,
  enhanceCost,
  enhanceRisco,
  enhanceSteelCost,
  enhanceSteelEscada,
  ENHANCE_PASSO,
  formatarChance,
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

  /**
   * O STEEL COMECA EM ZERO AQUI, e nao fica de fora.
   *
   * Sem este campo a caixa de aprimorar abriria com `steel` em
   * `undefined`, e `undefined < custoSteel` seria `false` — o botao ficaria
   * LIGADO com o saldo quebrado e o jogador veria "Steel insuficiente: 4"
   * num botao que ele podia apertar. O `?? 0` na prop cobre o caminho
   * tambem, mas o `VAZIO` e o que mantem a forma do objeto igual a do
   * `snapshot` — e sao duas defesas para um `undefined` que derruba a tela
   * se vazar
   */
  steel: 0,
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

/**
 * AS DUAS ABAS, pelo mesmo nome que o `useState` usa.
 *
 * E uma lista e nao um par de constantes porque o `useEffect` da aba pedida
 * precisa conferir se o valor recebido e uma aba que EXISTE — e o lugar onde
 * essa pergunta e respondida nao pode ser o `nav`, que monta os botoes. Sao
 * dois lugares que precisam concordar, e um so lugar onde concordar
 */
const ABAS_DO_PAINEL = ["encantar", "aprimorar"];

/** o texto do afixo de uma peca, ou "" */
function Afixo({ enchant }) {
  if (!enchant) return null;

  const estilo = RARITY_STYLE[enchant.rarity];

  return (
    <span
      className="enc-affix"
      style={{ color: estilo?.color }}
      data-tip={`${estilo?.label ?? enchant.rarity} — rola de novo para trocar`}
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
          <IconeMoeda moeda="coins" />
          {custo}
        </span>
      </p>

      <button
        type="button"
        className="enc-action"
        onClick={onEnchant}
        disabled={semOuro}
        data-tip={
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

/**
 * A CAIXA DA ABA "APRIMORAR".
 *
 * ## POR QUE UM COMPONENTE SEPARADO E NAO UM `if` NA `CaixaDoLado`
 *
 * Porque sao duas telas com information different: a de encantar mostra
 * o preco de um SORTEIO, e a de aprimorar mostra o nivel atual, o quanto
 * o proximo nivel vale e o preco DELE. Misturar as duas numa caixa so com
 * `if` daria um componente com dois conjuntos de variaveis das quais cada
 * metade so e usada em metade das vezes
 *
 * E o `afixo` NAO aparece aqui. O aprimoramento mexe nos stats base da
 * peca, e o afixo e a outra camada — mistura-los faria o jogador achar
 * que esta pagando para mexer no afixo
 */
function CaixaDoAprimorar({
  entry,
  item,
  coins,

  /**
   * O SALDO DE STEEL DO JOGADOR.
   *
   * E `data.steel ?? 0` e nao `data.steel` porque o `VAZIO` deste painel
   * ainda nao tem o campo: o painel abre antes do primeiro `snapshot` e,
   * sem o `?? 0`, `undefined < custo` seria `false` e o botao ficaria
   * habilitado com o saldo quebrado — o jogador veria "Steel insuficiente:
   * 4" num botao que ele podia apertar
   */
  steel = 0,
  onEnhance,
}) {
  /**
   * A CONFIRMACAO, COMO ESTADO LOCAL desta caixa.
   *
   * ## POR QUE UM `useState` E NAO UM `confirm()` DO NAVEGADOR
   *
   * Porque `window.confirm` nao tem nada a ver com a arte do jogo, e o
   * jogador veria um aviso do navegador no meio de um painel que fala em
   * "peca", "nivel" e "ouro". A confirmacao precisa mostrar O DEGRAU e as
   * duas chances, que e a unica coisa que faz o clique ser consciente
   *
   * ## POR QUE O HOOK ANTES DO `if (!entry)`
   *
   *porque `useState` antes do `return` vazio e o que mantem a ordem dos
   * hooks igual em toda renderizacao. Depois do `if`, a primeira
   * renderizacao sem peca chamaria menos hooks que a seguinte, e o React
   * associaria o estado ao lugar errado
   */
  const [confirmando, setConfirmando] = useState(false);

  const nivel = entry?.enhance ?? 0;

  /**
   * A CONFIRMACAO MORRE QUANDO A PECA OU O NIVEL MUDA.
   *
   * Sem isso o jogador confirmaria um risco que nao e o da peca na tela:
   * selecionava uma espada +6, clicava, trocava para o arco +11 e
   * confirmava as 61,75% do arco sem ter lido nada do arco
   */
  useEffect(() => {
    setConfirmando(false);
  }, [entry?.uid, entry?.slotId, nivel]);

  if (!entry || !item) {
    return (
      <div className="enc-side">
        <span className="eyebrow">Aprimorar</span>

        <p className="enc-side__empty">
          Escolha uma peça para aprimorar.
        </p>
      </div>
    );
  }

  /**
   * O NIVEL, O PRECO DO PROXIMO, E PARA ONDE MANDAR O PEDIDO.
   *
   * ## POR QUE A PECA PODE ESTAR NA MOCHILA
   *
   * O `enhance` migrou do SLOT para a PECA (ver `Equipment.equip`), entao
   * a restricao de "tem que estar vestida" sumiu junto com o motivo. Uma
   * peca na mochila guarda o nivel dela e pode ser aprimorada — o ganho
   * so entra no ATQ quando ela for vestida, mas o numero e dela desde
   * sempre
   *
   * ## POR QUE O ALVO E UM OBJETO E NAO UM `slotId`
   *
   * Porque o servidor distingue os dois caminhos pelo campo que veio: e
   * `slotId` no corpo e `uid` na mochila, como no `encantar`. Mandar
   * `slotId: undefined` para uma peca da mochila faria o servidor cair no
   * caminho errado e recusar com "Escolha uma peca"
   */
  const bloqueio = enhanceBloqueio(nivel);

  const custo = enhanceCost(
    entry.itemId,
    nivel,
    entry.rarity,
  );

  /**
   * O STEEL DO MESMO DEGRAU, pela MESMA tabela que o motor debita.
   *
   * E o que faz o preco da caixa ser o preco real: `enhanceSteelCost` mora
   * em `data/enchant` e e importada tanto aqui quanto pelo `GameEngine`, e
   * nao existe segunda conta "2 mais 2 por nivel" espalhada pelo painel.
   * Um numero reescrito aqui divergiria do debito no primeiro ajuste de
   * preco, e o jogador pagaria 6 num botao que diz 4
   */
  const custoSteel = enhanceSteelCost(nivel);

  /**
   * QUEM FALTA.
   *
   * Os dois sao comparados ANTES do botao e nao dentro dele, pelo mesmo
   * motivo do `semOuro`: o botao desligado ainda precisa dizer quanto custa
   * e o que falta, e essa e a informacao que faz o jogador decidir ir
   * minerar ou guardar o ouro
   */
  const semOuro = coins < custo;
  const semSteel = steel < custoSteel;

  /**
   * O STEEL MANTA PRIMEIRO QUE FALTA.
   *
   * Nao por ser mais importante, e porque o steel e o recurso ESCASSO: o
   * ouro vem de todo mundo e o steel so de bater pedra. Dizer "faltam 3 de
   * ouro" quando o que realmente segura o botao e o steel mandaria o
   * jogador atras de uma moeda que ele ja tem
   */
  const semNada = bloqueio !== null || semSteel || semOuro;

  const alvoDoBotao = entry.slotId
    ? { slotId: entry.slotId }
    : { uid: entry.uid };

  /**
   * O RISCO DO DEGRAU QUE ESTA NA TELA, e `null` ate o +5.
   *
   * E a MESMA tabela que o motor sorteia (`enhanceRisco`), e nao uma
   * segunda copia dos numeros aqui: com dois lugares, a caixa mostraria
   * uma chance e o sorteio usaria outra, e o jogador perderia a peca
   * numa taxa que ele nunca viu
   */
  const risco = enhanceRisco(nivel);

  const motivo = bloqueio
    ? bloqueio
    : semSteel
      ? `Steel insuficiente: faltam ${custoSteel - steel}`
      : semOuro
        ? `Ouro insuficiente: faltam ${custo - coins}`
        : risco
          ? `Risco: ${formatarChance(risco.quebra)} de quebrar`
          : `Aprimorar para +${Math.round(
            ENHANCE_PASSO * 100 * (nivel + 1),
          )}%`;

  return (
    <div className="enc-side">
      <span className="eyebrow">Aprimorar</span>

      {/*
        O MESMO `enc-slot` da aba de encantar, com uma linha a mais.

        E o mesmo componente de proposito: o jogador precisa ver a MESMA
        peca que ele viu na outra aba, e duas artes diferentes para a
        mesma peca fariam ele duvidar de qual esta selecionada
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
          {RARITY_STYLE[entry.rarity]?.label ?? entry.rarity}
        </small>

        {/*
          O NIVEL, que e a unica informacao que esta aba tem e a de
          encantar nao tem
        */}
        {/*
          O NIVEL e DE ONDE A PECA VEIO.

          A linha apareceu junto com a migracao do `enhance` para a peca.
          Antes so havia "Vestida · Peito" ou "Na mochila", e o nivel
          aparecia so aqui — mas o badge do card e a caixa do boneco no
          inventario ja mostram o numero. Agora a mesma caixa diz as duas
          coisas, que e o que o jogador precisa para nao trocar de aba
          so para conferir
        */}
        <small className="enc-slot__where">
          {entry.rotuloDoSlot
            ? `Vestida · ${entry.rotuloDoSlot}`
            : "Na mochila"}
        </small>

        {/*
          O NIVEL SO QUANDO EXISTE.

          Um "Nível 0" nao informa nada, e a caixa do lado ja diz o preco
          do proximo nivel. O zero e o estado inicial de todas as pecas do
          jogo
        */}
        {nivel > 0 && (
          <span className="enc-slot__enhance">
            {`+${nivel} · ${describeEnhance(nivel)}`}
          </span>
        )}
      </div>

      {/*
        O PRECO antes do botao, pelo mesmo motivo da aba de encantar: o
        botao desligado ainda precisa dizer quanto custa
      */}
      <p className="enc-cost">
        <span className="enc-cost__label">
          {bloqueio ? "Teto" : "Próximo"}
        </span>

        <span
          className={[
            "enc-cost__value",
            semOuro && !bloqueio ? "is-short" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <IconeMoeda moeda="coins" />
          {bloqueio ? "—" : custo}
        </span>

        {/*
          O STEEL, NA MESMA LINHA E NAO EM OUTRA.

          E o mesmo `enc-cost` com um valor a mais porque o jogador compara
          os dois DELETASTE: ele olha o preco do degrau e pergunta "cabe no
          que eu tenho". Duas linhas fariam ele comparar o steel da linha de
          baixo com o ouro da linha de cima, e o numero que ele precisa ver
          junto e o do degrau

          E o `enc-cost__value--steel` para o glifo. O `◉` e do ouro, e o
          steel nao tem glifo proprio no catalogo de itens — ele nunca foi
          um item, e o icone do HUD o desenha como numero puro. Reusar o
          `◉` diria "2 de ouro" duas vezes na tela
        */}
        <span
          className={[
            "enc-cost__value",
            "enc-cost__value--steel",
            semSteel && !bloqueio ? "is-short" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <i>◆</i>
          {bloqueio ? "—" : custoSteel}
        </span>
      </p>

      {/*
        A ESCADA DE STEEL, E SO QUANDO FALTA.

        ## POR QUE SO QUANDO FALTA

        Porque com steel no mao a escada e um numero que o jogador ja tem:
        "4, 6, 8" nao diz nada. Com steel faltando ela vira a conta da
        descida ao Vale 1 — quantas batidas, quantos minutos — e e a
        informacao que transforma "faltam 4" em decisao

        ## POR QUE TRES DEGRAUS

        Tres respondem "vale a pena descer agora". Ate o quarto degrau a
        pergunta e a mesma, e a lista so empurra a caixa para baixo
      */}
      {!bloqueio && semSteel && (
        <ul className="enc-steel-steps">
          {enhanceSteelEscada(nivel).map((passo) => (
            <li
              key={passo.nivel}
              className={passo.nivel === nivel + 1 ? "is-next" : ""}
            >
              <span>+{passo.nivel}</span>
              <b>◈{passo.custo}</b>
            </li>
          ))}
        </ul>
      )}

      {/*
        A CONFIRMACAO SUBSTITUI O BOTAO, e nao fica ao lado dele.

        Sao dois botoes que competem pela mesma acao — confirmar e
        cancelar — e uma caixa embaixo do "Aprimorar" faria o jogador
        ler tres vezes o mesmo numero antes de clicar. Substituindo, o
        risco aparece uma vez e some quando a peca muda
      */}
      {confirmando && risco ? (
        <div className="enc-confirm">
          {/*
            OS MESMOS NUMEROS da caixa do rodape, pelo mesmo componente.

            Sao a mesma tabela e o mesmo degrau: a caixa ja mostrou o risco
            e a confirmacao so acrescenta a pergunta e os dois botoes
          */}
          <TresChances risco={risco} />

          <div className="enc-confirm__acoes">
            <button
              type="button"
              className="enc-action is-ghost"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="enc-action"
              onClick={() => {
                setConfirmando(false);

                onEnhance?.(alvoDoBotao);
              }}
              data-tip={motivo}
            >
              Confirmar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={["enc-action", risco ? "is-risky" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            /**
             * SO CONFIRMA QUANDO O DEGRAU TEM RISCO.
             *
             * Ate o +5 o preco e a unica perda, e pedir confirmacao ali
             * seria um clique extra a cada nivel sem nada para decidir. O
             * risco aparece do primeiro degrau que pode quebrar
             */
            if (risco) {
              setConfirmando(true);

              return;
            }

            onEnhance?.(alvoDoBotao);
          }}
          disabled={semNada}
          data-tip={motivo}
        >
          Aprimorar
        </button>
      )}
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
 * OS TRES NUMEROS de um degrau, o titulo e as tres linhas.
 *
 * ## POR QUE UM COMPONENTE SO
 *
 * Porque a caixa do rodape e a confirmacao mostram EXATAMENTE o mesmo
 * numero, e elas aparecem na mesma tela: a caixa para o jogador ler o
 * risco e a confirmacao para ele confirmar. Com o markup duplicado, os
 * tres numeros seriam escritos duas vezes, e uma troca de palavra em uma
 * das copias faria a tela discordar de si mesma — a caixa diria "falhar"
 * e a confirmacao "so falhar" no mesmo degrau
 *
 * ## POR QUE TRES LINHAS E NAO "FALHOU: 25%"
 *
 * Porque "falhou" e um termo ambiguo em portugues de RPG: tanto quer
 * dizer "a tentativa nao deu certo" quanto "a peca se perdeu". Sao duas
 * coisas com consequencias opostas, entao as duas aparecem separadas e o
 * "subir" fecha a conta em 100
 */
const TresChances = ({ risco }) => (
  <>
    <p className="enc-chance__titulo">
      {`+${risco.nivel} → +${risco.proximo}`}
    </p>

    <p className="enc-chance">
      <span className="is-break">Quebrar</span>

      {formatarChance(risco.quebra)}
    </p>

    <p className="enc-chance">
      <span>Só falhar</span>

      {formatarChance(risco.intacta)}
    </p>

    <p className="enc-chance">
      <span className="is-good">Subir</span>

      {formatarChance(risco.sucesso)}
    </p>
  </>
);

/**
 * O RISCO DO DEGRAU QUE O JOGADOR ESTA OLHANDO.
 *
 * ## POR QUE SO O DEGRAU SELECIONADO, E NAO A TABELA INTEIRA
 *
 * Porque o risco e uma propriedade do DEGRAU, e o degrau que importa e o
 * proximo. Uma tabela com os seis deixaria o jogador procurando a linha
 * do nivel da peca dele, e as outras cinco linhas sao risco de OTHER
 * peca — e nao de outro jogador
 *
 * ## POR QUE `enhanceRisco` E A UNICA CONDICAO
 *
 * Porque ela ja devolve `null` nos dois casos em que a caixa nao faz
 * sentido: abaixo do +6 nao ha risco, e no +12 nao ha proximo degrau. Um
 * `nivel < ENHANCE_RISCO_A_PARTIR_DE` aqui repetiria a regra do comeco do
 * risco e ainda precisaria de uma segunda condicao para o teto
 */
const RiscoAprimoramento = ({ nivel }) => {
  const risco = enhanceRisco(nivel);

  if (!risco) return null;

  return (
    <div className="enc-odds">
      <span className="eyebrow">Risco</span>

      <div className="enc-chances">
        <TresChances risco={risco} />
      </div>
    </div>
  );
};

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
function Grupo({ itens, selecionado, onSelect }) {
  return (
    <section className="enc-group">
      {/*
        O TITULO "Equipado" E "Mochila" SAIU.

        ## POR QUE

        Porque as duas listas viraram UMA, e o titulo diria o que a lista nao
        separa mais. Um "Equipado · 2" em cima de seis pecas seria mentira —
        duas sao do corpo e quatro sao da bolsa

        E o card ja carrega essa informacao: o slot da peca vestida tem a
        classe `is-equipped`, que e a mesma marca que o boneco usa. O jogador
        ve qual esta no corpo sem ler nenhum texto

        ## POR QUE A ABA SEM TITULO NAO PERDE A ORIENTACAO

        Porque `todas` ja vem na ordem certa — `doCorpo` primeiro, depois
        `daMochila`. A peca que esta valendo agora e sempre a primeira da
        lista, entao o jogador abre e ve ela em cima
      */}

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
                mostrarTexto={false}
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
              {/*
                O AFIXO DEBAIXO DO ICONE SAIU.

                ## POR QUE

                Porque o afixo continua aparecendo no CARD SELECIONADO, na
                lista lateral, com o texto inteiro e a chance de trocar. O que
                estava embaixo do icone de cada peca era o MESMO numero repetido
                em seis linhas da grade — e o jogador comparava duas pecas
                olhando um numero minúsculo em vez de olhar a peca

                E o tooltip do mouse ja mostra o afixo inteiro, com nome do
                stat e valor. O icone nao precisa carregar um texto que so
                aparece quando a peca ja esta selecionada
              */}
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
  abaInicial = null,

  /**
   * APRIMORAR a peca vestida de um slot.
   *
   * ## POR QUE SEPARADO DO `onEnchant`
   *
   * Porque os dois botoes pagos sao acoes diferentes sobre a peca: um
   * SORTEIA um afixo que pode sair melhor ou pior que o anterior, e o
   * outro AUMENTA o valor dos stats que ela ja tem e nunca piora
   *
   * Se os dois usassem a mesma prop, a aba precisaria mandar o modo junto
   * e o servidor receberia um `op` com dois formatos — e o nome do metodo
   * mentiria para quem lesse a chamada
   */
  onEnhance,
}) {
  const data = inventory ?? VAZIO;

  const [selecionado, setSelecionado] = useState(null);

  /**
   * A ABA ABERTA.
   *
   * `encantar` ou `aprimorar`. Antes havia um so botao marcado
   * `is-active` e nenhum estado: "Encantar" era a unica aba por construcao,
   * e nao por decisao
   *
   * O `selecionado` NAO e limpo ao trocar de aba, de proposito. O jogador
   * compara a mesma peca nas duas, e limpar a selecao faria a caixa do
   * lado esvaziar no clique na aba — ele perderia a peca que estava olhando
   * para ver o preco dela do outro jeito
   */
  const [aba, setAba] = useState("encantar");

  const aprimorarAtivo = aba === "aprimorar";

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
        /**
         * O QUE JA ESTA NO CORPO NAO ENTRA AQUI.
         *
         * A peca vestida continua em `data.items` — ela so ganha
         * `equipped: true` e um `slotId` no equipamento. Sem este filtro a
         * mesma peca aparecia NAS DUAS listas: uma vez em `doCorpo`, vinda do
         * slot, e outra em `daMochila`, vinda da pilha
         *
         * E o jogador via dois(ids) iguais de uma peca so. Pior: as duas linhas
         * tinham afixos diferentes — a do corpo e a que esta vestida, a da
         * mochila e uma peca nova — e nao havia nenhuma marca na tela dizendo
         * qual era qual
         */
        .filter(
          (entry) => !entry.equipped && canEnchantItem(entry.itemId),
        )
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

          /**
           * O NIVEL DE APRIMORAMENTO.
           *
           * Sem este campo a aba mostraria `+0%` em toda peca e o jogador
           * veria o numero errado antes de pagar pelo primeiro nivel
           *
           * ## POR QUE A LISTA DA ABA APRIMORAR VOLTOU A TER A MOCHILA
           *
           * O `enhance` migrou do slot para a pECA (ver
           * `Equipment.equip`). Com o numero no item, nao ha mais razao
           * para esconder peca da mochila: ela pode ser aprimorada e o
           * numero viaja com ela
           */
          enhance: slot.enhance ?? 0,
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
   * A ABA QUE O MENU DO ITEM PEDIU.
   *
   * ## POR QUE ISTO E UM EFEITO E NAO UM `useState` INICIAL
   *
   * Pelo mesmo motivo da peca pedida acima: o `HUD` mantem o painel na tela e
   * troca o pedido depois. Com `useState(abaInicial)`, o "Aprimorar" do menu
   * cairia na aba "Encantar" — e o jogador abriria o painel errado com a peca
   * certa escolhida, o que e pior do que nao abrir nada: parece bug
   *
   * ## E POR QUE O EFEITO NAO SOBRESCREVE A ESCOLHA DO JOGADOR
   *
   * Porque o `HUD` limpa o pedido ao fechar o painel, e o efeito so reage
   * quando o valor MUDA. Quem mexeu na aba depois que o painel abriu nao tem
   * como ser jogado para a outra aba por um pedido velho
   *
   * ## E POR QUE SO AS DUAS ABAS CONHECIDAS PASSAM
   *
   * Porque `setAba` pode receber qualquer string, e uma aba que nao existe
   * deixaria a tela sem caixa nenhuma: nem "Encantar", nem "Aprimorar". O
   * `includes` e o que impede isso, e ele lista as duas em vez de repetir a
   * lista de botoes do `nav` — porque sao dois lugares que precisam concordar
   * e nao podem
   */
  useEffect(() => {
    if (!ABAS_DO_PAINEL.includes(abaInicial)) return;

    setAba(abaInicial);
  }, [abaInicial]);

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
        {/*
          AS DUAS ABAS.

          ## POR QUE O ESTADO MORA AQUI E NAO NO HUD

          Porque a aba e estado do PAINEL. Se ela morasse no HUD, fechar e
          reabrir o painel buscaria a aba do jogador anterior — e abrir o
          painel para encantar landing na aba "Aprimorar" seria uma
          surpresa

          ## POR QUE O `selecionado` SOBREVIVE A TROCA

          Ver o `useState` acima. O jogador compara a mesma peca nas duas
          abas, e limpar a selecao esvaziaria a caixa no clique
        */}
        <button
          type="button"
          className={[
            "inv-tab",
            !aprimorarAtivo ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setAba("encantar")}
          data-tip="Encantar uma peça"
          aria-pressed={!aprimorarAtivo}
        >
          <span className="inv-tab__icon">✧</span>

          <small>Encantar</small>

          {!aprimorarAtivo && todas.length > 0 && (
            <i className="inv-tab__count">{todas.length}</i>
          )}
        </button>

        {/*
          A CONTAGEM DA ABA DE APRIMORAR e so das PECAS VESTIDAS.

          Porque e o numero de pecas que o jogador pode aprimorar agora. A
          contagem da aba vizinha mostra o total de pecas afixaveis,
          mochila inclusa — e um numero que nao e resposta para "quanto eu
          tenho para aprimeorar"
        */}
        <button
          type="button"
          className={[
            "inv-tab",
            aprimorarAtivo ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setAba("aprimorar")}
          data-tip="Aprimorar uma peça vestida"
          aria-pressed={aprimorarAtivo}
        >
          <span className="inv-tab__icon">▲</span>

          <small>Aprimorar</small>

          {aprimorarAtivo && doCorpo.length > 0 && (
            <i className="inv-tab__count">{doCorpo.length}</i>
          )}
        </button>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar (X)"
          aria-label="Fechar o painel de encantamento"
        >
          ✕
        </button>
      </nav>

      <div className="inv-panel__body">
        {/*
          A CAIXA DO LADO TROCA COM A ABA.

          Sao duas telas com information different, e o `if` escolhe qual
          delas existe. Nao ha estado de "qual esta aberta" alem do booleano
          da aba — quem sabe e a propria `aba`
        */}
        {aprimorarAtivo ? (
          <CaixaDoAprimorar
            entry={entry}
            item={item}
            coins={data.coins}
            steel={data.steel ?? 0}
            onEnhance={onEnhance}
          />
        ) : (
          <CaixaDoLado
            entry={entry}
            item={item}
            coins={data.coins}
            onEnchant={() => {
              if (alvo) onEnchant?.(alvo);
            }}
          />
        )}

        <div className="inv-main">
          {/*
            A LISTA DA ABA DE APRIMORAR E SO DO CORPO.

            Peca na mochila nao tem onde guardar o `enhance` — ele mora no
            slot. Listar a mochila aqui mostraria o botao desligado em
            metade das pecas, sem explicar por quê
          */}
          {aprimorarAtivo ? (
            todas.length === 0 ? (
              <p className="inv-panel__empty">
                Nenhuma arma ou armadura para aprimorar. Equipe uma peça ou
                ache uma na mochila.
              </p>
            ) : (
              <>
                {/*
                  AS DUAS LISTAS, e nao so o corpo.

                  Quando o `enhance` vivia no slot, a aba mostrava so o
                  vestido — porque so ele tinha numero. Agora o numero e
                  da pECA, entao mochila entra: o jogador pode aprimorar o
                  item antes de vestir, e o nivel viaja com ele
                */}
{/*
                    UMA LISTA SO, COM AS DUAS FONTES JUNTAS.

                    ## POR QUE ANTES ERAM DOIS GRUPOS

                    "Equipado" e "Mochila" em dois blocos obrigavam o jogador a
                    varrer a tela duas vezes para achar a peca. E o titulo
                    repetia o que o card ja mostra: o slot tem a classe do
                    vestida desenhada nele mesmo

                    ## POR QUE O EQUIPADO CONTINUA PRIMEIRO

                    Porque e a ordem que o jogador espera: a peca que esta
                    valendo agora vem antes, e a da bolsa e a alternativa.
                    `todas` ja e `[...doCorpo, ...daMochila]`, entao a ordem
                    vem pronta
                  */}
                  {todas.length > 0 && (
                    <Grupo
                      itens={todas}
                      selecionado={selecionado}
                      onSelect={setSelecionado}
                    />
                  )}

                {/*
                  A TABELA DE RISCO fica DEPOIS das listas, pelo mesmo
                  motivo que a de chances do encantar: as pecas sao o que
                  o jogador veio escolher, e o risco e a informacao que
                  ele consulta depois de escolher
                */}
                <RiscoAprimoramento nivel={entry?.enhance ?? 0} />
              </>
            )
          ) : (
            <>
              {todas.length === 0 ? (
                <p className="inv-panel__empty">
                  Nenhuma arma ou armadura para encantar. Equipe uma peça
                  ou ache uma na mochila.
                </p>
              ) : (
                <>
                  {/*
                    O EQUIPADO vem ANTES da mochila.

                    E a ordem que o jogador espera: a peca que esta valendo
                    agora vem primeiro, e a da mochila e a alternativa. Com
                    a mochila na frente, o jogador veria um arco na mochila
                    e outro identico no corpo, e teria de adivinhar qual
                    dos dois a arte do slot estava vestindo
                  */}
{/* a MESMA lista unica da aba de aprimorar, e pela mesma razao */}
                    {todas.length > 0 && (
                      <Grupo
                        itens={todas}
                        selecionado={selecionado}
                        onSelect={setSelecionado}
                      />
                    )}
                </>
              )}

              <Chances />
            </>
          )}
        </div>
      </div>

      {/*
        O RODAPE: SO AS DUAS MOEDAS, NA DIREITA.

        ## POR QUE O `used/capacity` SUMIU

        E o pedido, e porque este painel e um painel de ACAO: ele mostra
        o preco da peca, o risco de quebrar e o ouro que paga. O espaco
        da mochila nao participa de nenhuma dessas contas — o jogador nao
        esta aqui para ver se tem lugar, esta aqui para ver se pode pagar.
        O numero ocupava a ponta esquerda do rodape sem dizer nada sobre
        o que o rodape e

        ## POR QUE AS DUAS MOEDAS COLADAS NA DIREITA

        Porque ouro e steel sao a MESMA pergunta — "quanto eu tenho" — e o
        steel e o que a propria aba de aprimorar cobra. Com o espaco fora,
        as duas viram o rodape inteiro: `justify-content: flex-end` as
        joga para a direita e o `gap` do `.inv-status` as separa

        E os glifos `◉` e `◈` sao os mesmos da badge da HUD e do rodape do
        inventario: reusar os tres lugares com o mesmo desenho e o que faz o
        jogador ler "1440" como ouro e "86" como steel sem processar nada
      */}
      <footer className="inv-status">
        <span className="inv-status__coins">
          <IconeMoeda moeda="coins" />
          {data.coins}
        </span>

        <span className="inv-status__coins inv-status__coins--steel">
          <IconeMoeda moeda="steel" />
          {data.steel ?? 0}
        </span>
      </footer>
    </section>
  );
}
