import { beforeEach, describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { COR_DANO } from "../../src/game/combat/DamageSystem.js";

/**
 * O NUMERO DE DANO pelo socket.
 *
 * Este e o unico arquivo que pega o caminho INTEIRO do online: o
 * servidor calcula o golpe, o `DamageSystem` sorteia o miss e o
 * critico, e o `GameServer` decide para quem o `DAMAGE` sai.
 *
 * Sem ele, os testes do `DamageSystem` provam a conta e nada mais — e a
 * conta ja funcionava offline, onde o motor desenha sozinho. O que
 * faltava era o caminho de volta do numero, que e exatamente onde o
 * online quebrava: o motor do servidor cria o texto flutuante no
 * `EffectSystem` dele, que nunca e desenhado porque aquele motor foi
 * criado com `canvas = null`. O numero nascia e morria no servidor
 *
 * O que este arquivo segura:
 *
 * 1. **quem recebe** — so quem atirou e quem levou, nunca os outros
 * 2. **o conteudo** — valor, critico, miss e o tipo do golpe
 * 3. **o alvo** — o id do mob, e a marca de quando a vitima e o
 *    proprio jogador, que e o caso em que nao ha id para procurar
 */

let jogo;

/** o `DamageSystem` do servidor, que e quem sorteia */
const dano = () => jogo.engine.damage;

/** um jogador conectado, com tudo que o teste precisa olhar */
function abrir(nome, classId = "warrior") {
  const recebidos = [];

  const socket = {
    readyState: 1,
    send: (texto) => recebidos.push(JSON.parse(texto)),
  };

  const client = new Client(socket);

  jogo.conectar(client);

  jogo.receber(
    client,
    JSON.stringify(
      createCommand(CLIENT_COMMANDS.JOIN, { name: nome, classId }),
    ),
  );

  return {
    nome,
    client,
    recebidos,
    sessao: () => jogo.engine.world.players.get(client.id),

    /** so os `DAMAGE` que chegaram para ESTE jogador */
    danos: () =>
      recebidos
        .filter((r) => r.type === SERVER_EVENTS.DAMAGE)
        .map((r) => r.payload),
  };
}

/**
 * Uma criatura DE VERDADE, colada no jogador.
 *
 * E do roster do mapa, e nao montada a mao. Minha primeira versao
 * deste arquivo construia um objeto com `hp`, `x`, `evasion` e mais
 * nada, e o `DamageSystem` le `statusEffects`, `reflect` e outros
 * campos que o objeto nao tinha — cada um virou um `TypeError` que
 * parecia um defeito do numero de dano e era um mob de mentira
 *
 * O `applyDamage` nao exige proximidade: ele aplica no alvo que
 * recebeu, sem checar alcance. A proximidade vem do `SkillSystem`,
 * que nao participa deste caminho
 */
function mobPerto(jogador, extra = {}) {
  const mob = jogo.engine.world.enemies.find((e) => e.isCreature);

  if (!mob) throw new Error("o mapa nao tem criatura para o teste");

  mob.x = jogador.x + 24;
  mob.y = jogador.y;
  mob.hp = mob.maxHp;
  mob.alive = true;

  Object.assign(mob, extra);

  return mob;
}

beforeEach(() => {
  /**
   * O VALE, e nao a base.
   *
   * A base e o hub, e o hub nao tem criatura nenhuma — e uma decisao
   * do projeto, nao um bug. Um servidor na base deixa este arquivo sem
   * mob para bater, e o primeiro `TypeError` seria sobre a lista
   * vazia, nao sobre o numero de dano
   */
  jogo = new GameServer({
    config: { ...SERVER_CONFIG },
    mapId: "map_1",
  });
});

describe("o numero de dano pelo socket", () => {
  it("quem atirou recebe o numero do golpe que deu", () => {
    const ana = abrir("Ana");

    // sorteio 1: o golpe acerta e nao e critico
    dano().random = () => 1;

    const jogador = ana.sessao().player;
    const mob = mobPerto(jogador, { evasion: 0 });

    const vidaAntes = mob.hp;

    dano().applyDamage(jogador, mob, {
      damage: 100,
      damageType: "physical",
    });

    const danos = ana.danos();

    expect(danos.length, "quem atirou nao recebeu o proprio numero").toBe(
      1,
    );

    /**
     * O `amount` e o dano EFETIVO, nao o da skill.
     *
     * A criatura tem defesa, e o `DamageSystem` reduz o golpe por ela
     * antes de aplicar. O numero que sobe na tela tem que ser o que
     * saiu do HP — se o `DAMAGE` mandasse o valor bruto, o jogador
     * veria "100" em cima de um mob que perdeu 12 de vida
     */
    expect(danos[0].amount).toBe(vidaAntes - mob.hp);

    expect(danos[0]).toMatchObject({
      alvoId: mob.id,
      alvoSouJogador: false,
      critical: false,
      missed: false,
      damageType: "physical",
    });
  });

  it("quem levou tambem recebe, e sabe que era ele", () => {
    /**
     * O caso de dano no jogador, que e metade dos numeros da tela.
     *
     * O `alvoSouJogador` e o que dispensa o cliente de procurar um id
     * que nao existe na lista de inimigos: a vitima e o proprio
     * jogador que ele esta desenhando
     */
    const ana = abrir("Ana");

    const jogador = ana.sessao().player;
    const mob = mobPerto(jogador, { evasion: 0.5 });

    // sorteio 1: o golpe ACERTA o jogador, que e o que se quer medir
    dano().random = () => 1;

    const vidaAntes = jogador.hp;

    dano().applyDamage(mob, jogador, {
      damage: 33,
      damageType: "physical",
    });

    const danos = ana.danos();

    expect(danos.length, "quem levou nao recebeu o numero").toBe(1);

    expect(danos[0].amount).toBe(vidaAntes - jogador.hp);

    expect(danos[0]).toMatchObject({
      alvoSouJogador: true,
      missed: false,
    });
  });

  it("quem nao estava no golpe nao recebe nada", () => {
    /**
     * O filtro que evita a tela suja.
     *
     * O Bento esta no mundo, longe, e nao participou do golpe. Mandar
     * o numero para ele encheria a tela dele de numero que nao tem
     * nada a ver com o que ele esta fazendo
     */
    const ana = abrir("Ana");
    const bento = abrir("Bento");

    expect(jogo.clients.size, "o teste precisa de dois jogadores").toBe(
      2,
    );

    dano().random = () => 1;

    const jogador = ana.sessao().player;
    const mob = mobPerto(jogador);

    dano().applyDamage(jogador, mob, {
      damage: 100,
      damageType: "physical",
    });

    expect(ana.danos(), "quem atirou nao recebeu").toHaveLength(1);

    expect(
      bento.danos(),
      "o jogador que nao estava no golpe recebeu numero",
    ).toHaveLength(0);
  });

  it("o golpe que errou sai com missed e valor zero", () => {
    const ana = abrir("Ana");

    const jogador = ana.sessao().player;
    const mob = mobPerto(jogador, { evasion: 0.5 });

    // sorteio 0 faz o golpe passar pelo miss
    dano().random = () => 0;

    dano().applyDamage(jogador, mob, {
      damage: 100,
      damageType: "physical",
    });

    const danos = ana.danos();

    expect(danos).toHaveLength(1);
    expect(danos[0]).toMatchObject({ missed: true, amount: 0 });
  });

  it("o critico viaja marcado", () => {
    const ana = abrir("Ana");

    const jogador = ana.sessao().player;

    /**
     * A criatura SEM evasao, de proposito.
     *
     * O `random` injetado responde sempre 0, e o `DamageSystem` sorteia
     * o miss ANTES do critico. Com a evasao do nivel, o `0 < 3%` seria
     * verdade e o golpe sairia como MISS — um teste de critico que
     * acabaria medindo o miss
     */
    const mob = mobPerto(jogador, { evasion: 0 });

    jogador.critRate = 1;
    dano().random = () => 0;

    dano().applyDamage(jogador, mob, {
      damage: 100,
      damageType: "physical",
    });

    expect(ana.danos()[0]).toMatchObject({
      critical: true,
      missed: false,
    });
  });

  it("o golpe magico viaja com o tipo, para o numero sair roxo", () => {
    const ana = abrir("Ana");

    dano().random = () => 1;

    const jogador = ana.sessao().player;
    const mob = mobPerto(jogador);

    dano().applyDamage(jogador, mob, {
      damage: 100,
      damageType: "magic",
    });

    expect(ana.danos()[0].damageType).toBe("magic");
  });

  it("a paleta do online e a mesma do offline", () => {
    /**
     * O guardiao da paleta.
     *
     * As cores sao as duas do `DamageSystem`, e este teste existe
     * porque uma paleta se duplica com o tempo: alguem ajusta o
     * amarelo do offline e esquece que o online tem a sua lista. O
     * critico viraria vermelho numa ponta e amarelo na outra, e o
     * jogador acharia que o jogo mudava de regra conforme ele
     * entrasse numa partida
     */
    const cores = [
      COR_DANO.normal,
      COR_DANO.critico,
      COR_DANO.magico,
      COR_DANO.miss,
    ];

    expect(new Set(cores).size).toBe(4);
  });

  it("o jogador que se atinge de volta nao recebe o numero dobrado", () => {
    /**
     * O golpe que se pega de volta.
     *
     * Numa cadeia de reflexo o jogador pode ser atacante e vitima do
     * mesmo `applyDamage`. Sem o filtro de ja avisados, o numero
     * apareceria duas vezes empilhadas no mesmo pixel — visivel como
     * um numero mais grosso, que ninguem sabe explicar
     */
    const ana = abrir("Ana");

    dano().random = () => 1;

    const jogador = ana.sessao().player;

    dano().applyDamage(jogador, jogador, {
      damage: 5,
      damageType: "physical",
    });

    expect(
      ana.danos().length,
      "o mesmo golpe saiu duas vezes para a mesma pessoa",
    ).toBe(1);
  });
});
