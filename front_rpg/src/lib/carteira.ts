/**
 * A CARTEIRA DO NAVEGADOR, e o passo de assinar.
 *
 * ## POR QUE ESTE ARQUIVO EXISTE
 *
 * Assinar e preciso em DOIS momentos: quando a pessoa entra na conta e
 * quando ela entra no jogo com um personagem. O passo e o mesmo nos dois —
 * `personal_sign` com a mensagem que o servidor montou — e ele estava escrito
 * dentro da tela de login, onde a tela de personagens nao alcançava
 *
 *## POR QUE A ASSINATURA NAO FICA AQUI DENTRO
 *
 * Porque `entrarComCarteira` e `pedirTokenDeEntrada` recebem um CALLBACK de
 * assinatura, e nao a carteira. A carteira e do jogador e a MetaMask e uma
 * extensao que so existe no navegador: quem assina precisa estar no
 * `useEffect`/no clique, e nao dentro de uma funcao de rede. O callback e o
 * que permite testar o fluxo sem carteira
 *
 * ## POR QUE `eth_accounts` E NAO `eth_requestAccounts` AQUI
 *
 * Porque este passo nao pode abrir o pedido de permissao. Quem chama ja
 * passou por `entrarComCarteira`, que chamou `eth_requestAccounts` — a conta
 * esta autorizada e este passo e silencioso. Se a conta nao estiver
 * autorizada, `eth_accounts` devolve vazio e a funcao diz "nenhuma conta
 * conectada", que e a resposta certa
 *
 * ## E POR QUE O ENDERECO VAI NO SEGUNDO PARAMETRO
 *
 * Porque e o que a EIP-191 pede: `personal_sign` recebe `[mensagem, endereco]`.
 * Invertido, a MetaMask abre a tela de assinatura e a pessoa fica olhando
 * para a mensagem em hexadecimal
 */

/**
 * So o que o front usa: pedir as contas e pedir uma assinatura. Tipar
 * `request` como `(o: unknown) => Promise<unknown>` obrigaria a converter o
 * resultado em CADA chamada, e a conversao mais segura e o `as` no ponto
 * onde o formato e esperado
 */
export type CarteiraEthereum = {
  request: (requisicao: { method: string; params?: unknown[] }) => Promise<unknown>
}

/** A carteira da pagina, ou `null` quando nao ha extensao nenhuma. */
export function carteiraDoNavegador(): CarteiraEthereum | null {
  if (typeof window === 'undefined') return null

  return (window as unknown as { ethereum?: CarteiraEthereum }).ethereum ?? null
}

/**
 * A CONTA CONECTADA NA METAMASK, ou `null`.
 *
 * E a funcao que decide se o jogador esta "conectado com a MetaMask no
 * site". Diferente do `assinarComCarteira`, ela NUNCA abre um pedido de
 * permissao: se a conta nao estiver autorizada, `eth_accounts` devolve vazio
 * e a resposta e `null` — que e o que a tela inicial quer saber
 *
 * ## POR QUE O `try` ENGOLE O ERRO
 *
 * Porque `eth_accounts` RECUSA quando a MetaMask esta travada ou quando o
 * usuario recusou a permissao. Sem o `catch`, a tela inicial derrubaria num
 * rejeitado so por causa de um clique num botão — e um botão de navegação
 * que lanca exceção é um botão quebrado
 *
 * ## E POR QUE ELA VIVE AQUI, E NÃO NA TELA
 *
 * Porque "tem carteira" e uma pergunta do navegador, igual a assinatura. A
 * tela inicial é uma das que precisa dela, e ela não deve repetir o
 * `window.ethereum` — que é um `any` na prática
 */
export async function contaConectada(): Promise<string | null> {
  const ethereum = carteiraDoNavegador()

  if (!ethereum) return null

  try {
    const contas = (await ethereum.request({ method: 'eth_accounts' })) as string[]

    return contas?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * Assina `mensagem` com a conta ja conectada.
 *
 * E a funcao que os dois fluxos repassam: a tela de entrada assina a
 * mensagem de vincular a carteira, e a tela de personagens assina a mensagem
 * de entrar no jogo
 */
export async function assinarComCarteira(mensagem: string): Promise<string> {
  const ethereum = carteiraDoNavegador()

  if (!ethereum) throw new Error('MetaMask não encontrada.')

  const contas = (await ethereum.request({ method: 'eth_accounts' })) as string[]

  if (!contas?.[0]) throw new Error('Nenhuma conta conectada.')

  return (await ethereum.request({
    method: 'personal_sign',
    params: [mensagem, contas[0]],
  })) as string
}