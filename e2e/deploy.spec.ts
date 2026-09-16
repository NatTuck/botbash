import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import {
	BASE,
	GameWatcher,
	canvasPoint,
	clickPass,
	createGame,
	handCenter,
	login,
	opponentSlotCenter,
	resetServer,
	slotCenter,
	uniqueName,
	waitForBoard,
} from "./helpers";

interface Setup {
	alice: Page;
	bob: Page;
	watcher: GameWatcher;
	aliceName: string;
	bobName: string;
	gameId: string;
}

async function setupGame(browser: Browser): Promise<Setup> {
	await resetServer();
	for (let attempt = 0; attempt < 10; attempt++) {
		const aliceName = uniqueName("Alice");
		const bobName = uniqueName("Bob");
		const watcherName = uniqueName("Obs");

		const ctxA = await browser.newContext();
		const alice = await ctxA.newPage();
		alice.on("dialog", (d) => d.accept());

		let ctxB: Awaited<ReturnType<Browser["newContext"]>> | null = null;
		let bob: Page | null = null;
		let watcher: GameWatcher | null = null;

		try {
			await login(alice, aliceName);
			const gameId = await createGame(alice);

			ctxB = await browser.newContext();
			bob = await ctxB.newPage();
			bob.on("dialog", (d) => d.accept());
			await login(bob, bobName);
			await bob.goto(`${BASE}/games/${gameId}`);
			await waitForBoard(bob);

			watcher = new GameWatcher(watcherName, gameId);
			await waitForBoard(alice);

			const g = await watcher.waitFor(
				(gg) => gg?.phase === "deploy" && gg.players.every((p) => p.hand.length > 0),
			);
			const aP = g.players.find((p) => p.name === aliceName);
			const bP = g.players.find((p) => p.name === bobName);
			if (aP && bP && aP.hand.some((c) => c.type === "bot") && bP.hand.some((c) => c.type === "bot")) {
				return { alice, bob, watcher, aliceName, bobName, gameId };
			}

			watcher.close();
			await ctxA.close();
			await ctxB.close();
		} catch (e) {
			watcher?.close();
			await ctxA.close();
			await ctxB?.close();
		}
	}
	throw new Error("could not get a game where both players have a bot");
}

async function botHandIndex(watcher: GameWatcher, name: string): Promise<number> {
	const g = await watcher.waitFor(
		(gg) => gg?.phase === "deploy" && gg.players.every((p) => p.hand.length > 0),
	);
	const player = g.players.find((p) => p.name === name);
	if (!player) throw new Error(`no player ${name}`);
	const i = player.hand.findIndex((c) => c.type === "bot");
	if (i < 0) throw new Error(`${name} has no bot in hand`);
	return i;
}

async function clickDeploy(page: Page, handIndex: number, slot: number): Promise<void> {
	const hp = await canvasPoint(page, handCenter(handIndex).lx, handCenter(handIndex).ly);
	await page.mouse.click(hp.x, hp.y);
	await page.waitForTimeout(150);
	const sp = await canvasPoint(page, slotCenter(slot).lx, slotCenter(slot).ly);
	await page.mouse.click(sp.x, sp.y);
}

async function clickActionRobust(
	page: Page,
	watcher: GameWatcher,
	playerName: string,
	handIndex: number,
	targetSlot: number,
	targetsOpponent: boolean,
): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const hp = await canvasPoint(page, handCenter(handIndex).lx, handCenter(handIndex).ly);
		await page.mouse.click(hp.x, hp.y);
		await page.waitForTimeout(120);
		const st = (await page.evaluate(() => (window as unknown as Record<string, unknown>).__botbash)) as {
			selection: number | null;
		};
		if (st.selection !== handIndex) continue;
		const target = targetsOpponent ? opponentSlotCenter(targetSlot) : slotCenter(targetSlot);
		const sp = await canvasPoint(page, target.lx, target.ly);
		await page.mouse.click(sp.x, sp.y);
		await page.waitForTimeout(150);
		const g = watcher.getState();
		// The play is confirmed either by the pending submission or, if this was
		// the final submission, by the phase already advancing to turn 2.
		if (g?.submissions[playerName]?.kind === "action") return;
		if (g?.turn === 2 && g?.phase === "deploy") return;
	}
	throw new Error(`could not play action card for ${playerName}`);
}

async function dragDeploy(page: Page, handIndex: number, slot: number): Promise<void> {
	const hp = await canvasPoint(page, handCenter(handIndex).lx, handCenter(handIndex).ly);
	const sp = await canvasPoint(page, slotCenter(slot).lx, slotCenter(slot).ly);
	await page.mouse.move(hp.x, hp.y);
	await page.mouse.down();
	await page.mouse.move(hp.x, hp.y + 30, { steps: 4 });
	await page.mouse.move(sp.x, sp.y, { steps: 8 });
	await page.mouse.up();
}

async function assertBoardsDeployed(
	s: Setup,
	aliceSlot: number,
	bobSlot: number,
): Promise<void> {
	const g = s.watcher.getState();
	if (!g) throw new Error("no game state");
	const aP = g.players.find((p) => p.name === s.aliceName);
	const bP = g.players.find((p) => p.name === s.bobName);
	expect(aP?.board[aliceSlot]?.type).toBe("bot");
	expect(bP?.board[bobSlot]?.type).toBe("bot");
}

async function cleanup(s: Setup): Promise<void> {
	s.watcher.close();
	await s.alice.context().close();
	await s.bob.context().close();
}

test("both players can CLICK-deploy a bot", async ({ browser }) => {
	const s = await setupGame(browser);

	const aIndex = await botHandIndex(s.watcher, s.aliceName);
	await clickDeploy(s.alice, aIndex, 0);
	await s.watcher.waitFor((g) => g?.submissions[s.aliceName]?.kind === "deploy");

	const bIndex = await botHandIndex(s.watcher, s.bobName);
	await clickDeploy(s.bob, bIndex, 2);
	await s.watcher.waitFor((g) => g?.phase === "action");

	await assertBoardsDeployed(s, 0, 2);
	await cleanup(s);
});

test("both players can DRAG-deploy a bot", async ({ browser }) => {
	const s = await setupGame(browser);

	const aIndex = await botHandIndex(s.watcher, s.aliceName);
	await dragDeploy(s.alice, aIndex, 0);
	await s.watcher.waitFor((g) => g?.submissions[s.aliceName]?.kind === "deploy");

	const bIndex = await botHandIndex(s.watcher, s.bobName);
	await dragDeploy(s.bob, bIndex, 2);
	await s.watcher.waitFor((g) => g?.phase === "action");

	await assertBoardsDeployed(s, 0, 2);
	await cleanup(s);
});

test("players can act again after a full turn (canAct is not stuck)", async ({
	browser,
}) => {
	const s = await setupGame(browser);

	// Turn 1 deploy: both pass.
	await clickPass(s.alice);
	await clickPass(s.bob);
	await s.watcher.waitFor((g) => g?.phase === "action");
	await waitForPagePhase(s.alice, "action");
	await waitForPagePhase(s.bob, "action");

	// Turn 1 action: both pass -> combat -> turn 2 deploy.
	await clickPass(s.alice);
	await clickPass(s.bob);
	await s.watcher.waitFor((g) => g?.turn === 2 && g?.phase === "deploy");
	await waitForPagePhase(s.alice, "deploy");
	await waitForPagePhase(s.bob, "deploy");

	// Regression: both players can interact again (canAct true, not stuck).
	for (const page of [s.alice, s.bob]) {
		await page.waitForFunction(
			() => (window as unknown as Record<string, unknown>).__botbash?.phase === "deploy",
		);
		const st = (await page.evaluate(() => (window as unknown as Record<string, unknown>).__botbash)) as {
			canAct: boolean;
			phase: string | null;
		};
		expect(st.phase).toBe("deploy");
		expect(st.canAct).toBe(true);
	}

	await cleanup(s);
});

test("click-deploy works without a pause between clicks", async ({ browser }) => {
	const s = await setupGame(browser);

	const aIndex = await botHandIndex(s.watcher, s.aliceName);
	const h = await canvasPoint(s.alice, handCenter(aIndex).lx, handCenter(aIndex).ly);
	await s.alice.mouse.click(h.x, h.y);
	const sp = await canvasPoint(s.alice, slotCenter(0).lx, slotCenter(0).ly);
	await s.alice.mouse.click(sp.x, sp.y);

	await s.watcher.waitFor((g) => g?.submissions[s.aliceName]?.kind === "deploy");
	await cleanup(s);
});

test("a click with small movement selects without deploying; a real drag deploys", async ({ browser }) => {
	const s = await setupGame(browser);

	// Simulate a human click with ~4px of jitter (under the 8px dragDistance).
	const aIndex = await botHandIndex(s.watcher, s.aliceName);
	const h = await canvasPoint(s.alice, handCenter(aIndex).lx, handCenter(aIndex).ly);
	await s.alice.mouse.move(h.x, h.y);
	await s.alice.mouse.down();
	await s.alice.mouse.move(h.x + 4, h.y + 2, { steps: 2 });
	await s.alice.mouse.up();
	await s.alice.waitForTimeout(300);
	// A jitter click must NOT deploy.
	expect(s.watcher.getState()?.submissions[s.aliceName]).toBeUndefined();

	// A real drag (well over 8px) does deploy.
	const aHand = await canvasPoint(s.alice, handCenter(aIndex).lx, handCenter(aIndex).ly);
	const aSlot = await canvasPoint(s.alice, slotCenter(0).lx, slotCenter(0).ly);
	await s.alice.mouse.move(aHand.x, aHand.y);
	await s.alice.mouse.down();
	await s.alice.mouse.move(aHand.x, aHand.y + 40, { steps: 4 });
	await s.alice.mouse.move(aSlot.x, aSlot.y, { steps: 8 });
	await s.alice.mouse.up();
	await s.watcher.waitFor((g) => g?.submissions[s.aliceName]?.kind === "deploy");

	await cleanup(s);
});

async function readBotbash(page: Page): Promise<{
	hand: string[];
	interactive: boolean[];
	selection: number | null;
	phase: string | null;
}> {
	return page.evaluate(() => (window as unknown as Record<string, unknown>).__botbash) as never;
}

async function waitForPagePhase(page: Page, phase: string): Promise<void> {
	await page.waitForFunction(
		(p) => (window as unknown as Record<string, unknown>).__botbash?.phase === p,
		phase,
	);
}

test("every bot card can be click-selected in the deploy phase", async ({ browser }) => {
	const s = await setupGame(browser);

	const st = await readBotbash(s.alice);
	const botSlots = st.hand
		.map((t, i) => [i, t] as const)
		.filter(([, t]) => t === "bot")
		.map(([i]) => i);
	expect(botSlots.length).toBeGreaterThan(0);

	for (const slot of botSlots) {
		expect(st.interactive[slot]).toBe(true);
		const h = await canvasPoint(s.alice, handCenter(slot).lx, handCenter(slot).ly);
		await s.alice.mouse.click(h.x, h.y);
		await s.alice.waitForTimeout(80);
		const after = await readBotbash(s.alice);
		expect(after.selection).toBe(slot);
	}

	await cleanup(s);
});

test("fresh deploy game: both players can interact (__botbash)", async ({ browser }) => {
	const s = await setupGame(browser);

	for (const [page, name] of [
		[s.alice, s.aliceName],
		[s.bob, s.bobName],
	] as const) {
		const st = await page.evaluate(() => (window as unknown as Record<string, unknown>).__botbash) as {
			username: string;
			phase: string | null;
			isPlayer: boolean;
			isInputPhase: boolean;
			mySubmission: unknown;
			canAct: boolean;
			submissions: Record<string, unknown>;
			hand: string[];
		};
		console.log("__botbash", JSON.stringify(st));
		expect(st.username).toBe(name);
		expect(st.phase).toBe("deploy");
		expect(st.isPlayer).toBe(true);
		expect(st.isInputPhase).toBe(true);
		expect(st.mySubmission).toBeNull();
		expect(st.canAct).toBe(true);
		expect(st.hand).toContain("bot");
	}

	await cleanup(s);
});

test("action cards play, animate, and both players can act again", async ({ browser }) => {
	let s: Setup | null = null;
	for (let attempt = 0; attempt < 10; attempt++) {
		s = await setupGame(browser);
		const pageErrors: string[] = [];
		for (const page of [s.alice, s.bob]) {
			page.on("pageerror", (e) => pageErrors.push(String(e)));
		}

		// Turn 1 deploy: both put a bot on the board.
		const aIndex = await botHandIndex(s.watcher, s.aliceName);
		await clickDeploy(s.alice, aIndex, 0);
		await s.watcher.waitFor((g) => g?.submissions[s.aliceName]?.kind === "deploy");
		const bIndex = await botHandIndex(s.watcher, s.bobName);
		await clickDeploy(s.bob, bIndex, 2);
		await s.watcher.waitFor((g) => g?.phase === "action");
		await waitForPagePhase(s.alice, "action");
		await waitForPagePhase(s.bob, "action");

		// Stun actions target the opponent; repair and damage target the player's own bot.
		const aHand = s.watcher.getState()?.players.find((p) => p.name === s.aliceName)?.hand ?? [];
		const bHand = s.watcher.getState()?.players.find((p) => p.name === s.bobName)?.hand ?? [];
		const aAction = aHand.findIndex((card) => card.type === "action");
		const bAction = bHand.findIndex((card) => card.type === "action");
		if (aAction < 0 && bAction < 0) {
			await cleanup(s);
			s = null;
			continue;
		}
		if (aAction >= 0) {
			const aTargetsOpponent = aHand[aAction].effect?.kind === "stun";
			await clickActionRobust(
				s.alice,
				s.watcher,
				s.aliceName,
				aAction,
				aTargetsOpponent ? 2 : 0,
				aTargetsOpponent,
			);
		} else {
			await clickPass(s.alice);
			await s.watcher.waitFor(
				(g) => g?.submissions[s.aliceName]?.kind === "pass",
			);
		}
		// Let Bob's page settle from Alice's broadcast before he clicks.
		await s.bob.waitForFunction(
			(name) => {
				const st = (window as unknown as Record<string, unknown>).__botbash as {
					submissions?: Record<string, unknown>;
				};
				return Boolean(st?.submissions?.[name]);
			},
			s.aliceName,
		);
		if (bAction >= 0) {
			const bTargetsOpponent = bHand[bAction].effect?.kind === "stun";
			await clickActionRobust(
				s.bob,
				s.watcher,
				s.bobName,
				bAction,
				bTargetsOpponent ? 0 : 2,
				bTargetsOpponent,
			);
		} else {
			await clickPass(s.bob);
			await s.watcher.waitFor(
				(g) => g?.submissions[s.bobName]?.kind === "pass",
			);
		}

		await s.watcher.waitFor((g) => g?.turn === 2 && g?.phase === "deploy");
		await waitForPagePhase(s.alice, "deploy");
		await waitForPagePhase(s.bob, "deploy");

		// Regression: interaction is not stuck after the play animations.
		for (const page of [s.alice, s.bob]) {
			const after = (await page.evaluate(() => (window as unknown as Record<string, unknown>).__botbash)) as {
				canAct: boolean;
				phase: string | null;
			};
			expect(after.phase).toBe("deploy");
			expect(after.canAct).toBe(true);
		}
		expect(pageErrors).toEqual([]);

		await cleanup(s);
		return;
	}
	throw new Error("could not get a game where either player has an action card in hand");
});
