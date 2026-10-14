import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { entrarComCarteira, limparSessao } from '@/lib/api'
import { destinoDaAventura } from '@/lib/comecar'
import { assinarComCarteira } from '@/lib/carteira'
import world from '@/assets/world-map.png'
import { NOME_DO_PROJETO, MarcaRavenDorn } from '@/components/marca-projeto'

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [
    { title: `Entrar - ${NOME_DO_PROJETO}` },
    { name: 'description', content: `Entre em ${NOME_DO_PROJETO} com sua carteira e comece sua aventura.` },
    { property: 'og:title', content: `Entrar - ${NOME_DO_PROJETO}` },
    { property: 'og:description', content: `Entre em ${NOME_DO_PROJETO} com sua carteira e comece sua aventura.` },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: AuthPage,
})

/**
 * O LOGO DA METAMASK.
 *
 * Era o icone do Google, que nao e mais usado: o login por conta Google
 * dependia de um provedor de identidade de terceiro e saiu junto com ele. A
 * carteira e a identidade agora, e e verificada pelo servidor
 */
function MetaMaskIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path fill="#E2761B" d="M29.3 4.6 18.1 14.8l2.5-6.1 8.7-4.1z" />
      <path fill="#E4761B" d="M2.7 4.6 13.8 14.8l-2.4-6.1L2.7 4.6z" />
      <path fill="#F6851B" d="m23.9 22.6-3.2 4.9 6.8 1.9 2-6.7-5.6-.1zM8.1 22.7l-5.6 0 2 6.7 6.8-1.9-3.2-5z" />
      <path fill="#E4761B" d="M9.6 11.4 7.8 14l6.1.3-.2-6.2-4.1 3.3zM22.4 11.4 18.3 8.1l-.2 6.2 6.1-.3-1.8-2.6z" />
      <path fill="#F6851B" d="M18.1 14.8h-6.2l-.1 3.5 2.1 1.6-.1-.1 4.3 3.2v-4.7l-6.2-.2 6.2-.3z" />
      <path fill="#C0AC9D" d="m17.9 20.3-4.3-3.2.1.1-2.7 2v.1l6.9 5.1v-4.1zM21.9 14.6l-3.8-.2v4.7l6.9-5.1-3.1 2.4z" />
      <path fill="#161616" d="M13.9 11.1 17.8 7.3l-.2-.1-3.4 3.4-.1 3.4 2.4-2.5-2.6.6zM18.1 14.8h-6.2l.1 3.6 2.2 1.6 4.3-3.2v-4.7l-6.2.2 5.8.5z" />
    </svg>
  )
}

/**
 * A FRASE DE CADA RECUSA, DO SERVIDOR PARA O JOGADOR.
 *
 * O servidor devolve um codigo (`NOME_EM_USO`, `ASSINATURA_INVALIDA`), e a
 * traducao fica aqui. O texto de qualquer erro que nao esteja nesta lista
 * e o do proprio servidor: e melhor mostrar a frase tecnica do que
 * esconder um problema que alguem vai ter que investigar
 */
const ERROS: Record<string, string> = {
  ASSINATURA_INVALIDA: 'A assinatura não confere. Tente de novo.',
  ASSINATURA_DE_OUTRA_CARTEIRA: 'Essa assinatura é de outra carteira.',
  NONCE_DESCONHECIDO: 'A assinatura expirou. Tente de novo.',
  NONCE_EXPIRADO: 'A assinatura expirou. Tente de novo.',
  ENDERECO_INVALIDO: 'Carteira inválida.',
}

/**
 * O CODIGO DO ERRO DO SERVIDOR.
 *
 * Tipado como `string` e nao `string | undefined` de proposito: o `??`
 * abaixo existe porque o `Record` do TypeScript sempre devolve `undefined`
 * para chave que nao existe, e o projeto liga `noUncheckedIndexedAccess`
 */
function traduzirErro(erro: unknown): string {
  const e = erro as { status?: number; message?: string; dados?: { erro?: string } }

  if (e?.status === 401) return 'Sessão expirada. Entre de novo.'

  const codigo = e?.dados?.erro ?? (tentarLerCodigo(e?.message))
  const frase = codigo ? ERROS[codigo] : undefined

  return frase ?? 'Não foi possível conectar. Tente de novo.'
}

/**
 * O `chamar` joga o corpo da resposta dentro de `error.message`, entao o
 * codigo do servidor chega como JSON dentro de uma string
 */
function tentarLerCodigo(mensagem: string | undefined): string | undefined {
  if (!mensagem) return undefined

  try {
    const dados = JSON.parse(mensagem) as { erro?: string }
    return typeof dados.erro === 'string' ? dados.erro : undefined
  } catch {
    return undefined
  }
}

function AuthPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [conectado, setConectado] = useState<string | null>(null)

useEffect(() => {
    // quem ja tem sessao vai direto para os personagens. Sem isso, o
    // jogador logado veria a tela de entrar de novo ao clicar em "voltar".
    // E o `destinoDaAventura` e o MESMO que a home usa no botao "comecar
    // aventura": uma regra em dois lugares divergiria no primeiro token
    // vencido, e o jogador veria a home mandando para uma tela que
    // imediatamente joga ele para a outra
    void destinoDaAventura().then((destino) => {
      if (destino === '/characters') navigate({ to: '/characters' })
    })
  }, [navigate])

/**
   * A ASSINATURA VAI PARA A METAMASK.
   *
   * Este passo nao pode ser feito aqui dentro do `entrarComCarteira`: ele
   * precisa da carteira e a carteira e do jogador. Por isso a funcao
   * recebe um callback — quem assina e o navegador, via `window.ethereum`
   *
   * O passo em si mora em `lib/carteira.ts`, que e compartilhado com a tela
   * de personagens: entrar na conta e entrar no jogo assinam do mesmo jeito,
   * e o `personal_sign` escrito duas vezes seria o mesmo bug escrito duas
   * vezes
   */
  const assinarComMetaMask = assinarComCarteira

  async function handleConectar() {
    setBusy(true)
    setError(null)

    try {
      await entrarComCarteira(assinarComMetaMask)
      navigate({ to: '/characters' })
    } catch (e) {
      setError(traduzirErro(e))
      setBusy(false)
      return
    }

    setBusy(false)
  }

  function handleSair() {
    limparSessao()
    setConectado(null)
  }

  return (
    <div className="auth-screen">
      <img src={world} className="auth-art" alt="" aria-hidden="true" width={2176} height={1216} />
      <div className="auth-veil" />
      <div className="auth-card">
        <Link to="/" className="wordmark no-underline text-foreground justify-center"><MarcaRavenDorn /></Link>
        {conectado ? (
          <>
            <h1>Você já está conectado</h1>
            <p>{conectado}</p>
            <Button variant="game" asChild className="mt-6 w-full">
              <Link to="/characters">Continuar <ArrowRight /></Link>
            </Button>
            <Button variant="gameOutline" className="mt-2 w-full" onClick={handleSair}>Sair da conta</Button>
          </>
        ) : (
          <>
            <div className="eyebrow justify-center mt-8">ENTRADA DOS AVENTUREIROS</div>
            <h1>Entre na sua lenda</h1>
            <p>Um mundo. A sua lenda. Conecte sua carteira para começar sua aventura em {NOME_DO_PROJETO}.</p>
            <button className="auth-google" onClick={handleConectar} disabled={busy}>
              <MetaMaskIcon /> {busy ? 'Assinando…' : 'Conectar MetaMask'}
            </button>
            {error && <p className="auth-error">{error}</p>}
            <p className="auth-note">Sua carteira é a sua conta. Assinamos uma mensagem para provar que ela é sua — nada é gasto.</p>
          </>
        )}
      </div>
    </div>
  )
}