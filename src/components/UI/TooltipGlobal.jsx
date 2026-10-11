import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * O TOOLTIP GLOBAL: uma caixa para todos os `data-tip` do jogo.
 *
 * ## POR QUE UM SO COMPONENTE, E NAO UM `<Tip>` POR USO
 *
 * Sao 139 atributos de texto curto espalhados por 37 arquivos — "Fechar",
 * "Abrir missoes (Q)", "Base da classe: 104". Escrever um componente em
 * volta de cada um seria uma edicao manual em 37 lugares, e qualquer um
 * desses 139 que eu esquecesse seria um tooltip nativo do navegador
 * perdido no meio do jogo. Aqui a troca e MECANICA: o atributo `title` vira
 * `data-tip`, e este componente desenha todos
 *
 * ## POR QUE UM ESCUTA NO `document`, E NAO UM HOOK POR ELEMENTO
 *
 * Porque `data-tip` nao e um prop de React: e um atributo que o JSX repassa
 * sem transformar. Um hook por elemento exigiria trocar todos os 139 usos por
 * `<Tip>` — que e justamente o trabalho manual que este arquivo evita
 * `<Tip>` — que e justamente o trabalho manual que este arquivo evita
 *
 * ## POR QUE ESCUTA `mouseover` E NAO `mouseenter` EM CADA ALVO
 *
 * Porque `mouseover` faz BUBBLE. Um unico listener no `document` ve todos os
 * alvos, e o `closest("[data-tip]")` diz de qual deles o cursor veio. Com
 * um listener por elemento, sair de um botao para dentro de um filho dele
 * reabriria a caixa a cada movimento
 *
* ## E O DELAY DE 375ms
 *
 * Porque o painel tem dezenas de botoes em linha. Sem espera, atravessar o
 * painel com o cursor deixaria uma caixa para tras de cada botao, e o
 * jogador nao leria nenhuma. Parado de proposito, a caixa aparece rapido; o
 * mouse apenas passando por cima, nao
 *
 * Subiu de 250ms para 375ms (+50%) porque 250 ainda era curto demais para o
 * jogo: os botoes da HUD ficam a poucos pixels uns dos outros, e o cursor
 * que atravessava um corredor de icones aparecia em tres alvos antes de
 * parar em um. Com 375 o movimento tem de ser PARADO para abrir, e parar
 * e o que o jogador faz quando quer ler
 */
const DELAY_MS = 375;

/** quanto a caixa se afasta da borda da tela antes de virar para o outro lado */
const GAP = 10;

/** a largura maxima antes de quebra a linha: o texto de um stat e longo */
const LARGURA_MAXIMA = 280;

export default function TooltipGlobal() {
  const caixa = useRef(null);
  const timer = useRef(null);

  /**
   * O ALVO, EM DOIS REFS — e nao em estado.
   *
   * ## POR QUE NAO O `dado`
   *
   * Porque os listeners vivem num `useEffect` que depende de `dado`, e um
   * efeito so roda DEPOIS do render. Entre a troca de alvo e a reexecucao
   * do efeito, o `mouseout` seguinte leria um `dado` VELHO e fecharia a
   * caixa errada — ou nao fecharia a que devia
   *
   * Com `ref` o listener le sempre o valor atual, independente de quando o
   * React decides rodar o efeito. E o efeito pode entao ter dependencia
   * vazia e ser registrado UMA vez
   *
   * `ancorado` e o alvo de uma caixa ABERTA; `agendado` e o alvo de um delay
   * que ainda nao venceu. Os dois sao necessarios porque sao duas perguntas
   * diferentes: "qual caixa eu fecho" e "qual timer eu cancelo"
   */
  const ancorado = useRef(null);
  const agendado = useRef(null);

  const [dado, setDado] = useState(null);

  /**
   * O LUGAR MEDIDO, E SEPARADO DO `dado`.
   *
   * Porque sao dois momentos diferentes: `dado` e "qual alvo e qual texto",
   * que vem do hover; `lugar` e "quantos pixels", que so existe depois que a
   * caixa foi montada e medida. Guardar os dois no mesmo estado faria a
   * posicao parecer pronta no primeiro frame — que e o bug que isto substitui
   *
   * E `lugar` comeca `null` a CADA abertura, senao o `useLayoutEffect`
   * pularia a medicao por causa da dependencia `[dado]`: o React so roda o
   * efeito quando o `dado` MUDA, e com o `lugar` antigoEle nao mediria a
   * caixa nova, que tem outro texto e outra largura
   */
  const [lugar, setLugar] = useState(null);

  /**
   * SOME, e cancela o pending.
   *
   * O `clearTimeout` e o que impede a caixa de abrir DEPOIS do cursor ter
   * saido: entre o `mouseover` e o `mouseout` passam 250ms, e se o timer
   * sobreviver a abertura ela ficaria presa na tela sem alvo
   */
  const fechar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    ancorado.current = null;
    agendado.current = null;

    setDado(null);
  }, []);

  useEffect(() => {
    const abrir = (evento) => {
      const alvo = evento.target?.closest?.("[data-tip]");

      if (!alvo) return;

      const texto = alvo.getAttribute("data-tip");

      if (!texto) return;

      /**
       * REABRINDO O MESMO ALVO NAO REINICIA O DELAY.
       *
       * Porque o `mouseover` dispara tambem ao passar de um filho para
       * outro dentro do mesmo botao. Sem esta compara, mover o cursor sobre
       * o texto do botao faria a caixa sumir e voltar a cada pixel
       *
       * E a comparacao e com o `ancorado` porque o `agendado` pode ser
       * outro: estar sobre um alvo CUJA caixa ja esta aberta e o caso
       * comum de passar por dentro de um botao
       */
      if (ancorado.current === alvo) return;

      if (timer.current) clearTimeout(timer.current);

      agendado.current = alvo;

      timer.current = setTimeout(() => {
        /**
         * `lugar` volta a `null` JUNTO com o novo alvo.
         *
         * E o que faz a caixa nascer INVISIVEL e ser medida antes de
         * aparecer. Sem esta linha, a posicao do tooltip anterior valeria
         * para o texto novo, que e mais estreito ou mais largo — e a caixa
         * sairia descentrada ate o proximo hover
         */
        setLugar(null);
        ancorado.current = alvo;
        agendado.current = null;
        setDado({ texto, alvo });
      }, DELAY_MS);
    };

    /**
     * SAIR, E A CORRECAO DO TOOLTIP QUE FICAVA PRESO.
     *
     * ## O BUG
     *
     * A versao anterior testava o `alvo` do `mouseout` — o elemento de onde
     * o cursor SAI — e so fechava se ele NAO tivesse `data-tip`. Num botao
     * com tooltip, sair para um div qualquer dava `closest` = o proprio
     * botao, o `if` nao disparava, e o `mouseover` seguinte caia no
     * `return` de "este elemento nao tem tooltip". Os dois lados recusavam
     * fechar, e a caixa ficava na tela sem alvo nenhum
     *
     * ## A REGUA CERTA
     *
     * A pergunta nao e "o elemento de onde saiu tem tooltip" e "o cursor
     * continua em cima da MESMA coisa". Quem responde e o `relatedTarget`,
     * que e para ONDE o cursor foi
     *
     * - dentro do alvo, ou de um filho dele: e so passar por cima, fica
     * - dentro de OUTRO alvo: a caixa troca de texto, quem resolve e o
     *   `abrir`, e fechar aqui abriria um vao de 375ms no meio da troca
     * - fora de tudo: fecha. E o caso do bug
     *
     * ## E POR QUE FUNCIONA ANTES DA CAIXA ABRIR
     *
     * Porque `origem` cai para o `agendado`: sair do botao durante o delay
     * cancela o timer. Sem isso, o `setTimeout` venceria depois da ida do
     * mouse e abriria uma caixa para um alvo que nao esta mais embaixo
     */
    const sair = (evento) => {
      const origem = ancorado.current ?? agendado.current;

      if (!origem) return;

      const para = evento.relatedTarget;

      if (
        para &&
        (origem.contains(para) || para.closest?.("[data-tip]"))
      ) {
        return;
      }

      fechar();
    };

    document.addEventListener("mouseover", abrir, true);
    document.addEventListener("mouseout", sair, true);

    /**
     * O CLIQUE NUM BOTAO FECHA NA HORA.
     *
     * ## POR QUE O `mouseout` NAO BASTAVA
     *
     * Porque clicar num botao nem sempre move o mouse. O caso comum e o
     * painel que ABRE embaixo do cursor: o botao continua sob o ponteiro, o
     * `mouseout` nao dispara, e a caixa fica apontando para um botao que o
     * jogador acabou de usar
     *
     * ## E POR QUE SO BOTAO, E NAO QUALQUER CLIQUE
     *
     * Porque clicar em outro lugar ja move o mouse, e o `mouseout` cuida.
     * O que sobra e o clique sem movimento, e ele e sempre em algo
     * acionavel
     *
     * ## `pointerdown` E NAO `click`
     *
     * Porque o `pointerdown` e o "vou fazer isto" e chega antes: o jogador
     * ve a caixa sumir no mesmo quadro do toque, e nao depois do
     * `mouseup`. E porque botao `disabled` nao emite `click` — o
     * `pointerdown` ainda chega nele, e um slot trancado continua
     * dispensavel
     *
     * ## E POR QUE `preventDefault` NAO
     *
     * Porque ele nao seria uma dispensacao de tooltip: seria cancelar o
     * clique do jogador. O `fechar` so mexe em estado do tooltip
     */
    const apertou = (evento) => {
      const alvo = evento.target?.closest?.(
        "button, [role='button'], summary",
      );

      if (alvo) fechar();
    };

    document.addEventListener("pointerdown", apertou, true);

    /**
     * A RODA E O `blur` FECHAM TAMBEM.
     *
     * A roda move o alvo sob o cursor sem cruzar nenhum `mouseout`, e a
     * caixa ficaria apontando para um botao que saiu de baixo do mouse.
     * Sem `blur`, trocar de aba com a caixa aberta deixaria ela na tela
     */
    const rolou = () => fechar();
    const perdeuFoco = () => fechar();

    document.addEventListener("wheel", rolou, { passive: true });
    window.addEventListener("blur", perdeuFoco);

    return () => {
      document.removeEventListener("mouseover", abrir, true);
      document.removeEventListener("mouseout", sair, true);
      document.removeEventListener("pointerdown", apertou, true);
      document.removeEventListener("wheel", rolou);
      window.removeEventListener("blur", perdeuFoco);

      if (timer.current) clearTimeout(timer.current);
    };
  }, [fechar]);

  /**
   * A POSICAO, em DUAS PASSAGENS.
   *
   * ## O BUG DA PRIMEIRA VERSAO, E POR QUE ELE PUXAVA PARA A ESQUERDA
   *
   * A primeira versao media a caixa DENTRO do render:
   *
   *   const altura = caixa.current?.offsetHeight ?? 34;
   *   const largura = caixa.current?.offsetWidth ?? LARGURA_MAXIMA;
   *
   * No primeiro render o `caixa.current` e `null` — a ref so eprenchida
   * DEPOIS que o React cria o elemento. Entao a conta usava o fallback: 280px
   * de largura para um texto de "Fechar", que ocupa 60
   *
   * E o centro sai do lugar exato quanto a caixa e mais estreita que a
   * largura assumida: `ancora.left + largura/2 - 280/2` colocava a caixa
   * 110px a esquerda de onde ela devia estar. Era um texto curto num painel
   * largo, e o erro aparecia em quase todos
   *
   * ## POR QUE DUAS PASSAGENS E NAO ESPERAR UM FRAME
   *
   * Porque com um `requestAnimationFrame` a caixa apareceria primeiro no
   * lugar errado e depois saltaria para o certo — um visibly-positioned flicker.
   *
   * Aqui o primeiro render ja sai INVISIVEL no canto da tela, o
   * `useLayoutEffect` mede a caixa real, e o segundo render a coloca no
   * lugar. O navegador pinta so o resultado, e o jogador nunca ve o salto
   */
  useLayoutEffect(() => {
    if (!dado?.alvo || !caixa.current) return;

    const ancoraRect = dado.alvo.getBoundingClientRect();
    const altura = caixa.current.offsetHeight;
    const largura = caixa.current.offsetWidth;

    let top = ancoraRect.bottom + GAP;

    /**
     * SEM ESPACO EMBAIXO, A CAIXA VIRA PARA CIMA.
     *
     * E o `top` do alvo, nao o `bottom`: a caixa tem que ENCostar no
     * alvo, e o `GAP` e o ar entre eles
     */
    if (top + altura > window.innerHeight - GAP) {
      top = ancoraRect.top - altura - GAP;
    }

    /**
     * E, SE AINDA ASSIM NAO CABER, ELA SOBE PARA O MEIO DA TELHA.
     *
     * Porque um alvo na base da tela, com uma caixa alta, nao cabe nem
     * acima nem abaixo. Em vez de desenhar fora da janela — que e o que o
     * navegador faria com um `title` nativo, e a razao de ele ser ruim —
     * a caixa entra pela metade
     */
    if (top < GAP) {
      top = GAP;
    }

    /**
     * A CENTRALIZACAO, E O clamp NA BORDA DIREITA.
     *
     * A caixa nasce centrada no alvo, que e o que se espera de um tooltip.
     * O `Math.min` com o limite da janela e o que impede que um alvo no
     * canto direito empurre metade da caixa para fora da tela
     */
    let esquerda = ancoraRect.left + ancoraRect.width / 2 - largura / 2;

    esquerda = Math.max(GAP, Math.min(esquerda, window.innerWidth - largura - GAP));

    setLugar({ top, esquerda });
  }, [dado]);

  if (!dado) return null;

  return createPortal(
    <div
      ref={caixa}
      className="tip"

      /**
       * `visibility: hidden` enquanto nao mediu.
       *
       * E o que segura a primeira passagem na tela: sem isto o tooltip
       * apareceria no canto (-9999) por um quadro, e o jogador veria um
       * piscar no rodape da tela antes dele ir para o lugar
       */
      style={{
        top: lugar?.top ?? 0,
        left: lugar?.esquerda ?? 0,
        maxWidth: LARGURA_MAXIMA,
        visibility: lugar ? "visible" : "hidden",
      }}
    >
      {dado.texto}
    </div>,
    document.body,
  );
}