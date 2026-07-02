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
