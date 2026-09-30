import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import ClassPortrait from "../../components/UI/ClassPortrait.jsx";

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

export default function CharacterSelectScene({
  selectedClass,
  onSelectClass,
  onPlay,
}) {
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
            Escolha uma classe e entre no Campo de Provas.
          </p>
        </div>

        <div className="selection-header__badge">
          <span>ETAPA</span>
          <strong>01</strong>
          <small>8 CLASSES</small>
        </div>
      </header>

      <section className="class-grid">
        {CHARACTER_CLASSES.map((definition) => {
          const selected =
            selectedClass?.id === definition.id;

          return (
            <button
              key={definition.id}
              type="button"
              className={[
                "class-card",
                selected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                "--accent": definition.accent,
              }}
              onClick={() => onSelectClass(definition)}
            >
              <ClassPortrait definition={definition} />

              <span className="class-card__role">
                {definition.role}
              </span>

              <strong>{definition.name}</strong>
              <small>{definition.tagline}</small>

              <span className="class-card__stats">
                <span>HP {definition.stats.hp}</span>
                <span>ATQ {definition.stats.attack}</span>
                <span>DEF {definition.stats.defense}</span>
              </span>
            </button>
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
                className="play-button"
                onClick={onPlay}
              >
                <span>JOGAR</span>
                <small>Entrar no mapa</small>
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
