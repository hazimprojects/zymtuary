import * as THREE from 'three';
import { VEILROSE_PALETTE } from './veilrosePalette';

export type RoofKind = 'flat' | 'gable' | 'dome' | 'arch';

export type BuildingDef = {
	x: number;
	z: number;
	width: number;
	depth: number;
	rot?: number;
	wallColor: string;
	roofColor: string;
	roof: RoofKind;
	/** Lebar lorong melalui bangunan — perlanggaran di tepi sahaja. */
	passageWidth?: number;
};

const W = VEILROSE_PALETTE;
const C = [W.cream, W.gold, W.pink, W.purple] as const;
const R = [W.pink, W.purple, W.gold, W.cream] as const;

function b(
	x: number,
	z: number,
	width: number,
	depth: number,
	roof: RoofKind,
	ci = 0,
	ri = 0,
	rot = 0,
	passageWidth?: number,
): BuildingDef {
	return {
		x,
		z,
		width,
		depth,
		rot,
		wallColor: C[ci % C.length],
		roofColor: R[ri % R.length],
		roof,
		passageWidth,
	};
}

/** ~48 bangunan — perimeter, cincin dalaman, dan isi padat yang menyorok spot. */
export const QUARTER_BUILDINGS: BuildingDef[] = [
	// ── Perimeter utara (celah masuk x≈±0) ──
	b(-16, 24, 6.5, 2.8, 'gable', 0, 1),
	b(-9, 24.5, 4.5, 2.6, 'arch', 1, 2, 0, 2.4),
	b(9, 24.5, 4.5, 2.6, 'arch', 2, 3, 0, 2.4),
	b(16, 24, 6.5, 2.8, 'dome', 3, 0),
	b(-22, 20, 3.2, 5.5, 'flat', 0, 2),
	b(22, 20, 3.2, 5.5, 'gable', 1, 3),
	// ── Cincin dalaman utara — halang pandangan terus ke spot tersorok ──
	b(-13, 16, 3.2, 2.6, 'gable', 2, 0),
	b(-6, 15.5, 2.8, 2.4, 'dome', 3, 1),
	b(6, 15.5, 2.8, 2.4, 'flat', 0, 2),
	b(13, 16, 3.2, 2.6, 'arch', 1, 3, 0, 2.0),
	b(-18, 14, 2.8, 3.5, 'flat', 2, 0),
	b(18, 14, 2.8, 3.5, 'dome', 3, 1),
	// ── Sayap barat — lorong ke Memory Room ──
	b(-20, 10, 2.8, 4.2, 'gable', 0, 2),
	b(-20, 4, 2.8, 4.2, 'dome', 1, 3),
	b(-20, -2, 2.8, 4.2, 'flat', 2, 0),
	b(-20, -8, 2.8, 4.2, 'gable', 3, 1),
	b(-16, 12, 2.6, 3.2, 'arch', 0, 2, 0, 2.0),
	b(-16, 0, 2.6, 3.2, 'arch', 1, 3, 0, 2.0),
	b(-16, -6, 2.6, 3.2, 'dome', 2, 0),
	b(-12, 10, 2.6, 3.0, 'flat', 3, 1),
	b(-12, 4, 2.6, 3.0, 'gable', 0, 2),
	b(-12, -2, 2.6, 3.0, 'dome', 1, 3),
	b(-12, -8, 2.6, 3.0, 'flat', 2, 0),
	// ── Sayap timur — lorong ke Rehearsal Mirrors ──
	b(20, 10, 2.8, 4.2, 'dome', 3, 1),
	b(20, 4, 2.8, 4.2, 'flat', 0, 2),
	b(20, -2, 2.8, 4.2, 'gable', 1, 3),
	b(20, -8, 2.8, 4.2, 'arch', 2, 0, 0, 2.0),
	b(20, -14, 2.8, 4.2, 'dome', 3, 1),
	b(20, -20, 2.8, 4.0, 'flat', 0, 2),
	b(16, 8, 2.6, 3.2, 'gable', 1, 3),
	b(16, 0, 2.6, 3.2, 'arch', 2, 0, 0, 2.0),
	b(16, -8, 2.6, 3.2, 'dome', 3, 1),
	b(16, -16, 2.6, 3.2, 'flat', 0, 2),
	b(12, 6, 2.6, 3.0, 'arch', 1, 3, 0, 2.0),
	b(12, -2, 2.6, 3.0, 'gable', 2, 0),
	b(12, -10, 2.6, 3.0, 'dome', 3, 1),
	b(12, -18, 2.6, 3.0, 'flat', 0, 2),
	// ── Isi plaza — halang pandangan silang antara spot ──
	b(-7, 7, 2.4, 2.4, 'gable', 1, 2),
	b(7, 7, 2.4, 2.4, 'dome', 2, 3),
	b(-7, 0, 2.4, 2.4, 'flat', 3, 0),
	b(7, 0, 2.4, 2.4, 'arch', 0, 1, 0, 2.0),
	b(-7, -6, 2.4, 2.4, 'dome', 1, 2),
	b(7, -6, 2.4, 2.4, 'gable', 2, 3),
	b(-3, 9, 2.2, 2.0, 'flat', 3, 0),
	b(3, 9, 2.2, 2.0, 'dome', 0, 1),
	b(-3, -9, 2.2, 2.0, 'gable', 1, 2),
	b(3, -9, 2.2, 2.0, 'flat', 2, 3),
	// ── Selatan dalaman — lorong ke Fallen Petals ──
	b(-10, -12, 3.0, 2.6, 'dome', 3, 0),
	b(10, -12, 3.0, 2.6, 'gable', 0, 1),
	b(-6, -14, 2.6, 2.4, 'flat', 1, 2),
	b(6, -14, 2.6, 2.4, 'arch', 2, 3, 0, 1.8),
	b(0, -12, 2.8, 2.4, 'arch', 3, 0, 0, 2.2),
	b(-14, -16, 3.0, 2.8, 'gable', 0, 2),
	b(14, -16, 3.0, 2.8, 'dome', 1, 3),
	// ── Perimeter selatan (celah keluar) ──
	b(-18, -26, 6.0, 2.8, 'flat', 2, 0),
	b(-9, -26.5, 4.5, 2.6, 'arch', 3, 1, 0, 2.4),
	b(9, -26.5, 4.5, 2.6, 'arch', 0, 2, 0, 2.4),
	b(18, -26, 6.0, 2.8, 'gable', 1, 3),
	b(-22, -22, 3.2, 5.0, 'dome', 2, 0),
	b(22, -22, 3.2, 5.0, 'flat', 3, 1),
	// ── Kedalaman selatan & timur — pocket tersorok ──
	b(-8, -20, 2.8, 2.6, 'gable', 0, 2),
	b(8, -20, 2.8, 2.6, 'dome', 1, 3),
	b(0, -22, 2.6, 2.4, 'flat', 2, 0),
	b(-16, -22, 2.8, 3.0, 'dome', 3, 1),
	b(16, -22, 2.8, 3.0, 'gable', 0, 2),
	b(18, -24, 2.6, 3.0, 'flat', 1, 3),
	b(-4, -24, 2.4, 2.4, 'gable', 2, 0),
];

/** Pavement lorong sempit — batu kelabu-keemasan. */
export type PavementSegment = {
	x: number;
	z: number;
	length: number;
	width: number;
	rot: number;
};

export const ALLEY_PAVEMENTS: PavementSegment[] = [
	{ x: 0, z: 18, length: 22, width: 2.2, rot: 0 },
	{ x: -15, z: 4, length: 18, width: 1.9, rot: Math.PI / 2 },
	{ x: 15, z: -4, length: 28, width: 1.9, rot: Math.PI / 2 },
	{ x: 0, z: -18, length: 24, width: 1.7, rot: 0 },
	{ x: -9, z: -14, length: 14, width: 1.7, rot: 0 },
	{ x: 9, z: -16, length: 12, width: 1.6, rot: Math.PI / 2 },
	{ x: -5, z: 4, length: 10, width: 1.8, rot: 0 },
	{ x: 5, z: -6, length: 14, width: 1.7, rot: Math.PI / 2 },
	{ x: -12, z: -8, length: 10, width: 1.6, rot: 0 },
	{ x: 12, z: -12, length: 16, width: 1.6, rot: Math.PI / 2 },
];

const WINDOW_OFFSETS = [
	[-0.28, 0.55],
	[0.28, 0.55],
	[-0.28, 1.35],
	[0.28, 1.35],
];

const PAVEMENT_COLOR = '#B8A878';
const PAVEMENT_EDGE = '#A89868';

function FlatRoof({ width, depth, color, y }: { width: number; depth: number; color: string; y: number }) {
	return (
		<mesh position={[0, y, 0]}>
			<boxGeometry args={[width + 0.12, 0.32, depth + 0.14]} />
			<meshStandardMaterial color={color} flatShading roughness={0.7} emissive={color} emissiveIntensity={0.05} />
		</mesh>
	);
}

function GableRoof({ width, depth, color, y }: { width: number; depth: number; color: string; y: number }) {
	return (
		<group position={[0, y, 0]}>
			<mesh position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
				<cylinderGeometry args={[depth * 0.52, depth * 0.52, width + 0.2, 3, 1]} />
				<meshStandardMaterial color={color} flatShading roughness={0.72} emissive={color} emissiveIntensity={0.06} />
			</mesh>
		</group>
	);
}

function DomeRoof({ width, depth, color, y }: { width: number; depth: number; color: string; y: number }) {
	const r = Math.min(width, depth) * 0.48;
	return (
		<mesh position={[0, y + 0.15, 0]} scale={[1, 0.55, 1]}>
			<icosahedronGeometry args={[r, 1]} />
			<meshStandardMaterial color={color} flatShading roughness={0.65} emissive={color} emissiveIntensity={0.1} />
		</mesh>
	);
}

function ArchFacade({ width, depth, color }: { width: number; depth: number; color: string }) {
	const archW = Math.min(width * 0.55, 1.6);
	return (
		<group position={[0, 0, depth / 2 + 0.02]}>
			<mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[archW * 0.5, 0.07, 6, 12, Math.PI]} />
				<meshStandardMaterial color={color} flatShading roughness={0.6} emissive={color} emissiveIntensity={0.12} />
			</mesh>
			{[-archW * 0.55, archW * 0.55].map((ox, i) => (
				<mesh key={i} position={[ox, 0.35, 0]}>
					<boxGeometry args={[0.14, 0.7, 0.1]} />
					<meshStandardMaterial color={VEILROSE_PALETTE.cream} flatShading roughness={0.75} />
				</mesh>
			))}
		</group>
	);
}

function QuarterBuilding({ seg }: { seg: BuildingDef }) {
	const wallH = 1.05;
	const totalH = wallH * 2 + 0.12;
	const rot = seg.rot ?? 0;
	const roofY = totalH + 0.18;

	return (
		<group position={[seg.x, 0, seg.z]} rotation={[0, rot, 0]}>
			<mesh position={[0, wallH, 0]}>
				<boxGeometry args={[seg.width, wallH * 2, seg.depth]} />
				<meshStandardMaterial color={seg.wallColor} flatShading roughness={0.82} />
			</mesh>
			{seg.roof === 'flat' ? <FlatRoof width={seg.width} depth={seg.depth} color={seg.roofColor} y={roofY} /> : null}
			{seg.roof === 'gable' ? <GableRoof width={seg.width} depth={seg.depth} color={seg.roofColor} y={roofY} /> : null}
			{seg.roof === 'dome' ? <DomeRoof width={seg.width} depth={seg.depth} color={seg.roofColor} y={roofY} /> : null}
			{seg.roof === 'arch' ? (
				<>
					<FlatRoof width={seg.width} depth={seg.depth} color={seg.roofColor} y={roofY} />
					<ArchFacade width={seg.width} depth={seg.depth} color={seg.roofColor} />
				</>
			) : null}
			{WINDOW_OFFSETS.map((w, i) => (
				<mesh key={i} position={[w[0] * seg.width * 0.55, w[1], seg.depth / 2 + 0.02]}>
					<boxGeometry args={[0.2, 0.26, 0.04]} />
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

export function VeilroseAlleyPavements() {
	return (
		<group>
			{ALLEY_PAVEMENTS.map((p, i) => (
				<group key={i} position={[p.x, 0.195, p.z]} rotation={[0, p.rot, 0]}>
					<mesh receiveShadow={false}>
						<boxGeometry args={[p.width, 0.04, p.length]} />
						<meshStandardMaterial color={PAVEMENT_COLOR} flatShading roughness={0.88} metalness={0.02} />
					</mesh>
					{/* Tepi pavement — bacaan visual lorong */}
					<mesh position={[p.width / 2 + 0.03, 0.01, 0]}>
						<boxGeometry args={[0.04, 0.03, p.length]} />
						<meshStandardMaterial color={PAVEMENT_EDGE} flatShading roughness={0.9} />
					</mesh>
					<mesh position={[-p.width / 2 - 0.03, 0.01, 0]}>
						<boxGeometry args={[0.04, 0.03, p.length]} />
						<meshStandardMaterial color={PAVEMENT_EDGE} flatShading roughness={0.9} />
					</mesh>
				</group>
			))}
		</group>
	);
}

const CITY_SILHOUETTES: { x: number; z: number; w: number; d: number; h: number }[] = [
	{ x: -30, z: 28, w: 10, d: 5.5, h: 3.8 },
	{ x: -12, z: 32, w: 12, d: 4.5, h: 4.6 },
	{ x: 14, z: 31, w: 11, d: 5.8, h: 4.0 },
	{ x: 32, z: 22, w: 8, d: 6.5, h: 4.2 },
	{ x: 34, z: -2, w: 9, d: 5.5, h: 3.5 },
	{ x: -28, z: -26, w: 13, d: 5, h: 3.8 },
	{ x: 8, z: -32, w: 10, d: 5.5, h: 4.1 },
	{ x: -32, z: 4, w: 7, d: 9, h: 4.8 },
	{ x: 28, z: -20, w: 9, d: 6, h: 3.6 },
	{ x: -20, z: 30, w: 8, d: 4, h: 3.9 },
];

export function VeilroseCitySilhouettes() {
	return (
		<group>
			{CITY_SILHOUETTES.map((s, i) => (
				<mesh key={i} position={[s.x, s.h / 2, s.z]}>
					<boxGeometry args={[s.w, s.h, s.d]} />
					<meshStandardMaterial color="#3d2e42" flatShading roughness={0.95} transparent opacity={0.5} />
				</mesh>
			))}
		</group>
	);
}

export function VeilroseStreetMouths() {
	const mouths = [{ x: 0, z: 25.5 }, { x: 0, z: -27.5 }];
	return (
		<group>
			{mouths.map((m, i) => (
				<group key={i} position={[m.x, 0, m.z]}>
					{[-3.2, 3.2].map((ox, j) => (
						<mesh key={j} position={[ox, 1.2, 0]}>
							<cylinderGeometry args={[0.07, 0.08, 2.4, 6]} />
							<meshStandardMaterial color="#6b4a3a" flatShading roughness={0.8} />
						</mesh>
					))}
					<mesh position={[0, 2.55, 0]}>
						<boxGeometry args={[7.5, 0.07, 0.07]} />
						<meshStandardMaterial color={VEILROSE_PALETTE.gold} flatShading emissive={VEILROSE_PALETTE.gold} emissiveIntensity={0.22} />
					</mesh>
				</group>
			))}
		</group>
	);
}

export function VeilroseQuarterBuildings() {
	return (
		<group>
			{QUARTER_BUILDINGS.map((seg, i) => (
				<QuarterBuilding key={i} seg={seg} />
			))}
		</group>
	);
}

/** Titik perlanggaran bangunan — sokong lorong melalui arch/passage. */
export function buildingColliderPoints(
	seg: BuildingDef,
): { dx: number; dz: number; radius: number }[] {
	const rot = seg.rot ?? 0;
	const pw = seg.passageWidth ?? 0;

	const localPoints: { dx: number; dz: number; radius: number }[] = [];
	if (pw > 0.8) {
		const side = (seg.width - pw) / 2;
		if (side > 0.35) {
			localPoints.push({ dx: -(pw / 2 + side / 2), dz: 0, radius: side * 0.92 });
			localPoints.push({ dx: pw / 2 + side / 2, dz: 0, radius: side * 0.92 });
		}
	} else {
		localPoints.push({ dx: 0, dz: 0, radius: Math.max(seg.width, seg.depth) * 0.5 });
	}

	return localPoints.map((p) => ({
		dx: p.dx * Math.cos(rot) - p.dz * Math.sin(rot),
		dz: p.dx * Math.sin(rot) + p.dz * Math.cos(rot),
		radius: p.radius,
	}));
}

/** @deprecated guna QUARTER_BUILDINGS */
export const PERIMETER_BUILDINGS = QUARTER_BUILDINGS;

export function VeilrosePerimeterBuildings() {
	return <VeilroseQuarterBuildings />;
}
