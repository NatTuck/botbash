import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import { emitLogin } from "../socket";

export default function Login() {
	const setUsername = useGameStore((s) => s.setUsername);
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const navigate = useNavigate();

	function listGames(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		emitLogin(trimmed, (res) => {
			if (res.ok) {
				setUsername(trimmed);
				navigate("/dashboard");
			} else {
				setError(res.error ?? "Login failed");
			}
		});
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm rounded-lg border border-neon-purple/40 bg-panel p-8 neon-glow text-neon-purple">
				<h1 className="mb-1 text-center text-3xl text-neon-pink neon-text">
					BOT BASH
				</h1>
				<p className="mb-6 text-center text-xs tracking-widest text-muted">
					ROBOTS FIGHT ROBOTS
				</p>

				<form onSubmit={listGames} className="flex flex-col gap-4">
					<label className="flex flex-col gap-1 text-sm text-glow">
						Username
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="rounded border border-neon-cyan/40 bg-panel-deep px-3 py-2 text-glow outline-none transition focus:border-neon-cyan focus:neon-border text-neon-cyan"
						/>
					</label>
					<button
						type="submit"
						className="rounded border border-neon-pink/60 bg-neon-pink/10 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-neon-pink transition hover:bg-neon-pink/20 neon-glow"
					>
						List Games
					</button>
					{error && <p className="text-center text-sm text-rust">{error}</p>}
				</form>
			</div>
		</div>
	);
}
