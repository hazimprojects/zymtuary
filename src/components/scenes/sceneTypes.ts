export type SceneHotspot = {
	/** Label pendek dipaparkan pada butang hotspot, cth. "Mask Vendor's Row" */
	label: string;
	/** Kedudukan peratus (x, y) dalam imej latar — 0-100 */
	position: [number, number];
	/** id Scene destinasi — untuk peralihan DALAM VN yang sama (tiada muat
	 * semula halaman). Tetapkan salah satu sahaja daripada target/href. */
	target?: string;
	/** Laluan URL sebenar — untuk navigasi KE HALAMAN Astro lain (cth. dari
	 * hub wilayah ke /kawasan/veilrose-quarter). Tetapkan salah satu sahaja
	 * daripada target/href. */
	href?: string;
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
