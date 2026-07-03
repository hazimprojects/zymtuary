import * as THREE from 'three';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { VEILROSE_PALETTE } from './veilrosePalette';

/**
 * Susun atur Veilrose Quarter ikut kawasan_deskripsi/spot_utama sebenar —
 * The Applause Steps di tengah pasar (dideskripsikan "di tengah pasar"),
 * The Memory Room dan Mask Vendor's Row di sekelilingnya. Warna tanah setiap
 * spot diambil daripada VEILROSE_PALETTE supaya saling berkaitan, bukan
 * dipilih berasingan mengikut objek.
 */
const SPOT_LAYOUT: Record<string, { angle: number; radius: number; scale: number; groundColor: string }> = {
	'The Applause Steps': { angle: 0, radius: 0, scale: 1.5, groundColor: VEILROSE_PALETTE.cream },
	'The Memory Room of Smiling Frames': { angle: 0.95, radius: 4.2, scale: 1.2, groundColor: VEILROSE_PALETTE.purple },
	"The Mask Vendor's Row": { angle: -2.15, radius: 4.4, scale: 1.05, groundColor: VEILROSE_PALETTE.pink },
};

export function layoutVeilroseAnchors(spots: { nama: string }[]): KawasanAnchor[] {
	return spots.map((spot) => {
		const cfg = SPOT_LAYOUT[spot.nama] ?? { angle: 0, radius: 4, scale: 1, groundColor: VEILROSE_PALETTE.gold };
		return {
			id: spot.nama,
			nama: spot.nama,
			position: new THREE.Vector3(Math.cos(cfg.angle) * cfg.radius, 0, Math.sin(cfg.angle) * cfg.radius),
			groundColor: cfg.groundColor,
			scale: cfg.scale,
		};
	});
}

/** Kedudukan hiasan gerai bunga mawar rawak di sekeliling plaza — mengisi
 * ruang supaya "pasar terbuka dipenuhi gerai bunga mawar" terasa padat &
 * hidup, bukan sekadar 3 objek terpencil dalam ruang kosong. */
export const AMBIENT_ROSE_STALLS: { x: number; z: number; rot: number; scale: number }[] = [
	{ x: 2.1, z: 1.6, rot: 0.4, scale: 0.85 },
	{ x: -1.8, z: 2.4, rot: -0.6, scale: 0.7 },
	{ x: 1.4, z: -2.6, rot: 1.1, scale: 0.9 },
	{ x: -2.6, z: -1.2, rot: -1.4, scale: 0.75 },
	{ x: 5.6, z: -0.4, rot: 0.2, scale: 0.8 },
	{ x: -5.2, z: 1.1, rot: 0.9, scale: 0.72 },
];
