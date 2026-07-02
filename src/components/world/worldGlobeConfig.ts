export type EntityEntry = {
	id: string;
	nama: string;
	gelaran: string;
	keluarga_aetherys: string;
	keadaan: string;
	bisikan: string;
	spheral_rumah: string;
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
export const RESONANCE_LIFT = 0.06;

export type HemisferaAfiniti = 'luminara' | 'noctira' | 'horizon';

/** Afiniti hemisfera berdasarkan keluarga + spheral_rumah arkib */
export function getHemisferaAfiniti(entity: EntityEntry): HemisferaAfiniti {
	const { keluarga_aetherys, spheral_rumah } = entity;

	if (keluarga_aetherys === 'Duskborne' || keluarga_aetherys === 'Eclipborne') {
		return 'horizon';
	}
	if (keluarga_aetherys === 'Halcyborne') return 'horizon';
	if (keluarga_aetherys === 'Dawnborne') return 'luminara';
	if (spheral_rumah === 'luminara') return 'luminara';
	if (spheral_rumah === 'noctira') return 'noctira';
	return 'horizon';
}

export type ResonancePlacement = {
	entity: EntityEntry;
	position: [number, number, number];
	hemisfera: HemisferaAfiniti;
};

/** Taburkan titik resonans pada permukaan Equilara */
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
		const r = GLOBE_RADIUS + RESONANCE_LIFT;
		const x = ring * Math.sin(theta) * r;
		const z = ring * Math.cos(theta) * r;

		return {
			entity,
			position: [x, y * r, z],
			hemisfera,
		};
	});
}

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
	return h / 1000;
}
