/**
 * AS PAREDES DO TILED VIRARAM COLISAO, dos dois lados.
 *
 * ## POR QUE UM VERIFICADOR E NAO UM TESTE
 *
 * Porque o que precisa ser provado aqui e uma PROPRIEDADE do arquivo e do
 * registro: que os dois lados leem o mesmo `.tmj` e produzem os mesmos
 * retangulos. Isso e leitura de dados e comparacao, nao comportamento
 *
 * ## E POR QUE COMPARAR OS DOIS LADOS E O PONTO INTEIRO
 *
 * Porque a falha nao seria o servidor derrubar â€” seria o servidor ACHANDO QUE
 * ESTA TUDO BEM. Se os lados divergem, o cliente ve parede, o jogador online
 * atravessa, e nenhum dos dois mostra erro nenhum. E um defeito que so
 * aparece jogando
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { solidsDeObjetosTiled, camadasIgnoradasPelaColisao, CAMADA_DE_PAREDE } from "../src/game/maps/colisaoTiled.js";
import { registrarCamadas, colisaoDoMapa } from "../src/game/maps/registroDeTiles.js";
import { registrarTilesDoDisco } from "../server/src/maps/tilesDoDisco.js";
import { MAP_1 } from "../src/data/maps/index.js";
import { CollisionSystem } from "../src/game/collision/CollisionSystem.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const TMJ = resolve(AQUI, "../src/assets/tilesets/map_1/dungeon.tmj");

let ok = 0;
let falhas = 0;

function conferir(condicao, mensagem, detalhe) {
  if (condicao) {
    ok++;
    return;
  }

  falhas++;
  console.error(`  FALHA  ${mensagem}`);

  if (detalhe !== undefined) {
    console.error(`         ${detalhe}`);
  }
}

console.log("\n  AS PAREDES DO TILED VIRARAM COLISAO\n");

const tmj = JSON.parse(readFileSync(TMJ, "utf8"));

// ---------------------------------------------------------------- a camada

/**
 * A CAMADA DE PAREDE, E NAO A PRIMEIRA CAMADA DE OBJETO QUE APARECER.
 *
 * Este arquivo nasceu quando o mapa tinha uma unica camada de objeto. O
 * autor desenhou as zonas em camadas novas depois, e a primeira que o `find`
 * acha passou a ser outra â€” o verificador contava os objetos da camada
 * errada e comparava com os solidos da camada certa
 *
 * O nome e o que amarra a camada, e e o mesmo nome que o `colisaoTiled`
 * le. Se voce renomear a camada, este aviso abaixo vai dizer
 */
const camadaDeObjetos = tmj.layers.find(
  (l) => l.type === "objectgroup" && (l.name ?? "").trim() === CAMADA_DE_PAREDE,
);

conferir(!!camadaDeObjetos, "a camada PAREDES existe", `camadas: ${tmj.layers.map((l) => `"${l.name}"`).join(", ")}`);

const objetos = camadaDeObjetos?.objects ?? [];

conferir(objetos.length > 0, "a camada tem parede desenhada", "ela esta vazia: o jogador nao teria parede nenhuma para bater");

// ------------------------------------------------------- a derivacao pura

const doArquivo = solidsDeObjetosTiled(tmj);

/**
 * TODO OBJETO COM AREA VIROU SOLIDO, E O VAZIO FICOU DE FORA.
 *
 * O Tiled grava `0x0` quando o retangulo e criado e solto sem arrastar. O
 * objeto existe no arquivo e nao tem area, entao nao pode virar parede â€” o
 * que o motor faz esta certo
 *
 * A checagem separa os dois de proposito: sem isso, um retangulo vazio
 * pareceria um defeito do motor, e seriaè„†avel corrigir o motor em vez de
 * arrumar o mapa
 */
const comArea = objetos.filter((o) => (o.width ?? 0) > 0 && (o.height ?? 0) > 0);
const vazios = objetos.filter((o) => !(o.width > 0 && o.height > 0));

conferir(
  doArquivo.length === comArea.length,
  "todo objeto com area virou um solido",
  `${comArea.length} objetos com area -> ${doArquivo.length} solidos (e ${vazios.length} vazios no arquivo)`,
);

conferir(
  vazios.every((o) => !doArquivo.some((s) => s.x === o.x && s.y === o.y)),
  "nenhum retangulo vazio virou parede",
  "um 0x0 nao barra ninguem e so polui o colisor",
);

conferir(
  doArquivo.every((s) => s.kind === "tiled"),
  "todo solido sabe que e parede de mapa",
);

conferir(
  doArquivo.every((s) => s.width > 0 && s.height > 0 && Number.isFinite(s.x) && Number.isFinite(s.y)),
  "todo solido tem tamanho e posicao finitos",
  JSON.stringify(doArquivo),
);

conferir(
  doArquivo.every(
    (s) =>
      s.x >= 0 &&
      s.y >= 0 &&
      s.x + s.width <= tmj.width * tmj.tilewidth &&
      s.y + s.height <= tmj.height * tmj.tileheight,
  ),
  "nenhum solido sai do mapa",
);

// ------------------------------------------- o que entra e o que fica de fora

/**
 * ESTES CASOS PASSAM O NOME DA CAMADA PORQUE O LEITOR SO LE A DECLARADA.
 *
 * Sem `camadaDeParede` eles seriam camadas "(sem nome)", que nao sao parede
 * por regra, e os testes passariam sem provar nada
 */
const comParede = (camada) =>
  solidsDeObjetosTiled({ layers: [camada] }, { camadaDeParede: "PAREDES" });

conferir(
  comParede({ name: "PAREDES", type: "objectgroup", visible: false, objects: objetos }).length === 0,
  "camada escondida nao barra",
  "o jogador nao consegue ver o que o segura",
);

conferir(
  comParede({
    name: "PAREDES",
    type: "objectgroup",
    objects: [{ x: 0, y: 0, gid: 12 }],
  }).length === 0,
  "tile object fica de fora",
  "o tamanho dele vem da folha, que o servidor nao tem",
);

conferir(
  comParede({
    name: "PAREDES",
    type: "objectgroup",
    objects: [{ x: 100, y: 100, width: 64, height: 64, rotation: 45 }],
  })[0]?.width > 64,
  "objeto rodado vira caixa que cobre o original",
);

/**
 * A ZONA NAO VIRA PAREDE.
 *
 * Este e o teste que faltava quando o mapa ganhou as camadas de zona. O
 * leitor pegava toda camada de objeto, e cada uma das 12 zonas virou uma
 * parede invisivel do tamanho da zona: o jogador via o campo livre e ficava
 * travado no meio dele
 */
conferir(
  comParede({
    name: "pantano",
    type: "objectgroup",
    objects: [{ x: 4544, y: 2880, width: 1344, height: 1216 }],
  }).length === 0,
  "camada de zona nao vira parede",
  "o retangulo de uma zona e area de nascimento, nao obstaculo",
);

conferir(
  camadasIgnoradasPelaColisao(tmj).length ===
    tmj.layers.filter((l) => l.type === "objectgroup" && l.name !== "PAREDES").length,
  "as ignoradas sao justamente as que nao sao parede",
);

/**
 * E NO MAPA REAL, AS ZONAS NAO ESTAO ENTRE OS SOLIDOS.
 *
 * O teste de cima usa um mapa de mentira. Este usa o arquivo do jogo, que e
 * onde o defeito aparecia
 */
conferir(
  solidsDeObjetosTiled(tmj).length === comArea.length,
  "o mapa inteiro so produz as paredes da camada PAREDES",
  `${solidsDeObjetosTiled(tmj).length} solidos para ${comArea.length} paredes com area`,
);

// ------------------------------------------------------- o navegador e o Node

registrarCamadas("map_1", { tmj, imagens: {}, tilesets: {} });

const doNavegador = colisaoDoMapa("map_1");

registrarTilesDoDisco();

const doServidor = colisaoDoMapa("map_1");

conferir(
  JSON.stringify(doNavegador) === JSON.stringify(doServidor),
  "os dois lados produzem os mesmos solidos",
  `navegador ${doNavegador.length} / servidor ${doServidor.length}`,
);

conferir(
  doServidor.length === doArquivo.length && doServidor.length > 0,
  "o servidor leu o arquivo do disco",
  `${doServidor.length} solidos no servidor`,
);

conferir(
  colisaoDoMapa("mapa_que_nao_existe").length === 0,
  "mapa sem camada nao inventa parede",
);

// ------------------------------------------------------- o motor usa mesmo

/**
 * O MAPA JA COMO ESTA, com os `bounds` dele.
 *
 * E o `MAP_1` puro de proposito: um `bounds` reescrito aqui passaria num
 * formato que o motor nao entende â€” o dele e `{x, y, width, height}` â€” e o
 * resultado seria "tudo bloqueado", que parece uma parede funcionando
 */
const colisao = new CollisionSystem(MAP_1, doServidor);

conferir(
  colisao.solids.length === doServidor.length,
  "os solidos entram no CollisionSystem",
  `${colisao.solids.length} no sistema`,
);

const parede = doServidor[0];

if (parede) {
  /**
   * ANDAR NA DIRECAO DA PAREDE NAO ATRAVESSA.
   *
   * E o teste que importa: o `CollisionSystem` RECEBER os retangulos e so
   * metade do caminho. O que o jogador sente e se ele e barrado. Um solido
   * registrado que nao barra e um solido inerte â€” e ele pareceria perfeito
   * em qualquer inspecao de codigo
   *
   * O passo e de 400px contra uma parede de 64: nao ha como "passar raspando"
   * por engano de arredondamento, e o `moveEntity` Andar em passos THENFAIL
   */
  const jogador = {
    x: parede.x - 32,
    y: parede.y + parede.height / 2,
    radius: 16,
  };

  colisao.moveEntity(jogador, 400, 0);

  /**
   * ATRAVESSOU E FICAR DO OUTRO LADO.
   *
   * Comparado com a borda de dentro e nao com `parede.x`: um empurrador
   * minimo deixaria o jogador apoiado em `parede.x + 16`, que ja e o miolo da
   * parede e nao o lado de fora dela
   */
  const atravessou = jogador.x > parede.x + parede.width / 2;

  conferir(
    !atravessou,
    "andar contra a parede nao atravessa",
    `parou em x=${jogador.x}, parede em x=${parede.x}..${parede.x + parede.width}`,
  );

  /**
   * E O JOGADOR NASCIDO DENTRO DA PAREDE SAI.
   *
   * Sem isto, uma parede salva no meio do chao tranca quem entra nela: o
   * `resolveOverlap` empurra, mas so se ele chegar ali â€” e quem ja estava la
   * precisa sair pelo mesmo caminho
   */
  const dentroDaParede = {
    x: parede.x + parede.width / 2,
    y: parede.y + parede.height / 2,
    radius: 16,
  };

  colisao.resolveOverlap(dentroDaParede, 16);

  const continuaDentro =
    dentroDaParede.x > parede.x &&
    dentroDaParede.x < parede.x + parede.width &&
    dentroDaParede.y > parede.y &&
    dentroDaParede.y < parede.y + parede.height;

  conferir(
    !continuaDentro,
    "quem nasce dentro da parede e expulso",
    `ficou em x=${dentroDaParede.x} y=${dentroDaParede.y}`,
  );

  /**
   * O LADO DE DENTRO DO MAPA SEGUE ANDANDO.
   *
   * A parede vira solido pelo `extraSolids` e nao por `map.solids`, entao o
   * risco aqui e o oposto do teste anterior: um retangulo de tamanho errado,
   * ou derivado em escala errada, efecha o mapa inteiro. Este jogador anda no
   * chao, longe de tudo, e precisa andar
   */
  const noChao = {
    x: tmj.tilewidth * 10,
    y: tmj.tileheight * 10,
    radius: 16,
  };

  const antes = { x: noChao.x, y: noChao.y };

  colisao.moveEntity(noChao, 64, 0);

  conferir(
    noChao.x > antes.x,
    "o chao longe da parede continua andando",
    `x=${noChao.x}`,
  );
}

console.log(`\n  ${ok} ok, ${falhas} falhas\n`);

process.exit(falhas ? 1 : 0);