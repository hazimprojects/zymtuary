import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng, tangentBasis, localToDir } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type MendariTownscapeProps = {
	/** Sama seperti Vegetation/Aethirion — kota hanya kelihatan sepenuhnya
	 * apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
	/** Ketik/klik model kota sendiri utk masuk — hanya aktif bila descent
	 * sudah cukup dekat (gantikan butang terapung yg menutup pandangan). */
	enterEnabled?: boolean;
	onEnter?: () => void;
};

const UP = new THREE.Vector3(0, 1, 0);
// MESTI sepadan dgn radius 'mendari-kota' dlm worldGlobeConfig.ts — jejari
// dibesarkan drpd 0.13 asal (~1.7x, luas ~3x) supaya kota "3x lebih besar"
// tanpa bertindih dgn Laut Keemasan yg berdekatan.
const MENDARI_RADIUS = 0.22;

function angularDist(a: number, b: number): number {
	return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** Sempadan kota tak sekata (harmonik sudut) — elak "bulatan cantik" genap
 * (pengajaran drpd Vegetation.tsx round sebelum ini). */
function buildIrregularBoundary(rng: () => number): (theta: number) => number {
	const a1 = 0.12 + rng() * 0.1;
	const p1 = rng() * Math.PI * 2;
	const a2 = 0.06 + rng() * 0.08;
	const p2 = rng() * Math.PI * 2;
	return (theta: number) => 1 + a1 * Math.cos(theta + p1) + a2 * Math.cos(2 * theta + p2);
}

/**
 * MENDARI ialah kota berbilang KAWASAN bernama (Codex/zip-model.json) —
 * bukan satu bandar rata:
 *  - Veilrose Quarter ("jantung Mendari") — pasar mawar terbuka, jambu→fuchsia.
 *  - Faceless Bazaar — kedai berpindah susun setiap kunjungan, tak pernah tetap.
 *  - Idlewick — neon pastel + muzik tak henti (gema carousel sedia ada).
 *  - Harlequin's Corner — lebih kecil & intim, kopi & lilin.
 *  - Velvet Alcove — kawasan paling teduh, pokok berdaun jambu lembut.
 * Setiap satu diberi SEKTOR SUDUT sendiri (bukan serata) supaya "dikumpul
 * bersama" sbg kawasan tersendiri dlm satu kota, sepadan lore. Rumah biasa
 * mengisi jurang antara sektor.
 */
type ZoneId = 'veilrose' | 'faceless' | 'idlewick' | 'harlequin' | 'velvet';
type ZoneDef = { id: ZoneId; center: number; halfSpan: number };

const ZONES: ZoneDef[] = [
	{ id: 'veilrose', center: 0.0, halfSpan: 0.55 }, // jantung — sektor terbesar
	{ id: 'velvet', center: 1.35, halfSpan: 0.42 },
	{ id: 'faceless', center: 2.8, halfSpan: 0.45 },
	{ id: 'idlewick', center: 4.2, halfSpan: 0.38 },
	{ id: 'harlequin', center: 5.4, halfSpan: 0.28 }, // "lebih kecil & intim" — sektor terkecil
];

function classifyZone(angle: number): ZoneId | null {
	for (const z of ZONES) {
		if (angularDist(angle, z.center) < z.halfSpan) return z.id;
	}
	return null;
}

type HouseSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: number;
	variant: number;
};

const HOUSE_VARIANT_COUNT = 3;
const INNER_EXCLUSION = 0.05; // ruang utk carousel + air pancut di tengah

/** Rumah "biasa" (bukan kawasan bernama) mengisi JURANG antara sektor —
 * diserak organik (radial + sempadan tak sekata), MENGELAK kelima-lima
 * sektor kawasan supaya tidak bertindih dgn kandungan kawasan tersebut. */
function buildHouseSpots(count: number): HouseSpot[] {
	const spots: HouseSpot[] = [];
	const center = findLandmarkDirection('mendari-kota');
	const { u, v } = tangentBasis(center);
	const rng = seededRng(6501);
	const boundary = buildIrregularBoundary(rng);
	const maxAttempts = count * 8;

	let attempts = 0;
	while (spots.length < count && attempts < maxAttempts) {
		attempts++;
		const angle = rng() * Math.PI * 2;
		if (classifyZone(angle) !== null) continue;

		const maxR = MENDARI_RADIUS * 0.92 * boundary(angle);
		const r = INNER_EXCLUSION + Math.sqrt(rng()) * (maxR - INNER_EXCLUSION);
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));

		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		const scale = 0.55 + rng() * 0.55;
		const variant = Math.floor(rng() * HOUSE_VARIANT_COUNT);
		spots.push({ position, quaternion, scale, variant });
	}

	return spots;
}

type ZoneSpot = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number; colorIndex: number };

/** Serak spot dlm SATU sektor zon (angle center±halfSpan), radial-uniform. */
function buildZoneSpots(zone: ZoneDef, count: number, rMin: number, rMax: number, scaleMin: number, scaleMax: number, colorCount: number, seed: number): ZoneSpot[] {
	const center = findLandmarkDirection('mendari-kota');
	const { u, v } = tangentBasis(center);
	const rng = seededRng(seed);
	const spots: ZoneSpot[] = [];
	for (let i = 0; i < count; i++) {
		const angle = zone.center + (rng() - 0.5) * zone.halfSpan * 1.75;
		const r = rMin + Math.sqrt(rng()) * (rMax - rMin);
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));
		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		spots.push({
			position,
			quaternion,
			scale: scaleMin + rng() * (scaleMax - scaleMin),
			colorIndex: Math.floor(rng() * colorCount),
		});
	}
	return spots;
}

/** PENTING: mergeBufferGeometries GAGAL (pulang null) jika ada campuran
 * geometri BERINDEKS (Box/Cylinder/Cone/Sphere/Torus — indexed lalai) dgn
 * geometri TAK BERINDEKS (Icosahedron/Octahedron/dll — PolyhedronGeometry
 * sentiasa tak berindeks utk normal per-muka rata). toNonIndexed() SEMUA
 * kepingan dahulu supaya seragam sebelum cantum — elak kegagalan senyap
 * (yg sebelum ini menyebabkan fallback `?? pieces[0]` DIBUANG serta-merta
 * oleh dispose() gelung sama, memutuskan geometri null pada peringkat
 * render). toNonIndexed() pulangkan OBJEK SAMA jika geometri asal sudah
 * tak berindeks — guna Set supaya tak dispose dua kali/dispose objek yg
 * masih digunakan. */
function mergePieces(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const nonIndexed = pieces.map((p) => p.toNonIndexed());
	const merged = mergeBufferGeometries(nonIndexed, false);
	if (!merged) throw new Error('mergePieces: mergeBufferGeometries gagal walau selepas toNonIndexed()');
	const toDispose = new Set([...pieces, ...nonIndexed]);
	for (const p of toDispose) p.dispose();
	return merged;
}

function zoneDirPosition(zone: ZoneDef, r: number, centerDir: [number, number, number], u: [number, number, number], v: [number, number, number]): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
	const lu = Math.cos(zone.center) * r;
	const lv = Math.sin(zone.center) * r;
	const dir = new THREE.Vector3(...localToDir(centerDir, u, v, lu, lv));
	const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
	return { position, quaternion };
}

/**
 * Menara loceng Mendari — mercu tanda kota umum (bukan kawasan bernama),
 * diletak di jurang antara Velvet Alcove & Faceless Bazaar.
 */
function buildBellTowerGeo(): THREE.BufferGeometry {
	const pieces: THREE.BufferGeometry[] = [];
	let y = 0;
	const add = (topR: number, bottomR: number, h: number, segments = 8) => {
		const g = new THREE.CylinderGeometry(topR, bottomR, h, segments);
		g.translate(0, y + h / 2, 0);
		pieces.push(g);
		y += h;
	};
	add(0.021, 0.024, 0.05);
	add(0.017, 0.02, 0.035);
	add(0.014, 0.016, 0.022);
	const roof = new THREE.ConeGeometry(0.02, 0.03, 8);
	roof.translate(0, y + 0.015, 0);
	pieces.push(roof);
	return mergePieces(pieces);
}

const HOUSE_ROOF_COLORS = ['#d9698f', '#c97a3a', '#b8506e'] as const;
const HOUSE_WALL_COLORS = ['#d9b878', '#e0c290', '#cfae70'] as const;

type HouseVariant = { wallGeo: THREE.BufferGeometry; roofGeo: THREE.BufferGeometry; bloomGeo: THREE.BufferGeometry };

/** 3 bentuk rumah berlainan (pondok/rumah-teres/rumah-lebar), setiap satu
 * ada "bloom" bougainvillea di puncak bumbung. */
function buildHouseVariants(): HouseVariant[] {
	const wall0 = new THREE.BoxGeometry(0.024, 0.02, 0.024);
	wall0.translate(0, 0.01, 0);
	const roof0 = new THREE.ConeGeometry(0.019, 0.016, 4);
	roof0.rotateY(Math.PI / 4);
	roof0.translate(0, 0.028, 0);
	const bloom0 = new THREE.IcosahedronGeometry(0.007, 0);
	bloom0.translate(0, 0.038, 0);

	const wall1 = new THREE.BoxGeometry(0.02, 0.032, 0.02);
	wall1.translate(0, 0.016, 0);
	const roof1 = new THREE.ConeGeometry(0.016, 0.02, 4);
	roof1.rotateY(Math.PI / 4);
	roof1.translate(0, 0.042, 0);
	const bloom1 = new THREE.IcosahedronGeometry(0.0065, 0);
	bloom1.translate(0, 0.053, 0);

	const wall2 = new THREE.BoxGeometry(0.033, 0.022, 0.026);
	wall2.translate(0, 0.011, 0);
	const roof2 = new THREE.ConeGeometry(0.023, 0.017, 4);
	roof2.rotateY(Math.PI / 4);
	roof2.translate(0, 0.03, 0);
	const bloom2 = new THREE.IcosahedronGeometry(0.008, 0);
	bloom2.translate(0, 0.039, 0);

	return [
		{ wallGeo: wall0, roofGeo: roof0, bloomGeo: bloom0 },
		{ wallGeo: wall1, roofGeo: roof1, bloomGeo: bloom1 },
		{ wallGeo: wall2, roofGeo: roof2, bloomGeo: bloom2 },
	];
}

// --- Veilrose Quarter: pasar mawar (gema VEILROSE_PALETTE — gold/pink/purple/cream) ---
const VEILROSE_STALL_COLORS = ['#F2D9A0', '#E8A8A0', '#C9A0C4', '#FFF6E8'] as const;

function buildVeilroseStallGeo(): THREE.BufferGeometry {
	const counter = new THREE.BoxGeometry(0.02, 0.012, 0.014);
	counter.translate(0, 0.006, 0);
	const awning = new THREE.BoxGeometry(0.026, 0.003, 0.02);
	awning.rotateX(-0.15);
	awning.translate(0, 0.017, -0.004);
	return mergePieces([counter, awning]);
}

function buildRoseBushGeo(): THREE.BufferGeometry {
	const rng = seededRng(2201);
	const pieces: THREE.BufferGeometry[] = [];
	for (let j = 0; j < 4; j++) {
		const g = new THREE.IcosahedronGeometry(0.0055 + rng() * 0.003, 0);
		g.translate((rng() - 0.5) * 0.014, 0.005 + rng() * 0.004, (rng() - 0.5) * 0.014);
		pieces.push(g);
	}
	return mergePieces(pieces);
}

// --- Faceless Bazaar: kedai tak simetri/senget, tona kelabu-mauve pudar (gema "tak pernah tetap") ---
const FACELESS_SHOP_COLORS = ['#B0A89C', '#B5766E', '#9a8f9c', '#a89aa0'] as const;

function buildFacelessShopGeo(): THREE.BufferGeometry {
	const rng = seededRng(3302);
	const box = new THREE.BoxGeometry(0.019 + rng() * 0.006, 0.017 + rng() * 0.006, 0.019 + rng() * 0.006);
	box.rotateZ((rng() - 0.5) * 0.18);
	box.rotateY((rng() - 0.5) * 0.3);
	box.translate(0, 0.011, 0);
	// Bumbung leper senget (bukan kon simetri) — kesan "tak pernah selesai/tetap".
	const lid = new THREE.BoxGeometry(0.024, 0.004, 0.024);
	lid.rotateZ((rng() - 0.5) * 0.35);
	lid.translate(0, 0.021, 0);
	return mergePieces([box, lid]);
}

// --- Idlewick: tiang lampu neon pastel + carousel (sedia ada) ---
const IDLEWICK_NEON_COLORS = ['#f4b6d2', '#a6d8f0', '#f5eda0'] as const;

function buildNeonLampGeo(): THREE.BufferGeometry {
	const pole = new THREE.CylinderGeometry(0.0012, 0.0018, 0.026, 5);
	pole.translate(0, 0.013, 0);
	const bulb = new THREE.IcosahedronGeometry(0.005, 1);
	bulb.translate(0, 0.028, 0);
	return mergePieces([pole, bulb]);
}

// --- Harlequin's Corner: lampu lilin hangat + satu bangunan kecil intim ---
function buildLanternGeo(): THREE.BufferGeometry {
	const pole = new THREE.CylinderGeometry(0.001, 0.0015, 0.018, 5);
	pole.translate(0, 0.009, 0);
	const flame = new THREE.IcosahedronGeometry(0.0035, 0);
	flame.translate(0, 0.019, 0);
	return mergePieces([pole, flame]);
}

function buildCornerNookGeo(): { wallGeo: THREE.BufferGeometry; roofGeo: THREE.BufferGeometry } {
	const wall = new THREE.BoxGeometry(0.028, 0.024, 0.024);
	wall.translate(0, 0.012, 0);
	const roof = new THREE.ConeGeometry(0.021, 0.018, 4);
	roof.rotateY(Math.PI / 4);
	roof.translate(0, 0.033, 0);
	return { wallGeo: wall, roofGeo: roof };
}

// --- Velvet Alcove: pokok berdaun jambu lembut (retema drpd hijau generik) + katil bunga jambu ---
function buildPinkTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(0.0028, 0.0042, 0.02, 5);
	trunk.translate(0, 0.01, 0);
	const canopy = new THREE.IcosahedronGeometry(0.015, 1);
	canopy.translate(0, 0.026, 0);
	return { trunk, canopy };
}

const VELVET_FLOWER_COLORS = ['#e8a8a0', '#d9698f', '#c9a0c4'] as const;

function buildVelvetFlowerVariants(): THREE.BufferGeometry[] {
	return VELVET_FLOWER_COLORS.map((_, i) => {
		const rng = seededRng(1120 + i);
		const pieces: THREE.BufferGeometry[] = [];
		for (let j = 0; j < 3; j++) {
			const g = new THREE.IcosahedronGeometry(0.005 + rng() * 0.003, 0);
			g.translate((rng() - 0.5) * 0.012, 0.004 + rng() * 0.003, (rng() - 0.5) * 0.012);
			pieces.push(g);
		}
		return mergePieces(pieces);
	});
}

/** Air pancut kecil di plaza (kolam + tiang tengah + sembur partikel) — satu
 * lagi mercu tanda plaza selain carousel. */
function buildFountainGeo(): { basinGeo: THREE.BufferGeometry; poleGeo: THREE.BufferGeometry } {
	const basin = new THREE.CylinderGeometry(0.018, 0.02, 0.008, 12);
	basin.translate(0, 0.004, 0);
	const rim = new THREE.TorusGeometry(0.018, 0.0025, 6, 14);
	rim.rotateX(Math.PI / 2);
	rim.translate(0, 0.008, 0);
	const pole = new THREE.CylinderGeometry(0.0025, 0.004, 0.014, 6);
	pole.translate(0, 0.007 + 0.008, 0);
	return { basinGeo: mergePieces([basin, rim]), poleGeo: pole };
}

type WaterSpray = { offset: THREE.Vector3; phase: number };

function buildWaterSpray(): WaterSpray[] {
	const rng = seededRng(4471);
	return Array.from({ length: 14 }, () => {
		const angle = rng() * Math.PI * 2;
		const r = rng() * 0.006;
		return { offset: new THREE.Vector3(Math.cos(angle) * r, rng() * 0.012, Math.sin(angle) * r), phase: rng() };
	});
}

function zoneOf(id: ZoneId): ZoneDef {
	const z = ZONES.find((zz) => zz.id === id);
	if (!z) throw new Error(`Zon "${id}" tidak dijumpai`);
	return z;
}

/**
 * Mendari — kota-taman Wilayah Lumiborne, kini merangkumi LIMA kawasan
 * bernama sedia ada dlm lore (zip-model.json) yg sebelum ini tak pernah
 * digemakan di peringkat globe: Veilrose Quarter (jantung/pasar mawar),
 * Faceless Bazaar (kedai tak pernah tetap), Idlewick (neon+muzik, gema
 * carousel), Harlequin's Corner (sudut intim), Velvet Alcove (taman teduh
 * berdaun jambu). Setiap satu diberi sektor sudut sendiri supaya
 * "dikumpul bersama" sbg satu kota, bukan diserak rata tanpa identiti.
 * Jejari kota dibesarkan 0.13→0.22 (~1.7x jejari, ~3x luas/kandungan).
 * Carousel asal ("The Carousel That Never Stops") dikekalkan tanpa
 * perubahan — signature Idlewick.
 */
export default function MendariTownscape({ atmosphereBlendRef, enterEnabled = false, onEnter }: MendariTownscapeProps) {
	const centerDir = useMemo(() => findLandmarkDirection('mendari-kota'), []);
	const dir = useMemo(() => new THREE.Vector3(...centerDir), [centerDir]);
	const { u: uArr, v: vArr } = useMemo(() => tangentBasis(centerDir), [centerDir]);
	const carouselPosition = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003), [dir]);
	const carouselQuaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);

	// Kiraan dinaikkan ~3x drpd asal (55→170 serata kawasan) utk kesan "kota
	// 3x lebih besar" dari segi kandungan.
	const houseSpots = useMemo(() => buildHouseSpots(150), []);
	const houseVariants = useMemo(() => buildHouseVariants(), []);
	const bellTowerGeo = useMemo(() => buildBellTowerGeo(), []);
	const { basinGeo: fountainBasinGeo, poleGeo: fountainPoleGeo } = useMemo(() => buildFountainGeo(), []);
	const waterSpray = useMemo(() => buildWaterSpray(), []);

	// --- Veilrose Quarter ---
	const veilroseZone = useMemo(() => zoneOf('veilrose'), []);
	const veilroseStalls = useMemo(() => buildZoneSpots(veilroseZone, 26, INNER_EXCLUSION * 1.2, MENDARI_RADIUS * 0.88, 0.8, 1.2, VEILROSE_STALL_COLORS.length, 7001), [veilroseZone]);
	const veilroseBushes = useMemo(() => buildZoneSpots(veilroseZone, 18, INNER_EXCLUSION, MENDARI_RADIUS * 0.9, 0.7, 1.1, 1, 7002), [veilroseZone]);
	const veilroseStallGeo = useMemo(() => buildVeilroseStallGeo(), []);
	const roseBushGeo = useMemo(() => buildRoseBushGeo(), []);

	// --- Faceless Bazaar ---
	const facelessZone = useMemo(() => zoneOf('faceless'), []);
	const facelessShops = useMemo(() => buildZoneSpots(facelessZone, 22, INNER_EXCLUSION * 1.2, MENDARI_RADIUS * 0.88, 0.8, 1.25, FACELESS_SHOP_COLORS.length, 8001), [facelessZone]);
	const facelessShopGeo = useMemo(() => buildFacelessShopGeo(), []);

	// --- Idlewick ---
	const idlewickZone = useMemo(() => zoneOf('idlewick'), []);
	const idlewickLamps = useMemo(() => buildZoneSpots(idlewickZone, 16, INNER_EXCLUSION * 1.1, MENDARI_RADIUS * 0.85, 0.8, 1.1, IDLEWICK_NEON_COLORS.length, 9001), [idlewickZone]);
	const neonLampGeo = useMemo(() => buildNeonLampGeo(), []);

	// --- Harlequin's Corner ---
	const harlequinZone = useMemo(() => zoneOf('harlequin'), []);
	const harlequinLanterns = useMemo(() => buildZoneSpots(harlequinZone, 10, INNER_EXCLUSION * 1.1, MENDARI_RADIUS * 0.7, 0.8, 1.0, 1, 10001), [harlequinZone]);
	const lanternGeo = useMemo(() => buildLanternGeo(), []);
	const { wallGeo: nookWallGeo, roofGeo: nookRoofGeo } = useMemo(() => buildCornerNookGeo(), []);
	const nookPosition = useMemo(() => zoneDirPosition(harlequinZone, MENDARI_RADIUS * 0.45, centerDir, uArr, vArr), [harlequinZone, centerDir, uArr, vArr]);

	// --- Velvet Alcove ---
	const velvetZone = useMemo(() => zoneOf('velvet'), []);
	const velvetTrees = useMemo(() => buildZoneSpots(velvetZone, 22, INNER_EXCLUSION, MENDARI_RADIUS * 0.88, 0.75, 1.15, 1, 11001), [velvetZone]);
	const velvetFlowers = useMemo(() => buildZoneSpots(velvetZone, 24, INNER_EXCLUSION * 0.7, MENDARI_RADIUS * 0.92, 0.6, 1.2, VELVET_FLOWER_COLORS.length, 11002), [velvetZone]);
	const { trunk: pinkTrunkGeo, canopy: pinkCanopyGeo } = useMemo(() => buildPinkTreeGeometry(), []);
	const velvetFlowerVariants = useMemo(() => buildVelvetFlowerVariants(), []);

	// Menara loceng — mercu tanda kota umum, di jurang antara Velvet Alcove &
	// Faceless Bazaar.
	const towerPosition = useMemo(() => {
		const angle = (velvetZone.center + velvetZone.halfSpan + facelessZone.center - facelessZone.halfSpan) / 2;
		const fakeZone: ZoneDef = { id: 'harlequin', center: angle, halfSpan: 0 };
		return zoneDirPosition(fakeZone, MENDARI_RADIUS * 0.62, centerDir, uArr, vArr);
	}, [velvetZone, facelessZone, centerDir, uArr, vArr]);
	const towerQuaternion = towerPosition.quaternion;

	// Air pancut betul2 di sisi carousel, condong ke arah Veilrose (pintu
	// masuk pasar) — plaza tengah ada DUA mercu tanda.
	const fountainSpot = useMemo(() => {
		const fakeZone: ZoneDef = { id: 'veilrose', center: veilroseZone.center + 0.55 * Math.PI, halfSpan: 0 };
		return zoneDirPosition(fakeZone, INNER_EXCLUSION * 1.6, centerDir, uArr, vArr);
	}, [veilroseZone, centerDir, uArr, vArr]);

	// --- Bahan (materials) ---
	const wallMats = useMemo(
		() => HOUSE_WALL_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, transparent: true, opacity: 0 })),
		[],
	);
	const roofMats = useMemo(
		() =>
			HOUSE_ROOF_COLORS.map(
				(c) =>
					new THREE.MeshStandardMaterial({
						color: c,
						emissive: '#5a1f30',
						emissiveIntensity: 0.3,
						flatShading: true,
						roughness: 0.6,
						transparent: true,
						opacity: 0,
					}),
			),
		[],
	);
	const bloomMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#e8547a', emissive: '#6a1a38', emissiveIntensity: 0.45, flatShading: true, roughness: 0.55, transparent: true, opacity: 0 }),
		[],
	);
	const carouselRoofMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#e8a34a', emissive: '#5a3410', emissiveIntensity: 0.35, flatShading: true, roughness: 0.55, transparent: true, opacity: 0 }),
		[],
	);
	const towerMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#d9b878', flatShading: true, roughness: 0.7, transparent: true, opacity: 0 }),
		[],
	);
	const fountainMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#b8a888', flatShading: true, roughness: 0.6, transparent: true, opacity: 0 }),
		[],
	);
	const waterTexture = useMemo(() => buildSpriteTexture(), []);
	const waterMat = useMemo(
		() =>
			new THREE.PointsMaterial({
				size: 0.006,
				map: waterTexture,
				color: '#cfeaff',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				sizeAttenuation: true,
				blending: THREE.AdditiveBlending,
			}),
		[waterTexture],
	);

	// Veilrose — guna warna sebenar drpd VEILROSE_PALETTE, base putih supaya
	// instanceColor tentukan hue sebenar (teknik sama dgn Vegetation.tsx).
	const veilroseStallMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.7, transparent: true, opacity: 0 }),
		[],
	);
	const roseBushMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#e8547a', emissive: '#6a1a38', emissiveIntensity: 0.4, flatShading: true, roughness: 0.55, transparent: true, opacity: 0 }),
		[],
	);
	const facelessShopMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const neonLampMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#ffffff',
				emissive: '#ffffff',
				emissiveIntensity: 0.7,
				flatShading: true,
				roughness: 0.4,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const lanternMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#4a3020', emissive: '#f0a030', emissiveIntensity: 0.6, flatShading: true, roughness: 0.6, transparent: true, opacity: 0 }),
		[],
	);
	const nookWallMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#c9a878', flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
		[],
	);
	const nookRoofMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#8a5a3a', emissive: '#3a2010', emissiveIntensity: 0.3, flatShading: true, roughness: 0.6, transparent: true, opacity: 0 }),
		[],
	);
	const pinkTrunkMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#6a4a4a', flatShading: true, roughness: 0.8, transparent: true, opacity: 0 }),
		[],
	);
	const pinkCanopyMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#e0a0ac', emissive: '#5a2a3a', emissiveIntensity: 0.3, flatShading: true, roughness: 0.65, transparent: true, opacity: 0 }),
		[],
	);
	const velvetFlowerMats = useMemo(
		() =>
			VELVET_FLOWER_COLORS.map(
				(c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, flatShading: true, roughness: 0.6, transparent: true, opacity: 0 }),
			),
		[],
	);

	// Menara loceng ialah MERCU TANDA kota — sama corak dgn Heartbloom/
	// Ascendari/Aethirion: kekal separa kelihatan dari orbit (lantai 0.55).
	// Semua kandungan kawasan/rumah/taman kekal lantai 0 — hanya kelihatan
	// bila rapat.
	const cityMats = useMemo(
		() => [
			...wallMats,
			...roofMats,
			bloomMat,
			carouselRoofMat,
			fountainMat,
			veilroseStallMat,
			roseBushMat,
			facelessShopMat,
			neonLampMat,
			lanternMat,
			nookWallMat,
			nookRoofMat,
			pinkTrunkMat,
			pinkCanopyMat,
			...velvetFlowerMats,
		],
		[wallMats, roofMats, bloomMat, carouselRoofMat, fountainMat, veilroseStallMat, roseBushMat, facelessShopMat, neonLampMat, lanternMat, nookWallMat, nookRoofMat, pinkTrunkMat, pinkCanopyMat, velvetFlowerMats],
	);
	const landmarkMats = useMemo(() => [towerMat], [towerMat]);

	const waterPositions = useMemo(() => new Float32Array(waterSpray.length * 3), [waterSpray.length]);
	const waterGeomRef = useRef<THREE.BufferGeometry>(null);

	const carouselBaseGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.03, 0.032, 0.012, 10);
		g.translate(0, 0.006, 0);
		return g;
	}, []);
	const carouselPoleGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6);
		g.translate(0, 0.012 + 0.025, 0);
		return g;
	}, []);
	const carouselRoofGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.034, 0.024, 10);
		g.translate(0, 0.012 + 0.05 + 0.012, 0);
		return g;
	}, []);
	const carouselSupportGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 4);
		g.translate(0, 0.012 + 0.025, 0);
		return g;
	}, []);
	const carouselSupportPositions = useMemo(() => {
		const r = 0.024;
		return [0, 1, 2, 3, 4, 5].map((i) => {
			const a = (i / 6) * Math.PI * 2;
			return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
		});
	}, []);

	const carouselRef = useRef<THREE.Group>(null);
	const spinAngle = useRef(0);

	useFrame(({ clock }, delta) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);

		for (const mat of cityMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		waterMat.opacity = THREE.MathUtils.lerp(waterMat.opacity, near * 0.8, 0.05);
		waterMat.visible = waterMat.opacity > 0.01;

		// Neon Idlewick berdenyut lembut (gema "muzik tak pernah henti").
		const neonPulse = 0.65 + 0.35 * Math.sin(clock.elapsedTime * 1.4);
		neonLampMat.emissiveIntensity = 0.7 * neonPulse;
		// Lilin Harlequin's Corner berkelip lebih perlahan/hangat.
		const flamePulse = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 2.6 + 1.7);
		lanternMat.emissiveIntensity = 0.6 * flamePulse;

		// Gubah quaternion (bukan mutate rotation.y terus) — carousel perlu
		// berputar mengelilingi paksi "atas" TEMPATANnya sendiri.
		spinAngle.current += delta * 0.25;
		if (carouselRef.current) {
			carouselRef.current.quaternion
				.copy(carouselQuaternion)
				.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spinAngle.current));
		}

		for (let i = 0; i < waterSpray.length; i++) {
			const w = waterSpray[i];
			const t = (clock.elapsedTime * 0.6 + w.phase) % 1;
			waterPositions[i * 3] = w.offset.x;
			waterPositions[i * 3 + 1] = 0.019 + t * 0.02;
			waterPositions[i * 3 + 2] = w.offset.z;
		}
		if (waterGeomRef.current) waterGeomRef.current.attributes.position.needsUpdate = true;
	});

	const houseByVariant = useMemo(() => {
		const groups: HouseSpot[][] = Array.from({ length: HOUSE_VARIANT_COUNT }, () => []);
		for (const s of houseSpots) groups[s.variant].push(s);
		return groups;
	}, [houseSpots]);

	const makeInstances = (
		list: (HouseSpot | ZoneSpot)[],
		geometry: THREE.BufferGeometry,
		material: THREE.Material,
		colorPalette?: readonly string[],
	) => {
		if (list.length === 0) return null;
		return (
			<instancedMesh
				args={[geometry, material, list.length]}
				ref={(mesh) => {
					if (!mesh) return;
					const m = new THREE.Matrix4();
					const col = new THREE.Color();
					list.forEach((spot, i) => {
						m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
						mesh.setMatrixAt(i, m);
						if (colorPalette && 'colorIndex' in spot) {
							col.set(colorPalette[spot.colorIndex % colorPalette.length]);
							mesh.setColorAt(i, col);
						}
					});
					mesh.instanceMatrix.needsUpdate = true;
					if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
				}}
			/>
		);
	};

	const handleClick = (e: ThreeEvent<MouseEvent>) => {
		if (!enterEnabled) return;
		e.stopPropagation();
		onEnter?.();
	};

	const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
		if (!enterEnabled) return;
		e.stopPropagation();
		document.body.style.cursor = 'pointer';
	};

	const handlePointerOut = () => {
		document.body.style.cursor = 'auto';
	};

	return (
		<group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
			{/* Rumah biasa mengisi jurang antara kawasan bernama */}
			{houseVariants.map((v, i) => (
				<group key={i}>
					{makeInstances(houseByVariant[i], v.wallGeo, wallMats[i])}
					{makeInstances(houseByVariant[i], v.roofGeo, roofMats[i])}
					{makeInstances(houseByVariant[i], v.bloomGeo, bloomMat)}
				</group>
			))}

			{/* Veilrose Quarter — pasar mawar */}
			{makeInstances(veilroseStalls, veilroseStallGeo, veilroseStallMat, VEILROSE_STALL_COLORS)}
			{makeInstances(veilroseBushes, roseBushGeo, roseBushMat)}

			{/* Faceless Bazaar — kedai tak simetri/senget */}
			{makeInstances(facelessShops, facelessShopGeo, facelessShopMat, FACELESS_SHOP_COLORS)}

			{/* Idlewick — tiang neon pastel di sekeliling carousel */}
			{makeInstances(idlewickLamps, neonLampGeo, neonLampMat, IDLEWICK_NEON_COLORS)}

			{/* Harlequin's Corner — lilin hangat + satu rumah nook kecil */}
			{makeInstances(harlequinLanterns, lanternGeo, lanternMat)}
			<mesh geometry={nookWallGeo} material={nookWallMat} position={nookPosition.position} quaternion={nookPosition.quaternion} />
			<mesh geometry={nookRoofGeo} material={nookRoofMat} position={nookPosition.position} quaternion={nookPosition.quaternion} />

			{/* Velvet Alcove — taman teduh berdaun jambu */}
			{makeInstances(velvetTrees, pinkTrunkGeo, pinkTrunkMat)}
			{makeInstances(velvetTrees, pinkCanopyGeo, pinkCanopyMat)}
			{velvetFlowers.map((spot, i) => {
				const variant = i % velvetFlowerVariants.length;
				return (
					<mesh
						key={i}
						geometry={velvetFlowerVariants[variant]}
						material={velvetFlowerMats[variant]}
						position={spot.position}
						quaternion={spot.quaternion}
						scale={spot.scale}
					/>
				);
			})}

			{/* Mercu tanda kota umum */}
			<mesh geometry={bellTowerGeo} material={towerMat} position={towerPosition.position} quaternion={towerQuaternion} />

			<group position={fountainSpot.position} quaternion={fountainSpot.quaternion}>
				<mesh geometry={fountainBasinGeo} material={fountainMat} />
				<mesh geometry={fountainPoleGeo} material={fountainMat} />
				<points>
					<bufferGeometry ref={waterGeomRef}>
						<bufferAttribute attach="attributes-position" args={[waterPositions, 3]} count={waterPositions.length / 3} itemSize={3} />
					</bufferGeometry>
					<primitive object={waterMat} attach="material" />
				</points>
			</group>

			<group ref={carouselRef} position={carouselPosition} quaternion={carouselQuaternion}>
				<mesh geometry={carouselBaseGeo} material={wallMats[0]} />
				<mesh geometry={carouselPoleGeo} material={wallMats[0]} />
				{carouselSupportPositions.map((pos, i) => (
					<mesh key={i} geometry={carouselSupportGeo} material={wallMats[0]} position={pos} />
				))}
				<mesh geometry={carouselRoofGeo} material={carouselRoofMat} />
			</group>
		</group>
	);
}
