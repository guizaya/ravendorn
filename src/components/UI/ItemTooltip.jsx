import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ITEM_TYPE_LABEL,
  RARITY_STYLE,
  getItem,
  statsAt,
} from "../../data/items/index.js";
import { SKILL_PACKS } from "../../data/skills/index.js";
import {
  describeEnchant,
  describeEnhance,
} from "../../data/enchant/index.js";

/**
 * A CAIXA DE INFORMACOES DO ITEM, que era um `title` do navegador.
 *
 * ## POR QUE UM PORTAL, E NAO UM `absolute`
 *
 * O painel de inventario tem `transform: translate(-50%, -50%)` e
 * `overflow: hidden`. O `transform` o torna bloco contentor de
 * `position: fixed`, e o `overflow` corta qualquer coisa que saia dele.
 *
 * Isso deixa duas opcoes, e as duas erradas: um `absolute` dentro do
 * painel e cortado nas bordas, e um `fixed` que se行為 como `absolute`
 * porque o painel virou o bloco contentor. Nas duas, a caixa de um item
 * do canto da tela apareceria cortada — que e pior do que o `title` nativo,
 * que pelo menos o navegador sabe desenhar em cima de tudo
 *
 * O portal tira o elemento da arvore do painel e o pendura no `body`, que
 * nao tem transform nem overflow. A posicao continua `fixed`, calculada
 * pela tela
 *
 * ## POR QUE O `title` NATIVO SAIU
 *
 * O navegador desenha o `title` com a fonte e o fundo dele, sem cor do
 * jogo, e leva um segundo para aparecer. Era a forma mais barata de dar a
 * informacao; agora e uma caixa com a cara do resto do inventario
 *
 * O nome continua no `aria-label` do botao, entao o leitor de tela nao
 * perde nada — e o `title` saia de proposito, porque deixar os dois
 * duplicaria a informacao
 */

const LARGURA_MAXIMA = 260;

const GAP = 10;

export default function ItemTooltip({
  entry = null,
  ancora = null,
  fontes = null,
  tem = null,
  precisa = null,
}) {
  const caixa = useRef(null);
  const [posicao, setPosicao] = useState(null);

  const item = entry ? getItem(entry.itemId) : null;

  /**
   * A POSICAO, MEDIDA DEPOIS QUE A CAIXA SABE O SEU TAMANHO.
   *
   * E um `useLayoutEffect` porque a caixa precisa do proprio tamanho para
   * decidir se cabe: com um `useEffect` normal ela apareceria um quadro no
   * lugar errado e depois se moveria — um salto que o olho pega
   */
  useLayoutEffect(() => {
    if (!ancora || !caixa.current) {
      setPosicao(null);
      return;
    }

    const rect = ancora.getBoundingClientRect();
    const meu = caixa.current.getBoundingClientRect();

    const larguraDaTela = window.innerWidth;
    const alturaDaTela = window.innerHeight;

    /**
     * DO LADO OPOSTO QUANDO NAO CABE.
     *
     * O slot fica a direita da lista, entao quase sempre cabe a direita. O
     * item da ultima coluna e o do boneco na coluna da esquerda, e sao
     * esses que vao para o outro lado
     */
    const cabeNaDireita =
      rect.right + GAP + meu.width <= larguraDaTela;

    const left = cabeNaDireita
      ? rect.right + GAP
      : rect.left - GAP - meu.width;

    /**
     * A CAIXA CENTRALIZA NO SLOT e nao na tela.
     *
     * Centralizar na tela faria a caixa pular de posicao a cada item da
     * lista. Com o slot como referencia, ela sai sempre na mesma
     * distancia do item, e o movimento do mouse e o que guia o olho
     */
    const top = Math.min(
      Math.max(rect.top + rect.height / 2 - meu.height / 2, GAP),
      alturaDaTela - meu.height - GAP,
    );

    setPosicao({ left, top });
  }, [ancora, entry?.uid, entry?.slotId]);

  /**
   * SEM ITEM, SEM ANCHORA OU SEM `document`.
   *
   * O `document` e por causa do servidor: os paineis sao renderizados
   * com `renderToStaticMarkup` nos testes, e um portal sem DOM explodiria
   * ali. Como a caixa so existe com o mouse em cima, esse caminho nunca
   * acontece no servidor — o `document` e so a garantia
   */
  if (!item || !ancora || typeof document === "undefined") {
    return null;
  }

  const raridadeId = entry.rarity ?? item.rarity;
  const estilo = RARITY_STYLE[raridadeId] ?? null;

  /**
   * OS STATS SAO DA RARIDADE DO SLOT, e nao os do catalogo.
   *
   * `item.stats` e a definicao CRUA do item, e ela so vale para a raridade
   * natural: o arco de galho esta no catalogo como `common`, entao
   * `item.stats` e sempre a arte e os numeros da comum. A cor da caixa ja
   * vinha de `raridadeId` acima, entao a caixa dizia "Lendario" em dourado
   * e listava ATQ +8 — os numeros da comum, ao lado de uma cor que nao
   * era a deles
   *
   * O `statsAt` e a mesma funcao que o craft usa para montar a receita, e
   * e ela que aplica o `RARITY_STAT_SCALE`: ler os dois numeros da mesma
   * fonte e o que impede a peca lendaria de anunciar mais ataque do que a
   * recipe que a criou
   *
   * Com `raridadeId` nulo cai nos stats do catalogo, que e o que o loot e
   * a missao entregam: o `entry.rarity` ausente significa que o item nunca
   * passou por variante nenhuma
   */
  const bonus = Object.entries(statsAt(item.id, raridadeId) ?? {});

  /**
   * A SKILL QUE O LIVRO ENSINA, e nao so o ID dela.
   *
   * O `use.teachSkill` do item e um id cru (`arbalist_quick_shot`), e um
   * id nao diz nada ao jogador que esta decidindo se gasta o livro. A
   * busca e pelo ID e nao pelo nome porque o nome muda: reescrever "Quick
   * Shot" para "Disparo Rapido" trocaria o texto da dica sem quebrar
   * nada, e o id continuaria apontando para a skill certa
   *
   * Devolve `null` quando o item nao e livro, ou quando o id nao
   * resolve. E um `find` sobre os packs das 4 classes, e este arquivo
   * so desenha: quem decide se o livro ensina mesmo e o servidor, no
   * `aprenderHabilidade`
   */
  const skillEnsina = (() => {
    const skillId = item.use?.teachSkill;

    if (!skillId) return null;

    for (const pack of Object.values(SKILL_PACKS)) {
      const achada = pack.skills?.find((s) => s.id === skillId);

      if (achada) return achada;
    }

    return null;
  })();

  const conteudo = (
    <div
      ref={caixa}
      className="inv-tip"
      role="tooltip"
      style={{
        left: posicao?.left ?? 0,
        top: posicao?.top ?? 0,

        // invisivel ate medir: nasce em 0,0 e no primeiro quadro cai no
        // lugar. Sem isto a caixa apareceria no canto superior da tela
        // por um quadro
        opacity: posicao ? 1 : 0,
        maxWidth: LARGURA_MAXIMA,
      }}
    >
      <strong className="inv-tip__name">{item.name}</strong>

      <span className="inv-tip__meta">
        <span style={{ color: estilo?.color ?? "#c3ccd6" }}>
          {estilo?.label ?? ""}
        </span>

        <i aria-hidden="true">·</i>

        <span>{ITEM_TYPE_LABEL[item.type] ?? item.type}</span>
      </span>

      {/*
        O APRIMORAMENTO, e a linha que FALTAVA.

        ## POR QUE O SLOT TEM E O TOOLTIP NAO

        Porque o slot tem um quadradinho no canto com o `+3`, e ele e o
        NIVEL, nao o valor: o jogador via "esta peca foi aprimorada tres
        vezes" e nao "quanto isso rende". O painel de aprimorar tem a tabela
        de risco e o botao com o preco, entao la o numero tava

        No tooltip, que e a caixa de LEITURA da peca, faltava a linha. O
        jogador passava o mouse, comparava duas espadas, e as duas diziam
        "Lendario" — sendo que uma dava +18% e a outra +54%

        ## POR QUE `describeEnhance` E NAO UM `+${nivel}`

        Porque o nivel e um passo e o valor e uma porcentagem. `ENHANCE_PASSO`
        cresce por nivel, entao o "+3" do slot e o "+18%" desta linha sao o
        mesmo dado em duas linguagens. O numero que o jogador compara piece e
        o do segundo
      */}
      {(entry.enhance ?? 0) > 0 && (
        <span className="inv-tip__aprimoramento">
          Aprimoramento {entry.enhance} ·{" "}
          {describeEnhance(entry.enhance)}
        </span>
      )}

      {/*
        O AFIXO DA PECA.

        ## POR QUE AQUI E NAO SO NO PAINEL DE ENCANTAR

        Porque o `EnchantPanel` so existe quando o jogador abriu ele para
        encantar alguma coisa. O resto do tempo, a peca encantada estava na
        mochila ou no corpo do personagem sem nenhuma pista do que nela
        tinha sido rolado — e o jogador comparando duas espadas nao tinha
        como saber qual era a melhor

        ## POR QUE SEM O `title` QUE O PAINEL USA

        La o `title` explica "rola de novo para trocar", que e uma ACAO do
        painel de encantar. Num tooltip de leitura essa frase seria uma
        promessa que o jogador nao pode cumprir ali

        ## POR QUE A COR E DO `RARITY_STYLE` E NAO DO AFIXO

        Porque a raridade do afixo e o que o jogador compara: dois
        `+3%` de raridades diferentes sao coisas diferentes. A cor vem do
        mesmo dicionario que a do `EnchantPanel`, entao a peca parece a
        mesma nos dois lugares
      */}
      {entry.enchant && (
        <span
          className="enc-affix"
          style={{
            color: (RARITY_STYLE[entry.enchant.rarity] ?? null)?.color,
          }}
        >
          {describeEnchant(entry.enchant)}
        </span>
      )}

      {/*
        O QUE O LIVRO ENSINA.
        *
        * A descricao do item ja diz "ensina a habilidade", e isso e
        * verdade e nao ajuda em nada: o jogador precisa do NOME da
        * habilidade antes de gastar o livro
        *
        * O dano e o cooldown entram porque sao o que o jogador esta
        * comparando com as outras habilidades da classe quando decide se
        * vale a pena aprender esta
        */}
      {skillEnsina && (
        <div className="inv-tip__ensina">
          <span className="inv-tip__ensina-rotulo">
            Ensina
          </span>

          <strong>{skillEnsina.name}</strong>

          <span className="inv-tip__ensina-numeros">
            {skillEnsina.damage > 0
              ? `${skillEnsina.damage} dano · `
              : ""}
            {skillEnsina.cooldown}s
            {skillEnsina.resourceCost > 0
              ? ` · ${skillEnsina.resourceCost} de recurso`
              : ""}
          </span>
        </div>
      )}

      {/*
    QUANTO TEM E QUANTO PRECISA.

    ## POR QUE ISTO ENTROU AQUI

    Porque o painel de craft precisa dizer as duas coisas, e ele nao tinha
    onde: o `title` nativo dele sumiu quando a arte dos materiais mudou, e
    a caixa do item nao falava de quantidade. Um slot de ingrediente que
    mostra "3/8" na arte e nao diz o que os numeros significam obriga o
    jogador a abrir o inventario para descobrir

    ## POR QUE SO QUANDO AS DUAS CHEGAM JUNTAS

    Porque `tem` e `precisa` sao a MESMA informacao em dois estados, e
    uma caixa mostrando "voce tem 12" num slot onde o jogador precisa de
    3 nao esta dizendo nada. As duas props juntas sao o que forma a
    frase "precisa de 3, voce tem 12"
  */}
      {tem !== null && precisa !== null && (
        <span className="inv-tip__conta">
          <small>Precisa</small>
          <b>{precisa}</b>
          <i aria-hidden="true">·</i>
          <small>Você tem</small>
          <b
            className={
              tem >= precisa ? "" : "is-short"
            }
          >
            {tem}
          </b>
        </span>
      )}

      {/*
        AS CRIATURAS QUE SOLTAM O ITEM.

        ## POR QUE A LISTA VEM DO CHAMADOR

        Porque o indice reverso item -> criatura mora no `data/craft`, e
        este componente nao importa o catalogo de criaturas. Passar a lista
        ja pronta mantem a caixa em um componente so de DESENHO, que e o
        que ela e
      */}
      {fontes && fontes.length > 0 && (
        <div className="inv-tip__fontes">
          <span className="inv-tip__fontes-rotulo">
            Solta em
          </span>

          {fontes.map((fonte) => (
            <span
              key={fonte.id}
              className="inv-tip__fonte"
            >
              <i style={{ color: fonte.color }}>
                {fonte.icon}
              </i>

              <span>{fonte.name}</span>

              <small>
                Nv.{fonte.level}
                {fonte.zoneName
                  ? ` · ${fonte.zoneName}`
                  : ""}
              </small>

              <b>
                {Math.round(fonte.share * 100)}%
              </b>
            </span>
          ))}
        </div>
      )}

      {item.description && (
        <span className="inv-tip__desc">
          {item.description}
        </span>
      )}

      {item.value > 0 && (
        <span className="inv-tip__value">
          Valor: {item.value} moedas
        </span>
      )}

      {/*
        OS ATRIBUTOS, UM POR LINHA.

        ## POR QUE NAO EM UMA LINHA SO

        Antes os bonuses iam em uma frase: "ATK 5  ·  DEF 3  ·  HP 10". O
        jogador que compara dois arcos precisa ler numero por numero, e
        numa frase unica os numeros se misturam com os separadores: o
        olho nao sabe onde um termina e o outro comeca. Quebrando em
        linhas, cada atributo e um item com rotulo na esquerda e valor na
        direita — que e o mesmo formato do cartao de Power do
        inventario, entao os dois lugares falam a mesma lingua

        ## O MESMO FORMATO DELE, EM COLUNA

        O `inv-stat-grid` do cartao de Power e um `grid` de DUAS colunas,
        porque la o espaco e largo e o ganho e caber mais bonus numa tela.
        Aqui a caixa e estreita e a coluna e o que cabe; o que se copiou
        foi o `justify-content: space-between` de dentro de cada linha
      */}
      {bonus.length > 0 && (
        <ul className="inv-tip__stats">
          {bonus.map(([chave, valor]) => (
            <li key={chave} className="inv-tip__stat">
              <small>{rotuloDoBonus(chave)}</small>
              <b>{valor}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return createPortal(conteudo, document.body);
}

/**
 * O NOME CURTO DE UM BONUS.
 *
 * E o mesmo dicionario que o tooltip antigo usava, so que agora cada
 * bonus e uma linha propria. A sigla e o que cabe numa caixa de 260px: o
 * nome inteiro ("redução de recarga") empurraria o valor para fora
 */
const ROTULOS = {
  attack: "ATQ",
  defense: "DEF",
  speed: "VEL",
  attackSpeed: "VEL. ATQ",
  critChance: "CRIT",
  critDamage: "DANO CRIT",
  maxHp: "HP",
  maxResource: "REC",
  lifeSteal: "ROUBO",
  cooldownReduction: "CD",
};

function rotuloDoBonus(chave) {
  return ROTULOS[chave] ?? chave;
}