import * as THREE from 'three';

export type KawasanAnchor = {
	id: string;
	nama: string;
	position: THREE.Vector3;
	/** Warna yang bercampur ke tanah plaza berhampiran kawasan ini — diambil
	 * terus daripada apa yang dideskripsikan dalam lore, bukan hue rawak. */
	groundColor: string;
	scale: number;
};

const ISLAND_RADIUS = 6.4;
const GRID_SEGMENTS = 34;

/**
 * Susun atur Mendari ikut hubungan sebenar dalam dokumen — Veilrose Quarter
 * ialah "jantung Mendari" jadi ia diletak di tengah (jejari 0), bukan setara
 * dengan 4 kawasan lain dalam pentagon simetri. Harlequin's Corner sengaja
 * lebih kecil & lebih dekat kerana ia dideskripsikan "lebih kecil dan lebih
 * intim". Warna tanah setiap kawasan diambil daripada teks kawasan_deskripsi:
 * Veilrose = gerai mawar jambu-fuchsia, Faceless Bazaar = cermin/tiada wajah
 * tetap (kelabu perak sejuk), Idlewick = neon pastel, Harlequin's Corner =
 * kafe redup lilin (marun), Velvet Alcove = daun merah jambu lembut + langsir
 * merah wain.
 */
const MENDARI_LAYOUT: Record<
	string,
	{ angle: number; radius: number; scale: number; groundColor: string }
> = {
	zymelisse: { angle: 0, radius: 0, scale: 1.25, groundColor: '#e78bab' },
	zymimic: { angle: -Math.PI / 2.4, radius: 3.9, scale: 1, groundColor: '#c7ced4' },
	zyminque: { angle: Math.PI / 4.4, radius: 4.1, scale: 1.05, groundColor: '#e6a9c9' },
	zymarleq: { angle: Math.PI, radius: 2.5, scale: 0.7, groundColor: '#5c2430' },
	zymirae: { angle: Math.PI * 0.62, radius: 3.4, scale: 0.95, groundColor: '#c98aa0' },
};

export function layoutMendariAnchors(entities: { id: string; nama: string; kawasan?: string }[]): KawasanAnchor[] {
	return entities.map((e) => {
		const cfg = MENDARI_LAYOUT[e.id] ?? { angle: 0, radius: 3.4, scale: 1, groundColor: '#e0b56a' };
		return {
			id: e.id,
			nama: e.kawasan ?? e.nama,
			position: new THREE.Vector3(Math.cos(cfg.angle) * cfg.radius, 0, Math.sin(cfg.angle) * cfg.radius),
			groundColor: cfg.groundColor,
			scale: cfg.scale,
		};
	});
}

const PLAZA_HEIGHT = 0.18;
const EDGE_START = ISLAND_RADIUS * 0.74;
const EDGE_END = ISLAND_RADIUS * 1.12;
/** Applause Steps — tangga marmar berperingkat yang dideskripsikan tepat di
 * jantung Veilrose Quarter (pusat pulau), bukan bonjolan gunung rawak. */
const HEART_STEP_RADIUS = 1.75;

/** Bina geometri plaza faceted rendah-poligon — "kota-taman yang terlalu
 * sempurna" patut rata & tersusun (bukan bukit organik rawak), dengan tepi
 * yang turun lembut macam hujung taman yang direka, dan warna yang
 * bergradasi ke arah kawasan terdekat ikut warna sebenar dalam lore. */
export function buildIslandGeometry(anchors: KawasanAnchor[], baseColor: string): THREE.BufferGeometry {
	const geometry = new THREE.PlaneGeometry(
		ISLAND_RADIUS * 2.3,
		ISLAND_RADIUS * 2.3,
		GRID_SEGMENTS,
		GRID_SEGMENTS,
	);
	geometry.rotateX(-Math.PI / 2);

	const position = geometry.attributes.position;
	const base = new THREE.Color(baseColor);
	const colors: number[] = [];

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		const distFromCenter = Math.hypot(x, z);

		let height = PLAZA_HEIGHT;
		if (distFromCenter > EDGE_START) {
			const edgeT = THREE.MathUtils.clamp((distFromCenter - EDGE_START) / (EDGE_END - EDGE_START), 0, 1);
			height = THREE.MathUtils.lerp(PLAZA_HEIGHT, -0.55, Math.pow(edgeT, 1.6));
		}
		if (distFromCenter < HEART_STEP_RADIUS) {
			const tier = Math.floor((1 - distFromCenter / HEART_STEP_RADIUS) * 3);
			height += tier * 0.085;
		}
		position.setY(i, height);

		let nearestIndex = 0;
		let nearestDist = Infinity;
		anchors.forEach((anchor, idx) => {
			const d = Math.hypot(x - anchor.position.x, z - anchor.position.z);
			if (d < nearestDist) {
				nearestDist = d;
				nearestIndex = idx;
			}
		});
		const blend = THREE.MathUtils.clamp(1 - nearestDist / 3, 0, 0.45);
		const c = base.clone().lerp(new THREE.Color(anchors[nearestIndex]?.groundColor ?? baseColor), blend);
		const edgeShade =
			distFromCenter > EDGE_START
				? THREE.MathUtils.lerp(1, 0.5, THREE.MathUtils.clamp((distFromCenter - EDGE_START) / (ISLAND_RADIUS - EDGE_START), 0, 1))
				: 1;
		colors.push(c.r * edgeShade, c.g * edgeShade, c.b * edgeShade);
	}

	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	return geometry;
}

export { ISLAND_RADIUS };
