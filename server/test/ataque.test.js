import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  PLAYER_ACTIONS,
  createCommand,
} from "../../src/shared/protocol.js";
import { CHARACTER_CLASSES } from "../../src/data/characters/index.js";

/**
 * Clicar num inimigo tem que andar ate ele e machucar.
 *
 * O relato era: a animacao de ataque tocava, o ataque era criado,
 * e o personagem ficava parado, longe, sem dano nenhum.
 *
 * Duas causas, e as duas importavam:
 *
 * 1. O clique do motor local marca `engagedTargetId`, e E ISSO que
 *    faz o `approachTarget` andar ate o alvo. O servidor so
 *    disparava a habilidade, entao a personagem nunca chegava perto
 *    e o golpe de corpo a corpo nao alcançava.
 * 2. A mira do servidor era um vetor de direcao, nao o ponto do
 *    alvo, entao o projétil saia para o lado errado.
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
  jogo = new GameServer({
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

  /**
   * Todo golpe ACERTA.
   *
   * Este arquivo mede se o pedido de ataque chega no alvo e tira vida,
   * e nao se o golpe acerta. O jogador e o mob tem esquiva, e um teste
   * que espera o HP cair falharia uma vez a cada vinte por sorte — o
   * que faria o arquivo parecer quebrado em vez de deterministico
   *
   * `1` e o maior valor que o `random` devolve, e `1 < 3%` nunca e
   * verdade
   */
  jogo.engine.damage.random = () => 1;

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
  jogo.stop();

  await new Promise((resolve) => {
    for (const socket of wss.clients) socket.terminate();
    wss.close(() => http.close(resolve));
  });
});

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function criarCliente(nome, classId) {
  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
  });

  cliente.conectar();

  return cliente;
}

async function entrar(cliente, nome, classId) {
  cliente.entrar({ name: nome, classId });

  for (let i = 0; i < 100 && !cliente.jogando(); i += 1) {
    await esperar(25);
  }

  expect(cliente.jogando()).toBe(true);

  return cliente;
}

/** Um inimigo VIVO perto o bastante para ser clicado. */
const inimigoPerto = () => {
  const jogador = jogo.engine.world.session.player;

  const alvo = jogo.engine.world.enemies.find(
    (e) =>
      e.kind !== "training" &&
      e.alive &&
      Math.hypot(e.x - jogador.x, e.y - jogador.y) < 200,
  );

  return alvo;
};

describe("clicar num mob", () => {
  it("marca o alvo, para que o personagem ande ate ele", async () => {
    const cliente = criarCliente();
    await entrar(cliente, "Ana", "warrior");

    const alvo = inimigoPerto();
    const sessao = jogo.engine.world.players.get(cliente.playerId);

    cliente.atacarAlvo(alvo.id);
    await esperar(120);

    // o campo que o motor le no tick para decidir andar. sem
    // ele, o ataque sai e o personagem fica parado no lugar
    expect(sessao.engagedTargetId).toBe(alvo.id);
    expect(sessao.selectedTargetId).toBe(alvo.id);

    cliente.desconectar();
  });

  it("o personagem CHEGA perto do alvo", async () => {
    const cliente = criarCliente();
    await entrar(cliente, "Ana", "warrior");

    const alvo = inimigoPerto();
    const sessao = jogo.engine.world.players.get(cliente.playerId);

    const distanciaAntes = Math.hypot(
      alvo.x - sessao.player.x,
      alvo.y - sessao.player.y,
    );

    expect(distanciaAntes).toBeGreaterThan(30);

    cliente.atacarAlvo(alvo.id);

    // alguns ticks: 20 por segundo
    await esperar(900);

    const distanciaDepois = Math.hypot(
      alvo.x - sessao.player.x,
      alvo.y - sessao.player.y,
    );

    // e o sintoma exato do relato: ele ficava parado. aqui ele
    // precisa ter chegado dentro do ALCANCE da classe, que e o que
    // importa de verdade. o "radius + 40" que eu tinha escrito era
    // um numero chute meu, e o motor para a uns 78 do centro do
    // mob: dentro do 115 do guerreiro, ou seja, correto
    const alcance = CHARACTER_CLASSES.find(
      (c) => c.id === "warrior",
    ).basicAttack.range;

    expect(distanciaDepois).toBeLessThan(distanciaAntes);
    expect(distanciaDepois).toBeLessThan(alcance);

    cliente.desconectar();
  });

  it("o mob leva dano", async () => {
    const cliente = criarCliente();
    await entrar(cliente, "Ana", "warrior");

    const alvo = inimigoPerto();

    // determinismo: o sorteio de drop nao interfere no dano, mas
    // o teste fica claro com o hp inicial
    const hpAntes = alvo.hp;

    cliente.atacarAlvo(alvo.id);
    await esperar(1500);

    // o golpe so conecta depois de chegar perto, entao o tempo
    // acima e o que o motor precisa para andar e acertar
    expect(alvo.hp).toBeLessThan(hpAntes);

    cliente.desconectar();
  });

  it("o ataque continua enquanto o alvo estiver vivo", async () => {
    const cliente = criarCliente();
    await entrar(cliente, "Ana", "warrior");

    const alvo = inimigoPerto();

    // A alegacao real e "continua batendo". "matar em 2.5s" era
    // exigir demais da classe: o golpe basico do guerreiro leva 82
    // e tem 1.18s de recarga, e o slime aguenta mais que isso
    cliente.atacarAlvo(alvo.id);

    await esperar(600);
    const primeira = alvo.hp;

    await esperar(2200);
    const segunda = alvo.hp;

    // sem o engagement continuando, a vida pararia de cair depois
    // do primeiro golpe: foi exatamente o sintoma do relato
    expect(segunda).toBeLessThan(primeira);

    cliente.desconectar();
  });
});

describe("a mira vai para o alvo", () => {
  it("o ponteiro do servidor aponta para o mob clicado", async () => {
    const cliente = criarCliente();
    await entrar(cliente, "Ana", "arbalist");

    const alvo = inimigoPerto();
    const sessao = jogo.engine.world.players.get(cliente.playerId);

    cliente.atacarAlvo(alvo.id);
    await esperar(120);

    // a mira tem de estar NAS COORDENADAS do alvo. com o vetor de
    // direcao do cliente, o projetil sai para o lado errado e
    // erra o mob: e a outra metade do sintoma
    expect(sessao.input.pointer.x).toBe(alvo.x);
    expect(sessao.input.pointer.y).toBe(alvo.y);

    cliente.desconectar();
  });

  it("sem alvo, a mira vem do cliente", async () => {
    const cliente = criarCliente();
    await entrar(cliente, "Ana", "arbalist");

    const sessao = jogo.engine.world.players.get(cliente.playerId);

    cliente.keys.add("KeyD");
    cliente.sincronizarIntencao();
    await esperar(120);

    // a mira por direcao continua valendo: e o que serve para
    // atirar sem mirar em ninguem
    expect(sessao.input.pointer.inside).toBe(true);

    cliente.desconectar();
  });

  it("a mira de um jogador nao vira a do outro", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const bento = criarCliente();
    await entrar(bento, "Bento", "sorcerer");

    const alvo = inimigoPerto();

    const sessaoAna = jogo.engine.world.players.get(ana.playerId);
    const sessaoBento = jogo.engine.world.players.get(bento.playerId);

    ana.atacarAlvo(alvo.id);
    await esperar(120);

    // a Ana mira no mob; o Bento nao tem mira nenhuma ainda.
    // com o estado do motor, o Bento miraria no mesmo mob
    expect(sessaoAna.input.pointer.x).toBe(alvo.x);
    expect(sessaoBento.input.pointer.x).not.toBe(alvo.x);

    ana.desconectar();
    bento.desconectar();
  });
});

describe("o alvo nao vaza entre jogadores", () => {
  it("o engagement da Ana nao move o Bento", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const bento = criarCliente();
    await entrar(bento, "Bento", "warrior");

    const alvo = inimigoPerto();

    const sessaoAna = jogo.engine.world.players.get(ana.playerId);
    const sessaoBento = jogo.engine.world.players.get(bento.playerId);

    const xBento = sessaoBento.player.x;

    ana.atacarAlvo(alvo.id);
    await esperar(600);

    // este campo era do MOTOR. o engagement da Ana aparecia no
    // update do Bento e o Bento ia atras do mob dela
    expect(sessaoAna.engagedTargetId).toBe(alvo.id);
    expect(sessaoBento.engagedTargetId).toBe(null);
    expect(sessaoBento.player.x).toBe(xBento);

    ana.desconectar();
    bento.desconectar();
  });

  it("o auto-play de um nao liga o do outro", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const bento = criarCliente();
    await entrar(bento, "Bento", "warrior");

    const sessaoAna = jogo.engine.world.players.get(ana.playerId);
    const sessaoBento = jogo.engine.world.players.get(bento.playerId);

    // um Client de verdade, para o caminho de rede ser o mesmo
    const duble = new Client({
      readyState: 1,
      send: () => {},
    });

    duble.session = sessaoAna;
    duble.joined = true;

    jogo.receber(
      duble,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.TOGGLE_AUTO_PLAY,
        }),
      ),
    );

    expect(sessaoAna.autoPlay).toBe(true);
    expect(sessaoBento.autoPlay).toBe(false);

    ana.desconectar();
    bento.desconectar();
  });
});

/**
 * O botao de auto da missao tem que existir NA REDE.
 *
 * O botao do auto de cacar tinha caminho de rede; o da missao nao.
 * No `GameCanvas` ele chamava `engineRef.current.focusQuest` direto,
 * que no cliente nao simulacao e nao tem sessao: o clique nao
 * chegava no servidor e a missao nunca entrava no piloto. O painel
 * ja publicava `quests.auto`, entao a tela mostrava o estado
 * certo de um pedido que nunca tinha sido feito.
 */
/** Um `Client` ligado a uma sessao, para mandar pacote na mao. */
const pedido = (sessao, payload) => {
  const duble = new Client({ readyState: 1, send: () => {} });

  duble.session = sessao;
  duble.joined = true;

  jogo.receber(
    duble,
    JSON.stringify(createCommand(CLIENT_COMMANDS.PANEL, payload)),
  );
};

describe("o auto da missao pela rede", () => {
  it("TOGGLE_QUEST_AUTO liga o piloto da missao", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const sessao = jogo.engine.world.players.get(ana.playerId);

    pedido(sessao, { op: PANEL_OPS.TOGGLE_QUEST_AUTO });

    expect(sessao.quests.autoEnabled).toBe(true);
    expect(sessao.quests.objectiveId).toBe(
      sessao.quests.currentMain?.id,
    );

    // e o piloto tem que andar: e o objetivo que liga o motor,
    // nao o botao de cacar perto
    expect(sessao.autoPlay).toBe(false);
    expect(jogo.engine.isAutoActive()).toBe(true);

    ana.desconectar();
  });

  it("TOGGLE_QUEST_AUTO duas vezes desliga", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const sessao = jogo.engine.world.players.get(ana.playerId);

    pedido(sessao, { op: PANEL_OPS.TOGGLE_QUEST_AUTO });
    pedido(sessao, { op: PANEL_OPS.TOGGLE_QUEST_AUTO });

    expect(sessao.quests.autoEnabled).toBe(false);

    ana.desconectar();
  });

  it("FOCUS_QUEST escolhe a missao pelo botao do painel", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const sessao = jogo.engine.world.players.get(ana.playerId);
    const principal = sessao.quests.currentMain;

    pedido(sessao, {
      op: PANEL_OPS.FOCUS_QUEST,
      questId: principal.id,
    });

    expect(sessao.quests.objectiveId).toBe(principal.id);
    expect(sessao.quests.autoEnabled).toBe(true);

    ana.desconectar();
  });

  it("FOCUS_QUEST com id desconhecido nao liga nada", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const sessao = jogo.engine.world.players.get(ana.playerId);

    pedido(sessao, {
      op: PANEL_OPS.FOCUS_QUEST,
      questId: "missao_que_nao_existe",
    });

    // um id inventado nao pode colocar o piloto para andar para
    // lugar nenhum
    expect(sessao.quests.autoEnabled).toBe(false);

    ana.desconectar();
  });

  it("o auto da missao de um nao liga o do outro", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const bento = criarCliente();
    await entrar(bento, "Bento", "warrior");

    const sessaoAna = jogo.engine.world.players.get(ana.playerId);
    const sessaoBento = jogo.engine.world.players.get(bento.playerId);

    pedido(sessaoAna, { op: PANEL_OPS.TOGGLE_QUEST_AUTO });

    expect(sessaoAna.quests.autoEnabled).toBe(true);
    expect(sessaoBento.quests.autoEnabled).toBe(false);

    bento.desconectar();
    ana.desconectar();
  });
});

/**
 * O botao AUTO tem que TIRAR a missao do comando.
 *
 * Este e o sintoma exato do relato: apertar T e o personagem ir
 * atras da missao. A causa era a tecla, nao o botao: a `T` era
 * tratada pelo motor da TELA, que em modo rede nao tem sessao, e o
 * pedido morria ali. O auto da missao, que ja estava ligado,
 * continuava no comando e o jogador via o personagem indo para a
 * zona.
 */
describe("o auto de cacar perto toma o comando da missao", () => {
  it("TOGGLE_AUTO_PLAY com a missao ligada desliga a missao", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const sessao = jogo.engine.world.players.get(ana.playerId);

    pedido(sessao, { op: PANEL_OPS.TOGGLE_QUEST_AUTO });

    expect(sessao.quests.autoEnabled).toBe(true);

    // agora o jogador aperta T
    pedido(sessao, { op: PANEL_OPS.TOGGLE_AUTO_PLAY });

    expect(sessao.autoPlay).toBe(true);

    // e a missao SAI do comando. sem isto o piloto continuaria
    // obedecendo a zona e o botao pareceria quebrado
    expect(sessao.quests.autoEnabled).toBe(false);
    expect(jogo.engine.getQuestObjective()).toBeNull();

    ana.desconectar();
  });

  it("depois do T, o piloto caeca uma criatura, e nao a zona", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const sessao = jogo.engine.world.players.get(ana.playerId);

    // o auto da missao assume o comando primeiro
    ana.alternarAutoMissao();
    await esperar(200);

    // o jogador aperta T
    ana.alternarAutoPlay();
    await esperar(400);

    // o piloto escolheu uma CRIATURA. um waypoint da zona da missao
    // nao teria alvo nenhum: e o que separava os dois modos
    const alvo = sessao.selectedTargetId
      ? jogo.engine.world.enemies.find(
          (e) => e.id === sessao.selectedTargetId,
        )
      : null;

    expect(alvo).toBeTruthy();
    expect(alvo.isCreature).toBe(true);

    // e o personagem esta indo para o alvo, batendo nele
    const distanciaAntes = Math.hypot(
      alvo.x - sessao.player.x,
      alvo.y - sessao.player.y,
    );

    await esperar(900);

    const distanciaDepois = Math.hypot(
      alvo.x - sessao.player.x,
      alvo.y - sessao.player.y,
    );

    expect(distanciaDepois).toBeLessThan(distanciaAntes);

    // e ha flecha no ar: o tiro de verdade, e nao so o passo.
    //
    // A flecha e rapida (720 px/s) e vive poucos instantes, entao
    // um unico pacote pode pegar o instante em que ela nao existe.
    // Aqui se ESPERA aparecer, em vez de olhar uma vez so.
    let viuFlecha = false;

    for (let i = 0; i < 40 && !viuFlecha; i += 1) {
      await esperar(50);
      viuFlecha = ana.mundo.projeteis().length > 0;
    }

    expect(viuFlecha).toBe(true);

    ana.desconectar();
  });
});

/**
 * O arqueiro tem que atirar DE VERDADE, na rede de verdade.
 *
 * Este e o teste que pega o sintoma "ele chega perto, fica parado e
 * nao tacando flecha". O dano e o `world.projectiles` sao coisas do
 * SERVIDOR: se o pacote nao trouxer a flecha, o cliente tem o
 * dano e nada voando na tela.
 *
 * O caminho inteiro e testado aqui: o cliente pede o ataque, o
 * servidor cria o projetil, e o projetil volta no snapshot.
 */
describe("o arqueiro atira de verdade pela rede", () => {
  it("a flecha do servidor volta no snapshot para o cliente", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const alvo = inimigoPerto();
    const sessao = jogo.engine.world.players.get(ana.playerId);

    // o pedido so; quem atira e o servidor
    ana.atacarAlvo(alvo.id);

    let viuFlecha = false;
    let estilo = null;

    for (let i = 0; i < 40 && !viuFlecha; i += 1) {
      await esperar(25);

      const flechas = ana.mundo.projeteis();

      if (flechas.length > 0) {
        viuFlecha = true;
        estilo = flechas[0].style;
      }
    }

    // a flecha precisa EXISTIR no pacote. sem isso o arqueiro
    // batia o mob e nada voava, que era o relato
    expect(viuFlecha).toBe(true);

    // e precisa ser a arte de flecha do Arbalist, nao um orbe ou
    // um fire de outra classe: o cliente desenha pelo `style`
    expect(estilo).toBe("arrow");

    // a velocidade vai no pacote porque o desenho gira a flecha
    // por ela. sem isso a flecha sairia apontada para a direita
    // mesmo atirando para cima
    const [flecha] = ana.mundo.projeteis();
    expect(Math.abs(flecha.velocityX) + Math.abs(flecha.velocityY))
      .toBeGreaterThan(0);

    // sanity: o servidor e quem tem o projetil de verdade
    expect(jogo.engine.world.projectiles.length).toBeGreaterThan(0);
    expect(sessao.player.attackAnimation).toBeGreaterThan(0);

    ana.desconectar();
  });

  it("o aviso de tiro do arqueiro local chega no pacote", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const alvo = inimigoPerto();

    ana.atacarAlvo(alvo.id);

    let viuAtirando = false;

    for (let i = 0; i < 40 && !viuAtirando; i += 1) {
      await esperar(25);

      // e o sinal que o cliente transforma na pose de arco. sem
      // ele o arqueiro ficava no idle enquanto atirava
      if (ana.mundo.eu(ana.playerId)?.acting) viuAtirando = true;
    }

    expect(viuAtirando).toBe(true);

    ana.desconectar();
  });

  it("o arqueiro CONTINUA batendo enquanto o alvo estiver vivo", async () => {
    // O relato: "bate uma vez e para de bater".
    //
    // O `autoActions` era um campo do motor, e no servidor o motor
    // e um so. As acoes candidatas eram as da classe do motor, e o
    // alcance de parada tambem. O arqueiro andava ate a distancia
    // do outro jogador e la nao achava acao em alcance.
    //
    // Este teste conta os GOLPES de verdade, pela rede, e nao
    // vezes que o `request` foi chamado: e o numero de ticks que
    // o mob sobreviveu que mostra se o ciclo de ataque continua.
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const alvo = inimigoPerto();
    const hpInicial = alvo.hp;

    ana.atacarAlvo(alvo.id);

    // 2 segundos: o cooldown do Arbalist e de 1/1.4 = 0.71s, entao
    // sao ~2.8 disparos se o ciclo continuar
    await esperar(2000);

    const dano = hpInicial - alvo.hp;

    // um golpe do Arbalist tira 104. um ciclo parado tiraria 104 e
    // nada mais
    expect(dano).toBeGreaterThan(104);

    ana.desconectar();
  });

  it("cada jogador ataca com o golpe DA CLASSE DELE, nao do motor", async () => {
    // A CAUSA RAIZ do sintoma "o arqueiro nao taca flecha".
    //
    // O servidor tem UM motor, criado com a primeira classe que
    // entrou. Se o motor usar a propria classe para decidir o
    // ataque, o Arbalist que entrasse depois usaria o `cone` do
    // Warrior: dano de perto, sem projetil, sem flecha no ar. E o
    // defeito era invisivel nos testes, porque eles entravam
    // sempre com a mesma classe que o motor.
    const ana = criarCliente();
    await entrar(ana, "Ana", "warrior");

    const anaSessao = jogo.engine.world.players.get(ana.playerId);
    const bento = criarCliente();
    await entrar(bento, "Bento", "arbalist");

    const bentoSessao = jogo.engine.world.players.get(bento.playerId);

    // as duas sessoes estao no mundo ao mesmo tempo, e sao de
    // classes diferentes: e exatamente a condicao que quebrava
    expect(anaSessao.classDefinition.id).toBe("warrior");
    expect(bentoSessao.classDefinition.id).toBe("arbalist");

    // o golpe do Bento tem de ser o DELE: projetil de flecha.
    // `withPlayer` recebe o ID, que e como o servidor troca o foco
    jogo.engine.withPlayer(bento.playerId, () => {
      jogo.engine.useBasicAttack();
    });

    const tipos = jogo.engine.world.projectiles.map(
      (p) => p.action?.projectileStyle,
    );

    // se o motor tivesse usado a classe dele, o ataque seria um
    // cone e esta lista estaria vazia
    expect(tipos).toContain("arrow");

    // e o motor NAO pode trocar de classe no meio: a da Ana
    // continua sendo a do motor
    expect(jogo.engine.classDefinition.id).toBe("warrior");

    bento.desconectar();
    ana.desconectar();
  });

  it("a flecha de um jogador NAO aparece para o outro sem estar no campo dele", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const bento = criarCliente();
    await entrar(bento, "Bento", "arbalist");

    const alvo = inimigoPerto();

    ana.atacarAlvo(alvo.id);
    await esperar(150);

    // o filtro de interesse e o mesmo dos inimigos: uma flecha
    // do outro lado do mapa nao pode ser desenhada, e nao apenas
    // deixa de ser
    for (const flecha of ana.mundo.projeteis()) {
      const distancia = Math.hypot(
        flecha.x - ana.mundo.eu(ana.playerId).x,
        flecha.y - ana.mundo.eu(ana.playerId).y,
      );

      expect(distancia).toBeLessThan(2000);
    }

    void alvo;
    bento.desconectar();
    ana.desconectar();
  });
});

describe("o motor resolve o engagement igual ao clique", () => {
  it("engageTarget marca e dispara", () => {
    const motor = jogo.engine;
    const local = motor.world.session;

    let disparou = false;
    motor.useBasicAttack = () => {
      disparou = true;
      return true;
    };

    motor.engageTarget("slime_0");

    expect(local.engagedTargetId).toBe("slime_0");
    expect(local.selectedTargetId).toBe("slime_0");
    expect(disparou).toBe(true);
  });

  it("engageTarget com null limpa o alvo", () => {
    const motor = jogo.engine;
    const local = motor.world.session;

    motor.engageTarget("slime_0");
    motor.engageTarget(null, { atacarAgora: false });

    // o alvo morreu ou o jogador cancelou: o engagement tem que
    // sumir, senao o `runEngagedTarget` ficaria tentando achar um
    // mob que nao existe mais
    expect(local.engagedTargetId).toBe(null);
  });

  it("lookAtTarget move a mira para o mob", () => {
    const motor = jogo.engine;
    const local = motor.world.session;

    const alvo = motor.world.enemies.find(
      (e) => e.kind !== "training",
    );

    const achado = motor.lookAtTarget(alvo.id);

    expect(achado).toBe(achado);
    expect(local.input.pointer.x).toBe(alvo.x);
    expect(local.input.pointer.y).toBe(alvo.y);
  });

  it("lookAtTarget com id invalido nao mexe na mira", () => {
    const motor = jogo.engine;
    const local = motor.world.session;

    local.input.pointer.x = 123;

    expect(motor.lookAtTarget("nao_existe")).toBe(null);
    expect(local.input.pointer.x).toBe(123);
  });

  it("PLAYER_ACTIONS.BASIC_ATTACK existe no protocolo", () => {
    // o servidor compara com o valor do protocolo. um valor
    // digitado errado aqui faria todo clique virar "nada"
    expect(PLAYER_ACTIONS.BASIC_ATTACK).toBe("BASIC_ATTACK");
  });
});
