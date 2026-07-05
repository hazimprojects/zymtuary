export type SpotUtama = {
	nama: string;
	deskripsi: string;
};

export type EntityEntry = {
	id: string;
	nama: string;
	gelaran: string;
	keluarga_aetherys: string;
	keadaan: string;
	bisikan: string;
	spheral_rumah: string;
	wilayah?: string;
	kawasan?: string;
	kawasan_deskripsi?: string;
	spot_utama?: SpotUtama[];
};

/** Warna hemisfera — orientasi geografi, bukan alam berasingan */
export const HEMISPHERE_COLORS = {
	luminara: '#d4a843',
	noctira: '#5c4a8a',
	equilara: '#9a8f7a',
} as const;

export const FAMILY_COLORS: Record<string, string> = {
	Lumiborne: '#e8c96a',
	Noctiborne: '#7a6898',
	Duskborne: '#a89078',
	Dawnborne: '#c4a86a',
	Halcyborne: '#8eb8a8',
	Eclipborne: '#8a7aa8',
};

export const GLOBE_RADIUS = 1.55;

export type HemisferaAfiniti = 'luminara' | 'noctira' | 'horizon';

/**
 * Afiniti hemisfera ikut geografi rasmi (5.2 Peta Geografi Zymtuary):
 * Ascendari (Duskborne) & Mendari (Lumiborne) di Luminara; Veldari (Noctiborne)
 * & Threndari (Dawnborne) di Noctira; Wandari (Halcyborne) & Resonari
 * (Eclipborne) di Equilara — spheral_rumah kini padan terus dengan wilayah.
 */
export function getHemisferaAfiniti(entity: EntityEntry): HemisferaAfiniti {
	if (entity.spheral_rumah === 'luminara') return 'luminara';
	if (entity.spheral_rumah === 'noctira') return 'noctira';
	return 'horizon';
}

export type SpheralRegionId = 'luminara' | 'noctira' | 'equilara';

/**
 * Klasifikasikan satu titik pada permukaan globe (arah normal -1..1 pada
 * paksi-y) kepada Spheral sebenar mengikut dokumen — dunia terbahagi kepada
 * Luminara (hemisfera cahaya), Noctira (hemisfera bayang), dan Equilara
 * (jalur khatulistiwa). Lebar jalur ini sepadan dengan pewarnaan hemisfera
 * dalam globeShader.ts (uLuminara/uNoctira melebar dari lat 0→0.7, uEquilara
 * tertumpu pada |lat| < 0.28) supaya apa yang dilihat sepadan dengan ke mana
 * ketikan membawa anda.
 */
export function classifyDirectionToSpheral(y: number): SpheralRegionId {
	if (y > 0.28) return 'luminara';
	if (y < -0.28) return 'noctira';
	return 'equilara';
}

export type ResonancePlacement = {
	entity: EntityEntry;
	position: [number, number, number];
	direction: [number, number, number];
	hemisfera: HemisferaAfiniti;
};

export type WilayahPortal = {
	wilayahId: string;
	nama: string;
	route: string;
	theta: number;
	y: number;
};

/**
 * Wilayah yang sudah ada scene 3D sendiri (lihat src/pages/wilayah/) boleh
 * "diportalkan" — lokasi tetap pada permukaan globe supaya descent yang
 * cukup dekat dengan titik ini boleh terus tawarkan masuk ke halaman wilayah
 * berkenaan. Wilayah lain (cth. Ascendari) kekal sebagai serakan entiti biasa
 * tanpa portal sehingga scene masing-masing dibina.
 */
export const WILAYAH_PORTALS: Record<string, WilayahPortal> = {
	// theta/y MESTI sama dengan ciri 'mendari-kota' dalam LANDMARK_FEATURES.
	mendari: { wilayahId: 'mendari', nama: 'Mendari', route: '/wilayah/mendari', theta: 0.65, y: 0.62 },
};

export function portalDirection(portal: WilayahPortal): [number, number, number] {
	const ring = Math.sqrt(Math.max(0, 1 - portal.y * portal.y));
	return [ring * Math.sin(portal.theta), portal.y, ring * Math.cos(portal.theta)];
}

/** Kosinus sudut penerimaan portal — dalam lingkaran ini pada permukaan
 * globe, descent akan tawarkan masuk terus ke scene wilayah berkenaan. */
export const PORTAL_ENTER_COS = Math.cos(0.34);

/** Taburkan titik resonans — arah dari pusat untuk cahaya dalaman. Entiti
 * yang tergolong dalam wilayah berportal dikelompokkan rapat dengan
 * portalnya (supaya cahaya pada globe benar-benar menandakan lokasi Mendari,
 * bukan serakan rawak merata hemisfera); yang lain kekal taburan lama. */
export function layoutResonancePoints(entities: EntityEntry[]): ResonancePlacement[] {
	const golden = Math.PI * (3 - Math.sqrt(5));

	return entities.map((entity, i) => {
		const hemisfera = getHemisferaAfiniti(entity);
		const portal = entity.wilayah ? WILAYAH_PORTALS[entity.wilayah] : undefined;

		let theta: number;
		let y: number;

		if (portal) {
			theta = portal.theta + (hash(entity.id + 'theta') - 0.5) * 0.5;
			y = Math.min(0.92, Math.max(0.3, portal.y + (hash(entity.id + 'y') - 0.5) * 0.16));
		} else {
			theta = golden * i * 2.4 + hash(entity.id) * 0.5;
			switch (hemisfera) {
				case 'luminara':
					y = 0.35 + hash(entity.id + 'y') * 0.45;
					break;
				case 'noctira':
					y = -0.35 - hash(entity.id + 'y') * 0.45;
					break;
				case 'horizon':
					y = (hash(entity.id + 'y') - 0.5) * 0.35;
					break;
			}
		}

		const ring = Math.sqrt(Math.max(0, 1 - y * y));
		const dirX = ring * Math.sin(theta);
		const dirZ = ring * Math.cos(theta);
		const dirY = y;
		const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

		const direction: [number, number, number] = [dirX / len, dirY / len, dirZ / len];
		const position: [number, number, number] = [
			direction[0] * GLOBE_RADIUS,
			direction[1] * GLOBE_RADIUS,
			direction[2] * GLOBE_RADIUS,
		];

		return { entity, position, direction, hemisfera };
	});
}

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
	return h / 1000;
}

/**
 * Mercu tanda "liar" pada permukaan globe — bukan wilayah watak, tetapi gema
 * lapisan mitos yang lebih dalam (Ignisara/Nivira/Primisera) menembusi
 * permukaan wilayah kini. Zym telah lama meninggalkan dunia ini selepas
 * Descent, jadi permukaannya kini kaya dengan lapisan peninggalan sepanjang
 * kewujudannya — bukan sekadar wilayah watak yang terbina baru-baru ini.
 * Kedudukan sengaja diseimbangkan antara dua hemisfera (setiap satu ada
 * rekahan api/ais, gunung, air, dan kawasan hijau) ikut arahan reka bentuk.
 */
export type LandmarkType = 'fissure' | 'mountain' | 'water' | 'green' | 'arid' | 'hotspring' | 'tree' | 'selat' | 'kota';

const LANDMARK_TYPE_CODE: Record<LandmarkType, number> = {
	fissure: 0,
	mountain: 1,
	water: 2,
	green: 3,
	arid: 4,
	hotspring: 5,
	tree: 6,
	selat: 7,
	kota: 8,
};

export type LandmarkFeature = {
	id: string;
	nama: string;
	type: LandmarkType;
	theta: number;
	y: number;
	radius: number;
};

export function deg(d: number): number {
	return (d * Math.PI) / 180;
}

export function directionFromThetaY(thetaRad: number, y: number): [number, number, number] {
	const ring = Math.sqrt(Math.max(0, 1 - y * y));
	return [ring * Math.sin(thetaRad), y, ring * Math.cos(thetaRad)];
}

/**
 * Rekahan (fissure) TIDAK lagi disenaraikan di sini — bentuknya kini rangkaian
 * retakan bercabang (lihat generateCrackNetwork di bawah), bukan tampalan
 * bulat. Pusat rekahan hidup dalam FISSURE_CENTERS.
 */
export const LANDMARK_FEATURES: LandmarkFeature[] = [
	// Luminara — gunung berapi, teres air panas, padang bunga (gema
	// Elythrean Bloomfields), laut hangat, Heartbloom.
	{ id: 'gunung-berapi', nama: 'Gunung Berapi', type: 'mountain', theta: deg(208), y: 0.78, radius: 0.19 },
	{ id: 'teres-air-panas', nama: 'Teres Air Panas', type: 'hotspring', theta: deg(260), y: 0.55, radius: 0.27 },
	{ id: 'padang-bunga', nama: 'Padang Bunga', type: 'green', theta: deg(320), y: 0.45, radius: 0.2 },
	{ id: 'laut-keemasan', nama: 'Laut Keemasan', type: 'water', theta: deg(15), y: 0.35, radius: 0.2 },
	// Mendari — kota-taman Wilayah Lumiborne (Codex 5.2). theta/y MESTI sama
	// dengan WILAYAH_PORTALS.mendari supaya lokasi terrain & titik portal
	// padan tepat. Struktur 3D (rumah + carousel) dilayan dalam
	// MendariTownscape.tsx.
	{ id: 'mendari-kota', nama: 'Mendari', type: 'kota', theta: 0.65, y: 0.62, radius: 0.13 },
	// Heartbloom Isle — pulau pokok gergasi Heartbloom. Cukup jauh (~60°)
	// drpd Pulau Ascendari supaya kedua-dua pulau tidak bertindih jadi satu
	// bongkah tanah — dipisahkan oleh Selat Equilara (lihat rantaian
	// 'selat-*' di bawah) yang menghubungkan Luminara terus ke Noctira.
	{ id: 'heartbloom', nama: 'Heartbloom Isle', type: 'tree', theta: deg(100), y: 0.5, radius: 0.15 },
	// Pulau Ascendari — pulau besar berbatu tempat menara Ascendari berdiri
	// (struktur 3D menara dilayan berasingan dalam AscendariTower.tsx).
	{ id: 'ascendari-pulau', nama: 'Pulau Ascendari', type: 'mountain', theta: deg(160), y: 0.5, radius: 0.15 },
	// Noctira — gunung obsidian, tasik gelap (gema Thalyssan Depths), hutan
	// senja (gema Vorynth Wood), padang pasir (gema Gorrathic Badlands).
	{ id: 'gunung-obsidian', nama: 'Gunung Obsidian', type: 'mountain', theta: deg(80), y: -0.72, radius: 0.19 },
	{ id: 'tasik-gelap', nama: 'Tasik Gelap', type: 'water', theta: deg(150), y: -0.55, radius: 0.18 },
	{ id: 'hutan-senja', nama: 'Hutan Senja', type: 'green', theta: deg(215), y: -0.45, radius: 0.2 },
	{ id: 'padang-pasir', nama: 'Padang Pasir', type: 'arid', theta: deg(300), y: -0.42, radius: 0.18 },
	// Selat Equilara — rantaian laut penghubung Heartbloom Isle/Pulau
	// Ascendari (Luminara) merentasi khatulistiwa Equilara terus ke Tasik
	// Gelap (Noctira), warna aqua tersendiri (bukan keemasan/gelap seperti
	// laut lain) mewakili pertemuan kedua-dua spheral.
	{ id: 'selat-equilara-utara', nama: 'Selat Equilara (Utara)', type: 'selat', theta: deg(130), y: 0.32, radius: 0.22 },
	{ id: 'selat-equilara-tengah', nama: 'Selat Equilara (Tengah)', type: 'selat', theta: deg(130), y: 0.0, radius: 0.24 },
	{ id: 'selat-equilara-selatan', nama: 'Selat Equilara (Selatan)', type: 'selat', theta: deg(145), y: -0.32, radius: 0.24 },
];

/** Cari arah 3D satu ciri (guna id) — supaya komponen 3D berasingan
 * (menara, pokok gergasi) sentiasa padan dgn kedudukan sebenar dlm
 * LANDMARK_FEATURES tanpa perlu menyalin theta/y secara berasingan
 * (elak risiko dua tempat jadi tidak segerak apabila kedudukan diubah). */
export function findLandmarkDirection(id: string): [number, number, number] {
	const feature = LANDMARK_FEATURES.find((f) => f.id === id);
	if (!feature) throw new Error(`Landmark not found: ${id}`);
	return directionFromThetaY(feature.theta, feature.y);
}

export const MAX_FEATURES = 16;

export function buildFeatureUniformArrays(): {
	dirs: [number, number, number][];
	types: number[];
	radii: number[];
	count: number;
} {
	return {
		dirs: LANDMARK_FEATURES.map((f) => directionFromThetaY(f.theta, f.y)),
		types: LANDMARK_FEATURES.map((f) => LANDMARK_TYPE_CODE[f.type]),
		radii: LANDMARK_FEATURES.map((f) => f.radius),
		count: LANDMARK_FEATURES.length,
	};
}

// ---------------------------------------------------------------------------
// Rangkaian bercabang (sungai & rekahan) — dijana sebagai segmen dalam
// satah tangen berpusat pada satu arah, kemudian diunjur semula ke sfera.
// Ini elak trigonometri sfera yang rumit untuk percabangan, dan padan
// dengan aduan: sungai bukan garis lurus, rekahan bukan bulatan licin.
// ---------------------------------------------------------------------------

export type Segment = { a: [number, number, number]; b: [number, number, number]; width: number };

function cross3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize3(a: [number, number, number]): [number, number, number] {
	const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
	return [a[0] / len, a[1] / len, a[2] / len];
}

export function tangentBasis(dir: [number, number, number]): {
	u: [number, number, number];
	v: [number, number, number];
} {
	const upRef: [number, number, number] = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
	const u = normalize3(cross3(upRef, dir));
	const v = cross3(dir, u);
	return { u, v };
}

/** RNG berbenih (mulberry32) — supaya rangkaian bercabang konsisten antara
 * muat semula, bukan berubah rawak setiap kali. */
export function seededRng(seed: number): () => number {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function localToDir(
	center: [number, number, number],
	u: [number, number, number],
	v: [number, number, number],
	lu: number,
	lv: number,
): [number, number, number] {
	return normalize3([center[0] + u[0] * lu + v[0] * lv, center[1] + u[1] * lu + v[1] * lv, center[2] + u[2] * lu + v[2] * lv]);
}

/** Songsang localToDir kasar — unjur satu arah sfera ke koordinat satah
 * tangen setempat (anggaran munasabah untuk pemisahan sudut kecil-sederhana),
 * supaya sungai boleh disasarkan tepat ke arah ciri lain (cth. laut). */
function dot3(a: [number, number, number], b: [number, number, number]): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function projectToTangent(
	center: [number, number, number],
	u: [number, number, number],
	v: [number, number, number],
	target: [number, number, number],
): [number, number] {
	return [dot3(target, u), dot3(target, v)];
}

export type FissureCenter = { id: string; nama: string; theta: number; y: number; radius: number; seed: number };

export const FISSURE_CENTERS: FissureCenter[] = [
	// y dijauhkan daripada kutub sfera (~0.95+) — geometri UV-sphere paling
	// terjejas/tirus berhampiran kutub, menyebabkan anjakan verteks di situ
	// membentuk kawah/lubang kelihatan pada sfera rendah-poligon.
	{ id: 'ignisara-rekahan', nama: 'Rekahan Lava Ignisara', theta: deg(200), y: 0.72, radius: 0.22, seed: 17 },
	{ id: 'nivira-rekahan', nama: 'Rekahan Ais Nivira', theta: deg(30), y: -0.72, radius: 0.22, seed: 42 },
];

export const MAX_CRACK_SEGMENTS = 26;

/**
 * Rangkaian retak macam labah-labah — beberapa retakan utama merekah keluar
 * dari satu pusat dalam arah berlainan, setiap satu jengkel (jagged) dan
 * kadangkala bercabang ke retakan kecil, mengecil (tirus) ke hujung.
 */
export function generateCrackNetwork(center: [number, number, number], radius: number, seed: number, maxSegments: number): Segment[] {
	const { u, v } = tangentBasis(center);
	const rng = seededRng(seed);
	const segments: Segment[] = [];
	const primaryCount = 4 + Math.floor(rng() * 2);

	for (let p = 0; p < primaryCount && segments.length < maxSegments; p++) {
		const baseAngle = (p / primaryCount) * Math.PI * 2 + (rng() - 0.5) * 0.7;
		let angle = baseAngle;
		let lu = 0;
		let lv = 0;
		let width = radius * 0.1;
		const steps = 3 + Math.floor(rng() * 2);

		for (let s = 0; s < steps && segments.length < maxSegments; s++) {
			const stepLen = (radius / steps) * (0.75 + rng() * 0.55);
			angle += (rng() - 0.5) * 0.55;
			const nlu = lu + Math.cos(angle) * stepLen;
			const nlv = lv + Math.sin(angle) * stepLen;
			segments.push({ a: localToDir(center, u, v, lu, lv), b: localToDir(center, u, v, nlu, nlv), width });

			if (s > 0 && rng() < 0.3 && segments.length < maxSegments) {
				const branchAngle = angle + (rng() < 0.5 ? 1 : -1) * (0.65 + rng() * 0.5);
				const branchLen = stepLen * (0.5 + rng() * 0.35);
				const blu = nlu + Math.cos(branchAngle) * branchLen;
				const blv = nlv + Math.sin(branchAngle) * branchLen;
				segments.push({
					a: localToDir(center, u, v, nlu, nlv),
					b: localToDir(center, u, v, blu, blv),
					width: width * 0.5,
				});
			}

			lu = nlu;
			lv = nlv;
			width *= 0.75;
		}
	}

	return segments;
}

export function buildCrackUniformArrays(): {
	a: [number, number, number][];
	b: [number, number, number][];
	width: number[];
	/** Pusat + jejari lingkungan setiap rekahan — tapisan murah supaya
	 * gelung segmen retak tidak perlu dinilai di seluruh permukaan. */
	boundDirs: [number, number, number][];
	boundRadius: number[];
} {
	const all = FISSURE_CENTERS.flatMap((f) =>
		generateCrackNetwork(directionFromThetaY(f.theta, f.y), f.radius, f.seed, Math.floor(MAX_CRACK_SEGMENTS / FISSURE_CENTERS.length)),
	);
	const padded = Array.from({ length: MAX_CRACK_SEGMENTS }, (_, i) => all[i] ?? { a: [0, 1, 0] as const, b: [0, 1, 0] as const, width: 0 });
	return {
		a: padded.map((s) => s.a as [number, number, number]),
		b: padded.map((s) => s.b as [number, number, number]),
		width: padded.map((s) => s.width),
		boundDirs: FISSURE_CENTERS.map((f) => directionFromThetaY(f.theta, f.y)),
		boundRadius: FISSURE_CENTERS.map((f) => f.radius * 1.9),
	};
}

export type RiverNetwork = {
	id: string;
	nama: string;
	center: { theta: number; y: number };
	from: [number, number];
	to: [number, number];
	seed: number;
	warna: string;
};

/** Dua sungai — satu setiap hemisfera. `from`/`to` dalam unit satah tangen
 * (bukan sudut sfera) supaya laluan boleh bengkok/bercabang secara semula
 * jadi sebelum diunjur ke permukaan sfera. */
/** Sasarkan hujung sungai tepat ke arah ciri lain (cth. laut/tasik) supaya
 * sungai kelihatan benar-benar mengalir masuk ke situ, bukan berhenti di
 * tengah padang tanpa destinasi. */
function riverTargetLocal(centerTheta: number, centerY: number, targetTheta: number, targetY: number): [number, number] {
	const center = directionFromThetaY(centerTheta, centerY);
	const { u, v } = tangentBasis(center);
	const target = directionFromThetaY(targetTheta, targetY);
	return projectToTangent(center, u, v, target);
}

export const RIVER_NETWORKS: RiverNetwork[] = [
	{
		id: 'sungai-cahaya',
		nama: 'Sungai Cahaya',
		center: { theta: deg(290), y: 0.5 },
		from: [-0.22, 0.08],
		// Muara ke Laut Keemasan (theta 15°, y 0.35)
		to: riverTargetLocal(deg(290), 0.5, deg(15), 0.35),
		seed: 71,
		warna: '#5ba3a0',
	},
	{
		id: 'sungai-kelabu',
		nama: 'Sungai Kelabu',
		center: { theta: deg(115), y: -0.63 },
		from: [-0.24, -0.05],
		// Muara ke Tasik Gelap (theta 150°, y -0.55)
		to: riverTargetLocal(deg(115), -0.63, deg(150), -0.55),
		seed: 133,
		warna: '#4a5568',
	},
];

export const MAX_RIVER_SEGMENTS = 10;

/**
 * Sungai tirus & bercabang — nipis di hulu (sumber), melebar ke hilir
 * (muara), dengan satu anak sungai (tributary) yang menyatu di tengah,
 * dijana melalui gelek rawak (meander) supaya tidak jadi garis lurus.
 */
export function generateRiverNetwork(river: RiverNetwork, maxSegments: number): Segment[] {
	const center = directionFromThetaY(river.center.theta, river.center.y);
	const { u, v } = tangentBasis(center);
	const rng = seededRng(river.seed);
	const segments: Segment[] = [];

	const steps = 5;
	let width = 0.012;
	const widthGrowth = 1.24;
	let [lu, lv] = river.from;
	const [tu, tv] = river.to;

	for (let s = 0; s < steps && segments.length < maxSegments; s++) {
		const t = (s + 1) / steps;
		const targetU = river.from[0] + (tu - river.from[0]) * t + (rng() - 0.5) * 0.045;
		const targetV = river.from[1] + (tv - river.from[1]) * t + (rng() - 0.5) * 0.045;
		segments.push({ a: localToDir(center, u, v, lu, lv), b: localToDir(center, u, v, targetU, targetV), width });

		if (s === Math.floor(steps / 2) && segments.length < maxSegments) {
			const tribAngle = Math.atan2(targetV - lv, targetU - lu) + (rng() < 0.5 ? 1 : -1) * (0.75 + rng() * 0.4);
			const tribLen = 0.14 + rng() * 0.06;
			const tribStartU = targetU + Math.cos(tribAngle) * tribLen;
			const tribStartV = targetV + Math.sin(tribAngle) * tribLen;
			segments.push({
				a: localToDir(center, u, v, tribStartU, tribStartV),
				b: localToDir(center, u, v, targetU, targetV),
				width: width * 0.5,
			});
		}

		lu = targetU;
		lv = targetV;
		width *= widthGrowth;
	}

	return segments;
}

/** Jejari lingkungan tetap yang meliputi keseluruhan rangkaian sungai
 * (from/to dalam unit satah tangen tidak pernah melebihi ~0.3) — tapisan
 * murah supaya gelung segmen sungai tidak dinilai di seluruh permukaan. */
const RIVER_BOUND_RADIUS = 0.45;

export function buildRiverUniformArrays(): {
	a: [number, number, number][];
	b: [number, number, number][];
	width: number[];
	color: string;
	boundDir: [number, number, number];
	boundRadius: number;
}[] {
	return RIVER_NETWORKS.map((river) => {
		const segs = generateRiverNetwork(river, MAX_RIVER_SEGMENTS);
		const padded = Array.from({ length: MAX_RIVER_SEGMENTS }, (_, i) => segs[i] ?? { a: [0, 1, 0] as const, b: [0, 1, 0] as const, width: 0 });
		return {
			a: padded.map((s) => s.a as [number, number, number]),
			b: padded.map((s) => s.b as [number, number, number]),
			width: padded.map((s) => s.width),
			color: river.warna,
			boundDir: directionFromThetaY(river.center.theta, river.center.y),
			boundRadius: RIVER_BOUND_RADIUS,
		};
	});
}

export type ZoomMode = 'orbit' | 'atmosphere' | 'descent';

export const DESCENT_CONFIG = {
	minAltitude: 0.05,
	maxAltitude: 0.55,
	// hampir julat penuh menegak (termasuk lurus ke bawah) supaya bumi di bawah
	// boleh dipandang terus dan kemasukan descent tidak perlu klip pitch mentah
	minPitch: -1.5,
	maxPitch: 1.4,
	fov: 68,
	orbitExitDistance: 4.6,
	/** Kelajuan joystick bergerak di permukaan globe — lebih perlahan supaya terkawal */
	moveAngularSpeed: 0.24,
	lookYawSpeedMobile: 0.0042,
	lookYawSpeedDesktop: 0.0032,
	lookPitchSpeedMobile: 0.0032,
	lookPitchSpeedDesktop: 0.0026,
	/** Kelajuan pembetulan sudut ke arah globe semasa zoom out */
	zoomOutAlignSpeed: 4.2,
} as const;

/** Ambang jarak kamera → mod zoom immersive */
export const ZOOM_THRESHOLDS = {
	atmosphereEnter: 4.2,
	// Sepadan tepat dengan maxAltitude supaya masuk descent tidak melonjak
	// kedudukan kamera — pada jarak ini altitud sudah dalam julat descent.
	descentEnter: GLOBE_RADIUS + DESCENT_CONFIG.maxAltitude,
} as const;

/**
 * Joystick maya di penjuru bawah (kiri/kanan) untuk bergerak — seret di
 * mana-mana tempat lain untuk toleh 360°. Dua zon ini beroperasi secara
 * berasingan (boleh guna serentak dengan dua jari, macam kawalan FPS mobile).
 */
export const JOYSTICK_CONFIG = {
	maxRadius: 56,
	deadzone: 0.12,
	moveAngularSpeed: 0.42,
	cornerZoneWidthFrac: 0.35,
	cornerZoneHeightFrac: 0.45,
} as const;

export function getZoomMode(distance: number, descentActive: boolean): ZoomMode {
	if (descentActive) return 'descent';
	if (distance <= ZOOM_THRESHOLDS.descentEnter) return 'atmosphere';
	if (distance <= ZOOM_THRESHOLDS.atmosphereEnter) return 'atmosphere';
	return 'orbit';
}

/** 0 = orbit jauh, 1 = dalam atmosfera / descent */
export function getProximity(distance: number): number {
	const near = GLOBE_RADIUS + 0.18;
	const far = ZOOM_THRESHOLDS.atmosphereEnter;
	return 1 - Math.min(1, Math.max(0, (distance - near) / (far - near)));
}

export function getOrbitControlsForMode(mode: ZoomMode, isMobile: boolean) {
	const base = isMobile
		? { maxDistance: 10, zoomSpeed: 1.0, rotateSpeed: 0.45, minPolarAngle: 0.15, maxPolarAngle: Math.PI - 0.15 }
		: { maxDistance: 6.5, zoomSpeed: 0.85, rotateSpeed: 0.55, minPolarAngle: 0.12, maxPolarAngle: Math.PI - 0.12 };

	switch (mode) {
		case 'atmosphere':
			return {
				...base,
				minDistance: isMobile ? 2.0 : 1.85,
				rotateSpeed: base.rotateSpeed * 0.9,
			};
		default:
			return {
				...base,
				minDistance: isMobile ? 4.2 : 3.0,
			};
	}
}
