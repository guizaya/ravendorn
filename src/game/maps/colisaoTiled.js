/**
 * AS PAREDES DO TILED VIRARAM SOLIDOS.
 *
 * ## POR QUE ISTO LE O `.tmj` CRU E NAO PASSA PELO `lerMapaTiled`
 *
 * Porque a colisao nao precisa de folha de tiles, nem de imagem, nem de
 * `gid`. Um retangulo de objeto tem `x`, `y`, `width` e `height` em pixels
 * de mundo, e ele esta no arquivo tanto quanto o resto
 *
 * Passar pelo `lerMapaTiled` obrigaria o servidor a ter a imagem do tileset
 * para chegar a um numero que ja esta em texto — e o servidor nao tem
 * imagem nenhuma
 *
 * ## POR QUE UM RETANGULO POR OBJETO, E NAO POR TILE
 *
 * ## POR QUE SO A CAMADA DE OBJETOS
 *
 * Porque a camada de tiles nao diz o que e parede. Um tile de parede e um
 * tile de chao no arquivo do Tiled: a diferenca esta em qual deles o
 * jogador PINTOU, e o jogo so sabe disso lendo a imagem
 *
 * A camada de objetos e a unica em que o mapa declara "aqui e solido", e e
 * por isso que ela existe separada da camada de desenho
 */

/**
 * O OBJETO E UM RETANGULO QUE A GENTE PODE USAR?
 *
 * ## POR QUE OBJETO COM `gid` NAO ENTRA
 *
 * Porque um "Tile Object" tem a imagem do tileset como fonte, e o tamanho
 * dele vem do tile — o `width`/`height` do objeto sao 0. Sem resolver o tile
 * nao ha como saber o tamanho, e um retangulo de 0x0 nao barra ninguem: o
 * jogador atravessaria a parede e o codigo nao diria nada
 *
 * ## E POR QUE `rotation` VIRA CAIXA CIRCUMSCRITA
 *
 * Porque a `CollisionSystem` so:testa retangulo alinhado aos eixos. Um
 * objeto rodado de 30 graus tem um retangulo delimitante MAIOR que ele, e
 * esse retangulo seria a parede
 *
 * E maior demais em vez de torto: o jogador escorrega na diagonal perto da
 * ponta, o que se ve como "a parede tem um cantoodd", e nao como buraco
 */
function retanguloUsavel(objeto) {
  if (!objeto || objeto.visible === false) return null;

  // tile object: o tamanho vem do tile, e o jogo nao tem a folha
  if (objeto.gid !== undefined) return null;

  const largura = objeto.width ?? 0;
  const altura = objeto.height ?? 0;

  if (largura <= 0 || altura <= 0) return null;

  if (!objeto.rotation) {
    return {
      x: objeto.x,
      y: objeto.y,
      width: largura,
      height: altura,
    };
  }

  const radianos = (objeto.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radianos));
  const sen = Math.abs(Math.sin(radianos));

  const caixaLargura = largura * cos + altura * sen;
  const caixaAltura = largura * sen + altura * cos;

  const centroX = objeto.x + largura / 2;
  const centroY = objeto.y + altura / 2;

  return {
    x: Math.round(centroX - caixaLargura / 2),
    y: Math.round(centroY - caixaAltura / 2),
    width: Math.round(caixaLargura),
    height: Math.round(caixaAltura),
  };
}

/**
 * O NOME DA CAMADA QUE E PAREDE.
 *
 * ## POR QUE UM NOME, E NAO "TODA CAMADA DE OBJETO"
 *
 * Porque "toda camada de objeto" parou de valer no dia que o mapa ganhou
 * zonas. As zonas tambem sao retangulo numa camada de objeto, e elas NAO
 * sao parede: sao onde a criatura nasce. Um leitor que pega todas transformava
 * cada zona numa parede invisivel do tamanho da zona, e o sintoma era o
 * jogador travado no meio de uma area que ele nem via bloqueada
 *
 * ## E POR QUE NOMEAR A PAREDE E MAIS SEGURO DO QUE O CONTRARIO
 *
 * As duas regras que nao deu para usar:
 *
 * - "toda camada cujo nome nao parece zona e parede" — um nome digitado errado
 *   vira uma parede invisivel atravessando o mapa inteiro
 * - "toda camada de objeto e parede, menos as de zona" — mesmo problema, so
 *   que agora o problema nasce de um id de zona inexistente
 *
 * Nomeando a PAREDE, o erro vai para o outro lado: renomear a camada faz as
 * paredes deixarem de barrar, e o jogador atravessa o que ele ve. Percebido em
 * um segundo, e destravado com uma edicao
 *
 * ## E O QUE ACONTECE COM AS OUTRAS CAMADAS
 *
 * Sao ignoradas, e o registro avisa uma vez por mapa quais foram. O aviso e
 * de leitura, nao de erro: uma camada de zona ignorada pela colisao e o
 * resultado esperado, e silenciar isso seria o mesmo que esconder o
 * descaso de uma camada nova que o autor achou que era parede
 */
export const CAMADA_DE_PAREDE = "PAREDES";

/**
 * AS CAMADAS DE OBJETO QUE A COLISAO NAO LER, e o motivo de cada uma.
 *
 * Serve para o registro dizer o que ele deixou de lado. Uma lista vazia
 * significa que o mapa so tem a camada de parede
 */
export function camadasIgnoradasPelaColisao(
  tmj,
  { camadaDeParede = CAMADA_DE_PAREDE } = {},
) {
  const ignoradas = [];

  for (const camada of tmj?.layers ?? []) {
    if (camada.type !== "objectgroup") continue;

    const nome = (camada.name ?? "").trim();

    if (nome === camadaDeParede) continue;

    ignoradas.push(nome || "(sem nome)");
  }

  return ignoradas;
}

/**
 * TODOS OS SOLIDOS DE UM MAPA DO TILED, no formato do motor.
 *
 * ## E O FORMATO QUE A `CollisionSystem` JA CONSOME
 *
 * `{ x, y, width, height }` em pixels de mundo, com `x`/`y` no canto. E o
 * mesmo que `buildPropSolids` produz para as arvores — por isso estes
 * retangulos entram pelo `extraSolids` e se somam aos outros sem nenhum
 * caminho novo no motor
 *
 * ## E POR QUE `kind` E "tiled"
 *
 * Porque o motor usa `kind` para saber o que e quando algo da para pegar
 * fogo, ser cortado ou subir em cima. Uma parede desenhada no mapa nao e
 * nenhuma dessas coisas, e um `kind` honesto evita que um tratamento de arvore
 * aqui errado caia nela
 *
 * @param {object} tmj o JSON do mapa, como veio do arquivo
 * @param {{camadaDeParede?: string}} [opcoes]
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export function solidsDeObjetosTiled(tmj, { camadaDeParede = CAMADA_DE_PAREDE } = {}) {
  const camadas = tmj?.layers ?? [];

  const saida = [];

  for (const camada of camadas) {
    if (camada.type !== "objectgroup") continue;

    /**
     * SO A CAMADA DE PAREDE ENTRA AQUI.
     *
     * As demais camadas de objeto do mapa sao as ZONAS, e zona e area de
     * nascimento, nao obstaculo. Sem esta linha cada uma das 12 virava uma
     * parede invisivel do tamanho da zona
     */
    if ((camada.name ?? "").trim() !== camadaDeParede) continue;

    /**
     * UMA CAMADA ESCONDIDA NAO BARRADA.
     *
     * E o mesmo que o motor faz com o desenho: uma parede que o jogador nao
     * ve e nao pode estar no caminho dele. Deixar a camada escondida colidindo
     * e o pior dos dois mundos — o boneco trava num lugar que ele nao
     * entende
     */
    if (camada.visible === false) continue;

    for (const objeto of camada.objects ?? []) {
      const caixa = retanguloUsavel(objeto);

      if (!caixa) continue;

      saida.push({ ...caixa, kind: "tiled" });
    }
  }

  return saida;
}