import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { createPlayerSession } from "./PlayerSession.js";
import { installDomStubs } from "./testHarness.js";
import { NetworkWorld } from "../net/NetworkWorld.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { resolveAnimation } from "../sprites/animation.js";
import {
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
} from "../ui/minimap.js";

// o motor com canvas liga eventos de teclado e mouse na `window`.
// no node puro nao existe `window`, e o mesmo stub do resto da
// suite resolve
installDomStubs();

/**
 * O arqueiro precisa PARECER que esta atirando, em modo rede.
 *
 * O sintoma: o personagem chega perto do mob, o dano acontece no
 * servidor, e mesmo assim ele fica parado no idle, sem arte de
 * tiro e sem flecha. A animacao local existe, mas em modo rede o
 * motor nao simula, e a apresentacao nunca pegava o relogio do
 * jogador local: so os jogadores DISTANTES tinham animacao.
 *
 * Estes testes cobrem as duas metades do tiro:
 *
 * 1. a arte do corpo (a pose de arco puxado)
 * 2. a flecha no ar (o projeteil)
 *
 * As duas somem ao mesmo tempo, e por isso o defeito parece um so.
 */
const criar = (classId = "arbalist") => {
  const engine = new GameEngine(
    canvasDeTeste(),
    CHARACTER_CLASSES.find((c) => c.id === classId),
    null,
    { playerId: "p_ana", characterName: "Ana" },
  );

  engine.setMap(MAP_1);
  engine.setNetworked(true);

  return { engine, mundo: new NetworkWorld(engine) };
};

/**
 * Um canvas que so aceita drawing.
 *
 * O `render` sai cedo quando o motor e headless, e o minimapa e
 * desenhado no canvas. Sem isto, os testes do minimap passariam sem
 * nunca desenhar nada.
 */
function canvasDeTeste() {
  const contexto = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(alvo, chave) {
        if (chave in alvo) return alvo[chave];
        return () => {};
      },
      set(alvo, chave, valor) {
        alvo[chave] = valor;
        return true;
      },
    },
  );

  return {
    getContext: () => contexto,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };
}

/**
 * O estado de um jogador que o servidor mandou.
 *
 * `acting` e `hasTarget` sao o que o servidor ja envia em
 * `estadoJogadores`, e sao o aviso de "o tiro comecou". O cliente
 * so precisa transformar esse aviso em pose.
 */
const eu = (extra = {}) => ({
  id: "p_ana",
  name: "Ana",
  x: 3000,
  y: 2100,
  hp: 700,
  maxHp: 700,
  facing: { x: 1, y: 0 },
  isMoving: false,
  acting: false,
  hasTarget: false,
  ...extra,
});

const estado = (extra = {}) => ({
  eu: eu(),
  outros: [],
  inimigos: [],
  drops: [],
  ...extra,
});

describe("a arte de tiro do jogador LOCAL em modo rede", () => {
  it("o servidor avisando que atirou produz a pose de tiro", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado());
    expect(
      resolveAnimation(engine.world.player, engine.classDefinition),
    ).toBe("idle");

    // o servidor comecou um tiro. o cliente tem que mostrar isso
    mundo.aplicar(
      estado({ eu: eu({ acting: true, hasTarget: true }) }),
    );

    expect(
      resolveAnimation(engine.world.player, engine.classDefinition),
    ).toBe("attack");

    engine.destroy();
  });

  it("a pose de tiro tem_alvo do Arbalist, entao ha alvo no pacote", () => {
    const { engine, mundo } = criar();

    // o aviso de "atirando" sem alvo NAO pode virar a arte de
    // arco: `needsTarget` existe para o tiro nao entrar quando o
    // arqueiro esta so lanando um buff em si mesmo
    mundo.aplicar(estado({ eu: eu({ acting: true }) }));

    expect(engine.world.player.firingTargetId).toBeFalsy();

    engine.destroy();
  });

  it("a pose de tiro ACABA sozinha, sem o motor simular", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(
      estado({ eu: eu({ acting: true, hasTarget: true }) }),
    );

    expect(
      resolveAnimation(engine.world.player, engine.classDefinition),
    ).toBe("attack");

    // passam 300ms e o servidor avisa que parou. em modo rede o
    // relogio e do cliente: e ele que conta a duracao da pose
    engine.update(0.3);

    mundo.aplicar(estado());

    expect(
      resolveAnimation(engine.world.player, engine.classDefinition),
    ).toBe("idle");

    // e o alvo some junto, senao o arqueiro ficaria mirando para
    // sempre depois do tiro
    expect(engine.world.player.firingTargetId).toBeNull();

    engine.destroy();
  });

  it("andando em modo rede, o passo do arqueiro continua animando", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(
      estado({ eu: eu({ isMoving: true, facing: { x: 1, y: 0 } }) }),
    );

    const antes = engine.world.player.walkPhase;

    engine.update(0.2);

    // o balanco do andar e o que faz o sprite nao deslizar
    // congelado. sem este relogio, o arqueiro andava deslizando
    expect(engine.world.player.walkPhase).toBeGreaterThan(antes);
    expect(engine.world.player.walkBlend).toBeGreaterThan(0);

    engine.destroy();
  });
});

describe("o auto-play respeita a classe do jogador", () => {
  /**
   * O sintoma era: "bate uma vez e para de bater".
   *
   * O `autoActions` era um campo do MOTOR, montado com a classe do
   * motor. No servidor, como o motor e um so para o mundo inteiro,
   * as acoes candidatas eram as do primeiro jogador que entrou. O
   * Arbalist era offered o alcance do cone do Warrior, e ao parar
   * de andar na distancia DELE, nao achava acao em alcance: um
   * golpe e depois silencio.
   */
  const comDuasClasses = () => {
    // o motor e do WARRIOR, como no servidor quando o primeiro
    // jogador a entrar e um guerreiro
    const engine = new GameEngine(
      null,
      CHARACTER_CLASSES.find((c) => c.id === "warrior"),
      null,
      { playerId: "p_ana", characterName: "Ana" },
    );

    engine.setMap(MAP_1);

    // e o Arbalist entra no MESMO motor
    const sessao = engine.addPlayer(
      createPlayerSession(
        CHARACTER_CLASSES.find((c) => c.id === "arbalist"),
        { id: "p_bento", name: "Bento" },
      ),
    );

    return { engine, sessao };
  };

  it("com um Arbalist em foco, o auto-play oferece o basico DELE", () => {
    const { engine, sessao } = comDuasClasses();

    // o motor continua sendo do Warrior: e a classe desenhada
    expect(engine.classDefinition.id).toBe("warrior");

    engine.withPlayer(sessao.id, () => {
      expect(engine.autoBasicAction.id).toBe("arbalist_basic_attack");
      expect(engine.autoBasicAction.type).toBe("projectile");
      expect(engine.autoBasicAction.projectileStyle).toBe("arrow");
    });

    engine.destroy();
  });

  it("o alcance do auto-play e o do Arbalist, e nao o do Warrior", () => {
    const { engine, sessao } = comDuasClasses();

    engine.withPlayer(sessao.id, () => {
      // 550 de alcance, 70%: 385. com o cone do Warrior seria
      // muito menos, e o arqueiro parava longe demais
      expect(engine.getAutoDesiredRange()).toBe(385);
    });

    engine.destroy();
  });

  it("cada jogador tem as SUAS habilidades candidatas", () => {
    const { engine, sessao } = comDuasClasses();

    const arbalist = CHARACTER_CLASSES.find((c) => c.id === "arbalist");
    const warrior = CHARACTER_CLASSES.find((c) => c.id === "warrior");

    engine.withPlayer(sessao.id, () => {
      // as candidatas do Arbalist tem de ser as DELE, e nao as do
      // Warrior. o basico ja e a flecha; o resto tem de vir do
      // pacote de habilidades dele
      const esperadas = [
        arbalist.basicAttack,
        ...arbalist.skills.filter(Boolean),
      ];

      expect(engine.autoActions).toHaveLength(esperadas.length);
      expect(engine.autoActions.map((a) => a.id)).toEqual(
        esperadas.map((a) => a.id),
      );
    });

    engine.withPlayer("p_ana", () => {
      const esperadas = [
        warrior.basicAttack,
        ...warrior.skills.filter(Boolean),
      ];

      expect(engine.autoActions.map((a) => a.id)).toEqual(
        esperadas.map((a) => a.id),
      );

      // e nenhuma habilidade do Arbalist pode sobrar na lista da
      // Ana: e exatamente o vazamento que o `withPlayer` evita
      for (const acao of engine.autoActions) {
        expect(arbalist.skills.map((s) => s?.id)).not.toContain(
          acao.id,
        );
      }
    });

    engine.destroy();
  });
});

describe("o minimapa desce quando ha alvo, em modo rede tambem", () => {
  // O minimapa tem duas posicoes: a de descanso, e a que deixa a
  // faixa do alvo livre. O painel do alvo e desenhado pelo HUD,
  // por cima, e o minimapa e desenhado no canvas: se os dois
  // ficarem na mesma faixa, o alvo some debaixo do minimapa.
  //
  // Este defeito ja existia, mas era INVISIVEL: o painel do alvo
  // so aparecia depois de um clique, e o clique no navegador nao
  // chegava ao servidor. Agora que o clique funciona, o painel
  // aparece e a sobreposicao ficou a vista.
  it("o alvo escolhido no servidor desce o minimapa", () => {
    const { engine, mundo } = criar();

    // o id vem do mundo: um id inventado nao viraria a mesma
    // entidade, e o teste passaria sem provar nada
    const alvo = mundo.porId.values().next().value;

    mundo.aplicar(estado());
    engine.render();

    // sem alvo, o minimapa fica na posicao de descanso
    expect(engine.minimapY).toBe(MINIMAP_TOP_IDLE);

    // o jogador escolheu um alvo. o servidor e quem sabe disso, e
    // a escolha precisa VIR no pacote: se o cliente so descobrir
    // pelo proprio clique, o minimap nao desce
    mundo.aplicar(
      estado({
        eu: eu({ selectedTargetId: alvo.id }),
        inimigos: [
          {
            id: alvo.id,
            x: 3060,
            y: 2100,
            hp: 30,
            state: "idle",
          },
        ],
      }),
    );

    expect(engine.selectedTargetId).toBe(alvo.id);
    expect(engine.hasLiveTarget()).toBe(true);

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    // o minimapa desce, para baixo da faixa do alvo
    expect(engine.minimapY).toBe(MINIMAP_TOP_TARGETED);
    expect(engine.minimapY).toBeGreaterThan(MINIMAP_TOP_IDLE);

    engine.destroy();
  });

  it("o alvo morreu no servidor, o minimapa volta para cima", () => {
    const { engine, mundo } = criar();

    const alvo = mundo.porId.values().next().value;

    mundo.aplicar(
      estado({
        eu: eu({ selectedTargetId: alvo.id }),
        inimigos: [
          {
            id: alvo.id,
            x: 3060,
            y: 2100,
            hp: 30,
            state: "idle",
          },
        ],
      }),
    );

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    expect(engine.minimapY).toBe(MINIMAP_TOP_TARGETED);

    // o slime morreu. o servidor manda vida zero e o alvo tem de
    // sumir junto, senao o minimapa ficava preso na posicao de baixo
    mundo.aplicar(
      estado({
        eu: eu({ selectedTargetId: null }),
        inimigos: [
          {
            id: alvo.id,
            x: 3060,
            y: 2100,
            hp: 0,
            state: "dead",
          },
        ],
      }),
    );

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    expect(engine.hasLiveTarget()).toBe(false);
    expect(engine.minimapY).toBe(MINIMAP_TOP_IDLE);

    engine.destroy();
  });
});

describe("a flecha do arqueiro em modo rede", () => {
  it("o servidor manda a flecha e o cliente a desenha", () => {
    const { engine, mundo } = criar();

    // o servidor simula o projetil e o manda no pacote. o
    // jogador ve a MESMA flecha que causou o dano, e nao uma
    // animacao inventada aqui
    mundo.aplicar(
      estado({
        projeteis: [
          {
            id: "flecha_1",
            x: 3060,
            y: 2100,
            radius: 10,
            velocityX: 720,
            velocityY: 0,
            style: "arrow",
            color: "#8ed081",
            rain: false,
          },
        ],
      }),
    );

    expect(engine.world.projectiles).toHaveLength(1);

    const [flecha] = engine.world.projectiles;

    expect(flecha.x).toBe(3060);
    expect(flecha.style).toBe("arrow");
    expect(flecha.velocityX).toBe(720);

    // e o motor precisa saber DESENHAR essa flecha. `drawProjectiles`
    // lia `projectile.action.projectileStyle`, que so existe no
    // servidor: sem esta forma, a flecha chegava e nao aparecia
    expect(flecha.action.projectileStyle).toBe("arrow");

    engine.destroy();
  });

  it("a flecha some quando o servidor para de manda-la", () => {
    const { engine, mundo } = criar();

    const flecha = {
      id: "flecha_1",
      x: 3060,
      y: 2100,
      radius: 10,
      velocityX: 720,
      velocityY: 0,
      style: "arrow",
      color: "#8ed081",
      rain: false,
    };

    mundo.aplicar(estado({ projeteis: [flecha] }));
    expect(engine.world.projectiles).toHaveLength(1);

    // a flecha bateu ou expirou. o servidor para de manda-la, e
    // o cliente nao pode ficar com uma flecha parada no ar para
    // sempre
    mundo.aplicar(estado({ projeteis: [] }));
    expect(engine.world.projectiles).toHaveLength(0);

    engine.destroy();
  });

  it("o cliente nao decide o caminho da flecha", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(
      estado({
        projeteis: [
          {
            id: "flecha_1",
            x: 3060,
            y: 2100,
            radius: 10,
            velocityX: 720,
            velocityY: 0,
            style: "arrow",
            color: "#8ed081",
            rain: false,
          },
        ],
      }),
    );

    const x = engine.world.projectiles[0].x;

    // quanto tempo passou entre pacotes nao move a flecha: quem
    // manda a posicao e o servidor. se o cliente integra a
    // velocidade aqui, uma flecha proofreadada andaria sozinha
    engine.update(0.5);

    expect(engine.world.projectiles[0].x).toBe(x);

    engine.destroy();
  });

  it("o pacote sem projeteis nao quebra o cliente", () => {
    const { engine, mundo } = criar();

    // servidor velho, ou o primeiro pacote antes de existir
    // projetil: a ausencia do campo nao pode virar erro
    mundo.aplicar({ eu: eu(), outros: [], inimigos: [], drops: [] });

    expect(engine.world.projectiles).toHaveLength(0);

    engine.destroy();
  });
});
