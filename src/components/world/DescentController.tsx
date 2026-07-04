import { useRef, useEffect, useCallback, useMemo, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
	DESCENT_CONFIG,
	GLOBE_RADIUS,
	JOYSTICK_CONFIG,
	PORTAL_ENTER_COS,
	WILAYAH_PORTALS,
	portalDirection,
	ZOOM_THRESHOLDS,
} from './worldGlobeConfig';
import {
	anglesFromDirection,
	buildSurfaceFrame,
	lookDirectionFromAngles,
	applyDescentPose,
} from './surfaceFrame';

export type JoystickVisual = {
	originX: number;
	originY: number;
	dx: number;
	dy: number;
};

type DescentControllerProps = {
	active: boolean;
	anchor: THREE.Vector3;
	interactionPaused: boolean;
	isMobile: boolean;
	groupRef?: RefObject<THREE.Group | null>;
	onAnchorChange?: (anchor: THREE.Vector3) => void;
	onJoystickChange?: (joystick: JoystickVisual | null) => void;
	onPortalNear?: (wilayahId: string | null) => void;
	onExitDescent?: () => void;
	groupRotationRef?: RefObject<number>;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const EXIT_MAX_ALTITUDE = ZOOM_THRESHOLDS.atmosphereEnter - GLOBE_RADIUS;
const ORBIT_RADIUS_MIN = 1.85;
const ORBIT_RADIUS_MAX = 10;
const ORBIT_JOYSTICK_SPEED = 1.15;
const ORBIT_MIN_PHI = 0.15;
const ORBIT_MAX_PHI = Math.PI - 0.15;

type JoystickState = {
	pointerId: number;
	originX: number;
	originY: number;
	dx: number;
	dy: number;
};

type PinchStart = { dist: number; value: number };

export function DescentController({
	active,
	anchor,
	interactionPaused,
	isMobile,
	groupRef,
	onAnchorChange,
	onJoystickChange,
	onPortalNear,
	onExitDescent,
	groupRotationRef,
}: DescentControllerProps) {
	const { camera, gl } = useThree();
	const activeRef = useRef(active);
	activeRef.current = active;

	const yaw = useRef(0);
	const pitch = useRef(0);
	const altitude = useRef(0.25);
	const anchorRef = useRef(new THREE.Vector3());
	const dragging = useRef(false);
	const lastPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<PinchStart | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number; role: 'move' | 'look' }>());
	const joystick = useRef<JoystickState | null>(null);
	const lastNearPortal = useRef<string | null>(null);
	const exitGuardUntil = useRef(0);
	const spherical = useRef(new THREE.Spherical());
	const onAnchorChangeRef = useRef(onAnchorChange);
	const onJoystickChangeRef = useRef(onJoystickChange);
	const onExitDescentRef = useRef(onExitDescent);
	onAnchorChangeRef.current = onAnchorChange;
	onJoystickChangeRef.current = onJoystickChange;
	onExitDescentRef.current = onExitDescent;

	const anchorPropRef = useRef(anchor);
	anchorPropRef.current = anchor;

	const portals = useMemo(
		() =>
			Object.values(WILAYAH_PORTALS).map((portal) => ({
				id: portal.wilayahId,
				direction: new THREE.Vector3(...portalDirection(portal)),
			})),
		[],
	);

	const initFromCamera = useCallback(() => {
		anchorRef.current.copy(anchorPropRef.current).normalize();
		const frame = buildSurfaceFrame(anchorRef.current);

		const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camera.position).normalize();
		const angles = anglesFromDirection(toCenter, frame);
		yaw.current = angles.yaw;
		pitch.current = THREE.MathUtils.clamp(angles.pitch, DESCENT_CONFIG.minPitch, DESCENT_CONFIG.maxPitch);

		altitude.current = THREE.MathUtils.clamp(
			camera.position.length() - GLOBE_RADIUS,
			DESCENT_CONFIG.minAltitude,
			DESCENT_CONFIG.maxAltitude,
		);
	}, [camera]);

	const resetPointerState = useCallback(() => {
		pointers.current.clear();
		pinchStart.current = null;
		dragging.current = false;
		if (joystick.current) {
			joystick.current = null;
			onJoystickChangeRef.current?.(null);
		}
	}, []);

	useEffect(() => {
		if (active) {
			initFromCamera();
			resetPointerState();
			exitGuardUntil.current = performance.now() + 450;
		} else if (lastNearPortal.current !== null) {
			lastNearPortal.current = null;
			onPortalNear?.(null);
		}
	}, [active, initFromCamera, onPortalNear, resetPointerState]);

	useEffect(() => {
		if (!isMobile || interactionPaused) return;
		const el = gl.domElement;
		const rotateSpeed = DESCENT_CONFIG.lookYawSpeedMobile;
		const pitchSpeed = DESCENT_CONFIG.lookPitchSpeedMobile;

		const applyDescentLookDrag = (clientX: number, clientY: number) => {
			const dx = clientX - lastPointer.current.x;
			const dy = clientY - lastPointer.current.y;
			lastPointer.current = { x: clientX, y: clientY };
			yaw.current += dx * rotateSpeed;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current - dy * pitchSpeed,
				DESCENT_CONFIG.minPitch,
				DESCENT_CONFIG.maxPitch,
			);
		};

		const applyOrbitLookDrag = (clientX: number, clientY: number) => {
			const dx = clientX - lastPointer.current.x;
			const dy = clientY - lastPointer.current.y;
			lastPointer.current = { x: clientX, y: clientY };
			spherical.current.setFromVector3(camera.position);
			spherical.current.theta -= dx * rotateSpeed;
			spherical.current.phi = THREE.MathUtils.clamp(
				spherical.current.phi - dy * pitchSpeed,
				ORBIT_MIN_PHI,
				ORBIT_MAX_PHI,
			);
			camera.position.setFromSpherical(spherical.current);
			camera.lookAt(0, 0, 0);
		};

		const pointerDist = () => {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) return 0;
			return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		};

		/** Penjuru bawah kiri — ibu jari kiri, bukan separuh skrin */
		const isMoveZone = (clientX: number, clientY: number) => {
			const rect = el.getBoundingClientRect();
			const localX = clientX - rect.left;
			const localY = clientY - rect.top;
			return (
				localX < rect.width * JOYSTICK_CONFIG.cornerZoneWidthFrac &&
				localY > rect.height * (1 - JOYSTICK_CONFIG.cornerZoneHeightFrac)
			);
		};

		const emitJoystick = () => {
			if (!joystick.current) { onJoystickChangeRef.current?.(null); return; }
			onJoystickChangeRef.current?.({
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
			const clamped = Math.min(mag, JOYSTICK_CONFIG.maxRadius);
			const scale = mag > 0 ? clamped / mag : 0;
			joystick.current.dx = rawDx * scale;
			joystick.current.dy = rawDy * scale;
			emitJoystick();
		};

		const pinchValue = () =>
			activeRef.current ? altitude.current : camera.position.length();

		const startPinchZoom = () => {
			if (joystick.current) {
				joystick.current = null;
				onJoystickChangeRef.current?.(null);
			}
			dragging.current = false;
			pinchStart.current = {
				dist: Math.max(pointerDist(), 48),
				value: pinchValue(),
			};
		};

		const onPointerDown = (e: PointerEvent) => {
			try { el.setPointerCapture(e.pointerId); } catch { /* pointerId mungkin tidak sah */ }

			const role: 'move' | 'look' = isMoveZone(e.clientX, e.clientY) ? 'move' : 'look';
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role });

			// Dua jari (dua ibu jari) = cubit — batalkan joystick
			if (pointers.current.size >= 2) {
				startPinchZoom();
				return;
			}

			if (role === 'move') {
				joystick.current = {
					pointerId: e.pointerId,
					originX: e.clientX,
					originY: e.clientY,
					dx: 0,
					dy: 0,
				};
				emitJoystick();
				return;
			}

			dragging.current = true;
			lastPointer.current = { x: e.clientX, y: e.clientY };
		};

		const onPointerMove = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				updateJoystickOffset(e.clientX, e.clientY);
				const entry = pointers.current.get(e.pointerId);
				if (entry) { entry.x = e.clientX; entry.y = e.clientY; }
				return;
			}

			const isOrphan = !pointers.current.has(e.pointerId);
			const role = isMoveZone(e.clientX, e.clientY) ? 'move' : 'look';
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role });

			if (isOrphan) {
				if (pointers.current.size >= 2 && !pinchStart.current) {
					startPinchZoom();
				} else if (pointers.current.size === 1) {
					dragging.current = role === 'look';
					lastPointer.current = { x: e.clientX, y: e.clientY };
				}
				return;
			}

			if (pointers.current.size === 2 && pinchStart.current && !joystick.current) {
				const dist = Math.max(pointerDist(), 1);
				const scale = dist / pinchStart.current.dist;
				const rawNext = pinchStart.current.value / scale;

				if (activeRef.current) {
					altitude.current = THREE.MathUtils.clamp(
						rawNext,
						DESCENT_CONFIG.minAltitude,
						EXIT_MAX_ALTITUDE,
					);
					if (
						performance.now() >= exitGuardUntil.current &&
						GLOBE_RADIUS + altitude.current >= ZOOM_THRESHOLDS.atmosphereEnter - 0.04
					) {
						onExitDescentRef.current?.();
					}
				} else {
					const nextR = THREE.MathUtils.clamp(rawNext, ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX);
					camera.position.normalize().multiplyScalar(nextR);
					camera.lookAt(0, 0, 0);
				}
				return;
			}

			if (!dragging.current) return;
			const entry = pointers.current.get(e.pointerId);
			if (!entry || entry.role !== 'look') return;

			if (activeRef.current) applyDescentLookDrag(e.clientX, e.clientY);
			else applyOrbitLookDrag(e.clientX, e.clientY);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChangeRef.current?.(null);
				if (activeRef.current) onAnchorChangeRef.current?.(anchorRef.current.clone());
				pointers.current.delete(e.pointerId);
				dragging.current = false;
				return;
			}

			pointers.current.delete(e.pointerId);
			pinchStart.current = null;
			const remaining = [...pointers.current.entries()].find(([, p]) => p.role === 'look');
			if (remaining && !joystick.current) {
				dragging.current = true;
				lastPointer.current = { x: remaining[1].x, y: remaining[1].y };
			} else if (!remaining) {
				dragging.current = false;
			}
		};

		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerUp);

		return () => {
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerUp);
			if (joystick.current) { joystick.current = null; onJoystickChangeRef.current?.(null); }
		};
	}, [interactionPaused, isMobile, gl, camera]);

	useFrame((_, delta) => {
		if (!isMobile || interactionPaused) return;

		if (joystick.current) {
			const { dx, dy } = joystick.current;
			const rawMag = Math.hypot(dx, dy);
			const mag = rawMag / JOYSTICK_CONFIG.maxRadius;

			if (mag > JOYSTICK_CONFIG.deadzone && rawMag > 0) {
				const ndx = dx / rawMag;
				const ndy = dy / rawMag;

				if (activeRef.current) {
					const frame = buildSurfaceFrame(anchorRef.current);
					const forwardWorld = lookDirectionFromAngles(yaw.current, 0, frame);
					const rightWorld = lookDirectionFromAngles(yaw.current + Math.PI / 2, 0, frame);
					const moveWorld = new THREE.Vector3()
						.addScaledVector(forwardWorld, -ndy)
						.addScaledVector(rightWorld, ndx);

					if (moveWorld.lengthSq() > 1e-8) {
						moveWorld.normalize();
						const axis = new THREE.Vector3().crossVectors(anchorRef.current, moveWorld).normalize();
						if (axis.lengthSq() > 1e-8) {
							const angleStep = DESCENT_CONFIG.moveAngularSpeed * mag * delta;
							const nextAnchor = anchorRef.current.clone().applyAxisAngle(axis, angleStep).normalize();
							const nextFrame = buildSurfaceFrame(nextAnchor);
							yaw.current = anglesFromDirection(forwardWorld, nextFrame).yaw;
							anchorRef.current.copy(nextAnchor);
						}
					}
				} else if (groupRef?.current) {
					groupRef.current.rotation.y -= ndx * ORBIT_JOYSTICK_SPEED * mag * delta;
					groupRef.current.rotation.x = THREE.MathUtils.clamp(
						groupRef.current.rotation.x - ndy * 0.35 * mag * delta,
						-0.22,
						0.22,
					);
				}
			}
		}

		if (activeRef.current && camera instanceof THREE.PerspectiveCamera) {
			const frame = buildSurfaceFrame(anchorRef.current);
			applyDescentPose(
				camera,
				anchorRef.current,
				yaw.current,
				pitch.current,
				altitude.current,
				GLOBE_RADIUS,
				frame.up,
			);

			if (onPortalNear) {
				const groupY = groupRotationRef?.current ?? 0;
				const localAnchor = anchorRef.current.clone().applyAxisAngle(Y_AXIS, -groupY);
				const nearest = portals.find((p) => localAnchor.dot(p.direction) > PORTAL_ENTER_COS)?.id ?? null;
				if (nearest !== lastNearPortal.current) {
					lastNearPortal.current = nearest;
					onPortalNear(nearest);
				}
			}
		}
	});

	return null;
}
