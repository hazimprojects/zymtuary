import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { FAMILY_COLORS, type EntityEntry } from './worldGlobeConfig';

type ResonancePointProps = {
	entity: EntityEntry;
	position: [number, number, number];
	onHover: (entity: EntityEntry | null) => void;
	onSelect: (entity: EntityEntry) => void;
	isHovered: boolean;
};

export function ResonancePoint({
	entity,
	position,
	onHover,
	onSelect,
	isHovered,
}: ResonancePointProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [localHover, setLocalHover] = useState(false);
	const active = isHovered || localHover;
	const color = FAMILY_COLORS[entity.keluarga_aetherys] ?? '#c9a96e';
	const isDormant = entity.keadaan === 'Dormant';

	useFrame(({ clock }) => {
		if (!meshRef.current) return;
		const scale = active ? 1.5 : 1 + Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.15;
		meshRef.current.scale.setScalar(scale * (isDormant ? 0.75 : 1));

		const mat = meshRef.current.material as THREE.MeshStandardMaterial;
		mat.emissiveIntensity = active ? 1.2 : isDormant ? 0.25 : 0.55;
		mat.opacity = active ? 0.95 : isDormant ? 0.35 : 0.65;
	});

	return (
		<mesh
			ref={meshRef}
			position={position}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setLocalHover(true);
				onHover(entity);
				document.body.style.cursor = 'pointer';
			}}
			onPointerOut={() => {
				setLocalHover(false);
				onHover(null);
				document.body.style.cursor = 'default';
			}}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				onSelect(entity);
			}}
		>
			<sphereGeometry args={[0.045, 10, 10]} />
			<meshStandardMaterial
				color={color}
				emissive={color}
				emissiveIntensity={0.5}
				transparent
				opacity={0.65}
				depthWrite={false}
			/>
		</mesh>
	);
}
