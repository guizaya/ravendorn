import { describe, expect, it } from "vitest";

import { DISCORD_INVITE_URL } from "@/lib/community";

// The community button must take players straight to the game's Discord server.
describe("Community Discord invite", () => {
  it("points at a real Discord invite link", () => {
    const url = new URL(DISCORD_INVITE_URL);

    expect(url.protocol).toBe("https:");
    expect(["discord.gg", "discord.com", "www.discord.com"]).toContain(url.hostname);
    if (url.hostname !== "discord.gg") expect(url.pathname.startsWith("/invite/")).toBe(true);
    expect(url.pathname.length).toBeGreaterThan(1);
  });
});
