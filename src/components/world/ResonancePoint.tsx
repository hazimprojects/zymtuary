import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { FAMILY_COLORS, type EntityEntry } from './worldGlobeConfig';

type ResonancePointProps = {
	entity: EntityEntry;
	position: [number, number, number];
	onHover: (entity: EntityEntry | null) => void;
	onSelect: (entity: EntityEntry) => void;
	isHovered: boolean;
	isMobile: boolean;
	dimmed: boolean;
};

const _worldPos = new THREE.Vector3();
const _center = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _toCamera = new THREE.Vector3();

export function ResonancePoint({
	entity,
	position,
	onHover,
	onSelect,
	isHovered,
	isMobile,
	dimmed,
}: ResonancePointProps) {
	const groupRef = useRef<THREE.Group>(null);
	const meshRef = useRef<THREE.Mesh>(null);
	const haloRef = useRef<THREE.Mesh>(null);
	const htmlRef = useRef<HTMLDivElement>(null);

	const color = FAMILY_COLORS[entity.keluarga_aetherys] ?? '#c9a96e';
	const isDormant = entity.keadaan === 'Dormant';
	const active = isHovered && !dimmed;
	const visualSize = isMobile ? 0.05 : 0.042;
	const touchSize = isMobile ? 56 : 44;

	useFrame(({ camera, clock }) => {
		if (!groupRef.current || !meshRef.current || !haloRef.current) return;

		groupRef.current.getWorldPosition(_worldPos);
		groupRef.current.parent?.getWorldPosition(_center);

		_normal.copy(_worldPos).sub(_center).normalize();
		_toCamera.copy(camera.position).sub(_worldPos).normalize();
		const isFacing = _normal.dot(_toCamera) > 0.08;
		const show = isFacing && !dimmed;

		meshRef.current.visible = show;
		haloRef.current.visible = show;

		if (htmlRef.current) {
			htmlRef.current.style.opacity = show ? '1' : '0';
			htmlRef.current.style.pointerEvents = show ? 'auto' : 'none';
		}

		if (!show) return;

		const pulse = 1 + Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.12;
		const scale = (active ? 1.35 : pulse) * (isDormant ? 0.8 : 1);
		meshRef.current.scale.setScalar(scale);
		haloRef.current.scale.setScalar(scale * (active ? 2.4 : 2));

		const mat = meshRef.current.material as THREE.MeshStandardMaterial;
		mat.emissiveIntensity = active ? 1.5 : isDormant ? 0.35 : 0.65;
	});

	const handleTap = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		e.stopPropagation();
		onSelect(entity);
	};

	return (
		<group ref={groupRef} position={position}>
			<mesh ref={meshRef} raycast={() => null} renderOrder={2}>
				<sphereGeometry args={[visualSize, 10, 10]} />
				<meshStandardMaterial
					color={color}
					emissive={color}
					emissiveIntensity={0.6}
					depthWrite
					depthTest
				/>
			</mesh>

			<mesh ref={haloRef} raycast={() => null} renderOrder={2}>
				<sphereGeometry args={[visualSize, 8, 8]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.1}
					depthWrite={false}
					depthTest
				/>
			</mesh>

			<Html
				center
				distanceFactor={isMobile ? 14 : 11}
				zIndexRange={[200, 100]}
				style={{ pointerEvents: 'none' }}
			>
				<div ref={htmlRef} style={{ pointerEvents: 'none' }}>
					<button
						type="button"
						className="relative flex items-center justify-center border-0 bg-transparent p-0 outline-none"
						style={{
							pointerEvents: 'auto',
							width: touchSize,
							height: touchSize,
							touchAction: 'manipulation',
							WebkitTapHighlightColor: 'transparent',
						}}
						aria-label={`${entity.nama} — ${entity.gelaran}`}
						onMouseEnter={() => onHover(entity)}
						onMouseLeave={() => onHover(null)}
						onClick={handleTap}
					>
						<span
							aria-hidden
							className="block rounded-full transition-transform duration-500"
							style={{
								width: active ? 10 : 8,
								height: active ? 10 : 8,
								background: `radial-gradient(circle, ${color}ee, ${color}88)`,
								boxShadow: active
									? `0 0 20px ${color}aa, 0 0 40px ${color}44`
									: `0 0 12px ${color}66, 0 0 24px ${color}33`,
								opacity: isDormant ? 0.55 : 1,
							}}
						/>
					</button>
				</div>
			</Html>
		</group>
	);
}
