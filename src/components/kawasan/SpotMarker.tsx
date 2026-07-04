import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { IslandTerrainOptions, KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VeilroseSpotLandmark } from './veilroseLandmarks';

// Label diskalakan & dipudarkan sendiri (bukan guna prop distanceFactor
// Html) supaya boleh dihadkan — distanceFactor Html mengira skala sebagai
// 1/jarak TANPA had, jadi bila watak boleh berjalan rapat ke satu spot
// (cth. selepas pembetulan pendakian Tangga Tepukan), label itu boleh
// membesar tanpa batas dan menutup seluruh skrin.
const LABEL_SCALE_REF_DISTANCE = 7;
const LABEL_SCALE_MIN = 0.7;
const LABEL_SCALE_MAX = 1.25;
const LABEL_FADE_NEAR = 4.5;
const LABEL_FADE_FAR = 8.5;
/** Had atas legap label yang TIDAK aktif — dipadamkan supaya beberapa nama
 * spot yang kelihatan serentak dalam satu pandangan tidak bersaing dengan
 * teks lain (tajuk, kapsyen bawah), cuma isyarat halus arah mana spot itu. */
const INACTIVE_LABEL_OPACITY_MAX = 0.32;

/** `active` = watak Zym sudah cukup dekat (bukan diketik) — reka bentuk ini
 * sengaja tanpa interaksi klik, selaras dengan falsafah "navigasi melalui
 * penerokaan dan rasa, bukan menu" dalam dokumen reka bentuk. */
export function SpotMarker({
	anchor,
	active,
	bobOffset,
	terrainOptions,
}: {
	anchor: KawasanAnchor;
	active: boolean;
	bobOffset: number;
	terrainOptions?: IslandTerrainOptions;
}) {
	const groupRef = useRef<THREE.Group>(null);
	const labelRef = useRef<HTMLSpanElement>(null);
	const labelWorldPos = useRef(new THREE.Vector3());
	// Sudut arah anchor ke pusat plaza — dipakai oleh spot yang perlu
	// menghala ke tengah (cth. lengkung galeri The Memory Room).
	const facingAngle = useMemo(
		() => Math.atan2(-anchor.position.x, 2 - anchor.position.z),
		[anchor.position],
	);

	useFrame(({ clock, camera }) => {
		if (groupRef.current) {
			const t = clock.getElapsedTime();
			// Bobbing lembut kekal berterusan sama ada aktif atau tidak — spot
			// tidak patut melonjak/berubah bila Zym menghampirinya.
			groupRef.current.position.y = Math.sin(t * 0.55 + bobOffset) * 0.025;
		}
		if (labelRef.current) {
			labelWorldPos.current.set(anchor.position.x, anchor.position.y + anchor.scale * 2, anchor.position.z);
			const dist = camera.position.distanceTo(labelWorldPos.current);
			const scale = THREE.MathUtils.clamp(LABEL_SCALE_REF_DISTANCE / Math.max(dist, 0.01), LABEL_SCALE_MIN, LABEL_SCALE_MAX);
			const fadeT = THREE.MathUtils.clamp((dist - LABEL_FADE_NEAR) / (LABEL_FADE_FAR - LABEL_FADE_NEAR), 0, 1);
			// Spot aktif sudah ada nama & deskripsi penuh pada kapsyen bawah
			// (VeilroseQuarterWorld.tsx) — label terapung dipadamkan supaya
			// tidak berulang tampil serentak pada dua tempat berbeza.
			const opacity = active ? 0 : THREE.MathUtils.lerp(INACTIVE_LABEL_OPACITY_MAX, 0.05, fadeT);
			labelRef.current.style.transform = `scale(${scale})`;
			labelRef.current.style.opacity = String(opacity);
		}
	});

	return (
		<group position={anchor.position} scale={anchor.scale}>
			<group ref={groupRef}>
				<VeilroseSpotLandmark id={anchor.id} terrainOptions={terrainOptions} facingAngle={facingAngle} />
			</group>
			<Html center position={[0, 2, 0]} occlude={false}>
				<span
					ref={labelRef}
					className="whitespace-nowrap font-body text-[0.6rem] uppercase tracking-[0.2em] transition-colors duration-500"
					style={{
						color: '#f5f0e8',
						textShadow: `0 0 16px ${anchor.groundColor}99`,
					}}
				>
					{anchor.nama}
				</span>
			</Html>
		</group>
	);
}
