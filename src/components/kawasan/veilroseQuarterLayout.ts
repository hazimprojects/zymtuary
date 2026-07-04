import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import {
	BUILDING_BLOCKS,
	CITY_SPAWN,
	CITY_SPOT_POSITIONS,
	VEILROSE_QUARTER_BOUNDS,
	blockColliderPoints,
	isOnStreet,
	isValidPropPlacement,
} from './veilroseCityPlan';
import { VEILROSE_PALETTE } from './veilrosePalette';

export { VEILROSE_QUARTER_BOUNDS } from './veilroseCityPlan';

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

const SPOT_ENTRIES = Object.entries(CITY_SPOT_POSITIONS);

function spotConfig(nama: string) {
	const pos = CITY_SPOT_POSITIONS[nama as keyof typeof CITY_SPOT_POSITIONS];
	if (!pos) return null;
	const base = {
		x: pos.x,
		z: pos.z,
		scale: 1,
		groundColor: VEILROSE_PALETTE.gold,
		obstacleRadius: undefined as number | undefined,
		obstaclePoints: undefined as { dx: number; dz: number; radius: number }[] | undefined,
	};

	switch (nama) {
		case 'The Applause Steps':
			return { ...base, groundColor: VEILROSE_PALETTE.cream, obstacleRadius: 0.25 };
		case 'The Memory Room of Smiling Frames':
			return {
				...base,
				groundColor: VEILROSE_PALETTE.purple,
				obstaclePoints: memoryRoomObstaclePoints(Math.atan2(17, 2 - 5)),
			};
		case "The Mask Vendor's Row":
			return {
				...base,
				groundColor: VEILROSE_PALETTE.pink,
				obstaclePoints: [
					{ dx: -5, dz: 0, radius: 0.64 },
					{ dx: -3, dz: 0, radius: 0.86 },
					{ dx: -1, dz: 0, radius: 1.01 },
					{ dx: 1, dz: 0, radius: 0.75 },
					{ dx: 3, dz: 0, radius: 0.9 },
					{ dx: 5, dz: 0, radius: 0.71 },
				],
			};
		case 'The Rehearsal Mirrors':
			return {
				...base,
				groundColor: VEILROSE_PALETTE.purple,
				obstaclePoints: [
					{ dx: -0.925, dz: 0.594, radius: 0.48 },
					{ dx: 0, dz: 1.1, radius: 0.48 },
					{ dx: 0.925, dz: 0.594, radius: 0.48 },
				],
			};
		case 'The Room of Fallen Petals':
			return {
				...base,
				scale: 0.95,
				groundColor: VEILROSE_PALETTE.ash,
				obstaclePoints: [
					{ dx: -0.76, dz: 0, radius: 0.25 },
					{ dx: 0.76, dz: 0, radius: 0.25 },
				],
			};
		default:
			return base;
	}
}

export const VEILROSE_SPAWN = CITY_SPAWN;

const SPOT_COORDS = SPOT_ENTRIES.map(([, p]) => p);

export function layoutVeilroseAnchors(spots: { nama: string }[]): KawasanAnchor[] {
	return spots.map((spot) => {
		const cfg = spotConfig(spot.nama) ?? { x: 0, z: 4, scale: 1, groundColor: VEILROSE_PALETTE.gold };
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
	const colliders: KawasanAnchor[] = [];
	BUILDING_BLOCKS.forEach((block, bi) => {
		blockColliderPoints(block).forEach((p, pi) => {
			colliders.push({
				id: `__building_${bi}_${pi}`,
				nama: '',
				position: new THREE.Vector3(p.x, 0, p.z),
				groundColor: VEILROSE_PALETTE.gold,
				scale: 1,
				obstaclePoints: [{ dx: 0, dz: 0, radius: p.radius }],
			});
		});
	});
	return colliders;
}

/** Prop hiasan — HANYA di atas pavement jalan, tidak bertindih bangunan. */
export const AMBIENT_ROSE_STALLS: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: -10, z: 8, rot: 0.3, scale: 0.78 },
	{ x: -10, z: 4, rot: -0.5, scale: 0.72 },
	{ x: 10, z: 8, rot: 1.0, scale: 0.76 },
	{ x: 10, z: 0, rot: -0.7, scale: 0.74 },
	{ x: 10, z: -8, rot: 0.9, scale: 0.72 },
	{ x: 10, z: -14, rot: -1.1, scale: 0.7 },
	{ x: 0, z: -10, rot: 0.5, scale: 0.75 },
	{ x: 0, z: -16, rot: 1.2, scale: 0.72 },
	{ x: -6, z: -16, rot: -0.4, scale: 0.7 },
	{ x: 6, z: -16, rot: 0.8, scale: 0.7 },
	{ x: -8, z: -4, rot: 0.4, scale: 0.73 },
	{ x: 8, z: -4, rot: -0.9, scale: 0.73 },
].filter((s) => isValidPropPlacement(s.x, s.z, SPOT_COORDS));

export const AMBIENT_FLOWERING_TREES: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: -10, z: -4, rot: 0.2, scale: 0.82 },
	{ x: 10, z: -10, rot: -0.5, scale: 0.78 },
	{ x: 0, z: -22, rot: 1.0, scale: 0.76 },
	{ x: -4, z: -16, rot: 0.6, scale: 0.74 },
	{ x: 4, z: -16, rot: -0.3, scale: 0.8 },
].filter((t) => isValidPropPlacement(t.x, t.z, SPOT_COORDS));

export const AMBIENT_GRASS_TUFTS: { x: number; z: number; rot: number; scale: number }[] = (() => {
	const tufts: { x: number; z: number; rot: number; scale: number }[] = [];
	for (let i = 0; tufts.length < 28 && i < 80; i++) {
		const t = i / 80;
		const candidates = [
			{ x: -10 + (t - 0.5) * 2, z: 10 - t * 14 },
			{ x: 10 - (t - 0.5) * 2, z: 10 - t * 20 },
			{ x: (t - 0.5) * 4, z: -4 - t * 18 },
		];
		for (const c of candidates) {
			if (!isOnStreet(c.x, c.z)) continue;
			if (!isValidPropPlacement(c.x, c.z, SPOT_COORDS, 1.8)) continue;
			tufts.push({ x: c.x, z: c.z, rot: (i * 0.37) % (Math.PI * 2), scale: 0.62 + ((i * 41) % 28) / 100 });
			break;
		}
	}
	return tufts;
})();

export const ALLEY_FLAG_LINES: {
	from: [number, number, number];
	to: [number, number, number];
}[] = [
	{ from: [-3, 2.8, 20], to: [3, 2.8, 20] },
	{ from: [-10, 2.6, 10], to: [-10, 2.6, 2] },
	{ from: [10, 2.5, 10], to: [10, 2.5, -14] },
	{ from: [0, 2.4, -10], to: [0, 2.4, -22] },
	{ from: [-6, 2.3, -16], to: [6, 2.3, -16] },
];

export const ALLEY_CORNER_DECOR: {
	x: number;
	z: number;
	rot: number;
	kind: 'bench' | 'pot' | 'lamp';
}[] = [
	{ x: -10, z: 8, rot: 0.5, kind: 'bench' },
	{ x: -10, z: 2, rot: -0.5, kind: 'pot' },
	{ x: 10, z: 6, rot: 0.8, kind: 'lamp' },
	{ x: 10, z: -6, rot: -0.6, kind: 'bench' },
	{ x: 10, z: -12, rot: 0.4, kind: 'pot' },
	{ x: 0, z: -16, rot: 0.7, kind: 'lamp' },
	{ x: 0, z: -22, rot: -0.9, kind: 'bench' },
	{ x: -6, z: -16, rot: 0.5, kind: 'pot' },
	{ x: 6, z: -16, rot: -0.4, kind: 'lamp' },
].filter((d) => isValidPropPlacement(d.x, d.z, SPOT_COORDS, 1.5));
