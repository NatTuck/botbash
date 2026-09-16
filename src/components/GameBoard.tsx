import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import type { Game, GameCard, GameEvent, Submission } from "../../shared/types";
import { getPalette } from "../theme";
import { CardArt } from "./BoardCard";
import {
	BOARD_TOTAL,
	boardX,
	CARD_H,
	CARD_W,
	CENTER_H,
	CENTER_Y,
	CUR_BOARD_Y,
	CUR_HAND_Y,
	centerX,
	DESIGN_H,
	DESIGN_W,
	findTarget,
	handX,
	OPP_BOARD_Y,
} from "./boardMath";
import { CardStack } from "./CardStack";
import { GameButton } from "./Controls";
import { CurrentZone } from "./CurrentZone";
import { OpponentZone } from "./OpponentZone";
import { PlayEffects } from "./PlayEffects";

export default function GameBoard({
	game,
	username,
	hand = {},
	canAct,
	hasLegalAction,
	selectedHandIndex,
	validTargets,
	pendingChoice,
	events,
	onAnimationsComplete,
	onHandClick,
	onBoardClick,
	onDragHand,
	onPass,
	onScrapHand,
}: {
	game: Game;
	username: string;
	hand?: Record<string, GameCard[]>;
	canAct: boolean;
	hasLegalAction: boolean;
	selectedHandIndex: number | null;
	validTargets: Set<string>;
	pendingChoice?: Submission | null;
	events?: GameEvent[] | null;
	onAnimationsComplete?: () => void;
	onHandClick?: (handIndex: number, card: GameCard) => void;
	onBoardClick?: (boardOwner: string, slot: number) => void;
	onDragHand?: (handIndex: number, boardOwner: string, slot: number) => void;
	onPass?: () => void;
	onScrapHand?: () => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<KonvaStage | null>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver(([entry]) => {
			setSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			});
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	// Debug: log pointer events (capture phase, so it fires even if a browser
	// extension such as Brave Shields stops propagation downstream) with the
	// Konva node under the cursor.
	useEffect(() => {
		const onPointer = (e: PointerEvent) => {
			const stage = stageRef.current;
			if (!stage) return;
			const container = stage.container();
			if (!container) return;
			const r = container.getBoundingClientRect();
			const pos = { x: e.clientX - r.left, y: e.clientY - r.top };
			let hit = "none";
			try {
				const node = stage.getIntersection(pos) as {
					getType?: () => string;
					name?: () => string;
				} | null;
				hit = node
					? `${node.getType?.() ?? "?"}${node.name?.() ? `:${node.name()}` : ""}`
					: "none";
			} catch {
				hit = "none";
			}
			console.log(
				`[pointer] type=${e.type} screen=(${e.clientX},${e.clientY}) hit=${hit}`,
			);
		};
		window.addEventListener("pointerdown", onPointer, true);
		return () => window.removeEventListener("pointerdown", onPointer, true);
	}, []);

	const palette = getPalette();

	const isViewerPlayer = game.players.some((p) => p.name === username);
	const current =
		game.players.find((p) => p.name === username) ?? game.players[0];
	const opponent = game.players.find((p) => p.name !== current.name) ?? null;

	const pendingGhost = (() => {
		if (
			!pendingChoice ||
			pendingChoice.kind === "pass" ||
			pendingChoice.kind === "scrapHand"
		) {
			return null;
		}
		const card = current.hand[pendingChoice.handIndex];
		if (!card) return null;
		const isOwn =
			pendingChoice.kind === "deploy" || pendingChoice.board === current.name;
		const slot = pendingChoice.slot;
		const x = isOwn ? boardX(slot) : boardX(2 - slot);
		const y = isOwn ? CUR_BOARD_Y : OPP_BOARD_Y;
		return (
			<Group opacity={0.5}>
				<CardArt
					x={x}
					y={y}
					card={card}
					accent={palette.neonPink}
					palette={palette}
				/>
			</Group>
		);
	})();

	const pendingHandIndex =
		pendingChoice &&
		pendingChoice.kind !== "pass" &&
		pendingChoice.kind !== "scrapHand"
			? pendingChoice.handIndex
			: null;

	const scale = Math.min(size.width / DESIGN_W, size.height / DESIGN_H) || 0;
	const contentW = DESIGN_W * scale;
	const contentH = DESIGN_H * scale;
	const offsetX = (size.width - contentW) / 2;
	const offsetY = (size.height - contentH) / 2;

	function dragEnd(handIndex: number, e: KonvaEventObject<DragEvent>): void {
		const pos = e.target.position();
		const cx = pos.x + CARD_W / 2;
		const cy = pos.y + CARD_H / 2;
		e.target.position({ x: handX(handIndex), y: CUR_HAND_Y });
		e.target.getLayer()?.batchDraw();
		const target = findTarget(current.name, opponent?.name ?? null, cx, cy);
		if (target && onDragHand) onDragHand(handIndex, target.owner, target.slot);
	}

	const phaseText =
		game.turn > 0
			? `TURN ${game.turn} · ${game.phase.toUpperCase()}`
			: "WAITING FOR PLAYERS";

	return (
		<div ref={containerRef} className="relative h-full w-full overflow-hidden">
			{size.width > 0 && scale > 0 && (
				<Stage ref={stageRef} width={size.width} height={size.height}>
					<Layer>
						<Group x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
							<Rect
								width={DESIGN_W}
								height={DESIGN_H}
								cornerRadius={12}
								fill={palette.void}
								stroke={palette.neonPurple}
								strokeWidth={1}
							/>

							<OpponentZone
								opponent={opponent}
								hand={opponent ? (hand[opponent.name] ?? []) : []}
								canAct={canAct}
								validTargets={validTargets}
								onBoardClick={onBoardClick}
								palette={palette}
							/>

							<Rect
								x={centerX(BOARD_TOTAL)}
								y={CENTER_Y}
								width={BOARD_TOTAL}
								height={CENTER_H}
								cornerRadius={8}
								fill={palette.panel}
								stroke={palette.ember}
								strokeWidth={1}
								dash={[6, 4]}
							/>
							<Text
								x={centerX(BOARD_TOTAL)}
								y={CENTER_Y + 12}
								width={BOARD_TOTAL}
								align="center"
								text={phaseText}
								fontSize={16}
								fontFamily="Orbitron, sans-serif"
								letterSpacing={2}
								fill={palette.ember}
							/>
							{game.phase === "over" && (
								<Text
									x={centerX(BOARD_TOTAL)}
									y={CENTER_Y + 46}
									width={BOARD_TOTAL}
									align="center"
									text={
										game.winner === "draw"
											? "DRAW"
											: `${game.winner?.toUpperCase()} WINS`
									}
									fontSize={16}
									fontFamily="Orbitron, sans-serif"
									letterSpacing={2}
									fill={palette.neonPink}
								/>
							)}
							<CardStack
								x={DESIGN_W - 48 - 90}
								y={CENTER_Y - 12}
								width={90}
								height={120}
								label="SCRAP"
								count={game.scrapPile.length}
								palette={palette}
							/>
							{/* Controls below the scrap pile */}
							{canAct && (
								<GameButton
									x={780}
									y={400}
									width={120}
									height={38}
									label="PASS"
									highlight={!hasLegalAction}
									onClick={onPass}
									palette={palette}
								/>
							)}
							{canAct && !hasLegalAction && (
								<GameButton
									x={780}
									y={446}
									width={120}
									height={38}
									label="SCRAP HAND"
									highlight
									onClick={onScrapHand}
									palette={palette}
								/>
							)}
							<Text
								x={12}
								y={DESIGN_H - 24}
								text={`observing: ${game.observers.length}`}
								fontSize={11}
								fill={palette.muted}
							/>

							<CurrentZone
								current={current}
								hand={hand[current.name] ?? []}
								isViewerPlayer={isViewerPlayer}
								canAct={canAct}
								phase={game.phase}
								selectedHandIndex={selectedHandIndex}
								validTargets={validTargets}
								pendingHandIndex={pendingHandIndex}
								onHandClick={onHandClick}
								onBoardClick={onBoardClick}
								onDragEnd={dragEnd}
								palette={palette}
							/>

							{/* Ghost preview of the viewer's pending action */}
							{!events?.length && pendingGhost}
							<PlayEffects
								events={events ?? []}
								viewer={username}
								palette={palette}
								onComplete={onAnimationsComplete ?? (() => {})}
							/>
						</Group>
					</Layer>
				</Stage>
			)}
		</div>
	);
}
