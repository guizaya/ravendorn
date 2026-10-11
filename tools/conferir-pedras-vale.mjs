/**
 * CONFERE ONDE AS PEDRAS DO VALE CAIRAM.
 *
 * Existe por causa de um risco concreto do `placeProps`: ele descarta em
 * silencio a prop que nao coube nas 40 tentativas e devolve so o que place
 * (`return placed`). Com o sorteio uniforme num mapa de 5920x4120 isso
 * nunca acontecia. Ao distribuir as pedras num anel, a chance de uma pedra
 * nao couber e o gargalo passa a ser o centro livre e o espaco entre elas
 *
 * (build nao pega isso: e dado, nao sintaxe.)
 */
import {
  MAP_1_BOUNDS,
  MAP_1_SPAWN,
  MAP_TESTE,
} from "../src/data/maps/index.js";

const ZONA_LIVRE = { largura: 2200, altura: 1700 };

const props = MAP_TESTE.props ?? [];
const pedras = props.filter((p) => String(p.type).startsWith("cristal"));

const margemX = MAP_1_BOUNDS.x + 70;
const margemY = MAP_1_BOUNDS.y + 70;
const larguraUtil = MAP_1_BOUNDS.width - 140;
const alturaUtil = MAP_1_BOUNDS.height - 140;
const centroX = margemX + larguraUtil / 2;
const centroY = margemY + alturaUtil / 2;

const porTipo = {};
for (const p of pedras) porTipo[p.type] = (porTipo[p.type] ?? 0) + 1;

console.log(`  pedras geradas: ${pedras.length}`);
console.log(`  por tipo: ${JSON.stringify(porTipo)}`);

const dentroDoCentro = (p) =>
  Math.abs(p.x - centroX) <= ZONA_LIVRE.largura / 2 &&
  Math.abs(p.y - centroY) <= ZONA_LIVRE.altura / 2;

const noCentro = pedras.filter(dentroDoCentro);
console.log(`\n  dentro da zona livre: ${noCentro.length}`);
for (const p of noCentro) {
  console.log(`    (${p.x},${p.y}) ${p.type}`);
}

/**
 * O ANEL EM OITO SETORES.
 *
 * E o teste que pega o erro da versao dos cantos: os quatro bolsos
 * encheriam e o meio das bordas ficaria vazio. Oito setores dao conta de
 * "distribuido em todos os locais", porque quem so mede os quatro cantos
 * passa num anel concentrateso nos extremos
 */
const meioX = margemX + larguraUtil / 2;
const meioY = margemY + alturaUtil / 2;
const faixaX = larguraUtil / 2;
const faixaY = alturaUtil / 2;

const setores = Array.from({ length: 8 }, () => 0);
for (const p of pedras) {
  const dx = p.x - meioX;
  const dy = p.y - meioY;
  // angulo em 8 setores de 45 graus, comecando em 0 = direita
  let ang = Math.atan2(dy, dx) + Math.PI;
  if (ang < 0) ang += Math.PI * 2;
  const setor = Math.floor((ang / (Math.PI * 2)) * 8) % 8;
  setores[setor] += 1;
}

const nomes = ["leste", "nordeste", "norte", "noroeste", "oeste", "sudoeste", "sul", "sudeste"];
console.log(`\n  distribuicao no anel (8 setores):`);
const vazios = [];
setores.forEach((n, i) => {
  if (n === 0) vazios.push(nomes[i]);
  console.log(`    ${nomes[i].padEnd(9)} ${n}`);
});

const longeDoCentro = pedras.filter((p) => !dentroDoCentro(p));
const maisLonge = longeDoCentro.reduce((max, p) => {
  const d = Math.hypot(p.x - centroX, p.y - centroY);
  return d > max.d ? { d, p } : max;
}, { d: 0, p: null });

const maisPerto = longeDoCentro.reduce((min, p) => {
  const d = Math.hypot(p.x - centroX, p.y - centroY);
  return d < min.d ? { d, p } : min;
}, { d: Infinity, p: null });

console.log(`\n  mais perto do centro: ${maisPerto.d.toFixed(0)}px (${maisPerto.p.type})`);
console.log(`  mais longe do centro: ${maisLonge.d.toFixed(0)}px (${maisLonge.p.type})`);

const doSpawn = pedras.filter(
  (p) => Math.hypot(p.x - MAP_1_SPAWN.x, p.y - MAP_1_SPAWN.y) < 180 + p.radius,
);
console.log(`  pedras em cima do spawn: ${doSpawn.length}`);

const arteVaza = pedras.filter(
  (p) =>
    p.x - (p.radius ?? 0) < MAP_1_BOUNDS.x ||
    p.y - (p.radius ?? 0) < MAP_1_BOUNDS.y ||
    p.x + (p.radius ?? 0) > MAP_1_BOUNDS.x + MAP_1_BOUNDS.width ||
    p.y + (p.radius ?? 0) > MAP_1_BOUNDS.y + MAP_1_BOUNDS.height,
);
console.log(`  pedras com arte fora do limite: ${arteVaza.length}`);

console.log(`\n  ${vazios.length ? "ATENCAO: setores vazios -> " + vazios.join(", ") : "nenhum setor vazio: anel todo ocupado"}`);