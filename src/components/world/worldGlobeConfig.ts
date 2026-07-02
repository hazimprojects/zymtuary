export type SpheralEntry = {
	id: string;
	nama: string;
	mood: string;
};

export const SPHERAL_COLORS: Record<string, string> = {
	primisera: '#3d2e1f',
	luminara: '#d4a843',
	noctira: '#5c4a8a',
	ignisara: '#c44d2a',
	nivira: '#8eb8c8',
	equilara: '#b8bcc4',
};

export const MOOD_SINGKAT: Record<string, string> = {
	primisera: 'sunyi',
	luminara: 'terbuka',
	noctira: 'melindungi',
	ignisara: 'dorongan',
	nivira: 'hening',
	equilara: 'seimbang',
};

/** Zon permukaan globe — phi/theta dalam radian (Three.js SphereGeometry convention). */
export type SurfaceZone = {
	id: string;
	phiStart: number;
	phiLength: number;
	thetaStart: number;
	thetaLength: number;
	/** Jarak dari permukaan asas — zon dalam lebih tinggi supaya boleh diklik */
	lift?: number;
};

export const SURFACE_ZONES: SurfaceZone[] = [
	{
		id: 'luminara',
		phiStart: 0,
		phiLength: Math.PI * 0.38,
		thetaStart: 0,
		thetaLength: Math.PI * 2,
	},
	{
		id: 'equilara',
		phiStart: Math.PI * 0.36,
		phiLength: Math.PI * 0.28,
		thetaStart: 0,
		thetaLength: Math.PI * 2,
		lift: 0.02,
	},
	{
		id: 'noctira',
		phiStart: Math.PI * 0.62,
		phiLength: Math.PI * 0.38,
		thetaStart: 0,
		thetaLength: Math.PI * 2,
	},
	{
		id: 'ignisara',
		phiStart: Math.PI * 0.52,
		phiLength: Math.PI * 0.32,
		thetaStart: Math.PI * 0.15,
		thetaLength: Math.PI * 0.7,
		lift: 0.04,
	},
	{
		id: 'nivira',
		phiStart: Math.PI * 0.12,
		phiLength: Math.PI * 0.32,
		thetaStart: Math.PI * 1.15,
		thetaLength: Math.PI * 0.7,
		lift: 0.04,
	},
];

export const GLOBE_RADIUS = 1.55;
export const CORE_RADIUS = 0.42;
