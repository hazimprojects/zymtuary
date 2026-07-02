import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
	CORE_RADIUS,
	GLOBE_RADIUS,
	MOOD_SINGKAT,
	SURFACE_ZONES,
	type SpheralEntry,
} from './worldGlobeConfig';
import { GlobeCore } from './GlobeCore';
import { GlobeZone } from './GlobeZone';

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

	const byId = useMemo(() => Object.fromEntries(spherals.map((s) => [s.id, s])), [spherals]);

	useFrame((_, delta) => {
		if (!groupRef.current || dragging) return;
		groupRef.current.rotation.y += delta * 0.08;
	});

	return (
		<>
			<ambientLight intensity={0.15} />
			<pointLight position={[4, 6, 4]} intensity={0.6} color="#f5d78e" />
			<pointLight position={[-5, -3, -4]} intensity={0.35} color="#6b5a9a" />

			<Stars
				radius={80}
				depth={40}
				count={isMobile ? 1200 : 2500}
				factor={3}
				saturation={0}
				fade
				speed={0.4}
			/>

			<group ref={groupRef}>
				{/* Shell gelap — rupa organik */}
				<mesh>
					<sphereGeometry args={[GLOBE_RADIUS * 0.98, 48, 48]} />
					<meshStandardMaterial
						color="#0a0806"
						roughness={1}
						metalness={0}
						transparent
						opacity={0.92}
					/>
				</mesh>

				{/* Aura luar */}
				<mesh>
					<sphereGeometry args={[GLOBE_RADIUS * 1.08, 32, 32]} />
					<meshStandardMaterial
						color="#1a1510"
						emissive="#2a2218"
						emissiveIntensity={0.15}
						transparent
						opacity={0.12}
						side={THREE.BackSide}
						depthWrite={false}
					/>
				</mesh>

				{SURFACE_ZONES.map((zone) => {
					const spheral = byId[zone.id];
					if (!spheral) return null;

					return (
						<GlobeZone
							key={zone.id}
							id={zone.id}
							nama={spheral.nama}
							moodSingkat={MOOD_SINGKAT[zone.id] ?? ''}
							phiStart={zone.phiStart}
							phiLength={zone.phiLength}
							thetaStart={zone.thetaStart}
							thetaLength={zone.thetaLength}
							radius={GLOBE_RADIUS}
							lift={zone.lift}
							onHover={onHover}
							onSelect={onSelect}
							hoveredId={hoveredId}
						/>
					);
				})}

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
				enableZoom={!isMobile}
				minDistance={2.8}
				maxDistance={5.5}
				rotateSpeed={0.6}
				zoomSpeed={0.5}
				onStart={() => setDragging(true)}
				onEnd={() => setDragging(false)}
			/>
		</>
	);
}
