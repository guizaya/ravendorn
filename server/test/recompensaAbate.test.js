import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { ITEMS } from "../../src/data/items/index.js";

/**
 * O ultimo golpe e de quem matou: XP, moedas, item e o aviso de
 * tela.
 *
 * Este arquivo trava um bug real. O premio em si ja era do dono (o
 * `lastHitBy` decide), mas o AVISO de "+16 moedas" vivia num campo
 * do MOTOR, e todo painel lia o mesmo campo. O resultado na tela era
 * o pior dos dois: o numero de moedas do jogador estava certo e a
 * tela dos outros tambem mostrava a recompensa, como se todos
 * tivessem ganhado. Quem encontrou o bug via os dois lados.
 *
 * E o outro lado do mesmo bug: o abate por DoT chega em `handleKill`
 * pela parte COMPARTILHADA do tick, sem `withPlayer`, e sem o
 * `withPlayer` do dono o aviso cairia no jogador que estivesse em
 * foco - que e o primeiro a entrar, nao o matador.
 */
function montar() {
  const jogo = new GameServer({
    config: { ...SERVER_CONFIG },

    /**
     * Este teste e de COMBATE, entao roda no vale.
     *
     * O hub nao tem zona de mob — e nao e defeito, e o que um hub e.
     * Sem este `mapId` o servidor entraria no calcamento e nao haveria
     * alvo nenhum para bater
     */
    mapId: "map_1",
  });

  const abrir = (nome, classId = "warrior") => {
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
        createCommand(CLIENT_COMMANDS.JOIN, {
          name: nome,
          classId,
        }),
      ),
    );

    const sessao = () => jogo.engine.world.players.get(client.id);

    const painel = () => {
      jogo.enviarPainel(client);

      for (let i = recebidos.length - 1; i >= 0; i -= 1) {
        if (recebidos[i].type === SERVER_EVENTS.PLAYER_STATE) {
          return recebidos[i].payload;
        }
      }

      return null;
    };

    return { client, sessao, painel };
  };

  // pelo menos 20 tipos, para encher a mochila de 20 espacos
const ITENS_DISTINTOS = Object.keys(ITEMS).slice(0, 20);

const mobVivo = () =>
    [...jogo.engine.world.enemies].find((e) => e.hp > 0);

  return { jogo, abrir, mobVivo };
}

/**
 * Os itens que enchem a mochila, e o item que o abate entrega.
 *
 * Antes eram `slice(-20)`, os ULTIMOS da lista, porque o alvo era o
 * PRIMEIRO e ele tinha de ficar fora da mochila cheia. Depois da
 * limpeza do catalogo sobraram 14 itens e a capacidade padrao e 20:
 * `slice(-20)` passou a devolver a lista INTEIRA, incluindo o alvo, e
 * a mochila nunca ficava cheia. O teste quebrava em `isFull` e o
 * transbordo nem era exercitado
 *
 * Agora o alvo e o ultimo da lista e os que enchem sao os primeiros,
 * e a capacidade e ajustada para o que existe. A razao continua a
 * mesma: o alvo NAO pode estar dentro da mochila cheia, senao o
 * `add` entraria na pilha que ja existe e nada transbordaria
 */
const ORDEM = Object.keys(ITEMS);
const ALVO = ORDEM.at(-1);
const CHEIOS = ORDEM.slice(0, -1);
const CAPACIDADE_CHEIA = CHEIOS.length;

/** Deixa a mochila de `c` cheia, do jeito que o teste precisa. */
function encher(c) {
  const inv = c.sessao().inventory;

  inv.capacity = CAPACIDADE_CHEIA;
  inv.stacks.length = 0;

  for (const item of CHEIOS) inv.add(item, 1);

  return inv;
}

/** O que o jogador TEM, e nao o que a tela diz que ele tem. */
const carteira = (c) => ({
  xp: c.sessao().player.xp ?? 0,
  coins: c.sessao().inventory.coins,
  itens: c.sessao().inventory.stacks.length,
});

const aviso = (c) => c.painel()?.message ?? null;

describe("recompensa do ultimo golpe", () => {
  it("dá XP e moedas so para quem matou", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    const mob = mobVivo();

    mob.lastHitBy = bia.sessao().player;

    jogo.engine.handleKill(mob, null);

    expect(carteira(ana)).toEqual({ xp: 0, coins: 0, itens: 0 });
    expect(carteira(bia).xp).toBeGreaterThan(0);
    expect(carteira(bia).coins).toBeGreaterThan(0);

    jogo.stop();
  });

  it("manda o aviso de recompensa so para quem matou", () => {
    const { jogo, abrir, mobVivo } = montar();

    // a Ana mata, e ela NAO e a sessao em foco: quem fica em foco
    // na parte compartilhada e a ultima a entrar. E o erro de antes
    // mandava o aviso da Ana para a pessoa em foco
    const ana = abrir("Ana");

    abrir("Bia");
    const cid = abrir("Cid");

    expect(jogo.engine.world.session.id).toBe(cid.client.id);

    const mob = mobVivo();

    mob.lastHitBy = ana.sessao().player;

    jogo.engine.handleKill(mob, null);

    expect(aviso(ana).text).toMatch(/moedas/);
    expect(aviso(ana).bad).toBe(false);

    // quem nem matou nao ve nada, e o foco em si nao muda o destino
    expect(aviso(cid)).toBeNull();

    jogo.stop();
  });

  it("não avisa ninguem quando o abate não tem dono", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    // mob que ninguem tocou: sem `lastHitBy` e sem `killer`
    jogo.engine.handleKill(mobVivo(), null);

    expect(carteira(ana)).toEqual({ xp: 0, coins: 0, itens: 0 });
    expect(carteira(bia)).toEqual({ xp: 0, coins: 0, itens: 0 });
    expect(aviso(ana)).toBeNull();
    expect(aviso(bia)).toBeNull();

    jogo.stop();
  });

  it("dá o item no inventário de quem matou, não no do outro", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    // o sorteio e aleatorio, entao ele e FIXADO aqui: o que este
    // teste quer verificar e a DONA do item, nao a tabela de drop
    jogo.engine.loot.roll = () => ({
      coins: 0,
      items: [{ itemId: ALVO, count: 2 }],
    });

    const mob = mobVivo();

    mob.lastHitBy = bia.sessao().player;

    jogo.engine.handleKill(mob, null);

    const conta = (c) =>
      c
        .sessao()
        .inventory.stacks.find((s) => s.itemId === ALVO)?.count ??
      0;

    expect(conta(ana)).toBe(0);
    expect(conta(bia)).toBe(2);

    jogo.stop();
  });

  it("não deixa quem só estava no mapa pegar o que transbordou", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");
    const cid = abrir("Cid");

    // o mesmo item para todos, e nenhum deles tem nada disso
    jogo.engine.loot.roll = () => ({
      coins: 0,
      items: [{ itemId: ALVO, count: 2 }],
    });

    // a mochila da Bia esta cheia. Encher com o mesmo item NAO
    // serviria, porque ele se juntaria numa pilha so e o proximo
    // `add` entraria nela em vez de transbordar
    const inv = encher(bia);

    expect(inv.isFull).toBe(true);

    const mob = mobVivo();

    mob.lastHitBy = bia.sessao().player;

    jogo.engine.handleKill(mob, null);

    const drop = jogo.engine.world.drops.find(
      (d) => d.ownerId === bia.client.id,
    );

    expect(drop).toBeTruthy();

    // o Cid e a Ana vao pisar em cima do drop
    for (const curioso of [cid, ana]) {
      curioso.sessao().player.x = drop.x;
      curioso.sessao().player.y = drop.y;

      jogo.engine.withPlayer(curioso.client.id, () => {
        jogo.engine.coletarDropDoChao();
      });
    }

    // o drop continua no chao, com a Bia como dona
    expect(
      jogo.engine.world.drops.some(
        (d) => d.ownerId === bia.client.id,
      ),
    ).toBe(true);

    // e a dona recolhe assim que lugar na mochila. Sem esta parte o
    // teste passaria tambem se NINGUEM pudesse pegar, que e o outro
    // extremo do mesmo bug
    bia.sessao().inventory.stacks.pop();

    expect(bia.sessao().inventory.isFull).toBe(false);

    bia.sessao().player.x = drop.x;
    bia.sessao().player.y = drop.y;

    jogo.engine.withPlayer(bia.client.id, () => {
      jogo.engine.coletarDropDoChao();
    });

    expect(
      jogo.engine.world.drops.some(
        (d) => d.ownerId === bia.client.id,
      ),
    ).toBe(false);

    expect(
      bia
        .sessao()
        .inventory.stacks.find((s) => s.itemId === ALVO)?.count,
    ).toBe(2);

    jogo.stop();
  });

  it("não credita a quem só estava no mapa", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");
    const cid = abrir("Cid");

    // tres pessoas no mesmo mapa, uma matando
    const mob = mobVivo();

    mob.lastHitBy = bia.sessao().player;

    jogo.engine.handleKill(mob, null);

    for (const bystander of [ana, cid]) {
      expect(carteira(bystander)).toEqual({
        xp: 0,
        coins: 0,
        itens: 0,
      });

      expect(aviso(bystander)).toBeNull();
    }

    jogo.stop();
  });

  it("mantém as recompensas separadas entre vários abates", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    const primeiro = mobVivo();
    primeiro.lastHitBy = ana.sessao().player;
    jogo.engine.handleKill(primeiro, null);

    const anaDepoisDoPrimeiro = carteira(ana);

    const segundo = mobVivo();
    segundo.lastHitBy = bia.sessao().player;
    jogo.engine.handleKill(segundo, null);

    // O abate da Bia nao pode mexer no total da Ana. Os dois mobs sao
    // do mesmo tipo e valem o mesmo XP, entao os numeros PODEM ser
    // iguais: o que nao pode e a Ana ganhar o segundo abate
    expect(carteira(ana)).toEqual(anaDepoisDoPrimeiro);
    expect(carteira(bia).xp).toBeGreaterThan(0);
    expect(carteira(bia).coins).toBeGreaterThan(0);

    jogo.stop();
  });

  it("caduca o aviso de cada um no seu tempo", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    const mob = mobVivo();

    mob.lastHitBy = bia.sessao().player;

    jogo.engine.handleKill(mob, null);

    expect(aviso(bia)).not.toBeNull();

    // passa o suficiente para o aviso de 2.5s expirar
    for (let i = 0; i < 40; i += 1) {
      jogo.engine.update(0.1);
    }

    expect(aviso(bia)).toBeNull();
    // e a Ana nunca teve aviso para caducar
    expect(ana.sessao().message).toBeNull();

    jogo.stop();
  });

  it("não deixa o aviso de um jogador aparecer para o seguinte", () => {
    const { jogo, abrir, mobVivo } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    // a Ana ganha um aviso
    const mob = mobVivo();
    mob.lastHitBy = ana.sessao().player;
    jogo.engine.handleKill(mob, null);

    expect(aviso(ana)).not.toBeNull();
    expect(aviso(bia)).toBeNull();

    // a Bia entao faz alguma coisa que escreve mensagem, e o aviso
    // da Ana nao pode "pular" para ela
    jogo.engine.withPlayer(bia.client.id, () => {
      jogo.engine.showMessage("oi");
    });

    expect(aviso(ana).text).not.toBe("oi");
    expect(aviso(bia).text).toBe("oi");

    jogo.stop();
  });
});
