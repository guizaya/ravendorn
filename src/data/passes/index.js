/**
 * OS PASSES.
 *
 * ## O QUE ESTE ARQUIVO E, E O QUE NAO E
 *
 * E o CONTEUDO do painel: quantos passes tem, como cada um se chama, o que
 * cada dia da trilha da e em que dia o jogador esta. E nao o ESTADO dele —
 * o que foi resgatado e se o premium esta ativo nao mora aqui, e sim em
 * quem renderiza, porque estado que muda mora no componente
 *
 * ## POR QUE TODO `itemId` VEM DO CATALOGO
 *
 * Nenhum item novo: todo id deste arquivo existe em `ITEMS`, e o `ItemIcon`
 * do painel busca a arte e o glifo la. Um id escrito a mao que o catalogo
 * nao conhece renderiza um quadrado vazio — o jogador ve um premio que o
 * jogo nao tem como dar. E o nome do item NAO serve de id: `Poção Pequena`
 * e `pocao_cura`, e trocar um pelo outro faz o premio sumir
 *
 * ## POR QUE A RARIDADE E UM CAMPO A PARTE
 *
 * Porque o craft entrega o mesmo equipamento nas cinco raridades, e o
 * passe faz o mesmo: `botas_warrior` no dia 5 e no dia 11 sao o mesmo item
 * e o que muda e a raridade. Sem o campo, a trilha mostraria duas copias
 * identicas do mesmo par de botas em dias diferentes
 */
export const PASSES = [
  {
    id: "praga",
    nome: "Praga dos Ratos",
    icone: "⌇",
    descricao:
      "O celeiro do vale esta infestado. O loot e pequeno, mas chega rapido.",
    /** Em que dia do passe o jogador esta */
    diaAtual: 6,
    /** A janela inteira, em dias. O ultimo dia e a recompensa final */
    totalDias: 14,
    /** O lugar do mundo de onde vem o loot */
    origem: "Vale de Corvos",
    /** Quanto o jogador ganha por dia de presence, e o total da temporada */
    pontosPorDia: 100,
    dias: [
      { dia: 1, itemId: "osso_quebrado", quantidade: 2 },
      { dia: 2, itemId: "osso_quebrado", quantidade: 3 },
      { dia: 3, itemId: "tendao_ressecado", quantidade: 2, premium: true },
      { dia: 4, itemId: "pocao_cura", quantidade: 3 },
      { dia: 5, itemId: "osso_quebrado", quantidade: 6, premium: true },
      { dia: 6, itemId: "pocao_media", quantidade: 3 },
      { dia: 7, itemId: "tendao_ressecado", quantidade: 5, premium: true },
      { dia: 8, itemId: "pocao_cura", quantidade: 6 },
      { dia: 9, itemId: "dummy_wood", quantidade: 6, premium: true },
      { dia: 10, itemId: "pocao_media", quantidade: 6 },
      { dia: 11, itemId: "tendao_ressecado", quantidade: 3, premium: true },
      { dia: 12, itemId: "pocao_cura", quantidade: 10 },
      { dia: 13, itemId: "tendao_ressecado", quantidade: 5, premium: true },
      {
        dia: 14,
        itemId: "pergaminho_teleporte",
        quantidade: 2,
        premium: true,
        final: true,
      },
    ],
  },

  {
    id: "cripta",
    nome: "Cripta dos Mortos",
    icone: "☗",
    descricao:
      "Ghols, ossos e o que sobrou de quem desceu. O melhor loot do vale.",
    diaAtual: 9,
    totalDias: 14,
    origem: "Cripta",
    pontosPorDia: 150,
    dias: [
      { dia: 1, itemId: "osso_quebrado", quantidade: 4 },
      { dia: 2, itemId: "osso_quebrado", quantidade: 4 },
      { dia: 3, itemId: "tendao_ressecado", quantidade: 3, premium: true },
      { dia: 4, itemId: "osso_quebrado", quantidade: 6 },
      { dia: 5, itemId: "essencia_necrotica", quantidade: 2, premium: true },
      { dia: 6, itemId: "pocao_media", quantidade: 5 },
      { dia: 7, itemId: "tendao_ressecado", quantidade: 5, premium: true },
      { dia: 8, itemId: "couro_goblin", quantidade: 4 },
      { dia: 9, itemId: "essencia_necrotica", quantidade: 2, premium: true },
      { dia: 10, itemId: "pocao_grande", quantidade: 3 },
      { dia: 11, itemId: "couro_goblin", quantidade: 6, premium: true },
      { dia: 12, itemId: "pocao_media", quantidade: 8 },
      { dia: 13, itemId: "essencia_necrotica", quantidade: 4, premium: true },
      {
        dia: 14,
        itemId: "peito_warrior",
        quantidade: 1,
        rarity: "legendary",
        premium: true,
        final: true,
      },
    ],
  },

  {
    id: "arsenal",
    nome: "Arsenal do Arqueiro",
    icone: "🏹",
    descricao:
      "Arcos, aljavas e o equipamento inteiro do arqueiro, em raridade alta.",
    diaAtual: 3,
    totalDias: 14,
    origem: "Posto de arqueiros",
    pontosPorDia: 120,
    dias: [
      { dia: 1, itemId: "couro_goblin", quantidade: 6 },
      { dia: 2, itemId: "osso_quebrado", quantidade: 5 },
      {
        dia: 3,
        itemId: "aljava_arbalist",
        quantidade: 1,
        rarity: "rare",
        premium: true,
      },
      { dia: 4, itemId: "pocao_cura", quantidade: 4 },
      {
        dia: 5,
        itemId: "botas_arbalist",
        quantidade: 1,
        rarity: "uncommon",
        premium: true,
      },
      { dia: 6, itemId: "couro_goblin", quantidade: 6 },
      {
        dia: 7,
        itemId: "luvas_arbalist",
        quantidade: 1,
        rarity: "rare",
        premium: true,
      },
      { dia: 8, itemId: "dummy_wood", quantidade: 8 },
      {
        dia: 9,
        itemId: "peito_arbalist",
        quantidade: 1,
        rarity: "epic",
        premium: true,
      },
      { dia: 10, itemId: "pocao_media", quantidade: 4 },
      {
        dia: 11,
        itemId: "pergaminho_teleporte",
        quantidade: 2,
        premium: true,
      },
      { dia: 12, itemId: "pocao_cura", quantidade: 6 },
      {
        dia: 13,
        itemId: "willow_bow",
        quantidade: 1,
        rarity: "legendary",
        premium: true,
      },
      {
        dia: 14,
        itemId: "capuz_arbalist",
        quantidade: 1,
        rarity: "legendary",
        premium: true,
        final: true,
      },
    ],
  },
];

/**
 * O PRIMEIRO PASSE, que e o que abre selecionado.
 *
 * A lista nao pode comecar sem selecao: a trilha da direita ficaria vazia
 * e o painel abriria com um menu a esquerda e um buraco a direita
 */
export const PASSE_PADRAO = PASSES[0];

/**
 * O PRECO DO PASSE PREMIUM, EM DIAMANTES.
 *
 * ## POR QUE 100 DIAMANTES E NAO OURO
 *
 * Porque o diamante nao vem de drop: nada no jogo produz. Um preco em diamante
 * e um preco que o jogador so paga se alguem DEU o diamante a ele — e e a
 * unica moeda do jogo que nao se produz jogando
 *
 * Em ouro, o premium viraria mais uma coisa que a caca paga, e um dia de
 * presenca premium custaria menos que um bau
 *
 * ## POR QUE O PRECO ESTA AQUI E NAO NO MOTOR
 *
 * Porque o painel precisa MOSTRAR o numero, e o motor precisa COBRAR. Sao
 * dois lugares, e um numero escrito em dois vira dois numeros no dia em que
 * um deles mudar
 *
 * E o `data/` porque e onde mora toda regra de preco do passe — o mesmo
 * lugar que diz quantos dias tem e o que cada dia paga
 */
export const PASSE_PREMIUM_DIAMANTES = 100;

/**
 * Um passe pelo `id`, ou `null`.
 *
 * ## POR QUE ISTO EXISTE E O PAINEL NAO BUSCA SOZINHO
 *
 * Porque o SERVIDOR precisa do catalogo do dia que o jogador mandou resgatar,
 * e o cliente nao pode ser a fonte disso. O pedido so traz `passId` e `dia`;
 * daqui para frente sao lidos do catalogo. Um pedido que trouxesse
 * `itemId: "pergaminho_teleporte"` e `quantidade: 99` seria ignorado, e um
 * pedido com `passId` desconhecido volta `null` e nao paga nada
 *
 * E o `?? null` e o que impede o `undefined` de virar objeto: `getPasse(...).dias`
 * em `undefined` quebraria o servidor inteiro por um pedido de cliente
 */
export function getPasse(passeId) {
  return PASSES.find((p) => p.id === passeId) ?? null;
}

/**
 * UM DIA do passe, ou `null`.
 *
 * Devolve o dia pelo NUMERO e nao pelo indice: `dias[3]` e o dia 4, e uma
 * seasonship que mudasse a ordem da lista pagaria o premio errado sem erro
 * nenhum. O numero e o que o painel mostra e o que o jogador digitou
 */
export function getDiaDoPasse(passeId, dia) {
  const passe = getPasse(passeId);

  if (!passe) return null;

  const numero = Math.floor(Number(dia));

  if (!Number.isFinite(numero)) return null;

  return passe.dias.find((d) => d.dia === numero) ?? null;
}

/**
 * O estado de um dia, lido de tres coisas ao mesmo tempo.
 *
 * ## POR QUE E UMA FUNCAO E NAO UM CAMPO NO CATALOGO
 *
 * Porque o estado depende de tres perguntas ao mesmo tempo — o dia chegou,
 * o jogador ja pegou, e o dia e premium — e sao tres respostas que mudam
 * por jogador. Guardar isso como `status` no catalogo faria o catalogo
 * mentir para o segundo jogador que abrir o painel: o dia 5 ja resgatado
 * para um e disponivel para o outro
 *
 * ## A ORDEM DAS CONDICOES E O QUE O JOGADOR VE
 *
 * Ela vai do mais terminal para o menos. `resgatado` vem primeiro porque um
 * dia ja pego nao pode virar "premium bloqueado" so porque o premium
 * acabou: o item esta no inventario, e dizer que esta trancado seria
 * mentira
 */
export function estadoDoDia(dia, { resgatado, premiumAtivo, diaAtual }) {
    if (resgatado) {
      return "resgatado";
    }

    /**
     * O PREMUIM VEM ANTES DO DIA QUE NAO CHEGOU.
     *
     * ## O QUE MUDOU
     *
     * Era `dia.dia > diaAtual` primeiro, e o `premium` depois. Com o passe
     * ativado, o dia 7 em diante continuava "bloqueado" — e o painel
     * mostrava o interruptor ligado e nenhum card destravando, o que parece
     * um botao quebrado
     *
     * ## POR QUE O PREMIUM ABRE DIA FUTURO
     *
     * Porque o premium nao e "ver o dia antes da hora": e o que paga os
     * dias marcados. O dia 7 e premium no catalogo, entao ele PODE ser
     * resgatado com o passe ligado — e um dia que o jogador ainda nao
     * chegou continua assim, e o `disponivel` abaixo cuida dos dois
     *
     * ## O QUE NAO MUDA
     *
     * O dia que chegou e nao e premium segue `disponivel` como sempre. E o
     * `premium` continua existindo como estado, para o dia marcado que o
     * jogador ainda nao pode pegar
     */
    if (dia.premium && premiumAtivo) {
      return "disponivel";
    }

    if (dia.dia > diaAtual) {
      return "bloqueado";
    }

    if (dia.premium && !premiumAtivo) {
      return "premium";
    }

    return "disponivel";
  }

/**
 * O QUE CADA ESTADO DIZ, em texto.
 *
 * A cor sozinha nao diz nada para quem nao distingue o azul do vermelho, e
 * o texto e o que o leitor de tela le no botao do dia
 */
export const ESTADO_TEXTO = {
  bloqueado: "Ainda nao chegou",
  disponivel: "Pronto para resgatar",
  resgatado: "Ja resgatado",
  premium: "Exige o passe premium",
};

/**
 * Os PONTOS de um passe, para a barra de progresso.
 *
 * ## POR QUE PONTOS E NAO SO "DIA 6 DE 14"
 *
 * Porque o dia sozinho nao diz o que falta. "Dia 6 de 14" e um numero que
 * o jogador precisa converter de cabeca; "600 de 1400 pontos, faltam 800"
 * e o que ele tem que fazer. Os dois numeros vem do mesmo `diaAtual`, so
 * que um deles e abstrato e o outro e a meta
 *
 * ## POR QUE O TOTAL E MULTIPLICADO E NAO SOMADO
 *
 * Porque `pontosPorDia` e constante no passe: 14 dias de 100 dao 1400, e
 * nao 100+101+102. A serie crescente seria o esquema de passe online em
 * que todo dia vale mais que o anterior — e aqui todo dia vale o mesmo,
 * porque o jogo nao tem evento com dificuldade subindo
 */
export function pontosDoPasse(passe) {
  const total = passe.totalDias * passe.pontosPorDia;
  const feitos = Math.min(passe.diaAtual, passe.totalDias) * passe.pontosPorDia;

  return {
    feitos,
    total,
    faltam: Math.max(0, total - feitos),
    /** De 0 a 100, para a largura da barra */
    percentual: total === 0 ? 0 : Math.round((feitos / total) * 100),
    diasRestantes: Math.max(0, passe.totalDias - passe.diaAtual),
  };
}