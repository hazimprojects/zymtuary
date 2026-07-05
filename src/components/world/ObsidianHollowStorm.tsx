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
// MESTI sepadan dgn heightScale 'obsidian-hollow' (6) di worldGlobeConfig.ts
// — kluster awan berpusat di altitud puncak, bukan pada GLOBE_RADIUS asas.
const PEAK_BUMP = 0.1 * 6;

type Puff = { offset: THREE.Vector3; phase: number };
type CloudClump = { center: THREE.Vector3; puffs: Puff[] };

/** Beberapa KELOMPOK awan berasingan mengelilingi puncak (sama teknik dgn
 * kelompok awan gunung/pokok dlm TerrainProps.tsx) — bukan satu gegelang
 * berterusan. Lebih banyak kelompok drpd rujukan awan biasa sebab puncak
 * PALING TINGGI di Noctira patut kelihatan paling berawan/ribut. */
function buildCloudClumps(): CloudClump[] {
	const rng = seededRng(9911);
	const clumpCount = 9;
	const clumps: CloudClump[] = [];
	for (let c = 0; c < clumpCount; c++) {
		const angle = rng() * Math.PI * 2;
		const r = 0.14 + rng() * 0.3;
		const y = -0.05 + rng() * 0.11;
		const center = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
		const puffCount = 5 + Math.floor(rng() * 6);
		const puffs: Puff[] = [];
		for (let i = 0; i < puffCount; i++) {
			const pr = rng() * 0.06;
			const pAngle = rng() * Math.PI * 2;
			const offset = new THREE.Vector3(
				center.x + Math.cos(pAngle) * pr,
				center.y + (rng() - 0.5) * 0.04,
				center.z + Math.sin(pAngle) * pr,
			);
			puffs.push({ offset, phase: rng() });
		}
		clumps.push({ center, puffs });
	}
	return clumps;
}

/** Bolt kilat zigzag DGN cabang sisi (1-2 dahan pendek bercabang dari titik
 * rawak sepanjang bolt utama) — kilat sebenar jarang naik lurus tanpa
 * cabang. Segmen silinder nipis bersambung dijana SEKALI per varian
 * (bentuk statik); hanya keterlihatan/kedudukan yang berdenyut (useFrame). */
function buildBoltGeometry(seed: number): THREE.BufferGeometry {
	const rng = seededRng(seed);
	const points: THREE.Vector3[] = [new THREE.Vector3(0, 0.18, 0)];
	const steps = 5 + Math.floor(rng() * 2);
	for (let i = 0; i < steps; i++) {
		const cur = points[points.length - 1];
		points.push(new THREE.Vector3(cur.x + (rng() - 0.5) * 0.045, cur.y - 0.19 / steps, cur.z + (rng() - 0.5) * 0.045));
	}

	const segments: THREE.BufferGeometry[] = [];
	const addSegment = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) => {
		const dir = b.clone().sub(a);
		const len = dir.length();
		if (len < 1e-5) return;
		const geo = new THREE.CylinderGeometry(r0, r1, len, 4);
		geo.translate(0, len / 2, 0);
		geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
		geo.translate(a.x, a.y, a.z);
		segments.push(geo);
	};

	for (let i = 0; i < points.length - 1; i++) addSegment(points[i], points[i + 1], 0.0028, 0.0042);

	const branchCount = 1 + Math.floor(rng() * 2);
	for (let b = 0; b < branchCount; b++) {
		const startIdx = 1 + Math.floor(rng() * (points.length - 2));
		let cur = points[startIdx].clone();
		const branchSteps = 2 + Math.floor(rng() * 2);
		for (let i = 0; i < branchSteps; i++) {
			const next = new THREE.Vector3(
				cur.x + (rng() - 0.5) * 0.05,
				cur.y - 0.045 - rng() * 0.03,
				cur.z + (rng() - 0.5) * 0.05,
			);
			addSegment(cur, next, 0.0016, 0.0026);
			cur = next;
		}
	}

	const merged = mergeBufferGeometries(segments, false) ?? segments[0];
	for (const s of segments) s.dispose();
	return merged;
}

const BOLT_VARIANT_COUNT = 4;
// Garis masa kilat DITENTUKAN oleh masa berlalu sahaja (bukan mesin keadaan
// mutable) — elak sebarang risiko "tersekat" dlm satu keadaan. Dijana SEKALI
// (seeded) merangkumi julat masa TIMELINE, kemudian berulang — kekerapan &
// bentuk bervariasi (kadang tunggal, kadang beberapa denyar pantas
// berturutan/"kluster kilat", jarak antara kluster juga rawak).
const TIMELINE = 42;

type FlashEvent = { start: number; end: number; boltIndex: number; clumpIndex: number };

function buildFlashTimeline(clumpCount: number): FlashEvent[] {
	const rng = seededRng(7731);
	const events: FlashEvent[] = [];
	let t = rng() * 2;
	while (t < TIMELINE) {
		const burstSize = rng() < 0.4 ? 2 + Math.floor(rng() * 2) : 1;
		for (let i = 0; i < burstSize && t < TIMELINE; i++) {
			const dur = 0.05 + rng() * 0.1;
			events.push({
				start: t,
				end: t + dur,
				boltIndex: Math.floor(rng() * BOLT_VARIANT_COUNT),
				clumpIndex: Math.floor(rng() * clumpCount),
			});
			t += dur + 0.05 + rng() * 0.14;
		}
		t += 1.4 + rng() * 4.8;
	}
	return events;
}

function activeFlash(elapsed: number, timeline: FlashEvent[]): FlashEvent | null {
	const t = elapsed % TIMELINE;
	for (const e of timeline) {
		if (t >= e.start && t < e.end) return e;
	}
	return null;
}

/**
 * Ribut di puncak Obsidian Hollow — beberapa KELOMPOK awan gelap terapung
 * berasingan (bukan satu gegelang/lapisan penuh, sama teknik dgn kelompok
 * awan gunung/pokok) + kilat zigzag BERCABANG dgn bentuk & kekerapan
 * bervariasi (kadang tunggal, kadang beberapa denyar pantas berturutan,
 * dari kelompok awan berlainan), gema "berawan gelap dan petir" utk puncak
 * gunung PALING TINGGI di Noctira.
 */
export default function ObsidianHollowStorm({ atmosphereBlendRef }: ObsidianHollowStormProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('obsidian-hollow')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const cloudCenter = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + PEAK_BUMP), [dir]);

	const texture = useMemo(() => buildSpriteTexture(), []);
	const clumps = useMemo(() => buildCloudClumps(), []);
	const puffs = useMemo(() => clumps.flatMap((c) => c.puffs), [clumps]);
	const positions = useMemo(() => new Float32Array(puffs.length * 3), [puffs.length]);
	const geomRef = useRef<THREE.BufferGeometry>(null);
	const cloudMatRef = useRef<THREE.PointsMaterial>(null);

	const boltVariants = useMemo(() => Array.from({ length: BOLT_VARIANT_COUNT }, (_, i) => buildBoltGeometry(4471 + i * 97)), []);
	const flashTimeline = useMemo(() => buildFlashTimeline(clumps.length), [clumps.length]);
	const boltMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0 }), []);
	const boltMeshRef = useRef<THREE.Mesh>(null);
	const boltGroupRef = useRef<THREE.Group>(null);
	const boltLightRef = useRef<THREE.PointLight>(null);

	const _world = useMemo(() => new THREE.Vector3(), []);

	useFrame(({ clock, camera }) => {
		let nearestDistSq = Infinity;
		for (let i = 0; i < puffs.length; i++) {
			const p = puffs[i];
			const bob = Math.sin(clock.elapsedTime * 0.2 + p.phase * Math.PI * 2) * 0.006;
			_world.copy(p.offset);
			_world.y += bob;
			_world.applyQuaternion(quaternion).add(cloudCenter);
			positions[i * 3] = _world.x;
			positions[i * 3 + 1] = _world.y;
			positions[i * 3 + 2] = _world.z;
			const distSq = camera.position.distanceToSquared(_world);
			if (distSq < nearestDistSq) nearestDistSq = distSq;
		}
		if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;

		// Sprite billboard sizeAttenuation MEMBESAR tanpa had bila jarak kamera
		// -> 0 — jika kamera terbang terlalu hampir dgn satu kepulan (terutama
		// bila pandang sedikit ke atas), satu sprite boleh memenuhi SELURUH
		// skrin & "menelan" puncak gunung sepenuhnya. Pudarkan keseluruhan
		// kluster awan bila kepulan TERDEKAT terlalu rapat, supaya puncak
		// sentiasa kelihatan tidak kira sudut kamera.
		const nearestDist = Math.sqrt(nearestDistSq);
		const proximityFade = THREE.MathUtils.smoothstep(nearestDist, 0.08, 0.2);

		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1) * 0.85 * proximityFade;
		if (cloudMatRef.current) {
			cloudMatRef.current.opacity = THREE.MathUtils.lerp(cloudMatRef.current.opacity, target, 0.05);
			cloudMatRef.current.visible = cloudMatRef.current.opacity > 0.01;
		}

		const flash = activeFlash(clock.elapsedTime, flashTimeline);
		const visible = target > 0.1 && flash !== null;
		boltMat.opacity = visible ? 1 : 0;
		boltMat.visible = visible;
		if (visible && flash) {
			if (boltMeshRef.current) boltMeshRef.current.geometry = boltVariants[flash.boltIndex];
			if (boltGroupRef.current) boltGroupRef.current.position.copy(clumps[flash.clumpIndex].center);
		}
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
				<group ref={boltGroupRef}>
					<mesh ref={boltMeshRef} geometry={boltVariants[0]} material={boltMat} />
					<pointLight ref={boltLightRef} color="#cfe8ff" intensity={0} distance={0.6} position={[0, 0.09, 0]} />
				</group>
			</group>
		</group>
	);
}
