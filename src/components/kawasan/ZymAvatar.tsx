import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VEILROSE_PALETTE } from './veilrosePalette';

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

export type ZymMotionState = {
	/** 0..1 keamatan gerakan semasa (magnitud joystick) — memacu kelajuan
	 * kitaran berjalan. */
	speed: number;
	/** 0..1 — 1 bila joystick melepasi ambang larian. */
	running: number;
	/** -1..1 — negatif = strafe kiri, positif = strafe kanan (animasi 8-arah ringkas). */
	strafe: number;
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

const CLOAK_WIDTH = 0.5;
const CLOAK_HEIGHT = 0.82;
const CLOAK_W_SEG = 8;
const CLOAK_H_SEG = 12;

/** Panel jubah melengkung — bukan prisma; simpan asas posisi untuk animasi kain. */
function buildCloakPanelGeometry(): THREE.BufferGeometry {
	const geo = new THREE.PlaneGeometry(CLOAK_WIDTH, CLOAK_HEIGHT, CLOAK_W_SEG, CLOAK_H_SEG);
	const pos = geo.attributes.position;
	const halfH = CLOAK_HEIGHT / 2;

	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const v = (y + halfH) / CLOAK_HEIGHT;
		const flare = (1 - v) * 0.38;
		const billow = Math.pow(1 - v, 2.1) * 0.48;
		const shoulderTuck = THREE.MathUtils.smoothstep(v, 0.72, 1) * 0.06;
		pos.setXYZ(
			i,
			x * (1 + flare),
			y + 0.34,
			billow + 0.1 - shoulderTuck,
		);
	}

	geo.userData.basePositions = Float32Array.from(pos.array);
	geo.computeVertexNormals();
	return geo;
}

function applyCloakSway(
	geometry: THREE.BufferGeometry,
	phase: number,
	speed: number,
	flying: number,
	strafe: number,
): void {
	const pos = geometry.attributes.position;
	const base = geometry.userData.basePositions as Float32Array | undefined;
	if (!base) return;

	const halfH = CLOAK_HEIGHT / 2;
	const swayAmp = (0.035 + speed * 0.05) * (1 - flying * 0.35);
	const flyLift = flying * 0.18;

	for (let i = 0; i < pos.count; i++) {
		const bx = base[i * 3];
		const by = base[i * 3 + 1];
		const bz = base[i * 3 + 2];
		const v = (by - 0.34 + halfH) / CLOAK_HEIGHT;
		const edgeWeight = Math.pow(THREE.MathUtils.clamp(1 - v, 0, 1), 1.6);
		const ripple = Math.sin(phase * 1.15 + bx * 9 + by * 4) * swayAmp * edgeWeight;
		const strafeBias = strafe * edgeWeight * 0.04;
		pos.setXYZ(i, bx, by, bz + ripple + flyLift * edgeWeight + strafeBias);
	}
	pos.needsUpdate = true;
	geometry.computeVertexNormals();
}

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

/** Jubah belakang + penanda dada — membezakan hadapan (-Z) dan belakang (+Z) watak. */
function DirectionalCues({
	glowColor,
	cloakOuterGeo,
	cloakInnerGeo,
}: {
	glowColor: string;
	cloakOuterGeo: THREE.BufferGeometry;
	cloakInnerGeo: THREE.BufferGeometry;
}) {
	const cloakMat = {
		color: VEILROSE_PALETTE.purple,
		emissive: VEILROSE_PALETTE.purple,
		emissiveIntensity: 0.32,
		roughness: 0.72,
		metalness: 0.02,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.88,
	} as const;

	return (
		<group name="direction-cues">
			{/* Penanda hadapan — terang di dada */}
			<mesh position={[0, 0.74, -0.19]} rotation={[0, 0, Math.PI / 4]}>
				<octahedronGeometry args={[0.08, 0]} />
				<meshStandardMaterial
					color={VEILROSE_PALETTE.cream}
					emissive={VEILROSE_PALETTE.cream}
					emissiveIntensity={1.05}
					roughness={0.28}
					flatShading
				/>
			</mesh>
			<mesh position={[0, 0.62, -0.17]}>
				<ringGeometry args={[0.05, 0.1, 16]} />
				<meshStandardMaterial
					color={glowColor}
					emissive={glowColor}
					emissiveIntensity={0.9}
					roughness={0.35}
					side={THREE.DoubleSide}
				/>
			</mesh>

			{/* Kolar lembut */}
			<mesh position={[0, 0.9, 0.1]} rotation={[0.55, 0, 0]}>
				<torusGeometry args={[0.2, 0.028, 8, 18, Math.PI * 1.05]} />
				<meshStandardMaterial
					color={VEILROSE_PALETTE.pink}
					emissive={VEILROSE_PALETTE.pink}
					emissiveIntensity={0.38}
					roughness={0.6}
				/>
			</mesh>

			{/* Jubah — dua lapisan kain melengkung */}
			<mesh geometry={cloakInnerGeo} position={[0, 0, 0.02]} scale={[0.93, 0.97, 1]}>
				<meshStandardMaterial {...cloakMat} color={VEILROSE_PALETTE.pink} emissive={VEILROSE_PALETTE.pink} opacity={0.55} />
			</mesh>
			<mesh geometry={cloakOuterGeo}>
				<meshStandardMaterial {...cloakMat} />
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
	const cloakRef = useRef<THREE.Group>(null);
	const cloakOuterGeo = useMemo(() => buildCloakPanelGeometry(), []);
	const cloakInnerGeo = useMemo(() => buildCloakPanelGeometry(), []);

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

		const { speed, running, strafe, flying, pitchInput } = motionRef.current;
		walkPhase.current +=
			delta * WALK_CYCLE_SPEED * (1 + running * 0.55) * Math.max(speed, flying > 0.5 ? 0.6 : 0);
		const legSwing = Math.sin(walkPhase.current) * MAX_LEG_SWING * (1 - flying) * Math.max(speed, 0.15);
		const armSwing = Math.sin(walkPhase.current + Math.PI) * MAX_ARM_SWING * (1 - flying) * Math.max(speed, 0.15);
		const strafeLean = running * strafe * 0.22;

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
			const dynamicLean = THREE.MathUtils.clamp(
				FLY_BASE_LEAN - pitchInput * FLY_DYNAMIC_TILT,
				-0.95,
				0.35,
			);
			rootRef.current.rotation.x = THREE.MathUtils.lerp(0, dynamicLean, flying);
			rootRef.current.rotation.z = THREE.MathUtils.lerp(strafeLean, 0, flying);
			const hover = Math.sin(bobPhase.current) * THREE.MathUtils.lerp(0.035, 0.09, flying);
			rootRef.current.position.y = hover;
		}
		if (cloakRef.current) {
			const sway = Math.sin(walkPhase.current) * 0.1 * Math.max(speed, 0.12);
			cloakRef.current.rotation.x = THREE.MathUtils.lerp(sway, -0.38 - pitchInput * 0.18, flying);
			cloakRef.current.rotation.z = strafe * 0.1 * (1 - flying);
			applyCloakSway(cloakOuterGeo, walkPhase.current, speed, flying, strafe);
			applyCloakSway(cloakInnerGeo, walkPhase.current + 0.6, speed, flying, strafe);
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
			<group ref={cloakRef}>
				<DirectionalCues glowColor={glowColor} cloakOuterGeo={cloakOuterGeo} cloakInnerGeo={cloakInnerGeo} />
			</group>
			<pointLight position={[0, 0.8, 0]} intensity={0.5} color={glowColor} distance={4} />
		</group>
	);
}
