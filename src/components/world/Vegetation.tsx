import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
	GLOBE_RADIUS,
	LANDMARK_FEATURES,
	directionFromThetaY,
	localToDir,
	seededRng,
	tangentBasis,
	type LandmarkFeature,
} from './worldGlobeConfig';

type VegetationProps = {
	/** Pokok hanya kelihatan sepenuhnya dalam atmosfera — dari orbit jauh
	 * dunia kelihatan tapi tanpa perincian, kaya hanya bila didekati. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

type TreeSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: number;
	warm: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);

/** Kawasan yang layak ditanami pokok — hijau/Heartbloom sahaja. TIADA pokok
 * di gunung berapi/obsidian — lereng itu tandus batu-batu dan rekahan. */
function densityFor(feature: LandmarkFeature): number {
	if (feature.type === 'tree') return 26;
	if (feature.type === 'green') return 20;
	return 0;
}

function buildTreeSpots(): TreeSpot[] {
	const spots: TreeSpot[] = [];

	for (const feature of LANDMARK_FEATURES) {
		const count = densityFor(feature);
		if (count === 0) continue;

		const center = directionFromThetaY(feature.theta, feature.y);
		const { u, v } = tangentBasis(center);
		const rng = seededRng(feature.theta * 1000 + feature.y * 7000 + count);
		const warm = feature.y > 0;

		for (let i = 0; i < count; i++) {
			// Taburan cakera seragam (bukan segi empat) — punca akar sqrt elak
			// pekat di tengah.
			const r = Math.sqrt(rng()) * feature.radius * 0.95;
			const angle = rng() * Math.PI * 2;
			const lu = Math.cos(angle) * r;
			const lv = Math.sin(angle) * r;
			const dir = localToDir(center, u, v, lu, lv);
			const dirVec = new THREE.Vector3(...dir);
			// Nipis — pokok kecil, jadi lekapan permukaan mesti rapat supaya
			// tidak kelihatan terapung di atas tanah.
			const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + 0.006);

			const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
			quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));

			// Pokok kecil & padat — hutan sebenar, bukan beberapa pokok besar
			// terserak jarang.
			const scale = 0.4 + rng() * 0.4;
			spots.push({ position, quaternion, scale, warm });
		}
	}

	return spots;
}

function buildTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(0.005, 0.008, 0.045, 5);
	trunk.translate(0, 0.0225, 0);
	const canopy = new THREE.ConeGeometry(0.026, 0.062, 6);
	canopy.translate(0, 0.05, 0);
	return { trunk, canopy };
}

/** Pokok rendah-poligon (trunk + canopy kon) diserak sebagai InstancedMesh
 * pada kawasan hijau/Heartbloom sahaja — kecil & padat macam hutan
 * sebenar, bukan beberapa pokok besar jarang. */
export default function Vegetation({ atmosphereBlendRef }: VegetationProps) {
	const spots = useMemo(() => buildTreeSpots(), []);
	const { trunk, canopy } = useMemo(() => buildTreeGeometry(), []);

	const trunkMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#6b4a2e', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const canopyWarmMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#a3b854', flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
		[],
	);
	const canopyColdMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#4a7a5e', flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
		[],
	);

	const materials = useMemo(
		() => [trunkMaterial, canopyWarmMaterial, canopyColdMaterial],
		[trunkMaterial, canopyWarmMaterial, canopyColdMaterial],
	);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.06);
			mat.visible = mat.opacity > 0.01;
		}
	});

	const warmSpots = useMemo(() => spots.filter((s) => s.warm), [spots]);
	const coldSpots = useMemo(() => spots.filter((s) => !s.warm), [spots]);

	const makeInstances = (list: TreeSpot[], geometry: THREE.BufferGeometry, material: THREE.Material) => {
		if (list.length === 0) return null;
		return (
			<instancedMesh
				args={[geometry, material, list.length]}
				ref={(mesh) => {
					if (!mesh) return;
					const m = new THREE.Matrix4();
					list.forEach((spot, i) => {
						m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
						mesh.setMatrixAt(i, m);
					});
					mesh.instanceMatrix.needsUpdate = true;
				}}
			/>
		);
	};

	return (
		<group>
			{makeInstances(warmSpots, trunk, trunkMaterial)}
			{makeInstances(coldSpots, trunk, trunkMaterial)}
			{makeInstances(warmSpots, canopy, canopyWarmMaterial)}
			{makeInstances(coldSpots, canopy, canopyColdMaterial)}
		</group>
	);
}
