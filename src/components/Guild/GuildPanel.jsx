import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";
import InvSlotView from "../UI/InvSlotView.jsx";

import {
  GUILD_CRIACAO_CUSTO,
  GUILD_NOME_MAX,
  GUILD_NOME_MIN,
  GUILD_TAG_MAX,
  GUILD_TAG_MIN,
  formatarMoedas,
} from "../../data/guild/index.js";
import { getItem } from "../../data/items/index.js";

/**
 * O painel da GUILDA.
 *
 * Quatro abas, e a escolha delas nao e cosmetica: cada aba e uma
 * pergunta que so o SERVIDOR pode responder.
 *
 * - CRIAR: o jogador ainda nao tem guilda. Uma pergunta por vez
 * - BUSCAR: quais guildas existem, e o que elas tem. E a unica aba que
 *   olha o MUNDO em vez de voce
 * - MEMBROS: quem esta na guilda, e — so para a diretoria — os pedidos
 *   esperando e o cofre
 * - TALENTOS: a arvore, e o gasto de ponto
 *
 * A arvore aparece para quem NAO tem guilda tambem, toda bloqueada:
 * esconder a arvore de quem vai criar a guilda em um minuto faria a
 * aba parecer quebrada. E o motivo de ela ser a ultima aba e nao a
 * primeira
 *
 * Este componente nao decide nada. Nao sabe se o saldo basta, se o
 * jogador e lider, nem se a guilda esta cheia: le o que veio no painel
 * e pede. Quem recusa diz o motivo, e o motivo chega em `aviso`
 */
export default function GuildPanel({
  guilda = null,
  moedas = 0,
  onCriar = null,
  onBuscar = null,
  onPedir = null,
  onAceitar = null,
  onNegar = null,
  onSair = null,
  onTalent = null,
  onCofre = null,

  /**
   * A MOCHILA do jogador, no mesmo formato do inventario.
   *
   * E a FONTE do painel de deposito: os itens que aparecem la sao os
   * daqui, e o `uid` que o jogador clica e o `uid` desta mochila. Sem
   * este prop o deposito de item nao teria de onde tirar, e o painel
   * mostraria um cofre que so sabe tirar
   *
   * Vem como prop e nao por um store global porque o painel ja recebe o
   * resto do estado do servidor do mesmo jeito — `guilda` e o snapshot
   */
  inventory = null,

  onClose = null,
}) {
  const [aba, setAba] = useState(() => (guilda?.guilda ? "membros" : "criar"));
  const [nome, setNome] = useState("");
  const [tag, setTag] = useState("");
  const [termo, setTermo] = useState("");

  /**
   * O prop `guilda` e o SNAPSHOT, e nao a guilda.
   *
   * O servidor manda `snapshot.guilda`, que e um objeto com a guilda
   * dentro de `guilda.guilda`, ao lado dos pontos, da arvore e do
   * cofre. Confundir os dois quebrava o painel inteiro: como o
   * snapshot vem sempre preenchido, mesmo sem guilda, `Boolean(guilda)`
   * era sempre verdadeiro — a aba "Criar" sumia para quem mais precisava
   * dela, o cabecalho mostrava `[undefined] undefined`, e a aba Membros
   * recebia um objeto sem `membros`, estourando em `.map`
   *
   * `dados` e o snapshot, para o que fica nele; `g` e a entidade, para o
   * que e dela
   */
  const dados = guilda ?? null;

  const g = dados?.guilda ?? null;

const temGuilda = Boolean(g);

  /**
   * A DIRETORIA decide se a aba do Cofre existe.
   *
   * O servidor ja esconde o cofre de quem nao pode mexer: o membro comum
   * recebe `cofre: null` no snapshot. A aba segue a MESMA regra, e nao a
   * opposite: mostrar uma aba para quem receberia `null` dentro dela seria
   * uma tela inteira de "so a diretoria abre" para dizer ao jogador o que
   * ele ja sabe pelo fato de a aba nao estar ali
   *
   * E por isso que `ehDiretoria` entra na lista de dependencias do
   * `useMemo` das abas: um co-lider promovido pelo lider tem que ver a
   * aba aparecer sem precisar fechar e abrir o painel
   */
  const ehDiretoria = Boolean(dados?.ehDiretoria);

  const abas = useMemo(
    () =>
      [
/**
 * As abas de GUILDA so existem para quem tem guilda.
 *
 * Sem isso apareciam para o jogador que ainda nao tinha uma, e a aba
 * Membros abria em "Voce nao tem guilda ainda" — uma tela para dizer o
 * que o jogador ja sabe
 *
 * E o inverso tambem vale, e e a regra de "Buscar": as duas abas de
 * ESPACO EXISTEM (achar ou criar uma) somem para quem ja tem uma
 */
      { id: "membros", label: "Membros", sempre: temGuilda },
      { id: "talentos", label: "Talentos", sempre: temGuilda },
      { id: "cofre", label: "Cofre", sempre: temGuilda && ehDiretoria },

      /**
       * BUSCAR SOME PARA QUEM JA TEM GUILDA.
       *
       * Era `sempre: true`, e a aba ficava na barra de quem ja era
       * membro. Quem esta dentro de uma guilda nao vai procurar outra, e
       * ver a lista ao lado da propria guilda e um convite a sair dela
       * num clique
       *
       * O `sempre` virou `!temGuilda`, que e a regra oposta da de
       * "Criar": as duas abas de ESPACO EXISTEM (achar ou criar uma
       * guilda) somem para quem ja tem uma. Quem esta dentro ve so o
       * que se faz dentro: membros, talentos e — se for da diretoria —
       * o cofre
       *
       * E o `atual` abaixo ja sabe cair para "membros" quando a aba
       * escolhida e a que sumiu, entao sair da guilda durante o painel
       * traz a busca de volta sem nenhum ajuste extra
       */
      { id: "buscar", label: "Buscar", sempre: !temGuilda },
      { id: "criar", label: "Criar", sempre: !temGuilda },
    ].filter((a) => a.sempre),
  [temGuilda, ehDiretoria],
);

/**
 * A aba VISIVEL e a que o jogador escolheu, desde que ela ainda exista.
 *
 * A versao anterior era `g ? aba : "criar"`: sem guilda, `atual` ficava
 * preso em "criar" e clicar em "Buscar" nao fazia NADA — a `aba` mudava
 * para "buscar" e o `atual` sobrescrevia de volta para "criar" no
 * render. Era a aba que mais importa para quem ainda nao tem guilda,
 * e era a unica que o jogador nao conseguia abrir
 *
 * A escolha do jogador vale; o que se corrige e so o caso em que a aba
 * escolhida deixa de existir. Acontece em tres momentos:
 *
 * 1. o jogador cria a guilda estando em "criar", e essa aba some da
 *    barra — sem isto o corpo ficaria vazio, sem aba nenhuma marcada
 * 2. o jogador sai da guilda estando em "membros" ou "talentos"
 * 3. o jogador CRIA a guilda estando em "buscar", que agora so existe
 *    para quem nao tem uma
 *
 * Nos dois primeiros ele cai em "membros", que e a aba do novo estado. No
 * terceiro cai em "buscar" de novo — que e o que o jogador precisa ver
 * depois de criar: a lista do mundo, agora com a guilda dele nela
 */
const atual = abas.some((a) => a.id === aba)
  ? aba
  : temGuilda
    ? "membros"
    : "buscar";

const usar = (id) => () => setAba(id);

  /**
   * A LISTA DE GUILDAS CARREGA SOZINHA AO ABRIR A ABA.
   *
   * ## POR QUE UM EFEITO E NAO UM `useState` INICIAL
   *
   * A aba nasce em "criar" para quem tem guilda e em "buscar" para quem
   * nao tem, e o painel pode ser fechado e reaberto a qualquer momento. Um
   * `useState` com a busca inicial so rodaria na primeira montagem deste
   * componente — e o `HUD` mantem o painel na tela trocando de aba, entao
   * o efeito nem seria lido de novo
   *
   * ## O EFEITO DISPARA SO NA TRANSIÇÃO PARA A ABA
   *
   * A dependencia e o `atual`, e nao o `aba`: quem pode mudar sem o
   * jogador pedir e a regra de correcao das abas, que troca `aba` quando
   * a escolhida deixa de existir. Se o efeito dependesse do `aba`, um
   * jogador que cria a guilda searching dispararia a busca no mesmo
   * instante em que a aba "criar" sumiu
   *
   * ## POR QUE O TERMO VA VAZIO
   *
   * E um filtro sobre NOME e TAG: vazio traz todas as guildas. E o que
   * o jogador quer ao abrir a aba — a lista do mundo, e nao um resultado
   * de busca. Quem quiser filtrar digita e aperta "Procurar"
   *
   * Offline nao ha `onBuscar` e o efeito nao faz nada: a lista fica
   * vazia, que e o que o mercado entre jogadores ja faz sem servidor
   */
  useEffect(() => {
    if (atual !== "buscar") return;

    onBuscar?.("");
  }, [atual, onBuscar]);

  return (
    <section className="inv-panel gld-panel" aria-label="Guilda">
      {/*
        A casca e a do mercado e a do encantamento: `inv-panel` para a
        largura e o centrado, `inv-tabs` para as abas, `inv-close` para
        o X.

        A guilda tinha `position: absolute; inset: 0` na propria classe,
        o que abria uma caixa do tamanho da tela inteira — e ainda
        deixava um plano por cima de tudo, engolindo o clique nos botoes
        de dentro. Reaproveitar a casca compartilhada resolve as duas
        coisas de uma vez
      */}
      <nav className="inv-tabs gld-tabs">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={atual === a.id}
            className={[
              "inv-tab",
              atual === a.id ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={usar(a.id)}
          >
            <small>{a.label}</small>
          </button>
        ))}

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (G)"
        >
          ✕
        </button>
      </nav>

      <div className="gld-panel__body">
        {/*
          A IDENTIDADE da guilda, acima do conteudo.

          Ficava num `<header>` antes das abas, e deu ruim quando as
          abas passaram a usar a casca `inv-tabs`: o cabecalho empurrava
          a barra de abas para fora do lugar. Aqui ela mora dentro do
          corpo, que e a parte que rola
        */}
        {g && (
          <p className="gld-panel__tag">
            <span className="gld-panel__tag-bracket">[{g.tag}]</span>{" "}
            {g.nome}
          </p>
        )}

        {atual === "criar" && (
          <AbaCriar
            nome={nome}
            tag={tag}
            setNome={setNome}
            setTag={setTag}
            onCriar={onCriar}
            jaTem={temGuilda}
            moedas={moedas}
          />
        )}

        {atual === "buscar" && (
          <AbaBuscar
            termo={termo}
            setTermo={setTermo}
            guilda={g}
            busca={dados?.busca ?? []}
            onBuscar={onBuscar}
            onPedir={onPedir}
          />
        )}

        {atual === "membros" && (
          <AbaMembros
            guilda={g}
            ehDiretoria={Boolean(dados?.ehDiretoria)}
            onAceitar={onAceitar}
            onNegar={onNegar}
            onSair={onSair}
          />
        )}

        {atual === "talentos" && (
          <AbaTalentos guilda={dados} onTalent={onTalent} />
      )}

      {atual === "cofre" && (
          <AbaCofre
            guilda={dados}
            inventory={inventory}
            onCofre={onCofre}
          />
      )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ criar */

function AbaCriar({
  nome,
  tag,
  setNome,
  setTag,
  onCriar,
  jaTem,
  moedas,
}) {
  if (jaTem) {
    return (
      <p className="inv-panel__empty">
        Voce ja esta em uma guilda.
      </p>
    );
  }

  const nomeOk =
    nome.trim().length >= GUILD_NOME_MIN &&
    nome.trim().length <= GUILD_NOME_MAX;

  const tagOk =
    tag.trim().length >= GUILD_TAG_MIN &&
    tag.trim().length <= GUILD_TAG_MAX;

  /**
   * Sem saldo, o botao fica travado.
   *
   * A tela mostra o preco porque e o jogador que tem de juntar os dez
   * milhoes — esconder o custo e o jogador descobrir no clique, depois
   * de preencher o formulario
   */
  const temSaldo = moedas >= GUILD_CRIACAO_CUSTO;

  return (
    <form
      className="gld-form"
      onSubmit={(e) => {
        e.preventDefault();

        onCriar?.(nome, tag);
      }}
    >
      <label className="gld-field">
        <span>Nome da guilda</span>
        <input
          type="text"
          value={nome}
          maxLength={GUILD_NOME_MAX}
          onChange={(e) => setNome(e.target.value)}
        />
      </label>

      <label className="gld-field">
        <span>Tag</span>
        <input
          type="text"
          value={tag}
          maxLength={GUILD_TAG_MAX}
          onChange={(e) => setTag(e.target.value)}
        />
      </label>

      {/*
        O PRECO, e o que falta para ele.

        Fica entre os campos e o botao porque e a resposta da pergunta
        que o jogador faria ao ver "Criar guilda" travado
      */}
      <p
        className={[
          "gld-custo",
          temSaldo ? "is-ok" : "is-falta",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span>Criar uma guilda custa</span>
        <strong>{formatarMoedas(GUILD_CRIACAO_CUSTO)}</strong>

        {!temSaldo && (
          <small>
            Faltam {formatarMoedas(GUILD_CRIACAO_CUSTO - moedas)}.
          </small>
        )}
      </p>

      <button
        type="submit"
        className="gld-btn gld-btn--primary"
        disabled={!nomeOk || !tagOk || !temSaldo}
      >
        Criar guilda
      </button>
    </form>
  );
}

/* ----------------------------------------------------------------- buscar */

function AbaBuscar({
  termo,
  setTermo,
  guilda,
  busca,
  onBuscar,
  onPedir,
}) {
  return (
    <div className="gld-busca">
      <label className="gld-field">
        <span>Nome ou tag</span>
        <input
          type="text"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="gld-btn"
        onClick={() => onBuscar?.(termo)}
      >
        Procurar
      </button>

      {/*
        A LISTA, e a QUE O JOGADOR VE AO ABRIR A ABA.
        *
        * Antes so aparecia depois de digitar algo e apertar "Procurar",
        * e a aba Buscar — a unica que existe para quem ainda nao tem
        * guilda — abria vazia. O efeito acima pede a lista com o termo
        * vazio, que traz todas as guildas
        */}
      <ul className="gld-lista">
        {busca.length === 0 ? (
          <li className="gld-lista__vazia">
            Nenhuma guilda encontrada.
          </li>
        ) : (
          busca.map((g) => {
          const jaSou = guilda?.id === g.id;

          return (
            <li key={g.id} className="gld-row">
              <span className="gld-row__tag">[{g.tag}]</span>
              <span className="gld-row__nome">{g.nome}</span>
              <span className="gld-row__contagem">
                {g.membros}/{g.membrosMax}
              </span>

              {jaSou ? (
                <span className="gld-row__voce">sua</span>
              ) : (
                <button
                  type="button"
                  className="gld-btn gld-btn--sm"
                  disabled={g.cheia}
                  /**
                   * "ENTRAR", E O QUE O JOGADOR QUER VER.
                   *
                   * O que o botao faz e PEDIR entrada, e a diretoria
                   * aceita. O rotulo antigo era "Pedir", que descreve o
                   * mecanismo e nao a intencao — e o jogador que abriu a
                   * aba Buscar quer entrar numa guilda, nao mandar um
                   * pedido
                   *
                   * O mecanismo continua sendo pedido, e o `title`
                   * diz isso: um clique parece virar guilda na hora e
                   * a recusa chega depois, quando ninguem aprova. O
                   * `GuildStore` e o que exige aprovacao — o
                   * `aceitarEntrada` e da diretoria, e um "entrar"
                   * direto burlaria essa regra sem o servidor saber
                   */
                  title={
                    g.cheia
                      ? "Esta guilda esta cheia"
                      : "Pedir entrada. A diretoria precisa aceitar."
                  }
                  onClick={() => onPedir?.(g.id)}
                >
                  {g.cheia ? "Cheia" : "Entrar"}
                </button>
              )}
            </li>
          );
        })
        )}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- membros */

const PAPEL = {
  lider: "Lider",
  coLider: "Co-lider",
  membro: "Membro",
};

/**
 * A GUILDA, a entidade — e nao o snapshot.
 *
 * `ehDiretoria` vem separado porque vive no snapshot, e nao nela. E os
 * `?? []` nao sao defensiva gratuit: o `membros.map` desta aba era o
 * `.map` que estourava quando o painel recebia o objeto errado
 */
function AbaMembros({
  guilda,
  ehDiretoria = false,
  onAceitar,
  onNegar,
  onSair,
}) {
  if (!guilda) {
    return (
      <p className="inv-panel__empty">
        Voce nao tem guilda ainda.
      </p>
    );
  }

  const membros = guilda.membros ?? [];

  const pedidos = guilda.pedidos ?? [];

  return (
    <div className="gld-membros">
      <ul className="gld-lista">
        {membros.map((m) => (
          <li key={m.id} className="gld-row">
            <span className="gld-row__nome">{m.nome}</span>
            <span className="gld-row__papel">{PAPEL[m.papel]}</span>
            {m.eu && <span className="gld-row__voce">voce</span>}
          </li>
        ))}
      </ul>

      {/*
        Os PEDIDOS so aparecem para a diretoria.

        Nao e so esconder: quem nao e diretoria nem recebe a lista no
        painel, entao esconder aqui e consequencia e nao filtro. A aba
        fica vazia para o membro comum, e o motivo esta no texto
      */}
      <h3 className="gld-sub">
        Pedidos
      </h3>

      {pedidos.length === 0 ? (
        <p className="inv-panel__empty">
          {ehDiretoria
            ? "Nenhum pedido esperando."
            : "So a diretoria ve os pedidos."}
        </p>
      ) : (
        <ul className="gld-lista">
          {pedidos.map((p) => (
            <li key={p.jogadorId} className="gld-row">
              <span className="gld-row__nome">{p.nome}</span>

              <button
                type="button"
                className="gld-btn gld-btn--sm"
                onClick={() => onAceitar?.(guilda.id, p.jogadorId)}
              >
                Aceitar
              </button>

              <button
                type="button"
                className="gld-btn gld-btn--sm gld-btn--negar"
                onClick={() => onNegar?.(guilda.id, p.jogadorId)}
              >
                Negar
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="gld-btn gld-btn--sair"
        onClick={() => onSair?.()}
      >
        Sair da guilda
      </button>
    </div>
  );
}


/* --------------------------------------------------------------- talentos */

/**
 * A ARVORE DE TALENTOS.
 *
 * ## O QUE A TELA MOSTRA E O QUE NAO
 *
 * Cada no mostra o icone, o nome, o `Nv. N` e a PORCENTAGEM ate o
 * proximo degrau. Nenhum deles mostra quantos pontos o degrau custa — o
 * numero e segredo, e o servidor nem o manda no pacote (ve
 * `talentProgresso`). Se um dia o `custo` aparecer no payload e o JSX
 * decide nao imprimir, ele continua indo pela rede e o console do
 * jogador entrega o numero
 *
 * A porcentagem e o que o jogador ganha com isso: responde "esta perto?"
 * sem responder "quanto falta?". A espera e a parte '_' que faz a arvore
 * ter peso
 *
 * ## AS LINHAS SAO SVG MEDIDO, E NAO CSS
 *
 * Os nos ficam em tres colunas de largura igual, e a linha entre um pai e
 * um filho tem que saber exatamente onde eles estao. Fazer isso com borda
 * e pseudoelemento daria uma linha reta, e a imagem pede um COTOVELO: a
 * linha sai do pai, vira na horizontal e chega no filho
 *
 * Por isso o `useLayoutEffect`: ele mede os nos DEPOIS que o navegador
 * assenta a posicao e ANTES de a tela pintar, entao a primeira pintura ja
 * vem com a arvore montada. Com `useEffect` a arvore apareceria um quadro
 * sem linhas e depois as linhas cairiam no lugar
 *
 * ## POR QUE O COFRE SAIU DESTA ABA
 *
 * O cofre estava no PE desta tela, embaixo da arvore, e isso colocava
 * duas coisas sem relacao na mesma aba: a arvore (todo membro sobe) e o
 * cofre (so a diretoria mexe). O membro comum via um "Cofre" com um
 * aviso de que nao podia usar, no fim de uma tela de arvore — e a aba
 * mais longa do painel passava a ser a de quem tem menos a fazer nela
 *
 * Agora o cofre e aba propria, e ela so existe para a diretoria
 */
function AbaTalentos({ guilda, onTalent }) {
  const arvore = guilda?.arvore ?? [];

  const pontos = guilda?.pontos ?? 0;
  const pontosMax = guilda?.pontosMax ?? 24;

  /**
   * A COLUNA mais alta da arvore.
   *
   * A grade usa a coluna com mais nos como altura, para as colunas
   * menores ficarem centradas na vertical em vez de grudadas no topo. Na
* imagem as quatro raizes enchem a coluna e as outras duas ficam no
 * meio da altura, e e o mesmo efeito
   */
  const colunas = useMemo(() => {
    const mapa = new Map();

    for (const node of arvore) {
      const c = node.coluna ?? 1;

      if (!mapa.has(c)) mapa.set(c, []);

      mapa.get(c).push(node);
    }

    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [arvore]);

  const alturaDaColuna = colunas.reduce(
    (maior, [, nodes]) => Math.max(maior, nodes.length),
    0,
  );

  return (
    <div className="gld-talentos">
      {/*
        O SALDO de pontos.

        O teto e o que segura a espera: sem ele, o jogador que ficasse
        um mes offline veria "720 pontos" e a arvore inteira liberada de
        uma vez. Com ele, o numero para em 24 e so volta a subir depois
        de gastar

        O saldo e a UNICA coisa da aba que mostra numero. E e o numero que
        o jogador controla — o do talento e o que o jogo guarda
      */}
      <p className="gld-pontos">
        <strong>{pontos}</strong> de {pontosMax} pontos
        <small>1 ponto por hora, mesmo offline</small>
      </p>

      {arvore.length === 0 ? (
        <p className="inv-panel__empty">
          A arvore de talentos carregou devagar.
        </p>
      ) : (
        <ArvoreTalentos
          arvore={arvore}
          colunas={colunas}
          alturaDaColuna={alturaDaColuna}
          onTalent={onTalent}
        />
      )}
    </div>
  );
}

/**
 * A arvore: as colunas de nos e as linhas que as ligam.
 *
 * As linhas e o SVG sao coisas separadas, e as duas se apoiam nas MESMAS
 * medidas: `caixas` e `linhas`. Se o SVG usasse numeros em vez das caixas,
 * um no que mudasse de tamanho por causa do nome arrastaria a linha junto
 * e as duas fontes de verdade divergiriam
 */
function ArvoreTalentos({ arvore, colunas, alturaDaColuna, onTalent }) {
  const svgRef = useRef(null);
  const gradeRef = useRef(null);

  const [medidas, setMedidas] = useState({
    largura: 0,
    altura: 0,
    caixas: {},
    linhas: [],
  });

  /**
   * MEDE os nos e desenha as linhas.
   *
   * E um `useCallback` e nao um `useMemo` porque devolve uma FUNCAO, e
   * nao um valor: o `useLayoutEffect` e o `ResizeObserver` dependem dela
   * pela identidade, e um `useMemo` com funcao dentro daria uma referencia
   * nova a cada render — o efeito rodaria duas vezes e as linhas
   * tremeriam
   *
   * O `?? 0` no tamanho e o que impede o `NaN` de entrar no atributo do
   * SVG no primeiro quadro: antes do layout nao ha caixa nenhuma, e um
   * `NaN` no `viewBox` deixa a arvore inteira invisivel em vez de meio
   * desenhada
   */
  const medir = useCallback(() => {
    const grade = gradeRef.current;
    const svg = svgRef.current;

    if (!grade || !svg) return;

    const base = grade.getBoundingClientRect();

    const caixas = {};

    for (const node of grade.querySelectorAll("[data-node]")) {
      const r = node.getBoundingClientRect();

      caixas[node.dataset.node] = {
        x: r.left - base.left,
        y: r.top - base.top,
        w: r.width,
        h: r.height,
        centroY: r.top - base.top + r.height / 2,
        centroX: r.left - base.left + r.width / 2,
      };
    }

    /**
     * O COTOVELO de cada ligacao.
     *
     * A linha sai do pai pela DIREITA (o no esta a esquerda do filho),
     * anda na horizontal ate a coluna do filho e desce na vertical ate a
     * altura do filho. E o desenho da imagem, e o que faz dois nos de
     * colunas diferentes parecerem ligados em vez de simplesmente
     * vizinhos
     *
     * A coluna do meio do caminho e a do proprio pai: o joelho fica
     * junto de quem ja esta na tela, e nao no meio do vao entre as duas
     * colunas
     */
    const linhas = [];

    for (const node of arvore) {
      const filho = caixas[node.id];

      if (!filho) continue;

      for (const paiId of node.exige ?? []) {
        const pai = caixas[paiId];

        if (!pai) continue;

        linhas.push({
          id: `${paiId}->${node.id}`,
          x1: pai.x + pai.w,
          y1: pai.centroY,
          x2: filho.x,
          y2: filho.centroY,
          joelho: pai.x + pai.w + (filho.x - pai.x - pai.w) / 2,
          viva: (node.nivel ?? 0) > 0 && (pai.nivel ?? 0) > 0,
        });
      }
    }

    setMedidas({
      largura: base.width,
      altura: base.height,
      caixas,
      linhas,
    });
  }, [arvore]);

  useLayoutEffect(() => {
    medir();

    /**
     * A REDIMENSIONAR.
     *
     * A arvore sobe e desce com o numero de digitos do `Nv.` e com o
     * texto mais comprido de cada no, entao a largura das colunas muda
     * sozinha. Um `ResizeObserver` na grade e o que redesenha as linhas
     * nesses casos — e ele quem cobre a fonte do sistema, que troca a
     * largura de tudo quando o jogador aumenta o texto do navegador
     */
    const grade = gradeRef.current;

    if (!grade || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observador = new ResizeObserver(() => medir());

    observador.observe(grade);

    return () => observador.disconnect();
  }, [medir]);

  return (
    <div className="gld-arvore">
      <div
        className="gld-arvore__grade"
        ref={gradeRef}
        style={{
          // a grade tem a altura da coluna mais cheia, e cada coluna
          // centraliza os proprios nos nela
          "--gld-linhas": alturaDaColuna,
        }}
      >
        {colunas.map(([coluna, nodes]) => (
          <div
            key={coluna}
            className="gld-arvore__coluna"
            data-coluna={coluna}
          >
            {nodes.map((node) => (
              <NoTalento
                key={node.id}
                node={node}
                onTalent={onTalent}
              />
            ))}
          </div>
        ))}

        <svg
          className="gld-arvore__ligas"
          ref={svgRef}
          width={medidas.largura || undefined}
          height={medidas.altura || undefined}
          viewBox={`0 0 ${medidas.largura || 1} ${medidas.altura || 1}`}
          aria-hidden="true"
        >
          {medidas.linhas.map((linha) => (
            <path
              key={linha.id}
              className={[
                "gld-arvore__liga",
                linha.viva ? "is-viva" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              d={[
                `M ${linha.x1} ${linha.y1}`,
                `H ${linha.joelho}`,
                `V ${linha.y2}`,
                `H ${linha.x2}`,
              ].join(" ")}
            />
          ))}
        </svg>
      </div>

      <p className="gld-arvore__nota">
        Cada talento vai ate o Nv. 5. O custo do proximo nivel e
        secreto: o que a barra mostra e o quanto voce ja juntou.
      </p>
    </div>
  );
}

/**
 * UM NO da arvore.
 *
 * ## OS TRES ESTADOS
 *
 * `is-locked`   o pai nao subiu, e nao ha nem como tentar
 * `is-ready`    o botao acende: ha ponto no bolso e o no aceita
 * `is-max`      chegou no Nv. 5 e nao ha mais o que encher
 *
 * E o `noMaximo` que separa "chegou" de "falta um clique". Sao dois
 * lugares com a barra cheia na tela, e so o texto e o botao os distinguem
 *
 * ## O BOTAO E "ATRIBUIR", E ELE SEMPRE CUSTA 1 PONTO
 *
 * O clique nao compra um degrau pronto: ele coloca UM ponto no no, e o
 * nivel sobe sozinho quando a marca e ultrapassada. Por isso o botao diz
 * "Atribuir" e nao "Subir" — "Subir" prometia um degrau inteiro e
 * entregava um ponto
 *
 * E por isso que o texto NAO diz quantos pontos faltam para a marca:
 * "faltam 3" mais o saldo do jogador dariam a marca em uma divisao, que
 * e o numero secreto. O botao diz o ACTION e o quanto custa, e a barra
 * diz o quao perto
 */
function NoTalento({ node, onTalent }) {
  const nivel = node.nivel ?? 0;

  const podeAtribuir = node.podeAtribuir && !node.noMaximo;

  const podeGastar = podeAtribuir && node.temPontos;

  const classes = [
    "gld-no",
    node.noMaximo ? "is-max" : "",
    !podeAtribuir ? "is-locked" : "",
    podeGastar ? "is-ready" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-node={node.id}>
      <span className="gld-no__icone" aria-hidden="true">
        {node.icone}
      </span>

      <span className="gld-no__nome">{node.nome}</span>

      <span className="gld-no__nivel">
        Nv. {nivel}
        <small>/{node.nivelMax}</small>
      </span>

      {/*
        OS STATS do no: o que ele JA da, e o que o proximo nivel soma.

        A linha de cima e o premio atual, e e o mesmo numero que o
        painel de status vai mostrar depois do `applyEquipment` — os dois
        leem do catalogo, entao nao ha como a tela dizer uma coisa e o
        personagem ter outra

        A de baixo e o incremento do proximo degrau, e ela responde a
        pergunta que decide se vale a pena esperar o ponto: "vale o que
        vem?". Um no que da +2 e o proximo +7 sao escolhas diferentes de
        onde investir, e sem isso o jogador so teria o total

        As DUAS linhas ficam vazias no Nv. 0. Um no em 0% nao da nada
        ainda, e mostrar "+2 ATK" ali seria uma promessa que a folha de
        stats nao confirmaria
      */}
      <span className="gld-no__stats">
        <span className="gld-no__premio">
          {(node.bonus ?? []).length === 0 ? (
            <em>Nenhum stat ainda</em>
          ) : (
            node.bonus.map((s) => (
              <b key={s.stat} title={`${s.nome}: +${s.valor}`}>
                +{s.valor} {s.sigla}
              </b>
            ))
          )}
        </span>

        {!node.noMaximo && (node.proximo ?? []).length > 0 && (
          <span className="gld-no__proximo">
            {(node.proximo ?? []).map((s) => (
              <i key={s.stat} title={`Proximo nivel: +${s.valor} ${s.nome}`}>
                +{s.valor} {s.sigla}
              </i>
            ))}
          </span>
        )}
      </span>

      {/*
        A BARRA do proximo nivel.

        O `role="progressbar"` e o `aria-valuenow` nao sao enfeite de
        acessibilidade: a barra e a unica leitura de "quanto falta", e
        ela precisa ser lida por quem nao ve a cor
      */}
      <span
        className="gld-no__barra"
        role="progressbar"
        aria-valuenow={node.percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${node.nome}: ${node.percentual}% do proximo nivel`}
      >
        <i style={{ width: `${node.percentual}%` }} />
      </span>

      <span className="gld-no__pct">{node.percentual}%</span>

      <button
        type="button"
        className="gld-btn gld-btn--sm gld-no__btn"
        disabled={!podeGastar}
        onClick={() => onTalent?.(node.id)}
        title={
          node.noMaximo
            ? "No nivel maximo"
            : !podeAtribuir
              ? "Suba o talento que vem antes"
              : node.temPontos
                ? "Atribuir 1 ponto"
                : "Voce nao tem ponto ainda"
        }
      >
        {node.noMaximo
          ? "MAX"
          : podeGastar
            ? "Atribuir"
            : nivel === 0
              ? "Nv. 0"
              : `Nv. ${nivel}`}
      </button>
    </div>
  );
}



/* ------------------------------------------------------------------ cofre */

/**
 * A ABA DO COFRE.
 *
 * ## SO A DIRETORIA VEM AQUI
 *
 * A aba so aparece para quem `podeGerenciar`, e o servidor tambem so
 * manda o `cofre` para essa gente. As duas coisas sao a mesma regra em
 * dois lugares, entao o `cofre: null` que chegar aqui e um estado
 * IMPOSSIVEL e nao um caso para tratar — mas o `return` abaixo existe
 * porque `atual` guarda a aba escolhida por uma renderizacao a mais:
 * uma promocao chega no pacote seguinte, e nesse intervalo o corpo da
 * aba poderia pedir o `cofre` de um snapshot velho
 *
 * ## OS DOIS SENTIDOS SAO DOIS PAINEIS
 *
 * Depositar e retirar sao operacoes de natureza oposta: uma le da
 * mochila e escreve no cofre, a outra faz o contrario. Junta-las em um
 * painel so com um botao que muda de texto obrigaria o jogador a lembrar
 * em que sentido o formulario esta — e o erro errado ali deposita uma
 * mochila cheia em vez de esvaziar um cofre
 *
 * ## POR QUE O ITEM E O `uid` E O `item`
 *
 * No deposito, o id vem da MOCHILA (`item`); no saque, do SLOT do cofre
 * (`uid`). Sao espacos diferentes com ids diferentes, e e o espaco que
 * diz de onde o item vem. Um painel so para os dois lados teria de
 * renomear o campo a cada clique
 */
function AbaCofre({ guilda, onCofre, inventory }) {
  const cofre = guilda?.cofre;

  if (!cofre) {
    return (
      <p className="inv-panel__empty">
        So a diretoria mexe no cofre.
      </p>
    );
  }

  const id = guilda.guilda?.id;

  const slots = cofre.slots ?? [];

  return (
    <div className="gld-cofre">
      {/*
        AS MOEDAS no topo, acima dos dois paineis.

        E a unica leitura que os dois lados compartilham, e a unica
        linha da aba que cresce sozinha: o cofre nunca perde moeda, so
        ganha, porque so a diretoria deposita
      */}
      <p className="gld-cofre__moedas">
        {formatarMoedas(cofre.moedas ?? 0)} moedas no cofre
      </p>

      <div className="gld-cofre__paineis">
        <PainelCofre
          titulo="Depositar"
          dica="Da mochila para o cofre"
          moedas={inventory?.coins ?? 0}
          itens={inventory?.items ?? []}
          rotuloDaQuantidade={(e) => e.count ?? 1}

          /**
           * O `item` e o `uid` da MOCHILA. O servidor procura esse id em
           * `inventory.findByUid` e tira dali — e um id de slot do cofre
           * seria recusado, o que e o comportamento certo: sao espacos
           * diferentes
           */
          montarItem={(chave, quantidade) => ({
            item: chave,
            quantidade,
          })}

          onMover={(dados) => onCofre?.(id, "depositar", dados)}
          vazio="Sua mochila esta vazia."
        />

        <PainelCofre
          titulo="Retirar"
          dica="Do cofre para a mochila"
          moedas={cofre.moedas ?? 0}
          itens={slots}
          rotuloDaQuantidade={(e) => e.quantidade ?? 1}

          /**
           * Aqui e o `uid` do SLOT. E o mesmo nome de campo do outro
           * painel porque o SERVIDOR e que sabe qual dos dois o pedido
           * quer: ele le `uid` para saque e `item` para deposito
           */
          montarItem={(chave, quantidade) => ({
            uid: chave,
            quantidade,
          })}

          onMover={(dados) => onCofre?.(id, "retirar", dados)}
          vazio="O cofre esta vazio."
        />
      </div>

      {/*
        A REGRA que esvazia o cofre, escrita uma vez e em voz baixa.

        O aviso antigo dizia "So a diretoria mexe nele" embaixo de uma
        lista vazia, que lia como defeito. Aqui o texto muda com o
        estado: vazio de verdade pede deposito, e o jogador sabe que o
        deposito e dele
      */}
      {slots.length === 0 && (
        <p className="gld-cofre__nota">
          O cofre so enche com o que a diretoria deposita.
        </p>
      )}
    </div>
  );
}

/**
 * UM LADO do cofre: depositar ou retirar.
 *
 * O MESMO componente nos dois sentidos, e o que muda e de onde vem a
 * lista. Por isso ele e um componente e nao duas copias do mesmo
 * formulario — duas copias divergiriam na primeira regra que alguem
 * mudar, e a divergencia seria "o deposito funciona mas o saque nao"
 *
 * ## O BOTAO DE MOEDAS E O CAMPO AO LADO
 *
 * O botao grande e a carteira INTEIRA, e o campo numerico e para o valor
 * exato. Comecar pelo total e o caminho comum e o mais rapido de acertar:
 * um campo vazio esperando o jogador lembrar o numero e um campo que
 * trava a acao por um erro de digitar
 */
function PainelCofre({
  titulo,
  dica,
  moedas,
  itens,
  rotuloDaQuantidade,
  montarItem,
  onMover,
  vazio,
}) {
  const [chave, setChave] = useState(null);
  const [quantidade, setQuantidade] = useState("");

  const item = itens.find((i) => (i.uid ?? i.itemId) === chave);

  const maximo = item ? rotuloDaQuantidade(item) : 0;

  const valor = Math.floor(Number(quantidade) || 0);

  const enviarItem = () => {
    if (!item) return;

    onMover(montarItem(chave, valor > 0 ? valor : 1));

    // a quantidade volta a 1 porque o item ja foi mexido: deixar o
    // numero_old na caixa faria o segundo clique mover o valor antigo
    // de novo, e o jogador nao saberia de onde o numero veio
    setQuantidade("");
    setChave(null);
  };

  return (
    <section className="gld-cofre__painel">
      <header className="gld-cofre__cabeca">
        <h4>{titulo}</h4>
        <small>{dica}</small>
      </header>

      {/* ---------- as moedas ---------- */}

      <div className="gld-cofre__linha">
        <button
          type="button"
          className="gld-btn gld-btn--sm"
          disabled={moedas <= 0}
          onClick={() => onMover({ moeda: moedas })}
          title="Tudo o que tem aqui"
        >
          {formatarMoedas(moedas)}
        </button>

        <input
          className="gld-cofre__campo"
          type="number"
          min="1"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          placeholder="moedas"
          aria-label={`Quantidade de moedas para ${titulo.toLowerCase()}`}
        />

        <button
          type="button"
          className="gld-btn gld-btn--sm"
          disabled={valor <= 0 || valor > moedas}
          onClick={() => onMover({ moeda: valor })}
        >
          Moedas
        </button>
      </div>

      {/* ---------- os itens ---------- */}

      {itens.length === 0 ? (
        <p className="inv-panel__empty">{vazio}</p>
      ) : (
        <div className="inv-grid gld-cofre__grade">
          {itens.map((entrada) => {
            const id = entrada.uid ?? entrada.itemId;

            return (
              <div key={id} className="inv-cell">
                <InvSlotView
                  entry={{
                    uid: id,
                    itemId: entrada.itemId,
                    rarity: entrada.rarity,
                    count: rotuloDaQuantidade(entrada),
                    enchant: entrada.enchant ?? null,
                  }}
                  selected={chave === id}
                  onSelect={() => {
                    setChave(id);
                    setQuantidade("");
                  }}
                />

                <span className="inv-cell__name">
                  {getItem(entrada.itemId)?.name ??
                    entrada.nome ??
                    entrada.itemId}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/*
        A QUANTIDADE do item escolhido.

        So aparece depois de escolher um item. Um campo de quantidade
        permanent ao lado do campo das moedas e um formulario que o
        jogador preenche duas vezes sem saber qual dos dois esta valendo
      */}
      {item && (
        <div className="gld-cofre__linha gld-cofre__linha--item">
          <span className="gld-cofre__escolhido">
            {getItem(item.itemId)?.name ?? item.nome ?? item.itemId}
            {" ("}
            {maximo}
            {")"}
          </span>

          <input
            className="gld-cofre__campo"
            type="number"
            min="1"
            max={maximo}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="1"
            aria-label={`Quantidade de ${
              getItem(item.itemId)?.name ?? item.itemId
            }`}
          />

          <button
            type="button"
            className="gld-btn gld-btn--sm"
            onClick={enviarItem}
          >
            Mover
          </button>
        </div>
      )}
    </section>
  );
}
