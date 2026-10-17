/**
 * Os icones desenhados dos botoes da HUD.
 *
 * Os botoes da barra usavam um GLIFO de texto — `☠` no bestiario,
 * `⇄` no market, `⚒` no craft e `?` no status — e eles nao dizem o que
 * o painel e. O `?` do status e o pior dos quatro: e o caractere de
 * "duvida" do teclado virado de proposito para o painel do personagem,
 * e o jogador tem de adivinhar o que ele abre. A arte resolve, e e o
 * que esta pasta tem
 *
 * O nome do arquivo e o do botao: `stats.png`, `bestiario.png`,
 * `market.png`, `craft.png`, `colecao.png` e `rank.png`. O
 * `gear_pixel_icon.png` e a excecao, e ele entra pelo `HUD_ICON_FILE`
 * logo abaixo. O mapa e o unico lugar onde o nome do botao e o caminho
 * do arquivo se encontram, e ele e escrito POR EXTENSO, com o caminho
 * literal em cada `new URL`
 *
 * Isso nao e preferencia de escrita: e a regra do Vite, que so
 * empacota o `new URL` quando o caminho e um literal. Com
 * `new URL(\`../assets/icons/${nome}.png\`, import.meta.url)` o
 * build passa, imprime `✓ built`, e o PNG nao vai para o `dist`: no
 * desenvolvimento a URL `file://` funciona e o icone aparece, e so em
 * producao que ele some. Sem erro, sem aviso — e o Vite tem outros
 * arquivos que aparecem no `dev` e nao chegam no `dist`
 *
 * O `new URL(..., import.meta.url)` e o mesmo motivo de
 * `data/items/icons.js` e de `./sprites/`: o motor tambem roda no
 * servidor Node, e um `import url from "stats.png"` derrubaria o
 * processo com ERR_UNKNOWN_FILE_EXTENSION. O Node resolve isto para uma
 * string sem abrir o arquivo
 */

/**
 * Os icones que existem, e o glifo de cada um.
 *
 * O glifo e o RESERVA: e o que o botao mostra enquanto a imagem nao
 * carregou, e o que ele mostra se o arquivo faltar. Sem ele, um icone
 * que da 404 deixa o botao vazio, e um botao vazio na barra e pior do
 * que o glifo feio que ele substitui — o jogador perde a referencia
 * de qual painel aquele circulo abre
 *
 * A ordem e a da barra, e a lista cresce de proposito: um icone novo
 * entra aqui e o `hudIcons.test.js` o acha pelo `for`, sem ninguem
 * precisar escrever um caso
 *
 * O que NAO esta aqui e o botao de teste. Ele e painel de depuracao, e
 * a arte dele nao foi feita; quando aparecer, e um `png` e uma linha
 * nesta lista, e nada mais
 */
export const HUD_ICON_IDS = [
  "stats",
  "bestiario",
  "market",
  "loja",
  "collection",
  "craft",
  "encantar",
  "rank",
  "guild",
  "arvore",
"passe",
  "settings",
  /**
   * `ataque`, `defesa` e `velocidade` NAO entram nesta lista.
   *
   * A lista e o que o `hudIcons.test.js` percorre, e ele le o arquivo de
   * cada id do disco: um id aqui sem PNG faz o teste falhar. Os tres
   * atributos do rodape usam so o GLIFO, ate que a arte seja desenhada
   *
   * E `arena` saiu. Ele estava na lista sem ter PNG, e era ele que quebrava o
   * `URL == IDS` do teste: nenhum botao da barra pede `arena`, e a arte
   * dele nunca foi feita
   *
   * ## E O `boss`, A PRIMEIRA ARTE VERTICAL DA BARRA
   *
   * O `boss.png` tem 239x253 — retrato — enquanto os outros andam em torno de
   * 170x160. E o unico icone em que a arte chega perto do topo e da base do
   * quadro, entao o `object-fit: contain` sem limite de altura a faria estourar
   * a barra na vertical. Quem resolve e o `max-height` em `.hud-btn--boss`,
   * e nao um recorte do arquivo: cortar a arte do chefe e pior que deixa-la
   * pequena
   */
  "boss",
];

/**
 * O glifo de reserva de cada icone.
 *
 * E o mesmo caractere que o botao usava antes da arte, e nao um
 * glifo novo: o desenho precisa da mesma leitura de antes, e o texto
 * ainda e o que aparece se a imagem nao vier
 */
const HUD_ICON_GLYPH = {
  stats: "?",
  bestiario: "☠",

  /**
   * O MAPA DE TESTE.
   *
   * E o `⌗` da prancheta: e um botao que nao abre painel nenhum, e sim
   * leva para um lugar e traz de volta. O glifo e o de "prancheta" porque
   * e o unico caractere de "apoio" na lista — os outros dez ou descrevem
   * o que o painel CONTE (`☠` criaturas, `⛁` coleção, `♛` rank) ou sao
   * acao dentro do mundo (`⇄` troca, `⚒` forja)
   */
  teste: "⌗",

  /**
   * A SAIDA DO VALE 1, que aparece quando o jogador ja esta la.
   *
   * ## POR QUE UM GLIFO E NAO UMA ARTE
   *
   * Porque e o que os outros botoes sem desenho usam, e o `⌗` da
   * prancheta ja e um glifo. Trocar so a arte deixaria o botao com imagem
   * quando ela carrega e com um caractere do teclado quando nao — dois
   * desenhos para o mesmo botao, e o jogador ve um mudando no meio da tela
   *
   * ## POR QUE `⇥` E NAO `←`
   *
   * A seta para a esquerda e o glifo do BESTIARIO — `⇄` e troca. Uma seta
   * que o jogador ja ve em outro botao, invertida, e ambigua: ele nao sabe
   * se volta ou se troca. O `⇥` e TAB, e nao existe em nenhum outro botao
   * da prateleira
   *
   * E o `⇥` e tabulacao, que e o que o botao faz na prateleira de icones:
   * tira o foco de um e leva ao outro
   */
  sair: "⇥",

  /**
   * A ARENA DO CHEFE.
   *
   * E o `☠` do bestiario de proposito: os dois botoes sao sobre criaturas
   * e luta, e a arena e ONDE a luta acontece. Um glifo proprio
   * acrescentaria um nono desenho que o jogador precisa aprender sem
   * dizer nada novo
   *
   * O botao e o mesmo nas duas direcoes e muda so o texto e a cor — o
   * glifo e um so, e ver o mesmo icone virar "sair" e o que comunica que
   * e a mesma porta
   */
  arena: "☠",

  /**
   * O CHEFE, com `⚔` e nao com o `☠` do bestiario.
   *
   * O `hudIcons.test.js` exige glifo UNICO por icone, e o `☠` ja e do
   * bestiario — e da arena, que nao esta na lista. As duas entradas da barra
   * apontariam para o mesmo desenho de reserva, e a reserva e justamente o
   * que aparece quando a arte falha: duas imagens iguais significando coisas
   * diferentes e o pior estado em que um botao pode estar
   *
   * As espadas cruzadas dizem a mesma coisa que a caveira — luta — sem
   * repetir o desenho de nenhum outro botao
   */
  boss: "⚔",

  market: "⇄",

  /**
   * A LOJA.
   *
   * ## POR QUE `⚿` E NAO UM SACO DE MOEDA
   *
   * Porque `⚿` e a chave da loja, e e o desenho que o jogador ja espera
   * onde tem coisa para comprar. Um emoji de sacinho ou de moedas seria
   * colorido e do tamanho errado, e a `⚿` e o que separa o preco do
   * loot
   *
   * ## POR QUE NAO O `⇄` DO MERCADO
   *
   * Porque os dois botoes estao vizinhos agora, e o `⇄` e de troca: duas
   * setas para lados opostos, que e o gesto de DAR e RECEBER entre
   * jogadores. A loja e o sentido contrario — o jogo VENDE, e nao ha
   * proposta nem contraproposta. Os dois botoes lado a lado com o mesmo
   * glifo seriam indistinguiveis na prateleira
   */
  loja: "⚿",

  // a colecao usava o `⛁`, o mesmo caractere do catalogo de itens
  collection: "⛁",

  craft: "⚒",

  /**
   * O ENCANTAR, que ate aqui nem glifo tinha.
   *
   * E o `✦`, a estrela de brilho, e nao o `⚒` da forja: os dois botoes sao
   * vizinhos, `craft` monta a peca e `encantar` e o que se faz depois que
   * ela esta montada. O martelo e a bigorna sao a oficina; a estrela e o
   * efeito que a peca recebe
   *
   * Sao tres verbos da oficina em botao, e cada um precisa de uma leitura
   * propria antes mesmo de a arte entrar
   */
  encantar: "✦",

  /**
   * A ARVORE DE HABILIDADE, que ate aqui so tinha a tecla H.
   *
   * ## POR QUE SO O GLIFO
   *
   * Porque nao ha arte de arvore em `assets/icons`. O `HudIcon` cai no
   * glifo quando `hudIconUrl` devolve `null`, entao o botao funciona hoje e
   * passa a usar imagem no dia que o desenho existir — sem trocar uma linha
   * no `HUD.jsx`
   *
   * E o `HUD_ICON_IDS` fica sem ele de proposito: aquela lista e o que o
   * `hudIcons.test.js` percorre lendo arquivo do disco, e um id la sem PNG
   * faz o teste falhar. O `encantar` esta no mesmo caso
   *
   * ## POR QUE `⑂`
   *
   * Porque e o unico glifo da lista que desenha um GALHO, e a arvore de
   * talento e a unica coisa do jogo que ramifica. Os outros descrevem o
   * que o painel CONTE ou o que ele FAZ, e nenhum dos dois serve aqui
   */
  arvore: "⑂",

  rank: "♛",

  /**
   * A GUILDA.
   *
   * O escudo e o glifo de reserva, e a leitura e de "grupo protegido
   * que voce entra". Um emoji de gente sugeriria lista de amigos, que
   * nao e o que o painel faz: lao dentro tem arvore de talento e cofre
   */
  guild: "⛊",
  settings: "⚙",

  /**
   * O PASSE.
   *
   * ## POR QUE `❖` E NAO UM EMOJI DE INGRESSO
   *
   * `🎫` seria a leitura certa e a escolha errada: e um emoji, e os outros
   * treze botoes da prateleira nao tem nenhum. Um botao que vira imagem
   * colorida do nada entre treze circulos com glifo de texto parece outro
   * sistema, e o jogador nao sabe se e botao ou efeito
   *
   * O `❖` e o glifo de "recompensa que nao e do mundo": os botoes que
   * descrevem o mundo usam coisa do mundo (`☠` criatura, `⛁` colecao,
   * `♛` rank) e os que sao acao usam verbo (`⇄` troca, `⚒` forja). Passe
   * nao e criatura nem e acao, e o losango preenchido e o unico desenho da
   * lista que diz "premiado" sem dizer o que
   */
  passe: "❖",

  /**
   * OS TRES ATRIBUTOS DO RODAPE.
   *
   * Nao sao botoes: sao leitura. O glifo e o que aparece enquanto a arte
   * nao carregou, e o `HudIcon` cai nele sozinho quando o id nao tem PNG
   * — entao os tres funcionam hoje sem nenhum arquivo novo
   *
   * - ATK e uma espada: e o que o numero mede, o dano do golpe
   * - DEF e um escudo: o que o numero mede, o que segura
   * - VEL e uma seta para a direita: o que o numero mede, a velocidade
   *   de movimento. Nao e o glifo da seta que a arte usa (`left`/`right`),
   *   e o `»` de "para onde voce anda"
   */
  ataque: "⚔",
  defesa: "⛊",
  velocidade: "»",
};

/**
 * Id do icone -> nome do arquivo.
 *
 * ## QUATRO IDS NAO BATEM COM O NOME DO ARQUIVO
 *
 * `collection` segue o `PAINEL.COLECAO` do `HUD.jsx` e o arquivo e
 * `colecao.png`. `settings` vira `configuracao.png`, `guild` vira
 * `guilda.png` e `market` vira `market_palyers.png` — este ultimo com o
 * `palyers` trocado, que e o nome que o arquivo traz
 *
 * Sao dois dicionarios diferentes, e este mapa e o unico lugar onde eles
 * se encontram. O caminho continua escrito por extenso no `HUD_ICON_URL`
 * logo abaixo, porque e o Vite que so enxerga o `new URL` de caminho
 * literal. Este mapa nao monta caminho nenhum: ele existe para o teste
 * saber qual arquivo cada id deve estar apontando, e para o erro de nome
 * ficar visivel em vez de silencioso
 */
export const HUD_ICON_FILE = {
  stats: "stats",
  bestiario: "bestiario",
  market: "market_palyers",
  loja: "loja",
  craft: "craft",
  encantar: "encantar",
  collection: "colecao",
  rank: "rank",
  guild: "guilda",
  arvore: "arvore_de_habilidades",
  passe: "passe",
  settings: "configuracao",
  boss: "boss",
};

/**
 * As DOZE artes da barra, todas em `assets/icons/hud`.
 *
 * ## POR QUE A PASTA NOVA
 *
 * Porque as artes antigas viviam soltas em `assets/icons`, misturadas com
 * as que o jogo usa fora da barra — `left`, `right`, `auto`,
 * `metamask`. Doze PNGs de 30 a 80kb que so a barra consome tinham um
 * lugar proprio, e e para la que os botoes apontam agora
 *
 * ## POR QUE O CAMINHO ESTA POR EXTENSO, LINHA POR LINHA
 *
 * Porque e a regra do Vite: ele so empacota o arquivo quando o caminho do
 * `new URL` e um literal escrito no codigo. Um caminho montado com
 * template string nao e seguido, e o pacote sairia sem as doze artes — sem
 * erro nenhum, so o glifo de reserva aparecendo no lugar dos botoes
 */
const HUD_ICON_URL = {
  stats: new URL(
    "../assets/icons/hud/stats.png",
    import.meta.url,
  ).href,

  bestiario: new URL(
    "../assets/icons/hud/bestiario.png",
    import.meta.url,
  ).href,

  /**
   * O `market` e a LOJA sao botoes diferentes.
   *
   * `market` e a troca entre jogadores e `loja` e o estoque do jogo. Os
   * dois glifos ja eram distintos (`⇄` e `⚿`), e o id ja era `loja`, entao
   * cada arte foi para o seu botao e nao entrou um id novo
   */
  market: new URL(
    "../assets/icons/hud/market_palyers.png",
    import.meta.url,
  ).href,

  loja: new URL(
    "../assets/icons/hud/loja.png",
    import.meta.url,
  ).href,

  /**
   * O ENCANTAR e o CRAFT sao vizinhos e nao podem parecer iguais.
   *
   * `craft` monta a peca e `encantar` e o que se faz depois de montada. O
   * `⚒` e martelo e bigorna, que e a oficina; o `✦` e a estrela de brilho,
   * que e o efeito que a peca recebe
   *
   * Sao tres verbos da oficina em botao, e cada um precisa de uma leitura
   * propria antes mesmo de a arte entrar
   */
  encantar: new URL(
    "../assets/icons/hud/encantar.png",
    import.meta.url,
  ).href,

  craft: new URL(
    "../assets/icons/hud/craft.png",
    import.meta.url,
  ).href,

  collection: new URL(
    "../assets/icons/hud/colecao.png",
    import.meta.url,
  ).href,

  rank: new URL(
    "../assets/icons/hud/rank.png",
    import.meta.url,
  ).href,

  guild: new URL(
    "../assets/icons/hud/guilda.png",
    import.meta.url,
  ).href,

  /**
   * A ARVORE DE HABILIDADE, que ate o botao novo so tinha o glifo `⑂`.
   *
   * O glifo continua no `HUD_ICON_GLYPH` como reserva: e ele que aparece
   * se a imagem nao carregar, e e o que o `hudIcons.test.js` exige de
   * todo id da lista
   */
  arvore: new URL(
    "../assets/icons/hud/arvore_de_habilidades.png",
    import.meta.url,
  ).href,

  passe: new URL(
    "../assets/icons/hud/passe.png",
    import.meta.url,
  ).href,

  // o nome do arquivo nao segue o id, e o `HUD_ICON_FILE` e quem declara
  // isso: o id e o que o botao pede, e o arquivo e o que a arte se chama
  settings: new URL(
    "../assets/icons/hud/configuracao.png",
    import.meta.url,
  ).href,

  /**
   * O CHEFE. O id segue o arquivo, que nao foi exceção nenhuma aqui.
   *
   * O glifo de reserva e o `☠`, o mesmo do bestiario de proposito: os dois
   * botoes sao sobre criatura de combate, e um sinal de caveira na barra
   * concorda com a arte dos dois
   */
  boss: new URL("../assets/icons/hud/boss.png", import.meta.url).href,
};

/**
 * A URL do icone, ou `null`.
 *
 * `null` quando o nome nao existe no mapa, e e o que o `HudIcon`
 * le para cair no glifo. Um id de painel escrito errado no botao e o
 * que o teste deste modulo pega: sem este `null`, a imagem sairia com
 * `src="undefined"`
 */
export function hudIconUrl(iconId) {
  return HUD_ICON_URL[iconId] ?? null;
}

/** O glifo de reserva do icone, ou `null` */
export function hudIconGlyph(iconId) {
  return HUD_ICON_GLYPH[iconId] ?? null;
}

/** Existe arte desenhada para este icone? */
export function hasHudIcon(iconId) {
  return Object.hasOwn(HUD_ICON_URL, iconId);
}

export { HUD_ICON_URL };