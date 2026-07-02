import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLOBE_RADIUS } from './worldGlobeConfig';
import { createGlobeMaterial } from './globeShader';

type GlobeSurfaceProps = {
	segments: number;
};

/** Selubung Equilara — atmosfera keseluruhan, bukan zon klik */
export function GlobeSurface({ segments }: GlobeSurfaceProps) {
	const material = useMemo(() => createGlobeMaterial(), []);

	useFrame(({ clock }) => {
		material.uniforms.uTime.value = clock.elapsedTime;
	});

	return (
		<mesh>
			<sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
			<primitive object={material} attach="material" />
		</mesh>
	);
}
