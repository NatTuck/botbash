import { useEffect, useState } from "react";

export const CARD_BACK = "/images/card_back.jpg";

const MAP: Record<string, string> = {
	"Robot Duck": "/images/robot_duck.jpg",
	"Light Repair": "/images/light_repair.jpg",
    "Breadson": "/images/breadson.png",
	"Zap": "/images/zap.jpg",
	"MS Paint Duck": "MS Paint Duck.png",
};

/** Maps a card name to its image URL, if one exists. */
export function imageForCard(name: string): string | undefined {
	for (const prefix of Object.keys(MAP)) {
		if (name.startsWith(prefix)) return MAP[prefix];
	}
	return undefined;
}

/** Shared image cache so cards don't each trigger an async re-render on load. */
const cache = new Map<string, HTMLImageElement>();

/** Loads an image for use as a Konva `Image` source (cached). */
export function useCardImage(src: string | undefined) {
	const [img, setImg] = useState<HTMLImageElement | undefined>(
		src ? cache.get(src) : undefined,
	);

	useEffect(() => {
		if (!src) {
			setImg(undefined);
			return;
		}
		const cached = cache.get(src);
		if (cached) {
			setImg(cached);
			return;
		}
		const el = new window.Image();
		el.onload = () => {
			cache.set(src, el);
			setImg(el);
		};
		el.src = src;
		return () => {
			el.onload = null;
		};
	}, [src]);

	return img;
}
