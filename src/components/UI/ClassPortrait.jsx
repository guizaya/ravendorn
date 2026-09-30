export default function ClassPortrait({
  definition,
  large = false,
}) {
  return (
    <div
      className={[
        "class-portrait",
        large ? "class-portrait--large" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--accent": definition.accent,
      }}
    >
      <div className="class-portrait__grid" />

      <div className="class-portrait__aura" />

      <span className="class-portrait__icon">
        {definition.icon}
      </span>

      <span className="class-portrait__name">
        {definition.name}
      </span>
    </div>
  );
}
