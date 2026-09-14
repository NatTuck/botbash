import { io } from "socket.io-client";
import type {
	Game,
	GameEvent,
	GameSummary,
	Player,
	Submission,
} from "../shared/types";
import { useGameStore } from "./store";

/** Single shared socket connection for the whole SPA. */
export const socket = io();

export interface Ack {
	ok: boolean;
	error?: string;
}

export interface LoginAck extends Ack {
	player?: Player;
}

export interface GameAck extends Ack {
	game?: Game;
	role?: "player" | "observer";
	removed?: boolean;
}

export function emitLogin(
	username: string,
	cb?: (res: LoginAck) => void,
): void {
	socket.emit("login", { username }, cb);
}

export function requestGames(): void {
	socket.emit("games", ({ games }: { games: GameSummary[] }) => {
		useGameStore.getState().setGames(games);
	});
}

export function emitCreateGame(cb?: (res: GameAck) => void): void {
	socket.emit("createGame", cb);
}

export function emitJoinGame(
	gameId: string,
	cb?: (res: GameAck) => void,
): void {
	socket.emit("joinGame", { gameId }, cb);
}

export function emitLeaveGame(cb?: (res: GameAck) => void): void {
	socket.emit("leaveGame", cb);
}

export function emitDeleteGame(
	gameId: string,
	cb?: (res: GameAck) => void,
): void {
	socket.emit("deleteGame", { gameId }, cb);
}

export function emitSubmit(
	choice: Submission,
	cb?: (res: GameAck & { status?: "waiting" | "resolved" }) => void,
): void {
	socket.emit("submit", { choice }, cb);
}

/** Registers global socket listeners and restores a saved session, if any. */
export function initSocket(): void {
	socket.on("players", ({ players }: { players: Player[] }) => {
		useGameStore.getState().setPlayers(players);
	});

	socket.on("games", ({ games }: { games: GameSummary[] }) => {
		useGameStore.getState().setGames(games);
	});

	socket.on(
		"gameUpdate",
		({ game, events }: { game: Game; events?: GameEvent[] }) => {
			useGameStore.getState().setActiveGame(game, events ?? []);
			const { username } = useGameStore.getState();
			useGameStore.getState().setMyGameId(game.id);
			if (username) {
				const isPlayer = game.players.some((p) => p.name === username);
				const isObserver = game.observers.includes(username);
				if (!isPlayer && !isObserver) {
					useGameStore.getState().setMyGameId(null);
				}
			}
		},
	);

	socket.on("gameDeleted", ({ gameId }: { gameId: string }) => {
		const st = useGameStore.getState();
		if (st.activeGame?.id === gameId) st.setActiveGame(null);
		if (st.myGameId === gameId) st.setMyGameId(null);
	});

	const saved = localStorage.getItem("botbash.username");
	if (saved) {
		emitLogin(saved);
	}
}
