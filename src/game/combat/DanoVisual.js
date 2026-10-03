import { COR_DANO } from "./DamageSystem.js";

/**
 * O NUMERO DE DANO na tela, do golpe ao texto.
 *
 * Este e o unico lugar que decide o que o numero diz e de que cor ele
 * e, e ele serve as DUAS pontas:
 *
 * - o single player, que cria o texto direto no `DamageSystem`
 * - o online, que recebe o golpe pelo socket e desenha aqui
 *
 * A paleta vem de `COR_DANO`, do `DamageSystem`, e nao e reescrita
 * aqui. Se as duas pontas tivessem listas proprias, um critico seria
 * vermelho online e amarelo offline, e o jogador acharia que o jogo
 * estava mudando de regra conforme ele entrasse numa partida
 *
 * A ordem de prioridade e a mesma do `DamageSystem`: o critico ganha
 * do magico, porque o critico e a informacao que o jogador procura
 * para decidir onde meter ponto
 */

/**
 * O texto e a cor de um golpe resolvido.
 *
 * @param {object} dano  o payload do `DAMAGE`, ou o resultado do
 *                       `onResolved`. Precisa de `missed`, `critical`,
 *                       `damageType` e `amount`
 * @returns {{texto: string, cor: string, critico: boolean}}
 */
export function textoDoDano(dano) {
  /**
   * O "MISS" e a palavra, e nao o zero.
   *
   * Um `0` seria a mesma coisa que "chegou e nao doeu", que e o estado
   * inicial de qualquer mob com vida cheia. O jogador precisa ler que
   * o golpe PASSOU, e so a palavra diz isso
   */
  if (dano.missed) {
    return { texto: "MISS", cor: COR_DANO.miss, critico: false };
  }

  if (dano.critical) {
    return {
      texto: String(dano.amount),
      cor: COR_DANO.critico,
      critico: true,
    };
  }

  if (dano.damageType === "magic") {
    return {
      texto: String(dano.amount),
      cor: COR_DANO.magico,
      critico: false,
    };
  }

  return {
    texto: String(dano.amount),
    cor: COR_DANO.normal,
    critico: false,
  };
}

/**
 * Desenha o numero no `EffectSystem` do motor.
 *
 * Fica num modulo e nao dentro de um componente porque quem chama e a
 * tela, e a tela nao deveria saber o formato do `EffectSystem`. E o
 * `EffectSystem` e do motor, nao de um componente
 *
 * @param {object} engine  o motor que TEM o canvas
 * @param {object} dano    o payload do `DAMAGE`
 */
export function mostrarDano(engine, dano) {
  if (!engine || !dano) return false;

  const alvo = alvoDoDano(engine, dano);

  /**
   * O numero nasce SOBRE o alvo, e nao em cima do jogador.
   *
   * A posicao do mob vem da entidade que o `NetworkWorld` acabou de
   * atualizar. A do jogador e a do motor. Se nenhum dos dois for
   * achado, o numero aparece no jogador: melhor um numero na posicao
   * errada do que nenhum numero, que e o que o jogador veria sem isto
   */
  const x = alvo?.x ?? engine.world?.player?.x ?? 0;

  const y =
    (alvo?.y ?? engine.world?.player?.y ?? 0) -
    (alvo?.radius ?? 18) -
    8;

  const { texto, cor, critico } = textoDoDano(dano);

  engine.effects?.addText(x, y, texto, cor, critico);

  return true;
}

/**
 * A entidade que LEVOU o golpe.
 *
 * O `DAMAGE` chega logo apos o golpe, e o `SNAPSHOT` que fecha o golpe
 * pode ainda nao ter vindo. Ate la, o `NetworkWorld` nao sabe que o
 * mob morreu e o `id` continua na lista de inimigos do motor, entao a
 * busca funciona na maioria das vezes
 *
 * Quando a busca falha de vez, o numero cai em cima do jogador, que e
 * o unico ponto que ele sempre sabe onde esta
 */
function alvoDoDano(engine, dano) {
  /**
   * A vitima JOGADOR nao precisa de busca: e o proprio jogador que o
   * cliente esta desenhando. E o caso de todo golpe que o jogador leva,
   * que e metade dos numeros da tela
   */
  if (dano.alvoSouJogador) return engine.world?.player ?? null;

  if (!dano.alvoId) return null;

  return (
    engine.world?.enemies?.find?.((e) => e.id === dano.alvoId) ?? null
  );
}
