import type { Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import type { Game } from "../shared/types";
import {
	CARD_H,
	CARD_W,
	CUR_BOARD_Y,
	CUR_HAND_Y,
	DESIGN_H,
	DESIGN_W,
	boardX,
	handX,
} from "../src/boardLayout";

export const BASE = "http://localhost:3000";

/** Unique suffix so tests don't collide with each other or prior runs. */
export function uniqueName(base: string): string {
	return `${base}-${Math.floor(Math.random() * 1e9)}`;
}

/** Resets the server's in-memory state so each test starts clean. */
export async function resetServer(): Promise<void> {
	await fetch(`${BASE}/api/reset`, { method: "POST" });
}

export async function login(page: Page, name: string): Promise<void> {
	await page.goto(BASE);
	await page.locator("input").fill(name);
	await page.getByRole("button", { name: /List Games/i }).click();
	await page.waitForURL("**/dashboard");
}

export async function createGame(page: Page): Promise<string> {
	await page.getByRole("button", { name: /Create Game/i }).click();
	await page.waitForURL(/\/games\/[0-9a-f-]+/);
	return page.url().split("/").pop() as string;
}

export async function joinFirstOpenGame(page: Page): Promise<void> {
	await page.getByRole("button", { name: /^Join$/ }).click();
	await page.waitForURL(/\/games\/[0-9a-f-]+/);
}

export async function waitForBoard(page: Page): Promise<void> {
	await page.locator("canvas").first().waitFor();
}

/** Maps a logical board point to viewport pixel coordinates. */
export async function canvasPoint(
	page: Page,
	lx: number,
	ly: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator("canvas").first().boundingBox();
	if (!box) throw new Error("board canvas not found");
	const scale = Math.min(box.width / DESIGN_W, box.height / DESIGN_H);
	const ox = (box.width - DESIGN_W * scale) / 2;
	const oy = (box.height - DESIGN_H * scale) / 2;
	return { x: box.x + ox + lx * scale, y: box.y + oy + ly * scale };
}

export function handCenter(index: number): { lx: number; ly: number } {
	return { lx: handX(index) + CARD_W / 2, ly: CUR_HAND_Y + CARD_H / 2 };
}

export function slotCenter(slot: number): { lx: number; ly: number } {
	return { lx: boardX(slot) + CARD_W / 2, ly: CUR_BOARD_Y + CARD_H / 2 };
}

/** The in-board PASS button (below the scrap pile). */
const PASS_CENTER = { lx: 840, ly: 419 };

export async function clickPass(page: Page): Promise<void> {
	// The PASS button only renders while the player is able to act.
	await page.waitForFunction(
		() =>
			(window as unknown as Record<string, unknown>).__botbash?.canAct === true,
	);
	// Konva rebuilds its hit graph on the frame after a React commit. Without
	// waiting a frame, a click can land before the button is hit-testable and
	// be silently dropped.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
	const p = await canvasPoint(page, PASS_CENTER.lx, PASS_CENTER.ly);
	await page.mouse.click(p.x, p.y);
}

/** A socket.io observer that tracks authoritative game state during a test. */
export class GameWatcher {
	private socket: Socket;
	private state: Game | null = null;
	private listeners = new Set<() => void>();
	private gameId: string;

	constructor(watcherName: string, gameId: string) {
		this.gameId = gameId;
		this.socket = io(BASE);
		this.socket.on("connect", () => {
			this.socket.emit("login", { username: watcherName });
			this.socket.emit("joinGame", { gameId });
		});
		this.socket.on("gameUpdate", ({ game }: { game: Game }) => {
			if (game.id !== gameId) return;
			this.state = game;
			for (const l of this.listeners) l();
		});
	}

	getState(): Game | null {
		return this.state;
	}

	async waitFor(pred: (g: Game | null) => boolean): Promise<Game> {
		if (this.state && pred(this.state)) return this.state;
		return new Promise((resolve) => {
			const l = () => {
				if (this.state && pred(this.state)) {
					this.listeners.delete(l);
					resolve(this.state as Game);
				}
			};
			this.listeners.add(l);
		});
	}

	close(): void {
		this.socket.disconnect();
	}
}
