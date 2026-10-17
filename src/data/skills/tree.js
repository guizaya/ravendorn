import { SKILL_PACKS } from "./index.js";

/**
 * A ARVORE DE HABILIDADE, EM FUNIL.
 *
 * ## O DESENHO
 *
 * Quatro troncos sobem do topo, cada um abrindo dois nos, e os quatro
 * CONVERGEM num no so no meio: a Fundacao. Debaixo dela o desenho abre de novo
 * em tres, e em quatro.
 *
 * ```
 *   (b1)      (b2)      (b3)      (b4)        <- 4 troncos, cada um ensina uma skill
 *      \      /   \      /   \      /            <- 2 por tronco
 *        \  /       \  /       \  /
 *          \        \/         /
 *                 (F)          <- a FUNDACAO: um no so, maior e aceso
 *              /   |   \
 *            (s1) (s2) (s3)                     <- abre de novo
 *          /   \  /  \  /   \
 *        (s4) (s5) (s6) (s7)                    <- e abre mais
 * ```
 *
 * ## POR QUE CONVERGE E NAO EXPLODE
 *
 * Porque exploding para fora, os 32 nos do anel final viravam um circulo de
 * cartoes que o jogador nao conseguia ler nem rolar direito. Convergindo,
 * os quatro troncos ocupam a largura toda no topo — que e onde ha espaco — e
 * vao ficando um so ate o no unico do meio
 *
 * ## POR QUE A POSICAO E ESCREVIDA E NAO CALCULADA
 *
 * Porque e um funil, nao um circulo. Nao ha trigonometria: cada degrau e uma
 * linha com as posicoes que o desenho pede, e a unica conta e a conversao do
 * X normalizado para pixel. Um radial com raio e angulo Here daria um desenho
 * de arvore de natal
 */

/** Quantos pontos o personagem recebe por nivel subido. */
export const PONTOS_POR_NIVEL = 1;

/**
 * A POSICAO DE CADA DEGRAU, em X normalizado de -1 a 1.
 *
 * ## POR QUE OS NUMEROS SAO ESTES
 *
 * O topo abre quase ate a borda (-0.92 a +0.92) porque e onde ha espaco: ali
 * o desenho tem a largura inteira do palco. Cada degrau seguinte fecha um
 * pouco, porque os troncos vao se juntando. Depois da Fundacao o desenho abre
 * de novo, e por isso o ultimo degrau volta a ir ate -0.70
 *
 * E o `x` normalizado e nao pixel, para a mesma arvore caber num palco
 * diferente sem recalcular nada
 */
const DEGRAUS = [
  [-0.78, -0.26, 0.26, 0.78],

  /**
   * A LINHA MAIS LARGA: OITO NÓS NO PALCO DE 550.
   *
   * Estes valores não são "aproximados" — são os centros de oito nós de 54px
   * distribuídos com 13px de folga dentro de 522px úteis, e devolvidos para a
   * escala de -1 a 1. Qualquer arredondão aqui some um dos dois hexágonos de
   * fora do palco
   */
  [-0.851, -0.608, -0.365, -0.121, 0.121, 0.365, 0.608, 0.851],
  [-0.6, -0.2, 0.2, 0.6],
  [0],

  /**
   * ## O ESPELHO DA FUNDAÇÃO
   *
   * Os quatro degraus de baixo repetem, na ordem inversa, a construção dos
   * quatro de cima: 4 nós, 8 nós, 4 nós, e o ramo geral fechando. O X de cada
   * linha é o da linha correspondente de cima, o que faz o desenho abrir e
   * fechar duas vezes com a mesma silhueta
   *
   * Antes these three degrees eram uma fileira chapada de 3, outra de 4 e o
   * ramo geral — e a única parte da árvore que não era um funil
   */
  [-0.6, -0.2, 0.2, 0.6],
  [-0.851, -0.608, -0.365, -0.121, 0.121, 0.365, 0.608, 0.851],
  [-0.78, -0.26, 0.26, 0.78],

  /**
   * O DEGRAU DAS HABILIDADES GERAIS.
   *
   * E o unico degrau que NAO pertence a uma classe: os quatro nos aqui sao os
   * mesmos para o guerreiro, o lancer, a feiticeira e a arqueira. Eles abrem
   * depois das quatro convergencias de qualquer uma delas
   *
   * O X abre mais que a linha de baixo porque e onde a arvore ja terminou o
   * caminho da classe e sobra largura para o ramo geral
   */
  [-0.62, -0.21, 0.21, 0.62],
];

/** O nivel minimo, o custo e o total de cada degrau. */
const REGRAS_DEGRAU = [
  { nivel: 1, custo: 1 },
  { nivel: 3, custo: 2 },
  { nivel: 8, custo: 3 },
  { nivel: 14, custo: 5 },
  { nivel: 20, custo: 4 },
  { nivel: 26, custo: 6 },

  /**
   * A CONVERGENCIA DE BAIXO E A MAIS CARA DO CAMINHO DA CLASSE.
   *
   * Custa mais que a de cima porque e a ultima porta antes do ramo geral: e
   * aqui que o jogador decide se ainda quer fechar os quatro ramos
   */
  { nivel: 30, custo: 7 },

  /**
   * O DEGRAU GERAL E O MAIS CARO, e o ultimo a abrir.
   *
   * Nao por ser o mais forte, e porque chega depois de tudo: quem chegou ate
   * aqui ja pagou a classe inteira, e o ramo geral fecha o personagem. Com
   * custo menor, a Foundation de qualquer classe seria mais barata que ela
   */
  { nivel: 36, custo: 9 },
];

/**
 * O PALCO, em pixels.
 *
 * ## POR QUE 550 DE LARGURA
 *
 * Porque o pedido foi estreitar. E estreitar o palco estreita a árvore
 * inteira de uma vez: o `x` de cada nó sai do X normalizado vezes a METADE
 * da largura, entao o mesmo desenho fica mais estreito sem recalcular nada
 *
 /**
 * ## E POR QUE A ALTURA SUBIU PARA 1120
 *
 * Porque estreitar sem alongar daria uma coluna espremida. O desenho é um
 * funil que agora fecha DUAS vezes — o da classe descendo até a Fundação e o
 * dos ramos subindo até o ramo geral — e são oito degraus em vez de sete.
 * Com a altura antiga de 980, os 980px eram divididos em 6 vãos; são agora 7,
 * e cada vão passaria a 111px contra os 130px que o hexágono de 84px precisa
 * para a linha do `comprados/total` caber embaixo sem encostar no de baixo
 *
 * 1120 devolve os 130px exatos de vão
 */
export const PALCO = { largura: 550, altura: 1120 };

/**
 * O TAMANHO DO NÓ, e ele é o que o palco de 550 dita.
 *
 * ## POR QUE 54 E NÃO 76
 *
 * Porque a segunda linha tem OITO nós, e oito de 76 dão 608px: mais que os
 * 550 do palco, antes de qualquer folga. Com 54, oito nós ocupam 432 e
 * sobram 118 para sete folgas de 13px
 *
 * ## POR QUE `alto` É IGUAL A `largo`
 *
 * Porque o nó virou BOLA, e uma bola é redonda. Com `alto` maior que `largo`
 * sobraria uma elipse, e o `meiaAltura` — que é o raio com que a ligação sai
 * do nó — passaria afurá-la em cima e em baixo: a linha entraria no desenho em
 * vez de encostar nele
 *
 * O `alto` continua existindo como campo, e não como constante: o CSS do nó
 * lê o mesmo par, e um dia a bola pode voltar a ser oval sem tocar na fórmula
 *
 * ## E POR QUE A FUNDAÇÃO É MAIOR
 *
 * Porque é onde o desenho junta e o olho precisa achar o centro sem ler
 * nada. A diferença entre 66 e 54 é o que dá essa hierarquia sem numero
 * nenhum na tela
 */
export const TAMANHO_DO_NO = {
  largo: 54,
  alto: 54,
  fundacaoLargo: 66,
  fundacaoAlto: 66,
};

/**
 * UM NO, escrito na forma CURTA.
 *
 * Porque sao 24 nos por classe, e escrever nome, icone e bonus em quatro linhas
 * cada daria um arquivo de miles de linhas repetindo `nome:`. O que nao muda
 * entre eles fica no `montar`
 */
const n = (nome, icone, bonus) => ({
  nome,
  icone,
  bonus,
});

/**
 * AS HABILIDADES GERAIS: AS MESMAS PARA AS QUATRO CLASSES.
 *
 * ## POR QUE ELAS EXISTEM
 *
 * Porque a arvore erainteiramente da classe, e isso punia a escolha de classe.
 * Quem escolheu o guerreiro por `Golpe do Vazio` nao tinha como subir a
 * resistencia depois, e quem escolheu a feiticeira pelo recurso perdia o
 * ataque. A arvore ficava presa na primeira escolha, que e exatamente o
 * contrario do que uma arvore de progressao deveria fazer
 *
 * ## E POR QUE ELAS VEM DEPOIS DA FUNDACAO
 *
 * Porque o ramo geral e o FIM do caminho, nao um atalho. Quem nao fechou
 * nenhum tronco ainda nao sabe se quer resistencia ou velocidade, e o ramo
 * geral nao e o lugar de decidir isso. Ele fecha o personagem de quem ja
 * escolheu
 *
 * ## E POR QUE SAO QUATRO E NAO UMA LINHA
 *
 * Porque nao se puxam uns dos outros: cada um e uma escolha a parte, e o
 * jogador pode pegar os quatro. A linha que puxa o vizinho — que e o que os
 * nos da base fazem — obrigaria a atravessar o primeiro para chegar no
 * segundo, e transformaria uma escolha em trilha
 */
const GERAIS = [
  n("Corpo Firme", "🛡", { defense: 9, maxHp: 7 }),
  n("Reflexo", "⚡", { speed: 11 }),
  n("Mente Aberta", "🧠", { resource: 11 }),
  n("Golpe Certeiro", "🎯", { attack: 10 }),
];

/**
 * O PREFIXO DO ID DOS NÓS GERAIS.
 *
 * E o que faz o no geral ser o MESMO em todas as classes. O id normal leva o
 * nome da classe na frente — `warrior_g0_0` — e por isso cada classe tem a sua
 * copia. O geral usa este no lugar do nome da classe, e ai `geral_g6_0` e um
 * no so, que o save de qualquer classe reconhece
 */
const PREFIXO_GERAL = "geral";

/**
 * O CATALOGO DAS QUATRO CLASSES.
 *
 * ## A FORMA
 *
 * `bracos` sao os quatro troncos de cima — cada um ensina uma das quatro
 * skills da classe. `abaixo` sao os nos de baixo da Fundacao, compartilhados
 * por todos: eles nao dependem de nenhum tronco, e e por isso que o desenho
 * abre de novo depois do centro
 */
const CATALOGO = {
  warrior: {
    bracos: [
      {
        nome: "Golpe do Vazio",
        icone: "⚒",
        skillId: "warrior_void_slash",
        bonus: { attack: 7 },
        filhos: [
          { no: n("Corte Aberto", "🗡", { attack: 10 }), neto: n("Lamina Dupla", "⚔", { attack: 4 }) },
          { no: n("Vazio que Fura", "🕳", { attack: 6, defense: 8 }), neto: n("Costura", "🧵", { defense: 5 }) },
        ],
      },
      {
        nome: "Quebra-Chao",
        icone: "⛨",
        skillId: "warrior_ground_smash",
        bonus: { defense: 7 },
        filhos: [
          { no: n("Onda de Choque", "🌊", { defense: 13 }), neto: n("Rachadura", "🪨", { defense: 5 }) },
          { no: n("Estilhaco", "💎", { attack: 11 }), neto: n("Lasca", "🔹", { attack: 4 }) },
        ],
      },
      {
        nome: "Golpe Dividido",
        icone: "🌀",
        skillId: "warrior_splitting_slash",
        bonus: { speed: 9 },
        filhos: [
          { no: n("Lamina Larga", "🌗", { attack: 15 }), neto: n("Tres Cortes", "⚔", { attack: 5 }) },
          { no: n("Passo ao Lado", "👣", { speed: 15 }), neto: n("Pique", "🦵", { speed: 5 }) },
        ],
      },
      {
        nome: "Lamina de Vento",
        icone: "🌪",
        skillId: "warrior_gale_slash",
        bonus: { attack: 6, speed: 7 },
        filhos: [
          { no: n("Ciclone", "🍃", { speed: 12 }), neto: n("Redemoinho", "🌀", { speed: 5 }) },
          { no: n("Vendaval", "💨", { attack: 9, speed: 9 }), neto: n("Rajada", "🌬", { speed: 5, attack: 3 }) },
        ],
      },
    ],
    fundacao: n("Fundacao", "🗿", { maxHp: 14, defense: 9 }),

    /**
     * OS QUATRO RAMOS DE BAIXO, no espelho dos quatro troncos de cima.
     *
     * Cada um abre em dois filhos e fecha em uma convergência, exatamente
     * como o tronco faz na descida. O nome de cada ramo é o eixo que ele
     * trabalha, e os filhos saem os dois bonus do eixo com o valor dobrado
     */
    ramos: [
      {
        nome: "Muralha",
        icone: "🛡",
        bonus: { defense: 8 },
        filhos: [
          { no: n("Couro Escuro", "🧥", { defense: 12 }), neto: n("Bastiao", "🏰", { defense: 5 }) },
          { no: n("Placas", "🪨", { maxHp: 16 }), neto: n("Pedra Bruta", "🪓", { maxHp: 5 }) },
        ],
      },
      {
        nome: "Furia",
        icone: "⚔",
        bonus: { attack: 7 },
        filhos: [
          { no: n("Golpe Pesado", "🪓", { attack: 14 }), neto: n("Executar", "💀", { attack: 5 }) },
          { no: n("Rugido", "📢", { attack: 8, maxHp: 8 }), neto: n("Grito Longo", "🗣", { attack: 4 }) },
        ],
      },
      {
        nome: "Passo",
        icone: "👣",
        bonus: { speed: 8 },
        filhos: [
          { no: n("Arrancada", "💨", { speed: 14 }), neto: n("Investida", "🐎", { speed: 5 }) },
          { no: n("Giro", "🌀", { speed: 9, defense: 6 }), neto: n("Rodopio", "🔄", { speed: 5 }) },
        ],
      },
      {
        nome: "Coracao",
        icone: "❤",
        bonus: { maxHp: 9 },
        filhos: [
          { no: n("Folego", "🫁", { maxHp: 16 }), neto: n("Vigor", "💪", { maxHp: 5 }) },
          { no: n("Instinto", "👁", { defense: 7, speed: 5 }), neto: n("Presa", "🦷", { defense: 4 }) },
        ],
      },
    ],
  },

  lancer: {
    bracos: [
      {
        nome: "Golpe Devastador",
        icone: "➶",
        skillId: "lancer_ravaging_blow",
        bonus: { attack: 8 },
        filhos: [
          { no: n("Estocada Larga", "🗡", { attack: 11 }), neto: n("Estocada Dupla", "⚔", { attack: 5 }) },
          { no: n("Alcance de Braco", "✋", { speed: 11 }), neto: n("Cotovelo", "💪", { speed: 5 }) },
        ],
      },
      {
        nome: "Lamina Crescente",
        icone: "🌙",
        skillId: "lancer_crescent_blade",
        bonus: { attack: 5, maxHp: 9 },
        filhos: [
          { no: n("Meia-Lua", "🌛", { attack: 14 }), neto: n("Lua Cheia", "🌕", { attack: 5 }) },
          { no: n("Pele Dura", "🩸", { maxHp: 18 }), neto: n("Casco", "🛡", { defense: 5 }) },
        ],
      },
      {
        nome: "Tempestade Varrida",
        icone: "🌀",
        skillId: "lancer_sweeping_storm",
        bonus: { speed: 9, defense: 6 },
        filhos: [
          { no: n("Giro Continuo", "🔄", { speed: 13 }), neto: n("Rodopio", "🌀", { speed: 5 }) },
          { no: n("Muralha Movel", "🧱", { defense: 15 }), neto: n("Bloco", "🧱", { defense: 5 }) },
        ],
      },
      {
        nome: "Cauda de Dragao",
        icone: "🐉",
        skillId: "lancer_dragon_tail",
        bonus: { attack: 10 },
        filhos: [
          { no: n("Sopro Curto", "🔥", { attack: 12 }), neto: n("Brasa", "🔥", { attack: 5 }) },
          { no: n("Casco de Dragao", "🐲", { maxHp: 16, defense: 9 }), neto: n("Placa", "🛡", { defense: 5 }) },
        ],
      },
    ],
    fundacao: n("Fundacao", "🏛", { maxHp: 12, attack: 6 }),

    ramos: [
      {
        nome: "Presa",
        icone: "🐍",
        bonus: { attack: 8 },
        filhos: [
          { no: n("Estocada Profunda", "🗡", { attack: 13 }), neto: n("Perfurar", "🕳", { attack: 5 }) },
          { no: n("Lanca Longa", "➶", { attack: 9, speed: 6 }), neto: n("Ponta Extra", "🔱", { attack: 4 }) },
        ],
      },
      {
        nome: "Couraça",
        icone: "🛡",
        bonus: { defense: 8 },
        filhos: [
          { no: n("Pele Dura", "🩸", { defense: 13 }), neto: n("Casco", "🐚", { defense: 5 }) },
          { no: n("Escamas", "🐉", { maxHp: 15 }), neto: n("Muda", "🦎", { maxHp: 5 }) },
        ],
      },
      {
        nome: "Alento",
        icone: "🫁",
        bonus: { maxHp: 9 },
        filhos: [
          { no: n("Respiracao", "🌬", { maxHp: 17 }), neto: n("Pulmao Cheio", "🫀", { maxHp: 5 }) },
          { no: n("Visao de Alcance", "🔭", { speed: 7 }), neto: n("Mirada", "👁", { speed: 4 }) },
        ],
      },
      {
        nome: "Giro",
        icone: "🔄",
        bonus: { speed: 8 },
        filhos: [
          { no: n("Rodopio", "🌀", { speed: 13 }), neto: n("Redemoinho", "🌪", { speed: 5 }) },
          { no: n("Recuo", "🦵", { speed: 8, defense: 6 }), neto: n("Contra-Golpe", "🔙", { defense: 4 }) },
        ],
      },
    ],
  },

  sorcerer: {
    bracos: [
      {
        nome: "Orbe de Chama",
        icone: "🔥",
        skillId: "sorcerer_flame_orb",
        bonus: { attack: 9 },
        filhos: [
          { no: n("Combustao Lenta", "🕯", { attack: 12 }), neto: n("Brasa", "🔥", { attack: 5 }) },
          { no: n("Circuito Aberto", "🔋", { resource: 17 }), neto: n("Bobina", "🌀", { resource: 6 }) },
        ],
      },
      {
        nome: "Orbe de Gelo",
        icone: "❄",
        skillId: "sorcerer_frost_orb",
        bonus: { maxHp: 11 },
        filhos: [
          { no: n("Geada Profunda", "🧊", { maxHp: 19 }), neto: n("Corrente Fria", "🧣", { maxHp: 5 }) },
          { no: n("Pele Fria", "🛡", { defense: 12 }), neto: n("Toque", "🖐", { defense: 4, resource: 4 }) },
        ],
      },
      {
        nome: "Vortice Sombrio",
        icone: "🌀",
        skillId: "sorcerer_dark_vortex",
        bonus: { attack: 7, speed: 6 },
        filhos: [
          { no: n("Fundo do Vortice", "👁", { attack: 13 }), neto: n("Olheira", "👁", { attack: 5 }) },
          { no: n("Passo Leve", "🩰", { speed: 13 }), neto: n("Sussurro", "💨", { speed: 5 }) },
        ],
      },
      {
        nome: "Escudo Magico",
        icone: "🔮",
        skillId: "sorcerer_magic_shield",
        bonus: { defense: 10 },
        filhos: [
          { no: n("Barreira Dura", "🏰", { defense: 18 }), neto: n("Muralha", "🧱", { defense: 5 }) },
          { no: n("Reservatorio Cheio", "💧", { resource: 20 }), neto: n("Cisterna", "🛢", { resource: 6 }) },
        ],
      },
    ],
    fundacao: n("Fundacao", "🧿", { resource: 18, maxHp: 8 }),

    ramos: [
      {
        nome: "Fluxo",
        icone: "🔮",
        bonus: { resource: 9 },
        filhos: [
          { no: n("Circuito Fechado", "🔋", { resource: 16 }), neto: n("Fluxo Pleno", "🌊", { resource: 5 }) },
          { no: n("Canal Direto", "⚡", { resource: 10, attack: 6 }), neto: n("Descarga", "🔌", { resource: 4 }) },
        ],
      },
      {
        nome: "Brasa",
        icone: "🔥",
        bonus: { attack: 8 },
        filhos: [
          { no: n("Combustao", "🕯", { attack: 13 }), neto: n("Explosao", "💥", { attack: 5 }) },
          { no: n("Estilhaco", "💎", { attack: 9, resource: 4 }), neto: n("Lasca", "🔹", { attack: 4 }) },
        ],
      },
      {
        nome: "Escudo",
        icone: "🛡",
        bonus: { defense: 9 },
        filhos: [
          { no: n("Manto Frio", "🧣", { defense: 12 }), neto: n("Absorcao", "🧿", { defense: 5 }) },
          { no: n("Barreira", "🧊", { maxHp: 14 }), neto: n("Casca Gelada", "🧊", { maxHp: 5 }) },
        ],
      },
      {
        nome: "Leveza",
        icone: "🪶",
        bonus: { speed: 9 },
        filhos: [
          { no: n("Passos Leves", "🩰", { speed: 14 }), neto: n("Vento", "🌬", { speed: 5 }) },
          { no: n("Flutuar", "🕊", { speed: 8, resource: 5 }), neto: n("Suspensao", "🪶", { speed: 4 }) },
        ],
      },
    ],
  },

  arbalist: {
    bracos: [
      {
        nome: "Tiro Rapido",
        icone: "➹",
        skillId: "arbalist_quick_shot",
        bonus: { attack: 9 },
        filhos: [
          { no: n("Mao Firme", "✊", { attack: 12 }), neto: n("Dedo Leve", "👆", { attack: 5 }) },
          { no: n("Olho de Aquila", "🦅", { speed: 13 }), neto: n("Alcance", "🔭", { speed: 5 }) },
        ],
      },
      {
        nome: "Casco de Bruma",
        icone: "☠",
        skillId: "arbalist_venom_mist_shell",
        bonus: { speed: 8 },
        filhos: [
          { no: n("Arco Envenenado", "🧪", { attack: 12 }), neto: n("Picada", "🦟", { attack: 5 }) },
          { no: n("Capa Curtissima", "🧥", { speed: 15 }), neto: n("Manga", "🧤", { speed: 5 }) },
        ],
      },
      {
        nome: "Flecha Ilusoria",
        icone: "🎭",
        skillId: "arbalist_illusion_arrow",
        bonus: { attack: 6, maxHp: 9 },
        filhos: [
          { no: n("Dobra Imagem", "👥", { attack: 13 }), neto: n("Eco", "🔊", { attack: 5 }) },
          { no: n("Pele Fina", "🍃", { maxHp: 17 }), neto: n("Cuticula", "🩹", { maxHp: 5 }) },
        ],
      },
      {
        nome: "Manto",
        icone: "🌫",
        skillId: "arbalist_cloaking",
        bonus: { defense: 9 },
        filhos: [
          { no: n("Sombra Solida", "⬛", { defense: 16 }), neto: n("Densidade", "🪨", { defense: 5 }) },
          { no: n("Passo Sem Som", "🐾", { speed: 16 }), neto: n("Ponta dos Pes", "🦶", { speed: 5 }) },
        ],
      },
    ],
    fundacao: n("Fundacao", "🕸", { speed: 10, defense: 6 }),

    ramos: [
      {
        nome: "Mira",
        icone: "🎯",
        bonus: { attack: 8 },
        filhos: [
          { no: n("Olho de Aguia", "🦅", { attack: 13 }), neto: n("Alcance", "🔭", { attack: 5 }) },
          { no: n("Corda Tensa", "🪢", { attack: 9, speed: 5 }), neto: n("Ponta Afiada", "🗡", { attack: 4 }) },
        ],
      },
      {
        nome: "Silencio",
        icone: "🌫",
        bonus: { speed: 9 },
        filhos: [
          { no: n("Capa Curtissima", "🧥", { speed: 14 }), neto: n("Fantasma", "👻", { speed: 5 }) },
          { no: n("Passo Sem Som", "🐾", { speed: 10, defense: 5 }), neto: n("Vulto", "🌬", { speed: 4 }) },
        ],
      },
      {
        nome: "Veneno",
        icone: "🧪",
        bonus: { resource: 8 },
        filhos: [
          { no: n("Arco Envenenado", "🦟", { attack: 11, resource: 5 }), neto: n("Toxina", "☣", { resource: 5 }) },
          { no: n("Cuba Lenta", "🧫", { resource: 10 }), neto: n("Sedimento", "⚗", { resource: 4 }) },
        ],
      },
      {
        nome: "Pele",
        icone: "🍃",
        bonus: { maxHp: 9 },
        filhos: [
          { no: n("Couro Leve", "🧤", { maxHp: 15 }), neto: n("Vigor", "💪", { maxHp: 5 }) },
          { no: n("Cuticula", "🩹", { defense: 7, speed: 5 }), neto: n("Casca", "🪵", { defense: 4 }) },
        ],
      },
    ],
  },
};

/**
 * DERIVA ID, DEGRAU, POSICAO, EXIGENCIA E HERANCA DE CADA NO.
 *
 * ## A EXIGENCIA DE CADA DEGRAU
 *
 * - o tronco e o no unico do topo: nada e exigido
 * - os dois filhos de um tronco: o tronco
 * - o no de convergencia de um tronco: os dois filhos daquele tronco. E o que
 *   faz o desenho fechar: o tronco so chega na Fundacao tendo pago o caminho
 *   inteiro dele
 * - a FUNDACAO: os quatro nos de convergencia. Ninguem passa por ela sem ter
 *   fechado pelo menos um tronco
 * - os nos de baixo da Fundacao: so a Fundacao
 * - a base: os nos de baixo, e cada um pega o vizinho do lado
 */
function montar(classeId, def) {
  const nos = [];

  /**
   * COLOCA UM NO NA ARVORE, COM ID, EXIGENCIA E COORDENADA.
   *
   * ## POR QUE ELA VIVE DENTRO DE `montar`
   *
   * Porque ela fecha em `classeId` e em `nos`. Fora da funcao, `classeId`
   * seria `undefined` e o `id` de todo no sairia `undefined_g0_0` — dois nos
   * com o mesmo id, e o save parando de distinguir um do outro
   *
   * ## E O `x` ABSOLUTO NO PALCO, E NAO UM DESLOCAMENTO
   *
   * E o ponto onde este desenho ja quebrou uma vez. O `DEGRAUS` guarda o X
   * NORMALIZADO de -1 a +1, e e natural multiplicar isso pela metade da
   * largura achando que sai um deslocamento. Mas `left: 0` num elemento
   * posicionado e a BORDA ESQUERDA do palco, e nao o MEIO dele
   *
   * Com deslocamento, a Fundacao — cujo x normalizado e 0 — caia na borda
   * esquerda, e os ramos da esquerda saiam para `left: -367px`, fora do
   * palco. O desenho aparecia inteiro na metade esquerda, o `overflow` do
   * painel cortava o resto, e o arrasto nao tinha para onde ir
   *
   * ## POR QUE A CORRECAO E AQUI E NAO NO CSS
   *
   * Porque a MESMA coordenada e usada em dois lugares: no `left` do botao e no
   * `d` do `path` do SVG. Os dois tem origem no canto superior esquerdo do
   * palco. Somar a metade da largura em um dos dois os desalinharia — que e a
   * segunda metade do mesmo bug
   */
  const empurra = (no, degrau, exige, indice, prefixo = classeId) => {
    const regra = REGRAS_DEGRAU[degrau];

    const largo = no.fundacao ? TAMANHO_DO_NO.fundacaoLargo : TAMANHO_DO_NO.largo;
    const alto = no.fundacao ? TAMANHO_DO_NO.fundacaoAlto : TAMANHO_DO_NO.alto;

    const completo = {
      ...no,
      /**
       * O `prefixo` DO ID, e NAO a classe.
       *
       * O no geral usa `geral`, e e por isso que ele e o mesmo no para as
       * quatro: `geral_g6_0` existe na arvore do guerreiro e na da feiticeira,
       * com o mesmo id. O save guarda o id, entao um no geral comprado
       * continua valendo se o personagem mudar de classe depois — que e o que
       * "geral" quer dizer
       *
       * E sem isso o no geral seria `warrior_g6_0` e `lancer_g6_0`, que sao
       * dois nos diferentes com o mesmo preco: um bought como guerreiro nao
       * valeria como lancer, e o ramo seria quatro copias
       */
      id: `${prefixo}_g${degrau}_${indice}`,
      geral: prefixo === PREFIXO_GERAL,
      degrau,
      nivel: regra.nivel,
      custo: regra.custo,
      exige,
      x: PALCO.largura / 2 + (DEGRAUS[degrau][indice] * PALCO.largura) / 2,

      /**
       * O `y` DEIXA 100px EM CIMA E 100px EMBAIXO DO PRIMEIRO E DO ULTIMO.
       *
       * O de cima porque o hexagono do topo tem que caber inteiro com a grade
       * aparecendo atras dele. O de baixo porque o `comprados/total` fica DEBAIXO
       * do hexagono, e um no no ultimo degrau com o rotulo em `-4px` do limite
       * seria cortado
       */
      y: 100 + degrau * ((PALCO.altura - 200) / (DEGRAUS.length - 1)),
      total: DEGRAUS[degrau].length,
      meiaLargura: largo / 2,
      meiaAltura: alto / 2,
    };

    nos.push(completo);

    return completo;
  };


  const troncos = [];

  for (const [i, braco] of def.bracos.entries()) {
    const tronco = empurra(
      {
        nome: braco.nome,
        icone: braco.icone,
        bonus: braco.bonus,
        skillId: braco.skillId ?? null,
        descricao: `Ensina ${braco.nome}.`,
      },
      0,
      [],
      i,
    );

    const filhos = [];

    for (const [j, filho] of (braco.filhos ?? []).entries()) {
      filhos.push(empurra(filho.no, 1, [tronco.id], i * 2 + j));
    }

    /**
     * O NO DE CONVERGENCIA DO TRONCO, E UM SO POR TRONCO.
     *
     * ## POR QUE UM E NAO UM POR FILHO
     *
     * Porque e ele que fecha o tronco. Com dois — um por filho — a arvore
     * teria 8 nos no terceiro degrau, e o desenho nao CONVERGIRIA: ele abriria
     * de novo no meio, que e justamente o oposto do funil
     *
     * ## E POR QUE ELE EXIGE OS DOIS FILHOS
     *
     * Porque e o no que diz "este tronco esta fechado". Quem chegou nele pagou
     * o tronco e os dois caminhos dentro dele, e so agora ele sobe para a
     * Fundacao
     */
    empurra(
      {
        nome: braco.filhos?.[0]?.neto ?? null,
        icone: "🔺",
        bonus: {},
      },
      2,
      filhos.map((f) => f.id),
      i,
    );

    // o neto real vem do catalogo, e nao deste esqueleto
    const convergencia = nos[nos.length - 1];

    convergencia.nome = braco.filhos?.[0]?.neto?.nome ?? convergencia.nome;
    convergencia.icone = braco.filhos?.[0]?.neto?.icone ?? convergencia.icone;
    convergencia.bonus = braco.filhos?.[0]?.neto?.bonus ?? {};

    troncos.push({ tronco, filhos, convergencia });
  }

  /**
   * A FUNDACAO: O NO QUE O DESENHO TODO JUNTA.
   *
   * E onde as quatro pontas se encontram, e por isso que ele e maior e aceso.
   * Ela exige os QUATRO nos de convergencia — um por tronco — de modo que so
   * se chega nela tendo fechado o caminho inteiro de cada tronco
   */
  const fundacao = empurra(
    def.fundacao,
    3,
    troncos.map((t) => t.convergencia.id),
    0,
  );

  fundacao.fundacao = true;

  /**
   * OS QUATRO RAMOS DE BAIXO, E O ESPELHO DOS QUATRO TRONCOS DE CIMA.
   *
   * ## POR QUE A MESMA CONSTRUÇÃO, E NÃO UM DESENHO NOVO
   *
   * Porque o jogador que understands o caminho da classe learns sem tentar:
   * abre um ramo, escolhe entre dois filhos, fecha o ramo num neto, e o
   * desenho faz o mesmo que ele ja fez três vezes acima. Uma fileira chapada
   * embaixo — que era o que existia — quebrava isso: a arvore ficava legivel
   * na metade de cima e inventava um vocabulario novo na de baixo
   *
   * E o ramo geral fica no fim, exigindo as QUATRO convergencias. E o que
   * fecha o personagem: nao se compra um no geral tendo um ramo pela metade
   */
  const ramos = [];

  for (const [i, ramo] of (def.ramos ?? []).entries()) {
    const noRamo = empurra(
      {
        nome: ramo.nome,
        icone: ramo.icone,
        bonus: ramo.bonus,
        descricao: `Ramo de ${ramo.nome}.`,
      },
      4,
      [fundacao.id],
      i,
    );

    const filhos = [];

    for (const [j, filho] of (ramo.filhos ?? []).entries()) {
      filhos.push(empurra(filho.no, 5, [noRamo.id], i * 2 + j));
    }

    /**
     * A CONVERGENCIA DO RAMO, e UM SO POR RAMO.
     *
     * O `🔻` de espelho e proposital: o tronco fecha com `🔺`, e os dois
     * juntos mostram que o desenho subiu ate a Fundacao e esta descendo
     */
    empurra(
      {
        nome: ramo.filhos?.[0]?.neto ?? null,
        icone: "🔻",
        bonus: {},
      },
      6,
      filhos.map((f) => f.id),
      i,
    );

    const convergencia = nos[nos.length - 1];

    convergencia.nome =
      ramo.filhos?.[0]?.neto?.nome ?? convergencia.nome;
    convergencia.icone =
      ramo.filhos?.[0]?.neto?.icone ?? convergencia.icone;
    convergencia.bonus = ramo.filhos?.[0]?.neto?.bonus ?? {};

    ramos.push({ ramo: noRamo, filhos, convergencia });
  }

  /**
   * O RAMO GERAL, NO FIM DE TUDO.
   *
   * ## POR QUE UM NO GERAL EXIGE SÓ A CONVERGÊNCIA DO SEU PRÓPRIO RAMO
   *
   * Porque as quatro linhas viriam todas para o mesmo centro: exigindo as
   * quatro, o SVG desenhava 16 retas em leque de baixo para cima, e o
   * desenho embaixo da Fundação virava uma teia — exatamente o problema que a
   * metade de cima não tem
   *
   * E não perde nada de sentido: o no geral continua exigindo um ramo inteiro
   * fechado, e continua sendo o mesmo no nas quatro classes, porque o `prefixo`
   * dele é `geral` e não o nome da classe
   */
  for (const [i, no] of GERAIS.entries()) {
    empurra(
      {
        ...no,
        descricao: "Habilidade geral: vale para qualquer classe.",
      },
      7,
      [ramos[i].convergencia.id],
      i,
      PREFIXO_GERAL,
    );
  }

  return nos;
}

/**
 * O ID VELHO DE UM NÓ, OU O PRÓPRIO — e por quê existe este desvio.
 *
 * ## O QUE QUEBROU
 *
 * O `id` de um nó é `${prefixo}_g${degrau}_${indice}`, e o número do degrau
 * está no ID. O ramo geral saiu do degrau 6 para o 7 quando os quatro ramos
 * entraram embaixo da Fundação, então `geral_g6_0` deixou de existir e virou
 * `geral_g7_0`
 *
 * ## POR QUE ISSO APAGAVA COMPRA
 *
 * `nosConfiaveis` confere cada id do save contra a árvore atual e descarta o
 * que não acha. Um personagem que tinha comprado um no geral veria ele sumir
 * do painel, com o ponto gasto e sem o bônus — e o `custoTotalDaArvore`
 * devolveria o ponto, porque ele conta os nós comprados
 *
 * ## E POR QUE SÓ O GERAL PRECISA DO DESVIO
 *
 * Porque os nós de classe que mudaram de grau (`_g4_` e `_g5_` de baixo) foram
 * removidos de propósito: o pedido era tirar o que estava embaixo. Não há o
 * que migrar deles
 */
function idAntigo(id) {
  return /^geral_g6_/.test(id)
    ? id.replace("geral_g6_", "geral_g7_")
    : id;
}

/**
 * Os nos de uma classe, de cima para baixo.
 */
const NOS_POR_CLASSE = new Map();

for (const [classeId, def] of Object.entries(CATALOGO)) {
  NOS_POR_CLASSE.set(classeId, montar(classeId, def));
}

/** Os nos de uma classe. Array vazio quando ela nao tem arvore. */
export function arvoreDaClasse(classeId) {
  return NOS_POR_CLASSE.get(classeId) ?? [];
}

/** Um no da arvore que existe e pertence a classe, ou `null`. */
export function noDaArvore(classeId, noId) {
  return (
    arvoreDaClasse(classeId).find((no) => no.id === noId) ?? null
  );
}

/**
 * TODOS OS NOS COM O QUE CADA UM PODE, E POR QUE NAO.
 *
 * As tres regras ficam aqui e nao em cada tela porque sao a MESMA pergunta
 * feita em tres lugares: o painel decide o que acende, o motor decide se
 * aceita, e o save decide se confia
 */
export function nosDisponiveis(classeId, comprados, pontos, level) {
  const resultado = [];

  for (const no of arvoreDaClasse(classeId)) {
    const investido = comprados?.has(no.id) ?? false;

    let motivo = "";

    if (investido) {
      motivo = "aprendido";
    } else if (level < no.nivel) {
      motivo = `nivel ${no.nivel}`;
    } else if ((no.exige ?? []).some((id) => !comprados?.has(id))) {
      motivo = "bloqueado";
    } else if (pontos < no.custo) {
      motivo = `custa ${no.custo}`;
    }

    resultado.push({ no, pode: motivo === "", motivo, investido });
  }

  return resultado;
}

/** SOMA OS BONUS DE TODOS OS NOS INVESTIDOS. */
export function bonusDaArvore(classeId, comprados) {
  const bonus = {};

  if (!comprados?.size) return bonus;

  for (const noId of comprados) {
    const no = noDaArvore(classeId, noId);

    if (!no?.bonus) continue;

    for (const [stat, valor] of Object.entries(no.bonus)) {
      bonus[stat] = (bonus[stat] ?? 0) + valor;
    }
  }

  return bonus;
}

/** O total de pontos que a arvore inteira custa. */
export function custoTotalDaArvore(classeId) {
  let total = 0;

  for (const no of arvoreDaClasse(classeId)) total += no.custo;

  return total;
}

/**
 * Um save esta CONSISTENTE quando todo no salvo pertence a arvore da classe.
 *
 * E o filtro do `applyCharacterSave`: um id guardado e conferido aqui antes de
 * virar ponto de bonus, e no com `exige` quebrado tambem e descartado
 */
export function nosConfiaveis(classeId, ids) {
  const confiaveis = new Set();

  /**
   * A TRADUÇÃO E MARCADA AQUI, e o "herdado" viaja JUNTO com o id.
   *
   * Marcar depois, por busca reversa, dá o resultado oposto do que se quer:
   * o `geral_g7_0` procurado no formato antigo não existe, a busca volta vazio,
   * e TODO geral novo — inclusive o de um save adulterado — passava como se
   * fosse antigo. A verdade é que a herança é uma propriedade do ID que
   * chegou, não de um id que se procura depois
   */
  const traduzidos = (ids ?? []).map((id) => {
    const novo = idAntigo(id);

    return { id: novo, herdado: novo !== id };
  });

  const lista = traduzidos.map((t) => t.id);

  for (const { id, herdado } of traduzidos) {
    const no = noDaArvore(classeId, id);

    if (!no) continue;

    /**
     * O NO GERAL ANTIGO E HERDADO, E NAO EXIGIDO.
     *
     * Ele passou a depender de uma das convergencias novas do degrau 6 — uma
     * ramificacao que o personagem nao tinha como construir, porque ela nao
     * existia quando ele comprou. Cobrar o pre-requisito aqui apagava a
     * compra: o no sumia do painel, o ponto gasto nao voltava, e o
     * `custoTotalDaArvore` devolvia os pontos porque ele conta os nos salvos
     *
     * A concessao e estreita de proposito: vale so para o ID que o `idAntigo`
     * acabou de traduzir, que sao quatro no total em todo o jogo. Um save
     * adulterado no formato NOVO nao ganha nada por aqui — ele so teria o
     * pre-requisito conferido como qualquer outro
     */
    if (herdado) {
      confiaveis.add(id);
      continue;
    }

    const temTodosOsPreReq = (no.exige ?? []).every((r) => lista.includes(r));

    if (temTodosOsPreReq) confiaveis.add(id);
  }

  return confiaveis;
}

/**
 * A skill de um no entra no `habilidadesAprendidas`?
 *
 * `books.js` ja valida o livro contra o pack, e aqui o no faz o mesmo pela
 * arvore, para um no mal editado nao teachar uma skill de outra classe
 */
export function skillDoNoConfiavel(classeId, noId) {
  const no = noDaArvore(classeId, noId);

  if (!no?.skillId) return null;

  const existe = SKILL_PACKS[classeId]?.skills?.some(
    (skill) => skill.id === no.skillId,
  );

  return existe ? no.skillId : null;
}
