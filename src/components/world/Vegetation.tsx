import { useMemo } from 'react';
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

type TreeSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: number;
	warm: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);

/** Kawasan yang layak ditanami pokok — hijau/Heartbloom (lebat) dan lereng
 * gunung (jarang, "banjaran gunung dengan pokok"). */
function densityFor(feature: LandmarkFeature): number {
	if (feature.type === 'tree') return 16;
	if (feature.type === 'green') return 12;
	if (feature.type === 'mountain') return 7;
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
			const r = Math.sqrt(rng()) * feature.radius * (feature.type === 'mountain' ? 0.85 : 0.95);
			const angle = rng() * Math.PI * 2;
			const lu = Math.cos(angle) * r;
			const lv = Math.sin(angle) * r;
			const dir = localToDir(center, u, v, lu, lv);
			const dirVec = new THREE.Vector3(...dir);
			const surfaceOffset = feature.type === 'mountain' ? 0.09 : 0.02;
			const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + surfaceOffset);

			const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
			quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));

			const scale = 0.65 + rng() * 0.7;
			spots.push({ position, quaternion, scale, warm });
		}
	}

	return spots;
}

function buildTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(0.006, 0.009, 0.05, 5);
	trunk.translate(0, 0.025, 0);
	const canopy = new THREE.ConeGeometry(0.032, 0.075, 6);
	canopy.translate(0, 0.06, 0);
	return { trunk, canopy };
}

/** Pokok rendah-poligon (trunk + canopy kon) diserak sebagai InstancedMesh
 * pada kawasan hijau/Heartbloom (lebat) dan lereng gunung (jarang) —
 * "hutan Vorynth Wood berkabus...banyak pokok lebat" dan "banjaran gunung
 * dengan pokok". */
export default function Vegetation() {
	const spots = useMemo(() => buildTreeSpots(), []);
	const { trunk, canopy } = useMemo(() => buildTreeGeometry(), []);

	const trunkMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#6b4a2e', flatShading: true, roughness: 0.85 }),
		[],
	);
	const canopyWarmMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#a3b854', flatShading: true, roughness: 0.75 }),
		[],
	);
	const canopyColdMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#4a7a5e', flatShading: true, roughness: 0.75 }),
		[],
	);

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
