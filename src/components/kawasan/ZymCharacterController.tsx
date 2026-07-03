import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
	curvedStickMagnitude,
	GAME_CONTROL_CONFIG,
	springAlpha,
} from './gameControlConfig';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { sampleIslandGroundHeight } from '../wilayah/wilayahTerrain';
import { ZymAvatar, type ZymMotionState } from './ZymAvatar';

export type ZymJoystickVisual = {
	originX: number;
	originY: number;
	dx: number;
	dy: number;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const REVEAL_RADIUS = 2.1;
const FLY_HEIGHT = 1.75;
const FLY_MOVE_MULT = 1.55;
const FLY_RADIUS_MULT = 1.6;
const FLY_BLEND_RATE = 2.2;
const CAMERA_RAY = new THREE.Raycaster();
const _lookTarget = new THREE.Vector3();
const _idealPos = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _lookMatrix = new THREE.Matrix4();
const _forward = new THREE.Vector3();

function computeCameraIdealPosition(
	pivot: THREE.Vector3,
	viewYaw: number,
	pitch: number,
	distance: number,
	out: THREE.Vector3,
): THREE.Vector3 {
	const horizontalDist = distance * Math.cos(pitch);
	const height = distance * Math.sin(pitch);
	out.set(
		pivot.x + horizontalDist * Math.sin(viewYaw),
		pivot.y + height,
		pivot.z + horizontalDist * Math.cos(viewYaw),
	);
	const shoulderRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(Y_AXIS, viewYaw);
	out.addScaledVector(shoulderRight, GAME_CONTROL_CONFIG.shoulderOffset);
	return out;
}

function computeLookTarget(
	pivot: THREE.Vector3,
	facingYaw: number,
	out: THREE.Vector3,
): THREE.Vector3 {
	out.set(
		pivot.x + Math.sin(facingYaw) * GAME_CONTROL_CONFIG.lookAhead,
		pivot.y + 0.12,
		pivot.z - Math.cos(facingYaw) * GAME_CONTROL_CONFIG.lookAhead,
	);
	return out;
}

function resolveCameraPosition(
	eyeTarget: THREE.Vector3,
	idealPos: THREE.Vector3,
	collisionRoot: THREE.Object3D | null,
): THREE.Vector3 {
	const dir = new THREE.Vector3().subVectors(idealPos, eyeTarget);
	const dist = dir.length();
	if (dist < 1e-4 || !collisionRoot) return idealPos.clone();
	dir.normalize();
	CAMERA_RAY.set(eyeTarget, dir);
	CAMERA_RAY.far = dist;
	const hits = CAMERA_RAY.intersectObject(collisionRoot, true);
	if (hits.length === 0) return idealPos.clone();
	return hits[0].point.add(dir.multiplyScalar(-GAME_CONTROL_CONFIG.cameraCollisionPadding));
}

function resolveCharacterObstacles(
	pos: THREE.Vector3,
	anchors: KawasanAnchor[],
	plazaRadius: number,
): void {
	for (const anchor of anchors) {
		const dx = pos.x - anchor.position.x;
		const dz = pos.z - anchor.position.z;
		const dist = Math.hypot(dx, dz);
		const minDist = GAME_CONTROL_CONFIG.obstacleRadius + anchor.scale * 0.35;
		if (dist < minDist && dist > 1e-4) {
			const push = (minDist - dist) / dist;
			pos.x += dx * push;
			pos.z += dz * push;
		}
	}
	const horizontal = Math.hypot(pos.x, pos.z);
	if (horizontal > plazaRadius) {
		const scale = plazaRadius / horizontal;
		pos.x *= scale;
		pos.z *= scale;
	}
}

type JoystickState = {
	pointerId: number;
	originX: number;
	originY: number;
	dx: number;
	dy: number;
};

function shortestAngleDelta(from: number, to: number): number {
	let delta = (to - from) % (Math.PI * 2);
	if (delta > Math.PI) delta -= Math.PI * 2;
	if (delta < -Math.PI) delta += Math.PI * 2;
	return delta;
}

/** Yaw rotation.y Three.js daripada vektor arah XZ (forward = (sin θ, -cos θ)). */
function forwardFromYaw(yaw: number, out: THREE.Vector3): THREE.Vector3 {
	return out.set(Math.sin(yaw), 0, -Math.cos(yaw));
}

/**
 * Kawalan third-person ala Sky/Genshin — joystick atas/bawah gerak relatif
 * kamera (watak pusing ikut arah kamera); kiri/kanan pusing watak + kamera.
 * Orbit jari kanan ubah arah rujukan tanpa menggerakkan watak.
 */
export function ZymCharacterController({
	anchors,
	plazaRadius,
	startPosition,
	glowColor,
	isMobile,
	interactionPaused,
	flying,
	collisionRoot,
	onNearSpotChange,
	onJoystickChange,
}: {
	anchors: KawasanAnchor[];
	plazaRadius: number;
	startPosition: [number, number, number];
	glowColor: string;
	isMobile: boolean;
	interactionPaused: boolean;
	flying: boolean;
	collisionRoot?: RefObject<THREE.Object3D | null>;
	onNearSpotChange?: (id: string | null) => void;
	onJoystickChange?: (joystick: ZymJoystickVisual | null) => void;
}) {
	const { camera, gl } = useThree();
	const avatarGroupRef = useRef<THREE.Group>(null);
	const characterPos = useRef(new THREE.Vector3(...startPosition));
	const characterHeight = useRef(sampleIslandGroundHeight(startPosition[0], startPosition[2]));
	const startYaw = Math.atan2(-startPosition[0], -startPosition[2]);
	const facingYaw = useRef(startYaw);
	const camYaw = useRef(startYaw);
	const camPitch = useRef(GAME_CONTROL_CONFIG.defaultPitch);
	const camDistance = useRef(
		isMobile ? GAME_CONTROL_CONFIG.cameraDistanceMobile : GAME_CONTROL_CONFIG.cameraDistanceDesktop,
	);
	const camSpringPos = useRef(new THREE.Vector3());
	const camSpringQuat = useRef(new THREE.Quaternion());
	const camSpringReady = useRef(false);
	const lastNearSpot = useRef<string | null>(null);
	const flyTarget = useRef(0);
	const flyBlend = useRef(0);
	const pitchInputSmooth = useRef(0);
	const motionState = useRef<ZymMotionState>({ speed: 0, running: 0, strafe: 0, flying: 0, pitchInput: 0 });
	const baseFov = useRef(isMobile ? GAME_CONTROL_CONFIG.baseFovMobile : GAME_CONTROL_CONFIG.baseFovDesktop);

	const lookDragging = useRef(false);
	const lastLookPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<{ dist: number; distance: number } | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number; role: 'move' | 'look' }>());
	const joystick = useRef<JoystickState | null>(null);

	useEffect(() => {
		flyTarget.current = flying ? 1 : 0;
	}, [flying]);

	useEffect(() => {
		if (interactionPaused) return;
		const el = gl.domElement;
		const rotateSpeed = isMobile
			? GAME_CONTROL_CONFIG.rotateSpeedMobile
			: GAME_CONTROL_CONFIG.rotateSpeedDesktop;
		const pitchSpeed = isMobile
			? GAME_CONTROL_CONFIG.pitchSpeedMobile
			: GAME_CONTROL_CONFIG.pitchSpeedDesktop;

		const pointerDist = () => {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) return 0;
			return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		};

		const isMoveZone = (clientX: number) => {
			const rect = el.getBoundingClientRect();
			const localX = clientX - rect.left;
			return localX < rect.width * GAME_CONTROL_CONFIG.moveZoneWidthFrac;
		};

		const emitJoystick = () => {
			if (!joystick.current) {
				onJoystickChange?.(null);
				return;
			}
			onJoystickChange?.({
				originX: joystick.current.originX,
				originY: joystick.current.originY,
				dx: joystick.current.dx,
				dy: joystick.current.dy,
			});
		};

		const updateJoystickOffset = (clientX: number, clientY: number) => {
			if (!joystick.current) return;
			const rawDx = clientX - joystick.current.originX;
			const rawDy = clientY - joystick.current.originY;
			const mag = Math.hypot(rawDx, rawDy);
			const clamped = Math.min(mag, GAME_CONTROL_CONFIG.maxRadius);
			const scale = mag > 0 ? clamped / mag : 0;
			joystick.current.dx = rawDx * scale;
			joystick.current.dy = rawDy * scale;
			emitJoystick();
		};

		const onPointerDown = (e: PointerEvent) => {
			try {
				el.setPointerCapture(e.pointerId);
			} catch {
				// pointerId mungkin sudah tidak sah
			}

			if (!joystick.current && isMoveZone(e.clientX)) {
				joystick.current = {
					pointerId: e.pointerId,
					originX: e.clientX,
					originY: e.clientY,
					dx: 0,
					dy: 0,
				};
				pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'move' });
				emitJoystick();
				return;
			}

			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'look' });
			if (pointers.current.size === 1) {
				lookDragging.current = true;
				lastLookPointer.current = { x: e.clientX, y: e.clientY };
			}
			if (pointers.current.size === 2) {
				lookDragging.current = false;
				pinchStart.current = { dist: pointerDist(), distance: camDistance.current };
			}
		};

		const onPointerMove = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				updateJoystickOffset(e.clientX, e.clientY);
				const entry = pointers.current.get(e.pointerId);
				if (entry) {
					entry.x = e.clientX;
					entry.y = e.clientY;
				}
				return;
			}

			const isOrphan = !pointers.current.has(e.pointerId);
			const role: 'move' | 'look' = isMoveZone(e.clientX) ? 'move' : 'look';
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role });

			if (isOrphan) {
				if (pointers.current.size === 1) {
					lookDragging.current = role === 'look';
					lastLookPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size === 2 && !pinchStart.current) {
					lookDragging.current = false;
					pinchStart.current = { dist: pointerDist(), distance: camDistance.current };
				}
				return;
			}

			if (pointers.current.size === 2 && pinchStart.current) {
				const dist = pointerDist();
				const scale = dist / Math.max(pinchStart.current.dist, 1);
				camDistance.current = THREE.MathUtils.clamp(
					pinchStart.current.distance / scale,
					GAME_CONTROL_CONFIG.cameraDistanceMin,
					GAME_CONTROL_CONFIG.cameraDistanceMax,
				);
				return;
			}

			if (!lookDragging.current) return;
			const entry = pointers.current.get(e.pointerId);
			if (!entry || entry.role !== 'look') return;

			const dx = e.clientX - lastLookPointer.current.x;
			const dy = e.clientY - lastLookPointer.current.y;
			lastLookPointer.current = { x: e.clientX, y: e.clientY };
			camYaw.current += dx * rotateSpeed;
			camPitch.current = THREE.MathUtils.clamp(
				camPitch.current - dy * pitchSpeed,
				GAME_CONTROL_CONFIG.minPitch,
				GAME_CONTROL_CONFIG.maxPitch,
			);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChange?.(null);
				pointers.current.delete(e.pointerId);
				if (pointers.current.size < 2) pinchStart.current = null;
				if (pointers.current.size === 1) {
					const remaining = [...pointers.current.entries()][0];
					if (remaining[1].role === 'look') {
						lookDragging.current = true;
						lastLookPointer.current = { x: remaining[1].x, y: remaining[1].y };
					}
				} else {
					lookDragging.current = false;
				}
				return;
			}

			pointers.current.delete(e.pointerId);
			if (pointers.current.size < 2) pinchStart.current = null;
			if (pointers.current.size === 1) {
				const remaining = [...pointers.current.entries()][0];
				if (remaining[1].role === 'look') {
					lookDragging.current = true;
					lastLookPointer.current = { x: remaining[1].x, y: remaining[1].y };
				}
				return;
			}
			lookDragging.current = false;
		};

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			camDistance.current = THREE.MathUtils.clamp(
				camDistance.current + e.deltaY * 0.0016,
				GAME_CONTROL_CONFIG.cameraDistanceMin,
				GAME_CONTROL_CONFIG.cameraDistanceMax,
			);
		};

		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerUp);
		el.addEventListener('wheel', onWheel, { passive: false });

		return () => {
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerUp);
			el.removeEventListener('wheel', onWheel);
			if (joystick.current) {
				joystick.current = null;
				onJoystickChange?.(null);
			}
		};
	}, [interactionPaused, isMobile, gl, onJoystickChange]);

	useFrame((_, delta) => {
		flyBlend.current += (flyTarget.current - flyBlend.current) * Math.min(1, delta * FLY_BLEND_RATE);
		const speedMult = THREE.MathUtils.lerp(1, FLY_MOVE_MULT, flyBlend.current);
		const radiusMult = THREE.MathUtils.lerp(1, FLY_RADIUS_MULT, flyBlend.current);
		const effectiveRadius = plazaRadius * radiusMult;

		let moveMag = 0;
		let forwardInput = 0;
		let turnInput = 0;
		let pitchInputRaw = 0;
		motionState.current.running = 0;
		motionState.current.strafe = 0;
		if (joystick.current) {
			const { dx, dy } = joystick.current;
			const rawLen = Math.hypot(dx, dy);
			const rawMag = rawLen / GAME_CONTROL_CONFIG.maxRadius;
			const mag = curvedStickMagnitude(rawMag);
			if (mag > 0 && rawLen > 1e-4) {
				const ndx = dx / rawLen;
				const ndy = dy / rawLen;
				forwardInput = -ndy * mag;
				turnInput = ndx * mag;
				pitchInputRaw = forwardInput;
				moveMag = Math.hypot(forwardInput, turnInput);

				if (Math.abs(turnInput) > 0.02) {
					const turnDelta = -turnInput * GAME_CONTROL_CONFIG.stickTurnSpeed * delta;
					facingYaw.current += turnDelta;
					camYaw.current += turnDelta;
					motionState.current.strafe = THREE.MathUtils.clamp(-turnInput, -1, 1);
				}

				if (Math.abs(forwardInput) > 0.02) {
					const isRunning = Math.abs(forwardInput) >= GAME_CONTROL_CONFIG.runThreshold;
					const gaitMult = isRunning
						? GAME_CONTROL_CONFIG.runSpeedMult
						: GAME_CONTROL_CONFIG.walkSpeedMult;
					motionState.current.running = isRunning ? 1 : 0;
					const forward = forwardFromYaw(camYaw.current, _forward);
					const targetFacing =
						forwardInput > 0 ? camYaw.current : camYaw.current + Math.PI;
					facingYaw.current +=
						shortestAngleDelta(facingYaw.current, targetFacing) *
						Math.min(1, delta * GAME_CONTROL_CONFIG.facingTurnRate);
					const step = forward.multiplyScalar(
						GAME_CONTROL_CONFIG.moveSpeed * speedMult * gaitMult * forwardInput * delta,
					);
					characterPos.current.add(step);
					resolveCharacterObstacles(characterPos.current, anchors, effectiveRadius);
				}
			}
		}
		pitchInputSmooth.current += (pitchInputRaw - pitchInputSmooth.current) * Math.min(1, delta * 5);

		const groundY = sampleIslandGroundHeight(characterPos.current.x, characterPos.current.z);
		const targetHeight = groundY + FLY_HEIGHT * flyBlend.current;
		characterHeight.current += (targetHeight - characterHeight.current) * Math.min(1, delta * FLY_BLEND_RATE * 1.8);

		motionState.current.speed = moveMag;
		motionState.current.flying = flyBlend.current;
		motionState.current.pitchInput = pitchInputSmooth.current;

		if (avatarGroupRef.current) {
			avatarGroupRef.current.position.set(characterPos.current.x, characterHeight.current, characterPos.current.z);
			avatarGroupRef.current.rotation.y = facingYaw.current;
		}

		const pivot = _pivot.set(
			characterPos.current.x,
			characterHeight.current + GAME_CONTROL_CONFIG.pivotHeight,
			characterPos.current.z,
		);
		computeCameraIdealPosition(
			pivot,
			camYaw.current,
			camPitch.current,
			camDistance.current,
			_idealPos,
		);

		const resolvedPos = resolveCameraPosition(
			pivot,
			_idealPos,
			collisionRoot?.current ?? null,
		);

		const lookTarget = computeLookTarget(pivot, facingYaw.current, _lookTarget);

		if (!camSpringReady.current) {
			camSpringPos.current.copy(resolvedPos);
			_lookMatrix.lookAt(resolvedPos, lookTarget, Y_AXIS);
			camSpringQuat.current.setFromRotationMatrix(_lookMatrix);
			camera.position.copy(resolvedPos);
			camera.quaternion.copy(camSpringQuat.current);
			camSpringReady.current = true;
		} else {
			camSpringPos.current.lerp(resolvedPos, springAlpha(GAME_CONTROL_CONFIG.cameraSpring, delta));
			_lookMatrix.lookAt(camSpringPos.current, lookTarget, Y_AXIS);
			_targetQuat.setFromRotationMatrix(_lookMatrix);
			camSpringQuat.current.slerp(_targetQuat, springAlpha(GAME_CONTROL_CONFIG.cameraRotationSpring, delta));
			camera.position.copy(camSpringPos.current);
			camera.quaternion.copy(camSpringQuat.current);
		}

		if (camera instanceof THREE.PerspectiveCamera) {
			const targetFov =
				baseFov.current +
				motionState.current.running * GAME_CONTROL_CONFIG.runFovBoost +
				flyBlend.current * GAME_CONTROL_CONFIG.flyFovBoost;
			camera.fov += (targetFov - camera.fov) * springAlpha(8, delta);
			camera.updateProjectionMatrix();
		}

		if (onNearSpotChange) {
			let nearest: string | null = null;
			let nearestDist = REVEAL_RADIUS;
			for (const anchor of anchors) {
				const d = Math.hypot(characterPos.current.x - anchor.position.x, characterPos.current.z - anchor.position.z);
				if (d < nearestDist) {
					nearestDist = d;
					nearest = anchor.id;
				}
			}
			if (nearest !== lastNearSpot.current) {
				lastNearSpot.current = nearest;
				onNearSpotChange(nearest);
			}
		}
	});

	return (
		<group ref={avatarGroupRef}>
			<ZymAvatar glowColor={glowColor} motionRef={motionState} />
		</group>
	);
}
