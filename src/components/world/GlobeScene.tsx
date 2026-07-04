import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
	DESCENT_CONFIG,
	getOrbitControlsForMode,
	getProximity,
	getZoomMode,
	layoutResonancePoints,
	ZOOM_THRESHOLDS,
	type EntityEntry,
	type ZoomMode,
} from './worldGlobeConfig';
import { AtmosphereVeil } from './AtmosphereVeil';
import { DescentController, type JoystickVisual } from './DescentController';
import { GlobeSurface, type GlobeSurfaceHandle } from './GlobeSurface';
import { ResponsiveCamera } from './ResponsiveCamera';

type GlobeSceneProps = {
	entities: EntityEntry[];
	onHover: (entity: EntityEntry | null) => void;
	hoveredEntity: EntityEntry | null;
	isMobile: boolean;
	interactionPaused: boolean;
	onZoomModeChange?: (mode: ZoomMode) => void;
	onJoystickChange?: (joystick: JoystickVisual | null) => void;
	onPortalNear?: (wilayahId: string | null) => void;
};

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function GlobeScene({
	entities,
	onHover,
	hoveredEntity,
	isMobile,
	interactionPaused,
	onZoomModeChange,
	onJoystickChange,
	onPortalNear,
}: GlobeSceneProps) {
	const groupRef = useRef<THREE.Group>(null);
	const globeRef = useRef<GlobeSurfaceHandle>(null);
	const controlsRef = useRef<OrbitControlsImpl>(null);
	const [dragging, setDragging] = useState(false);
	const [descentActive, setDescentActive] = useState(false);
	const [exitingDescent, setExitingDescent] = useState(false);
	const [descentAnchor, setDescentAnchor] = useState(() => new THREE.Vector3(0, 0.6, 0.8));
	const exitProgress = useRef(0);
	const exitFrom = useRef(new THREE.Vector3());
	const exitTo = useRef(new THREE.Vector3());
	const exitFromQuat = useRef(new THREE.Quaternion());
	const exitToQuat = useRef(new THREE.Quaternion());
	// Portal wilayah (lihat worldGlobeConfig.ts) ditakrif dalam ruang tempatan
	// `groupRef` (di mana kedudukan entiti sebenar dilukis), tetapi anchor
	// descent dikira dalam ruang dunia — groupRef berputar perlahan semasa
	// mod orbit, jadi DescentController perlu tahu sudut putaran semasa untuk
	// padankan kedua-dua ruang koordinat itu bila menyemak kedekatan portal.
	const groupRotationRef = useRef(0);
	const { camera } = useThree();
	const segments = isMobile ? 48 : 64;

	const placements = useMemo(() => layoutResonancePoints(entities), [entities]);
	const distance = camera.position.length();
	const zoomMode = getZoomMode(distance, descentActive);
	const orbitConfig = useMemo(() => getOrbitControlsForMode(zoomMode, isMobile), [zoomMode, isMobile]);
	const [atmosphereIntensity, setAtmosphereIntensity] = useState(0.03);

	useEffect(() => {
		onZoomModeChange?.(zoomMode);
	}, [onZoomModeChange, zoomMode]);

	const descentAnchorRef = useRef(descentAnchor);
	descentAnchorRef.current = descentAnchor;
	const exitingDescentRef = useRef(exitingDescent);
	exitingDescentRef.current = exitingDescent;

	const beginExitDescent = useCallback(() => {
		if (exitingDescentRef.current) return;
		exitFrom.current.copy(camera.position);
		exitTo.current.copy(descentAnchorRef.current).normalize().multiplyScalar(DESCENT_CONFIG.orbitExitDistance);
		// Kekalkan sudut pandang semasa sebagai titik mula putaran, bukan terus
		// "snap" ke lookAt(0,0,0) — dieselang perlahan ke sudut sasaran sepanjang
		// transisi supaya keluar dari descent terasa lancar (padanan dengan
		// pembetulan "snap" masuk descent sebelum ini).
		exitFromQuat.current.copy(camera.quaternion);
		const targetMatrix = new THREE.Matrix4().lookAt(exitTo.current, new THREE.Vector3(0, 0, 0), camera.up);
		exitToQuat.current.setFromRotationMatrix(targetMatrix);
		exitProgress.current = 0;
		setExitingDescent(true);
		setDescentActive(false);
	}, [camera]);

	useFrame((_, delta) => {
		if (exitingDescent && camera instanceof THREE.PerspectiveCamera) {
			exitProgress.current = Math.min(1, exitProgress.current + delta * 1.1);
			const t = easeInOutCubic(exitProgress.current);
			camera.position.lerpVectors(exitFrom.current, exitTo.current, t);
			camera.quaternion.slerpQuaternions(exitFromQuat.current, exitToQuat.current, t);
			camera.fov = THREE.MathUtils.lerp(DESCENT_CONFIG.fov, isMobile ? 50 : 45, t);
			camera.near = 0.08;
			camera.updateProjectionMatrix();
			if (exitProgress.current >= 1) {
				setExitingDescent(false);
				controlsRef.current?.update();
			}
			return;
		}

		if (!descentActive && !exitingDescent && !interactionPaused) {
			const dist = camera.position.length();
			if (dist <= ZOOM_THRESHOLDS.descentEnter) {
				setDescentAnchor(camera.position.clone().normalize());
				setDescentActive(true);
			}
		}

		const proximity = getProximity(camera.position.length(), descentActive);
		setAtmosphereIntensity(0.03 + proximity * 0.14);

		if (groupRef.current) groupRotationRef.current = groupRef.current.rotation.y;

		if (!groupRef.current || dragging || interactionPaused || descentActive || exitingDescent) return;
		if (zoomMode !== 'orbit') return;
		groupRef.current.rotation.y += delta * 0.035;
	});

	const fogNear = descentActive ? 0.8 : zoomMode === 'atmosphere' ? 4.5 : 8;
	const fogFar = descentActive ? 14 : 22;
	// Langit sebenar dilihat dari dalam atmosfera — biru cair, bukan kelabu —
	// sepadan dengan warna latar Canvas di WorldGlobe.tsx mengikut zoomMode.
	const fogColor = descentActive ? '#8fc4ea' : '#0a1420';

	return (
		<>
			<fog attach="fog" args={[fogColor, fogNear, fogFar]} />
			<ResponsiveCamera isMobile={isMobile} disabled={descentActive || exitingDescent} />

			<ambientLight intensity={descentActive ? 0.55 : 0.38} color={descentActive ? '#c8d8e8' : '#8aa0b0'} />
			<directionalLight
				position={[4, 6, 5]}
				intensity={descentActive ? 1.1 : 0.85}
				color="#f0e6d0"
			/>
			<pointLight position={[2, 4, 5]} intensity={0.45} color="#c4a86a" distance={14} />
			<pointLight position={[-3, -2, -4]} intensity={0.28} color="#6a5898" distance={14} />

			{!descentActive ? (
				<Stars
					radius={90}
					depth={50}
					count={isMobile ? 600 : 1400}
					factor={2}
					saturation={0}
					fade
					speed={0.15}
				/>
			) : null}

			<group ref={groupRef} scale={isMobile ? 0.92 : 1}>
				<AtmosphereVeil intensity={atmosphereIntensity} />

				<GlobeSurface
					ref={globeRef}
					segments={segments}
					placements={placements}
					onHover={onHover}
					hoveredEntity={hoveredEntity}
					interactionPaused={interactionPaused || descentActive}
					forceProximity={descentActive ? 1 : undefined}
				/>
			</group>

			<DescentController
				active={descentActive && !exitingDescent}
				anchor={descentAnchor}
				interactionPaused={interactionPaused}
				isMobile={isMobile}
				onRequestExit={beginExitDescent}
				onAnchorChange={setDescentAnchor}
				onJoystickChange={onJoystickChange}
				onPortalNear={onPortalNear}
				groupRotationRef={groupRotationRef}
			/>

			<OrbitControls
				ref={controlsRef}
				enabled={!interactionPaused && !descentActive && !exitingDescent}
				enablePan={false}
				enableZoom
				enableDamping
				dampingFactor={0.09}
				minDistance={orbitConfig.minDistance}
				maxDistance={orbitConfig.maxDistance}
				minPolarAngle={orbitConfig.minPolarAngle}
				maxPolarAngle={orbitConfig.maxPolarAngle}
				rotateSpeed={orbitConfig.rotateSpeed}
				zoomSpeed={orbitConfig.zoomSpeed}
				touches={{
					ONE: THREE.TOUCH.ROTATE,
					TWO: THREE.TOUCH.DOLLY_ROTATE,
				}}
				onStart={() => setDragging(true)}
				onEnd={() => setDragging(false)}
			/>
		</>
	);
}
