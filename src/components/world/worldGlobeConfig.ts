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
