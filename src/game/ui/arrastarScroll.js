import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ARRASTAR COM O MOUSE, em vez de rolar a roda.
 *
 * ## O PROBLEMA QUE ESTE HOOK RESOLVE
 *
 * A trilha de recompensas tem treze cards de 96px e sobra talvez metade
 * deles na tela. Antes o jogador so andava por ela de tres jeitos: pela barra
 * de rolagem de 8px embaixo (que some quando o cursor sai), pela roda do
 * mouse (que em varios navegadores nao funciona em `overflow: hidden`) ou
 * por SHIFT + roda. Um painel de passe que esconde as proprias rewards exige
 * que o jogador descubra um dos tres
 *
 * ## POR QUE `pointer`, E NAO `mousedown`
 *
 * Porque `pointerdown` chega tambem do toque e da caneta, e o codigo do
 * toque tem de ser o mesmo: se isto so funcionasse com mouse, o celular
 * perderia o recurso que o desktop ganhou
 *
 * ## POR QUE O ESTADO DO GESTO FICA NUM `ref` E NAO NO `useState`
 *
 * Porque `x`, `y` e `scroll` mudam a cada `pointermove`. Se fossem estado,
 * o React re-renderizaria o painel inteiro sessenta vezes por segundo para
 * mover um `scrollLeft`. O unico estado que o React precisa saber e
 * `arrastando`, que muda duas vezes por gesto e e o que pinta o cursor
 */
export function useArrastarScroll({ eixo = null } = {}) {
  const alvo = useRef(null);
  const [arrastando, setArrastando] = useState(false);

  const gesto = useRef({
    ativo: false,
    /** O `pointerId` que arrasta, para um segundo dedo nao encerrar o gesto */
    id: null,
    x: 0,
    y: 0,
    scroll: 0,
    /** Passou do limiar? Antes disso ainda e um clique */
    passou: false,
    /** A trava do clique barrido ja foi armada neste gesto? */
    travado: false,
  });

  /**
   * O EIXO, lido do elemento quando o chamador nao diz.
   *
   * E o que faz o MESMO hook servir para a trilha horizontal e para a lista
   * vertical — e para a lista virar horizontal no `@media` sem ninguem
   * avisar. O `+ 1` de folga porque `scrollWidth` e `clientWidth` podem
   * diferir em 1px sem haver rolagem, e o elemento acharia que rola
   */
  const eixoDo = useCallback(
    (el) => {
      if (eixo) return eixo;
      if (el.scrollWidth > el.clientWidth + 1) return "x";
      return "y";
    },
    [eixo],
  );

  /**
   * O FIM DO GESTO, e ele NAO vem do `onPointerUp` do elemento.
   *
   * Ele vem do `window`, e e de proposito. Com `setPointerCapture` o
   * `pointerup` cai no elemento capturado e isso funciona; mas se a captura
   * falhar — ponteiro ja liberado, gesto vindo de um device que nao
   * implementa capture — o `pointerup` chega em outro elemento e o arrasto
   * fica preso: cursor de "pegando", `user-select: none` ligado, e so um
   * novo `pointerdown` limpa. Ouvir o `window` deixa o arrasto terminar em
   * qualquer lugar, inclusive se o ponteiro sair da janela do jogo
   */
  const encerrar = useRef(() => {});

  const aoPressionar = useCallback(
    (event) => {
      /**
       * SO O BOTAO PRINCIPAL.
       *
       * O do meio abre em outra aba e o direito abre o menu do navegador, e
       * nenhum dos dois e "arraste a trilha". Sem esta guarda, clicar com o
       * direito num dia para inspecionar o item comeca um arrasto
       */
      if (event.button !== 0) return;

      const el = alvo.current;
      if (!el) return;

      gesto.current = {
        ativo: true,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scroll: eixoDo(el) === "x" ? el.scrollLeft : el.scrollTop,
        passou: false,
        travado: false,
      };

      /**
       * O `setPointerCapture` NAO FICA AQUI — ele e armado no `aoMover`, no
       * instante em que o gesto passa do limiar.
       *
       * ## O QUE ACONTECIA COM A CAPTURA AQUI
       *
       * Enquanto ha captura de ponteiro, o navegador entrega os eventos de
       * compatibilidade de mouse — o `click` entre eles — no ALVO DA CAPTURA,
       * e nao em onde o ponteiro apertou e soltou. Com a captura armada no
       * `pointerdown` do container, o `click` saia no `<ul>`, nunca no
       * `<button>` que estava embaixo do cursor, e o `onClick` do botao nao
       * rodava
       *
       * No passe isso significava que NENHUM botao da lista e da trilha
       * respondia. Parecia funcionar no primeiro passe porque ele ja vem
       * selecionado: clicar nele nao muda nada na tela, entao o defeito
       * sumia — e nos outros dois o clique simplesmente nao acontecia
       *
       * ## POR QUE ARMAR TARDE NAO ESTRAGA O ARRASTO
       *
       * Porque ate o limiar o ponteiro nao saiu do lugar onde apertou: sao
       * menos de 5px, e o `pointermove` continua chegando no container sem
       * captura nenhuma. O `aoMover` ve o primeiro `pointermove` que passa de
       * 5px e arma a captura ali, antes de escrever o `scroll` — o arrasto
       * continua vivo quando o jogador sai do retangulo do elemento
       */
    },
    [eixoDo],
  );

  const aoMover = useCallback((event) => {
    const g = gesto.current;
    const el = alvo.current;

    // um segundo dedo no toque nao commandeia o gesto que ja comecou
    if (!g.ativo || !el || g.id !== event.pointerId) return;

    const x = event.clientX - g.x;
    const y = event.clientY - g.y;
    const dist = eixoDo(el) === "x" ? Math.abs(x) : Math.abs(y);

    /**
     * O LIMIAR DE 5px, que separa "arrastei" de "cliquei".
     *
     * Sem ele o arrasto parte no `pointerdown`, e um clique firme — que tem 2
     * ou 3px de tremor na mao — vira micro-rolagem. O jogador clicaria no dia
     * 7 e o dia 6 apareceria cortado ao meio, sem ele entender por que. A
     * partir do limiar o arrasto e o que vale: passou de 5px a intencao foi
     * mover, e o clique nao deve chegar ao botao
     */
    if (!g.passou && dist < 5) return;

    g.passou = true;

    /**
     * A CAPTURA, ARMADA AQUI E NAO NO `pointerdown`.
     *
     * E o primeiro gesto que passou do limiar: um clique de verdade nunca
     * chega aqui, entao nunca e capturado, e o `click` sai no botao. Um
     * arrasto, sim, e precisa da captura para continuar vivo quando o
     * jogador sai do retangulo do elemento — e a partir daqui ela ja esta
     * armada antes do primeiro `scroll`
     *
     * O `try` cobre o navegador que nao implementa captura de ponteiro: o
     * arrasto fica sem "seguir o dedo" fora da caixa, mas o `window` ainda
     * encerra o gesto, porque o `pointerup` e do `window`
     */
    try {
      el.setPointerCapture?.(event.pointerId);
    } catch {
      // navegador sem captura de ponteiro: o arrasto so vale dentro do elemento
    }

    setArrastando(true);

    if (eixoDo(el) === "x") {
      el.scrollLeft = g.scroll - x;
    } else {
      el.scrollTop = g.scroll - y;
    }
  }, [eixoDo]);

  /**
   * O GESTO ACABOU.
   *
   * O `if (!g.ativo)` na entrada e o que torna isto idempotente: `pointerup`
   * e `pointercancel` podem chegar os dois, e `aoSoltar` pode ser chamado
   * pelo React e pelo `window`. Sem a guarda, a trava do clique seria armada
   * duas vezes e comeria o proximo clique real do jogador
   */
  encerrar.current = useCallback((event) => {
    const g = gesto.current;
    const el = alvo.current;

    if (!g.ativo) return;

    /**
     * O GESTO QUE NAO ERA ESTE.
     *
     * No toque, o segundo dedo solta com o `pointerId` dele e derrubaria o
     * arrasto que o primeiro dedo ainda estava fazendo
     */
    if (event && g.id !== event.pointerId) return;

    /**
     * O `SMOOTH` DO CSS DESLIGADO DURANTE O ARRASTO.
     *
     * A trilha tem `scroll-behavior: smooth`, e e ele que faz a roda do
     * mouse deslizar em vez de saltar. Mas ele tambem reescreve o
     * `scrollLeft` QUE O HOOK ATRIBUI a cada `pointermove`: cada atribuicao
     * vira uma animacao, e a trilha fica um quadro atras do dedo o tempo
     * todo. O sintoma e pior que o ganho — arrastar devagar faz a rolagem
     * passar do ponto, e o jogador perde o dia que estava mirando
     *
     * Volta para `auto` no fim, para a roda continuar suave
     */
    if (el) {
      el.style.scrollBehavior = "auto";
    }

    const arrastou = g.passou;

    gesto.current.ativo = false;
    setArrastando(false);

    /**
     * O CLIQUE VARRIDO E COMIDO UMA VEZ.
     *
     * Depois de arrastar, o navegador ainda dispara o `click` no botao que
     * estava embaixo do dedo no fim do gesto. Sem esta trava, o jogador
     * arrastava a trilha para ver o dia 10 e resgATAVA o dia 10 sem querer
     *
     * O `capture: true` e obrigatorio: a trava tem de rodar ANTES do
     * `onClick` do botao, e num listener de bolha chegaria tarde demais.
     * E o `once: true` impede que ela coma o proximo clique real — o de
     * abrir o painel, o de resgatar o dia seguinte
     */
    if (arrastou && !g.travado) {
      g.travado = true;

      const engolir = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        window.removeEventListener("pointerup", soltarDeNovo, true);
      };

      // se nenhum `click` vier (o ponteiro saiu da janela no fim do gesto), a
      // trava se desarma sozinha no proximo `pointerup`, em vez de ficar
      // armada para comer um clique que o jogador nem deu perto do arrasto
      const soltarDeNovo = () => window.removeEventListener("click", engolir, true);

      window.addEventListener("click", engolir, { capture: true, once: true });
      window.addEventListener("pointerup", soltarDeNovo, { capture: true, once: true });
    }
  }, []);

  /**
   * O FIM DO GESTO OUVIDO NO `window`, desde o `pointerdown`.
   *
   * E o que garante que o arrasto nunca fique preso: o `pointerup` e o
   * `pointercancel` sao do `window`, e nao do elemento, entao soltar o mouse
   * em qualquer lugar encerra — inclusive fora da janela do jogo, onde o
   * evento nem chegaria no React
   */
useEffect(() => {
    /**
     * O `pointerup` CHEGA QUALQUER `button`.
     *
     * Aqui nao ha botao esquerdo a checar, e isso e proposital: existe o
     * `pointerup` que o navegador dispara sozinho quando o ponteiro sai da
     * janela com o botao apertado, e esse chega com o botao que JA ESTAVA
     * apertado. Filtrar por `button === 0` deixaria o arrasto preso justamente
     * no gesto que o `capture` do `pointerdown` prometeu resolver
     *
     * O filtro do BOTAO fica no `aoPressionar`, que e onde o gesto comeca
     */
    const aoEncerrar = (event) => encerrar.current(event);

    window.addEventListener("pointerup", aoEncerrar);
    window.addEventListener("pointercancel", aoEncerrar);

    return () => {
      window.removeEventListener("pointerup", aoEncerrar);
      window.removeEventListener("pointercancel", aoEncerrar);
    };
  }, []);

  /**
   * O CURSOR E A SELECAO DURANTE O GESTO.
   *
   * A classe `is-dragging` e o que troca o cursor para `grabbing` e segura
   * o `user-select: none`, para o nome do dia nao ficar Realcado enquanto o
   * jogador arrasta. E o efeito depende so do booleano, entao ele roda duas
   * vezes por gesto — no comeco e no fim
   */
  useEffect(() => {
    const el = alvo.current;
    if (!el) return undefined;

    el.classList.toggle("is-dragging", arrastando);
    return () => el.classList.remove("is-dragging");
  }, [arrastando]);

  /**
   * O `ref` E O `evento` SAEM JUNTOS DO HOOK.
   *
   * Quem chama nao pode errar a ligacao: o elemento que rola e o elemento
   * que recebe o `pointerdown`, e sao o mesmo por definicao. Com um `ref`
   * separado os dois poderiam divergir — o `ref` na lista e o `onPointerDown`
   * na trilha — e o arrasto moveria a coisa errada sem nenhum erro
   */
  return {
    ref: alvo,
    arrastando,
    evento: {
      onPointerDown: aoPressionar,
      onPointerMove: aoMover,
    },
  };
}