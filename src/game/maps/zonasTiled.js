/**
 * AS ZONAS DE MOB DO MAPA 1, lidas do `.tmj`.
 *
 * ## O QUE ISTO TROCA
 *
 * Antes o retangulo de cada zona vivia em `MAP_1_ZONES`, em `data/maps`. O
 * autor ajustava a area de uma zona editando um numero no JavaScript
 *
 * Agora o retangulo vem da camada de objeto do Tiled. Editar a caixa no
 * Tiled e mover a zona no jogo: o rectangulo que voce ve e o retangulo onde
 * o esqueleto nasce
 *
 * ## POR QUE SO O MAPA 1
 *
 * Porque so ele tem `.tmj`. O mapa 2 e uma copia do 1 escrita em codigo, e
 * o hub nao tem zona nenhuma — dar a eles um caminho que le arquivo seria
 * um ramo que so existe para nao happen nunca
 *
 * ## POR QUE O NOME DA CAMADA E O ID DA ZONA
 *
 * Porque e o unico nome que o mapa tem sem ninguem inventar convencao nova.
 * O Tiled nao obriga o autor a nomear o objeto dentro da camada, e um objeto
 * sem nome nao serve para nada
 *
 * O id e o que casa com o `ZONE_ROSTER`: a camada `pantano` vira a zona
 * `pantano`, e e essa linha do roster que continua dizendo quantos
 * esqueletos sao e de que nivel. O Tiled decide ONDE, o roster decide QUEM
 *
 * ## POR QUE A LISTA DE IDS VEM DE PARAMETRO
 *
 * Porque este arquivo nao pode saber os ids: eles moram em
 * `data/enemies`, que importa `data/maps`, e um `import` de la para ca
 * viraria ciclo. Quem chama diz quais ids existem, e este so devolve os que
 * foram pedidos
 *
 * E porque o filtro e uma whitelist, e nao "tudo que nao for parede": uma
 * camada nova com nome errado vira uma zona sem criatura e o autor nao sabe
 * por que o campo esta vazio. Com a whitelist, o aviso sai
 */

/**
 * O RETANGULO DE UMA ZONA.
 *
 * ## POR QUE SO O PRIMEIRO OBJETO
 *
 * Porque uma zona e uma area com nome, e duas areas com o mesmo nome nao
 * formam uma zona: formam duas zonas com o mesmo id, e o `map.zones.find`
 * casaria sempre com a primeira. O autor desenharia duas caixas, veria que so
 * uma valeu, e nao teria aviso
 *
 * ## POR QUE UM RETANGULO COM `gid` NAO CONTA
 *
 * Porque um "Tile Object" tem a imagem como fonte, e o `width`/`height` do
 * objeto sao 0. Sem resolver o tile nao ha como saber o tamanho, e uma zona
 * de 0x0 nao engene o esqueleto em lugar nenhum — o sintoma seria uma zona
 * que existe no arquivo e no minimapa e nunca tem criatura
 *
 * ## E POR QUE CAMADA VAZIA E IGNORADA
 *
 * Porque e o estado normal de um mapa em construcao. Uma zona sem criatura
 * e um esqueleto a menos enquanto voce posiciona a caixa
 */
function retanguloDaCamada(camada) {
  const objetos = (camada.objects ?? []).filter(
    (objeto) =>
      objeto.visible !== false &&
      objeto.gid === undefined &&
      (objeto.width ?? 0) > 0 &&
      (objeto.height ?? 0) > 0,
  );

  return objetos[0] ?? null;
}

/**
 * AS ZONAS QUE O MAPO DECLARA, e so as que o jogo conhece.
 *
 * ## E POR QUE A WHITEST VEM DO ROSTER, E NAO DO `MAP_1_ZONES`
 *
 * Porque o roster e quem diz que uma zona tem criatura. Uma camada `pantano`
 * com o retangulo errado cria os esqueletos no lugar errado — erro visivel.
 * Uma camada `abismo` que ninguem pediu nao criaria criatura nenhuma, e o
 * unico sintoma seria um retangulo no arquivo que o jogo ignora em silencio
 *
 * ## E POR QUE AVISA O QUE FOI DEIXADO DE FORA
 *
 * Porque sem o aviso o autor arrasta uma caixa nova, ve o retangulo no
 * Tiled, e nao entende por que o campo continua vazio. A mensagem diz o
 * nome: ou o nome esta errado, ou ainda nao ha linha de roster
 *
 * @param {object} tmj o JSON do mapa, como veio do arquivo
 * @param {Set<string>|Iterable<string>} idsConhecidos ids que o jogo aceita
 * @returns {{ zonas: Array<object>, ignoradas: string[] }}
 */
export function zonasDeCamadasTiled(tmj, idsConhecidos) {
  const conhecidos = idsConhecidos instanceof Set
    ? idsConhecidos
    : new Set(idsConhecidos ?? []);

  const zonas = [];
  const ignoradas = [];

  for (const camada of tmj?.layers ?? []) {
    if (camada.type !== "objectgroup") continue;

    const nome = (camada.name ?? "").trim();

    if (!nome) continue;

    if (!conhecidos.has(nome)) {
      ignoradas.push(nome);
      continue;
    }

    /**
     * CAMADA ESCONDIDA NAO E ZONA.
     *
     * A mesma regra da colisao e do desenho: o que o jogador nao ve e nao
     * entra no minimapa e nao cria criatura. O autor liga a camada quando a
     * caixa esta no lugar
     */
    if (camada.visible === false) continue;

    const caixa = retanguloDaCamada(camada);

    if (!caixa) {
      ignoradas.push(nome);
      continue;
    }

    zonas.push({
      id: nome,
      x: caixa.x,
      y: caixa.y,
      width: caixa.width,
      height: caixa.height,
    });
  }

  return { zonas, ignoradas };
}