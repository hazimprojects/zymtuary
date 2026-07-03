import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VEILROSE_PALETTE } from './veilrosePalette';

/**
 * Hiasan tambahan tanpa perlanggaran/interaksi (sama falsafah dengan
 * RoseStallProp dalam veilroseLandmarks.tsx) — mengisi plaza dengan rumput
 * dan pokok bunga supaya Veilrose Quarter terasa lebih hidup & cantik,
 * bukan sekadar tanah rata di antara spot-spot utama.
 */

const GRASS_BLOOM_COLORS = [VEILROSE_PALETTE.pink, VEILROSE_PALETTE.gold];
const GRASS_SWAY_PERIOD = 3.4;

/** Rumpun rumput kecil — pengisi ruang kosong plaza, kadang-kadang dengan
 * sekuntum bunga kecil. */
export function VeilroseGrassTuft({ scale, swayPhase = 0 }: { scale: number; swayPhase?: number }) {
	const groupRef = useRef<THREE.Group>(null);
	const hasBloom = swayPhase % 1 < 0.4;

	useFrame(({ clock }) => {
		if (!groupRef.current) return;
		const t = clock.getElapsedTime();
		const angle = (Math.PI * 2) / GRASS_SWAY_PERIOD;
		groupRef.current.rotation.z = Math.sin(t * angle + swayPhase) * 0.16;
	});

	const blades = [0, 1, 2, 3];
	return (
		<group ref={groupRef} scale={scale}>
			{blades.map((i) => {
				const a = (i / blades.length) * Math.PI * 2;
				return (
					<mesh
						key={i}
						position={[Math.cos(a) * 0.05, 0.11, Math.sin(a) * 0.05]}
						rotation={[Math.cos(a) * 0.25, a, Math.sin(a) * 0.25]}
					>
						<coneGeometry args={[0.035, 0.22, 4]} />
						<meshStandardMaterial color={VEILROSE_PALETTE.green} flatShading roughness={0.7} />
					</mesh>
				);
			})}
			{hasBloom ? (
				<mesh position={[0, 0.24, 0]}>
					<icosahedronGeometry args={[0.06, 0]} />
					<meshStandardMaterial
						color={GRASS_BLOOM_COLORS[Math.floor(swayPhase) % GRASS_BLOOM_COLORS.length]}
						flatShading
						emissive={GRASS_BLOOM_COLORS[Math.floor(swayPhase) % GRASS_BLOOM_COLORS.length]}
						emissiveIntensity={0.25}
						roughness={0.5}
					/>
				</mesh>
			) : null}
		</group>
	);
}

const TREE_BLOOM_SETS: readonly (readonly [string, string])[] = [
	[VEILROSE_PALETTE.pink, VEILROSE_PALETTE.gold],
	[VEILROSE_PALETTE.purple, VEILROSE_PALETTE.pink],
];
const TREE_SWAY_PERIOD = 7.5;

/** Pokok bunga — batang meruncing dengan 2-3 tingkat kanopi bunga, cukup
 * tinggi (~2.2-3.2 unit) untuk terasa matang berbanding avatar Zym (~1.2
 * unit) tanpa menenggelamkan plaza. */
export function VeilroseFloweringTree({ scale, swayPhase = 0 }: { scale: number; swayPhase?: number }) {
	const canopyRef = useRef<THREE.Group>(null);
	const blooms = TREE_BLOOM_SETS[Math.floor(swayPhase) % TREE_BLOOM_SETS.length];

	useFrame(({ clock }) => {
		if (!canopyRef.current) return;
		const t = clock.getElapsedTime();
		const angle = (Math.PI * 2) / TREE_SWAY_PERIOD;
		canopyRef.current.rotation.z = Math.sin(t * angle + swayPhase) * 0.045;
	});

	const tiers = [
		{ y: 1.7, r: 0.62 },
		{ y: 2.15, r: 0.46 },
		{ y: 2.5, r: 0.3 },
	];

	return (
		<group scale={scale}>
			<mesh position={[0, 0.85, 0]}>
				<cylinderGeometry args={[0.1, 0.16, 1.7, 6]} />
				<meshStandardMaterial color="#7a5236" flatShading roughness={0.85} />
			</mesh>
			<group ref={canopyRef}>
				{tiers.map((tier, i) => (
					<mesh key={i} position={[0, tier.y, 0]}>
						<dodecahedronGeometry args={[tier.r, 0]} />
						<meshStandardMaterial
							color={blooms[i % blooms.length]}
							flatShading
							emissive={blooms[i % blooms.length]}
							emissiveIntensity={0.2}
							roughness={0.6}
						/>
					</mesh>
				))}
			</group>
		</group>
	);
}
