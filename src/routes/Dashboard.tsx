import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	emitCreateGame,
	emitDeleteGame,
	emitJoinGame,
	emitLeaveGame,
	requestGames,
} from "../socket";
import { useGameStore } from "../store";

export default function Dashboard() {
	const username = useGameStore((s) => s.username);
	const players = useGameStore((s) => s.players);
	const games = useGameStore((s) => s.games);
	const myGameId = useGameStore((s) => s.myGameId);
	const navigate = useNavigate();

	useEffect(() => {
		requestGames();
	}, []);

	function onCreate() {
		emitCreateGame((res) => {
			if (res.ok && res.game) {
				navigate(`/games/${res.game.id}`);
			} else {
				alert(res.error ?? "Could not create game");
			}
		});
	}

	function onJoin(gameId: string) {
		emitJoinGame(gameId, (res) => {
			if (res.ok && res.game) {
				navigate(`/games/${res.game.id}`);
			} else {
				alert(res.error ?? "Could not join game");
			}
		});
	}

	function onLeave() {
		emitLeaveGame();
	}

	function onDelete(gameId: string) {
		emitDeleteGame(gameId, (res) => {
			if (!res.ok) alert(res.error ?? "Could not delete game");
		});
	}

	function onRejoin() {
		if (myGameId) navigate(`/games/${myGameId}`);
	}

	const myGame = games.find((g) => g.id === myGameId);

	return (
		<div className="mx-auto max-w-3xl p-6">
			<header className="mb-8 flex items-end justify-between">
				<div>
					<h1 className="text-3xl text-neon-pink neon-text">DASHBOARD</h1>
					<p className="mt-1 text-sm text-muted">
						Logged in as <span className="text-neon-cyan">{username}</span>
					</p>
				</div>
				<Link
					to="/"
					className="text-xs tracking-wider text-muted underline-offset-2 hover:text-neon-cyan hover:underline"
				>
					Change user
				</Link>
			</header>

			{myGame && (
				<div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-ember/50 bg-panel p-4 neon-border text-ember">
					<p>
						You are in game{" "}
						<strong className="font-display text-sm tracking-wider">
							{myGame.id.slice(0, 8)}
						</strong>
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onRejoin}
							className="rounded border border-ember/60 bg-ember/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ember transition hover:bg-ember/20"
						>
							Rejoin
						</button>
						<button
							type="button"
							onClick={onLeave}
							className="rounded border border-rust/60 bg-rust/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rust transition hover:bg-rust/20"
						>
							Leave
						</button>
					</div>
				</div>
			)}

			<section className="mb-8 rounded-lg border border-neon-purple/40 bg-panel p-5 neon-border text-neon-purple">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-xl text-neon-cyan neon-text">GAMES</h2>
					<button
						type="button"
						onClick={onCreate}
						className="rounded border border-neon-pink/60 bg-neon-pink/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neon-pink transition hover:bg-neon-pink/20 neon-glow"
					>
						Create Game
					</button>
				</div>

				{games.length === 0 ? (
					<p className="text-sm text-muted">
						No games yet. Create one to get started.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{games.map((g) => (
							<li
								key={g.id}
								className="flex items-center justify-between gap-4 rounded border border-glow/10 bg-panel-deep px-4 py-3"
							>
								<div>
									<Link
										to={`/games/${g.id}`}
										className="font-display text-sm text-neon-cyan hover:underline"
									>
										#{g.id.slice(0, 8)}
									</Link>
									<p className="mt-1 text-xs text-muted">
										{g.players.join(", ") || "no players"} · {g.playerCount}/2
										players · {g.observerCount} observing
									</p>
								</div>
								<div className="flex gap-2">
									{!g.players.includes(username) && (
										<button
											type="button"
											onClick={() => onJoin(g.id)}
											className={`rounded border px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
												g.open
													? "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20"
													: "border-neon-purple/60 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20"
											}`}
										>
											{g.open ? "Join" : "Observe"}
										</button>
									)}
									{g.players.includes(username) && (
										<button
											type="button"
											onClick={() => onDelete(g.id)}
											className="rounded border border-rust/60 bg-rust/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rust transition hover:bg-rust/20"
										>
											Delete
										</button>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="rounded-lg border border-neon-cyan/40 bg-panel p-5 neon-border text-neon-cyan">
				<h2 className="mb-4 text-xl text-neon-pink neon-text">PLAYERS</h2>
				{players.length === 0 ? (
					<p className="text-sm text-muted">No players yet.</p>
				) : (
					<ul className="flex flex-col gap-2">
						{players.map((p) => (
							<li
								key={p.name}
								className="flex justify-between rounded border border-glow/10 bg-panel-deep px-4 py-2 text-sm"
							>
								<span>{p.name}</span>
								<span className="text-muted">
									starter + {p.deck.length} cards
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
