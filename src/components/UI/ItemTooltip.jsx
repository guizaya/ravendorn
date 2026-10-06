import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ITEM_TYPE_LABEL,
  RARITY_STYLE,
  getItem,
} from "../../data/items/index.js";
import { SKILL_PACKS } from "../../data/skills/index.js";

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

export default function ItemTooltip({ entry = null, ancora = null }) {
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

  const bonus = Object.entries(item.stats ?? {});

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