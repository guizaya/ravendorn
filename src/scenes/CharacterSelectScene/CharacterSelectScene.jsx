import { useId, useState } from "react";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import ClassPortrait from "../../components/UI/ClassPortrait.jsx";
import {
  NAME_MAX,
  NAME_MIN,
  sanitizeNameInput,
  validateName,
} from "../../data/characterName.js";

function SkillSummary({ skill }) {
  const typeLabels = {
    self: "Utilidade",
    line: "Linha",
    cone: "Cone",
    circle: "Área",
    ground: "Posicionada",
    projectile: "Projétil",
    chain: "Encadeamento",
    dash: "Investida",
  };

  return (
    <li className="skill-summary">
      <span className="skill-summary__icon">
        {skill.icon}
      </span>

      <span>
        <strong>{skill.name}</strong>
        <small>
          {typeLabels[skill.type] ?? skill.type}
          {" · "}
          {skill.cooldown}s
          {" · "}
          {skill.resourceCost}{" "}
          {skill.resourceCost > 0 ? "recurso" : "grátis"}
        </small>
      </span>
    </li>
  );
}

/**
 * Campo do nome do personagem.
 *
 * Fica na propria tela de selecao, e nao em um card de classe,
 * porque o nome e do PERSONAGEM e nao da classe: dois jogadores
 * da mesma classe sao gente diferente no mesmo mapa.
 *
 * O campo e a primeira coisa da tela. Sem ele nao existe JOGAR,
 * porque o jogo e so online e o servidor exige um nome para
 * identificar o jogador na lista.
 */
function NameField({ name, onChange, error }) {
  const inputId = useId();
  const helpId = `${inputId}-help`;

  return (
    <div className="name-field">
      <label
        className="name-field__label"
        htmlFor={inputId}
      >
        <span className="eyebrow">NOME DO PERSONAGEM</span>
      </label>

      <input
        id={inputId}
        className={[
          "name-field__input",
          error ? "is-invalid" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        type="text"
        value={name}
        maxLength={NAME_MAX}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        placeholder="Como os outros vao te ver"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={helpId}
        onChange={(event) =>
          onChange(sanitizeNameInput(event.target.value))
        }
      />

      <small
        id={helpId}
        className={[
          "name-field__help",
          error ? "is-invalid" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {error ??
          `De ${NAME_MIN} a ${NAME_MAX} caracteres. Letras, numeros, espaco e hifen.`}
      </small>
    </div>
  );
}

export default function CharacterSelectScene({
  selectedClass,
  onSelectClass,
  onPlay,
  characterName = "",
  onNameChange,
}) {
  const [tentouEntrar, setTentouEntrar] = useState(false);
  const nome = validateName(characterName);

  // o erro so aparece depois da primeira tentativa: reclamar do
  // campo vazio enquanto o jogador ainda esta escolhendo a classe
  // seria ruido
  const erro = tentouEntrar && !nome.ok ? nome.reason : null;

  const entrar = () => {
    setTentouEntrar(true);
    if (!nome.ok || !selectedClass) return;

    onPlay({ name: nome.value });
  };

  return (
    <main className="selection-screen">
      <div className="selection-screen__background" />

      <header className="selection-header">
        <div>
          <span className="eyebrow">PROTÓTIPO DE COMBATE</span>
          <h1>
            PROJECT <em>ASHEN</em>
          </h1>
          <p>
            Escolha um nome, uma classe e entre no Campo de
            Provas.
          </p>
        </div>

        <div className="selection-header__badge">
          <span>ETAPA</span>
          <strong>02</strong>
          <small>8 CLASSES</small>
        </div>
      </header>

      <NameField
        name={characterName}
        onChange={onNameChange}
        error={erro}
      />

      <section className="class-grid">
        {CHARACTER_CLASSES.map((definition) => {
          const selected =
            selectedClass?.id === definition.id;

          /**
           * O quadrado e o BOTAO, e o nome fica DEPOIS dele, fora.
           *
           * O botao tem `aspect-ratio: 1` e so a arte dentro: e o que
           * o jogador clica, e ele precisa ser um quadrado para a
           * animacao ficar centrada nele. O nome virou legenda da
           * celula, nao conteudo do botao — alem de nao caber num
           * quadrado, ele ja aparecia duas vezes na tela, no `<h2>`
           * dos detalhes e no rotulo do botao
           *
           * O `aria-label` do botao e o que o leitor de tela anuncia,
           * e ele NAO pode faltar: sem ele o botao so tem a arte
           * dentro e some o nome da classe para quem nao ve
           */
          return (
            <div
              key={definition.id}
              className={[
                "class-card-cell",
                selected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                "--accent": definition.accent,
              }}
            >
              <button
                type="button"
                className="class-card"
                aria-label={definition.name}
                aria-pressed={selected}
                onClick={() => onSelectClass(definition)}
              >
                <ClassPortrait definition={definition} />
              </button>

              <span className="class-card__label">
                {definition.name}
              </span>
            </div>
          );
        })}
      </section>

      {selectedClass && (
        <section
          className="class-detail"
          style={{
            "--accent": selectedClass.accent,
          }}
        >
          <div className="class-detail__visual">
            <ClassPortrait
              definition={selectedClass}
              large
            />
          </div>

          <div className="class-detail__content">
            <div className="class-detail__heading">
              <div>
                <span className="eyebrow">
                  {selectedClass.role}
                </span>

                <h2>{selectedClass.name}</h2>

                <p>
                  {selectedClass.description}
                </p>
              </div>

              <button
                type="button"
                className={[
                  "play-button",
                  // sem nome valido nao entra: o servidor exige
                  // nome para identificar o jogador
                  nome.ok ? "" : "is-blocked",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-disabled={!nome.ok}
                onClick={entrar}
              >
                <span>JOGAR</span>
                <small>
                  {nome.ok
                    ? "Entrar no mapa"
                    : "Escreva um nome"}
                </small>
              </button>
            </div>

            <div className="detail-pills">
              <span>
                Combate: {selectedClass.combatType}
              </span>
              <span>
                Alcance: {selectedClass.rangeLabel}
              </span>
              <span>
                Dano: {selectedClass.damageType}
              </span>
              <span>
                Recurso: {selectedClass.resource.name}
              </span>
              <span>
                Velocidade: {selectedClass.stats.speed}
              </span>
            </div>

            <div className="class-detail__columns">
              <div>
                <h3>Características</h3>
                <ul className="bullet-list">
                  {selectedClass.characteristics.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3>Pontos fortes</h3>
                <ul className="bullet-list bullet-list--positive">
                  {selectedClass.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3>Pontos fracos</h3>
                <ul className="bullet-list bullet-list--negative">
                  {selectedClass.weaknesses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mechanic-card">
              <span className="eyebrow">
                MECÂNICA PRINCIPAL
              </span>
              <strong>{selectedClass.mechanic.name}</strong>
              <p>{selectedClass.mechanic.description}</p>
              <small>
                Estilo de jogo: {selectedClass.playstyle}
              </small>
            </div>

            <div className="skills-preview">
              <div className="section-heading">
                <h3>Habilidades disponíveis</h3>
                <span>
                  {selectedClass.skills.length + 1} entradas
                </span>
              </div>

              <ul>
                {selectedClass.skills.map((skill) => (
                  <SkillSummary
                    key={skill.id}
                    skill={skill}
                  />
                ))}

                <SkillSummary
                  skill={{
                    ...selectedClass.ultimate,
                    slot: "R",
                  }}
                />
              </ul>
            </div>
          </div>
        </section>
      )}

      {!selectedClass && (
        <div className="selection-prompt">
          Selecione uma classe para visualizar seus atributos e
          habilidades.
        </div>
      )}
    </main>
  );
}
