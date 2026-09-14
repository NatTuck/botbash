import { Group, Image as KonvaImage, Rect } from "react-konva";
import { CARD_BACK, useCardImage } from "../cardImages";
import type { Palette } from "../theme";

/** A card back rendered from the card-back image, sized to fit. */
export function CardBack({
	x,
	y,
	width,
	height,
	palette,
}: {
	x: number;
	y: number;
	width: number;
	height: number;
	palette: Palette;
}) {
	const img = useCardImage(CARD_BACK);

	return (
		<Group x={x} y={y}>
			{img && (
				<KonvaImage
					image={img}
					width={width}
					height={height}
					cornerRadius={6}
				/>
			)}
			<Rect
				width={width}
				height={height}
				cornerRadius={6}
				stroke={palette.muted}
				strokeWidth={1}
			/>
		</Group>
	);
}
