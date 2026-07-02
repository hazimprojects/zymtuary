import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SPHERAL_COLORS } from './worldGlobeConfig';

type GlobeCoreProps = {
	nama: string;
	moodSingkat: string;
	radius: number;
	onHover: (id: string | null) => void;
	onSelect: (id: string) => void;
	hoveredId: string | null;
};

export function GlobeCore({
	nama,
	moodSingkat,
	radius,
	onHover,
	onSelect,
	hoveredId,
}: GlobeCoreProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [localHover, setLocalHover] = useState(false);
	const color = SPHERAL_COLORS.primisera;
	const isActive = hoveredId === 'primisera' || localHover;

	useFrame(({ clock }) => {
		if (!meshRef.current) return;
		const material = meshRef.current.material as THREE.MeshStandardMaterial;
		const pulse = 0.6 + Math.sin(clock.elapsedTime * 0.7) * 0.15;
		material.emissiveIntensity = isActive ? 1.4 : pulse;
		material.opacity = isActive ? 0.9 : 0.65;
		meshRef.current.scale.setScalar(isActive ? 1.06 : 1 + Math.sin(clock.elapsedTime * 0.5) * 0.02);
	});

	return (
		<mesh
			ref={meshRef}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setLocalHover(true);
				onHover('primisera');
				document.body.style.cursor = 'pointer';
			}}
			onPointerOut={() => {
				setLocalHover(false);
				onHover(null);
				document.body.style.cursor = 'default';
			}}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				onSelect('primisera');
			}}
			aria-label={`${nama} — ${moodSingkat}`}
		>
			<sphereGeometry args={[radius, 24, 24]} />
			<meshStandardMaterial
				color={color}
				emissive={color}
				emissiveIntensity={0.7}
				transparent
				opacity={0.65}
				roughness={1}
				metalness={0}
			/>
		</mesh>
	);
}
