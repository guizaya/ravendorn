/**
 * Confere se as criaturas do relatorio de farm offline sao distinguiveis
 * pelo NOME.
 *
 * O jogo tem duas criaturas chamadas "Goblin" — `ogre_da_predeira` e
 * `ogre`. O relatorio agrupa por `typeId`, entao as duas entram como duas
 * linhas, e sem o nivel o jogador leria a mesma palavra duas vezes com
 * numeros diferentes
 *
 * Uso: node tools/conferir-mobs-farm.mjs
 */
import { iniciar, resolver } from "../src/game/progression/OfflineFarm.js";

const HORA = 3_600_000;
const AGORA = 1_700_000_000_000;

const CENARIOS = [
  { nivel: 1, attack: 3, mapaId: "map_1", horas: 2 },
  { nivel: 4, attack: 13, mapaId: "map_1", horas: 2 },
  { nivel: 10, attack: 32, mapaId: "map_1", horas: 4 },
  { nivel: 15, attack: 48, mapaId: "map_1", horas: 4 },
  { nivel: 25, attack: 80, mapaId: "map_2", horas: 6 },
  { nivel: 30, attack: 96, mapaId: "map_2", horas: 8 },
];

let colisoes = 0;

for (const c of CENARIOS) {
  const estado = iniciar(null, { agora: AGORA, mapaId: c.mapaId });

  const { relatorio } = resolver({
    estado,
    jogador: { level: c.nivel, attack: c.attack },
    agora: AGORA + c.horas * HORA,
  });

  console.log(
    `\n  ${c.mapaId} · nv ${c.nivel} · ${c.horas}h` +
      `  (abates: ${relatorio.abates})`,
  );

  const linhas = new Set();

  for (const mob of relatorio.mobs) {
    const acima = mob.nivel > c.nivel;

    console.log(
      `    ${`${mob.nome} Nv ${mob.nivel}`.padEnd(24)}` +
        `${String(mob.abates).padStart(6)}   ` +
        `${mob.typeId}${acima ? '   <- um acima' : ''}`,
    );

    linhas.add(`${mob.nome} Nv ${mob.nivel}`);
  }

  /**
   * O QUE SE REPETE E A LINHA INTEIRA, e nao so o nome.
   *
   * O jogo tem duas criaturas chamadas "Goblin" — `ogre_da_predeira` e
   * `ogre` — e o catalogo mantem os dois nomes porque o id e o que o
   * bestiario, as missoes de cacada e os `mix` de zona usam para achar a
   * criatura. O que a tela mostra e "NOME Nv NIVEL", entao duas linhas
   * iguais no relatorio so acontecem quando nome E nivel coincidem
   */
  if (linhas.size !== relatorio.mobs.length) {
    colisoes += 1;

    console.log(
      `    !! ${relatorio.mobs.length - linhas.size} linha(s) repetida(s)` +
        " — nome e nivel iguais",
    );
  }
}

console.log(
  colisoes === 0
    ? "\n  nenhuma colisao de nome: todas se distinguem\n"
    : `\n  ${colisoes} cenario(s) com colisao\n`,
);