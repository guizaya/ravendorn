import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { isCreatureMoving } from "../sprites/animation.js";
import { createCreature } from "../../data/enemies/index.js";

/**
 * A MULTIDAO.
 *
 * ## O DEFEITO
 *
 * Oito ogres em volta do jogador produziam, no codigo antigo:
 *
 *   batendo:                        0
 *   andando com arte de andar PRESO: 8
 *   todos parados a 84px do jogador, o alcance de golpe e 78
 *
 * Os tres nao sao um sintoma so. Sao o mesmo defeito em tres camadas:
 *
 * 1. TODO mundo mirava no PONTO do jogador, entao oito queriam ocupar a
 *    mesma circunferencia de raio 78. A geometria diz que oito corpos de
 *    raio 32 precisam de 84px: sete ou oito ficam do lado de fora
 * 2. O `aiState` virava `chase` pela INTENCAO, e `chase` esta no conjunto
 *    que toca animacao de andar. Com o passo bloqueado, oito bixos
 *    tocavam caminhada parada por 4 segundos seguidos
 * 3. Nao havia empurrao entre mobes, entao nao havia como sair do anel
 */
const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

const DT = 1 / 60;

function multidao(tipo = "ogre", quantidade = 8, nivel = 8) {
  const engine = new GameEngine(null, classe, null, {
    playerId: "p_ana",
    characterName: "Ana",
  });

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  const p = engine.world.player;

  const zona = MAP_1.zones.find((z) => z.id === "cripta");

  p.x = zona.x + zona.width / 2;
  p.y = zona.y + zona.height / 2;

  engine.world.enemies.length = 0;

  for (let i = 0; i < quantidade; i += 1) {
    const ang = (i / quantidade) * Math.PI * 2;

    engine.world.enemies.push(
      createCreature(
        tipo,
        {
          x: p.x + Math.cos(ang) * 260,
          y: p.y + Math.sin(ang) * 260,
        },
        i,
        nivel,
      ),
    );
  }

  for (let f = 0; f < 360; f += 1) {
    engine.update(DT);
  }

  return { engine, player: p };
}

describe("a multidao nao trava", () => {
  it("os ogres batem ao mesmo tempo, e nao um por vez", () => {
    const { engine } = multidao();

    const batendo = engine.world.enemies.filter(
      (e) => e.aiState === "attack",
    );

    expect(batendo.length).toBe(8);
  });

  it("ninguem toca animacao de andar enquanto esta parado", () => {
    /**
     * A METRICA DO DEFEITO.
     *
     * O codigo antigo dava 8. Um unico bicho com a arte de andar travada
     * ja e um bug visivel; oito e a multidao inteira parada
     */
    const { engine } = multidao();

    const andandoParado = engine.world.enemies.filter(
      (e) => isCreatureMoving(e) && e.stuckTimer > 0.2,
    );

    expect(andandoParado).toEqual([]);
  });

  it("ninguem se sobrepoe", () => {
    const { engine } = multidao();

    const sobrepostos = [];

    for (let i = 0; i < engine.world.enemies.length; i += 1) {
      for (let j = i + 1; j < engine.world.enemies.length; j += 1) {
        const a = engine.world.enemies[i];
        const b = engine.world.enemies[j];

        const d = Math.hypot(a.x - b.x, a.y - b.y);

        if (d < (a.radius + b.radius) * 0.98) {
          sobrepostos.push([a.id, b.id]);
        }
      }
    }

    expect(sobrepostos).toEqual([]);
  });

  it("multidao de limo tambem resolve", () => {
    /**
     * O caso de `wander`, e nao de combate.
     *
     * Limpos sao PASSIVE: eles nao perseguem, eles passeiam. Dez deles
     * nascendo perto sorteiam o mesmo ponto e se empilham — e era ali que
     * o estado `wander` ficava rodando sem o bicho sair do lugar
     */
    const { engine } = multidao("slime", 10, 1);

    const andandoParado = engine.world.enemies.filter(
      (e) => isCreatureMoving(e) && e.stuckTimer > 0.2,
    );

    expect(andandoParado.length).toBeLessThan(3);
  });

  it("o mob solto continua chegando perto do jogador", () => {
    /**
     * A separacao nao pode atrapalhar o mob que tem a arena para si.
     *
     * Se a empurrao fosse forte demais, um ogre sozinho nunca sairia do
     * lugar. E o piso e o alcance COM a folga da multidao, que e onde o
     * `tryAttack` aceita: um mob solto para na borda do anel, que e o
     * mesmo lugar onde ele para com a multidao em volta
     */
    const { engine, player } = multidao("ogre", 1, 8);

    const mob = engine.world.enemies[0];

    const distancia = Math.hypot(mob.x - player.x, mob.y - player.y);

    const folga = mob.radius * 0.5;

    expect(distancia).toBeLessThanOrEqual(
      mob.attackRange + folga,
    );

    // e ele entrou em golpe, e nao ficou passeando
    expect(mob.aiState).toBe("attack");
  });

  it("a empurrao e deterministica entre sessoes", () => {
    /**
     * O angulo do setor sai do hash do id.
     *
     * Com `Math.random()`, dois ogres presos um no outro sorteavam o
     * mesmo lado e ficavam empurrando para a mesma direcao. O hash faz o
     * lado ser sempre o mesmo para cada mob
     */
    const primeira = multidao();
    const segunda = multidao();

    const posicoes = (r) =>
      r.engine.world.enemies.map((e) => [
        Math.round(e.x),
        Math.round(e.y),
      ]);

    expect(posicoes(primeira)).toEqual(posicoes(segunda));
  });
});