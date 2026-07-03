import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DESCENT_CONFIG, GLOBE_RADIUS, JOYSTICK_CONFIG } from './worldGlobeConfig';
import {
	applyDescentPose,
	anglesFromDirection,
	buildSurfaceFrame,
	lookDirectionFromAngles,
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
};

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

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
}: DescentControllerProps) {
	const { camera, gl } = useThree();
	const yaw = useRef(0);
	const pitch = useRef(0.05);
	const altitude = useRef(0.2);
	const transition = useRef(1);
	const anchorRef = useRef(new THREE.Vector3());
	const dragging = useRef(false);
	const lastPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<{ dist: number; alt: number } | null>(null);
	// Penuding "pandang" / cubit sahaja — penuding joystick disimpan berasingan
	// di bawah supaya kedua-dua zon boleh aktif serentak (dua jari, dua peranan).
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const joystick = useRef<JoystickState | null>(null);

	const initFromCamera = useCallback(() => {
		anchorRef.current.copy(anchor).normalize();
		const frame = buildSurfaceFrame(anchorRef.current);
		const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camera.position).normalize();
		const angles = anglesFromDirection(toCenter, frame);
		yaw.current = angles.yaw;
		pitch.current = THREE.MathUtils.clamp(
			THREE.MathUtils.lerp(angles.pitch, 0.08, 0.55),
			DESCENT_CONFIG.minPitch,
			DESCENT_CONFIG.maxPitch,
		);
		altitude.current = THREE.MathUtils.clamp(
			camera.position.length() - GLOBE_RADIUS,
			DESCENT_CONFIG.minAltitude,
			DESCENT_CONFIG.maxAltitude,
		);
		transition.current = 0;
	}, [anchor, camera]);

	useEffect(() => {
		if (active) initFromCamera();
	}, [active, initFromCamera]);

	useEffect(() => {
		if (!active || interactionPaused) return;
		const el = gl.domElement;
		const rotateSpeed = isMobile ? 0.0038 : 0.0028;
		const pitchSpeed = isMobile ? 0.0028 : 0.0022;

		const pointerDist = () => {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) return 0;
			const dx = pts[1].x - pts[0].x;
			const dy = pts[1].y - pts[0].y;
			return Math.hypot(dx, dy);
		};

		/** Penjuru bawah kiri/kanan skrin — di sinilah joystick pergerakan muncul. */
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
			// Tanpa capture, jari yang bergerak laju/jauh boleh terlepas daripada
			// canvas di sesetengah pelayar mobile dan pointermove berhenti sampai.
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
				pinchStart.current = { dist: pointerDist(), alt: altitude.current };
			}
		};

		const onPointerMove = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				updateJoystickOffset(e.clientX, e.clientY);
				return;
			}

			// Jari yang sudah di skrin sebelum descent aktif (cth. cubit yang mencetuskan
			// peralihan) tidak sempat cetuskan pointerdown pada controller ini — daftar
			// terus di sini supaya "look" tidak mati sehingga jari diangkat & disentuh semula.
			const isOrphan = !pointers.current.has(e.pointerId);
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

			if (isOrphan) {
				if (pointers.current.size === 1) {
					dragging.current = true;
					lastPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size === 2 && !pinchStart.current) {
					dragging.current = false;
					pinchStart.current = { dist: pointerDist(), alt: altitude.current };
				}
				return;
			}

			if (pointers.current.size === 2 && pinchStart.current) {
				const dist = pointerDist();
				const scale = dist / Math.max(pinchStart.current.dist, 1);
				const next = THREE.MathUtils.clamp(
					pinchStart.current.alt * scale,
					DESCENT_CONFIG.minAltitude,
					DESCENT_CONFIG.maxAltitude + 0.08,
				);
				altitude.current = next;
				// Cubit keluar dengan jelas (jarak jari bertambah >35%) sentiasa naik keluar —
				// tak perlu sudah berada dekat ketinggian maksimum dahulu.
				if (scale > 1.35) {
					onRequestExit();
				}
				return;
			}

			if (!dragging.current) return;
			const dx = e.clientX - lastPointer.current.x;
			const dy = e.clientY - lastPointer.current.y;
			lastPointer.current = { x: e.clientX, y: e.clientY };
			yaw.current += dx * rotateSpeed;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current - dy * pitchSpeed,
				DESCENT_CONFIG.minPitch,
				DESCENT_CONFIG.maxPitch,
			);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChange?.(null);
				onAnchorChange?.(anchorRef.current.clone());
				return;
			}

			pointers.current.delete(e.pointerId);
			if (pointers.current.size < 2) pinchStart.current = null;

			if (pointers.current.size === 1) {
				// satu jari masih di skrin selepas cubit keluar — sambung "look" tanpa lompat
				const remaining = [...pointers.current.values()][0];
				dragging.current = true;
				lastPointer.current = { ...remaining };
				return;
			}

			dragging.current = false;
		};

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const next = THREE.MathUtils.clamp(
				altitude.current + e.deltaY * 0.00035,
				DESCENT_CONFIG.minAltitude,
				DESCENT_CONFIG.maxAltitude + 0.1,
			);
			altitude.current = next;
			if (next >= DESCENT_CONFIG.maxAltitude * 0.95 && e.deltaY > 0) onRequestExit();
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
	}, [active, interactionPaused, isMobile, gl, onRequestExit, onAnchorChange, onJoystickChange]);

	useFrame((_, delta) => {
		if (!active || !(camera instanceof THREE.PerspectiveCamera)) return;

		if (transition.current < 1) {
			transition.current = Math.min(1, transition.current + delta * 1.1);
			const t = easeOutCubic(transition.current);
			camera.fov = THREE.MathUtils.lerp(48, DESCENT_CONFIG.fov, t);
			camera.near = 0.015;
			camera.updateProjectionMatrix();
		}

		if (joystick.current) {
			const { dx, dy } = joystick.current;
			const rawMag = Math.hypot(dx, dy);
			const mag = rawMag / JOYSTICK_CONFIG.maxRadius;
			if (mag > JOYSTICK_CONFIG.deadzone && rawMag > 0) {
				// Arah dunia dikira daripada yaw semasa — joystick menggerakkan anda
				// relatif ke arah pandang (depan/belakang/sisi), tetapi tidak pernah
				// menukar arah pandang itu sendiri ("kamera tak berubah").
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
						const angleStep = JOYSTICK_CONFIG.moveAngularSpeed * mag * delta;
						const nextAnchor = anchorRef.current.clone().applyAxisAngle(axis, angleStep).normalize();
						const newFrame = buildSurfaceFrame(nextAnchor);
						// Kekalkan arah pandang dunia tetap semasa bergerak, bukan hanya
						// yaw mentah — elak "melayang" apabila melintasi kutub tempatan.
						yaw.current = anglesFromDirection(forwardWorld, newFrame).yaw;
						anchorRef.current.copy(nextAnchor);
					}
				}
			}
		}

		applyDescentPose(
			camera,
			anchorRef.current,
			yaw.current,
			pitch.current,
			altitude.current,
			GLOBE_RADIUS,
		);
	});

	return <InteriorAtmosphere active={active} isMobile={isMobile} />;
}
