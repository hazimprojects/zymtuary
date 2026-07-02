import { SURFACE_ZONES } from './worldGlobeConfig';

/** Tukar normal permukaan → id spheral (prioriti zon kecil dahulu). */
export function pickZone(nx: number, ny: number, nz: number): string | null {
	const phi = Math.acos(Math.max(-1, Math.min(1, ny)));
	const theta = Math.atan2(nx, nz);

	const inTheta = (t: number, start: number, length: number) => {
		const end = start + length;
		if (length >= Math.PI * 2 - 0.01) return true;
		if (end <= Math.PI * 2) return t >= start && t <= end;
		return t >= start || t <= end - Math.PI * 2;
	};

	const deepZones = ['ignisara', 'nivira', 'equilara'];
	for (const id of deepZones) {
		const zone = SURFACE_ZONES.find((z) => z.id === id);
		if (!zone) continue;
		if (
			phi >= zone.phiStart &&
			phi <= zone.phiStart + zone.phiLength &&
			inTheta(theta, zone.thetaStart, zone.thetaLength)
		) {
			return id;
		}
	}

	if (phi <= Math.PI * 0.38) return 'luminara';
	if (phi >= Math.PI * 0.62) return 'noctira';

	return null;
}

/** Jarak teras Primisera — klik dalam radius ini pilih primisera */
export function isCoreHit(
	point: { x: number; y: number; z: number },
	coreRadius: number,
): boolean {
	const dist = Math.sqrt(point.x ** 2 + point.y ** 2 + point.z ** 2);
	return dist < coreRadius * 1.15;
}
