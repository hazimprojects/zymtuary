import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { JOYSTICK_CONFIG } from '../world/worldGlobeConfig';
import type { KawasanAnchor } from '../wilayah/wilayahTerrain';
import type { JoystickVisual } from '../world/DescentController';
import { ZymAvatar, type ZymMotionState } from './ZymAvatar';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const MOVE_SPEED = 2.6;
const REVEAL_RADIUS = 2.1;
const FLY_HEIGHT = 1.75;
const FLY_MOVE_MULT = 1.55;
const FLY_RADIUS_MULT = 1.6;
const FLY_BLEND_RATE = 2.2;
const FACING_TURN_RATE = 9;

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

/**
 * Watak Zym-kesedaran yang boleh dilihat — pelawat mengawal avatar ini
 * bergerak di atas plaza (bukan kamera terapung terus). Kamera ikut di
 * belakang/atas watak (third-person); seret penjuru bawah untuk gerak,
 * seret di tempat lain untuk putar kamera mengelilingi watak. Watak boleh
 * berjalan (kaki berayun) atau terbang (melayang lebih tinggi, kaki
 * menghala belakang, lengan terbentang macam sayap) — `flying` dikawal
 * daripada komponen induk (butang togol).
 */
export function ZymCharacterController({
	anchors,
	plazaRadius,
	startPosition,
	glowColor,
	isMobile,
	interactionPaused,
	flying,
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
	onNearSpotChange?: (id: string | null) => void;
	onJoystickChange?: (joystick: JoystickVisual | null) => void;
}) {
	const { camera, gl } = useThree();
	const avatarGroupRef = useRef<THREE.Group>(null);
	const characterPos = useRef(new THREE.Vector3(...startPosition));
	const characterHeight = useRef(0);
	const facingYaw = useRef(0);
	const camYaw = useRef(Math.PI * 0.15);
	const camPitch = useRef(0.62);
	const camDistance = useRef(isMobile ? 5.2 : 4.4);
	const lastNearSpot = useRef<string | null>(null);
	const flyTarget = useRef(0);
	const flyBlend = useRef(0);
	const motionState = useRef<ZymMotionState>({ speed: 0, flying: 0 });

	const dragging = useRef(false);
	const lastPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<{ dist: number; distance: number } | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const joystick = useRef<JoystickState | null>(null);

	useEffect(() => {
		flyTarget.current = flying ? 1 : 0;
	}, [flying]);

	useEffect(() => {
		if (interactionPaused) return;
		const el = gl.domElement;
		const rotateSpeed = isMobile ? 0.0042 : 0.0032;
		const pitchSpeed = isMobile ? 0.0032 : 0.0026;

		const pointerDist = () => {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) return 0;
			return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		};

		const isMovementCorner = (clientX: number, clientY: number) => {
			const rect = el.getBoundingClientRect();
			const localX = clientX - rect.left;
			const localY = clientY - rect.top;
			const inBottom = localY > rect.height * (1 - JOYSTICK_CONFIG.cornerZoneHeightFrac);
			const inSide =
				localX < rect.width * JOYSTICK_CONFIG.cornerZoneWidthFrac ||
				localX > rect.width * (1 - JOYSTICK_CONFIG.cornerZoneWidthFrac);
			return inBottom && inSide;
		};

		const updateJoystickOffset = (clientX: number, clientY: number) => {
			if (!joystick.current) return;
			const rawDx = clientX - joystick.current.originX;
			const rawDy = clientY - joystick.current.originY;
			const mag = Math.hypot(rawDx, rawDy);
			const clamped = Math.min(mag, JOYSTICK_CONFIG.maxRadius);
			const scale = mag > 0 ? clamped / mag : 0;
			joystick.current.dx = rawDx * scale;
			joystick.current.dy = rawDy * scale;
			onJoystickChange?.({
				originX: joystick.current.originX,
				originY: joystick.current.originY,
				dx: joystick.current.dx,
				dy: joystick.current.dy,
			});
		};

		const onPointerDown = (e: PointerEvent) => {
			try {
				el.setPointerCapture(e.pointerId);
			} catch {
				// pointerId mungkin sudah tidak sah — abaikan
			}

			if (!joystick.current && isMovementCorner(e.clientX, e.clientY)) {
				joystick.current = { pointerId: e.pointerId, originX: e.clientX, originY: e.clientY, dx: 0, dy: 0 };
				onJoystickChange?.({ originX: e.clientX, originY: e.clientY, dx: 0, dy: 0 });
				return;
			}

			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
			if (pointers.current.size === 1) {
				dragging.current = true;
				lastPointer.current = { x: e.clientX, y: e.clientY };
			}
			if (pointers.current.size === 2) {
				dragging.current = false;
				pinchStart.current = { dist: pointerDist(), distance: camDistance.current };
			}
		};

		const onPointerMove = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				updateJoystickOffset(e.clientX, e.clientY);
				return;
			}

			const isOrphan = !pointers.current.has(e.pointerId);
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

			if (isOrphan) {
				if (pointers.current.size === 1) {
					dragging.current = true;
					lastPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size === 2 && !pinchStart.current) {
					dragging.current = false;
					pinchStart.current = { dist: pointerDist(), distance: camDistance.current };
				}
				return;
			}

			if (pointers.current.size === 2 && pinchStart.current) {
				const dist = pointerDist();
				const scale = dist / Math.max(pinchStart.current.dist, 1);
				camDistance.current = THREE.MathUtils.clamp(pinchStart.current.distance / scale, 2.4, 8);
				return;
			}

			if (!dragging.current) return;
			const dx = e.clientX - lastPointer.current.x;
			const dy = e.clientY - lastPointer.current.y;
			lastPointer.current = { x: e.clientX, y: e.clientY };
			camYaw.current += dx * rotateSpeed;
			camPitch.current = THREE.MathUtils.clamp(camPitch.current - dy * pitchSpeed, 0.28, 1.3);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChange?.(null);
				return;
			}
			pointers.current.delete(e.pointerId);
			if (pointers.current.size < 2) pinchStart.current = null;
			if (pointers.current.size === 1) {
				const remaining = [...pointers.current.values()][0];
				dragging.current = true;
				lastPointer.current = { ...remaining };
				return;
			}
			dragging.current = false;
		};

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			camDistance.current = THREE.MathUtils.clamp(camDistance.current + e.deltaY * 0.0016, 2.4, 8);
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
		if (joystick.current) {
			const { dx, dy } = joystick.current;
			const rawMag = Math.hypot(dx, dy);
			const mag = rawMag / JOYSTICK_CONFIG.maxRadius;
			if (mag > JOYSTICK_CONFIG.deadzone && rawMag > 0) {
				const ndx = dx / rawMag;
				const ndy = dy / rawMag;
				const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, camYaw.current);
				const right = forward.clone().applyAxisAngle(Y_AXIS, -Math.PI / 2);
				const moveDir = new THREE.Vector3().addScaledVector(forward, -ndy).addScaledVector(right, ndx);
				if (moveDir.lengthSq() > 1e-8) {
					moveMag = mag;
					moveDir.normalize();
					const targetYaw = Math.atan2(moveDir.x, moveDir.z);
					facingYaw.current += shortestAngleDelta(facingYaw.current, targetYaw) * Math.min(1, delta * FACING_TURN_RATE);

					const step = moveDir.multiplyScalar(MOVE_SPEED * speedMult * mag * delta);
					characterPos.current.add(step);
					const horizontal = Math.hypot(characterPos.current.x, characterPos.current.z);
					if (horizontal > effectiveRadius) {
						const scale = effectiveRadius / horizontal;
						characterPos.current.x *= scale;
						characterPos.current.z *= scale;
					}
				}
			}
		}

		characterHeight.current += (FLY_HEIGHT * flyBlend.current - characterHeight.current) * Math.min(1, delta * FLY_BLEND_RATE);

		motionState.current.speed = moveMag;
		motionState.current.flying = flyBlend.current;

		if (avatarGroupRef.current) {
			avatarGroupRef.current.position.set(characterPos.current.x, characterHeight.current, characterPos.current.z);
			avatarGroupRef.current.rotation.y = facingYaw.current;
		}

		const eyeTarget = characterPos.current
			.clone()
			.setY(characterHeight.current + 0.85)
			.add(new THREE.Vector3());
		const horizontalDist = camDistance.current * Math.cos(camPitch.current);
		const height = camDistance.current * Math.sin(camPitch.current);
		const offset = new THREE.Vector3(
			horizontalDist * Math.sin(camYaw.current),
			height,
			horizontalDist * Math.cos(camYaw.current),
		);
		camera.position.copy(eyeTarget).add(offset);
		camera.lookAt(eyeTarget);

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
