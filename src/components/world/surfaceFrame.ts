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
	upOverride?: THREE.Vector3,
): void {
	const frame = buildSurfaceFrame(anchor);
	const radius = globeRadius + altitude;
	camera.position.copy(anchor).multiplyScalar(radius);
	const forward = lookDirectionFromAngles(yaw, pitch, frame);
	camera.up.copy(upOverride ?? frame.up);
	camera.lookAt(camera.position.clone().add(forward));
}

/**
 * Kamera third-person ala Veilrose Quarter — pivot pada bahu avatar, kamera
 * di belakang+atas pada sudut camPitch, lookAt condong ke bawah menuju pivot.
 * Zym kelihatan di bahagian bawah-tengah skrin seperti dalam Veilrose.
 */
export function applyThirdPersonGlobePose(
	camera: THREE.PerspectiveCamera,
	anchor: THREE.Vector3,
	yaw: number,
	globeRadius: number,
	avatarScale: number,
	upOverride?: THREE.Vector3,
): { avatarPos: THREE.Vector3; avatarForward: THREE.Vector3; frame: SurfaceFrame } {
	const frame = buildSurfaceFrame(anchor);

	// Kaki avatar tepat atas permukaan
	const avatarPos = anchor.clone().multiplyScalar(globeRadius + avatarScale * 0.04);

	// Arah hadap avatar — yaw sahaja, pitch 0 (horizontal di permukaan)
	const avatarForward = lookDirectionFromAngles(yaw, 0, frame, new THREE.Vector3());

	// Pivot di bahu avatar (~87% ketinggian badan)
	const AVATAR_H = avatarScale * 1.2;
	const pivot = avatarPos.clone().addScaledVector(frame.up, AVATAR_H * 0.88);

	// Kamera: mundur + naik mengikut camPitch (sama dengan GAME_CONTROL_CONFIG.defaultPitch)
	const CAM_PITCH = 0.36;
	const CAM_DIST = AVATAR_H * 3.2;
	const backward = avatarForward.clone().negate();
	const camPos = pivot.clone()
		.addScaledVector(backward, CAM_DIST * Math.cos(CAM_PITCH))
		.addScaledVector(frame.up, CAM_DIST * Math.sin(CAM_PITCH));

	// LookAt sedikit ke hadapan pivot — kamera condong ke bawah (ala lookAhead Veilrose)
	const lookTarget = pivot.clone().addScaledVector(avatarForward, AVATAR_H * 0.45);

	camera.position.copy(camPos);
	camera.up.copy(upOverride ?? frame.up);
	camera.lookAt(lookTarget);

	return { avatarPos, avatarForward, frame };
}
