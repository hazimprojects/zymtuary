import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';
import { createGlobeMaterial } from './globeShader';

type GlobeSurfaceProps = {
	segments: number;
};

export type GlobeSurfaceHandle = THREE.Mesh;

/** Selubung Equilara — permukaan opaque, teras pepejal di dalam */
export const GlobeSurface = forwardRef<GlobeSurfaceHandle, GlobeSurfaceProps>(
	function GlobeSurface({ segments }, ref) {
		const meshRef = useRef<THREE.Mesh>(null);
		const material = useMemo(() => {
			const mat = createGlobeMaterial();
			mat.depthWrite = true;
			mat.depthTest = true;
			mat.side = THREE.FrontSide;
			return mat;
		}, []);

		useImperativeHandle(ref, () => meshRef.current as THREE.Mesh);

		useFrame(({ clock }) => {
			material.uniforms.uTime.value = clock.elapsedTime;
		});

		return (
			<group>
				{/* Teras pepejal — elak tembus pandang */}
				<mesh renderOrder={0}>
					<sphereGeometry args={[GLOBE_RADIUS * 0.992, segments, segments]} />
					<meshBasicMaterial color="#061018" depthWrite depthTest />
				</mesh>

				{/* Permukaan terrain */}
				<mesh ref={meshRef} renderOrder={1}>
					<sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
					<primitive object={material} attach="material" />
				</mesh>
			</group>
		);
	},
);
