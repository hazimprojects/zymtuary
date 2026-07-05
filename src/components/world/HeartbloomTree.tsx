import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection } from './worldGlobeConfig';

type HeartbloomTreeProps = {
	/** Sama seperti Vegetation/Aethirion — pokok gergasi hanya kelihatan
	 * sepenuhnya apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

const TRUNK_H = 0.22;

// Heartbloom ialah ciri type 'water' (lembah tasik) — terrainHeight
// menakikkan lembangan ini sedalam falloff*0.03 di pusatnya. Pangkal
// pokok perlu dianjak SAMA jumlah supaya duduk di atas dasar tasik
// (pulau kecil tersirat), bukan terapung di udara di atas permukaan air.
const LAKE_INDENT = 0.03;

/** Kanopi rata/bujur amat luas (bukan kon tirus macam pokok pine) — sfera
 * unit dipepatkan (scale.y kecil drpd scale.x/z) untuk profil "cendawan"
 * bertingkat yang lebar mencecah banjaran gunung sekeliling lembah. */
function makeCanopyGeometry(radiusXZ: number, radiusY: number, centerY: number): THREE.BufferGeometry {
	const g = new THREE.IcosahedronGeometry(1, 1);
	g.scale(radiusXZ, radiusY, radiusXZ);
	g.translate(0, centerY, 0);
	return g;
}

/**
 * Pokok gergasi Heartbloom — tempat kelahiran Auryalis, tumbuh di pulau
 * kecil tengah lembah tasik Heartbloom Isle. Kanopi cendawan dua tingkat
 * amat lebar (jejari dunia ~0.3, sepadan jejari gegelang TerrainRings di
 * sekelilingnya) supaya kelihatan "mencecah" banjaran gunung pelindung —
 * bukan sekadar pokok besar biasa.
 */
export default function HeartbloomTree({ atmosphereBlendRef }: HeartbloomTreeProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('heartbloom')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS - LAKE_INDENT + 0.006), [dir]);

	const rootFlareGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.09, 0.06, 8);
		g.translate(0, 0.03, 0);
		return g;
	}, []);
	const trunkGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.032, 0.05, TRUNK_H, 7);
		g.translate(0, TRUNK_H / 2 + 0.03, 0);
		return g;
	}, []);
	const canopyLowGeo = useMemo(() => makeCanopyGeometry(0.3, 0.14, TRUNK_H + 0.08), []);
	const canopyTopGeo = useMemo(() => makeCanopyGeometry(0.19, 0.11, TRUNK_H + 0.24), []);

	const trunkMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#5a3d24', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const canopyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#a8c94a',
				emissive: '#4a5a1a',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.65,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const materials = useMemo(() => [trunkMat, canopyMat], [trunkMat, canopyMat]);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={rootFlareGeo} material={trunkMat} />
			<mesh geometry={trunkGeo} material={trunkMat} />
			<mesh geometry={canopyLowGeo} material={canopyMat} />
			<mesh geometry={canopyTopGeo} material={canopyMat} />
		</group>
	);
}
