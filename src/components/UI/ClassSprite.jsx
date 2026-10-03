import { useEffect, useRef, useState } from "react";

import { SpriteSheet } from "../../game/sprites/SpriteSheet.js";
import {
  isDirectionalFormat,
  resolveFrameRect,
} from "../../game/sprites/animation.js";
import { getClassSprite } from "../../data/sprites/index.js";

/**
 * A arte de uma classe, animada, no retrato da tela de selecao.
 *
 * O retrato mostrava o `icon` de TEXTO do catalogo — o emoji do
 * arquiro, que e uma figura generica e nao parece com ninguem. O que
 * entra no lugar e o sprite de verdade, no `idle`.
 *
 * So o `directional` anima, e as QUATRO classes jogaveis ja sao
 * direcionais. Quem ainda fica no glifo e a classe sem folha gerada. A
 * regra e o FORMATO do sprite e nao o id da classe, entao uma classe
 * que ganhar folha direcional depois entra aqui sozinha
 *
 * O glifo fica por tras do canvas enquanto a folha nao carrega. Uma
 * imagem que da 404 nao pode deixar o retrato vazio, e o `new URL` de
 * um arquivo inexistente vira URL quebrada sem erro nenhum — o
 * fallback e obrigatorio, nao defensivo
 */
/**
 * A classe tem arte que anima?
 *
 * Exportado para o `ClassPortrait` decidir o que mostrar sem repetir a
 * regra do formato. A duplicar o `isDirectionalFormat` nos dois
 * arquivos, uma classe que ganhasse folha direcional animado aqui e
 * continuaria com o halo atras do glifo no outro
 */
export function hasAnimatedSprite(classId) {
  const definition = getClassSprite(classId);

  return Boolean(definition) && isDirectionalFormat(definition);
}

export default function ClassSprite({
  classId,
  className = "",
}) {
  const canvasRef = useRef(null);
  const avisouPronto = useRef(false);
  const [pronto, setPronto] = useState(false);

  const definition = getClassSprite(classId);
  const animavel =
    Boolean(definition) && isDirectionalFormat(definition);

  useEffect(() => {
    const canvas = canvasRef.current;

    // `avisouPronto` e um `ref` e nao estado de propósito: ele marca
    // que o `setPronto` ja rodou, e NAO entra no array de
    // dependencias. Com estado, o efeito se refaria ao virar `pronto`,
    // destruir a folha, recarregar a imagem e recomecar o laco
    avisouPronto.current = false;

    if (!canvas || !animavel) {
      setPronto(false);

      return undefined;
    }

    // sem `Image` — servidor, ou o `renderToStaticMarkup` dos testes —
    // o laco nem comeca e o glifo fica
    if (typeof Image === "undefined") return undefined;

    const context = canvas.getContext?.("2d");

    if (!context) return undefined;

    const sheet = new SpriteSheet(definition);

    let laco = 0;
    let inicio = 0;

    /**
     * O desenho.
     *
     * O `idle` do arquiro tem `row: 8`, uma arte desenhada que e a
     * MESMA para as oito direcoes: o parado olha para frente. Por isso
     * o `facing` e fixo em `south` e nao segue o ponteiro da tela — a
     * selecao nao tem direcao, e o sprite virando sozinho pareceria o
     * personagem olhando para o cursor
     */
    const desenhar = (agora) => {
      laco = requestAnimationFrame(desenhar);

      if (!sheet.ready) return;

      if (inicio === 0) inicio = agora;

      if (!avisouPronto.current) {
        avisouPronto.current = true;
        setPronto(true);
      }

      const { clientWidth, clientHeight } = canvas;

      // o canvas ainda nao tem laid out: desenhar em 0x0 nao quebra
      // nada, e o proximo quadro ja sai certo
      if (clientWidth === 0 || clientHeight === 0) return;

      /**
       * A superficie de desenho tem que ter o tamanho da CAIXA.
       *
       * Um `<canvas>` sem `width`/`height` nos atributos tem uma
       * superficie de 300x150, que e o padrao do HTML e nao o
       * tamanho dele na tela. Desenhar em `clientWidth`/`clientHeight`
       * num canvas de 300x150 dentro de uma caixa de 150x150 faz o
       * navegador espremer a superficie inteira para caber na caixa: a
       * arte sai achatada, deslocada e nao centralizada
       *
       * O `devicePixelRatio` vem junto porque a superficie e a de
       * PONTOS DE TELA: sem ele a arte sai borrada em tela de alta
       * densidade. E `image-rendering` do CSS nao resolve, porque ele
       * fala da apresentacao, e nao do desenho
       */
      const dpr =
        (typeof window !== "undefined" &&
          window.devicePixelRatio) ||
        1;

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
        (agora - inicio) / 1000,
        { x: 0, y: 1 },
      );

      /**
       * O que entra e o DESENHO, e nao a celula.
       *
       * A celula do arquiro e 64x64 e o personagem ocupa 30x44 dela.
       * Centralizar a celula inteira centraliza a margem
       * transparente, e nao o personagem: a arte sai pequena, com
       * 17px de vao de cada lado, e um pouco alta. O `contentBox`
       * medido no PNG recorta essa margem, e o que sobra e o
       * personagem — que e o que preenche o quadrado do retrato
       */
      const caixa = definition.contentBox ?? {
        x: 0,
        y: 0,
        width: definition.frameWidth,
        height: definition.frameHeight,
      };

      /**
       * A escala e em PONTOS DE TELA, e nao em pixels de CSS.
       *
       * A superficie foi multiplicada pelo `dpr` acima, entao as
       * coordenadas de desenho precisam do mesmo fator. Dividir por
       * `clientWidth` daria a escala do espaco de tela e a arte
       * ocuparia so a fracao `1/dpr` do canvas
       */
      const escala = Math.min(
        alvoLargura / caixa.width,
        alvoAltura / caixa.height,
      );

      const largura = caixa.width * escala;
      const altura = caixa.height * escala;

      // centralizado pelo DESENHO, que e o que o jogador ve
      const x = (alvoLargura - largura) / 2;
      const y = (alvoAltura - altura) / 2;

      context.clearRect(0, 0, alvoLargura, alvoAltura);

      // a folha e desenhada em 64px e esta sendo ampliada aqui: o
      // navegador precisa amostrar, e nao pegar o pixel vizinho
      context.imageSmoothingEnabled = true;

      context.drawImage(
        sheet.image,
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

    laco = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(laco);
      sheet.destroy();
    };
  }, [definition, animavel]);

  if (!animavel) return null;

  return (
    <canvas
      ref={canvasRef}
      className={[
        "class-sprite",
        pronto ? "is-ready" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    />
  );
}
