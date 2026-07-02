import { forwardRef, useImperativeHandle, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, getProximity, type EntityEntry, type ResonancePlacement } from './worldGlobeConfig';
import { createEntityGlowUniforms, updateEntityGlowUniforms } from './entityGlowUniforms';
import { createGlobeMaterial } from './globeShader';
import { pickNearestEntity, setHoverGlow } from './pickNearestEntity';

type GlobeSurfaceProps = {
	segments: number;
	placements: ResonancePlacement[];
	onHover: (entity: EntityEntry | null) => void;
	onSelect: (entity: EntityEntry) => void;
	hoveredEntity: EntityEntry | null;
	interactionPaused: boolean;
	forceProximity?: number;
};

export type GlobeSurfaceHandle = THREE.Mesh;

export const GlobeSurface = forwardRef<GlobeSurfaceHandle, GlobeSurfaceProps>(
	function GlobeSurface(
		{ segments, placements, onHover, onSelect, hoveredEntity, interactionPaused, forceProximity },
		ref,
	) {
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

		useEffect(() => {
			updateEntityGlowUniforms(glowUniforms, placements);
		}, [glowUniforms, placements]);

		useFrame(({ clock }) => {
			material.uniforms.uTime.value = clock.elapsedTime;
			material.uniforms.uProximity.value =
				forceProximity ?? getProximity(camera.position.length());

			const hovered = placements.find((p) => p.entity.id === hoveredEntity?.id);
			setHoverGlow(material, hovered?.direction ?? null, hovered ? 1 : 0);
		});

		const hitNormal = (e: ThreeEvent<PointerEvent>) => {
			const n = e.object.worldToLocal(e.point.clone()).normalize();
			return pickNearestEntity(n.x, n.y, n.z, placements, 0.88);
		};

		const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
			if (interactionPaused) return;
			e.stopPropagation();
			const entity = hitNormal(e);
			onHover(entity);
			document.body.style.cursor = entity ? 'pointer' : 'default';
		};

		const handlePointerOut = () => {
			onHover(null);
			document.body.style.cursor = 'default';
		};

		const handleClick = (e: ThreeEvent<MouseEvent>) => {
			if (interactionPaused) return;
			e.stopPropagation();
			const entity = hitNormal(e);
			if (entity) onSelect(entity);
		};

		return (
			<group>
				<mesh renderOrder={0}>
					<sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
					<meshBasicMaterial color="#061018" depthWrite depthTest />
				</mesh>

				<mesh
					ref={meshRef}
					renderOrder={1}
					onPointerMove={handlePointerMove}
					onPointerOut={handlePointerOut}
					onClick={handleClick}
				>
					<sphereGeometry args={[GLOBE_RADIUS * 1.001, segments, segments]} />
					<primitive object={material} attach="material" />
				</mesh>
			</group>
		);
	},
);
