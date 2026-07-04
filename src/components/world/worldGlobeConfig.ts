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

/** Skala globe ini sengaja kecil & stylized — bukan cubaan mensimulasikan
 * bumi sebenar, cuma satu bola kecil yang boleh didekati/di-zoom. */
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

export type ResonancePlacement = {
	entity: EntityEntry;
	position: [number, number, number];
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
 * Wilayah yang sudah ada scene sendiri (lihat src/pages/wilayah/) boleh
 * "diportalkan" — lokasi tetap pada permukaan globe supaya zoom yang cukup
 * dekat dengan titik ini boleh tawarkan masuk terus ke halaman wilayah
 * berkenaan. Wilayah lain kekal sebagai serakan entiti biasa tanpa portal
 * sehingga scene masing-masing dibina.
 */
export const WILAYAH_PORTALS: Record<string, WilayahPortal> = {
	mendari: { wilayahId: 'mendari', nama: 'Mendari', route: '/wilayah/mendari', theta: 0.65, y: 0.62 },
};

export function portalDirection(portal: WilayahPortal): [number, number, number] {
	const ring = Math.sqrt(Math.max(0, 1 - portal.y * portal.y));
	return [ring * Math.sin(portal.theta), portal.y, ring * Math.cos(portal.theta)];
}

/** Taburkan titik resonans — cahaya kecil mewakili setiap entiti pada
 * permukaan globe. Entiti yang tergolong dalam wilayah berportal
 * dikelompokkan rapat dengan portalnya (supaya cahaya pada globe benar-benar
 * menandakan lokasi Mendari, bukan serakan rawak merata hemisfera). */
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

		const position: [number, number, number] = [
			(dirX / len) * GLOBE_RADIUS,
			(dirY / len) * GLOBE_RADIUS,
			(dirZ / len) * GLOBE_RADIUS,
		];

		return { entity, position, hemisfera };
	});
}

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
	return h / 1000;
}

/** Kamera cukup dekat DAN menghala kira-kira ke arah portal untuk tawarkan
 * masuk — dot product antara arah kamera->pusat dan arah portal. */
export const PORTAL_ENTER_COS = Math.cos(0.5);
export const PORTAL_ENTER_DISTANCE = GLOBE_RADIUS + 0.9;
