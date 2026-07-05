import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
	getOrbitControlsForMode,
	getZoomMode,
	ZOOM_THRESHOLDS,
	type ZoomMode,
} from './worldGlobeConfig';
import {
	getAtmosphereBlend,
	getCameraFov,
	getDayFactor,
	getDaylight,
	getExteriorVeilIntensity,
	getFogColor,
	getFogRange,
	getInteriorBlend,
	getStarVisibility,
	smoothDamp,
} from './atmosphereTransition';
import { AtmosphereSky } from './AtmosphereSky';
import { AtmosphereVeil } from './AtmosphereVeil';
import { CosmicBackdrop } from './CosmicBackdrop';
import { InteriorAtmosphere } from './InteriorAtmosphere';
import { DescentController, type JoystickVisual } from './DescentController';
import { GlobeSurface, type GlobeSurfaceHandle } from './GlobeSurface';
import { ResponsiveCamera } from './ResponsiveCamera';
import AethirionIsland from './AethirionIsland';
import Vegetation from './Vegetation';
import FeatureParticles from './FeatureParticles';
import TerrainProps from './TerrainProps';
import AscendariTower from './AscendariTower';
import HeartbloomTree from './HeartbloomTree';
import MendariTownscape from './MendariTownscape';
import ObsidianHollowStorm from './ObsidianHollowStorm';

const SPACE_AMB = new THREE.Color('#8aa0b0');
const INNER_AMB = new THREE.Color('#c8d8e8');

type GlobeSceneProps = {
	isMobile: boolean;
	interactionPaused: boolean;
	onZoomModeChange?: (mode: ZoomMode) => void;
	onAtmosphereBlendChange?: (blend: number) => void;
	onJoystickChange?: (joystick: JoystickVisual | null) => void;
	onPortalNear?: (wilayahId: string | null) => void;
	onEnterPortal?: (wilayahId: string) => void;
};

export function GlobeScene({
	isMobile,
	interactionPaused,
	onZoomModeChange,
	onAtmosphereBlendChange,
	onJoystickChange,
	onPortalNear,
	onEnterPortal,
}: GlobeSceneProps) {
	const groupRef = useRef<THREE.Group>(null);
	const globeRef = useRef<GlobeSurfaceHandle>(null);
	const controlsRef = useRef<OrbitControlsImpl>(null);
	const ambLightRef = useRef<THREE.AmbientLight>(null);
	const dirLightRef = useRef<THREE.DirectionalLight>(null);
	const [dragging, setDragging] = useState(false);
	const [descentActive, setDescentActive] = useState(false);
	const [descentAnchor, setDescentAnchor] = useState(() => new THREE.Vector3(0, 0.6, 0.8));
	const [showStars, setShowStars] = useState(true);
	const [showInterior, setShowInterior] = useState(false);
	const [veilIntensity, setVeilIntensity] = useState(0);
	const [globeProximity, setGlobeProximity] = useState(0);
	const [nearPortalId, setNearPortalId] = useState<string | null>(null);
	const groupRotationRef = useRef(0);
	const blockDescentEntry = useRef(false);
	const atmosphereBlend = useRef(0);
	const interiorBlend = useRef(0);
	const dayNight = useRef(0.7);
	const fogColor = useRef(new THREE.Color('#0a1420'));
	const ambColor = useRef(new THREE.Color('#8aa0b0'));
	const { camera, scene } = useThree();
	const segments = isMobile ? 48 : 64;

	const distance = camera.position.length();
	const zoomMode = getZoomMode(distance, descentActive);
	const orbitConfig = useMemo(() => getOrbitControlsForMode(zoomMode, isMobile), [zoomMode, isMobile]);

	useEffect(() => {
		onZoomModeChange?.(zoomMode);
	}, [onZoomModeChange, zoomMode]);

	const handlePortalNear = useCallback(
		(wilayahId: string | null) => {
			setNearPortalId(wilayahId);
			onPortalNear?.(wilayahId);
		},
		[onPortalNear],
	);

	const endDescentInstant = useCallback(() => {
		blockDescentEntry.current = true;
		setDescentActive(false);
		camera.lookAt(0, 0, 0);
		requestAnimationFrame(() => {
			const controls = controlsRef.current;
			if (!controls) return;
			controls.target.set(0, 0, 0);
			controls.update();
		});
	}, [camera]);

	useFrame((state, delta) => {
		const dist = camera.position.length();
		const targetBlend = getAtmosphereBlend(dist);
		atmosphereBlend.current = smoothDamp(atmosphereBlend.current, targetBlend, delta, 4.2);
		interiorBlend.current = getInteriorBlend(atmosphereBlend.current);
		dayNight.current = getDayFactor(state.clock.elapsedTime);

		onAtmosphereBlendChange?.(atmosphereBlend.current);

		const blend = atmosphereBlend.current;
		const starVis = getStarVisibility(blend);
		if (starVis < 0.03 && showStars) setShowStars(false);
		else if (starVis >= 0.03 && !showStars) setShowStars(true);

		const nextVeil = getExteriorVeilIntensity(blend);
		if (Math.abs(nextVeil - veilIntensity) > 0.006) setVeilIntensity(nextVeil);
		if (Math.abs(blend - globeProximity) > 0.012) setGlobeProximity(blend);
		const interior = getInteriorBlend(blend);
		if (interior > 0.06 && !showInterior) setShowInterior(true);
		else if (interior <= 0.04 && showInterior) setShowInterior(false);

		if (blockDescentEntry.current && dist > ZOOM_THRESHOLDS.atmosphereEnter + 0.05) {
			blockDescentEntry.current = false;
		}

		if (!descentActive && !interactionPaused && !blockDescentEntry.current) {
			if (dist <= ZOOM_THRESHOLDS.descentEnter) {
				setDescentAnchor(camera.position.clone().normalize());
				setDescentActive(true);
			}
		}

		if (groupRef.current) groupRotationRef.current = groupRef.current.rotation.y;

		const freezeGlobeSpin =
			dragging ||
			interactionPaused ||
			descentActive ||
			isMobile ||
			dist <= ZOOM_THRESHOLDS.atmosphereEnter;

		if (groupRef.current && !freezeGlobeSpin) {
			groupRef.current.rotation.y += delta * 0.035;
		}

		const fog = getFogRange(blend);
		const hemisphereY = camera.position.y / (camera.position.length() || 1);
		fogColor.current = getFogColor(blend, hemisphereY, dayNight.current);
		if (scene.fog instanceof THREE.Fog) {
			scene.fog.color.copy(fogColor.current);
			scene.fog.near = fog.near;
			scene.fog.far = fog.far;
		}

		// Cahaya permukaan diredupkan waktu malam (Stellar Drift dsb) tapi tidak
		// gelap gulita — hanya diguna dlm atmosfera (blend) supaya orbit/angkasa
		// tak terjejas. Void Tempest Noctira tetap dramatik krn skynya sendiri.
		const daylight = THREE.MathUtils.lerp(1, getDaylight(dayNight.current), blend);
		ambColor.current.copy(SPACE_AMB).lerp(INNER_AMB, blend);
		if (ambLightRef.current) {
			ambLightRef.current.intensity = THREE.MathUtils.lerp(0.38, 0.85, blend) * daylight;
			ambLightRef.current.color.copy(ambColor.current);
		}
		if (dirLightRef.current) {
			dirLightRef.current.intensity = THREE.MathUtils.lerp(0.85, 1.25, blend) * daylight;
		}

		if (camera instanceof THREE.PerspectiveCamera) {
			const targetFov = getCameraFov(blend, isMobile);
			camera.fov = smoothDamp(camera.fov, targetFov, delta, 3.5);
			camera.near = THREE.MathUtils.lerp(0.08, 0.015, interiorBlend.current);
			camera.updateProjectionMatrix();
		}
	});

	return (
		<>
			<fog attach="fog" args={[fogColor.current, 8, 24]} />
			<AtmosphereSky blendRef={atmosphereBlend} dayNightRef={dayNight} />
			<CosmicBackdrop atmosphereBlendRef={atmosphereBlend} dayNightRef={dayNight} />
			<ResponsiveCamera isMobile={isMobile} disabled={descentActive} />

			<ambientLight ref={ambLightRef} intensity={0.38} color="#8aa0b0" />
			<directionalLight ref={dirLightRef} position={[4, 6, 5]} intensity={0.85} color="#f0e6d0" />
			<pointLight position={[2, 4, 5]} intensity={0.45} color="#c4a86a" distance={14} />
			<pointLight position={[-3, -2, -4]} intensity={0.28} color="#6a5898" distance={14} />

			{/* Bintang kini sebahagian drpd nebula CosmicBackdrop (bukan lagi
			    drei <Stars> — bintang kotak besar itu bertindih hodoh dgn
			    nebula). CosmicBackdrop menyediakan bintang + nebula sekali. */}

			<group ref={groupRef} scale={isMobile ? 0.92 : 1}>
				<AtmosphereVeil intensity={veilIntensity} />

				<GlobeSurface
					ref={globeRef}
					segments={segments}
					proximityOverride={globeProximity}
				/>
				<Vegetation atmosphereBlendRef={atmosphereBlend} />
				<TerrainProps atmosphereBlendRef={atmosphereBlend} />
				<AscendariTower atmosphereBlendRef={atmosphereBlend} />
				<HeartbloomTree atmosphereBlendRef={atmosphereBlend} />
				<MendariTownscape
					atmosphereBlendRef={atmosphereBlend}
					enterEnabled={nearPortalId === 'mendari'}
					onEnter={() => onEnterPortal?.('mendari')}
				/>
				<ObsidianHollowStorm atmosphereBlendRef={atmosphereBlend} />
				<FeatureParticles atmosphereBlendRef={atmosphereBlend} />
			</group>

			<AethirionIsland atmosphereBlendRef={atmosphereBlend} />

			<DescentController
				active={descentActive}
				anchor={descentAnchor}
				interactionPaused={interactionPaused}
				isMobile={isMobile}
				groupRef={groupRef}
				onAnchorChange={setDescentAnchor}
				onJoystickChange={onJoystickChange}
				onPortalNear={handlePortalNear}
				onExitDescent={endDescentInstant}
				groupRotationRef={groupRotationRef}
			/>

			{showInterior ? (
				<InteriorAtmosphere interiorBlendRef={interiorBlend} isMobile={isMobile} />
			) : null}

			<OrbitControls
				ref={controlsRef}
				enabled={!interactionPaused && !isMobile && !descentActive}
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
				onEnd={() => {
					setDragging(false);
					blockDescentEntry.current = false;
				}}
			/>
		</>
	);
}
