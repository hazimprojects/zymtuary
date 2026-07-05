import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type ObsidianHollowStormProps = {
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);
// MESTI sepadan dgn heightScale 'obsidian-hollow' (4.2) di worldGlobeConfig.ts
// — awan gelap terapung di atas puncak yg dinaikkan drastik, bukan pada
// GLOBE_RADIUS asas.
const PEAK_BUMP = 0.1 * 4.2;

type Puff = { offset: THREE.Vector3; phase: number };

function buildPuffs(): Puff[] {
	const rng = seededRng(9911);
	return Array.from({ length: 32 }, () => {
		const angle = rng() * Math.PI * 2;
		const r = rng() * 0.14;
		const offset = new THREE.Vector3(Math.cos(angle) * r, 0.16 + rng() * 0.07, Math.sin(angle) * r);
		return { offset, phase: rng() };
	});
}

/** Bolt kilat zigzag — segmen silinder nipis bersambung dijana SEKALI
 * (bentuk statik); hanya keterlihatannya yang berdenyut (useFrame), bukan
 * bentuknya, supaya murah dari segi prestasi. */
function buildBoltGeometry(): THREE.BufferGeometry {
	const rng = seededRng(4471);
	const points: THREE.Vector3[] = [new THREE.Vector3(0, 0.18, 0)];
	const steps = 5;
	for (let i = 0; i < steps; i++) {
		const cur = points[points.length - 1];
		points.push(new THREE.Vector3(cur.x + (rng() - 0.5) * 0.04, cur.y - 0.18 / steps, cur.z + (rng() - 0.5) * 0.04));
	}

	const segments: THREE.BufferGeometry[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		const dir = b.clone().sub(a);
		const len = dir.length();
		const geo = new THREE.CylinderGeometry(0.0028, 0.0042, len, 4);
		geo.translate(0, len / 2, 0);
		geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
		geo.translate(a.x, a.y, a.z);
		segments.push(geo);
	}
	const merged = mergeBufferGeometries(segments, false) ?? segments[0];
	for (const s of segments) s.dispose();
	return merged;
}

// Jadual kilat DITENTUKAN oleh masa berlalu sahaja (bukan mesin keadaan
// mutable) — elak sebarang risiko "tersekat" dalam satu keadaan (cth. kekal
// menyala macam tongkat statik). Sesuatu masa sentiasa sama ada terang atau
// gelap, dikira semula setiap bingkai drpd clock.elapsedTime % CYCLE.
const CYCLE = 8;
const FLASH_WINDOWS: [number, number][] = [
	[0, 0.06],
	[0.12, 0.17],
	[0.24, 0.32],
];

function isBoltVisible(elapsed: number): boolean {
	const t = elapsed % CYCLE;
	for (const [start, end] of FLASH_WINDOWS) {
		if (t >= start && t < end) return true;
	}
	return false;
}

/**
 * Ribut di puncak Obsidian Hollow — kepulan awan gelap terapung (teknik
 * sprite sama dgn TerrainProps) + kilat zigzag yang sabung-menyabung
 * sekali sekala (kluster denyar pantas setiap ~8 saat, bukan menyala
 * berterusan), gema "berawan gelap dan petir" utk puncak gunung PALING
 * TINGGI di Noctira.
 */
export default function ObsidianHollowStorm({ atmosphereBlendRef }: ObsidianHollowStormProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('obsidian-hollow')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const cloudCenter = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + PEAK_BUMP), [dir]);

	const texture = useMemo(() => buildSpriteTexture(), []);
	const puffs = useMemo(() => buildPuffs(), []);
	const positions = useMemo(() => new Float32Array(puffs.length * 3), [puffs.length]);
	const geomRef = useRef<THREE.BufferGeometry>(null);
	const cloudMatRef = useRef<THREE.PointsMaterial>(null);

	const boltGeo = useMemo(() => buildBoltGeometry(), []);
	const boltMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0 }), []);
	const boltLightRef = useRef<THREE.PointLight>(null);

	useFrame(({ clock }) => {
		for (let i = 0; i < puffs.length; i++) {
			const p = puffs[i];
			const bob = Math.sin(clock.elapsedTime * 0.2 + p.phase * Math.PI * 2) * 0.006;
			const world = p.offset.clone();
			world.y += bob;
			world.applyQuaternion(quaternion).add(cloudCenter);
			positions[i * 3] = world.x;
			positions[i * 3 + 1] = world.y;
			positions[i * 3 + 2] = world.z;
		}
		if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;

		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1) * 0.85;
		if (cloudMatRef.current) {
			cloudMatRef.current.opacity = THREE.MathUtils.lerp(cloudMatRef.current.opacity, target, 0.05);
			cloudMatRef.current.visible = cloudMatRef.current.opacity > 0.01;
		}

		const visible = target > 0.1 && isBoltVisible(clock.elapsedTime);
		boltMat.opacity = visible ? 1 : 0;
		boltMat.visible = visible;
		if (boltLightRef.current) boltLightRef.current.intensity = visible ? 3.5 : 0;
	});

	return (
		<group>
			<points>
				<bufferGeometry ref={geomRef}>
					<bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
				</bufferGeometry>
				<pointsMaterial
					ref={cloudMatRef}
					size={0.1}
					map={texture}
					color="#242429"
					transparent
					opacity={0}
					depthWrite={false}
					sizeAttenuation
					blending={THREE.NormalBlending}
				/>
			</points>
			<group position={cloudCenter} quaternion={quaternion}>
				<mesh geometry={boltGeo} material={boltMat} />
				<pointLight ref={boltLightRef} color="#cfe8ff" intensity={0} distance={0.6} position={[0, 0.09, 0]} />
			</group>
		</group>
	);
}
