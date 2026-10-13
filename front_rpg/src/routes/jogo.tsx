import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { urlDoJogo, lerTokenPendente } from '@/lib/api'
import { NOME_DO_PROJETO } from '@/components/marca-projeto'

/**
 * A ROTA AINDA ACEITA `?token=`, POR COMPATIBILIDADE.
 *
 * O token passou a ir pelo `sessionStorage`, e o `navigate({ to: '/jogo' })`
 * chega aqui sem query nenhuma. O `validateSearch` continua existindo para o
 * link antigo e para o `F5` de quem ja estava na tela: o token da query e
 * lido e a URL e limpa na hora
 *
 * Quem nao tem token em lugar nenhum cai na selecao de classe do jogo, que
 * e o comportamento certo para quem abriu `/jogo` direto
 */
export const Route = createFileRoute('/jogo')({
  validateSearch: (search: Record<string, unknown>): { token?: string | undefined } => {
    const token = search['token']

    return { token: typeof token === 'string' ? token : undefined }
  },

  head: () => ({
    meta: [
      { title: NOME_DO_PROJETO },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
    ],
  }),
  component: TelaDoJogo,
})

/**
 * A PAGINA DO MAPA, DENTRO DE UM IFRAME.
 *
 * ## POR QUE IFRAME E NAO IMPORTAR O JOGO
 *
 * Sao duas aplicacoes React com build proprio: o site (TanStack Start, SSR) e
 * o jogo (Vite, com o plugin que le `.tmj` e 300 arquivos de motor). Juntar
 * os dois num bundle exigiria mexer no preset do build, que o `AGENTS.md`
 * do front manda nao alterar
 *
 * O iframe resolve os dois problemas de uma vez:
 *
 *  - o CSS do jogo (777 KB) fica no documento DELE, e nao escapa para o
 *    site. O Tailwind do front nunca alcanca o mapa
 *  - o jogo so roda no navegador: `canvas`, `WebSocket`, `document`. Numa
 *    rota SSR isso quebraria no servidor
 *
 * ## O TOKEN CHEGA POR POSTMESSAGE, E NAO PELA URL
 *
 * O token de entrada vive 60 segundos e vale uma vez. Passar pela query do
 * iframe o deixaria na barra de endereco, no historico e no `Referer` de
 * qualquer coisa que o mapa carregasse
 *
 * A rota espera o iframe mandar `postMessage({ tipo: "pronto" })`, e so
 * entao responde com o token. O jogo usa esse token no JOIN e limpa a URL
 *
 * ## A MESMA ORIGIN DE PROPOSITO
 *
 * O `jogo.html` e servido pelo MESMO servidor que a API e o WebSocket, e o
 * `urlDoServidor()` do jogo deriva o socket de `window.location`. Assim o
 * mapa fala com `/ws` na origem que ja esta aberta, sem CORS e sem
 * configuracao de host
 */
function TelaDoJogo() {
  const { token: tokenDaUrl } = Route.useSearch()

  /**
   * A URL DO IFRAME, RESOLVIDA UMA VEZ.
   *
   * ## POR QUE UM ESTADO E NAO A CHAMADA DIRETA NO JSX
   *
   * Porque `urlDoJogo()` no corpo do JSX roda tambem no SERVIDOR, e o front
   * e SSR. La ela devolve `""` (nao ha `window`), e sem o estado o React
   * resolveria o iframe contra a propria origin do front — que em dev aponta
   * para 3000, e nao para o jogo. A reidratacao corrigiria, mas depender
   * disso e fragil
   *
   * ## E O QUE O ESTADO FAZ
   *
   * No servidor fica a string vazia, e o JSX converte para `undefined` — que o
   * React entende como "ainda nao sei" e nao escreve atributo. No cliente, o
   * primeiro render ja traz a URL certa — o `useState` so roda a funcao
   * inicial na primeira montagem
   *
   * Sem token, o mapa abre na selecao de classe do jogo, que e o
   * comportamento correto para quem abriu `/jogo` direto
   */
  const [urlDoMapa] = useState(() => {
    const base = urlDoJogo();

    return base ? `${base}/jogo.html` : "";
  })

  const moldura = useRef<HTMLIFrameElement>(null)
  const [pronto, setPronto] = useState(false)
  const [mundoPronto, setMundoPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  /**
   * DOIS "PRONTOS", E ELES RESPONDEM A COISAS DIFERENTES
   *
   * `pronto` e "o documento do iframe subiu, me manda o token". Sai no
   * `window.load` do jogo, que so espera HTML, CSS e `<img>` do DOM
   *
   * `mundoPronto` e "o chao ja esta pronto para desenhar". Sai quando a
   * folha de tile do mapa termina de baixar — uma imagem que o jogo cria com
   * `new Image()` DEPOIS de o React montar, e que o `window.load` nunca viu
   *
   * ## POR QUE A TELA DE ESPERA ESCUTA O SEGUNDO
   *
   * Porque e ela que existe para COBRIR a carga. Com `pronto` decidindo, a
   * tela sumia no instante em que o documento subia, e o mapa aparecia um
   * instante depois, quando a folha chegava: o jogador via a tela passar e o
   * mapa vir depois, sem nada no meio
   *
   * ## E POR QUE O IFRAME APARECE NO PRIMEIRO
   *
   * Porque ele PRECISA rodar para o segundo acontecer: um frame em
   * `display: none` nao executa `requestAnimationFrame`, e sem motor nao ha
   * folha carregando. Se a espera do `mundoPronto` dependesse do iframe estar
   * escondido, as duas esperas se travariam uma na outra
   */

  /**
   * O TOKEN DE ENTRADA, LIDO UMA VEZ.
   *
   * O caminho de verdade e o `sessionStorage`, onde o botao Jogar deixou o
   * token. A query e o fallback, para o link antigo e o `F5`
   *
   * Ler em cada render gastaria o token na primeira vez e devolveria `null`
   * na segunda — o storage e apagado na leitura, de proposito, porque o token
   * e de uso unico. E um `useState` com funcao inicial, para a leitura
   * acontecer uma vez so
   */
  const [token] = useState<string | null>(() => lerTokenPendente() ?? tokenDaUrl ?? null)

  /**
   * O TOKEN JA FOI ENTREGUE AO JOGO?
   *
   * E um `ref` e nao um `state` porque ele nao desenha nada: o `pronto`
   * acontece dentro de um evento de mensagem, e um `state` aqui dispararia
   * um render inteiro da rota no meio da partida
   *
   * E a memoria que faz o segundo `pronto` significar "o iframe recarregou"
   */
  const jaEntregue = useRef(false)

  /**
   * SEM TOKEN, ESTA ROTA NAO EXISTE.
   *
   * ## POR QUE A VOLTA ACONTECE AQUI E NAO NO JOGO
   *
   * Porque o `token` acima ja e conhecido no PRIMEIRO render: ele vem do
   * `sessionStorage`, que o navegador le de forma sincrona. O jogo ainda nem
   * comecou a carregar dentro do iframe quando esta pagina ja sabe que nao ha
   * o que mostrar
   *
   * Esperar o jogo descobrir isso custaria uma tela inteira: ele so descobre
   * depois de carregar, sobe, monta o React e so entao pergunta. O usuario
   * veria o front inteiro — e o "Preparando a selecao", que ainda falava de
   * uma tela de selecao que nao existe mais — antes de qualquer coisa
   *
   * ## POR QUE `null` E NAO UMA TELA DE "VOLTANDO"
   *
   * Porque qualquer conteudo renderizado aqui seria pintado pelo navegador
   * antes do efeito rodar. `null` nao ocupa nada, e o redirect acontece no
   * primeiro tique: o usuario nao chega a ver esta rota
   *
   * ## POR QUE SO REDIRECIONA NO NAVEGADOR
   *
   * Porque no servidor nao existe `sessionStorage`, e o token do cliente
   * ainda nao chegou. Tratar a ausencia de token no servidor como "sem
   * token" mandaria ate quem tem sessao para a home, em qualquer recarga
   * direta da pagina
   */
  useEffect(() => {
    if (token) return

    // fora do navegador nao ha token para ler: e o caso do SSR, e ai quem
    // decide e o efeito do cliente
    if (typeof window === 'undefined') return

    window.location.replace('/')
  }, [token])

  /**
   * TIRA O `?token=` DA BARRA DE ENDERECOS.
   *
   * ## POR QUE ISSO E NECESSARIO MESMO COM O STORAGE
   *
   * Porque ele chega aqui de dois jeitos, e um deles e a URL: o link antigo
   * e o `F5` de quem ja estava na tela. O token so passa pela barra por
   * alguns milissegundos, mas "alguns milissegundos" e o tempo de um
   * print de tela, e o historico do navegador guarda a entrada mesmo depois
   * do `replaceState`
   *
   * ## POR QUE `replaceState` E NAO `pushState`
   *
   * `pushState` criaria uma entrada NOVA, e o token ficaria na anterior, que
   * e o historico. `replaceState` troca a entrada atual: o historico passa a
   * ter `/jogo` sem nada depois
   */
  useEffect(() => {
    if (!tokenDaUrl) return

    const url = new URL(window.location.href)
    url.searchParams.delete('token')

    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [tokenDaUrl])

  useEffect(() => {
    /**
     * A ORIGEM DO IFRAME, e nao a do front.
     *
     * Em desenvolvimento o front roda em 3000 e o jogo em 8787: sao origens
     * diferentes. O `postMessage` so entrega a mensagem para quem declarar o
     * `targetOrigin` certo, e o jogo so aceita mensagem da origem dele. Usar
     * a origin do front nas duas pontas faria a mensagem nao chegar —
     * silenciosamente
     *
     * ## POR QUE ESTA CONTA FICA AQUI E NAO NO CORPO DO COMPONENTE
     *
     * Porque o corpo roda no SERVIDOR tambem: o front e SSR, e `window` nao
     * existe la. Ler `window.location` durante o render derrubava a pagina
     * inteira com `ReferenceError: window is not defined`, antes de o
     * navegador ver qualquer coisa
     *
     * E dentro do efeito a conta e a certa: e o unico lugar que so roda no
     * navegador, e o `targetOrigin` do `postMessage` e uma coisa de browser
     */
    const origemDoJogo = urlDoJogo() || window.location.origin

    /**
     * A PONTARIA DE MENSAGENS.
     *
     * O `event.origin` e conferido antes de qualquer coisa: sem isso,
     * qualquer pagina aberta na aba do jogador poderia mandar uma mensagem
     * com um token falso
     */
    function aoReceber(evento: MessageEvent) {
      if (evento.origin !== origemDoJogo) return

      const dados = evento.data as { tipo?: string; destino?: string } | null

      /**
       * O JOGO PEDIU PARA VOLTAR.
       *
       * Sem token de entrada nao ha o que mostrar nesta rota: o mapa
       * carregou e ficou parado numa tela de "Carregando", porque ele ja
       * gastou o token de uso unico. E quem navega tem de ser ESTA pagina:
       * o jogo esta dentro de um iframe, e `location` dele so trocaria o
       * quadro, nao a URL da barra de enderecos
       *
       * O `destino` vem do jogo porque em dev o front pode estar em um
       * endereco diferente do padrao. O `evento.origin` ja foi conferido
       * acima, entao o campo e do jogo de confianca — e mesmo assim ele so
       * e usado quando aponta para um lugar de verdade
       */
      if (dados?.tipo === 'eldoria:sem-token') {
        const destino = dados.destino

        window.location.replace(destino && /^https?:\/\//.test(destino) ? destino : '/')

        return
      }

      /**
       * "O MUNDO JA DESENHOU": a tela de espera pode sair.
       *
       * E o unico sinal que mexe na tela de espera. O `pronto` abaixo cuida
       * do token e de mostrar o iframe, e essa separacao e o que faz a tela
       * esperar a carga de verdade em vez de so o HTML
       */
      if (dados?.tipo === 'mundo:pronto') {
        setMundoPronto(true)

        return
      }

      if (dados?.tipo !== 'pronto') return

      /**
       * O TOKEN E DE USO UNICO, E ELE JÁ FOI ENTREGUE.
       *
       * ## O QUE ESTA CONTANDO
       *
       * O jogo anuncia `pronto` UMA VEZ por vida da pagina dele. Um segundo
       * `pronto` significa que o iframe recarregou — o HMR durante o
       * desenvolvimento, ou um F5 em cima do quadro
       *
       * ## POR QUE ISSO NAO E "REPASSAR O TOKEN DE NOVO"
       *
       * Porque o token que esta no `state` desta rota e o mesmo que o servidor
       * ja QUEIMOU no primeiro JOIN. O `nonce` dele e de uso unico: reenviar
       * produz um token recusado, o jogo fica_showing recusa no JOIN, e o
       * jogador fica preso em `/jogo` sem mapa e sem motivo aparente
       *
       * ## POR QUE A PAGINA INTEIRA SAI, E NAO SO O IFRAME
       *
       * Porque nao existe mais o que recarregar: o token morreu, e pedir
       * outro e um botao na `/characters`. Voltar para a home e o caminho que
       * leva o jogador ate la
       */
      if (token && jaEntregue.current) {
        window.location.replace('/')

        return
      }

      if (token) {
        jaEntregue.current = true
      }

      setPronto(true)

      /**
       * O FOCO VAI PARA O IFRAME ASSIM QUE ELE APARECE.
       *
       * ## POR QUE SEM ISSO O JOGO NAO ANDA SOZINHO
       *
       * O `GameEngine` escuta `keydown` no `window` DELE — que e a janela do
       * iframe, nao a da pagina. Ate o iframe receber foco, o teclado vai
       * todo para o documento do front, e o personagem so andaria depois de
       * um clique
       *
       * ## E POR QUE O FOCO PRECISA ESPERAR O `display`
       *
       * O iframe fica em `display: none` enquanto a tela de espera cobre a
       * tela, e um elemento invisivel NAO ACEITA FOCO. Por isso o foco vem
       * num efeito que roda depois que o `pronto` virou `true` e o React ja
       * aplicou o `display: block`
       */
      requestAnimationFrame(() => {
        moldura.current?.focus()
      })

      /**
       * `origem` E A DO FRONT, e nao a do jogo.
       *
       * O jogo compara o que vem aqui com o `document.referrer` dele — que e
       * a pagina que de fato embutiu o iframe. Os dois lados precisam dizer a
       * MESMA coisa, e ela e o front: quem esta embutindo
       *
       * Sem esse campo, o jogo nao tem como saber de quem veio a mensagem e
       * recusa o token, que e o sintoma de "a tela do mapa fica carregando
       * para sempre"
       */
      moldura.current?.contentWindow?.postMessage(
        {
          tipo: 'entrada',
          token: token ?? null,
          origem: window.location.origin,
        },
        origemDoJogo,
      )
    }

    window.addEventListener('message', aoReceber)

    return () => window.removeEventListener('message', aoReceber)
    /**
     * A dependencia e `urlDoMapa`, e nao `origemDoJogo`.
     *
     * Porque `origemDoJogo` e local do efeito (depende de `window`, que so
     * existe no navegador), e nao daria para usar. `urlDoMapa` e o valor
     * derivado da MESMA `urlDoJogo()` que o efeito le, e muda junto com ela —
     * entao e o proxy correto para o array de dependencias
     */
  }, [token, urlDoMapa])

  /**
   * O MAPA CARREGOU, MAS E PRECISO CONFIRMAR.
   *
   * ## POR QUE O `onLoad` NAO CHEGA
   *
   * Porque o jogo so manda `pronto` depois do PRIMEIRO QUADRO, e o `onLoad`
   * do iframe dispara quando o HTML carrega. Sao dois instantes: o documento
   * sobe, e so depois o React monta, o motor cria o canvas e o `main.jsx`
   * avisa. Entre os dois a tela ficaria vazia se o mapa quebrasse no meio
   *
* ## E POR QUE UM TIMEOUT E NAO O `onError` DO IFRAME
    *
    * Porque o `onError` do iframe quase nunca dispara: erro de rede dentro de
    * um frame e reportado no `contentWindow`, nao no elemento, e a
    * especificacao mantem o elemento silencioso. Sem este tempo, uma arena
    * que deu erro no `main.jsx` ficaria girando o anel para sempre — que e o
    * pior defeito de uma tela de espera, porque ela mente
    *
    * ## E POR QUE ELE ESCUTA `mundoPronto`, E NAO `pronto`
    *
    * Porque `pronto` sao as folhas. Se o prazo so vigiasse `pronto`, uma
    * folha que nunca carregasse deixaria o anel girar para sempre depois do
    * aviso — a tela de espera mentindo sobre a unica coisa que ela promete
    * cobrir
    *
   * ## E POR QUE O LIMITE E GENEROSO
   *
   * Em desenvolvimento o Vite do jogo pode demorar alguns segundos para
   * transformar 300 arquivos, e a primeira carga e a mais lenta. Trinta
   * segundos cobrem esse caso com folga, e um timeout curto (tres, cinco)
   * mataria a tela em desenvolvimento sem avisar nada
   */
  useEffect(() => {
    if (mundoPronto) return

    if (typeof window === 'undefined') return

    const limite = window.setTimeout(() => {
      setErro(
        'O mapa não respondeu. Confira se o jogo está rodando (npm run dev:web na raiz).'
      )
    }, 30_000)

    return () => window.clearTimeout(limite)
  }, [mundoPronto])

  function aoCarregar() {
    setErro(null)
  }

  /**
   * SEM TOKEN, NAO DESENHA NADA.
   *
   * O efeito acima ja mandou a pagina para a home. Devolver a tela de espera
   * aqui daria ao navegador um quadro inteiro de "Preparando a selecao" —
   * um texto que, alem de estar errado desde que a selecao de personagem foi
   * removida, ainda e o unico pixel que o usuario veria da rota errada
   */
  if (!token) return null

  return (
    <div
      className={`jgj-tela${mundoPronto ? ' jgj-entrando' : ''}`}
      style={{ position: 'fixed', inset: 0 }}
    >
      {/*
        A TELA DE ESPERA CONTINUA MONTADA DEPOIS DO `mundo:pronto`.

        Desmontar com `!mundoPronto &&` tiraria o elemento do DOM no mesmo
        quadro em que o mapa avisou que desenha, e a transicao de opacity do
        CSS nao teria em que rodar: o jogador veria um corte seco entre o anel
        e o jogo.

        E o `aria-hidden` acompanha o `mundoPronto` pelo mesmo motivo: para o
        leitor de tela parar de anunciar a tela de espera assim que o mapa
        assume
      */}
      <div
        className={`jgj-carregando${erro ? ' is-erro' : ''}`}
        // `role="alert"` SO QUANDO HA ERRO: a tela de espera normal e uma
        // espera, nao uma falha — e um `alert` que dispara assim que a rota
        // monta anunciaria "carregando" para quem usa leitor de tela
        role={erro ? 'alert' : undefined}
        aria-live="polite"
        aria-hidden={mundoPronto || undefined}
      >
        {/*
          O ANEL E ARIA-HIDDEN.
          Porque ele e decorativo e anima a 60 quadros por segundo: sem o
          `aria-hidden`, o leitor de tela anunciaria "elemento grafico" a
          cada quadro. O que ele DEVE ler e o `jgj-status` logo abaixo
        */}
        <div
          aria-hidden="true"
          style={{ position: 'relative', display: 'grid', placeItems: 'center' }}
        >
          <div className="jgj-anel" />
          <div className="jgj-anel jgj-anel--interno" style={{ position: 'absolute' }} />
        </div>

        {/*
          A FRASE E SO UMA.
          A rota so chega a desenhar com token em maos — sem ele, o `return
          null` de cima ja mandou a pagina para a home. O texto antigo
          "Preparando a selecao" morreu junto com a tela de selecao do jogo
        */}
        <p className="jgj-status">
          {erro ?? 'Carregando o mundo'}
        </p>

        <div className="jgj-barra" aria-hidden="true" />
      </div>

      <iframe
        ref={moldura}
        /**
         * `tabIndex` E O QUE DEIXA O JOGO PEGAR O TECLADO.
         *
         * ## POR QUE PRECISA ESTAR AQUI
         *
         * Porque o `GameEngine` escuta `keydown` na janela do IFRAME. Ate o
         * iframe receber foco, o teclado do jogador vai para o documento do
         * front — e o personagem so responde depois de um clique na tela
         *
         * ## E POR QUE `-1`, E NAO `0`
         *
         * Porque o jogo e a tela INTEIRA: um `0` botaria o frame na ordem de
         * Tab da pagina, e quem navega por teclado passaria por ele como se
         * fosse mais um link do site. Com `-1` ele continua focavel por
         * clique e por `focus()` (que e o que o efeito faz), mas fica fora
         * do Tab
         *
         * `outline: none` no CSS tira o contorno azul de foco — o jogador
         * precisa ver o jogo, nao uma borda em volta dele
         */
        tabIndex={-1}
/**
       * `src` COMO `undefined`, E NAO COMO STRING VAZIA.
       *
       * ## O QUE O REACT AVISA
       *
       * `An empty string ("") was passed to the src attribute`: uma string
       * vazia em `src` e um pedido RELATIVO de "" — ou seja, a pagina
       * inteira. O navegador baixa o front de novo dentro do iframe, que e o
       * oposto do que a tela precisa
       *
       * `undefined` e o valor que o React entende como "ainda nao sei" e nao
       * escreve atributo nenhum. O aviso desaparece e o iframe nao faz
       * requisicao nenhuma
       *
       * ## POR QUE ISSO SO ACONTECE NO SERVIDOR
       *
       * Porque `urlDoMapa()` devolve `""` no SSR (nao ha `window` para ler a
       * origem). No cliente ela vem preenchida no primeiro render, e o
       * atributo aparece
       */
      src={urlDoMapa || undefined}
        title={NOME_DO_PROJETO}
        onLoad={aoCarregar}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          display: pronto ? 'block' : 'none',

          /**
           * DEBAIXO DA TELA DE ESPERA.
           *
           * O `z-index: 2` do `.jgj-carregando` e o que faz a tela cobrir o
           * jogo; este `1` e o outro lado do par. As duas camadas sao
           * `position: absolute; inset: 0`, entao sem numero nos dois a
           * ordem no HTML decidiria — e o iframe vem depois, Winning por
           * cima
           *
           * Precisa ser `1` e nao `0`: um `z-index: 0` cria contexto de
           * empilhamento proprio e desce abaixo do auto do pai
           */
          zIndex: 1,
        }}
      />
    </div>
  )
}
