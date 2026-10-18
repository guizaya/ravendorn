import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { inflateSync } from "node:zlib";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encodePng } from "./png.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * As folhas que a ferramenta monta.
 *
 * Cada uma tem o seu tamanho de celula: o arqueiro e o arqueiro
 * zumbi usam artes de origem com dimensoes diferentes, e um frame
 * quadrado de 64x64 nao cabe numa celula de 68x68 sem cortar o
 * personagem. Encolher as duas para o menor seria perder pixels da
 * arte nova, entao cada sheet declara o proprio tamanho.
 *
 * `idle` e `shootFallback` existem por causa do ogre da predeira, que
 * veio com uma arte menos completa que as outras duas: o golpe (o nome
 * da pasta no origem e `shoot`, mas nao ha arco nenhum) so veio em 5
 * das 8 direcoes, e o `idle.gif` chegou depois de a folha estar montada
 * — o `idle: false` abaixo e o que segurava a folha sem essa linha.
 * Ver `buildSheet`.
 */
export const SHEETS = {
  arbalist: {
    sourceDir: "src/assets/sprites/new_arbalist_2",
    output: "src/assets/sprites/arbalist-sheet.png",

    /**
     * A CELULA DE 84 PASSOU A SER DE 96.
     *
     * A arte do arquiro foi regerada maior: as 25 lanes de `walk`, `idle`,
     * `shoot` e `mining` medem 92x92. A ferramenta recusa uma lane MAIOR que
     * a celula em vez de cortar pixel da arte, entao uma celula de 84
     * parava a geracao
     *
     * E 96, e nao 92, porque a arte ENCOSTA na propria borda: o arco do
     * arqueiro chega na ultima linha da tela em quatro quadros — dois de
     * caminhada na diagonal e dois de tiro na diagonal. Com a celula do
     * mesmo tamanho da arte, o arco encosta em `maxY = 91` e a auditoria
     * recusa a folha, com o aviso de que a arte pode vazar para a celula
     * vizinha
     *
     * Dois pixels a mais dao a margem que o `centraliza` preenche com
     * transparente: a arte nao e redimensionada nem cortada, so ganha borda
     *
     * A folha antiga (756x1428) era de 84; a nova sai de 96
     */
    frameSize: 96,
    prefix: "ARBALIST",

    /**
     * A CAMINHADA ESTA EM `walk/`, e nao na raiz da pasta.
     *
     * Sem este `walkDir` a ferramenta procuraria `east.gif` na raiz de
     * `new_arbalist_2`, que so tem a subpasta `walk/`, e pararia com "falta
     * ./east.gif" — sem tocar em nenhum arquivo de arte
     */
    walkDir: "walk",

    /**
     * O idle AGORA E POR DIRECAO, e nao um gif unico.
     *
     * A pasta `idle/` do arquiro tem um gif para cada um dos oito angulos,
     * igual a `walk/`. Sem o `idleDir` a ferramenta procuraria `idle.gif` na
     * raiz — que nao existe nesta pasta — e a folha sairia sem linha de
     * parado, com o boneco congelado no primeiro quadro do walk
     *
     * ## E ISSO QUE MUDA O LAYOUT INTEIRO
     *
     * Idle de uma linha so usa `row` no layout; idle de oito linhas usa
     * `rowOffset`, porque cada angulo ocupa a sua. Sao dois jeitos diferentes
     * de apontar a mesma folha, e o arquiro passou do primeiro para o segundo
     */
    idleDir: "idle",

    /**
     * O tiro esta em `shoot/`, e nao em `attack/`.
     *
     * O guerreiro e o zombie atiram de `attack/`; o nome da pasta e do ciclo,
     * e cada folha declara o seu. Aqui o padrao `shoot` da ferramenta ja e o
     * nome certo, entao nao ha `shootDir` para declarar
     */
    shoot: true,

    /**
     * A MINERACAO, que e a unica arte que entra por um caminho novo.
     *
     * Ela vale uma linha so — veio do sul —, entao entra como `lane` unica
     * no fim da folha, lida pelo layout por `row` fixo
     */
    mining: true,
  },
  zumbi: {
    sourceDir: "src/assets/sprites/zumbi_arbalist",
    output: "src/assets/sprites/zumbi_arbalist-sheet.png",
    frameSize: 68,
    prefix: "ZUMBI",
  },

  /**
   * O GOBLIN DA PEDREIRA.
   *
   * ## A FOLHA SUBSTITUI O OGRE, E O ID CONTINUA SENDO `ogre`
   *
   * A criatura deste jogo que aparece nas cinco zonas da pedreira se
   * chama `goblin` na tela e tem id `ogre` no save. O id nao mudou
   * porque ele e a chave do bestiario, das missoes de cacada e dos
   * `mix` de zona: trocar o id apagaria o registro de abate de quem
   * ja matou o ogre
   *
   * ## TRES COISAS QUE SO ESTA FOLHA TEM
   *
   * A pasta `src/assets/sprites/goblin` e diferente de todas as outras
   * em tres pontos, e cada um precisou de uma opcao nova na
   * ferramenta:
   *
   * 1. **Celula de 84.** As lanes medem 84x84, e nao os 68 das folhas
   *    de bicho de pe. Ja e o que o arqueiro usa, entao o caminho
   *    esta feito
   *
   * 2. **Idle por direcao.** As outras folhas tem UM `idle.gif`, que
   *    vira uma linha so na folha e serve para as oito direcoes. Aqui
   *    o idle veio em `idle/`, com um gif por direcao, porque o goblin
   *    tem uma pose de parado diferente de cada angulo. Sao oito
   *    linhas, e nao uma — e o `rowOffset` do idle no layout
   *
   * 3. **Morte, so no sul.** `death/south.gif` veio e nada mais. A
   *    ferramenta recebe `deathDirection` para deixar isso explicito
   *    em vez de aceitar um sprite de frente em qualquer lado
   *
   * ## POR QUE A MORTE E UMA LINHA SO
   *
   * Sao 17 linhas de gameplay mais 1 de morte: 8 de caminhada, 8 de
   * idle e 8 de golpe, mais o sul. A folha fica com 25 linhas, e o
   * layout do goblin le a morte por `row`, nunca por `rowOffset` —
   * nao ha direcao de morte para somar
   */
  goblin: {
    sourceDir: "src/assets/sprites/goblin",
    output: "src/assets/sprites/goblin-sheet.png",
    frameSize: 84,
    prefix: "GOBLIN",

    /**
     * A CAMINHADA TAMBEM ESTA EM PASTA.
     *
     * Nas folhas antigas os oito gifs de caminhada ficam na raiz da
     * pasta de arte, e por isso a ferramenta os procura em `.`. Aqui
     * os tres ciclos estao cada um em sua pasta (`walk/`, `idle/`,
     * `attack/`, `death/`), que e a organizacao mais comum em pacote
     * de animacao
     */
    walkDir: "walk",

    /**
     * O idle esta em `idle/`, um gif por direcao.
     *
     * Sem este `idleDir`, a ferramenta iria procurar `idle.gif` na
     * raiz da pasta e pararia com "falta ./idle.gif", porque aqui nao
     * existe nenhum. Com ele, o idle vira oito lanes como a
     * caminhada
     */
    idleDir: "idle",

    // oito quadros por direcao, em todas as oito
    idle: true,

    // o golpe esta em `attack/`, e nao em `shoot/`, pelo mesmo nome
    // que o guerreiro usa: e o nome da arte de origem
    shootDir: "attack",
    shoot: true,

    /**
     * A MORTE VEM SO DO SUL.
     *
     * Declarado aqui para que a linha da folha exista e para que
     * quem ler o layout saiba que nao ha oito direcoes de morte. A
     * ferramenta usa este valor como nome de arquivo e como direcao
     * unica do bloco
     */
    deathDir: "death",
    death: true,
    deathDirection: "south",
  },
  ogre: {
    sourceDir: "src/assets/sprites/ogre_da_predeira",
    output:
      "src/assets/sprites/ogre_da_predeira-sheet.png",
    frameSize: 68,
    prefix: "OGRE_PREDEIRA",

    /**
     * O `idle.gif` EXISTE.
     *
     * A folha ficava sem idle ate a arte de parado chegar. Agora ela veio: a
     * folha sai com 8 linhas de caminhada, 1 de idle e 8 de golpe, e o
     * layout aponta o idle para a linha dele em vez de congelar um frame
     * da caminhada
     */
    idle: true,

    /**
     * Direcao que substitui cada lane de golpe ausente.
     *
     * A escolha e a vizinha mais proxima na ROSA DOS VENTOS, e nao a
     * primeira que apareceu na pasta. A ordem de `ROWS` e
     * circular, entao a distancia e circular tambem: `north` esta a
     * 2 passos de `east` e de `west`, e a 3 de `south-east`.
     *
     * `south` (o oposto) esta descartado de proposito: colar o lado
     * de frente no lugar do lado de costas faria o jogador ver a
     * CARA do ogre quando o ogre esta virado para away, que e o
     * caso mais comum num golpe.
     *
     * Declarar o mapa aqui, em vez de a ferramenta escolher, deixa a
     * troca visivel no codigo e no log: e uma decisao sobre a arte,
     * nao um detalhe de implementacao.
     */
    shootFallback: {
      north: "east",
      "north-east": "east",
      "north-west": "west",
    },
  },
  boneco: {
    sourceDir: "src/assets/sprites/boneco_de_madeira",
    output: "src/assets/sprites/boneco_de_madeira-sheet.png",
    frameSize: 68,
    prefix: "BONECO",

    // O boneco de treino so tem as OITO DIRECOES de caminhada.
    // Nem idle, nem golpe: e um boneco, ele nao ataca. A folha sai
    // com 8 linhas e nada mais, e o layout do inimigo declara
    // apenas `walk` e um `idle` de 1 frame congelado na linha da
    // direcao
    idle: false,
    shoot: false,
  },

  ghoul: {
    // A pasta de origem chama o ghoul de "guerreiro", e a saida
    // mantem o nome do INIMIGO (`ghoul_faminto`), que e quem o jogo
    // conhece. Um asset com o nome em portugues e o que ja acontece
    // com `ogre_da_predeira`
    sourceDir: "src/assets/sprites/guerreiro",
    output: "src/assets/sprites/ghoul_faminto-sheet.png",
    frameSize: 68,
    prefix: "GHOUL_FAMINTO",

    // Tem `idle.gif` e as oito direcoes, mas nao tem golpe. O
    // ghoul e corpo a corpo, entao o golpe dele esta no MESMO
    // arquivo da caminhada: nao existe arte de ataque separada
    idle: true,
    shoot: false,
  },

  warrior: {
    sourceDir: "src/assets/sprites/warrior",
    output: "src/assets/sprites/warrior-sheet.png",
    /**
     * A CELULA DE 96 PARA UMA ARTE DE 92.
     *
     * A arte nova mede ate 92x92 — o `attack/north` e o `mining` saem com 92, e
     * o `idle` e o `walk` com 88, e duas diagonais do idle com 84. Uma celula
     * de 92 faria a arte ENCOSTAR na propria borda, e a ferramenta recusa a
     * folha: sem 2px de folga o desenho pode vazar para a celula vizinha
     *
     * E 96 pelo mesmo motivo do arquiro, que tem a mesma arte de 92 numa
     * celula de 96. Os quatro pixels que sobram entram preenchidos de
     * transparente: a arte nao e redimensionada nem cortada
     */
    frameSize: 96,
    prefix: "WARRIOR",

    /**
     * A ARTE NOVA, COM AS QUATRO PASTAS.
     *
     * Antes o idle era um gif unico na raiz, chamado `indle.gif`, e o
     * `idleFile` declarava esse nome. Agora sao oito gifs em `idle/`, um por
     * angulo — a mesma forma que o arquiro e o sorcerer usam — entao o que
     * vale e o `idleDir`, e o `idleFile` sai
     *
     * E entra `mining: true`: o guerreiro ganhou a picareta, e sem a flag a
     * ferramenta nem procuraria a pasta e a folha sairia sem a linha do
     * ciclo
     */
    walkDir: "walk",
    idleDir: "idle",
    mining: true,

    /**
     * O golpe do guerreiro esta em `attack/`, e nao em `shoot/`.
     *
     * O nome do ciclo e dado pela arte de origem, e o padrao da
     * ferramenta (`shoot`) so vale para quem o respeita. Um corpo a
     * corpo como o guerreiro nao atira: o golpe dele e um `./target`,
     * e chamar a pasta de tiro faria o log mentir sobre o que a
     * folha contem
     */
    shootDir: "attack",
  },

sorcerer: {
      sourceDir: "src/assets/sprites/sorcerer",
      output: "src/assets/sprites/sorcerer-sheet.png",

      /**
       * A CELULA PASSOU DE 132 PARA 96.
       *
       * ## POR QUE BAIXOU
       *
       * A celula de 132 era a arte ANTERIOR do sorcerer, que saia em
       * 128x128 e 132x132. A arte nova e bem menor: `walk`, `idle` e
       * `attack` medem 88x88, e so o `mining` chega a 92x92
       *
       * Uma celula de 132 para uma arte de 88 nao quebra a geracao — a
       * ferramenta so recusa arte MAIOR que a celula — mas desperdiça 40%
       * da folha em transparente, e o `scale` do layout teria de compensar
       * uma margem que nao existe
       *
       * ## E POR QUE 96, E NAO 92
       *
       * Porque a ferramenta recusa arte que ENCOSTA na borda: sem folga, o
       * desenho pode vazar para a celula vizinha. O `mining` mede 92 exatos
       * nas sete direcoes, e uma celula de 92 o deixaria colado na parede
       *
       * E 96 pelo mesmo motivo do guerreiro e do arqueiro, que tem a mesma
       * arte de 92 numa celula de 96. Os 4px que sobram entram preenchidos
       * de transparente: a arte nao e redimensionada nem cortada
       *
       * ## E O QUE ISSO FAZ COM O TAMANHO NA TELA
       *
       * O tamanho na tela nao e a celula: e a celula vezes o `scale` do
       * layout. Como a celula caiu de 132 para 96, o `SORCERER_SCALE` em
       * `src/data/sprites/layout.js` foi reajustado na mesma medida — sem
       * isso o sorcerer apareceria com 1,37x do tamanho na tela
       */
      frameSize: 96,
      prefix: "SORCERER",

    /**
     * A CAMINHADA E O IDLE AGORA ESTAO EM PASTA, um gif por angulo.
     *
     * A pasta de origem veio organizada em `walk/`, `idle/` e `attack/`, como
     * a do arquiro. Antes o idle era um `idle.gif` solto na raiz, e a folha o
     * punha em UMA linha so, lida por `row`
     *
     * ## E ISSO QUE MUDA O LAYOUT INTEIRO
     *
     * Idle de uma linha so usa `row` no layout; idle de oito linhas usa
     * `rowOffset`, porque cada angulo ocupa a sua. Sao dois jeitos diferentes
     * de apontar a mesma folha, e quem escolhe o layout errado mostra o
     * sorcerer parado virado para o angulo errado
     */
    walkDir: "walk",
    idleDir: "idle",

    /**
     * O GOLPE PASSOU A EXISTIR, e ele esta em `attack/`.
     *
     * ## O QUE MUDOU
     *
     * Antes esta folha saia com `shoot: false` e o layout apontava o
     * `attack` para a linha de idle: o sorcerer ficava parado no golpe, sem
     * arte. Agora a pasta tem `attack/` com os oito angulos, e o golpe passa
     * a ter arte propria
     *
     * ## E POR QUE `shootDir`
     *
     * Porque `shoot/` e o nome padrao da ferramenta, e o do arqueiro. O
     * pacote do sorcerer chamou a pasta de `attack/` — igual ao guerreiro e ao
     * goblin —, e o nome do ciclo nao interfere em nada: o layout e o cliente
     * chamam isso de `attack`
     */
shootDir: "attack",
      shoot: true,

      /**
       * A MINERACAO ENTROU, E A FOLHA VAI DE 24 PARA 32 LINHAS.
       *
       * A pasta ganhou `mining/` com os oito angulos. Sem o `mining: true` a
       * ferramenta nem procuraria a pasta, e as oito linhas ficariam como
       * buraco no layout — o sorcerer apareceria parado ao minerar
       *
       * E o `mining`, e nao o `shoot`, porque o padrao da ferramenta e
       * `shoot` e ele ja foi declarado acima
       */
      mining: true,
    },

  lancer: {
    sourceDir: "src/assets/sprites/lancer",
    output: "src/assets/sprites/lancer-sheet.png",
    frameSize: 68,
    prefix: "LANCER",

    /**
     * O idle do lancer tem o mesmo nome trocado do guerreiro,
     * `indle.gif`. A pasta declara o nome real em vez de a arte ser
     * renomeada: os dois archivos sao do usuario, e o que a folha le
     * nao muda por causa do `d`
     */
    idleFile: "indle",

    /**
     * Sem golpe, como o sorcerer e o ghoul.
     *
     * O lancer e um bruiser de alcance e o golpe basico dele e um
     * `./target` em linha, mas a pasta de origem nao trouxe a arte
     * disso: nem em `shoot/`, nem em pasta propria. Sao oito direcoes
     * de caminhada e um idle, e nada mais
     *
     * Nao e preciso declarar `shootDir: "attack"` como no guerreiro:
     * ali a pasta existe e se chama `attack`, e o nome declara o que a
     * folha contem. Aqui nao ha pasta nenhuma, e `shoot: false` e o
     * que impede a ferramenta de procurar arquivos que nunca existiram
     */
    shoot: false,
  },

  /**
   * O RATO DA TOCA.
   *
   * A pasta de origem se chama `urso`, e o nome e da arte: e um urso
   * que o jogador mandou para o bicho da toca. O nome do jogo continua
   * sendo "Rato da Toca" e o `id` continua sendo `rat` — renomear a
   * criatura para o nome da arte mudaria o save de todo mundo que ja
   * matou um rato
   *
   * A mesma separacao do ghoul, que usa a pasta `guerreiro` e sai como
   * `ghoul_faminto-sheet.png`: a pasta guarda o nome da arte, e a
   * saida e o nome da CRIATURA, que e o que o `GameEngine` procura
   */
  rato_da_toca: {
    sourceDir: "src/assets/sprites/urso",
    output: "src/assets/sprites/rato_da_toca-sheet.png",
    frameSize: 68,
    prefix: "RATO_DA_TOCA",

    /**
     * Tem `idle` de verdade: as oito direcoes de caminhada mais um
     * `idle.gif` desenhado
     */
    idle: true,

    /**
     * Sem golpe, como o ghoul.
     *
     * O rato e PASSIVO, com `aggroRange: 0`: ele foge do jogador e
     * nao ataca. O `attackRange` e `damage` do catalogo existem para
     * a criatura ter os mesmos campos dos outros, e nao porque ele
     * golpeie — entao nao ha arte de ataque para montar
     *
     * Com o `shoot: false` o pedido de "attack" cai no reserva do
     * `resolveFrameRect`, que procura o `idle` antes do `walk`: um
     * pedido de golpe mostraria o parado, e nao o bicho andando no
     * meio de um golpe que ele nunca deu
     */
    shoot: false,

    /**
     * A CAMINHADA do `south` vem do `idle.gif`.
     *
     * A arte nao tem `south.gif`: sao sete direcoes de caminhada e o
     * `idle`, que e a arte de PARADO de frente. Copiar a vizinha mais
     * proxima em grau — o que o mapa faz por padrao, e o que o ogre
     * usa para as direcoes de golpe que faltam — poria o rato andando
     * na diagonal toda vez que ele andasse na direcao do jogador, e essa
     * e a direcao mais vista do jogo
     *
     * A arte parada mantem o RATO DE FRENTE, que e o sinal mais forte
     * de para onde ele esta indo. O que se perde e a pata mexendo: andando
     * para baixo o rato desliza em vez de caminhar. E um defeito
     * visivel, e a troca foi consciente — a diagonal seria visivel
     * tambem, e errada de um jeito pior
     *
     * Quando o `south.gif` chegar na pasta, e apagar esta linha: a
     * ferramenta passa a usar a arte de verdade e o log volta a dizer
     * que as oito direcoes vieram da arte
     */
    walkFallback: {
      south: "idle",
    },
  },

/**
 * A SENTINELA ESQUELETICA SAIU DAQUI.
 *
 * A criatura agora se chama Kaelen e a folha e montada pela entrada
 * `kaelen`, logo acima, a partir de `src/assets/sprites/espadas`. A pasta
 * `sentinela` e o `sentinela_esqueletica-sheet.png` sao a arte antiga: a
 * pasta nao e mais lida por nenhum layout e o PNG nao e mais importado
 * por nenhum registro
 *
 * Elas ficam no disco por enquanto. Apagar a arte antiga e uma operacao
 * de uma vez so, e o que decide e se vale a pena — o PNG antigo ocupa
 * 98KB e a pasta, 17 gifs
 */

  /**
   * O ESQUELETO — que ainda e a criatura `slime`.
   *
   * ## POR QUE O NOME DA SAIDA NAO E `limo`
   *
   * A criatura continua com o id `slime`, e o id e o que esta no save,
   * no bestiario, nas missoes e no `slime_gel`/`slime_core` que o craft
   * pede. O que mudou foi o NOME e a ARTE, e a saida usa os dois: o
   * arquivo se chama `esqueleto` porque ninguem vai procurar uma folha de
   * limo e encontrar um esqueleto
   *
   * A pasta se chama `new_skeleton` porque e o nome que veio na arte.
   *
   * ## O `id` NAO MUDOU, E ISSO E DELIBERADO
   *
   * Trocar o id para `esqueleto` arrastaria a colecao "Restos do Brejo",
   * as missoes de nivel, o loot e o indice do craft — e o `skeleton` ja e
   * de outra criatura, a Sentinela Esqueletica. O `id` e a identidade da
   * criatura no jogo, e uma troca de arte nao pode reescrever identidade
   */
  esqueleto: {
    sourceDir: "src/assets/sprites/new_skeleton",
    output: "src/assets/sprites/esqueleto-sheet.png",

    /**
     * 88 E NAO 68, que e o das outras folhas.
     *
     * A arte veio em celulas de 88x88 e o gerador recusa uma celula
     * maior em vez de cortar pixel sozinho. Diminuir para 68 cortaria a
     * arte, e quem decide o tamanho da celula e quem desenhou o boneco
     *
     * E a folha sai maior que as outras: 9 colunas de 88 (792px) contra 9
     * de 68 (612px). E o layout em `enemyLayout.js` que declara o
     * `frameWidth`/`frameHeight` correspondente
     */
    frameSize: 88,
    prefix: "ESQUELETO",

    // tem `idle` desenhado, com oito quadros
    idle: true,

    /**
     * O GOLPE, que e a novelty desta arte.
     *
     * A pasta se chama `attack/` e nao `shoot/`, porque o esqueleto bate
     * em vez de atirar — e o `shootDir` existe exatamente para o nome da
     * pasta poder ser outro sem mexer na ferramenta
     *
     * E o que o `limo_preguicoso` nao tinha: o limo era PASSIVO com
     * `aggroRange: 0` e nunca atacava, entao a linha de golpe ficava
     * reservada e o pedido caia no `idle`. Agora o esqueleto RETALIA quem
     * o bate, e a animacao de golpe e o que mostra isso acontecendo
     */
    shoot: true,
    shootDir: "attack",
  },

  /**
   * O GOBLIN SAQUEADOR.
   *
   * A pasta se chama `hulk`, e o nome e da arte. A criatura e o
   * `goblin`, que e o `id` do save e do bestiario; a saida usa o nome
   * de exibicao, "Goblin Saqueador", como o ghoul usa "Ghoul Faminto"
   *
   * A arte e limpa como a da sentinela e a do limo: oito direcoes,
   * `idle`, todas em 68x68, oito quadros, nenhum truncado
   */
  goblin_saqueador: {
    sourceDir: "src/assets/sprites/hulk",
    output: "src/assets/sprites/goblin_saqueador-sheet.png",
    frameSize: 68,
    prefix: "GOBLIN_SAQUEADOR",

    // tem `idle` desenhado, com oito quadros
    idle: true,

    /**
     * Sem golpe, e aqui a ausencia e DOVADA pelo catalogo.
     *
     * O goblin e `SEMI_PASSIVE` com `aggroRange: 0`: ele passeia e nao
     * persegue. O `attackRange: 52` e o `damage: 22` existem para a
     * criatura ter os mesmos campos dos outros, e nao porque ele
     * persiga o jogador — e o mesmo caso do ghoul faminto, que tambem
     * e semi-passivo e tambem nao tem arte de golpe
     *
     * Sem `attack` na definicao, um pedido de golpe cai no reserva do
     * `resolveFrameRect`, que prefere o `idle` a caminhada. E aqui o
     * salto de direcao e imperceptivel, ao contrario da sentinela: um
     * bicho que nao persegue quase nao entra na janela de golpe
     */
    shoot: false,
  },

  /**
   * O KAELEN, que era a Sentinela Esqueletica.
   *
   * ## A PASTA SE CHAMA `espadas`
   *
   * E o nome da arte de origem, como `hulk` era antes. A criatura e o
   * `skeleton`, que e o `id` do save, do bestiario e das missoes — e a
   * saida usa o nome de exibicao, "Kaelen"
   *
   * ## A CELULA E DE 88, E NAO DE 84
   *
   * Diferente do goblin, cujas lanes eram todas de 84 (e o `north` de 80,
   * centralizado). Aqui a arte veio misturada: os quatro angulos do norte
   * e o `south` saem em 88x88, e os outros quatro em 84x84. A celula tem
   * que ser a MAIOR, porque a ferramenta recusa uma lane maior que a
   * celula em vez de cortar pixel da arte — e cortar 4px de um angulo
   * cortaria o cabelo ou a ponta da lanca
   *
   * ## OS MESMOS TRES CICLOS DO GOBLIN
   *
   * Idle por direcao, golpe em `attack/` e morte so do sul. E a mesma
   * organizacao de pasta, entao os mesmos `walkDir`/`idleDir` valem
   */
  kaelen: {
    sourceDir: "src/assets/sprites/espadas",
    output: "src/assets/sprites/kaelen-sheet.png",
    frameSize: 88,
    prefix: "KAELEN",

    walkDir: "walk",
    idleDir: "idle",

    // o golpe esta em `attack/`, e nao em `shoot/`
    shootDir: "attack",
    shoot: true,

    deathDir: "death",
    death: true,
    deathDirection: "south",
  },

  /**
   * A NYLARA, que era o Arqueiro Zumbi.
   *
   * ## A CELULA E DE 88, E A ARTE NAO E TODA DE 84
   *
   * Oito dos gifs saem em 84x84, e DOIS — `west` e `north-west`, em
   * `walk`, `idle` e `attack` — saem em 88x88. A celula tem que ser a
   * MAIOR, porque a ferramenta recusa cortar pixel de arte, e cortar 4px
   * cortaria a ponta do arco
   *
   * E o mesmo motivo do Kaelen, que tambem veio misturado e tambem ficou
   * em 88
   *
   * ## A MORTE E UMA LINHA SO
   *
   * A pasta `death/` traz um `south.gif` apenas — nao sao oito angulos
   * como o walk, o idle e o golpe. E a folha e a mesma do goblin e do
   * Kaelen nesses tres blocos:
   *
   * ```
   *   0.. 7  walk   (8 direcoes, 8 quadros)
   *   8..15  idle   (8 direcoes, 8 quadros)
   *  16..23  attack (8 direcoes, 9 quadros)
   *      24  death  (so o sul,   9 quadros)
   * ```
   *
   * ## O GOLPE CONTINUA SENDO DE TIRO
   *
   * A Nylara e `ranged: true` e atira de longe, entao a arte do golpe e a
   * de disparo e o layout precisa de `needsTarget`: sem alvo de verdade
   * ela nao pode disparar. O Kaelen, que e corpo a corpo, tirou esse
   * `needsTarget`
   */
  nylara: {
    sourceDir: "src/assets/sprites/nida",
    output: "src/assets/sprites/nylara-sheet.png",
    frameSize: 88,
    prefix: "NYLARA",

    walkDir: "walk",
    idleDir: "idle",

    shootDir: "attack",
    shoot: true,

    deathDir: "death",
    death: true,
    deathDirection: "south",
  },

  /**
   * O HULK, O CHEFE DA ARENA.
   *
   * ## A MESMA PASTA DO GOBLIN
   *
   * `sourceDir` e `src/assets/sprites/hulk` — a MESMA arte que o Goblin
   * Saqueador usa. A pasta se chama `hulk` e nao `goblin` desde o
   * começo: e o nome que a arte teve, e o goblin passou a usar ela
   * depois
   *
   * Sao duas folhas de saida diferentes para um so par de gifs, e isso
   * e o que permite as DUAS criaturas existirem com stats e
   * comportamentos distintos mesmo tendo a mesma cara
   *
   * ## O GOLPE AGORA EXISTE
   *
   * A pasta `attack/` foi preenchida depois de a folha do goblin ser
   * montada pela primeira vez, e e por isso que o goblin esta com
   * `shoot: false` acima. O hulk NAO: ele ataca de verdade, e e um
   * AGGRESSIVO com `aggroRange` grande, entao a falta de animacao de
   * golpe seria visivel em todas as lutas
   *
   * Como a arte e a mesma, um pedido de golpe aqui mostra EXATAMENTE o
   * que o goblin mostra hoje: o parado. Sao duas criaturas com nomes,
   * numeros e comportamentos diferentes e a mesma arte — se isso for
   * um problema visual, a correcao e trocar a pasta de origem do hulk,
   * nao mexer nesta folha
   */
  hulk: {
    sourceDir: "src/assets/sprites/hulk",
    output: "src/assets/sprites/hulk-sheet.png",
    frameSize: 68,
    prefix: "HULK",

    // tem `idle` desenhado, com oito quadros
    idle: true,

    /**
     * ## POR QUE A MORTE FICA FORA DESTA FOLHA
     *
     * O goblin e o hulk sao a MESMA arte de origem (a pasta `hulk`),
     * e por isso os dois tem as mesmas 17 linhas. A pasta do goblin
     * ganhou uma pasta `death/` que a do hulk NAO tem, e essa e a
     * diferenca que impede as duas criaturas de continuar sendo uma
     * so folha
     *
     * Sem isto, `buildSheet` procuraria `death/south.gif` na pasta
     * `hulk` e pararia com "falta death/south.gif". A saida seria a
     * mesma folha de antes mais um erro, entao o ciclo e desligado
     * aqui explicitamente: o hulk continua morrendo como qualquer
     * outro inimigo, sumindo na hora
     */
    death: false,

    /**
     * O golpe esta em `attack/`, e nao em `shoot/`.
     *
     * E o mesmo nome que o guerreiro usa, e pela mesma razao: e corpo a
     * corpo e o nome da pasta e o da arte de origem, nao uma
     * descricao do que o golpe faz
     */
    shootDir: "attack",
    shoot: true,
  },

  /**
   * O CHEFE DO VALE, com arte propria em `boss_vale/`.
   *
   * ## POR QUE NAO E O `hulk` DE NOVO
   *
   * Porque `hulk_val` nao e o `hulk` da arena: e uma criatura com `typeId`
   * proprio, 15.000 de HP e raio de 96. Compartilhar a folha faria o chefe do
   * centro do vale sair com a arte do chefe da arena — que e o oposto de
   * "outra criatura"
   *
   * ## A CELULA E 168, E AS DUAS ARTES CHEGARAM DIFERENTES
   *
   * Sete direcoes medem 168x168 e `south` mede 164x164. A ferramenta CENTRALIZA
   * a arte menor na celula maior em vez de cortar pixel, entao o `south` fica
   * com 2px de margem de cada lado — o mesmo tratamento que o arquiro e o
   * guerreiro ja recebem. Nenhum pixel do desenho e perdido
   *
   * ## E O MESMO MOLDE DO `hulk`
   *
   * Mesma pasta `attack/`, mesma morte desligada. A diferenca de verdade e a
   * celula: 168 contra 68, que e o que faz este chefe ser grande sem que o
   * `scale` precise de numero grande
   */
  boss_vale: {
    sourceDir: "src/assets/sprites/boss_vale",
    output: "src/assets/sprites/boss_vale-sheet.png",
    frameSize: 168,
    prefix: "BOSS_VALE",

    idle: true,

    /**
     * O IDLE E POR DIRECAO, E VEM DA PASTA `idle/`.
     *
     * Sem `idleDir` a ferramenta procuraria `idle.gif` na RAIZ da pasta de
     * arte, e nao acha: aqui as tres lanes sao pastas, uma por ciclo
     */
    idleDir: "idle",

    /**
     * O MESMO PARA A CAMINHADA, que esta em `walk/`.
     *
     * O `hulk` nao precisa disto porque os GIFs dele estao na raiz. Aqui a
     * pasta `boss_vale/` tem so as tres subpastas, e a raiz esta vazia
     */
    walkDir: "walk",

    /**
     * A MORTE FICA FORA, pelo mesmo motivo do `hulk`: a pasta nao tem
     * `death/`, e sem esta linha o `buildSheet` pararia com "falta
     * death/south.gif"
     */
    death: false,

    /**
     * O golpe esta em `attack/`, e nao em `shoot/`.
     *
     * Mesmo nome e mesma razao do `hulk`: e corpo a corpo, e o nome vem da
     * arte de origem
     */
    shootDir: "attack",
    shoot: true,
  },
};

export const ROWS = [
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
];

/**
 * A pasta e a linha do ciclo de tiro/golpe, quando a folha nao
 * declara outra.
 *
 * O nome e `shoot` porque foi o primeiro asset a ter essa arte (o
 * arqueiro zumbi atira). O ogre da predeira e corpo a corpo e o
 * golpe dele esta na MESMA pasta: o nome do arquivo de origem nao
 * descreve o que a arte faz. E o guerreiro tem golpe em pasta
 * propria, chamada `attack` — por isso `shootDir` na folha
 */
export const SHOOT_DIR = "shoot";

/**
 * O arquivo de idle, quando a folha nao declara outro.
 *
 * `idle` e o nome de toda arte de origem ate aqui. O guerreiro
 * entrega o dele com o `d` trocado (`indle.gif`), e o nome real
 * fica declarado na folha em vez de ser adivinhado
 */
export const IDLE_FILE = "idle";

/**
 * A pasta da arte de MORTE.
 *
 * Nenhuma folha usava esse ciclo antes do goblin: o motor nao tinha
 * animacao de morte nenhuma (o inimigo morto era pulado no desenho) e
 * a ferramenta so sabia montar `walk`, `idle` e `shoot`
 *
 * O nome e `death` por ser o mesmo nome do bloco que o `layout.js`
 * declara em `animations`, e nao por descricao: e o nome do ciclo, do
 * jeito que `shootDir` e o nome do ciclo de tiro
 */
export const DEATH_DIR = "death";

/**
 * A pasta da arte de MINERACAO.
 *
 * O unico ciclo do jogo que nao e de andar, nem de atirar, nem de morrer:
 * e o que roda enquanto o jogador esta quebrando uma pedra no vale
 *
 * ## POR QUE TEM O NOME DE UM CICLO E NAO DE UMA ACAO
 *
 * Pelo mesmo motivo do `shootDir`: `shoot` e o golpe do arqueiro zumbi e do
 * arquiro, mas o ogre da predeira golpeia corpo a corpo e o nome da arte dele
 * continua sendo o do ciclo. O nome da pasta e o nome do ciclo no `layout.js`,
 * e nao uma descricao do que o boneco faz
 *
 * ## E UMA LANE SO, COMO A MORTE
 *
 * A arte de mineracao veio so do sul, entao ela nao entra como grupo de oito
 * direcoes. O layout le essa linha por `row`, e nao por `rowOffset` + direcao
 */
export const MINING_DIR = "mining";



function lzwDecode(minCodeSize, data, pixelCount) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;

  let codeSize = minCodeSize + 1;
  let next = eoi + 1;

  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4096);

  for (let i = 0; i < clear; i += 1) {
    prefix[i] = -1;
    suffix[i] = i;
  }

  const out = new Uint8Array(pixelCount);

  let written = 0;
  let bitBuffer = 0;
  let bitCount = 0;
  let pos = 0;
  let old = -1;
  let truncated = false;

  const readCode = () => {
    while (bitCount < codeSize) {
      if (pos >= data.length) return -1;
      bitBuffer |= data[pos] << bitCount;
      pos += 1;
      bitCount += 8;
    }

    const code = bitBuffer & ((1 << codeSize) - 1);

    bitBuffer >>= codeSize;
    bitCount -= codeSize;

    return code;
  };

  while (written < pixelCount) {
    const code = readCode();

    if (code === -1) {
      truncated = true;
      break;
    }

    if (code === eoi) {
      if (written < pixelCount) truncated = true;
      break;
    }

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      old = -1;
      continue;
    }

    let current = code;
    let sp = 0;

    if (code >= next) {
      if (old === -1) {
        truncated = true;
        break;
      }
      stack[sp] = suffix[old];
      sp += 1;
      current = old;
    }

    while (current >= clear) {
      stack[sp] = suffix[current];
      sp += 1;
      current = prefix[current];
      if (sp >= 4096) break;
    }

    stack[sp] = suffix[current];
    sp += 1;

    for (let i = sp - 1; i >= 0 && written < pixelCount; i -= 1) {
      out[written] = stack[i];
      written += 1;
    }

    if (old !== -1 && next < 4096) {
      prefix[next] = old;
      suffix[next] = stack[sp - 1];
      next += 1;

      if (next === 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    }

    old = code;
  }

  return { out, written, truncated };
}

export function decodeGif(buffer) {
  const signature = buffer
    .subarray(0, 6)
    .toString("latin1");

  if (!signature.startsWith("GIF8")) {
    throw new Error(`nao e um gif: ${signature}`);
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packed = buffer[10];

  const globalTableSize = 3 * 2 ** ((packed & 7) + 1);

  let i = 13 + globalTableSize;

  const frames = [];

  let transparent = null;
  let loop = null;
  let delay = null;
  let disposal = null;

  while (i < buffer.length) {
    const block = buffer[i];

    if (block === 0x21) {
      const label = buffer[i + 1];

      if (label === 0xf9) {
        const gcePacked = buffer[i + 3];

        delay = buffer.readUInt16LE(i + 4);

        if (gcePacked & 1) {
          transparent = buffer[i + 6];
        }

        disposal = (gcePacked >> 2) & 7;
        i += 8;
      } else {
        if (label === 0xff) {
          const size = buffer[i + 2];
          const app = buffer
            .subarray(i + 3, i + 3 + size)
            .toString("latin1");

          if (app.startsWith("NETSCAPE")) {
            loop = buffer.readUInt16LE(i + 3 + size + 2);
          }
        }

        i += 2;

        while (buffer[i] !== 0) i += buffer[i] + 1;
        i += 1;
      }

      continue;
    }

    if (block === 0x2c) {
      const imgPacked = buffer[i + 9];

      let j = i + 10;
      let tableOffset = 13;
      let tableSize = globalTableSize;

      if (imgPacked & 0x80) {
        tableOffset = j;
        tableSize = 3 * 2 ** ((imgPacked & 7) + 1);
        j += tableSize;
      }

      const minCodeSize = buffer[j];
      j += 1;

      const chunks = [];

      while (buffer[j] !== 0) {
        const length = buffer[j];
        chunks.push(buffer.subarray(j + 1, j + 1 + length));
        j += length + 1;
      }

      const pixelCount = width * height;
      const { out: indices, written, truncated } = lzwDecode(
        minCodeSize,
        Buffer.concat(chunks),
        pixelCount,
      );

      const rgba = new Uint8Array(pixelCount * 4);

      for (let p = 0; p < pixelCount; p += 1) {
        const value = indices[p];

        if (value === transparent) continue;

        const base = tableOffset + value * 3;
        const target = p * 4;

        rgba[target] = buffer[base];
        rgba[target + 1] = buffer[base + 1];
        rgba[target + 2] = buffer[base + 2];
        rgba[target + 3] = 255;
      }

      frames.push({
        rgba,
        delay,
        disposal,
        complete: !truncated && written === pixelCount,
        written,
      });

      i = j + 1;
      continue;
    }

    if (block === 0x3b) break;
    i += 1;
  }

  return { width, height, frames, loop, transparent };
}

function measure(frame, width, height) {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (frame[(y * width + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }

  return { minX, maxX, minY, maxY, count };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle];

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function shiftFrame(frame, width, height, dx, dy) {
  if (dx === 0 && dy === 0) return frame;

  const out = new Uint8Array(frame.length);

  for (let y = 0; y < height; y += 1) {
    const sourceY = y - dy;

    if (sourceY < 0 || sourceY >= height) continue;

    for (let x = 0; x < width; x += 1) {
      const sourceX = x - dx;

      if (sourceX < 0 || sourceX >= width) continue;

      const source = (sourceY * width + sourceX) * 4;
      const target = (y * width + x) * 4;

      out[target] = frame[source];
      out[target + 1] = frame[source + 1];
      out[target + 2] = frame[source + 2];
      out[target + 3] = frame[source + 3];
    }
  }

  return out;
}

/**
 * Decodifica um PNG RGBA de 8 bits.
 *
 * Exportado porque e o unico jeito de conferir a folha DEPOIS de
 * gerada, sem depender do que o navegador faz com a imagem: um
 * teste pode abrir o png e comparar celula a celula com os gifs de
 * origem, e provar que o que esta no arquivo e a arte de quem
 * mandou, e nao outra coisa.
 */
/**
 * Decodifica um PNG para RGBA.
 *
 * Sao aceitos os dois formatos de 8 bits que aparecem no projeto:
 *
 * - **color 6, RGBA**: o que o `portal_1.png` e o `portal_2.png` tem.
 *   A transparencia ja vem no arquivo
 * - **color 2, RGB**: o que o `base.png` tem. Sem canal alpha nenhum,
 *   entao o recorte da moldura e do fundo depende de quem chama
 *
 * O caso RGB entra devolvendo alpha 255 em tudo. Isso NAO inventa
 * transparencia: so faz o resto do pipeline — o `caixaOpaca` do
 * `gerar-portal.mjs`, por exemplo — poder tratar os dois formatos com o
 * mesmo codigo. Quem precisa cortar um fundo pintado faz isso a parte,
 * porque so quem conhece a arte sabe qual pixel e fundo
 */
export function inflatePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) {
      throw new Error("png invalido");
    }
  }

  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;

  const idat = [];

  let i = 8;

  while (i < buffer.length) {
    const length = buffer.readUInt32BE(i);
    const type = buffer.toString("ascii", i + 4, i + 8);
    const data = buffer.subarray(i + 8, i + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    i += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(
      `png inesperado: depth ${bitDepth}, color ${colorType}`,
    );
  }

  /**
   * Os bytes por pixel do ARQUIVO, que e o que o filtro da linha usa.
   *
   * E 3 no RGB e 4 no RGBA. Confundir os dois faz a linha inteira
   * correr e a imagem sai com listras diagonais
   */
  const bpp = colorType === 6 ? 4 : 3;

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;

  // o filtro acontece em RGB puro; a expansao para RGBA vem depois
  const cru = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(
      y * (stride + 1) + 1,
      y * (stride + 1) + 1 + stride,
    );

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? cru[y * stride + x - bpp] : 0;
      const up = y > 0 ? cru[(y - 1) * stride + x] : 0;
      const upLeft =
        x >= bpp && y > 0 ? cru[(y - 1) * stride + x - bpp] : 0;

      let value = line[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);

        value +=
          dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }

      cru[y * stride + x] = value & 0xff;
    }
  }

  // RGB ja veio: devolve como esta
  if (colorType === 6) {
    return { width, height, data: cru };
  }

  const out = new Uint8Array(width * height * 4);

  for (let p = 0; p < width * height; p += 1) {
    out[p * 4] = cru[p * 3];
    out[p * 4 + 1] = cru[p * 3 + 1];
    out[p * 4 + 2] = cru[p * 3 + 2];
    out[p * 4 + 3] = 255;
  }

  return { width, height, data: out };
}

function repairTruncatedFrames(directions) {
  const repairs = [];

  for (const direction of directions) {
    const { frames } = direction.gif;
    const total = frames.length;

    const valid = frames
      .map((frame, index) => (frame.complete ? index : null))
      .filter((index) => index !== null);

    if (valid.length === 0) {
      throw new Error(
        `${direction.name}.gif nao tem nenhum frame decodificavel`,
      );
    }

    frames.forEach((frame, index) => {
      if (frame.complete) return;

      let best = null;
      let bestDistance = Infinity;

      for (const candidate of valid) {
        const raw = Math.abs(candidate - index);
        const distance = Math.min(raw, total - raw);

        const prefersEarlier =
          distance === bestDistance && candidate < index;

        if (distance < bestDistance || prefersEarlier) {
          best = candidate;
          bestDistance = distance;
        }
      }

      repairs.push({
        name: direction.name,
        dir: direction.dir === "." ? null : direction.dir,
        index,
        from: best,
        written: frame.written,
      });

      frame.rgba = Uint8Array.from(frames[best].rgba);
      frame.complete = true;
    });

    direction.frames = frames.map((frame) => frame.rgba);
  }

  return repairs;
}

function dropTruncatedFrames(source) {
  const dropped = [];
  const kept = [];

  source.gif.frames.forEach((frame, index) => {
    if (frame.complete) {
      kept.push(frame.rgba);
      return;
    }

    dropped.push({
      name: source.name,
      index,
      written: frame.written,
    });
  });

  if (kept.length === 0) {
    throw new Error(
      `${source.name}.gif nao tem nenhum frame decodificavel`,
    );
  }

  source.frames = kept;

  return dropped;
}

function alignAnchors(lanes, target, frameSize) {
  const anchors = lanes.map((lane) => {
    const measured = lane.frames.map((frame) =>
      measure(frame, frameSize, frameSize),
    );

    return {
      foot: median(measured.map((box) => box.maxY)),
      center: median(
        measured.map((box) => box.minX + box.maxX),
      ),
    };
  });

  const targetFoot = target?.foot ??
    median(anchors.map((anchor) => anchor.foot));

  const targetCenter = target?.center ??
    median(anchors.map((anchor) => anchor.center));

  const offsets = anchors.map((anchor) => ({
    dx: Math.round((targetCenter - anchor.center) / 2),
    dy: targetFoot - anchor.foot,
  }));

  lanes.forEach((lane, index) => {
    const { dx, dy } = offsets[index];

    if (dx === 0 && dy === 0) return;

    lane.frames = lane.frames.map((frame) =>
      shiftFrame(frame, frameSize, frameSize, dx, dy),
    );
  });

  return { offsets, targetFoot, targetCenter };
}

/**
 * @param semAverificarO QUE NAO PODE SER ACUSADO DE QUADRADO ACHATADO.
 *
 * Os indices das lanes onde perder altura e LEGITIMO. E o caso da morte:
 * o ultimo quadro do cadaver e o personagem deitado no chao, que tem a
 * largura do personagem em pe e um terco da altura
 *
 * A regra do `squashed` foi escrita para pegar stream LZW truncado — que
 * escreve as primeiras linhas da celula e deixa o resto vazio — e ela se
 * apoia em "perder ALTURA e assinatura de corrupcao". Numa animacao de
 * morte essa premissa e falsa: o cadaver deitado e a arte CORRETA, e sem
 * esta isencao a ferramenta recusaria a propria animacao de morte
 *
 * E so a MORTE entra aqui. O `walk`, o `idle` e o `attack` continuam
 * auditados normalmente, porque neles perder altura ainda e defeito
 */
function audit(directions, frameSize, semAverificar = new Set()) {
  const perRow = [];
  const squashed = [];
  const tocando = [];
  let touching = 0;
  let empty = 0;

  for (const [row, direction] of directions.entries()) {
    const isenta = semAverificar.has(row);
    const boxes = direction.frames.map((frame) =>
      measure(frame, frameSize, frameSize),
    );

    const unionWidth =
      Math.max(...boxes.map((box) => box.maxX)) -
      Math.min(...boxes.map((box) => box.minX)) +
      1;

    const unionHeight =
      Math.max(...boxes.map((box) => box.maxY)) -
      Math.min(...boxes.map((box) => box.minY)) +
      1;

    const unionArea = unionWidth * unionHeight;

    let minX = frameSize;
    let maxX = -1;
    let minY = frameSize;
    let maxY = -1;
    let opaque = 0;

    boxes.forEach((box, index) => {
      if (box.count === 0) {
        empty += 1;
        return;
      }

      const width = box.maxX - box.minX + 1;
      const height = box.maxY - box.minY + 1;

      // a assinatura de frame corrompido e perder ALTURA: o
      // stream LZW truncado escreve as primeiras linhas da celula
      // e o resto fica vazio. largura varia de legitimamente na
      // animacao de tiro, com o arco sendo puxado e estendido.
      //
      // A isencao da lane e o que deixa a MORTE passar: o cadaver
      // deitado perde altura de proposito
      const flat = height < unionHeight * 0.5;
      const sparse = width * height < unionArea * 0.3;

      if (!isenta && (flat || sparse)) {
        squashed.push(
          `${direction.name} frame ${index} ` +
            `(${width}x${height} contra ${unionWidth}x${unionHeight})`,
        );
      }

if (
          box.minX === 0 ||
          box.maxX === frameSize - 1 ||
          box.minY === 0 ||
          box.maxY === frameSize - 1
        ) {
          touching += 1;

          /**
           * O NOME DA CELULA QUE ENCOSTOU, e nao so a contagem.
           *
           * A contagem sozinha nao diz o que fazer: "4 celulas tocam a
           * borda" obriga a abrir a arte na mao e contar de novo.
           *
           * O `row` entra porque `name` sozinho e ambiguo: as oito
           * direcoes existem em `walk`, em `idle` e em `shoot`, e as tres
           * copias chamam `south-east` igual. A linha da folha e o que
           * separa "o tiro encostou" de "o idle do norte tem um pixel a
           * mais", e e o numero que o layout vai ler
           */
          tocando.push(
            `linha ${row} ${direction.dir}/${direction.name} ` +
              `frame ${index}`,
          );
        }

      minX = Math.min(minX, box.minX);
      maxX = Math.max(maxX, box.maxX);
      minY = Math.min(minY, box.minY);
      maxY = Math.max(maxY, box.maxY);
      opaque += box.count;
    });

    perRow[row] = {
      minX,
      maxX,
      minY,
      maxY,
      foot: maxY,
      opaque,
    };
  }

return {
      perRow,
      touching,
      tocando,
      empty,
      squashed,
      foot: median(perRow.map((info) => info.foot)),
    };
}

function verifySheet(png, data, sheetWidth, lanes, frameSize) {
  const decoded = inflatePng(png);

  if (
    decoded.width !== sheetWidth ||
    decoded.height !== frameSize * lanes.length
  ) {
    throw new Error("png gerado com dimensao errada");
  }

  let mismatched = 0;
  let opaquePixels = 0;

  for (const [row, lane] of lanes.entries()) {
    for (const [column, frame] of lane.frames.entries()) {
      for (let y = 0; y < frameSize; y += 1) {
        for (let x = 0; x < frameSize; x += 1) {
          const source = (y * frameSize + x) * 4;
          const targetX = column * frameSize + x;
          const targetY = row * frameSize + y;
          const target = (targetY * sheetWidth + targetX) * 4;

          if (frame[source + 3] > 0) opaquePixels += 1;

          for (let channel = 0; channel < 4; channel += 1) {
            if (
              frame[source + channel] !==
              decoded.data[target + channel]
            ) {
              mismatched += 1;
            }
          }
        }
      }
    }
  }

  if (mismatched > 0) {
    throw new Error(
      `png divergiu da sheet montada em ${mismatched} canais`,
    );
  }

  return {
    opaquePixels,
    cells: lanes.reduce(
      (total, lane) => total + lane.frames.length,
      0,
    ),
  };
}

/**
 * Carrega um lane (uma direcao de um ciclo), aplicando a substituicao
 * declarada quando o gif nao existe.
 *
 * `substituicoes` e o mapa `direcao -> direcao vizinha` da folha. Ele
 * existe porque o ogre da predeira so tem 5 direcoes de golpe: sem
 * isso a ferramenta pararia num arquivo faltando, e a folha do
 * inimigo nao existiria.
 */
function loadLane(
  sourceDir,
  frameSize,
  dir,
  name,
  expectedFrames,
  substituicoes = null,
) {
  const file = resolve(sourceDir, dir, `${name}.gif`);

  let lane = null;
  let usado = null;

  if (existsSync(file)) {
    lane = loadGif(file, `${dir}/${name}.gif`, frameSize);
    usado = name;
  } else {
    const vizinho = substituicoes?.[name] ?? null;

    if (!vizinho) {
      throw new Error(
        `falta ${dir}/${name}.gif e a folha nao declara ` +
          `nenhum substituto para essa direcao`,
      );
    }

    const arquivoVizinho = resolve(
      sourceDir,
      dir,
      `${vizinho}.gif`,
    );

    if (!existsSync(arquivoVizinho)) {
      throw new Error(
        `${dir}/${name}.gif nao existe e o substituto ` +
          `declarado (${vizinho}.gif) tambem nao`,
      );
    }

    lane = loadGif(
      arquivoVizinho,
      `${dir}/${name}.gif`,
      frameSize,
    );

    usado = vizinho;
  }

  if (
    expectedFrames !== null &&
    lane.gif.frames.length !== expectedFrames
  ) {
    throw new Error(
      `${usado}.gif tem ${lane.gif.frames.length} frames, ` +
        `esperado ${expectedFrames}`,
    );
  }

  return { name, dir, gif: lane.gif, usado, substituiu: usado !== name };
}

/**
 * Centraliza um frame menor dentro da celula da folha.
 *
 * A arte de origem nem sempre vem com a mesma tela em todos os
 * arquivos. A do `urso` e o caso: `north` sai em 68x68, `east` em
 * 64x64, `idle` em 60x60 e os dois de baixo em 56x56 — com o MESMO
 * desenho dentro, so a borda em volta que muda
 *
 * Preencher a celula com transparente resolve, e sem REDIMENSIONAR:
 * encolher o maior para o menor perderia pixel da arte, que e a razao
 * de cada folha declarar o proprio tamanho de celula. Como o desenho
 * ja cabe em qualquer das celulas, o unico efeito e uma margem
 * transparente a mais
 *
 * O deslocamento e inteiro e Centralizado: `(celula - origem) / 2`
 * arredondado para baixo. O `alignAnchors` cuida do pe e do centro do
 * CORPO depois, e e ele que decide o alinhamento final — aqui so
 * importa que a arte nao encoste na borda
 */
function centraliza(frame, origem, frameSize) {
  if (origem === frameSize) return frame;

  const out = new Uint8Array(frameSize * frameSize * 4);

  const dx = Math.floor((frameSize - origem) / 2);
  const dy = Math.floor((frameSize - origem) / 2);

  for (let y = 0; y < origem; y += 1) {
    for (let x = 0; x < origem; x += 1) {
      const source = (y * origem + x) * 4;
      const target = ((y + dy) * frameSize + x + dx) * 4;

      out[target] = frame[source];
      out[target + 1] = frame[source + 1];
      out[target + 2] = frame[source + 2];
      out[target + 3] = frame[source + 3];
    }
  }

  return out;
}

function loadGif(file, nome, frameSize) {
  const gif = decodeGif(readFileSync(file));

  /**
   * A arte MENOR que a celula e centralizada; a MAIOR ainda e erro.
   *
   * Centralizar e seguro porque o desenho ja cabe. Uma tela de
   * origem MAIOR que a celula exigiria cortar pixel, e cortar pixel
   * de arte e o que nenhuma folha deve fazer — por isso esse lado
   * continua sendo recusado, com o tamanho na mensagem
   */
  if (gif.width > frameSize || gif.height > frameSize) {
    throw new Error(
      `${nome} tem ${gif.width}x${gif.height}, ` +
        `maior que a celula de ${frameSize}x${frameSize}: ` +
        `seria preciso cortar pixel da arte`,
    );
  }

  if (gif.width !== frameSize || gif.height !== frameSize) {
    for (const frame of gif.frames) {
      frame.rgba = centraliza(
        frame.rgba,
        gif.width,
        frameSize,
      );
    }

    gif.centralizado = `${gif.width}x${gif.height}`;
  }

  return { gif };
}

/**
 * O menor numero de frames do grupo, e o corte de todos nele.
 *
 * A arte nao vem com contagem igual em todas as direcoes: o ogre da
 * predeira tem caminhada de 8 e 9 frames e golpe de 9 e 10. Cortar
 * no MENOR e o que mantem o passo das pernas e o ritmo do golpe
 * iguais em todas as direcoes.
 *
 * A alternativa, completar o grupo repetindo o ultimo frame, faria
 * o ciclo dar um tranco no final da volta: em um loop, segurar o
 * ultimo quadro por um tempo fixo e visivel.
 */
function normalizarFrames(lanes, grupo) {
  const alvo = Math.min(
    ...lanes.map((lane) => lane.gif.frames.length),
  );

  const cortes = [];

  for (const lane of lanes) {
    const total = lane.gif.frames.length;

    if (total === alvo) continue;

    if (total < alvo) {
      throw new Error(
        `${lane.name} tem ${total} frames e o menor do grupo ` +
          `(${grupo}) tem ${alvo}: nao da para completar`,
      );
    }

    cortes.push({
      name: lane.name,
      de: total,
      para: alvo,
    });

    lane.gif.frames.length = alvo;
  }

  return { alvo, cortes };
}

/**
 * Monta uma sheet a partir dos gifs de uma criatura ou classe.
 *
 * `name` e a chave em `SHEETS`. A funcao nao roda nada sozinha: quem
 * chama e decide qual folha montar. Antes o `run()` disparava no
 * import, e um `import { decodeGif }` num script de inspecao
 * regerava a sheet do arqueiro por efeito colateral.
 */
export function buildSheet(name) {
  const sheet = SHEETS[name];

  if (!sheet) {
    throw new Error(
      `sheet desconhecida: ${name} (tem ${Object.keys(SHEETS).join(", ")})`,
    );
  }

  const { frameSize, prefix } = sheet;
  const sourceDir = resolve(HERE, "..", sheet.sourceDir);
  const output = resolve(HERE, "..", sheet.output);

  const querIdle = sheet.idle !== false;
  const querShoot = sheet.shoot !== false;
  const querDeath = sheet.death === true;
  const querMining = sheet.mining === true;

  // o nome do ciclo vem da arte de origem, e cada folha declara o
  // seu quando nao for o padrao da ferramenta
  const shootDir = sheet.shootDir ?? SHOOT_DIR;
  const idleFile = sheet.idleFile ?? IDLE_FILE;

  /**
   * O idle pode ser UM gif ou uma pasta de oito.
   *
   * Sem `idleDir`, o idle e o `idleFile` na raiz: uma lane so, que a
   * folha usa para as oito direcoes. Com `idleDir`, e uma lane por
   * direcao dentro da pasta, e a folha ganha oito linhas de idle
   *
   * A escolha muda o layout inteiro: o idle por direcao precisa de
   * `rowOffset`, e o idle unico precisa de `row`. Sao duas coisas
   * diferentes e o layout do goblin declara a primeira
   */
  const idleDir = sheet.idleDir ?? null;

  /**
   * O ciclo de MORTE, que so o goblin tem.
   *
   * Diferente do walk, do idle e do golpe, a morte NAO tem oito
   * direcoes: a arte veio so do sul. Por isso ela nao entra como
   * `normalizarFrames` e `alignAnchors` de um grupo de oito, e sim
   * como uma lane unica que ocupa uma linha so da folha
   */
  const deathDir = sheet.deathDir ?? DEATH_DIR;
  const deathLaneName = sheet.deathDirection ?? "south";

  /**
   * A pasta e o angulo da arte de MINERACAO.
   *
   * Mesmo formato da morte: uma lane so, numa linha so, lida pelo layout por
   * `row`. O arquiro mina virado para a pedra, e a arte veio so do sul
   */
  const miningDir = sheet.miningDir ?? MINING_DIR;
  const miningLaneName = sheet.miningDirection ?? "south";

  // Nenhuma contagem e esperada na carga: a arte de origem nao tem
  // por que ter o mesmo numero de frames em todas as direcoes, e o
  // ajuste para o menor do grupo acontece em `normalizarFrames`
  const walk = ROWS.map((rowName) =>
    loadLane(
      sourceDir,
      frameSize,
      sheet.walkDir ?? ".",
      rowName,
      null,
      sheet.walkFallback ?? null,
    ),
  );

  const shoot = [];

  if (querShoot) {
    for (const rowName of ROWS) {
      shoot.push(
        loadLane(
          sourceDir,
          frameSize,
          shootDir,
          rowName,
          null,
          sheet.shootFallback ?? null,
        ),
      );
    }
  }

  const walkNorm = normalizarFrames(walk, "walk");
  const shootNorm = querShoot
    ? normalizarFrames(shoot, shootDir)
    : { alvo: 0, cortes: [] };

/**
   * A MORTE, UMA LANE SO.
   *
   * Nao entra em `normalizarFrames` nem em `alignAnchors` com o resto
   * do grupo: ela nao e um ciclo de oito direcoes, e a linha dela na
   * folha e a unica que o layout le por `row`
   *
   * As tres criaturas que tem arte de morte — goblin, Kaelen e Nylara —
   * trazem a pasta `death/` com um `south.gif` so. Nenhuma delas tem os
   * oito angulos, entao nao existe o caminho de morte por direcao aqui
   *
   * A contagem de frames (9 no goblin) e maior que a do walk (8), e a
   * largura da folha e o maximo de todas as linhas, entao a folha sai
   * com 9 colunas
   */
  const death = [];

if (querDeath) {
    death.push(
      loadLane(
        sourceDir,
        frameSize,
        deathDir,
        deathLaneName,
        null,
        sheet.deathFallback ?? null,
      ),
    );
  }

  /**
   * A MINERACAO, UMA LANE SO, e o ultimo ciclo da folha.
   *
   * A arte veio so do sul, como a morte, entao nao existe caminho de
   * mineracao por direcao: ela ocupa uma linha e o layout a le por `row`.
   *
   * Ela e a ULTIMA linha de proposito. A ordem das linhas e o que o layout
   * le, e o `index.js` precisa saber que a mineracao esta depois do tiro
   * sem fazer conta — e nenhuma outra arte nova entra sem mexer nessa ordem
   */
  const mining = [];

  if (querMining) {
    /*
      A MINERACAO PODE SER UMA LANE OU OITO.

      ## POR QUE ISTO EXISTE

      A mineracao nasceu como LANE UNICA — veio so do sul, e `miningDirection`
      apontava para ela. Isso ainda vale para a folha que declara
      `miningDirection`, e o `row` fixo continua sendo o jeito de ler uma
      linha so

      Mas a arte do arquiro agora tem `mining/` com os oito angulos, e o
      jogador chega na pedra de qualquer lado. Ler `row: 24` mostrava o
      arqueiro socando para BAIXO enquanto ele estava de norte — o
      angulo errado na acao que mais se nota, porque a picareta e a mao que
      o jogador esta olhando

      ## O QUE MUDA COM OITO DIRECOES

      O ciclo passa a ser lido por `rowOffset`, como o `idle` e o `shoot`:
      a linha do angulo e a linha do ciclo MAIS o deslocamento da direcao.
      Uma linha so nunca usaria `rowOffset` — apontaria para o tiro ou para
      fora da folha

      A `miningDirection` continua valendo: e ela que decide o caminho. Com
      ela declarada, a folha mantem a lane unica de antes
    */
    if (sheet.miningDirection) {
      mining.push(
        loadLane(
          sourceDir,
          frameSize,
          miningDir,
          miningLaneName,
          null,
          sheet.miningFallback ?? null,
        ),
      );
    } else {
      for (const rowName of ROWS) {
        mining.push(
          loadLane(
            sourceDir,
            frameSize,
            miningDir,
            rowName,
            null,
            sheet.miningFallback ?? null,
          ),
        );
      }
    }
  }

  // sem idle, a linha de tiro sobe: as linhas da folha sao as que o
  // layout vai ler, e ele e impresso no fim
  const idle = [];

  if (querIdle && idleDir) {
    // idle por direcao: uma lane por linha, na ordem do `ROWS`, que e
    // a mesma ordem que a caminhada usa. E o que faz o idle do
    // goblin precisar de `rowOffset` no layout
    for (const rowName of ROWS) {
      idle.push(
        loadLane(
          sourceDir,
          frameSize,
          idleDir,
          rowName,
          null,
          sheet.idleFallback ?? null,
        ),
      );
    }
  } else if (querIdle) {
    idle.push(
      loadLane(sourceDir, frameSize, ".", idleFile, null),
    );
  }

  /**
   * O idle por direcao e normalizado como os outros grupos.
   *
   * O idle de uma linha so nunca precisou disso, porque nao ha com o
   * que discordar. Com oito lanes, uma direcao com um quadro a mais
   * faria o idle daquela direcao correr mais rapido que as outras
   * sete, e o corte no menor e o mesmo ajuste que o `walk` usa
   */
  const idleNorm = idleDir && idle.length > 1
    ? normalizarFrames(idle, "idle")
    : { alvo: 0, cortes: [] };

  // as direcoes mantem a contagem de frames porque o ciclo de
  // todo grupo passa pelo reparo antes do descarte
  const repairs = [
    /**
     * O IDLE TAMBEM ENTRA NO REPARO, e e o que fecha o quadro que faltava.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * O idle era o UNICO grupo que nao passava por aqui: ele ia direto para o
     * `dropTruncatedFrames`, que DESCARTA o quadro corrompido em vez de
     * reconstruir
     *
     * ## POR QUE O SINTOMA ERA O PERSONAGEM SUMINDO, E NAO UM QUADRO A MENOS
     *
     * Porque o `normalizarFrames` roda ANTES, e ele conta os 8 quadros do gif
     * truncado — ele nao sabe que dois deles estao corrompidos. A folha era
     * entao montada com 8 colunas, e so 6 delas recebiam pixels: as duas do
     * fim ficavam TRANSPARENTES
     *
     * O layout, que le `IDLE_FRAMES = 8`, continuava ciclando os 8. O
     * `resolveFrame` chegava na coluna vazia, desenhava nada, e o boneco
     * desaparecia por um quadro antes de voltar
     *
     * ## POR QUE REPARAR E A CERTEZA AQUI, E NAO UM PALPITE
     *
     * Porque os quadros do idle sao TODOS IGUAIS — e uma pose parada repetida
     * em laco. O `repairTruncatedFrames` copia o quadro valido mais proximo, e
     * como nao ha diferenca entre eles, o resultado e byte a byte o que um gif
     * inteiro daria. Descartar, esse, so produzia a celula vazia
     *
     * Foi assim que o north-west e o north-east do guerreiro perderam 2 quadros
     * cada, e o do conjurador 1 — e sao exatamente as duas direcoes em que o
     * LZW desses gifs veio truncado
     */
    ...repairTruncatedFrames(idle),
    ...repairTruncatedFrames(walk),
    ...(querShoot ? repairTruncatedFrames(shoot) : []),
    ...(querDeath ? repairTruncatedFrames(death) : []),
    ...(querMining ? repairTruncatedFrames(mining) : []),
  ];

  const drops = [];

  /**
   * O DESCARTE DO IDLE, e POR QUE AGORA ELE NAO DESCARTA NADA.
   *
   * O `repairTruncatedFrames` acima ja reconstruiu o que faltava, entao aqui
   * nao sobra nenhum corrompido para cair fora — e o `lane.frames` continua
   * sendo promovido por esta chamada, que e o que a montagem da folha le
   */
  for (const lane of idle) {
    drops.push(...dropTruncatedFrames(lane));
  }

  /**
   * A MORTE PASSA PELO MESMO REPARO E DESCARTE.
   *
   * `loadLane` devolve a lane com os frames dentro de `gif.frames`, e
   * quem promove para `lane.frames` sao estas duas funcoes. Sem a
   * morte entrar aqui, `lane.frames` ficava indefinido e a montagem da
   * folha quebrava em `death[0].frames.length`
   *
   * E a arte e um gif como qualquer outro: o stream LZW truncado
   * acontece com ela igual
   */
  for (const lane of death) {
    drops.push(...dropTruncatedFrames(lane));
  }

  /**
   * A MINERACAO TAMBEM PASSA PELO REPARO E DESCARTE.
   *
   * Pelos mesmos dois motivos da morte: `lane.frames` so e promovido por
   * estas funcoes, e um gif corrompido acontece com ela igual
   */
  for (const lane of mining) {
    drops.push(...dropTruncatedFrames(lane));
  }

  /**
   * A MINERACAO E CORTADA NO MENOR, COMO TODO GRUPO DE OITO.
   *
   * Sem isto, uma lane com mais quadros entraria na folha com eles e o
   * `length` do layout — que e a contagem do MENOR — deixaria os quadros
   * extras fora do ciclo. Nao daria erro: a arte valida aparecia, e o
   * gesto da picareta dava um tranco no fim da volta
   *
   * A lane unica nao passa aqui: `miningNorm` fica com alvo 0, e o
   * `mining[0].frames.length` da impressao continua sendo o comprimento
   * dela
   */
  const miningNorm = mining.length > 1
    ? normalizarFrames(mining, miningDir)
    : { alvo: 0, cortes: [] };

  if (idle.length > 0) {
    if (idle[0].frames.length < 2) {
      throw new Error(
        `idle.gif ficou com ${idle[0].frames.length} frame valido`,
      );
    }

    /**
     * A capacidade da grade e a MAIOR das linhas que existem, e nao
     * a do golpe.
     *
     * A checagem usava `shootNorm.alvo`, que e 0 numa folha sem
     * golpe: o ghoul faminto tem `idle.gif` e as oito direcoes, mas
     * nao tem arte de ataque, e a ferramenta falhava com "a grade
     * comporta 0" jogando fora uma arte valida. A largura da folha
     * e o maximo de todas as linhas, entao e com ele que o idle se
     * compara
     */
    const capacidade = Math.max(
      walkNorm.alvo,
      shootNorm.alvo,
      death[0]?.frames.length ?? 0,
      mining.reduce(
        (maior, lane) => Math.max(maior, lane.frames.length),
        0,
      ),
    );

    const idleMaior = idle.reduce(
      (maior, lane) => Math.max(maior, lane.frames.length),
      0,
    );

    if (idleMaior > capacidade) {
      throw new Error(
        `idle tem ${idleMaior} frames validos, ` +
          `a grade comporta ${capacidade}`,
      );
    }
  }

  const walkAnchor = alignAnchors(walk, null, frameSize);

  const shared = {
    foot: walkAnchor.targetFoot,
    center: walkAnchor.targetCenter,
  };

  const idleAnchor = alignAnchors(idle, shared, frameSize);
  const shootAnchor = alignAnchors(shoot, shared, frameSize);

  /**
   * A MORTE USA O PE DO WALK E NAO O SEU.
   *
   * O `shared` que a caminhada produz e o ponto de pe de referencia
   * de toda a folha. A arte de morte ja chega deitada, com o desenho
   * no chao, e alinhar o PE dela no pe de quem esta em pe alevantaria
   * o cadaver no ar no ultimo quadro
   *
   * `alignAnchors` com `shared` nulo devolve o alvo do proprio grupo,
   * que e o que a caminhada usa: a lane se alinha nela mesma e o
   * deslocamento e zero. E o que mantem o corpo no lugar
   */
  const deathAnchor = alignAnchors(death, null, frameSize);

  /**
   * A MINERACAO SE ALINHA NO PE DE QUEM ESTA EM PE, e no dela.
   *
   * Diferente da morte, que chega deitada: o arquiro minerando esta de pe e
   * socando a pedra para baixo. Passar o `shared` do walk e o que impede que
   * a picareta desca um bloco a cada quadro — o defeito apareceria como um
   * boneco que afunda no chao enquanto a barra de mineracao sobe
   */
  const miningAnchor = alignAnchors(mining, shared, frameSize);

  const lanes = [
    ...walk,
    ...idle,
    ...shoot,
    ...death,
    ...mining,
  ];

  const idleRow = walk.length;
  const shootRow = walk.length + idle.length;
  const deathRow = walk.length + idle.length + shoot.length;
  const miningRow = deathRow + death.length;

  const columns = Math.max(
    walkNorm.alvo,
    idle.reduce(
      (maior, lane) => Math.max(maior, lane.frames.length),
      0,
    ),
    shootNorm.alvo,
    death[0]?.frames.length ?? 0,

    /**
     * A COLUNA MAIOR DA MINERACAO, e nao a da lane 0.
     *
     * Com oito direcoes, `mining[0]` e so o angulo do leste: usar a
     * contagem dele deixaria as lanes mais longas do grupo saindo da
     * folha. O `normalizarFrames` corta no MENOR, e `reduce` no maior e o
     * mesmo cuidado que o `idle` e o `shoot` ja fazem acima
     */
    mining.reduce(
      (maior, lane) => Math.max(maior, lane.frames.length),
      0,
    ),
  );

  /**
 * A MORTE NAO E AUDITADA COMO QUADRADO ACHATADO.
 *
 * O indice da lane de morte e `deathRow`, e ele so existe quando a folha
 * tem o ciclo. Um `Set` vazio numa folha sem morte e o mesmo comportamento
 * de antes
 */
  const lanesIsentas = new Set(
    death.length > 0 ? [deathRow] : [],
  );

  const report = audit(lanes, frameSize, lanesIsentas);

  if (report.touching > 0) {
    throw new Error(
      `${report.touching} celulas tocam a borda da celula; ` +
        "a arte esta encostando e pode vazar para a vizinha:\n" +
        report.tocando.map((nome) => `  - ${nome}`).join("\n"),
    );
  }

  if (report.empty > 0) {
    throw new Error(
      `${report.empty} celulas ficaram vazias apos o reparo`,
    );
  }

  if (report.squashed.length > 0) {
    throw new Error(
      `celulas com o personagem incompleto:\n` +
        report.squashed.map((entry) => `  - ${entry}`).join("\n"),
    );
  }

  const sheetWidth = frameSize * columns;
  const sheetHeight = frameSize * lanes.length;
  const data = new Uint8Array(sheetWidth * sheetHeight * 4);

  for (const [row, lane] of lanes.entries()) {
    for (const [column, frame] of lane.frames.entries()) {
      for (let y = 0; y < frameSize; y += 1) {
        for (let x = 0; x < frameSize; x += 1) {
          const source = (y * frameSize + x) * 4;
          const targetX = column * frameSize + x;
          const targetY = row * frameSize + y;
          const target = (targetY * sheetWidth + targetX) * 4;

          data[target] = frame[source];
          data[target + 1] = frame[source + 1];
          data[target + 2] = frame[source + 2];
          data[target + 3] = frame[source + 3];
        }
      }
    }
  }

  const png = encodePng(data, sheetWidth, sheetHeight);

  const verified = verifySheet(
    png,
    data,
    sheetWidth,
    lanes,
    frameSize,
  );

  writeFileSync(output, png);

  const substitutas = shoot.filter((lane) => lane.substituiu);

  /**
   * As telas de origem que foram centralizadas.
   *
   * Entra no log porque e uma diferenca entre a arte que o jogador
   * mandou e a folha que saiu: um `gif` de 56px dentro de uma celula
   * de 68px tem 6px de margem transparente a mais de cada lado. Sem
   * esta linha o artefato aparecia do nada, e a primeira pessoa a
   * verificar a arte nao teria como saber que ela foi assim
   */
  const centralizados = lanes.filter((lane) => lane.gif.centralizado);

  if (centralizados.length > 0) {
    console.log(
      `\ntelas de origem menores que a celula, centralizadas:`,
    );

    for (const lane of centralizados) {
      console.log(
        `  ${lane.name.padEnd(12)} ${lane.gif.centralizado} ` +
          `-> ${frameSize}x${frameSize}`,
      );
    }
  }

  console.log(
    `\nsheet ${name} gerada: ${sheetWidth}x${sheetHeight} ` +
      `(${columns} colunas x ${lanes.length} linhas: ` +
      `${ROWS.length} walk` +
      // o idle por direcao ocupa uma linha por angulo, e o de uma
      // linha so ocupa uma: a frase do relatorio muda porque a
      // estrutura da folha muda
      `${
        idle.length === 0
          ? " (sem idle)"
          : idle.length > 1
            ? ` + ${idle.length} idle`
            : " + 1 idle"
      }` +
      // o boneco de treino so tem direcao: a frase muda, para o
      // relatorio nao anunciar um golpe que nao esta na folha
      `${
        shoot.length > 0
          ? ` + ${ROWS.length} ${shootDir}`
          : " (sem golpe)"
      }` +
// a morte e uma linha so, e ela nao tem direcao nenhuma
`${death.length > 0 ? ` + 1 ${deathDir}` : ""}` +
        // a mineracao e a ultima: uma linha so quando a folha declara
        // `miningDirection`, e oito quando a arte trouxe os angulos
        `${mining.length > 0
          ? ` + ${mining.length === 1 ? 1 : mining.length} ${miningDir}`
          : ""}, ` +
        `celula ${frameSize}x${frameSize})\n`,
  );

  /**
 * As substituicoes, por ciclo.
 *
 * O log e separado por ciclo porque a RAZAO de cada um e diferente.
 * O golpe do ogre falta em tres direcoes e a folha usa a vizinha mais
 * proxima em grau, que e o que o mapa `shootFallback` declara. A
 * caminhada do rato falta no `south`, e a folha usa a arte de PARADO
 * de frente, que mantem a direcao certa ao custo das patas paradas
 *
 * As duas sao substituicoes declaradas, e nao algo que a ferramenta
 * inventou: sem o mapa, a construcao para com o nome do arquivo que
 * faltou
 */
const substituidasPorCiclo = [
  { ciclo: "walk", lanes: walk.filter((lane) => lane.substituiu) },
  { ciclo: "idle", lanes: idle.filter((lane) => lane.substituiu) },
  {
    ciclo: shootDir,
    lanes: substitutas,
  },
{ ciclo: deathDir, lanes: death.filter((lane) => lane.substituiu) },
    {
      ciclo: miningDir,
      lanes: mining.filter((lane) => lane.substituiu),
    },
  ];

for (const { ciclo, lanes: copiadas } of substituidasPorCiclo) {
  if (copiadas.length === 0) continue;

  console.log(
    `\ndirecoes de ${ciclo} que faltavam na arte e foram ` +
      `copiadas de outra arte:`,
  );

  for (const lane of copiadas) {
    console.log(
      `  ${lane.name.padEnd(12)} <- ${lane.usado}.gif`,
    );
  }
}

const allOffsets = [
      ...walkAnchor.offsets,
      ...idleAnchor.offsets,
      ...shootAnchor.offsets,
      ...deathAnchor.offsets,
      ...miningAnchor.offsets,
    ];

  for (const [row, lane] of lanes.entries()) {
    const info = report.perRow[row];
    const { dx, dy } = allOffsets[row];

const group =
        row < walk.length
          ? "walk"
          : row < idleRow + idle.length
            ? "idle"
            : row < shootRow + shoot.length
              ? shootDir
              : row < deathRow + death.length
                ? deathDir
                : miningDir;

    // a direcao vem com a marca de quando foi copiada de outra, para
    // o log deixar claro que a linha NAO veio da arte
    const veioDe = lane.substituiu
      ? ` (copiado de ${lane.usado})`
      : "";

    console.log(
      `  ${group.padEnd(6)} ${lane.name.padEnd(12)}${veioDe.padEnd(22)} ` +
        `linha ${String(row).padStart(2)}   ` +
        `frames ${String(lane.frames.length).padStart(2)}   ` +
        `offset ${dx >= 0 ? "+" : ""}${dx},${dy >= 0 ? "+" : ""}${dy}   ` +
        `pes y=${String(info.foot).padStart(2)}   ` +
        `bbox ${info.minX}..${info.maxX} x ${info.minY}..${info.maxY}`,
    );
  }

  for (const corte of [
    ...walkNorm.cortes,
    ...idleNorm.cortes,
    ...shootNorm.cortes,
  ]) {
    console.log(
      `\n  ${corte.name}: ${corte.de} -> ${corte.para} frames ` +
        `(o grupo foi cortado no menor, para o passo nao mudar ` +
        `de direcao para direcao)`,
    );
  }

  if (repairs.length > 0) {
    console.log("\nframes reparados (stream LZW truncado no gif):");

    for (const repair of repairs) {
      console.log(
        `  ${repair.dir ? `${repair.dir}/` : ""}${repair.name}.gif ` +
          `frame ${repair.index} -> copiado do frame ${repair.from} ` +
          `(${repair.written}/${frameSize * frameSize} pixels)`,
      );
    }
  }

  if (drops.length > 0) {
    console.log("\nframes descartados (stream LZW truncado no gif):");

    for (const drop of drops) {
      console.log(
        `  ${drop.name}.gif frame ${drop.index} ` +
          `(${drop.written}/${frameSize * frameSize} pixels)`,
      );
    }
  }

  console.log(
    `\nconstantes para o modulo de layout:` +
      `\n  celula ${frameSize}x${frameSize}` +
      `\n  ${prefix}_WALK_FRAMES = ${walkNorm.alvo}` +
      (idle.length > 0
        ? idle.length > 1
          ? `\n  ${prefix}_IDLE_FRAMES = ${idleNorm.alvo}` +
            `\n  ${prefix}_IDLE_ROW_OFFSET = ${idleRow}` +
            "\n  (idle por direcao: use rowOffset, nunca row)"
          : `\n  ${prefix}_IDLE_FRAMES = ${idle[0].frames.length}` +
            `\n  ${prefix}_IDLE_ROW = ${idleRow}`
        : "\n  (sem idle: aponte o idle para o frame 0 do walk)") +
      (shoot.length > 0
        ? `\n  ${prefix}_${shootDir.toUpperCase()}_FRAMES = ${shootNorm.alvo}` +
          `\n  ${prefix}_${shootDir.toUpperCase()}_ROW = ${shootRow}`
        : "\n  (sem golpe: a arte nao tem ataque)") +
      (death.length > 0
        ? `\n  ${prefix}_${deathDir.toUpperCase()}_FRAMES = ${death[0].frames.length}` +
          `\n  ${prefix}_${deathDir.toUpperCase()}_ROW = ${deathRow}` +
          "\n  (a morte e uma linha so: use row, nunca rowOffset)"
        : "\n  (sem morte: o bicho some na hora)") +
        /*
    A mineracao e o ULTIMO ciclo impresso, pela mesma razao da morte:
    quando e lane unica, entra por `row` e nao por `rowOffset`.

    Com as oito direcoes o texto muda: o layout passa a ler por
    `rowOffset`, porque a linha do angulo e a do ciclo MAIS o
    deslocamento — e e o que o `idle` e o `shoot` ja fazem
  */
        (mining.length > 0
          ? mining.length === 1
            ? `\n  ${prefix}_${miningDir.toUpperCase()}_FRAMES = ` +
                `${mining[0].frames.length}` +
              `\n  ${prefix}_${miningDir.toUpperCase()}_ROW = ${miningRow}` +
              "\n  (a mineracao e uma linha so: use row, nunca rowOffset)"
            : `\n  ${prefix}_${miningDir.toUpperCase()}_FRAMES = ` +
                `${Math.min(...mining.map((l) => l.frames.length))}` +
              `\n  ${prefix}_${miningDir.toUpperCase()}_ROW_OFFSET = ${miningRow}` +
              "\n  (mineracao por direcao: use rowOffset, nunca row)"
          : "") +
      `\n  ${prefix}_COLUMNS = ${columns}` +
      `\n  ${prefix}_ANCHOR_X = ${walkAnchor.targetCenter / 2}` +
      `\n  ${prefix}_ANCHOR_Y = ${walkAnchor.targetFoot}`,
  );

  console.log(
    `\nvalidacao: ${verified.cells} celulas, ` +
      `${verified.opaquePixels} pixels opacos, ` +
      "0 divergencia com o png gerado",
  );

  console.log(
    `            ${report.touching} celulas encostando na borda, ` +
      `${report.empty} vazias, ` +
      `${report.squashed.length} com personagem incompleto`,
  );

  const spread = {
    foot: Math.max(...report.perRow.map((i) => i.foot)) -
      Math.min(...report.perRow.map((i) => i.foot)),
    center: Math.max(
      ...report.perRow.map((i) => (i.minX + i.maxX) / 2),
    ) - Math.min(
      ...report.perRow.map((i) => (i.minX + i.maxX) / 2),
    ),
  };

  console.log(
    `            dispersao entre linhas: ` +
      `${spread.foot}px vertical, ${spread.center}px horizontal`,
  );

  console.log(
    `\n-> ${relative(HERE + "/..", output)} (${png.length} bytes)`,
  );

  return {
    name,
    output,
    frameSize,
    width: sheetWidth,
    height: sheetHeight,
    columns,
    rows: lanes.length,
    idleRow: idle.length > 0 ? idleRow : null,

    /**
     * `null` quando o idle e uma linha so.
     *
     * Sao duas coisas diferentes de proposito: o idle unico aponta
     * para uma linha pelo valor absoluto (`row`), e o idle por direcao
     * aponta para o inicio do bloco (`rowOffset`), porque a linha real
     * depende do angulo. Quem ler este retorno precisa saber qual dos
     * dois usar
     */
    idleRowOffset: idle.length > 1 ? idleRow : null,
    idleFrames: idleNorm.alvo > 0
      ? idleNorm.alvo
      : idle[0]?.frames.length ?? 0,
    shootFrames: shoot.length > 0 ? shootNorm.alvo : 0,
    walkFrames: walkNorm.alvo,

    // `null` quando a folha nao tem golpe: e melhor que zero, porque
    // zero parece "um golpe de zero frames"
    shootRow: shoot.length > 0 ? shootRow : null,

// a morte e uma linha so, em qualquer folha que a tenha
deathRow: death.length > 0 ? deathRow : null,
deathFrames: death[0]?.frames.length ?? 0,
    anchorX: walkAnchor.targetCenter / 2,
    anchorY: walkAnchor.targetFoot,

    // as direcoes de tiro que a arte nao tinha e de onde vieram.
    // Fica no retorno para um teste poder afirmar a escolha, e para
    // quem chamar a ferramenta saber o que foi inventado
    substituidas: substitutas.map((lane) => ({
      direcao: lane.name,
      veioDe: lane.usado,
    })),
  };
}

const executadoDireto =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (executadoDireto) {
  // sem argumento, reconstroi todas as folhas: e o que se espera
  // depois de trocar um gif na pasta da arte
  const pedidos = process.argv.slice(2);
  const folhas = pedidos.length > 0 ? pedidos : Object.keys(SHEETS);

  for (const folha of folhas) {
    buildSheet(folha);
  }
}
