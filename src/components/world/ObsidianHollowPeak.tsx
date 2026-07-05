import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection } from './worldGlobeConfig';

type ObsidianHollowPeakProps = {
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

// Sepadan dgn falloff mountain di terrainHeight: 0.1 * heightScale (1.45
// utk 'obsidian-hollow') + sedikit ruang supaya kon ais duduk DI ATAS
// puncak yg dianjak, bukan tertanam/terapung.
const PEAK_BUMP = 0.1 * 1.45;

/**
 * Puncak ais di kemuncak Obsidian Hollow — "gunung obsidian hitam
 * berpuncak ais, PALING TINGGI di Noctira". Shader terrain sendiri hanya
 * beri satu warna gelap seragam utk semua gunung; kon ais putih kecil ini
 * di hujung puncak yang beri isyarat visual "berais" secara terus.
 */
export default function ObsidianHollowPeak({ atmosphereBlendRef }: ObsidianHollowPeakProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('obsidian-hollow')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + PEAK_BUMP + 0.003), [dir]);

	const capGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.03, 0.055, 7);
		g.translate(0, 0.0275, 0);
		return g;
	}, []);

	const capMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#e8f4fb',
				emissive: '#3a5566',
				emissiveIntensity: 0.3,
				flatShading: true,
				roughness: 0.4,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		capMat.opacity = THREE.MathUtils.lerp(capMat.opacity, target, 0.05);
		capMat.visible = capMat.opacity > 0.01;
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={capGeo} material={capMat} />
		</group>
	);
}
