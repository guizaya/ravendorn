import { useCallback, useMemo, useState } from "react";
import {
  ITEM_TYPE,
  RARITY_ORDER,
  RARITY_STYLE,
  describeStats,
} from "../../data/items/index.js";
import ItemIcon from "../UI/ItemIcon.jsx";
import ItemTooltip from "../UI/ItemTooltip.jsx";
import SlotMenuFloat from "../UI/SlotMenuFloat.jsx";
import InvSlotView from "../UI/InvSlotView.jsx";
import { FAMILIAS } from "../../data/materiais/index.js";

/**
 * O QUE ESTE PAINEL E
 *
 * O layout vem do prompt `craft` da raiz: abas no topo, e embaixo tres
 * colunas — raridade, grade de itens e o painel de craft. Nao ha rodape e
 * nao ha barra de progresso, porque o craft nao tem meta: com os itens da
 * receita em maos o jogador cria quantos quiser
 *
 * ## A RARIDADE SAIU DO DETALHE E SUBIU PARA A COLUNA
 *
 * Antes a raridade era escolhida por item, com cinco botoes dentro do
 * detalhe. O layout pede que ela seja o FILTRO da lista, na coluna
 * esquerda. A capacidade nao se perde: a escolha virou global, e o que o
 * jogador fazia com cinco botoes agora faz na coluna
 *
 * E por isso que a coluna filtra por "fecha nesta raridade": no catalogo
 * deste jogo cada receita tem as CINCO raridades escritas a mao, entao um
 * item nao pertence a uma raridade, ele TEM cinco. Filtrar pela raridade
 * que o jogador quer ver faz sentido; filtrar por "o item e da raridade X"
 * mostraria a mesma lista cinco vezes
 */
const EMPTY_CRAFT = {
  categories: [],
  total: 0,
  ready: 0,
  coins: 0,
};

/**
 * A ORDEM DE RARIDADE NA COLUNA, da mais alta para a mais baixa.
 *
 * E o inverso do `RARITY_ORDER`, que vai de comum a lendario. O layout
 * pede Legendary no topo e Uncommon embaixo, e a coluna se le de cima
 * para baixo: o que o jogador procura primeiro fica no alto
 */
const RARIDADES_ALTA = [...RARITY_ORDER].reverse();

/**
 * O NUMERAL ROMANO do tier, e SO dele.
 *
 * O catalogo deste jogo tem tier `0` e `1` — material e equipamento. O
 * prompt fala em I ate IV porque o jogo dele tem quatro tiers, e aqui nao
 * ha o que mostrar alem de I: inventar um tier para preencher a grade
 * seria mentir sobre a receita
 *
 * O `null` do tier 0 e o que material e, e material nao tem tier. A
 * ausencia do numeral e a informacao, e um "0" seria pior
 */
const TIER_ROMANO = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

const numeroRomano = (tier) => TIER_ROMANO[tier] ?? null;

/**
 * A ORDEM DOS GRUPOS NA GRADE.
 *
 * O grupo e o SLOT, e nao o tipo: duas pecas que o jogador procura lado a
 * lado sao as de um mesmo slot (duas botas, duas calcas), e nao "armadura"
 * e "armadura". O material cai no fim porque nao ocupa slot nenhum
 */
const SEM_SLOT = "(material)";

const ORDEM_DE_SLOT = [
  "weapon",
  "weapon2",
  "head",
  "gloves",
  "chest",
  "legs",
  "boots",
  "trinket1",
  "trinket2",
  SEM_SLOT,
];

const slotDe = (recipe) => recipe.slot ?? SEM_SLOT;

/**
 * A ORDENACAO: por grupo de slot, e dentro do grupo pelo tier decrescente.
 *
 * O prompt pede IV, IV, III, III, II, II. Aqui o tier vai de 1 a 0, entao
 * a ordem real e o equipamento antes do material — que e a mesma ideia
 * com os numeros que este catalogo tem
 */
function ordenarReceitas(recipes) {
  return [...recipes].sort((a, b) => {
    const grupoA = ORDEM_DE_SLOT.indexOf(slotDe(a));
    const grupoB = ORDEM_DE_SLOT.indexOf(slotDe(b));

    if (grupoA !== grupoB) return grupoA - grupoB;

    if ((b.tier ?? 0) !== (a.tier ?? 0)) {
      return (b.tier ?? 0) - (a.tier ?? 0);
    }

    return String(a.name).localeCompare(String(b.name), "pt-BR");
  });
}

/** o separador de milhar, para o contador `1,416/75` do prompt */
const numero = (value) => Number(value ?? 0).toLocaleString("pt-BR");

/* ------------------------------------------------------------------ *
 * COLUNA DE RARIDADE
 * ------------------------------------------------------------------ */

/**
 * UM BOTAO DE RARIDADE, com o badge "!" quando fecha receita.
 *
 * O badge e CALCULADO: `prontas > 0` e a contagem de receitas do grupo que
 * fecham naquela raridade. Nada aqui e escrito a mao
 */
/**
 * UM BOTAO DE RARIDADE, com o badge "!" quando fecha receita.
 *
 * O `onClick` e uma SETA que passa a raridade. Passar `onPick` direto
 * entregaria o SyntheticEvent ao `setRarity`, que e um estado de string: o
 * evento ficava guardado como se fosse uma raridade, nenhuma receita
 * casava com ele e a grade saia vazia
 */
function RarityButton({
  rarity,
  label,
  color,
  active,
  prontas,
  onPick,
}) {
  return (
    <button
      type="button"
      className={[
        "cft-rar__btn",
        active ? "is-active" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--rarity": color }}
      onClick={() => onPick(rarity)}
      aria-pressed={active}
      data-tip={`${label} · ${prontas} receita${
        prontas === 1 ? "" : "s"
      } que fecha${prontas === 1 ? "" : "m"}`}
    >
      <span className="cft-rar__name">{label}</span>

      {/*
        A BOLINHA DE "TEM RECEITA PRONTA AQUI".

        ## POR QUE UM PONTO E NAO O "!"

        Porque o "!" e um sinal de ALERTA: ele pede atencao para algo errado
        ou urgente. Receita pronta nao e erro nenhum — e a coisa boa que o
        jogador foi abrir o craft para fazer, e o sinal vermelho gritava
        junto com o numero de dano baixo e com a poça sem efeito
        *
        E o ponto comunica o mesmo com menos ruido: existe algo la, e o
        `data-tip` do botao diz quantas
      */}
      {prontas > 0 && (
        <i
          className="cft-ponto"
          aria-hidden="true"
          data-tip={`${prontas} receita${
            prontas === 1 ? "" : "s"
          } cria${prontas === 1 ? "" : "m"} nesta raridade`}
        />
      )}
    </button>
  );
}

/**
 * A COLUNA ESQUERDA: as cinco raridades e, no fim, o "Craft Available".
 *
 * E a unica coluna com `height: 100%` e `margin-top: auto` no checkbox:
 * sem isso ele sobe junto com a lista e deixa de ser um rodape da coluna
 */
function RaritySidebar({
  raridades,
  onlyCraftable,
  onToggleOnly,
  anyCraftable,
}) {
  return (
    <aside className="cft-rar">
      <div className="cft-rar__list">
        {raridades.map((entry) => (
          <RarityButton
            key={entry.rarity}
            rarity={entry.rarity}
            label={entry.label}
            color={entry.color}
            active={entry.active}
            prontas={entry.prontas}
            onPick={entry.onPick}
          />
        ))}
      </div>

      <div className="cft-rar__foot">
        <label className="cft-only">
          <input
            type="checkbox"
            checked={onlyCraftable}
            onChange={onToggleOnly}
          />
          <span>Craft Available</span>
        </label>

        {!anyCraftable && (
          <p className="cft-rar__hint">
            Nenhuma receita fecha com o que voce tem.
          </p>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * ABAS DE CATEGORIA
 * ------------------------------------------------------------------ */

/**
 * AS ABAS, e o badge "!" de cada uma.
 *
 * E o mesmo `ready` que a barra de status da direita usava, movido para
 * ca: o layout pede o badge na aba, e ele e calculado a partir das receitas
 * que fecham em QUALQUER raridade
 */
/**
 * AS ABAS, E ELAS SAO AS DO INVENTARIO.
 *
 * `inv-tabs`, `inv-tab`, `inv-tab__icon` e `inv-close` sao a casca que a
 * mochila, o bau, o mercado, a guilda e o encantamento ja usam. A primeira
 * versao deste painel desenhou as proprias (`cft-tabs`/`cft-tab`), e o
 * resultado foi um painel azul-marinho no meio de uma tela de seis
 * paineis marrons — o jogador abre o craft e tem a sensacao de que entrou
 * em outro jogo
 *
 * O `inv-close` fica DENTRO do `nav`, e e o que o mercado faz: as abas e
 * o X dividem a mesma barra, e o `inv-tabs` ja e `display: flex`, entao o
 * X encosta na direita sem posicionamento absoluto
 */
function CategoryTabs({
  categories,
  activeId,
  onPick,
  onClose,
}) {
  return (
    <nav
      className="inv-tabs"
      role="tablist"
      aria-label="Categoria de craft"
    >
      {categories.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={entry.id === activeId}
          className={[
            "inv-tab",
            entry.id === activeId ? "is-active" : "",
          ].filter(Boolean).join(" ")}
          /**
           * A SETA AQUI, e nao `onClick={onPick}`.
           *
           * `onClick` passa o EVENTO para o handler, e `onPick` espera o
           * ID da categoria. Passados direto, o `setCategory` recebia um
           * SyntheticEvent: nenhum `entry.id` batia com ele, o `ativa` caia
           * no "primeira com receita pronta" e a aba parecia presa no
           * material
           */
          onClick={() => onPick(entry.id)}
          data-tip={entry.label}
        >
          <span className="inv-tab__icon">{entry.icon}</span>
          <small>{entry.label}</small>

          {/*
            A BOLINHA DE "TEM RECEITA PRONTA AQUI".

            O mesmo ponto da raridade, pelo mesmo motivo: o "!" e um sinal de
            alerta, e receita craftavel e a coisa boa que o jogador veio
            fazer. O `data-tip` continua dizendo quantas
          */}
          {entry.ready > 0 && (
            <i
              className="cft-ponto"
              aria-hidden="true"
              data-tip={`${entry.ready} receita${
                entry.ready === 1 ? "" : "s"
              } pronta${entry.ready === 1 ? "" : "s"}`}
            />
          )}
        </button>
      ))}

      <button
        type="button"
        className="inv-close"
        onClick={onClose}
        data-tip="Fechar (C)"
        aria-label="Fechar o craft"
      >
        ✕
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * GRADE DE ITENS
 * ------------------------------------------------------------------ */

/**
 * UM CARD DA GRADE, e ele e o MESMO slot da mochila.
 *
 * E o `InvSlotView`, o componente que o inventario, o bau e a guilda ja
 * usam. A alternativa seria copiar o `<div class="inv-slot">` para dentro do
 * craft, e e a que o proprio arquivo dele proibe: uma correcao no slot da
 * mochila chegaria so em um dos dois, e o jogador veria a mesma peca com
 * duas aparencias no mesmo jogo
 *
 * ## POR QUE NAO O `ItemSlot` DO INVENTARIO
 *
 * Porque o `ItemSlot` e o slot COM O MENU DE CONTEXTO: ele monta as acoes
 * de vestir, encantar, aprimorar e excluir, mede o retangulo para a caixa
 * abrir para cima ou para baixo, e depende de `onEquip`, `onDiscardItem` e
 * seis callbacks que o craft nao tem. Nenhuma dessas acoes faz sentido
 * numa receita que ainda nao virou item
 *
 * O `InvSlotView` e a apresentacao pura: ele desenha o slot, resolve o
 * icone pela raridade e abre a caixa de informacao. E o que o craft quer
 *
 * ## A RARIDADE DO SLOT E SEMPRE A COMUM
 *
 * O `InvSlotView` pinta o slot com `entry.rarity`, e aqui ela e a COMUM de
 * proposito: o card e o NOME do produto, e a raridade que ele vai sair e a
 * que a coluna esquerda tem marcada agora. Pintar a escolhida prometeria
 * uma coisa que a receita daquele item pode nao ser
 *
 * E o `entry.equipped` vai ligado, que e o que faz aparecer o "E" do
 * inventario no card do item que o jogador ja tem vestido
 */
function ItemCard({
  recipe,
  rarity,
  selected,
  equipado,
  isNew,
  onSelect,
}) {
  const romano = numeroRomano(recipe.tier);

  return (
    <InvSlotView
      entry={{
        itemId: recipe.itemId,

        /**
         * A RARIDADE MARCADA NA COLUNA DA ESQUERDA, e nao a comum.
         *
         * Este card ja foi wired com `rarity: COMMON` fixo, com o
         * argumento de que o card e o NOME do produto e a raridade e a
         * coluna que decide. O `InvSlotView` le `entry.rarity` DUAS vezes —
         * uma para pintar a borda e outra para escolher a arte — e o
         * resultado era a coluna marcando "lendaria", o medalao do lado
         * mostrando a arte lendaria e a grade inteira mostrando a comum
         *
         * O jogador escolhe a raridade para mudar o que vai sair do craft.
         * Se a grade nao acompanha, ele marca a lendaria e ve um item
         * comum, que e exatamente o que ele pediu para nao acontecer
         */
        rarity,

        equipped: equipado,
      }}
      selected={selected}
      onSelect={onSelect}
      className="cft-card"
    >
      {/*
        A MESMA BOLINHA DAS ABAS, dentro do card.

        ## O QUE MUDOU, E POR QUE

        Antes o card tinha DOIS sinais para a mesma coisa, e em cores que se
        brigavam: um halo VERDE no icone quando a receita fechava, e uma
        bolinha vermelha que so aparecia enquanto o jogador nao tinha visto
        aquela receita. Visto uma vez, o card perdia o marcador e passava a
        gritar "pronto" com brilho verde, que e a cor que o jogo usa para
        "pode craftar"

        Agora o sinal e um so, e e a MESMA bolinha que a aba e a raridade
        usam: existe receita pronta. Vermelho, 7px, o mesmo brilho

        ## E O "NOVO" FOI PARA O TOOLTIP

        Porque "voce ainda nao reparou nessa" e uma informacao de primeira
        vez, e ela muda sozinha no primeiro clique. Um marcador que se apaga
        sozinho obriga o jogador a decorar quais cards ele ainda nao viu —
        que e o trabalho que o marcador devia fazer por ele

        ## E O HALO VERDE SAIU

        Porque dois sinais de cores opostas no mesmo quadrado faziam o
        jogador parar para decidir qual dos dois era o aviso
      */}
      {recipe.canCraft && (
        <i
          className="cft-ponto cft-ponto--no-card"
          aria-hidden="true"
          data-tip={
            isNew ? "Pronto para criar" : "Pronto para criar de novo"
          }
        />
      )}

      {romano && (
        <span
          className="cft-card__tier"
          data-tip={`Tier ${recipe.tier}`}
        >
          {romano}
        </span>
      )}
    </InvSlotView>
  );
}

/**
 * AGRUPA AS RECEITAS POR FAMILIA DE MATERIAL.
 *
 * ## POR QUE O GRUPO VEM DO `FAMILIAS` E NAO DA PRIMEIRA APARICAO
 *
 * Porque a ordem das chaves de um objeto nao e garantida, e a ordem em que os
 * grupos aparecem na tela e uma escolha: Esqueleto, Goblin, Kaelen, Nylara. A
 * lista e a unica que garante isso
 *
 * ## E O QUE ACONTECE COM O QUE NAO TEM FAMILIA
 *
 * Fica num grupo so, no fim, e sem cabecalho. E o caso do equipamento: ele
 * nao tem familia nenhuma e continua na grade de hoje
 *
 * ## POR QUE ISTO NAO E UM `Map` INTEIRO
 *
 * Porque os grupos sao montados a cada filtro, e um `Map` novo por mudanca de
 * raridade ou de categoria seria trabalho por clique sem guardar nada: o
 * agrupamento e so leitura da lista que ja existe
 */
function agruparPorFamilia(recipes) {
  const porFamilia = new Map();

  for (const familia of FAMILIAS) porFamilia.set(familia.mob, []);

  const semFamilia = [];

  for (const recipe of recipes) {
    if (!recipe.familia) {
      semFamilia.push(recipe);

      continue;
    }

    if (!porFamilia.has(recipe.familia)) porFamilia.set(recipe.familia, []);

    porFamilia.get(recipe.familia).push(recipe);
  }

  const grupos = FAMILIAS.map((familia) => ({
    chave: familia.mob,
    titulo: familia.nome,
    recipes: porFamilia.get(familia.mob) ?? [],
  })).filter((grupo) => grupo.recipes.length > 0);

  /**
   * AS FAMILIAS QUE O `FAMILIAS` NAO CONHECE, e elas vao para o FIM.
   *
   * ## POR QUE ESTE PASSO EXISTE, E ELE JA SALVOU UMA REGRESSAO
   *
   * Porque o mapa acima foi construindo uma chave para cada `familia` que
   * aparece nas receitas, mas os grupos sao montados andando so pelo
   * `FAMILIAS`. Uma familia declarada no dado e esquecida aqui teria os
   * materiais montados no mapa e NAO apareceria em nenhum grupo: a receita
   * sumia da tela sem erro, sem aviso e sem contagem
   *
   * A ordem e a do achado, e nao a alfabetica, porque e a ordem em que os
   * materiais chegaram na lista
   */
  const conhecidas = new Set(FAMILIAS.map((familia) => familia.mob));

  for (const [mob, lista] of porFamilia) {
    if (conhecidas.has(mob) || lista.length === 0) continue;

    grupos.push({ chave: mob, titulo: mob, recipes: lista });
  }

  if (semFamilia.length > 0) {
    grupos.push({
      chave: "__sem_familia",
      titulo: null,
      recipes: semFamilia,
    });
  }

  return grupos;
}

/**
 * A GRADE, com os slots vazios no fim.
 *
 * O preenchimento existe para a altura nao pular quando o filtro muda: com
 * duas receitas a grade tinha uma linha, com tres virava duas, e o painel
 * inteiro dancava. As celulas vazias sao escuras e NAO clicaveis, e sao o
 * que falta para fechar a ultima linha
 *
 * ## E POR QUE AGORA HA VARIAS GRADES
 *
 * Porque a lista de material virou 4 grupos, e cada um fecha a SUA ultima
 * linha. Com uma grade so, o preenchimento do fim do Esqueleto viraria uma
 * linha inteira de buraco antes do Goblin
 */
function ItemGrid({
  recipes,
  rarity,
  selectedId,
  equipados,
  vistos,
  onSelect,
}) {
  if (recipes.length === 0) {
    return (
      <p className="inv-panel__empty">
        Nenhuma receita nesta categoria.
      </p>
    );
  }

  const COLUNAS = 4;

  /**
   * A GRADE DE UM GRUPO, com os vazios dela.
   *
   * O preenchimento e calculado aqui dentro e nao no mapa de fora porque cada
   * grupo tem uma quantidade diferente: fechar a linha com o resto do grupo
   * seguinte seria repetir quadrado vazio embaixo de material que existe
   */
  const gradeDe = (lista) => {
    const faltantes = (COLUNAS - (lista.length % COLUNAS)) % COLUNAS;

    return (
      <div className="cft-grid">
        {lista.map((recipe) => (
          <ItemCard
            key={recipe.id}
            recipe={recipe}
            rarity={rarity}
            selected={recipe.id === selectedId}
            equipado={equipados.has(recipe.itemId)}
            isNew={recipe.canCraft && !vistos.has(recipe.id)}
            onSelect={() => onSelect(recipe.id)}
          />
        ))}

        {/*
          A CELULA VAZIA USA O `inv-slot` CRU, e nao o `InvSlotView`.

          O `InvSlotView` devolve `null` quando o item do catalogo nao
          existe, e um slot vazio nao tem item nenhum — ele existe so
          para a grade fechar a ultima linha com quatro quadrados do
          mesmo tamanho dos que tem item

          E por isso que ela leva a classe `inv-slot` direto: e o que
          da a `width: 100%` e o `aspect-ratio: 1` que fazem o quadrado
          ter o mesmo tamanho do slot ao lado
        */}
        {Array.from({ length: faltantes }, (_, i) => (
          <div
            key={`vazio_${i}`}
            className="inv-slot cft-card--vazio"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  };

  const grupos = agruparPorFamilia(recipes);

  /**
   * SEM FAMILIA E SO UM GRUPO: A GRADE DE ANTES, COMO ESTAVA.
   *
   * O equipamento nao tem familia, e trocar o desenho dele junto com o do
   * material seria mexer numa aba que funcionava para arrumar outra
   */
  if (grupos.length === 1 && !grupos[0].titulo) {
    return gradeDe(grupos[0].recipes);
  }

  return (
    <div className="cft-grupos">
      {grupos.map((grupo) => (
        <section key={grupo.chave} className="cft-grupo">
          {/*
            O CABECALHO DA FAMILIA.

            ## POR QUE O NOME DA CRIATURA E NAO O DO MATERIAL

            Porque sao tres materiais por familia e cada um tem cinco graus:
            quinze quadrados com nome de material repetiria a mesma palavra
            tres vezes. "Esqueleto" diz de uma vez de onde os quinze vem, e o
            jogador caça a criatura, nao o material

            ## E POR QUE ELE SAI QUANDO SOBRA UM SO

            Com o filtro de "craft disponivel" ligado, a familia costuma
            sobrar um material so, e o cabecalho com um quadrado embaixo dele
            gasta mais linha do que economiza
          */}
          {grupo.titulo && grupo.recipes.length > 1 && (
            <h3 className="cft-grupo__titulo">{grupo.titulo}</h3>
          )}

          {gradeDe(grupo.recipes)}
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * O MEDALHAO
 * ------------------------------------------------------------------ */

/**
 * O MEDALHAO: a arte do selecionado no meio de um anel incandescente.
 *
 * O anel e laranja e a moldura e metalica, e a estrela de pontas e o que
 * faz parecer uma peca de craft e nao um simples avatar. A arte segue a
 * RARIDADE ESCOLHIDA — e esta e a unica caixa do painel que mostra a arte
 * de verdade, e e onde o jogador compara as cinco antes de gastar material
 */
function ItemMedallion({ recipe, rarity, flash }) {
  return (
    <div
      className={[
        "cft-medal",
        flash ? "is-flash" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--rarity": rarity?.color ?? "#c3ccd6" }}
    >
      <span className="cft-medal__star" aria-hidden="true" />
      <span className="cft-medal__ring" aria-hidden="true" />
      <span className="cft-medal__art">
        <ItemIcon
          item={recipe}
          rarity={rarity?.rarity ?? null}
        />
      </span>
    </div>
  );
}

/**
 * UM SLOT CIRCULAR DE MATERIAL.
 *
 * O contador e `possuido/necessario` e vai a vermelho quando falta. E o
 * que ha embaixo do circulo: nada.
 *
 * ## O NOME, O PREFIXO E A CHANCE SAIRAM DEBAIXO DO CIRCULO
 *
 * O nome do material e a lista de criaturas que o soltam estao na
 * `ItemTooltip`, aberta pelo mouse em cima do slot, e a raridade continua
 * na cor do anel
 *
 * A chance saiu porque o que importava nela era a PORCENTAGEM: tirando o
 * `%` sobrava um numero solto, e "58" sem unidade nao diz se e chance de
 * drop, de critico ou de acerto
 *
 * ## A FONTE DO DROP ESTA NO MENU E NO TOOLTIP
 *
 * O `sources` do ingrediente nao virou informacao morta: ele monta o botao
 * "Cacar Goblin" do menu do clique e a secao "Solta em" da dica. Perder a
 * linha de baixo do circulo foi escolha de layout; perder a informacao
 * seria erro
 */
function MaterialSlot({ ingredient, onCacar, onCriar }) {
  const fonte = ingredient.sources?.[0] ?? null;
  const resto = ingredient.sources?.slice(1) ?? [];

  /**
   * A DICA ANCORADA NO SLOT.
   *
   * E o mesmo par do `InvSlotView`: o `title` nativo saiu porque o
   * navegador o desenha com a fonte e o fundo DELE, sem cor do jogo, e
   * leva um segundo para aparecer
   *
   * O `title` nao sumiu do arquivo — ele virou este array, e o que mudou
   * foi onde ele e desenhado. `ItemTooltip` pendura a caixa no `body` por
   * portal, porque o painel de craft tem `transform` e `overflow: hidden`
   * e cortaria uma dica posicionada dentro dele
   */
  const [ancora, setAncora] = useState(null);

  /**
   * O MENU DO INGREDIENTE, e o que o clique abre.
   *
   * ## POR QUE SO DUAS ACOES
   *
   * Porque sao as duas coisas que o jogador faz com um ingrediente, e
   * elas nao tem meio termo: ou o material vem de uma criatura, ou vem de
   * uma receita. As opcoes do inventario — largar, vender, equipar — nao
   * fazem sentido aqui, porque o jogador nao esta com o item na mao: esta
   * lendo o que FALTA para craftar
   *
   * ## POR QUE "CACAR" SO APARECE QUANDO ALGUEM SOLTA O MATERIAL
   *
   * Porque um botao que leva a lugar nenhum e pior do que a ausencia dele.
   * O `sources` vem do indice reverso das tabelas de drop, entao ele sabe
   * exatamente de qual criatura o material sai — nao e uma busca no mapa
   * que pode nao encontrar nada
   */
  const [menuAberto, setMenuAberto] = useState(false);

  const [alvoDoMenu, setAlvoDoMenu] = useState(null);

  const acoes = [];

  const criatura = fonte?.id ?? null;

  if (criatura && onCacar) {
    acoes.push({
      id: "cacar",
      label: `Cacar ${fonte.name}`,
      run: () => onCacar(criatura),
    });
  }

  if (onCriar) {
    acoes.push({
      id: "criar",
      label: "Ver a receita",
      run: () => onCriar(ingredient.itemId),
    });
  }

  const abrirDica = (event) => setAncora(event.currentTarget);

  const fecharDica = () => setAncora(null);

  const abrirMenu = (event) => {
    setAlvoDoMenu(event.currentTarget);
    setMenuAberto((aberto) => !aberto);
  };

  const fecharMenu = () => setMenuAberto(false);

  /**
   * A COR DA RARIDADE, e nao o rotulo dela.
   *
   * O rotulo ("Lendario", "Epico") saio de baixo do circulo junto com o
   * nome do item. O que fica e a cor, e ela continua marcando o lugar:
   * o anel do circulo vem do `--rarity`, e o glifo da criatura usa a cor
   * dela
   */
  const raridadeDoMaterial = RARITY_STYLE[ingredient.rarity];

  return (
    <li
      className={[
        "cft-mat",
        menuAberto ? "is-menu" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={abrirDica}
      onMouseLeave={fecharDica}
      onClick={abrirMenu}
    >
      <span
        className={[
          "cft-mat__circle",
          ingredient.ok ? "is-ok" : "is-short",
        ].filter(Boolean).join(" ")}
        style={{
          "--rarity": raridadeDoMaterial?.color ?? "#c3ccd6",
        }}
      >
        {/*
          A ARTE DO INGREDIENTE, e nao o glifo do catalogo.

          O `ingredient.icon` e o glifo em texto do item, e ele era o que
          aparecia aqui. Os materiais novos nao tem glifo proprio — todos
          os 60 compartilham o mesmo `◆` de reserva — entao a lista de
          requisitos virava cinquenta e seis losangos identicos, e o
          jogador nao distinguia um Osso Quebrado de um Couro Lendario sem
          ler o nome

          O `ItemIcon` e o mesmo componente que desenha o item grande no
          topo do painel, e ele resolve a arte pela raridade: o
          `arteDoMaterial` corta o sufixo do grau e acha o arquivo da
          familia. Passando so o `itemId` e o `rarity`, o botao nao precisa
          saber nada disso
        */}
        <span className="cft-mat__icon">
          <ItemIcon
            itemId={ingredient.itemId}
            rarity={ingredient.rarity}
          />
        </span>

        <b
          className={[
            "cft-mat__count",
            ingredient.ok ? "" : "is-short",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {numero(ingredient.have)}
          <i>/{numero(ingredient.need)}</i>
        </b>
      </span>

      {/*
        DEBAIXO DO CIRCULO NAO TEM MAIS NADA.
        *
        * Saíram o nome do item e a linha da criatura, e cada uma por um
        * motivo que vale deixar escrito aqui, porque as duas voltaram a
        * aparecer depois e a tentacao e grande
        *
        * O NOME foi para a `ItemTooltip`, aberta pelo mouse em cima do
        * slot. Repetir o nome no circulo e na dica dizia a mesma coisa
        * duas vezes na mesma tela
        *
        * A LINHA DA CRIATURA foi porque o que importava nela era a
        * PORCENTAGEM. Tirando o `%` sobrava um numero solto embaixo do
        * circulo, e "58" sem unidade nao diz se e chance de drop, de
        * critico ou de acerto — era pior do que a linha ter ficado
        *
        * A chance continua na `ItemTooltip`, na secao "Solta em", com o
        * nome da criatura, o nivel, a zona e o tanto que ela solta. E o
        * menu do clique continua levando direto na cacada
        */}

      {/*
        A CAIXA DE INFORMACOES.

        E a mesma que abre no inventario, com dois acrescimos que so o
        craft precisa: quanto falta e quem solta o material. O `title`
        nativo que existia aqui dizia as tres coisas e agora nao existe
        mais — o navegador o desenhava com a fonte e o fundo DELE, sem cor
        do jogo, e levava um segundo para aparecer

        O `ItemTooltip` ja sabia ancorar num elemento e portalizar fora do
        painel, porque o painel de craft tem `transform` e `overflow:
        hidden` e cortaria uma dica posicionada dentro dele
      */}
      <ItemTooltip
        entry={{
          itemId: ingredient.itemId,
          rarity: ingredient.rarity,
        }}
        ancora={ancora}
        tem={numero(ingredient.have)}
        precisa={numero(ingredient.need)}
        fontes={[
          ...(fonte ? [fonte] : []),
          ...resto,
        ]}
      />

      {/*
        O MENU, que e o `SlotMenuFloat` do inventario.

        E o mesmo componente e nao uma caixa nova: ele ja resolve o
        problema de container — o painel de craft tem `transform` e
        `overflow: hidden`, e um menu posicionado dentro dele seria cortado
        nas bordas. Ele pendura a caixa no `body` por portal

        A ancora e o `<li>` do proprio clique, e nao o `data-uid` que o
        inventario usa, porque um ingrediente nao tem uid de pilha
      */}
      {menuAberto && alvoDoMenu && (
        <SlotMenuFloat
          entry={{ uid: ingredient.itemId }}
          actions={acoes}
          ancora={alvoDoMenu}
          fechar={fecharMenu}
        />
      )}
    </li>
  );
}

/**
 * O CUSTO EM GOLD, na linha logo acima do botao de criar.
 *
 * "custo em gold" na esquerda e o numero na direita, com a moeda entre
 * eles. E uma linha e nao uma caixa: a caixa com borda e fundo era o
 * jeito de mostrar um numero solto no meio da coluna, e ela escondia o
 * zero das receitas de material em vez de mostrar
 *
 * ## POR QUE O ZERO APARECE
 *
 * Porque 100 blocos de raridade do catalogo estao escritos com `coins: 0`
 * — o arco de galho, a madeira de treino e o osso amaldicoado custam zero
 * para craftar, ja que a materia e o proprio ingrediente. Esconder a
 * linha nesses casos era pior do que o `0` que ela tirava da frente: o
 * jogador via os materiais, via a receita e nao via NENHUM sinal de
 * dinheiro, e nao sabia se era de graca ou se o painel tinha falhado
 *
 * `0` aqui e informacao verdadeira — e o texto "custo em gold" do lado
 * diz de que numero se trata
 *
 * ## POR QUE SO O CUSTO, E NAO O VALOR
 *
 * `coins` e o que o servidor desconta (`spendCoins`) e o que acende o
 * vermelho de "moedas insuficientes" no botao. `value` e o que o mercado
 * paga pelo item depois de pronto. Sao grandezas diferentes, e a linha
 * que decide se o botao funciona tem de ser a que o botao le
 */
function GoldCost({ coins, haveCoins }) {
  const curto = coins > haveCoins;

  return (
    <div
      className={[
        "cft-cost",
        curto ? "is-short" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="cft-cost__rotulo">custo em gold</span>

      <span className="cft-cost__valor">
        <i aria-hidden="true">◉</i>

        {numero(coins)}

        {curto && (
          <small>de {numero(haveCoins)}</small>
        )}
      </span>
    </div>
  );
}

/**
 * A COLUNA DA DIREITA, de cima para baixo.
 *
 * O medalhao, a seta, os materiais, os stats, o custo em gold e o botao
 * de craft na base. A coluna tem o botao com `margin-top: auto` para ele
 * ficar SEMPRE na base e nao logo abaixo da receita: com uma receita de
 * tres ingredientes o botao subiria para o meio do painel e o jogador
 * teria que cacar ele para clicar
 */
function CraftPanelBody({
  recipe,
  rarity,
  onCraft,
  onCacarMaterial,
  onVerReceita,
  flash,
}) {
  if (!recipe) {
    return (
      <aside className="cft-craft cft-craft--empty">
        <p className="inv-panel__empty">
          Escolha um item para ver a receita.
        </p>
      </aside>
    );
  }

  const podeCriar = Boolean(rarity?.canCraft);

  const motivo = podeCriar
    ? "Criar"
    : rarity?.shortOnCoins
      ? "Faltam moedas"
      : (rarity?.missing ?? 0) > 0
        ? `Faltam ${rarity.missing} ingrediente${
            rarity.missing > 1 ? "s" : ""
          }`
        : "Mochila cheia";

  return (
    <aside className="cft-craft">
      {/*
        O BOTAO DE ENHANCE SAIU DESTE PAINEL.

        Ele vivia no alto da coluna de craft, e era a unica coisa ali que
        nao pertencia a receita: o jogador marcava uma raridade, escolhia
        um item e, no alto a direita, achava um botao para chamar um
        painel de outro sistema. Quem aperta Enhance quer aprimorar a peca
        que ele JA TEM, e nao a que esta namorando

        O atalho continua existindo fora daqui: o painel de aprimoramento
        abre pelo HUD, com o item equipado, e e la que o `onOpenEnhance`
        faz sentido. Este painel passa a ter um prop a menos
      */}

      <ItemMedallion
        recipe={recipe}
        rarity={rarity}
        flash={flash}
      />

      <p className="cft-craft__placa">{recipe.name}</p>

      <p className="cft-craft__sub">
        {recipe.tier > 0 ? `Tier ${recipe.tier}` : "Material"}
        {recipe.kindLabel ? ` · ${recipe.kindLabel}` : ""}
        {rarity ? ` · ${rarity.label}` : ""}
      </p>

      <span className="cft-craft__seta" aria-hidden="true" />

      <ul className="cft-mats">
        {(rarity?.ingredients ?? []).map((ingredient) => (
<MaterialSlot
              key={ingredient.itemId}
              ingredient={ingredient}
              onCacar={onCacarMaterial}
              onCriar={onVerReceita}
            />
        ))}
      </ul>

{/*
        OS STATS DO ITEM: uma lista, com o rotulo a esquerda e o valor a
        direita.

        ## POR QUE NAO A LINHA JOINED

        O `statsLine` do snapshot e uma frase — "ATQ +14 · DEF +6 · VEL.
        ATQ -30%" — com os dois pontos entre um atributo e o outro. Numa
        linha so, o olho nao tem onde se agarrar: para comparar a defesa
        desta espada com a do arco, o jogador precisa ler os dois numeros
        em voz alta e lembrar qual era qual

        Empilhando, cada atributo vira uma linha com o rotulo na esquerda e
        o numero na direita, e a comparacao passa a ser de linha para
        linha. E o mesmo formato que o custo em gold usa logo abaixo, e que
        a lista de materiais usa acima: um rotulo, um numero

        ## O `text` VEM PRONTO DO CATALOGO

        O sinal do `+`, o `-30%` do `attackSpeed` e o arredondamento sao
        do `describeStat` em `data/items`, o mesmo que monta a `statsLine`.
        O painel nao arredonda nem decide porcentagem: se ele fizesse,
        `Velocidade de ataque` viraria `-0` num item de valor 0.002 e a
        lista discordaria da frase que o servidor manda

        ## POR QUE O NOME POR EXTENSO, E NAO O ABREVIADO

        O `entry.short` ("ATQ", "DEF", "VEL. ATQ") serve para a frase do
        `statsLine`, que junta tudo com `·` e precisa caber numa linha.
        Aqui cada atributo tem a sua linha e o rotulo esta na coluna da
        esquerda, com o vazio do meio: nao ha pressao nenhuma de espaco, e
        "Velocidade de ataque -30%" se lê sem que o jogador decifre
        abreviatura nenhuma

        A abreviacao aqui custaria um segundo correto do jogador — e o que
        o nome curto esconde e justamente que o sinal negativo e uma
        penalidade
      */}
      {rarity?.stats && Object.keys(rarity.stats).length > 0 && (
        <ul className="cft-stats">
          {describeStats(rarity.stats).map((entry) => (
            <li
              key={entry.stat}
              className={[
                "cft-stats__linha",
                entry.value < 0 ? "is-ruim" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="cft-stats__rotulo">
                {entry.long}
              </span>

              <span className="cft-stats__valor">
                {entry.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/*
        O RODAPE: o custo e o botao, colados.

        O `margin-top: auto` que empurra o botao para a base da coluna
        ficava no botao, e a linha de custo ficava logo depois dos stats,
        la em cima — entre os dois sobrava uma faixa vazia do tamanho que
        o jogador nao usava. O custo e do botao: e o preco daquela
        receita, e os dois tem de descer e subir juntos

        E o wrapper que faz isso. Nele o `margin-top: auto` e o botao perde
        o dele, porque agora os dois sao um bloco so
      */}
      <div className="cft-craft__rodape">
        <GoldCost
          coins={rarity?.coins ?? 0}
          haveCoins={rarity?.haveCoins ?? 0}
        />

        <button
          type="button"
          className={[
            "cft-go",
            podeCriar ? "is-ready" : "",
          ].filter(Boolean).join(" ")}
          onClick={() =>
            onCraft?.(recipe.id, rarity?.rarity ?? null)
          }
          disabled={!podeCriar}
        >
          {motivo}
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * A TELA
 * ------------------------------------------------------------------ */

export default function CraftPanel({
  craft,
  onCraft,
  onHunt,
  onClose,
  equipment = null,
}) {
  const data = craft ?? EMPTY_CRAFT;

  const [category, setCategory] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [rarity, setRarity] = useState(null);
  const [onlyCraftable, setOnlyCraftable] = useState(false);
  const [vistos, setVistos] = useState(() => new Set());
  const [flash, setFlash] = useState(false);

  /**
   * A CATEGORIA ATIVA.
   *
   * A escolhida, ou a primeira que tem receita pronta. O badge do botao
   * promete "N prontas", entao o painel tem de abrir mostrando o que da
   * para criar — so quando nao ha nada pronto ele cai na primeira
   */
  const ativa = useMemo(
    () =>
      data.categories.find(
        (entry) => entry.id === category,
      ) ??
      data.categories.find(
        (entry) => entry.ready > 0,
      ) ??
      data.categories[0] ??
      null,
    [data.categories, category],
  );

  /**
   * A RARIDADE MOSTRADA, e a escolhida ou a primeira que fecha.
   *
   * Sem isto o jogador abriria o craft e veria um item cuja raridade nao
   * era a que a coluna estava marcando — e a coluna mostra a lista filtrada
   * por ela
   */
  const raridadeAtiva = useMemo(() => {
    if (rarity) return rarity;

    const primeira = RARIDADES_ALTA.find((key) =>
      ativa?.recipes.some((recipe) =>
        recipe.rarities.some(
          (entry) => entry.rarity === key && entry.canCraft,
        ),
      ),
    );

    return (
      primeira ??
      ativa?.recipes[0]?.rarities[0]?.rarity ??
      RARITY_ORDER[0]
    );
  }, [ativa, rarity]);

  /**
   * A COLUNA DE RARIDADE: quantas receitas fecham em cada uma.
   *
   * E daqui que saem o badge "!" e o filtro. A contagem ignora o "Craft
   * Available" de proposito: o badge responde "existe algo craftavel aqui",
   * e nao "existe algo craftavel aqui depois do filtro que voce acabou de
   * marcar" — o badge sumiria no mesmo clique que marcou o filtro
   */
  const raridades = useMemo(
    () =>
      RARIDADES_ALTA.map((key) => {
        const style = RARITY_STYLE[key];

        let prontas = 0;

        for (const recipe of ativa?.recipes ?? []) {
          const entry = recipe.rarities.find(
            (item) => item.rarity === key,
          );

          if (entry?.canCraft) prontas += 1;
        }

        return {
          rarity: key,
          label: style?.label ?? key,
          color: style?.color ?? "#c3ccd6",
          prontas,
          active: key === raridadeAtiva,
          onPick: setRarity,
        };
      }),
    [ativa, raridadeAtiva],
  );

  /**
   * O INDICE itemId -> receita, sobre o CATALOGO INTEIRO.
   *
   * ## POR QUE NAO E A LISTA DA ABA
   *
   * Porque o "ver a receita" de um ingrediente precisa achar a receita em
   * qualquer aba. O jogador esta na aba de Armadura olhando uma armadura,
   * clica em "Osso Quebrado Reforçado" no ingredient, e a receita do osso
   * vive na aba Material — que nao esta na `lista`, porque `lista` so tem o
   * que a aba ativa mostra
   *
   * E por isso que aqui nao ha filtro nenhum: um indice que devolve a
   * receita de qualquer item e o que faz o clique funcionar de qualquer
   * lugar. O filtro de raridade e o de "so o que fecha" NAO valem aqui —
   * abrir uma receita que ainda nao fecha e util, e e o caminho normal
   */
  const receitasPorItem = useMemo(() => {
    const indice = new Map();

    for (const categoria of data.categories) {
      for (const receita of categoria.recipes ?? []) {
        indice.set(receita.itemId, receita);
      }
    }

    return indice;
  }, [data.categories]);

  /**
   * A LISTA: receitas que TEM a raridade escolhida, e que fecham nela se o
   * filtro esta marcado
   */
  const lista = useMemo(() => {
    const receitas = (ativa?.recipes ?? []).filter((recipe) => {
      const entry = recipe.rarities.find(
        (item) => item.rarity === raridadeAtiva,
      );

      if (!entry) return false;

      return onlyCraftable ? entry.canCraft : true;
    });

    return ordenarReceitas(receitas);
  }, [ativa, onlyCraftable, raridadeAtiva]);

  /**
   * O SELECIONADO: o escolhido, ou o primeiro que fecha na raridade.
   *
   * O `canCraft` e o do item NA raridade escolhida, e nao o `canCraft` do
   * item em geral — que quer dizer "fecha em ALGUMA raridade". Sem esta
   * distincao o painel abriria com o primeiro item que fecha na comum
   * enquanto a coluna estivesse marcando a lendaria
   */
  const selecionado = useMemo(() => {
    const escolhido = lista.find(
      (recipe) => recipe.id === selectedId,
    );

    if (escolhido) return escolhido;

    return (
      lista.find((recipe) =>
        recipe.rarities.some(
          (entry) =>
            entry.rarity === raridadeAtiva && entry.canCraft,
        ),
      ) ??
      lista[0] ??
      null
    );
  }, [lista, raridadeAtiva, selectedId]);

  const raridadeSelecionada = useMemo(() => {
    if (!selecionado) return null;

    return (
      selecionado.rarities.find(
        (entry) => entry.rarity === raridadeAtiva,
      ) ??
      selecionado.rarities[0] ??
      null
    );
  }, [raridadeAtiva, selecionado]);

  /**
   * OS ITENS EQUIPADOS, como um conjunto de `itemId`.
   *
   * Vem do `equipment` do snapshot, que ja estava no HUD e nao chegava no
   * craft. E o que poe a faixa "EQUIP" no card: o jogador compara a peca que
   * ele tem vestida com a receita da mesma peca
   */
  const equipados = useMemo(() => {
    const slots = equipment?.slots ?? [];

    return new Set(
      slots.map((slot) => slot?.itemId).filter(Boolean),
    );
  }, [equipment]);

  const algumaPronta = data.categories.some(
    (entry) => entry.ready > 0,
  );

  /**
   * TROCAR DE ABA.
   *
   * Zera o item selecionado: a lista da outra categoria nao tem o id antigo,
   * e deixar ele no estado faria o `selecionado` cair no primeiro item
   * correto sozinho — o mesmo efeito, mas por um caminho que depende do
   * filtro e falha quando a categoria comeca vazia
   */
  const pickCategoria = (id) => {
    setCategory(id);
    setSelectedId(null);
  };

  /**
   * CLICAR NO CARD marca o item como visto.
   *
   * O layout pede que a bolinha vermelha de "pronto" suma depois que o
   * jogador olha o item. O clique e o "olhar": nao ha outra hora em que o
   * item entra na tela, e ele nao sai enquanto estiver marcado
   */
  const pickItem = (id) => {
    setSelectedId(id);

    setVistos((antes) => {
      if (antes.has(id)) return antes;

      const depois = new Set(antes);
      depois.add(id);

      return depois;
    });
  };

/**
 * O BRILHO DO MEDALHAO depois de mandar criar.
 *
 * O `onCraft` nao devolve se deu certo: ele manda o pedido para o
 * servidor, que decide, e a resposta volta no proximo snapshot. O brilho
 * aqui e o sinal de "o pedido saiu", e ele se apaga sozinho — sem
 * mentir sobre o resultado
 *
 * O nome e `criar` e nao `craft` porque o `craft` ja e a PROP do
 * snapshot, e declarar os dois no mesmo escopo derruba o modulo inteiro
 */
const criar = () => {
  onCraft?.(selecionado?.id, raridadeSelecionada?.rarity ?? null);

  if (flash) return;

  setFlash(true);
  setTimeout(() => setFlash(false), 620);
};

/**
 * "CACAR" NUM INGREDIENTE.
 *
 * ## POR QUE A CRIATURA VEM DO INGREDIENTE E NAO DE UMA BUSCA
 *
 * Porque o `ingredient.sources` ja e o indice reverso do catalogo de drop:
 * ele foi montado a partir das tabelas de loot das criaturas e sabe qual
 * e a que mais solta aquele material. Uma busca por "quem solta isso" feita
 * aqui seria a MESMA consulta de novo, e as duas respostas divergiriam no
 * dia em que uma criatura mudasse de drop
 *
 * E o `onHunt` do proprio painel de craft, e nao a intencao de rede
 * direta: quem decide o caminho e o servidor, e o painel so pede
 */
const onCacarMaterial = useCallback(
  (creatureId) => {
    onHunt?.(creatureId);
  },
  [onHunt],
);

/**
 * "VER A RECEITA" DE UM INGREDIENTE.
 *
 * E o caminho inverso do mesmo raciocinio: todo material com cadeia tem
 * uma receita no catalogo, e ela e o que o jogador quer quando ele le "Faltam
 * 3" ao lado de um material e quer saber de onde vem o resto
 *
 * ## POR QUE PRECISA TROCAR A ABA E A RARIDADE
 *
 * Porque o painel abre na aba ativa e na raridade ativa. Um material vive
 * na aba Material, e na raridade do SEU grau — que e o que o
 * `RARITY_STYLE` do item devolve. Trocar so a aba deixaria a coluna
 * marcando a raridade do equipamento que o jogador estava olhando, e a
 * receita mostrada seria a de outro grau
 *
 * ## POR QUE O ITEM PRECISA EXISTIR COMO RECEITA
 *
 * Porque um material base — Osso Quebrado, Couro Goblin — NAO tem receita:
 * ele vem de criatura. Abrir a aba Material e nao achar a receita dele e a
 * resposta correta, e o `onCriar` simplesmente nao aparece no menu nesse
 * caso, em vez de abrir um painel vazio
 */
const onVerReceita = useCallback(
  (itemId) => {
    const receita = receitasPorItem.get(itemId);

    if (!receita) return;

    setCategory(ITEM_TYPE.MATERIAL);
    setSelectedId(receita.id);

    /**
     * A raridade do INGREDIENTE, e nao a do equipamento aberto.
     *
     * Um "Osso Quebrado Reforçado" e incomum, entao a coluna precisa marcar
     * a incomum. Deixar a raridade do equipamento que o jogador estava
     * vendo abriria a receita do material na raridade errada, e os
     * ingredientes mostrados seriam os do grau errado
     */
    setRarity(receita.baseRarity ?? null);
  },
  [receitasPorItem],
);

  /**
 * O painel usa `inv-panel` JUNTO de `cft-panel`, e isso e obrigatorio.
 *
 * A `inv-panel` e a classe que centraliza QUALQUER painel do projeto:
 * `position: absolute`, `top/left: 50%`, `translate(-50%, -50%)` e
 * `z-index: 30`. O `z-index` e o que segura o painel ACIMA da HUD, que
 * fica em 10 — sem ele os icones da HUD pintam por cima da tela do craft
 *
 * O `cft-panel` so entao troca o que o layout novo pede: a largura, o
 * `display: grid` das tres colunas e o fundo azul. Como ele vem DEPOIS no
 * arquivo de CSS, e a mesma especificidade, ele vence a `inv-panel` no
 * que conflita
 */
return (
    <section className="inv-panel cft-panel">
      <CategoryTabs
        categories={data.categories}
        activeId={ativa?.id ?? null}
        onPick={pickCategoria}
        onClose={onClose}
      />

      <div className="cft-layout">
        <RaritySidebar
          raridades={raridades}
          onlyCraftable={onlyCraftable}
          onToggleOnly={() => setOnlyCraftable((valor) => !valor)}
          anyCraftable={algumaPronta}
        />

        <div className="cft-main">
          <ItemGrid
            recipes={lista}
            rarity={raridadeAtiva}
            selectedId={selecionado?.id ?? null}
            equipados={equipados}
            vistos={vistos}
            onSelect={pickItem}
          />
        </div>

<CraftPanelBody
            recipe={selecionado}
            rarity={raridadeSelecionada}
            onCraft={criar}
            onCacarMaterial={onCacarMaterial}
            onVerReceita={onVerReceita}
            flash={flash}
          />
      </div>
    </section>
  );
}