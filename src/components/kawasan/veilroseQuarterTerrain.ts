import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VEILROSE_PALETTE } from './veilrosePalette';
import {
	VEILROSE_QUARTER_BOUNDS,
	isInsidePlaza,
	isOnStreet,
	isInsideBuildingBlock,
} from './veilroseCityPlan';

const PLAZA_HEIGHT = 0.18;
const GRID_W = 48;
const GRID_D = 58;

export { VEILROSE_QUARTER_BOUNDS } from './veilroseCityPlan';

const STONE_COLOR = '#B8A878';
const EARTH_COLOR = VEILROSE_PALETTE.ash;

export type VeilroseGroundZone = 'plaza' | 'street' | 'earth';

export function classifyVeilroseGroundZone(x: number, z: number): VeilroseGroundZone {
	if (isInsidePlaza(x, z)) return 'plaza';
	if (isOnStreet(x, z)) return 'street';
	if (z < -14) return 'earth';
	if (isInsideBuildingBlock(x, z)) return 'earth';
	return 'plaza';
}

function zoneBaseColor(zone: VeilroseGroundZone, baseColor: string): THREE.Color {
	switch (zone) {
		case 'street':
			return new THREE.Color(baseColor).lerp(new THREE.Color(STONE_COLOR), 0.35);
		case 'earth':
			return new THREE.Color(EARTH_COLOR).lerp(new THREE.Color(VEILROSE_PALETTE.driedRose), 0.25);
		default:
			return new THREE.Color(baseColor);
	}
}

function quarterEdgeFalloff(x: number, z: number): number {
	const dx = Math.max(0, Math.abs(x) - VEILROSE_QUARTER_BOUNDS.halfWidth + 2);
	const dz = Math.max(0, Math.abs(z + 1) - VEILROSE_QUARTER_BOUNDS.halfDepth + 2);
	const edge = Math.max(dx, dz);
	return THREE.MathUtils.clamp(1 - edge / 3.2, 0, 1);
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
	const anchorBlendRadius = 3.5;

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		const zone = classifyVeilroseGroundZone(x, z);
		const edge = quarterEdgeFalloff(x, z);

		let height = PLAZA_HEIGHT * edge;
		height += heartStepHeight(x, z, heartStepRadius, heartStepTierHeight) * edge;
		if (zone === 'earth') height *= 0.92;
		if (isInsideBuildingBlock(x, z)) height = PLAZA_HEIGHT * 0.85 * edge;
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
		if (spotAnchor && zone === 'plaza') {
			const blend = THREE.MathUtils.clamp(1 - nearestDist / anchorBlendRadius, 0, 0.3);
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
