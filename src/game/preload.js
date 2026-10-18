/**
 * O PRELOAD DE FUNDO DA ARTE DO MUNDO.
 *
 * ## O DEFEITO QUE ISTO CONSERTA
 *
 * Trocar de mapa carregava o CHAO antes do `setMap` — o motor ja faz isso, e
 * funciona. O que nao tinha preload eram as folhas dos MOBS: elas entram por
 * `new Image()` no instante em que o bicho e criado, e so quando o bicho entra
 * em cena. Indo do mapa da base para o mapa 1, o jogador via o chao pronto e os
 * bichos aparecendo aos poucos, um por um, com a luta ja comecando. Em
 * diagonal, com dez bichos na tela, era dez pedidos de rede competing com o
 * motor
 *
 * ## POR QUE PRELOAD, E NAO ESPERAR
 *
 * Porque a folha de mob e uma imagem pequena e o mapa ja esta em cena. Nao
 * existe uma "travessia" esperando, como existe no caso do chao: a espera
 * acontece no meio do jogo, e e exatamente onde ela incomoda. O preload tira o
 * download do meio do jogo e coloca ele na janela em que ninguem esta vendo —
 * logo depois de o mundo comecar a andar
 *
 * ## E POR QUE DEPOIS DO MUNDO ESTAR PRONTO, E NAO ANTES
 *
 * ## Porque antes custaria caro ao primeiro jogador, e o ganho quase nunca aparece
 *
 * Sao 14 folhas de mob (1,7 MB) e 8 folhas de tile. Baixar isso antes de o
 * primeiro quadro atrasaria a entrada de todo mundo — e o primeiro jogador e o
 * unico que pagaria por um ganho que so aparece quando ele andar para o mapa
 * seguinte
 *
 * Aqui o jogo ja esta jogavel quando o preload comeca. Quem fica na base
 * minutos (e e o caso comum, a base e onde se fica) nunca chega a pagar por
 * nenhum byte destes, porque o navegador so guarda o que foi realmente baixado
 *
 * ## E POR QUE UM DE CADA VEZ
 *
 * Porque dez `new Image()` juntos brigam pela mesma conexao: cada um ganha
 * uma fatia, nenhum termina, e a latencia de TODOS sobe. Como sao 22 arquivos
 * de 30 a 570 KB, o certo e um por vez — o proximo comecar depois do anterior
 * terminar mantem a conexao cheia em vez de fragmentada
 *
 * ## E POR QUE NO TEMPO OCIOSO
 *
 * Porque `requestIdleCallback` e o unico momento em que o navegador esta
 *.ensure que ninguem esta esperando. O preload e o que roda enquanto o jogador
 * nao fez nada ainda no mapa novo — se ele esta andando ou lutando, o preload
 * espera. O `setTimeout` e a reserva para navegador sem a API
 */

import { folhasDeTodosOsMapas } from "./maps/registroDeTiles.js";
import { ENEMY_SPRITES } from "../data/sprites/enemies.js";

/** Ja rodou nesta sessao? O preload nao pode repetir. */
let jaPrecarregou = false;

/**
 * O `requestIdleCallback` COM RESERVA.
 *
 * O Safari nao tem a API. Sem o `setTimeout`, o preload simplesmente nunca
 * rodaria em boa parte dos navegadores de celular — que e onde a travessia
 * demora mais, porque a conexao e pior
 */
const tempoOcioso =
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? (funcao) => window.requestIdleCallback(funcao, { timeout: 3000 })
    : (funcao) => setTimeout(funcao, 1);

/**
 * AS FOLHAS DE MOB.
 *
 * O `ENEMY_SPRITES` e um objeto indexado por tipo de inimigo, e cada entrada
 * traz a sua `src`. O `Set` porque o mesmo sprite aparece em varias entradas:
 * `goblin-sheet.png` responde por dois bichos diferentes, e baixa-lo duas vezes
 * seria duas entradas no cache para o mesmo arquivo
 */
function folhasDeMob() {
  const folhas = new Set();

  for (const sprite of Object.values(ENEMY_SPRITES ?? {})) {
    if (typeof sprite?.src === "string" && sprite.src) folhas.add(sprite.src);
  }

  return folhas;
}

/**
 * BAIXA UMA FOLHA E PROMETE QUANDO TERMINOU.
 *
 * O `onload` e o `onerror` sao os dois necessarios: sem o `onerror`, uma folha
 * que responde 404 deixa a promessa pendurada para sempre, e a fila do preload
 * trava nela — o resto da arte nunca seria buscado, sem um unico erro no console
 */
function baixar(url) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof window.Image !== "function") {
      resolve();

      return;
    }

    const imagem = new window.Image();

    imagem.onload = () => resolve();
    imagem.onerror = () => resolve();

    // `decoding="async"` aqui tambem: o decode de uma folha de 570 KB trava a
    // thread principal se for na hora, e o jogo esta rodando
    imagem.decoding = "async";
    imagem.src = url;
  });
}

/**
 * A FILA.
 *
 * ## POR QUE RECURSIVA, E NAO UM `for` COM `await`
 *
 * Porque entre uma folha e outra tem de passar pelo tempo ocioso, e o
 * `requestIdleCallback` nao se cancela. A recursao com `setTimeout` entre uma e
 * outra mantem a cadeia honesta: so entra a proxima depois que a anterior
 * terminou E o navegador voltou a ficar ocioso
 *
 * ## E POR QUE SEM `Promise.all`
 *
 * Porque seria o caminho curto e seria ERRADO: `Promise.all` dispara os 22 de
 * uma vez, que e exatamente oCompetition de conexao que o comentario de cima
 * descreve
 */
async function puxarUma(filas, indice) {
  if (indice >= filas.length) return;

  await new Promise((resolve) => {
    tempoOcioso(() => resolve());
  });

  await baixar(filas[indice]);

  await puxarUma(filas, indice + 1);
}

/**
 * COMECA O PRELOAD. NAO ESPERA, E NAO TRAVA NADA.
 *
 * Quem chama nao recebe promessa e nao pode travar o jogo esperando. O preload
 * e um presente: o mundo ja esta pronto quando ele comeca
 */
export function precarregarArteDoMundo() {
  if (typeof window === "undefined") return;

  // So no cliente: no servidor nao ha `Image`, e o registro de tiles so foi
  // preenchido se os modulos de camada chegaram a ser importados
  if (jaPrecarregou) return;

  jaPrecarregou = true;

  const filas = [...folhasDeMob(), ...folhasDeTodosOsMapas()];

  if (!filas.length) return;

  // O primeiro item entra AGORA, sem passar pelo tempo ocioso: e o mais
  // provavel de ser o proximo que o jogador vai ver, e a fila ja tem 1 item de
  // folga para entrar enquanto ele decide andar
  baixar(filas[0]).then(() => puxarUma(filas, 1));

  if (typeof console !== "undefined" && import.meta.env?.DEV) {
    console.info(`[preload] ${filas.length} folhas do mundo na fila`);
  }
}