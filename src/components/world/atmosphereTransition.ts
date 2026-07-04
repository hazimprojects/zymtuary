import * as THREE from 'three';
import { GLOBE_RADIUS, ZOOM_THRESHOLDS } from './worldGlobeConfig';

/** Warna langit pada setiap fasa — angkasa → tepi atmosfera → dalam awan */
export const ATMOSPHERE_SKY = {
	space: '#020408',
	approach: '#0a1e32',
	shell: '#1a4a72',
	inner: '#8fc4ea',
} as const;

export const ATMOSPHERE_FOG = {
	space: '#0a1420',
	inner: '#8fc4ea',
} as const;

function clamp01(t: number): number {
	return Math.min(1, Math.max(0, t));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = clamp01((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
	const c = new THREE.Color(hex);
	return [c.r, c.g, c.b];
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): THREE.Color {
	return new THREE.Color(
		a[0] + (b[0] - a[0]) * t,
		a[1] + (b[1] - a[1]) * t,
		a[2] + (b[2] - a[2]) * t,
	);
}

/** 0 = angkasa jauh, 1 = dalam atmosfera — zon perantaraan untuk transisi lancar */
export function getAtmosphereBlend(distance: number): number {
	const outer = 6.2;
	const shellEdge = ZOOM_THRESHOLDS.atmosphereEnter;
	const innerEdge = ZOOM_THRESHOLDS.descentEnter;
	const core = GLOBE_RADIUS + 0.12;

	if (distance >= outer) return 0;
	if (distance <= core) return 1;

	if (distance >= shellEdge) {
		const t = 1 - smoothstep(shellEdge, outer, distance);
		return t * 0.35;
	}
	if (distance >= innerEdge) {
		const t = 1 - smoothstep(innerEdge, shellEdge, distance);
		return 0.35 + t * 0.4;
	}
	const t = 1 - smoothstep(core, innerEdge, distance);
	return 0.75 + t * 0.25;
}

export function getSkyColor(blend: number): THREE.Color {
	const space = hexToRgb(ATMOSPHERE_SKY.space);
	const approach = hexToRgb(ATMOSPHERE_SKY.approach);
	const shell = hexToRgb(ATMOSPHERE_SKY.shell);
	const inner = hexToRgb(ATMOSPHERE_SKY.inner);

	if (blend <= 0.35) return lerpRgb(space, approach, blend / 0.35);
	if (blend <= 0.75) return lerpRgb(approach, shell, (blend - 0.35) / 0.4);
	return lerpRgb(shell, inner, (blend - 0.75) / 0.25);
}

export function getFogColor(blend: number): THREE.Color {
	return lerpRgb(hexToRgb(ATMOSPHERE_FOG.space), hexToRgb(ATMOSPHERE_FOG.inner), blend);
}

export function getFogRange(blend: number): { near: number; far: number } {
	return {
		near: THREE.MathUtils.lerp(8, 0.75, blend),
		far: THREE.MathUtils.lerp(24, 14, blend),
	};
}

export function getStarVisibility(blend: number): number {
	return 1 - smoothstep(0.18, 0.62, blend);
}

export function getInteriorBlend(blend: number): number {
	return smoothstep(0.52, 0.92, blend);
}

export function getCameraFov(blend: number, isMobile: boolean): number {
	const orbitFov = isMobile ? 50 : 48;
	const descentFov = 68;
	return THREE.MathUtils.lerp(orbitFov, descentFov, smoothstep(0.45, 1, blend));
}

export function smoothDamp(current: number, target: number, delta: number, speed = 5): number {
	return current + (target - current) * Math.min(1, delta * speed);
}
