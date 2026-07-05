import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { getSkyColor } from './atmosphereTransition';

type AtmosphereSkyProps = {
	blendRef: RefObject<number>;
	dayNightRef: RefObject<number>;
};

/** Kemas kini warna latar scene mengikut blend atmosfera, hemisfera & masa
 * (siang/malam) semasa — setiap Spheral ada watak siang/malam tersendiri
 * (Solar Bloom / Void Tempest / Meridian Hush, dll). Lancar tanpa snap mod. */
export function AtmosphereSky({ blendRef, dayNightRef }: AtmosphereSkyProps) {
	const { scene, camera } = useThree();

	useFrame(() => {
		const hemisphereY = camera.position.y / (camera.position.length() || 1);
		scene.background = getSkyColor(blendRef.current, hemisphereY, dayNightRef.current ?? 0.7);
	});

	return null;
}
