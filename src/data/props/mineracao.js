/**
 * A MINERACAO DE STEEL: as regras, e nao o lugar delas.
 *
 * O que decide QUEM da steel e QUANDO esta no `GameServer`, porque o
 * servidor e quem manda no tempo e no saldo. O que este arquivo guarda e
 * o numero: quanto tempo dura uma batida, quanto vale, quantas cabem em
 * cada pedra e quanto tempo a pedra demolida fica fora
 *
 * ## POR QUE O ROLAGEM DO STEEL ESTA AQUI E NAO NO SERVIDOR
 *
 * Porque o sorteio usa a mesma `createRandom` que semeia as props, e a
 * soma de um dado de 20 bytes em um arquivo de 300 linhas nao compra
 * nenhuma clareza. O que importa e o STEEL POR BATIDA ser um dado e nao
 * um numero solto no meio de um `if`
 */

import { PROP_TYPES } from "./index.js";

/**
 * QUANTO TEMPO DURA UMA BATIDA, EM SEGUNDOS.
 *
 * O pedido do usuario: dez segundos por batida. E o numero que faz o
 * painel conseguir prometer tempo em vez de so mostrar "faltam 7" — com
 * ele, "faltam 7 batidas" e "1min10" sao a mesma frase
 */
export const SEGUNDOS_POR_BATIDA = 10;

/**
 * QUANTO TEMPO A PEDRA DEMOLIDA FICA FORA DO MAPA, EM SEGUNDOS.
 *
 * O pedido foi "volta depois de um tempo", sem numero. 120s e o que faz
 * o campo se sustentar: com 2 lendarios de 200s de mineracao cada, um
 * tempo menor que isso devolveria a pedra antes de o jogador conseguir
 * terminar a segunda, e o campo nunca secaria de verdade
 *
 * E UM NUMERO SO, e nao um por raridade, porque foi o que foi pedido. O
 * lendario demora 200s para cair e 120s para voltar, entao um jogador
 * dedicado puxa mais lendario do que comum — o campo nao esvazia, e so
 * muda de mao
 */
export const PEDRA_VOLTA_EM_S = 120;

/**
 * QUANTO STEEL CADA BATIDA DRA.
 *
 * Uma tabela e nao um `1 + floor(random() * 3)`: o `1` tem de ser o
 * resultado mais comum, e o sorteio uniforme daria um terço para cada
 * numero. A soma das tres e 1, e o servidor sorteia um ponto nesse
 * intervalo — e o mesmo metodo de peso do `pickPlanEntry` das props, e
 * por isso que o mesmo arquivo precisa da `createRandom`
 */
export const STEEL_POR_BATIDA = [
  { steel: 1, peso: 0.55 },
  { steel: 2, peso: 0.3 },
  { steel: 3, peso: 0.15 },
];

/** O TETO DE STEEL QUE UMA BATIDA PODE DAR, para o painel e para o save. */
export const STEEL_MAXIMO_POR_BATIDA = STEEL_POR_BATIDA.reduce(
  (maior, entrada) => Math.max(maior, entrada.steel),
  0,
);

/**
 * O TOTAL DE STEEL QUE UMA PEDIDA ENTREGA, DE PONTO.
 *
 * Serve para o painel mostrar o teto antes de o jogador gastar tres
 * minutos na pedra lendaria sem saber o tamanho do premio. E um teto, nao
 * uma promessa: o sorteio real raramente bate nele
 */
export function steelMaximoDe(batidas) {
  return batidas * STEEL_MAXIMO_POR_BATIDA;
}

/**
 * QUANTAS BATIDAS UMA PEDIDA DÁ.
 *
 * Vem do proprio tipo da prop, do campo `batidas`. Um tipo sem o campo
 * devolve 0, que e a resposta para "esta prop nao se mineraria"
 */
export function batidasDe(typeId) {
  return PROP_TYPES[typeId]?.batidas ?? 0;
}

/** ESTA PROP SE MINERA? So o cristal do vale 1 tem `mineravel: true`. */
export function mineravel(typeId) {
  return PROP_TYPES[typeId]?.mineravel === true;
}

/**
 * A FOLGA QUE DIZ QUE O JOGADOR ESTA ENCOSTADO, EM PIXEL.
 *
 * ## POR QUE ESTE NUMERO PRECISA SER O MESMO NOS DOIS LADOS
 *
 * O motor decide que o jogador CHEGOU, e o servidor decide se a batida
 * CAI. Se os dois usassem numeros diferentes, o servidor veria o jogador
 * longe enquanto o motor o considerava parado na pedra — e a batida
 * cairia com o boneco a um passo de distancia, sem animacao nenhuma na
 * tela
 *
 * E o `+18` nao e enfeite. Com a comparacao nua, o jogador encostaria
 * exatamente na borda do solido e o `resolveOverlap`, que roda todo quadro
 * e empurra o jogador para fora de qualquer solido, o empurraria para
 * tras a cada tique: o boneco treme na borda da pedra a 10s de distancia
 * de receber steel
 */
export const FOLGA_ENCOSTADO = 18;

/**
 * DE QUANTO EM QUANTO TEMPO O CAMINHO ATÉ A PEDIDA E REFEITO, EM
 * SEGUNDOS.
 *
 * So quando o caminho ACABA, e nao a cada tique. O A* deste mapa e caro —
 * grade de 40px sobre 5920x4120 — e refaze-lo a 20Hz para um jogador
 * atravessando o vale seriam 20 buscas por segundo para um caminho que nao
 * mudou
 */
export const RECALCULA_CAMINHO_S = 0.5;

/**
 * DE QUANTO TEMPO O JOGADOR PODE EMPURRAR A PEDIDA SEM AVANCO.
 *
 * Quatro segundos de sobra: um boneco a 165px/s atravessa 660px nesse
 * tempo, e a maior distancia entre duas pedras do vale e bem menor que isso
 *
 * E o que impede o sintoma de "o boneco treme contra a pedra sem travar". Um
 * espaco menor que o diametro do jogador entre ele e a rocha faz o
 * `moveEntity` recusar os DOIS eixos para sempre, e sem este prazo o pedido
 * ficaria aberto com a locomocao travada
 */
export const MINERACAO_TRAVA_S = 4;

/**
 * OS SEGUNDOS QUE FALTAM PARA ACABAR A PEDIDA. */
export function segundosRestantes(batidasRestantes) {
  return Math.max(0, batidasRestantes) * SEGUNDOS_POR_BATIDA;
}

/** O MESMO TEMPO, ESCREVIDO PARA O PAINEL. `95` vira `1min35`. */
export function formatarTempo(segundos) {
  const total = Math.max(0, Math.round(segundos));

  if (total < 60) return `${total}s`;

  const minutos = Math.floor(total / 60);
  const resto = total % 60;

  if (resto === 0) return `${minutos}min`;

  return `${minutos}min${String(resto).padStart(2, "0")}`;
}

/**
 * A DISTANCIA DO JOGADOR ATE A ARTE DA PEDIDA.
 *
 * ## POR QUE A DISTANCIA E ATE A CAIXA, E NAO ATE O PONTO DA PROP
 *
 * Porque a prop esta no PE do cristal (`base: 1`) e a arte sobe 180px
 * acima dele. Medindo a distancia ate o PE, quem encostava na lateral da
 * pedra ficava a 91px — dentro do limite — e quem encostava na PONTA DE
 * CIMA ficava a 202px — fora dele. A mesma pedra aceitaria mineracao pela
 * esquerda e recusaria pelo alto, e o jogador que clicasse na ponta de
 * cima veria o boneco chegar, ficar parado e nunca receber steel
 *
 * A distancia ate a CAIXA e a mesma nos quatro lados, que e o que o olho
 * do jogador espera
 *
 * ## POR QUE O PONTO MAIS PROXIMO DA CAIXA, E NAO O CENTRO
 *
 * Porque o centro esta DENTRO da arte, e a conta de "esta encostado"
 * precisa valer para quem entrou no cristal por um bug de colisao
 */
export function distanciaAteArte(x, y, prop, typeId) {
  const tipo = PROP_TYPES[typeId];

  const meia = (tipo?.drawWidth ?? 0) / 2;
  const altura = tipo?.drawHeight ?? 0;
  const base = tipo?.base ?? 1;

  const x0 = prop.x - meia;
  const x1 = prop.x + meia;
  const y0 = prop.y - altura * base;
  const y1 = prop.y;

  const presoX = Math.min(Math.max(x, x0), x1);
  const presoY = Math.min(Math.max(y, y0), y1);

  return Math.hypot(x - presoX, y - presoY);
}

/**
 * O PONTO DA ARTE MAIS PROXIMO DO JOGADOR.
 *
 * E o ponto da CAIXA mais perto de onde ele esta: se ele esta em cima da
 * pedra, e a propria face de cima; se esta a esquerda, e a face esquerda
 *
 * ## POR QUE O ALVO DA CAMINHADA E A PROPRIA PEDIDA
 *
 * Porque antes o alvo era um ponto LONGE da arte, do lado de onde o jogador
 * ja estava, calculado para ser um lugar onde ele coubesse. Um alvo assim e
 *alcancavel so em linha reta, e a ultima perna empurrava o jogador contra o
 * vazio de um ponto que ele nunca alcançava: quando outra pedra estava no
 * meio, o `moveEntity` recusava o eixo e o jogador escorregava para frente e
 * para tras sem nunca travar na rocha
 *
 * Apontar para a PRÓPRIA pedra resolve a classe inteira do problema: a
 * direcao e sempre para a rocha, ela nao depende de um ponto externo, e quem
 * para o jogador e a colisao na borda — que e a 22px da arte, dentro dos
 * 40px do `encostadoNaPedida`. O painel abre na hora em que ele encosta
 */
export function superficieDaArte(x, y, prop, typeId) {
  const tipo = PROP_TYPES[typeId];

  const meia = (tipo?.drawWidth ?? 0) / 2;
  const altura = tipo?.drawHeight ?? 0;
  const base = tipo?.base ?? 1;

  return {
    x: Math.min(Math.max(x, prop.x - meia), prop.x + meia),
    y: Math.min(
      Math.max(y, prop.y - altura * base),
      prop.y,
    ),
  };
}

/**
 * O JOGADOR ESTA ENCOSTADO NESTA PEDIDA?
 *
 * E a FUNCAO, e nao uma conta repetida em dois lugares. O motor decide que
 * o jogador chegou e o servidor decide se a batida cai; se os dois usassem
 * numeros escritos por conta propria, divergiriam no primeiro ajuste de
 * folga e o jogador receberia steel de uma pedra a um passo de distancia
 *
 * ## POR QUE `+ FOLGA_ENCOSTADO` E NAO SO O RAIO DO JOGADOR
 *
 * Porque o `resolveOverlap` roda todo quadro e empurra o jogador para fora
 * de qualquer solido em que ele entre. Com a comparacao nua, o jogador
 * encostaria exatamente na borda e o `resolveOverlap` o jogaria para tras a
 * cada tique: o boneco tremeria na borda da pedra a 10s de receber steel
 */
export function encostadoNaPedida(x, y, prop, raioJogador) {
  if (!prop) return false;

  return (
    distanciaAteArte(x, y, prop, prop.type) <=
    raioJogador + FOLGA_ENCOSTADO
  );
}

/**
 * SORTEIA O STEEL DE UMA BATIDA.
 *
 * O `random` e a `createRandom` da sessao, nao o `Math.random`. Nao e
 * detalhe: o sorteio precisa ser reproduzivel a partir da semente para
 * que o servidor que calcula o steel e o cliente que mostra a animacao
 * contem a mesma historia
 */
export function sortearSteel(random) {
  const ponto = random();

  let acumulado = 0;

  for (const entrada of STEEL_POR_BATIDA) {
    acumulado += entrada.peso;

    if (ponto < acumulado) return entrada.steel;
  }

  return STEEL_POR_BATIDA[STEEL_POR_BATIDA.length - 1].steel;
}
