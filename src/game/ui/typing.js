/**
 * O jogo esta DIGITANDO?
 *
 * Ate aqui os dois `keydown` do jogo — o da HUD, que abre painel, e o
 * do canvas, que anda e usa skill — escutavam o `window` sem perguntar
 * aonde a tecla foi. Com o foco num campo de texto, isso significava
 * duas coisas ruins ao mesmo tempo:
 *
 * 1. **o painel abria.** Digitar `b` no nome da guilda abria o
 *    bestiario por cima do campo que o jogador estava usando
 * 2. **o personagem andava.** `w`, `a`, `s` e `d` iam para o servidor
 *    como ordem de movimento, e o boneco saia andando enquanto o
 *    jogador escrevia o nome do clan
 *
 * Nenhum dos dois lados pode resolver sozinho: quem tem o atalho de
 * painel e a HUD, quem tem o movimento e o canvas, e os dois precisam
 * da MESMA resposta — senao um deles deixa a tecla passar
 *
 * Este modulo e o unico lugar que sabe a resposta. Os dois importam
 */

/**
 * Os campos onde o jogador escreve.
 *
 * `SELECT` entrou porque trocar de aba num `<select>` tambem e uma
 * digitacao, e o jogo usa `<select>` para paginas de skill
 */
const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Os `<input>` que NAO recebem texto.
 *
 * Fica aqui e nao dentro da funcao: e uma constante, e um `new Set` a
 * cada tecla seria trabalho jogado fora. O `type` e vazio num
 * `<input>` sem atributo, e nesse caso o padrao e `text` — que e o que
 * a ausencia deste conjunto quer dizer
 */
const SEM_TEXTO = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "range",
  "color",
  "file",
]);

/**
 * `true` quando o evento nasceu num campo de texto.
 *
 * Recebe o EVENTO e nao o `document.activeElement` de proposito: quem
 * chama ja tem o evento na mao, e o `activeElement` pode estar um
 * quadro atras do `target` num foco trocado no mesmo aperto — que e
 * exatamente o caso do clique no campo
 *
 * Nao referencia `window` nem `document`, e e uma funcao pura sobre o
 * `target`. Um `keydown` disparado na janela tem `target` sem `tagName`,
 * e cai fora de `CAMPOS` sozinho — o mesmo resultado de uma checagem
 * explicita, sem o globals
 *
 * `checkbox` e `button` sao INPUT mas nao aceitam texto. Deixar um
 * checkbox na lista faria o auto e as skills morrerem sempre que o
 * jogador marcasse "ataque automatico", e aquilo nao e digitacao
 */
export function digitandoEm(evento) {
  const alvo = evento?.target;

  if (!alvo) return false;

  if (alvo.isContentEditable) return true;

  if (!CAMPOS.has(alvo.tagName)) return false;

  return !SEM_TEXTO.has((alvo.type ?? "").toLowerCase());
}
