import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import {
	FAMILY_COLORS,
	GLOBE_RADIUS,
	PORTAL_ENTER_COS,
	PORTAL_ENTER_DISTANCE,
	WILAYAH_PORTALS,
	layoutResonancePoints,
	portalDirection,
	type EntityEntry,
} from './worldGlobeConfig';
import { buildGlobeGeometry } from './globeGeometry';

const mendariPortal = WILAYAH_PORTALS.mendari;
const mendariDir = new THREE.Vector3(...portalDirection(mendariPortal));
const mendariPos: [number, number, number] = [
	mendariDir.x * GLOBE_RADIUS,
	mendariDir.y * GLOBE_RADIUS,
	mendariDir.z * GLOBE_RADIUS,
];

/** Globe statik (tiada auto-putar) — pelawat orbit & zoom sendiri (drag +
 * scroll/pinch) untuk cari & mendekati portal Mendari. Statik sengaja
 * supaya semakan "adakah kamera menghala ke portal" (dot product) kekal
 * mudah & betul tanpa perlu jejak putaran tambahan. */
export function GlobeScene({
	entities,
	onPortalProximity,
}: {
	entities: EntityEntry[];
	onPortalProximity: (near: boolean) => void;
}) {
	const geometry = useMemo(() => buildGlobeGeometry(), []);
	const points = useMemo(() => layoutResonancePoints(entities), [entities]);
	const glowRef = useRef<THREE.Mesh>(null);
	const wasNear = useRef(false);
	const camDir = useRef(new THREE.Vector3());

	useFrame(({ clock, camera }) => {
		if (glowRef.current) {
			const mat = glowRef.current.material as THREE.MeshStandardMaterial;
			mat.emissiveIntensity = 0.7 + Math.sin(clock.getElapsedTime() * 1.6) * 0.25;
		}
		const dist = camera.position.length();
		camDir.current.copy(camera.position).normalize();
		const cosAngle = camDir.current.dot(mendariDir);
		const near = dist < PORTAL_ENTER_DISTANCE && cosAngle > PORTAL_ENTER_COS;
		if (near !== wasNear.current) {
			wasNear.current = near;
			onPortalProximity(near);
		}
	});

	return (
		<>
			<mesh geometry={geometry}>
				<meshStandardMaterial vertexColors flatShading roughness={0.75} metalness={0.05} />
			</mesh>

			{points.map((p) => {
				const color = FAMILY_COLORS[p.entity.keluarga_aetherys] ?? '#e8c96a';
				return (
					<mesh key={p.entity.id} position={p.position}>
						<icosahedronGeometry args={[0.035, 0]} />
						<meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} flatShading />
					</mesh>
				);
			})}

			{/* Portal Mendari — titik lebih besar & berdenyut, menandakan wilayah
			 * yang sudah ada scene sendiri untuk dimasuki */}
			<mesh ref={glowRef} position={mendariPos}>
				<icosahedronGeometry args={[0.075, 0]} />
				<meshStandardMaterial color="#fff6e8" emissive="#fff6e8" emissiveIntensity={0.8} flatShading />
			</mesh>
			<pointLight position={mendariPos} intensity={0.5} color="#fff6e8" distance={1.5} />

			<hemisphereLight args={['#fbe2a8', '#241830', 0.9]} />
			<directionalLight position={[3, 2, 4]} intensity={1.1} color="#ffe4b0" />

			<OrbitControls
				enablePan={false}
				minDistance={GLOBE_RADIUS + 0.5}
				maxDistance={7}
				zoomSpeed={0.8}
				rotateSpeed={0.5}
			/>
		</>
	);
}
