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
	/** Pokok mati — batang/dahan sahaja, tiada kanopi, utk kedalaman &
	 * realistik (gema rujukan: hutan pain dgn beberapa pokok botak/mati
	 * bercampur). */
	dead: boolean;
	/** Indeks bentuk: pokok hidup → varian kanopi hemisfera berkenaan
	 * (Luminara 3 varian pain; Noctira 2 varian bercahaya gelap); pokok
	 * mati → varian bentuk mati (DEAD_VARIANT_COUNT). */
	variant: number;
	canopyColor: THREE.Color;
	trunkColor: THREE.Color;
};

const UP = new THREE.Vector3(0, 1, 0);
const LUMINARA_VARIANT_COUNT = 3;
const NOCTIRA_VARIANT_COUNT = 2;
const DEAD_VARIANT_COUNT = 2;
const DEAD_CHANCE = 0.08;

function randomHSL(rng: () => number, hueMin: number, hueMax: number, satMin: number, satMax: number, lightMin: number, lightMax: number): THREE.Color {
	const h = (hueMin + rng() * (hueMax - hueMin)) / 360;
	const s = satMin + rng() * (satMax - satMin);
	const l = lightMin + rng() * (lightMax - lightMin);
	return new THREE.Color().setHSL(h, s, l);
}

/** Setiap pokok dpt tona kanopi/batang SENDIRI (gelap ke cerah, bukan satu
 * warna rata) — Noctira kekal warna HIJAU macam Luminara tetapi julat hue
 * lebih sejuk/kebiruan & lebih gelap keseluruhannya (suasana malam), bukan
 * palet berlainan (cth. ungu) sepenuhnya. */
function placeTree(dirVec: THREE.Vector3, scaleMin: number, scaleMax: number, rng: () => number, warm: boolean, variantCount: number): TreeSpot {
	const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + 0.006);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
	quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
	const scale = scaleMin + rng() * (scaleMax - scaleMin);
	const dead = rng() < DEAD_CHANCE;
	const variant = dead ? Math.floor(rng() * DEAD_VARIANT_COUNT) : Math.floor(rng() * variantCount);
	const canopyColor = warm
		? randomHSL(rng, 70, 95, 0.45, 0.65, 0.32, 0.6)
		: randomHSL(rng, 128, 156, 0.26, 0.46, 0.16, 0.38);
	const trunkColor = dead
		? randomHSL(rng, 30, 42, 0.06, 0.16, 0.28, 0.48)
		: warm
			? randomHSL(rng, 25, 35, 0.35, 0.55, 0.28, 0.42)
			: randomHSL(rng, 20, 30, 0.14, 0.28, 0.13, 0.24);
	return { position, quaternion, scale, warm, dead, variant, canopyColor, trunkColor };
}

function hash2D(x: number, y: number, seed: number): number {
	const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
	return s - Math.floor(s);
}

function valueNoise2D(x: number, y: number, seed: number): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const h00 = hash2D(xi, yi, seed);
	const h10 = hash2D(xi + 1, yi, seed);
	const h01 = hash2D(xi, yi + 1, seed);
	const h11 = hash2D(xi + 1, yi + 1, seed);
	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);
	return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h00, h10, u), THREE.MathUtils.lerp(h01, h11, u), v);
}

/** Bunyi berbilang oktaf (fbm) 2D murah — dipakai utk medan ketumpatan
 * hutan tak sekata (tompok & jurang organik, BUKAN kluster bulat/cakera
 * genap). */
function fbm2D(x: number, y: number, seed: number): number {
	let v = 0;
	let amp = 0.55;
	let freq = 1;
	let norm = 0;
	for (let i = 0; i < 3; i++) {
		v += amp * valueNoise2D(x * freq, y * freq, seed + i * 101);
		norm += amp;
		amp *= 0.5;
		freq *= 2.15;
	}
	return v / norm;
}

/** Sempadan kawasan hutan bukan bulatan sempurna — gabungan beberapa
 * harmonik sudut (fasa/amplitud rawak) memberi bentuk "blob" tak sekata
 * (lobus keluar-masuk), macam sempadan hutan sebenar mengikut rupa bumi,
 * bukan cakera genap. */
function buildIrregularBoundary(rng: () => number): (theta: number) => number {
	const a1 = 0.16 + rng() * 0.12;
	const p1 = rng() * Math.PI * 2;
	const a2 = 0.09 + rng() * 0.1;
	const p2 = rng() * Math.PI * 2;
	const a3 = 0.05 + rng() * 0.08;
	const p3 = rng() * Math.PI * 2;
	return (theta: number) => 1 + a1 * Math.cos(theta + p1) + a2 * Math.cos(2 * theta + p2) + a3 * Math.cos(3 * theta + p3);
}

/** Jana "tompok" hutan organik — calon diserak dlm sempadan tak sekata
 * (buildIrregularBoundary), setiap calon diberi pemberat drpd bunyi fbm
 * 2D (medan ketumpatan tak sekata), lebihan calon (oversample) disusun
 * ikut pemberat & hanya `count` teratas diambil. Ini menjamin bilangan
 * TEPAT tanpa gelung tolak-terima (rejection loop) yg boleh tak menentu,
 * & hasilnya tompok/jurang organik ikut kontur bunyi — bukan kluster
 * bulat kecil berulang (masalah pendekatan "pusat kluster" sebelum ini). */
function buildOrganicPatch(
	rng: () => number,
	count: number,
	baseRadius: number,
	seed: number,
	innerR = 0,
): { u: number; v: number }[] {
	const boundary = buildIrregularBoundary(rng);
	const oversample = 3;
	const total = count * oversample;
	const candidates: { u: number; v: number; w: number }[] = [];
	for (let i = 0; i < total; i++) {
		const theta = rng() * Math.PI * 2;
		const localMax = baseRadius * boundary(theta);
		// minFrac>0 KECUALIKAN zon tengah scr KERAS (bukan sekadar pemberat
		// rendah) — sampel rho dlm gegelang [innerR, localMax] supaya tiada
		// calon langsung terjana di dlm zon tengah (cth. tasik kecil).
		const minFrac = Math.min(0.98, innerR / localMax);
		const rho = Math.sqrt(minFrac * minFrac + rng() * (1 - minFrac * minFrac));
		const u = Math.cos(theta) * rho * localMax;
		const v = Math.sin(theta) * rho * localMax;
		const n = fbm2D(u * 8 + 50, v * 8 + 50, seed);
		// Berat sedikit lebih tinggi berhampiran tengah supaya tidak jadi
		// gegelang kosong di tengah, tapi bunyi fbm kekal penentu utama
		// bentuk tompok/jurangnya.
		const w = n * (0.65 + 0.35 * (1 - rho));
		candidates.push({ u, v, w });
	}
	candidates.sort((a, b) => b.w - a.w);
	return candidates.slice(0, count);
}

/** Kawasan yang layak ditanami pokok — hijau/Heartbloom sahaja. TIADA pokok
 * di gunung berapi/obsidian — lereng itu tandus batu-batu dan rekahan.
 * Kiraan diturunkan sikit drpd 6000/4500 asal supaya jarak tanaman
 * longgar sesuai dgn pokok yg kini ~1.6x lebih besar (lihat placeTree
 * scale di bawah) — elak canopy terlalu bertindih/blobby. */
function densityFor(feature: LandmarkFeature): number {
	if (feature.type === 'tree') return 4800;
	if (feature.type === 'green') return 3600;
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
		const maxR = feature.radius * 0.95;
		const patch = buildOrganicPatch(rng, count, maxR, feature.theta * 733 + feature.y * 991, feature.innerExclusion ?? 0);

		for (const p of patch) {
			const dir = localToDir(center, u, v, p.u, p.v);
			// Skala dibesarkan ~1.6x drpd asal (0.1-0.19) supaya sepadan dgn
			// saiz pokok Aethirion/Velvet Alcove (Mendari) — sblm ini hutan am
			// jauh lebih kecil (~2-3x) drpd pokok "hero" di kawasan lain.
			spots.push(placeTree(new THREE.Vector3(...dir), 0.16, 0.3, rng, warm, variantCount));
		}
	}

	return spots;
}

/** Pokok sepanjang tebing sungai — "sepanjang sungai patut ada banyak
 * pokok" — dijana daripada segmen sungai sebenar (sama data dengan
 * globeShader) supaya betul-betul mengikut laluan alur, bukan kawasan
 * bulat berasingan. Diklumpkan sepanjang beberapa titik jangkar (bukan
 * taburan genap sepanjang keseluruhan tebing) supaya nampak macam
 * kelompok pokok tepi sungai, bukan barisan lurus sekata. */
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
			// Diturunkan drpd 500 asal — pokok tebing kini ~1.6x lebih besar
			// (lihat placeTree di bawah), jadi kiraan lebih rendah kekalkan
			// jarak longgar yg sepadan.
			const perTreesTarget = 400;
			const segSeed = rng() * 9999;

			// Kepekatan sepanjang tebing ikut bunyi fbm 1D (bukan titik jangkar
			// diskret — itu sendiri jadi kelihatan macam kluster bulat kecil
			// berulang) — oversample & ambil pemberat teratas, sama teknik dgn
			// buildOrganicPatch, supaya tompok/jurang organik sepanjang alir.
			const oversample = 3;
			const candidates: { t: number; bankSide: number; bankFrac: number; w: number }[] = [];
			for (let i = 0; i < perTreesTarget * oversample; i++) {
				const t = rng();
				const bankSide = rng() < 0.5 ? 1 : -1;
				const bankFrac = 1.6 + rng() * 2.4;
				const n = fbm2D(t * 14, bankSide * 3.1, segSeed);
				candidates.push({ t, bankSide, bankFrac, w: n });
			}
			candidates.sort((x, y) => y.w - x.w);
			const chosen = candidates.slice(0, perTreesTarget);

			for (const c of chosen) {
				const along = a.clone().lerp(b, c.t).normalize();
				// Ofset tebing MESTI relatif kpd lebar SEBENAR segmen ini
				// (seg.width), bukan pemalar tetap — sungai melebar ke hilir,
				// jadi ofset tetap menyebabkan pokok "melanggar"/tumbuh di dlm
				// air berhampiran muara yg lebar. Visual lebar sungai dlm
				// shader ialah ~width*1.3 (riverMask smoothstep(w*1.3,w*0.25,d))
				// — mulakan ofset SELEPAS itu (×1.6 keatas) supaya sentiasa di
				// luar air tidak kira lebar segmen.
				const bankDist = seg.width * c.bankFrac * c.bankSide;
				const crossed = new THREE.Vector3().crossVectors(along, u);
				const perp = crossed.length() > 0.001 ? crossed : v.clone();
				const dir = along.clone().addScaledVector(perp.normalize(), bankDist).normalize();
				// Skala dibesarkan ~1.6x drpd asal (0.08-0.15) — sepadan dgn
				// pembesaran hutan am di buildFeatureTreeSpots.
				spots.push(placeTree(dir, 0.13, 0.24, rng, warm, variantCount));
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
 * ditukar warna): kluster bulat gelap & tunggul tirus dgn hujung bulat —
 * tiada kon pain langsung. Warna kekal keluarga HIJAU (lihat placeTree)
 * tapi hue/kecerahan berbeza drpd Luminara supaya dua hemisfera jelas
 * kelihatan berbeza reka bentuk & tona pokoknya. */
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

/** Pokok mati — batang tunggul + dahan nipis condong tak simetri (tiada
 * kanopi langsung), utk kedalaman/realistik di kawasan hutan (gema
 * rujukan: hutan pain dgn beberapa pokok botak bercampur). Dikongsi
 * antara Luminara & Noctira (kayu mati sama rupa tak kira hemisfera, tona
 * warnanya varias sendiri via instanceColor). */
function buildDeadTreeVariants(): THREE.BufferGeometry[] {
	const rngA = seededRng(5551);
	const trunkA = new THREE.CylinderGeometry(0.004, 0.007, 0.075, 5);
	trunkA.translate(0, 0.0375, 0);
	const piecesA: THREE.BufferGeometry[] = [trunkA];
	for (let i = 0; i < 3; i++) {
		const h = 0.03 + rngA() * 0.02;
		const branch = new THREE.CylinderGeometry(0.0015, 0.003, h, 4);
		branch.translate(0, h / 2, 0);
		branch.rotateX((rngA() - 0.5) * 1.4);
		branch.rotateZ((rngA() - 0.5) * 1.4);
		branch.translate(0, 0.04 + rngA() * 0.03, 0);
		piecesA.push(branch);
	}
	const variantA = mergeGeoms(piecesA);

	const stumpB = new THREE.CylinderGeometry(0.006, 0.009, 0.03, 6);
	stumpB.translate(0, 0.015, 0);
	const snapTop = new THREE.ConeGeometry(0.007, 0.014, 5);
	snapTop.rotateZ(0.35);
	snapTop.translate(0.002, 0.033, 0);
	const variantB = mergeGeoms([stumpB, snapTop]);

	return [variantA, variantB];
}

/** Pokok rendah-poligon diserak sebagai InstancedMesh (satu per varian
 * bentuk × hemisfera) pada kawasan hijau/Heartbloom DAN sepanjang tebing
 * sungai — rapat & padat macam hutan sebenar, dgn pelbagai bentuk, tona
 * warna gelap-ke-cerah per-pokok (bukan satu warna rata), taburan
 * berkluster tak sekata (bukan cakera/jalur genap), pokok mati bercampur,
 * & reka bentuk Luminara/Noctira yg jelas berlainan. */
export default function Vegetation({ atmosphereBlendRef }: VegetationProps) {
	const spots = useMemo(() => [...buildFeatureTreeSpots(), ...buildRiverbankTreeSpots()], []);
	const luminaraVariants = useMemo(() => buildLuminaraVariants(), []);
	const noctiraVariants = useMemo(() => buildNoctiraVariants(), []);
	const deadVariants = useMemo(() => buildDeadTreeVariants(), []);

	const trunkWarmMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.8, transparent: true, opacity: 0 }),
		[],
	);
	const trunkColdMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
		[],
	);
	const canopyWarmMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#ffffff',
				emissive: '#33401a',
				emissiveIntensity: 0.35,
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
				color: '#ffffff',
				emissive: '#16261c',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.6,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const deadMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.95, transparent: true, opacity: 0 }),
		[],
	);

	const materials = useMemo(
		() => [trunkWarmMaterial, trunkColdMaterial, canopyWarmMaterial, canopyColdMaterial, deadMaterial],
		[trunkWarmMaterial, trunkColdMaterial, canopyWarmMaterial, canopyColdMaterial, deadMaterial],
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
		for (const s of spots) if (s.warm && !s.dead) groups[s.variant].push(s);
		return groups;
	}, [spots, luminaraVariants.length]);

	const coldByVariant = useMemo(() => {
		const groups: TreeSpot[][] = Array.from({ length: noctiraVariants.length }, () => []);
		for (const s of spots) if (!s.warm && !s.dead) groups[s.variant].push(s);
		return groups;
	}, [spots, noctiraVariants.length]);

	const deadByVariant = useMemo(() => {
		const groups: TreeSpot[][] = Array.from({ length: deadVariants.length }, () => []);
		for (const s of spots) if (s.dead) groups[s.variant].push(s);
		return groups;
	}, [spots, deadVariants.length]);

	const makeInstances = (
		list: TreeSpot[],
		geometry: THREE.BufferGeometry,
		material: THREE.Material,
		colorOf: (spot: TreeSpot) => THREE.Color,
	) => {
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
						mesh.setColorAt(i, colorOf(spot));
					});
					mesh.instanceMatrix.needsUpdate = true;
					if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
				}}
			/>
		);
	};

	return (
		<group>
			{luminaraVariants.map((v, i) => (
				<group key={`warm-${i}`}>
					{makeInstances(warmByVariant[i], v.trunk, trunkWarmMaterial, (s) => s.trunkColor)}
					{makeInstances(warmByVariant[i], v.canopy, canopyWarmMaterial, (s) => s.canopyColor)}
				</group>
			))}
			{noctiraVariants.map((v, i) => (
				<group key={`cold-${i}`}>
					{makeInstances(coldByVariant[i], v.trunk, trunkColdMaterial, (s) => s.trunkColor)}
					{makeInstances(coldByVariant[i], v.canopy, canopyColdMaterial, (s) => s.canopyColor)}
				</group>
			))}
			{deadVariants.map((geo, i) => (
				<group key={`dead-${i}`}>{makeInstances(deadByVariant[i], geo, deadMaterial, (s) => s.trunkColor)}</group>
			))}
		</group>
	);
}
