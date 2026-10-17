import { iconeDaMoeda } from "../../data/icons/moedas.js";

/**
 * O ICONE DE UMA MOEDA.
 *
 * ## POR QUE UM COMPONENTE E NAO UM `<img>` SOLTO EM CADA LUGAR
 *
 * Porque o `◉` estava escrito em sete arquivos, cada um com um `<i>` proprio
 * e um `font-size` diferente. Uma correcao de tamanho ou de alinhamento
 * teria de ser feita em sete lugares, e o esquecimento de um deles aparecia
 * como moeda de um tamanho diferente da outra
 *
 * ## E POR QUE O `alt` E VAZIO
 *
 * Porque o glifo era `aria-hidden` e o numero ao lado e o que o leitor de
 * tela le. O `img` continua `aria-hidden` pelo mesmo motivo: ele nao carrega
 * informacao que o numero nao carrega
 *
 * ## E POR QUE O LADO VEM DO CSS, E NAO DE UM ATRIBUTO
 *
 * Porque o `width` e o `height` do `<img>` sao o que o navegador usa para
 * reservar o espaco antes da arte carregar. Deixar no `width`/`height` em vez
 * do `style` evita o salto de layout quando a imagem entra, e deixa o CSS
 * mandar no tamanho final
 *
 * @param {object} props
 * @param {"coins"|"steel"|"diamonds"} props.moeda o id da moeda
 * @param {number} [props.lado] o lado em pixels; o CSS decide se faltar
 * @param {string} [props.className] classe extra
 */
export default function IconeMoeda({ moeda, lado = null, className = "" }) {
  const src = iconeDaMoeda(moeda);

  /**
   * A MOEDA DESCONHECIDA.
   *
   * Nao ha glifo de reserva: um `?` seria uma moeda que o jogo nao tem, e o
   * melhor e o espaco vazio, que faz a falta aparecer no lugar certo em vez
   * de mascarada
   */
  if (!src) return null;

  return (
    <img
      className={`moeda ${className}`.trim()}
      src={src}
      alt=""
      aria-hidden="true"
      /**
       * A MOEDA COMO ATRIBUTO.
       *
       * Porque as tres artes vivem sob a mesma classe `moeda`, e so o
       * `src` as distinguia — o que nao da para estilizar. O atributo
       * deixa o CSS falar do steel sem dar uma classe nova para cada
       * chamador
       */
      data-moeda={moeda}
      width={lado ?? undefined}
      height={lado ?? undefined}
    />
  );
}
