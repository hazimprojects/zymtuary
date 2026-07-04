import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, getProximity } from './worldGlobeConfig';
import { createEntityGlowUniforms } from './entityGlowUniforms';
import { createGlobeMaterial } from './globeShader';

type GlobeSurfaceProps = {
	segments: number;
	interactionPaused: boolean;
	/** Override proximity shader — ikut blend atmosfera berterusan */
	proximityOverride?: number;
};

export type GlobeSurfaceHandle = THREE.Mesh;

export const GlobeSurface = forwardRef<GlobeSurfaceHandle, GlobeSurfaceProps>(
	function GlobeSurface({ segments, proximityOverride }, ref) {
		const meshRef = useRef<THREE.Mesh>(null);
		const { camera } = useThree();
		const glowUniforms = useMemo(() => createEntityGlowUniforms(), []);
		const material = useMemo(() => {
			const mat = createGlobeMaterial(glowUniforms);
			mat.depthWrite = true;
			mat.depthTest = true;
			mat.side = THREE.FrontSide;
			return mat;
		}, [glowUniforms]);

		useImperativeHandle(ref, () => meshRef.current as THREE.Mesh);

		useFrame(({ clock }) => {
			material.uniforms.uTime.value = clock.elapsedTime;
			material.uniforms.uProximity.value =
				proximityOverride ?? getProximity(camera.position.length());
		});

		return (
			<group>
				<mesh renderOrder={0}>
					<sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
					<meshBasicMaterial color="#061018" depthWrite depthTest />
				</mesh>

				<mesh ref={meshRef} renderOrder={1}>
					<sphereGeometry args={[GLOBE_RADIUS * 1.001, segments, segments]} />
					<primitive object={material} attach="material" />
				</mesh>
			</group>
		);
	},
);
