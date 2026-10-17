import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  arvoreDaClasse,
  PALCO,
  nosDisponiveis,
  custoTotalDaArvore,
} from "../../data/skills/tree.js";

/**
 * A ARVORE DE HABILIDADE, EM FUNIL DE HEXAGONOS.
 *
 * ## DE ONDE VEM O DESENHO
 *
 * Da referencia visual `src/assets/Items/drops/Screenshot_3.png`, e ela traz
 * tres coisas que nao existiam na versao anterior:
 *
 *   1. O NO E UM HEXAGONO, e nao um cartao. Um hexagono tem seis lados, e o
 *      desenho fica coeso porque todo no tem a mesma forma — um cartao com
 *      larguras diferentes quebraria o conjunto
 *   2. O DESENHO CONVERGE. Os quatro troncos de cima se juntam num no so no
 *      meio, a Fundacao, e depois abrem de novo. Explodindo para fora, o anel
 *      final virava um circulo de cartoes que nao cabia nem rolava direito
 *   3. O ROTULO E `comprados/total` do degrau. Nao e um numero solto: e o
 *      quanto do nivel inteiro o jogador ja construiu
 *
 * ## E O FUNDO
 *
 * A grade e a mesma do fundo do jogo, e o brilho verde central marca o no da
 * Fundacao. O jogador le a tela como um mapa, e nao como um formulario
 *
 * ## POR QUE AQUI NAO SE MEDE NADA
 *
 * Porque a posicao ja vem escrita no dado — cada degrau e uma linha de `x`
 * normalizado, e a unica conta e a conversao para pixel. Nao ha grade com
 * tamanho de no, entao nao ha texto empurrando coluna, e o desenho nao se
 * move quando a fonte do navegador muda
 */

/** Os limites do zoom, e o que cada um quer dizer */
const ZOOM_MINIMO = 0.6;
const ZOOM_MAXIMO = 3;

function Arvore({ classeId, comprados, nos, aoComprar, disabled }) {
  const caixaRef = useRef(null);

  const [arrastando, setArrastando] = useState(false);
  const arraste = useRef({ ativo: false, x: 0, y: 0, sx: 0, sy: 0, movido: 0 });

  /**
   * O ZOOM DA RODINHA.
   *
   * ## POR QUE O PALCO FICOU 550 E O ZOOM EXISTE
   *
   * Porque com 550 de largura a linha de oito nós só cabe se cada um tiver
   * uns 54px, e aí o nome dentro do hexágono fica pequeno demais para ler sem
   * ajuda. O zoom é o que resolve os dois: o jogador abre a tela já perto e
   * dá zoom para dentro quando precisa ver o desenho inteiro
   *
   * ## E POR QUE ABRE EM 150%, E NÃO EM 100% OU 200%
   *
   * A 100% o hexágono de 54px mostra o nome em 8px, e o que o jogador faz ao
   * abrir a árvore é ler nome e bônus — o 100% não serve para isso
   *
   * O 200% resolve a leitura e cria outro problema: a caixa do palco passa de
   * 1100px dentro de um painel de 700, e a primeira coisa que o jogador vê é
   * um pedaço do desenho com metade da árvore fora da tela. O 150% é o meio
   * termo — nome em 12px, que já se lê, e a largura da linha de oito nós em
   * 825px, que ainda deixa o jogador ver o desenho inteiro rolando um pouco
   *
   * ## E POR QUE ASSIM AINDA NÃO CABE NO PAINEL
   *
   * E proposital: a caixa do palco é multiplicada pelo zoom, e a 150% ela passa
   * da largura do painel, então a rolagem assume. O que não pode é o desenho
   * APARECER CORTADO sem rolagem — e não aparece, porque o `.arb-arvore` é o
   * que rola
   */
  const [zoom, setZoom] = useState(1.2);

  /**
   * O ZOOM É UM `transform`, E A CAIXA É MULTIPLICADA.
   *
   * Porque `transform` não muda o tamanho do elemento na layout: um palco de
   * 550 esticado para 2x visualmente continuaria ocupando 550px de caixa, e
   * a rolagem do `.arb-arvore` não teria o que percorrer. Multiplicando a
   * caixa junto, o conteúdo esticado tem exatamente o espaço que ocupa
   */
  useEffect(() => {
    const caixa = caixaRef.current;

    if (!caixa) return;

    /**
     * A RODINHA FALA, E COM `passive: false`.
     *
     * ## POR QUE UM LISTENER NATIVO E NÃO O `onWheel` DO REACT
     *
     * Porque o React registra `wheel` como PASSIVO na raiz, e num listener
     * passivo o `preventDefault` é ignorado pelo navegador. O `wheel` padrão
     * da página rolaria junto com o zoom, e a árvore subia enquanto o
     * jogador queria só aumentar
     *
     * ## E POR QUE O ZOOM NÃO SOBE ALÉM DE 3
     *
     * Porque acima disso o hexágono perde a borda: o desenho é `clip-path`,
     * e a arte é pixelada. Esticar 3x já dá um bloco borrado, e passar disso
     * só gasta memória de tela
     */
    function naRoda(evento) {
      evento.preventDefault();

      const passo = evento.deltaY < 0 ? 0.12 : -0.12;

      setZoom((atual) => {
        const proximo = atual + passo;

        return Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, proximo));
      });
    }

    caixa.addEventListener("wheel", naRoda, { passive: false });

    return () => caixa.removeEventListener("wheel", naRoda);
  }, []);

  const nosArvore = useMemo(() => arvoreDaClasse(classeId), [classeId]);

  /**
   * A CAIXA DO NÓ: DUAS ESTADOS, E O PINCO É O QUE SEPARA OS DOIS.
   *
   * `passando` e `noSobre`: só passa o mouse, some no instante seguinte, e não
   * tem botão. `fixado` e o que o clique abriu: fica, ganha o "APLICAR", e é o
   * único jeito de gastar o ponto
   *
   * ## POR QUE O CLIQUE NÃO APLICA MAIS DIRETO
   *
   * Porque o ponto é caro e não tem volta: `aprenderNoArvore` debita do saldo
   * e grava no save no mesmo pedido. Um clique acidental num nó errado gastava
   * um ponto que o jogador não conseguia recuperar, e o `custoTotalDaArvore`
   * devolvia o número mas não devolvia a escolha
   *
   * Passar o mouse já mostra tudo o que o balão mostrava, então a caixa não
   * tira informação de ninguém: ela só acrescenta o botão que cobra o clique
   */
  const [noSobre, setNoSobre] = useState(null);
  const [fixado, setFixado] = useState(null);

  const fechar = useCallback(() => {
    setFixado(null);
  }, []);

  /**
   * O CLIQUE FORA FECHA, E NUM LISTENER NATIVO NA FASE DE CAPTURA.
   *
   * ## POR QUE NATIVO E NÃO `onPointerDown` NO REACT
   *
   * Porque o `pointerdown` do React só dispara em elemento do React, e um
   * clique no vazio do painel — que é a maior parte da tela — não é nenhum
   * deles. A alternativa seria um `onPointerDown` em cada div do caminho, e
   * qualquer elemento novo entre eles deixaria a caixa aberta
   *
   * ## E POR QUE `capture: true`, QUE ERA O QUE FALTAVA
   *
   * Porque o `aoPointerDown` do arraste chama `e.stopPropagation()` — ele
   * precisa, para o arraste não virar arraste do painel. No `document`, um
   * listener de FASE DE BORBOTA só roda se o evento chegar lá, e esse
   * `stopPropagation` mata o evento antes: clicar no vazio entre duas bolas
   * nunca chegava, e a caixa ficava presa. Trocar de bola funcionava porque o
   * `click` do nó é outro evento, e o `.arb-arvore` não cancela o clique
   *
   * Na fase de CAPTURA o listener roda ANTES de qualquer handler do alvo, e
   * o `stopPropagation` de bubbling não alcança o que já foi executado
   *
   * ## E POR QUE O TESTO E `.arb-no`, E NÃO O `contains` DO `caixaRef`
   *
   * Porque `contains` perguntava "o clique saiu do painel que rola a árvore?",
   * e a árvore ocupa a tela toda — o fundo dela é justamente o que o jogador
   * clica para dispensar. `closest(".arb-no")` acha a bola E a caixa num
   * seletor só, porque a caixa é filha do wrapper do nó
   */
  useEffect(() => {
    if (fixado === null) return;

    function fora(evento) {
      if (evento.target.closest?.(".arb-no")) return;

      fechar();
    }

    document.addEventListener("pointerdown", fora, true);

    return () => document.removeEventListener("pointerdown", fora, true);
  }, [fixado, fechar]);

  /**
   * QUANTOS NOS DE CADA DEGRAU JA FORAM PAGOS.
   *
   * E o que vira o `comprados/total` do rotulo. A contagem e feita uma vez
   * por render e nao por no: sao 28 nos, e refazer a conta dentro do JSX faria
   * 28 varreduras de 28 nos para desenhar um texto
   */
  const porDegrau = useMemo(() => {
    const mapa = new Map();

    for (const no of nosArvore) {
      if (!mapa.has(no.degrau)) mapa.set(no.degrau, 0);

      if (comprados.has(no.id)) {
        mapa.set(no.degrau, mapa.get(no.degrau) + 1);
      }
    }

    return mapa;
  }, [nosArvore, comprados]);

  /**
   * AS LIGACOES: retas, da borda de uma bola a borda da outra.
   *
   * ## POR QUE SAO RETAS E NAO COM COTOVELO
   *
   * Porque num funil as pontas de um tronco ficam perto o bastante para que a
   * linha reta ja alcance a borda do filho. O cotovelo era necessario no
   * desenho radial — la os nos estavam em circulos e a reta cortava o
   * cartao do meio
   */
  const ligacoes = useMemo(() => {
    const porId = new Map(nosArvore.map((no) => [no.id, no]));

    const linhas = [];

    /**
     * ONDE A LINHA ENCONTRA A BORDA DA BOLA.
     *
     * E o raio, e nao uma divisao. A versao anterior tratava o no como um
     * RETANGULO e pegava o menor entre `meiaLargura/|ux|` e `meiaAltura/|uy|`
     * — que e exatamente a borda de um retangulo. Numa bola isso e um
     * quadrado: nas diagonais a linha saia cedo demais e ficava no vazio
     * entre um no e o outro, e nas pontas ela afurava o circulo
     *
     * Com a bola, o raio e o mesmo em toda direcao. Como `(ux, uy)` ja e um
     * vetor normalizado — o `Math.hypot` de `dx, dy` divided por ele — a
     * distancia ate a borda e o proprio raio, sem divisao nenhuma
     */
    const naBorda = (no, ux, uy, sinal) => {
      const t = no.meiaLargura * sinal;

      return { x: no.x + ux * t, y: no.y + uy * t };
    };

    for (const no of nosArvore) {
      for (const paiId of no.exige ?? []) {
        const pai = porId.get(paiId);

        if (!pai) continue;

        const dx = no.x - pai.x;
        const dy = no.y - pai.y;
        const dist = Math.hypot(dx, dy) || 1;

        const ux = dx / dist;
        const uy = dy / dist;

        const saida = naBorda(pai, ux, uy, 1);
        const chegada = naBorda(no, ux, uy, -1);

        linhas.push({
          id: `${paiId}->${no.id}`,
          x1: saida.x,
          y1: saida.y,
          x2: chegada.x,
          y2: chegada.y,
          viva: comprados.has(paiId) && comprados.has(no.id),
        });
      }
    }

    return linhas;
  }, [nosArvore, comprados]);

  /**
   * O ARRASTE QUE VIRA ROLAGEM, o mesmo gesto do talento da guilda.
   *
   * O `closest("button, a")` separa comprar de deslizar, o `movido > 4` trava
   * o clique de um arraste que terminou sobre um no, e o `stopPropagation`
   * impede que o arraste vire arrasto do PAINEL
   */
  const aoPointerDown = useCallback((e) => {
    const caixa = caixaRef.current;

    if (!caixa) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a")) return;

    /**
     * O `preventDefault` SAIU, E O QUE ELE TRAVA ERA O CLIQUE.
     *
     * `preventDefault` no `pointerdown` cancela os eventos de compatibilidade
     * de mouse — e com eles o `click`. Quem sofria era o clique na BOLA: ela
     * não está na lista `button, a` acima, então o arraste subia, cancelava o
     * clique, e a caixa nunca fixava
     *
     * ## POR QUE ELE NÃO ERA NECESSÁRIO
     *
     * O que ele segurava — a seleção de texto na rolagem e a rolagem da página
     * junto do arraste — já é feito por `user-select: none` e `touch-action:
     * none` no `.arb-arvore`. E o `removeAllRanges` abaixo cobre a seleção que
     * já tivesse sido feita antes
     */
    window.getSelection?.()?.removeAllRanges();
    e.stopPropagation();

    arraste.current = {
      ativo: true,
      x: e.clientX,
      y: e.clientY,
      sx: caixa.scrollLeft,
      sy: caixa.scrollTop,
      movido: 0,
    };
  }, []);

  const aoPointerMove = useCallback((e) => {
    const caixa = caixaRef.current;
    const d = arraste.current;

    if (!caixa || !d.ativo) return;

    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    d.movido = Math.max(d.movido, Math.abs(dx), Math.abs(dy));

    if (d.movido > 4) setArrastando(true);

    if (Math.abs(dy) >= Math.abs(dx)) {
      caixa.scrollTop = d.sy - dy;
    } else {
      caixa.scrollLeft = d.sx - dx;
    }
  }, []);

  const aoPointerUp = useCallback((e) => {
    const d = arraste.current;

    /**
     * O `preventDefault` SO QUANDO FOI ARRASTE.
     *
     * Aplicado sempre, comeria o clique de um no apertado sem mexer um pixel
     */
    if (d.movido > 4) e.preventDefault();

    d.ativo = false;

    setArrastando(false);
  }, []);

  const aoClickCapture = useCallback((e) => {
    if (arraste.current.movido > 4) {
      e.preventDefault();
      e.stopPropagation();
    }

    arraste.current.movido = 0;
  }, []);

  return (
    <div
      className={[
        "gld-arvore arb-arvore",
        arrastando ? "is-arrastando" : "",
        fixado !== null ? "is-fixada" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={caixaRef}
      onPointerDown={aoPointerDown}
      onPointerMove={aoPointerMove}
      onPointerUp={aoPointerUp}
      onPointerCancel={aoPointerUp}
      onClickCapture={aoClickCapture}
    >
      <div
        className="arb-palco"
        style={{
          "--arb-altura": `${PALCO.altura}px`,
          "--arb-largura": `${PALCO.largura}px`,

          /**
           * A CAIXA MULTIPLICADA JUNTO COM O `transform`.
           *
           * Sem isto o palco esticado 2x continuaria ocupando 550px na
           * layout, e a rolagem do `.arb-arvore` nao teria o que percorrer:
           * a arvore cresceria para fora da area rolavel e a parte de baixo
           * simplesmente nao apareceria
           */
          width: `${PALCO.largura * zoom}px`,
          height: `${PALCO.altura * zoom}px`,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        <svg
          className="arb-ligacoes"
          viewBox={`0 0 ${PALCO.largura} ${PALCO.altura}`}
          width={PALCO.largura}
          height={PALCO.altura}
          aria-hidden="true"
        >
          {ligacoes.map((linha) => (
            <path
              key={linha.id}
              className={[
                "arb-liga",
                linha.viva ? "is-viva" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              d={`M ${linha.x1} ${linha.y1} L ${linha.x2} ${linha.y2}`}
            />
          ))}
        </svg>

        {nosArvore.map((no) => (
          <NoHabilidade
            key={no.id}
            no={no}
            dados={nos.get(no.id)}
            progresso={`${porDegrau.get(no.degrau) ?? 0}/${no.total}`}
            aoComprar={aoComprar}
            desabilitado={disabled}
            sobre={noSobre === no.id}
            fixado={fixado === no.id}
            aoSobre={setNoSobre}
            aoFixar={setFixado}
            aoAplicar={() => {
              setFixado(null);
              aoComprar?.(no.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * UM NO EM HEXAGONO.
 *
 * ## POR QUE O HEXAGONO E FEITO COM DOIS BLOCOS
 *
 * Porque `clip-path` recorta um preenchimento, e nao desenha uma borda. O
 * contorno de um pixel do desenho e um hexagono slightly MAIOR na cor da
 * borda, com outro hexagono DENTRO dele na cor do fundo. O que sobra entre os
 * dois e a linha
 *
 * E por isso que o bloco de dentro precisa de `clip-path` tambem: sem ele, o
 * retangulo interno cobriria os seis cantos do de fora
 *
 * ## E POR QUE O FUNDACAO E MAIOR
 *
 * Porque ele e onde o desenho junta, e o olho precisa achar o centro sem ler
 * nada. Na referencia ele tem um hexagrama interno e uma barra de progresso
 * verde; aqui ele ganha escala e o verde, e o hexagrama fica para a barra
 */
/**
 * O NOME CURTO DE CADA BÔNUS.
 *
 * ## POR QUE TRÊS LETRAS E NÃO A PALAVRA INTEIRA
 *
 * Porque a caixa de tooltip tem 280px e o nome do nó já ocupa a primeira
 * linha. "Ataque +10" ao lado de "Defesa +9" e "Vida +7" não cabe em duas
 * linhas, e o que sobrar seria uma linha quebrada no meio da palavra. As
 * três letras são o formato que o resto do HUD já usa para stat
 *
 * E a lista é EXAUSTIVA de propósito: um bônus novo sem entrada aqui cairia
 * em `chave.toUpperCase()` e apareceria "MAXHP" no balão, que é pior do que
 * não aparecer
 */
const ROTULO_DO_BONUS = {
  attack: "ATQ",
  defense: "DEF",
  speed: "VEL",
  maxHp: "VIDA",
  resource: "REC",
};

/**
 * O BÔNUS DO NÓ, COMO UMA FRASE.
 *
 * ## POR QUE SOME COM VALOR ZERO
 *
 * Porque `convergencia.bonus` pode vir `{}` quando o tronco nao tem `neto`, e
 * um "ATQ +0" no balão é uma promessa que o nó não cumpre
 *
 * ## E POR QUE O `+` SAI NO NÚMERO, E NÃO NO RÓTULO
 *
 * Porque é o número que muda de um nó para outro. Com o sinal colado no
 * rótulo, "ATQ+ e DEF+" diria duas coisas que o jogador teria de casar com
 * os números
 */
function fraseDoBonus(bonus) {
  const partes = Object.entries(bonus ?? {})
    .filter(([, valor]) => Number.isFinite(valor) && valor !== 0)
    .map(([chave, valor]) => {
      const rotulo = ROTULO_DO_BONUS[chave];

      return rotulo
        ? `${rotulo} ${valor > 0 ? "+" : ""}${valor}`
        : `${chave} ${valor > 0 ? "+" : ""}${valor}`;
    });

  return partes.join("  ·  ");
}

/**
 * O BALÃO DO NÓ, EM VÁRIAS LINHAS.
 *
 * ## POR QUE O BÔNUS APARECE TAMBÉM NO NÓ JÁ APRENDIDO
 *
 * Porque essa era a pergunta do jogador: passar o mouse por cima de um nó que
 * ele já pagou e não ter como confirmar o que aquilo está dando. O nome não
 * responde, e o ícone é glifo. O bonûs é o ÚNICO lugar da tela que diz o que
 * o nó faz depois de comprado — e é justamente quando o jogador esqueceu
 *
 * ## E POR QUE A LINHA DO ESTADO VAI NO FIM
 *
 * Porque a ordem é "o que é, o que dá, o que custa". Ler o custo primeiro e
 * depois descobrir o que se paga é o caminho ao contrário
 */
function textoDoNo(no, { pode, motivo, investido }) {
  const linhas = [no.nome];

  /**
   * O QUE ELE ENSINA, e so quando ensina.
   *
   * Porque o tronco da arvore é o que dá a skill de verdade; os nós de baixo
   * são só número. Escrever "Ensina Golpe do Vazio" num nó que não ensina
   * skill seria mentira no balão
   */
  if (no.skillId) linhas.push(`Ensina ${no.nome}.`);

  const bonus = fraseDoBonus(no.bonus);

  if (bonus) linhas.push(bonus);

  if (investido) {
    linhas.push("APRENDIDO");
  } else if (pode) {
    linhas.push(`${no.custo} ponto${no.custo > 1 ? "s" : ""}`);
  } else {
    linhas.push(motivo);
  }

  return linhas.join("\n");
}

/**
 * O NÓ, COM A CAIXA ACIMA DELE.
 *
 * E o `z-index` que este wrapper carrega que põe a caixa ACIMA das bolas
 * vizinhas, e não o `z-index: 5` da caixa. O `transform` do wrapper cria um
 * contexto de empilhamento próprio: a caixa nunca sobe acima das irmãs do
 * wrapper, por mais alto que o `z-index` dela seja. Nos nós da fileira de cima
 * a caixa atravessava as bolas de baixo
 */
function NoHabilidade({
  no,
  dados,
  progresso,
  desabilitado,
  sobre,
  fixado,
  aoSobre,
  aoFixar,
  aoAplicar,
}) {
  if (!dados) return null;

  const { pode, motivo, investido } = dados;

  const classes = [
    "arb-hex",
    no.fundacao ? "arb-hex--fundacao" : "",
    investido ? "is-aprendido" : "",
    !investido && !pode ? "is-bloqueado" : "",
    pode ? "is-pronto" : "",
    fixado ? "is-fixado" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /**
   * A BOLA É UM `div`, E NÃO O BOTÃO.
   *
   * Porque o botão agora seria o "APLICAR" dentro da caixa. Se a bola
   * continuasse sendo o botão, um clique nela gastaria o ponto — que é
   * exatamente o que o pedido é para não acontecer — e o `disabled` dela
   * desligaria justamente os nós bloqueados, que são os que precisam abrir
   * a caixa para o jogador LER o motivo
   *
   * ## E POR QUE O CLIQUE ESTÁ NO WRAPPER, E NÃO NA BOLA
   *
   * Porque a caixa também é filha do wrapper, e o clique no cabeçalho dela
   * subiria até aqui de qualquer jeito. Com o handler no wrapper, os dois
   * alvos — a bola e o cabeçalho — fixam a caixa, e não há dois lugares
   * mantendo o mesmo estado
   */
  return (
    <div
      className={[
        "arb-no",
        sobre || fixado ? "is-aberto" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ left: no.x, top: no.y }}
      onPointerEnter={() => aoSobre(no.id)}
      onPointerLeave={() => aoSobre(null)}
      onClick={() => aoFixar(no.id)}
    >
      <div className={classes} aria-hidden="true">
        <span className="arb-hex__forma" />

        <span className="arb-hex__conteudo">
          <span className="arb-hex__icone">{no.icone}</span>
        </span>
      </div>

      <CaixaNo
        no={no}
        aberta={sobre || fixado}
        progresso={progresso}
        linhas={textoDoNo(no, { pode, motivo, investido })}
        mostrarAplicar={fixado}
        pode={pode && !desabilitado && !investido}
        aoAbrir={() => aoFixar(no.id)}
        aoAplicar={aoAplicar}
      />
    </div>
  );
}

/**
 * A CAIXA DO NÓ: some, ou fica com o botão.
 *
 * Passar o mouse mostra o texto e o `comprados/total` do degrau — o que era o
 * rótulo preso embaixo da bola. Clicar na bola trava a caixa e é aí que o
 * "APLICAR" aparece: só existe com a caixa fixada, porque é o clique que está
 * autorizando o gasto, e não a passagem do cursor
 *
 * ## POR QUE ELA VIRA PARA BAIXO NA FILA DE CIMA
 *
 * Porque a caixa abre para cima por padrão, e o primeiro degrau fica a 100px do
 * topo do palco: a caixa subia uns 120px e saía pela barra do painel, cortada
 * no meio da frase. Vira para baixo nos nós em que não há espaço acima
 */
function CaixaNo({
  no,
  aberta,
  progresso,
  linhas,
  mostrarAplicar,
  pode,
  aoAbrir,
  aoAplicar,
}) {
  /**
   * ALTURA QUE A CAIXA PRECISA ACIMA DA BOLA, E O LIMIAR QUE VIRA A DECISÃO.
   *
   * 10px de folga + ~78px de caixa (nome, uma linha de bônus, o botão quando
   * fixada) + 27px da metade da bola. Abaixo de 130px de `y` não cabe, e o
   * primeiro degrau está a 100
   */
  const paraBaixo = no.y < 130;

  /**
   * O AJUSTE QUE MANTÉM A CAIXA DENTRO DO PALCO.
   *
   * A caixa é de 210px e nasce centrada na bola. Na bola da ponta esquerda o
   * centro fica a 60px do palco, e metade da caixa passava para fora: o
   * `overflow` do palco cortava o canto e o nome da habilidade aparecia
   * partido
   *
   * ## POR QUE CONTA EM JAVASCRIPT E NÃO COM `right: 0` NO CSS
   *
   * Porque a coluna dos nós é o dado — `DEGRAUS[degrau][indice]` já traz o X
   * normalizado, e é dele que sai o pixel. Uma regra de CSS que ancorasse pela
   * direita adivinharia a posição pelo nome da classe, e o degrau de 8 nós é o
   * que chega mais perto da borda: um limiar em CSS erra por linhas inteiras,
   * enquanto `no.x` é exato
   */
  const MEIA_CAIXA = 105;
  const MARGEM = 6;

  const faltouEsquerda = no.x - MEIA_CAIXA;
  const faltouDireita = no.x + MEIA_CAIXA - (PALCO.largura - MARGEM);

  const ajuste =
    faltouEsquerda < MARGEM
      ? MARGEM - faltouEsquerda
      : faltouDireita > 0
        ? -faltouDireita
        : 0;

  return (
    <div
      className={[
        "arb-caixa",
        aberta ? "is-aberta" : "",
        mostrarAplicar ? "is-fixada" : "",
        paraBaixo ? "is-para-baixo" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={ajuste === 0 ? undefined : { marginLeft: `${ajuste}px` }}
      role="dialog"
      aria-hidden={!aberta}
    >
      <button
        type="button"
        className="arb-caixa__cabecalho"
        onClick={aoAbrir}
        tabIndex={aberta ? 0 : -1}
      >
        <span className="arb-caixa__nome">{no.nome}</span>

        <span className="arb-caixa__progresso">{progresso}</span>
      </button>

      <p className="arb-caixa__linhas">{linhas}</p>

      {mostrarAplicar ? (
        <button
          type="button"
          className="arb-caixa__aplicar"
          onClick={aoAplicar}
          disabled={!pode}
        >
          APLICAR
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ painel */

export default function SkillTreePanel({
  classId,
  className,
  level,
  pontos,
  nosArvore,
  aoComprar,
  onClose,
}) {
  const comprados = useMemo(() => new Set(nosArvore ?? []), [nosArvore]);

  const nos = useMemo(() => {
    const mapa = new Map();

    for (const item of nosDisponiveis(
      classId,
      comprados,
      pontos ?? 0,
      level ?? 1,
    )) {
      mapa.set(item.no.id, item);
    }

    return mapa;
  }, [classId, comprados, pontos, level]);

  const total = useMemo(() => custoTotalDaArvore(classId), [classId]);

  const restantes = Math.max(0, total - comprados.size);

  const semArvore = nos.size === 0;

  return (
    <section className="inv-panel arb-panel">
      <header className="arb-cabecalho">
        <span className="arb-cabecalho__titulo">Arvore de Habilidade</span>

        {/**
         * O NUMERO E O ROTEIRO SAO DOIS ELEMENTOS.
         *
         * Porque o numero cresce a cada nivel e o rotulo nao. Num elemento so
         * o texto pularia para a esquerda quando o numero ganhasse um digito
         */}
        <span
          className={[
            "arb-cabecalho__saldo",
            (pontos ?? 0) > 0 ? "is-cheio" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <strong>{pontos ?? 0}</strong> pt
        </span>

        <button
          type="button"
          className="arb-cabecalho__fechar"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>
      </header>

      {semArvore ? (
        <div className="inv-panel__empty">
          <p>Nenhuma arvore para esta classe.</p>
          <p className="arb-vazio-detalhe">
            id recebido:{" "}
            <code>{classId ? `"${classId}"` : "nenhum"}</code>
            {className ? (
              <>
                {" · "}
                classe do personagem: <code>{className}</code>
              </>
            ) : null}
          </p>
        </div>
      ) : (
        <>
          <p className="arb-nota">
            {comprados.size}/{total} nos · {restantes} pt para fechar · cada
            nivel da 1 pt · arraste para mover
          </p>

          <Arvore
            classeId={classId}
            comprados={comprados}
            nos={nos}
            aoComprar={aoComprar}
          />
        </>
      )}
    </section>
  );
}