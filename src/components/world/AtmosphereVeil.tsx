import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

type AtmosphereVeilProps = {
	intensity?: number;
};

/** Selubung kabut Equilara — lebih kuat apabila masuk atmosfera */
export function AtmosphereVeil({ intensity = 0.025 }: AtmosphereVeilProps) {
	const ref = useRef<THREE.Mesh>(null);

	useFrame(({ clock }) => {
		if (!ref.current) return;
		ref.current.rotation.y = clock.elapsedTime * 0.015;
		ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.08) * 0.04;
	});

	return (
		<mesh ref={ref} renderOrder={4}>
			<sphereGeometry args={[GLOBE_RADIUS * 1.18, 40, 40]} />
			<meshBasicMaterial
				color="#c4b89a"
				transparent
				opacity={intensity}
				side={THREE.BackSide}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
			/>
		</mesh>
	);
}
