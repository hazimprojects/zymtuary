import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VEILROSE_PALETTE } from './veilrosePalette';

const PLAZA_HEIGHT = 0.18;
const GRID_W = 52;
const GRID_D = 64;

/** Kuartir diperluas — lebih banyak ruang menjelajah. */
export const VEILROSE_QUARTER_BOUNDS = {
	halfWidth: 24,
	halfDepth: 30,
	minX: -24,
	maxX: 24,
	minZ: -30,
	maxZ: 26,
} as const;

const STONE_COLOR = '#B8A878';
const PAVEMENT_COLOR = '#C4B48A';
const EARTH_COLOR = VEILROSE_PALETTE.ash;

export type VeilroseGroundZone = 'plaza' | 'alley' | 'pavement' | 'earth';

function distToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
	const dx = x2 - x1;
	const dz = z2 - z1;
	const lenSq = dx * dx + dz * dz;
	if (lenSq < 1e-6) return Math.hypot(px - x1, pz - z1);
	const t = THREE.MathUtils.clamp(((px - x1) * dx + (pz - z1) * dz) / lenSq, 0, 1);
	return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

/** Laluan pavement & lorong — ikut ALLEY_PAVEMENTS dalam veilroseBuildings. */
function isOnPavement(x: number, z: number): boolean {
	const paths: [number, number, number, number, number][] = [
		[0, 8, 0, 26, 1.15],
		[-15, -4, -15, 14, 1.0],
		[15, -16, 15, 10, 1.0],
		[0, -28, 0, -8, 0.95],
		[-9, -20, -9, -8, 0.9],
		[9, -22, 9, -10, 0.85],
		[-5, 0, -5, 8, 0.95],
		[5, -12, 5, 0, 0.9],
		[-12, -12, -12, -4, 0.85],
		[12, -18, 12, -6, 0.85],
	];
	return paths.some(([x1, z1, x2, z2, halfW]) => distToSegment(x, z, x1, z1, x2, z2) < halfW);
}

/** Zon permukaan — plaza, lorong, pavement, tanah kelopak. */
export function classifyVeilroseGroundZone(x: number, z: number): VeilroseGroundZone {
	if (isOnPavement(x, z)) return 'pavement';
	if (z < -16) return 'earth';
	if (z < -4 && Math.abs(x) < 14) return 'alley';
	if (z < 2 && x > 9) return 'alley';
	if (z < 6 && x < -9) return 'alley';
	if (z > 10 && Math.abs(x) > 5) return 'alley';
	return 'plaza';
}

function zoneBaseColor(zone: VeilroseGroundZone, baseColor: string): THREE.Color {
	switch (zone) {
		case 'pavement':
			return new THREE.Color(PAVEMENT_COLOR);
		case 'alley':
			return new THREE.Color(baseColor).lerp(new THREE.Color(STONE_COLOR), 0.48);
		case 'earth':
			return new THREE.Color(EARTH_COLOR).lerp(new THREE.Color(VEILROSE_PALETTE.driedRose), 0.3);
		default:
			return new THREE.Color(baseColor);
	}
}

function quarterEdgeFalloff(x: number, z: number): number {
	const dx = Math.max(0, Math.abs(x) - VEILROSE_QUARTER_BOUNDS.halfWidth + 2.2);
	const dz = Math.max(0, Math.abs(z + 1) - VEILROSE_QUARTER_BOUNDS.halfDepth + 2.2);
	const edge = Math.max(dx, dz);
	return THREE.MathUtils.clamp(1 - edge / 3.5, 0, 1);
}

function heartStepHeight(
	x: number,
	z: number,
	heartStepRadius: number,
	heartStepTierHeight: number,
): number {
	const dist = Math.hypot(x, z - 2);
	if (dist >= heartStepRadius) return 0;
	const tier = Math.floor((1 - dist / heartStepRadius) * 3);
	return tier * heartStepTierHeight;
}

export function buildVeilroseQuarterGeometry(
	anchors: KawasanAnchor[],
	baseColor: string,
	heartStepRadius = 1.75,
	heartStepTierHeight = 0.28,
): THREE.BufferGeometry {
	const geometry = new THREE.PlaneGeometry(
		VEILROSE_QUARTER_BOUNDS.halfWidth * 2.15,
		VEILROSE_QUARTER_BOUNDS.halfDepth * 2.12,
		GRID_W,
		GRID_D,
	);
	geometry.rotateX(-Math.PI / 2);

	const position = geometry.attributes.position;
	const colors: number[] = [];
	const anchorBlendRadius = 3.8;

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		const zone = classifyVeilroseGroundZone(x, z);
		const edge = quarterEdgeFalloff(x, z);

		let height = PLAZA_HEIGHT * edge;
		height += heartStepHeight(x, z, heartStepRadius, heartStepTierHeight) * edge;
		if (zone === 'earth') height *= 0.9;
		if (zone === 'pavement') height += 0.025;
		position.setY(i, height);

		let nearestIndex = 0;
		let nearestDist = Infinity;
		anchors.forEach((anchor, idx) => {
			if (anchor.id.startsWith('__')) return;
			const d = Math.hypot(x - anchor.position.x, z - anchor.position.z);
			if (d < nearestDist) {
				nearestDist = d;
				nearestIndex = idx;
			}
		});
		const spotAnchor = anchors.filter((a) => !a.id.startsWith('__'))[nearestIndex];
		const c = zoneBaseColor(zone, baseColor);
		if (spotAnchor && zone !== 'pavement') {
			const blend = THREE.MathUtils.clamp(1 - nearestDist / anchorBlendRadius, 0, 0.32);
			c.lerp(new THREE.Color(spotAnchor.groundColor), blend);
		}
		colors.push(c.r * edge, c.g * edge, c.b * edge);
	}

	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	return geometry;
}

export function sampleVeilroseQuarterGroundHeight(
	x: number,
	z: number,
	heartStepRadius = 1.75,
	heartStepTierHeight = 0.28,
): number {
	const edge = quarterEdgeFalloff(x, z);
	let height = PLAZA_HEIGHT * edge;
	height += heartStepHeight(x, z, heartStepRadius, heartStepTierHeight) * edge;
	if (classifyVeilroseGroundZone(x, z) === 'pavement') height += 0.025;
	return height;
}
