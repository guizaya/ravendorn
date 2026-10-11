/**
 * O PAINEL DE TECLAS, que fica DENTRO do pause.
 *
 * ## POR QUE UM PAINEL E NAO UM MENU SEPARADO
 *
 * Porque trocar tecla e mexer no jogo que esta rodando: o jogador precisa
 * ver o personagem parado na sua frente para lembrar o que o `E` faz. E o
 * pause e o lugar onde ele ja esta quando quer isso
 *
 * ## POR QUE ELE NAO VIRA UM MENU COM UM CAMPO DE TEXTO
 *
 * Porque um campo de texto pergunta "digite: W". O jogo pergunta "aperte W".
 * A diferenca aparece com Keyboard Layout alternado — a tecla `W` e a que
 * esta marcada no teclado, e nao a letra que sai dela. Um campo de texto
 * gravaria o caractere, e o painel grava o `code`, que e o que o motor
 * pergunta
 *
 * ## E O QUE O PAINEL FAZ COM O QUE ELE OUVE
 *
 * Enquanto um slot esta esperando tecla, o painel segura o `keydown` ANTES
 * de qualquer outro: sem isso, apertar `Espaco` para mapear o ataque
 * executaria o ataque — que e a acao que o jogador estava tentando mapear
 */

import { useCallback, useEffect, useReducer, useState } from "react";
import {
  ACOES,
  conflitoDe,
  mapaDeBinds,
  nomeDaTecla,
  restaurarPadroes,
  slotsVaziosDe,
  soltarTecla,
  trocarTecla,
} from "../../game/input/keybinds.js";

/**
 * O QUE ESTA SENDO ESPERADO AGORA.
 *
 * E `null` quando o painel so esta mostrando as teclas. Vira `{ acaoId,
 * indice }` quando o jogador clicou num slot, e `null` de novo quando a tecla
 * chegou — confirmada ou nao
 */
const NADA = null;

/**
 * O `keydown` que a janela CONSOME, e nao o jogo.
 *
 * Sao teclas que o painel nunca deve capturar para um bind: a de fechar o
 * proprio painel e a de apagar um bind. Deixar a `Escape` vira bind seria
 * sobra de tecla de brinde
 */
const TECLAS_DO_PAINEL = new Set(["Escape", "Backspace", "Delete"]);

/**
 * Os grupos, na ordem em que aparecem.
 *
 * ## POR QUE A ORDEM E FIXA E NAO A DO CATALOGO
 *
 * Porque o catalogo esta em ordem de `id` — que serve para o motor, e nao
 * para o olho. Um painel que abrisse com oito numeros de habilidade embaixo
 * de "Andar" faria o jogador rolar a lista antes de encontrar o basico
 *
 * E por que "Movimento" vem primeiro: e o que o jogador mais troca, e e o
 * que ele procura quando abre o painel sem saber o que quer trocar
 */
const ORDEM_DOS_GRUPOS = ["Movimento", "Combate", "Habilidades", "Jogo"];

/**
 * AS ACOES DE UM GRUPO, na ordem do catalogo.
 */
function acoesDoGrupo(grupo) {
  return ACOES.filter((acao) => acao.grupo === grupo);
}

export default function KeyBindsPanel({ onFechar }) {
  /**
   * O contador que manda o React redesenhar.
   *
   * ## POR QUE NAO UM `useState` COM O MAPA
   *
   * Porque o mapa de teclas vive no modulo, e e o mesmo objeto para o motor,
   * para o canvas e para o painel. Se o painel guardasse uma copia no estado,
   * seria a segunda fonte da verdade — e o painel mostraria uma tecla enquanto
   * o motor responde por outra, sem nenhum erro no console para denunciar
   *
   * O painel so precisa de um "mudei, redesenha". O dado ele le do modulo na
   * hora de desenhar
   */
  const [, redesenhar] = useReducer((n) => n + 1, 0);

  const [capturando, setCapturando] = useState(NADA);

  /**
   * O CONFLITO QUE AINDA NAO FOI CONFIRMADO.
   *
   * E o que segura a troca entre a leitura da tecla e a escrita. Sem este
   * estado, capturar uma tecla ja em uso Rewrite a acao na mesma hora e o
   * "vai ficar sem tecla" do aviso chegaria tarde demais para valer
   */
  const [pendente, setPendente] = useState(NADA);

  const ouvirTecla = useCallback((event) => {
    if (!capturando) return;

    /**
     * O PAINEL E DONO DO `keydown` ENQUANTO ESPERA.
     *
     * ## POR QUE `stopImmediatePropagation` E NAO SO `stopPropagation`
     *
     * Porque o motor e o canvas tambem escutam `keydown` na JANELA. O
     * `stopPropagation` impediria a propagacao para outros nos da arvore, mas
     * os outros ouvintes do MESMO no continuam rodando — e o motor esta no
     * mesmo no que este painel
     *
     * Sem isso, mapear o ataque para `Espaco` dispararia o ataque, e mapear
     * para `T` ligaria o auto-play: o painel estaria trocando a tecla de uma
     * acao ao mesmo tempo que executando aquela acao
     */
    event.stopImmediatePropagation();
    event.preventDefault();

    // a tecla que o painel consome para si mesmo
    if (TECLAS_DO_PAINEL.has(event.code)) {
      if (event.code === "Escape") setCapturando(NADA);

      return;
    }

    setCapturando(NADA);

    // o `slot` da propria acao nao e conflito: e trocar a tecla dela
    const conflito = conflitoDe(capturando.acaoId, event.code);

    if (conflito && conflito.acaoId !== capturando.acaoId) {
      setPendente({ ...capturando, code: event.code, conflito });

      return;
    }

    trocarTecla(capturando.acaoId, capturando.indice, event.code);
    redesenhar();
  }, [capturando, redesenhar]);

  useEffect(() => {
    if (!capturando) return undefined;

    /**
     * A CAPTURA E NA FASE DE CAPTURA, E ISSO QUE FAZ ELA VALER.
     *
     * `capture: true` roda o ouvinte ANTES dos que estao na fase normal, e
     * ainda no comeco do caminho. O motor escuta na fase normal da janela,
     * entao este `keydown` ja foi barrado quando ele chega la
     *
     * Com a fase normal, o motor leria a tecla primeiro, e o painel so veria
     * ela depois do efeito — que e o oposto do que um painel de captura
     * precisa
     */
    window.addEventListener("keydown", ouvirTecla, { capture: true });

    return () =>
      window.removeEventListener("keydown", ouvirTecla, { capture: true });
  }, [capturando, ouvirTecla]);

  /**
   * A TROCA CONFIRMADA, e aqui o orfao ACONTECE.
   *
   * ## POR QUE A PERDEDORA E APAGADA E NAO SO AVISADA
   *
   * Porque o aviso so e honesto se for cumprido. Duas acoes com a mesma tecla
   * nao e um estado que o motor sabe descrever: ele entrega a ultima troca e
   * a outra vira muda, sem nada na tela explicando por que ela parou de
   * responder. Apagar a slot da perdedora e o que transforma o aviso em
   * estado: a acao fica marcada como sem tecla, e o jogador ve o buraco
   */
  const confirmarConflito = useCallback(() => {
    if (!pendente) return;

    soltarTecla(pendente.conflito.acaoId, pendente.conflito.indice);
    trocarTecla(pendente.acaoId, pendente.indice, pendente.code);

    setPendente(NADA);
    redesenhar();
  }, [pendente, redesenhar]);

  const cancelar = useCallback(() => {
    setPendente(NADA);
    setCapturando(NADA);
  }, []);

  /**
   * APAGA A ACAO INTEIRA, e nao um slot.
   *
   * ## POR QUE UM BOTAO QUE SOME
   *
   * Porque "sem tecla nenhuma" e o estado que o painel precisa oferecer de
   * proposito. Um jogador que mapeou o andar para as setas e quer testa-lo
   * sem o W apaga a acao toda de uma vez — e o que ele quer nao e trocar
   * quatro slots, sao tirar quatro teclas
   *
   * E o espelho de `soltarTecla`: o atalho `Backspace` apaga o slot que esta
   * sob o cursor, e este botao apaga a acao. Sao granularidades diferentes
   * para a mesma duvida
   */
  const apagarAcao = useCallback((acaoId) => {
    const teclas = mapaDeBinds().get(acaoId) ?? [];

    for (let i = 0; i < teclas.length; i += 1) soltarTecla(acaoId, i);

    redesenhar();
  }, []);

  const restaurar = useCallback(() => {
    restaurarPadroes();
    setPendente(NADA);
    setCapturando(NADA);
    redesenhar();
  }, []);

  const mapa = mapaDeBinds();

  return (
    <div className="keybinds" role="dialog" aria-label="Teclas do jogo">
      {/*
    A CORTINA, e ela e o que separa esta camada do pause.

    ## POR QUE O PAUSE TAMBEM TEM UMA E ESTA PRECISA DA SUA

    Porque sao dois menus sobrepostos, e sem uma cortina propria o painel
    aparecia DENTRO do pause, no lugar dele: dois retangulos escuros um sobre
    o outro, e o de baixo aparecendo em volta do de cima. O jogador nao sabia
    se o que estava vendo era o menu de teclas ou o menu de pausa

    ## E POR QUE ELA NAO FECHA O PAINEL NO CLIQUE

    Igual a do pause. Um clique perdido no meio da lista de teclas nao pode
    fechar o painel e jogar o jogador no meio de uma luta
  */}
      <div className="keybinds__cortina" />

      <div className="keybinds__painel">
        <h3 className="keybinds__titulo">Teclas</h3>

        {/*
    A DICA DE CAPTURA.

    Ela fica visivel o tempo todo em vez de so durante a captura porque o
    jogador precisa saber que a tecla e lida em QUALQUER lugar da tela: ele
    vai apertar o `E` no meio da frase "aperte E para confirmar", e o painel
    tem que pegar. Uma dica que so aparece depois do clique ensinaria o
    contrario
  */}
        <p className="keybinds__dica">
          Clique numa tecla e aperte a nova. <b>Esc</b> cancela,{" "}
          <b>Backspace</b> apaga o bind.
        </p>

        <div className="keybinds__lista">
          {ORDEM_DOS_GRUPOS.map((grupo) => {
            const acoes = acoesDoGrupo(grupo);

            if (!acoes.length) return null;

            return (
              <section
                key={grupo}
                className="keybinds__grupo"
                aria-label={grupo}
              >
                <h4 className="keybinds__grupo-nome">{grupo}</h4>

                {acoes.map((acao) => {
                  const teclas = mapa.get(acao.id) ?? acao.padrao;

                  /**
                   * A ACAO INTEIRA SEM NENHUMA TECLA.
                   *
                   * E o pior estado possivel: o painel mostra "Andar" com
                   * quatro botoes vazios, e o jogador pode nao perceber que
                   * aquele boneco nao vai mexer. A linha inteira grita junto,
                   * porque e ela que esta quebrada
                   */
                  const orfa = slotsVaziosDe(acao.id).length === teclas.length;

                  return (
                    <div
                      key={acao.id}
                      className={
                        orfa ? "keybinds__linha keybinds__linha--orfa" : "keybinds__linha"
                      }
                    >
                      <span className="keybinds__rotulo">
                        {acao.rotulo}
                        {orfa && (
                          <span className="keybinds__selo">sem tecla</span>
                        )}
                      </span>

                      <span className="keybinds__slots">
                        {teclas.map((code, indice) => {
                          const ouvindo =
                            capturando?.acaoId === acao.id &&
                            capturando?.indice === indice;

                          /**
                           * A TECLA QUE ESTA SENDO TOMADA NESTE MESMO
                           * INSTANTE.
                           *
                           * Marcar o alvo do aviso e o que amarra a frase
                           * "o Dash vai ficar sem tecla" a um objeto na tela.
                           * O aviso, sozinho, é texto
                           */
                          const perdendo =
                            pendente?.conflito?.acaoId === acao.id &&
                            pendente?.conflito?.indice === indice;

                          const classes = ["keybinds__slot"];

                          if (!code) classes.push("keybinds__slot--vazio");
                          if (ouvindo) classes.push("keybinds__slot--ouvindo");
                          if (perdendo) classes.push("keybinds__slot--perdendo");

                          return (
                            <button
                              key={indice}
                              type="button"
                              className={classes.join(" ")}
                              onClick={() => setCapturando({ acaoId: acao.id, indice })}
                              aria-label={`${acao.rotulo}: ${code ? nomeDaTecla(code) : "sem tecla"}`}
                            >
                              {ouvindo
                                ? "..."
                                : code
                                  ? nomeDaTecla(code)
                                  : "vazio"}
                            </button>
                          );
                        })}
                      </span>

                      {/*
    O BOTAO DE APAGAR, e ele e POR LINHA e nao por slot.

    O jogador que quer tirar uma tecla clica nela e aperta Backspace — o
    atalho ja resolve. Este botao existe para o mouse, e para o caso dele
    nao descobrir o atalho: apagar pelo slot e o caminho que o painel
    anuncia no topo
  */}
                      <button
                        type="button"
                        className="keybinds__apagar"
                        onClick={() => apagarAcao(acao.id)}
                        disabled={teclas.every(Boolean)}
                        aria-label={`Apagar as teclas de ${acao.rotulo}`}
                        title="Apagar as teclas desta acao"
                      >
                        limpar
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        {/*
    O AVISO DE CONFLITO.

    Ele fica no rodape e NAO no meio da lista, porque ele e sobre duas linhas
    especificas: a que esta capturando e a que vai perder a tecla. Uma lista
    que rola com o aviso no meio empurra a linha que o jogador esta
    olhando, e o aviso some assim que ele precisa

    O texto nomeia a acao perdedora pelo ROTULO, nunca pelo id: o jogador
    le "Dash", e "dash" e uma palavra de codigo
  */}
        {pendente && (
          <div className="keybinds__aviso" role="alertdialog">
            <p className="keybinds__aviso-texto">
              <b>{nomeDaTecla(pendente.code)}</b> já é de{" "}
              <b>{pendente.conflito.rotulo}</b>. Se trocar,{" "}
              <b>{pendente.conflito.rotulo}</b> fica sem tecla.
            </p>

            <div className="keybinds__aviso-botoes">
              <button
                type="button"
                className="keybinds__btn keybinds__btn--perigo"
                onClick={confirmarConflito}
              >
                Trocar assim
              </button>

              <button
                type="button"
                className="keybinds__btn"
                onClick={cancelar}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="keybinds__rodape">
          <button
            type="button"
            className="keybinds__btn keybinds__btn--fraco"
            onClick={restaurar}
          >
            Restaurar padrões
          </button>

          <button
            type="button"
            className="keybinds__btn keybinds__btn--principal"
            onClick={onFechar}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}