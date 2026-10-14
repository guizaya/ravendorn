import { useCallback, useMemo, useState } from "react";
import {
  getItem,
  ITEM_TYPE,
  rarityOf,
  RARITY_ORDER,
  RARITY_STYLE,
} from "../../data/items/index.js";
import {
  isEquippable,
  slotNameFor,
} from "../../game/equipment/Equipment.js";
import { canEnchantItem } from "../../data/enchant/index.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { destinosDoItem } from "../../game/collection/destinosDoItem.js";
import { SKILL_PACKS } from "../../data/skills/index.js";
import InvSlotView from "../UI/InvSlotView.jsx";
import ItemCard from "../UI/ItemCard.jsx";
import SlotMenuFloat from "../UI/SlotMenuFloat.jsx";
import IconeMoeda from "../UI/IconeMoeda.jsx";
import MochilaExpansaoModal from "./MochilaExpansaoModal.jsx";
import { MOCHILA_SLOTS_MAX } from "../../data/inventory/capacidade.js";
import {
  DEFAULT_LOOT_FILTER,
  LOOT_CATEGORIES,
  LOOT_CATEGORY_LABEL,
  normalizeLootFilter,
} from "../../game/loot/lootFilter.js";

/**
 * A SKILL DE UM ID, ou `null`.
 *
 * Percorre os packs das classes em vez de receber a classe como
 * argumento: o inventario mostra item de qualquer origem — loot, mercado,
 * loja — e nenhuma delas sabe a classe de quem esta olhando. Com o
 * argumento, cada chamador teria de descobrir a classe primeiro para
 * desenhar um rotulo
 *
 * Este arquivo so DESENHA. Quem decide se o livro ensina mesmo e o
 * servidor, no `aprenderHabilidade`, e este `null` serve para o rotulo
 * cair em "ensina a habilidade" em vez de quebrar
 */
function skillPeloId(skillId) {
  if (!skillId) return null;

  for (const pack of Object.values(SKILL_PACKS)) {
    const achada = pack.skills?.find((skill) => skill.id === skillId);

    if (achada) return achada;
  }

  return null;
}

/**
 * As abas da mochila.
 *
 * `types` e o filtro da aba, e o `[]` e um filtro que nao casa com
 * nada: e assim que a aba de runas existe sem mostrar item. Um
 * `null` devolveria TUDO, e a aba seria um duplicado da "Tudo"
 */
export const TABS = [
  { id: "all", label: "Tudo", icon: "▤", types: null },
  {
    id: "equip",
    label: "Equip.",
    icon: "⚔",
    types: [
      ITEM_TYPE.WEAPON,
      ITEM_TYPE.ARMOR,
      ITEM_TYPE.TRINKET,
    ],
  },
  {
    id: "material",
    label: "Mat.",
    icon: "◈",
    types: [ITEM_TYPE.MATERIAL],
  },
  {
    id: "rune",
    label: "Runas",
    // `ᚱ` e uma letra runica, e nao um emoji: nao ha variation
    // selector depois dela, entao o navegador desenha como glifo de
    // TEXTO e ela herda a cor da aba
    icon: "ᚱ",
    // `types` vazio, e nao `null`: com `null` o filtro devolve TUDO e
    // a aba de runas viraria uma copia da aba "Tudo"
    types: [],
  },
];

/**
 * As ordenacoes da mochila.
 *
 * A raridade e a padrao porque e o que o jogador procura primeiro: o
 * lendario no topo. O desempate e sempre o nome, para a grade nao
 * embaralhar entre duas aberturas do painel.
 */
const RARITY_RANK = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

const SORTS = [
  { id: "rarity", label: "Raridade" },
  { id: "name", label: "Nome" },
  { id: "count", label: "Quantidade" },
  { id: "value", label: "Valor" },
];

// area de cada peça no boneco de equipamento
const DOLL_AREA = {
  head: "head",
  gloves: "gloves",
  weapon: "weapon",
  weapon2: "weapon2",
  chest: "chest",
  legs: "legs",
  boots: "boots",
  trinket1: "trinket1",
  trinket2: "trinket2",
};

const STAT_LABELS = {
  attack: "ATQ",
  defense: "DEF",
  maxHp: "HP",
  speed: "VEL",
  attackSpeed: "VEL. ATQ",
  resourceRegen: "REG",
  resource: "REC",
};

const PERCENT_STATS = new Set(["attackSpeed", "resourceRegen"]);

function formatStat(key, value) {
  return PERCENT_STATS.has(key)
    ? `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`
    : `+${Math.round(value)}`;
}

export function SlotMenu({ actions, align, direction = "down" }) {
  if (actions.length === 0) return null;

  return (
    <span
      className={[
        "inv-menu",
        `inv-menu--${align}`,
        `inv-menu--${direction}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={[
            "inv-menu__action",
            action.danger ? "is-danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </span>
  );
}

/**
 * AS ACOES DE UM SLOT, e a lista que a caixa de opcoes mostra.
 *
 * ## POR QUE ESTE TRECO SAIU DO `ItemSlot`
 *
 * Porque o `ItemSlot` desenha um slot com menu. A mochila usa um
 * `ItemCard` — que tem o nome embaixo do icone — e o `ItemCard` nao
 * sabe montar acoes: ele so repassa o que o dono da lista passar
 *
 * Com a montagem presa dentro do `ItemSlot`, a grade da mochila recebia
 * `onUseItem`, `onDiscardItem` e os outros pelo `slotProps` e nenhum
 * deles era lido. O clique abria o card, a caixa de opcoes nao aparecia,
 * e nao havia como usar, vestir nem excluir NADA da mochila — nao era o
 * livro, era o inventario inteiro
 *
 * Uma funcao que os dois chamam nao deixa essa lista de acoes crescer em
 * dois lugares: um item novo entra aqui e aparece nos dois paineis
 */
function buildItemActions(entry, handlers) {
  const {
    onEquip,
    onUnequip,
    onDiscardItem,
    onDiscardEquipped,
    onUseItem,
    onEnchant,
    onEnhance,
    onOpenCollection,
    onOpenCodex,
    onSelecionar,
    classId = null,
  } = handlers;

  const item = getItem(entry.itemId);

  if (!item) return [];

/**
 * SO OFERECE "EQUIPAR" COM O `classId` DA SESSAO.
 *
 * E a regra: qualquer monstro solta a peca de qualquer classe, mas so a sua
 * classe veste. O `classId` chega do `player.className` e e o que separa a
 * espada do guerreiro — que o arqueiro pode ter na mochila e nao pode vestir
 * — da espada dele
 *
 * E `null` antes da sessao carregar, e nesse caso a funcao volta ao
 * comportamento antigo em vez de trancar a mochila: trancar o inventario
 * inteiro por causa de um pacote que nao chegou seria pior que a regra
 *
 * ## POR QUE `tier > 0` SAIU DESTA CONDICAO
 *
 * Porque o `tier` nao distingue "equipamento" de "material" — ele distingue
 * oNIVEL do drop. E o anel e o amuleto sao tier 0, os dois, entao
 * `equippable` era `false` e o menu nunca oferecia "Equipar": o jogador via
 * o anel na mochila, clicava, e a unica acao era "Excluir"
 *
 * O `type` JA separa as duas coisas, e e a propriedade que o motor le:
 * `trinket`, `weapon` e `armor` sao equipaveis, `material` nao. O
 * `Equipment.slotForItem` decide o destino pelo mesmo `type` — entao era
 * este teste que discordava do motor, e ele estava errado
 *
 * Trocar `tier > 0` por nada nao abre nenhuma porta nova: o `type` continua
 * barrando o material, e o `canEquip` do servidor continua conferindo o
 * destino antes de vestir
 */
const equippable =
  item.type !== ITEM_TYPE.MATERIAL &&
  isEquippable(item, classId);

  /**
   * ESTA PECA ACEITA AFIXO? — e por consequencia TAMBEM APRIMORAMENTO.
   *
   * E o mesmo `canEnchantItem` que o painel usa para montar as DUAS listas
   * dele, e as duas abas — encantar e aprimorar — filtram pela MESMA
   * funcao. E por isso que uma so pergunta serve para as duas opcoes do
   * menu: se as perguntas fossem separadas, uma peca marcada aqui como
   * "Aprimorar" poderia nao aparecer na aba, e o jogador abriria o painel
   * vazio procurando o item que ele acabou de clicar
   *
   * O nome ficou `encantavel` porque foi o primeiro dos dois, mas ele hoje
   * responde pelos dois
   */
  const encantavel = canEnchantItem(item.id);

  const actions = [];

/**
   * O ATALHO DE COLECAO, E SO DE COLECAO.
   *
   * ## POR QUE O CODEX SAIU
   *
   * Porque a colecao responde "para que serve este material" e o codex
   * responde "de onde cai este drop" — e o item que o jogador tem na mao e o
   * INGREDIENTE, nao a prova. Um osso quebrado no inventario nao diz de que
   * monstro veio: diz o que o jogador pode fazer com ele agora. O atalho do
   * codex apontava para uma lista de criaturas que ele nao escolheu, e o
   * jogadorclicava sem saber o que esperava
   *
   * A busca por `criaturasQueDropam` continua viva no helper, porque e o que
   * decide se o item TEM relacao. O que saiu foi so o botao
   */
  const destinos = destinosDoItem(entry.itemId);

  if (destinos?.temColecao && onOpenCollection) {
    actions.push({
      id: "colecao",
      label:
        destinos.colecoes.length > 1
          ? `Ver na Colecao · ${destinos.colecoes.length} receitas`
          : "Ver na Colecao",
run: () => onOpenCollection(entry.itemId),
    });
  }

  if (entry.equipped) {
    if (onUnequip) {
      actions.push({
        id: "unequip",
        label: "Desequipar",
        run: () => onUnequip(entry.slotId),
      });
    }

    if (encantavel && onEnchant) {
      actions.push({
        id: "enchant",
        label: "Encantar",
        run: () => onEnchant(entry),
      });
    }

    /**
     * APRIMORAR, NA PECA VESTIDA.
     *
     * Fica logo abaixo do "Encantar" e antes do "Excluir", pelo mesmo
     * motivo do encantar: sao duas transformacoes da mesma peca, e a
     * destrutiva fica por ultimo
     *
     * ## POR QUE A VESTIDA TAMBEM TEM, E A MOCHILA TAMBEM
     *
     * Porque o `enhance` passou a morar na PECA e nao no slot, e as DUAS
     * listas do painel de aprimorar — corpo e mochila — aceitam a peca. A
     * regra e a mesma do encantar acima: as duas abas filtram pelo mesmo
     * `canEnchantItem`, entao o que o menu oferece e sempre o que o painel
     * mostra
     */
    if (encantavel && onEnhance) {
      actions.push({
        id: "enhance",
        label: "Aprimorar",
        run: () => onEnhance(entry),
      });
    }

    if (onDiscardEquipped) {
      actions.push({
        id: "discard",
        label: "Excluir",
        danger: true,
        run: () => onDiscardEquipped(entry.slotId),
      });
    }
  } else {
    if (equippable && onEquip) {
      // O rotulo diz ONDE a peca vai: "Equipar" num slot livre
      // qualquer era uma promessa vaga
      const destino = slotNameFor(item);

      actions.push({
        id: "equip",
        label: destino ? `Equipar · ${destino}` : "Equipar",
        run: () => onEquip(entry),
      });
    }

    if (item.use && onUseItem) {
      const partes = [];

      if (item.use.heal) partes.push(`${item.use.heal} de vida`);
      if (item.use.restoreResource) {
        partes.push(`${item.use.restoreResource} de recurso`);
      }

      /**
       * O LIVRO, e o NOME DA SKILL no rotulo.
       *
       * Sem esta parte o botao dizia so "Usar", e "Usar" e um botao que
       * o jogador ja leu trinta vezes em pocaos sem olhar. Here o que
       * ele esta prestes a perder 150 moedas decide, e o rotulo e o
       * lugar mais barato de dizer isso
       *
       * O nome vem do pack pelo id, e nao de um texto escrito no item:
       * renomear a skill no catalogo muda este rotulo junto, e nao
       * deixaria "Usar" aqui falando um nome velho
       */
      if (item.use.teachSkill) {
        const skill = skillPeloId(item.use.teachSkill);

        partes.push(
          skill ? `ensina ${skill.name}` : "ensina a habilidade",
        );
      }

      const efeito = partes.join(" e ");

      actions.push({
        id: "use",
        label: efeito ? `Usar · ${efeito}` : "Usar",
        run: () => onUseItem(entry),
      });
    }

    /**
     * ENCANTAR, na mochila.
     *
     * Fica entre "Usar" e "Excluir": e uma acao de transformação, que vem
     * antes da acao destrutiva, e nunca antes de "Equipar" — vestir a peca
     * e o que o jogador quer quando abre um item da mochila
     */
    if (encantavel && onEnchant) {
      actions.push({
        id: "enchant",
        label: "Encantar",
        run: () => onEnchant(entry),
      });
    }

    /**
     * APRIMORAR, DEPOIS DE ENCANTAR E ANTES DE EXCLUIR.
     *
     * ## POR QUE A ORMA
     *
     * As duas sao transformacoes da MESMA peca, e o encantar vem primeiro
     * porque e o que maisunknown sobre a peca: um afixo muda o numero que
     * o jogador ve e o preco que ele paga, entao afixar antes de subir o
     * nivel faz sentido — e e a ordem que a aba do painel tambem usa
     *
     * E antes de "Excluir" por causa do que ja valia para o encantar: a
     * acao destrutiva e sempre a ultima
     *
     * ## E POR QUE O ROTAULO NAO PROMETE O NIVEL
     *
     * Porque o面板 mostra `+0%` e o resultado depende do sorteio. Um
     * "Aprimorar para +1" no menu seria uma promessa que o painel pode
     * desmentir trinta pixels depois — e o menu nao tem onde mostrar a
     * tabela de risco para justificar
     */
    if (encantavel && onEnhance) {
      actions.push({
        id: "enhance",
        label: "Aprimorar",
        run: () => onEnhance(entry),
      });
    }

    if (onSelecionar) {
      /**
       * SELECIONAR, ANTES DE EXCLUIR E DEPOIS DE APRIMORAR.
       *
       * ## O QUE O CLIQUE FAZ
       *
       * Marca ESTE item e liga o modo de marcacao. A partir dai, clicar em
       * qualquer outro item da mochila marca em vez de abrir o menu — que e
       * a razao de a acao entrar no menu em vez de virar um botao na barra:
       * o jogador ja esta olhando para o item que quer marcar
       *
       * ## POR QUE ANTES DE "EXCLUIR"
       *
       * Porque a acao destrutiva e sempre a ultima, e porque marcar e o que
       * leva a ela. O rotulo e so "Selecionar" e nao "Selecionar para
       * excluir" porque o item marcado nao vai para o lixo: ele vai para a
       * fila da barra, e o lixeira la embaixo continua sendo uma decisao
       * separada, com o numero na frente
       *
       * ## E POR QUE O MODO NAO SAI SOZINHO
       *
       * Porque ele tem saida propria: o "Concluir" da barra de marcacao, que
       * so aparece quando ha algo marcado. Um item marcado e esquecido
       * levaria a proxima exclusive junto sem o jogador querer
       */
      actions.push({
        id: "selecionar",
        label: "Selecionar",
        run: () => onSelecionar(entry),
      });
    }

    if (onDiscardItem) {
      actions.push({
        id: "discard",
        label: "Excluir",
        danger: true,
        run: () => onDiscardItem(entry.uid),
      });
    }
  }

  return actions;
}

export function ItemSlot({
  entry,
  onEquip,
  onUnequip,
  onDiscardItem,
  onDiscardEquipped,
  onUseItem,
  onEnchant,
  onEnhance,
  onOpenCollection,
  onOpenCodex,
  classId = null,
  compact = false,
  area,
  menuOpen = false,
  onToggleMenu,
}) {
  const item = getItem(entry.itemId);

  /**
   * PARA ONDE A CAIXA ABRE: para baixo ou para cima.
   *
   * ## POR QUE ISTO EXISTE
   *
   * A caixa e `position: absolute` dentro do slot, entao ela NAO tem
   * lugar na tela: ela tem lugar no painel. E o painel tem
   * `overflow: hidden`, e a lista da mochila tem `overflow-y: auto`. Uma
   * caixa que abre para baixo e CORTADA no item da ultima linha — e o
   * slot das botas, no boneco, e exatamente um deles
   *
   * Abrir para cima resolve, mas quebra o item da PRIMEIRA linha. Nao ha
   * um lado que serve para todos: quem decide e a posicao do slot na
   * hora de abrir
   *
   * ## POR QUE MEDIR E NAO ADIVINHAR POR INDICE
   *
   * Poderia ser uma regra de "linha par abre para cima", que e o tipo de
   * coisa que funciona ate a lista ter rolagem. Medindo o retangulo do
   * slot contra o do container, a regra continua valendo com a lista
   * rolada, com o painel meio na tela e com o boneco ter so as botas
   * vestidas
   *
   * ## POR QUE O `event`, E NAO UM `ref`
   *
   * O `event.currentTarget` e o botao que o jogador apertou, e dele sai o
   * slot e o container por `closest`. Um `ref` exigiria que o
   * `InvSlotView` — que e compartilhado com o mercado —aceitasse
   *_forwardRef_, e o mercado passaria a pagar por uma referencia que
   * nao usa
   */
  const [direcao, setDirecao] = useState("down");

  if (!item) return null;

  /**
   * AS ACOES ANTES DO `abrirMenu`, e nao depois.
   *
   * Porque o `abrirMenu` agora conta quantas acoes existem para decidir se a
   * caixa cabe embaixo do slot. Ele e definido antes desta linha, mas so
   * EXECUTA no clique — e nesse momento `actions` ja existe. Declarar depois
   * funciona em tempo de execucao, mas deixa a leitura atravessando quinze
   * linhas de codigo para uma variavel que e da proxima frase
   */
  const actions = buildItemActions(entry, {
    onEquip,
    onUnequip,
    onDiscardItem,
    onDiscardEquipped,
    onUseItem,
    onEnchant,
    onEnhance,
    onOpenCollection,
    onOpenCodex,
  });

  const abrirMenu = (clicado, event) => {
    const slot = event?.currentTarget?.closest?.(".inv-slot");

    const container = slot?.closest?.(
      ".inv-content, .inv-equip__grid, .inv-panel__body",
    );

    if (!slot || !container) {
      onToggleMenu?.(clicado);
      return;
    }

    const caixaDoSlot = slot.getBoundingClientRect();
    const caixaDoContainer = container.getBoundingClientRect();

    /**
     * A ALTURA QUE A CAIXA PRECISA, DERIVADA DO NUMERO DE ACOES.
     *
     * ## POR QUE NAO E MAIS UM NUMERO FIXO
     *
     * Porque o numero fixo era de quando o menu tinha DUAS acoes, e o menu
     * hoje tem ate QUATRO — vestir, encantar, aprimorar e excluir sao as
     * quatro ao mesmo tempo. Com o valor velho, uma peca de baixo da lista
     * abria a caixa para baixo, a caixa passava da borda e o painel
     * cortava: o jogador via o item selecionado e nenhuma opcao
     *
     * ## POR QUE CONTAR E MAIS BARATO QUE MEDIR
     *
     * Porque o `actions` ja esta montado quando a caixa abre, e ele e a
     * VERDADE do que o jogador vai ver. Medir exigiria renderizar a caixa
     * primeiro e ler o `offsetHeight` depois: um segundo layout a cada clique,
     * so para descobrir um numero que a contagem ja diz
     *
     *## E POR QUE 25PX POR ACAO
     *
     * E o `padding: 6px` de cima e de baixo mais a linha de 10px do
     * `.inv-menu__action`, mais a borda de 1px entre as linhas. Se um dia o
     * item da acao mudar de altura, este numero e o primeiro a passar a
     * mentir — e ele mente para o lado seguro: na duvida, trata como "nao
     * cabe embaixo" e abre para cima
     */
    const ALTURA_POR_ACAO = 25;

    const alturaDaCaixa =
      actions.length * ALTURA_POR_ACAO + 8;

    const espacoAbaixo =
      caixaDoContainer.bottom - caixaDoSlot.bottom;

    setDirecao(
      espacoAbaixo < alturaDaCaixa ? "up" : "down",
    );

    onToggleMenu?.(clicado);
  };

  return (
    /**
     * O BOTAO DE CLIQUE E O DO `InvSlotView`, e nao um aqui.
     *
     * Este componente desenhavo um `<button class="inv-slot__hit">`
     * proprio, DENTRO do `InvSlotView` — que ja traz o seu. Sao dois
     * botoes com a mesma classe no mesmo slot, e num `display: grid` sem
     * `grid-template-rows` cada filho ocupa uma linha propria: o do
     * `InvSlotView` fica na linha 1, que e onde o jogador ve o icone, e o
     * de baixo empurrava para fora da caixa.
     *
     * O efeito era que o clique batia no botao do `InvSlotView`, cujo
     * `onSelect` NUNCA era passado aqui — entao `onSelect?.(entry)` era
     * um no-op silencioso e a caixa de opcoes nao abria em lugar nenhum.
     * O botao que funcionava estava embaixo da dobra
     *
     * Passar o `onToggleMenu` pelo `onSelect` resolve os dois: um botao
     * so, e ele e o que o jogador esta clicando de verdade
     */
    <InvSlotView
      entry={entry}
      compact={compact}
      area={area}
      className={menuOpen ? "is-menu" : ""}
      onSelect={abrirMenu}
      selected={menuOpen}
    >
      {menuOpen && (
        <SlotMenu
          actions={actions}
          align={area ? "left" : "center"}
          direction={direcao}
        />
      )}
    </InvSlotView>
  );
}

function DollSlot({
    slot,
    onUnequip,
    onDiscardEquipped,
    onEnchant,
    onEnhance,
    onOpenCollection,
    onOpenCodex,
    classId,
    menuOpen,
    onToggleMenu,
  }) {
  const area = DOLL_AREA[slot.id];

  if (slot.itemId) {
    return (
      <ItemSlot
        compact
        area={area}
        menuOpen={menuOpen}
        onToggleMenu={onToggleMenu}
        entry={{
          itemId: slot.itemId,
          // A raridade da variante vestida: sem ela o slot caia na do
          // catalogo e mostrava a arte da raridade base
          rarity: slot.rarity ?? null,
          count: 1,
          slotId: slot.id,
          equipped: true,

          /**
           * O NIVEL DE APRIMORAMENTO, que o `InvSlotView` le para o
           * badge do canto.
           *
           * O dado JA VINHA no `equipment.slots` do snapshot, e esta
           * entrada e montada aqui, na mao. Sem esta linha o campo
           * ficava `undefined` e o badge nunca aparecia no inventario —
           * a peca estava aprimorada e a tela nao dizia
           */
enhance: slot.enhance ?? 0,

            /**
             * O AFIXO DA PECA VESTIDA, que faltava.
             *
             * O `enhance` acima ja vinha desde antes; o `enchant` nao. E o
             * `equipment.setSlotEnchant` grava o afixo no SLOT, entao o dado
             * existia no snapshot o tempo todo — o que nao existia era a linha
             * que o copiava para a entrada montada aqui
             *
             * Sem ela, a peca vestida mostrava o nivel do aprimoramento e o
             * resto do texto, e nunca a linha do afixo. Era a diferenca entre
             * a peca na mochila e a peca no corpo, com os dois caminhos
             * alimentando o mesmo `ItemTooltip`
             */
            enchant: slot.enchant ?? null,
          }}
onUnequip={onUnequip}
            onDiscardEquipped={onDiscardEquipped}
            onEnchant={onEnchant}
            onEnhance={onEnhance}
            onOpenCollection={onOpenCollection}
            onOpenCodex={onOpenCodex}
            classId={classId}
          />
    );
  }

  return (
    <div
      className="inv-slot inv-slot--empty"
      style={{ gridArea: area }}
      data-tip={`${slot.name} — vazio`}
    >
      <span className="inv-slot__icon">{slot.icon}</span>
    </div>
  );
}

function EquipmentDoll({
    equipment,
    onUnequip,
    onDiscardEquipped,
    onEnchant,
    onEnhance,
    onOpenCollection,
    onOpenCodex,
    classId = null,
    menu,
    onToggleMenu,
  }) {
  const slots = equipment?.slots ?? [];

  return (
    <div className="inv-equip__grid">
      {slots.map((slot) => (
        <DollSlot
          key={slot.id}
          slot={slot}
          menuOpen={menu === slot.id}
          onToggleMenu={onToggleMenu}
          onUnequip={onUnequip}
          onDiscardEquipped={onDiscardEquipped}
          onEnchant={onEnchant}
          onEnhance={onEnhance}
        />
      ))}
    </div>
  );
}

/**
 * O CARTÃO DE POWER.
 *
 * ## POR QUE NÃO TEM MAIS O "EQUIPAR MELHORES"
 *
 * Porque o jogador precisa ver POR QUE uma peça é melhor do que a que ele
 * está vestindo. O botão trocava as cinco peças do corpo numa tacada sem
 * nenhuma janela de revisão, e o resultado era o personagem com "+40 ATQ"
 * e nenhum lugar explicando de onde veio o número. O jogador que não
 * entendeu a troca não sabia desfazê-la
 *
 * ## POR QUE A PROPRIEDADE `onAutoEquip` SAIU JUNTO
 *
 * Porque ela existia só para esse botão. Deixada na assinatura, ela
 * continuaria sendo passada do `HUD` até aqui sem nada consumir — e a
 * próxima pessoa a ler este componente contaria quantas ações o inventário
 * oferece e encontraria uma a mais do que a tela mostra
 */
function PowerCard({ equipment }) {
  const bonuses = Object.entries(equipment?.bonuses ?? {});

  return (
    <div className="inv-power">
      <div className="inv-power__head">
        <span className="inv-power__label">Power</span>
        <strong className="inv-power__value">
          {equipment?.power ?? 0}
        </strong>
      </div>

      {bonuses.length === 0 ? (
        <p className="inv-power__empty">
          Nenhum equipamento vestido.
        </p>
      ) : (
        <ul className="inv-stat-grid">
          {bonuses.map(([key, value]) => (
            <li key={key} className="inv-stat">
              <small>{STAT_LABELS[key] ?? key}</small>
              <b>{formatStat(key, value)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FilterPanel({
  filter,
  onChange,
  onReset,
  onPrune,
  onClose,
}) {
  return (
    <div className="inv-filter">
      <header className="inv-filter__head">
        <strong>Filtro de coleta</strong>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar filtro"
        >
          ✕
        </button>
      </header>

      <p className="inv-filter__hint">
        Item abaixo da raridade escolhida é descartado na hora:
        não dropara, não vai para o chão e não entra na mochila.
      </p>

      {LOOT_CATEGORIES.map((category) => (
        <div key={category} className="inv-filter__row">
          <span className="inv-filter__label">
            {LOOT_CATEGORY_LABEL[category]}
          </span>

          <div className="inv-filter__choices">
            <button
              type="button"
              className={[
                "inv-filter__choice",
                filter[category] === null ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(category, null)}
            >
              Tudo
            </button>

            {RARITY_ORDER.map((rarity) => {
              const style = RARITY_STYLE[rarity];

              return (
                <button
                  key={rarity}
                  type="button"
                  className={[
                    "inv-filter__choice",
                    filter[category] === rarity
                      ? "is-active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--rarity": style.color }}
                  onClick={() => onChange(category, rarity)}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="inv-filter__foot">
        <button
          type="button"
          className="inv-filter__action"
          onClick={onPrune}
        >
          Limpar mochila
        </button>

        <button
          type="button"
          className="inv-filter__action"
          onClick={onReset}
        >
          Padrão
        </button>
      </div>
    </div>
  );
}

export default function InventoryPanel({
  inventory,
  equipment,
  player,
  lootFilter,
  onClose,
  onEquip,
  onUnequip,
  onDiscardItem,
  onDiscardEquipped,
  onUseItem,
onEnchant,
onEnhance,
onOpenCollection,
onOpenCodex,
onFilterChange,
onFilterReset,
onFilterPrune,
  onExpandInventory,
}) {
  /**
   * A CLASSE DA SESSAO, lida uma vez — e pelo ID, e nao pelo nome.
   *
   * ## POR QUE PELO ID
   *
   * Porque `player.className` traz o NOME de exibicao ("Arbalist"), e a
   * regra de equipar compara o ID ("arbalist"), que e o valor gravado em
   * `item.classes` e no catalogo de criaturas. Comparar "Arbalist" com
   * "arbalist" dava sempre falso, e a peca da propria classe era tratada
   * como de outra — o menu perdia o "Equipar" de tudo
   *
   * O `CHARACTER_CLASSES` e a lista de verdade das quatro classes do jogo.
   * Buscar por nome e devolver o id e o que fecha a ponte entre o que o
   * servidor manda ler e o que o catalogo guarda
   */
  const classeDaSessao = useMemo(() => {
    const nome = player?.className;

    if (!nome) return null;

    /* ja e o id: um save ou um teste pode mandar "arbalist" direto */
    const classes = Object.values(CHARACTER_CLASSES ?? {});
    const achada = classes.find(
      (classe) => classe.id === nome || classe.name === nome,
    );

    return achada?.id ?? null;
  }, [player?.className]);

  const [category, setCategory] = useState("all");
  const [menu, setMenu] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  /**
   * A BOX DO CRITERIO DE ORDENACAO, e ela e IRMA DA OUTRA
   *
   * Sao dois ajustes que nao cabem na barra: o filtro de coleta e o criterio
   * de ordenacao. Cada um abre a sua box, e so uma por vez — as duas abertas
   * empilhariam no mesmo canto e o jogador nao saberia qual estava mexendo
   */
  const [raridadeOpen, setRaridadeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("rarity");

  /**
   * A MODAL DE EXPANSÃO, e ela é estado do PAINEL e não da modal.
   *
   * Porque quem abre é o `+` da barra, que vive aqui. O `Esc` é o ponto
   * que importa: o `HUD` escuta `Escape` na `window` e chama `alternarPause`,
   * que fecha a mochila E abre a pausa. A modal escuta em `capture` e para a
   * propagação, então um aperto fecha só ela — sem a troca do painel inteiro
   * por um pause que o jogador não pediu
   */
  const [expandindo, setExpandindo] = useState(false);

  /**
   * A EXCLUSAO EM LOTE.
   *
   * `marcando` liga o modo: enquanto for `true`, o clique num item MARCA em vez
   * de abrir o menu. E `marcados` guarda os `uid` marcados
   *
   * ## POR QUE UM SO ESTADO COM UM SET
   *
   * Porque os dois se confundem se ficarem separados: `marcando` ligado com
   * nada marcado e o modo ligado sem nada para fazer, que e so uma barreira
   * entre o jogador e o menu. E o reverse — itens marcados com o modo
   * desligado — e um estado invisivel, que e o pior tipo de estado
   */
  const [marcando, setMarcando] = useState(false);

  const [marcados, setMarcados] = useState(() => new Set());

  /**
   * MARCAR OU DESMARCAR UM ITEM.
   *
   * Um `Set` novo a cada clique, e nao mutar o antigo: o React compara a
   * referencia para saber se o estado mudou, e mutar o mesmo `Set` deixaria a
   * tela parada com o clique dado
   */
  const alternarMarca = (uid) => {
    setMarcados((antes) => {
      const depois = new Set(antes);

      if (depois.has(uid)) depois.delete(uid);
      else depois.add(uid);

      return depois;
    });
  };

  /**
   * SAIR DO MODO DE MARCAÇÃO.
   *
   * Limpa os marcados junto, porque os dois estados nascem e morrem juntos.
   * Sair com marcas pendentes deixaria o jogador voltar ao uso normal do
   * inventario e ainda ver o quadrado nos itens, sem nenhuma explicacao
   */
  const sairMarcando = useCallback(() => {
    setMarcando(false);
    setMarcados(new Set());
  }, []);

  const filter = useMemo(
    () => normalizeLootFilter(lootFilter),
    [lootFilter],
  );

  const summary = inventory ?? {
    coins: 0,
    used: 0,
    capacity: 20,
    isFull: false,
    items: [],
  };

  const hp = Math.max(0, Math.round(player?.hp ?? 0));
  const maxHp = Math.max(1, Math.round(player?.maxHp ?? 0));
  const hpPercent = Math.min(100, (hp / maxHp) * 100);

  const entries = summary.items ?? [];

  /**
   * A MOCHILA JÁ CHEGOU NO TETO?
   *
   * Lido do `capacity` que o servidor mandou, e nao da contagem de compras:
   * o `capacity` e o que a mochila USA, e e ele que o save e a grade leem.
   * Uma contagem de compras aqui divergiria do numero de slots da tela
   */
  const noLimite = summary.capacity >= MOCHILA_SLOTS_MAX;

  const capacityPercent = Math.min(
    100,
    (summary.used / Math.max(1, summary.capacity)) * 100,
  );

  const closeMenu = () => setMenu(null);

  const toggleMenu = (entry) =>
    setMenu((current) => {
      const id = entry.slotId ?? entry.uid;

      return current === id ? null : id;
    });

  const discardItem = (uid) => {
    closeMenu();
    onDiscardItem?.(uid);
  };

  const discardEquipped = (slotId) => {
    closeMenu();
    onDiscardEquipped?.(slotId);
  };

  const useItem = (entry) => {
    closeMenu();
    onUseItem?.(entry);
  };

  /**
   * ENCANTAR: fecha a mochila e entrega a peca ao painel de encantar.
   *
   * O `closeMenu` vem antes porque o painel de inventario vai sair de
   * cena — os dois paineis sao o mesmo `PAINEL`, entao abrir o de
   * encantar ja desmonta este. Sem fechar a caixa aqui, a troca
   * aconteceria um quadro depois e a caixa piscaria no item errado
   */
  const enchantItem = (entry) => {
    closeMenu();
    onEnchant?.(entry);
  };

  /**
   * O "APRIMORAR" do menu, e o `closeMenu` vem antes pelo MESMO motivo do
   * `enchantItem` acima.
   *
   * Inventario e aprimorar tambem sao o mesmo `PAINEL`: abrir um fecha o
   * outro. Sem fechar a caixa aqui, a troca aconteceria um quadro depois e
   * a caixa piscaria no item errado — que e o sintoma exato que fez o
   * "Encantar" parecer quebrado antes de o `closeMenu` existir
   */
  const enhanceItem = (entry) => {
    closeMenu();
    onEnhance?.(entry);
  };

  const changeFilter = (key, value) => {
    closeMenu();
    onFilterChange?.(key, value);
  };

  // a contagem de cada aba, calculada uma vez por mudanca da mochila
/**
     * AS CONTAGENS DAS ABAS, E ELAS NAO PODEM CONTER O QUE ESTA VESTIDO.
     *
     * E o mesmo filtro da grade, pelo mesmo motivo: o numero no canto da aba
     * e "quantoitem eu tenho", e o jogador que esta com 3 armaduras e uma
     * vestida tem TRES para guardar, nao quatro. Sem este `!entry.equipped`,
     * a aba marcava um item a mais do que a lista mostrava — e a conta nao
     * fechava com nada que o jogador pudesse conferir
     */
    const tabCounts = useMemo(() => {
      const counts = {};

      for (const tab of TABS) {
        counts[tab.id] = tab.types
          ? entries.filter((entry) => {
              if (entry.equipped) return false;

              const def = getItem(entry.itemId);

              return def && tab.types.includes(def.type);
            }).length
          : entries.filter((entry) => !entry.equipped).length;
      }

      return counts;
    }, [entries]);

  // aba + busca + ordenacao num passo so, ja com o item resolvido
  const cards = useMemo(() => {
    const tab = TABS.find((entry) => entry.id === category);
    const term = searchTerm.trim().toLowerCase();

    const list = [];

    for (const entry of entries) {
      /**
       * O QUE JA ESTA NO CORPO NAO APARECE NA MOCHILA.
       *
       * ## POR QUE ESTE `continue` EXISTE
       *
       * Porque a peca vestida CONTINUA em `inventory.stacks` — ela so ganha
       * `equipped: true` e um `slotId`, mas continua na pilha. O `summary`
       * marca o campo e nao tira a entrada, entao sem este filtro a mesma
       * armadura aparecia na grade da mochila E no boneco, e o jogador
       * recebia "Desequipar" numa peca que ele ja estava usando
       *
       * ## POR QUE ISSO NAO E PAPEL DO `summary`
       *
       * Porque o `summary` e o estado do jogo, e o estado do jogo e o mesmo
       * para o inventario, para o bau e para o mercado — o mercado precisa
       * saber que aquela peca esta vestida para nao vender o que o jogador
       * esta usando. Filtrar aqui seria mentir com o estado
       *
       * E o filtro fica DEPOIS do `getItem`, porque uma pilha cujo item saiu
       * do catalogo precisa ser descartada do mesmo jeito, e nao aparecer
       * como uma celula quebrada
       */
      if (entry.equipped) continue;

      const item = getItem(entry.itemId);

      if (!item) continue;
      if (tab?.types && !tab.types.includes(item.type)) continue;
      if (term && !item.name.toLowerCase().includes(term)) continue;

      const raridadeId = entry.rarity ?? item.rarity;

      list.push({
        entry,
        item,
        raridadeId,
        style: RARITY_STYLE[raridadeId] ?? rarityOf(item),
      });
    }

    const byName = (a, b) => a.item.name.localeCompare(b.item.name);

    /**
     * A ORDEM DO AFIXO, e o que ele FAZ quando falta.
     *
     * Um item SEM afixo e um item COM afixo epic nao podem empatar: o
     * epic de afixo vale mais que qualquer peca sem afixo, e o jogador
     * procura exatamente essa peca
     *
     * O `99` e o "sem afixo". Ele fica depois de TUDO, inclusive depois de um
     * afixo lendario — e `RARITY_RANK` comeca no 0, entao qualquer afixo real
     * (0..4) fica antes do 99
     */
    const rankDoAfixo = (card) => {
      const afixo = card.entry?.enchant;

      if (!afixo?.rarity) return 99;

      return RARITY_RANK[afixo.rarity] ?? 99;
    };

    /**
     * A RARIDADE DA PECA PRIMEIRO, E O AFIXO COMO DESEMPATE.
     *
     * ## POR QUE O AFIXO NAO VENCE MAIS
     *
     * Porque a raridade da peca e o que o jogador escolheu: e a variante que
     * ele fabricou, que ele comprou, que ele guardou a sorte de achar. Duas
     * pecas da MESMA raridade so se distinguem pelo afixo, e e por ele que
     * elas devem se ordenar — mas uma peca lendaria SEM afixo e melhor que
     * uma comum com afixo epico, porque o valor dela esta no numero de
     * ataque que a variante entrega
     *
     * ## O QUE O AFIXO RESOLVE AQUI
     *
     * Exatamente o caso em que ele e a UNICA informacao que distingue as
     * pecas: duas COMMON, uma com afixo epico e outra sem. Sem este desempate
     * elas cairiam no nome, e o jogador veria a boa atras da ruim
     */
    const porAfixo = (a, b) =>
      (RARITY_RANK[a.raridadeId] ?? 9) -
        (RARITY_RANK[b.raridadeId] ?? 9) ||
      rankDoAfixo(a) - rankDoAfixo(b) ||
      byName(a, b);

    list.sort((a, b) => {
      if (sort === "name") return byName(a, b);

      if (sort === "count") {
        return b.entry.count - a.entry.count || byName(a, b);
      }

      if (sort === "value") {
        return (
          (b.item.value ?? 0) * b.entry.count -
            (a.item.value ?? 0) * a.entry.count || byName(a, b)
        );
      }

      return porAfixo(a, b);
    });

    return list;
  }, [entries, category, searchTerm, sort]);

/**
     * O VALOR DA MOCHILA, e NAO DO PERSONAGEM.
     *
     * ## POR QUE FILTRA O QUE ESTA VESTIDO
     *
     * Porque este numero responde "quanto vale o que eu posso perder". A peca
     * vestida nao esta na bolsa, entao ela nao entra no que o jogador arrisca
     * ao trocar de filtro ou ao limpar a mochila
     *
     * E o mesmo filtro da grade e das abas, para os tres numeros contarem a
     * mesma coisa. Com um deles sem o filtro, o painel mostraria "12 itens" na
     * aba e "11" na grade, e o jogador nao saberia qual dos dois era o
     * Mentira
     */
    const totalValue = entries.reduce((total, entry) => {
      if (entry.equipped) return total;

      const item = getItem(entry.itemId);

      return total + (item?.value ?? 0) * entry.count;
    }, 0);

  const filtering =
    filter[LOOT_CATEGORIES[0]] !== null ||
    filter[LOOT_CATEGORIES[1]] !== null;

  const searching = searchTerm.trim() !== "";

  /**
   * OS SLOTS VAZIOS, E QUANDO ELES DESAPARECEM
   *
   * ## POR QUE A MOCHILA DESENHA OS 20 ESPACOS
   *
   * Porque a mochila tem 20 e o jogador precisa VER que tem 20. Com a grade
   * so dos itens, uma mochila com 3 pecas mostrava 3 quadrados e o resto da
   * tela era um vazio sem informacao: nao dava para saber se havia espaco,
   * nem quanto, nem onde o proximo item vai cair
   *
   * ## E POR QUE SO COM A MOCHILA CHEIA DE NADA
   *
   * Porque o padding e da MOCHILA, e nao da busca. Com a busca ligada ou com
   * uma categoria filtrada, a lista nao e a mochila — e um recorte dela.
   * Encher o resultado da busca com 17 quadrados vazios faria o jogador
   * contar buraco em vez de ler o que ele procurou
   *
   * ## E POR QUE O `Math.max` COM ZERO
   *
   * Porque `cards` pode passar da capacidade quando um filtro devolve mais
   * linhas que slots — e nesse caso nao existe espaco vazio para desenhar,
   * e um `length` negativo viraria um numero de buracos
   */
  const semFiltro = !searching && category === "all";

  /**
   * QUANTOS ESPACOS FICAM VAZIOS.
   *
   * O `Math.max` com zero e obrigatorio: `cards` pode passar da capacidade
   * quando um filtro devolve mais linhas que slots, e nesse caso nao existe
   * espaco vazio para desenhar — um `length` negativo viraria um numero de
   * buracos
   */
  const slotsVazios = semFiltro
    ? Math.max(0, summary.capacity - cards.length)
    : 0;

  /**
   * A LISTA DE ESPACOS VAZIOS, montada aqui e nao dentro do JSX.
   *
   * Porque um `{Array.from({ length }, (_, i) => (...))}` no meio da
   * marcacao e um objeto literal disfarçado de array: o `{ length: n }`
   * abre um bloco, e qualquer chave escrita ao lado dele vira sintaxe. Fazer
   * a conta em uma `const` deixa o JSX com um `{vazios.map(...)}` que so
   * parece o que e
   */
  const vazios = useMemo(
    () => Array.from({ length: slotsVazios }, (_, i) => `vazio-${i}`),
    [slotsVazios],
  );

  return (
    <section className="inv-panel inv-v2">
      <header className="inv-header">
        <div className="inv-header__left">

          <div className="inv-header__titles">
            <h2 className="inv-title">Inventário</h2>

            </div>
        </div>

        <div className="inv-header__right">
          <div className="inv-search">
            <span className="inv-search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="text"
              className="inv-search__input"
              placeholder="Pesquisar itens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="inv-search__clear"
                onClick={() => setSearchTerm("")}
                data-tip="Limpar pesquisa"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className={[
              "inv-gear",
              filterOpen ? "is-active" : "",
              filtering ? "is-filtering" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              closeMenu();
              setFilterOpen((current) => !current);
            }}
            data-tip="Configurar filtro de coleta"
          >
            ⚙
          </button>

          {/*
            O `+` DE EXPANDIR, AO LADO DO `⚙`.

            ## POR QUE ELE NAO ABRE A MODAL SOZINHO

            Porque expandir a mochila e a unica acao do inventario que tem
            PRECO. Todo o resto do painel move o que ja e do jogador; este
            botao tira diamante, e um clique sem confirmacao seria um gasto
            que o jogador nao pediu

            ## E POR QUE ELE CONTINUA CLICAVEL NO LIMITE

            Porque um botao morto na barra nao diz nada. O `+` no teto abre a
            modal do mesmo jeito, e e la dentro que o jogador le que a mochila
            chegou ao maximo — um botao que so fica cinza quando clicado
            precisa carregar essa informacao
          */}
          <button
            type="button"
            className="inv-gear inv-gear--expandir"
            onClick={() => {
              closeMenu();
              setFilterOpen(false);
              setRaridadeOpen(false);
              setExpandindo(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={expandindo}
            data-tip="Expandir a mochila"
          >
            +
          </button>

          {/*
            O BOTAO DO FILTRO DE RARIDADE, AO LADO DO `⚙`

            ## E SO UM BOTAO, COM ICONE

            Sem o `select` dentro. A primeira versao tentou pendurar o
            dropdown no proprio botao, e o resultado foi um segundo criterio
            de ordenacao solto na barra, que e exatamente o que o jogador
            pediu para sair de la

            ## E O QUE ELE ABRE

            Uma BOX, a mesma que o `⚙` abre. As duas sao o mesmo tipo de
            controle — cada uma esconde um ajuste que nao cabe na barra — e
            um abre na mao do outro ficaria com dois formatos na mesma linha

            O `aria-expanded` e o que diz para o leitor de tela que o botao
            tem um painel, e `aria-haspopup` diz que ele abre uma lista
          */}
          <button
            type="button"
            className={[
              "inv-gear",
              raridadeOpen ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              closeMenu();
              setRaridadeOpen((current) => !current);
            }}
            aria-haspopup="true"
            aria-expanded={raridadeOpen}
            data-tip="Ordenar a mochila"
          >
            ▽
          </button>

          <button
            type="button"
            className="inv-close"
            onClick={onClose}
            data-tip="Fechar (I)"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="inv-panel__body">
        <aside className="inv-illus">
          <section className="inv-equipment-section">
            <h3 className="inv-section-title">Equipamento</h3>

            <EquipmentDoll
equipment={equipment}
                  menu={menu}
                  onToggleMenu={toggleMenu}
                  onUnequip={onUnequip}
    onDiscardEquipped={discardEquipped}
              onEnchant={enchantItem}
              onEnhance={enhanceItem}
              onOpenCollection={onOpenCollection}
              onOpenCodex={onOpenCodex}
              classId={classeDaSessao}
            />
          </section>

          <PowerCard equipment={equipment} />
        </aside>

        <main className="inv-main">
          <div className="inv-toolbar">
            <nav className="inv-tabs-compact">
              {TABS.map((entry) => {
                const count = tabCounts[entry.id];

                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={[
                      "inv-tab-compact",
                      category === entry.id ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      closeMenu();
                      setCategory(entry.id);
                    }}
                    data-tip={entry.label}
                  >
                    <span className="inv-tab-compact__icon">
                      {entry.icon}
                    </span>
                    <small>{entry.label}</small>
                    {count > 0 && (
                      <i className="inv-tab-compact__count">
                        {count}
                      </i>
                    )}
                  </button>
                );
              })}
            </nav>

            {/*
              A BARRA DE CIMA FICA SO COM AS ABAS.

              O `select` de ordenacao saiu daqui e foi para o botao com
              simbolo de filtro, ao lado do `⚙` do filtro de coleta. Com ele
              aqui, a barra tinha tres tipos de controle misturados — aba,
              criterio e nada mais — e o criterio nao se diferenciava de uma
              aba por cor, por borda nem por forma
            */}
            </div>

            {/*
              O MENU DA EXCLUSAO EM LOTE, e ele FICA NO LUGAR da barra.

              ## POR QUE NAO E UM MODAL

              Porque exclusao em lote e uma acao de TRES passos — marcar,
              conferir o numero, confirmar — e cada modal apaga a lista
              selecionada de vista. O jogador marcaria 12 itens, abriria um
              modal, veria "12", e nao teria como conferir *quais* sem voltar

              ## POR QUE SO "Descartar", E NAO "Vender"

              Porque vender exige o mercado aberto e um preco por item. Isso e
              outro painel, e esta barra ja tem uma acao que faz isso
            */}
            {marcando && (
              <div className="inv-mark-bar">
                <span className="inv-mark-bar__conta">
                  {marcados.size === 0
                    ? "Marque os itens para excluir"
                    : `${marcados.size} ${marcados.size === 1 ? "item marcado" : "itens marcados"}`}
                </span>

                <button
                  type="button"
                  className="inv-mark-bar__limpar"
                  onClick={() => setMarcados(new Set())}
                  disabled={marcados.size === 0}
                >
                  Limpar
                </button>

                <button
                  type="button"
                  className="inv-mark-bar__confirma"
onClick={() => {
                      /**
                       * O LOOP DE EXCLUICAO.
                       *
                       * ## POR QUE CHAMA `discardItem` E NAO `onDiscardItem`
                       *
                       * Porque `discardItem` e o MESMO caminho do "Excluir" do
                       * menu do item. Chamar o `prop` direto atravessava o
                       * `closeMenu()` que os dois tem, e o menu de opcoes de
                       * um item marcado ficava aberto por cima da grade
                       * enquanto ela esvaziava
                       *
                       * ## POR QUE UM `for` E NAO UM `Promise.all`
                       *
                       * Porque nao ha promessa: cada exclusao e um comando
                       * de rede independente, e o servidor responde com o
                       * proprio pacote de inventario. `for` mantem a ordem —
                       * que e a ordem em que o jogador marcou — e nao
                       * depende de nada que ainda nao existe no jogo
                       */
                      for (const uid of marcados) discardItem(uid);

                      sairMarcando();
                    }}
                  disabled={marcados.size === 0}
                  data-tip="Excluir todos os itens marcados"
                >
                  Excluir {marcados.size > 0 && `· ${marcados.size}`}
                </button>
              </div>
            )}

          <div className="inv-content">
            {/**
             * A GRADE SEMPRE, MESMO VAZIA.
             *
             * Antes era `cards.length === 0 ? vazio : grade`, e o estado
             * vazio escondia a propria mochila. O jogador abria o inventario
             * de um heroi novo e via um icone e uma frase — sem nenhum dos
             * 20 quadrados, e sem nenhuma pista de quantos espacos ele tinha
             *
             * A frase continua existindo, mas AGORA DEBAIXO da grade: ela
             * explica a tela em vez de substitui-la
             */}
            <div className="inv-grid-modern">
              {cards.map(({ entry, item, raridadeId, style }) => {
                  /**
                   * AS ACOES DESTE ITEM, montadas aqui e nao no cartao.
                   *
                   * O `ItemCard` so pendura o que recebe: quem sabe o que
                   * cabe num livro e o que cabe numa pocao e o dono da
                   * lista. Passar os handlers pelo `slotProps` sem montar a
                   * lista aqui deixava o inventario inteiro sem acao — o
                   * clique abria o card e nao aparecia nada
                   */
const acoes = buildItemActions(entry, {
                      onEquip,
                      onDiscardItem: discardItem,
  onUseItem: useItem,
        onEnchant: enchantItem,
        onEnhance: enhanceItem,
        onOpenCollection,
        onOpenCodex,
        /**
         * A MARCA E O MODO, JUNTOS, E NAO EM DOIS PASSOS.
         *
         * Porque o menu so aparece quando o modo esta DESLIGADO: com ele
         * ligado, o clique no item marca e nao abre o menu. Passar so
         * `alternarMarca` marcaria este item e deixaria o proximo clique
         * abrindo menu de novo — o jogador marcaria um e teria de repetir o
         * caminho no segundo
         */
        onSelecionar: (alvo) => {
          closeMenu();
          alternarMarca(alvo.uid);
          setMarcando(true);
        },
        classId: classeDaSessao,
      });

                    const aberto = menu === entry.uid;

return (
                      <ItemCard
                        key={entry.uid ?? entry.itemId}
                        entry={entry}
                        mostrarTexto={false}
                        className={
                          (aberto ? "is-menu" : "") +
                          (marcados.has(entry.uid) ? " is-marcado" : "")
                        }
                        slotProps={{
                          /*
                            O CLIQUE TEM DOIS DESTINOS.

                            No modo de marcacao ele MARCA, e nao abre o menu de
                            opcoes. Sem isto o jogador teria que marcar 12 itens
                            clicando 12 vezes e cancelando 12 menus, e o modo
                            nao ahorraria nada
                          */
                          onToggleMenu: marcando
                            ? () => alternarMarca(entry.uid)
                            : toggleMenu,

                          menuOpen: aberto,
                          marcado: marcados.has(entry.uid),
                        }}
/**
                   * O MENU FORA DA LISTA, e nao dentro do cartao.
                   *
                   * A `.inv-content` rola, e um `absolute` dentro dela e
                   * cortado nas duas bordas: para baixo o item do topo
                   * perdia a caixa, para cima ela passava da borda e
                   * ficava ATRAS da barra de abas
                   *
                   * O portal pendura a caixa no `body` com `fixed`, que
                   * nao conhece container nenhum. E o que o `ItemTooltip`
                   * ja faz pela dica, pelo mesmo motivo
                   */
                  menu={
                    aberto ? (
                      <SlotMenuFloat
                        entry={entry}
                        actions={acoes}
                      />
                    ) : null
                  }
                  />
                );
                })}

                {/**
                 * OS ESPACOS VAZIOS: SO O SLOT, E DO TAMANHO DO SLOT DO ITEM
                 *
                 * ## SEM CASCA POR FORA
                 *
                 * Porque a casca `.inv-item-card` é o que o jogador nao quer
                 * em volta do vazio: e a moldura que existe para segurar o
                 * nome e a raridade, e um espaco vazio nao tem nenhum dos
                 * dois. Com ela, o vazio virava um cartao dentro de outro
                 *
                 * ## E O `calc` DE 14px
                 *
                 * Porque o slot do item ocupado NAO ocupa a coluna inteira: a
                 * casca tira 6px de cada lado de `padding` e mais 1px de
                 * borda de cada lado. Sao 14px. O vazio e filho direto da
                 * grade e recebe a coluna cheia, entao sem isso ele ficaria
                 * 14px mais largo que o item ao lado — e e o suficiente para
                 * a coluna do `auto-fit` inchar e abrir o vao gigante
                 *
                 * ## E POR QUE SEM `<button>`
                 *
                 * Um espaco vazio clicavel promete equipar, usar ou excluir,
                 * e nao ha item para nenhuma dessas. Seria o mesmo defeito da
                 * arvore: uma tela que aceita o clique e nao faz nada
                 */}
                {vazios.map((chave) => (
                  <span
                    key={chave}
                    className="inv-slot inv-slot--empty"
                    aria-hidden="true"
                  />
                ))}
              </div>

              {cards.length === 0 && (
                <div className="inv-empty-state">
                  <div className="inv-empty-icon">
                    {searching ? "⌕" : "▣"}
                  </div>
                  <p className="inv-panel__empty">
                    {searching
                      ? "Nenhum item encontrado para a busca."
                      : "Nenhum item nesta categoria."}
                  </p>
                </div>
              )}

            {/*
              OS DOIS NUMEROS: DENTRO DA DIV DOS ITENS, NO CANTO INFERIOR
              DIREITO DO PAINEL.

              ## POR QUE ESTAO AQUI E NAO EM UM RODAPE

              Porque nao e um rodape. Nao ha faixa, nem borda, nem linha
              separando: sao dois numeros flutuando no canto da tela, sobre
              o fundo escuro do painel — o mesmo peso visual de um HUD, e nao
              de uma secao da pagina

              ## POR QUE FICA DENTRO DO `.inv-content` E NAO DO PAINEL

              E o pedido, e porque o `.inv-content` e o container que tem a
              AREA dos itens. Colocado como filho do painel, os dois
              numeros desceriam para baixo do boneco e da grade, na coluna
              errada; aqui eles ficam no canto da area onde o jogador esta
              olhando

              ## POR QUE `absolute` FUNCIONA MESMO COM `overflow: auto`

              Porque o corte do `overflow` so vale para o filho
              POSICIONADO do proprio container que rola. O `.inv-content` e
              estatico, entao o `absolute` deste bloco passa por ele e vai
              resolver no primeiro ancestral posicionado — o `.inv-panel`,
              que e `absolute`. E o que faz os dois ficarem no canto do
              PAINEL em vez do canto da area rolavel: eles nao acompanham
              o scroll da lista
            */}
            <div className="inv-footbar">
              <span
                className={[
                  "inv-chip",
                  summary.isFull ? "is-full" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-tip="Espaço da mochila"
              >
                <i>▣</i>
                <b>
                  {summary.used}/{summary.capacity}
                </b>
                <span className="inv-chip__bar">
                  <span style={{ width: `${capacityPercent}%` }} />
                </span>
              </span>

{/*
                AS DUAS MOEDAS, JUNTAS NA PONTA DIREITA.

                E o `◉` do ouro e o `◈` do steel, que sao exatamente os
                glifos que a HUD usa na badge de cada uma. Reusar os dois e
                o que faz o jogador reconhecer o numero no canto do painel
                como "isto e a minha moeda" e nao como um numero solto

                E o `summary.steel` e nao um prop separado: o `summary` do
                inventario e o pacote que ja vai a 4Hz com o `coins` ao
                lado, e as duas moedas que o jogador consulta no painel
                chegam no mesmo lugar
              */}
<span className="inv-moedas">
                  <span className="inv-chip inv-chip--gold" data-tip="Moedas">
                    <IconeMoeda moeda="coins" />
                    <b>{summary.coins}</b>
                  </span>

                  <span className="inv-chip inv-chip--steel" data-tip="Steel">
                    <IconeMoeda moeda="steel" />
                    <b>{summary.steel ?? 0}</b>
                  </span>

                  {/* o diamante, no mesmo canto e com o mesmo glifo da HUD */}
                  <span className="inv-chip inv-chip--diamond" data-tip="Diamantes">
                    <IconeMoeda moeda="diamonds" />
                    <b>{summary.diamonds ?? 0}</b>
                  </span>
                </span>
            </div>
          </div>
        </main>
      </div>

      {menu !== null && (
        <button
          type="button"
          className="inv-menu__backdrop"
          aria-label="Fechar menu do item"
          onClick={() => {
            closeMenu();
            setFilterOpen(false);
          }}
        />
      )}

      {filterOpen && (
        <div className="inv-filter-panel">
          <FilterPanel
            filter={filter}
            onChange={changeFilter}
            onReset={() => onFilterReset?.()}
            onPrune={() => onFilterPrune?.()}
            onClose={() => setFilterOpen(false)}
          />
        </div>
      )}

      {/*
        A BOX DO CRITERIO, E ELA E A MESMA FORMA DA DO FILTRO DE COLETA

        ## POR QUE A MESMA CAIXA E NAO UM `<select>`

        Porque o `select` e um controle do SO e do TAB: ele abre uma lista do
        sistema, com a aparencia do sistema, e nao segue nenhum dos botoes do
        painel. O filtro de coleta ja resolvia esse problema com uma caixa
        propria, e o criterio de ordenacao tem a mesma forma de problema

        ## E POR QUE O `select` CONTINUA DENTRO DA CAIXA

        Porque dentro dela ele e uma linha da lista, e nao mais um menu
        solto. O criterio escolhido fica visivel na caixa fechada pelo
        rotulo do botao, e a lista abre embaixo dele
      */}
      {raridadeOpen && (
        <div className="inv-filter-panel inv-ordem-panel">
          {/*
            O `.inv-filter` E A ARTE DO CARTAO, E O `inv-filter-panel` E SO O
            POSICIONAMENTO

            Sao duas coisas com nomes parecidos e papeis diferentes: o painel
            de fora so tem `position`, `z-index`, `top` e `right`; a borda, o
            fundo e o arredondado moram no `.inv-filter` de dentro

            Sem este embrulho o criterio aparecia voando: posicionado certo,
            sem nenhuma coisa para ele ser. E o erro e do mesmo tipo do
            comentario orfao que engoliu o CSS do `⚙` — um elemento que
            depende de uma regra que nao estava no lugar
          */}
          <div className="inv-filter">
            <header className="inv-filter__head">
              <strong>Ordenar por</strong>

              <button
                type="button"
                className="inv-close"
                onClick={() => setRaridadeOpen(false)}
                data-tip="Fechar"
              >
                ✕
              </button>
            </header>

            <div className="inv-ordem-panel__linha">
              <select
                className="inv-ordem-panel__select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/*
        A MODAL DE EXPANSÃO, e ela fica AQUI dentro do painel.

        E nao no HUD porque quem a abre e o `+` da barra, e quem a fecha e o
        `Esc` dela: monto-a aqui e o `InventoryPanel` ja sabe que existe uma
        coisa sobre ela — sem isso, o `Esc` do painel fecharia a mochila
        embaixo da modal, e o jogador voltaria para o jogo sem estar olhando
        para nada
      */}
      {expandindo && (
        <MochilaExpansaoModal
          inventory={summary}
          onConfirmar={() => {
            setExpandindo(false);
            onExpandInventory?.();
          }}
          onClose={() => setExpandindo(false)}
        />
      )}
    </section>
  );
}

export { DEFAULT_LOOT_FILTER };
