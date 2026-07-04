import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, deg, directionFromThetaY, seededRng, tangentBasis } from './worldGlobeConfig';

type EmitterProps = {
	atmosphereBlendRef: React.MutableRefObject<number>;
};

type Emitter = {
	center: [number, number, number];
	spread: number;
	count: number;
	color: string;
	size: number;
	riseSpeed: number;
	maxRise: number;
	seed: number;
};

type ParticleState = {
	dirBase: THREE.Vector3;
	tangentU: THREE.Vector3;
	tangentV: THREE.Vector3;
	driftU: number;
	driftV: number;
	phase: number;
	speed: number;
};

/** Buat tekstur sprite bulat lembut sekali sahaja (kanvas offscreen) —
 * dikongsi oleh semua emitter supaya tidak jana berulang kali. */
function buildSpriteTexture(): THREE.CanvasTexture {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	gradient.addColorStop(0, 'rgba(255,255,255,1)');
	gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
	gradient.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	return new THREE.CanvasTexture(canvas);
}

function buildParticles(emitter: Emitter): ParticleState[] {
	const rng = seededRng(emitter.seed);
	const center = new THREE.Vector3(...emitter.center);
	const { u, v } = tangentBasis(emitter.center);
	const tangentU = new THREE.Vector3(...u);
	const tangentV = new THREE.Vector3(...v);

	return Array.from({ length: emitter.count }, () => {
		const angle = rng() * Math.PI * 2;
		const r = Math.sqrt(rng()) * emitter.spread;
		const offsetU = Math.cos(angle) * r;
		const offsetV = Math.sin(angle) * r;
		const dirBase = center
			.clone()
			.addScaledVector(tangentU, offsetU)
			.addScaledVector(tangentV, offsetV)
			.normalize();
		return {
			dirBase,
			tangentU,
			tangentV,
			driftU: (rng() - 0.5) * 0.012,
			driftV: (rng() - 0.5) * 0.012,
			phase: rng(),
			speed: emitter.riseSpeed * (0.7 + rng() * 0.6),
		};
	});
}

function ParticleGroup({
	emitter,
	texture,
	additive,
	atmosphereBlendRef,
}: { emitter: Emitter; texture: THREE.Texture; additive: boolean } & EmitterProps) {
	const particles = useMemo(() => buildParticles(emitter), [emitter]);
	const positions = useMemo(() => new Float32Array(emitter.count * 3), [emitter.count]);
	const geomRef = useRef<THREE.BufferGeometry>(null);
	const materialRef = useRef<THREE.PointsMaterial>(null);

	useFrame((_, delta) => {
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			p.phase += delta * p.speed;
			if (p.phase > 1) p.phase -= 1;

			// Susut naik sangat kecil — hanya sedikit terapung di mulut
			// rekahan, bukan melonjak ke langit.
			const altitude = GLOBE_RADIUS + 0.004 + p.phase * emitter.maxRise;
			const spread = p.phase * 0.4;
			const x = p.dirBase.x * altitude + p.tangentU.x * p.driftU * spread + p.tangentV.x * p.driftV * spread;
			const y = p.dirBase.y * altitude + p.tangentU.y * p.driftU * spread + p.tangentV.y * p.driftV * spread;
			const z = p.dirBase.z * altitude + p.tangentU.z * p.driftU * spread + p.tangentV.z * p.driftV * spread;
			positions[i * 3] = x;
			positions[i * 3 + 1] = y;
			positions[i * 3 + 2] = z;
		}
		if (geomRef.current) {
			geomRef.current.attributes.position.needsUpdate = true;
		}

		if (materialRef.current) {
			const blend = atmosphereBlendRef.current;
			const target = THREE.MathUtils.clamp((blend - 0.2) / 0.35, 0, 1) * 0.75;
			materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, target, 0.06);
			materialRef.current.visible = materialRef.current.opacity > 0.01;
		}
	});

	return (
		<points>
			<bufferGeometry ref={geomRef}>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
			</bufferGeometry>
			<pointsMaterial
				ref={materialRef}
				size={emitter.size}
				map={texture}
				color={emitter.color}
				transparent
				opacity={0}
				depthWrite={false}
				sizeAttenuation
				blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
			/>
		</points>
	);
}

/**
 * Partikel halus & kecil di mulut rekahan sahaja — bara api ember menyala
 * (Ignisara) dan salji/ais berdenyut (Nivira). Terapung sedikit sahaja
 * (bukan naik ke langit) dan hanya kelihatan dalam atmosfera.
 */
export default function FeatureParticles({ atmosphereBlendRef }: EmitterProps) {
	const texture = useMemo(() => buildSpriteTexture(), []);

	const emberEmitter: Emitter = useMemo(
		() => ({
			center: directionFromThetaY(deg(200), 0.72),
			spread: 0.055,
			count: 14,
			color: '#ff8a3d',
			size: 0.009,
			riseSpeed: 0.14,
			maxRise: 0.035,
			seed: 901,
		}),
		[],
	);

	const snowEmitter: Emitter = useMemo(
		() => ({
			center: directionFromThetaY(deg(30), -0.72),
			spread: 0.055,
			count: 14,
			color: '#dff2ff',
			size: 0.007,
			riseSpeed: 0.07,
			maxRise: 0.028,
			seed: 902,
		}),
		[],
	);

	return (
		<group>
			<ParticleGroup emitter={emberEmitter} texture={texture} additive atmosphereBlendRef={atmosphereBlendRef} />
			<ParticleGroup emitter={snowEmitter} texture={texture} additive={false} atmosphereBlendRef={atmosphereBlendRef} />
		</group>
	);
}
