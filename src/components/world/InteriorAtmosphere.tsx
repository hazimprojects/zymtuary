import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';
import { createInteriorCloudMaterial } from './interiorAtmosphereShader';

const SUN_DIR = new THREE.Vector3(0.35, 0.55, 0.75).normalize();

type InteriorAtmosphereProps = {
	active: boolean;
};

export function InteriorAtmosphere({ active }: InteriorAtmosphereProps) {
	const sunRef = useRef<THREE.Group>(null);
	const haloRef = useRef<THREE.Mesh>(null);
	const { camera } = useThree();

	const cloudMaterials = useMemo(
		() => [
			createInteriorCloudMaterial(0.55),
			createInteriorCloudMaterial(0.38),
			createInteriorCloudMaterial(0.22),
		],
		[],
	);

	const shellRadii = useMemo(
		() => [GLOBE_RADIUS + 0.12, GLOBE_RADIUS + 0.28, GLOBE_RADIUS + 0.48],
		[],
	);

	useFrame(({ clock }) => {
		if (!active) return;

		if (sunRef.current) {
			sunRef.current.position.copy(camera.position).addScaledVector(SUN_DIR, 38);
		}

		for (const mat of cloudMaterials) {
			mat.uniforms.uTime.value = clock.elapsedTime;
		}
	});

	if (!active) return null;

	return (
		<group>
			{shellRadii.map((radius, i) => (
				<mesh key={radius} renderOrder={10 + i}>
					<sphereGeometry args={[radius, 48, 48]} />
					<primitive object={cloudMaterials[i]} attach="material" />
				</mesh>
			))}

			<group ref={sunRef} renderOrder={20}>
				<mesh>
					<sphereGeometry args={[1.8, 24, 24]} />
					<meshBasicMaterial color="#fff6dc" transparent opacity={0.95} depthWrite={false} />
				</mesh>
				<mesh ref={haloRef}>
					<sphereGeometry args={[3.2, 16, 16]} />
					<meshBasicMaterial
						color="#ffd080"
						transparent
						opacity={0.18}
						depthWrite={false}
						blending={THREE.AdditiveBlending}
					/>
				</mesh>
			</group>

			<mesh renderOrder={5}>
				<sphereGeometry args={[GLOBE_RADIUS + 0.62, 32, 32]} />
				<meshBasicMaterial
					color="#b8d4f0"
					transparent
					opacity={0.06}
					side={THREE.BackSide}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
		</group>
	);
}
