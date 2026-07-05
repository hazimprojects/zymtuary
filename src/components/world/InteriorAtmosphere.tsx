import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';
import { createInteriorCloudMaterial } from './interiorAtmosphereShader';

const SUN_DIR = new THREE.Vector3(0.35, 0.55, 0.75).normalize();

type InteriorAtmosphereProps = {
	interiorBlendRef: RefObject<number>;
	isMobile?: boolean;
};

export function InteriorAtmosphere({ interiorBlendRef, isMobile = false }: InteriorAtmosphereProps) {
	const sunRef = useRef<THREE.Group>(null);
	const haloRef = useRef<THREE.Mesh>(null);
	const skyHazeRef = useRef<THREE.Mesh>(null);
	const sunMatRef = useRef<THREE.MeshBasicMaterial>(null);
	const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
	const { camera } = useThree();

	const baseOpacities = useMemo(
		() => (isMobile ? [0.5, 0.3] : [0.55, 0.38, 0.22]),
		[isMobile],
	);

	const cloudMaterials = useMemo(
		() => baseOpacities.map((o) => createInteriorCloudMaterial(o)),
		[baseOpacities],
	);

	// Awan kekal pada beberapa tingkat rendah — atmosfera (skyHaze di bawah)
	// diletak JAUH lebih tinggi drpd tingkat awan tertinggi, supaya ada ruang
	// udara lapang antara awan & tepi atmosfera, bukan berhimpit rapat.
	const shellRadii = useMemo(
		() =>
			isMobile
				? [GLOBE_RADIUS + 0.2, GLOBE_RADIUS + 0.5]
				: [GLOBE_RADIUS + 0.15, GLOBE_RADIUS + 0.35, GLOBE_RADIUS + 0.6],
		[isMobile],
	);

	const shellSegments = isMobile ? 22 : 48;

	useFrame(({ clock }) => {
		const blend = interiorBlendRef.current;
		if (blend <= 0.001) return;

		if (sunRef.current) {
			sunRef.current.position.copy(camera.position).addScaledVector(SUN_DIR, 38);
		}

		for (let i = 0; i < cloudMaterials.length; i++) {
			const mat = cloudMaterials[i];
			mat.uniforms.uTime.value = clock.elapsedTime;
			mat.uniforms.uOpacity.value = baseOpacities[i] * blend;
		}

		if (sunMatRef.current) sunMatRef.current.opacity = 0.95 * blend;
		if (haloMatRef.current) haloMatRef.current.opacity = 0.18 * blend;
		if (skyHazeRef.current?.material instanceof THREE.MeshBasicMaterial) {
			skyHazeRef.current.material.opacity = 0.06 * blend;
		}
	});

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
					<meshBasicMaterial
						ref={sunMatRef}
						color="#fff6dc"
						transparent
						opacity={0}
						depthWrite={false}
					/>
				</mesh>
				<mesh ref={haloRef}>
					<sphereGeometry args={[3.2, 16, 16]} />
					<meshBasicMaterial
						ref={haloMatRef}
						color="#ffd080"
						transparent
						opacity={0}
						depthWrite={false}
						blending={THREE.AdditiveBlending}
					/>
				</mesh>
			</group>

			<mesh ref={skyHazeRef} renderOrder={5}>
				<sphereGeometry args={[GLOBE_RADIUS + 1.6, 32, 32]} />
				<meshBasicMaterial
					color="#b8d4f0"
					transparent
					opacity={0}
					side={THREE.BackSide}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
		</group>
	);
}
