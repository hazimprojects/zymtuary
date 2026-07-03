/** Konfigurasi kawalan ala Sky/Genshin — Tier 1+ */
export const GAME_CONTROL_CONFIG = {
	/** Separuh kiri skrin = zon gerak (floating joystick) */
	moveZoneWidthFrac: 0.5,
	maxRadius: 56,
	deadzone: 0.12,
	/** Lerp kamera ke sasaran — lebih tinggi = lebih melekat pada watak */
	cameraSpring: 28,
	cameraRotationSpring: 24,
	/** Jarak kamera lalai (meter) — dekat seperti Sky/Genshin */
	cameraDistanceMobile: 2.05,
	cameraDistanceDesktop: 1.85,
	cameraDistanceMin: 1.45,
	cameraDistanceMax: 3.8,
	/** Sudut menegak lalai — sedikit dari atas, over-shoulder */
	defaultPitch: 0.36,
	pivotHeight: 1.05,
	/** Titik pandang sedikit ke hadapan watak */
	lookAhead: 0.55,
	/** Offset bahu kamera (meter) — kamera sedikit ke kanan watak */
	shoulderOffset: 0.14,
	/** Jarak minimum kamera dari halangan (meter) */
	cameraCollisionPadding: 0.35,
	rotateSpeedMobile: 0.0042,
	rotateSpeedDesktop: 0.0032,
	pitchSpeedMobile: 0.0032,
	pitchSpeedDesktop: 0.0026,
	minPitch: 0.22,
	maxPitch: 1.15,
	moveSpeed: 2.6,
	walkSpeedMult: 0.58,
	runSpeedMult: 1.0,
	runThreshold: 0.48,
	/** Kelajuan pusing joystick kiri/kanan (rad/s pada defleksi penuh) */
	stickTurnSpeed: 2.75,
	/** Watak pusing ke arah gerakan (relatif kamera) semasa jalan */
	facingTurnRate: 12,
	baseFovMobile: 50,
	baseFovDesktop: 42,
	runFovBoost: 5,
	flyFovBoost: 4,
	/** Jarak halangan bulat sekitar titik spot / landmark */
	obstacleRadius: 1.15,
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
