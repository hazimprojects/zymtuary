import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { QUARTER_BUILDINGS, buildingColliderPoints } from './veilroseBuildings';
import { VEILROSE_PALETTE } from './veilrosePalette';
import { VEILROSE_QUARTER_BOUNDS } from './veilroseQuarterTerrain';

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
 * Spot diletak dalam "pocket" tersorok — tidak kelihatan dari sudut lain
 * kerana disekat bangunan di antara.
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
		z: 2,
		scale: 1,
		groundColor: VEILROSE_PALETTE.cream,
		obstacleRadius: 0.25,
	},
	'The Memory Room of Smiling Frames': {
		x: -18,
		z: 5,
		scale: 1,
		groundColor: VEILROSE_PALETTE.purple,
		obstaclePoints: memoryRoomObstaclePoints(Math.atan2(18, 2 - 5)),
	},
	"The Mask Vendor's Row": {
		x: -10,
		z: 12,
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
		x: 18,
		z: -14,
		scale: 1,
		groundColor: VEILROSE_PALETTE.purple,
		obstaclePoints: [
			{ dx: -0.925, dz: 0.594, radius: 0.48 },
			{ dx: 0, dz: 1.1, radius: 0.48 },
			{ dx: 0.925, dz: 0.594, radius: 0.48 },
		],
	},
	'The Room of Fallen Petals': {
		x: 3,
		z: -24,
		scale: 0.95,
		groundColor: VEILROSE_PALETTE.ash,
		obstaclePoints: [
			{ dx: -0.76, dz: 0, radius: 0.25 },
			{ dx: 0.76, dz: 0, radius: 0.25 },
		],
	},
};

export const VEILROSE_SPAWN: [number, number, number] = [0, 0, 22];

const SPAWN_POINT: [number, number] = [VEILROSE_SPAWN[0], VEILROSE_SPAWN[2]];
const SPAWN_KEEPOUT = 2.0;

const SPOT_KEEPOUTS: { x: number; z: number; r: number }[] = Object.values(SPOT_LAYOUT).map((cfg) => ({
	x: cfg.x,
	z: cfg.z,
	r: cfg.scale * 2.0 + 1.5,
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

export function layoutBuildingColliders(): KawasanAnchor[] {
	return QUARTER_BUILDINGS.map((b, i) => ({
		id: `__building_${i}`,
		nama: '',
		position: new THREE.Vector3(b.x, 0, b.z),
		groundColor: VEILROSE_PALETTE.gold,
		scale: 1,
		obstaclePoints: buildingColliderPoints(b),
	}));
}

export const AMBIENT_ROSE_STALLS: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: -14, z: 8, rot: 0.3, scale: 0.78 },
	{ x: -8, z: 16, rot: -0.5, scale: 0.72 },
	{ x: 14, z: 6, rot: 1.0, scale: 0.8 },
	{ x: 14, z: -2, rot: -0.7, scale: 0.74 },
	{ x: 14, z: -10, rot: 0.9, scale: 0.76 },
	{ x: 10, z: -16, rot: -1.1, scale: 0.7 },
	{ x: 6, z: -20, rot: 0.5, scale: 0.78 },
	{ x: -4, z: -18, rot: 1.2, scale: 0.72 },
	{ x: -10, z: -14, rot: -0.4, scale: 0.74 },
	{ x: -14, z: -20, rot: 0.8, scale: 0.7 },
	{ x: 8, z: -22, rot: -0.6, scale: 0.68 },
	{ x: -6, z: -8, rot: 0.4, scale: 0.75 },
	{ x: 4, z: -14, rot: -0.9, scale: 0.73 },
	{ x: -12, z: -4, rot: 1.4, scale: 0.7 },
].filter((s) => isClearOfSpotsAndSpawn(s.x, s.z));

export const AMBIENT_FLOWERING_TREES: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: 13, z: -6, rot: 0.2, scale: 0.85 },
	{ x: 11, z: -14, rot: -0.5, scale: 0.8 },
	{ x: -6, z: -20, rot: 1.0, scale: 0.78 },
	{ x: 8, z: -22, rot: -1.2, scale: 0.82 },
	{ x: -12, z: -16, rot: 0.6, scale: 0.76 },
	{ x: -14, z: 2, rot: -0.3, scale: 0.88 },
	{ x: 6, z: -10, rot: 0.7, scale: 0.8 },
	{ x: -8, z: -10, rot: -0.8, scale: 0.77 },
].filter((t) => isClearOfSpawn(t.x, t.z));

const GRASS_COUNT = 52;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const AMBIENT_GRASS_TUFTS: { x: number; z: number; rot: number; scale: number }[] = (() => {
	const tufts: { x: number; z: number; rot: number; scale: number }[] = [];
	for (let i = 0; tufts.length < GRASS_COUNT && i < GRASS_COUNT * 4; i++) {
		const t = i / (GRASS_COUNT * 4);
		const x = (t - 0.5) * 38;
		const z = 14 - t * 42;
		if (!isClearOfSpotsAndSpawn(x, z)) continue;
		if (Math.hypot(x, z - 2) < 3.2) continue;
		tufts.push({
			x,
			z,
			rot: (i * 0.37) % (Math.PI * 2),
			scale: 0.62 + ((i * 53) % 32) / 100,
		});
	}
	return tufts;
})();

export const ALLEY_FLAG_LINES: {
	from: [number, number, number];
	to: [number, number, number];
}[] = [
	{ from: [-4, 2.8, 20], to: [4, 2.8, 20] },
	{ from: [-14, 2.6, 8], to: [-14, 2.6, -2] },
	{ from: [14, 2.5, 6], to: [14, 2.5, -12] },
	{ from: [-3, 2.4, -14], to: [3, 2.4, -22] },
	{ from: [-8, 2.3, -10], to: [8, 2.3, -10] },
	{ from: [10, 2.2, -4], to: [10, 2.2, -18] },
	{ from: [-10, 2.5, 0], to: [-10, 2.5, 10] },
];

export const ALLEY_CORNER_DECOR: {
	x: number;
	z: number;
	rot: number;
	kind: 'bench' | 'pot' | 'lamp';
}[] = [
	{ x: -13, z: 10, rot: 0.5, kind: 'bench' },
	{ x: -13, z: 0, rot: -0.5, kind: 'pot' },
	{ x: -13, z: -6, rot: 0.8, kind: 'lamp' },
	{ x: 13, z: 4, rot: -0.6, kind: 'bench' },
	{ x: 13, z: -6, rot: 0.4, kind: 'pot' },
	{ x: 13, z: -14, rot: -0.3, kind: 'lamp' },
	{ x: 5, z: -16, rot: 0.7, kind: 'bench' },
	{ x: -5, z: -18, rot: -0.9, kind: 'pot' },
	{ x: 0, z: -20, rot: 0.2, kind: 'lamp' },
	{ x: 8, z: -20, rot: -1.1, kind: 'bench' },
	{ x: -8, z: -14, rot: 0.5, kind: 'pot' },
	{ x: 4, z: -10, rot: -0.4, kind: 'lamp' },
];
