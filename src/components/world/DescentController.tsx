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
} from './worldGlobeConfig';
import {
	anglesFromDirection,
	buildSurfaceFrame,
	lookDirectionFromAngles,
	applyDescentPose,
} from './surfaceFrame';
import { InteriorAtmosphere } from './InteriorAtmosphere';

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
	onRequestExit: () => void;
	onAnchorChange?: (anchor: THREE.Vector3) => void;
	onJoystickChange?: (joystick: JoystickVisual | null) => void;
	onPortalNear?: (wilayahId: string | null) => void;
	groupRotationRef?: RefObject<number>;
};

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

type JoystickState = {
	pointerId: number;
	originX: number;
	originY: number;
	dx: number;
	dy: number;
};

export function DescentController({
	active,
	anchor,
	interactionPaused,
	isMobile,
	onRequestExit,
	onAnchorChange,
	onJoystickChange,
	onPortalNear,
	groupRotationRef,
}: DescentControllerProps) {
	const { camera, gl } = useThree();
	const yaw = useRef(0);
	const pitch = useRef(0);
	const altitude = useRef(0.25);
	const transition = useRef(1);
	const anchorRef = useRef(new THREE.Vector3());
	const dragging = useRef(false);
	const lastPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<{ dist: number; alt: number } | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number; role: 'move' | 'look' }>());
	const joystick = useRef<JoystickState | null>(null);
	const lastNearPortal = useRef<string | null>(null);
	/** Elak cubit orbit yang masih aktif semasa kemasukan terus picu keluar descent. */
	const exitGuardUntil = useRef(0);
	const onRequestExitRef = useRef(onRequestExit);
	const onAnchorChangeRef = useRef(onAnchorChange);
	const onJoystickChangeRef = useRef(onJoystickChange);
	onRequestExitRef.current = onRequestExit;
	onAnchorChangeRef.current = onAnchorChange;
	onJoystickChangeRef.current = onJoystickChange;

	// camera.up semasa masuk descent — lerp halus, bukan snap sekali-gus
	const cameraUpStart = useRef(new THREE.Vector3(0, 1, 0));

	const pitchStart = useRef(0);
	const pitchTarget = useRef(0);
	const altitudeStart = useRef(0);
	const altitudeTarget = useRef(0);

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

		// Pandang dari kamera ke pusat globe — arah pandang OrbitControls semasa ini
		const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camera.position).normalize();
		const angles = anglesFromDirection(toCenter, frame);
		yaw.current = angles.yaw;

		// KEKAL pada sudut kemasukan — camera tidak bergeser ke ufuk.
		// "Menghadap ke globe" bermakna pitch negatif (pandang ke bawah ke permukaan),
		// bukan pitch = 0.08 (ufuk). Pengguna bebas seret untuk ubah sudut.
		pitchStart.current = THREE.MathUtils.clamp(angles.pitch, DESCENT_CONFIG.minPitch, DESCENT_CONFIG.maxPitch);
		pitchTarget.current = pitchStart.current;
		pitch.current = pitchStart.current;

		altitudeStart.current = THREE.MathUtils.clamp(
			camera.position.length() - GLOBE_RADIUS,
			DESCENT_CONFIG.minAltitude,
			DESCENT_CONFIG.maxAltitude + 0.3,
		);
		altitudeTarget.current = THREE.MathUtils.clamp(
			altitudeStart.current,
			DESCENT_CONFIG.minAltitude,
			DESCENT_CONFIG.maxAltitude,
		);
		altitude.current = altitudeStart.current;

		// Simpan camera.up untuk lerp halus → elak guling mendadak
		cameraUpStart.current.copy(camera.up);

		transition.current = 0;
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
			exitGuardUntil.current = performance.now() + 480;
		} else if (lastNearPortal.current !== null) {
			lastNearPortal.current = null;
			onPortalNear?.(null);
		}
	}, [active, initFromCamera, onPortalNear, resetPointerState]);

	useEffect(() => {
		if (!active || interactionPaused) return;
		const el = gl.domElement;
		const rotateSpeed = isMobile ? DESCENT_CONFIG.lookYawSpeedMobile : DESCENT_CONFIG.lookYawSpeedDesktop;
		const pitchSpeed = isMobile ? DESCENT_CONFIG.lookPitchSpeedMobile : DESCENT_CONFIG.lookPitchSpeedDesktop;

		const applyLookDrag = (clientX: number, clientY: number) => {
			const dx = clientX - lastPointer.current.x;
			const dy = clientY - lastPointer.current.y;
			lastPointer.current = { x: clientX, y: clientY };
			// Seret kanan = pandang kanan (globe berpusing ke kiri); seret atas = pandang atas
			yaw.current += dx * rotateSpeed;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current - dy * pitchSpeed,
				DESCENT_CONFIG.minPitch,
				DESCENT_CONFIG.maxPitch,
			);
		};

		const pointerDist = () => {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) return 0;
			return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		};

		// Separuh kiri skrin = zon joystick (floating, sama macam Veilrose Quarter)
		const isMoveZone = (clientX: number) => {
			const rect = el.getBoundingClientRect();
			return clientX - rect.left < rect.width * 0.5;
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

		const canExitDescent = () => performance.now() >= exitGuardUntil.current;

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

		const startPinchZoom = () => {
			if (joystick.current) {
				joystick.current = null;
				onJoystickChangeRef.current?.(null);
			}
			dragging.current = false;
			const dist = Math.max(pointerDist(), 48);
			pinchStart.current = { dist, alt: altitude.current };
		};

		const onPointerDown = (e: PointerEvent) => {
			try { el.setPointerCapture(e.pointerId); } catch { /* pointerId mungkin tidak sah */ }

			const role: 'move' | 'look' = isMoveZone(e.clientX) ? 'move' : 'look';
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role });

			// Joystick aktif + jari kedua = toleh kamera serentak (ala Sky / Veilrose)
			if (joystick.current) {
				pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'look' });
				dragging.current = true;
				lastPointer.current = { x: e.clientX, y: e.clientY };
				return;
			}

			// Dua jari tanpa joystick = cubit zoom
			if (pointers.current.size >= 2) {
				startPinchZoom();
				return;
			}

			// Satu jari di zon kiri = joystick floating
			if (role === 'move') {
				joystick.current = { pointerId: e.pointerId, originX: e.clientX, originY: e.clientY, dx: 0, dy: 0 };
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
			const role = isMoveZone(e.clientX) ? 'move' : 'look';
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role });

			if (isOrphan) {
				if (joystick.current) {
					dragging.current = true;
					lastPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size >= 2 && !pinchStart.current) {
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
				// Buka jari (scale > 1) = zoom masuk = altitude KURANG (rapat ke permukaan)
				// Cubit (scale < 1) = zoom keluar = altitude NAIK (menjauh dari permukaan)
				const next = THREE.MathUtils.clamp(
					pinchStart.current.alt / scale,
					DESCENT_CONFIG.minAltitude,
					DESCENT_CONFIG.maxAltitude + 0.08,
				);
				altitude.current = next;
				// Keluar hanya pada cubit keluar yang jelas — bukan sisa gerakan masuk dari orbit
				if (canExitDescent() && scale < 0.78 && next >= DESCENT_CONFIG.maxAltitude * 0.9) {
					onRequestExitRef.current();
				}
				return;
			}

			if (!dragging.current) return;
			const entry = pointers.current.get(e.pointerId);
			if (!entry) return;
			// Semasa joystick aktif, mana-mana jari lain boleh toleh kamera
			if (!joystick.current && entry.role !== 'look') return;

			applyLookDrag(e.clientX, e.clientY);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChangeRef.current?.(null);
				onAnchorChangeRef.current?.(anchorRef.current.clone());
				pointers.current.delete(e.pointerId);
				const remaining = [...pointers.current.entries()].find(([, p]) => p.role === 'look');
				if (remaining) {
					dragging.current = true;
					lastPointer.current = { x: remaining[1].x, y: remaining[1].y };
				} else {
					dragging.current = false;
				}
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

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			// deltaY > 0 = skrol turun = zoom masuk = altitude KURANG (rapat ke permukaan)
			const next = THREE.MathUtils.clamp(
				altitude.current - e.deltaY * 0.00035,
				DESCENT_CONFIG.minAltitude,
				DESCENT_CONFIG.maxAltitude + 0.1,
			);
			altitude.current = next;
			// Skrol naik (deltaY < 0) = zoom keluar = altitude naik → keluar descent
			if (canExitDescent() && next >= DESCENT_CONFIG.maxAltitude * 0.9 && e.deltaY < 0) {
				onRequestExitRef.current();
			}
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
			if (joystick.current) { joystick.current = null; onJoystickChangeRef.current?.(null); }
		};
	}, [active, interactionPaused, isMobile, gl]);

	useFrame((_, delta) => {
		if (!active || !(camera instanceof THREE.PerspectiveCamera)) return;

		if (transition.current < 1) {
			transition.current = Math.min(1, transition.current + delta * 0.55);
			const t = easeOutCubic(transition.current);
			camera.fov = THREE.MathUtils.lerp(48, DESCENT_CONFIG.fov, t);
			camera.near = 0.015;
			camera.updateProjectionMatrix();
			// Hanya altitude yang berubah semasa transition — pitch dan yaw KEKAL tetap
			// supaya kamera sentiasa kekal menghala ke globe pada saat masuk.
			if (!dragging.current && !pinchStart.current) {
				altitude.current = THREE.MathUtils.lerp(altitudeStart.current, altitudeTarget.current, t);
			}
		}

		if (joystick.current) {
			const { dx, dy } = joystick.current;
			const rawMag = Math.hypot(dx, dy);
			const mag = rawMag / JOYSTICK_CONFIG.maxRadius;
			if (mag > JOYSTICK_CONFIG.deadzone && rawMag > 0) {
				const ndx = dx / rawMag;
				const ndy = dy / rawMag;
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
			}
		}

		// Lerp camera.up dari world-up → surface normal sepanjang transition
		// untuk elak guling mendadak semasa masuk descent dari orbit
		const frame = buildSurfaceFrame(anchorRef.current);
		const blendedUp =
			transition.current < 1
				? cameraUpStart.current.clone().lerp(frame.up, easeOutCubic(transition.current))
				: frame.up;

		// First-person: kamera di atas permukaan, pandang mengikut yaw+pitch semasa
		applyDescentPose(
			camera,
			anchorRef.current,
			yaw.current,
			pitch.current,
			altitude.current,
			GLOBE_RADIUS,
			blendedUp,
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
	});

	return <InteriorAtmosphere active={active} isMobile={isMobile} />;
}
