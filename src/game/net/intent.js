/**
 * Converte o que o jogador digitou na INTENCAO que o servidor
 * entende.
 *
 * O cliente nunca manda posicao, so o vetor de direcao. E o
 * servidor que decide o quanto andar. Sem esta separacao, um
 * cliente modificado mandaria `x: 9999` e teleportaria.
 *
 * A funcao e pura de proposito: e a parte que precisa estar
 * correta mesmo com o servidor fora, e por isso tem teste sem
 * WebSocket nenhum.
 */

import { mapaDeBinds, vetorDeMovimento } from "../input/keybinds.js";

/**
 * O vetor de movimento, ja normalizado.
 *
 * A normalizacao e o ponto: segurar D e W ao mesmo tempo produz
 * `(1, 1)`, cuja magnitude e 1.41. Sem cortar, o jogador andaria
 * 41% mais rapido na diagonal do que em linha reta, e o
 * servidor nao teria como corrigir.
 *
 * ## POR QUE ELA VEM DO `keybinds` E NAO DAS LISTAS DE TECLAS
 *
 * ## O ONLINE TINHA A MESMA DOENCA DO MOTOR
 *
 * Estas quatro listas eram a copia do `KeyD` hardcoded em outro lugar: o
 * jogador trocava a tecla no painel, o motor offline andava com a nova, e o
 * online andava com a velha. Pior que o offline, porque o online nao da para
 * cair para testar
 *
 * E por isso que o `mapa` e um PARAMETRO com padrao, e nao uma leitura de
 * modulo: a funcao continua pura para quem passa o mapa, e o `net.test.js`
 * continua testando os padroes sem tocar em `localStorage`
 *
 * ## E POR QUE O SERVIDOR NAO PRECISA SABER DAS TECLAS
 *
 * Porque ele nunca recebeu codigo de tecla: recebe `moveX` e `moveY` ja
 * prontos. Um bind novo nao muda nada no servidor — que e o que faz este ser
 * uma preferencia local e nao uma configuracao de conta
 */
export function moveFromKeys(keys, mapa = mapaDeBinds()) {
  const { x, y } = vetorDeMovimento(keys, mapa);

  return limitar({ x, y });
}

/**
 * O vetor de mira, a partir do ponteiro em relacao ao centro do
 * jogador na tela.
 *
 * O jogador e desenhado no centro da camera, entao o ponteiro
 * acima dele e "cima". Mandar a posicao do mouse em pixels nao
 * faria sentido no servidor: a resolucao do cliente nao e a de
 * ninguem mais.
 *
 * O resultado e sempre um VETOR UNITARIO (ou zero). Uma mira de
 * comprimento 0.3 etaizeria o motor a apontar 0.3 de lado em vez
 * de lado, e o tiro sairia torto perto do jogador.
 */
export function aimFromPointer(
  ponteiro,
  jogadorTela,
  { alcance = 100, zonaMorta = 6 } = {},
) {
  if (!ponteiro?.inside) return { x: 0, y: 0 };

  const dx = ponteiro.x - (jogadorTela?.x ?? 0);
  const dy = ponteiro.y - (jogadorTela?.y ?? 0);

  // o ponteiro em cima do proprio jogador nao e mira nenhuma
  if (Math.hypot(dx, dy) <= zonaMorta) return { x: 0, y: 0 };

  return normalizar({ x: dx, y: dy });
}

/**
 * Escala o vetor para comprimento 1, qualquer que seja o valor.
 *
 * `limitar` so CORTE o que passa de 1, e serve para o
 * movimento, onde segurar duas teclas deve dar a mesma
 * velocidade. A mira e o contrario: um ponteiro a 3 pixels do
 * jogador e um a 300 pixels apontam para a MESMA direcao, e o
 * alcance da habilidade e responsabilidade do motor, que conhece
 * a classe. Sem normalizar, o tiro sairia torto de perto.
 */
export function normalizar({ x, y }) {
  const nx = Number.isFinite(x) ? x : 0;
  const ny = Number.isFinite(y) ? y : 0;

  const tamanho = Math.hypot(nx, ny);

  if (tamanho === 0) return { x: 0, y: 0 };

  return { x: nx / tamanho, y: ny / tamanho };
}

/** Corta o comprimento em 1 e descarta valores que nao sao numero. */
export function limitar({ x, y }) {
  const nx = Number.isFinite(x) ? x : 0;
  const ny = Number.isFinite(y) ? y : 0;

  const tamanho = Math.hypot(nx, ny);

  if (tamanho <= 1) return { x: nx, y: ny };
  if (tamanho === 0) return { x: 0, y: 0 };

  return { x: nx / tamanho, y: ny / tamanho };
}

/** O jogador esta andando? Determina se o sprite deve andar. */
export function estaAndando(keys) {
  return moveFromKeys(keys).x !== 0 || moveFromKeys(keys).y !== 0;
}
