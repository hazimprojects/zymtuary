import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { PERIMETER_BUILDINGS } from './veilroseBuildings';
import { VEILROSE_PALETTE } from './veilrosePalette';
import { VEILROSE_QUARTER_BOUNDS } from './veilroseQuarterTerrain';

/** Jejari berjalan kuartir — lebih besar daripada plaza pusat, merangkumi lorong. */
export const VEILROSE_ISLAND_RADIUS = Math.max(VEILROSE_QUARTER_BOUNDS.halfWidth, VEILROSE_QUARTER_BOUNDS.halfDepth);

const MEMORY_ROOM_CURVE_RADIUS = 4.2;
const MEMORY_ROOM_HALF_SPAN = 1.35;

function memoryRoomObstaclePoints(facingAngle: number): { dx: number; dz: number; radius: number }[] {
	const segments = 7;
	const angles = Array.from({ length: segments }, (_, i) =>
		THREE.MathUtils.lerp(-MEMORY_ROOM_HALF_SPAN, MEMORY_ROOM_HALF_SPAN, i / (segments - 1)),
	);
	const rot = facingAngle + Math.PI;
	return angles.map((a) => {
		const lx = MEMORY_ROOM_CURVE_RADIUS * Math.sin(a);
		const lz = MEMORY_ROOM_CURVE_RADIUS * (Math.cos(a) - 1);
		return {
			dx: lx * Math.cos(rot) - lz * Math.sin(rot),
			dz: lx * Math.sin(rot) + lz * Math.cos(rot),
			radius: 0.85,
		};
	});
}

/**
 * Susun atur kartesian Veilrose Quarter — kuartir bandar dengan plaza
 * tertutup, Memory Room sebagai dinding perimeter, lorong ke spot tersorok.
 */
const SPOT_LAYOUT: Record<
	string,
	{
		x: number;
		z: number;
		scale: number;
		groundColor: string;
		obstacleRadius?: number;
		obstaclePoints?: { dx: number; dz: number; radius: number }[];
	}
> = {
	'The Applause Steps': {
		x: 0,
		z: 1,
		scale: 1,
		groundColor: VEILROSE_PALETTE.cream,
		obstacleRadius: 0.25,
	},
	'The Memory Room of Smiling Frames': {
		x: -10,
		z: 2,
		scale: 1,
		groundColor: VEILROSE_PALETTE.purple,
		obstaclePoints: memoryRoomObstaclePoints(Math.atan2(-10, 2)),
	},
	"The Mask Vendor's Row": {
		x: -3,
		z: 7.5,
		scale: 1,
		groundColor: VEILROSE_PALETTE.pink,
		obstaclePoints: [
			{ dx: -5, dz: 0, radius: 0.64 },
			{ dx: -3, dz: 0, radius: 0.86 },
			{ dx: -1, dz: 0, radius: 1.01 },
			{ dx: 1, dz: 0, radius: 0.75 },
			{ dx: 3, dz: 0, radius: 0.9 },
			{ dx: 5, dz: 0, radius: 0.71 },
		],
	},
	'The Rehearsal Mirrors': {
		x: 9,
		z: -7.5,
		scale: 1,
		groundColor: VEILROSE_PALETTE.purple,
		obstaclePoints: [
			{ dx: -0.925, dz: 0.594, radius: 0.48 },
			{ dx: 0, dz: 1.1, radius: 0.48 },
			{ dx: 0.925, dz: 0.594, radius: 0.48 },
		],
	},
	'The Room of Fallen Petals': {
		x: 1.5,
		z: -13.5,
		scale: 0.95,
		groundColor: VEILROSE_PALETTE.ash,
		obstaclePoints: [
			{ dx: -0.76, dz: 0, radius: 0.25 },
			{ dx: 0.76, dz: 0, radius: 0.25 },
		],
	},
};

/** Titik mula di mulut jalan utara — menghadap plaza. */
export const VEILROSE_SPAWN: [number, number, number] = [0, 0, 11];

const SPAWN_POINT: [number, number] = [VEILROSE_SPAWN[0], VEILROSE_SPAWN[2]];
const SPAWN_KEEPOUT = 1.8;

const SPOT_KEEPOUTS: { x: number; z: number; r: number }[] = Object.values(SPOT_LAYOUT).map((cfg) => ({
	x: cfg.x,
	z: cfg.z,
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
		const cfg = SPOT_LAYOUT[spot.nama] ?? {
			x: 0,
			z: 4,
			scale: 1,
			groundColor: VEILROSE_PALETTE.gold,
		};
		return {
			id: spot.nama,
			nama: spot.nama,
			position: new THREE.Vector3(cfg.x, 0, cfg.z),
			groundColor: cfg.groundColor,
			scale: cfg.scale,
			obstacleRadius: cfg.obstacleRadius,
			obstaclePoints: cfg.obstaclePoints,
		};
	});
}

/** Perlanggaran bangunan perimeter — membentuk dinding tidak boleh ditembusi. */
export function layoutBuildingColliders(): KawasanAnchor[] {
	return PERIMETER_BUILDINGS.map((b, i) => ({
		id: `__building_${i}`,
		nama: '',
		position: new THREE.Vector3(b.x, 0, b.z),
		groundColor: VEILROSE_PALETTE.gold,
		scale: 1,
		obstaclePoints: [{ dx: 0, dz: 0, radius: Math.max(b.width, b.depth) * 0.52 }],
	}));
}

/** Gerai mawar di lorong & sudut — ganjaran visual sepanjang laluan. */
export const AMBIENT_ROSE_STALLS: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: 5.5, z: 5.2, rot: 0.4, scale: 0.82 },
	{ x: -6.5, z: 5.8, rot: -0.5, scale: 0.75 },
	{ x: 7.2, z: -2.5, rot: 1.0, scale: 0.78 },
	{ x: 6.8, z: -9.5, rot: -0.8, scale: 0.72 },
	{ x: 3.5, z: -11.5, rot: 0.6, scale: 0.8 },
	{ x: -2.5, z: -10.8, rot: 1.2, scale: 0.74 },
	{ x: -5.5, z: -13.2, rot: -0.4, scale: 0.7 },
	{ x: 4.2, z: -14.2, rot: 0.9, scale: 0.76 },
	{ x: 10.5, z: -4.5, rot: -1.1, scale: 0.68 },
	{ x: -8.5, z: -5.5, rot: 0.3, scale: 0.72 },
].filter((s) => isClearOfSpotsAndSpawn(s.x, s.z));

export const AMBIENT_FLOWERING_TREES: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: 5.8, z: -5.5, rot: 0.2, scale: 0.88 },
	{ x: 3.2, z: -12.5, rot: -0.5, scale: 0.82 },
	{ x: -4.5, z: -12.8, rot: 1.0, scale: 0.78 },
	{ x: 7.5, z: -11.2, rot: -1.2, scale: 0.85 },
	{ x: -6.8, z: -8.5, rot: 0.6, scale: 0.8 },
	{ x: 2.8, z: 9.5, rot: -0.3, scale: 0.9 },
].filter((t) => isClearOfSpawn(t.x, t.z));

const GRASS_COUNT = 38;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const AMBIENT_GRASS_TUFTS: { x: number; z: number; rot: number; scale: number }[] = (() => {
	const tufts: { x: number; z: number; rot: number; scale: number }[] = [];
	for (let i = 0; tufts.length < GRASS_COUNT && i < GRASS_COUNT * 3; i++) {
		const t = i / (GRASS_COUNT * 3);
		const x = (t - 0.5) * 22;
		const z = 6 - t * 24;
		if (!isClearOfSpotsAndSpawn(x, z)) continue;
		if (Math.abs(x) > 11 && z > 0) continue;
		tufts.push({
			x,
			z,
			rot: (i * 0.37) % (Math.PI * 2),
			scale: 0.65 + ((i * 53) % 30) / 100,
		});
	}
	return tufts;
})();

/** Bendera rentang lorong — gaya perayaan Mediterranean. */
export const ALLEY_FLAG_LINES: {
	from: [number, number, number];
	to: [number, number, number];
}[] = [
	{ from: [-5.5, 2.6, 6.5], to: [5.5, 2.6, 6.5] },
	{ from: [5.5, 2.4, 2], to: [11.5, 2.4, -4] },
	{ from: [4, 2.2, -6], to: [11, 2.2, -9] },
	{ from: [-3, 2.3, -8], to: [3, 2.3, -11] },
];

/** Hiasan sudut lorong — bangku, pasu, lampu (tiada perlanggaran). */
export const ALLEY_CORNER_DECOR: {
	x: number;
	z: number;
	rot: number;
	kind: 'bench' | 'pot' | 'lamp';
}[] = [
	{ x: 5.2, z: 4.8, rot: -0.5, kind: 'bench' },
	{ x: 7.8, z: -3.2, rot: 0.8, kind: 'pot' },
	{ x: 6.2, z: -8.5, rot: -0.3, kind: 'lamp' },
	{ x: -5.8, z: -7.5, rot: 1.1, kind: 'bench' },
	{ x: 2.5, z: -10.5, rot: 0.4, kind: 'pot' },
	{ x: -3.5, z: -11.8, rot: -0.7, kind: 'lamp' },
];
