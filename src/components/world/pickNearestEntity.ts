import * as THREE from 'three';
import type { ResonancePlacement } from './worldGlobeConfig';

const _normal = new THREE.Vector3();
const _entityDir = new THREE.Vector3();

/** Cari entiti paling hampir dengan normal permukaan (ruang tempatan globe). */
export function pickNearestEntity(
	nx: number,
	ny: number,
	nz: number,
	placements: ResonancePlacement[],
	threshold = 0.84,
): ResonancePlacement['entity'] | null {
	_normal.set(nx, ny, nz).normalize();
	let best: ResonancePlacement['entity'] | null = null;
	let bestDot = threshold;

	for (const { entity, direction } of placements) {
		const dot = _normal.dot(_entityDir.set(...direction));
		if (dot > bestDot) {
			bestDot = dot;
			best = entity;
		}
	}

	return best;
}

/** Kemas kini uniform hover pada material globe */
export function setHoverGlow(
	material: THREE.ShaderMaterial,
	direction: [number, number, number] | null,
	active: number,
): void {
	if (direction) {
		material.uniforms.uHoverDir.value.set(...direction);
	}
	material.uniforms.uHoverActive.value = THREE.MathUtils.lerp(
		material.uniforms.uHoverActive.value,
		active,
		0.15,
	);
}
