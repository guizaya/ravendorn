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

  /**
   * O MUNDO JA DESENHOU, E O FRONT PODE TIRAR A TELA DE ESPERA.
   *
   * ## POR QUE ISTO EXISTE E O `window.load` NAO SERVE
   *
   * Porque o `window.load` so espera os recursos do DOCUMENTO — HTML, CSS,
   * `<img>` do DOM. As folhas de tile do mapa nao estao no DOM: sao criadas
   * por `new Image()` no `drawMap`, depois que o motor existe
   *
   * A tela de espera sumia nesse `load`, e o mapa so aparecia um instante
   * depois, quando a folha terminava de baixar. O jogador via a tela passar e
   * o mapa chegar DEPOIS
   *
   * ## E POR QUE UM CALLBACK E NAO UM ESTADO
   *
   * Porque e um AVISO, e nao um dado: o front so precisa saber o instante,
   * uma vez. Se fosse estado, entraria no efeito de rede e o motor seria
   * recriado no quadro em que o mundo ficasse pronto — a tela inteira
   * piscaria bem na hora em que devia ficar suave
   */
  onMundoPronto = null,
}) {
  const canvasRef = useRef(null);
  const mundoRef = useRef(null);

  /**
   * O `onMundoPronto` atual, sem depender dele.
   *
   * E o mesmo truque que o `estadoRef`: a funcao chega como prop e muda de
   * identidade a cada render, e um efeito que dependesse dela recriaria o
   * motor inteiro
   */
  const avisarRef = useRef(onMundoPronto);
  avisarRef.current = onMundoPronto;

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

  /**
   * O AVISO DE "O MUNDO JA DESENHOU".
   *
   * ## POR QUE UM LACO DE `requestAnimationFrame`, E NAO UM `onload`
   *
   * Porque nao existe um `onload` para isto. As folhas de tile sao criadas
   * por `new Image()` dentro do `drawMap`, e cada `Image` tem o seu proprio
   * `onload`, espalhado por tres sistemas diferentes (terreno, tiles, sprites)
   *
   * E porque o motor so descobre que precisa delas DEPOIS de existir: o
   * `engine.setMap()` acontece no efeito acima. Nenhuma promessa de imagem
   * pode ser feita antes disso
   *
   * ## POR QUE O LACO PARA SOZINHO
   *
   * Porque o aviso vale UMA vez por vida da tela. Depois que o front tirou a
   * tela de espera, continuar perguntando sessenta vezes por segundo seria
   * trabalho jogado fora — e `cancelAnimationFrame` no cleanup garante que
   * o laco morra junto com o motor
   *
   * ## E POR QUE O `ref`
   *
   * Porque `onMundoPronto` muda de identidade a cada render do pai, e um
   * efeito que dependesse dele remontaria o motor — que e o pior defeito
   * possivel aqui. O `ref` le a versao atual sem entrar no array
   */
  useEffect(() => {
    const motor = engineRef.current;

    if (!motor) return;

    let quadro = 0;

    const avisar = () => {
      if (!motor.mundoDesenhavel()) {
        quadro = requestAnimationFrame(avisar);

        return;
      }

      avisarRef.current?.();
    };

    quadro = requestAnimationFrame(avisar);

    return () => cancelAnimationFrame(quadro);
  }, [engineRef]);

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
   * A mira vai para o servidor em DIRECAO, medida a partir de onde o
   * jogador esta DESENHADO.
   *
   * So importa sem alvo marcado: com alvo, o servidor mira nele.
   * O `aimFromPointer` do cliente normaliza, entao chega um vetor
   * unitario, e nao pixels.
   *
   * ## POR QUE O PONTEIRO SOZINHO NAO BASTA
   *
   * O ponteiro sai medido do CENTRO DA TELA. Isso so vale porque o
   * jogador e desenhado no centro — e ele so e desenhado no centro
   * enquanto a camera o segue. Perto da borda do mapa a camera trava, o
   * jogador anda na tela, e medir pelo centro passa a apontar para o
   * lado errado. A correcao e o leitor que o `useEffect` de cima registra
   * no cliente, que diz onde o boneco esta a cada pacote
   */
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    // o `onIntent` e lido DENTRO do evento, e nao capturado aqui.
    // capturando, o efeito perderia a funcao para sempre quando a
    // tela montasse antes do socket - e e exatamente a ordem em que a
    // tela real monta
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
   * ONDE O JOGADOR ESTA DESENHADO, EM PIXELS DE TELA DO CENTRO.
   *
   * E o `(jogador - centro) * zoom`, que e o inverso do `translate` que
   * o `render` faz. Precisa do `zoom` porque o `GameClient` recebe o
   * ponteiro em pixels de tela, e as duas coisas tem de estar no mesmo
   * espaco para a diferenca virar angulo
   *
   * ## POR QUE UM LEITOR E NAO UM VALOR
   *
   * Se isto devolvesse uma posicao CAPTURADA no efeito, ela viraria velha
   * assim que o jogador andasse: a camera prende na borda e o boneco sai
   * do centro. Lendo direto do motor a cada chamada, o valor e sempre o
   * do instante em que o pacote esta sendo montado
   *
   * ## POR QUE A DEPENDENCIA E O `onIntent` INTEIRO
   *
   * O leitor so pode ser registrado depois que o socket existe, e o
   * `comCliente` do hook e um no-op ate la. O `onIntent` e memoizado e so
   * muda de identidade quando o status muda — ou seja, exatamente quando
   * o cliente passa a existir. Com `[]` o leitor ficaria perdido para
   * sempre e a mira voltaria a medir pelo centro
   */
  useEffect(() => {
    const registrarJogador =
      onIntentRef.current?.definirLeitorDeJogadorNaTela;

    const registrarMira = onIntentRef.current?.definirLeitorDePonteiroDeMira;

    if (!registrarJogador && !registrarMira) return;

    registrarJogador?.(() => {
      const motor = engineRef.current;

      // o motor pode ja ter sido destruido entre o registro e a chamada
      if (!motor) return null;

      const z = motor.cameraZoom;
      const centro = motor.centroDaCameraLimitado();
      const eu = motor.world?.player;

      if (!eu || !Number.isFinite(eu.x) || !Number.isFinite(eu.y)) {
        return null;
      }

      return { x: (eu.x - centro.x) * z, y: (eu.y - centro.y) * z };
    });

    /**
     * O PONTO DE MIRA, E NAO O PONTEIRO.
     *
     * O motor e quem sabe se a mira magnetica colou num inimigo, e onde ele
     * esta AGORA — que muda a cada quadro, porque o bicho anda. Ler o ponto
     * na hora de montar o pacote e o que impede o reticulo de mirar num
     * lugar e o golpe de sair em outro
     */
    registrarMira?.(() => {
      const motor = engineRef.current;

      if (!motor) return null;

      return motor.ponteiroDaMiraNaTela();
    });

    return () => {
      registrarJogador?.(null);
      registrarMira?.(null);
    };
  }, [onIntent, engineRef]);

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
