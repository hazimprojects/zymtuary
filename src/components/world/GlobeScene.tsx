import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { layoutResonancePoints, type EntityEntry } from './worldGlobeConfig';
import { AtmosphereVeil } from './AtmosphereVeil';
import { GlobeSurface, type GlobeSurfaceHandle } from './GlobeSurface';
import { InnerGlow } from './InnerGlow';
import { ResponsiveCamera } from './ResponsiveCamera';

type GlobeSceneProps = {
	entities: EntityEntry[];
	onHover: (entity: EntityEntry | null) => void;
	onSelect: (entity: EntityEntry) => void;
	hoveredEntity: EntityEntry | null;
	isMobile: boolean;
	interactionPaused: boolean;
	whisperOpen: boolean;
};

export function GlobeScene({
	entities,
	onHover,
	onSelect,
	hoveredEntity,
	isMobile,
	interactionPaused,
	whisperOpen,
}: GlobeSceneProps) {
	const groupRef = useRef<THREE.Group>(null);
	const globeRef = useRef<GlobeSurfaceHandle>(null);
	const [dragging, setDragging] = useState(false);
	const segments = isMobile ? 36 : 48;

	const placements = useMemo(() => layoutResonancePoints(entities), [entities]);

	useFrame((_, delta) => {
		if (!groupRef.current || dragging || interactionPaused) return;
		groupRef.current.rotation.y += delta * 0.035;
	});

	const controls = isMobile
		? { minDistance: 4.5, maxDistance: 10, zoomSpeed: 1.0, rotateSpeed: 0.45 }
		: { minDistance: 3.2, maxDistance: 6.5, zoomSpeed: 0.6, rotateSpeed: 0.55 };

	return (
		<>
			<fog attach="fog" args={['#020408', 7, 20]} />
			<ResponsiveCamera isMobile={isMobile} />

			<ambientLight intensity={0.12} color="#6a8090" />
			<pointLight position={[2, 4, 5]} intensity={0.35} color="#c4a86a" distance={12} />
			<pointLight position={[-3, -2, -4]} intensity={0.2} color="#5c4a8a" distance={12} />

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
				<AtmosphereVeil />

				<GlobeSurface
					ref={globeRef}
					segments={segments}
					placements={placements}
					onHover={onHover}
					onSelect={onSelect}
					hoveredEntity={hoveredEntity}
					interactionPaused={interactionPaused}
				/>

				{placements.map((placement) => (
					<InnerGlow
						key={placement.entity.id}
						placement={placement}
						isHovered={hoveredEntity?.id === placement.entity.id}
						dimmed={whisperOpen}
					/>
				))}
			</group>

			<OrbitControls
				enabled={!interactionPaused}
				enablePan={false}
				enableZoom
				enableDamping
				dampingFactor={0.09}
				minDistance={controls.minDistance}
				maxDistance={controls.maxDistance}
				rotateSpeed={controls.rotateSpeed}
				zoomSpeed={controls.zoomSpeed}
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
