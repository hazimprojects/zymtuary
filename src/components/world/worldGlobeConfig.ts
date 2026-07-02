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

export type ZoomMode = 'orbit' | 'atmosphere' | 'surface';

/** Ambang jarak kamera → mod zoom immersive */
export const ZOOM_THRESHOLDS = {
	atmosphereEnter: 4.2,
	surfaceEnter: 2.65,
} as const;

export function getZoomMode(distance: number): ZoomMode {
	if (distance <= ZOOM_THRESHOLDS.surfaceEnter) return 'surface';
	if (distance <= ZOOM_THRESHOLDS.atmosphereEnter) return 'atmosphere';
	return 'orbit';
}

/** 0 = orbit jauh, 1 = hampir permukaan */
export function getProximity(distance: number): number {
	const near = GLOBE_RADIUS + 0.18;
	const far = ZOOM_THRESHOLDS.atmosphereEnter;
	return 1 - Math.min(1, Math.max(0, (distance - near) / (far - near)));
}

export function getOrbitControlsForMode(mode: ZoomMode, isMobile: boolean) {
	const surfaceMin = isMobile ? 1.78 : 1.72;
	const base = isMobile
			? { maxDistance: 10, zoomSpeed: 1.0, rotateSpeed: 0.45, minPolarAngle: 0.15, maxPolarAngle: Math.PI - 0.15 }
		: { maxDistance: 6.5, zoomSpeed: 0.85, rotateSpeed: 0.55, minPolarAngle: 0.12, maxPolarAngle: Math.PI - 0.12 };

	switch (mode) {
		case 'surface':
			return {
				...base,
				minDistance: surfaceMin,
				rotateSpeed: base.rotateSpeed * 0.75,
				minPolarAngle: 0.05,
				maxPolarAngle: Math.PI - 0.05,
			};
		case 'atmosphere':
			return {
				...base,
				minDistance: surfaceMin,
				rotateSpeed: base.rotateSpeed * 0.9,
			};
		default:
			return {
				...base,
				minDistance: isMobile ? 4.2 : 3.0,
			};
	}
}
