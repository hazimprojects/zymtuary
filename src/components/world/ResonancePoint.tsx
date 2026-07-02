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
	isMobile: boolean;
};

export function ResonancePoint({
	entity,
	position,
	onHover,
	onSelect,
	isHovered,
	isMobile,
}: ResonancePointProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const hitRef = useRef<THREE.Mesh>(null);
	const [localHover, setLocalHover] = useState(false);
	const active = isHovered || localHover;
	const color = FAMILY_COLORS[entity.keluarga_aetherys] ?? '#c9a96e';
	const isDormant = entity.keadaan === 'Dormant';
	const hitSize = isMobile ? 0.14 : 0.09;
	const visualSize = isMobile ? 0.055 : 0.045;

	useFrame(({ clock }) => {
		if (!meshRef.current) return;
		const scale = active ? 1.4 : 1 + Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.12;
		meshRef.current.scale.setScalar(scale * (isDormant ? 0.8 : 1));

		const mat = meshRef.current.material as THREE.MeshStandardMaterial;
		mat.emissiveIntensity = active ? 1.4 : isDormant ? 0.35 : 0.7;
		mat.opacity = active ? 1 : isDormant ? 0.5 : 0.8;
	});

	const handleSelect = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		onSelect(entity);
	};

	return (
		<group position={position}>
			{/* Kawasan sentuh lebih besar untuk mobile */}
			<mesh
				ref={hitRef}
				onPointerOver={(e: ThreeEvent<PointerEvent>) => {
					e.stopPropagation();
					setLocalHover(true);
					onHover(entity);
				}}
				onPointerOut={() => {
					setLocalHover(false);
					onHover(null);
				}}
				onPointerDown={handleSelect}
				onClick={handleSelect}
			>
				<sphereGeometry args={[hitSize, 8, 8]} />
				<meshBasicMaterial transparent opacity={0} depthWrite={false} />
			</mesh>

			{/* Cahaya visual */}
			<mesh ref={meshRef}>
				<sphereGeometry args={[visualSize, 10, 10]} />
				<meshStandardMaterial
					color={color}
					emissive={color}
					emissiveIntensity={0.6}
					transparent
					opacity={0.75}
					depthWrite={false}
				/>
			</mesh>

			{/* Halo */}
			<mesh scale={active ? 2.2 : 1.8}>
				<sphereGeometry args={[visualSize, 8, 8]} />
				<meshBasicMaterial color={color} transparent opacity={active ? 0.18 : 0.08} depthWrite={false} />
			</mesh>
		</group>
	);
}
