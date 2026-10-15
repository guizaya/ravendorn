import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { entrarComCarteira, limparSessao } from '@/lib/api'
import { destinoDaAventura } from '@/lib/comecar'
import { assinarComCarteira } from '@/lib/carteira'
import world from '@/assets/world-map.png'
import metamaskLogo from '@/assets/metamask.png'
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
 * Era um SVG embutido aqui, e o desenho da raposa em low-poly passou a vir de
 * arquivo. O arquivo mora em `front_rpg/src/assets/` e nao em
 * `src/assets/icons/` da RAIZ: os dois sao apps Vite separados, e o `@/`
 * deste aponta para o proprio `front_rpg/src`. Importar pelo caminho da raiz
 * dariaria "module not found" no build
 *
 * ## POR QUE `alt=""` E `aria-hidden` AO MESMO TEMPO
 *
 * Porque o botao ao lado ja diz "Conectar MetaMask". Um `alt` com o nome do
 * icone faria o leitor de tela anunciar o nome duas vezes seguidas — a regra
 * de ouro do `alt` em imagem decorativa: ela descreve a IMAGEM, e aqui a
 * imagem nao acrescenta nada ao texto que ja esta do lado
 *
 * ## E POR QUE O `display: block`
 *
 * Porque o `img` e inline por padrao e reserva o espaco da linha de base
 * abaixo dele. Num botao `inline-flex` isso vira um descasamento de 3 ou 4px
 * entre o logo e o texto. O `flex` do botao transformaria o `img` em item de
 * bloco sozinho, mas o componente nao pode depender de estar dentro dele
 */
function MetaMaskIcon({ size = 18 }: { size?: number }) {
  return (
    <img
      src={metamaskLogo}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ display: 'block', flex: 'none' }}
    />
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