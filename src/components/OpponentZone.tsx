import { Rect, Text } from "react-konva";
import type { GameCard, GamePlayer } from "../../shared/types";
import type { Palette } from "../theme";
import { CardArt } from "./BoardCard";
import {
	BACK_H,
	BACK_W,
	backsX,
	boardX,
	DECK_H,
	DECK_W,
	DECK_X,
	DESIGN_W,
	OPP_BOARD_Y,
	OPP_DECK_Y,
	OPP_HAND_Y,
	OPP_NAME_Y,
} from "./boardMath";
import { CardBack } from "./CardBack";
import { CardStack } from "./CardStack";

export function OpponentZone({
	opponent,
	hand,
	canAct,
	validTargets,
	onBoardClick,
	palette,
}: {
	opponent: GamePlayer | null;
	hand: GameCard[];
	canAct: boolean;
	validTargets: Set<string>;
	onBoardClick?: (boardOwner: string, slot: number) => void;
	palette: Palette;
}) {
	return (
		<>
			<Text
				x={0}
				y={OPP_NAME_Y}
				width={DESIGN_W}
				align="center"
				text={opponent ? opponent.name.toUpperCase() : "WAITING FOR OPPONENT"}
				fontSize={16}
				fontFamily="Orbitron, sans-serif"
				letterSpacing={2}
				fill={palette.neonCyan}
			/>
			{opponent && (
				<CardStack
					x={DECK_X}
					y={OPP_DECK_Y}
					width={DECK_W}
					height={DECK_H}
					label="DECK"
					count={opponent.deck.length}
					palette={palette}
				/>
			)}
			{[0, 1, 2, 3, 4].map((slot) => {
				const card = hand[slot];
				return card ? (
					<CardBack
						key={slot}
						x={backsX(slot)}
						y={OPP_HAND_Y}
						width={BACK_W}
						height={BACK_H}
						palette={palette}
					/>
				) : (
					<Rect
						key={slot}
						x={backsX(slot)}
						y={OPP_HAND_Y}
						width={BACK_W}
						height={BACK_H}
						cornerRadius={6}
						fill={palette.panelDeep}
						stroke={palette.muted}
						strokeWidth={1}
						dash={[4, 4]}
					/>
				);
			})}
			{[0, 1, 2].map((pos) => {
				const slotIndex = 2 - pos;
				const key = `${opponent?.name}:${slotIndex}`;
				return (
					<CardArt
						key={slotIndex}
						x={boardX(pos)}
						y={OPP_BOARD_Y}
						card={opponent?.board[slotIndex] ?? null}
						accent={palette.neonCyan}
						palette={palette}
						highlight={canAct && validTargets.has(key)}
						onClick={
							canAct && opponent
								? () => onBoardClick?.(opponent.name, slotIndex)
								: undefined
						}
					/>
				);
			})}
		</>
	);
}
