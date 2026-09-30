import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SkillSlot from "./SkillSlot.jsx";

const SKILL = {
  id: "warrior_void_slash",
  name: "Void Slash",
  icon: "VS",
  slot: 1,
  cooldown: 5,
  color: "#ef5350",
};

function render(props = {}) {
  return renderToStaticMarkup(
    <SkillSlot skill={SKILL} {...props} />,
  );
}

describe("SkillSlot render", () => {
  it("renders with every combination of flags", () => {
    for (const auto of [false, true]) {
      for (const draggable of [false, true]) {
        for (const ultimate of [false, true]) {
          for (const disabled of [false, true]) {
            for (const cooldown of [0, 2.5]) {
              expect(() =>
                render({
                  auto,
                  draggable,
                  ultimate,
                  disabled,
                  cooldown,
                }),
              ).not.toThrow();
            }
          }
        }
      }
    }
  });

  it("renders without crashing when a skill has no id or color", () => {
    expect(() =>
      render({
        skill: {
          ...SKILL,
          id: undefined,
          color: undefined,
        },
      }),
    ).not.toThrow();
  });

  it("does not show the drag hint while idle", () => {
    const markup = render({ draggable: true, auto: true });

    expect(markup).toContain("skill-slot__auto-badge");
    expect(markup).not.toContain("skill-slot__drag-hint");
    expect(markup).not.toContain("is-dragging");
  });

  it("keeps the circular frame for the metalic look", () => {
    expect(render({})).toContain("skill-slot__frame");
  });

  it("does not render a slot name inside the circle", () => {
    expect(render({})).not.toContain(
      "skill-slot__name",
    );
  });

  it("marks auto slots so the border can animate", () => {
    expect(render({ auto: true })).toContain("is-auto");
    expect(render({ auto: false })).not.toContain("is-auto");
  });

  it("never marks the ultimate as auto or draggable", () => {
    const markup = render({
      ultimate: true,
      auto: true,
      draggable: true,
    });

    expect(markup).toContain("skill-slot--ultimate");
    expect(markup).not.toContain("is-auto");
    expect(markup).not.toContain("is-draggable");
    expect(markup).not.toContain("skill-slot__auto-badge");
  });

  it("exposes the pressed state for accessibility", () => {
    expect(render({ auto: true })).toContain(
      'aria-pressed="true"',
    );
    expect(render({ auto: false })).toContain(
      'aria-pressed="false"',
    );
  });
});
