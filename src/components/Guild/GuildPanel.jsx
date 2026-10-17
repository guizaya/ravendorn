import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";
import InvSlotView from "../UI/InvSlotView.jsx";
import IconeMoeda from "../UI/IconeMoeda.jsx";

import {
  GUILD_BONUS_ROTULO,
  GUILD_CORES,
  GUILD_CRIACAO_CUSTO,
  GUILD_ICONS,
  GUILD_NOME_MAX,
  GUILD_NOME_MIN,
  GUILD_ROLE_ORDEM,
  GUILD_TAG_MAX,
  GUILD_TAG_MIN,
  formatarMoedas,
} from "../../data/guild/index.js";
import { getItem } from "../../data/items/index.js";
import { useArrastarScroll } from "../../game/ui/arrastarScroll.js";
import { SeletorEstilo, PreviaEstilo } from "./GuildEstilo.jsx";

/**
 * O painel da GUILDA.
 *
 * Quatro abas, e a escolha delas nao e cosmetica: cada aba e uma
 * pergunta que so o SERVIDOR pode responder.
 *
 * - RESUMO: como esta a guilda. Quantos membros, quantos pontos, e o que a
 *   guilda esta dando de bonus. E a PRIMEIRA aba de quem ja tem uma, porque
 *   e a primeira pergunta de quem entra aqui ja tendo guilda
 * - CRIAR: o jogador ainda nao tem guilda. Uma pergunta por vez
 * - BUSCAR: quais guildas existem, e o que elas tem. E a unica aba que
 *   olha o MUNDO em vez de voce
 * - MEMBROS: quem esta na guilda, e — so para a diretoria — os pedidos
 *   esperando e o cofre
 * - TALENTOS: a arvore, e o gasto de ponto
 *
 * Sao CINCO, e o "quatro" deste comentario ja foi verdade. A ordem da
 * barra e a ordem das perguntas de quem esta dentro — resumo, membros,
 * talentos, cofre — e nao a ordem em que as telas foram escritas
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
  onEstilo = null,
  onMostrarTag = null,

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
  const [aba, setAba] = useState(() =>
    guilda?.guilda ? "resumo" : "criar",
  );
  const [nome, setNome] = useState("");
  const [tag, setTag] = useState("");
  const [termo, setTermo] = useState("");

  /**
   * O ARRASTAR COM O MOUSE, no mesmo hook do passe.
   *
   * ## POR QUE O MESMO HOOK E NAO UM NOVO
   *
   * Porque `useArrastarScroll` ja resolve as tres coisas que faltavam aqui:
   * descobre o eixo sozinho pelo `scrollWidth` contra o `clientWidth`, arm
   * a captura de ponteiro so DEPOIS do limiar de 5px — o que deixa o clique
   * nos botoes chegar no botao — e escuta o `pointerup` no `window`, para o
   * arrasto nunca ficar preso quando o ponteiro sai da janela
   *
   * A unica exigencia e que o elemento seja o que rola. Por isso o hook vai
   * no `.gld-panel__body`, que e o unico com `overflow-y: auto`: a arvore de
   * talentos e a aba mais alta e ela rola junto com o resto
   */
  const arraste = useArrastarScroll();

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
      { id: "resumo", label: "Resumo", sempre: temGuilda },
      { id: "membros", label: "Membros", sempre: temGuilda },
      { id: "talentos", label: "Talentos", sempre: temGuilda },
      { id: "cofre", label: "Cofre", sempre: temGuilda && ehDiretoria },
      { id: "ajustes", label: "Ajustes", sempre: temGuilda },

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
   * A ABA VISIVEL e a que o jogador escolheu, desde que ela ainda exista.
   *
   * ## POR QUE A PRIMEIRA DA BARRA E A QUE ABRE
   *
   * Porque o Resumo e a aba de quem esta DENTRO, e a primeira pergunta de
   * quem entra no painel de guilda ja tendo guilda e "como esta a minha
   * guilda". Antes ela caia em "Membros", que responde "quem esta dentro" —
   * uma lista de nomes, que e a segunda pergunta e a mais cara de ler
   *
   * E o mesmo raciocinio que fez "Buscar" ser a ultima aba: a ordem da
   * barra e a ordem das perguntas, nao a ordem em que as telas foram
   * escritas
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
   * Nos dois primeiros ele cai no "resumo", que e a aba do novo estado. No
   * terceiro cai em "buscar" de novo — que e o que o jogador precisa ver
   * depois de criar: a lista do mundo, agora com a guilda dele nela
   */
  const atual = abas.some((a) => a.id === aba)
    ? aba
    : temGuilda
      ? "resumo"
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
          data-tip="Fechar (G)"
        >
          ✕
        </button>
      </nav>

      {/*
        O CORPO DO PAINEL, com a classe do PADRAO ao lado da propria.

        ## POR QUE AS DUAS

        Porque `gld-panel__body` sozinho nao e o corpo do painel — e um corpo
        com as regras do painel de guilda por cima. Sem a `inv-panel__body`
        na classe, o elemento nao recebia o FUNDO do padrao: o radial que vai
        de `#2b2118` no topo a `#17110c` embaixo. O resultado era o gradiente
        liso do `.inv-panel` aparecendo atras do conteudo, e a guilda ficava
        com um tom de fundo diferente de todos os outros quatro painéis sem
        nenhuma regra de cor no css da guilda

        E o `gld-panel__body` continua necessario: sao o arrasto, o
        `flex-direction: column`, o `gap` e o `padding` que o painel de
        guilha usa e que nenhum dos outros usa
      */}
      <div
        className="inv-panel__body gld-panel__body"
        ref={arraste.ref}
        {...arraste.evento}
      >
        {/*
          A BANDEIRA DA GUILDA.

          ## O QUE TROCOU

          Era um `<p>` com `[TAG] Nome` e uma borda embaixo, dentro do corpo
          que rola. Ficava estranho por tres motivos, e os tres somem aqui:

          1. era uma LINHA de texto com o nome no meio de uma tela cheia de
             listas. Em Mir4 e Night Crows a identidade da guilda e uma
             BANDEIRA — uma placa com moldura dourada, brasao a esquerda, nome
             grande e numeros a direita — e nao um paragrafo
          2. ela ROLAVA com o conteudo. A identidade de uma guilda e fixa: o
             jogador desce a lista de membros e a guilda dele nao pode sair
             da tela junto
          3. ela repetia o que o Resumo ja mostrava, em duas telas diferentes
             e com duas grafias

          ## POR QUE FICA FORA DO QUE ROLA

          Porque o banner e a moldura da tela. Ele vive antes do container que
          arraste, e o `flex: none` impede que ele encolha quando o corpo
          ganha conteudo. E o que faz a aba parecer um painel de guilda e nao
          um formulario com um titulo
        */}
        {g && (
          <header className="gld-bandeira">
            {/*
              O BRASAO.

              E um losango com o mesmo desenho do `❈` que o no do topo da
              arvore usa: no catalogo de talentos ele marca "a coisa mais
              cara da guilda", e aqui marca "a guilda". Reusar o glifo faz os
              dois lerem como o mesmo assunto
            */}
            <span
              className="gld-bandeira__brasao"
              aria-hidden="true"
            >
              ❈
            </span>

            <div className="gld-bandeira__texto">
              {/*
                A TAG COMO EMBLEMA, e nao entre colchetes.

                Em Night Crows e Mir4 a tag e um escudo pequeno ao lado do
                nome, nao um prefixo de texto. O `[TAG]` entre colchetes era a
                notacao das telas de TEXTO — a lista de buscar, a aba de
                membros. Num bloco de emblema, os colchetes so fariam um
                arranjo torto: o jogador leria "[GUAR]" como parte do nome
              */}
              <span className="gld-bandeira__tag">{g.tag}</span>

              <h3 className="gld-bandeira__nome">{g.nome}</h3>

              <small className="gld-bandeira__papel">
                {dados?.ehLider ? "Lider" : null}
                {dados?.ehLider && dados?.ehDiretoria ? " · " : null}
                {dados?.ehDiretoria && !dados?.ehLider
                  ? "Diretoria"
                  : null}
                {!dados?.ehDiretoria ? "Membro" : null}
              </small>
            </div>

            {/*
              OS DOIS NUMEROS DA BANDEIRA, e so dois.

              Membros e pontossao os unicos que cabem numa faixa sem virar uma
              tabela. A arvore inteira, os bonus e a diretoria ficam no
              Resumo: a bandeira responde "de quem e esta guilda", e a aba
              responde "o que ela esta dando"
            */}
            <div className="gld-bandeira__nums">
              <span>
                <strong>{g.membros?.length ?? 0}</strong>
                <small>/ {g.membrosMax ?? 0} membros</small>
              </span>

              <span>
                <strong>{dados?.pontos ?? 0}</strong>
                <small>pontos</small>
              </span>
            </div>
          </header>
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

        {atual === "resumo" && (
          <AbaResumo guilda={g} dados={dados} />
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

      {atual === "ajustes" && (
          <AbaAjustes guilda={g} dados={dados} onEstilo={onEstilo} onTag={onMostrarTag} />
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

/* ----------------------------------------------------------------- resumo */

/**
 * O RESUMO DA GUILDA, a aba que abre para quem tem uma.
 *
 * ## POR QUE ELA SOME DOS DADOS QUE JA EXISTEM
 *
 * Porque cada numero aqui ja eraTrue em outra aba, e e exatamente por isso
 * que a aba existia: "tres membros de quarenta" estava numa lista de nomes,
 * "vinte e tres pontos guardados" numa barra no cabecalho de talentos, e os
 * bonus que a guilda da, espalhados em sete nos que o jogador teria de somar
 * de cabeca para descobrir quanto a guilda dele vale
 *
 * ## E POR QUE SOMAR OS BONUS AQUI, E NAO PEDIR AO SNAPSHOT
 *
 * Porque cada no ja traz o `bonus` DELES no payload, como soma ate o nivel
 * alcancado. Somar aqui usa o mesmo numero que o `applyEquipment` aplica no
 * personagem — o painel de status e o resumo contariam a mesma historia
 *
 * E pedir um total pronto ao servidor seria um segundo lugar onde o bonus
 * e calculado: o servidor faria a soma, o motor faria a dele, e os dois
 * divergiriam no primeiro talento novo acrescentado a arvore
 */
function AbaResumo({ guilda, dados }) {
  const arvore = dados?.arvore ?? [];

  /**
   * O BONUS TOTAL DA GUILDA, por stat.
   *
   * O `Map` e o que faz a soma por chave: sete nos com `defense` somados num
   * objeto comum exigiriam um `+=` em sete lugares, e um stat novo na
   * arvore apareceria sem ser somado — o resumo prometeria menos do que o
   * personagem recebe
   */
  const bonusTotal = useMemo(() => {
    const total = new Map();

    for (const no of arvore) {
      for (const bonus of no.bonus ?? []) {
        total.set(bonus.stat, (total.get(bonus.stat) ?? 0) + bonus.valor);
      }
    }

    /**
     * A ORDEM DOS STATS E FIXA, e nao a ordem em que apareceram.
     *
     * Sem isso o resumo reordenaria a cada ponto investido, porque subir um
     * no muda o `Map`. Uma lista de bonus que se reordena sozinha parece um
     * bug mesmo estando certa — e a ordem do `GUILD_BONUS_ROTULO` ja e a
     * ordem em que o jogador espera: ataque, defesa, vida
     */
    return GUILD_BONUS_ROTULO_ORDER.map(([stat, rotulo]) => ({
      stat,
      rotulo,
      valor: total.get(stat) ?? 0,
    })).filter((linha) => linha.valor > 0);
  }, [arvore]);

  /**
   * A ARVORE EM NUMEROS: quantos nos subiram, quantos acabaram, quantos
   * pontos foram para a guilda.
   *
   * Sao tres perguntas que a arvore nao responde numa olhadada. Ver "Nv. 3"
   * em tres nos e contar na mao; "3 de 7 nos, 18 pontos investidos" e o
   * resumo da mesma informacao
   */
  const progresso = useMemo(() => {
    let subidos = 0;
    let completos = 0;

    for (const no of arvore) {
      if ((no.nivel ?? 0) > 0) subidos += 1;
      if (no.noMaximo) completos += 1;
    }

    return { subidos, completos, total: arvore.length };
  }, [arvore]);

  /**
   * A PAPEIS CONTADOS, e nao a lista de nomes.
   *
   * Uma guilda com trinta e nove membros e um lider e uma guilda com trinta e
   * nove membros e trinta e nove lideres sao coisas muito diferentes, e a
   * lista de nomes nao distingue as duas sem o jogador ler 39 linhas
   */
  const papeis = useMemo(() => {
    const conta = new Map();

    for (const membro of guilda?.membros ?? []) {
      conta.set(
        membro.papel,
        (conta.get(membro.papel) ?? 0) + 1,
      );
    }

    return conta;
  }, [guilda?.membros]);

  return (
    <div className="gld-cartao gld-resumo">
      {/*
        OS NUMEROS DA GUILDA.

        ## POR QUE A IDENTIDADE SUMIU DESTA ABA

        Porque a bandeira, la em cima, ja mostra tag, nome, papel,
        membros e pontos. Deixar a identidade tambem aqui significava duas
        bandeiras na tela — na aba Resumo, que e a que abre por padrao — e o
        jogador veria a mesma informacao duas vezes em duas grafias

        E o que sobra e o que a bandeira NAO tem: a arvore em numeros. Ver
        "Nv. 3" em tres nos e contar na mao
      */}
      <div className="gld-resumo__nums">
        <NumeroResumo
          valor={`${progresso.subidos}/${progresso.total}`}
          legenda="Nos subidos"
        />

        <NumeroResumo
          valor={progresso.completos}
          legenda="Nos no maximo"
        />
      </div>

      {/*
        A DIRETORIA, so quando ha mais de um papel em uso.

        Uma guilda de um jogador so tem lider, e "Lider 1" nao informa nada
        que o titulo da aba nao tenha dito. A condicao e `size > 1` e nao
        `size > 0`: o que interessa e a composicao, e so ha composicao
        quando existe mais de um papel
      */}
      {papeis.size > 1 && (
        <section className="gld-resumo__bloco">
          <h4>Diretoria</h4>

          <ul className="gld-resumo__papeis">
            {GUILD_ROLE_ORDEM.filter((papel) => papeis.has(papel)).map(
              (papel) => (
                <li key={papel}>
                  <span>{PAPEL[papel] ?? papel}</span>
                  <strong>{papeis.get(papel)}</strong>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {/*
        O QUE A GUILDA ESTA DANDO.

        O bloco que nao existia em lugar nenhum. Os mesmos numeros que o
        `applyEquipment` soma no personagem de todo mundo, juntos — que e a
        unica forma de o jogador saber se vale subir o proximo no
      */}
      <section className="gld-resumo__bloco">
        <h4>Bonus da guilda</h4>

        {bonusTotal.length === 0 ? (
          <p className="gld-vazio">
            Nenhum talento subido ainda. Os pontos da guilda viram bonus
            quando alguem investe na arvore.
          </p>
        ) : (
          <ul className="gld-resumo__bonus">
            {bonusTotal.map((linha) => (
              <li key={linha.stat}>
                <span data-tip={linha.rotulo.nome}>{linha.rotulo.sigla}</span>
                <strong>+{linha.valor}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * UMA CAIXA DE NUMERO DO RESUMO.
 *
 * E um componente e nao uma classe so porque a mesma caixa aparece em tres
 * lugares com conteudo diferente. O `destaque` existe para a caixa de
 * membros cheia: um "40/40" em vermelho e a unica informacao da tela que
 * significa "voce precisa grow antes de contratar"
 */
function NumeroResumo({ valor, legenda, destaque = false }) {
  return (
    <div
      className={[
        "gld-num",
        destaque ? "is-cheio" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <strong>{valor}</strong>
      <small>{legenda}</small>
    </div>
  );
}

/* -------------------------------------------------------------- ajustes */

/**
 * OS AJUSTES DA GUILDA.
 *
 * ## POR QUE UMA ABA PARA CADA MEMBRO E NAO SO PARA O LIDER
 *
 * Porque o emblema e a cor sao do LIDER, e a tag no boneco e de CADA UM.
 * Se a aba so existisse para a diretoria, o membro comum — que e a maioria
 * de quem abre o painel — nao teria onde ligar a opcao que e sobre o boneco
 * DELE
 *
 * ## E POR QUE O QUE NAO E DELE APARECE DESABILITADO
 *
 * Porque esconder o seletor de emblema para um membro comum e pior do que
 * mostra-lo cinza: o jogador pensaria que a funcao nao existe. Desabilitado
 * com o rotulo "so o lider muda" responde a pergunta que ele faria — "por
 * que nao posso?" — sem precisar abrir outra tela
 *
 * ## E POR QUE O INTERRUPTOR DA TAG VEM PRIMEIRO
 *
 * Porque e a unica coisa desta aba que o jogador comum pode mudar. Se ela
 * estivesse embaixo de um bloco cinza que ele nao pode tocar, ele sairia da
 * tela sem ver que aquilo era para ele
 */
function AbaAjustes({ guilda, dados, onEstilo, onTag }) {
  /**
   * O ESTILO EM EDICAO, e nao o da guilda.
   *
   * E local porque o servidor grava na hora: cada clique e um pedido, e o
   * painel so descobriria que a cor mudou quando o pacote de 4Hz voltasse.
   * O jogador clicaria duas vezes na mesma amostra esperando o desenho
   * acompanhar o mouse
   */
  const [estilo, setEstilo] = useState({
    icone: guilda?.icone ?? GUILD_ICONS[0].id,
    cor: guilda?.corId ?? GUILD_CORES[0].id,
  });

  const [tagLigada, setTagLigada] = useState(false);

  /**
   * O QUE O SERVIDOR RESPONDEU, que sobrepoe o que o jogador esta vendo.
   *
   * E por dependencia dos CAMPOS e nao do objeto: o painel chega inteiro a
   * cada pacote, entao uma dependencia do objeto dispararia isto quatro vezes
   * por segundo mesmo sem mudanca nenhuma — e o `setEstilo` com um objeto
   * novo a cada vez faria o `SeletorEstilo` repintar inteiro sem motivo
   */
  useEffect(() => {
    setEstilo({
      icone: guilda?.icone ?? GUILD_ICONS[0].id,
      cor: guilda?.corId ?? GUILD_CORES[0].id,
    });
  }, [guilda?.icone, guilda?.corId]);

  /**
   * A TAG SAI DA LINHA DO PROPRIO MEMBRO, e nao de um campo no painel.
   *
   * Porque o painel traz `eu: true` na linha do jogador e `mostrarTag` em
   * todas. Ler um campo no topo do `guilda` seria uma segunda fonte de
   * verdade para a mesma coisa — e as duas divergiriam no primeiro pacote
   * depois de um clique
   */
  const linhaDoEu = useMemo(
    () => guilda?.membros?.find?.((m) => m.eu) ?? null,
    [guilda?.membros],
  );

  useEffect(() => {
    if (!linhaDoEu) return;

    setTagLigada(linhaDoEu.mostrarTag === true);
  }, [linhaDoEu]);

  const ehLider = Boolean(dados?.ehLider);

  /**
   * A TROCA DE ESTILO, e ela so existe para o LIDER.
   *
   * O `onChange` do `SeletorEstilo` e separado do `onTag` de proposito: os
   * dois vao para o servidor por caminhos com permissoes diferentes. Uma
   * funcao unica que decidisse "isto e meu?" dentro deixaria a regra do
   * lider no painel — e a regra do lider e do servidor
   */
  const escolher = (proximo) => {
    if (!ehLider) return;

    setEstilo(proximo);

    onEstilo?.(proximo.icone, proximo.cor);
  };

  const virarTag = () => {
    const alvo = !tagLigada;

    setTagLigada(alvo);

    onTag?.(alvo);
  };

  return (
    <div className="gld-cartao gld-ajustes">
      {/*
        A TAG SOBRE O BONECO.

        E a unica coisa aqui que o jogador comum pode mudar, entao vem
        primeiro. E o texto explica o efeito REAL — que os OUTROS veem —
        porque "exibir tag" sem isso parece uma opcao de tela, e o jogador
        nao ligaria se soubesse que e o mundo inteiro
      */}
      <section className="gld-ajustes__bloco">
        <h4>Tag no boneco</h4>

        <button
          type="button"
          role="switch"
          aria-checked={tagLigada}
          className={[
            "gld-interruptor",
            tagLigada ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={virarTag}
        >
          <span className="gld-interruptor__trilho" aria-hidden="true">
            <span className="gld-interruptor__botao" />
          </span>

          <span className="gld-interruptor__texto">
            <strong>
              {tagLigada ? "Mostrando a tag" : "Tag escondida"}
            </strong>

            <small>
              Desenha [TAG] com a cor da guilda em cima do seu boneco, para
              todo mundo ver.
            </small>
          </span>
        </button>

        {/*
          A CONFIRMACAO DE QUE A OPCA PEGOU.

          E porque ligar o interruptor nao muda NADA na tela: a tag e
          desenhada no canvas, e o mundo estava parado. Sem esta linha o
          jogador clicaria, veria a mesma coisa, e concluiria que o botao
          quebrou
        */}
        <p className="gld-ajustes__nota">
          {tagLigada
            ? "A sua tag aparece em cima do seu personagem para os outros jogadores."
            : "Ninguem ve a sua tag agora. Voce continua com a guilda, so sem o nome dela em cima do boneco."}
        </p>
      </section>

      {/*
        O EMBLEMA e A COR.

        Vem depois da tag porque e do LIDER, e um membro comum vem a esta aba
        para mexer so no interruptor de cima
      */}
      <section className="gld-ajustes__bloco">
        <h4>Emblema e cor</h4>

        {!ehLider && (
          <p className="gld-ajustes__aviso">
            So o lider muda o emblema e a cor. E o que os outros jogadores veem
            em cima do boneco de cada membro.
          </p>
        )}

        <SeletorEstilo
          icone={estilo.icone}
          cor={estilo.cor}
          onChange={escolher}
          bloqueado={!ehLider}
        />

        <PreviaEstilo
          icone={estilo.icone}
          cor={estilo.cor}
          nome={guilda?.nome ?? ""}
          tag={guilda?.tag ?? ""}
        />
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- criar */

/**
 * O FORMULARIO DE CRIAR.
 *
 * ## POR QUE UM PREVIA DA IDENTIDADE
 *
 * Porque nome e tag sao lidos JUNTOS por todo mundo — na lista de buscar, na
 * aba de membros, na aba de resumo. O jogador escrevia "Os Guardioes" e a tag
 * "GRD" e nunca via os dois juntos ate procurar a propria guilda na lista do
 * mundo e confirmar que o "[GRD] Os Guardioes" era ele. A previa e essa
 * confirmacao, antes de gastar
 *
 * ## POR QUE MOSTRAR O QUE VAI ACONTECER
 *
 * Porque "Criar guilda" e uma compra irreversivel de 10.000 moedas: o nome
 * fica ocupado para sempre e nao ha edicao. A tela dizia o preco e nao
 * dizia o que voce ganha, entao o jogador decidia no escuro
 */
function AbaCriar({
  nome,
  tag,
  setNome,
  setTag,
  onCriar,
  jaTem,
  moedas,
}) {
  /**
   * O ESTILO ESCOLHIDO, no estado do painel.
   *
   * E local e nao vai pro store ainda: a guilda nao existe, entao nao ha
   * nada para gravar. O par so viaja no `onCriar`, e o `GuildStore` valida
   * outra vez antes de escrever no arquivo
   */
  const [estilo, setEstilo] = useState({
    icone: GUILD_ICONS[0].id,
    cor: GUILD_CORES[0].id,
  });

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

  const preenchido = nome.trim().length > 0 || tag.trim().length > 0;

  return (
    <form
      className="gld-form"
      onSubmit={(e) => {
        e.preventDefault();

        onCriar?.(nome, tag, estilo);
      }}
    >
      {/*
        A PREVIA ANTIGA, ACIMA DO CAMPO DE NOME. FOI REMOVIDA.

        ## POR QUE ELA DUPLICAVA A DE BAIXO

        Mostrava `[TAG] Nome` no mesmo formato da `PreviaEstilo` que fica
        depois do seletor de emblema e cor — so que por cima, e antes de o
        jogador escolher cor nenhuma

        ## E A DE BAIXO E MELHOR, POR UM MOTIVO ESPECIFICO

        Porque a tag dela sai NA COR ESCOLHIDA. Esta aqui era um `<span>`
        sem `style`, e o texto saia na cor do texto: o jogador via o
        `[GUER] Guardaes` em branco e nao tinha como saber a cor que ia
        escolher dali a pouco

        Ou seja: as duas mostravam a mesma frase, e a unica coisa que elas
        NAO tinham em comum era a cor — que era justamente o que a previa
        existe para mostrar
      */}

      {/*
        A PREVIA DA TAG E DO NOME, ACIMA DO CAMPO.

        ## POR QUE ESTA E A PREVIA QUE FICOU

        Havia duas mostrando `[TAG] Nome`. A de cima era um `<span>` sem
        `style`: a tag saia na cor do TEXTO, e nao na cor da guilda. O jogador
        via o que ia escrever e nao via a cor — que e a unica coisa que ele
        ainda nao tinha como saber

        Esta usa a `PreviaEstilo`, que aplica `style={{ color: amostra.cor }}`.
        O texto e o mesmo, a cor e a escolha

        ## E POR QUE ACIMA DO PRIMEIRO CAMPO, E NAO DEPOIS DO SELETOR

        Porque e a IDENTIDADE que o mundo vai ver: nome, tag, emblema e cor,
        numa placa so, antes de qualquer campo. Depois do seletor, ela ficava
        no rodape do formulario — o jogador digitava o nome, escolhia a cor
        tres blocos abaixo, e so entao aparecia o resultado da escolha

        Acima, a previa e o titulo do que o jogador esta preenchendo
      */}
      <PreviaEstilo
        icone={estilo.icone}
        cor={estilo.cor}
        nome={nome}
        tag={tag}
      />

      <label className="gld-field">
        <span>Nome da guilda</span>

        <input
          type="text"
          value={nome}
          maxLength={GUILD_NOME_MAX}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Os Guardioes do Vale"
        />

        {/*
          O CONTADOR, que vira um problema so quando ele existe.

          Um contador que mostra "0/24" em campo vazio e ruido: o jogador
          ainda nem comecou. Ele aparece quando ja tem texto, e fica vermelho
          quando o texto passou do minimo ou esta perto do maximo — que e
          quando o numero e uma informacao e nao um decoracao
        */}
        {nome.trim().length > 0 && (
          <small
            className={[
              "gld-field__conta",
              nome.trim().length < GUILD_NOME_MIN ? "is-ruim" : "",
              nome.trim().length >= GUILD_NOME_MAX ? "is-limite" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {nome.trim().length < GUILD_NOME_MIN
              ? `Faltam ${GUILD_NOME_MIN - nome.trim().length} caracteres`
              : `${nome.trim().length}/${GUILD_NOME_MAX}`}
          </small>
        )}
      </label>

      <label className="gld-field">
        <span>Tag</span>

        <input
          type="text"
          value={tag}
          maxLength={GUILD_TAG_MAX}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          placeholder="GUAR"
        />

        {/*
          A MESMA CONTAGEM da tag, e pela mesma razao. E o `toUpperCase` no
          `onChange` e nao um `CSS text-transform`: o valor que vai para o
          servidor passa a ser o que o jogador ve, e nao o que ele digitou
          minusculo esperando que a tela fizesse o trabalho
        */}
        {tag.trim().length > 0 && (
          <small
            className={[
              "gld-field__conta",
              tag.trim().length < GUILD_TAG_MIN ? "is-ruim" : "",
              tag.trim().length >= GUILD_TAG_MAX ? "is-limite" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {tag.trim().length < GUILD_TAG_MIN
              ? `Faltam ${GUILD_TAG_MIN - tag.trim().length}`
              : `${tag.trim().length}/${GUILD_TAG_MAX}`}
          </small>
        )}
      </label>

      {/*
        O ESTILO, e a previa, logo depois da identidade.

        Vem antes do bloco "O que voce cria" porque e a parte da tela que o
        jogador vai mexer depois de decidir o nome: o nome e o formato sao a
        identidade, o emblema e a cor sao a aparencia

        E a previa vem colada no seletor porque e o RESULTADO da escolha.
        Separadas, o jogador teria de juntar as duas informacoes na cabeca
        para saber o que esta escolhendo — e o que esta escolhendo e
        literalmente o que sera pintado no boneco dele no mundo
      */}
<SeletorEstilo
          icone={estilo.icone}
          cor={estilo.cor}
          onChange={setEstilo}
        />

      {/*
        O PRECO, e o que falta para ele.

        ## POR QUE O BLOCO "O QUE VOCE CRIA" SAIU

        Eram tres linhas explicando bonus de stat, pontos por hora e cofre
        compartilhado — e o preco, que vem logo abaixo, e a unica coisa que
        trava o botao. O jogador que nao tem as moedas ve o "Criar guilda"
        cinza e a resposta na tela; o que ele ganha vem tres blocos depois,
        numa lista que ele le como marketing antes de mexer no saldo

        A `PreviaEstilo` FICOU, logo acima deste bloco. Ela repete o
        `[TAG] Nome` dos dois campos — mas a TAG sai na COR ESCOLHIDA, que o
        campo de texto nao mostra. Sem ela, a cor escolhida nao aparecia em
        lugar nenhum antes de a guilda existir

        O `SeletorEstilo` fica acima dela, porque ICONE e COR sao as duas
        escolhas, e a previa e o resultado delas

        Fica entre o que voce ganha e o botao porque e a resposta da pergunta
        que o jogador faria ao ver "Criar guilda" travado
      */}
      {/*
        O BOTAO E O PRECO, NA MESMA LINHA.

        ## POR QUE O PRECO VAI PARA CAI

        Porque o preco nao e uma informacao do FORMULARIO: e o preco da
        ACAO. Ele estava num paragrafo solto acima do botao, e o jogador lia
        "10.000" longe da coisa que custa 10.000

        Ao lado, o par e auto-explicativo: "Criar guilda" + o preço. E quando o
        saldo nao cobre, o `disabled` do botao e o `is-falta` da cifra falam
        ao mesmo tempo, sem o jogador ter de casar dois blocos

        ## E O ICONE ANTES DO VALOR

        Porque um numero solto nao diz de que moeda e. O `◉` e o mesmo
        glifo que a HUD usa no gold e que o mercado usa no preco — e o
        jogador le `[10.000]` como moedas de guild e `[⌀10.000]` como outra
        coisa
      */}
      <div className="gld-criar-linha">
        <button
          type="submit"
          className="gld-btn gld-btn--primary gld-btn--criar"
          disabled={!nomeOk || !tagOk || !temSaldo}
        >
          Criar guilda
        </button>

        <span
          className={[
            "gld-custo",
            temSaldo ? "is-ok" : "is-falta",
          ]
            .filter(Boolean)
            .join(" ")}
          data-tip={
            temSaldo
              ? "Voce tem moedas suficientes"
              : `Faltam ${formatarMoedas(GUILD_CRIACAO_CUSTO - moedas)}`
          }
        >
          <IconeMoeda moeda="coins" />
          {formatarMoedas(GUILD_CRIACAO_CUSTO)}
        </span>
      </div>
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
                  data-tip={
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
 * A ORDEM DOS BONUS DO RESUMO.
 *
 * E a ordem das CHAVES do `GUILD_BONUS_ROTULO`, e nao uma lista a parte.
 * Sao as mesmas sete, e nao sete de novo: uma segunda lista com os mesmos
 * sete nomes divergiria na primeira vez que um stat novo aparecesse — o
 * `GUILD_BONUS_ROTULO` ganharia a sigla e este resumo continuaria sem
 * mostrar o stat, sem erro nenhum
 */
const GUILD_BONUS_ROTULO_ORDER = Object.entries(GUILD_BONUS_ROTULO);

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
    <div className="gld-cartao gld-membros">
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
    <div className="gld-cartao gld-talentos">
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
  const caixaRef = useRef(null);

  const [arrastando, setArrastando] = useState(false);

  /**
   * O ARRASTE da arvore.
   *
   * ## POR QUE A CAIXA TEM `overflow` E A GRADE NAO
   *
   * A arvore tem mais colunas do que cabem num painel de 560px. Antes disso
   * aqui, a grade usava `grid-auto-columns: 1fr`, e `1fr` nunca desce do
   * `min-content` do no — entao as colunas ficavam espremidas, a ultima
   * transbordava, e o `overflow: hidden` do painel cortava o no. O jogador
   * perdia justamente a ponta da arvore
   *
   * Agora a CAIXA e quem rola no eixo X, e a grade mantem a largura que a
   * arvore precisa. A barra fica escondida: um no tem largura propria e uma
   * barra de rolagem embaixo deles roubaria a unica pista de que ainda ha
   * coluna para a direita — que e o arraste
   *
   * ## POR QUE O BOTAO "ATRIBUIR" NAO DISPARA O ARRASTE
   *
   * O `closest` no `pointerdown` e o que separa as duas intencoes. O jogador
   * que chega no botao quer ATRIBUIR, nao deslizar; o que chega no fundo da
   * arvore quer ver a outra ponta. Deixar o arraste comecar no botao
   * transformaria um clique em "arrastei e nao happened nada"
   *
   * E o `movido > 4` no `click` e a trava final: um arrasto que termina
   * sobre um botao nao pode virar clique. Sem ela, mirar o botao no meio de
   * um deslize comprava um ponto por acidente
   */
  const arraste = useRef({ ativo: false, x: 0, scroll: 0, movido: 0 });

  const aoPointerDown = useCallback((e) => {
    const caixa = caixaRef.current;

    if (!caixa) return;

    if (e.pointerType === "mouse" && e.button !== 0) return;

    if (e.target.closest("button, a")) return;

    /*
      A SELECAO DE TEXTO, do lado do JS.

      O `user-select: none` do CSS ja resolve, e este e o reforco para o
      Firefox: ele comeca a marcar no `pointerdown` antes de a regra entrar
      em vigor no elemento que esta sob o dedo

      E o `getSelection().removeAllRanges()` limpa o que ja tenha marcado —
      sem ele, o retangulo continua desenhado mesmo com o `user-select`
      ligado depois
    */
    e.preventDefault();

    window.getSelection?.()?.removeAllRanges();

    /*
      E O QUE SEPARA OS DOIS ARRASTES.

      O painel tambem se arrasta, e esse gesto vive no `onPointerDown` do
      CORPO — o pai da arvore. Sem o `stopPropagation`, todo arraste na
      arvore viraria arraste do painel: o jogador tentava ver a ponta da
      arvore e ganhava um painel boiando pela tela

      Os dois gestos usam o mesmo evento e o mesmo dedo. So o alvo os
      distingue
    */
    e.stopPropagation();

    arraste.current = {
      ativo: true,
      x: e.clientX,
      scroll: caixa.scrollLeft,
      movido: 0,
    };
  }, []);

  const aoPointerMove = useCallback((e) => {
    const caixa = caixaRef.current;
    const d = arraste.current;

    if (!caixa || !d.ativo) return;

    const delta = e.clientX - d.x;

    d.movido = Math.max(d.movido, Math.abs(delta));

    if (d.movido > 4) {
      setArrastando(true);

      caixa.setPointerCapture?.(e.pointerId);
    }

    caixa.scrollLeft = d.scroll - delta;
  }, []);

  const aoPointerUp = useCallback((e) => {
    const caixa = caixaRef.current;

    arraste.current.ativo = false;

    if (caixa?.hasPointerCapture?.(e.pointerId)) {
      caixa.releasePointerCapture(e.pointerId);
    }

    setArrastando(false);
  }, []);

  const aoClickCapture = useCallback((e) => {
    if (arraste.current.movido > 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

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
    <div
      className={[
        "gld-arvore",
        arrastando ? "is-arrastando" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={caixaRef}
      onPointerDown={aoPointerDown}
      onPointerMove={aoPointerMove}
      onPointerUp={aoPointerUp}
      onPointerCancel={aoPointerUp}
      onClickCapture={aoClickCapture}
    >
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
              <b key={s.stat} data-tip={`${s.nome}: +${s.valor}`}>
                +{s.valor} {s.sigla}
              </b>
            ))
          )}
        </span>

        {!node.noMaximo && (node.proximo ?? []).length > 0 && (
          <span className="gld-no__proximo">
            {(node.proximo ?? []).map((s) => (
              <i key={s.stat} data-tip={`Proximo nivel: +${s.valor} ${s.nome}`}>
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
        data-tip={
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
/**
 * OS 100 SLOTS DO COFRE DA GUILDA, na aba de Retirar.
 *
 * ## POR QUE UM NUMERO AQUI, E NAO O `cofre.capacity` DO SERVIDOR
 *
 * Porque o painel precisa desenhar a grade ANTES de saber o que tem dentro
 * dela, e a grade dos 100 slots e o que o jogador ve — nao o quanto esta
 * ocupado. Se o numero viesse do servidor, um cofre quase vazio mostraria uma
 * grade de 3 slots, e o layout pularia a cada peca guardada
 *
 * ## E POR QUE A ABA DE DEPOSITAR NAO USA ESTE NUMERO
 *
 * Porque ali os slots sao os da MOCHILA (`inventory.capacity`), que cresce
 * quando o jogador compra espaco. Um cofre de 100 nao vira uma mochila de 100
 *
 * E o mesmo desenho do bau do NPC: um limite por lado, porque cada aba e a
 * MESMA grade vista de duas direcoes
 */
const COFRE_SLOTS = 100;

function AbaCofre({ guilda, onCofre, inventory }) {
  const cofre = guilda?.cofre;

  /**
   * QUAL DOS DOIS LADOS ESTA ABERTO.
   *
   * ## POR QUE PAROU DE SER OS DOIS AO MESMO TEMPO
   *
   * Porque o painel tem 560px e cada lado recebia metade: 270px. E o
   * `inv-grid` do jogo e `repeat(5, var(--slot))` com `--slot` de 68px, ou
   * seja uns 360px fixos. Um grid de 360px dentro de uma caixa de 270px
   * estourava o painel, e era por isso que os itens apareciam enormes e
   * cortados: nao era o icone grande, era o grid nao cabendo
   *
   * ## E POR QUE UM so, e nao encolher o slot
   *
   * Encolher o slot caberia os dois lados, mas em 48px o item vira um
   * quadrado sem nome legivel — e o nome do item esta logo abaixo de cada
   * celula. Um cofre com quarenta slots e duas colunas de nomes ilegiveis
   * e pior que um cofre de uma coluna com nomes bons
   *
   * ## POR QUE ABAS E NAO UM BOTÃO DE TROCA
   *
   * Porque sao duas ACOES opostas: guardar e tirar. Juntas na mesma tela,
   * um clique errado deposita um item que o jogador queria retrieve. Em
   * Mir4 e Night Crows sao telas separadas por essa razao tambem, e o
   * titulo da aba ja diz o que o botao vai fazer
   */
  const [lado, setLado] = useState("depositar");

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
        AS MOEDAS, e a barra das DUAS ACOES.

        Continua no topo e nao dentro de nenhum dos lados porque e a leitura
        que os dois compartilham: o cofre nunca perde moeda, so ganha
      */}
      <p className="gld-cofre__moedas">
        {formatarMoedas(cofre.moedas ?? 0)} moedas no cofre
      </p>

      {/*
        AS DUAS ABAS.

        E `role="tablist"` com `aria-selected` porque sao abas de verdade, e
        nao dois botoes decorados: o leitor de tela tem que anunciar qual
        lado esta aberto, senao ele anuncia "Depositar, botao" e "Retirar,
        botao" sem dizer qual dos dois age
      */}
      <div
        className="gld-cofre__abas"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={lado === "depositar"}
          className={[
            "gld-cofre__aba",
            lado === "depositar" ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setLado("depositar")}
        >
          Depositar
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={lado === "retirar"}
          className={[
            "gld-cofre__aba",
            lado === "retirar" ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setLado("retirar")}
        >
          Retirar
        </button>
      </div>

      {/*
        SO UM PAINEL POR VEZ.

        O `key` forca a remontagem ao trocar de lado, e e o que impede o
        item selecionado e a quantidade digitada de vazar de "Depositar"
        para "Retirar": o estado do `PainelCofre` é local a ele, e sem o
        `key` o React reaproveitaria a instancia e o jogador veria
        "Poção Grande (5)" selecionado do outro lado

        E o `slots` que vem logo abaixo: QUANTOS QUADRADINHOS CADA ABA
        DESENHA, e as duas nao desenham o mesmo numero.

        Em "Depositar" vale a capacidade da MOCHA: 20 para quem tem 20, 30
        para quem comprou mais 10 espaco. Desenhar ali os 100 do cofre seria
        mentira — o jogador escolheria um slot que a mochila dele nao tem, e o
        servidor recusaria a peca depois que ela ja entrou no slot

        Em "Retirar" vale a capacidade do COFRE, que sao os 100 do `COFRE_SLOTS`
      */}
      <PainelCofre
        key={lado}
        lado={lado}
        titulo={lado === "depositar" ? "Depositar" : "Retirar"}
        dica={
          lado === "depositar"
            ? "Da mochila para o cofre"
            : "Do cofre para a mochila"
        }
        moedas={
          lado === "depositar"
            ? inventory?.coins ?? 0
            : cofre.moedas ?? 0
        }
        itens={lado === "depositar" ? inventory?.items ?? [] : slots}
        slots={
          lado === "depositar" ? (inventory?.capacity ?? 0) : COFRE_SLOTS
        }
        rotuloDaQuantidade={(e) =>
          lado === "depositar" ? e.count ?? 1 : e.quantidade ?? 1
        }

        /**
         * O `item` e o `uid` da MOCHILA no deposito, e o `uid` do SLOT no
         * saque. E o mesmo nome de campo nos dois porque o SERVIDOR e que
         * sabe qual dos dois o pedido quer: ele le `uid` para saque e `item`
         * para deposito
         */
        montarItem={(chave, quantidade) =>
          lado === "depositar"
            ? { item: chave, quantidade }
            : { uid: chave, quantidade }
        }

        onMover={(dados) =>
          onCofre?.(id, lado === "depositar" ? "depositar" : "retirar", dados)
        }
      />

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
  lado,
  titulo,
  dica,
  moedas,
  itens,
  slots,
  rotuloDaQuantidade,
  montarItem,
  onMover,
}) {
  const [chave, setChave] = useState(null);
  const [quantidade, setQuantidade] = useState("");

  const item = itens.find((i) => (i.uid ?? i.itemId) === chave);

  const maximo = item ? rotuloDaQuantidade(item) : 0;

  /**
   * ESTE ITEM EMPILHA, OU E SO UM?
   *
   * ## POR QUE A PERGUNTA PRECISA SER FEITA AQUI
   *
   * Porque o campo de quantidade estava sempre na tela, e ele e uma pergunta
   * sem resposta para o que nao empilha. Um anel chega com `maxStack: 1`: o
   * jogador via "Quantidade" com o maximo em 1 e nao tinha o que escolher
   *
   * A resposta vem do CATALOGO e nao do formato do item, porque quem sabe se
   * duas espadas iguais podem virar uma pilha e o catalogo — e ele ja tem o
   * campo, usado pelo inventario e pelo baú para empilhar
   *
   * ## POR QUE ESCONDER E NAO TRAVAR
   *
   * Porque o `max="1"` do `input` ja impedia digitar mais, e mesmo assim o
   * campo continuava ali, ocupando espaco e pedindo uma decisao que ja estava
   * tomada. Esconder deixa a linha com o nome, o "(1)" e o botao — que e
   * tudo que ha para fazer com aquela peca
   */
  const empilha = getItem(item?.itemId)?.stackable ?? false;

  const valor = Math.floor(Number(quantidade) || 0);

  const enviarItem = () => {
    if (!item) return;

    /**
     * O QUE NAO EMPILHA SAI INTEIRO, E O CODIGO DIZ ISSO.
     *
     * Sem este desvio, um numero que sobrou no campo — de um item que empilha
     * selecionado antes — iria junto para uma peca que so pode sair uma vez.
     * O `valor` aqui e 0 para o que nao empilha, porque nao ha campo para
     * digitar nele, mas a defesa fica escrita
     */
    const quantidadeFinal = empilha && valor > 0 ? valor : 1;

    onMover(montarItem(chave, quantidadeFinal));

    // a quantidade volta a 1 porque o item ja foi mexido: deixar o
    // numero_old na caixa faria o segundo clique mover o valor antigo
    // de novo, e o jogador nao saberia de onde o numero veio
    setQuantidade("");
    setChave(null);
  };

  return (
    <section className="gld-cartao">
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
          data-tip="Tudo o que tem aqui"
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

        {/*
        O BOTAO DO DINHEIRO, e ele fala em VERBO AGORA.

        ## POR QUE ELE SEGUE O `titulo` E NAO UM TEXTO FIXO

        Porque este mesmo painel monta os dois lados: o `GuildPanel` passa
        `titulo="Depositar"` de um lado e `titulo="Retirar"` do outro, com a
        mesma arvore. Escrever "Depositar" fixo deixaria o botao de saque
        prometendo o contrario do que ele faz — e o jogador que estava
        retirando seria mandado pelo texto para o outro caminho

        ## E POR QUE "MOEDAS" NAO SERVIA

        Porque o botao fica do lado de um campo que ja diz "moedas" no
        placeholder. O texto repetia o que a tela ja mostrava e nao dizia o
        que o clique FAZ: o jogador tinha de olhar para o titulo do cartao
        para saber se ia depositsitar ou sacar

        O verbo cabe no mesmo espaco do nome, e ele ja esta decorado pelo
        cartao — nao e preciso repetir
        */}
        <button
          type="button"
          className="gld-btn gld-btn--sm"
          disabled={valor <= 0 || valor > moedas}
          onClick={() => onMover({ moeda: valor })}
        >
          {titulo}
        </button>
      </div>

      {/* ---------- os itens ---------- */}

      {/*
        A GRADE SEMPRE, NUNCA O TEXTO DE VAZIO.

        Antes havia `{itens.length === 0 ? <p>{vazio}</p> : <grade>}`: um cofre
        vazio mostrava um aviso no lugar dos slots. Com as celulas fixas o
        cofre vazio É uma grade de quadrados vazios — e e isso que o jogador
        precisa ver: que existe espaco, e quanto
      */}
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

          {/*
            OS VAZIOS ATÉ `slots`, E NAO UM MAP SOBRE UM ARRAY DE `slots`.

            ## POR QUE UM DIV, E NAO O `InvSlotView`

            Porque o `InvSlotView` faz `getItem(entry.itemId)` e devolve `null`
            quando o item nao existe — o slot nem chega a ser desenhado.
            Passar `entry={null}` aqui renderizaria celulas invisiveis: o
            espaco da grade viria certo, mas o jogador nao veria o cofre

            E o mesmo desenho que a mochila usa no slot vazio dela
            (`InventoryPanel.jsx:753`), para que as duas grades leiam igual
          */}
          {Array.from({ length: Math.max(0, slots - itens.length) }, (_, i) => (
            <div key={`vazio-${i}`} className="inv-cell">
              <div className="inv-slot inv-slot--empty" aria-hidden="true" />
            </div>
          ))}
        </div>

      {/*
        A QUANTIDADE do item escolhido.

        So aparece depois de escolher um item. Um campo de quantidade
        permanent ao lado do campo das moedas e um formulario que o
        jogador preenche duas vezes sem saber qual dos dois esta valendo

        ## E SO PARA O QUE EMPILHA

        O anel, a armadura e o botao sao uma peca so. O campo apareceria
        com o maximo em 1 e sem nada para escolher, e o jogador gastaria o
        clique preguntando um numero que ja estava respondido
      */}
      {item && (
        <div className="gld-cofre__linha gld-cofre__linha--item">
          <span className="gld-cofre__escolhido">
            {getItem(item.itemId)?.name ?? item.nome ?? item.itemId}
            {" ("}
            {maximo}
            {")"}
          </span>

          {empilha && (
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
          )}

          <button
            type="button"
            className="gld-btn gld-btn--sm"
            onClick={enviarItem}
          >
            {/*
              O NOME DA AÇÃO, E NAO "Mover".

              ## POR QUE "MOVER" ESTAVA ERRADO

              "Mover" descreve a MECANICA, e nao o que o jogador vai fazer. O
              item nao muda de lugar dentro de uma tela: ele sai da mochila e
              entra no cofre, ou o contrario. Duas acoes opostas com o mesmo
              botao e o mesmo texto e o que faz o jogador clicarDepositando
              quando queria retirar

              ## E POR QUE O TEXTO VEM DO `lado`, E NAO DO `titulo`

              Porque o `titulo` e o que a aba escreve — mudar a palavra do titulo
              mudaria o botao junto, e o botao nao e o titulo. O `lado` e o
              valor que o servidor recebe, entao ele e a fonte da verdade
            */}
            {lado === "depositar" ? "Depositar" : "Retirar"}
          </button>
        </div>
      )}
    </section>
  );
}
