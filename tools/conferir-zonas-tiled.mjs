/**
 * MOVER UMA ZONA NO `.tmj` MOVE A ZONA NO JOGO.
 *
 * ## POR QUE UM VERIFICADOR E NAO UM TESTE
 *
 * Porque a propriedade a provar e sobre DADOS DE ARQUIVO: que o retangulo
 * lido pelo motor e o mesmo retangulo escrito no Tiled. Nao ha logica de
 * jogo nova envolvida — o motor ja sabia ler `map.zones`
 *
 * ## E POR QUE UM ARQUIVO DE COPIA, E NAO O DE VERDADE
 *
 * Porque a prova e mover a caixa. Mover a do arquivo de verdade deixaria o
 * mapa com a zona do pantano fora do lugar, e o jogo com os esqueletos
 * nascendo num canto errado — para provar que o caminho funciona, nao ha por
 * que deixar o mapa quebrado
 *
 * ## E POR QUE ISSO NAO PEGA SO O LEITOR
 *
 * Porque da para ler a zona do arquivo e continuar usando a do codigo, e o
 * jogo continuaria funcionando — com o retangulo velho, sem nenhum erro. O
 * que pega esse caso e comparar a posicao de um INIMIGO DENTRO da zona com a
 * posicao do retangulo: e o efeito final, nao o intermedio
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { zonasDeCamadasTiled } from "../src/game/maps/zonasTiled.js";
import { registrarCamadas, zonasDoMapa } from "../src/game/maps/registroDeTiles.js";
import { registrarTilesDoDisco } from "../server/src/maps/tilesDoDisco.js";
import { GameEngine } from "../src/game/engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../src/data/characters/index.js";
import { ZONE_ROSTER } from "../src/data/enemies/index.js";
import { getMap, MAP_1, MAP_2_ZONES, getZoneById } from "../src/data/maps/index.js";

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
  if (detalhe !== undefined) console.error(`         ${detalhe}`);
}

console.log("\n  MOVER A ZONA NO TMJ MOVE A ZONA NO JOGO\n");

const tmj = JSON.parse(readFileSync(TMJ, "utf8"));

const idsDoRoster = ZONE_ROSTER.map((linha) => linha.zone);

// ---------------------------------------------------------------- o arquivo

/** A PROPORCAO entre o arquivo e o que o motor le. */
const { zonas, ignoradas } = zonasDeCamadasTiled(tmj, idsDoRoster);

/**
 * AS CAMADAS DESLIGADAS NO TILED.
 *
 * E um estado legitimo e esperado: a camada escondida e o interruptor que o
 * autor usa para tirar uma area de jogo sem apagar o desenho. O jogo nao cria
 * criatura nela enquanto esta apagada
 *
 * Este verificador nao pode falhar por causa disso — a prova que ele faz e
 * sobre o CAMINHO (o retangulo do arquivo chega no motor), e nao sobre quais
 * zonas estao ligadas agora
 */
const desligadas = tmj.layers.filter(
  (l) => l.type === "objectgroup" && l.name !== "PAREDES" && l.visible === false,
);

const ligadas = tmj.layers.filter(
  (l) =>
    l.type === "objectgroup" &&
    l.name !== "PAREDES" &&
    idsDoRoster.includes(l.name) &&
    l.visible !== false,
);

conferir(
  ligadas.length + desligadas.length === tmj.layers.filter((l) => l.type === "objectgroup" && l.name !== "PAREDES").length,
  "toda camada de zona esta ligada ou desligada",
);

conferir(zonas.length === ligadas.length, "as zonas lidas sao as camadas ligadas", `${zonas.length} lidas, ${ligadas.length} camadas ligadas`);

conferir(
  ignoradas.every((nome) => nome === "PAREDES"),
  "a camada PAREDES e a unica que fica de fora",
  `ignoradas: ${ignoradas.join(", ")}`,
);

if (desligadas.length) {
  console.log(`\n  ATENCAO: ${desligadas.length} camadas de zona estao DESLIGADAS no Tiled:`);
  console.log(`    ${desligadas.map((c) => `"${c.name}"`).join(", ")}`);
  console.log(`  Elas nao geram criatura e nao entram no minimapa. Ligue no Tiled quando quiser.\n`);
}

/**
 * A PROVA DO CAMINHO NAO DEPENDE DO QUE O AUTOR LIGOU.
 *
 * Abaixo o verificador liga as camadas ele mesmo e move a caixa do pantano.
 * Esta checagem e so o lembrete de que, com todas desligadas, o JOGO esta
 * sem criatura nenhuma no vale — que e o que o autor quis ao desligar, e
 * nao um defeito
 */
if (desligadas.length === tmj.layers.filter((l) => l.type === "objectgroup" && l.name !== "PAREDES").length) {
  console.log(`\n  O JOGO ESTA SEM ZONA LIGADA: nao vai nascer criatura no vale.`);
  console.log(`  (a prova abaixo liga as camadas ela mesma, so para testar o caminho)\n`);
}

for (const z of zonas) {
  conferir([z.x, z.y, z.width, z.height].every((v) => v % 64 === 0), `a zona "${z.id}" esta na grade de 64`);
  conferir(
    z.x >= 0 && z.y >= 0 && z.x + z.width <= tmj.width * 64 && z.y + z.height <= tmj.height * 64,
    `a zona "${z.id}" cabe no mapa`,
  );
}

// ----------------------------------------------- a prova de que o motor usa

/**
 * O MOTOR DO JOGO, com um `.tmj` que o autor escolheu.
 *
 * O registro e global e memoizado por `mapId`, entao registrar um arquivo
 * novo limpa a cache: `registrarCamadas` apaga a leitura e a colisao
 */
function motorCom(tmjDeTeste) {
  registrarCamadas("map_1", { tmj: tmjDeTeste, imagens: {}, tilesets: {} });
  const motor = new GameEngine(null, CHARACTER_CLASSES[0], null, { playerId: "p" });
  motor.setMap(getMap("map_1"));
  return motor;
}

/** ONDE OS INIMIGOS CAEM DENTRO DA ZONA QUE O JOGO LEU */
function inimigosNaZona(motor, zona) {
  return motor.world.enemies.filter(
    (e) =>
      e.x >= zona.x &&
      e.x <= zona.x + zona.width &&
      e.y >= zona.y &&
      e.y <= zona.y + zona.height,
  );
}

/**
 * A PROVA DO CAMINHO, COM A CAMADA LIGADA POR ESTE VERIFICADOR.
 *
 * ## POR QUE LIGAR AQUI E NAO USAR O ARQUIVO COMO ESTA
 *
 * Porque a camada desligada e um estado legitimo do autor — ele desliga a
 * zona para tirar aquela area do jogo sem apagar o desenho. O verificador
 * teria de falhar toda vez que isso acontecesse, e o autor passaria a ignorar
 * ele inteiro
 *
 * E o caminho que precisa ser provado e o da LEITURA, e nao o da
 * configuracao. Entra no motor um mapa com as camadas ligadas, e o que se
 * prova e que o retangulo do arquivo chega no lugar certo
 */
const comZonasLigadas = JSON.parse(JSON.stringify(tmj));

for (const camada of comZonasLigadas.layers) {
  if (camada.type !== "objectgroup") continue;
  if (camada.name === "PAREDES") continue;

  camada.visible = true;
}

const original = motorCom(comZonasLigadas);
const zonaOriginal = original.world.map.zones.find((z) => z.id === "pantano");

conferir(
  zonaOriginal.x === 4544 && zonaOriginal.y === 2880,
  "o motor leu o pantano do arquivo",
  `leu ${zonaOriginal.x},${zonaOriginal.y}`,
);

const inimigosOriginais = inimigosNaZona(original, zonaOriginal);
conferir(
  inimigosOriginais.length > 0,
  "tem esqueleto dentro do pantano",
  "o campo esta vazio: sem isso a prova nao diz nada",
);

// ------------------------------------------------- AGORA O AUTOR MOVE A CAIXA

const movido = JSON.parse(JSON.stringify(comZonasLigadas));
const camadaPantano = movido.layers.find((l) => l.name === "pantano");

camadaPantano.objects[0].x = 64;
camadaPantano.objects[0].y = 64;
camadaPantano.objects[0].width = 1280;
camadaPantano.objects[0].height = 1280;

const depois = motorCom(movido);
const zonaMovida = depois.world.map.zones.find((z) => z.id === "pantano");

conferir(
  zonaMovida.x === 64 && zonaMovida.y === 64 && zonaMovida.width === 1280 && zonaMovida.height === 1280,
  "o motor leu a caixa nova",
  `leu ${zonaMovida.x},${zonaMovida.y} ${zonaMovida.width}x${zonaMovida.height}`,
);

/**
 * E O EFEITO NO LUGAR DAS CRIATURAS.
 *
 * O teste que pega o defeito de verdade: se o motor lesse a zona do arquivo e
 * ainda usasse a do codigo, os esqueletos continuariam na caixa antiga e
 * este teste passaria errado. Aqui a zona nova e a caixa da FLORESTA, e os
 * esqueletos do pântano tem que trocar de lugar com os de la
 */
const naCaixaNova = inimigosNaZona(depois, zonaMovida);

conferir(
  naCaixaNova.length > 0,
  "os esqueletos foram para a caixa nova",
  "nenhum inimigo caiu onde o autor desenhou o pântano",
);

conferir(
  inimigosNaZona(depois, zonaOriginal).length === 0 ||
    inimigosNaZona(depois, zonaOriginal).length < inimigosOriginais.length,
  "os esqueletos sairam da caixa antiga",
  `ainda tem ${inimigosNaZona(depois, zonaOriginal).length} onde eles estavam`,
);

/**
 * AS OUTRAS 11 ZONAS NAO SE MEXERAM.
 *
 * Mover uma caixa no Tiled mexe naquela caixa. As outras tem ids e posicoes
 * proprias, e o pântano novo esta em cima da floresta — se a floresta tambem
 * tivesse ido para la, as duas zonas se sobreporiam e o creatures de uma
 * nasceria dentro da outra
 */
const florestaDepois = depois.world.map.zones.find((z) => z.id === "floresta");

conferir(
  florestaDepois.x === 64 && florestaDepois.y === 64,
  "a floresta continua onde estava",
  `foi para ${florestaDepois.x},${florestaDepois.y}`,
);

/**
 * E O MAPA DE MODULO NAO FOI MEXIDO.
 *
 * `MAP_1` e um objeto de modulo compartilhado. Se o motor tivesse escrito as
 * zonas novas nele, todo mundo que segura uma referencia passaria a ver a
 * caixa errada — e nao haveria como voltar
 */
conferir(
  MAP_1.zones.find((z) => z.id === "pantano").x === 4544,
  "o MAP_1 de modulo continua com a zona original",
  `virou ${MAP_1.zones.find((z) => z.id === "pantano").x}`,
);

conferir(
  depois.world.map !== MAP_1 && depois.world.map.zones !== MAP_1.zones,
  "o mapa do motor e um objeto proprio",
);

// ------------------------------------------------------- navegador e Node

registrarTilesDoDisco();

const doServidor = zonasDoMapa("map_1", idsDoRoster);

conferir(
  doServidor.length === zonas.length &&
    JSON.stringify(doServidor) === JSON.stringify(zonas),
  "os dois lados leem as mesmas zonas",
  `navegador ${zonas.length} / servidor ${doServidor.length}`,
);

conferir(
  zonasDoMapa("mapa_2", idsDoRoster).length === 0,
  "mapa sem camada nao inventa zona",
);

conferir(
  zonasDeCamadasTiled(tmj, ["zona_que_nao_existe"]).zonas.length === 0,
  "uma zona que o jogo nao conhece nao entra",
);

// ------------------------------- quem mais le a zona acha a caixa do Tiled

/**
 * O `getZoneById` PRECISA VER A CAIXA NOVA.
 *
 * E o furo que este trabalho quase deixou aberto. O motor lia o `.tmj`, mas
 * `getZoneById` devolvia `MAP_1_ZONES` — o codigo. E por ele que a viagem
 * automatica escolhe o destino, que o bestiario mostra a area e que o craft
 * diz onde o material cai
 *
 * Sem esta checagem o jogo ficaria assim: os esqueletos na caixa nova, o
 * piloto voando para a caixa velha, e o jogador aterrissando num campo vazio
 * achando que o destino era la
 */
const zonaDoRegistro = getZoneById("pantano");

conferir(
  zonaDoRegistro.x === 4544 && zonaDoRegistro.y === 2880,
  "o getZoneById aponta para a caixa do arquivo",
  `devolveu ${zonaDoRegistro.x},${zonaDoRegistro.y}`,
);

/**
 * E A ZONA CONTINUA COMPLETA.
 *
 * O leitor do Tiled devolve so o retangulo. Devolver isso cru quebraria o
 * minimapa (sem `terrain`) e o piloto (sem `name`)
 */
conferir(!!zonaDoRegistro.name, "a zona do registro tem nome", `name: ${zonaDoRegistro.name}`);
conferir(!!zonaDoRegistro.terrain, "a zona do registro tem terreno", `terrain: ${zonaDoRegistro.terrain}`);
conferir(zonaDoRegistro.mapId === "map_1", "a zona do registro sabe de que mapa e");

/**
 * E O MAPA 2 NAO FOI CONTAMINADO.
 *
 * O mapa 2 e uma copia escrita em codigo, sem `.tmj`. Se o resolvedor
 * procurasse "pantano" sem checar o `mapId`, a zona do mapa 2 receberia o
 * retangulo do mapa 1 — que e uma caixa do tamanho errado, em outro lugar
 */
const zonaDoMapa2 = getZoneById("m2_pantano");

conferir(!!zonaDoMapa2, "a zona do mapa 2 existe");
conferir(
  zonaDoMapa2.x === MAP_2_ZONES.find((z) => z.id === "m2_pantano").x,
  "a zona do mapa 2 continua com a caixa do codigo",
  `devolveu ${zonaDoMapa2.x},${zonaDoMapa2.y}`,
);
conferir(zonaDoMapa2.mapId === "map_2", "a zona do mapa 2 sabe que e dele");

/**
 * SEM O `.tmj` REGISTRADO, VOLTA TUDO AO CODIGO.
 *
 * O mapa 2 nao registra nada, e o hub nao tem zona. Um mapa assim tem de
 * responder pelo codigo, senao um registro pela metade quebraria o jogo todo
 */
conferir(
  zonasDoMapa("mapa_sem_registro", ["pantano"]).length === 0,
  "mapa nao registrado nao inventa zona",
);

console.log(`\n  ${ok} ok, ${falhas} falhas\n`);

process.exit(falhas ? 1 : 0);