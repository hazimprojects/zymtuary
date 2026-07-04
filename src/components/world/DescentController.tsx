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
	applyThirdPersonGlobePose,
	type SurfaceFrame,
} from './surfaceFrame';
import { InteriorAtmosphere } from './InteriorAtmosphere';
import { ZymAvatar } from '../kawasan/ZymAvatar';
import { type ZymMotionState } from '../kawasan/ZymAvatar';

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

// Globe radius = 1.55 unit. AVATAR_SCALE dikira supaya Zym kelihatan seperti
// insan di permukaan planet — ~7% jejari globe. applyThirdPersonGlobePose
// menggunakan formula Veilrose (pivot bahu + camPitch 0.36) supaya rasa kamera
// sama macam di Veilrose Quarter.
const AVATAR_SCALE = 0.07;
const ZYM_GLOW = '#d4a843';

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
	const pitch = useRef(0.05);
	const altitude = useRef(0.25);
	// Pre-allocated — elak pembinaan objek Three.js dalam setiap bingkai
	const _avatarRight = useRef(new THREE.Vector3());
	const _avatarMatrix = useRef(new THREE.Matrix4());
	const transition = useRef(1);
	const anchorRef = useRef(new THREE.Vector3());
	const dragging = useRef(false);
	const lastPointer = useRef({ x: 0, y: 0 });
	const pinchStart = useRef<{ dist: number; alt: number } | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number; role: 'move' | 'look' }>());
	const joystick = useRef<JoystickState | null>(null);
	const lastNearPortal = useRef<string | null>(null);

	// camera.up semasa masuk descent — untuk lerp halus, bukannya snap sekali gus
	const cameraUpStart = useRef(new THREE.Vector3(0, 1, 0));
	// kuaternion kamera semasa masuk — untuk lerp kuaternion sepanjang transition
	const cameraQuatStart = useRef(new THREE.Quaternion());

	// Ref avatar Zym — kemas kini setiap frame tanpa re-render
	const avatarGroupRef = useRef<THREE.Group>(null);
	const motionState = useRef<ZymMotionState>({ speed: 0, running: 0, flying: 1, pitchInput: 0 });

	const portals = useMemo(
		() =>
			Object.values(WILAYAH_PORTALS).map((portal) => ({
				id: portal.wilayahId,
				direction: new THREE.Vector3(...portalDirection(portal)),
			})),
		[],
	);

	const pitchStart = useRef(0);
	const pitchTarget = useRef(0);
	const altitudeStart = useRef(0);
	const altitudeTarget = useRef(0);

	const anchorPropRef = useRef(anchor);
	anchorPropRef.current = anchor;

	const initFromCamera = useCallback(() => {
		anchorRef.current.copy(anchorPropRef.current).normalize();
		const frame = buildSurfaceFrame(anchorRef.current);

		// Pandang dari kamera ke pusat globe — ini arah pandang OrbitControls
		const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camera.position).normalize();
		const angles = anglesFromDirection(toCenter, frame);
		yaw.current = angles.yaw;

		// Kekalkan pitch semasa — jangan beransur ke ufuk (itu yang menyebabkan lonjakan)
		pitchStart.current = THREE.MathUtils.clamp(angles.pitch, DESCENT_CONFIG.minPitch, DESCENT_CONFIG.maxPitch);
		// pitchTarget sama dengan pitchStart — tiada perubahan pitch semasa transition
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

		// Simpan up & quaternion kamera semasa untuk lerp halus — inilah fix utama:
		// `applyThirdPersonGlobePose` akan set camera.up = frame.up secara mengejut
		// pada bingkai pertama kecuali kita lerp secara manual sepanjang transition.
		cameraUpStart.current.copy(camera.up);
		cameraQuatStart.current.copy(camera.quaternion);

		transition.current = 0;
	}, [camera]);

	useEffect(() => {
		if (active) initFromCamera();
		else if (lastNearPortal.current !== null) {
			lastNearPortal.current = null;
			onPortalNear?.(null);
		}
	}, [active, initFromCamera, onPortalNear]);

	useEffect(() => {
		if (!active || interactionPaused) return;
		const el = gl.domElement;
		const rotateSpeed = isMobile ? 0.0038 : 0.0028;
		const pitchSpeed = isMobile ? 0.0028 : 0.0022;

		const pointerDist = () => {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) return 0;
			return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		};

		/** Separuh kiri skrin = zon joystick (sama macam Veilrose Quarter) */
		const isMoveZone = (clientX: number) => {
			const rect = el.getBoundingClientRect();
			return clientX - rect.left < rect.width * 0.5;
		};

		const emitJoystick = () => {
			if (!joystick.current) { onJoystickChange?.(null); return; }
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
			const clamped = Math.min(mag, JOYSTICK_CONFIG.maxRadius);
			const scale = mag > 0 ? clamped / mag : 0;
			joystick.current.dx = rawDx * scale;
			joystick.current.dy = rawDy * scale;
			emitJoystick();
		};

		const onPointerDown = (e: PointerEvent) => {
			try { el.setPointerCapture(e.pointerId); } catch { /* pointerId tidak sah */ }

			if (!joystick.current && isMoveZone(e.clientX)) {
				// Joystick floating — muncul di mana jari menyentuh (sama macam Veilrose)
				joystick.current = { pointerId: e.pointerId, originX: e.clientX, originY: e.clientY, dx: 0, dy: 0 };
				pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'move' });
				emitJoystick();
				return;
			}

			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, role: 'look' });
			if (joystick.current) {
				// Joystick aktif + jari baru = seret kamera serentak (ala Sky)
				dragging.current = true;
				lastPointer.current = { x: e.clientX, y: e.clientY };
			} else if (pointers.current.size === 1) {
				dragging.current = true;
				lastPointer.current = { x: e.clientX, y: e.clientY };
			} else if (pointers.current.size === 2) {
				dragging.current = false;
				pinchStart.current = { dist: pointerDist(), alt: altitude.current };
			}
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
				} else if (pointers.current.size === 1) {
					dragging.current = role === 'look';
					lastPointer.current = { x: e.clientX, y: e.clientY };
				} else if (pointers.current.size === 2 && !pinchStart.current) {
					dragging.current = false;
					pinchStart.current = { dist: pointerDist(), alt: altitude.current };
				}
				return;
			}

			if (pointers.current.size === 2 && pinchStart.current && !joystick.current) {
				const dist = pointerDist();
				const scale = dist / Math.max(pinchStart.current.dist, 1);
				const next = THREE.MathUtils.clamp(
					pinchStart.current.alt * scale,
					DESCENT_CONFIG.minAltitude,
					DESCENT_CONFIG.maxAltitude + 0.08,
				);
				altitude.current = next;
				if (scale > 1.35) onRequestExit();
				return;
			}

			if (!dragging.current) return;
			const entry = pointers.current.get(e.pointerId);
			if (!entry || entry.role !== 'look') return;

			const dx = e.clientX - lastPointer.current.x;
			const dy = e.clientY - lastPointer.current.y;
			lastPointer.current = { x: e.clientX, y: e.clientY };
			// Seret kiri = toleh kiri (arah dibalikkan supaya rasa semula jadi)
			yaw.current -= dx * rotateSpeed;
			pitch.current = THREE.MathUtils.clamp(
				pitch.current + dy * pitchSpeed,
				DESCENT_CONFIG.minPitch,
				DESCENT_CONFIG.maxPitch,
			);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (joystick.current && e.pointerId === joystick.current.pointerId) {
				joystick.current = null;
				onJoystickChange?.(null);
				onAnchorChange?.(anchorRef.current.clone());
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
			if (joystick.current) { joystick.current = null; onJoystickChange?.(null); }
		};
	}, [active, interactionPaused, isMobile, gl, onRequestExit, onAnchorChange, onJoystickChange]);

	useFrame((_, delta) => {
		if (!active || !(camera instanceof THREE.PerspectiveCamera)) return;

		if (transition.current < 1) {
			transition.current = Math.min(1, transition.current + delta * 0.55);
			const t = easeOutCubic(transition.current);
			camera.fov = THREE.MathUtils.lerp(48, DESCENT_CONFIG.fov, t);
			camera.near = 0.015;
			camera.updateProjectionMatrix();
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
				const moveFrame = buildSurfaceFrame(anchorRef.current);
				const forwardWorld = lookDirectionFromAngles(yaw.current, 0, moveFrame);
				const rightWorld = lookDirectionFromAngles(yaw.current + Math.PI / 2, 0, moveFrame);
				const moveWorld = new THREE.Vector3()
					.addScaledVector(forwardWorld, -ndy)
					.addScaledVector(rightWorld, ndx);

				if (moveWorld.lengthSq() > 1e-8) {
					moveWorld.normalize();
					const axis = new THREE.Vector3().crossVectors(anchorRef.current, moveWorld).normalize();
					if (axis.lengthSq() > 1e-8) {
						const angleStep = JOYSTICK_CONFIG.moveAngularSpeed * mag * delta;
						const nextAnchor = anchorRef.current.clone().applyAxisAngle(axis, angleStep).normalize();
						const nextFrame = buildSurfaceFrame(nextAnchor);
						yaw.current = anglesFromDirection(forwardWorld, nextFrame).yaw;
						anchorRef.current.copy(nextAnchor);
					}
				}
				// Kemas kini state gerak avatar
				motionState.current.speed = mag;
			} else {
				motionState.current.speed = 0;
			}
		} else {
			motionState.current.speed = 0;
		}

		// Lerp camera.up dari up asal → surface frame.up sepanjang transition
		// untuk elak "guling" mendadak semasa masuk descent dari orbit.
		const frameForUp = buildSurfaceFrame(anchorRef.current);
		const blendedUp =
			transition.current < 1
				? cameraUpStart.current.clone().lerp(frameForUp.up, easeOutCubic(transition.current))
				: frameForUp.up;

		// Kamera third-person ala Veilrose — applyThirdPersonGlobePose mengembalikan
		// frame supaya kita boleh guna semula untuk orientasi avatar tanpa kira ulang.
		const { avatarPos, avatarForward, frame: avatarFrame } = applyThirdPersonGlobePose(
			camera,
			anchorRef.current,
			yaw.current,
			GLOBE_RADIUS,
			AVATAR_SCALE,
			blendedUp,
		);

		// Orientasi avatar: atas = surface normal, hadapan = avatarForward
		if (avatarGroupRef.current) {
			avatarGroupRef.current.position.copy(avatarPos);
			_avatarRight.current.crossVectors(avatarForward, avatarFrame.up).normalize();
			_avatarMatrix.current.makeBasis(
				_avatarRight.current,
				avatarFrame.up,
				avatarForward.clone().negate(),
			);
			avatarGroupRef.current.quaternion.setFromRotationMatrix(_avatarMatrix.current);
		}

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

	return (
		<>
			<InteriorAtmosphere active={active} isMobile={isMobile} />
			{active ? (
				<group ref={avatarGroupRef} scale={AVATAR_SCALE}>
					<ZymAvatar glowColor={ZYM_GLOW} motionRef={motionState} />
				</group>
			) : null}
		</>
	);
}
