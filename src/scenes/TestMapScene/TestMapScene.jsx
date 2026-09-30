import { useCallback, useRef, useState } from "react";
import GameCanvas from "../../components/Game/GameCanvas.jsx";
import HUD from "../../components/HUD/HUD.jsx";

export default function TestMapScene({
  classDefinition,
  onBack,
}) {
  const engineRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);

  const handleSnapshot = useCallback((nextSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  return (
    <main className="game-screen">
      <GameCanvas
        classDefinition={classDefinition}
        onSnapshot={handleSnapshot}
        engineRef={engineRef}
      />

      <HUD
        classDefinition={classDefinition}
        snapshot={snapshot}
        engineRef={engineRef}
        onBack={onBack}
      />
    </main>
  );
}
