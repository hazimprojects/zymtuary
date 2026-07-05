import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

type AtmosphereVeilProps = {
	intensity?: number;
};

/** Halimunan lembut di tepi globe — satu lapisan sahaja, tanpa putaran */
export function AtmosphereVeil({ intensity = 0.025 }: AtmosphereVeilProps) {
	const matRef = useRef<THREE.MeshBasicMaterial>(null);

	useFrame(() => {
		if (matRef.current) matRef.current.opacity = intensity;
	});

	return (
		<mesh renderOrder={4}>
			<sphereGeometry args={[GLOBE_RADIUS * 1.24, 32, 32]} />
			<meshBasicMaterial
				ref={matRef}
				color="#a8c4d8"
				transparent
				opacity={intensity}
				side={THREE.BackSide}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
			/>
		</mesh>
	);
}
