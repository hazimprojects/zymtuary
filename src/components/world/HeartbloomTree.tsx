import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';

type HeartbloomTreeProps = {
	/** Sama seperti Vegetation/Aethirion — pokok gergasi hanya kelihatan
	 * sepenuhnya apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

const TRUNK_H = 0.22;

// Heartbloom ialah ciri type 'water' (lembah tasik) dgn heightScale — MESTI
// sepadan dgn heightScale 'heartbloom' dlm worldGlobeConfig.ts. Pangkal
// pokok perlu dianjak SAMA jumlah supaya duduk di dasar tasik (pulau kecil
// tersirat), bukan terapung di udara di atas permukaan air.
const HEARTBLOOM_WATER_HEIGHT_SCALE = 2.8;
const LAKE_INDENT = 0.03 * HEARTBLOOM_WATER_HEIGHT_SCALE;

type CanopyClump = { position: THREE.Vector3; radiusXZ: number; radiusY: number };

/** Serak beberapa "rumpun" daun rata/bujur pada bulatan tak-seragam
 * (bukan satu kubah bulat sempurna) — profil bonsai/cendawan bertingkat,
 * bukan pokok pine simetri. */
function buildCanopyClumps(count: number, ringRadius: number, baseY: number, sizeRange: [number, number], seed: number): CanopyClump[] {
	const rng = seededRng(seed);
	const clumps: CanopyClump[] = [];
	for (let i = 0; i < count; i++) {
		const angle = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.7;
		const r = ringRadius * (0.7 + rng() * 0.55);
		const x = Math.cos(angle) * r;
		const z = Math.sin(angle) * r;
		const y = baseY + (rng() - 0.5) * 0.045;
		const size = sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]);
		clumps.push({ position: new THREE.Vector3(x, y, z), radiusXZ: size, radiusY: size * (0.55 + rng() * 0.15) });
	}
	return clumps;
}

function makeClumpGeometry(clump: CanopyClump): THREE.BufferGeometry {
	const g = new THREE.IcosahedronGeometry(1, 1);
	g.scale(clump.radiusXZ, clump.radiusY, clump.radiusXZ);
	g.translate(clump.position.x, clump.position.y, clump.position.z);
	return g;
}

function mergeClumps(clumps: CanopyClump[]): THREE.BufferGeometry {
	const pieces = clumps.map(makeClumpGeometry);
	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const p of pieces) p.dispose();
	return merged;
}

/** Dahan nipis condong dari batang ke pangkal setiap rumpun tingkat-bawah —
 * gema "beberapa dahan macam bonsai" (bukan kanopi licin tanpa dahan kelihatan). */
function makeBranchGeometry(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
	const dir = to.clone().sub(from);
	const len = dir.length();
	const g = new THREE.CylinderGeometry(0.007, 0.016, len, 5);
	g.translate(0, len / 2, 0);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
	g.translate(from.x, from.y, from.z);
	return g;
}

function mergeBranches(from: THREE.Vector3, targets: THREE.Vector3[]): THREE.BufferGeometry {
	const pieces = targets.map((t) => makeBranchGeometry(from, t));
	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const p of pieces) p.dispose();
	return merged;
}

/**
 * Pokok gergasi Heartbloom — tempat kelahiran Auryalis, tumbuh di pulau
 * kecil tengah lembah tasik Heartbloom Isle. Kanopi cendawan DUA tingkat
 * (tingkat atas jelas lebih kecil drpd tingkat bawah), setiap tingkat
 * terdiri drpd beberapa rumpun daun tak-seragam (bukan kubah bulat licin)
 * bersambung ke batang melalui dahan nipis condong — profil bonsai/world
 * tree, cukup lebar (jejari dunia keseluruhan ~0.3) utk mencecah banjaran
 * gunung sekeliling.
 */
export default function HeartbloomTree({ atmosphereBlendRef }: HeartbloomTreeProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('heartbloom')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS - LAKE_INDENT + 0.006), [dir]);

	const rootFlareGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.09, 0.06, 8);
		g.translate(0, 0.03, 0);
		return g;
	}, []);
	const trunkGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.032, 0.05, TRUNK_H, 7);
		g.translate(0, TRUNK_H / 2 + 0.03, 0);
		return g;
	}, []);

	const tier1Clumps = useMemo(() => buildCanopyClumps(5, 0.17, TRUNK_H + 0.09, [0.11, 0.15], 5501), []);
	const tier2Clumps = useMemo(() => buildCanopyClumps(3, 0.08, TRUNK_H + 0.27, [0.06, 0.08], 5502), []);

	const tier1Geo = useMemo(() => mergeClumps(tier1Clumps), [tier1Clumps]);
	const tier2Geo = useMemo(() => mergeClumps(tier2Clumps), [tier2Clumps]);
	const branchGeo = useMemo(() => {
		const from = new THREE.Vector3(0, TRUNK_H + 0.03, 0);
		return mergeBranches(
			from,
			tier1Clumps.map((c) => c.position.clone().multiplyScalar(0.72)),
		);
	}, [tier1Clumps]);

	const trunkMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#5a3d24', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const canopyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#a8c94a',
				emissive: '#4a5a1a',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.65,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const materials = useMemo(() => [trunkMat, canopyMat], [trunkMat, canopyMat]);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={rootFlareGeo} material={trunkMat} />
			<mesh geometry={trunkGeo} material={trunkMat} />
			<mesh geometry={branchGeo} material={trunkMat} />
			<mesh geometry={tier1Geo} material={canopyMat} />
			<mesh geometry={tier2Geo} material={canopyMat} />
		</group>
	);
}
