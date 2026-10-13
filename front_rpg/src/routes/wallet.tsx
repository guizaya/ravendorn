import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { NOME_DO_PROJETO } from '@/components/marca-projeto'

export const Route = createFileRoute('/wallet')({
  head: () => ({ meta: [{ title: `Conta - ${NOME_DO_PROJETO}` }] }),
  component: WalletRedirect,
})

/**
 * `/wallet` AGORA E SÓ UM REDIRECIONAMENTO.
 *
 * ## POR QUE A ROTA FICOU VAZIA
 *
 * Ela existia porque o login tinha duas etapas: o Google criava a conta, e
 * a carteira era vinculada DEPOIS, numa tela separada. A tela se garantia de
 * que ninguem jogasse sem carteira
 *
 * Agora a carteira e a propria identidade da conta, verificada pelo servidor
 * antes de a conta existir. Nao ha etapa depois do login, entao nao ha o que
 * esta tela faria
 *
 * ## POR QUE NAO APAGAR A ROTA
 *
 * Porque o endereco pode estar em um link salvo, no historico do navegador,
 * ou em um `favicon` antigo. Quem abrir `/wallet` cai em `/auth` em vez de
 * ver um 404, que e a diferenca entre "o site quebrou" e "o link mudou"
 *
 * ## POR QUE `replace`, E NAO `push`
 *
 * `push` deixaria `/wallet` no historico, e o botao "voltar" do navegador
 * devolveria o jogador a esta tela, que so redireciona: um ciclo de duas
 * voltas antes de sair. `replace` troca a entrada e o historico fica limpo
 */
function WalletRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/auth', replace: true })
  }, [navigate])

  return null
}