import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
	GLOBE_RADIUS,
	LANDMARK_FEATURES,
	MAX_RIVER_SEGMENTS,
	RIVER_NETWORKS,
	directionFromThetaY,
	generateRiverNetwork,
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

function placeTree(dirVec: THREE.Vector3, scaleMin: number, scaleMax: number, rng: () => number, warm: boolean): TreeSpot {
	const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + 0.006);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
	quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
	const scale = scaleMin + rng() * (scaleMax - scaleMin);
	return { position, quaternion, scale, warm };
}

/** Kawasan yang layak ditanami pokok — hijau/Heartbloom sahaja. TIADA pokok
 * di gunung berapi/obsidian — lereng itu tandus batu-batu dan rekahan. */
function densityFor(feature: LandmarkFeature): number {
	if (feature.type === 'tree') return 1200;
	if (feature.type === 'green') return 900;
	return 0;
}

function buildFeatureTreeSpots(): TreeSpot[] {
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
			spots.push(placeTree(new THREE.Vector3(...dir), 0.1, 0.19, rng, warm));
		}
	}

	return spots;
}

/** Pokok sepanjang tebing sungai — "sepanjang sungai patut ada banyak
 * pokok" — dijana daripada segmen sungai sebenar (sama data dengan
 * globeShader) supaya betul-betul mengikut laluan alur, bukan kawasan
 * bulat berasingan. */
function buildRiverbankTreeSpots(): TreeSpot[] {
	const spots: TreeSpot[] = [];

	for (const river of RIVER_NETWORKS) {
		const segments = generateRiverNetwork(river, MAX_RIVER_SEGMENTS).filter((s) => s.width > 0.0001);
		const center = directionFromThetaY(river.center.theta, river.center.y);
		const { u: uArr, v: vArr } = tangentBasis(center);
		const u = new THREE.Vector3(...uArr);
		const v = new THREE.Vector3(...vArr);
		const rng = seededRng(river.seed * 13 + 7);
		const warm = river.center.y > 0;

		for (const seg of segments) {
			const a = new THREE.Vector3(...seg.a);
			const b = new THREE.Vector3(...seg.b);
			const perTrees = 100;
			for (let i = 0; i < perTrees; i++) {
				const t = rng();
				const along = a.clone().lerp(b, t).normalize();
				// Ofset tepi (bank) berserenjang dengan arah sungai, supaya pokok
				// berbaris di kedua-dua tebing, bukan terus di atas air.
				const bankSide = rng() < 0.5 ? 1 : -1;
				const bankDist = (0.01 + rng() * 0.022) * bankSide;
				const crossed = new THREE.Vector3().crossVectors(along, u);
				const perp = crossed.length() > 0.001 ? crossed : v.clone();
				const dir = along.clone().addScaledVector(perp.normalize(), bankDist).normalize();
				spots.push(placeTree(dir, 0.08, 0.15, rng, warm));
			}
		}
	}

	return spots;
}

function buildTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(0.004, 0.006, 0.036, 5);
	trunk.translate(0, 0.018, 0);
	const canopy = new THREE.ConeGeometry(0.021, 0.05, 6);
	canopy.translate(0, 0.042, 0);
	return { trunk, canopy };
}

/** Pokok rendah-poligon (trunk + canopy kon) diserak sebagai InstancedMesh
 * pada kawasan hijau/Heartbloom DAN sepanjang tebing sungai — kecil &
 * padat macam hutan sebenar. Warna dicerahkan supaya kelihatan jelas
 * walaupun di atas tanah gelap (bahagian terlindung cahaya Luminara). */
export default function Vegetation({ atmosphereBlendRef }: VegetationProps) {
	const spots = useMemo(() => [...buildFeatureTreeSpots(), ...buildRiverbankTreeSpots()], []);
	const { trunk, canopy } = useMemo(() => buildTreeGeometry(), []);

	const trunkMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#7a5638', flatShading: true, roughness: 0.8, transparent: true, opacity: 0 }),
		[],
	);
	const canopyWarmMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#bcd06a',
				emissive: '#3a4a1a',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.7,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const canopyColdMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#5a9a76',
				emissive: '#12281c',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.7,
				transparent: true,
				opacity: 0,
			}),
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
