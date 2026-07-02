import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';
import { createInteriorCloudMaterial } from './interiorAtmosphereShader';

const SUN_DIR = new THREE.Vector3(0.35, 0.55, 0.75).normalize();

type InteriorAtmosphereProps = {
	active: boolean;
	isMobile?: boolean;
};

export function InteriorAtmosphere({ active, isMobile = false }: InteriorAtmosphereProps) {
	const sunRef = useRef<THREE.Group>(null);
	const haloRef = useRef<THREE.Mesh>(null);
	const { camera } = useThree();

	// Shell awan bertindih dengan shader noise yang mahal boleh menjunam kadar
	// bingkai di GPU mobile — kurangkan bilangan shell, resolusi, dan kos shader.
	const cloudMaterials = useMemo(
		() =>
			isMobile
				? [createInteriorCloudMaterial(0.5, 'low'), createInteriorCloudMaterial(0.3, 'low')]
				: [
						createInteriorCloudMaterial(0.55),
						createInteriorCloudMaterial(0.38),
						createInteriorCloudMaterial(0.22),
					],
		[isMobile],
	);

	const shellRadii = useMemo(
		() =>
			isMobile
				? [GLOBE_RADIUS + 0.16, GLOBE_RADIUS + 0.4]
				: [GLOBE_RADIUS + 0.12, GLOBE_RADIUS + 0.28, GLOBE_RADIUS + 0.48],
		[isMobile],
	);

	const shellSegments = isMobile ? 22 : 48;

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
					<sphereGeometry args={[radius, shellSegments, shellSegments]} />
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
