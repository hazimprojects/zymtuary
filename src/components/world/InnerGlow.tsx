import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FAMILY_COLORS, INNER_GLOW_RADIUS, type ResonancePlacement } from './worldGlobeConfig';

type InnerGlowProps = {
	placement: ResonancePlacement;
	isHovered: boolean;
	dimmed: boolean;
};

const _worldPos = new THREE.Vector3();
const _center = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _toCamera = new THREE.Vector3();

/** Cahaya dari dalam — bukan pin di permukaan */
export function InnerGlow({ placement, isHovered, dimmed }: InnerGlowProps) {
	const groupRef = useRef<THREE.Group>(null);
	const outerRef = useRef<THREE.Mesh>(null);
	const midRef = useRef<THREE.Mesh>(null);
	const coreRef = useRef<THREE.Mesh>(null);

	const { entity, direction } = placement;
	const color = FAMILY_COLORS[entity.keluarga_aetherys] ?? '#c9a96e';
	const isDormant = entity.keadaan === 'Dormant';

	const innerPos = useMemo((): [number, number, number] => {
		return [
			direction[0] * INNER_GLOW_RADIUS,
			direction[1] * INNER_GLOW_RADIUS,
			direction[2] * INNER_GLOW_RADIUS,
		];
	}, [direction]);

	useFrame(({ camera, clock }) => {
		if (!groupRef.current || !outerRef.current || !midRef.current || !coreRef.current) return;

		groupRef.current.getWorldPosition(_worldPos);
		groupRef.current.parent?.getWorldPosition(_center);
		_normal.copy(_worldPos).sub(_center).normalize();
		_toCamera.copy(camera.position).sub(_worldPos).normalize();
		const facing = _normal.dot(_toCamera) > 0.05;
		const show = facing && !dimmed;

		groupRef.current.visible = show;
		if (!show) return;

		const base = isDormant ? 0.45 : 1;
		const active = isHovered ? 1.35 : 1;
		const pulse = 0.88 + Math.sin(clock.elapsedTime * 0.85 + direction[0] * 3) * 0.12;
		const s = base * active * pulse;

		outerRef.current.scale.setScalar(s * 2.8);
		midRef.current.scale.setScalar(s * 1.4);
		coreRef.current.scale.setScalar(s * 0.5);

		const outerOp = (isHovered ? 0.06 : 0.035) * base;
		const midOp = (isHovered ? 0.12 : 0.07) * base;
		const coreOp = (isHovered ? 0.55 : 0.35) * base;

		(outerRef.current.material as THREE.MeshBasicMaterial).opacity = outerOp;
		(midRef.current.material as THREE.MeshBasicMaterial).opacity = midOp;
		(coreRef.current.material as THREE.MeshBasicMaterial).opacity = coreOp;
	});

	return (
		<group ref={groupRef} position={innerPos}>
			<mesh ref={outerRef} raycast={() => null} renderOrder={2}>
				<sphereGeometry args={[0.14, 12, 12]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.04}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
			<mesh ref={midRef} raycast={() => null} renderOrder={2}>
				<sphereGeometry args={[0.08, 10, 10]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.08}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
			<mesh ref={coreRef} raycast={() => null} renderOrder={2}>
				<sphereGeometry args={[0.035, 8, 8]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.4}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
		</group>
	);
}
