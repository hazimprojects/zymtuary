import * as THREE from 'three';
import { FAMILY_COLORS, type ResonancePlacement } from './worldGlobeConfig';

export const MAX_ENTITY_GLOWS = 24;

export type EntityGlowUniforms = {
	uEntityCount: { value: number };
	uEntityDirs: { value: THREE.Vector3[] };
	uEntityColors: { value: THREE.Vector3[] };
	uEntityStrength: { value: number[] };
	uHoverDir: { value: THREE.Vector3 };
	uHoverActive: { value: number };
};

export function createEntityGlowUniforms(): EntityGlowUniforms {
	const dirs = Array.from({ length: MAX_ENTITY_GLOWS }, () => new THREE.Vector3(0, 1, 0));
	const colors = Array.from({ length: MAX_ENTITY_GLOWS }, () => new THREE.Vector3(0.8, 0.7, 0.5));
	const strength = Array.from({ length: MAX_ENTITY_GLOWS }, () => 0);

	return {
		uEntityCount: { value: 0 },
		uEntityDirs: { value: dirs },
		uEntityColors: { value: colors },
		uEntityStrength: { value: strength },
		uHoverDir: { value: new THREE.Vector3(0, 1, 0) },
		uHoverActive: { value: 0 },
	};
}

export function updateEntityGlowUniforms(
	uniforms: EntityGlowUniforms,
	placements: ResonancePlacement[],
): void {
	const count = Math.min(placements.length, MAX_ENTITY_GLOWS);
	uniforms.uEntityCount.value = count;

	for (let i = 0; i < MAX_ENTITY_GLOWS; i++) {
		if (i >= count) {
			uniforms.uEntityStrength.value[i] = 0;
			continue;
		}
		const p = placements[i];
		uniforms.uEntityDirs.value[i].set(...p.direction);
		const c = new THREE.Color(FAMILY_COLORS[p.entity.keluarga_aetherys] ?? '#c9a96e');
		uniforms.uEntityColors.value[i].set(c.r, c.g, c.b);
		uniforms.uEntityStrength.value[i] = p.entity.keadaan === 'Dormant' ? 0.28 : 0.75;
	}
}
