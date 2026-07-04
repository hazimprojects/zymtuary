import * as THREE from 'three';
import { VEILROSE_PALETTE } from './veilrosePalette';

/** Lebar lorong boleh jalan — pavement sentiasa di DALAM koridor ini. */
export const STREET_WIDTH = 2.0;
export const PAVEMENT_WIDTH = 1.75;
export const BUILDING_WALL_HEIGHT = 2.1;

export type RoofKind = 'flat' | 'gable' | 'dome' | 'arch';

/** Laluan jalan — titik bersambung; lengkung diperhalusi semasa render pavement. */
export type StreetPath = {
	id: string;
	width: number;
	points: { x: number; z: number }[];
};

/**
 * Blok bangunan bersambung — satu jisim pepejal per blok bandar.
 * `openings` = celah di tepi blok untuk lorong (bukan kotak berasingan).
 */
export type BuildingBlockDef = {
	id: string;
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
	wallColor: string;
	roofColor: string;
	openings: { edge: 'n' | 's' | 'e' | 'w'; t0: number; t1: number }[];
	roofAccents: { x: number; z: number; kind: RoofKind }[];
};

/** Plaza terbuka di tengah — tiada bangunan. */
export const PLAZA_BOUNDS = { minX: -6.5, maxX: 6.5, minZ: -4, maxZ: 10 } as const;

export const VEILROSE_QUARTER_BOUNDS = {
	halfWidth: 22,
	halfDepth: 28,
	minX: -22,
	maxX: 22,
	minZ: -28,
	maxZ: 24,
} as const;

/**
 * Rangkaian jalan teratur — spine utara, sayap barat/timur, spine selatan.
 * Pavement dijana HANYA di sini — tidak bertindih bangunan.
 */
export const STREET_PATHS: StreetPath[] = [
	{
		id: 'north-entry',
		width: PAVEMENT_WIDTH,
		points: [
			{ x: 0, z: 22 },
			{ x: 0, z: 16 },
			{ x: 0, z: 10 },
		],
	},
	{
		id: 'west-to-memory',
		width: PAVEMENT_WIDTH,
		points: [
			{ x: -2, z: 10 },
			{ x: -6, z: 10 },
			{ x: -10, z: 10 },
			{ x: -10, z: 6 },
			{ x: -10, z: 2 },
			{ x: -13, z: 2 },
			{ x: -16, z: 5 },
		],
	},
	{
		id: 'east-to-rehearsal',
		width: PAVEMENT_WIDTH,
		points: [
			{ x: 2, z: 10 },
			{ x: 6, z: 10 },
			{ x: 10, z: 10 },
			{ x: 10, z: 4 },
			{ x: 10, z: -2 },
			{ x: 10, z: -8 },
			{ x: 10, z: -14 },
			{ x: 14, z: -14 },
			{ x: 17, z: -14 },
		],
	},
	{
		id: 'south-to-petals',
		width: PAVEMENT_WIDTH,
		points: [
			{ x: 0, z: -4 },
			{ x: 0, z: -10 },
			{ x: 0, z: -16 },
			{ x: 0, z: -22 },
			{ x: 2, z: -24 },
		],
	},
	{
		id: 'cross-west',
		width: PAVEMENT_WIDTH * 0.92,
		points: [
			{ x: -10, z: -4 },
			{ x: -6, z: -4 },
			{ x: -2, z: -4 },
		],
	},
	{
		id: 'cross-east',
		width: PAVEMENT_WIDTH * 0.92,
		points: [
			{ x: 2, z: -4 },
			{ x: 6, z: -4 },
			{ x: 10, z: -4 },
		],
	},
	{
		id: 'south-garden',
		width: PAVEMENT_WIDTH * 0.9,
		points: [
			{ x: -6, z: -16 },
			{ x: -2, z: -16 },
			{ x: 2, z: -16 },
			{ x: 6, z: -16 },
		],
	},
];

const W = VEILROSE_PALETTE;

/** Blok bandar bersambung — kongsi sempadan, bukan kotak berselerak. */
export const BUILDING_BLOCKS: BuildingBlockDef[] = [
	{
		id: 'blk-nw',
		minX: -22,
		maxX: -10.8,
		minZ: 10.8,
		maxZ: 24,
		wallColor: W.cream,
		roofColor: W.pink,
		openings: [{ edge: 'e', t0: 0.72, t1: 0.92 }],
		roofAccents: [
			{ x: -18, z: 20, kind: 'gable' },
			{ x: -14, z: 22, kind: 'dome' },
		],
	},
	{
		id: 'blk-ne',
		minX: 10.8,
		maxX: 22,
		minZ: 10.8,
		maxZ: 24,
		wallColor: W.cream,
		roofColor: W.purple,
		openings: [{ edge: 'w', t0: 0.72, t1: 0.92 }],
		roofAccents: [
			{ x: 18, z: 20, kind: 'dome' },
			{ x: 14, z: 22, kind: 'gable' },
		],
	},
	{
		id: 'blk-inner-nw',
		minX: -9.8,
		maxX: -2.2,
		minZ: 6.8,
		maxZ: 10.2,
		wallColor: W.gold,
		roofColor: W.gold,
		openings: [
			{ edge: 'e', t0: 0.35, t1: 0.65 },
			{ edge: 's', t0: 0.3, t1: 0.7 },
		],
		roofAccents: [{ x: -6, z: 9, kind: 'flat' }],
	},
	{
		id: 'blk-inner-ne',
		minX: 2.2,
		maxX: 9.8,
		minZ: 6.8,
		maxZ: 10.2,
		wallColor: W.gold,
		roofColor: W.pink,
		openings: [
			{ edge: 'w', t0: 0.35, t1: 0.65 },
			{ edge: 's', t0: 0.3, t1: 0.7 },
		],
		roofAccents: [{ x: 6, z: 9, kind: 'arch' }],
	},
	{
		id: 'blk-west',
		minX: -22,
		maxX: -10.8,
		minZ: -2.2,
		maxZ: 10.2,
		wallColor: W.gold,
		roofColor: W.purple,
		openings: [
			{ edge: 'e', t0: 0.55, t1: 0.78 },
			{ edge: 'e', t0: 0.05, t1: 0.22 },
			{ edge: 's', t0: 0.4, t1: 0.65 },
		],
		roofAccents: [
			{ x: -18, z: 6, kind: 'gable' },
			{ x: -14, z: 2, kind: 'flat' },
		],
	},
	{
		id: 'blk-east',
		minX: 10.8,
		maxX: 22,
		minZ: -2.2,
		maxZ: 10.2,
		wallColor: W.gold,
		roofColor: W.pink,
		openings: [
			{ edge: 'w', t0: 0.55, t1: 0.78 },
			{ edge: 'w', t0: 0.05, t1: 0.22 },
			{ edge: 's', t0: 0.35, t1: 0.6 },
		],
		roofAccents: [
			{ x: 18, z: 6, kind: 'dome' },
			{ x: 14, z: 0, kind: 'gable' },
		],
	},
	{
		id: 'blk-sw',
		minX: -22,
		maxX: -2.2,
		minZ: -28,
		maxZ: -2.8,
		wallColor: W.cream,
		roofColor: W.gold,
		openings: [
			{ edge: 'e', t0: 0.82, t1: 0.96 },
			{ edge: 'n', t0: 0.42, t1: 0.58 },
		],
		roofAccents: [
			{ x: -14, z: -10, kind: 'flat' },
			{ x: -8, z: -18, kind: 'gable' },
		],
	},
	{
		id: 'blk-se',
		minX: 2.2,
		maxX: 22,
		minZ: -28,
		maxZ: -2.8,
		wallColor: W.cream,
		roofColor: W.purple,
		openings: [
			{ edge: 'w', t0: 0.82, t1: 0.96 },
			{ edge: 'n', t0: 0.38, t1: 0.55 },
			{ edge: 'e', t0: 0.15, t1: 0.35 },
		],
		roofAccents: [
			{ x: 14, z: -10, kind: 'dome' },
			{ x: 18, z: -20, kind: 'arch' },
		],
	},
	{
		id: 'blk-south-mid',
		minX: -2.2,
		maxX: 2.2,
		minZ: -28,
		maxZ: -4.2,
		wallColor: W.gold,
		roofColor: W.pink,
		openings: [{ edge: 'n', t0: 0.35, t1: 0.65 }],
		roofAccents: [{ x: 0, z: -20, kind: 'gable' }],
	},
];

function distToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
	const dx = x2 - x1;
	const dz = z2 - z1;
	const lenSq = dx * dx + dz * dz;
	if (lenSq < 1e-6) return Math.hypot(px - x1, pz - z1);
	const t = THREE.MathUtils.clamp(((px - x1) * dx + (pz - z1) * dz) / lenSq, 0, 1);
	return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

export function sampleStreetPath(path: StreetPath, divisionsPerSeg = 10): { x: number; z: number }[] {
	const pts = path.points;
	if (pts.length < 2) return [...pts];
	const curve = new THREE.CatmullRomCurve3(
		pts.map((p) => new THREE.Vector3(p.x, 0, p.z)),
		false,
		'catmullrom',
		0.35,
	);
	const total = (pts.length - 1) * divisionsPerSeg;
	return Array.from({ length: total + 1 }, (_, i) => {
		const p = curve.getPoint(i / total);
		return { x: p.x, z: p.z };
	});
}

export function isInsidePlaza(x: number, z: number): boolean {
	return x >= PLAZA_BOUNDS.minX && x <= PLAZA_BOUNDS.maxX && z >= PLAZA_BOUNDS.minZ && z <= PLAZA_BOUNDS.maxZ;
}

export function isInsideBuildingBlock(x: number, z: number): boolean {
	return BUILDING_BLOCKS.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
}

export function isOnStreet(x: number, z: number): boolean {
	if (isInsideBuildingBlock(x, z)) return false;
	if (isInsidePlaza(x, z)) return false;
	for (const path of STREET_PATHS) {
		const halfW = path.width / 2;
		const sampled = sampleStreetPath(path, 8);
		for (let i = 0; i < sampled.length - 1; i++) {
			if (
				distToSegment(x, z, sampled[i].x, sampled[i].z, sampled[i + 1].x, sampled[i + 1].z) <
				halfW
			) {
				return true;
			}
		}
	}
	return false;
}

export function isValidPropPlacement(
	x: number,
	z: number,
	spots: { x: number; z: number }[] = [],
	minDist = 2.2,
): boolean {
	if (!isOnStreet(x, z)) return false;
	return spots.every((s) => Math.hypot(x - s.x, z - s.z) >= minDist);
}

export function blockColliderPoints(block: BuildingBlockDef): { x: number; z: number; radius: number }[] {
	const w = block.maxX - block.minX;
	const d = block.maxZ - block.minZ;
	const cx = (block.minX + block.maxX) / 2;
	const cz = (block.minZ + block.maxZ) / 2;
	const points: { x: number; z: number; radius: number }[] = [];

	// Empat penjuru — halang shortcut melalui blok
	points.push({ x: block.minX + 0.8, z: block.minZ + 0.8, radius: 1.1 });
	points.push({ x: block.maxX - 0.8, z: block.minZ + 0.8, radius: 1.1 });
	points.push({ x: block.minX + 0.8, z: block.maxZ - 0.8, radius: 1.1 });
	points.push({ x: block.maxX - 0.8, z: block.maxZ - 0.8, radius: 1.1 });

	// Pusat blok — isi pepejal
	if (w > 3.5 && d > 3.5) {
		points.push({ x: cx, z: cz, radius: Math.min(w, d) * 0.32 });
	}
	return points;
}

export const CITY_SPOT_POSITIONS = {
	'The Applause Steps': { x: 0, z: 2 },
	'The Memory Room of Smiling Frames': { x: -17, z: 5 },
	"The Mask Vendor's Row": { x: -10, z: 11 },
	'The Rehearsal Mirrors': { x: 17, z: -14 },
	'The Room of Fallen Petals': { x: 2, z: -24 },
} as const;

export const CITY_SPAWN: [number, number, number] = [0, 0, 21];
