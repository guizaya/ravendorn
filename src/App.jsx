import { Component, useState } from "react";
import CharacterSelectScene from "./scenes/CharacterSelectScene/CharacterSelectScene.jsx";
import TestMapScene from "./scenes/TestMapScene/TestMapScene.jsx";
import { fallbackName } from "./data/characterName.js";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro inesperado na aplicação:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <div className="fatal-error__card">
            <span className="eyebrow">ERRO DE EXECUÇÃO</span>
            <h1>Não foi possível continuar.</h1>
            <p>{this.state.error.message}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [scene, setScene] = useState("character-select");
  const [selectedClass, setSelectedClass] = useState(null);
  const [characterName, setCharacterName] = useState("");

  // o nome vem da tela ja validado e limpo. se um dia algo
  // chamar startGame sem passar nome, o fallback evita um
  // personagem sem identidade em vez de propagar undefined
  function startGame(character = {}) {
    if (!selectedClass) return;

    setScene("test-map");
    setCharacterName(
      character.name ??
        fallbackName(selectedClass.id),
    );
  }

  function returnToSelection() {
    setScene("character-select");
  }

  return (
    <AppErrorBoundary>
      {scene === "character-select" ? (
        <CharacterSelectScene
          selectedClass={selectedClass}
          onSelectClass={setSelectedClass}
          onPlay={startGame}
          characterName={characterName}
          onNameChange={setCharacterName}
        />
      ) : (
        <TestMapScene
          key={`${selectedClass.id}:${characterName}`}
          classDefinition={selectedClass}
          characterName={characterName}
          onBack={returnToSelection}
        />
      )}
    </AppErrorBoundary>
  );
}
