import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

/** Selubung kabut Equilara — rasa organik, bukan planet app */
export function AtmosphereVeil() {
	const ref = useRef<THREE.Mesh>(null);

	useFrame(({ clock }) => {
		if (!ref.current) return;
		ref.current.rotation.y = clock.elapsedTime * 0.015;
		ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.08) * 0.04;
	});

	return (
		<mesh ref={ref} renderOrder={3}>
			<sphereGeometry args={[GLOBE_RADIUS * 1.22, 48, 48]} />
			<meshBasicMaterial
				color="#9a8f7a"
				transparent
				opacity={0.045}
				side={THREE.BackSide}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
			/>
		</mesh>
	);
}
