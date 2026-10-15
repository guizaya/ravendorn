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
 * ## O TAMANHO E DO CSS, E O `tamanho` E SO UM ESCAPE
 *
 * Antes este componente escrevia `style={{ width: tamanho, height: tamanho }}`
 * com `tamanho` valendo 40 por padrao. `style` inline ganha de qualquer
 * regra de `.classe`, entao a `.site-header .wordmark .marca { height: 56px }`
 * do `styles.css` nunca chegava a valer: o logo do header desenhava com 40px
 * exatamente como os outros, e a regra do header era codigo morto
 *
 * Agora o tamanho e do CSS e o componente nao escreve nada no `style`. O
 * `tamanho` continua existindo para quem precisar de um tamanho explicito
 * naquele ponto — e so nesse caso ele vira `style` inline de novo
 *
 * ## POR QUE ISSO E MELHOR E NAO SO UM `!important`
 *
 * Porque a largura e a altura da marca sao uma decisao de cada tela, e tres
 * telas ja discordam entre si: 40 no rodape, 56 no header. Isso e CSS, e o
 * CSS ja sabe. Um `!important` resolveria o sintoma e deixaria as duas
 * medidas em dois lugares — que e como a regra do header morreu
 *
 * A arte e um PNG de 1600x1600, entao subir ate 56 ou 72px nao borra: a
 * resolucao sobraria por uma ordem de grandeza
 */
export function MarcaRavenDorn({ tamanho = null, className = '' }: { tamanho?: number | null; className?: string }) {
  return (
    <img
      src={logo}
      alt={NOME_DO_PROJETO}
      className={`marca ${className}`.trim()}
      width={tamanho ?? undefined}
      height={tamanho ?? undefined}
      style={tamanho === null ? undefined : { width: tamanho, height: tamanho }}
    />
  )
}