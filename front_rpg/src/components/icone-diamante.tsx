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
 *
* ## E POR QUE A CLASSE `chars-diamond` EXISTE
 *
 * Porque o CSS dos cartoes de selecao tem uma regra de arte que vale para
 * TODO `img` dentro deles:
 *
 *     .chars-slot img { position: absolute; inset: 0; width: 100%; height: 100%; }
 *
 * Ela existe para a arte do personagem, que preenche o cartao inteiro. Sem
 * uma classe propria, o `<img>` do diamante — que esta DENTRO do mesmo cartao,
 * no texto "N diamantes para desbloquear" — herdava essa regra e saia do fluxo
 * do texto.
 *
 * ## E POR QUE O TAMANHO VAI NO `style` E NAO NO CSS
 *
 * Porque a regra herdada traz `width: 100%`, e o CSS do cartao ganha do
 * atributo `width` do HTML. Cancelar isso no CSS com `width: auto` NAO
 * funciona: em um `<img>`, `auto` ignora o atributo e devolve o tamanho
 * INTRINSICO da arte (128x96), e o icone fica enorme.
 *
 * O `style` inline e o unico lugar que ganha da regra de arte sem depender de
 * `!important`, entao e la que o tamanho e posto. A classe cobre apenas o
 * `position`/`inset`, que nao conflita com nada
 */
export function IconeDiamante({ tamanho = 14 }: { tamanho?: number }) {
  const largura = Math.round(tamanho * (4 / 3))

  return (
    <img
      className="chars-diamond"
      src={diamante}
      alt=""
      aria-hidden="true"
      width={largura}
      height={tamanho}
      style={{ display: 'block', flex: 'none', width: largura, height: tamanho }}
    />
  )
}