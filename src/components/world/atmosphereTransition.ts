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
 * Tona langit ikut hemisfera — identiti TIGA ALAM ABADI (bukan kitaran masa):
 * Luminara = SIANG abadi (langit emas cerah, matahari menyerlah, nebula
 * tersembunyi), Noctira = MALAM abadi (gelap; cakerawala Aethernals kelihatan
 * dari tanah — lihat CosmicBackdrop hemiVis), Equilara = SENJA abadi (ufuk
 * hangat beralih ke biru sejuk, separa berbintang). 'inner' = tona dekat
 * permukaan, 'shell' = tona lebih tinggi ke arah zenit.
 */
export const HEMISPHERE_SKY = {
	// Siang: ufuk emas terang → biru langit siang hangat di atas.
	luminara: { shell: '#6ea6cc', inner: '#f6e6b0' },
	// Malam: sangat gelap — nebula Aethernals (CosmicBackdrop) jadi bintang utama.
	noctira: { shell: '#070f1e', inner: '#0e1626' },
	// Senja: ufuk jingga-mawar hangat → biru-nila sejuk di atas (seam siang/malam).
	equilara: { shell: '#2a3f68', inner: '#d08a66' },
} as const;

export const HEMISPHERE_FOG = {
	luminara: '#ecdca4', // kabus siang hangat keemasan
	noctira: '#070d18', // kabus malam gelap (biar nebula menyerlah)
	equilara: '#b58a7a', // kabus senja jingga-kelabu lembut
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

/** @param hemisphereY arah-y kamera dinormalisasi (-1 Noctira, 0 Equilara, 1
 * Luminara) — tona hemisfera hanya ketara apabila blend (kedalaman
 * atmosfera) cukup tinggi, sepadan dgn "kelihatan dari dalam atmosfera". */
export function getSkyColor(blend: number, hemisphereY: number): THREE.Color {
	const space = hexToRgb(ATMOSPHERE_SKY.space);
	const approach = hexToRgb(ATMOSPHERE_SKY.approach);
	const shell = hemisphereBlend(hemisphereY, {
		luminara: HEMISPHERE_SKY.luminara.shell,
		noctira: HEMISPHERE_SKY.noctira.shell,
		equilara: HEMISPHERE_SKY.equilara.shell,
	});
	const inner = hemisphereBlend(hemisphereY, {
		luminara: HEMISPHERE_SKY.luminara.inner,
		noctira: HEMISPHERE_SKY.noctira.inner,
		equilara: HEMISPHERE_SKY.equilara.inner,
	});

	if (blend <= 0.35) return lerpRgb(space, approach, blend / 0.35);
	if (blend <= 0.75) return lerpRgb(approach, shell, (blend - 0.35) / 0.4);
	return lerpRgb(shell, inner, (blend - 0.75) / 0.25);
}

export function getFogColor(blend: number, hemisphereY: number): THREE.Color {
	const space = hexToRgb(ATMOSPHERE_FOG.space);
	const inner = hemisphereBlend(hemisphereY, HEMISPHERE_FOG);
	return lerpRgb(space, inner, blend);
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
