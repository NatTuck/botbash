import { describe, expect, it } from "vitest";
import { cardByName, cards, cardsOfType } from "./cards";

describe("cards", () => {
	it("has 10 unique robot duck bots 10 unique ms paint duck and 50 unique light repairs", () => {
		const bots = cardsOfType("bot");
		const actions = cardsOfType("action");
		expect(bots).toHaveLength(20);
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

    it("gives Breaadson its stats", () => {
        const duck = cardByName("Breadson 1");
		expect(duck.type).toBe("bot");
		expect(duck.atk).toBe(3);
		expect(duck.hp).toEqual({ current: 4, max: 4 });
		expect(duck.effect).toBeUndefined();
    });

	it("gives Light Repair a repair effect", () => {
		const repair = cardByName("Light Repair 1");
		expect(repair.type).toBe("action");
		expect(repair.effect).toEqual({ kind: "repair", amount: 1 });
	});
});
