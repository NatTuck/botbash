import type { KonvaEventObject } from "konva/lib/Node";
import { Text } from "react-konva";
import type { GameCard, GamePlayer } from "../../shared/types";
import type { Palette } from "../theme";
import { CardArt } from "./BoardCard";
import {
	boardX,
	CARD_H,
	CARD_W,
	CUR_BOARD_Y,
	CUR_DECK_Y,
	CUR_HAND_Y,
	CUR_NAME_Y,
	DECK_H,
	DECK_W,
	DECK_X,
	DESIGN_W,
	handX,
	isPlayable,
} from "./boardMath";
import { CardBack } from "./CardBack";
import { CardStack } from "./CardStack";

export function CurrentZone({
	current,
	hand,
	isViewerPlayer,
	canAct,
	phase,
	selectedHandIndex,
	validTargets,
	pendingHandIndex,
	onHandClick,
	onBoardClick,
	onDragEnd,
	palette,
}: {
	current: GamePlayer;
	hand: GameCard[];
	isViewerPlayer: boolean;
	canAct: boolean;
	phase: string;
	selectedHandIndex: number | null;
	validTargets: Set<string>;
	pendingHandIndex?: number | null;
	onHandClick?: (handIndex: number, card: GameCard) => void;
	onBoardClick?: (boardOwner: string, slot: number) => void;
	onDragEnd?: (handIndex: number, e: KonvaEventObject<DragEvent>) => void;
	palette: Palette;
}) {
	return (
		<>
			{current.board.map((card, slotIndex) => {
				const key = `${current.name}:${slotIndex}`;
				return (
					<CardArt
						// biome-ignore lint/suspicious/noArrayIndexKey: board slot position is the stable, meaningful key
						key={slotIndex}
						x={boardX(slotIndex)}
						y={CUR_BOARD_Y}
						card={card}
						accent={palette.neonPink}
						palette={palette}
						highlight={canAct && validTargets.has(key)}
						onClick={
							canAct ? () => onBoardClick?.(current.name, slotIndex) : undefined
						}
					/>
				);
			})}
			<Text
				x={0}
				y={CUR_NAME_Y}
				width={DESIGN_W}
				align="center"
				text={current.name.toUpperCase()}
				fontSize={16}
				fontFamily="Orbitron, sans-serif"
				letterSpacing={2}
				fill={palette.neonPink}
			/>
			<CardStack
				x={DECK_X}
				y={CUR_DECK_Y}
				width={DECK_W}
				height={DECK_H}
				label="DECK"
				count={current.deck.length}
				palette={palette}
			/>
			{[0, 1, 2, 3, 4].map((slot) => {
				const card = hand[slot];
				if (card && !isViewerPlayer) {
					return (
						<CardBack
							key={slot}
							x={handX(slot)}
							y={CUR_HAND_Y}
							width={CARD_W}
							height={CARD_H}
							palette={palette}
						/>
					);
				}
				const isPending = slot === pendingHandIndex;
				const interactive = canAct && card && isPlayable(phase, card);
				return (
					<CardArt
						key={slot}
						x={handX(slot)}
						y={CUR_HAND_Y}
						card={isPending ? null : (card ?? null)}
						accent={palette.neonPink}
						palette={palette}
						highlight={selectedHandIndex === slot}
						onClick={interactive ? () => onHandClick?.(slot, card) : undefined}
						draggable={interactive}
						onDragEnd={interactive ? (e) => onDragEnd?.(slot, e) : undefined}
					/>
				);
			})}
		</>
	);
}
