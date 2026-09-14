export type CardType = "bot" | "action";

export type CardEffect =
	| { kind: "damage"; amount: number }
	| { kind: "repair"; amount: number }
	| { kind: "stun" }; // doesnt need amount since it always lasts for one combat

export type CardStatus =
	| { kind: "temporary"; name: string; turnsRemaining: number }
	| { kind: "permanent"; name: string };

export interface Card {
	name: string;
	type: CardType;
	atk: number;
	hp: { current: number; max: number };
	status: CardStatus[];
	effect?: CardEffect;
}

/** A copy of a card that lives inside a game and can track runtime state. */
export type GameCard = Card;

/**
 * A resolved play, broadcast to clients so they can animate it. `card` is the
 * played card (face up even for opponent plays); `handIndex` refers to the
 * slot the card came from in the player's hand before resolution.
 */
export type GameEvent =
	| {
		kind: "deploy";
		player: string;
		handIndex: number;
		card: GameCard;
		slot: number;
	}
	| {
		kind: "action";
		player: string;
		handIndex: number;
		card: GameCard;
		board: string;
		slot: number;
	};

/** A player's persistent identity and deck (lobby-side). */
export interface Player {
	name: string;
	starter: Card;
	deck: Card[];
}

/** One player's live state within a game. Board slots are left-to-right, 0-2. */
export interface GamePlayer {
	name: string;
	starter: Card;
	deck: Card[];
	hand: GameCard[];
	board: (GameCard | null)[];
}

export type GamePhase = "draw" | "deploy" | "action" | "combat" | "over";

/** A player's input during a simultaneous-input phase (deploy or action). */
export type Submission =
	| { kind: "deploy"; handIndex: number; slot: number }
	| { kind: "action"; handIndex: number; board: string; slot: number }
	| { kind: "scrapHand" }
	| { kind: "pass" };

export interface Game {
	id: string;
	players: GamePlayer[];
	/** Observer names. Observers are not part of the game's player list. */
	observers: string[];
	/** Shared discard/scrap pile, not part of either player's deck. */
	scrapPile: GameCard[];
	/** Current game phase. */
	phase: GamePhase;
	/** The current turn number (1-based). 0 before the game begins. */
	turn: number;
	/** Pending inputs for the current input phase, keyed by player name. */
	submissions: Record<string, Submission>;
	/** The winner's name, "draw", or null if the game isn't over. */
	winner: string | "draw" | null;
}

/** A lightweight view of a game for lobby listings. */
export interface GameSummary {
	id: string;
	players: string[];
	playerCount: number;
	open: boolean;
	observerCount: number;
}

export interface ServerState {
	players: Player[];
	games: Record<string, Game>;
}
