import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, directionFromThetaY, seededRng, tangentBasis } from './worldGlobeConfig';

type Emitter = {
	center: [number, number, number];
	spread: number;
	count: number;
	color: string;
	size: number;
	riseSpeed: number;
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
	const texture = new THREE.CanvasTexture(canvas);
	return texture;
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
			driftU: (rng() - 0.5) * 0.06,
			driftV: (rng() - 0.5) * 0.06,
			phase: rng(),
			speed: emitter.riseSpeed * (0.7 + rng() * 0.6),
		};
	});
}

function ParticleGroup({ emitter, texture, additive }: { emitter: Emitter; texture: THREE.Texture; additive: boolean }) {
	const particles = useMemo(() => buildParticles(emitter), [emitter]);
	const positions = useMemo(() => new Float32Array(emitter.count * 3), [emitter.count]);
	const pointsRef = useRef<THREE.Points>(null);
	const geomRef = useRef<THREE.BufferGeometry>(null);

	useFrame((_, delta) => {
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			p.phase += delta * p.speed;
			if (p.phase > 1) p.phase -= 1;

			const altitude = GLOBE_RADIUS + 0.015 + p.phase * 0.22;
			const spread = p.phase * 0.5;
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
	});

	return (
		<points ref={pointsRef}>
			<bufferGeometry ref={geomRef}>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
			</bufferGeometry>
			<pointsMaterial
				size={emitter.size}
				map={texture}
				color={emitter.color}
				transparent
				opacity={0.85}
				depthWrite={false}
				sizeAttenuation
				blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
			/>
		</points>
	);
}

/**
 * Partikel kecil yang keluar dari rekahan — bara api ember menyala
 * (Ignisara) dan salji/ais berdenyut (Nivira), hanyut perlahan ke atas
 * dan berpencar sedikit sebelum berkitar semula.
 */
export default function FeatureParticles() {
	const texture = useMemo(() => buildSpriteTexture(), []);

	const emberEmitter: Emitter = useMemo(
		() => ({
			center: directionFromThetaY((208 * Math.PI) / 180, 0.75),
			spread: 0.22,
			count: 46,
			color: '#ff8a3d',
			size: 0.028,
			riseSpeed: 0.16,
			seed: 901,
		}),
		[],
	);

	const snowEmitter: Emitter = useMemo(
		() => ({
			center: directionFromThetaY((80 * Math.PI) / 180, -0.7),
			spread: 0.22,
			count: 46,
			color: '#dff2ff',
			size: 0.022,
			riseSpeed: 0.09,
			seed: 902,
		}),
		[],
	);

	return (
		<group>
			<ParticleGroup emitter={emberEmitter} texture={texture} additive />
			<ParticleGroup emitter={snowEmitter} texture={texture} additive={false} />
		</group>
	);
}
