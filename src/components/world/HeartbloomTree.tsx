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
const TRUNK_H = 0.24;

// Heartbloom ialah ciri type 'water' (lembah tasik) dgn heightScale — MESTI
// sepadan dgn heightScale 'heartbloom' dlm worldGlobeConfig.ts. Pangkal pokok
// dianjak SAMA supaya duduk di dasar tasik, bukan terapung di atas air.
const HEARTBLOOM_WATER_HEIGHT_SCALE = 2.8;
const LAKE_INDENT = 0.03 * HEARTBLOOM_WATER_HEIGHT_SCALE;

/** Silinder tirus antara dua titik (r0 di a, r1 di b) — blok binaan batang,
 * dahan & akar (teknik sama dgn segmen kilat/rekahan). */
function addTaperedSegment(
	pieces: THREE.BufferGeometry[],
	a: THREE.Vector3,
	b: THREE.Vector3,
	r0: number,
	r1: number,
	radialSeg = 6,
): void {
	const dir = b.clone().sub(a);
	const len = dir.length();
	if (len < 1e-5) return;
	const geo = new THREE.CylinderGeometry(r1, r0, len, radialSeg);
	geo.translate(0, len / 2, 0);
	geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
	geo.translate(a.x, a.y, a.z);
	pieces.push(geo);
}

function mergePieces(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const p of pieces) p.dispose();
	return merged;
}

/** Batang tirus (lebar di pangkal → nipis di atas) dgn sedikit bengkok
 * organik, kemudian BERCABANG jadi beberapa dahan naik-keluar ke dlm kanopi
 * (gema rujukan: batang yg bercabang ke dlm mahkota, bukan tiang lurus).
 * Pulangkan geometri + hujung dahan (utk letak rumpun kanopi betul-betul di
 * atas dahan). */
function buildTrunkAndBranches(): { geo: THREE.BufferGeometry; branchEnds: THREE.Vector3[]; trunkTop: THREE.Vector3 } {
	const rng = seededRng(7710);
	const pieces: THREE.BufferGeometry[] = [];

	// Batang — 3 segmen, tirus 0.06→0.028, bengkok sedikit.
	const segs = 3;
	let prev = new THREE.Vector3(0, 0.02, 0);
	let r = 0.06;
	const bx = (rng() - 0.5) * 0.03;
	const bz = (rng() - 0.5) * 0.03;
	for (let i = 1; i <= segs; i++) {
		const t = i / segs;
		const next = new THREE.Vector3(bx * t * t, 0.02 + TRUNK_H * t, bz * t * t);
		const rNext = THREE.MathUtils.lerp(0.06, 0.028, t);
		addTaperedSegment(pieces, prev, next, r, rNext, 8);
		prev = next;
		r = rNext;
	}
	const trunkTop = prev.clone();

	// Dahan — 5 bercabang naik-keluar, setiap satu 2 segmen (fork sekali).
	const branchEnds: THREE.Vector3[] = [];
	const branchCount = 5;
	for (let b = 0; b < branchCount; b++) {
		const angle = (b / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.6;
		const outLen = 0.075 + rng() * 0.05;
		const up = 0.05 + rng() * 0.055;
		const mid = trunkTop.clone().add(new THREE.Vector3(Math.cos(angle) * outLen * 0.55, up * 0.65, Math.sin(angle) * outLen * 0.55));
		addTaperedSegment(pieces, trunkTop, mid, 0.026, 0.016, 6);
		const end = mid.clone().add(new THREE.Vector3(Math.cos(angle) * outLen * 0.5, up * 0.5, Math.sin(angle) * outLen * 0.5));
		addTaperedSegment(pieces, mid, end, 0.016, 0.008, 5);
		branchEnds.push(end);
	}

	return { geo: mergePieces(pieces), branchEnds, trunkTop };
}

/** Akar berjejari terselerak keluar dari pangkal ke atas tanah (gema rujukan:
 * akar merebak di atas pentas kecil), tirus & sedikit bengkok. */
function buildRoots(): THREE.BufferGeometry {
	const rng = seededRng(8820);
	const pieces: THREE.BufferGeometry[] = [];
	const rootCount = 7;
	for (let i = 0; i < rootCount; i++) {
		const angle = (i / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.5;
		const outR = 0.1 + rng() * 0.07;
		const start = new THREE.Vector3(0, 0.035, 0);
		const mid = new THREE.Vector3(Math.cos(angle) * outR * 0.5, 0.012, Math.sin(angle) * outR * 0.5);
		const end = new THREE.Vector3(Math.cos(angle) * outR, 0.0, Math.sin(angle) * outR);
		addTaperedSegment(pieces, start, mid, 0.03, 0.018, 5);
		addTaperedSegment(pieces, mid, end, 0.018, 0.005, 4);
	}
	return mergePieces(pieces);
}

/** Mahkota LEBAT & padu — satu rumpun pusat besar + rumpun sederhana di atas
 * setiap hujung dahan + beberapa rumpun kecil di atas utk kubah — bertindih
 * BERAT supaya terbaca sbg SATU jisim organik (bukan beberapa blob berasingan
 * spt sebelum ini). */
function buildCrown(branchEnds: THREE.Vector3[], trunkTop: THREE.Vector3): THREE.BufferGeometry {
	const rng = seededRng(5501);
	const pieces: THREE.BufferGeometry[] = [];
	const crownCenterY = trunkTop.y + 0.08;

	const addClump = (x: number, y: number, z: number, rXZ: number, rY: number) => {
		const g = new THREE.IcosahedronGeometry(1, 1);
		g.scale(rXZ, rY, rXZ);
		g.translate(x, y, z);
		pieces.push(g);
	};

	// Rumpun pusat besar.
	addClump(0, crownCenterY, 0, 0.2, 0.16);
	// Rumpun di atas setiap hujung dahan (sambung mahkota ke dahan).
	for (const e of branchEnds) {
		addClump(e.x * 1.1, e.y + 0.03, e.z * 1.1, 0.11 + rng() * 0.04, 0.1 + rng() * 0.03);
	}
	// Rumpun kecil di atas utk kubah rata-bulat.
	const topCount = 4;
	for (let i = 0; i < topCount; i++) {
		const a = (i / topCount) * Math.PI * 2 + rng();
		const rr = 0.06 + rng() * 0.05;
		addClump(Math.cos(a) * rr, crownCenterY + 0.07 + rng() * 0.03, Math.sin(a) * rr, 0.08 + rng() * 0.03, 0.07 + rng() * 0.02);
	}
	return mergePieces(pieces);
}

/** Pentas diorama kecil — gundukan rumput rendah + beberapa batu kelabu di
 * sekeliling pangkal (gema rujukan: pokok di atas pentas berumput dgn batu). */
function buildGrassMound(): THREE.BufferGeometry {
	const g = new THREE.IcosahedronGeometry(1, 1);
	g.scale(0.22, 0.045, 0.22);
	g.translate(0, 0.01, 0);
	return g;
}

function buildRocks(): THREE.BufferGeometry {
	const rng = seededRng(3310);
	const pieces: THREE.BufferGeometry[] = [];
	const rockCount = 5;
	for (let i = 0; i < rockCount; i++) {
		const a = (i / rockCount) * Math.PI * 2 + (rng() - 0.5) * 0.8;
		const rr = 0.11 + rng() * 0.08;
		const s = 0.018 + rng() * 0.016;
		const g = new THREE.IcosahedronGeometry(1, 0);
		g.scale(s * (0.8 + rng() * 0.5), s * (0.6 + rng() * 0.4), s * (0.8 + rng() * 0.5));
		g.rotateY(rng() * Math.PI * 2);
		g.rotateX((rng() - 0.5) * 0.6);
		g.translate(Math.cos(a) * rr, 0.012, Math.sin(a) * rr);
		pieces.push(g);
	}
	return mergePieces(pieces);
}

type MistPuff = { offset: THREE.Vector3; phase: number };

/** Kabus lembut mengelilingi pokok — isyarat visual skala/ketinggian. */
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
 * Pokok gergasi Heartbloom — tempat kelahiran Auryalis. Direka semula ikut
 * rujukan pokok low-poly: batang tirus BERCABANG ke dlm mahkota, akar merebak
 * di pangkal, mahkota lebat padu (satu jisim, bukan blob berasingan), di atas
 * pentas diorama kecil (gundukan rumput + batu). Kabus mengelilingi memberi
 * kesan skala.
 */
export default function HeartbloomTree({ atmosphereBlendRef }: HeartbloomTreeProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('heartbloom')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS - LAKE_INDENT + 0.006), [dir]);

	const trunk = useMemo(() => buildTrunkAndBranches(), []);
	const rootsGeo = useMemo(() => buildRoots(), []);
	const crownGeo = useMemo(() => buildCrown(trunk.branchEnds, trunk.trunkTop), [trunk]);
	const grassGeo = useMemo(() => buildGrassMound(), []);
	const rocksGeo = useMemo(() => buildRocks(), []);

	const mistPuffs = useMemo(() => buildMistPuffs(), []);
	const mistPositions = useMemo(() => new Float32Array(mistPuffs.length * 3), [mistPuffs.length]);
	const mistGeomRef = useRef<THREE.BufferGeometry>(null);
	const mistMatRef = useRef<THREE.PointsMaterial>(null);
	const mistTexture = useMemo(() => buildSpriteTexture(), []);

	const woodMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#5a3d24', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const rootMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#4a3018', flatShading: true, roughness: 0.9, transparent: true, opacity: 0 }),
		[],
	);
	const canopyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#79b23a',
				emissive: '#3a5216',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.62,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const grassMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#8cbf46', emissive: '#2f4a14', emissiveIntensity: 0.25, flatShading: true, roughness: 0.8, transparent: true, opacity: 0 }),
		[],
	);
	const rockMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#8a8a92', flatShading: true, roughness: 0.95, transparent: true, opacity: 0 }),
		[],
	);

	// Bahagian siluet pokok (batang/akar/kanopi) kekal separa kelihatan dari
	// orbit (lantai 0.55 — mercu tanda). Perincian tanah (rumput/batu) pudar
	// penuh (lantai 0) — hanya kelihatan bila rapat.
	const landmarkMats = useMemo(() => [woodMat, rootMat, canopyMat], [woodMat, rootMat, canopyMat]);
	const groundMats = useMemo(() => [grassMat, rockMat], [grassMat, rockMat]);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);

		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);
		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of groundMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near, 0.05);
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
			const mistTarget = near * 0.5;
			mistMatRef.current.opacity = THREE.MathUtils.lerp(mistMatRef.current.opacity, mistTarget, 0.05);
			mistMatRef.current.visible = mistMatRef.current.opacity > 0.01;
		}
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={grassGeo} material={grassMat} />
			<mesh geometry={rocksGeo} material={rockMat} />
			<mesh geometry={rootsGeo} material={rootMat} />
			<mesh geometry={trunk.geo} material={woodMat} />
			<mesh geometry={crownGeo} material={canopyMat} />
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
