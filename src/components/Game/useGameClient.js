import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GameClient, STATUS } from "../../game/net/GameClient.js";

/**
 * O endereco do servidor de jogo.
 *
 * Em desenvolvimento o Vite faz proxy de `/ws` para o servidor,
 * entao o mesmo endereco da pagina serve. Em producao o jogo e
 * servido pelo proprio servidor, e o caminho e o mesmo.
 */
export function urlDoServidor() {
  if (typeof window === "undefined") return "ws://localhost:8787/ws";

  const protocolo = window.location.protocol === "https:" ? "wss" : "ws";

  return `${protocolo}://${window.location.host}/ws`;
}

const MENSAGEM = {
  [STATUS.CONECTANDO]: "Entrando no mundo...",
  [STATUS.CONECTADO]: "Conectado. Preparando o personagem...",
  [STATUS.ERRO]: "Nao deu para entrar no mundo.",
  [STATUS.RECUSADO]: "Esse nome nao serviu.",
  [STATUS.FECHADO]: "Voce saiu do mundo.",
};

/**
 * Mantem um `GameClient` vivo enquanto a tela estiver montada.
 *
 * Este e o unico lugar do front que conhece a rede. Todo o resto
 * do jogo le um estado e desenha: a tela de selecao nao sabe o
 * que e um socket, e o motor nao sabe que existe um servidor.
 */
export default function useGameClient({
  classDefinition,
  characterName,
  tokenDeEntrada,
  onState = () => {},
  onDano = () => {},
}) {
  const [status, setStatus] = useState(STATUS.CONECTANDO);
  const [erro, setErro] = useState(null);
  const [recusa, setRecusa] = useState(null);

  const clienteRef = useRef(null);
  const estadoRef = useRef(null);

  // o `onState` do React muda a cada render. guardamos em ref
  // para nao recriar a conexao so porque a tela re-renderizou
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  /**
   * O `onDano` tambem vai para ref, e pelo mesmo motivo.
   *
   * A diferenca e que ele nao pode virar estado do React: o numero de
   * dano e um INSTANTE, nao uma propriedade da tela. Passar por
   * `setState` faria a tela inteira re-renderizar a cada golpe, e o
   * numero subindo num canvas seria a coisa mais lenta do desenho
   */
  const onDanoRef = useRef(onDano);
  onDanoRef.current = onDano;

  /**
   * O CONVITE DE PARTY que chegou.
   *
   * Vive num `useState` e nao dentro do `snapshot` porque o convite e um
   * EVENTO addressed so a este jogador: se viesse no painel, a caixa
   * dependeria do proximo pacote de alguns segundos, e o jogador clicaria
   * em aceitar uma caixa que ainda nao apareceu
   */
  const [conviteParty, setConviteParty] = useState(null);

  useEffect(() => {
    const cliente = new GameClient({
      url: urlDoServidor(),

      onStatus: (s) => {
        setStatus(s.status);
        setErro(s.erro ?? null);
        setRecusa(s.motivoRecusa ?? null);
      },

      onState: (estado) => {
        estadoRef.current = estado;
        onStateRef.current(estado);
      },

      // o golpe resolvido que o servidor so mandou para este jogador
      onDano: (dano) => onDanoRef.current(dano),

      /**
       * O CONVITE DE PARTY.
       *
       * E um evento separado do `onState` de proposito: a caixa de cinco
       * segundos nao pode esperar o proximo painel, que so vem em alguns
       * segundos — o jogador clica em aceitar e a caixa nao estava la
       *
       * O `payload` de `null` e o convite fechando, e e o que faz a
       * caixa sair quando ele expira ou e recusado
       */
      onConviteParty: (convite) => setConviteParty(convite),
    });

    clienteRef.current = cliente;
    cliente.conectar();
    cliente.entrar({
      name: characterName,
      classId: classDefinition.id,
      token: tokenDeEntrada,
    });

    // o `destroy` e obrigatorio: sem ele, sair da tela deixaria o
    // socket aberto, o servidor continuaria contando este jogador
    // no `jogadores` e o personagem ficaria andando no vazio
    return () => {
      cliente.desconectar();
      clienteRef.current = null;
    };
  }, [classDefinition, characterName, tokenDeEntrada]);

  /**
   * Atalho para o `GameClient` real.
   *
   * Os metodos sao nomeados um por um em vez de um
   * `enviar("qualquerCoisa")`: se o nome do metodo mudar no
   * cliente, o erro aparece aqui em vez de virar um
   * `undefined is not a function` em tempo de jogo.
   */
  const comCliente = useCallback((acao) => {
    const cliente = clienteRef.current;

    if (!cliente) return false;

    try {
      return acao(cliente);
    } catch {
      // o socket pode ter morrido entre o clique e aqui
      return false;
    }
  }, []);

  const tecla = useCallback(
    (codigo, pressionada) =>
      comCliente((c) => c.tecla(codigo, pressionada)),
    [comCliente],
  );

  const ponteiro = useCallback(
    (x, y, dentro = true) =>
      comCliente((c) => c.moverPonteiro(x, y, dentro)),
    [comCliente],
  );

  /**
   * Entrega ao cliente quem sabe onde o jogador esta na tela.
   *
   * O `GameClient` guarda pacote e nao tem canvas, viewport nem zoom, entao
   * ele nao tem como saber. Quem tem e o `GameCanvas`, dono do motor
   */
  const definirLeitorDeJogadorNaTela = useCallback(
    (ler) => comCliente((c) => c.definirLeitorDeJogadorNaTela(ler)),
    [comCliente],
  );

  /** O mesmo para o ponto de mira, que a mira magnetica pode mover */
  const definirLeitorDePonteiroDeMira = useCallback(
    (ler) => comCliente((c) => c.definirLeitorDePonteiroDeMira(ler)),
    [comCliente],
  );

  const atacar = useCallback(
    (alvo) => comCliente((c) => c.atacarAlvo(alvo)),
    [comCliente],
  );

  /**
   * Manda a intencao com a mira do momento.
   *
   * Chamar depois de mover o ponteiro e o que mantem a mira do
   * jogador de alcance atualizada sem precisar mandar um pacote a
   * cada movimento do mouse.
   */
const sincronizar = useCallback(
() => comCliente((c) => c.sincronizarIntencao()),
[comCliente],
);

/**
 * O VETOR DE ANDAR QUE O SERVIDOR JA RECEBEU.
 *
 * E lido pelo `NetworkWorld` uma vez por quadro para mover o boneco
 * antes de o servidor responder (previsao). Devolve o vetor do
 * ultimo `INPUT` enviado, e nao o teclado: sao iguais enquanto a
 * conexao esta de pe, e diferentes quando ela cai.
 *
 * O `{x: 0, y: 0}` do `comCliente` e o que segura o quadro depois
 * que o socket fecha: sem cliente nao ha previsao, e o boneco para
 * onde o ultimo pacote o deixou, em vez de continuar andando para o
 * lugar que ninguem mais vai confirmar.
 */
const intencaoAtual = useCallback(
() => comCliente((c) => c.intencaoAtual()) ?? { x: 0, y: 0 },
[comCliente],
);

  const mirar = useCallback(
    (alvo) => comCliente((c) => c.mirar(alvo)),
    [comCliente],
  );

  const habilidade = useCallback(
    (slot, alvo = null) =>
      comCliente((c) => c.usarHabilidade(slot, alvo)),
    [comCliente],
  );

  const ultimate = useCallback(
    (alvo = null) => comCliente((c) => c.usarUltimate(alvo)),
    [comCliente],
  );

  // Painel. Online, o inventario e do servidor: o botao de
  // equipar vira um pedido, e o capacete so aparece quando o
  // servidor confirmar. Por isso nenhum destes metodos muda nada
  // localmente.
  const equipar = useCallback(
    (uid, slotId) => comCliente((c) => c.equipar(uid, slotId)),
    [comCliente],
  );

  const desequipar = useCallback(
    (slotId) => comCliente((c) => c.desequipar(slotId)),
    [comCliente],
  );

  /**
   * Tira do corpo as pecas no slot errado.
   *
   * Vai pelo mesmo caminho dos outros pedidos de painel: online quem
   * corrige o equipamento e o servidor. Chamar o motor da tela
   * nao faria nada, porque o cliente nao simula e nao tem a sessao
   */
  const consertarEquipamento = useCallback(
    () => comCliente((c) => c.consertarEquipamento()),
    [comCliente],
  );

  /**
   * LIGA O FARM OFFLINE, e o `await` e o que segura a navegacao.
   *
   * A UI precisa deste `await` antes de ir para a tela de classe: e o
   * servidor quem guarda o relogio, e sair antes da confirmacao
   * perderia o ganho
   */
  const iniciarFarmOffline = useCallback(
    () => comCliente((c) => c.iniciarFarmOffline()) ?? Promise.resolve(false),
    [comCliente],
  );

  /**
   * O JOGADOR FECHOU O MODAL do farm.
   *
   * Vira `true` depois que o pedido sai, e nao antes: se o servidor
   * recusar, o relatorio volta na proxima entrada e o modal abre de novo
   * — o que e melhor do que o sumir na mao
   */
  const viuFarmOffline = useCallback(
    () => comCliente((c) => c.viuFarmOffline()) === true,
    [comCliente],
  );

  const descartar = useCallback(
    (uid) => comCliente((c) => c.descartar(uid)),
    [comCliente],
  );

  const equiparMelhor = useCallback(
    () => comCliente((c) => c.equiparMelhor()),
    [comCliente],
  );

  const filtroDeLoot = useCallback(
    (filter) => comCliente((c) => c.filtroDeLoot(filter)),
    [comCliente],
  );

  const podarMochila = useCallback(
    () => comCliente((c) => c.podarMochila()),
    [comCliente],
  );

  /**
   * EXPANDIR A MOCHILA, e sem argumento nenhum.
   *
   * O preco e os slots sao decididos pelo servidor. Passar os dois aqui
   * mostraria um botao capaz de mudar de valor entre a tela e a resposta
   */
  const expandirMochila = useCallback(
    () => comCliente((c) => c.expandirMochila()),
    [comCliente],
  );

  const criar = useCallback(
    (recipeId, rarity) =>
      comCliente((c) => c.criar(recipeId, rarity)),
    [comCliente],
  );

  const marcarAuto = useCallback(
    (skillId, ativo) =>
      comCliente((c) => c.marcarAuto(skillId, ativo)),
    [comCliente],
  );

const alternarAutoPlay = useCallback(
      () => comCliente((c) => c.alternarAutoPlay()),
      [comCliente],
    );

    /**
     * Pede o DASH.
     *
     * E o mesmo desenho do `alternarAutoPlay`: sem `GameClient` o
     * `comCliente` devolve `false` e nao acontece nada
     *
     * ## E O CAMINHO OFFLINE
     *
     * O motor registra o proprio `keydown` no `window` no construtor, entao
     * o `E` chega nele de dois jeitos: por este pedido quando ha rede, e
     * direto pela janela quando nao ha. E por isso que o `KeyE` esta no
     * `handleKeyDown` do motor ANTES do corte do `networked` — o corte
     * existe para `Space`/`1`-`8`/`R`, que so fazem sentido no pedido, e o
     * dash faz sentido nos dois
     */
    const dash = useCallback(
      () => comCliente((c) => c.dash()),
      [comCliente],
    );

  /**
   * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
   *
   * A `mudanca` chega inteira e sem dissectar: quem decide o que cada campo
   * significa e o `GameClient` e, depois, o motor do servidor. O
   * `useGameClient` nao tem regra nenhuma de pocao, e e por isso que ele
   * repassa o objeto cru
   */
  const configurarAutoPocao = useCallback(
    (mudanca) => comCliente((c) => c.configurarAutoPocao(mudanca)),
    [comCliente],
  );

  /**
   * Atravessa um portal.
   *
   * O pedido leva o `portalId` e nada mais: o servidor descobre o
   * destino e confere que o jogador esta em cima do portal
   */
  const atravessarPortal = useCallback(
    (portalId) => comCliente((c) => c.atravessarPortal(portalId)),
    [comCliente],
  );

  /**
   * A ARENA DO CHEFE, o botao de ir e voltar.
   *
   * Sem argumento nenhum: o destino e o sentido sao do servidor. O
   * wrapper existe so para o HUD nao falar com o `GameClient` direto, como
   * os outros
   */
  const irParaArena = useCallback(
    () => comCliente((c) => c.irParaArena()),
    [comCliente],
  );

  /**
   * O MAPA DE TESTE, o botao de ir e voltar.
   *
   * Sem argumento nenhum, como a arena: o destino e o sentido sao do
   * servidor, que e quem guarda de onde o jogador veio
   */
  const irParaTeste = useCallback(
    () => comCliente((c) => c.irParaTeste()),
    [comCliente],
  );

  /**
   * A PEDIDA DE STEEL, e o mesmo gesto que a solta.
   *
   * Sem estado proprio, pelo motivo do `irParaTeste`: o hook nao guarda se
   * o jogador esta minerando. Se ele guardasse, o estado do cliente
   * discordaria do painel depois de um pacote perdido, e o botao pararia
   * de funcionar ate o proximo painel chegar
   */
  const minerar = useCallback(
    (propId) => comCliente((c) => c.minerar(propId)),
    [comCliente],
  );

  /** O auto da missao, que e um pedido separado do de cacar perto. */
  const alternarAutoMissao = useCallback(
    () => comCliente((c) => c.alternarAutoMissao()),
    [comCliente],
  );

  /** Escolhe a missao do botao "auto" dela no painel. */
  const focarMissao = useCallback(
    (questId) => comCliente((c) => c.focarMissao(questId)),
    [comCliente],
  );

  /**
   * Aceita a missao secundaria escolhida no painel.
   *
   * O `QuestLog` e por sessao no servidor. Sem este caminho, o
   * botao chamava o motor da tela, o clique morria e a missao
   * aceita nunca aparecia na caixa.
   */
  const aceitarMissaoSecundaria = useCallback(
    (questId) => comCliente((c) => c.aceitarMissaoSecundaria(questId)),
    [comCliente],
  );

  /** Desiste da missao secundaria ativa. */
  const abandonarMissaoSecundaria = useCallback(
    () => comCliente((c) => c.abandonarMissaoSecundaria()),
    [comCliente],
  );

  /**
   * Recebe a recompensa de uma missao concluida.
   *
   * O caminho e o do aceite pelo mesmo motivo: o dinheiro, o xp e a
   * mochila estao no servidor, e o clique do [RECEBER] no motor da
   * tela nao pagaria nada online
   */
  const resgatarRecompensaMissao = useCallback(
    (questId) =>
      comCliente((c) => c.resgatarRecompensaMissao(questId)),
    [comCliente],
  );

  /**
   * Resgata tudo que a aba aberta tem, pelo mesmo caminho do resgate
   * individual: so online. Na tela, quem paga e o motor local
   */
  const resgatarTodasMissoes = useCallback(
    (scope, mapa) =>
      comCliente((c) => c.resgatarTodasMissoes(scope, mapa)),
    [comCliente],
  );

  /**
   * Gasta um ponto da arvore, pelo caminho de online
   *
   * Sem este ramo o `handleComprarNo` do HUD so chamava o motor da tela, e
   * em jogo online o clique da arvore nao fazia nada: o ponto aparecia
   * disponivel e o servidor nunca recebia o pedido
   */
const aprenderNoArvore = useCallback(
        (noId) => comCliente((c) => c.aprenderNoArvore(noId)),
        [comCliente],
      );

      /**
       * AS QUATRO AÇÕES DE EXPEDIÇÃO DO CHEFE.
       *
       * Vêm pelo mesmo `comCliente` do resto, e pelo mesmo motivo: em jogo
       * online o painel é uma cópia de tela, e um clique que mexe só no React
       * morria ali — o grupo sumia no próximo pacote, sem o servidor nunca ter
       * ouvido falar dele
       *
       * E o `criarExpedicao` leva o `chefeId` junto porque a expedição é
       * DAQUELE chefe: é o que o `GameServer` confere contra o catálogo antes
       * de gravar
       */
      const criarExpedicao = useCallback(
        ({ chefeId, dificuldade }) =>
          comCliente((c) => c.criarExpedicao(dificuldade, chefeId)),
        [comCliente],
      );

      const entrarExpedicao = useCallback(
        (expedicaoId) => comCliente((c) => c.entrarExpedicao(expedicaoId)),
        [comCliente],
      );

      const sairExpedicao = useCallback(
        (expedicaoId) => comCliente((c) => c.sairExpedicao(expedicaoId)),
        [comCliente],
      );

      const dissolverExpedicao = useCallback(
        (expedicaoId) => comCliente((c) => c.dissolverExpedicao(expedicaoId)),
        [comCliente],
      );

  /**
   * Resgata UM dia do passe.
   *
   * Pelo mesmo caminho da recompensa de missao: quem tem a mochila e a lista
   * de resgates e o servidor, e o clique do painel nao pagaria nada online.
   *
   * ## POR QUE ESTE HOOK NAO GUARDA NADA
   *
   * Porque nao ha estado local para guardar: o resgate vira snapshot, e o
   * snapshot traz a lista nova. Se o painel guardasse tambem, os dois iam
   * discordar por um tique e o dia apareceria resgatado e clicavel ao mesmo
   * tempo
   */
  const resgatarDiaDoPasse = useCallback(
    (passId, dia) => comCliente((c) => c.resgatarDiaDoPasse(passId, dia)),
    [comCliente],
  );

/**
    * Liga ou desliga o passe premium.
    *
    * O valor chega no pedido, e nao um "inverter", pelo mesmo motivo do
    * `GameClient`: dois cliques rapidos podem chegar em qualquer ordem
    *
    * ## E O `passId` NAO PODE FICAR DE FORA
    *
    * Porque o premium e uma compra POR PASSE. O painel manda o passe aberto
    * junto com o valor, e sem repassar o `passId` para o `GameClient` o
    * servidor cairia no passe padrao: o jogador pagaria 100 diamantes para
    * ligar a Praga e so veria os dias pagos dela, com a Cripta e a Mina
    * ainda trancadas
    */
  const definirPassePremium = useCallback(
    (ativo, passId) =>
      comCliente((c) => c.definirPassePremium(ativo, passId)),
    [comCliente],
  );

  /**
   * Pede a cacada de UMA criatura no bestiario.
   *
   * O `bestiaryTargetType` e por sessao no servidor. Sem este
   * caminho, o botao "ir matar" chamava o motor da tela, o clique
   * morria e o piloto nunca ia atras da criatura.
   */
  const cacarCriatura = useCallback(
    (creatureId) => comCliente((c) => c.cacarCriatura(creatureId)),
    [comCliente],
  );

/**
   * Entrega uma parcela e paga a recompensa dela.
   *
   * O `indice` viaja ate o `GameClient`, e sem ele a entrega e a COLECAO
   * INTEIRA: `deliver(collectionId, null, ...)` paga as duas parcelas de uma
   * vez. Uma colecao de 2 slots virava uma entrega so, e o jogador perdia o
   * controle de qual parcela estava pagando
   */
  const entregarColecao = useCallback(
    (collectionId, indice = null) =>
      comCliente((c) => c.entregarColecao(collectionId, indice)),
    [comCliente],
  );

  /**
   * Compra um produto da loja.
   *
   * E o mesmo `comCliente` de tudo: se nao ha `GameClient` — single player
   * sem rede — ele devolve `false` e o `LojaPanel` nao marca nada na tela
   */
  const comprarProduto = useCallback(
    (produtoId) => comCliente((c) => c.comprarProduto(produtoId)),
    [comCliente],
  );

  /**
   * Encanta a peca escolhida.
   *
   * O pedido leva o endereco e NADA mais: o `uid` da peca na mochila,
   * ou o `slotId` da que esta vestida. Quem sorteia o afixo, cobra o
   * ouro e decide se o ouro basta e o SERVIDOR — um cliente que
   * sorteasse escreveria o numero que quisesse dentro do stat do
   * jogador
   *
   * O afixo volta no `SNAPSHOT` seguinte, em `inventory.items` ou em
   * `equipment.slots`, e o painel le o de la
   */
  const encantar = useCallback(
    (alvo) => comCliente((c) => c.encantar(alvo)),
    [comCliente],
  );

  /**
   * APRIMORAR a peca vestida de um slot.
   *
   * O resultado volta no `SNAPSHOT` seguinte, em `equipment.slots`, e a UI
   * le o `enhance` de la. Nao sorteia nada, entao nao ha afixo na resposta
   */
  const aprimorar = useCallback(
    (slotId) => comCliente((c) => c.aprimorar(slotId)),
    [comCliente],
  );

/**
 * As acoes do MARKET.
 *
 * O `price`, a moeda, o modo, o lance e a quantidade vao crus e o servidor
 * decide: ele aplica o piso e o teto contra o inventario de quem pediu, e
 * corta a quantidade no que a pilha tem. Passar os dois ja validados aqui
 * daria a impressao de que o cliente tem autoridade sobre o valor
 */
const listarNoMarket = useCallback(
    (uid, price, count, opcoes) =>
      comCliente((c) => c.listarNoMarket(uid, price, count, opcoes)),
    [comCliente],
  );

  const comprarNoMarket = useCallback(
    (listingId) =>
      comCliente((c) => c.comprarNoMarket(listingId)),
    [comCliente],
  );

  const cancelarNoMarket = useCallback(
    (listingId) =>
      comCliente((c) => c.cancelarNoMarket(listingId)),
    [comCliente],
  );

  /**
   * Dar lance e uma acao A PARTE de comprar: a compra tira o anuncio do ar, e
   * o lance mantem, entao nao pode ser o mesmo caminho nem a mesma resposta
   */
  const darLanceNoMarket = useCallback(
    (listingId, valor) =>
      comCliente((c) => c.darLanceNoMarket(listingId, valor)),
    [comCliente],
  );

  /**
   * BEBER um consumivel, e COMPRAR na loja do mercador.
   *
   * Nenhuma das duas decide nada. Quem cura, quem gasta o item da
   * mochila, quem cobra e quem recusa a vida cheia e o SERVIDOR. Um
   * `usarItem` local curaria o boneco da tela e o servidor nunca
   * saberia, que e o furo que a op existe para fechar
   */
  const usarItem = useCallback(
    (uid) => comCliente((c) => c.usarItem(uid)),
    [comCliente],
  );

  const comprarPocao = useCallback(
    (itemId, count) =>
      comCliente((c) => c.comprarPocao(itemId, count)),
    [comCliente],
  );

  /**
   * Compra um livro com o Mestre de Habilidades.
   *
   * Este e o unico lugar do front que conhecia o livro. Sem esta linha o
   * `intencao.comprarLivro` do HUD era `undefined`, e o clique chamava
   * `undefined` dentro de um `if (intencao)` que continuava verdadeiro —
   * o botao clicava, nao dava erro na tela e nao acontecia nada
   */
  const comprarLivro = useCallback(
    (itemId) => comCliente((c) => c.comprarLivro(itemId)),
    [comCliente],
  );

  /** Desiste da cacada em andamento. */
  const pararCacada = useCallback(
    () => comCliente((c) => c.pararCacada()),
    [comCliente],
  );

  /**
   * AS DUAS SAIDAS DA MORTE.
   *
   * Nenhuma das duas decide nada, e nenhuma manda preco: quem cobra o
   * ouro e quem calcula a perda de XP e o SERVIDOR. Um `reviver` local
   * devolveria a vida sem cobrar, e um `voltarBase` local perderia o XP
   * da tela enquanto o servidor continuaria com o XP inteiro — o jogador
   * veria o numero cair, fechar o navegador e voltar com ele inteiro
   *
   * Os dois metodos do `GameClient` tambem nao levam argumento, entao um
   * cliente modificado nao teria o que forjar
   */
  const reviver = useCallback(
    () => comCliente((c) => c.reviver()),
    [comCliente],
  );

  const voltarBase = useCallback(
    () => comCliente((c) => c.voltarBase()),
    [comCliente],
  );

  /**
   * Teleporta para o fim da viagem.
   *
   * Sem argumento, como o revive e o voltar para a base. O destino e o
   * pergaminho sao coisas do SERVIDOR: um teleporte local moveria o
   * boneco sem gastar o item, e o jogador assistiria ao teleporte
   * acontecer na tela e voltaria com o pergaminho inteiro na mochila
   */
  const teleportar = useCallback(
    () => comCliente((c) => c.teleportar()),
    [comCliente],
  );

  /** Anda até o NPC. Só o id vai; o servidor resolve o caminho. */
  const irAteNpc = useCallback(
    (npcId) => comCliente((c) => c.irAteNpc(npcId)),
    [comCliente],
  );

  /** Solta tudo. Usado ao perder o foco da janela. */
  const soltar = useCallback(
    () =>
      comCliente((c) => {
        c.keys.clear();
        c.sincronizarIntencao();
      }),
    [comCliente],
  );


  /* ------------------------------------------------------------------
     GUILDA
     ------------------------------------------------------------------
     Todas pelo comCliente, como o resto. Nenhuma delas decide nada:
     quem aceita um pedido, quem gasta ponto e quem abre o cofre e o
     SERVIDOR. Um criarGuilda local criaria uma guilda que so existe
     na tela
     ------------------------------------------------------------------ */

  const criarGuilda = useCallback(
    (nome, tag, estilo) =>
      comCliente((c) => c.criarGuilda(nome, tag, estilo)),
    [comCliente],
  );

  /**
   * O ESTILO da guilda: emblema e cor.
   *
   * Pelo caminho da criacao, e o `store` do servidor que recusa quem nao e
   * o lider. Aqui nao ha checagem nenhuma de proposito — quem decide o que
   * um jogador pode mudar no jogo e o servidor, e uma guarda no cliente
   * seria uma segunda regra que a primeira pode contradizer
   */
  const definirEstiloGuilda = useCallback(
    (icone, cor) => comCliente((c) => c.definirEstiloGuilda(icone, cor)),
    [comCliente],
  );

  /**
   * A TAG sobre o boneco deste jogador.
   *
   * Nao tem guarda nenhuma aqui tambem: e a unica acao de guilda que o
   * jogador pode fazer sobre si mesmo sem ser da diretoria
   */
  const definirMostrarTag = useCallback(
    (mostrar) => comCliente((c) => c.definirMostrarTag(mostrar)),
    [comCliente],
  );

  const buscarGuilda = useCallback(
    (termo) => comCliente((c) => c.buscarGuilda(termo)),
    [comCliente],
  );

  const pedirGuilda = useCallback(
    (guildaId) => comCliente((c) => c.pedirGuilda(guildaId)),
    [comCliente],
  );

  const aceitarGuilda = useCallback(
    (guildaId, alvoId) =>
      comCliente((c) => c.aceitarGuilda(guildaId, alvoId)),
    [comCliente],
  );

const negarGuilda = useCallback(
  (guildaId, alvoId) =>
    comCliente((c) => c.negarGuilda(guildaId, alvoId)),
  [comCliente],
);

/**
 * A PARTY.
 *
 * Os quatro vao pelo mesmo `comCliente` das gualdas: se nao ha socket,
 * nao ha ninguem para convidar, e o pedido morre aqui em vez de virar
 * um erro no console
 */
const criarParty = useCallback(
  () => comCliente((c) => c.criarParty()),
  [comCliente],
);

const convidarParty = useCallback(
  (alvoId) => comCliente((c) => c.convidarParty(alvoId)),
  [comCliente],
);

const convidarPartyPorNome = useCallback(
  (nome) => comCliente((c) => c.convidarPartyPorNome(nome)),
  [comCliente],
);

const aceitarConviteParty = useCallback(
  () => comCliente((c) => c.aceitarConviteParty()),
  [comCliente],
);

const sairDaParty = useCallback(
  () => comCliente((c) => c.sairDaParty()),
  [comCliente],
);

const expulsarDaParty = useCallback(
  (alvoId) => comCliente((c) => c.expulsarDaParty(alvoId)),
  [comCliente],
);

const seguirPartyMember = useCallback(
  (alvoId) => comCliente((c) => c.seguirPartyMember(alvoId)),
  [comCliente],
);

const focarAlvoDoLider = useCallback(
  (ligado) => comCliente((c) => c.focarAlvoDoLider(ligado)),
  [comCliente],
);

const passarLideranca = useCallback(
  (alvoId) => comCliente((c) => c.passarLiderancaDaParty(alvoId)),
  [comCliente],
);

  const sairDaGuilda = useCallback(
    () => comCliente((c) => c.sairDaGuilda()),
    [comCliente],
  );

const destravarTalent = useCallback(
  (talentId) => comCliente((c) => c.destravarTalent(talentId)),
  [comCliente],
);

const mexerNoCofre = useCallback(
    (guildaId, acao, dados) =>
      comCliente((c) => c.mexerNoCofre(guildaId, acao, dados)),
    [comCliente],
  );

  /**
 * O BAU DA BASE.
 *
 * A assinatura repete a do `GameClient` de proposito: a hook e uma
 * passagem, e um `(acao, dados)` aqui com um `(bauAcao, dados)` la faria
 * o painel chamar uma coisa e o socket entender outra
 */
const mexerNoBau = useCallback(
    (bauAcao, dados) =>
      comCliente((c) => c.mexerNoBau(bauAcao, dados)),
    [comCliente],
  );

/**
 * O QUE ESTE HOOK ENTREGA.
 *
 * A lista fica num objeto de modulo, e nao espalhada em dozens de
 * linhas de `return`. Dois motivos:
 *
 * 1. O `useMemo` abaixo precisa dela como dependencia, e uma lista
 *    escrita no `return` nao da para ler de la
 * 2. `useGameClient.test.jsx` le ESTE objeto por regex para conferir que
 *    todo metodo que o HUD pede existe aqui. A lista e a fonte da
 *    verdade, entao o teste passa a ler a fonte em vez de arranhar o
 *    arquivo
 */
  const intencao = {
  status,
  erro,
  recusa,

    /**
     * O CONVITE DE PARTY pendente, ou `null`.
     *
     * Sai do hook para a tela porque a caixa de cinco segundos e um
     * ESTADO DE INTERFACE, e nao dado do mundo: ela conta o tempo,
     * aceita e fecha sozinha
     */
    conviteParty,

    jogando: status === STATUS.JOGANDO,
    /**
     * A MENSAGEM DA RECUSA E O MOTIVO DO SERVIDOR.
     *
     * Antes era sempre `MENSAGEM[status]`, que na recusa dava "Esse nome
     * nao serviu" para qualquer motivo: nome logado em outro navegador,
     * classe diferente da salva, mundo cheio. O jogador via um texto
     * generico e nao sabia o que fazer
     *
     * O `motivoRecusa` ja chegava aqui e nao era usado em lugar nenhum.
     * Agora ele e a mensagem, e o texto generico fica so para o caso de
     * recusa sem motivo — que nao deveria acontecer, mas se acontecer
     * ainda tem algo na tela
     */
    mensagem:
      status === STATUS.RECUSADO
        ? (recusa ?? MENSAGEM[status])
        : (MENSAGEM[status] ?? ""),
    cliente: clienteRef,
    estado: estadoRef,
    tecla,
    ponteiro,
    definirLeitorDeJogadorNaTela,
    definirLeitorDePonteiroDeMira,
sincronizar,
intencaoAtual,
atacar,
    mirar,
    habilidade,
    ultimate,
    soltar,

    equipar,
    desequipar,
    consertarEquipamento,
    iniciarFarmOffline,
    viuFarmOffline,
    descartar,
    equiparMelhor,
    filtroDeLoot,
    podarMochila,
  expandirMochila,
    criar,
    marcarAuto,
    criarGuilda,
    definirEstiloGuilda,
    definirMostrarTag,
    buscarGuilda,
    pedirGuilda,
    aceitarGuilda,
    negarGuilda,

    criarParty,
    convidarParty,
    convidarPartyPorNome,
    aceitarConviteParty,
    sairDaParty,
    expulsarDaParty,
    seguirPartyMember,
    focarAlvoDoLider,
    passarLideranca,
    sairDaGuilda,
    destravarTalent,
    mexerNoCofre,
  mexerNoBau,

    alternarAutoPlay,
  dash,
    configurarAutoPocao,
    atravessarPortal,
    irParaArena,
    irParaTeste,
  minerar,
    alternarAutoMissao,
    focarMissao,
    aceitarMissaoSecundaria,
    abandonarMissaoSecundaria,
    resgatarRecompensaMissao,
    resgatarTodasMissoes,
    aprenderNoArvore,
        criarExpedicao,
        entrarExpedicao,
        sairExpedicao,
        dissolverExpedicao,
    resgatarDiaDoPasse,
    definirPassePremium,
    cacarCriatura,
    entregarColecao,
  comprarProduto,
    encantar,
  aprimorar,
    listarNoMarket,
    comprarNoMarket,
    cancelarNoMarket,
    darLanceNoMarket,
    usarItem,
    comprarPocao,
    comprarLivro,
    pararCacada,
    reviver,
    voltarBase,
    teleportar,
    irAteNpc,
  };

  /**
   * O RETORNO MEMOIZADO.
   *
   * Este hook devolvia um objeto literal, e o `TestMapScene` passa o
   * resultado inteiro como a prop `intencao` do `HUD`. Um literal novo a
   * cada render significa `intencao` com outra identidade 20 vezes por
   * segundo (a frequencia dos pacotes)
   *
   * E o `HUD` usa `intencao` como dependencia de `useEffect` e de
   * `useCallback`: o `openInventory` era recriado, e o `keydown` do
   * teclado inteiro era removido e registrado de novo a cada render. Isso
   * e a instabilidade #1 do projeto em React — nao custava um render
   * errado, custava trabalho repetido 20x por segundo
   *
   * A dependencia e o `intencao` INTEIRO, e nao a lista de cada metodo:
   * o objeto so muda quando um destes tres muda, entao o memo acerta, e
   * uma lista de 50 dependencias seria o mesmo numero de linhas sem
   * nenhum ganho — qualquer metodo novo mudaria o array de dependencias
   * e esqueceria de entrar, e ai o memo mentiria
   */
  const estavel = useRef(intencao);

  // so recalcula quando os tres estados de conexao mudam. Todo o resto
  // do objeto e `useCallback` com dependencia `[]`, que nunca muda
  if (
    estavel.current.status !== status ||
    estavel.current.erro !== erro ||
    estavel.current.recusa !== recusa ||
    estavel.current.conviteParty !== conviteParty
  ) {
    estavel.current = intencao;
  }

  return estavel.current;
}
