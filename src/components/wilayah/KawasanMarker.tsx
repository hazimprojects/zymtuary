import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { KawasanAnchor } from './wilayahTerrain';

export function KawasanMarker({
	anchor,
	active,
	onSelect,
	bobOffset,
}: {
	anchor: KawasanAnchor;
	active: boolean;
	onSelect: () => void;
	bobOffset: number;
}) {
	const groupRef = useRef<THREE.Group>(null);

	useFrame(({ clock }) => {
		if (!groupRef.current) return;
		const t = clock.getElapsedTime();
		groupRef.current.position.y = Math.sin(t * 0.8 + bobOffset) * 0.06 + (active ? 0.18 : 0);
	});

	return (
		<group position={anchor.position}>
			<group ref={groupRef}>
				<mesh
					castShadow={false}
					onClick={(e) => {
						e.stopPropagation();
						onSelect();
					}}
					scale={active ? 1.15 : 1}
				>
					<coneGeometry args={[0.36, 1.05, 5, 1]} />
					<meshStandardMaterial
						color={anchor.color}
						flatShading
						roughness={0.55}
						metalness={0.05}
						emissive={anchor.color}
						emissiveIntensity={active ? 0.45 : 0.18}
					/>
				</mesh>
			</group>
			{/* Label sengaja di luar kumpulan yang "bob" — kalau label ikut sekali
			 * bergoyang, elemen DOM (Html) jadi tak stabil untuk sentuhan/klik. */}
			<Html center distanceFactor={9} position={[0, 1.15, 0]} occlude={false}>
				<button
					type="button"
					onClick={onSelect}
					className="pointer-events-auto whitespace-nowrap font-body text-[0.6rem] uppercase tracking-[0.22em] transition-colors duration-500"
					style={{
						color: active ? '#f5f0e8' : 'rgba(245,240,232,0.55)',
						textShadow: `0 0 16px ${anchor.color}99`,
					}}
				>
					{anchor.nama}
				</button>
			</Html>
		</group>
	);
}
