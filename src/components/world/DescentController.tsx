import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
	DESCENT_CONFIG,
	GLOBE_RADIUS,
	type EntityEntry,
	type ResonancePlacement,
} from './worldGlobeConfig';
import { applyDescentPose, anglesFromDirection, buildSurfaceFrame } from './surfaceFrame';
import { pickNearestEntity } from './pickNearestEntity';
import { InteriorAtmosphere } from './InteriorAtmosphere';

type DescentControllerProps = {
	active: boolean;
	anchor: THREE.Vector3;
	interactionPaused: boolean;
	isMobile: boolean;
	placements: ResonancePlacement[];
	onSelect: (entity: EntityEntry) => void;
	onRequestExit: () => void;
};

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

export function DescentController({
	active,
	anchor,
	interactionPaused,
	isMobile,
	placements,
	onSelect,
	onRequestExit,
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
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const raycaster = useRef(new THREE.Raycaster());
	const globeHit = useRef(new THREE.Vector3());

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

		const onPointerDown = (e: PointerEvent) => {
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
			if (!pointers.current.has(e.pointerId)) return;
			pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

			if (pointers.current.size === 2 && pinchStart.current) {
				const dist = pointerDist();
				const scale = dist / Math.max(pinchStart.current.dist, 1);
				const next = THREE.MathUtils.clamp(
					pinchStart.current.alt * scale,
					DESCENT_CONFIG.minAltitude,
					DESCENT_CONFIG.maxAltitude + 0.08,
				);
				altitude.current = next;
				if (next >= DESCENT_CONFIG.maxAltitude * 0.92 && scale > 1.06) {
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
			const wasTap =
				pointers.current.size === 1 &&
				Math.hypot(e.clientX - lastPointer.current.x, e.clientY - lastPointer.current.y) < 8;

			pointers.current.delete(e.pointerId);
			if (pointers.current.size < 2) pinchStart.current = null;
			if (pointers.current.size === 0) {
				dragging.current = false;
				if (wasTap && camera instanceof THREE.PerspectiveCamera) {
					const lookDir = new THREE.Vector3();
					camera.getWorldDirection(lookDir);
					raycaster.current.set(camera.position, lookDir);
					const hit = raycaster.current.intersectSphere(
						new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS * 1.002),
						globeHit.current,
					);
					if (hit) {
						const n = globeHit.current.clone().normalize();
						const entity = pickNearestEntity(n.x, n.y, n.z, placements, 0.86);
						if (entity) onSelect(entity);
					}
				}
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
		};
	}, [active, interactionPaused, isMobile, gl, placements, onSelect, onRequestExit, camera]);

	useFrame((_, delta) => {
		if (!active || !(camera instanceof THREE.PerspectiveCamera)) return;

		if (transition.current < 1) {
			transition.current = Math.min(1, transition.current + delta * 1.1);
			const t = easeOutCubic(transition.current);
			camera.fov = THREE.MathUtils.lerp(48, DESCENT_CONFIG.fov, t);
			camera.near = 0.015;
			camera.updateProjectionMatrix();
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

	return <InteriorAtmosphere active={active} />;
}
