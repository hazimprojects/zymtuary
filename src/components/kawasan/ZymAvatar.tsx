import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

export type ZymMotionState = {
	/** 0..1 keamatan gerakan semasa (magnitud joystick) — memacu kelajuan
	 * kitaran berjalan. */
	speed: number;
	/** 0..1 — 1 bila joystick melepasi ambang larian. */
	running: number;
	/** 0..1 peralihan lembut antara pose berjalan (0) dan pose terbang (1). */
	flying: number;
	/** -1..1 — positif bila menolak ke depan, negatif bila menarik ke
	 * belakang. Memacu condongan badan semasa terbang supaya terasa macam
	 * fizik penerbangan sebenar, bukan sekadar terapung statik. */
	pitchInput: number;
};

const WALK_CYCLE_SPEED = 7.5;
const MAX_LEG_SWING = 0.62;
const MAX_ARM_SWING = 0.5;
const FLY_LEG_TRAIL = 0.34;
const FLY_ARM_SPREAD = 1.15;
const FLY_BASE_LEAN = -0.32;
const FLY_DYNAMIC_TILT = 0.5;

function Limb({
	pivot,
	length,
	radiusTop,
	radiusBottom,
	color,
}: {
	pivot: [number, number, number];
	length: number;
	radiusTop: number;
	radiusBottom: number;
	color: string;
}) {
	return (
		<group position={pivot} name="limb-pivot">
			<mesh position={[0, -length / 2, 0]}>
				<cylinderGeometry args={[radiusTop, radiusBottom, length, 6]} />
				<meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.45} flatShading />
			</mesh>
		</group>
	);
}

/**
 * Avatar Zym-kesedaran — siluet humanoid neutral bercahaya tanpa wajah/ciri
 * peribadi (Garden Keeper panggil SETIAP pelawat "Zym", jadi avatar mesti
 * boleh jadi "sesiapa saja"). Boleh berjalan (kaki berayun ikut kitaran) dan
 * terbang (lengan terbentang macam sayap, kaki menghala ke belakang). Muncul
 * dengan animasi "jatuh dengan lembut daripada cahaya menjadi bentuk penuh".
 */
export function ZymAvatar({
	glowColor,
	motionRef,
}: {
	glowColor: string;
	motionRef: RefObject<ZymMotionState>;
}) {
	const rootRef = useRef<THREE.Group>(null);
	const headMatRef = useRef<THREE.MeshStandardMaterial>(null);
	const torsoMatRef = useRef<THREE.MeshStandardMaterial>(null);
	const leftLegRef = useRef<THREE.Group>(null);
	const rightLegRef = useRef<THREE.Group>(null);
	const leftArmRef = useRef<THREE.Group>(null);
	const rightArmRef = useRef<THREE.Group>(null);

	const formProgress = useRef(0);
	const bobPhase = useRef(Math.random() * Math.PI * 2);
	const walkPhase = useRef(0);

	useFrame((_, delta) => {
		if (formProgress.current < 1) {
			formProgress.current = Math.min(1, formProgress.current + delta * 0.55);
		}
		const t = easeOutCubic(formProgress.current);

		if (rootRef.current) {
			rootRef.current.scale.setScalar(THREE.MathUtils.lerp(0.05, 1, t));
			bobPhase.current += delta * 1.1;
		}

		const { speed, running, flying, pitchInput } = motionRef.current;
		walkPhase.current +=
			delta * WALK_CYCLE_SPEED * (1 + running * 0.55) * Math.max(speed, flying > 0.5 ? 0.6 : 0);
		const legSwing = Math.sin(walkPhase.current) * MAX_LEG_SWING * (1 - flying) * Math.max(speed, 0.15);
		const armSwing = Math.sin(walkPhase.current + Math.PI) * MAX_ARM_SWING * (1 - flying) * Math.max(speed, 0.15);

		if (leftLegRef.current) {
			leftLegRef.current.rotation.x = THREE.MathUtils.lerp(legSwing, FLY_LEG_TRAIL, flying);
		}
		if (rightLegRef.current) {
			rightLegRef.current.rotation.x = THREE.MathUtils.lerp(-legSwing, FLY_LEG_TRAIL, flying);
		}
		if (leftArmRef.current) {
			leftArmRef.current.rotation.x = THREE.MathUtils.lerp(armSwing, 0, flying);
			leftArmRef.current.rotation.z = THREE.MathUtils.lerp(0.08, FLY_ARM_SPREAD, flying);
		}
		if (rightArmRef.current) {
			rightArmRef.current.rotation.x = THREE.MathUtils.lerp(-armSwing, 0, flying);
			rightArmRef.current.rotation.z = THREE.MathUtils.lerp(-0.08, -FLY_ARM_SPREAD, flying);
		}
		if (rootRef.current) {
			// Condongan semasa terbang ikut arah tolak — menolak ke depan
			// (pitchInput positif) menambah condong ke depan (menukik), menarik
			// ke belakang (negatif) mengurangkan/menyongsangkannya (mendaki) —
			// bukan sekadar condongan tetap seolah-olah terapung statik.
			const dynamicLean = THREE.MathUtils.clamp(
				FLY_BASE_LEAN - pitchInput * FLY_DYNAMIC_TILT,
				-0.95,
				0.35,
			);
			rootRef.current.rotation.x = THREE.MathUtils.lerp(0, dynamicLean, flying);
			const hover = Math.sin(bobPhase.current) * THREE.MathUtils.lerp(0.035, 0.09, flying);
			rootRef.current.position.y = hover;
		}

		const restingIntensity = 0.55;
		const entryIntensity = 2.6;
		const intensity = THREE.MathUtils.lerp(entryIntensity, restingIntensity, t) + flying * 0.25;
		if (torsoMatRef.current) torsoMatRef.current.emissiveIntensity = intensity;
		if (headMatRef.current) headMatRef.current.emissiveIntensity = intensity * 1.15;
	});

	return (
		<group ref={rootRef}>
			{/* Torso */}
			<mesh position={[0, 0.72, 0]}>
				<capsuleGeometry args={[0.17, 0.42, 3, 6]} />
				<meshStandardMaterial
					ref={torsoMatRef}
					color={glowColor}
					emissive={glowColor}
					emissiveIntensity={0.55}
					roughness={0.4}
					flatShading
				/>
			</mesh>
			{/* Kepala — bulat sengaja tanpa wajah */}
			<mesh position={[0, 1.14, 0]}>
				<sphereGeometry args={[0.15, 8, 7]} />
				<meshStandardMaterial
					ref={headMatRef}
					color={glowColor}
					emissive={glowColor}
					emissiveIntensity={0.65}
					roughness={0.35}
					flatShading
				/>
			</mesh>
			{/* Lengan */}
			<group ref={leftArmRef} position={[0.22, 0.92, 0]}>
				<Limb pivot={[0, 0, 0]} length={0.44} radiusTop={0.055} radiusBottom={0.045} color={glowColor} />
			</group>
			<group ref={rightArmRef} position={[-0.22, 0.92, 0]}>
				<Limb pivot={[0, 0, 0]} length={0.44} radiusTop={0.055} radiusBottom={0.045} color={glowColor} />
			</group>
			{/* Kaki */}
			<group ref={leftLegRef} position={[0.09, 0.52, 0]}>
				<Limb pivot={[0, 0, 0]} length={0.5} radiusTop={0.07} radiusBottom={0.055} color={glowColor} />
			</group>
			<group ref={rightLegRef} position={[-0.09, 0.52, 0]}>
				<Limb pivot={[0, 0, 0]} length={0.5} radiusTop={0.07} radiusBottom={0.055} color={glowColor} />
			</group>
			<pointLight position={[0, 0.8, 0]} intensity={0.5} color={glowColor} distance={4} />
		</group>
	);
}
