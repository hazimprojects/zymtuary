import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
	CORE_RADIUS,
	GLOBE_RADIUS,
	MOOD_SINGKAT,
	type SpheralEntry,
} from './worldGlobeConfig';
import { GlobeCore } from './GlobeCore';
import { GlobeSurface } from './GlobeSurface';
import { ResponsiveCamera } from './ResponsiveCamera';

type GlobeSceneProps = {
	spherals: SpheralEntry[];
	onHover: (id: string | null) => void;
	onSelect: (id: string) => void;
	hoveredId: string | null;
	isMobile: boolean;
};

export function GlobeScene({ spherals, onHover, onSelect, hoveredId, isMobile }: GlobeSceneProps) {
	const groupRef = useRef<THREE.Group>(null);
	const [dragging, setDragging] = useState(false);
	const segments = isMobile ? 36 : 48;

	const byId = useMemo(() => Object.fromEntries(spherals.map((s) => [s.id, s])), [spherals]);

	useFrame((_, delta) => {
		if (!groupRef.current || dragging) return;
		groupRef.current.rotation.y += delta * 0.06;
	});

	const controls = isMobile
		? { minDistance: 4.2, maxDistance: 10, zoomSpeed: 1.0, rotateSpeed: 0.5 }
		: { minDistance: 2.8, maxDistance: 6, zoomSpeed: 0.6, rotateSpeed: 0.6 };

	return (
		<>
			<ResponsiveCamera isMobile={isMobile} />

			<ambientLight intensity={0.2} />
			<pointLight position={[4, 6, 4]} intensity={0.55} color="#f5d78e" />
			<pointLight position={[-5, -3, -4]} intensity={0.3} color="#6b5a9a" />

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
				{/* Aura luar */}
				<mesh>
					<sphereGeometry args={[GLOBE_RADIUS * 1.12, 32, 32]} />
					<meshStandardMaterial
						color="#1a1510"
						emissive="#2a2218"
						emissiveIntensity={0.12}
						transparent
						opacity={0.1}
						side={THREE.BackSide}
						depthWrite={false}
					/>
				</mesh>

				<GlobeSurface
					onHover={onHover}
					onSelect={onSelect}
					hoveredId={hoveredId}
					segments={segments}
				/>

				{byId.primisera ? (
					<GlobeCore
						nama={byId.primisera.nama}
						moodSingkat={MOOD_SINGKAT.primisera}
						radius={CORE_RADIUS}
						onHover={onHover}
						onSelect={onSelect}
						hoveredId={hoveredId}
					/>
				) : null}
			</group>

			<OrbitControls
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
				onStart={() => setDragging(true)}
				onEnd={() => setDragging(false)}
			/>
		</>
	);
}
