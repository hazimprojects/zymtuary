import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection } from './worldGlobeConfig';

type AscendariTowerProps = {
	/** Sama seperti Vegetation/Aethirion — menara hanya kelihatan sepenuhnya
	 * apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

const TIER1_H = 0.05;
const TIER2_H = 0.055;
const TIER3_H = 0.06;
const TIER4_H = 0.045;
const SPIRE_H = 0.09;
const SPIRE_BASE_Y = TIER1_H + TIER2_H + TIER3_H + TIER4_H;

/**
 * Menara Ascendari — "menjulang lebih tinggi daripada mana-mana struktur
 * lain di Luminara" (Codex 5.2). Silhouette rekaan gah/hebat (banyak
 * tingkat menirus + menara sudut kecil) tapi setiap bahagian kekal
 * geometri ringkas (silinder/kon rendah-poli) — kegahan datang drpd
 * susunan/skala, bukan perincian ukiran.
 */
export default function AscendariTower({ atmosphereBlendRef }: AscendariTowerProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('ascendari-pulau')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.006), [dir]);

	const tier1Geo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.07, 0.085, TIER1_H, 9);
		g.translate(0, TIER1_H / 2, 0);
		return g;
	}, []);
	const tier2Geo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.055, 0.068, TIER2_H, 9);
		g.translate(0, TIER1_H + TIER2_H / 2, 0);
		return g;
	}, []);
	const tier3Geo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.038, 0.05, TIER3_H, 8);
		g.translate(0, TIER1_H + TIER2_H + TIER3_H / 2, 0);
		return g;
	}, []);
	const tier4Geo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.026, 0.036, TIER4_H, 8);
		g.translate(0, TIER1_H + TIER2_H + TIER3_H + TIER4_H / 2, 0);
		return g;
	}, []);
	const spireGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.022, SPIRE_H, 8);
		g.translate(0, SPIRE_BASE_Y + SPIRE_H / 2, 0);
		return g;
	}, []);
	const bellGeo = useMemo(() => {
		const g = new THREE.SphereGeometry(0.014, 8, 6);
		g.translate(0, SPIRE_BASE_Y - 0.012, 0);
		return g;
	}, []);

	// Menara sudut kecil di pangkal tier2 — beri profil "kubu gah" tanpa
	// menambah perincian ukiran, cuma 4 kon kecil pada sudut kompas.
	const cornerSpireGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.014, 0.06, 6);
		g.translate(0, 0.03, 0);
		return g;
	}, []);
	const cornerSpirePositions = useMemo(() => {
		const r = 0.06;
		const y = TIER1_H;
		return [0, 1, 2, 3].map((i) => {
			const a = (i / 4) * Math.PI * 2;
			return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
		});
	}, []);

	const graniteMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#3d3833', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const sandstoneMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#c9a86a',
				emissive: '#3a2c10',
				emissiveIntensity: 0.35,
				flatShading: true,
				roughness: 0.6,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const bellMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#2a1f14', metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0 }),
		[],
	);

	const materials = useMemo(() => [graniteMat, sandstoneMat, bellMat], [graniteMat, sandstoneMat, bellMat]);

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
			<mesh geometry={tier1Geo} material={graniteMat} />
			<mesh geometry={tier2Geo} material={sandstoneMat} />
			{cornerSpirePositions.map((pos, i) => (
				<mesh key={i} geometry={cornerSpireGeo} material={sandstoneMat} position={pos} />
			))}
			<mesh geometry={tier3Geo} material={sandstoneMat} />
			<mesh geometry={tier4Geo} material={graniteMat} />
			<mesh geometry={spireGeo} material={sandstoneMat} />
			<mesh geometry={bellGeo} material={bellMat} />
		</group>
	);
}
