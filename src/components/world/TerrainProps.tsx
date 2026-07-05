import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
	FISSURE_CENTERS,
	GLOBE_RADIUS,
	LANDMARK_FEATURES,
	MAX_CRACK_SEGMENTS,
	directionFromThetaY,
	generateCrackNetwork,
	localToDir,
	seededRng,
	tangentBasis,
	type LandmarkFeature,
} from './worldGlobeConfig';

type TerrainPropsProps = {
	/** Sama seperti Vegetation/Aethirion — perincian ini hanya kelihatan
	 * sepenuhnya apabila pelawat masuk atmosfera, bukan dari orbit jauh. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

type PropSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: THREE.Vector3;
	warm: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);

function radialSpot(
	dirVec: THREE.Vector3,
	heightOffset: number,
	scale: THREE.Vector3,
	spin: number,
	warm: boolean,
	tilt = 0,
	tiltAxis?: THREE.Vector3,
): PropSpot {
	const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + heightOffset);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
	quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
	if (tilt !== 0 && tiltAxis) {
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(tiltAxis, tilt));
	}
	return { position, quaternion, scale, warm };
}

/** Gugusan batu kecil rendah-poli — badlands & gunung (termasuk obsidian)
 * sahaja, TIADA di kawasan hijau/laut. Guna satu geometri kongsi (unit
 * icosahedron) diskala tak seragam + putaran rawak setiap instance untuk
 * variasi bentuk, elakkan jitter per-verteks yang mahal pada bilangan besar. */
function densityForRock(feature: LandmarkFeature): number {
	if (feature.type === 'mountain') return 220;
	if (feature.type === 'arid') return 180;
	return 0;
}

function buildRockSpots(): PropSpot[] {
	const spots: PropSpot[] = [];
	for (const feature of LANDMARK_FEATURES) {
		const count = densityForRock(feature);
		if (count === 0) continue;

		const center = directionFromThetaY(feature.theta, feature.y);
		const { u, v } = tangentBasis(center);
		const rng = seededRng(feature.theta * 500 + feature.y * 3000 + count);
		const warm = feature.y > 0;

		for (let i = 0; i < count; i++) {
			const r = Math.sqrt(rng()) * feature.radius * 0.92;
			const angle = rng() * Math.PI * 2;
			const lu = Math.cos(angle) * r;
			const lv = Math.sin(angle) * r;
			const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));

			const s = 0.012 + rng() * 0.02;
			const scale = new THREE.Vector3(s * (0.75 + rng() * 0.55), s * (0.5 + rng() * 0.4), s * (0.75 + rng() * 0.55));
			const tiltAxis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
			spots.push(radialSpot(dir, 0.003, scale, rng() * Math.PI * 2, warm, (rng() - 0.5) * 0.7, tiltAxis));
		}
	}
	return spots;
}

/** Kristal kecil bercahaya sepanjang rekahan Ignisara (lava, oren) dan
 * Nivira (ais, biru-putih) — diserak mengikut segmen retak SEBENAR (data
 * sama dengan glow rekahan dalam shader) supaya betul-betul mengikut
 * laluan retak, bukan kawasan bulat berasingan. */
function buildCrystalSpots(): PropSpot[] {
	const spots: PropSpot[] = [];
	const perFissureMax = Math.floor(MAX_CRACK_SEGMENTS / FISSURE_CENTERS.length);

	for (const fissure of FISSURE_CENTERS) {
		const center = directionFromThetaY(fissure.theta, fissure.y);
		const segments = generateCrackNetwork(center, fissure.radius, fissure.seed, perFissureMax).filter(
			(s) => s.width > 0.0001,
		);
		const rng = seededRng(fissure.seed * 31 + 5);
		const warm = fissure.y > 0;

		for (const seg of segments) {
			const a = new THREE.Vector3(...seg.a);
			const b = new THREE.Vector3(...seg.b);
			const perSeg = 6;
			for (let i = 0; i < perSeg; i++) {
				const t = rng();
				const along = a.clone().lerp(b, t).normalize();
				const s = 0.008 + rng() * 0.014;
				const scale = new THREE.Vector3(s * 0.55, s * (1.0 + rng() * 0.7), s * 0.55);
				spots.push(radialSpot(along, 0.002, scale, rng() * Math.PI * 2, warm));
			}
		}
	}
	return spots;
}

/** Kepulan awan rendah-poli melekat berhampiran kawasan gunung & hijau/pokok
 * — beberapa "gumpalan" (klump) kecil, setiap satu terdiri drpd beberapa
 * puff bertindih, terapung sedikit di atas permukaan (bukan naik ke langit). */
function densityForCloud(feature: LandmarkFeature): number {
	if (feature.type === 'mountain') return 5;
	if (feature.type === 'green' || feature.type === 'tree') return 4;
	return 0;
}

function buildCloudSpots(): PropSpot[] {
	const spots: PropSpot[] = [];
	for (const feature of LANDMARK_FEATURES) {
		const clumps = densityForCloud(feature);
		if (clumps === 0) continue;

		const center = directionFromThetaY(feature.theta, feature.y);
		const { u, v } = tangentBasis(center);
		const rng = seededRng(feature.theta * 800 + feature.y * 4000 + 99);
		const warm = feature.y > 0;

		for (let c = 0; c < clumps; c++) {
			const r = Math.sqrt(rng()) * feature.radius * 1.05;
			const angle = rng() * Math.PI * 2;
			const cu = Math.cos(angle) * r;
			const cv = Math.sin(angle) * r;
			const puffsInClump = 4 + Math.floor(rng() * 3);

			for (let p = 0; p < puffsInClump; p++) {
				const ou = cu + (rng() - 0.5) * 0.035;
				const ov = cv + (rng() - 0.5) * 0.035;
				const dir = new THREE.Vector3(...localToDir(center, u, v, ou, ov));
				const height = 0.05 + rng() * 0.045;
				const s = 0.02 + rng() * 0.022;
				const scale = new THREE.Vector3(s, s * (0.65 + rng() * 0.3), s);
				spots.push(radialSpot(dir, height, scale, rng() * Math.PI * 2, warm));
			}
		}
	}
	return spots;
}

function makeRockGeometry() {
	return new THREE.IcosahedronGeometry(1, 0);
}

function makeCrystalGeometry() {
	return new THREE.OctahedronGeometry(1, 0);
}

function makeCloudGeometry() {
	return new THREE.IcosahedronGeometry(1, 1);
}

export default function TerrainProps({ atmosphereBlendRef }: TerrainPropsProps) {
	const rockGeo = useMemo(() => makeRockGeometry(), []);
	const crystalGeo = useMemo(() => makeCrystalGeometry(), []);
	const cloudGeo = useMemo(() => makeCloudGeometry(), []);

	const rockSpots = useMemo(() => buildRockSpots(), []);
	const crystalSpots = useMemo(() => buildCrystalSpots(), []);
	const cloudSpots = useMemo(() => buildCloudSpots(), []);

	const rockWarmMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#7a6a58', flatShading: true, roughness: 0.95, transparent: true, opacity: 0 }),
		[],
	);
	const rockColdMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#17151c',
				flatShading: true,
				roughness: 0.35,
				metalness: 0.2,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const crystalWarmMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#ff8a3d',
				emissive: '#ff5a1a',
				emissiveIntensity: 1.1,
				flatShading: true,
				roughness: 0.3,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const crystalColdMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#a8ecff',
				emissive: '#5fc4ff',
				emissiveIntensity: 1.1,
				flatShading: true,
				roughness: 0.3,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const cloudWarmMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#fff6e6',
				emissive: '#4a3d28',
				emissiveIntensity: 0.25,
				flatShading: true,
				roughness: 1,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const cloudColdMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#eaf4ff',
				emissive: '#26313d',
				emissiveIntensity: 0.25,
				flatShading: true,
				roughness: 1,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const materials = useMemo(
		() => [rockWarmMat, rockColdMat, crystalWarmMat, crystalColdMat, cloudWarmMat, cloudColdMat],
		[rockWarmMat, rockColdMat, crystalWarmMat, crystalColdMat, cloudWarmMat, cloudColdMat],
	);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.06);
			mat.visible = mat.opacity > 0.01;
		}
		const pulse = 1.0 + 0.18 * Math.sin(clock.elapsedTime * 1.6);
		crystalWarmMat.emissiveIntensity = 1.1 * pulse;
		crystalColdMat.emissiveIntensity = 1.1 * (2.0 - pulse);
	});

	const warmRocks = useMemo(() => rockSpots.filter((s) => s.warm), [rockSpots]);
	const coldRocks = useMemo(() => rockSpots.filter((s) => !s.warm), [rockSpots]);
	const warmCrystals = useMemo(() => crystalSpots.filter((s) => s.warm), [crystalSpots]);
	const coldCrystals = useMemo(() => crystalSpots.filter((s) => !s.warm), [crystalSpots]);
	const warmClouds = useMemo(() => cloudSpots.filter((s) => s.warm), [cloudSpots]);
	const coldClouds = useMemo(() => cloudSpots.filter((s) => !s.warm), [cloudSpots]);

	const makeInstances = (list: PropSpot[], geometry: THREE.BufferGeometry, material: THREE.Material, key: string) => {
		if (list.length === 0) return null;
		return (
			<instancedMesh
				key={key}
				args={[geometry, material, list.length]}
				ref={(mesh) => {
					if (!mesh) return;
					const m = new THREE.Matrix4();
					list.forEach((spot, i) => {
						m.compose(spot.position, spot.quaternion, spot.scale);
						mesh.setMatrixAt(i, m);
					});
					mesh.instanceMatrix.needsUpdate = true;
				}}
			/>
		);
	};

	return (
		<group>
			{makeInstances(warmRocks, rockGeo, rockWarmMat, 'rock-warm')}
			{makeInstances(coldRocks, rockGeo, rockColdMat, 'rock-cold')}
			{makeInstances(warmCrystals, crystalGeo, crystalWarmMat, 'crystal-warm')}
			{makeInstances(coldCrystals, crystalGeo, crystalColdMat, 'crystal-cold')}
			{makeInstances(warmClouds, cloudGeo, cloudWarmMat, 'cloud-warm')}
			{makeInstances(coldClouds, cloudGeo, cloudColdMat, 'cloud-cold')}
		</group>
	);
}
