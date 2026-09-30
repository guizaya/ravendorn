import { useEffect, useRef } from "react";
import { GameEngine } from "../../game/engine/GameEngine.js";
import { TEST_MAP } from "../../data/maps/index.js";

export default function GameCanvas({
  classDefinition,
  onSnapshot,
  engineRef,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const engine = new GameEngine(
      canvasRef.current,
      classDefinition,
      onSnapshot,
    );

    engine.setMap(TEST_MAP);
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [classDefinition, engineRef, onSnapshot]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label={`Mapa de testes da classe ${classDefinition.name}`}
    />
  );
}
