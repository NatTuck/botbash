import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { CARD_BACK, useCardImage } from "../cardImages";
import type { Palette } from "../theme";

/** A stack of card backs for the draw deck / scrap pile, with a label + count. */
export function CardStack({
	x,
	y,
	width,
	height,
	label,
	count,
	palette,
}: {
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	count: number;
	palette: Palette;
}) {
	const img = useCardImage(CARD_BACK);

	return (
		<Group x={x} y={y}>
			{img &&
				[0, 1, 2].map((i) => (
					<KonvaImage
						key={i}
						image={img}
						x={i * 4}
						y={i * 4}
						width={width}
						height={height}
						cornerRadius={6}
					/>
				))}
			{img && (
				<Rect
					width={width}
					height={height}
					cornerRadius={6}
					stroke={palette.muted}
					strokeWidth={1}
				/>
			)}
			<Text
				x={-12}
				y={height + 10}
				width={width + 24}
				align="center"
				text={`${label} · ${count}`}
				fontSize={11}
				letterSpacing={1}
				fill={palette.muted}
			/>
		</Group>
	);
}
