import { describe, expect, it } from "vitest";
import { cardByName } from "../shared/cards";
import type { Game, GameCard, GamePlayer, ServerState } from "../shared/types";
import {
	beginGame,
	drawPlayerToFive,
	runDrawPhase,
	seedScrapPile,
} from "./gameplay";
import { createGame, joinGame } from "./games";
import { getOrCreatePlayer } from "./players";

function cards(count: number): GameCard[] {
	return Array.from({ length: count }, (_, i) =>
		cardByName(`Light Repair ${(i % 50) + 1}`),
	);
}

function player(deck: GameCard[], hand: GameCard[] = []): GamePlayer {
	return {
		name: "P",
		starter: cardByName("Robot Duck 1"),
		deck,
		hand,
		board: [null, null, null],
	};
}

function freshState(names: string[]) {
	const state: ServerState = { players: [], games: {} };
	for (const n of names) getOrCreatePlayer(state, n);
	return state;
}

function syntheticGame(decks: GameCard[][]): Game {
	return {
		id: "g",
		players: decks.map((deck) => player(deck)),
		observers: [],
		scrapPile: [],
		phase: "draw",
		turn: 0,
		submissions: {},
		winner: null,
	};
}

function expectGame(game: Game | null): Game {
	if (!game) throw new Error("expected a game");
	return game;
}

describe("drawPlayerToFive", () => {
	it("draws from the deck up to a full hand", () => {
		const p = player(cards(20), []);
		drawPlayerToFive(p, []);
		expect(p.hand).toHaveLength(5);
		expect(p.deck).toHaveLength(15);
	});

	it("draws the remaining deck when it has 0 < x <= 5 cards", () => {
		const p = player(cards(3), cards(2));
		drawPlayerToFive(p, []);
		expect(p.hand).toHaveLength(5);
		expect(p.deck).toHaveLength(0);
	});

	it("never exceeds a 5-card hand", () => {
		const p = player(cards(6), cards(4));
		drawPlayerToFive(p, []);
		expect(p.hand).toHaveLength(5);
		expect(p.deck).toHaveLength(5);
	});

	it("draws exactly 2 random cards from the scrap pile when the deck is empty", () => {
		const p = player([], []);
		const scrap = cards(3);
		drawPlayerToFive(p, scrap);
		expect(p.hand).toHaveLength(2);
		expect(scrap).toHaveLength(1);
	});

	it("caps scrap draws so the hand does not exceed 5", () => {
		const p = player([], cards(4));
		const scrap = cards(3);
		drawPlayerToFive(p, scrap);
		expect(p.hand).toHaveLength(5);
		expect(scrap).toHaveLength(2);
	});

	it("leaves the hand unchanged when both deck and scrap are empty", () => {
		const p = player([], []);
		drawPlayerToFive(p, []);
		expect(p.hand).toHaveLength(0);
	});
});

describe("game setup", () => {
	it("begins a game on the second join with turn 1, deploy phase, and a seeded scrap pile", () => {
		const state = freshState(["Alice", "Bob"]);
		const game = expectGame(createGame(state, "Alice"));
		expect(game.turn).toBe(0);

		const res = joinGame(state, game.id, "Bob");
		expect(res).toHaveProperty("game");
		expect(game.turn).toBe(1);
		expect(game.phase).toBe("deploy");
		expect(game.scrapPile).toHaveLength(10);
	});

	it("seeds a 10-card scrap pile with up to 2 bots, none in either deck", () => {
		const state = freshState(["Alice", "Bob"]);
		const game = expectGame(createGame(state, "Alice"));
		joinGame(state, game.id, "Bob");

		const used = new Set<string>();
		for (const p of game.players) {
			used.add(p.starter.name);
			p.deck.forEach((c) => {
				used.add(c.name);
			});
		}

		expect(game.scrapPile).toHaveLength(10);
		expect(
			game.scrapPile.filter((c) => c.type === "bot").length,
		).toBeLessThanOrEqual(2);
		for (const card of game.scrapPile) {
			expect(used.has(card.name)).toBe(false);
		}
	});

	it("seeds 2 bots and 8 actions when the bot pool is not exhausted", () => {
		const game = syntheticGame([cards(15), cards(15)]);
		seedScrapPile(game);
		expect(game.scrapPile.filter((c) => c.type === "bot")).toHaveLength(2);
		expect(game.scrapPile.filter((c) => c.type === "action")).toHaveLength(8);
		expect(game.scrapPile).toHaveLength(10);
	});

	it("beginGame is idempotent", () => {
		const state = freshState(["Alice", "Bob"]);
		const game = expectGame(createGame(state, "Alice"));
		joinGame(state, game.id, "Bob");
		const before = {
			turn: game.turn,
			phase: game.phase,
			scrap: game.scrapPile.length,
		};
		beginGame(game);
		expect(game.turn).toBe(before.turn);
		expect(game.phase).toBe(before.phase);
		expect(game.scrapPile.length).toBe(before.scrap);
	});

	it("runDrawPhase draws both players toward five", () => {
		const state = freshState(["Alice", "Bob"]);
		const game = expectGame(createGame(state, "Alice"));
		joinGame(state, game.id, "Bob");
		for (const p of game.players) {
			p.hand = [];
			p.deck = cards(20);
		}
		runDrawPhase(game);
		for (const p of game.players) {
			expect(p.hand).toHaveLength(5);
			expect(p.deck).toHaveLength(15);
		}
	});
});
