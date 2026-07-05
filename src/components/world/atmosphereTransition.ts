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

/**
 * Sistem cuaca SIANG/MALAM per-Spheral. Setiap alam ada watak siang & malam
 * TERSENDIRI (bukan sekadar terang/gelap sejagat) — dipandu kitaran masa
 * (getDayFactor) DAN hemisfera (arah-y kamera). 'inner' = tona dekat
 * permukaan, 'shell' = tona ke arah zenit.
 *
 *  Luminara siang "Solar Bloom"  : emas terang, tenggelamkan nebula.
 *  Luminara malam "Stellar Drift": emas → perak lembut, nebula halus muncul.
 *  Noctira  siang "Void Tempest" : ungu-magenta tebal dramatik (bukan gelap).
 *  Noctira  malam "Ashen Gale"   : ungu-kelabu tenang, bintang paling terang.
 *  Equilara siang "Meridian Hush": emas↔ungu bertukar, teal jambatan.
 *  Equilara malam "Twilight Conv.": senja tak pernah gelap penuh.
 */
export const HEMISPHERE_SKY_DAY = {
	luminara: { shell: '#7fb2da', inner: '#f8e8b0' }, // Solar Bloom
	noctira: { shell: '#3a1e50', inner: '#5a2e64' }, // Void Tempest
	equilara: { shell: '#3f7080', inner: '#c89a86' }, // Meridian Hush
} as const;

export const HEMISPHERE_SKY_NIGHT = {
	luminara: { shell: '#34405e', inner: '#b4b4c0' }, // Stellar Drift (perak)
	noctira: { shell: '#100c1a', inner: '#1e1a2c' }, // Ashen Gale (gelap, bintang menyerlah)
	equilara: { shell: '#2c3a58', inner: '#6a5a72' }, // Twilight Convergence (tak pernah gelap penuh)
} as const;

export const HEMISPHERE_FOG_DAY = {
	luminara: '#ecdca4',
	noctira: '#3a2444', // kabus ribut ungu Void Tempest
	equilara: '#b58a7a',
} as const;

export const HEMISPHERE_FOG_NIGHT = {
	luminara: '#a8a4b4', // perak lembut
	noctira: '#0a0e1a', // gelap — biar nebula menyerlah
	equilara: '#5a5064', // senja muted, tak hitam
} as const;

/** Tempoh satu kitaran siang+malam penuh (saat). */
export const DAY_NIGHT_CYCLE_SECONDS = 200;

/** 0 = malam penuh, 1 = siang penuh — kitaran lancar (cos). Ofset fasa 0.35
 * supaya muat-naik pertama bermula waktu SIANG (dayFactor≈0.79), bukan malam
 * gelap. */
export function getDayFactor(elapsed: number): number {
	const phase = (elapsed / DAY_NIGHT_CYCLE_SECONDS + 0.35) % 1;
	return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

/** Hampiran subuh/senja — 1 di tengah peralihan (dayFactor≈0.5), 0 di siang/
 * malam penuh. Utk cuaca istimewa Equilara (Pertembungan) & seam warna. */
export function getDawnDuskFactor(dayFactor: number): number {
	return clamp01(1 - Math.abs(dayFactor - 0.5) * 2);
}

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
	// Diluaskan sepadan dgn ZOOM_THRESHOLDS yg lebih tinggi (ruang udara lebih
	// lapang) — kekalkan nisbah jarak yg sama drpd shellEdge/innerEdge.
	const outer = 7.4;
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

/**
 * Blend 3-zon ikut arah-y kamera (bukan cuma purata linear Luminara↔Noctira)
 * — Equilara ialah zon sendiri di tengah (|y| kecil), bukan sekadar
 * pertengahan warna dua hemisfera lain, supaya "neutral tapi bervariasi".
 */
function hemisphereBlend(
	hemisphereY: number,
	colors: { luminara: string; noctira: string; equilara: string },
): [number, number, number] {
	const equilara = hexToRgb(colors.equilara);
	if (hemisphereY >= 0) {
		const t = smoothstep(0, 0.55, hemisphereY);
		return lerpRgbTuple(equilara, hexToRgb(colors.luminara), t);
	}
	const t = smoothstep(0, 0.55, -hemisphereY);
	return lerpRgbTuple(equilara, hexToRgb(colors.noctira), t);
}

function lerpRgbTuple(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Blend skalar 3-zon (sama corak dgn hemisphereBlend tapi utk nombor). */
function hemiScalar(hemisphereY: number, luminara: number, noctira: number, equilara: number): number {
	if (hemisphereY >= 0) return equilara + (luminara - equilara) * smoothstep(0, 0.55, hemisphereY);
	return equilara + (noctira - equilara) * smoothstep(0, 0.55, -hemisphereY);
}

/** Tona hemisfera dilerp antara jadual MALAM & SIANG ikut dayFactor. */
function hemisphereBlendDayNight(
	hemisphereY: number,
	dayFactor: number,
	dayCols: { luminara: string; noctira: string; equilara: string },
	nightCols: { luminara: string; noctira: string; equilara: string },
): [number, number, number] {
	const day = hemisphereBlend(hemisphereY, dayCols);
	const night = hemisphereBlend(hemisphereY, nightCols);
	return lerpRgbTuple(night, day, dayFactor);
}

/** @param hemisphereY arah-y kamera (-1 Noctira, 0 Equilara, 1 Luminara)
 * @param dayFactor 0 malam, 1 siang (getDayFactor). Setiap alam ada watak
 * siang/malam tersendiri. Lalai 0.7 (sedikit siang) utk pemanggil tanpa masa
 * (cth. latar CSS fallback sebelum canvas). */
export function getSkyColor(blend: number, hemisphereY: number, dayFactor = 0.7): THREE.Color {
	const space = hexToRgb(ATMOSPHERE_SKY.space);
	const approach = hexToRgb(ATMOSPHERE_SKY.approach);
	const shell = hemisphereBlendDayNight(
		hemisphereY,
		dayFactor,
		{ luminara: HEMISPHERE_SKY_DAY.luminara.shell, noctira: HEMISPHERE_SKY_DAY.noctira.shell, equilara: HEMISPHERE_SKY_DAY.equilara.shell },
		{ luminara: HEMISPHERE_SKY_NIGHT.luminara.shell, noctira: HEMISPHERE_SKY_NIGHT.noctira.shell, equilara: HEMISPHERE_SKY_NIGHT.equilara.shell },
	);
	const inner = hemisphereBlendDayNight(
		hemisphereY,
		dayFactor,
		{ luminara: HEMISPHERE_SKY_DAY.luminara.inner, noctira: HEMISPHERE_SKY_DAY.noctira.inner, equilara: HEMISPHERE_SKY_DAY.equilara.inner },
		{ luminara: HEMISPHERE_SKY_NIGHT.luminara.inner, noctira: HEMISPHERE_SKY_NIGHT.noctira.inner, equilara: HEMISPHERE_SKY_NIGHT.equilara.inner },
	);

	if (blend <= 0.35) return lerpRgb(space, approach, blend / 0.35);
	if (blend <= 0.75) return lerpRgb(approach, shell, (blend - 0.35) / 0.4);
	return lerpRgb(shell, inner, (blend - 0.75) / 0.25);
}

export function getFogColor(blend: number, hemisphereY: number, dayFactor = 0.7): THREE.Color {
	const space = hexToRgb(ATMOSPHERE_FOG.space);
	const inner = hemisphereBlendDayNight(hemisphereY, dayFactor, HEMISPHERE_FOG_DAY, HEMISPHERE_FOG_NIGHT);
	return lerpRgb(space, inner, blend);
}

/** Keterlihatan nebula Aethernals DALAM atmosfera ikut alam & masa (spec):
 *  Luminara: siang tersembunyi (0), malam halus (~0.42).
 *  Noctira : siang jelas Void Tempest (~0.72), malam paling penuh Ashen Gale (~1).
 *  Equilara: separa sentiasa (~0.32 siang, ~0.5 malam) — tak pernah hilang penuh. */
export function getNebulaAtmosphereVisibility(hemisphereY: number, dayFactor: number): number {
	const lum = THREE.MathUtils.lerp(0.42, 0.0, dayFactor);
	const noc = THREE.MathUtils.lerp(1.0, 0.72, dayFactor);
	const equ = THREE.MathUtils.lerp(0.5, 0.32, dayFactor);
	return hemiScalar(hemisphereY, lum, noc, equ);
}

/** Pendaraban cahaya permukaan ikut masa — malam lebih malap, tapi tidak
 * gelap gulita (0.5) supaya objek kekal terbaca. */
export function getDaylight(dayFactor: number): number {
	return THREE.MathUtils.lerp(0.5, 1.0, dayFactor);
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
	return smoothstep(0.68, 0.96, blend);
}

/** Selubung luar — hanya kelihatan rapat ke globe, elak cincin berlapis di angkasa */
export function getExteriorVeilIntensity(blend: number): number {
	return smoothstep(0.28, 0.72, blend) * 0.11;
}

export function getCameraFov(blend: number, isMobile: boolean): number {
	const orbitFov = isMobile ? 50 : 48;
	const descentFov = 68;
	return THREE.MathUtils.lerp(orbitFov, descentFov, smoothstep(0.45, 1, blend));
}

export function smoothDamp(current: number, target: number, delta: number, speed = 5): number {
	return current + (target - current) * Math.min(1, delta * speed);
}
