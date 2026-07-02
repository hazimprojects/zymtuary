import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SPHERAL_COLORS } from './worldGlobeConfig';

type GlobeZoneProps = {
	id: string;
	nama: string;
	moodSingkat: string;
	phiStart: number;
	phiLength: number;
	thetaStart: number;
	thetaLength: number;
	radius: number;
	lift?: number;
	onHover: (id: string | null) => void;
	onSelect: (id: string) => void;
	hoveredId: string | null;
};

export function GlobeZone({
	id,
	nama,
	moodSingkat,
	phiStart,
	phiLength,
	thetaStart,
	thetaLength,
	radius,
	lift = 0,
	onHover,
	onSelect,
	hoveredId,
}: GlobeZoneProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [localHover, setLocalHover] = useState(false);
	const color = SPHERAL_COLORS[id] ?? '#888888';
	const isActive = hoveredId === id || localHover;

	useFrame(({ clock }) => {
		if (!meshRef.current) return;
		const material = meshRef.current.material as THREE.MeshStandardMaterial;
		const pulse = 0.5 + Math.sin(clock.elapsedTime * 1.2 + phiStart) * 0.08;
		material.emissiveIntensity = isActive ? 1.1 : pulse * 0.55;
		material.opacity = isActive ? 0.72 : 0.38;
	});

	const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		setLocalHover(true);
		onHover(id);
		document.body.style.cursor = 'pointer';
	};

	const handlePointerOut = () => {
		setLocalHover(false);
		onHover(null);
		document.body.style.cursor = 'default';
	};

	const handleClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		onSelect(id);
	};

	return (
		<mesh
			ref={meshRef}
			onPointerOver={handlePointerOver}
			onPointerOut={handlePointerOut}
			onClick={handleClick}
			aria-label={`${nama} — ${moodSingkat}`}
		>
			<sphereGeometry
				args={[radius + lift, 32, 24, thetaStart, thetaLength, phiStart, phiLength]}
			/>
			<meshStandardMaterial
				color={color}
				emissive={color}
				emissiveIntensity={0.5}
				transparent
				opacity={0.38}
				roughness={0.85}
				metalness={0.1}
				side={THREE.DoubleSide}
				depthWrite={false}
			/>
		</mesh>
	);
}
