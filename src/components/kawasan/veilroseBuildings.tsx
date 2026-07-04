import * as THREE from 'three';
import type { ReactElement } from 'react';
import { VEILROSE_PALETTE } from './veilrosePalette';
import {
	BUILDING_BLOCKS,
	BUILDING_WALL_HEIGHT,
	STREET_PATHS,
	sampleStreetPath,
	type BuildingBlockDef,
	type RoofKind,
} from './veilroseCityPlan';

const PAVEMENT_COLOR = '#B8A878';
const PAVEMENT_EDGE = '#A89868';
const PAVEMENT_Y = 0.205;

function FlatRoofCap({ w, d, color, y }: { w: number; d: number; color: string; y: number }) {
	return (
		<mesh position={[0, y, 0]}>
			<boxGeometry args={[w, 0.28, d]} />
			<meshStandardMaterial color={color} flatShading roughness={0.7} emissive={color} emissiveIntensity={0.05} />
		</mesh>
	);
}

function GableCap({ w, d, color, y }: { w: number; d: number; color: string; y: number }) {
	return (
		<mesh position={[0, y + 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
			<cylinderGeometry args={[d * 0.5, d * 0.5, w, 3, 1]} />
			<meshStandardMaterial color={color} flatShading roughness={0.72} emissive={color} emissiveIntensity={0.06} />
		</mesh>
	);
}

function DomeCap({ size, color, y }: { size: number; color: string; y: number }) {
	return (
		<mesh position={[0, y + 0.12, 0]} scale={[1, 0.5, 1]}>
			<icosahedronGeometry args={[size * 0.42, 1]} />
			<meshStandardMaterial color={color} flatShading roughness={0.65} emissive={color} emissiveIntensity={0.1} />
		</mesh>
	);
}

function ArchCap({ w, color, y }: { w: number; color: string; y: number }) {
	return (
		<group position={[0, y, 0]}>
			<mesh rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[w * 0.22, 0.06, 6, 12, Math.PI]} />
				<meshStandardMaterial color={color} flatShading emissive={color} emissiveIntensity={0.12} />
			</mesh>
		</group>
	);
}

function RoofAccent({ kind, color }: { kind: RoofKind; color: string }) {
	const y = BUILDING_WALL_HEIGHT + 0.2;
	switch (kind) {
		case 'gable':
			return <GableCap w={2.2} d={1.8} color={color} y={y} />;
		case 'dome':
			return <DomeCap size={2} color={color} y={y} />;
		case 'arch':
			return <ArchCap w={2} color={color} y={y} />;
		default:
			return <FlatRoofCap w={2} d={1.6} color={color} y={y} />;
	}
}

/** Satu blok bandar bersambung — dinding pepejal + bumbung rata dengan aksen variasi. */
function CityBlockMesh({ block }: { block: BuildingBlockDef }) {
	const w = block.maxX - block.minX;
	const d = block.maxZ - block.minZ;
	const cx = (block.minX + block.maxX) / 2;
	const cz = (block.minZ + block.maxZ) / 2;
	const h = BUILDING_WALL_HEIGHT;

	// Tingkap beratur sepanjang fasad — rasa bangunan bandar sebenar
	const windowRows = [0.55, 1.35];
	const windowCols = Math.max(2, Math.floor(w / 1.4));

	return (
		<group position={[cx, 0, cz]}>
			<mesh position={[0, h / 2, 0]}>
				<boxGeometry args={[w, h, d]} />
				<meshStandardMaterial color={block.wallColor} flatShading roughness={0.84} />
			</mesh>
			<FlatRoofCap w={w + 0.1} d={d + 0.1} color={block.roofColor} y={h + 0.14} />
			{block.roofAccents.map((a, i) => (
				<group key={i} position={[a.x - cx, 0, a.z - cz]}>
					<RoofAccent kind={a.kind} color={block.roofColor} />
				</group>
			))}
			{windowRows.map((wy, ri) =>
				Array.from({ length: windowCols }, (_, ci) => {
					const wx = ((ci + 0.5) / windowCols - 0.5) * w * 0.88;
					return (
						<mesh key={`${ri}-${ci}`} position={[wx, wy, d / 2 + 0.02]}>
							<boxGeometry args={[0.18, 0.24, 0.03]} />
							<meshStandardMaterial
								color={VEILROSE_PALETTE.purple}
								emissive={VEILROSE_PALETTE.cream}
								emissiveIntensity={0.14}
								flatShading
								roughness={0.35}
							/>
						</mesh>
					);
				}),
			)}
		</group>
	);
}

/** Pavement melengkung — dijana sepanjang laluan jalan sahaja. */
function buildPavementStrip(
	a: { x: number; z: number },
	b: { x: number; z: number },
	width: number,
): THREE.BufferGeometry {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const len = Math.hypot(dx, dz);
	if (len < 0.05) return new THREE.BoxGeometry(0.01, 0.01, 0.01);

	const mx = (a.x + b.x) / 2;
	const mz = (a.z + b.z) / 2;
	const rotY = Math.atan2(dx, dz);

	const geo = new THREE.BoxGeometry(width, 0.035, len + 0.04);
	geo.rotateY(rotY);
	geo.translate(mx, PAVEMENT_Y, mz);
	return geo;
}

export function VeilroseAlleyPavements() {
	const strips: THREE.BufferGeometry[] = [];

	for (const path of STREET_PATHS) {
		const sampled = sampleStreetPath(path, 12);
		for (let i = 0; i < sampled.length - 1; i++) {
			strips.push(buildPavementStrip(sampled[i], sampled[i + 1], path.width));
		}
	}

	return (
		<group>
			{strips.map((geo, i) => (
				<mesh key={i} geometry={geo} receiveShadow={false}>
					<meshStandardMaterial color={PAVEMENT_COLOR} flatShading roughness={0.88} metalness={0.02} />
				</mesh>
			))}
			{/* Tepi pavement — jalur nipis di sisi lorong */}
			{STREET_PATHS.flatMap((path) => {
				const sampled = sampleStreetPath(path, 12);
				const edges: ReactElement[] = [];
				for (let i = 0; i < sampled.length - 1; i++) {
					const a = sampled[i];
					const b = sampled[i + 1];
					const dx = b.x - a.x;
					const dz = b.z - a.z;
					const len = Math.hypot(dx, dz);
					if (len < 0.05) continue;
					const mx = (a.x + b.x) / 2;
					const mz = (a.z + b.z) / 2;
					const rotY = Math.atan2(dx, dz);
					const perpX = (-dz / len) * (path.width / 2 + 0.05);
					const perpZ = (dx / len) * (path.width / 2 + 0.05);
					for (const side of [-1, 1]) {
						edges.push(
							<mesh
								key={`${path.id}-${i}-${side}`}
								position={[mx + perpX * side, PAVEMENT_Y + 0.01, mz + perpZ * side]}
								rotation={[0, rotY, 0]}
							>
								<boxGeometry args={[0.04, 0.025, len]} />
								<meshStandardMaterial color={PAVEMENT_EDGE} flatShading roughness={0.9} />
							</mesh>,
						);
					}
				}
				return edges;
			})}
		</group>
	);
}

const CITY_SILHOUETTES: { x: number; z: number; w: number; d: number; h: number }[] = [
	{ x: -28, z: 26, w: 10, d: 5, h: 3.8 },
	{ x: -10, z: 30, w: 12, d: 4.5, h: 4.4 },
	{ x: 12, z: 29, w: 11, d: 5.5, h: 3.9 },
	{ x: 30, z: 20, w: 8, d: 6, h: 4.1 },
	{ x: 32, z: -4, w: 9, d: 5, h: 3.4 },
	{ x: -26, z: -24, w: 12, d: 5, h: 3.7 },
	{ x: 6, z: -30, w: 10, d: 5, h: 4.0 },
	{ x: -30, z: 2, w: 7, d: 8, h: 4.6 },
];

export function VeilroseCitySilhouettes() {
	return (
		<group>
			{CITY_SILHOUETTES.map((s, i) => (
				<mesh key={i} position={[s.x, s.h / 2, s.z]}>
					<boxGeometry args={[s.w, s.h, s.d]} />
					<meshStandardMaterial color="#3d2e42" flatShading roughness={0.95} transparent opacity={0.48} />
				</mesh>
			))}
		</group>
	);
}

export function VeilroseStreetMouths() {
	const mouths = [{ x: 0, z: 23.5 }, { x: 0, z: -27 }];
	return (
		<group>
			{mouths.map((m, i) => (
				<group key={i} position={[m.x, 0, m.z]}>
					{[-3, 3].map((ox, j) => (
						<mesh key={j} position={[ox, 1.2, 0]}>
							<cylinderGeometry args={[0.07, 0.08, 2.4, 6]} />
							<meshStandardMaterial color="#6b4a3a" flatShading roughness={0.8} />
						</mesh>
					))}
					<mesh position={[0, 2.5, 0]}>
						<boxGeometry args={[7, 0.07, 0.07]} />
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
			{BUILDING_BLOCKS.map((block) => (
				<CityBlockMesh key={block.id} block={block} />
			))}
		</group>
	);
}

export function VeilrosePerimeterBuildings() {
	return <VeilroseQuarterBuildings />;
}

/** @deprecated — guna BUILDING_BLOCKS */
export const QUARTER_BUILDINGS = BUILDING_BLOCKS;
export const PERIMETER_BUILDINGS = BUILDING_BLOCKS;

export function buildingColliderPoints(): never {
	throw new Error('Guna blockColliderPoints dari veilroseCityPlan');
}
