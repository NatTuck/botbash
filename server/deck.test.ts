import { describe, expect, it } from "vitest";
import { cards } from "../shared/cards";
import { createDefaultDeck } from "./deck";

describe("createDefaultDeck", () => {
	it("builds a starter bot plus a 20-card deck (5 bots, 15 actions)", () => {
		const { starter, deck } = createDefaultDeck();
		expect(starter.type).toBe("bot");
		expect(deck).toHaveLength(20);
		expect(deck.filter((c) => c.type === "bot")).toHaveLength(5);
		expect(deck.filter((c) => c.type === "action")).toHaveLength(15);
	});

	it("returns unique card names across starter and deck", () => {
		const { starter, deck } = createDefaultDeck();
		const names = [starter, ...deck].map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
	});

    it("starter deck has ducks, repairs, and breadson", () => {
        const { starter, deck } = createDefaultDeck();
        const names = [starter, ...deck].map((card) => card.name);
        expect(names.some((n) => n.startsWith("Robot Duck"))).toBe(true);
        expect(names.some((n) => n.startsWith("Light Repair"))).toBe(true);
        expect(names.some((n) => n.startsWith("Breadson"))).toBe(true);
    });

	it("returns deep copies that do not reference the master cards", () => {
		const { starter, deck } = createDefaultDeck();
		for (const card of [starter, ...deck]) {
			const master = cards.find((c) => c.name === card.name);
			expect(master).toBeDefined();
			expect(card).not.toBe(master);
			expect(card.status).not.toBe(master?.status);
			expect(card.hp).not.toBe(master?.hp);
		}
	});
});
