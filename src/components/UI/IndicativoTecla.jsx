/**
 * O INDICATIVO DE TECLA QUE A HUD ESCREVE EMBAIXO DE CADA BOTAO.
 *
 * ## O QUE ELE SUBSTITUI
 *
 * A HUD escrevia `E` no dash e `R` na ultimate, literalmente no JSX, e o numero
 * do slot nas habilidades. Trocar uma tecla no painel deixava a HUD
 * anunciando a tecla antiga — o painel dizia "Espaco" e o jogo embaixo do
 * botao dizia "E", sem nenhum sinal de qual dos dois estava errado
 *
 * ## POR QUE UM COMPONENTE E NAO SO UMA FUNCAO
 *
 * Porque o nome da tecla muda SOZINHO, sem o React saber. O mapa de binds e um
 * `Map` modificado no lugar, e o React compara por referencia: ele so
 * redesenharia se um `useState` mudar. Com uma funcao pura o botao mostraria a
 * tecla antiga ate o jogador fechar e abrir o pause
 *
 * O `useSyncExternalStore` e o que amarra os dois: ele pergunta a versao do
 * mapa a cada render e se inscreve para ser avisado quando ela muda. A HUD
 * passa a reagir no mesmo instante em que o jogador confirma a tecla
 */

import { useSyncExternalStore } from "react";
import {
  assinarBinds,
  versaoDosBinds,
  teclaDaAcao,
  nomeDaTecla,
  nomeCurtoDaTecla,
} from "../../game/input/keybinds.js";

/**
 * A TECLA DE UMA ACAO, e o que a HUD precisa saber.
 *
 * ## POR QUE VOLTA TRES COISAS E NAO UMA
 *
 * Porque sao tres leituras diferentes com tres tamanhos diferentes:
 *
 * - `indicativo` vai no quadrado, e por isso vira glifo em "Espaco"
 * - `nome` vai no `data-tip`, e por isso fica escrito por extenso
 * - `code` nao vira nada visivel: ele existe para o `data-tecla`, que o CSS
 *   e o teste usam para descobrir a tecla sem ler o texto
 *
 * Devolver so o indicativo obrigaria cada `data-tip` a refazer a traducao, e
 * o tooltip do dash passaria a escrever "␣" — que e o oposto de tooltip
 */
export function useTeclaDaAcao(acaoId, indice = 0) {
  /**
   * A inscricao acontece uma vez por componente, e nao por tecla.
   *
   * Os oito slots da HUD assinam o mesmo numero: cada um re-renderiza sozinho
   * quando a versao muda, e nao ha um estado compartilhado para sincronizar
   */
  useSyncExternalStore(assinarBinds, versaoDosBinds, versaoDosBinds);

  const code = teclaDaAcao(acaoId, indice);

  return {
    code,
    nome: code ? nomeDaTecla(code) : "",
    indicativo: nomeCurtoDaTecla(code),
  };
}

/**
 * COMO ESTA TECLA VAI SER DESENHADA, e nao o que ela diz.
 *
 * ## POR QUE O CSS PRECISA SABER, E NAO SO O TEXTO
 *
 * Porque o quadrado da HUD foi desenhado para uma LETRA: 13px de largura, 3px
 * de padding lateral, `line-height` de 13px. Um glifo e um simbolo quadrado e
 * baixo — no mesmo quadrado ele fica encostado na base e colado nas bordas, e
 * o jogador deixa de ver uma tecla e passa a ver um caractem solto
 *
 * Sao tres formatos porque o desenho e a informacao:
 *
 * - `nome`  — "E", "F1": a letra e o melhor formato que existe
 * - `glifo` — "↑", "⇧": simbolo que precisa de fonte propria e de um
 *   quadrado um pouco maior para nao parecer colado na borda
 * - `barra` — o espaco: desenhada em CSS, e nao digitada
 */
function formaDaTecla(code, indicativo, nome) {
  if (!code) return "vazia";

  /**
   * O ESPACO E DESENHADO, E NAO DIGITADO.
   *
   * Porque `␣` e um simbolo denso: a 9px ele vira um borrão dentro de um
   * quadrado de 13px, que e exatamente o "parece um caractem solto" que o
   * jogador reclamou. Uma barra desenhada com CSS tem 2px de altura exata,
   * fica centrada sozinha e continua nitida em qualquer tamanho de fonte
   */
  if (code === "Space") return "barra";

  return indicativo !== nome ? "glifo" : "nome";
}

/**
 * O ELEMENTO PRONTO, para quem so quer escrever no quadrado.
 *
 * ## POR QUE UM `<kbd>` E NAO UM `<span>`
 *
 * Porque e o elemento que o padrao do HTML reserva para "esta e a tecla que
 * aperta". Ele sobrevive a um tema sem CSS, e o leitor de tela anuncia
 * "tecla" antes do conteudo — o que importa mais do que parece num jogo em
 * que o quadrado e clicavel
 *
 * ## E POR QUE A CLASSE `tecla-hud` VEM SEMPRE
 *
 * Porque o navegador poe `font-family: monospace` no `<kbd>`, e o resto do
 * jogo fala com a fonte da interface. Sem o reset, trocar a tecla do dash para
 * o espaco trocava a fonte daquele quadrado — e o jogador veria uma mudanca
 * de estilo no mesmo lugar onde so mudou a letra
 *
 * ## E O QUE ACONTECE COM A ACAO SEM TECLA
 *
 * O quadrado mostra um travessao e apaga. Sem a tecla, o botao continua
 * clicavel: o jogador pode apertar o espaco e nada acontecer, e o painel de
 * teclas e o lugar onde ele descobre que a tecla sumiu
 */
export default function IndicativoTecla({
  acao,
  indice = 0,
  className = "tecla-hud",
  semTecla = "—",
}) {
  const { code, nome, indicativo } = useTeclaDaAcao(acao, indice);

  const forma = formaDaTecla(code, indicativo, nome);

  return (
    <kbd
      className={`tecla-hud ${className}${code ? "" : " tecla-hud--vazia"}`}
      data-tecla={code}
      data-forma={forma}
    >
      {/*
        A BARRA DO ESPACO, e ela e CSS e nao texto.
      */}
      {forma === "barra" && <span className="tecla-hud__barra" />}

      {forma !== "barra" && (code ? indicativo : semTecla)}

      {/*
        O QUE O LEITOR DE TELA FALA.
      */}
      <span className="tecla-hud__oculto">
        {code ? nome : semTecla}
      </span>
    </kbd>
  );
}