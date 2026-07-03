/** Konfigurasi kawalan ala Sky/Genshin — Tier 1+ */
export const GAME_CONTROL_CONFIG = {
	/** Separuh kiri skrin = zon gerak (floating joystick) */
	moveZoneWidthFrac: 0.5,
	maxRadius: 56,
	deadzone: 0.12,
	/** Lerp kamera ke sasaran — lebih tinggi = lebih ketat */
	cameraSpring: 10,
	rotateSpeedMobile: 0.0042,
	rotateSpeedDesktop: 0.0032,
	pitchSpeedMobile: 0.0032,
	pitchSpeedDesktop: 0.0026,
	minPitch: 0.28,
	maxPitch: 1.3,
	moveSpeed: 2.6,
	facingTurnRate: 9,
} as const;

/** Remap magnitude joystick selepas deadzone + ease smoothstep (rasa game). */
export function curvedStickMagnitude(rawMag: number, deadzone = GAME_CONTROL_CONFIG.deadzone): number {
	if (rawMag <= deadzone) return 0;
	const t = (rawMag - deadzone) / (1 - deadzone);
	return t * t * (3 - 2 * t);
}

/** Eksponen spring untuk lerp bingkai: `1 - exp(-rate * dt)`. */
export function springAlpha(rate: number, delta: number): number {
	return 1 - Math.exp(-rate * delta);
}
