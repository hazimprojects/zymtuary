import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';
import { createGlobeMaterial } from './globeShader';
import { pickZone } from './pickZone';
import { SPHERAL_COLORS } from './worldGlobeConfig';

type GlobeSurfaceProps = {
	onHover: (id: string | null) => void;
	onSelect: (id: string) => void;
	hoveredId: string | null;
	segments: number;
};

export function GlobeSurface({ onHover, onSelect, hoveredId, segments }: GlobeSurfaceProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const material = useMemo(() => createGlobeMaterial(), []);
	const hoverColor = useRef(new THREE.Vector3());

	useFrame(({ clock }) => {
		material.uniforms.uTime.value = clock.elapsedTime;

		if (hoveredId && SPHERAL_COLORS[hoveredId]) {
			const c = new THREE.Color(SPHERAL_COLORS[hoveredId]);
			hoverColor.current.set(c.r, c.g, c.b);
			material.uniforms.uHoverColor.value.copy(hoverColor.current);
			material.uniforms.uHoverActive.value = THREE.MathUtils.lerp(
				material.uniforms.uHoverActive.value,
				1,
				0.12,
			);
		} else {
			material.uniforms.uHoverActive.value = THREE.MathUtils.lerp(
				material.uniforms.uHoverActive.value,
				0,
				0.12,
			);
		}
	});

	const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		const n = e.object.worldToLocal(e.point.clone()).normalize();
		const zone = pickZone(n.x, n.y, n.z);
		onHover(zone);
		if (zone) document.body.style.cursor = 'pointer';
	};

	const handlePointerOut = () => {
		onHover(null);
		document.body.style.cursor = 'default';
	};

	const handleClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		const n = e.object.worldToLocal(e.point.clone()).normalize();
		const zone = pickZone(n.x, n.y, n.z);
		if (zone) onSelect(zone);
	};

	const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		const n = e.object.worldToLocal(e.point.clone()).normalize();
		const zone = pickZone(n.x, n.y, n.z);
		if (zone) onHover(zone);
	};

	return (
		<mesh
			ref={meshRef}
			onPointerMove={handlePointerMove}
			onPointerDown={handlePointerDown}
			onPointerOut={handlePointerOut}
			onClick={handleClick}
		>
			<sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
			<primitive object={material} attach="material" />
		</mesh>
	);
}
