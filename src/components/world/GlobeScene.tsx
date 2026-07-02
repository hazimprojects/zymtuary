import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { GLOBE_RADIUS, layoutResonancePoints, type EntityEntry } from './worldGlobeConfig';
import { GlobeSurface } from './GlobeSurface';
import { ResonancePoint } from './ResonancePoint';
import { ResponsiveCamera } from './ResponsiveCamera';

type GlobeSceneProps = {
	entities: EntityEntry[];
	onHover: (entity: EntityEntry | null) => void;
	onSelect: (entity: EntityEntry) => void;
	hoveredEntity: EntityEntry | null;
	isMobile: boolean;
	interactionPaused: boolean;
};

export function GlobeScene({
	entities,
	onHover,
	onSelect,
	hoveredEntity,
	isMobile,
	interactionPaused,
}: GlobeSceneProps) {
	const groupRef = useRef<THREE.Group>(null);
	const [dragging, setDragging] = useState(false);
	const segments = isMobile ? 36 : 48;

	const placements = useMemo(() => layoutResonancePoints(entities), [entities]);

	useFrame((_, delta) => {
		if (!groupRef.current || dragging || interactionPaused) return;
		groupRef.current.rotation.y += delta * 0.05;
	});

	const controls = isMobile
		? { minDistance: 4.2, maxDistance: 10, zoomSpeed: 1.0, rotateSpeed: 0.5 }
		: { minDistance: 2.8, maxDistance: 6, zoomSpeed: 0.6, rotateSpeed: 0.6 };

	return (
		<>
			<ResponsiveCamera isMobile={isMobile} />

			<ambientLight intensity={0.22} />
			<pointLight position={[3, 5, 4]} intensity={0.5} color="#f5d78e" />
			<pointLight position={[-4, -4, -3]} intensity={0.35} color="#6b5a9a" />

			<Stars
				radius={80}
				depth={40}
				count={isMobile ? 900 : 2200}
				factor={2.5}
				saturation={0}
				fade
				speed={0.3}
			/>

			<group ref={groupRef} scale={isMobile ? 0.92 : 1}>
				{/* Aura Equilara */}
				<mesh>
					<sphereGeometry args={[GLOBE_RADIUS * 1.14, 32, 32]} />
					<meshStandardMaterial
						color="#1a1510"
						emissive="#2a2218"
						emissiveIntensity={0.1}
						transparent
						opacity={0.08}
						side={THREE.BackSide}
						depthWrite={false}
					/>
				</mesh>

				<GlobeSurface segments={segments} />

				{placements.map(({ entity, position }) => (
					<ResonancePoint
						key={entity.id}
						entity={entity}
						position={position}
						onHover={onHover}
						onSelect={onSelect}
						isHovered={hoveredEntity?.id === entity.id}
						isMobile={isMobile}
					/>
				))}
			</group>

			<OrbitControls
				enabled={!interactionPaused}
				enablePan={false}
				enableZoom
				enableDamping
				dampingFactor={0.08}
				minDistance={controls.minDistance}
				maxDistance={controls.maxDistance}
				rotateSpeed={controls.rotateSpeed}
				zoomSpeed={controls.zoomSpeed}
				touches={{
					ONE: THREE.TOUCH.ROTATE,
					TWO: THREE.TOUCH.DOLLY_ROTATE,
				}}
				mouseButtons={{
					LEFT: THREE.MOUSE.ROTATE,
					MIDDLE: THREE.MOUSE.DOLLY,
					RIGHT: THREE.MOUSE.ROTATE,
				}}
				onStart={() => setDragging(true)}
				onEnd={() => setDragging(false)}
			/>
		</>
	);
}
