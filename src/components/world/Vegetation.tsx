import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
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
	/** Indeks bentuk dlm senarai varian hemisfera berkenaan (Luminara: 3
	 * varian pain; Noctira: 2 varian bercahaya) — bukan sekadar warna sama. */
	variant: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const LUMINARA_VARIANT_COUNT = 3;
const NOCTIRA_VARIANT_COUNT = 2;

function placeTree(dirVec: THREE.Vector3, scaleMin: number, scaleMax: number, rng: () => number, warm: boolean, variant: number): TreeSpot {
	const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + 0.006);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
	quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
	const scale = scaleMin + rng() * (scaleMax - scaleMin);
	return { position, quaternion, scale, warm, variant };
}

/** Kawasan yang layak ditanami pokok — hijau/Heartbloom sahaja. TIADA pokok
 * di gunung berapi/obsidian — lereng itu tandus batu-batu dan rekahan.
 * Kiraan 5x drpd asal supaya hutan rapat/padat macam hutan sebenar, bukan
 * pokok terselerak jarang. */
function densityFor(feature: LandmarkFeature): number {
	if (feature.type === 'tree') return 6000;
	if (feature.type === 'green') return 4500;
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
		const variantCount = warm ? LUMINARA_VARIANT_COUNT : NOCTIRA_VARIANT_COUNT;

		for (let i = 0; i < count; i++) {
			// Taburan cakera seragam (bukan segi empat) — punca akar sqrt elak
			// pekat di tengah.
			const r = Math.sqrt(rng()) * feature.radius * 0.95;
			const angle = rng() * Math.PI * 2;
			const lu = Math.cos(angle) * r;
			const lv = Math.sin(angle) * r;
			const dir = localToDir(center, u, v, lu, lv);
			const variant = Math.floor(rng() * variantCount);
			spots.push(placeTree(new THREE.Vector3(...dir), 0.1, 0.19, rng, warm, variant));
		}
	}

	return spots;
}

/** Pokok sepanjang tebing sungai — "sepanjang sungai patut ada banyak
 * pokok" — dijana daripada segmen sungai sebenar (sama data dengan
 * globeShader) supaya betul-betul mengikut laluan alur, bukan kawasan
 * bulat berasingan. Kiraan 5x drpd asal (perTrees) sepadan dgn hutan
 * berasaskan ciri di atas. */
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
		const variantCount = warm ? LUMINARA_VARIANT_COUNT : NOCTIRA_VARIANT_COUNT;

		for (const seg of segments) {
			const a = new THREE.Vector3(...seg.a);
			const b = new THREE.Vector3(...seg.b);
			const perTrees = 500;
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
				const variant = Math.floor(rng() * variantCount);
				spots.push(placeTree(dir, 0.08, 0.15, rng, warm, variant));
			}
		}
	}

	return spots;
}

type TreeVariant = { trunk: THREE.BufferGeometry; canopy: THREE.BufferGeometry };

function mergeGeoms(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const merged = mergeBufferGeometries(geos, false) ?? geos[0];
	for (const g of geos) g.dispose();
	return merged;
}

/** Pokok Luminara — hutan pain berlapis (gema rujukan: hutan pain low-poly
 * cerah), 3 bentuk berlainan (klasik/berlapis-tingkat/tirus tinggi) supaya
 * skyline hutan pelbagai, bukan satu bentuk kon berulang. Dibesarkan ~1.35x
 * drpd saiz asal supaya kelihatan "standard", bukan kecil sangat. */
function buildLuminaraVariants(): TreeVariant[] {
	const trunk = new THREE.CylinderGeometry(0.0054, 0.0081, 0.0486, 5);
	trunk.translate(0, 0.0243, 0);

	const classic = new THREE.ConeGeometry(0.0284, 0.0675, 6);
	classic.translate(0, 0.0567, 0);

	const tier1 = new THREE.ConeGeometry(0.034, 0.05, 7);
	tier1.translate(0, 0.0636, 0);
	const tier2 = new THREE.ConeGeometry(0.021, 0.045, 7);
	tier2.translate(0, 0.0999, 0);
	const layered = mergeGeoms([tier1, tier2]);

	const slim = new THREE.ConeGeometry(0.019, 0.095, 6);
	slim.translate(0, 0.0811, 0);

	return [
		{ trunk, canopy: classic },
		{ trunk, canopy: layered },
		{ trunk, canopy: slim },
	];
}

/** Pokok Noctira — REKA BENTUK BERLAINAN drpd Luminara (bukan sekadar
 * ditukar warna): kluster bulat gelap (gema hutan malam berpendarcahaya
 * dlm rujukan) & tunggul tirus dgn hujung bulat — tiada kon pain langsung,
 * supaya dua hemisfera jelas kelihatan berbeza reka bentuk pokoknya. */
function buildNoctiraVariants(): TreeVariant[] {
	const trunk = new THREE.CylinderGeometry(0.005, 0.0075, 0.045, 5);
	trunk.translate(0, 0.0225, 0);

	const c1 = new THREE.IcosahedronGeometry(0.026, 1);
	c1.translate(0, 0.069, 0);
	const c2 = new THREE.IcosahedronGeometry(0.018, 1);
	c2.translate(0.015, 0.09, 0.008);
	const c3 = new THREE.IcosahedronGeometry(0.017, 1);
	c3.translate(-0.013, 0.085, -0.011);
	const globular = mergeGeoms([c1, c2, c3]);

	const spire = new THREE.ConeGeometry(0.015, 0.08, 6);
	spire.translate(0, 0.073, 0);
	const tip = new THREE.SphereGeometry(0.01, 6, 6);
	tip.translate(0, 0.113, 0);
	const glowSpire = mergeGeoms([spire, tip]);

	return [
		{ trunk, canopy: globular },
		{ trunk, canopy: glowSpire },
	];
}

/** Pokok rendah-poligon diserak sebagai InstancedMesh (satu per varian
 * bentuk × hemisfera) pada kawasan hijau/Heartbloom DAN sepanjang tebing
 * sungai — rapat & padat macam hutan sebenar, dgn pelbagai bentuk & reka
 * bentuk berlainan antara Luminara (pain cerah) & Noctira (gelap
 * berpendarcahaya). Warna dicerahkan supaya kelihatan jelas walaupun di
 * atas tanah gelap (bahagian terlindung cahaya Luminara). */
export default function Vegetation({ atmosphereBlendRef }: VegetationProps) {
	const spots = useMemo(() => [...buildFeatureTreeSpots(), ...buildRiverbankTreeSpots()], []);
	const luminaraVariants = useMemo(() => buildLuminaraVariants(), []);
	const noctiraVariants = useMemo(() => buildNoctiraVariants(), []);

	const trunkWarmMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#7a5638', flatShading: true, roughness: 0.8, transparent: true, opacity: 0 }),
		[],
	);
	const trunkColdMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#332942', flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
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
				color: '#4a3a7a',
				emissive: '#8a5fe0',
				emissiveIntensity: 0.6,
				flatShading: true,
				roughness: 0.6,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const materials = useMemo(
		() => [trunkWarmMaterial, trunkColdMaterial, canopyWarmMaterial, canopyColdMaterial],
		[trunkWarmMaterial, trunkColdMaterial, canopyWarmMaterial, canopyColdMaterial],
	);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.06);
			mat.visible = mat.opacity > 0.01;
		}
	});

	const warmByVariant = useMemo(() => {
		const groups: TreeSpot[][] = Array.from({ length: luminaraVariants.length }, () => []);
		for (const s of spots) if (s.warm) groups[s.variant].push(s);
		return groups;
	}, [spots, luminaraVariants.length]);

	const coldByVariant = useMemo(() => {
		const groups: TreeSpot[][] = Array.from({ length: noctiraVariants.length }, () => []);
		for (const s of spots) if (!s.warm) groups[s.variant].push(s);
		return groups;
	}, [spots, noctiraVariants.length]);

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
			{luminaraVariants.map((v, i) => (
				<group key={`warm-${i}`}>
					{makeInstances(warmByVariant[i], v.trunk, trunkWarmMaterial)}
					{makeInstances(warmByVariant[i], v.canopy, canopyWarmMaterial)}
				</group>
			))}
			{noctiraVariants.map((v, i) => (
				<group key={`cold-${i}`}>
					{makeInstances(coldByVariant[i], v.trunk, trunkColdMaterial)}
					{makeInstances(coldByVariant[i], v.canopy, canopyColdMaterial)}
				</group>
			))}
		</group>
	);
}
