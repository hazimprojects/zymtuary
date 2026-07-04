import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { getSkyColor } from './atmosphereTransition';

type AtmosphereSkyProps = {
	blendRef: RefObject<number>;
};

/** Kemas kini warna latar scene mengikut blend atmosfera — lancar tanpa snap mod */
export function AtmosphereSky({ blendRef }: AtmosphereSkyProps) {
	const { scene } = useThree();

	useFrame(() => {
		scene.background = getSkyColor(blendRef.current);
	});

	return null;
}
