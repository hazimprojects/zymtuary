import zipModel from './zip-model.json';
import type { Scene } from '../components/scenes/sceneTypes';

const wilayahMendari = zipModel.wilayah.find((w) => w.id === 'mendari');
if (!wilayahMendari) throw new Error('Wilayah "mendari" tidak dijumpai dalam zip-model.json');

const mendariEntities = zipModel.entities.filter((e) => e.wilayah === 'mendari');
const veilrose = mendariEntities.find((e) => e.id === 'zymelisse');
if (!veilrose?.kawasan) throw new Error('Entiti "zymelisse" (Veilrose Quarter) tidak dijumpai dalam zip-model.json');

/** Hub Mendari — satu-satunya kawasan yang sudah ada scene sendiri
 * (Veilrose Quarter) dipautkan terus sebagai hotspot `href` (navigasi
 * HALAMAN sebenar, bukan peralihan dalam-VN, kerana ia laluan Astro
 * berasingan). */
export const MENDARI_HUB_SCENE: Scene = {
	id: 'mendari-hub',
	namaWilayah: wilayahMendari.nama,
	namaKawasan: wilayahMendari.nama,
	bisikan: wilayahMendari.deskripsi.split('.')[0] + '.',
	hotspot: [{ label: veilrose.kawasan, position: [50, 58], href: '/kawasan/veilrose-quarter' }],
};

/** Kawasan lain Mendari belum dibina sebagai scene sendiri (giliran
 * seterusnya selepas Veilrose Quarter, ikut arahan_peralihan_visual_novel.md
 * §5 langkah 7) — dipaparkan sebagai label pudar tanpa hotspot berfungsi,
 * supaya peta terasa lengkap tanpa menjanjikan pautan yang belum wujud. */
export const MENDARI_UPCOMING_KAWASAN: { nama: string; position: [number, number] }[] = mendariEntities
	.filter((e) => e.id !== 'zymelisse' && e.kawasan)
	.map((e, i) => {
		const positions: [number, number][] = [
			[20, 28],
			[80, 28],
			[20, 78],
			[80, 78],
		];
		return { nama: e.kawasan!, position: positions[i % positions.length] };
	});
