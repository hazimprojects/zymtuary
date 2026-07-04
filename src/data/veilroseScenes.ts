import zipModel from './zip-model.json';
import type { Scene } from '../components/scenes/sceneTypes';

const zymelisse = zipModel.entities.find((e) => e.id === 'zymelisse');
if (!zymelisse) throw new Error('Entiti "zymelisse" (Veilrose Quarter) tidak dijumpai dalam zip-model.json');

function spotDeskripsi(nama: string): string {
	const spot = zymelisse!.spot_utama.find((s) => s.nama === nama);
	if (!spot) throw new Error(`Spot "${nama}" tidak dijumpai dalam spot_utama Zymelisse`);
	return spot.deskripsi;
}

const WILAYAH = 'Mendari';
const KAWASAN = zymelisse.kawasan;
const BISIKAN = zymelisse.bisikan;

/**
 * Susun atur scene Veilrose Quarter — hub (plaza) di tengah dengan 4
 * hotspot terus, satu daripadanya ("lorong belakang") membawa ke rantaian
 * dua scene tersorok (Rehearsal Mirrors -> Room of Fallen Petals) selaras
 * lore kedua-duanya yang sengaja "tersorok"/"dibuang jauh dari mata
 * pengunjung". Applause Steps, Mask Vendor's Row, dan Memory Room kekal
 * terus boleh dicapai daripada plaza kerana ketiga-tiganya "di tengah
 * pasar"/terbuka mengikut deskripsi lore.
 */
export const VEILROSE_SCENES: Record<string, Scene> = {
	'veilrose-plaza': {
		id: 'veilrose-plaza',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		bisikan: BISIKAN,
		hotspot: [
			{ label: 'The Applause Steps', position: [50, 58], target: 'veilrose-applause-steps' },
			{ label: "The Mask Vendor's Row", position: [18, 62], target: 'veilrose-mask-row' },
			{ label: 'The Memory Room of Smiling Frames', position: [80, 58], target: 'veilrose-memory-room' },
			{ label: 'Lorong belakang pasar', position: [50, 88], target: 'veilrose-back-alley' },
		],
	},
	'veilrose-applause-steps': {
		id: 'veilrose-applause-steps',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		namaSpot: 'The Applause Steps',
		deskripsi: spotDeskripsi('The Applause Steps'),
		hotspot: [{ label: '← Kembali ke pasar', position: [50, 16], target: 'veilrose-plaza' }],
	},
	'veilrose-mask-row': {
		id: 'veilrose-mask-row',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		namaSpot: "The Mask Vendor's Row",
		deskripsi: spotDeskripsi("The Mask Vendor's Row"),
		hotspot: [{ label: '← Kembali ke pasar', position: [50, 16], target: 'veilrose-plaza' }],
	},
	'veilrose-memory-room': {
		id: 'veilrose-memory-room',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		namaSpot: 'The Memory Room of Smiling Frames',
		deskripsi: spotDeskripsi('The Memory Room of Smiling Frames'),
		bisikan: BISIKAN,
		hotspot: [{ label: '← Kembali ke pasar', position: [50, 16], target: 'veilrose-plaza' }],
	},
	'veilrose-back-alley': {
		id: 'veilrose-back-alley',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		hotspot: [
			{ label: 'The Rehearsal Mirrors', position: [62, 56], target: 'veilrose-rehearsal-mirrors' },
			{ label: '← Kembali ke pasar', position: [50, 16], target: 'veilrose-plaza' },
		],
	},
	'veilrose-rehearsal-mirrors': {
		id: 'veilrose-rehearsal-mirrors',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		namaSpot: 'The Rehearsal Mirrors',
		deskripsi: spotDeskripsi('The Rehearsal Mirrors'),
		hotspot: [
			{ label: 'The Room of Fallen Petals', position: [76, 56], target: 'veilrose-fallen-petals' },
			{ label: '← Kembali ke lorong', position: [50, 16], target: 'veilrose-back-alley' },
		],
	},
	'veilrose-fallen-petals': {
		id: 'veilrose-fallen-petals',
		namaWilayah: WILAYAH,
		namaKawasan: KAWASAN,
		namaSpot: 'The Room of Fallen Petals',
		deskripsi: spotDeskripsi('The Room of Fallen Petals'),
		hotspot: [{ label: '← Kembali', position: [50, 16], target: 'veilrose-rehearsal-mirrors' }],
	},
};

export const VEILROSE_ENTRY_SCENE = 'veilrose-plaza';
