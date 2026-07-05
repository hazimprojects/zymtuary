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
// Sepadan dgn heightScale 'obsidian-hollow' (1.45) pada terrainHeight —
// awan gelap terapung di atas puncak yg dinaikkan, bukan pada GLOBE_RADIUS asas.
const PEAK_BUMP = 0.1 * 1.45;

type Puff = { offset: THREE.Vector3; phase: number };

function buildPuffs(): Puff[] {
	const rng = seededRng(9911);
	return Array.from({ length: 18 }, () => {
		const angle = rng() * Math.PI * 2;
		const r = rng() * 0.09;
		const offset = new THREE.Vector3(Math.cos(angle) * r, 0.11 + rng() * 0.05, Math.sin(angle) * r);
		return { offset, phase: rng() };
	});
}

/** Bolt kilat zigzag — segmen silinder nipis bersambung dijana SEKALI
 * (bentuk statik); hanya keterlihatannya yang berdenyut (useFrame), bukan
 * bentuknya, supaya murah dari segi prestasi. */
function buildBoltGeometry(): THREE.BufferGeometry {
	const rng = seededRng(4471);
	const points: THREE.Vector3[] = [new THREE.Vector3(0, 0.14, 0)];
	const steps = 5;
	for (let i = 0; i < steps; i++) {
		const cur = points[points.length - 1];
		points.push(new THREE.Vector3(cur.x + (rng() - 0.5) * 0.035, cur.y - 0.14 / steps, cur.z + (rng() - 0.5) * 0.035));
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

type StrikeState = { mode: 'idle' | 'on' | 'off'; flashesRemaining: number; timer: number };

/**
 * Ribut di puncak Obsidian Hollow — kepulan awan gelap terapung (teknik
 * sprite sama dgn TerrainProps) + kilat zigzag yang sabung-menyabung
 * sekali sekala (beberapa denyar pantas, diam lama, ulang), gema "berawan
 * gelap dan petir" yang diminta utk puncak gunung PALING TINGGI di Noctira.
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

	const strike = useRef<StrikeState>({ mode: 'idle', flashesRemaining: 0, timer: 3 + Math.random() * 5 });

	useFrame(({ clock }, delta) => {
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

		const s = strike.current;
		s.timer -= delta;
		if (s.mode === 'idle') {
			boltMat.opacity = 0;
			if (s.timer <= 0 && target > 0.1) {
				s.mode = 'on';
				s.flashesRemaining = 2 + Math.floor(Math.random() * 3);
				s.timer = 0.05 + Math.random() * 0.06;
			}
		} else if (s.mode === 'on') {
			boltMat.opacity = 1;
			if (s.timer <= 0) {
				s.flashesRemaining -= 1;
				s.mode = s.flashesRemaining > 0 ? 'off' : 'idle';
				s.timer = s.mode === 'off' ? 0.05 + Math.random() * 0.05 : 4 + Math.random() * 6;
			}
		} else {
			boltMat.opacity = 0;
			if (s.timer <= 0) {
				s.mode = 'on';
				s.timer = 0.04 + Math.random() * 0.06;
			}
		}
		if (boltLightRef.current) boltLightRef.current.intensity = boltMat.opacity * 3.5;
	});

	return (
		<group>
			<points>
				<bufferGeometry ref={geomRef}>
					<bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
				</bufferGeometry>
				<pointsMaterial
					ref={cloudMatRef}
					size={0.09}
					map={texture}
					color="#2a2a30"
					transparent
					opacity={0}
					depthWrite={false}
					sizeAttenuation
					blending={THREE.NormalBlending}
				/>
			</points>
			<group position={cloudCenter} quaternion={quaternion}>
				<mesh geometry={boltGeo} material={boltMat} />
				<pointLight ref={boltLightRef} color="#cfe8ff" intensity={0} distance={0.6} position={[0, 0.07, 0]} />
			</group>
		</group>
	);
}
