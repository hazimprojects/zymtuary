import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VEILROSE_PALETTE } from './veilrosePalette';

/** Plaza Veilrose lebih luas daripada pulau Mendari — ruang uji pergerakan Zym,
 * dan cukup besar untuk 5 spot tanpa berasak-asak. */
export const VEILROSE_ISLAND_RADIUS = 13;
const LAYOUT_SCALE = VEILROSE_ISLAND_RADIUS / 6.4;

/**
 * Susun atur Veilrose Quarter ikut kawasan_deskripsi/spot_utama sebenar —
 * The Applause Steps di tengah pasar (dideskripsikan "di tengah pasar"),
 * spot-spot "hadapan pentas" (Memory Room, Mask Vendor's Row) lebih
 * terbuka, manakala spot "belakang tabir" (Rehearsal Mirrors, Room of
 * Fallen Petals) diletak lebih jauh/tersorok mengikut lore masing-masing.
 * Warna tanah setiap spot diambil daripada VEILROSE_PALETTE supaya saling
 * berkaitan, bukan dipilih berasingan mengikut objek.
 *
 * `obstacleRadius`/`obstaclePoints` menggantikan formula perlanggaran global
 * (lihat resolveCharacterObstacles dalam ZymCharacterController.tsx) untuk
 * spot yang patut boleh dipijak/dilalui (dais tangga) atau yang bentuknya
 * bukan bulatan seragam (barisan gerai panjang). Nilai dx/dz dalam
 * obstaclePoints sudah dalam unit dunia (skala anchor sudah dikira).
 */
const SPOT_LAYOUT: Record<
	string,
	{
		angle: number;
		radius: number;
		scale: number;
		groundColor: string;
		obstacleRadius?: number;
		obstaclePoints?: { dx: number; dz: number; radius: number }[];
	}
> = {
	'The Applause Steps': {
		angle: 0,
		radius: 0,
		// scale 1 sengaja — geometri dais diambil terus daripada
		// heartStepRadius/heartStepTierHeight (unit dunia sebenar) supaya
		// tangga yang kelihatan sepadan tepat dengan permukaan boleh-jalan;
		// sebarang faktor skala tambahan di sini akan menyebabkannya lari
		// daripada tanah sebenar semula.
		scale: 1,
		groundColor: VEILROSE_PALETTE.cream,
		// Boleh dipijak/didaki — permukaan tanah (heart-step tiers) sendiri
		// yang membentuk "dinding", bukan bulatan perlanggaran ini.
		obstacleRadius: 0.25,
	},
	'The Memory Room of Smiling Frames': {
		angle: 0.95,
		radius: 4.2 * LAYOUT_SCALE,
		scale: 1.15,
		groundColor: VEILROSE_PALETTE.purple,
		// Meliputi sudut terjauh kotak (3.6x2.8 pada scale 1.15) supaya watak
		// tidak menembusi bucu bangunan yang terlepas pandang oleh bulatan
		// yang lebih kecil.
		obstacleRadius: 2.65,
	},
	"The Mask Vendor's Row": {
		angle: -2.15,
		radius: 4.4 * LAYOUT_SCALE,
		scale: 1.0,
		groundColor: VEILROSE_PALETTE.pink,
		obstaclePoints: [
			{ dx: -3, dz: 0, radius: 0.75 },
			{ dx: -1.5, dz: 0, radius: 0.75 },
			{ dx: 0, dz: 0, radius: 0.75 },
			{ dx: 1.5, dz: 0, radius: 0.75 },
			{ dx: 3, dz: 0, radius: 0.75 },
		],
	},
	'The Rehearsal Mirrors': {
		angle: 2.4,
		radius: 4.3 * LAYOUT_SCALE,
		scale: 1.0,
		groundColor: VEILROSE_PALETTE.purple,
		obstaclePoints: [
			{ dx: -0.925, dz: 0.594, radius: 0.48 },
			{ dx: 0, dz: 1.1, radius: 0.48 },
			{ dx: 0.925, dz: 0.594, radius: 0.48 },
		],
	},
	'The Room of Fallen Petals': {
		angle: -0.75,
		radius: 4.5 * LAYOUT_SCALE,
		scale: 0.95,
		groundColor: VEILROSE_PALETTE.ash,
		obstaclePoints: [
			{ dx: -0.76, dz: 0, radius: 0.25 },
			{ dx: 0.76, dz: 0, radius: 0.25 },
		],
	},
};

/** Watak Zym bermula di (0, 5.5) — hiasan ambien (rumput/pokok) dijana
 * secara prosedur dan tidak sedar akan titik ini atau kedudukan spot, jadi
 * ia mesti ditapis secara eksplisit supaya tiada hiasan tersepit betul-betul
 * di atas titik mula (yang akan buat kamera terasa "terperangkap" dalam
 * objek raksasa pada saat pertama) atau menembusi jejak landmark sedia ada. */
const SPAWN_POINT: [number, number] = [0, 5.5];
const SPAWN_KEEPOUT = 1.6;
const SPOT_KEEPOUTS: { x: number; z: number; r: number }[] = Object.values(SPOT_LAYOUT).map((cfg) => ({
	x: Math.cos(cfg.angle) * cfg.radius,
	z: Math.sin(cfg.angle) * cfg.radius,
	r: cfg.scale * 1.8 + 1.3,
}));

function isClearOfSpawn(x: number, z: number): boolean {
	return Math.hypot(x - SPAWN_POINT[0], z - SPAWN_POINT[1]) >= SPAWN_KEEPOUT;
}

function isClearOfSpotsAndSpawn(x: number, z: number): boolean {
	if (!isClearOfSpawn(x, z)) return false;
	return SPOT_KEEPOUTS.every((k) => Math.hypot(x - k.x, z - k.z) >= k.r);
}

export function layoutVeilroseAnchors(spots: { nama: string }[]): KawasanAnchor[] {
	return spots.map((spot) => {
		const cfg = SPOT_LAYOUT[spot.nama] ?? { angle: 0, radius: 4 * LAYOUT_SCALE, scale: 1, groundColor: VEILROSE_PALETTE.gold };
		return {
			id: spot.nama,
			nama: spot.nama,
			position: new THREE.Vector3(Math.cos(cfg.angle) * cfg.radius, 0, Math.sin(cfg.angle) * cfg.radius),
			groundColor: cfg.groundColor,
			scale: cfg.scale,
			obstacleRadius: cfg.obstacleRadius,
			obstaclePoints: cfg.obstaclePoints,
		};
	});
}

/** Kedudukan hiasan gerai bunga mawar rawak di sekeliling plaza — mengisi
 * ruang supaya "pasar terbuka dipenuhi gerai bunga mawar" terasa padat &
 * hidup, bukan sekadar 3 objek terpencil dalam ruang kosong. */
export const AMBIENT_ROSE_STALLS: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: 3.4, z: 2.6, rot: 0.4, scale: 0.85 },
	{ x: -2.9, z: 3.9, rot: -0.6, scale: 0.7 },
	{ x: 2.3, z: -4.2, rot: 1.1, scale: 0.9 },
	{ x: -4.2, z: -1.9, rot: -1.4, scale: 0.75 },
	{ x: 9.1, z: -0.6, rot: 0.2, scale: 0.8 },
	{ x: -8.5, z: 1.8, rot: 0.9, scale: 0.72 },
	{ x: 6.2, z: 5.4, rot: -0.3, scale: 0.78 },
	{ x: -5.8, z: -5.1, rot: 1.5, scale: 0.82 },
	{ x: 1.2, z: 7.8, rot: 0.7, scale: 0.74 },
	{ x: -7.2, z: 4.6, rot: -1.1, scale: 0.8 },
];

/** Pokok bunga hiasan — beberapa sengaja ditempatkan berhampiran spot
 * "belakang tabir" (Rehearsal Mirrors, Room of Fallen Petals) supaya
 * melindungi pandangan ke situ, selaras dengan lore kedua-dua spot itu
 * ("tersorok", "dibuang jauh dari mata pengunjung"). Selebihnya mengisi
 * ruang kosong di keliling plaza. */
export const AMBIENT_FLOWERING_TREES: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: -7.8, z: 4.2, rot: 0.2, scale: 1.0 },
	{ x: -5.0, z: 7.6, rot: -0.5, scale: 0.85 },
	{ x: 8.2, z: -4.8, rot: 1.0, scale: 0.95 },
	{ x: 5.2, z: -8.0, rot: -1.2, scale: 0.9 },
	{ x: 0.4, z: -9.4, rot: 0.6, scale: 0.8 },
	{ x: 9.4, z: 2.2, rot: -0.8, scale: 0.9 },
	{ x: -9.2, z: -2.6, rot: 1.4, scale: 0.85 },
	{ x: 2.6, z: 9.2, rot: -0.3, scale: 0.95 },
].filter((tree) => isClearOfSpawn(tree.x, tree.z));

/** Rumput hiasan — taburan padat menggunakan sudut emas supaya organik,
 * bukan grid seragam. Elak zon tengah (Tangga Tepukan/Barisan) dan luar
 * plaza rata supaya tidak bercampur dengan cerun tepi. */
const GRASS_COUNT = 46;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// Jejari min/max dipilih terus (bukan LAYOUT_SCALE) supaya sentiasa kekal di
// antara jejari Tangga Tepukan (~3.6) dan tepi rata plaza (edgeStart ≈
// islandRadius*0.74 ≈ 9.6), mengelakkan rumput "terapung" di cerun tepi.
// Calonnya dijana lebih daripada GRASS_COUNT dan ditapis (isClearOfSpotsAndSpawn)
// supaya tiada rumput tersepit di titik mula watak atau menembusi landmark.
export const AMBIENT_GRASS_TUFTS: { x: number; z: number; rot: number; scale: number }[] = (() => {
	const tufts: { x: number; z: number; rot: number; scale: number }[] = [];
	for (let i = 0; tufts.length < GRASS_COUNT && i < GRASS_COUNT * 3; i++) {
		const t = i / (GRASS_COUNT * 3);
		const radius = 4.0 + t * 5.0;
		const angle = i * GOLDEN_ANGLE * 2.4;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		if (!isClearOfSpotsAndSpawn(x, z)) continue;
		tufts.push({
			x,
			z,
			rot: (i * 0.37) % (Math.PI * 2),
			scale: 0.65 + ((i * 53) % 30) / 100,
		});
	}
	return tufts;
})();
