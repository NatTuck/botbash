import { cardsOfType } from "../shared/cards";
import type { Card } from "../shared/types";

function shuffle<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function clone(c: Card): Card {
	return structuredClone(c);
}

/** Repeats cards until the pool produces the requested count (allows duplicates). */
function cycleFill(pool: Card[], count: number): Card[] {
	if (pool.length === 0) throw new Error("Cannot fill a deck from an empty pool");
	const out: Card[] = [];
	for (let i = 0; i < count; i++) out.push(clone(pool[i % pool.length]));
	return out;
}

function findName(cards: Card[], prefix: string): Card {
	const found = cards.find((c) => c.name.startsWith(prefix));
	if (!found) throw new Error("Deck requires a card named " + prefix);
	return found;
}

export function createDefaultDeck(): { starter: Card; deck: Card[] } {
	const bots = cardsOfType("bot");
	const actions = cardsOfType("action");

	const starter = clone(findName(bots, "Robot Duck"));

	const sigBots = [
		clone(findName(bots, "MMM-Sahur")),
		clone(findName(bots, "MS Paint Duck")),
	];
	const fillBots = cycleFill(
		bots.filter(
			(c) =>
				!c.name.startsWith("Robot Duck") &&
				!c.name.startsWith("MMM-Sahur") &&
				!c.name.startsWith("MS Paint Duck")
		),
		3
	);

	const sigActions = [
		clone(findName(actions, "Light Repair")),
		clone(findName(actions, "Zap")),
	];
	const fillActions = cycleFill(
		actions.filter(
			(c) =>
				!c.name.startsWith("Light Repair") &&
				!c.name.startsWith("Zap")
		),
		13
	);

	const deck = shuffle([...sigBots, ...fillBots, ...sigActions, ...fillActions].map(clone));
	return { starter, deck };
}