import { describe, expect, it } from "vitest";
import { cards, cardByName, cardsOfType } from "./cards";

describe("cards", () => {
	it("has 10 unique robot duck bots and 50 unique actions", () => {
		const bots = cardsOfType("bot");
		const actions = cardsOfType("action");
		expect(bots).toHaveLength(10);
		expect(actions).toHaveLength(50);
		expect(new Set(cards.map((c) => c.name)).size).toBe(cards.length);
	});

	it("gives Robot Duck its example stats", () => {
		const duck = cardByName("Robot Duck 1");
		expect(duck.type).toBe("bot");
		expect(duck.atk).toBe(2);
		expect(duck.hp).toEqual({ current: 6, max: 6 });
		expect(duck.effect).toBeUndefined();
	});

	it("gives Light Repair a repair effect", () => {
		const repair = cardByName("Light Repair 1");
		expect(repair.type).toBe("action");
		expect(repair.effect).toEqual({ kind: "repair", amount: 1 });
	});

	it("has 10 Duck and Roll cards with a stun effect", () => {
		const duckAndRollCards = cards.filter((card) =>
			card.name.startsWith("Duck and Roll"),
		);

		expect(duckAndRollCards).toHaveLength(10);
		expect(duckAndRollCards[0].type).toBe("action");
		expect(duckAndRollCards[0].effect).toEqual({ kind: "stun" });
	});
});
