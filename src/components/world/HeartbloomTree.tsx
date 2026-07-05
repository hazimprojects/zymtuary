import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

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

type MistPuff = { offset: THREE.Vector3; phase: number };

/** Kabus lembut mengelilingi pokok pada beberapa ketinggian — bukan cuma
 * hiasan, tapi isyarat visual skala/ketinggian gergasi pokok ini (gema
 * awan berpusar di sekeliling world tree dlm rujukan). */
function buildMistPuffs(): MistPuff[] {
	const rng = seededRng(6602);
	return Array.from({ length: 22 }, () => {
		const angle = rng() * Math.PI * 2;
		const heightBand = rng();
		const r = 0.16 + rng() * 0.1;
		const y = TRUNK_H * 0.3 + heightBand * (TRUNK_H + 0.35);
		const offset = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
		return { offset, phase: rng() };
	});
}

/**
 * Pokok gergasi Heartbloom — tempat kelahiran Auryalis, tumbuh di pulau
 * kecil tengah lembah tasik Heartbloom Isle. Kanopi cendawan DUA tingkat:
 * tingkat-atas duduk RAPAT/bertindih terus di atas tingkat-bawah (bukan
 * disambung dahan berasingan — itu nampak macam pokok kedua terapung),
 * profil cendawan sebenar. Kabus mengelilingi memberi kesan skala/ketinggian.
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
	// Tingkat-atas duduk BERTINDIH terus di atas jasad tingkat-bawah (bukan
	// dinaikkan jauh + disambung dahan berasingan) — kesan cendawan dua
	// tudung bertindih, bukan pokok kedua terapung di atas.
	const tier2Clumps = useMemo(() => buildCanopyClumps(3, 0.08, TRUNK_H + 0.16, [0.06, 0.08], 5502), []);

	const tier1Geo = useMemo(() => mergeClumps(tier1Clumps), [tier1Clumps]);
	const tier2Geo = useMemo(() => mergeClumps(tier2Clumps), [tier2Clumps]);

	const mistPuffs = useMemo(() => buildMistPuffs(), []);
	const mistPositions = useMemo(() => new Float32Array(mistPuffs.length * 3), [mistPuffs.length]);
	const mistGeomRef = useRef<THREE.BufferGeometry>(null);
	const mistMatRef = useRef<THREE.PointsMaterial>(null);
	const mistTexture = useMemo(() => buildSpriteTexture(), []);

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

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		// Tidak macam pokok/objek lain — pokok Heartbloom GERGASI dan sepatutnya
		// kelihatan sbg mercu tanda walau dari orbit jauh (pelawat sepatutnya
		// nampak siluetnya, bukan hilang terus), jadi opacity ada lantai
		// minimum (0.55) drpd 0 — kekayaan penuh (1.0) tetap hanya dlm atmosfera.
		const target = THREE.MathUtils.lerp(0.55, 1, THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1));
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.05);
			mat.visible = mat.opacity > 0.01;
		}

		for (let i = 0; i < mistPuffs.length; i++) {
			const p = mistPuffs[i];
			const bob = Math.sin(clock.elapsedTime * 0.22 + p.phase * Math.PI * 2) * 0.01;
			mistPositions[i * 3] = p.offset.x;
			mistPositions[i * 3 + 1] = p.offset.y + bob;
			mistPositions[i * 3 + 2] = p.offset.z;
		}
		if (mistGeomRef.current) mistGeomRef.current.attributes.position.needsUpdate = true;
		if (mistMatRef.current) {
			const mistTarget = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1) * 0.55;
			mistMatRef.current.opacity = THREE.MathUtils.lerp(mistMatRef.current.opacity, mistTarget, 0.05);
			mistMatRef.current.visible = mistMatRef.current.opacity > 0.01;
		}
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={rootFlareGeo} material={trunkMat} />
			<mesh geometry={trunkGeo} material={trunkMat} />
			<mesh geometry={tier1Geo} material={canopyMat} />
			<mesh geometry={tier2Geo} material={canopyMat} />
			<points>
				<bufferGeometry ref={mistGeomRef}>
					<bufferAttribute attach="attributes-position" args={[mistPositions, 3]} count={mistPositions.length / 3} itemSize={3} />
				</bufferGeometry>
				<pointsMaterial
					ref={mistMatRef}
					size={0.075}
					map={mistTexture}
					color="#eef6ea"
					transparent
					opacity={0}
					depthWrite={false}
					sizeAttenuation
					blending={THREE.NormalBlending}
				/>
			</points>
		</group>
	);
}
