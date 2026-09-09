import { cardsOfType } from "../shared/cards";
import type {
	Game,
	GameCard,
	GameEvent,
	GamePlayer,
	Submission,
} from "../shared/types";

const clone = <T>(value: T): T => structuredClone(value);

function pickRandom<T>(items: T[]): { value: T; index: number } {
	const index = Math.floor(Math.random() * items.length);
	return { value: items[index], index };
}

function shuffle<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function isBot(card: GameCard | null): boolean {
	return card?.type === "bot";
}

function isAction(card: GameCard | null): boolean {
	return card?.type === "action";
}

function usedCardNames(game: Game): Set<string> {
	const names = new Set<string>();
	for (const p of game.players) {
		names.add(p.starter.name);
		for (const card of p.deck) names.add(card.name);
	}
	return names;
}

/**
 * Seeds the shared scrap pile with 10 cards (ideally 2 bots + 8 non-bots) from
 * the master card pool that are not in either player's deck. If fewer than 2
 * bots remain in the pool, the remaining slots are filled with actions.
 */
export function seedScrapPile(game: Game): void {
	const used = usedCardNames(game);
	const unusedBots = shuffle(
		cardsOfType("bot").filter((c) => !used.has(c.name)),
	);
	const unusedActions = shuffle(
		cardsOfType("action").filter((c) => !used.has(c.name)),
	);

	const bots = unusedBots.slice(0, 2);
	const actions = unusedActions.slice(0, 10 - bots.length);
	game.scrapPile = [...bots, ...actions].map(clone);
}

/**
 * Draws toward a 5-card hand. Draws from the top of the deck; when the deck is
 * empty, draws exactly 2 random cards from the scrap pile. Hand never exceeds 5.
 */
export function drawPlayerToFive(
	player: GamePlayer,
	scrapPile: GameCard[],
): void {
	const missing = 5 - player.hand.length;
	if (missing <= 0) return;

	if (player.deck.length === 0) {
		const take = Math.min(2, missing, scrapPile.length);
		for (let i = 0; i < take; i++) {
			const { index } = pickRandom(scrapPile);
			player.hand.push(scrapPile.splice(index, 1)[0]);
		}
		return;
	}

	const take = Math.min(player.deck.length, missing);
	player.hand.push(...player.deck.splice(0, take));
}

export function runDrawPhase(game: Game): void {
	for (const player of game.players) {
		drawPlayerToFive(player, game.scrapPile);
	}
}

/** Starts turn 1: seeds the scrap pile, runs the draw, and moves to deploy. */
export function beginGame(game: Game): void {
	if (game.turn !== 0) return;
	game.turn = 1;
	game.submissions = {};
	seedScrapPile(game);
	runDrawPhase(game);
	game.phase = "deploy";
}

/** Returns an error string if the submission is illegal for the current phase. */
export function validateSubmission(
	game: Game,
	playerName: string,
	choice: Submission,
): string | null {
	const player = game.players.find((p) => p.name === playerName);
	if (!player) return "not a player";
	if (game.phase !== "deploy" && game.phase !== "action")
		return "not an input phase";
	if (choice.kind === "pass") return null;
	if (choice.kind === "scrapHand") return null;

	if (game.phase === "deploy") {
		if (choice.kind !== "deploy") return "expected a deploy";
		const card = player.hand[choice.handIndex];
		if (!card) return "no card at that index";
		if (!isBot(card)) return "must deploy a bot";
		if (choice.slot < 0 || choice.slot > 2) return "bad slot";
		if (player.board[choice.slot]) return "slot occupied";
		return null;
	}

	if (choice.kind !== "action") return "expected an action";
	const card = player.hand[choice.handIndex];
	if (!card) return "no card at that index";
	if (!isAction(card)) return "must play a non-bot card";
	if (!card.effect) return "card has no effect";
	const boardOwner = game.players.find((p) => p.name === choice.board);
	if (!boardOwner) return "bad target board";
	if (choice.slot < 0 || choice.slot > 2) return "bad slot";
	if (!boardOwner.board[choice.slot]) return "no bot to target";
	return null;
}

/** Applies each player's deploy: move a bot from hand to an empty board slot. */
export function resolveDeploy(game: Game, events: GameEvent[]): void {
	resolveScrapHands(game);
	for (const player of game.players) {
		const sub = game.submissions[player.name];
		if (sub?.kind !== "deploy") continue;
		const [card] = player.hand.splice(sub.handIndex, 1);
		player.board[sub.slot] = card;
		events.push({
			kind: "deploy",
			player: player.name,
			handIndex: sub.handIndex,
			card,
			slot: sub.slot,
		});
	}
}

/** Discards to the scrap pile the hand of any player whose submission is scrapHand. */
function resolveScrapHands(game: Game): void {
	for (const player of game.players) {
		const sub = game.submissions[player.name];
		if (sub?.kind !== "scrapHand") continue;
		game.scrapPile.push(...player.hand);
		player.hand = [];
	}
}

function applyEffect(
	effect: NonNullable<GameCard["effect"]>,
	boardOwner: GamePlayer,
	slot: number,
): void {
	const bot = boardOwner.board[slot];
	if (!bot) return;
	if (effect.kind === "repair") {
		bot.hp.current = Math.min(bot.hp.max, bot.hp.current + effect.amount);
	}
	if (effect.kind === "damage") {
		bot.hp.current = Math.max(0, bot.hp.current - effect.amount);
	}
}

/** Applies each player's action: play a non-bot card, discard it, apply its effect. */
export function resolveAction(game: Game, events: GameEvent[]): void {
	resolveScrapHands(game);
	for (const player of game.players) {
		const sub = game.submissions[player.name];
		if (sub?.kind !== "action") continue;
		const [card] = player.hand.splice(sub.handIndex, 1);
		const boardOwner = game.players.find((p) => p.name === sub.board) ?? player;
		if (card.effect) applyEffect(card.effect, boardOwner, sub.slot);
		game.scrapPile.push(card);
		events.push({
			kind: "action",
			player: player.name,
			handIndex: sub.handIndex,
			card,
			board: sub.board,
			slot: sub.slot,
		});
	}
}

/**
 * Resolves combat: each bot attacks the bot across from it (slot i -> opp 2-i),
 * falling back to the center slot. Damage is applied, dead bots go to the scrap
 * pile, an emptied center is refilled from a side, and the end state is checked.
 */
export function resolveCombat(game: Game): "over" | "continue" {
	const [a, b] = game.players;

	for (const player of [a, b]) {
		const opp = player === a ? b : a;
		for (let i = 0; i < 3; i++) {
			const bot = player.board[i];
			if (!bot) continue;
            if (bot.name.includes("Breadson")) {
                const target1 = opp.board[0];
                const target2 = opp.board[2];
                if (target1) target1.hp.current = Math.max(0, target1.hp.current - bot.atk);
                if (target2) target2.hp.current = Math.max(0, target2.hp.current - bot.atk);
            } else {
                let targetSlot = 2 - i;
                if (!opp.board[targetSlot]) targetSlot = 1;
                const target = opp.board[targetSlot];
                if (target) target.hp.current = Math.max(0, target.hp.current - bot.atk);
            }
		}
	}

	for (const player of [a, b]) {
		for (let i = 0; i < 3; i++) {
			const slot = player.board[i];
			if (slot && slot.hp.current <= 0) {
				game.scrapPile.push(slot);
				player.board[i] = null;
			}
		}
	}

	for (const player of [a, b]) {
		if (!player.board[1]) {
			const sides = [0, 2].filter((s) => player.board[s]);
			if (sides.length) {
				const s = sides[Math.floor(Math.random() * sides.length)];
				player.board[1] = player.board[s];
				player.board[s] = null;
			}
		}
	}

	const aBots = a.board.filter(Boolean).length;
	const bBots = b.board.filter(Boolean).length;
	if (aBots === 0 && bBots === 0) {
		game.winner = "draw";
		game.phase = "over";
		return "over";
	}
	if (aBots === 0) {
		game.winner = b.name;
		game.phase = "over";
		return "over";
	}
	if (bBots === 0) {
		game.winner = a.name;
		game.phase = "over";
		return "over";
	}
	return "continue";
}

export type SubmitResult =
	| { ok: true; status: "waiting" | "resolved"; events: GameEvent[] }
	| { ok: false; error: string };

/**
 * Records a player's submission. Once both players have submitted, resolves the
 * current input phase and advances (deploy -> action -> combat -> next turn).
 */
export function submitAndAdvance(
	game: Game,
	playerName: string,
	choice: Submission,
): SubmitResult {
	const err = validateSubmission(game, playerName, choice);
	if (err) return { ok: false, error: err };

	game.submissions[playerName] = choice;
	const allSubmitted = game.players.every((p) => game.submissions[p.name]);
	if (!allSubmitted) return { ok: true, status: "waiting", events: [] };

	const events: GameEvent[] = [];
	if (game.phase === "deploy") {
		resolveDeploy(game, events);
		game.submissions = {};
		game.phase = "action";
	} else if (game.phase === "action") {
		resolveAction(game, events);
		game.submissions = {};
		game.phase = "combat";
		if (resolveCombat(game) === "over") {
			return { ok: true, status: "resolved", events };
		}
		game.turn += 1;
		game.phase = "draw";
		runDrawPhase(game);
		game.phase = "deploy";
	}

	return { ok: true, status: "resolved", events };
}
