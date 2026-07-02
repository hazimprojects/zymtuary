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

/** Taburkan titik resonans — arah dari pusat untuk cahaya dalaman */
export function layoutResonancePoints(entities: EntityEntry[]): ResonancePlacement[] {
	const golden = Math.PI * (3 - Math.sqrt(5));

	return entities.map((entity, i) => {
		const hemisfera = getHemisferaAfiniti(entity);
		const theta = golden * i * 2.4 + hash(entity.id) * 0.5;

		let y: number;
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

/** Ambang jarak kamera → mod zoom immersive */
export const ZOOM_THRESHOLDS = {
	atmosphereEnter: 4.2,
	descentEnter: 2.75,
} as const;

export const DESCENT_CONFIG = {
	minAltitude: 0.05,
	maxAltitude: 0.55,
	// hampir julat penuh menegak supaya bumi di bawah boleh dipandang terus,
	// bukan hanya langit — dahulu minPitch -0.28 menyekat pandangan ke bawah
	minPitch: -1.4,
	maxPitch: 1.4,
	fov: 68,
	orbitExitDistance: 4.6,
	walkStepAngle: 0.22,
	walkDuration: 0.6,
} as const;

export function getZoomMode(distance: number, descentActive: boolean): ZoomMode {
	if (descentActive) return 'descent';
	if (distance <= ZOOM_THRESHOLDS.descentEnter) return 'atmosphere';
	if (distance <= ZOOM_THRESHOLDS.atmosphereEnter) return 'atmosphere';
	return 'orbit';
}

/** 0 = orbit jauh, 1 = dalam atmosfera / descent */
export function getProximity(distance: number, descentActive = false): number {
	if (descentActive) return 1;
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
