import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
	curvedStickMagnitude,
	GAME_CONTROL_CONFIG,
	springAlpha,
} from './gameControlConfig';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import { sampleIslandGroundHeight, type IslandTerrainOptions } from '../wilayah/wilayahTerrain';
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
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();

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

function yawFromDirection(dir: THREE.Vector3): number {
	// Three.js: rotation.y = θ → forward = (-sinθ, 0, -cosθ)
	// Nak forward = dir → sinθ = -dir.x, cosθ = -dir.z → θ = atan2(-dir.x, -dir.z)
	return Math.atan2(-dir.x, -dir.z);
}

function shortestAngleDelta(from: number, to: number): number {
	let delta = (to - from) % (Math.PI * 2);
	if (delta > Math.PI) delta -= Math.PI * 2;
	if (delta < -Math.PI) delta += Math.PI * 2;
	return delta;
}

/** Arah jalan menjauhi kamera — lawan offset kamera (sin θ, cos θ) dari pivot. */
function walkForwardFromCamera(camYaw: number, out: THREE.Vector3): THREE.Vector3 {
	return out.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
}

/**
 * Kawalan third-person ala Sky — joystick = arah jalan (dikunci pada sudut
 * kamera semasa mula/ubah arah stick). Orbit kamera bebas tanpa ubah arah gerak.
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
	terrainOptions,
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
	terrainOptions?: IslandTerrainOptions;
	onNearSpotChange?: (id: string | null) => void;
	onJoystickChange?: (joystick: ZymJoystickVisual | null) => void;
}) {
	const { camera, gl } = useThree();
	const avatarGroupRef = useRef<THREE.Group>(null);
	const characterPos = useRef(new THREE.Vector3(...startPosition));
	const characterHeight = useRef(sampleIslandGroundHeight(startPosition[0], startPosition[2], terrainOptions));
	const startYaw = Math.atan2(startPosition[0], startPosition[2]);
	const facingYaw = useRef(startYaw);
	const camYaw = useRef(startYaw);
	const camPitch = useRef<number>(GAME_CONTROL_CONFIG.defaultPitch);
	const camDistance = useRef<number>(
		isMobile ? GAME_CONTROL_CONFIG.cameraDistanceMobile : GAME_CONTROL_CONFIG.cameraDistanceDesktop,
	);
	const camSpringPos = useRef(new THREE.Vector3());
	const camSpringQuat = useRef(new THREE.Quaternion());
	const camSpringReady = useRef(false);
	const lastNearSpot = useRef<string | null>(null);
	const flyTarget = useRef(0);
	const flyBlend = useRef(0);
	const pitchInputSmooth = useRef(0);
	const motionState = useRef<ZymMotionState>({ speed: 0, running: 0, flying: 0, pitchInput: 0 });
	const baseFov = useRef(isMobile ? GAME_CONTROL_CONFIG.baseFovMobile : GAME_CONTROL_CONFIG.baseFovDesktop);

	const lookDragging = useRef(false);
	const lastLookPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<{ dist: number; distance: number } | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number; role: 'move' | 'look' }>());
	const joystick = useRef<JoystickState | null>(null);
	/** Sudut kamera semasa joystick mula / ubah arah — gerakan dikunci di sini. */
	const moveBasisYaw = useRef(startYaw);
	const lastStickAngle = useRef<number | null>(null);

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

			if (joystick.current) {
				// Joystick aktif + jari baru = kamera drag serentak (ala Sky)
				lookDragging.current = true;
				lastLookPointer.current = { x: e.clientX, y: e.clientY };
			} else if (pointers.current.size === 1) {
				lookDragging.current = true;
				lastLookPointer.current = { x: e.clientX, y: e.clientY };
			} else if (pointers.current.size === 2) {
				// Dua jari tanpa joystick = cubit zum
				lookDragging.current = false;
				pinchStart.current = { dist: pointerDist(), distance: camDistance.current };
			}
		};

		const onPointerMove = (e: PointerEvent) => {
			// Joystick pointer — kemas kini offset sahaja
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				updateJoystickOffset(e.clientX, e.clientY);
				const entry = pointers.current.get(e.pointerId);
				if (entry) { entry.x = e.clientX; entry.y = e.clientY; }
				return;
			}

			const isOrphan = !pointers.current.has(e.pointerId);
			const role: 'move' | 'look' = isMoveZone(e.clientX) ? 'move' : 'look';
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role });

			if (isOrphan) {
				if (joystick.current) {
					// Jari baru semasa joystick aktif = mula kamera drag
					lookDragging.current = true;
					lastLookPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size === 1) {
					lookDragging.current = role === 'look';
					lastLookPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size === 2 && !pinchStart.current) {
					lookDragging.current = false;
					pinchStart.current = { dist: pointerDist(), distance: camDistance.current };
				}
				return;
			}

			// Cubit zum — hanya bila tiada joystick aktif
			if (pointers.current.size === 2 && pinchStart.current && !joystick.current) {
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
			camYaw.current -= dx * rotateSpeed;
			camPitch.current = THREE.MathUtils.clamp(
				camPitch.current + dy * pitchSpeed,
				GAME_CONTROL_CONFIG.minPitch,
				GAME_CONTROL_CONFIG.maxPitch,
			);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChange?.(null);
				pointers.current.delete(e.pointerId);
				pinchStart.current = null;
				// Jari kamera mungkin masih aktif — sambung drag
				const remaining = [...pointers.current.entries()].find(([, p]) => p.role === 'look');
				if (remaining) {
					lookDragging.current = true;
					lastLookPointer.current = { x: remaining[1].x, y: remaining[1].y };
				} else {
					lookDragging.current = false;
				}
				return;
			}

			pointers.current.delete(e.pointerId);
			pinchStart.current = null;
			// Cari jari kamera yang masih aktif
			const remaining = [...pointers.current.entries()].find(([, p]) => p.role === 'look');
			if (remaining && !joystick.current) {
				lookDragging.current = true;
				lastLookPointer.current = { x: remaining[1].x, y: remaining[1].y };
			} else if (!remaining) {
				lookDragging.current = false;
			}
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
		let pitchInputRaw = 0;
		motionState.current.running = 0;
		if (joystick.current) {
			const { dx, dy } = joystick.current;
			const rawX = dx / GAME_CONTROL_CONFIG.maxRadius;
			const rawY = -dy / GAME_CONTROL_CONFIG.maxRadius;
			const rawMag = Math.hypot(rawX, rawY);
			const mag = curvedStickMagnitude(rawMag);
			if (mag > 0 && rawMag > 1e-4) {
				const stickX = (rawX / rawMag) * mag;
				const stickY = (rawY / rawMag) * mag;
				pitchInputRaw = stickY;
				moveMag = mag;

				const stickAngle = Math.atan2(rawX, rawY);
				if (lastStickAngle.current === null) {
					moveBasisYaw.current = camYaw.current;
				} else if (Math.abs(shortestAngleDelta(lastStickAngle.current, stickAngle)) > 0.35) {
					moveBasisYaw.current = camYaw.current;
				}
				lastStickAngle.current = stickAngle;

				const camForward = walkForwardFromCamera(moveBasisYaw.current, _forward);
				const camRight = _right.crossVectors(camForward, Y_AXIS).normalize();
				const moveDir = _moveDir
					.set(0, 0, 0)
					.addScaledVector(camForward, stickY)
					.addScaledVector(camRight, stickX);

				if (moveDir.lengthSq() > 1e-4) {
					moveDir.normalize();
					facingYaw.current = yawFromDirection(moveDir);

					const isRunning = mag >= GAME_CONTROL_CONFIG.runThreshold;
					const gaitMult = isRunning
						? GAME_CONTROL_CONFIG.runSpeedMult
						: GAME_CONTROL_CONFIG.walkSpeedMult;
					motionState.current.running = isRunning ? 1 : 0;

					const step = moveDir.multiplyScalar(
						GAME_CONTROL_CONFIG.moveSpeed * speedMult * gaitMult * mag * delta,
					);
					characterPos.current.add(step);
					resolveCharacterObstacles(characterPos.current, anchors, effectiveRadius);
				}
			}
		} else {
			lastStickAngle.current = null;
		}
		pitchInputSmooth.current += (pitchInputRaw - pitchInputSmooth.current) * Math.min(1, delta * 5);

		const groundY = sampleIslandGroundHeight(characterPos.current.x, characterPos.current.z, terrainOptions);
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
