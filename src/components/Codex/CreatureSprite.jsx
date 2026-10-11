import { useEffect, useRef, useState } from "react";

import { getEnemySprite } from "../../data/sprites/enemies.js";
import {
  isDirectionalFormat,
  resolveFrameRect,
} from "../../game/sprites/animation.js";

/**
 * A CRIATURA NO `idle` VIRADA PARA BAIXO.
 *
 * ## POR QUE ISTO NAO E O `ClassSprite`
 *
 * Porque o `ClassSprite` desenha CLASSE JOGAVEL, e o catalogo das criaturas e
 * outro (`getEnemySprite`, com `ENEMY_SPRITES`). O `ClassSprite` ainda fixa o
 * `facing` em `south` — o mesmo `{ x: 0, y: 1 }` deste arquivo — entao a
 * conta do desenho e a mesma; o que muda e de onde a definicao vem
 *
 * ## POR QUE A DIRECAO ESTA FIXA EM BAIXO E O MOUSE NAO MOVE
 *
 * Porque um retrato dentro de uma lista nao tem direcao: ele olha para quem
 * esta olhando a lista. Se a arte virasse conforme o cursor, o bicho da
 * miniatura viraria sozinho quando o jogador passasse o mouse por cima, e o
 * retrato pareceria vivo de um jeito que ninguem pediu
 *
 * ## POR QUE O GLIFO CONTINUA ATRAS
 *
 * Porque 4 das 5 criaturas do Codex tem arte, e o `slime` nao tem entrada
 * no `ENEMY_SPRITES`. Sem o glifo atras, essa linha sairia com um retangulo
 * vazio e o jogador leria "criatura sem imagem" em vez de "criatura sem arte
 * ainda". O canvas entra por cima so quando carrega — e o `SEM_IMAGEM` do
 * catalogo faz o `onerror` cair no mesmo caminho
 */
const FACE_BAIXO = { x: 0, y: 1 };

export default function CreatureSprite({
  creatureId,
  fallback = "?",
  animado = false,
}) {
  const canvasRef = useRef(null);
  const avisouPronto = useRef(false);
  const [pronto, setPronto] = useState(false);

  const definition = getEnemySprite(creatureId);
  const temArte = Boolean(definition) && isDirectionalFormat(definition);

  useEffect(() => {
    const canvas = canvasRef.current;

    /**
     * `avisouPronto` e `ref` e nao estado de proposito: ele marca que o
     * `setPronto` ja rodou e NAO entra no array de dependencias. Com
     * estado, o efeito se refaria ao virar `pronto`, destruir a folha e
     * recomecar o laco
     */
    avisouPronto.current = false;

    if (!canvas || !temArte) {
      setPronto(false);
      return undefined;
    }

    // sem `Image` — servidor, ou o `renderToStaticMarkup` dos testes — o
    // desenho nem comeca e o glifo fica
    if (typeof Image === "undefined") return undefined;

    const context = canvas.getContext?.("2d");

    if (!context) return undefined;

    const imagem = new Image();

    let laco = 0;
    let inicio = 0;

    const desenhar = (agora) => {
      // o `idle` parado e UM quadro so: sem laco, sem requestAnimationFrame
      // e sem custo por quadro numa lista que mostra ate 45 criaturas
      if (animado) {
        laco = requestAnimationFrame(desenhar);
      } else if (laco !== 0) {
        return;
      }

      if (!imagem.complete || !imagem.naturalWidth) return;

      if (inicio === 0) inicio = agora;

      if (!avisouPronto.current) {
        avisouPronto.current = true;
        setPronto(true);
      }

      const { clientWidth, clientHeight } = canvas;

      // o canvas ainda nao tem laid out: desenhar em 0x0 nao quebra nada
      if (clientWidth === 0 || clientHeight === 0) return;

      /**
       * A superficie e a da CAIXA, em PONTOS DE TELA.
       *
       * Um `<canvas>` sem `width`/`height` nos atributos tem 300x150, que e o
       * padrao do HTML e nao o tamanho dele na tela. Desenhar em
       * `clientWidth` sobre 300x150 dentro de uma caixa menor faz o
       * navegador espremer a superficie inteira e a arte sai achatada e
       * deslocada
       */
      const dpr =
        (typeof window !== "undefined" && window.devicePixelRatio) || 1;

      const alvoLargura = Math.round(clientWidth * dpr);
      const alvoAltura = Math.round(clientHeight * dpr);

      if (
        canvas.width !== alvoLargura ||
        canvas.height !== alvoAltura
      ) {
        canvas.width = alvoLargura;
        canvas.height = alvoAltura;
      }

      const origem = resolveFrameRect(
        definition,
        "idle",
        animado ? (agora - inicio) / 1000 : 0,
        FACE_BAIXO,
      );

      /**
       * O QUE ENTRA E O DESENHO, E NAO A CELULA.
       *
       * A celula tem margem transparente em volta do bicho. Centralizar a
       * celula inteira centraliza a margem, e nao o personagem — a arte sai
       * pequena, com vao de cada lado. O `contentBox` recorta essa margem, e
       * o que sobra e o bicho, que e o que preenche o quadrado
       */
      const caixa = definition.contentBox ?? {
        x: 0,
        y: 0,
        width: definition.frameWidth,
        height: definition.frameHeight,
      };

      /**
       * A escala e em PONTOS DE TELA, e nao em pixels de CSS: a superficie
       * foi multiplicada pelo `dpr` acima, entao as coordenadas de desenho
       * precisam do mesmo fator
       */
      const escala = Math.min(
        alvoLargura / caixa.width,
        alvoAltura / caixa.height,
      );

      const largura = caixa.width * escala;
      const altura = caixa.height * escala;

      const x = (alvoLargura - largura) / 2;
      const y = (alvoAltura - altura) / 2;

      context.clearRect(0, 0, alvoLargura, alvoAltura);

      // a folha e pequena e esta sendo ampliada: o navegador precisa
      // amostrar, e nao pegar o pixel vizinho
      context.imageSmoothingEnabled = false;

      context.drawImage(
        imagem,
        origem.x + caixa.x,
        origem.y + caixa.y,
        caixa.width,
        caixa.height,
        x,
        y,
        largura,
        altura,
      );
    };

    imagem.onload = () => {
      desenhar(performance.now());
    };

    imagem.onerror = () => {
      // sem arte: o glifo continua sendo a resposta visivel
      setPronto(false);
    };

    imagem.src = definition.src;

    return () => {
      if (laco !== 0) cancelAnimationFrame(laco);
    };
  }, [definition, temArte, animado]);

  if (!temArte) {
    return <span className="cdx-sprite__fallback">{fallback}</span>;
  }

  return (
    <>
      {/*
        O GLIFO ATRAS, e o canvas por cima quando carrega. Sao dois elementos
        porque um so teria de trocar de conteudo quando a imagem chegasse — e
        trocar conteudo no meio do layout e o que faz a miniatura pular de
        altura na abertura da lista
      */}
      <span className="cdx-sprite__fallback">{fallback}</span>

      <canvas
        ref={canvasRef}
        className={["cdx-sprite", pronto ? "is-ready" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
    </>
  );
}