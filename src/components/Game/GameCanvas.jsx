import { useEffect, useRef } from "react";
import { GameEngine } from "../../game/engine/GameEngine.js";
import { getMap, DEFAULT_MAP_ID } from "../../data/maps/index.js";
import { NetworkWorld } from "../../game/net/NetworkWorld.js";
import { digitandoEm } from "../../game/ui/typing.js";
import {
  TECLAS_DO_NAVEGADOR,
  acaoDaTecla,
} from "../../game/input/keybinds.js";

/**
 * O canvas do jogo.
 *
 * O motor cuida do desenho (terreno, props, sprites, barras) nos
 * dois modos. O que muda e de onde vem a posicao de cada um:
 *
 * - `estado` presente: o estado veio do SERVIDOR. O motor e
 *   ligado em modo rede e nao simula nada, so escreve o que o
 *   pacote trouxe e desenha.
 * - `estado` ausente: simulacao local, o modo single player.
 *
 * A distincao e explicita e nao derivada de "tem socket": uma
 * tela pode ter conexao e ainda assim estar mostrando o ultimo
 * estado enquanto ela volta.
 */
export default function GameCanvas({
  classDefinition,
  characterName,
  onSnapshot,
  engineRef,
  estado = null,
  onIntent = null,
}) {
  const canvasRef = useRef(null);
  const mundoRef = useRef(null);

  // a funcao muda a cada render do pai. o efeito nao pode
  // depender dela ou o motor seria recriado a cada quadro
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const onIntentRef = useRef(onIntent);
  onIntentRef.current = onIntent;

  useEffect(() => {
    const engine = new GameEngine(
      canvasRef.current,
      classDefinition,
      onSnapshot,
      { characterName },
    );

    /**
     * O MAPA BASE, que e o hub.
     *
     * `getMap(DEFAULT_MAP_ID)` e nao `MAP_1`: o Vale de Cinzas continua
     * existindo e vai ser o destino de um portal, nao o lugar onde o
     * jogo comeca
     *
     * Passar pelo `getMap` e nao por `BASE_MAP` direto e o que deixa o
     * mapa inicial em um lugar so. O registro tem um `DEFAULT_MAP_ID`, e
     * ele que decide — trocar o hub e trocar essa constante
     */
    engine.setMap(getMap(DEFAULT_MAP_ID));

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
      mundoRef.current = null;
    };
    // characterName entra: trocar de nome e uma criacao nova de
    // personagem, nao um renomear do mesmo
  }, [classDefinition, characterName, engineRef, onSnapshot]);

  // Liga e desliga o modo rede conforme o estado chega. Fica num
  // efeito separado para nao recriar o motor a cada snapshot, que
  // piscaria a tela inteira 20 vezes por segundo
  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) return;

    const online = Boolean(estado);

    if (engine.networked === online) return;

    engine.setNetworked(online);

    if (online && !mundoRef.current) {
      mundoRef.current = new NetworkWorld(engine);
    }
  }, [estado, engineRef]);

  // Cada snapshot vira posicao nas entidades do motor
  useEffect(() => {
    if (!estado || !engineRef.current) return;

    mundoRef.current?.aplicar(estado);
  }, [estado, engineRef]);

  /**
     * O teclado vai para o servidor, nao para o motor.
     *
     * O `bindDomEvents` do motor escreve em `engine.input`, que
     * ninguem le no modo rede: a intencao que vira movimento e a do
     * cliente de rede. Ligar os dois caminhos faria o motor e o
     * servidor discordarem sobre a tecla, e o jogador veria o
     * personagem ir para um lado e voltar.
     *
     * ## POR QUE A LISTA FIXA DE ORDENS FOI PARA
     *
     * Existia um `CODES_DE_ORDEM` aqui, e ele tinha um problema que so
     * apareceu quando os binds ficaram editaveis: ele dizia quais teclas
     * eram ordem, mas nao dizia o que elas FAZIAM. Uma tecla nova de
     * ordem, vinda do painel, passava por ele como se fosse movimento
     *
     * Quem responde agora e `acaoDaTecla`, a mesma funcao do motor no
     * single player — entao trocar uma bind vale nos dois modos
     */

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    /**
     * `true` quando a tecla era uma ordem e ja foi tratada.
     *
     * O `repeat` e o que segura o auto: o navegador repete o `keydown`
     * umas 30 vezes por segundo enquanto a tecla estiver apertada, e sem o
     * guarda o auto piscava a cada repeticao.
     *
     * ## A ORDEM E RESOLVIDA PELO `keybinds`, E NAO PELO `code`
     *
     * Era uma cadeia de `if (code === "Space")`, `if (code === "KeyR")` e
     * companhia, com a tecla escrita no codigo. Agora e `acaoDaTecla(code)`,
     * a mesma funcao que o motor usa no single player — entao trocar uma
     * bind no painel vale nos dois modos
     */
    const enviarOrdem = (code, repetida) => {
      const acao = acaoDaTecla(code);

      if (repetida) return acao !== null;

      const intencao = onIntentRef.current;
      const motor = engineRef.current;

      if (!intencao) return false;

      /**
       * O `Backspace` e engolido sem virar pedido nem movimento.
       *
       * Ele e controlado pelo motor — que cancela o evento para o
       * navegador nao "voltar" — e nao e atalho de nada. O `return true`
       * impede que caia no `tecla` abaixo e vire ordem de andar
       */
      if (TECLAS_DO_NAVEGADOR.includes(code) && !acao) return true;

      if (!acao) return false;

      // o alvo e o escolhido: e o mesmo que o `useBasicAttack` do
      // motor usaria, e quem aplica a mira e o servidor
      if (acao === "atacar") {
        intencao.atacar?.(motor?.selectedTargetId ?? null);
        return true;
      }

      if (acao === "ultimate") {
        intencao.ultimate?.(motor?.selectedTargetId ?? null);
        return true;
      }

      if (acao === "auto") {
        intencao.alternarAutoPlay?.();
        return true;
      }

      if (acao === "dash") {
        intencao.dash?.();
        return true;
      }

      if (acao.startsWith("slot")) {
        // o numero no dedo e o mesmo em todas as paginas. o que muda e a
        // pagina, que o HUD troca no botao, e o slot que viaja e absoluto
        // porque quem decide a habilidade e o servidor
        intencao.habilidade?.(
          Number(acao.slice(4)),
          motor?.selectedTargetId ?? null,
        );

        return true;
      }

      return false;
    };

    const aoPressionar = (evento) => {
      const enviar = onIntentRef.current;

      if (!enviar?.tecla) return;

      /**
       * COM O FOCO NUM CAMPO, a tecla e DIGITACAO, e nao ordem.
       *
       * Sem esta guarda, escrever "Lobos" no nome da guilda mandava
       * `L`, `o`, `b`, `o`, `s` para o servidor: o `L` e o `s` viravam
       * movimento e o boneco andava enquanto o jogador escrevia, e o
       * `3` disparava a terceira skill da pagina
       *
       * O `keyup` abaixo NAO e filtrado, e e de proposito: e ele que
       * solta a tecla que o jogador apertou antes de clicar no campo.
       * Sem isso o personagem ficaria andando sozinho ate o jogador
       * soltar `w` sem saber que apertou
       */
      if (digitandoEm(evento)) return;

      // uma ORDEM nao vira INPUT: mandar `T` como tecla faria o
      // servidor receber um pacote de direcao a cada aperto
      if (enviarOrdem(evento.code, evento.repeat)) return;

      enviar.tecla(evento.code, true);
    };

    const aoSoltar = (evento) => {
      /**
       * O `keyup` passa SEM filtro, mesmo com o foco num campo.
       *
       * Soltar nunca faz mal e e a unica forma de o servidor saber
       * que a tecla parou: se o jogador andava com `w`, clicou no
       * campo para escrever e soltou o `w` com o foco no campo, o
       * `keyup` filtrado deixaria o personagem andando sozinho ate a
       * proxima tecla, que nao viria
       */
      onIntentRef.current?.tecla?.(evento.code, false);
    };

    // perder o foco com a tecla segurada deixaria o jogador andando
    // sozinho pelo mapa depois de voltar para a aba
    const aoSair = () => onIntentRef.current?.soltar?.();

    window.addEventListener("keydown", aoPressionar);
    window.addEventListener("keyup", aoSoltar);
    window.addEventListener("blur", aoSair);

    return () => {
      window.removeEventListener("keydown", aoPressionar);
      window.removeEventListener("keyup", aoSoltar);
      window.removeEventListener("blur", aoSair);
    };
  }, []);

  /**
   * O clique do mouse tambem vai para o servidor.
   *
   * O motor descobre o alvo sob o cursor (ele sabe converter tela
   * para mundo) e chama `onTargetClick`; a camada de rede e que
   * vira isso num pacote. Sem este elo, o motor rodava o golpe
   * aqui mesmo: a animacao tocava e o ataque nao acontecia no
   * mundo, porque o cliente nao simula.
   */
  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) return;

    engine.onTargetClick = (targetId) => {
      onIntentRef.current?.atacar(targetId);
    };

    return () => {
      engine.onTargetClick = null;
    };
  }, [engineRef]);

  /**
   * O CLIQUE NA PEDIDA DE STEEL, pelo mesmo caminho do alvo.
   *
   * E um `useEffect` separado e nao uma linha dentro do de cima porque o
   * motor nao sabe falar em `op` de painel: ele acha a prop e entrega.
   * Quem conhece o protocolo e a camada de rede
   *
   * O `propId` que viaja e o da prop REAL, e nao um indice. O servidor
   * procura esse id no mapa em que o jogador esta, entao um id inventado
   * pela nao acha nada e a mineracao simplesmente nao comeca
   */
  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) return;

    engine.onMineClick = (prop) => {
      onIntentRef.current?.minerar(prop.id);
    };

    return () => {
      engine.onMineClick = null;
    };
  }, [engineRef]);

  /**
   * A mira vai para o servidor em DIRECAO, medida a partir do
   * centro da tela, que e onde o jogador e desenhado.
   *
   * So importa sem alvo marcado: com alvo, o servidor mira nele.
   * O `aimFromPointer` do cliente normaliza, entao chega um vetor
   * unitario, e nao pixels.
   */
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    // o `onIntent` e lido DENTRO do evento, e nao capturado aqui.
    // capturando, o efeito perderia a funcao para sempre quando a
    // tela montasse antes do socket - e e exatamente a ordem em que
    // a tela real monta
    const aoMover = (evento) => {
      const caixa = canvas.getBoundingClientRect();

      onIntentRef.current?.ponteiro?.(
        evento.clientX - caixa.left - caixa.width / 2,
        evento.clientY - caixa.top - caixa.height / 2,
      );
    };

    canvas.addEventListener("pointermove", aoMover);

    return () => {
      canvas.removeEventListener("pointermove", aoMover);
    };
  }, []);

  /**
   * O ponteiro muda conforme o que ha embaixo dele: mao de armadura na
   * base (la nao ha o que bater), mao aberta em cima de NPC e mira fora
   * deles.
   *
   * A classe vai no canvas e nao em `style`, porque o modo muda varias
   * vezes por segundo enquanto o ponteiro anda entre NPC e chao: um
   * `useState` transformaria cada uma dessas viradas em render do React
   * do jogo inteiro. `classList.toggle` no DOM nao custa render nenhum
   */
  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    engine.onCursorChange = (modo) => {
      canvas.classList.toggle("game-canvas--hub", modo === "hub");
      canvas.classList.toggle("game-canvas--npc", modo === "npc");
    };

/**
     * O primeiro modo precisa ser escrito na mao.
     *
     * O motor so avisa quando o modo MUDA, e o `setMap` do mount acontece
     * num efeito ANTERIOR a este — o aviso daquela vez foi perdido, sem
     * ouvinte. Ler o `cursorMode` ja resolvido pelo `setMap` evita
     * recalcular o modo aqui e ter duas regras para a mesma coisa
     */
    engine.onCursorChange(engine.cursorMode);

    return () => {
      engine.onCursorChange = null;

      canvas.classList.remove("game-canvas--hub", "game-canvas--npc");
    };
  }, [engineRef]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label={`Mapa de ${characterName}, classe ${classDefinition.name}`}
    />
  );
}
