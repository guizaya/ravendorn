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
  onBack,
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
         * O CONVITE DE PARTY vai por fora do `estado`.
         *
         * E um evento, e nao parte do painel: o servidor o manda na hora
         * em que o convite sai, e o painel so no proximo pacote. Se viesse
         * no `estado`, a caixa de cinco segundos dependeria do painel
         */
        conviteParty={rede.conviteParty}
        engineRef={engineRef}
        onBack={onBack}
        intencao={rede}
      />
    </main>
  );
}
