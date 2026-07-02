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
): void {
	const frame = buildSurfaceFrame(anchor);
	const radius = globeRadius + altitude;
	camera.position.copy(anchor).multiplyScalar(radius);
	const forward = lookDirectionFromAngles(yaw, pitch, frame);
	camera.up.copy(frame.up);
	camera.lookAt(camera.position.clone().add(forward));
}
