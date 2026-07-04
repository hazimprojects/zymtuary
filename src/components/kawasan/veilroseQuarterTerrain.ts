import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VEILROSE_PALETTE } from './veilrosePalette';

const PLAZA_HEIGHT = 0.18;
const GRID_W = 40;
const GRID_D = 48;

/** Sempadan kuartir bandar — bukan pulau bulat terpencil. */
export const VEILROSE_QUARTER_BOUNDS = {
	halfWidth: 15,
	halfDepth: 18,
	minX: -15,
	maxX: 15,
	minZ: -18,
	maxZ: 16,
} as const;

const STONE_COLOR = '#C9B88A';
const EARTH_COLOR = VEILROSE_PALETTE.ash;

export type VeilroseGroundZone = 'plaza' | 'alley' | 'earth';

/** Zon permukaan — plaza marmar, lorong batu sederhana, laluan kelopak tanah kasar. */
export function classifyVeilroseGroundZone(x: number, z: number): VeilroseGroundZone {
	if (z < -10.5) return 'earth';
	if (z < -2 && x > 4.5) return 'alley';
	if (z < -5 && Math.abs(x) < 6) return 'alley';
	return 'plaza';
}

function zoneBaseColor(zone: VeilroseGroundZone, baseColor: string): THREE.Color {
	switch (zone) {
		case 'alley':
			return new THREE.Color(baseColor).lerp(new THREE.Color(STONE_COLOR), 0.42);
		case 'earth':
			return new THREE.Color(EARTH_COLOR).lerp(new THREE.Color(VEILROSE_PALETTE.driedRose), 0.25);
		default:
			return new THREE.Color(baseColor);
	}
}

function quarterEdgeFalloff(x: number, z: number): number {
	const dx = Math.max(0, Math.abs(x) - VEILROSE_QUARTER_BOUNDS.halfWidth + 1.8);
	const dz = Math.max(0, Math.abs(z + 0.5) - VEILROSE_QUARTER_BOUNDS.halfDepth + 1.8);
	const edge = Math.max(dx, dz);
	return THREE.MathUtils.clamp(1 - edge / 3.2, 0, 1);
}

function heartStepHeight(
	x: number,
	z: number,
	heartStepRadius: number,
	heartStepTierHeight: number,
): number {
	const dist = Math.hypot(x, z - 1);
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
		VEILROSE_QUARTER_BOUNDS.halfWidth * 2.1,
		VEILROSE_QUARTER_BOUNDS.halfDepth * 2.15,
		GRID_W,
		GRID_D,
	);
	geometry.rotateX(-Math.PI / 2);

	const position = geometry.attributes.position;
	const colors: number[] = [];
	const anchorBlendRadius = 3.4;

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		const zone = classifyVeilroseGroundZone(x, z);
		const edge = quarterEdgeFalloff(x, z);

		let height = PLAZA_HEIGHT * edge;
		height += heartStepHeight(x, z, heartStepRadius, heartStepTierHeight) * edge;
		if (zone === 'earth') height *= 0.92;
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
		if (spotAnchor) {
			const blend = THREE.MathUtils.clamp(1 - nearestDist / anchorBlendRadius, 0, 0.38);
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
	return height;
}
