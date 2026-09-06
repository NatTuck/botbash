import { describe, expect, it } from "vitest";
import { cardByName } from "../shared/cards";
import type { Game, GameCard, GamePhase, GamePlayer } from "../shared/types";
import { resolveAction, resolveCombat, submitAndAdvance } from "./gameplay";

function cards(count: number): GameCard[] {
	return Array.from({ length: count }, (_, i) =>
		cardByName(`Light Repair ${(i % 50) + 1}`),
	);
}

function duck(hp = 6, atk = 2): GameCard {
	const card = structuredClone(cardByName("Robot Duck 1"));
	card.hp.current = hp;
	card.atk = atk;
	return card;
}

function repair(): GameCard {
	return structuredClone(cardByName("Light Repair 1"));
}

function duckAndRoll(): GameCard {
	return structuredClone(cardByName("Duck and Roll 1"));
}

function boardPlayer(
	name: string,
	board: (GameCard | null)[],
	hand: GameCard[] = [],
): GamePlayer {
	return { name, starter: duck(), deck: cards(15), hand, board };
}

function makeGame(players: GamePlayer[], phase: GamePhase): Game {
	return {
		id: "g",
		players,
		observers: [],
		scrapPile: [],
		phase,
		turn: 1,
		submissions: {},
		winner: null,
	};
}

describe("deploy phase", () => {
	it("moves a bot from hand to an empty slot once both players submit", () => {
		const alice = boardPlayer("Alice", [null, null, null], [duck()]);
		const bob = boardPlayer("Bob", [null, null, null], []);
		const game = makeGame([alice, bob], "deploy");

		expect(
			submitAndAdvance(game, "Alice", {
				kind: "deploy",
				handIndex: 0,
				slot: 2,
			}),
		).toEqual({ ok: true, status: "waiting", events: [] });
		expect(submitAndAdvance(game, "Bob", { kind: "pass" })).toEqual({
			ok: true,
			status: "resolved",
			events: [
				{
					kind: "deploy",
					player: "Alice",
					handIndex: 0,
					card: expect.objectContaining({ name: "Robot Duck 1" }),
					slot: 2,
				},
			],
		});

		expect(alice.board[2]?.name).toBe("Robot Duck 1");
		expect(alice.hand).toHaveLength(0);
		expect(game.phase).toBe("action");
	});

	it("rejects illegal deploys", () => {
		const alice = boardPlayer(
			"Alice",
			[duck(), null, null],
			[repair(), duck()],
		);
		const bob = boardPlayer("Bob", [null, null, null], []);
		const game = makeGame([alice, bob], "deploy");

		expect(
			submitAndAdvance(game, "Alice", {
				kind: "deploy",
				handIndex: 0,
				slot: 0,
			}),
		).toEqual({ ok: false, error: "must deploy a bot" });
		expect(
			submitAndAdvance(game, "Alice", {
				kind: "deploy",
				handIndex: 1,
				slot: 0,
			}),
		).toEqual({ ok: false, error: "slot occupied" });
	});

	it("scrap hand discards the player's hand to the scrap pile", () => {
		const alice = boardPlayer("Alice", [null, null, null], [duck(), repair()]);
		const bob = boardPlayer("Bob", [null, null, null], []);
		const game = makeGame([alice, bob], "deploy");

		submitAndAdvance(game, "Alice", { kind: "scrapHand" });
		submitAndAdvance(game, "Bob", { kind: "pass" });

		expect(alice.hand).toHaveLength(0);
		expect(game.scrapPile).toHaveLength(2);
	});
});

describe("action phase", () => {
	it("heals a bot on your own board and discards the card", () => {
		const target = duck(4);
		const alice = boardPlayer("Alice", [target, duck(), null], [repair()]);
		const bob = boardPlayer("Bob", [null, duck(), null], []);
		const game = makeGame([alice, bob], "action");

		submitAndAdvance(game, "Alice", {
			kind: "action",
			handIndex: 0,
			board: "Alice",
			slot: 0,
		});
		const res = submitAndAdvance(game, "Bob", { kind: "pass" });

		expect(target.hp.current).toBe(5);
		expect(game.scrapPile).toHaveLength(1);
		expect(res).toEqual({
			ok: true,
			status: "resolved",
			events: [
				{
					kind: "action",
					player: "Alice",
					handIndex: 0,
					card: expect.objectContaining({ name: "Light Repair 1" }),
					board: "Alice",
					slot: 0,
				},
			],
		});
	});

	it("heals up to max hp", () => {
		const target = duck(6);
		const alice = boardPlayer("Alice", [target, duck(), null], [repair()]);
		const bob = boardPlayer("Bob", [null, duck(), null], []);
		const game = makeGame([alice, bob], "action");

		submitAndAdvance(game, "Alice", {
			kind: "action",
			handIndex: 0,
			board: "Alice",
			slot: 0,
		});
		submitAndAdvance(game, "Bob", { kind: "pass" });

		expect(target.hp.current).toBe(6);
	});

	it("can heal a bot on the opponent's board", () => {
		const target = duck(3);
		const alice = boardPlayer("Alice", [duck(), null, duck()], [repair()]);
		const bob = boardPlayer("Bob", [duck(), target, duck()], []);
		const game = makeGame([alice, bob], "action");

		submitAndAdvance(game, "Alice", {
			kind: "action",
			handIndex: 0,
			board: "Bob",
			slot: 1,
		});
		submitAndAdvance(game, "Bob", { kind: "pass" });

		expect(target.hp.current).toBe(4);
	});

	it("stuns one enemy while all other bots attack normally", () => {
		const protectedBot = duck();
		const allyAttacker = duck();
		const activeEnemy = duck();
		const stunnedEnemy = duck();

		const alice = boardPlayer(
			"Alice",
			[protectedBot, null, allyAttacker],
			[duckAndRoll()],
		);
		const bob = boardPlayer(
			"Bob",
			[activeEnemy, null, stunnedEnemy],
			[],
		);
		const game = makeGame([alice, bob], "action");

		game.submissions = {
			Alice: {
				kind: "action",
				handIndex: 0,
				board: "Bob",
				slot: 2,
			},
			Bob: { kind: "pass" },
		};

		resolveAction(game, []);

		expect(stunnedEnemy.status).toContainEqual({
			kind: "temporary",
			name: "stunned",
			turnsRemaining: 1,
		});
		expect(game.scrapPile[0].name).toBe("Duck and Roll 1");

		resolveCombat(game);

		expect(protectedBot.hp.current).toBe(6);
		expect(stunnedEnemy.hp.current).toBe(4);
		expect(allyAttacker.hp.current).toBe(4);
		expect(activeEnemy.hp.current).toBe(4);
		expect(stunnedEnemy.status).not.toContainEqual(
			expect.objectContaining({ name: "stunned" }),
		);
	});

	it("rejects using Duck and Roll on your own bot", () => {
		const alice = boardPlayer(
			"Alice",
			[duck(), null, null],
			[duckAndRoll()],
		);
		const bob = boardPlayer("Bob", [null, duck(), null], []);
		const game = makeGame([alice, bob], "action");

		expect(
			submitAndAdvance(game, "Alice", {
				kind: "action",
				handIndex: 0,
				board: "Alice",
				slot: 0,
			}),
		).toEqual({
			ok: false,
			error: "must target an enemy bot",
		});
	});
});

describe("combat", () => {
	it("mirror attacks reduce hp and continue", () => {
		const aBot = duck();
		const bBot = duck();
		const alice = boardPlayer("Alice", [aBot, null, null], []);
		const bob = boardPlayer("Bob", [null, null, bBot], []);
		const game = makeGame([alice, bob], "combat");

		expect(resolveCombat(game)).toBe("continue");
		expect(aBot.hp.current).toBe(4);
		expect(bBot.hp.current).toBe(4);
		expect(game.phase).not.toBe("over");
	});

	it("sends a killed bot to the scrap pile and declares a winner", () => {
		const aBot = duck(2);
		const bBot = duck(2);
		const alice = boardPlayer("Alice", [aBot, null, null], []);
		const bob = boardPlayer("Bob", [null, null, bBot], []);
		const game = makeGame([alice, bob], "combat");

		expect(resolveCombat(game)).toBe("over");
		expect(alice.board[0]).toBeNull();
		expect(bob.board[2]).toBeNull();
		expect(game.scrapPile).toHaveLength(2);
		expect(game.winner).toBe("draw");
		expect(game.phase).toBe("over");
	});

	it("moves a side bot to the center when the center is emptied", () => {
		const center = duck(1);
		const alice = boardPlayer("Alice", [duck(), center, null], []);
		const bob = boardPlayer("Bob", [null, duck(), null], []);
		const game = makeGame([alice, bob], "combat");

		resolveCombat(game);
		expect(alice.board[1]?.name).toBe("Robot Duck 1");
	});
});

describe("submitAndAdvance pipeline", () => {
	it("advances deploy -> action -> combat -> next turn draw", () => {
		const alice = boardPlayer("Alice", [null, duck(), null], []);
		const bob = boardPlayer("Bob", [null, duck(), null], []);
		const game = makeGame([alice, bob], "deploy");

		submitAndAdvance(game, "Alice", { kind: "pass" });
		submitAndAdvance(game, "Bob", { kind: "pass" });
		expect(game.phase).toBe("action");

		submitAndAdvance(game, "Alice", { kind: "pass" });
		const res = submitAndAdvance(game, "Bob", { kind: "pass" });
		expect(res.ok).toBe(true);
		expect(res.ok && res.status).toBe("resolved");
		expect(game.turn).toBe(2);
		expect(game.phase).toBe("deploy");
		// starter bots exchanged attacks
		expect(alice.board[1]?.hp.current).toBe(4);
		expect(bob.board[1]?.hp.current).toBe(4);
	});
});
