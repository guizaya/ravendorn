import logo from '@/assets/project/logo.png'

/**
 * O NOME DO PROJETO, EM UM LUGAR SO.
 *
 * Antes cada tela escrevia `ELDORIA` no seu proprio `title`, na sua
 * `description` e na sua wordmark. Sao seis telas e tres lugares por tela, e
 * uma troca de nome passava batendo em dezoito strings — das quais era
 * facil esquecer uma.
 *
 * Este e o unico lugar onde o nome vive no front. As rotas importam e usam em
 * `title`, `description` e `og:*`; a wordmark usa `<MarcaRavenDorn />`.
 *
 * ## POR QUE A WORDMARK E A IMAGEM E NAO O TEXTO
 *
 * Porque a logo e arte, e uma logo desenhada como texto sobdora o desenho:
 * quem fez `logo.png` escolheu o desenho da palavra, e reescrever com a
 * fonte do site joga fora essa escolha. O texto continua no `alt` da imagem,
 * que e o que o leitor de tela le e o que o buscador indexa
 *
 * ## POR QUE O `sizes` ESTA FIXO
 *
 * Porque a logo e um PNG quadrado de 1600px e o navegador precisa saber o
 * tamanho de SLOT antes de o arquivo chegar — sem `width`/`height` o layout
 * pula quando a arte carrega. O `sizes` com o `w` do slot mantem a caixa com
 * a altura certa enquanto o download acontece
 */
export const NOME_DO_PROJETO = 'RavenDorn'

/**
 * A MARCA DA CASA.
 *
 * `tamanho` e a ALTURA em pixel de mundo da arte, e ela e a unica coisa que
 * muda entre as quatro telas. O `className` vai no `<a>` de quem chama,
 * porque cada tela tem o seu proprio `className` de wordmark e sobrescrever
 * aqui quebraria o `justify-center` da tela de entrada
 */
export function MarcaRavenDorn({ tamanho = 40, className = '' }: { tamanho?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt={NOME_DO_PROJETO}
      className={`marca ${className}`.trim()}
      width={tamanho}
      height={tamanho}
      style={{ width: tamanho, height: tamanho }}
    />
  )
}