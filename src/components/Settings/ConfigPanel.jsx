import { useMemo } from "react";

import { getItem, ITEM_TYPE } from "../../data/items/index.js";
import {
  AUTO_POCAO_LIMIAR_PADRAO,
  AUTO_POCAO_LIMIAR_MIN,
  AUTO_POCAO_LIMIAR_MAX,
} from "../../data/potions/index.js";
import ItemIcon from "../UI/ItemIcon.jsx";

/**
 * O PAINEL DE CONFIGURACAO.
 *
 * ## POR QUE ELE TEM UM ASSUNTO, E NAO UMA LISTA DE OPCOES
 *
 * Porque a configuracao do jogo tem uma coisa so por enquanto: o uso
 * automatico da pocao de cura. Um painel com "volume", "tela cheia" e
 * "resolucao" ao lado de um controle que ainda nao existe seria um painel
 * com tres buracos, e o jogador nao saberia qual buraco era o verdadeiro
 *
 * ## POR QUE A LISTA DE POCOES E AQUI, E NAO NO SLOT DA HUD
 *
 * E o pedido, e e o que mantem cada coisa em um lugar so: o painel tem as
 * tres escolhas — qual pocao, se liga, a partir de quanta vida — e a HUD so
 * mostra o RESULTADO. Se a escolha estivesse no slot da HUD, o jogador teria
 * duas telas para entender a mesma configuracao
 *
 * ## POR QUE O LIMIAR E PORCENTAGEM E NAO HP
 *
 * Porque o `maxHp` muda com nivel, com equipamento e com pocao de recurso.
 * Um limiar em HP absoluto deixaria de valer sozinho na metade da carreira,
 * e o jogador teria de mexer nele de novo sem nenhuma mudanca no jogo
 *
 * ## A POCAO ESCOLHIDA SOME DA LISTA
 *
 * Nao some da mochila: sai da lista e vai para o "equipada" no topo. As
 * tres pocoes do catalogo caberiam na tela juntas, e a lista mostraria as
 * tres sem dizer qual era a que o automatico ia beber
 */
export default function ConfigPanel({
  snapshot = null,
  onClose,
  onConfigurarAutoPocao,
}) {
  const config = snapshot?.autoPocao ?? null;

  /**
   * AS POCOES DE CURA QUE ESTAO NA MOCHILA.
   *
   * Vem do `inventory.items` do servidor e nao de um catalogo local: o
   * painel lista o que o jogador TEM, e o catalogo tem as tres pocoes
   * existindo no jogo, nao as que estao na bolsa
   */
  const pocoes = useMemo(() => {
    const itens = snapshot?.inventory?.items ?? [];

    const contaPorItem = new Map();

    for (const entrada of itens) {
      const item = getItem(entrada.itemId);

      if (item?.type !== ITEM_TYPE.POTION) continue;

      const uso = item.use ?? {};

      // a pocao de recurso entra pelo mesmo `POTION`, e nao serve aqui
      if (!uso.heal && !uso.regeneration) continue;

      contaPorItem.set(
        entrada.itemId,
        (contaPorItem.get(entrada.itemId) ?? 0) + (entrada.count ?? 0),
      );
    }

    return [...contaPorItem.entries()].map(([itemId, contagem]) => ({
      itemId,
      contagem,
      item: getItem(itemId),
    }));
  }, [snapshot]);

  /**
   * A POCAO EQUIPADA, e ela pode nao estar mais na mochila.
   *
   * O jogador unequipa a pocao e ela vai para o bau: o slot da HUD e o
   * painel continuam mostrando qual e, e a lista da mochila nao a tem. Sem
   * este achado, o painel mostraria "nenhuma pocao" e o jogador acharia que
   * perdeu a configuracao
   */
  const equipada = useMemo(() => {
    if (!config?.itemId) return null;

    return {
      itemId: config.itemId,
      contagem: config.contagem ?? 0,
      item: getItem(config.itemId),
    };
  }, [config]);

  /**
   * MUDAR A CONFIGURACAO, e um pedido so por clique.
   *
   * O painel nao guarda estado local: ele le o `snapshot` e manda o
   * pedido. Sem isso, arrastar o limiar guardaria um numero local que o
   * servidor ainda nao aceitou, e o proximo pacote sobrescreveria o valor
   * que o jogador estava apertando
   */
  const pedir = (mudanca) => {
    onConfigurarAutoPocao?.(mudanca);
  };

  const semPocao = pocoes.length === 0 && !equipada;

  return (
    <section className="inv-panel config-panel">
      <nav className="inv-tabs">
        <span className="inv-tab is-active config-tab">
          <span className="config-tab__icon">⚙</span>
          <small>Auto Pot</small>
        </span>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar"
          aria-label="Fechar a configuração"
        >
          ✕
        </button>
      </nav>

      <div className="config-panel__corpo">
        <h3 className="config-secao">Poção de cura</h3>

        {/*
          A LISTA DE POCOES.

          Cada linha e o botao que EQUIPA aquela pocao. Equipar e o que
          desliga o automatico, e o painel avisa disso no texto de baixo da
          lista em vez de esconder: um jogador que troca a pocao com o
          automatico ligado precisa saber por que ele desligou
        */}
        {semPocao ? (
          <p className="inv-panel__empty">
            Nenhuma poção de cura na mochila.
          </p>
        ) : (
          <ul className="config-pocoes">
            {equipada && (
              <li>
                <button
                  type="button"
                  className="config-pocao is-equipped"
                  onClick={() => pedir({ itemId: null })}
                  data-tip="Tirar do slot"
                >
<span className="config-pocao__arte">
                    <ItemIcon
                      item={equipada.item}
                      itemId={equipada.itemId}
                    />
                  </span>

                  <span className="config-pocao__nome">
                    {equipada.item?.name ?? equipada.itemId}
                    <small>Equipada</small>
                  </span>

                  <span className="config-pocao__conta">
                    {equipada.contagem}
                  </span>
                </button>
              </li>
            )}

            {pocoes
              .filter((entrada) => entrada.itemId !== config?.itemId)
              .map((entrada) => (
                <li key={entrada.itemId}>
                  <button
                    type="button"
                    className="config-pocao"
                    onClick={() => pedir({ itemId: entrada.itemId })}
                    data-tip={`Equipar ${entrada.item?.name ?? entrada.itemId}`}
                  >
                    <span className="config-pocao__arte">
                      <ItemIcon
                        item={entrada.item}
                        itemId={entrada.itemId}
                      />
                    </span>

                    <span className="config-pocao__nome">
                      {entrada.item?.name ?? entrada.itemId}
                    </span>

                    <span className="config-pocao__conta">
                      {entrada.contagem}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        {/*
          O INTERRUPTOR E O LIMIAR.

          O interruptor so liga COM pocao equipada, e quando falta pocao ele
          diz "Sem pocao" em vez de ficar cinza sem explicar nada: o jogador
          precisa saber o que falta, e o que falta e uma escolha que ele
          ainda nao fez na lista acima
        */}
        <div className="config-linha">
          <span className="config-linha__rotulo">
            Usar automaticamente
          </span>

          <button
            type="button"
            className={[
              "config-toggle",
              config?.ligado ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="switch"
            aria-checked={Boolean(config?.ligado)}
            aria-label="Usar a poção automaticamente"
            disabled={!config?.itemId}
            onClick={() => pedir({ ligado: !config?.ligado })}
            data-tip={
              config?.itemId
                ? "Liga e desliga o uso automático"
                : "Escolha uma poção primeiro"
            }
          >
            <span className="config-toggle__trilho">
              <span className="config-toggle__botao" />
            </span>
            <small>
              {config?.ligado
                ? "Ligado"
                : config?.itemId
                  ? "Desligado"
                  : "Sem poção"}
            </small>
          </button>
        </div>

{/*
          O LIMIAR: O ROTULO EM CIMA E A BARRA EMBAIXO.

          ## POR QUE A BARRA E O CONTROLE, E NAO O NUMERO

          Porque 85 e um numero que o jogador nao tem como imaginar. A barra
          desenhada responde a pergunta que ele realmente tem — "falta
          muita vida?" — e o numero ao lado responde a precisao. Com o
          numero sozinho, o jogador ajustaria no escuro; com a barra so,
          ele chutaria o valor exato

          ## POR QUE A BARRA E UMA `range` E NAO UM `div` CANDIDATO

          Porque uma barra arrastavel feita de `div` seria um desenho que o
          jogador arrasta e o painel finge que funciona. A `range` do
          navegador ja arrasta, ja tem teclado, ja tem o papel de
          `slider` para o leitor de tela, e o `--preenchimento` abaixo e so
          a cor da parte que ja foi escolhida
        */}
        <div className="config-bloco">
          <div className="config-bloco__topo">
            <span className="config-linha__rotulo">
              Beber abaixo de
            </span>

            <span className="config-limiar__valor">
              {config?.limiar ?? AUTO_POCAO_LIMIAR_PADRAO}%
            </span>
          </div>

          {/*
            O `--preenchimento` e o que pinta a parte escolhida da barra, e
            e o unico estilo que vai inline no painel: um valor que muda a
            cada arraste nao pode ficar num arquivo de CSS
          */}
          <input
            className="config-limiar__barra"
            type="range"
            min={AUTO_POCAO_LIMIAR_MIN}
            max={AUTO_POCAO_LIMIAR_MAX}
            step="5"
            value={config?.limiar ?? AUTO_POCAO_LIMIAR_PADRAO}
            disabled={!config?.itemId}
            aria-label="Porcentagem de vida para beber a poção"
            style={{
              "--preenchimento": `${config?.limiar ?? AUTO_POCAO_LIMIAR_PADRAO}%`,
            }}
            onChange={(evento) => {
              const numero = Number(evento.target.value);

              if (!Number.isFinite(numero)) return;

              pedir({ limiar: numero });
            }}
          />
        </div>

        {/*
          O QUE O JOGADOR VAI VER, em frase.

          Os tres controles acima sao numeros e um interruptor, e nenhum
          deles diz o que acontece na luta. Esta frase e a unica que traduz
          a configuracao para o jogador: com limiar em 85, ela
          diz "vai beber quando a vida cair abaixo de 85%"
        */}
        <p className="config-resumo">
          {equipada
            ? config?.ligado
              ? `Vai beber ${equipada.item?.name ?? "a poção"} quando a vida cair abaixo de ${config?.limiar ?? AUTO_POCAO_LIMIAR_PADRAO}%.`
              : `Automático desligado. ${equipada.item?.name ?? "A poção"} está no slot.`
            : "Escolha uma poção de cura acima."}
        </p>
      </div>
    </section>
  );
}