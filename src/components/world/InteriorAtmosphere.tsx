import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

const SUN_DIR = new THREE.Vector3(0.35, 0.55, 0.75).normalize();

type InteriorAtmosphereProps = {
	interiorBlendRef: RefObject<number>;
	isMobile?: boolean;
};

/**
 * Matahari + halo + haze langit sahaja — TIADA lagi lapisan awan sfera
 * penuh (dulu di sini) sebab ia menyelubungi SELURUH langit & menghalang
 * pandangan dari atas tidak kira arah. Awan kini kelompok-kelompok tempatan
 * sahaja (lihat TerrainProps.tsx CloudLayer & ObsidianHollowStorm.tsx),
 * sama macam kelompok awan di gunung/pokok — bukan lapisan sejagat.
 */
export function InteriorAtmosphere({ interiorBlendRef }: InteriorAtmosphereProps) {
	const sunRef = useRef<THREE.Group>(null);
	const haloRef = useRef<THREE.Mesh>(null);
	const skyHazeRef = useRef<THREE.Mesh>(null);
	const sunMatRef = useRef<THREE.MeshBasicMaterial>(null);
	const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
	const { camera } = useThree();

	useFrame(() => {
		const blend = interiorBlendRef.current;
		if (blend <= 0.001) return;

		if (sunRef.current) {
			sunRef.current.position.copy(camera.position).addScaledVector(SUN_DIR, 38);
		}

		if (sunMatRef.current) sunMatRef.current.opacity = 0.95 * blend;
		if (haloMatRef.current) haloMatRef.current.opacity = 0.18 * blend;
		if (skyHazeRef.current?.material instanceof THREE.MeshBasicMaterial) {
			skyHazeRef.current.material.opacity = 0.06 * blend;
		}
	});

	return (
		<group>
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
