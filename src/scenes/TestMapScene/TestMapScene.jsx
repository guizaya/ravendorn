import { useCallback, useRef, useState } from "react";
import GameCanvas from "../../components/Game/GameCanvas.jsx";
import HUD from "../../components/HUD/HUD.jsx";
import useGameClient from "../../components/Game/useGameClient.js";
import { mostrarDano } from "../../game/combat/DanoVisual.js";

/**
 * A tela de jogo.
 *
 * Ela nao sabe o que e um socket: pede um cliente de rede, guarda o
 * estado que chega e entrega os dois ao canvas. Se alguem trocar a
 * rede por um motor local, e so esta linha que muda.
 */
export default function TestMapScene({
  classDefinition,
  characterName,
  tokenDeEntrada,
  onBack,

  /**
   * O MUNDO JA DESENHOU, e o front precisa saber.
   *
   * E um repasse puro: quem descobre do chao pronto e o `GameCanvas`, e quem
   * fala com o pai do iframe e o `App`. Esta tela fica no meio das duas e nao
   * tem opiniao sobre quando o mapa esta pronto
   */
  onMundoPronto = null,
}) {
  const engineRef = useRef(null);
  const [estado, setEstado] = useState(null);

  // o estado chega a 20Hz. o `useState` do React agrupa, entao o
  // canvas ve sempre a ultima versao e nunca um pacote pela
  // metade
  const handleState = useCallback((novo) => {
    setEstado(novo);
  }, []);

  /**
   * O golpe resolvido vira um numero no canvas.
   *
   * Este e o lugar que junta as duas pontas: a tela sabe do socket,
   * pelo `useGameClient`, e tem o `engineRef`, que e o motor com o
   * canvas. Nem o `GameClient` (que so carrega pacote) nem o
   * `NetworkWorld` (que so escreve posicao) servem: os dois nao tem o
   * `EffectSystem`
   *
   * E NAO passa pelo `estado`. Um golpe e um INSTANTE; dentro do
   * `useState` ele re-renderizaria a tela inteira a cada golpe, e o
   * numero nasceria depois do render — meio segundo depois do mob ter
   * andado longe
   */
  const handleDano = useCallback((dano) => {
    mostrarDano(engineRef.current, dano);
  }, [engineRef]);

  const rede = useGameClient({
    classDefinition,
    characterName,
    tokenDeEntrada,
    onState: handleState,
    onDano: handleDano,
  });

  return (
    <main className="game-screen">
      <GameCanvas
        classDefinition={classDefinition}
        characterName={characterName}
        engineRef={engineRef}
        estado={estado}
        onIntent={rede}
        onMundoPronto={onMundoPronto}
      />

      <p className="game-connection" role="status">
        {rede.mensagem}
      </p>

      <HUD
        classDefinition={classDefinition}
        characterName={characterName}

        // o painel vem do SERVIDOR. e o mesmo formato que o
        // offline montava, entao o HUD nao mudou: so mudou de onde
        // os numeros vem
        snapshot={estado?.painel ?? null}

        /**
         * O MAPA EM QUE O JOGADOR ESTA.
         *
         * Vem por fora do `painel` porque e o unico dado do estado que o
         * painel nao carrega: o `mapa` viaja no `SNAPSHOT` do mundo, ao
         * lado dos jogadores e dos inimigos, e nao no painel privado
         *
         * O botao da arena precisa dele para saber se o proximo clique
         * ENTRA ou SAI. Sem isso o HUD teria que adivinhar pelo conteudo
         * do painel, e o botao ficaria errado logo apos a troca — que e
         * quando o jogador mais olha para ele
         */
        mapa={estado?.mapa ?? null}
        /**
         * O CONVITE DE PARTY vai por fora do `estado`.
         *
         * E um evento, e nao parte do painel: o servidor o manda na hora
         * em que o convite sai, e o painel so no proximo pacote. Se viesse
         * no `estado`, a caixa de cinco segundos dependeria do painel
         */
        conviteParty={rede.conviteParty}
        engineRef={engineRef}
        onBack={onBack}

        /**
         * O FARM OFFLINE, do `useGameClient`.
         *
         * E a promise e nao um booleano porque o botao da pausa precisa
         * esperar o servidor confirmar antes de navegar: navegar desmonta
         * esta tela, o `useGameClient` roda o cleanup e chama
         * `desconectar()`, que esvazia a fila de comandos — e o pedido do
         * farm iria junto
         */
        iniciarFarmOffline={rede.iniciarFarmOffline}
        intencao={rede}
      />
    </main>
  );
}
