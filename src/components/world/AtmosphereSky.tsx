import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { getSkyColor } from './atmosphereTransition';

type AtmosphereSkyProps = {
	blendRef: RefObject<number>;
};

/** Kemas kini warna latar scene mengikut blend atmosfera & hemisfera semasa
 * (Luminara cerah/hangat, Noctira redup/sejuk, Equilara neutral) — lancar
 * tanpa snap mod */
export function AtmosphereSky({ blendRef }: AtmosphereSkyProps) {
	const { scene, camera } = useThree();

	useFrame(() => {
		const hemisphereY = camera.position.y / (camera.position.length() || 1);
		scene.background = getSkyColor(blendRef.current, hemisphereY);
	});

	return null;
}
