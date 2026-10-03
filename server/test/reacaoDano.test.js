import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import {
  CREATURE_TYPES,
  createCreature,
} from "../../src/data/enemies/index.js";
import { NetworkWorld } from "../../src/game/net/NetworkWorld.js";
import { GameEngine } from "../../src/game/engine/GameEngine.js";
import {
  HURT_FLASH_DURATION,
  HURT_SHAKE_AMPLITUDE,
  resolveFrameRect,
  resolveHurtShake,
} from "../../src/game/sprites/animation.js";

/**
 * Sofreu dano e nao aconteceu NADA na tela.
 *
 * O dano e calculado no servidor: e ele que chama o `applyDamage` e
 * que zera o `hitFlash` de quem levou o golpe. O cliente nunca
 * roda esse codigo para o jogador, entao o `hitFlash` do seu
 * personagem NUNCA era ligado em modo rede.
 *
 * O resultado na tela era o pior dos dois: a barra de vida caia e o
 * numero de dano subia, mas o boneco ficava exatamente igual. Todo
 * mundo via o mob reagir; o jogador que o mob acertou nao sentia o
 * golpe. Pior, os mobs NAO tremiam, porque o tremor ainda nao
 * existia para ninguem: o `hitFlash` do mob era desenhado como um
 * piscar de cor, e o seu jogador nem isso tinha.
 *
 * Este arquivo trava as tres pontas da reacao: o tremor no desenho,
 * o pacote do servidor e a ponte que escreve o estado na entidade.
 */
let http;
let wss;
let jogo;
let porta;

beforeEach(async () => {
  await new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;
      resolve();
    });
  });

  wss = new WebSocketServer({ server: http, path: "/ws" });
  jogo = new GameServer({ config: { ...SERVER_CONFIG } });

  wss.on("connection", (socket) => {
    const client = new Client(socket);

    jogo.conectar(client);

    socket.on("message", (bruto) => {
      if (bruto.length > 8 * 1024) return;
      if (!client.limiter.permite()) return;

      jogo.receber(client, bruto.toString());
    });

    socket.on("close", () => jogo.desconectar(client));
  });

  jogo.start();
});

afterEach(async () => {
  await jogo.stop();

  await new Promise((resolve) => {
    for (const socket of wss.clients) socket.terminate();
    wss.close(() => http.close(resolve));
  });
});

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function criarCliente() {
  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
  });

  cliente.conectar();

  return cliente;
}

async function entrar(cliente, nome) {
  cliente.entrar({ name: nome, classId: "arbalist" });

  for (let i = 0; i < 120; i += 1) {
    if (cliente.painel?.player) return cliente;

    await esperar(25);
  }

  throw new Error(`${nome} nao entrou`);
}

/** A sessao do jogador que acabou de entrar. */
function sessaoAtual() {
  return [...jogo.engine.world.players.values()].at(-1);
}

/**
 * O JOGADOR pelo nome, e nao a sessao.
 *
 * `world.players` guarda a SESSAO, e o nome vive nela; quem tem
 * posicao, vida e `hitFlash` e o `session.player`. Devolver a sessao
 * por engano nao quebra com erro: `sessao.x` e `undefined`, e um
 * `undefined + 40` plantava o mob em `NaN`, onde ele nao persegue
 * ninguem e nao ataca. O teste falhava por "o mob nunca acertou" e
 * apontava para o tremor, que estava certo o tempo todo
 *
 * E a ordem do `Map` nao serve: e a ordem de conexao, e um teste que
 * assume "o ultimo e o Bao" quebra no dia em que a ordem mudar
 */
function jogadorPeloNome(nome) {
  const sessao = [...jogo.engine.world.players.values()].find(
    (s) => s.name === nome,
  );

  return sessao?.player;
}

let indiceMob = 700;

/**
 * Um mob perto do jogador, para ele atacar sem ter que esperar a IA
 * andar ate ele.
 *
 * O padrao e o esqueleto, que e `ACTIVE`: o limo, que seria o obvio,
 * e `PASSIVE` com `aggroRange: 0` e nunca ataca ninguem. Um teste
 * que esperasse o limo bater voltaria a falhar por tempo esgotado, e
 * o erro pareceria ser do trem, e nao da escolha do mob.
 *
 * O indice vai no id da criatura (`skeleton_0`), entao dois mobs com
 * o mesmo indice seriam o MESMO mob: o segundo viraria invisivel para
 * a busca por id e o teste passaria a medir a criatura errada sem
 * nenhuma falha aparecer.
 */
function mobNoAlcance(jogador, tipo = "skeleton", dx = 40) {
  indiceMob += 1;

  const mob = createCreature(
    tipo,
    { x: jogador.x + dx, y: jogador.y },
    indiceMob,
    CREATURE_TYPES[tipo].level,
  );

  jogo.engine.world.enemies.push(mob);

  return mob;
}

/**
 * Espera o jogador apanhar de verdade.
 *
 * O mob precisa bater pelo caminho normal, e nao com um `hitFlash`
 * plantado: a reacao tem de nascer da mesma linha de codigo que o
 * jogo usa. O esqueleto tem cooldown de golpe, entao isto da uma
 * janela de varios pacotes com o flash ligado, e nao um instante
 * isolado que o teste poderia perder entre dois `await`.
 */
async function esperarGolpe(jogador) {
  for (let i = 0; i < 100; i += 1) {
    await esperar(25);

    if (jogador.hitFlash > 0) return true;
  }

  return false;
}

/**
 * O que o SERVIDOR manda sobre TODOS os jogadores, inclusive voce.
 *
 * A lista sai na ordem do `Map` de `world.players`, que e a ordem de
 * conexao. Por isso os testes procuram por `id` e nunca por indice:
 * `lista[0]` e "a primeira pessoa que entrou", e um teste que
 * assumes que essa pessoa e voce mediria a reacao de outra pessoa
 */
function estadoDosJogadores() {
  return jogo.estadoJogadores();
}

/** O que o SERVIDOR manda sobre um jogador especifico. */
function estadoDo(jogador) {
  return estadoDosJogadores().find((p) => p.id === jogador.id);
}

describe("o tremor de dano", () => {
  it("nao move ninguem que nao levou golpe", () => {
    expect(resolveHurtShake(0)).toEqual({ x: 0, y: 0 });
    expect(resolveHurtShake(undefined)).toEqual({ x: 0, y: 0 });
  });

  it("desloca o corpo no instante do golpe", () => {
    const tremor = resolveHurtShake(HURT_FLASH_DURATION);

    expect(
      Math.hypot(tremor.x, tremor.y),
    ).toBeGreaterThan(0);
  });

  it("fica dentro da amplitude prometida", () => {
    // sem este teto, um `sin` com amplitude mal calibrada sacode o
    // personagem meia tela e o golpe fica comico
    for (const tempo of [HURT_FLASH_DURATION, 0.12, 0.06, 0.01]) {
      const tremor = resolveHurtShake(tempo);

      expect(Math.abs(tremor.x)).toBeLessThanOrEqual(
        HURT_SHAKE_AMPLITUDE,
      );
      expect(Math.abs(tremor.y)).toBeLessThanOrEqual(
        HURT_SHAKE_AMPLITUDE,
      );
    }
  });

  it("morre junto com o flash, e nao abruptamente", () => {
    // a amplitude e a que FAZ o tremor sumir: com a mesma amplitude
    // ate o fim, o personagem voltaria ao lugar de uma vez so
    const inicio = Math.hypot(
      ...Object.values(resolveHurtShake(HURT_FLASH_DURATION)),
    );
    const fim = Math.hypot(
      ...Object.values(resolveHurtShake(0.02)),
    );

    expect(fim).toBeLessThan(inicio);
  });

  it("um golpe no meio de uma onda mexe mais que no fim", () => {
    // a senoide tem vales: se o deslocamento fosse so "tem flash,
    // entao treme", o tremor passaria por um instante de amplitude
    // ZERO logo no comeco do golpe, que e quando mais se nota
    const amostras = [0.17, 0.16, 0.15, 0.14].map(
      (t) => Math.hypot(...Object.values(resolveHurtShake(t))),
    );

    expect(Math.max(...amostras)).toBeGreaterThan(
      Math.min(...amostras),
    );
  });
});

describe("o pacote do servidor leva a reacao", () => {
  it("o servidor nao manda reacao para quem esta inteiro", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const eu = estadoDo(sessaoAtual().player);

    expect(eu).toBeTruthy();
    expect(eu.hurt).toBe(0);
  });

  it("manda o tempo que resta quando o mob acerta o jogador", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const jogador = sessaoAtual().player;
    const mob = mobNoAlcance(jogador);

    expect(await esperarGolpe(jogador)).toBe(true);
    expect(mob.hp).toBeGreaterThan(0);

    const eu = estadoDo(jogador);

    // sem este campo a barra caia e o boneco nao mexia
    expect(eu.hurt).toBeGreaterThan(0);
    expect(eu.hurt).toBeLessThanOrEqual(HURT_FLASH_DURATION);
  });

  it("a reacao tambem vem de uma flecha", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const jogador = sessaoAtual().player;

    // o arqueiro zumbi atira de longe: e o caminho do DANO
    // DISTANTE, e nao o do corpo a corpo. Um teste so com esqueleto
    // passaria mesmo que a flecha nunca mexesse no estado
    mobNoAlcance(jogador, "zumbi_arbalist", 200);

    expect(await esperarGolpe(jogador)).toBe(true);

    expect(estadoDo(jogador).hurt).toBeGreaterThan(0);
  });

  it("nao deixa a reacao grudada no seu jogador", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const jogador = sessaoAtual().player;
    const mob = mobNoAlcance(jogador);

    expect(await esperarGolpe(jogador)).toBe(true);

    // O pacote traz o TEMPO RESTANTE, que diminui a cada tick, e
    // some no fim. O cliente tem de deixar o relogio terminar
    // sozinho: se ele nao contasse o tempo, o `hitFlash` ficaria
    // preso no ultimo valor recebido e o personagem ficaria branco
    // para sempre, sem nunca voltar ao idle
    let curou = false;

    for (let i = 0; i < 100; i += 1) {
      await esperar(25);

      if (estadoDo(jogador).hurt === 0) {
        curou = true;
        break;
      }
    }

    expect(curou).toBe(true);
    expect(mob.hp).toBeGreaterThan(0);
  });
});

describe("a reacao nao trava o desenho", () => {
  it("quem leva o golpe sem arte de dor fica PARADO, nao andando", () => {
    // O pedido e `hurt`, e o Arbalist nao tem esse bloco na folha. O
    // reserva de animacao decide o que aparece enquanto o flash
    // dura: se for `walk`, o personagem parado entra no ciclo de
    // caminhada e parece que ele saiu andando no lugar
    const definition = {
      format: "directional",
      frameWidth: 32,
      frameHeight: 32,
      directions: { south: 0 },
      fallbackDirection: "south",
      animations: {
        idle: { row: 0, start: 0, length: 1, fps: 1 },
        walk: { row: 1, start: 0, length: 4, fps: 9 },
      },
    };

    const parado = resolveFrameRect(definition, "hurt", 0, {
      x: 0,
      y: 1,
    });
    const andando = resolveFrameRect(definition, "walk", 0, {
      x: 0,
      y: 1,
    });

    // a linha do idle, e nao a do walk: e a diferenca entre "levou
    // um golpe" e "esta andando"
    expect(parado.y).toBe(0);
    expect(andando.y).toBe(32);
  });

  it("usa a arte de dor quando a folha tem", () => {
    const definition = {
      format: "directional",
      frameWidth: 32,
      frameHeight: 32,
      directions: { south: 0 },
      fallbackDirection: "south",
      animations: {
        idle: { row: 0, start: 0, length: 1, fps: 1 },
        walk: { row: 1, start: 0, length: 4, fps: 9 },
        hurt: { row: 2, start: 0, length: 2, fps: 10 },
      },
    };

    const ferido = resolveFrameRect(definition, "hurt", 0, {
      x: 0,
      y: 1,
    });

    expect(ferido.y).toBe(64);
  });

  it("o relogio de desenho consome o flash do seu jogador", () => {
    // O modo rede nao roda a simulacao local: o `update` volta antes,
    // no ramo `networked`. O `hitFlash` que decai no `updatePlayer`
    // nunca decai no cliente, e o golpe fica grudado na tela
    const { net, jogador, engine } = (() => {
      const alvo = { x: 0, y: 0, hitFlash: 0 };
      const engine = {
        world: { player: alvo, enemies: [], drops: [] },
        selectedTargetId: null,
        spriteDeClasse: () => null,
        updatePresentation: GameEngine.prototype.updatePresentation,
        animarJogador: GameEngine.prototype.animarJogador,
      };

      return {
        net: new NetworkWorld(engine),
        jogador: alvo,
        engine,
      };
    })();

    net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90, hurt: 0.18 });

    for (let i = 0; i < 20; i += 1) {
      engine.updatePresentation(0.05);
    }

    // 20 quadros de 50ms sao 1s, muito mais que os 0.18s do flash
    expect(jogador.hitFlash).toBe(0);
  });

  it("o flash do remoto nao e contado duas vezes", () => {
    // o remoto passa pelo laco de inimigos E pelo `animarJogador`. Se
    // os doisplaces contassem o tempo, a reacao do Bao duraria a
    // metade da do mob, e ninguem entenderia o por que
    const jogador = {
      x: 0,
      y: 0,
      isRemote: true,
      isMoving: false,
      hitFlash: 0.18,
      walkBlend: 0,
      walkPhase: 0,
      animationTime: 0,
    };

    const engine = {
      world: { player: { hitFlash: 0 }, enemies: [jogador], drops: [] },
      updatePresentation: GameEngine.prototype.updatePresentation,
      animarJogador: GameEngine.prototype.animarJogador,
    };

    // um unico quadro de 0.1s: o flash caiu de 0.18 para 0.08, e nao
    // para 0.02 (que seria o dobro de contagem) nem para 0.18 (que
    // seria nenhuma)
    engine.updatePresentation(0.1);

    expect(jogador.hitFlash).toBeCloseTo(0.08, 6);
  });
});

describe("a ponte escreve a reacao na entidade", () => {
  /**
   * A ponte com um motor de mentira: so o que ela le.
   *
   * O `spriteDeClasse` esta aqui porque `criarRemoto` pede a arte da
   * classe do jogador remoto ao criar a entidade. Sem ele, o teste
   * do remoto morreria com `not a function` em vez de chegar na
   * reacao, que e o que este arquivo quer medir.
   */
  function ponteFalsa() {
    const jogador = { x: 0, y: 0, hitFlash: 0 };
    const engine = {
      world: { player: jogador, enemies: [] },
      selectedTargetId: null,
      spriteDeClasse: () => null,
    };

    return { engine, jogador, net: new NetworkWorld(engine) };
  }

  it("acende o flash do seu proprio jogador", () => {
    const { net, jogador } = ponteFalsa();

    net.aplicarJogador(jogador, { x: 1, y: 2, hp: 90, hurt: 0.18 });

    expect(jogador.hitFlash).toBeCloseTo(0.18, 6);
  });

  it("segue o relogio do servidor em vez de reatravar o golpe", () => {
    const { net, jogador } = ponteFalsa();

    net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90, hurt: 0.18 });

    // o servidor manda o TEMPO RESTANTE, entao o proximo pacote vem
    // com um numero MENOR. E o que garante que o tremor termine: se
    // o cliente devolvesse o relogio ao valor mais alto que ja viu
    // (`max`), ele ficaria preso no 0.18 para sempre
    net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90, hurt: 0.12 });
    expect(jogador.hitFlash).toBeCloseTo(0.12, 6);

    net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90, hurt: 0.06 });
    expect(jogador.hitFlash).toBeCloseTo(0.06, 6);
  });

  it("deixa o relogio correr quando o golpe passou", () => {
    const { net, jogador } = ponteFalsa();

    net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90, hurt: 0.18 });
    jogador.hitFlash = 0.05;

    // o servidor parou de mandar: e o ultimo valor que vale, e o
    // cliente deixa o relogio terminar de correr
    net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90, hurt: 0 });

    expect(jogador.hitFlash).toBeCloseTo(0.05, 6);
  });

  it("aguenta um pacote velho sem o campo", () => {
    const { net, jogador } = ponteFalsa();

    // servidor antigo, ou o primeiro pacote antes do campo existir
    expect(() =>
      net.aplicarJogador(jogador, { x: 0, y: 0, hp: 90 }),
    ).not.toThrow();

    expect(jogador.hitFlash).toBe(0);
  });

  it("acende o flash do jogador remoto tambem", () => {
    const { net, engine } = ponteFalsa();

    net.aplicarOutrosJogadores([
      {
        id: "bento",
        x: 10,
        y: 20,
        hp: 80,
        maxHp: 100,
        name: "Bento",
        classId: "arbalist",
        hurt: 0.18,
      },
    ]);

    const remoto = engine.world.enemies[0];

    expect(remoto.name).toBe("Bento");
    expect(remoto.hitFlash).toBeCloseTo(0.18, 6);
  });

  it("nao prende a reacao do remoto quando o golpe passa", () => {
    const { net, engine } = ponteFalsa();

    const pacote = {
      id: "bento",
      x: 10,
      y: 20,
      hp: 80,
      maxHp: 100,
      name: "Bento",
      classId: "arbalist",
      hurt: 0.18,
    };

    net.aplicarOutrosJogadores([pacote]);

    const remoto = engine.world.enemies[0];
    remoto.hitFlash = 0.04;

    // o servidor ja avisou que o golpe passou
    net.aplicarOutrosJogadores([{ ...pacote, hurt: 0 }]);

    // sem isto, o Bao que apanha de um mob tremia sem parar na tela
    // de quem esta do lado
    expect(remoto.hitFlash).toBeCloseTo(0.04, 6);
  });
});
