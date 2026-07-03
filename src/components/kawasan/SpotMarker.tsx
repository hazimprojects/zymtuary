import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VeilroseSpotLandmark } from './veilroseLandmarks';

/** `active` = watak Zym sudah cukup dekat (bukan diketik) — reka bentuk ini
 * sengaja tanpa interaksi klik, selaras dengan falsafah "navigasi melalui
 * penerokaan dan rasa, bukan menu" dalam dokumen reka bentuk. */
export function SpotMarker({
	anchor,
	active,
	bobOffset,
}: {
	anchor: KawasanAnchor;
	active: boolean;
	bobOffset: number;
}) {
	const groupRef = useRef<THREE.Group>(null);

	useFrame(({ clock }) => {
		if (!groupRef.current) return;
		const t = clock.getElapsedTime();
		groupRef.current.position.y = Math.sin(t * 0.55 + bobOffset) * 0.025 + (active ? 0.08 : 0);
	});

	return (
		<group position={anchor.position} scale={anchor.scale}>
			<group ref={groupRef} scale={active ? 1.06 : 1}>
				<VeilroseSpotLandmark id={anchor.id} />
			</group>
			<Html center distanceFactor={11} position={[0, 2, 0]} occlude={false}>
				<span
					className="whitespace-nowrap font-body text-[0.6rem] uppercase tracking-[0.2em] transition-colors duration-500"
					style={{
						color: active ? '#f5f0e8' : 'rgba(245,240,232,0.55)',
						textShadow: `0 0 16px ${anchor.groundColor}99`,
					}}
				>
					{anchor.nama}
				</span>
			</Html>
		</group>
	);
}
