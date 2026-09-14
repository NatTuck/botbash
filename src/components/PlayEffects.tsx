import { animated, useSpring } from "@react-spring/konva";
import type { ReactNode } from "react";
import { Fragment, useCallback, useEffect, useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type { GameEvent } from "../../shared/types";
import type { Palette } from "../theme";
import { CardArt } from "./BoardCard";
import {
	BACK_H,
	BACK_W,
	backsX,
	boardX,
	CARD_H,
	CARD_W,
	CUR_BOARD_Y,
	CUR_HAND_Y,
	handX,
	OPP_BOARD_Y,
	OPP_HAND_Y,
} from "./boardMath";

// react-konva's complex prop types blow up react-spring's AnimatedProps
// inference, so type the animated wrappers explicitly.
const AnimatedGroup = animated(Group) as unknown as React.FC<{
	x?: unknown;
	y?: unknown;
	opacity?: unknown;
	scaleX?: unknown;
	scaleY?: unknown;
	listening?: boolean;
	children?: ReactNode;
}>;
const AnimatedRect = animated(Rect) as unknown as React.FC<{
	x?: unknown;
	y?: unknown;
	width?: unknown;
	height?: unknown;
	cornerRadius?: unknown;
	fill?: unknown;
	opacity?: unknown;
	listening?: boolean;
}>;
const AnimatedText = animated(Text) as unknown as React.FC<{
	x?: unknown;
	y?: unknown;
	width?: unknown;
	align?: unknown;
	text?: unknown;
	fontSize?: unknown;
	fontFamily?: unknown;
	fontStyle?: unknown;
	fill?: unknown;
	opacity?: unknown;
	listening?: boolean;
}>;

const FLY_MS = 320;
const FLASH_MS = 260;

const easeInOutCubic = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

function sourceRect(event: GameEvent, viewer: string) {
	const own = event.player === viewer;
	return own
		? {
				x: handX(event.handIndex),
				y: CUR_HAND_Y,
				width: CARD_W,
				height: CARD_H,
			}
		: {
				x: backsX(event.handIndex),
				y: OPP_HAND_Y,
				width: BACK_W,
				height: BACK_H,
			};
}

function sourcePoint(event: GameEvent, viewer: string) {
	const r = sourceRect(event, viewer);
	return { x: r.x, y: r.y };
}

function targetPoint(event: GameEvent, viewer: string) {
	if (event.kind === "deploy") {
		const own = event.player === viewer;
		return {
			x: boardX(own ? event.slot : 2 - event.slot),
			y: own ? CUR_BOARD_Y : OPP_BOARD_Y,
		};
	}
	const own = event.board === viewer;
	return {
		x: boardX(own ? event.slot : 2 - event.slot),
		y: own ? CUR_BOARD_Y : OPP_BOARD_Y,
	};
}

function FlyingCard({
	event,
	viewer,
	palette,
	onDone,
}: {
	event: GameEvent;
	viewer: string;
	palette: Palette;
	onDone: () => void;
}) {
	const from = sourcePoint(event, viewer);
	const to = targetPoint(event, viewer);
	const isAction = event.kind === "action";
	const amount = event.card.effect?.amount ?? 0;

	// The whole timeline lives in ONE spring (fly, then the action flash), so
	// nothing calls setState mid-animation and re-renders can't restart it.
	const [props, api] = useSpring(() => ({
		from: {
			x: from.x,
			y: from.y,
			opacity: 1,
			scaleX: 1,
			scaleY: 1,
			glowOpacity: 0,
			labelOpacity: 0,
			labelY: to.y + 26,
		},
	}));

	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		api.start({
			to: async (next) => {
				await next({
					x: to.x,
					y: to.y,
					config: { duration: FLY_MS, easing: easeInOutCubic },
				});
				if (isAction) {
					await next({
						opacity: 0,
						scaleX: 1.3,
						scaleY: 1.3,
						glowOpacity: 0.45,
						labelOpacity: 1,
						labelY: to.y - 26,
						config: { duration: FLASH_MS, easing: easeOutQuad },
					});
					await next({
						glowOpacity: 0,
						labelOpacity: 0,
						labelY: to.y - 40,
						config: { duration: FLASH_MS / 2 },
					});
				}
			},
			onRest: () => onDone(),
		});
	}, [api, isAction, onDone, to.x, to.y]);

	return (
		<Fragment>
			<AnimatedGroup
				x={props.x}
				y={props.y}
				opacity={props.opacity}
				scaleX={props.scaleX}
				scaleY={props.scaleY}
				listening={false}
			>
				<CardArt
					x={0}
					y={0}
					card={event.card}
					accent={palette.neonPink}
					palette={palette}
				/>
			</AnimatedGroup>
			{isAction && (
				<Fragment>
					<AnimatedRect
						x={to.x}
						y={to.y}
						width={CARD_W}
						height={CARD_H}
						cornerRadius={8}
						fill={palette.neonCyan}
						opacity={props.glowOpacity}
						listening={false}
					/>
					<AnimatedText
						x={to.x}
						y={props.labelY}
						width={CARD_W}
						align="center"
						text={`+${amount}`}
						fontSize={22}
						fontFamily="Orbitron, sans-serif"
						fontStyle="bold"
						fill={palette.neonCyan}
						opacity={props.labelOpacity}
						listening={false}
					/>
				</Fragment>
			)}
		</Fragment>
	);
}

/** Animates resolved plays: cards spring from the hand, action cards flash away. */
export function PlayEffects({
	events,
	viewer,
	palette,
	onComplete,
}: {
	events: GameEvent[];
	viewer: string;
	palette: Palette;
	onComplete: () => void;
}) {
	const doneCount = useRef(0);
	const completeOnce = useRef(false);
	const prevEvents = useRef(events);

	const total = events.length;

	// PlayEffects stays mounted between batches (it renders null when empty),
	// so reset the per-batch completion state whenever a new batch arrives.
	useEffect(() => {
		if (prevEvents.current === events) return;
		prevEvents.current = events;
		doneCount.current = 0;
		completeOnce.current = false;
	}, [events]);

	const handleDone = useCallback(() => {
		doneCount.current += 1;
		if (doneCount.current >= total && !completeOnce.current) {
			completeOnce.current = true;
			onComplete();
		}
	}, [total, onComplete]);

	// Safety net: never soft-lock the board if an animation fails to finish.
	useEffect(() => {
		if (total === 0) return;
		const timer = setTimeout(() => {
			if (!completeOnce.current) {
				completeOnce.current = true;
				onComplete();
			}
		}, 2500);
		return () => clearTimeout(timer);
	}, [total, onComplete]);

	if (total === 0) return null;

	return (
		<>
			{events.map((event, i) => {
				const source = sourceRect(event, viewer);
				return (
					<Fragment
						// biome-ignore lint/suspicious/noArrayIndexKey: one snapshot per play batch, order is stable
						key={i}
					>
						<Rect
							x={source.x}
							y={source.y}
							width={source.width}
							height={source.height}
							cornerRadius={8}
							fill={palette.panel}
							stroke={palette.muted}
							strokeWidth={1}
							dash={[6, 5]}
							listening={false}
						/>
						<FlyingCard
							event={event}
							viewer={viewer}
							palette={palette}
							onDone={handleDone}
						/>
					</Fragment>
				);
			})}
		</>
	);
}
