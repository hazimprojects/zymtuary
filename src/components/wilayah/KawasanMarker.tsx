import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { KawasanAnchor } from './wilayahTerrain';
import { KawasanLandmark } from './kawasanLandmarks';

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
		groupRef.current.position.y = Math.sin(t * 0.6 + bobOffset) * 0.03 + (active ? 0.1 : 0);
	});

	return (
		<group position={anchor.position} scale={anchor.scale}>
			<group ref={groupRef} scale={active ? 1.08 : 1}>
				<KawasanLandmark id={anchor.id} />
				{/* Sasaran klik/sentuh telus — bentuk landmark sebenar terdiri
				 * daripada beberapa mesh kecil, jadi satu bulatan lut sinar yang
				 * lebih besar memastikan sentuhan senang kena walaupun di mobile. */}
				<mesh
					onClick={(e) => {
						e.stopPropagation();
						onSelect();
					}}
					onPointerOver={() => {
						document.body.style.cursor = 'pointer';
					}}
					onPointerOut={() => {
						document.body.style.cursor = 'default';
					}}
					position={[0, 0.45, 0]}
				>
					<sphereGeometry args={[0.9, 8, 8]} />
					<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				</mesh>
			</group>
			{/* Label sengaja di luar kumpulan yang "bob" — kalau label ikut sekali
			 * bergoyang, elemen DOM (Html) jadi tak stabil untuk sentuhan/klik. */}
			<Html center distanceFactor={9} position={[0, 1.3, 0]} occlude={false}>
				<button
					type="button"
					onClick={onSelect}
					className="pointer-events-auto whitespace-nowrap font-body text-[0.6rem] uppercase tracking-[0.22em] transition-colors duration-500"
					style={{
						color: active ? '#f5f0e8' : 'rgba(245,240,232,0.55)',
						textShadow: `0 0 16px ${anchor.groundColor}99`,
					}}
				>
					{anchor.nama}
				</button>
			</Html>
		</group>
	);
}
