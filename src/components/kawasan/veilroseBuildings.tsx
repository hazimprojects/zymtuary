import * as THREE from 'three';
import { VEILROSE_PALETTE } from './veilrosePalette';

export type BuildingSegment = {
	x: number;
	z: number;
	width: number;
	depth: number;
	rot: number;
	wallColor: string;
	roofColor: string;
};

/** Bangunan dua tingkat generik di perimeter — membentuk "dinding" kuartir. */
export const PERIMETER_BUILDINGS: BuildingSegment[] = [
	// Utara — celah mulut jalan ke Faceless Bazaar (x ≈ -3.5 … 3.5)
	{ x: -9.2, z: 13.2, width: 5.4, depth: 2.4, rot: 0, wallColor: VEILROSE_PALETTE.cream, roofColor: VEILROSE_PALETTE.pink },
	{ x: 9.2, z: 13.2, width: 5.4, depth: 2.4, rot: 0, wallColor: VEILROSE_PALETTE.cream, roofColor: VEILROSE_PALETTE.purple },
	// Timur — lorong ke Rehearsal Mirrors
	{ x: 12.8, z: 8.5, width: 2.4, depth: 4.8, rot: 0, wallColor: VEILROSE_PALETTE.gold, roofColor: VEILROSE_PALETTE.gold },
	{ x: 12.8, z: 1.5, width: 2.4, depth: 4.2, rot: 0, wallColor: VEILROSE_PALETTE.cream, roofColor: VEILROSE_PALETTE.pink },
	{ x: 12.8, z: -5.5, width: 2.4, depth: 5.2, rot: 0, wallColor: VEILROSE_PALETTE.gold, roofColor: VEILROSE_PALETTE.purple },
	{ x: 12.8, z: -12, width: 2.4, depth: 4.6, rot: 0, wallColor: VEILROSE_PALETTE.cream, roofColor: VEILROSE_PALETTE.gold },
	// Selatan — celah keluar ke kawasan lain
	{ x: -9, z: -15.8, width: 5.2, depth: 2.4, rot: 0, wallColor: VEILROSE_PALETTE.gold, roofColor: VEILROSE_PALETTE.purple },
	{ x: 9, z: -15.8, width: 5.2, depth: 2.4, rot: 0, wallColor: VEILROSE_PALETTE.gold, roofColor: VEILROSE_PALETTE.pink },
	// Barat — sisi Memory Room (tinggalkan ruang untuk galeri melengkung)
	{ x: -12.8, z: 10, width: 2.4, depth: 4.5, rot: 0, wallColor: VEILROSE_PALETTE.cream, roofColor: VEILROSE_PALETTE.pink },
	{ x: -12.8, z: -8.5, width: 2.4, depth: 5.5, rot: 0, wallColor: VEILROSE_PALETTE.gold, roofColor: VEILROSE_PALETTE.purple },
	{ x: -12.8, z: -14.5, width: 2.4, depth: 3.8, rot: 0, wallColor: VEILROSE_PALETTE.cream, roofColor: VEILROSE_PALETTE.gold },
];

const WINDOW_OFFSETS = [
	[-0.28, 0.55, 0.51],
	[0.28, 0.55, 0.51],
	[-0.28, 1.35, 0.51],
	[0.28, 1.35, 0.51],
];

function QuarterBuilding({ seg }: { seg: BuildingSegment }) {
	const wallH = 1.05;
	const totalH = wallH * 2 + 0.12;
	return (
		<group position={[seg.x, 0, seg.z]} rotation={[0, seg.rot, 0]}>
			<mesh position={[0, wallH, 0]}>
				<boxGeometry args={[seg.width, wallH * 2, seg.depth]} />
				<meshStandardMaterial color={seg.wallColor} flatShading roughness={0.82} />
			</mesh>
			<mesh position={[0, totalH + 0.18, 0]}>
				<boxGeometry args={[seg.width + 0.12, 0.36, seg.depth + 0.18]} />
				<meshStandardMaterial color={seg.roofColor} flatShading roughness={0.7} emissive={seg.roofColor} emissiveIntensity={0.06} />
			</mesh>
			{WINDOW_OFFSETS.map((w, i) => (
				<mesh key={i} position={[w[0] * seg.width * 0.55, w[1], seg.depth / 2 + 0.02]}>
					<boxGeometry args={[0.22, 0.28, 0.04]} />
					<meshStandardMaterial
						color={VEILROSE_PALETTE.purple}
						emissive={VEILROSE_PALETTE.cream}
						emissiveIntensity={0.15}
						flatShading
						roughness={0.35}
					/>
				</mesh>
			))}
		</group>
	);
}

/** Siluet bumbung bandar jauh — rasa Mendari lebih besar di luar kuartir ini. */
const CITY_SILHOUETTES: { x: number; z: number; w: number; d: number; h: number }[] = [
	{ x: -22, z: 20, w: 8, d: 5, h: 3.2 },
	{ x: -8, z: 24, w: 10, d: 4, h: 4.1 },
	{ x: 10, z: 23, w: 9, d: 5.5, h: 3.6 },
	{ x: 24, z: 16, w: 7, d: 6, h: 3.9 },
	{ x: 26, z: -4, w: 8, d: 5, h: 3.1 },
	{ x: -20, z: -20, w: 11, d: 4.5, h: 3.4 },
	{ x: 6, z: -24, w: 9, d: 5, h: 3.7 },
	{ x: -24, z: 2, w: 6, d: 8, h: 4.2 },
];

export function VeilroseCitySilhouettes() {
	return (
		<group>
			{CITY_SILHOUETTES.map((s, i) => (
				<mesh key={i} position={[s.x, s.h / 2, s.z]}>
					<boxGeometry args={[s.w, s.h, s.d]} />
					<meshStandardMaterial color="#3d2e42" flatShading roughness={0.95} transparent opacity={0.55} />
				</mesh>
			))}
		</group>
	);
}

/** Tanda mulut jalan — tiang + kabus lembut di hujung pandangan. */
export function VeilroseStreetMouths() {
	const mouths = [
		{ x: 0, z: 14.8, label: 'Faceless Bazaar' },
		{ x: 0, z: -16.8, label: 'Mendari' },
	];
	return (
		<group>
			{mouths.map((m, i) => (
				<group key={i} position={[m.x, 0, m.z]}>
					{[-2.8, 2.8].map((ox, j) => (
						<mesh key={j} position={[ox, 1.1, 0]}>
							<cylinderGeometry args={[0.06, 0.07, 2.2, 6]} />
							<meshStandardMaterial color="#6b4a3a" flatShading roughness={0.8} />
						</mesh>
					))}
					<mesh position={[0, 2.35, 0]} rotation={[0, 0, 0]}>
						<boxGeometry args={[6.8, 0.06, 0.06]} />
						<meshStandardMaterial color={VEILROSE_PALETTE.gold} flatShading emissive={VEILROSE_PALETTE.gold} emissiveIntensity={0.2} />
					</mesh>
				</group>
			))}
		</group>
	);
}

export function VeilrosePerimeterBuildings() {
	return (
		<group>
			{PERIMETER_BUILDINGS.map((seg, i) => (
				<QuarterBuilding key={i} seg={seg} />
			))}
		</group>
	);
}
