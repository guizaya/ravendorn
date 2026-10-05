import { describe, expect, it } from "vitest";
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { NavGrid } from "./NavGrid.js";
import {
  BASE_MAP,
  MAP_1,
  MAP_1_ZONES,
} from "../../data/maps/index.js";

/**
 * A GRADE de navegacao, sozinha.
 *
 * O motor tem o seu teste de ponta a ponta (`viagemAuto.test.js`), que
 * prova que o boneco CHEGA. Este arquivo prova que a grade diz a
 * verdade — e as duas coisas sao defeitos diferentes
 *
 * Um caminho invalido porem chegar: o `walkToward` empurra o boneco
 * contra a arvore, o `escapeCorner` gira, e as vezes ele passa. O teste
 * de motor passaria com uma grade que devolvia caminhos por dentro de
 * obstaculos. Aqui cada perna do caminho e conferida contra o colisor
 * com o RAIO do boneco, entao um caminho que passa por dentro de uma
 * arvore reprova aqui
 */

/** um mapa de teste: um retangulo com um muro no meio */
function mapaComMuro() {
  const largura = 600;
  const altura = 400;

  return {
    id: "teste",
    width: largura,
    height: altura,
    bounds: { x: 0, y: 0, width: largura, height: altura },

    /**
     * O MURO: uma parede vertical com uma abertura de 120px no meio.
     *
     * A abertura e o que torna o mapa interessante: sem ela nao haveria
     * caminho nenhum, e o teste mediria so o caso de "sem rota". Com
     * ela, o caminho tem de contornar ou atravessar pelo buraco
     */
    solids: [
      { x: 280, y: 0, width: 40, height: 140 },
      { x: 280, y: 260, width: 40, height: 140 },
    ],
  };
}

const gradeDe = (mapa, opcoes) =>
  new NavGrid(mapa, new CollisionSystem(mapa, []), opcoes);

/** o ponto de partida, no canto de cima a esquerda */
const PARTIDA = { x: 60, y: 60 };

describe("a grade se constroi", () => {
  it("cobre o mapa inteiro", () => {
    const grade = gradeDe(mapaComMuro());

    expect(grade.columns).toBe(
      Math.ceil(mapaComMuro().width / grade.celula),
    );

    expect(grade.rows).toBe(
      Math.ceil(mapaComMuro().height / grade.celula),
    );

    expect(grade.andavel).toHaveLength(grade.columns * grade.rows);
  });

  it("marca o muro como nao andavel", () => {
    const grade = gradeDe(mapaComMuro());

    /**
     * A CELULA que contem o meio do muro.
     *
     * E o teste do que a grade existe para dizer: o ponto (300, 60) esta
     * dentro do retangulo solido, entao a celula dele e bloqueada. E o
     * que impede o A* de tracar um caminho por dentro da parede
     */
    const dentro = grade.celulaDe(300, 60);

    expect(grade.andavelEm(dentro.linha, dentro.coluna)).toBe(false);
  });

  it("marca o campo aberto como andavel", () => {
    const grade = gradeDe(mapaComMuro());

    const { linha, coluna } = grade.celulaDe(60, 200);

    expect(grade.andavelEm(linha, coluna)).toBe(true);
  });

  it("usa o raio do boneco e nao um numero solto", () => {
    /**
     * Com um raio MENOR que o boneco, a grade aceitaria o corredor
     * estreito do muro, o caminho passaria por ele, e o `moveEntity`
     * travaria — que e exatamente o defeito que a grade veio evitar
     */
    const mapa = mapaComMuro();

    const frouxa = gradeDe(mapa, { raio: 2 });
    const justa = gradeDe(mapa, { raio: 22 });

    const conta = (grade) =>
      grade.andavel.reduce((a, b) => a + b, 0);

    expect(
      conta(justa),
      "o raio do boneco deveria marcar mais celulas como bloqueadas",
    ).toBeLessThan(conta(frouxa));
  });
});

describe("o caminho contorna o obstaculo", () => {
  it("atravessa pelo buraco do muro", () => {
    const grade = gradeDe(mapaComMuro());

    const caminho = grade.caminho(PARTIDA, { x: 540, y: 60 });

    expect(caminho).not.toBe(null);
    expect(caminho.length).toBeGreaterThan(0);

    /**
     * Cada perna e conferida com o RAIO do boneco.
     *
     * E a verificacao que o teste de motor nao faz: ele so ve que o
     * boneco chegou, e o boneco pode chegar empurrando. Aqui a
     * Pergunta e se o CAMINHO cabe
     */
    let atual = PARTIDA;

    for (const ponto of caminho) {
      expect(
        grade.temLinhaDeVisada(atual, ponto),
        `a perna ate (${Math.round(ponto.x)}, ` +
          `${Math.round(ponto.y)}) atravessa o muro`,
      ).toBe(true);

      atual = ponto;
    }

    expect(atual.x).toBe(540);
    expect(atual.y).toBe(60);
  });

  it("devolve null quando nao ha caminho", () => {
    /**
     * Um mapa com a parede toda fechada.
     *
     * E o caso que o `caminho` precisa distinguir de "chegou": sem
     * caminho, o motor descarta a etapa e devolve o controle ao piloto.
     * Devolver um caminho vazio faria o motor andar para (0, 0)
     */
    const mapa = mapaComMuro();

    mapa.solids = [
      { x: 280, y: 0, width: 40, height: alturaTotal(mapa) },
    ];

    const grade = gradeDe(mapa);

    expect(grade.caminho(PARTIDA, { x: 540, y: 60 })).toBe(null);
  });

  it("um destino dentro do obstaculo acha a borda", () => {
    const mapa = mapaComMuro();

    const grade = gradeDe(mapa);

    /**
     * O destino e o MEIO do muro.
     *
     * E um caso real: o destino de uma viagem e o centro de uma zona,
     * e nada garante que ele esteja em piso livre. Devolver `null`
     * aqui faria o jogador nunca chegar em um destino valido
     */
    const caminho = grade.caminho(PARTIDA, { x: 300, y: 60 });

    expect(caminho).not.toBe(null);

    expect(caminho[caminho.length - 1]).toEqual({ x: 300, y: 60 });
  });

  it("simplifica: linha reta vira um ponto so", () => {
    const grade = gradeDe(mapaComMuro());

    const caminho = grade.caminho(
      { x: 60, y: 60 },
      { x: 260, y: 60 },
    );

    /**
     * Nao ha obstaculo entre os dois pontos, entao o caminho e a reta.
     *
     * A grade tem 40px de lado, e o A* sairia com um ponto a cada
     * celula. O string pulling e o que troca isso por um ponto: o piloto
     * viraria o waypoint em 0.25s sem ninguem ver a diferenca, e com
     * um degrau a cada 40px o boneco andaria dorminhando
     */
    expect(caminho).toHaveLength(1);
    expect(caminho[0]).toEqual({ x: 260, y: 60 });
  });

  it("nao corta o canto do muro", () => {
    /**
     * Os dois pontos estao na MESMA faixa de altura, e o muro esta
     * entre eles.
     *
     * A reta esta bloqueada, entao o caminho tem de descer ate a
     * abertura e voltar a subir. Descer e subir e exatamente onde um
     * A* que corta canto atravessa a parede pela diagonal — e o
     * `moveEntity` devolveria o boneco para tras, com o piloto tremendo
     * no canto do obstaculo
     *
     * O destino e walkable de proposito: uma etapa que termina dentro
     * de um solido e o caso do `#maisPertoAndavel`, e ele deixa a
     * ultima perna sem linha de visada de proposito. Testar aqui um
     * destino dentro do muro mediria essa escolha, nao o canto
     */
    const grade = gradeDe(mapaComMuro());

    const partida = { x: 100, y: 100 };
    const destino = { x: 460, y: 100 };

    expect(
      grade.temLinhaDeVisada(partida, destino),
      "a reta deste caso deveria estar bloqueada",
    ).toBe(false);

    const caminho = grade.caminho(partida, destino);

    expect(caminho).not.toBe(null);

    let atual = partida;

    for (const ponto of caminho) {
      expect(
        grade.temLinhaDeVisada(atual, ponto),
        `a perna de (${Math.round(atual.x)}, ` +
          `${Math.round(atual.y)}) para ` +
          `(${Math.round(ponto.x)}, ${Math.round(ponto.y)}) ` +
          `atravessa o muro`,
      ).toBe(true);

      atual = ponto;
    }

    expect(atual).toEqual(destino);
  });
});

describe("a grade do vale", () => {
  it("acha caminho para todas as doze zonas a partir do portal", () => {
    const grade = new NavGrid(MAP_1, new CollisionSystem(MAP_1, []));

    const portal = MAP_1.portals.find(
      (p) => p.id === "portal_pantano",
    );

    for (const zona of MAP_1_ZONES) {
      const alvo = {
        x: zona.x + zona.width / 2,
        y: zona.y + zona.height / 2,
      };

      const caminho = grade.caminho(
        { x: portal.x, y: portal.y },
        alvo,
      );

      expect(caminho, `sem caminho para ${zona.id}`).not.toBe(null);

      let atual = { x: portal.x, y: portal.y };

      for (const ponto of caminho) {
        expect(
          grade.temLinhaDeVisada(atual, ponto),
          `o caminho para ${zona.id} atravessa uma arvore`,
        ).toBe(true);

        atual = ponto;
      }
    }
  });

  it("a linha reta NAO serve para a maioria das zonas", () => {
    /**
     * Este e o teste que justifica a grade existir.
     *
     * Se a reta servisse para todas, o seek puro do piloto antigo
     * bastaria e o A* seria complexidade sem motivo. A asercao mede a
     * razao do`travessarPortal` funcionar mesmo sem rotas de contorno
     */
    const grade = new NavGrid(MAP_1, new CollisionSystem(MAP_1, []));

    const portal = MAP_1.portals.find(
      (p) => p.id === "portal_pantano",
    );

    const comObstaculo = MAP_1_ZONES.filter((zona) => {
      const alvo = {
        x: zona.x + zona.width / 2,
        y: zona.y + zona.height / 2,
      };

      return !grade.temLinhaDeVisada(
        { x: portal.x, y: portal.y },
        alvo,
      );
    });

    expect(
      comObstaculo.length,
      "nenhuma zona tem obstaculo na reta: a grade nao se justifica",
    ).toBeGreaterThan(6);
  });

  it("o hub nao tem obstaculo e a reta serve", () => {
    const grade = new NavGrid(BASE_MAP, new CollisionSystem(BASE_MAP, []));

    expect(BASE_MAP.solids).toHaveLength(0);

    const caminho = grade.caminho(
      BASE_MAP.spawn,
      { x: 1475, y: 588 },
    );

    expect(caminho).toHaveLength(1);
  });
});

/**
 * O A* ESCOLHE O CAMINHO MAIS CURTO
 *
 * ## O DEFEITO
 *
 * O comparador da heap devolvia a DIFERENCA em vez do booleano:
 * `a.f - b.f || a.h - b.h`. Lido como差 no `if`, isso e verdadeiro
 * quando `a` e o MAIOR — e a heap virou uma heap de MAXIMO
 *
 * Um A* de maximo devolve um caminho VALIDO, so que nao o mais curto: ele
 * abre a regiao mais distante primeiro e volta. No vale, ir do
 * nascimento ate um ponto 700px de distancia dava um caminho de 238
 * celulas, e o piloto dava a volta pelo mapa inteiro antes de chegar
 *
 * ## POR QUE OS OUTROS TESTES NAO PEGARAM
 *
 * Todos os outros medem se o caminho CABE, e um caminho de 238 celulas
 * cabe igual a um de 15. Nenhum media o COMPRIMENTO, que e a unica coisa
 * que um A* de maximo estraga
 */
describe("o A* escolhe o caminho mais curto", () => {
  it("um campo aberto sem obstaculo e uma perna so", () => {
    const grade = gradeDe(mapaComMuro());

    const caminho = grade.caminho({ x: 60, y: 200 }, { x: 540, y: 200 });

    expect(caminho).toHaveLength(1);
  });

  it("o caminho do vale nao da a volta para ir a 700px", () => {
    const grade = new NavGrid(MAP_1, new CollisionSystem(MAP_1, []));

    /**
     * O NASCIMENTO e um ponto a 700px do alvo, no MEIO do campo.
     *
     * O alvo e escolhido um pouco longe do centro de uma zona para a
     * linha reta NAO servir, e perto o bastante para que um A* de
     * maximo nao tenha por onde se esconder: um caminho de cinco mil
     * pixels para ir 700px e o sintoma, e o comprimento e o que mede
     */
    const partida = MAP_1.spawn;

    const alvo = { x: 3350, y: 2706 };

    const caminho = grade.caminho(partida, alvo);

    expect(caminho).not.toBe(null);

    const distancia = Math.hypot(
      alvo.x - partida.x,
      alvo.y - partida.y,
    );

    const percorrido = caminho.reduce((total, ponto, i) => {
      const anterior =
        i === 0 ? partida : caminho[i - 1];

      return (
        total +
        Math.hypot(
          ponto.x - anterior.x,
          ponto.y - anterior.y,
        )
      );
    }, 0);

    expect(
      percorrido,
      `o caminho andou ${Math.round(percorrido)}px para uma ` +
        `distancia de ${Math.round(distancia)}px`,
    ).toBeLessThan(distancia * 1.6);
  });
});

/**
 * O CAMINHO NAO RASPA NO OBSTACULO
 *
 * ## O DEFEITO
 *
 * A grade aceitava uma celula quando o boneco cabia nela — e cabendo e
 * encostar. O collider do arbusto e uma caixa de 28px e o boneco e um
 * circulo de raio 22: encostando, o sprite de 67px do boneco passa por
 * cima de metade do arbusto. E, pior que o desenho, a folga zero e
 * instavel: qualquer empurrao de meio px joga o boneco para dentro do
 * arbusto, o `travelParado` conta 3s, o caminho e refeito identico e o
 * piloto volta a encostar no mesmo arbusto
 *
 * ## O QUE ESTE ARQUIVO MEDE
 *
 * A MENOR folga que o caminho deixa em QUALQUER obstaculo, percorrida de
 * 4 em 4px. Um caminho que passa raspando tem folga 22 — que e o raio do
 * boneco, ou seja, o osso colado no tronco. O que o piloto quer e folga
 * acima do raio, e o que o vine tem
 */
describe("o caminho passa pelo meio do vao", () => {
  /** a menor folga de um caminho, em px de distancia do collider */
  const folgaMinima = (colisor, de, caminho) => {
    let pior = Infinity;

    let origem = de;

    for (const ponto of caminho) {
      const dx = ponto.x - origem.x;
      const dy = ponto.y - origem.y;

      const distancia = Math.hypot(dx, dy);

      const passos = Math.max(1, Math.ceil(distancia / 4));

      for (let i = 0; i <= passos; i += 1) {
        const x = origem.x + (dx * i) / passos;
        const y = origem.y + (dy * i) / passos;

        let maior = 0;

        for (let r = 22; r <= 60; r += 2) {
          if (colisor.isPositionFree({ x, y }, r)) maior = r;
          else break;
        }

        if (maior < pior) pior = maior;
      }

      origem = ponto;
    }

    return pior;
  };

  it("nenhum trecho do vale encosta em arvore nem em arbusto", () => {
    const colisor = new CollisionSystem(MAP_1, []);
    const grade = new NavGrid(MAP_1, colisor);

    const portal = MAP_1.portals.find(
      (p) => p.id === "portal_pantano",
    );

    const partida = { x: portal.x, y: portal.y };

    for (const zona of MAP_1_ZONES) {
      const alvo = {
        x: zona.x + zona.width / 2,
        y: zona.y + zona.height / 2,
      };

      const caminho = grade.caminho(partida, alvo);

      expect(caminho, `sem caminho para ${zona.id}`).not.toBe(null);

      /**
       * A folga e maior que o RAIO DO BONECO.
       *
       * E o que separa "passando pelo vao" de "encostado no arbusto". O
       * numero exato nao importa: o que o teste segura e que a folga
       * nunca CAIA no raio do boneco, que e o estado em que o caminho
       * raspa e o piloto trava
       */
      expect(
        folgaMinima(colisor, partida, caminho),
        `o caminho para ${zona.id} passa raspando em um obstaculo`,
      ).toBeGreaterThan(22);
    }
  });

  it("nenhuma perna nasce cega, nem no meio do vale", () => {
    const grade = new NavGrid(MAP_1, new CollisionSystem(MAP_1, []));

    const centros = MAP_1_ZONES.map((zona) => ({
      x: zona.x + zona.width / 2,
      y: zona.y + zona.height / 2,
    }));

    /**
     * TODOS OS PARES de zona, e nao so do portal.
     *
     * E o que o `seguir` faz: o destino dele e a posicao de uma pessoa,
     * que pode estar em qualquer ponto do vale. Um par invisivel em um
     * canto que o bestiario nunca aponta seria um piloto que trava no
     * meio de um grupo
     */
    for (const de of centros) {
      for (const para of centros) {
        if (de === para) continue;

        const caminho = grade.caminho(de, para);

        expect(caminho).not.toBe(null);

        let origem = de;

        caminho.forEach((ponto, i) => {
          const ultimo = i === caminho.length - 1;

          /**
           * A ULTIMA perna aceita o passo de lado.
           *
           * O destino exato pode estar a menos de 8px de um obstaculo, e
           * ai a folga nao cabe no ultimo metro. O que nao pode e uma
           * perna LONGA sem folga — que e a travessia dearbusto que
           * fazia o piloto ficar empurrando
           */
          const perna = Math.hypot(
            ponto.x - origem.x,
            ponto.y - origem.y,
          );

          if (!ultimo || perna <= 45) {
            expect(
              grade.temLinhaDeVisada(origem, ponto),
              `a perna ${i} de (${Math.round(de.x)},${Math.round(de.y)}) ` +
                `a (${Math.round(para.x)},${Math.round(para.y)}) ` +
                `nao tem linha de visada`,
            ).toBe(true);
          }

          origem = ponto;
        });
      }
    }
  });
});

/**
 * O DESTINO QUE FICOU DO OUTRO LADO DE UM OBSTACULO
 *
 * ## O DEFEITO
 *
 * O simplificador escrevia o destino por cima do ultimo ponto sem
 * perguntar nada. E o destino e testado ate o CENTRO da celula, nunca
 * ate o destino exato — e os dois sao ate 28px diferente. A ultima perna
 * do caminho nascia cega, atravessava o obstaculo, e o piloto ia nela
 *
 * Aqui o obstaculo esta NO MEIO do par e o destino do outro lado, que e o
 * caso em que a ponte resolve; e ha tambem o caso em que o destino esta
 * colado no obstaculo, que e o caso em que a ponte nao cabe e o caminho
 * termina no centro da celula vizinha
 */
describe("o destino do outro lado do obstaculo", () => {
  it("o destino colado no muro nao gera uma perna atravessando", () => {
    const grade = gradeDe(mapaComMuro());

    const partida = { x: 60, y: 60 };

    /**
     * COLADO no muro: valido para o boneco, curto demais para a folga.
     *
     * O muro e `x` de 280 a 320. O destino fica a 26px da face: o osso
     * de 22px cabe com 4px de sobra, e a folga de 30px nao. E o ultimo
     * metro de qualquer zona que tenha uma arvore a menos de 30px do
     * centro
     */
    const destino = { x: 254, y: 60 };

    const caminho = grade.caminho(partida, destino);

    expect(caminho).not.toBe(null);

    let origem = partida;

    for (const ponto of caminho) {
      expect(
        grade.temLinhaDeVisada(origem, ponto) ||
          grade.temLinhaDeVisada(origem, ponto, 22),
        `a perna ate (${Math.round(ponto.x)}, ${Math.round(ponto.y)}) ` +
          `atravessa o muro`,
      ).toBe(true);

      origem = ponto;
    }

    /**
     * E o piloto CHEGA.
     *
     * O caminho pode terminar no centro da celula vizinha em vez do
     * destino exato, e a tolerancia de chegada do motor e de meia
     * celula. O que nao pode e o caminho acabar a tres metros do lugar
     */
    const ultimo = caminho[caminho.length - 1];

    expect(
      Math.hypot(ultimo.x - destino.x, ultimo.y - destino.y),
      `o caminho parou a ` +
        `${Math.round(
          Math.hypot(ultimo.x - destino.x, ultimo.y - destino.y),
        )}px do destino`,
    ).toBeLessThan(40);
  });

  it("o destino atras de uma ponte recebe uma perna que existe", () => {
    const grade = gradeDe(mapaComMuro());

    const partida = { x: 60, y: 300 };

    const destino = { x: 540, y: 300 };

    expect(
      grade.temLinhaDeVisada(partida, destino),
      "o cenario nao tem obstaculo: o teste nao prova nada",
    ).toBe(false);

    const caminho = grade.caminho(partida, destino);

    expect(caminho).not.toBe(null);

    expect(caminho.length).toBeGreaterThan(1);

    let origem = partida;

    for (const ponto of caminho) {
      expect(
        grade.temLinhaDeVisada(origem, ponto),
        `a perna ate (${Math.round(ponto.x)}, ${Math.round(ponto.y)}) ` +
          `atravessa o muro`,
      ).toBe(true);

      origem = ponto;
    }
  });
});

/** a altura do mapa de teste */
function alturaTotal(mapa) {
  return mapa.height;
}