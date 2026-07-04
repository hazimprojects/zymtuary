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
export type LandmarkType = 'fissure' | 'mountain' | 'water' | 'green' | 'arid' | 'hotspring' | 'tree';

const LANDMARK_TYPE_CODE: Record<LandmarkType, number> = {
	fissure: 0,
	mountain: 1,
	water: 2,
	green: 3,
	arid: 4,
	hotspring: 5,
	tree: 6,
};

export type LandmarkFeature = {
	id: string;
	nama: string;
	type: LandmarkType;
	theta: number;
	y: number;
	radius: number;
};

function deg(d: number): number {
	return (d * Math.PI) / 180;
}

export function directionFromThetaY(thetaRad: number, y: number): [number, number, number] {
	const ring = Math.sqrt(Math.max(0, 1 - y * y));
	return [ring * Math.sin(thetaRad), y, ring * Math.cos(thetaRad)];
}

export const LANDMARK_FEATURES: LandmarkFeature[] = [
	// Luminara — rekahan Ignisara, gunung berapi, teres air panas, padang
	// bunga (gema Elythrean Bloomfields), laut hangat, Heartbloom.
	{ id: 'ignisara-rekahan', nama: 'Rekahan Lava Ignisara', type: 'fissure', theta: deg(200), y: 0.88, radius: 0.15 },
	{ id: 'gunung-berapi', nama: 'Gunung Berapi', type: 'mountain', theta: deg(208), y: 0.78, radius: 0.19 },
	{ id: 'teres-air-panas', nama: 'Teres Air Panas', type: 'hotspring', theta: deg(260), y: 0.55, radius: 0.18 },
	{ id: 'padang-bunga', nama: 'Padang Bunga', type: 'green', theta: deg(320), y: 0.45, radius: 0.2 },
	{ id: 'laut-keemasan', nama: 'Laut Keemasan', type: 'water', theta: deg(15), y: 0.35, radius: 0.2 },
	{ id: 'heartbloom', nama: 'Heartbloom', type: 'tree', theta: deg(100), y: 0.5, radius: 0.15 },
	// Noctira — rekahan Nivira, gunung obsidian, tasik gelap (gema Thalyssan
	// Depths), hutan senja (gema Vorynth Wood), padang pasir (gema Gorrathic
	// Badlands).
	{ id: 'nivira-rekahan', nama: 'Rekahan Ais Nivira', type: 'fissure', theta: deg(30), y: -0.88, radius: 0.15 },
	{ id: 'gunung-obsidian', nama: 'Gunung Obsidian', type: 'mountain', theta: deg(80), y: -0.72, radius: 0.19 },
	{ id: 'tasik-gelap', nama: 'Tasik Gelap', type: 'water', theta: deg(150), y: -0.55, radius: 0.18 },
	{ id: 'hutan-senja', nama: 'Hutan Senja', type: 'green', theta: deg(215), y: -0.45, radius: 0.2 },
	{ id: 'padang-pasir', nama: 'Padang Pasir', type: 'arid', theta: deg(300), y: -0.42, radius: 0.18 },
];

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

export type RiverPath = {
	id: string;
	nama: string;
	from: { theta: number; y: number };
	via: { theta: number; y: number };
	to: { theta: number; y: number };
	warna: string;
};

export const MAX_RIVER_POINTS = 7;

/** Dua sungai — satu setiap hemisfera, untuk keseimbangan visual. */
export const RIVER_PATHS: RiverPath[] = [
	{
		id: 'sungai-cahaya',
		nama: 'Sungai Cahaya',
		from: { theta: deg(260), y: 0.55 },
		via: { theta: deg(290), y: 0.5 },
		to: { theta: deg(320), y: 0.45 },
		warna: '#5ba3a0',
	},
	{
		id: 'sungai-kelabu',
		nama: 'Sungai Kelabu',
		from: { theta: deg(80), y: -0.72 },
		via: { theta: deg(115), y: -0.63 },
		to: { theta: deg(150), y: -0.55 },
		warna: '#4a5568',
	},
];

function nlerpUnit(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
	const x = a[0] + (b[0] - a[0]) * t;
	const y = a[1] + (b[1] - a[1]) * t;
	const z = a[2] + (b[2] - a[2]) * t;
	const len = Math.sqrt(x * x + y * y + z * z) || 1;
	return [x / len, y / len, z / len];
}

function riverPoints(river: RiverPath, count: number): [number, number, number][] {
	const from = directionFromThetaY(river.from.theta, river.from.y);
	const via = directionFromThetaY(river.via.theta, river.via.y);
	const to = directionFromThetaY(river.to.theta, river.to.y);
	return Array.from({ length: count }, (_, i) => {
		const t = i / (count - 1);
		return t < 0.5 ? nlerpUnit(from, via, t * 2) : nlerpUnit(via, to, (t - 0.5) * 2);
	});
}

export function buildRiverUniformArrays(): { points: [number, number, number][]; color: string }[] {
	return RIVER_PATHS.map((r) => ({ points: riverPoints(r, MAX_RIVER_POINTS), color: r.warna }));
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
