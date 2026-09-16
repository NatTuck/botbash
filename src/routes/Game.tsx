import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
	GameCard,
	Game as GameState,
	Submission,
} from "../../shared/types";
import { isPlayable } from "../boardLayout";
import GameBoard from "../components/GameBoard";
import { emitJoinGame, emitLogin, emitSubmit } from "../socket";
import { useGameStore } from "../store";

function targetIsValid(
	game: GameState | null,
	username: string,
	phase: string | undefined,
	owner: string,
	slot: number,
): boolean {
	if (!game) return false;
	const p = game.players.find((x) => x.name === owner);
	if (!p) return false;
	const bot = p.board[slot];
	if (phase === "deploy") return owner === username && !bot;
	if (phase === "action") return Boolean(bot);
	return false;
}

export default function Game() {
	const { uuid } = useParams<{ uuid: string }>();
	const username = useGameStore((s) => s.username);
	const storeGame = useGameStore((s) => s.activeGame);
	const events = useGameStore((s) => s.pendingEvents);

	const [selection, setSelection] = useState<{
		handIndex: number;
		card: GameCard;
	} | null>(null);
	// The game currently rendered. While play events animate, this stays on the
	// pre-resolution snapshot and only advances once the animation completes.
	const [displayGame, setDisplayGame] = useState<GameState | null>(storeGame);
	const lastPhase = useRef<string | undefined>(undefined);
	const navigate = useNavigate();

	useEffect(() => {
		if (!uuid) return;
		const gameId = uuid;

		function attemptJoin() {
			emitJoinGame(gameId, (res) => {
				if (res.ok) return;
				const go = () => (username ? navigate("/dashboard") : navigate("/"));
				if (res.error === "Game not found") {
					go();
				} else if (username) {
					// Ensure the user exists on the server, then redirect.
					emitLogin(username, () => go());
				} else {
					navigate("/");
				}
			});
		}

		if (username) {
			// Ensure the server knows this user before attempting to join.
			emitLogin(username, () => attemptJoin());
		} else {
			attemptJoin();
		}
	}, [uuid, username, navigate]);

	// Hold the current snapshot while play events animate; otherwise follow the
	// server's latest state immediately.
	useEffect(() => {
		if (events && events.length > 0) return;
		setDisplayGame(storeGame);
	}, [storeGame, events]);

	function handleAnimationsComplete() {
		const latest = useGameStore.getState().activeGame;
		setDisplayGame(latest);
		useGameStore.getState().clearEvents();
	}

	useEffect(() => {
		if (lastPhase.current !== displayGame?.phase) {
			lastPhase.current = displayGame?.phase;
			setSelection(null);
		}
	}, [displayGame?.phase]);

	const phase = displayGame?.phase;
	const isPlayer =
		displayGame?.players.some((p) => p.name === username) ?? false;
	const isObserver = displayGame?.observers.includes(username) ?? false;
	const me = displayGame?.players.find((p) => p.name === username);
	const isInputPhase = phase === "deploy" || phase === "action";
	// Interaction is gated by authoritative server state, so it can never
	// desync or get stuck: once I've submitted, submissions[username] is set;
	// it is cleared by the server when the phase resolves.
	const mySubmission =
		isPlayer && displayGame
			? (displayGame.submissions[username] ?? null)
			: null;
	const canAct =
		isPlayer && isInputPhase && !mySubmission && !(events && events.length > 0);

	const validTargets = useMemo(() => {
		const set = new Set<string>();
		if (!canAct || !selection || !displayGame) return set;
		for (const p of displayGame.players) {
			p.board.forEach((_slot, i) => {
				if (targetIsValid(displayGame, username, phase, p.name, i)) {
					set.add(`${p.name}:${i}`);
				}
			});
		}
		return set;
	}, [canAct, selection, displayGame, phase, username]);

	// Debug hook: expose the values driving interaction for diagnosis.
	useEffect(() => {
		const w = window as unknown as Record<string, unknown>;
		const hand = me?.hand ?? [];
		w.__botbash = {
			username,
			phase: phase ?? null,
			isPlayer,
			isInputPhase,
			mySubmission,
			canAct,
			submissions: displayGame?.submissions ?? {},
			hand: hand.map((c) => c.type) ?? [],
			interactive: hand.map((c) => canAct && isPlayable(phase ?? "", c)),
			selection: selection?.handIndex ?? null,
			validTargets: [...validTargets],
			pendingEvents: events?.length ?? 0,
		};
	}, [
		username,
		phase,
		isPlayer,
		isInputPhase,
		mySubmission,
		canAct,
		displayGame,
		me,
		selection,
		validTargets,
		events,
	]);

	// Whether the current player has any legal card play this phase. When false,
	// the Pass / Scrap Hand controls are highlighted/offered.
	const hasLegalAction = useMemo(() => {
		if (!displayGame || !me) return false;
		if (phase === "deploy") {
			return me.hand.some((c) => c.type === "bot") && me.board.some((s) => !s);
		}
		if (phase === "action") {
			return (
				me.hand.some((c) => c.type === "action") &&
				displayGame.players.some((p) => p.board.some((b) => b))
			);
		}
		return false;
	}, [displayGame, me, phase]);

	function submitChoice(choice: Submission) {
		emitSubmit(choice, (res) => {
			if (!res.ok) {
				alert(res.error ?? "Invalid action");
				return;
			}
			setSelection(null);
		});
	}

	function onPass() {
		submitChoice({ kind: "pass" });
	}

	function onScrapHand() {
		submitChoice({ kind: "scrapHand" });
	}

	function onHandClick(handIndex: number, card: GameCard) {
		const playable =
			phase === "deploy"
				? card.type === "bot"
				: phase === "action"
					? card.type === "action"
					: false;
		if (!playable) return;
		// Always select the clicked card (never toggle off), so a re-click or
		// double-click can't accidentally deselect mid-action.
		setSelection({ handIndex, card });
	}

	function onBoardClick(owner: string, slot: number) {
		if (
			!selection ||
			!targetIsValid(displayGame, username, phase, owner, slot)
		) {
			return;
		}
		if (phase === "deploy") {
			submitChoice({ kind: "deploy", handIndex: selection.handIndex, slot });
		} else if (phase === "action") {
			submitChoice({
				kind: "action",
				handIndex: selection.handIndex,
				board: owner,
				slot,
			});
		}
	}

	function onDragHand(handIndex: number, owner: string, slot: number) {
		const card = me?.hand[handIndex];
		if (!card || !targetIsValid(displayGame, username, phase, owner, slot)) {
			return;
		}
		if (phase === "deploy" && card.type === "bot") {
			submitChoice({ kind: "deploy", handIndex, slot });
		} else if (phase === "action" && card.type === "action") {
			submitChoice({ kind: "action", handIndex, board: owner, slot });
		}
	}

	if (!displayGame || displayGame.id !== uuid) {
		return (
			<div className="flex min-h-screen items-center justify-center text-neon-cyan">
				<p className="font-display text-sm uppercase tracking-widest neon-text">
					Joining game…
				</p>
			</div>
		);
	}

	const statusText = !isPlayer
		? "Observing"
		: displayGame.phase === "over"
			? "Game over"
			: mySubmission
				? "Submitted"
				: isInputPhase
					? selection
						? phase === "deploy"
							? "Selected a bot — now click an empty slot to deploy"
							: "Selected a card — now click a target to play it"
						: !hasLegalAction
							? phase === "deploy"
								? "No bots in hand to deploy — pass or scrap your hand"
								: "No valid target to play — pass or scrap your hand"
							: phase === "deploy"
								? "Deploy a bot to an empty slot (or pass)"
								: "Play a card on a bot (or pass)"
					: "Resolving…";

	return (
		<div className="mx-auto max-w-6xl p-6">
			<header className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-2xl text-neon-pink neon-text">
						GAME #{displayGame.id.slice(0, 8)}
					</h1>
					{isObserver && (
						<p className="mt-1 text-xs uppercase tracking-widest text-neon-purple">
							(observing)
						</p>
					)}
				</div>
				<Link
					to="/dashboard"
					className="text-xs tracking-wider text-muted underline-offset-2 hover:text-neon-cyan hover:underline"
				>
					Back to dashboard
				</Link>
			</header>

			<div className="mb-3 rounded-lg border border-neon-cyan/40 bg-panel px-4 py-2">
				<p className="text-sm text-glow">{statusText}</p>
			</div>

			<div className="h-[70vh] min-h-[480px] w-full rounded-lg border border-neon-purple/40 bg-panel p-3 neon-border">
				<GameBoard
					game={displayGame}
					username={username}
					hand={Object.fromEntries(
						displayGame.players.map((p) => [p.name, p.hand]),
					)}
					canAct={canAct}
					hasLegalAction={hasLegalAction}
					selectedHandIndex={selection?.handIndex ?? null}
					validTargets={validTargets}
					pendingChoice={mySubmission}
					events={events}
					onAnimationsComplete={handleAnimationsComplete}
					onHandClick={onHandClick}
					onBoardClick={onBoardClick}
					onDragHand={onDragHand}
					onPass={onPass}
					onScrapHand={onScrapHand}
				/>
			</div>
		</div>
	);
}
