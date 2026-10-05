import { useCallback, useEffect, useRef, useState } from "react";
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
    });

    // o `destroy` e obrigatorio: sem ele, sair da tela deixaria o
    // socket aberto, o servidor continuaria contando este jogador
    // no `jogadores` e o personagem ficaria andando no vazio
    return () => {
      cliente.desconectar();
      clienteRef.current = null;
    };
  }, [classDefinition, characterName]);

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
   * Atravessa um portal.
   *
   * O pedido leva o `portalId` e nada mais: o servidor descobre o
   * destino e confere que o jogador esta em cima do portal
   */
  const atravessarPortal = useCallback(
    (portalId) => comCliente((c) => c.atravessarPortal(portalId)),
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

/** Entrega uma colecao e paga a recompensa. */
  const entregarColecao = useCallback(
    (collectionId) =>
      comCliente((c) => c.entregarColecao(collectionId)),
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
     * As tres acoes do MARKET.
     *
     * O `price` e o `count` vao crus e o servidor decide: ele aplica o
     * piso e o teto do mercado contra o inventario de quem pediu, e
     * corta a quantidade no que a pilha tem. Passar os dois ja
     * validados aqui daria a impressao de que o cliente tem autoridade
     * sobre o valor
     */
  const listarNoMarket = useCallback(
    (uid, price, count) =>
      comCliente((c) => c.listarNoMarket(uid, price, count)),
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

  /** Desiste da cacada em andamento. */
  const pararCacada = useCallback(
    () => comCliente((c) => c.pararCacada()),
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
    (nome, tag) => comCliente((c) => c.criarGuilda(nome, tag)),
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
    (guildaId, acao) =>
      comCliente((c) => c.mexerNoCofre(guildaId, acao)),
    [comCliente],
  );

  return {
    status,
    erro,
    recusa,

    /**
     * O CONVITE DE PARTY pendente, ou `null`.
     *
     * Sai do hook para a tela porque a caixa de cinco segundos e um
     * ESTADO DE INTERFACE, e nao dado do mundo: ela conta o tempo, aceita
     * e fecha sozinha
     */
    conviteParty,

    jogando: status === STATUS.JOGANDO,
    mensagem: MENSAGEM[status] ?? "",
    cliente: clienteRef,
    estado: estadoRef,
    tecla,
    ponteiro,
    sincronizar,
    atacar,
    mirar,
    habilidade,
    ultimate,
    soltar,

  equipar,
  desequipar,
  consertarEquipamento,
  descartar,
  equiparMelhor,
    filtroDeLoot,
    podarMochila,
    criar,
    marcarAuto,
  criarGuilda,
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

    alternarAutoPlay,
    atravessarPortal,
    alternarAutoMissao,
    focarMissao,
    aceitarMissaoSecundaria,
    abandonarMissaoSecundaria,
    resgatarRecompensaMissao,
    cacarCriatura,
  entregarColecao,
  encantar,
  listarNoMarket,
  comprarNoMarket,
  cancelarNoMarket,
    usarItem,
    comprarPocao,
    pararCacada,
  };
}
