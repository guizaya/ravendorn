import { sessaoValida } from './api'
import { contaConectada } from './carteira'

/**
 * PARA ONDE "COMEÇAR AVENTURA" LEVA.
 *
 * ## A REGRA
 *
 * Sessão viva E carteira conectada vão para `/characters`. Qualquer coisa
 * diferente vai para `/auth`
 *
 * ## POR QUE SÃO DUAS CONDIÇÕES E NÃO SÓ UMA
 *
 * Porque elas respondem perguntas diferentes, e cada uma cobre a falha da
 * outra:
 *
 * - **sessão viva** é o que autoriza a API. Sem ela, `/characters` faz a
 *   chamada, recebe 401 e joga o jogador para o login — um ida-e-volta que
 *   não informa nada
 * - **carteira conectada** é o que garante que a sessão ainda é usável. Um
 *   token guardado no `localStorage` sobrevive a fechar o navegador, e
 *   sobrevive também a trava do MetaMask; nesse caso a sessão "válida" leva
 *   para uma tela que vai falhar no primeiro pedido
 *
 * ## POR QUE O DEFAULT É `/auth`
 *
 * Porque `/auth` é o caminho que funciona nos dois casos: ele pede a
 * assinatura quando falta e mostra o botão de conectar quando falta a
 * carteira. Mandar para `/auth` nunca perde nada — mandar para
 * `/characters` sem sessão perde
 */
export async function destinoDaAventura(): Promise<'/characters' | '/auth'> {
  if (!sessaoValida()) return '/auth'

  const conta = await contaConectada()

  return conta ? '/characters' : '/auth'
}