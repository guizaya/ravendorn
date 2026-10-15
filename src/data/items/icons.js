/**
 * Os icones desenhados de item, por raridade.
 *
 * O catalogo de itens tem um `icon` que e um GLIFO de texto (um
 * emoji), e ele nao muda com a raridade: o arco de galho e o mesmo
 * `🏹` nas cinco. Quando a arte entra, o icone passa a ser uma
 * imagem, e a imagem depende da raridade: um arco lendario nao e o
 * arco comum com outra cor, e um arco outro.
 *
 * Este modulo tem as duas pontas:
 *
 * 1. O mapa de raridade para o nome do ARQUIVO. O id de raridade do
 *    jogo e em ingles (`common`, `uncommon`), e o nome do arquivo na
 *    pasta de arte e em portugues (`comum.png`, `incomun.png`).
 *    Sao dois dicionarios diferentes, e o mapa e o unico lugar onde
 *    eles se encontram. Um `typo` aqui nao quebra nada em tempo de
 *    execucao: o `new URL` de um arquivo que nao existe vira uma
 *    URL que da 404 no navegador, e o item aparece sem imagem. Por
 *    isso o teste deste modulo confere os cinco arquivos em disco
 *
 * 2. O item que tem arte, ligado aos cinco arquivos. O id do arco e
 *    `willow_bow` e a pasta se chama `arco_de_galho`, que e o nome de
 *    exibicao em portugues; o resto do projeto nomeia as pastas com o
 *    id (`zumbi_arbalist`, `ogre_da_predeira`), e o item e a excecao
 *
 * `new URL(..., import.meta.url)` e o mesmo motivo de `./sprites/`:
 * o motor tambem roda no servidor Node, e um `import url from
 * "comum.png"` derrubaria o processo com ERR_UNKNOWN_FILE_EXTENSION.
 * O Node resolve isto para uma string sem abrir o arquivo, e o Vite
 * ainda reescreve para o asset empacotado
 */
import { RARITY } from "./index.js";

/**
 * Raridade do jogo -> nome do arquivo de arte.
 *
 * As tres ultimas batem com o id. As duas primeiras nao batem, e
 * sao a razao deste mapa existir
 */
export const RARITY_ICON_FILE = {
  [RARITY.COMMON]: "comum",
  [RARITY.UNCOMMON]: "incomun",
  [RARITY.RARE]: "rare",
  [RARITY.EPIC]: "epic",
  [RARITY.LEGENDARY]: "legendary",
};

/**
 * A LISTA DE ITENS COM ARTE POR RARIDADE, E ELA ESTA VAZIA.
 *
 * ## POR QUE
 *
 * O arco era o unico, e ele tambem virou arte unica: a pasta
 * `Items/arco_de_galho/` tem cinco PNGs, um por raridade, e o arquivo novo e
 * um so em `Items/drops/arqueiro_armadura_1/arco_de_galho.png`
 *
 * E e a MESMA troca que as seis pecas de armadura fizeram antes: a cor da
 * raridade ja e pintada no fundo do slot, e a arte repetindo isso em cinco
 * arquivos cuspia o mesmo que o fundo ja diz. O arco saiu do mesmo jeito
 *
 * A lista continua declarada, e vazia, em vez de sumir: `ITEM_ICON_ASSET`
 * depende dela, e um item novo com arte por raridade tem que entrar aqui de
 * proposito — que e o que a lista documenta
 */
export const ICON_ITEM_IDS = [];


/**
 * Item -> arte por raridade.
 *
 * VAZIO. O arco era o unico item aqui e virou arte unica — ver o
 * `ICON_ITEM_IDS`. Com a lista vazia este objeto tambem fica vazio, e
 * `itemIconUrl` cai no `ITEM_ICON_SIMPLES` para todo mundo
 */
export const ITEM_ICON_ASSET = {};

/**
 * Os itens que tem UMA arte so, igual em qualquer raridade.
 *
 * ## POR QUE ESTE MAPA E SEPARADO DO DE CIMA
 *
 * O `ITEM_ICON_ASSET` guarda um objeto com as CINCO raridades por item, e
 * o `ICON_ITEM_IDS` trava a lista de quem entra la. Um item de arte unica
 * nao cabe nesse formato: ele nao tem cinco arquivos, tem um
 *
 * Entrar no `ITEM_ICON_ASSET` forcaria duplicar o mesmo PNG cinco vezes —
 * e o arquivo do livro de habilidade pesa 1,7MB, entao isso custaria
 * 8,7MB de bundle para cinco copias da mesma imagem
 *
 * E o teste deste modulo exige, para todo item do `ICON_ITEM_IDS`, que as
 * cinco artes sejam DIFERENTES entre si. Uma arte unica falha nisso por
 * definicao: as cinco raridades cairiam no mesmo arquivo
 *
 * A diferenca entre os dois mapas e o dado, nao uma conveniencia. Um arco
 * lendario NAO e o arco comum com outra cor — sao dois desenhos. Um livro
 * de habilidade ensina a mesma coisa com a mesma capa, e ser raro nao o
 * torna um livro diferente. Guardar os dois no mesmo mapa obrigaria um dos
 * dois grupos a mentir sobre a sua propria arte
 *
 * O caminho e um `new URL` com o LITERAL inteiro, pelo mesmo motivo dos
 * outros cinco deste arquivo: o Vite so enxerga o arquivo no build quando
 * o caminho esta escrito por extenso
 *
 * A diferenca de posicao tambem e real, e nao esquecimento: as outras artes
 * estao em pasta (`pocao_cura/rare.png`), porque tem cinco arquivos para
 * organizar. Um arquivo solto nao precisa de pasta
 */
/**
 * A POCAO DE CURA e o PERGAMINHO SAIRAM DESTE MAPA.
 *
 * As duas artes que moravam aqui eram cinco arquivos por item, uma por
 * raridade. Os arquivos do disco NAO existem mais: a pasta
 * `assets/Items/pocao_cura/` tem hoje `pequena.png`, `media.png`,
 * `grande.png` e `teleporte.png`, e nenhum `comum.png`.
 *
 * Deixar as cinco URLs no ar nao dava erro nenhum em tempo de execucao —
 * o `new URL` de um arquivo ausente vira uma URL que da 404 no navegador
 * e o `<img>` aparecia quebrado. Pior, era a RACHA por raridade que o
 * item inteiro usava: com uma arte so, as cinco entradas apontam para o
 * mesmo lugar e o mapa volta a ser um mapa sem informacao
 *
 * Os quatro itens estao no `ITEM_ICON_SIMPLES`, cada um com a sua arte
 */
export const ITEM_ICON_SIMPLES = {
  livro_quick_shot: new URL(
    "../../assets/Items/book.png",
    import.meta.url,
  ).href,

  /**
   * As tres pocoes e o pergaminho.
   *
   * Sao quatro itens, UM arquivo cada, e o nome do arquivo e o que
   * diferencia: `pequena`, `media`, `grande`, `teleporte`. O eixo
   * aqui e o TAMANHO e a funcao, nao a raridade
   *
   * E por isso que a pocao de cura deixa de ter cinco artes. A arte
   * antiga mudava de desenho conforme a raridade, e o desenho era
   * exatamente o que separava uma pocao pequena de uma grande — as duas
   * cores eram o frasco e o liquido, e nao a raridade do objeto
   */
/**
     * AS SEIS PECAS DO ARBALIST, UMA ARTE CADA.
     *
     * ## O QUE MUDOU
     *
     * Estas pecas tinham cinco PNGs cada — uma por raridade, com couro de cor
     * diferente. Isso significava 30 arquivos para seis pecas, e a separacao
     * nao estava mais na arte: estava na COR DO FUNDO DO SLOT, que o jogo
     * ja pinta com a raridade. As duas coisas diziam a mesma coisa, e a arte
     * estava fazendo um trabalho que o fundo faz de graça
     *
     * ## POR QUE FICOU EM `ITEM_ICON_SIMPLES` E NAO EM `ITEM_ICON_ASSET`
     *
     * Porque `ITEM_ICON_ASSET` guarda CINCO arquivos por item, indexados por
     * raridade, e `itemIconUrl` pergunta `arte[file]` — com `file` vindo de
     * `RARITY_ICON_FILE[rarity]`. Um item de arte unica nao tem esse mapa:
     * ele responde igual para qualquer raridade, e para isso existe o caminho
     * do meio, que e exatamente o que estas pecas agora usam
     *
     * ## POR QUE O NOME DO ARQUIVO NAO SEGUE O ID DO ITEM
     *
     * A pasta e `arqueiro_armadura_1` e os arquivos usam o nome em portugues
     * (`peito_arqueiro_1`), enquanto o id do item e `peito_arbalist`. O resto
     * do projeto nomeia pastas com o id; estas nao, porque os arquivos
     * vieram prontos do gerador com o nome de quem os produziu
     */
    aljava_arbalist: new URL(
      "../../assets/Items/arqueiro_armadura_1/alijava_arqueiro_1.png",
      import.meta.url,
    ).href,
    botas_arbalist: new URL(
      "../../assets/Items/arqueiro_armadura_1/botas_arqueiro_1.png",
      import.meta.url,
    ).href,
    calca_arbalist: new URL(
      "../../assets/Items/arqueiro_armadura_1/calcas_arqueiro_1.png",
      import.meta.url,
    ).href,
    capuz_arbalist: new URL(
      "../../assets/Items/arqueiro_armadura_1/capzu_arqueiro_1.png",
      import.meta.url,
    ).href,
    luvas_arbalist: new URL(
      "../../assets/Items/arqueiro_armadura_1/luvas_arqueiro_1.png",
      import.meta.url,
    ).href,
    peito_arbalist: new URL(
      "../../assets/Items/arqueiro_armadura_1/peito_arqueiro_1.png",
      import.meta.url,
    ).href,

    /**
     * A ESPADA E O ESCUDO DO GUERREIRO.
     *
     * Sao os dois arquivos que faltavam da pasta `warrior_armadura_1`, e eles
     * entram aqui pelo mesmo caminho das seis pecas: uma arte so, e a cor da
     * raridade e o fundo do slot
     *
     * Os nomes sao os do arquivo (`arma.png`, `arma_secundaria.png`) porque
     * eles descrevem o PAPEL da peca na pasta, e nao o item. O `id` do item e
     * que diz o que a peca e
     */
    espada_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/arma.png",
      import.meta.url,
    ).href,
    escudo_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/arma_secundaria.png",
      import.meta.url,
    ).href,

    /**
     * AS SEIS PECAS DE ARMADURA DO GUERREIRO, a pasta `warrior_armadura_1`.
     *
     * ## O MESMO TRATAMENTO DA DO ARBALIST, E PELO MESMO MOTIVO
     *
     * Uma arte so para as cinco raridades: a cor da raridade e o fundo do
     * slot, e o desenho do item e o mesmo
     *
     * ## E POR QUE O `capacete.png` VIRA `elmo_warrior`
     *
     * Porque o id do item e `elmo_warrior` e o arquivo e `capacete.png`, e os
     * dois nomes vem de geradores diferentes. O projeto aceita essa excecao
     * quando ela ja existe, e nao vale renomear arte pronta para casar com
     * codigo
     */
    botas_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/botas.png",
      import.meta.url,
    ).href,
    calca_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/calca.png",
      import.meta.url,
    ).href,
    elmo_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/capacete.png",
      import.meta.url,
    ).href,
    luvas_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/luvas.png",
      import.meta.url,
    ).href,
    peito_warrior: new URL(
      "../../assets/Items/warrior_armadura_1/peito.png",
      import.meta.url,
    ).href,

    /**
     * AS SETE PECAS DO SORCERER, a pasta `sorcerer_armadura_1`.
     *
     * ## MESMO TRATAMENTO DAS DO GUERREIRO, E MESMO MOTIVO
     *
     * Uma arte so para as cinco raridades. O `capacete.png` do Guerreiro
     * virou `elmo_warrior` porque os dois nomes vinham de geradores
     * diferentes; aqui `capuz.png` casa com `capuz_sorcerer` e nao houve
     * nem que traduzir
     *
     * As duas armas mantem o nome do PAPEL que o arquivo tem: `arma.png` e o
     * cajado, `arma_secundaria.png` e o livro. O `id` do item e que diz o que
     * a peca e
     */
    botas_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/botas.png",
      import.meta.url,
    ).href,
    calca_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/calca.png",
      import.meta.url,
    ).href,
    capuz_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/capuz.png",
      import.meta.url,
    ).href,
    luvas_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/luvas.png",
      import.meta.url,
    ).href,
    peito_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/peito.png",
      import.meta.url,
    ).href,
    cajado_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/arma.png",
      import.meta.url,
    ).href,
    livro_habilidade_sorcerer: new URL(
      "../../assets/Items/sorcerer_armadura_1/arma_secundaria.png",
      import.meta.url,
    ).href,

    /**
     * O ARCO, e ele saiu dos cinco arquivos de raridade.
     *
     * O `drops/arqueiro_armadura_1/` tem o arco junto com as seis pecas de
     * armadura, e todas as sete agora tem UM arquivo so. O arco e a ultima
     * peca do arbalist a passar por essa troca, e pelo mesmo motivo das
     * outras: a cor da raridade e o fundo do slot
     *
     * E o `id` continua `willow_bow` enquanto o arquivo se chama
     * `arco_de_galho`, a mesma excecao de nome que ele sempre teve
     */
    willow_bow: new URL(
      "../../assets/Items/drops/arqueiro_armadura_1/arco_de_galho.png",
      import.meta.url,
    ).href,

    /**
     * OS DOIS ACESSORIOS, com o nome dos arquivos NOVOS.
     *
     * Antes eles saiam de `drops/otimizado/`, por `ARQUIVO_DA_FAMILIA`:
     * `anel.png` e `amuleto_arqueiro.png`. Os arquivos novos tem outro nome —
     * `anel_1.png` e `amuleto_do_arqueiro.png` — e e para eles que o item
     * aponta agora
     *
     * ## POR QUE SAIRAM DO `ARQUIVO_DA_FAMILIA`
     *
     * Porque aquele mapa resolve para `drops/otimizado/` E acrescenta o sufixo
     * de grau do material. Os dois acessorios nao tem grau: sao resultado de
     * craft, e um anel comum e um anel lendario sao o mesmo anel
     *
     * Manter os dois nos dois lugares faria o antigo continuar respondendo
     * primeiro, e o item mostraria a arte velha sem nenhum erro
     */
    anel: new URL(
      "../../assets/Items/drops/anel_1.png",
      import.meta.url,
    ).href,
    amuleto_arqueiro: new URL(
      "../../assets/Items/drops/amuleto_do_arqueiro.png",
      import.meta.url,
    ).href,

    pocao_cura: new URL(
      "../../assets/Items/pocao_cura/pequena.png",
      import.meta.url,
    ).href,

  pocao_media: new URL(
    "../../assets/Items/pocao_cura/media.png",
    import.meta.url,
  ).href,

  pocao_grande: new URL(
    "../../assets/Items/pocao_cura/grande.png",
    import.meta.url,
  ).href,

  pergaminho_teleporte: new URL(
    "../../assets/Items/pocao_cura/teleporte.png",
    import.meta.url,
  ).href,
};

/**
 * AS ARTE DOS MATERIAIS DE DROP, e os dois acessorios.
 *
 * Sao 14 arquivos em `assets/Items/drops`, um por familia de material —
 * e nao um por grau. Os 55 itens de material do catalogo seDividem em 11
 * familias de cinco, e as cinco pecas de uma familia NAO tem desenho
 * diferente: e o mesmo osso, o mesmo couro, so que mais bem tratado
 *
 * ## POR QUE O MAPA VAI PELO ID DA BASE E NAO PELO ID DO ITEM
 *
 * Porque o `ItemIcon` pede a arte pelo `itemId` da pilha, e a pilha de
 * um "Osso Quebrado Reforcado" tem `itemId: "osso_quebrado_reforcado"`.
 * Sem um registro por item, esses ids cairiam no glifo de reserva e o
 * jogador veria um losango no lugar do osso
 *
 * E por isso que os graus nao aparecem aqui: o `itemIconUrl` recebe o id
 * com o sufixo e este mapa o recognizes pelo prefixo — ver o
 * `ARTE_POR_FAMILIA` e o `arteDoMaterial` la embaixo
 */

/**
 * O ARQUIVO de cada familia, pelo id do material BASE.
 *
 * ## POR QUE O CAMINHO E `drops/otimizado/`
 *
 * Porque as arte originais tem ate 9600x9600 pixels e pesam 22 MB cada.
 * Uma so dessas no pacote e mais do que o jogo inteiro, e o jogador esperava
 * um segundo na aba de craft com a tela em branco enquanto os 122 MB
 * baixavam
 *
 * A pasta `otimizado` tem as mesmas artes em 256px, que e 3,7x o slot de
 * inventario do jogo (68px) e sobra mesmo em tela de alta densidade. Sao
 * 973 KB no total contra 122 MB
 *
 * ## POR QUE A PASTA SEPARADA E NAO SUBSTITUIR NO LUGAR
 *
 * Porque o original e a fonte. Se a arte precisa de um ajuste de tamanho
 * no futuro, o redimensionamento e um passo de novo sobre o original — e um
 * PNG reescalado duas vezes perde qualidade. O jogo so empacota o que esta
 * em `otimizado`; o resto fica no disco como materia prima
 */
const ARQUIVO_DA_FAMILIA = {
  osso_quebrado: "osso_quebrado.png",
  tendao_ressecado: "tendao_ressecado.png",
  essencia_necrotica: "essencia_necrotica.png",
  couro_goblin: "couro_goblin.png",
  minerio_bruto: "minerio_bruto.png",
  pedra_verde_bruta: "pedra_verde_final.png",
  fragmento_de_ferro: "fragmento_de_ferro.png",
  couro_reforcado: "couro_reforcado.png",
  fragmento_de_aco: "fragmento_de_aco.png",
  madeira_de_lanca: "madeira_de_lanca.png",
  tecido_militar: "tecido_militar.png",
aco_temperado: "aco_temperado.png",
};

/*
 * O ANEL E O AMULETO SAIRAM DESTE MAPA.
 *
 * Eles apontam agora para os arquivos novos em `ITEM_ICON_SIMPLES`:
 * `drops/anel_1.png` e `drops/amuleto_do_arqueiro.png`. Aqui eles pediam
 * `drops/otimizado/anel.png` e `amuleto_arqueiro.png`, que e a arte antiga
 *
 * Este mapa e das FAMILIAS DE MATERIAL, e os dois sao resultado de craft e
 * nao ingrediente: nao tem grau, e por isso nao tem por que estar aqui
 */

/**
 * As MESMAS 14 familias, com a URL pronta.
 *
 * E um `new URL` por linha, escrito por extenso, pelo mesmo motivo do
 * resto deste arquivo: e o Vite so enxerga o arquivo no build quando o
 * caminho esta escrito por extenso no codigo
 */
const ARTE_POR_FAMILIA = Object.fromEntries(
  Object.entries(ARQUIVO_DA_FAMILIA).map(([id, arquivo]) => [
    id,
    new URL(
      `../../assets/Items/drops/otimizado/${arquivo}`,
      import.meta.url,
    ).href,
  ]),
);

/**
 * Os SUFIXOS de grau, escritos aqui de novo em vez de importados.
 *
 * A fonte e `DEGRAUS`, em `data/materiais`, e ela nao e importada de
 * proposito: `data/materiais` le o `RARITY` de `data/items`, e o catalogo
 * de itens le ESTE arquivo. Importar daqui criaria o ciclo
 * `icons -> materiais -> items -> icons`, e quem paga com ele e o Vite no
 * build
 *
 * Sao quatro palavras soltas e um comentario apontando de onde veio. Um
 * ciclo de import e um bug que so aparece em producao
 */
const SUFIXOS_DE_GRAU = [
  "reforcado",
  "resistente",
  "refinado",
  "lendario",
];

/**
 * A arte de um MATERIAL, pelo id do item — base ou grau.
 *
 * ## POR QUE O CORTE E PELO SUFIXO E NAO PELAS DUAS PRIMEIRAS PALAVRAS
 *
 * Porque o nome do material tem uma ou duas palavras: `osso_quebrado` e
 * `couro_goblin` separam em dois, mas `pedra_verde_bruta`,
 * `fragmento_de_ferro` e `madeira_de_lanca` tem tres. Cortar as duas
 * primeiras palavras daria `pedra_verde` e `fragmento_de`, que nao estao
 * em nenhum mapa, e esses quatro itens cairiam no glifo de reserva
 *
 * O sufixo de grau, esse sim, e sempre o ULTIMO e sempre um destes
 * quatro. Entao o corte e exato: tira-se o sufixo e sobra o id da base,
 * que existe no mapa por construcao
 *
 * A ordem importa: o mapa e consultado do id mais especifico para o mais
 * generico, porque `couro_reforcado` e ao mesmo tempo uma familia E o
 * sufixo de `couro_goblin_reforcado` — e o nome exato tem que ganhar
 */
export function arteDoMaterial(itemId) {
  if (!itemId) return null;

  // o id exato primeiro: as familias que tem sufixo no nome
  if (ARTE_POR_FAMILIA[itemId]) return ARTE_POR_FAMILIA[itemId];

  for (const sufixo of SUFIXOS_DE_GRAU) {
    const termina = `_${sufixo}`;

    if (!itemId.endsWith(termina)) continue;

    const base = itemId.slice(0, -termina.length);

    if (ARTE_POR_FAMILIA[base]) return ARTE_POR_FAMILIA[base];
  }

  return null;
}

/** O item tem arte desenhada? */
export function hasItemIcon(itemId) {
  return Boolean(
    ITEM_ICON_ASSET[itemId] ??
      ITEM_ICON_SIMPLES[itemId] ??
      arteDoMaterial(itemId),
  );
}

/**
 * O caminho da imagem do item NAQUELA raridade, ou `null`.
 *
 * Devolve `null` em tres casos, e nos tres o certo e o chamador
 * desenhar o glifo do catalogo: item sem arte, raridade fora das
 * cinco, ou item que nem existe. Devolver `null` em vez de uma URL
 * quebrada importa porque a pasta de arte e opcional por item: um
 * item novo entra no jogo sem nenhum arquivo, e o icone dele tem de
 * continuar funcionando
 *
 * ## A ORDEM DAS DUAS FONTES
 *
 * Primeiro o `ITEM_ICON_ASSET`, que e por raridade; depois o
 * `ITEM_ICON_SIMPLES`, que nao liga para raridade nenhuma
 *
 * A ordem importa por causa do `null` do primeiro: se um item estivesse
 * nos dois mapas, o de arte unica cairia no `return null` do caminho por
 * raridade e nunca chegaria no segundo. Hoje os mapas sao disjuntos, e o
 * teste deste modulo roda sobre o `ICON_ITEM_IDS`, entao ninguem consegue
 * colocar um item nos dois sem que o `Object.keys` dele apareca na
 * conferencia
 */
export function itemIconUrl(itemId, rarity = null) {
  const arte = ITEM_ICON_ASSET[itemId];

  /**
   * A arte de MATERIAL e a ultima das tres fontes, e nao a segunda.
   *
   * A ordem e por especificidade e nao por importance: um item de
   * material nao esta em nenhum dos dois mapas acima, entao chegar aqui
   * significa que ele e das familias novas. Se a ordem fosse invertida, o
   * `return null` do caminho por raridade engoliria o material que tem
   * arte — e o icone viraria o glifo de reserva sem erro nenhum na tela
   *
   * E `return` direto, sem cair no `RARITY_ICON_FILE`: um material tem UM
   * arquivo para as cinco raridades, e perguntar o arquivo da raridade
   * devolveria `null` para quatro delas
   */
  const material = arteDoMaterial(itemId);

  if (material) return material;

  // arte unica: a mesma para qualquer raridade, e tambem quando o
  // chamador nao manda nenhuma
  if (!arte) return ITEM_ICON_SIMPLES[itemId] ?? null;

  const file = RARITY_ICON_FILE[rarity];

  if (!file) return null;

  return arte[file] ?? null;
}
