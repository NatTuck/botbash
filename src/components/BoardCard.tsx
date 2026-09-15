import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type { CardEffect, GameCard } from "../../shared/types";
import { CARD_H, CARD_W, GAP } from "../boardLayout";
import { imageForCard, useCardImage } from "../cardImages";
import type { Palette } from "../theme";

export { CARD_H, CARD_W, GAP };

export function effectLabel(effect: CardEffect): string {
	switch (effect.kind) {
		case "damage":
			return `Damage ${effect.amount}`;
		case "destroy":
			return "Destroy a bot";
		case "repair":
			return `Repair ${effect.amount}`;

		case "stun":
			return "Stun for one combat";
	}
}

export function CardArt({
	x,
	y,
	card,
	accent,
	palette,
	onClick,
	highlight,
	draggable,
	onDragEnd,
}: {
	x: number;
	y: number;
	card: GameCard | null;
	accent: string;
	palette: Palette;
	onClick?: () => void;
	highlight?: boolean;
	draggable?: boolean;
	onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
}) {
	const image = card ? imageForCard(card.name) : undefined;
	const img = useCardImage(image);
	const stroke = highlight ? palette.ember : accent;
	const strokeWidth = highlight ? 3 : 2;

	const frame = (content: React.ReactNode) => (
		<Group
			x={x}
			y={y}
			draggable={draggable}
			dragDistance={draggable ? 8 : undefined}
			onDragEnd={onDragEnd}
		>
			{content}
			{/* Dedicated transparent hit target so clicks register reliably
			    regardless of the card's image/text children. */}
			<Rect
				width={CARD_W}
				height={CARD_H}
				fill="rgba(0,0,0,0.001)"
				onClick={onClick}
				onTap={onClick}
				listening={Boolean(onClick)}
			/>
		</Group>
	);

	if (!card) {
		return frame(
			<>
				<Rect
					width={CARD_W}
					height={CARD_H}
					cornerRadius={8}
					fill={palette.panel}
					stroke={stroke}
					strokeWidth={1}
					dash={[6, 5]}
				/>
				<Text
					x={0}
					y={60}
					width={CARD_W}
					align="center"
					text="empty"
					fontSize={13}
					fill={palette.muted}
				/>
			</>,
		);
	}

	return frame(
		<>
			<Rect
				width={CARD_W}
				height={CARD_H}
				cornerRadius={8}
				fill={palette.panel}
				stroke={stroke}
				strokeWidth={strokeWidth}
			/>
			{img && (
				<KonvaImage
					image={img}
					width={CARD_W}
					height={CARD_H}
					cornerRadius={8}
				/>
			)}
			<Rect y={0} width={CARD_W} height={30} fill="rgba(0,0,0,0.55)" />
			<Text
				x={6}
				y={8}
				width={CARD_W - 12}
				align="center"
				text={card.name}
				fontSize={11}
				fontStyle="bold"
				fill={palette.glow}
			/>
			<Rect
				y={CARD_H - 38}
				width={CARD_W}
				height={38}
				fill="rgba(0,0,0,0.55)"
			/>
			{card.type === "bot" ? (
				<>
					<Text
						x={8}
						y={CARD_H - 30}
						text={`ATK ${card.atk}`}
						fontSize={12}
						fill={palette.neonCyan}
					/>
					<Text
						x={0}
						y={CARD_H - 32}
						width={CARD_W - 8}
						align="right"
						text={`${card.hp.current}/${card.hp.max}`}
						fontSize={15}
						fontFamily="Orbitron, sans-serif"
						fill={palette.rust}
					/>
				</>
			) : (
				<Text
					x={0}
					y={CARD_H - 30}
					width={CARD_W}
					align="center"
					text={card.effect ? effectLabel(card.effect) : ""}
					fontSize={13}
					fill={palette.neonCyan}
				/>
			)}
		</>,
	);
}
