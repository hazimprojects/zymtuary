import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { SpotUtama } from '../world/worldGlobeConfig';
import { buildIslandGeometry } from '../wilayah/wilayahTerrain';
import { layoutVeilroseAnchors, AMBIENT_ROSE_STALLS } from './veilroseQuarterLayout';
import { SpotMarker } from './SpotMarker';
import { RoseStallProp } from './veilroseLandmarks';

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const BASE_GROUND_COLOR = '#e8c96a';

export function VeilroseQuarterScene({
	spots,
	isMobile,
	activeId,
	onSelect,
}: {
	spots: SpotUtama[];
	isMobile: boolean;
	activeId: string | null;
	onSelect: (id: string | null) => void;
}) {
	const { camera, size } = useThree();
	const controlsRef = useRef<OrbitControlsImpl>(null);

	const anchors = useMemo(() => layoutVeilroseAnchors(spots), [spots]);
	const geometry = useMemo(() => buildIslandGeometry(anchors, BASE_GROUND_COLOR), [anchors]);

	const overviewPos = useMemo(() => {
		const aspect = size.width / Math.max(size.height, 1);
		const portraitBoost = aspect < 1 ? THREE.MathUtils.clamp(1 / aspect, 1, 2.2) : 1;
		const base = (isMobile ? 12.2 : 12.6) * portraitBoost;
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
	}, [overviewPos, overviewTarget, activeId, camera]);

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
				const dir = anchor.position.lengthSq() > 0.01 ? anchor.position.clone().normalize() : new THREE.Vector3(0, 0, 1);
				const closeDistance = 2.2 * anchor.scale + 1.3;
				flyToPos.current.copy(anchor.position).addScaledVector(dir, closeDistance).setY(1.9 * anchor.scale + 0.9);
				flyToTarget.current.set(anchor.position.x, 0.6 * anchor.scale, anchor.position.z);
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
			<fog attach="fog" args={[BASE_GROUND_COLOR, 7, 24]} />
			<hemisphereLight args={['#fbe2a8', '#5a3d2a', 0.85]} />
			<directionalLight position={[-4, 3.5, 2]} intensity={1.3} color="#ffd9a0" />
			<ambientLight intensity={0.25} color={BASE_GROUND_COLOR} />

			<mesh geometry={geometry} receiveShadow={false}>
				<meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.02} />
			</mesh>

			{AMBIENT_ROSE_STALLS.map((stall, i) => (
				<group key={i} position={[stall.x, 0.18, stall.z]} rotation={[0, stall.rot, 0]}>
					<RoseStallProp scale={stall.scale} />
				</group>
			))}

			{anchors.map((anchor, index) => (
				<SpotMarker
					key={anchor.id}
					anchor={anchor}
					active={anchor.id === activeId}
					bobOffset={index * 1.4}
					onSelect={() => onSelect(anchor.id === activeId ? null : anchor.id)}
				/>
			))}

			<OrbitControls
				ref={controlsRef}
				makeDefault
				target={overviewTarget}
				enablePan={false}
				minDistance={2.6}
				maxDistance={30}
				minPolarAngle={0.3}
				maxPolarAngle={1.1}
				autoRotateSpeed={0.3}
				enableDamping
				dampingFactor={0.08}
			/>
		</>
	);
}
