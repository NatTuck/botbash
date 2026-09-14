import { describe, expect, it } from "vitest";
import { getOrCreatePlayer } from "./players";
import { state } from "./state";

describe("getOrCreatePlayer", () => {
	it("creates a player with a starter and default deck when new", () => {
		const player = getOrCreatePlayer(state, "Alice");
		expect(player.name).toBe("Alice");
		expect(player.starter.type).toBe("bot");
		expect(player.deck).toHaveLength(20);
		expect(state.players).toContain(player);
	});

	it("returns the existing player on repeat calls", () => {
		const first = getOrCreatePlayer(state, "Alice");
		const second = getOrCreatePlayer(state, "Alice");
		expect(second).toBe(first);
		expect(state.players.filter((p) => p.name === "Alice")).toHaveLength(1);
	});
});
