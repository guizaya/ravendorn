import diamante from '@/assets/diamante.png'

/**
 * O ÍCONE DE DIAMANTE DESTA TELA.
 *
 * ## POR QUE A ARTE E NAO O `Gem` DO LUCIDE
 *
 * Porque o `Gem` e um glifo de contorno: um losango com um corte, lido como
 * "joia generica". O diamante do jogo — a mesma arte que o `IconeMoeda`
 * mostra na expansao da mochila e no mercado — e o que o jogador ja viu
 * gastando dinheiro. Ver o mesmo desenho nos dois lugares e o que faz a tela
 * de personagem parecer parte do jogo, e nao uma vitrine a parte
 *
 * ## POR QUE A ARTE FOI COPIADA PARA `front_rpg/src/assets/`
 *
 * Porque os dois sao apps Vite separados. O `@/` deste app aponta para o
 * proprio `front_rpg/src`, e o `src/` da raiz nao entra no grafo deste build:
 * um `import` para ca da "module not found" e nao um caminho relativo
 *
 * ## E POR QUE A LARGURA SAI DA ALTURA
 *
 * Porque a arte e de 1792x1344, uma razao de 4:3. Passando so a altura, um
 * `<img>` esticaria o diamante em cima e embaixo e ele viraria uma forma
 * alongada. A largura sai da altura pela mesma razao da arte, e o
 * `object-fit: contain` do CSS garante que nada mais distorca
 */
export function IconeDiamante({ tamanho = 14 }: { tamanho?: number }) {
  return (
    <img
      src={diamante}
      alt=""
      aria-hidden="true"
      width={Math.round(tamanho * (4 / 3))}
      height={tamanho}
      style={{ display: 'block', flex: 'none' }}
    />
  )
}