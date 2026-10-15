/**
 * ADICIONA AS CAMADAS DE ZONA NO `.tmj` DO MAPA 2.
 *
 * ## POR QUE UM SCRIPT E NÃO O EDITOR
 *
 * Porque o `map_2.tmj` tem 6016 x 4224 pixels de dados de tile, e editar o
 * arquivo na mão para acrescentar doze camadas é pedir para o JSON quebrar no
 * meio. Aqui o arquivo é lido, as camadas são montadas como OBJETO e o
 * resultado é serializado — o que sai é válido por construção
 *
 * ## POR QUE O NOME DA CAMADA É `m2_TREINO` E NÃO `TREINO`
 *
 * Porque no mapa 1 o nome da camada É o id da zona, e o resolvedor procura
 * pelo id. No mapa 2 as zonas tem prefixo: o id é `m2_treino` e o `baseId` é
 * `treino`. Nomear a camada de `treino` faria o desenho existir no editor e
 * nunca ser encontrado por quem procura `m2_treino`
 *
 * ## E O QUE ISSO NAO FAZ
 *
 * Não muda o jogo. As camadas são o que se VÊ no editor do Tiled; o resolvedor
 * de zonas em `registroDeTiles.js` ainda recusa o mapa 2 por
 * `if (zona.mapId !== "map_1") return null`. As zonas do mapa 2 continuam
 * usando o retângulo de `MAP_2_ZONES`, que é código
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ARQUIVO = path.join(
  RAIZ,
  "src",
  "assets",
  "tilesets",
  "map_2",
  "map_2.tmj",
);

/** O MESMO MAPA DO MAPA 1, com o prefixo que o mapa 2 usa. */
const ZONAS = [
  { id: "m2_floresta", x: 64, y: 64, width: 1280, height: 1280 },
  { id: "m2_acampamento", x: 1536, y: 128, width: 1280, height: 1152 },
  { id: "m2_campina", x: 3072, y: 64, width: 1280, height: 1280 },
  { id: "m2_ruinas", x: 4544, y: 128, width: 1344, height: 1152 },
  { id: "m2_treino", x: 2560, y: 1472, width: 1920, height: 1216 },
  { id: "m2_toca", x: 128, y: 1472, width: 1280, height: 1216 },
  { id: "m2_brejo", x: 1536, y: 1408, width: 896, height: 1216 },
  { id: "m2_cripta", x: 4608, y: 1472, width: 1280, height: 1216 },
  { id: "m2_cinzas", x: 64, y: 2880, width: 1344, height: 1216 },
  { id: "m2_dunas", x: 1536, y: 2880, width: 1280, height: 1216 },
  { id: "m2_pedreira", x: 3072, y: 2880, width: 1280, height: 1216 },
  { id: "m2_pantano", x: 4544, y: 2880, width: 1344, height: 1216 },
];

const mapa = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));

/** O que já existe com esses nomes é removido, para rodar duas vezes sem duplicar. */
const nomes = new Set(ZONAS.map((z) => z.id));

mapa.layers = mapa.layers.filter((camada) => !nomes.has(camada.name));

let layerId = mapa.nextlayerid ?? mapa.layers.length + 1;
let objectId = mapa.nextobjectid ?? 1;

/**
 * A ordem de leitura: linha de cima para linha de baixo, e da esquerda para a
 * direita. No mapa 1 o `.tmj` segue essa ordem, e um autor abrindo o mapa 2
 * para procurar o Pantano não deveria passar por onze camadas antes
 */
for (const zona of ZONAS) {
  mapa.layers.push({
    draworder: "topdown",
    id: layerId++,
    name: zona.id,
    objects: [
      {
        height: zona.height,
        id: objectId++,
        name: "",
        opacity: 1,
        rotation: 0,
        type: "",
        visible: true,
        width: zona.width,
        x: zona.x,
        y: zona.y,
      },
    ],
    opacity: 1,
    type: "objectgroup",
    visible: true,
    x: 0,
    y: 0,
  });
}

mapa.nextlayerid = layerId;
mapa.nextobjectid = objectId;

fs.writeFileSync(ARQUIVO, JSON.stringify(mapa, null, 1), "utf8");

console.log(`[mapa 2] ${ZONAS.length} camadas de zona escritas`);
console.log(`[mapa 2] nextlayerid=${mapa.nextlayerid} nextobjectid=${mapa.nextobjectid}`);