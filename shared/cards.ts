import type { Card, CardType } from "./types";

function range(count: number): number[] {
	return Array.from({ length: count }, (_, i) => i + 1);
}

const duck: Omit<Card, "name"> = {
	type: "bot",
	atk: 2,
	hp: { current: 6, max: 6 },
	status: [],
};

const repair: Omit<Card, "name"> = {
	type: "action",
	atk: 0,
	hp: { current: 0, max: 0 },
	status: [],
	effect: { kind: "repair", amount: 1 },
};

const zap: Omit<Card, "name"> = {
	type: "action",
	atk: 0,
	hp: { current: 0, max: 0 },
	status: [],
	effect: { kind: "damage", amount: 1 },
};

const duckAndRoll: Omit<Card, "name"> = {
	type: "action",
	atk: 0,
	hp: { current: 0, max: 0 },
	status: [],
	effect: { kind: "stun" },
};

/** The master list of all cards in the game. Never mutated at runtime. */
export const cards: Card[] = [
	...range(10).map((n) => ({ ...duck, name: `Robot Duck ${n}` })),
	...range(20).map((n) => ({ ...repair, name: `Light Repair ${n}` })),
	...range(20).map((n) => ({ ...zap, name: `Zap ${n}` })),
	...range(10).map((n) => ({
		...duckAndRoll,
		name: `Duck and Roll ${n}`,
	})),
];

/** All card names, unique. */
export const cardNames: string[] = cards.map((c) => c.name);

export function cardByName(name: string): Card {
	const card = cards.find((c) => c.name === name);
	if (!card) throw new Error(`Unknown card: ${name}`);
	return card;
}

export function cardsOfType(type: CardType): Card[] {
	return cards.filter((c) => c.type === type);
}
