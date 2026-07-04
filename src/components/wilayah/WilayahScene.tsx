import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { EntityData, WilayahData } from '../entities/SpheralExperience';
import { buildIslandGeometry, layoutMendariAnchors, type KawasanAnchor } from './wilayahTerrain';
import { KawasanMarker } from './KawasanMarker';

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function WilayahScene({
	wilayah,
	entities,
	isMobile,
	activeId,
	onSelect,
}: {
	wilayah: WilayahData;
	entities: EntityData[];
	isMobile: boolean;
	activeId: string | null;
	onSelect: (id: string | null) => void;
}) {
	const { camera, size } = useThree();
	const controlsRef = useRef<OrbitControlsImpl>(null);

	const anchors = useMemo(
		() => layoutMendariAnchors(entities.map((e) => ({ id: e.id, nama: e.nama, kawasan: e.kawasan }))),
		[entities],
	);

	const geometry = useMemo(() => buildIslandGeometry(anchors, wilayah.warna), [anchors, wilayah.warna]);

	/** Skrin sempit/potret ada FOV mendatar yang jauh lebih kecil daripada
	 * lanskap — tanpa tolak kamera lebih jauh, pulau kelihatan terlalu besar
	 * dan label kawasan terpotong di tepi skrin. */
	const overviewPos = useMemo(() => {
		const aspect = size.width / Math.max(size.height, 1);
		const portraitBoost = aspect < 1 ? THREE.MathUtils.clamp(1 / aspect, 1, 2.2) : 1;
		const base = (isMobile ? 9.6 : 9.8) * portraitBoost;
		return new THREE.Vector3(0, base, base);
	}, [isMobile, size.width, size.height]);
	const overviewTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);

	useEffect(() => {
		if (activeId) return;
		camera.position.copy(overviewPos);
		const controls = controlsRef.current;
		if (controls) {
			controls.target.copy(overviewTarget);
			controls.update();
		}
	}, [overviewPos, overviewTarget]);

	const flyProgress = useRef(1);
	const flyFromPos = useRef(new THREE.Vector3());
	const flyToPos = useRef(new THREE.Vector3());
	const flyFromTarget = useRef(new THREE.Vector3());
	const flyToTarget = useRef(new THREE.Vector3());
	const lastFocusId = useRef<string | null>(null);

	useFrame((_, delta) => {
		const controls = controlsRef.current;
		if (!controls) return;

		if (lastFocusId.current !== activeId) {
			lastFocusId.current = activeId;
			flyFromPos.current.copy(camera.position);
			flyFromTarget.current.copy(controls.target);

			const anchor = anchors.find((a) => a.id === activeId);
			if (anchor) {
				// Veilrose Quarter (jantung Mendari) duduk tepat di pusat (0,0,0) —
				// normalize() atas vektor sifar tak beri arah berguna, jadi guna
				// arah lalai bila kawasan itu sendiri ialah pusat.
				const dir = anchor.position.lengthSq() > 0.01 ? anchor.position.clone().normalize() : new THREE.Vector3(0, 0, 1);
				const closeDistance = 1.6 * anchor.scale + 1.1;
				flyToPos.current.copy(anchor.position).addScaledVector(dir, closeDistance).setY(1.4 * anchor.scale + 0.7);
				flyToTarget.current.set(anchor.position.x, 0.4 * anchor.scale, anchor.position.z);
			} else {
				flyToPos.current.copy(overviewPos);
				flyToTarget.current.copy(overviewTarget);
			}
			flyProgress.current = 0;
		}

		if (flyProgress.current < 1) {
			flyProgress.current = Math.min(1, flyProgress.current + delta * 0.9);
			const t = easeInOutCubic(flyProgress.current);
			camera.position.lerpVectors(flyFromPos.current, flyToPos.current, t);
			controls.target.lerpVectors(flyFromTarget.current, flyToTarget.current, t);
		}

		controls.autoRotate = !activeId && flyProgress.current >= 1;
		controls.update();
	});

	return (
		<>
			<fog attach="fog" args={[wilayah.warna, 6, 20]} />
			<hemisphereLight args={['#fbe2a8', '#5a3d2a', 0.85]} />
			<directionalLight position={[-4, 3.5, 2]} intensity={1.3} color="#ffd9a0" />
			<ambientLight intensity={0.25} color={wilayah.warna} />

			<mesh geometry={geometry} receiveShadow={false}>
				<meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.02} />
			</mesh>

			{anchors.map((anchor, index) => (
				<KawasanMarker
					key={anchor.id}
					anchor={anchor}
					active={anchor.id === activeId}
					bobOffset={index * 1.3}
					onSelect={() => onSelect(anchor.id === activeId ? null : anchor.id)}
				/>
			))}

			<OrbitControls
				ref={controlsRef}
				makeDefault
				target={overviewTarget}
				enablePan={false}
				minDistance={2.2}
				maxDistance={28}
				minPolarAngle={0.3}
				maxPolarAngle={1.1}
				autoRotateSpeed={0.35}
				enableDamping
				dampingFactor={0.08}
			/>
		</>
	);
}

export type { KawasanAnchor };
