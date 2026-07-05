import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, deg, directionFromThetaY } from './worldGlobeConfig';

type AscendariTowerProps = {
	/** Sama seperti Vegetation/Aethirion — menara hanya kelihatan sepenuhnya
	 * apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const ASCENDARI_THETA = deg(125);
const ASCENDARI_Y = 0.5;

const UP = new THREE.Vector3(0, 1, 0);

const BASE_H = 0.045;
const SHAFT_H = 0.17;
const SPIRE_H = 0.075;

/**
 * Menara tunggal Ascendari — "menjulang lebih tinggi daripada mana-mana
 * struktur lain di Luminara" (Codex 5.2). Dibina drpd tiga tingkat
 * bertindih (asas granit gelap, batang batu pasir keemasan, kemuncak
 * tirus) + loceng gangsa kecil dekat puncak (gema Silent Bell Tower),
 * berdiri tegak sebagai landmark tetap di Pulau Ascendari — bukan
 * hanyut macam Aethirion.
 */
export default function AscendariTower({ atmosphereBlendRef }: AscendariTowerProps) {
	const dir = useMemo(() => new THREE.Vector3(...directionFromThetaY(ASCENDARI_THETA, ASCENDARI_Y)), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.006), [dir]);

	const baseGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.05, 0.06, BASE_H, 8);
		g.translate(0, BASE_H / 2, 0);
		return g;
	}, []);
	const shaftGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.02, 0.046, SHAFT_H, 8);
		g.translate(0, BASE_H + SHAFT_H / 2, 0);
		return g;
	}, []);
	const spireGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.02, SPIRE_H, 8);
		g.translate(0, BASE_H + SHAFT_H + SPIRE_H / 2, 0);
		return g;
	}, []);
	const bellGeo = useMemo(() => {
		const g = new THREE.SphereGeometry(0.013, 8, 6);
		g.translate(0, BASE_H + SHAFT_H - 0.015, 0);
		return g;
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
			<mesh geometry={baseGeo} material={graniteMat} />
			<mesh geometry={shaftGeo} material={sandstoneMat} />
			<mesh geometry={spireGeo} material={sandstoneMat} />
			<mesh geometry={bellGeo} material={bellMat} />
		</group>
	);
}
