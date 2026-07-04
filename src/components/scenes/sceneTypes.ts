export type SceneHotspot = {
	/** Label pendek dipaparkan pada butang hotspot, cth. "Mask Vendor's Row" */
	label: string;
	/** Kedudukan peratus (x, y) dalam imej latar — 0-100 */
	position: [number, number];
	/** id Scene destinasi */
	target: string;
};

export type Scene = {
	id: string;
	namaWilayah: string;
	namaKawasan: string;
	/** Nama spot_utama jika scene ini spesifik kepada satu spot; scene hub
	 * (plaza/lorong) tiada nilai ini. */
	namaSpot?: string;
	/** Deskripsi lore dipaparkan sebagai kapsyen (dari spot_utama) */
	deskripsi?: string;
	/** Bisikan watak — dipaparkan pada scene hub bila tiada spot difokus */
	bisikan?: string;
	hotspot: SceneHotspot[];
};
