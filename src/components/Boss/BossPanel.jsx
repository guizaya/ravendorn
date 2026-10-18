import { useCallback, useMemo, useRef, useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import { ITEM_TYPE, ITEM_LIST } from "../../data/items/index.js";
import { RARITY_ORDER, RARITY_STYLE } from "../../data/items/raridade.js";
import {
  CHEFES_COM_ARTE,
  DIFICULDADES,
  arteDoChefe,
  nomeDaDificuldade,
} from "../../data/bosses/index.js";

  const MOTIVO = {
    "ja esta em uma expedicao": "Você já está em uma expedição.",
    "expedicao cheia": "Esta expedição está cheia.",
    "expedicao nao existe": "Esta expedição não existe mais.",
    "o lider dissolve, ele nao sair": "Você organiza esta expedição: dissolva.",
    "so o lider dissolve": "Só quem organiza pode dissolver.",
    "sem jogador": "Sessão sem personagem.",
    "sem chefe": "Escolha um chefe.",
    dificuldade: "Dificuldade inválida.",

    /**
     * A PARTY TRAVA A EXPEDIÇÃO, E A FRASE DIZ O QUE FAZER.
     *
     * "Você está em um grupo" sozinho deixaria o jogador sem saída: ele teria
     * de adivinhar que precisa sair da party, e o botão de sair fica na HUD,
     * longe desta tela. A frase nomeia a trava e diz o caminho
     */
    "voce esta em uma party":
      "Você está em um grupo. Saia dele para criar ou entrar numa expedição.",
  };




/**
 * O QUE O CHEFE PODE DAR, E POR QUE É UMA LISTA E NÃO UM FILTRO NO RENDER.
 *
 * ## OS CINCO TIPOS QUE O JOGADOR PROCURA
 *
 * Poção, material, pergaminho de teleporte, acessório e arma. Mais a peça da
 * classe dele. São as coisas que um chefe rende de verdade neste jogo, e não
 * invenção de layout: cada uma delas existe no `ITEM_LIST` com arte, preço e
 * raridade, e o painel só escolhe quais mostrar
 *
 * ## POR QUE A COR VEM DO `RARITY_STYLE`
 *
 * Porque a cor de um item no resto do jogo é a cor da raridade dele. Uma
 * paleta local aqui — azul, vermelho, verde, cinza — faria a recompensa do
 * chefe ter uma cor que nenhuma outra tela mostra, e o jogador perderia a
 * leitura de raridade que ele já sabe fazer olhando o inventário
 *
 * ## E POR QUE O ITEM VEM PRONTO DO CATÁLOGO
 *
 * Porque a raridade do drop é do ITEM, não da expedição. Um `pergaminho_teleporte`
 * é comum onde ele estiver, e fazer a dificuldade pintar um comum de roxo
 * faria o painel mentir sobre o que o jogador vai receber
 */
const TIPOS_DROP = [
  ITEM_TYPE.POTION,
  ITEM_TYPE.MATERIAL,
  ITEM_TYPE.TRINKET,
  ITEM_TYPE.WEAPON,
];

/**
 * O POOL DE UM CHEFE, MONTADO UMA VEZ POR CLASSE.
 *
 * ## E POR QUE ISSO NÃO É UM `useMemo` LONGO
 *
 * Porque é uma varredura de 93 itens sobre um filtro de tipo e outro de
 * classe, e o resultado é o mesmo a cada abertura. O `Map` guarda um pool por
 * classe para não refazer a varredura quando o jogador troca de coluna
 *
 * ## E O ITEM DA CLASSE ENTRA NA FRENTE
 *
 * Porque é o drop que o jogador mais quer ver: se ele equipou arqueiro, a
 * recompensa que interessa é arco e aljava, não a lista inteira do catálogo
 * embaralhada. A peça de classe ocupa a primeira linha, e o resto do pool
 * preenche embaixo
 */
const POOL_POR_CLASSE = new Map();

function poolDaClasse(classId) {
  const chave = classId ?? "";

  if (POOL_POR_CLASSE.has(chave)) return POOL_POR_CLASSE.get(chave);

  const daClasse = ITEM_LIST.filter((item) =>
    Array.isArray(item.classes) && item.classes.includes(classId),
  );

  const comuns = ITEM_LIST.filter(
    (item) =>
      TIPOS_DROP.includes(item.type) &&
      !daClasse.some((c) => c.id === item.id),
  );

  const pool = [...daClasse, ...comuns];

  POOL_POR_CLASSE.set(chave, pool);

  return pool;
}

/**
 * A RARIDADE DE UM ITEM, E O NÚMERO QUE ABRE O BALÃO.
 *
 * O `RARITY_ORDER` é o índice: ele vai do comum ao lendário na ordem do peso,
 * que é a ordem em que o jogador já aprende a ler raridade subindo na tela
 */
function estiloDoItem(item) {
  const estilo = RARITY_STYLE[item.rarity] ?? RARITY_STYLE.common;

  const posicao = RARITY_ORDER.indexOf(item.rarity);
  const ideal = posicao <= 0 ? 0 : [0, 30, 50, 70, 100][posicao];

  return {
    cor: estilo.color,
    rotulo: ideal > 0 ? `${estilo.label} (${ideal}%)` : estilo.label,
  };
}

/**
 * O JOGADOR DA SESSÃO.
 *
 * Vem do `snapshot.player.name` — o mesmo nome que a HUD mostra no topo. A
 * expedição criada pelo jogador precisa trazer o nome REAL dele, porque os
 * outros jogadores vão ver essa linha na busca. Um "Voce" fixo aqui
 * transformaria todo grupo criado em um grupo de "@Voce"
 */
const nomeDoJogador = (nomeDoPainel) =>
  nomeDoPainel?.trim() || "Aventureiro";

/**
 * A EXPEDIÇÃO NASCE SEM NOME, E COM O CHEFE E A DIFICULDADE QUE ESTÃO NA TELHA.
 *
 * ## POR QUE NEM O NOME NEM A DIFICULDADE SÃO PERGUNTADOS
 *
 * Porque a tela JÁ ESTÁ MOSTRANDO os dois. O jogador escolheu o chefe na
 * fileira e a dificuldade nos três botões, e abrir uma caixa para ele repetir
 * as duas escolhas é perguntar de novo o que ele acabou de responder — com o
 * risco dele responder diferente e criar a expedição para outro chefe sem
 * perceber
 *
 * ## E POR QUE O MÁXIMO É 5 E NÃO É PERGUNTADO
 *
 * Porque cinco é o número de lugares do chefe, e aDifficulty III é a única que
 * lota. Deixar o jogador escolher entre 2 e 5 criaria expedições de duas
 * pessoas para um chefe que aceita cinco, e a expedição fecharia com sobra —
 * sem nenhum ganho para quem organiza
 */
const MAX_DE_MEMBROS = 5;



/**
 * A CAIXA DAS DUAS SUB-MODAIS.
 *
 * E um `div` comum, e nao um `<dialog>`, por dois motivos: o conteudo precisa
 * ficar DENTRO da modal do chefe — no HTML as camadas sao filhas do `.modal`, e
 * a moldura do chefe em volta e o que faz o jogador saber que esta na mesma
 * tela. E `<dialog>` fecha sozinho no `Esc` do navegador, antes do React
 * saber, e o estado de "qual camada esta aberta" ficaria com duas verdades
 *
 * O `estreita` e o que trocaria o `width` da caixa, e ele foi embora junto com a
 * caixa de criação: sobrou uma camada só, a de busca, e um parametro que nunca
 * entra em `true` é só uma coisa para lembrar de limpar depois
 */
function Capa({ children, aoFechar }) {
  return (
    <div
      className="boss-capa"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="boss-capa__box">{children}</div>
    </div>
  );
}

/**
 * PROCURAR EXPEDIÇÃO.
 *
 * ## A ORDEM DA LISTA E O QUE FAZ A LISTA SER ÚTIL
 *
 * A do HTML era `minha`, depois `entrou`, depois id. É a ordem de quem o
 * jogador tem mais a ver com aquilo: primeiro a expedição em que ele está,
 * depois as outras dele, e só então o resto — o mais novo, porque quem acabou
 * de formar é o que ainda tem vaga
 */
function CapaBuscar({
  expedicoes,
  filtro,
  erro,
  aoMudarFiltro,
  aoEntrar,
  aoSair,
  aoDissolver,
  emParty,
  aoFechar,
}) {
  /**
   * DE QUE EXPEDIÇÃO O "INFO" ESTÁ ABERTO.
   *
   * ## POR QUE FICA NESTA CAMADA E NÃO NO PAINEL
   *
   * Porque a lista e renderizada aqui, dentro do `CapaBuscar`. O estado no
   * componente de cima exigiria descer por prop um `infoAberta` e um
   * `setInfoAberta` que so esta camada usa
   *
   * ## POR QUE GUARDA O ID E NÃO UM BOOLEANO
   *
   * Porque a lista mostra varias linhas, e cada uma tem o seu "Info". Com um
   * booleano, abrir o da segunda linha continuaria mostrando o da primeira — o
   * jogador leria o roster errado, que e pior do que nenhum
   *
   * E um ID, e nao o objeto inteiro: o roster chega no pacote de 4Hz, e um
   * objeto guardado em estado viraria uma segunda copia, desatualizada
   */
  const [infoAberta, setInfoAberta] = useState(null);
  /**
   * O STORE JÁ ORDENOU, E AQUI NÃO SE ORDENA DE NOVO.
   *
   * Antes desta tela ter servidor, a ordenação era feita no componente: o meu
   * primeiro, e as mais novas depois. Essa regra vive agora no `listar` do
   * `ExpeditionStore`, e ela é a mesma para o painel e para qualquer outra tela
   * que precise da lista — ordenar aqui de novo era ter a regra em dois lugares,
   * e o que apareceria primeiro mudaria sozinho
   *
   * O filtro também já vem aplicado: quem filtra é o componente pai, porque o
   * chip é estado de interface e não de mundo
   */
  const lista = expedicoes;

  /**
   * O MOTIVO DA RECUSA, TRADUZIDO AQUI.
   *
   * O store devolve CÓDIGO e não frase, porque ele não tem dicionário de texto
   * e um store que sabe falar português é um store de interface. A tradução
   * mora com quem mostra — e cada motivo é uma frase diferente, porque "você
   * já está em uma" e "expedição cheia" pedem ações opostas do jogador
   */

  return (
    <Capa aoFechar={aoFechar}>
      <header className="boss-capa__topo">
        Procurar expedição

        <button
          type="button"
          className="boss-capa__x"
          onClick={aoFechar}
          aria-label="Fechar"
        >
          ✕
        </button>
      </header>

      <div className="boss-filtros">
        {[-1, 0, 1, 2].map((f) => (
          <button
            key={f}
            type="button"
            className={[
              "boss-chip",
              filtro === f ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => aoMudarFiltro(f)}
          >
            {f < 0 ? "Todas" : nomeDaDificuldade(f)}
          </button>
        ))}

        <span className="boss-filtros__conta">
          {lista.length} expedição{lista.length === 1 ? "" : "ões"}
        </span>
      </div>

      {/**
       * O AVISO DA RECUSA, e o que impede o clique de parecer quebrado.
       *
       * A causa está no store e o texto vem do dicionário acima. Sem esta
       * linha o jogador clicaria em "entrar" numa expedição cheia, o servidor
       * recusaria, e nada apareceria — indistinguishable de um botão morto
       */}
      {erro ? (
        <p className="boss-aviso">{MOTIVO[erro] ?? erro}</p>
      ) : null}

      <div className="boss-lista">
        {lista.length === 0 ? (
          <p className="boss-lista__vazia">
            <strong>Nenhuma expedição</strong>
            Crie uma para ela aparecer aqui.
          </p>
        ) : (
          lista.map((e) => {
            /**
             * `lotada`, `souEu` E `chefe` VÊM PRONTOS DO STORE.
             *
             * Antes estas três contas eram feitas aqui, com os campos do
             * estado local. Com a lista vindo do servidor, o store já sabe
             * quem é o líder e se a vaga fechou — e refazer a conta aqui seria
             * a mesma regra em dois lugares, que divergem no primeiro
             * critério que o store ganhar
             *
             * E `membros` é um NÚMERO, não um array: o store manda só a
             * contagem, porque os nomes dos outros jogadores não existem no
             * pacote — mandar o array inteiro significaria mandar quem está em
             * cada grupo para qualquer jogador que procurar
             */
            const souEu = e.souLider || e.estouAqui;

            return (
              <article
                key={e.id}
                className={[
                  "boss-linha",
                  souEu ? "is-minha" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/**
                 * A ETIQUETA DA DIFICULDADE, e nao um numero solto.
                 *
                 * Porque o III sozinho nao diz nada: a cor e o que o jogador
                 * le da direita para a esquerda enquanto desce a lista. E as
                 * tres cores sao as do jogo — carmesim, ouro e roxo — nao as
                 * do HTML, que nao tinha nenhuma
                 */}
                <span
                  className={`boss-linha__tag is-d${e.dificuldade}`}
                  data-tip={`Dificuldade ${nomeDaDificuldade(e.dificuldade)}`}
                >
                  {nomeDaDificuldade(e.dificuldade)}
                </span>

                <div className="boss-linha__info">
                  <strong className="boss-linha__nome">{e.nome}</strong>

                  <small className="boss-linha__sub">
                    {e.souLider
                      ? "Sua expedição"
                      : `Nv. ${DIFICULDADES[e.dificuldade].nivel}`}
                    {e.estouAqui ? " · você entrou" : ""}
                  </small>
                </div>

                <span className="boss-linha__membros">
                  {e.membros}/{e.max}
                </span>

                <div className="boss-linha__acoes">
                  {souEu ? (
                    <>
                      <button
                        type="button"
                        className="boss-btn-pequeno"
                        aria-expanded={infoAberta === e.id}
                        data-tip="Quem está nesta expedição"
                        onClick={() =>
                          setInfoAberta((atual) =>
                            atual === e.id ? null : e.id,
                          )
                        }
                      >
                        Info
                      </button>

                      <button
                        type="button"
                        className="boss-btn-pequeno boss-btn-pequeno--perigo"
                        onClick={() => {
                          /* o grupo muda: a caixa nao sobrevive a quem saiu */
                          setInfoAberta(null);

                          e.souLider
                            ? aoDissolver(e.id)
                            : aoSair(e.id);
                        }}
                      >
                        {e.souLider ? "Dissolver" : "Sair"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="boss-btn-pequeno"
                      disabled={e.lotada || emParty}
                      data-tip={
                        emParty ? MOTIVO["voce esta em uma party"] : undefined
                      }
                      onClick={() => aoEntrar(e.id)}
                    >
                      {e.lotada ? "Cheia" : "Entrar"}
                    </button>
                  )}
                </div>

                {/**
                 * O ROSTER DA MINHA EXPEDIÇÃO.
                 *
                 * Só existe na linha em que o jogador esta — o servidor manda
                 * `roster` apenas nas expedicoes das quais ele participa, e
                 * `null` nas outras. E `null` e o que segura a informacao de
                 * dentro do grupo, sem virar uma lista de nomes de todo mundo
                 * para quem so esta procurando
                 *
                 * E a lista sai do `roster` cru, e nao de um filtro no nome da
                 * expedicao: o `id` e o que o servidor e o painel falam
                 */}
                {infoAberta === e.id && e.roster && (
                  <div className="boss-linha__roster">
                    {e.roster.map((m) => (
                      <span
                        key={m.id}
                        className="boss-roster__membro"
                      >
                        {/*
                          A COR DO LIDER, e nao um icone.
                          *
                          * O "voce" do painel ja diz que a expedicao e sua, e
                          * um glifo a mais disputaria o canto do nome com a
                          * contagem de membros
                          */}
                        {m.lider ? (
                          <strong>{m.nome}</strong>
                        ) : (
                          m.nome
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </Capa>
  );
}

export default function BossPanel({
  classId = null,
  nomeDoJogadorDoPainel = null,
  expedicoes = null,
  minhaExpedicao = null,
  erroExpedicao = null,
  emParty = false,
  intencao = null,
  onClose,
}) {
  const [chefeSelecionado, setChefeSelecionado] = useState(0);
  const [dificuldade, setDificuldade] = useState(0);
  const faixasRef = useRef(null);
  const arraste = useRef(null);
  const [arrastando, setArrastando] = useState(false);

  /**
   * A EXPEDIÇÃO DO JOGADOR, E A CAMADA ABERTA.
   *
   * ## POR QUE A CAMADA É ESTADO E NÃO UM `<dialog>`
   *
   * Porque no HTML as duas caixas são `display: none` alternado por uma classe,
   * dentro da própria modal. Um `<dialog>` abre fora dela, perde a moldura do
   * chefe ao redor, e no `Esc` do navegador fecha antes do React saber
   */
  const [camada, setCamada] = useState(null);
  const [filtro, setFiltro] = useState(-1);

  /**
   * A LISTA VEM DO SERVIDOR, E O PAINEL NAO TEM MAIS ESTADO DELA.
   *
   * ## POR QUE ISSO MUDOU
   *
   * Enquanto a expedicao morava num `useState` do componente, ela era um grupo
   * de uma pessoa so: o jogador criava, e o proprio painel mostrava. Com dois
   * personagens na tela, cada um veria a expedicao do outro como inexistente —
   * e o botao `entrar` nao teria em quem clicar
   *
   * ## POR QUE O `intencao` E PROP E NAO UM CALLBACK POR ACAO
   *
   * Porque as quatro acoes saem pelo mesmo caminho que o resto do jogo sai — o
   * pacote `PANEL` — e o motor e quem traduz pedido em metodo. Um callback por
   * acao aqui passaria a operacao pelo `useGameClient`, que e uma camada a mais
   * entre o painel e o protocolo
   *
   * E o filtro e estado LOCAL de verdade: e a aba que o jogador esta olhando,
   * e trocar de chip nao muda nada no mundo
   */
  const lista = expedicoes ?? [];

  /**
   * A LISTA QUE O JOGADOR VE, JA COM O FILTRO DA ABA.
   *
   * O filtro e aplicado aqui e nao no store porque muda a cada clique no chip,
   * e uma ida ao servidor por clique mostraria a lista piscando a cada toque.
   * O dado que volta e pequeno — cinco expedicoes por chefe, no maximo
   */
  const listaFiltrada = lista.filter((e) =>
    filtro < 0 ? true : e.dificuldade === filtro,
  );

  /**
   * CRIAR, E UM CLIQUE SEQUER.
   *
   * A tela JA ESTA com o chefe e a dificuldade escolhidos, e perguntar os dois
   * de novo e fazer o jogador responder a mesma pergunta duas vezes — com o
   * risco de responder diferente e criar a expedicao para outro chefe sem
   * perceber
   */
  const criar = useCallback(() => {
    intencao?.criarExpedicao?.({
      chefeId: CHEFES_COM_ARTE[chefeSelecionado].id,
      dificuldade,
    });
  }, [intencao, dificuldade, chefeSelecionado]);
  const chefe = CHEFES_COM_ARTE[chefeSelecionado];
  const dif = DIFICULDADES[dificuldade];

  /**
   * A RECOMPENSA, SEMPRE A MESMA PARA A MESMA DIFICULDADE.
   *
   * Porque é uma PRÉVIA do que a expedição rende, e uma prévia que muda a
   * cada abertura faz o jogador desconfiar dela. A semente é presa na
   * dificuldade: muda de dificuldade em dificuldade, nunca de clique em clique
   *
   * E a chave inclui a CLASSE, porque a mesma dificuldade rende coisas
   * diferentes para um arqueiro e para um guerreiro — e a prévia mentiria se
   * mostrasse o arco para quem não pode equipar
   */
  const recompensas = useMemo(() => {
    const pool = poolDaClasse(classId);

    if (pool.length === 0) return [];

    let semente = dificuldade * 977 + 13;

    const proximo = () => {
      semente = (semente * 16807) % 2147483647;
      return semente / 2147483647;
    };

    const usados = new Set();

    return Array.from({ length: dif.entradas }, (_, i) => {
      /**
       * SEM REPETIR ITEM, E O QUE FAZ A PRÉVIA VALER.
       *
       * Com reposição simples a mesma poção apareceria seis vezes na grade, e
       * o jogador leria "poção, poção, poção" como o chefe ter uma fraqueza
       * em vez de um loot variado. O `guarda` impede que o laço trave num pool
       * pequeno: se todas as peças já saíram, ele aceita a repetição
       */
      let sorte = proximo();
      let escolhido = pool[Math.floor(sorte * pool.length)];
      let guarda = 0;

      while (usados.has(escolhido.id) && guarda < 12) {
        sorte = proximo();
        escolhido = pool[Math.floor(sorte * pool.length)];
        guarda += 1;
      }

      usados.add(escolhido.id);

      const estilo = estiloDoItem(escolhido);

      return {
        key: `${dificuldade}-${i}`,
        item: escolhido,
        raridade: escolhido.rarity,
        cor: estilo.cor,
        rotulo: `${escolhido.name} — ${estilo.rotulo}`,
        quantidade: proximo() > 0.72 ? 1 + Math.floor(proximo() * 3) : 1,
        nivel: i < 3 + dificuldade && proximo() > 0.4,
      };
    });
  }, [dificuldade, dif.entradas, classId]);

  /**
   * A FILEIRA ROLA COM A RODA DO MOUSE E COM O ARRASTE.
   *
   * ## POR QUE A RODA PRECISA DO `wheel` E NÃO BASTA O `overflow-x`
   *
   * Porque o `overflow-x` rola a barra horizontal, e a roda do mouse manda o
   * eixo vertical. Sem este desvio, passar o mouse na fileira rolaria o PAINEL
   * inteiro — e o painel é o funil inteiro, com oito linhas de altura
   *
   * O `passive: false` e obrigatorio pelo mesmo motivo do zoom da arvore: sem
   * ele o navegador trata o `wheel` como nao cancelavel e o `preventDefault` e
   * ignorado
   */
  const rolar = (e) => {
    if (!e.deltaY) return;

    e.preventDefault();

    const caixa = faixasRef.current;

    if (caixa) caixa.scrollLeft += e.deltaY;
  };

  /**
   * O ARRASTE, E O MESMO GESTO DA ÁRVORE DE HABILIDADE.
   *
   * ## POR QUE A CAPTURA DO PONTEIRO SÓ ACONTECE DEPOIS DO LIMIAR
   *
   * Porque `setPointerCapture` FAZ O CLIQUE PARAR DE CHEGAR NO BOTÃO. Com a
   * captura ativa na div da fileira, o `click` passa a ter como alvo a própria
   * div — e o `onClick` do card nunca dispara. Era o que impedia o segundo card
   * de trocar o chefe
   *
   * A captura é adiada para o instante em que `movido > 4`, que é quando já
   * sabemos que é arraste. Antes disso o ponteiro fica solto, e um clique sem
   * movimento é um clique comum, selecionando o chefe
   */
  const aoPointerDown = useCallback((e) => {
    const caixa = faixasRef.current;

    if (!caixa) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    arraste.current = {
      id: e.pointerId,
      x: e.clientX,
      sx: caixa.scrollLeft,
      movido: 0,
      capturado: false,
    };
  }, []);

  const aoPointerMove = useCallback((e) => {
    const caixa = faixasRef.current;
    const d = arraste.current;

    if (!caixa || d === null || d.id !== e.pointerId) return;

    const dx = e.clientX - d.x;

    d.movido = Math.max(d.movido, Math.abs(dx));

    if (d.movido > 4 && !d.capturado) {
      d.capturado = true;
      caixa.setPointerCapture?.(e.pointerId);
    }

    if (!d.capturado) return;

    caixa.scrollLeft = d.sx - dx;

    setArrastando(true);
  }, []);

  const aoPointerUp = useCallback((e) => {
    const caixa = faixasRef.current;
    const d = arraste.current;

    if (d?.capturado) caixa?.releasePointerCapture?.(e.pointerId);

    arraste.current = null;

    setArrastando(false);
  }, []);

  const aoClickCapture = useCallback((e) => {
    if ((arraste.current?.movido ?? 0) > 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return (
    <section className="boss-modal" aria-label="Chefe">
      {/**
       * O FECHAR, NO CANTO DIREITO SUPERIOR.
       *
       * ## POR QUE ELE NAO ESTÁ NO TETO
       *
       * Porque o teto deste desenho é do lado esquerdo: as duas abas ocupam o
       * canto e a arte desce logo abaixo delas. O canto direito é da coluna de
       * informação, e um fechar no meio do teto dela brigaria com o nome do
       * chefe — que é a primeira coisa que o jogador lê nesta tela
       *
       * E é um botão de verdade, com `aria-label`, e não um `✕` solto: ele é
       * o botão do teclado para sair, e `✕` não é announcement
       */}
      <button
        type="button"
        className="boss-modal__fechar"
        onClick={onClose}
        aria-label="Fechar o painel do chefe"
        data-tip="Fechar"
      >
        ✕
      </button>

      <div className="boss-modal__vinheta" aria-hidden="true" />

{/**
       * A FILEIRA DE CHEFES, COLADA NO TETO.
       *
       * ## POR QUE NÃO HÁ ABAS ACIMA DELA
       *
       * Porque "Chefe" e "Raid" respondiam "qual tipo de tela", e a tela é a
       * mesma nas duas: o que muda é quem entra, não o que se vê. A distinção
       * que importa agora é "qual chefe", e essa está no desenho da própria
       * fileira — cada caixa é um chefe, e a que está com a borda dourada é o
       * selecionado
       *
       * E a fileira no teto devolve os 46px que as abas ocupavam, mais o
       * `42px` de deslocamento que ela tinha para caber embaixo delas. Sem as
       * duas coisas, sobraria uma faixa vazia entre o topo e o primeiro chefe
       */}
<div
            className={[
              "boss-faixas",
              arrastando ? "is-arrastando" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            ref={faixasRef}
            onWheel={rolar}
            onPointerDown={aoPointerDown}
            onPointerMove={aoPointerMove}
            onPointerUp={aoPointerUp}
            onPointerCancel={aoPointerUp}
            onClickCapture={aoClickCapture}
            role="tablist"
            aria-label="Chefes"
          >
        {CHEFES_COM_ARTE.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={CHEFES_COM_ARTE.indexOf(c) === chefeSelecionado}
            className={[
              "boss-faixa",
              CHEFES_COM_ARTE.indexOf(c) === chefeSelecionado ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setChefeSelecionado(CHEFES_COM_ARTE.indexOf(c))}
            data-tip={c.nome}
          >
            {/**
             * A MINIATURA, E O MESMO `ARTE` DO CENTRO, ENCOLHIDO.
             *
             * Reconhecer a miniatura antes de clicar é o que faz o clique
             * parecer óbvio em vez de adivinhação — e a arte da miniatura é a
             * mesma do meio, então o jogador confirma a escolha vendo a peça
             * grande ficar igual à pequena que ele apertou
             */}
<img
      className="boss-faixa__arte"
      src={arteDoChefe(c.id)}
      alt={c.nome}
      draggable={false}
      loading="lazy"
      decoding="async"
    />
          </button>
        ))}
      </div>

      {/**
       * A ARTE DO CENTRO.
       *
       * ## POR QUE ELA VEIO SEM A SOMBRA DEBAIXO
       *
       * A versão do HTML tinha uma elipse escura suave embaixo do chefe, para
       * "pousar" a arte no chão. Aqui ela lia como um brilho cinza no fundo da
       * modal: um borrão de borda mole em cima do gradiente de madeira pega o
       * olho antes do próprio chefe, e o jogador enxergava um halo que não
       * estava em lugar nenhum do resto do painel
       *
       * E a vinheta já faz esse trabalho: ela escurece a base da tela, e é o
       * que separa o chão do fundo sem precisar de um borrão no meio
       */}
      <div className="boss-arte" aria-hidden="true">
        {/**
         * A ARTE DO CHEFE SELECIONADO.
         *
         * E `key={chefe.id}` porque os dois chefes com arte são GIFs de
         * exatamente 168x168 — o mesmo tamanho, o mesmo formato. Sem a chave,
         * o React reusa o elemento `<img>` e só troca o `src`: o navegador
         * mantinha o quadro do gif anterior na tela até a primeira imagem nova
         * decodificar, e o jogador via o chefe errado por um instante
         *
         * E o `null` para os seis sem arte: o bloco some inteiro, em vez de
         * ficar um quadrão vazio no meio da tela. Um chefe sem arte nesta tela
         * ainda tem nome e recompensa, e o vazio honesto lê melhor que um
         * espaço reservado que ninguém preenche
         */}
        {arteDoChefe(chefe.id) ? (
<img
      key={chefe.id}
      className="boss-arte__gif"
      src={arteDoChefe(chefe.id)}
      alt={chefe.nome}
      draggable={false}
      loading="lazy"
      decoding="async"
    />
        ) : null}
      </div>

      <aside className="boss-info">
        {/**
         * O NOME SOZINHO, E O SUBTÍTULO SUMIU.
         *
         * A linha acima do nome era o subtítulo do chefe — "Guardião da Ponte
         * Cinzenta" no primeiro. Saiu inteira, e não só a do primeiro: manter
         * sete chefes com subtítulo e um sem é pior do que não ter nenhum,
         * porque o olho passa a esperar uma linha que às vezes não vem
         *
         * E o nome do chefe já está na arte do meio, na miniatura da fileira e
         * na dica do botão. O subtítulo repetia a mesma informação com três
         * palavras a mais, empurrando o nome para baixo do meio da coluna
         */}
        <h1 className="boss-info__nome">{chefe.nome}</h1>

        <div className="boss-info__stats">
          <span>Nv. {dif.nivel}</span>
          <span>5 lugares</span>
        </div>

        <hr className="boss-info__traco" />

        <p className="boss-info__rotulo">Dificuldade</p>

        <div className="boss-dif">
          {DIFICULDADES.map((d, i) => (
            <button
              key={d.id}
              type="button"
              className={[
                "boss-dif__btn",
                i === dificuldade ? "is-on" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setDificuldade(i)}
              data-tip={`Dificuldade ${d.id} — nivel ${d.nivel}`}
            >
              {d.id}
            </button>
          ))}
        </div>

        <p className="boss-info__rotulo">Recompensa esperada</p>

        {/**
         * A GRADE ROLA, E COM SCROLLBAR DO TEMA.
         *
         * Porque trinta e duas recompensas nao cabem na coluna sem rolar, e a
         * rolagem do painel inteiro esconderia os botoes do rodape junto. A
         * coluna rola sozinha e o rodape fica onde esta
         */}
        <div className="boss-recompensas">
          {recompensas.map((r) => (
            <div
              key={r.key}
              /**
               * A CLASSE DE RARIDADE É A DO INVENTÁRIO, e não uma daqui.
               *
               * `.inv-slot--uncommon` e companhia são regras simples, sem
               * âncora de painel: escrever a classe aqui faz o FUNDO sair do
               * mesmo CSS que pinta o baú, o inventário e o cofre. Não é
               * "parecido com o inventário" — é o mesmo fundo, do mesmo
               * lugar, e vai mudar junto quando alguém mexer lá
               */
              className={[
                "boss-recompensa",
                `inv-slot--${r.raridade}`,
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--rarity": r.cor }}
              data-tip={r.rotulo}
            >
              {/**
               * O `ItemIcon` E O MESMO QUE O DO INVENTARIO.
               *
               * Ele cai no glifo quando a arte nao existe, e o que importa
               * aqui: uma recompensa de chefe com arte de um lado e glifo do
               * outro faria o jogador ler o lado com glifo como item quebrado,
               * e nao como item sem arte. E o componente ja existe, ja sabe
               * resolver o caminho, e ja cai no glifo certo
               */}
              <ItemIcon
                item={r.item}
                rarity={r.item.rarity}
                className="boss-recompensa__arte"
              />

              {r.nivel ? (
                <span className="boss-recompensa__nivel">Nv.</span>
              ) : null}

              {r.quantidade > 1 ? (
                <span className="boss-recompensa__qtd">
                  {r.quantidade}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {/**
       * OS DOIS BOTÕES DO RODAPÉ, E O PAR QUE ELES TROCAM.
       *
       * Estando em uma expedição, "procurar" e "criar" somem e "ver
       * expedição" ocupa o lugar. Não é decoração: entrar em duas expedições ao
       * mesmo tempo não tem estado possível — o jogador é um corpo só.
       *
       * E o "ver" volta para a busca com o filtro já preso na expedição dele.
       * Abrir a lista geral obrigaria o jogador a procurar o próprio grupo
       * entre os dos outros, que é a coisa mais irritante que essa tela pode
       * fazer com ele
       */}
      <div className="boss-acoes">
        {minhaExpedicao ? (
          <button
            type="button"
            className="boss-btn boss-btn--primario"
            onClick={() => {
              setFiltro(minhaExpedicao.dificuldade);
              setCamada("buscar");
            }}
          >
            Ver expedição
          </button>
        ) : (
          <>
            <button
              type="button"
              className="boss-btn"
              onClick={() => setCamada("buscar")}
            >
              Procurar grupo
            </button>

            {/**
             * O CRIAR TRAVADO COM A `data-tip`, E NÃO COM O TEXTO TROCADO.
             *
             * Trocar "Criar expedição" por "Você está em um grupo" tiraria do
             * rodapé a palavra que diz O QUE o botão faz. O botão continua
             * dizendo o que é, e a dica diz por que está desligado — que é a
             * mesma conta do "Sem moedas" da loja e do "Aprendida" do livro
             *
             * E o `disabled` é UI, não a regra: quem barra de verdade é o
             * `GameServer`, e esta linha existe para o jogador não descobrir
             * a trava com um clique
             */}
            <button
              type="button"
              className="boss-btn boss-btn--primario"
              disabled={emParty}
              data-tip={
                emParty ? MOTIVO["voce esta em uma party"] : undefined
              }
              onClick={criar}
            >
              Criar expedição
            </button>
          </>
        )}
      </div>
      </aside>

      {camada === "buscar" ? (
        <CapaBuscar
expedicoes={listaFiltrada}
              filtro={filtro}
              aoMudarFiltro={setFiltro}
              erro={erroExpedicao}
              emParty={emParty}
              aoEntrar={(id) => intencao?.entrarExpedicao?.(id)}
              aoSair={(id) => intencao?.sairExpedicao?.(id)}
              aoDissolver={(id) => intencao?.dissolverExpedicao?.(id)}
              aoFechar={() => setCamada(null)}
        />
      ) : null}
    </section>
  );
}