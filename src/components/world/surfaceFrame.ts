import * as THREE from 'three';

export type SurfaceFrame = {
	up: THREE.Vector3;
	east: THREE.Vector3;
	north: THREE.Vector3;
};

export function buildSurfaceFrame(anchor: THREE.Vector3): SurfaceFrame {
	const up = anchor.clone().normalize();
	const reference =
		Math.abs(up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
	const east = new THREE.Vector3().crossVectors(reference, up).normalize();
	const north = new THREE.Vector3().crossVectors(up, east).normalize();
	return { up, east, north };
}

export function lookDirectionFromAngles(
	yaw: number,
	pitch: number,
	frame: SurfaceFrame,
	target = new THREE.Vector3(),
): THREE.Vector3 {
	const cosP = Math.cos(pitch);
	const sinP = Math.sin(pitch);
	const cosY = Math.cos(yaw);
	const sinY = Math.sin(yaw);
	return target
		.addScaledVector(frame.north, cosP * cosY)
		.addScaledVector(frame.east, cosP * sinY)
		.addScaledVector(frame.up, sinP)
		.normalize();
}

export function anglesFromDirection(dir: THREE.Vector3, frame: SurfaceFrame): { yaw: number; pitch: number } {
	const d = dir.clone().normalize();
	const pitch = Math.asin(THREE.MathUtils.clamp(d.dot(frame.up), -1, 1));
	const horizontal = d
		.clone()
		.addScaledVector(frame.up, -d.dot(frame.up))
		.normalize();
	const yaw = Math.atan2(horizontal.dot(frame.east), horizontal.dot(frame.north));
	return { yaw, pitch };
}

export function applyDescentPose(
	camera: THREE.PerspectiveCamera,
	anchor: THREE.Vector3,
	yaw: number,
	pitch: number,
	altitude: number,
	globeRadius: number,
	/** Semasa peralihan masuk, up-vektor sudah dilerp di luar — hantar di sini
	 * supaya kita tidak override dengan frame.up secara mengejut. */
	upOverride?: THREE.Vector3,
): void {
	const frame = buildSurfaceFrame(anchor);
	const radius = globeRadius + altitude;
	camera.position.copy(anchor).multiplyScalar(radius);
	const forward = lookDirectionFromAngles(yaw, pitch, frame);
	camera.up.copy(upOverride ?? frame.up);
	camera.lookAt(camera.position.clone().add(forward));
}

/** Sepertii applyDescentPose tapi kamera diletakkan di belakang+atas avatar
 * (third-person), bukan di atas permukaan tepat. */
export function applyThirdPersonGlobePose(
	camera: THREE.PerspectiveCamera,
	anchor: THREE.Vector3,
	yaw: number,
	pitch: number,
	globeRadius: number,
	camDist: number,
	camHeightAboveSurface: number,
	upOverride?: THREE.Vector3,
): { avatarPos: THREE.Vector3; avatarForward: THREE.Vector3 } {
	const frame = buildSurfaceFrame(anchor);
	// Avatar offset dari permukaan — kecil supaya sepadan dengan AVATAR_SCALE di DescentController
	const avatarPos = anchor.clone().multiplyScalar(globeRadius + 0.04);
	// Arah hadap avatar = arah pandang diunjur ke satah tangen
	const avatarForward = lookDirectionFromAngles(yaw, 0, frame, new THREE.Vector3());
	// Kamera: di belakang + sedikit atas avatar
	const camPos = avatarPos.clone()
		.addScaledVector(avatarForward, -camDist)
		.addScaledVector(frame.up, camHeightAboveSurface);
	// Pandang ke titik sedikit di hadapan avatar
	const lookAt = avatarPos.clone().addScaledVector(avatarForward, 0.4).addScaledVector(frame.up, 0.1);
	camera.position.copy(camPos);
	camera.up.copy(upOverride ?? frame.up);
	camera.lookAt(lookAt);
	return { avatarPos, avatarForward };
}
