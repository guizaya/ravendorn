import { useMemo, useState } from "react";

import {
  GUILD_CRIACAO_CUSTO,
  GUILD_NOME_MAX,
  GUILD_NOME_MIN,
  GUILD_TAG_MAX,
  GUILD_TAG_MIN,
  formatarMoedas,
} from "../../data/guild/index.js";

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

const abas = useMemo(
  () =>
    [
      /**
       * As abas de GUILDA so existem para quem tem guilda.
       *
       * Sem isso apareciam para o jogador que ainda nao tinha uma, e
       * a aba Membros abria em "Voce nao tem guilda ainda" — uma tela
       * para dizer o que o jogador ja sabe. Quem esta sem guilda ve
       * so o que o ajuda a conseguir uma: Buscar e Criar
       */
      { id: "membros", label: "Membros", sempre: temGuilda },
      { id: "talentos", label: "Talentos", sempre: temGuilda },
      { id: "buscar", label: "Buscar", sempre: true },
      { id: "criar", label: "Criar", sempre: !temGuilda },
    ].filter((a) => a.sempre),
  [temGuilda],
);

/**
 * A aba VISIVEL e a que o jogador escolheu, desde que ela ainda exista.
 *
 * A versao anterior era `g ? aba : "criar"`: sem guilda, `atual` ficava
 * preso em "criar" e clicar em "Buscar" nao fazia NADA — a `aba` mudava
 * para "buscar" e o `atual` sobrescrevia de volta a "criar" no
 * render. Era a aba que mais importa para quem ainda nao tem guilda,
 * e era a unica que o jogador nao conseguia abrir
 *
 * A escolha do jogador vale; o que se corrige e so o caso em que a aba
 * escolhida deixa de existir. Acontece em dois momentos:
 *
 * 1. o jogador cria a guilda estando em "criar", e essa aba some da
 *    barra — sem isto o corpo ficaria vazio, sem aba nenhuma marcada
 * 2. o jogador sai da guilda estando em "membros" ou "talentos"
 *
 * Nos dois, ele cai na aba que faz sentido para o novo estado: os
 * membros da guilda recem-criada, ou a busca de uma nova
 */
const atual = abas.some((a) => a.id === aba)
  ? aba
  : temGuilda
    ? "membros"
    : "buscar";

const usar = (id) => () => setAba(id);


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
          <AbaTalentos
            guilda={dados}
            onTalent={onTalent}
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

      <ul className="gld-lista">
        {busca.map((g) => {
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
                  onClick={() => onPedir?.(g.id)}
                >
                  {g.cheia ? "Cheia" : "Pedir"}
                </button>
              )}
            </li>
          );
        })}
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

function AbaTalentos({ guilda, onTalent, onCofre }) {
  const arvore = guilda?.arvore ?? [];

  const porTier = useMemo(() => {
    const grupos = new Map();

    for (const node of arvore) {
      if (!grupos.has(node.tier)) grupos.set(node.tier, []);

      grupos.get(node.tier).push(node);
    }

    return [...grupos.entries()].sort((a, b) => a[0] - b[0]);
  }, [arvore]);

  const pontos = guilda?.pontos ?? 0;
  const pontosMax = guilda?.pontosMax ?? 24;

  return (
    <div className="gld-talentos">
      {/*
        O SALDO de pontos.

        O teto e o que segura a espera: sem ele, o jogador que ficasse
        um mes offline veria "720 pontos" e a arvore inteira liberada de
        uma vez. Com ele, o numero para em 24 e so volta a subir depois
        de gastar
      */}
      <p className="gld-pontos">
        <strong>{pontos}</strong> de {pontosMax} pontos
        <small>1 ponto por hora, mesmo offline</small>
      </p>

      {porTier.map(([tier, nodes]) => (
        <section key={tier} className="gld-tier">
          <h3 className="gld-sub">Nivel {tier}</h3>

          <ul className="gld-lista">
            {nodes.map((n) => {
              const podeGastar =
                n.disponivel && pontos >= n.custo && !n.destravado;

              return (
                <li
                  key={n.id}
                  className={[
                    "gld-row",
                    "gld-talent",
                    n.destravado ? "is-done" : "",
                    !n.disponivel ? "is-locked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="gld-row__nome">{n.nome}</span>
                  <span className="gld-row__custo">
                    {n.custo} pt
                  </span>

                  <button
                    type="button"
                    className="gld-btn gld-btn--sm"
                    disabled={!podeGastar}
                    onClick={() => onTalent?.(n.id)}
                  >
                    {n.destravado ? "Destravado" : "Destravar"}
                  </button>

                  <small className="gld-row__desc">
                    {n.descricao}
                  </small>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/*
        O COFRE so entra na tela de quem pode mexer nele.

        E a unica aba do painel que depende do papel de verdade: o
        membro comum recebe `cofre: null` do servidor e nao ha nem o
        que esconder
      */}
      <h3 className="gld-sub">Cofre</h3>

      {!guilda?.ehDiretoria ? (
        <p className="inv-panel__empty">
          {guilda
            ? "So a diretoria abre o cofre."
            : "Voce precisa de uma guilda."}
        </p>
      ) : (
        <Cofre guilda={guilda} onCofre={onCofre} />
      )}
    </div>
  );
}

function Cofre({ guilda, onCofre }) {
  const cofre = guilda.cofre;

  return (
    <div className="gld-cofre">
      <p className="gld-cofre__moedas">
        {cofre?.moedas ?? 0} moedas
      </p>

      <ul className="gld-lista">
        {(cofre?.slots ?? []).map((s) => (
          <li key={s.uid ?? s.id} className="gld-row">
            <span className="gld-row__nome">
              {s.nome ?? s.itemId}
            </span>
            <span className="gld-row__contagem">
              {s.quantidade ?? 1}
            </span>
          </li>
        ))}
      </ul>

      <div className="gld-cofre__acoes">
        <button
          type="button"
          className="gld-btn gld-btn--sm"
          onClick={() => onCofre?.(guilda.id, "depositar")}
        >
          Depositar
        </button>

        <button
          type="button"
          className="gld-btn gld-btn--sm"
          onClick={() => onCofre?.(guilda.id, "retirar")}
        >
          Retirar
        </button>
      </div>

      {/*
        O aviso do cofre vazio.

        A regra e literal: so lider e co-lider tocam no cofre, entao
        nenhum membro consegue colocar item dentro. O cofre so enche se
        a diretoria colocar. E o que foi pedido, e vale o jogador saber
        em vez de achar que o botao quebrou
      */}
      {(cofre?.slots?.length ?? 0) === 0 && (
        <p className="inv-panel__empty">
          O cofre esta vazio. So a diretoria mexe nele.
        </p>
      )}
    </div>
  );
}
