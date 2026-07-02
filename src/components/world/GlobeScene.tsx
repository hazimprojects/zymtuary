import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
	getOrbitControlsForMode,
	getProximity,
	getZoomMode,
	layoutResonancePoints,
	type EntityEntry,
	type ZoomMode,
} from './worldGlobeConfig';
import { AtmosphereVeil } from './AtmosphereVeil';
import { GlobeSurface, type GlobeSurfaceHandle } from './GlobeSurface';
import { ResponsiveCamera } from './ResponsiveCamera';

type GlobeSceneProps = {
	entities: EntityEntry[];
	onHover: (entity: EntityEntry | null) => void;
	onSelect: (entity: EntityEntry) => void;
	hoveredEntity: EntityEntry | null;
	isMobile: boolean;
	interactionPaused: boolean;
	onZoomModeChange?: (mode: ZoomMode) => void;
};

export function GlobeScene({
	entities,
	onHover,
	onSelect,
	hoveredEntity,
	isMobile,
	interactionPaused,
	onZoomModeChange,
}: GlobeSceneProps) {
	const groupRef = useRef<THREE.Group>(null);
	const globeRef = useRef<GlobeSurfaceHandle>(null);
	const controlsRef = useRef<OrbitControlsImpl>(null);
	const [dragging, setDragging] = useState(false);
	const [zoomMode, setZoomMode] = useState<ZoomMode>('orbit');
	const [atmosphereIntensity, setAtmosphereIntensity] = useState(0.03);
	const { camera } = useThree();
	const segments = isMobile ? 40 : 56;

	const placements = useMemo(() => layoutResonancePoints(entities), [entities]);
	const orbitConfig = useMemo(() => getOrbitControlsForMode(zoomMode, isMobile), [zoomMode, isMobile]);

	useEffect(() => {
		onZoomModeChange?.(zoomMode);
	}, [onZoomModeChange, zoomMode]);

	useFrame((_, delta) => {
		const distance = camera.position.length();
		const nextMode = getZoomMode(distance);
		if (nextMode !== zoomMode) setZoomMode(nextMode);

		const proximity = getProximity(distance);
		setAtmosphereIntensity(0.03 + proximity * 0.12);

		if (!groupRef.current || dragging || interactionPaused) return;
		if (nextMode !== 'orbit') return;
		groupRef.current.rotation.y += delta * 0.035;
	});

	useFrame(() => {
		if (!(camera instanceof THREE.PerspectiveCamera)) return;
		const near = zoomMode === 'surface' ? 0.02 : 0.08;
		if (Math.abs(camera.near - near) > 0.001) {
			camera.near = near;
			camera.updateProjectionMatrix();
		}
	});

	const fogNear = zoomMode === 'surface' ? 2.5 : zoomMode === 'atmosphere' ? 4.5 : 8;
	const fogFar = zoomMode === 'surface' ? 20 : 22;

	return (
		<>
			<fog attach="fog" args={['#0a1420', fogNear, fogFar]} />
			<ResponsiveCamera isMobile={isMobile} />

			<ambientLight intensity={0.38} color="#8aa0b0" />
			<directionalLight position={[4, 6, 5]} intensity={0.85} color="#f0e6d0" />
			<pointLight position={[2, 4, 5]} intensity={0.45} color="#c4a86a" distance={14} />
			<pointLight position={[-3, -2, -4]} intensity={0.28} color="#6a5898" distance={14} />

			<Stars
				radius={90}
				depth={50}
				count={isMobile ? 600 : 1400}
				factor={2}
				saturation={0}
				fade
				speed={0.15}
			/>

			<group ref={groupRef} scale={isMobile ? 0.92 : 1}>
				<AtmosphereVeil intensity={atmosphereIntensity} />

				<GlobeSurface
					ref={globeRef}
					segments={segments}
					placements={placements}
					onHover={onHover}
					onSelect={onSelect}
					hoveredEntity={hoveredEntity}
					interactionPaused={interactionPaused}
				/>
			</group>

			<OrbitControls
				ref={controlsRef}
				enabled={!interactionPaused}
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
