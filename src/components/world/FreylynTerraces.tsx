import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type FreylynTerracesProps = {
	/** Sama seperti landmark lain — struktur kekal separa kelihatan dari
	 * orbit (mercu tanda), butiran (kilauan/kabus) hanya bila rapat. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Freylyn Terraces kini AIR TERJUN RENDAH BERBATU LICIN — bukan lagi teres
 * travertine Pamukkale/Baishuitai (3 pusingan cuba betulkan struktur
 * bertingkat itu tapi sentiasa nampak "tergantung": sfera dasar globe amat
 * rendah-poligon, ~48-64 segmen keliling 360°, tak mampu papar bonjolan
 * bukit sekecil radius 0.22 rad dgn tepat). Reka bentuk baharu duduk RATA
 * di aras tanah — spt prop batu biasa (TerrainProps.tsx) — jadi TIADA
 * bonjolan bukit diperlukan langsung, elak seluruh kelas isu embed/floating.
 */
function buildBlobBoundary(rng: () => number, irregularity: number): (theta: number) => number {
	const a1 = irregularity * (0.55 + rng() * 0.45);
	const p1 = rng() * Math.PI * 2;
	const a2 = irregularity * 0.45 * (0.4 + rng() * 0.6);
	const p2 = rng() * Math.PI * 2;
	return (theta: number) => 1 + a1 * Math.cos(theta + p1) + a2 * Math.cos(2 * theta + p2);
}

function buildBlobGeometry(
	radiusX: number,
	radiusZ: number,
	height: number,
	boundaryFn: (theta: number) => number,
	segments = 12,
): THREE.BufferGeometry {
	const geo = new THREE.CylinderGeometry(1, 1, height, segments, 1, false);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		const angle = Math.atan2(z, x);
		const factor = boundaryFn(angle);
		pos.setXYZ(i, x * radiusX * factor, pos.getY(i), z * radiusZ * factor);
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();
	return geo;
}

/** Batu SUNGAI licin — ikosahedron diperturbasi lembut (bukan tajam/berkelim
 * spt batu gunung berapi), guna smooth-shading (bukan flatShading) supaya
 * benar2 terbaca "licin" spt batu digilap air, kontras dgn batu tajam biasa. */
function buildBoulderGeometry(radius: number, seed: number, squash: number): THREE.BufferGeometry {
	const geo = new THREE.IcosahedronGeometry(radius, 1);
	const rng = seededRng(seed);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const len = Math.hypot(x, y, z) || 1;
		const bump = 1 + (rng() - 0.5) * 0.2;
		pos.setXYZ(i, x * bump, y * bump * squash, z * bump);
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();
	return geo;
}

// Rak atas kecil (mata air) berbeza aras drpd kelompok bawah (tempat air
// jatuh & terkumpul) — jatuhan air RENDAH sengaja (bukan menara tinggi
// spt teres lama) supaya seluruh struktur kekal dekat aras tanah.
const UPPER_Y = 0.05;
const BASE_Y = 0.006;

type Boulder = { geo: THREE.BufferGeometry; x: number; y: number; z: number; rotation: [number, number, number] };

function buildBoulders(): Boulder[] {
	const rng = seededRng(3100);
	const boulders: Boulder[] = [];
	const upperSpots: Array<[number, number]> = [
		[-0.032, -0.026],
		[0.012, -0.032],
		[0.04, -0.016],
	];
	upperSpots.forEach(([x, z], i) => {
		const r = 0.024 + rng() * 0.012;
		boulders.push({
			geo: buildBoulderGeometry(r, 3200 + i * 17, 0.7 + rng() * 0.2),
			x,
			y: UPPER_Y + r * 0.35,
			z,
			rotation: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI],
		});
	});
	const lowerSpots: Array<[number, number]> = [
		[-0.062, 0.026],
		[-0.028, 0.046],
		[0.018, 0.042],
		[0.052, 0.02],
		[0.068, 0.048],
		[-0.05, 0.064],
		[0.012, 0.07],
	];
	lowerSpots.forEach(([x, z], i) => {
		const r = 0.028 + rng() * 0.018;
		boulders.push({
			geo: buildBoulderGeometry(r, 3400 + i * 19, 0.62 + rng() * 0.25),
			x,
			y: BASE_Y + r * 0.4,
			z,
			rotation: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI],
		});
	});
	return boulders;
}

/** Kolam kecil di rak atas (mata air) — sumber air terjun. */
function buildSourcePool(): { geo: THREE.BufferGeometry; x: number; y: number; z: number } {
	const rng = seededRng(4501);
	const boundary = buildBlobBoundary(rng, 0.2);
	const geo = buildBlobGeometry(0.026, 0.02, 0.008, boundary, 12);
	return { geo, x: -0.006, y: UPPER_Y + 0.002, z: -0.024 };
}

/** Kolam utama di kaki air terjun — tempat air jatuh & terkumpul, gema
 * "air berkilau seperti kaca cair" (Codex). */
function buildBasePool(): { geo: THREE.BufferGeometry; x: number; y: number; z: number } {
	const rng = seededRng(4601);
	const boundary = buildBlobBoundary(rng, 0.18);
	const geo = buildBlobGeometry(0.058, 0.05, 0.009, boundary, 14);
	return { geo, x: 0.006, y: BASE_Y + 0.001, z: 0.05 };
}

/** Tekstur jalur air terjun menegak — teknik sama dgn AethirionIsland.tsx. */
function buildCascadeTexture(): THREE.CanvasTexture {
	const w = 16;
	const h = 128;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	for (let x = 0; x < w; x++) {
		const streak = 0.6 + Math.random() * 0.4;
		for (let y = 0; y < h; y++) {
			const fade = 1 - y / h;
			const noise = 0.75 + Math.random() * 0.25;
			const alpha = Math.max(0, streak * fade * fade * noise);
			ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
			ctx.fillRect(x, y, 1, 1);
		}
	}
	const tex = new THREE.CanvasTexture(canvas);
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	return tex;
}

type MistSpot = { position: THREE.Vector3 };

/** Kabus/kilauan halus dekat kaki air terjun (tempat air menghempas). */
function buildMistSpots(): MistSpot[] {
	const rng = seededRng(6701);
	const spots: MistSpot[] = [];
	for (let i = 0; i < 10; i++) {
		const x = (rng() - 0.5) * 0.07;
		const z = 0.01 + rng() * 0.03;
		const y = BASE_Y + 0.01 + rng() * 0.03;
		spots.push({ position: new THREE.Vector3(x, y, z) });
	}
	return spots;
}

export default function FreylynTerraces({ atmosphereBlendRef }: FreylynTerracesProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('freylyn-terraces')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.004), [dir]);

	const boulders = useMemo(() => buildBoulders(), []);
	const sourcePool = useMemo(() => buildSourcePool(), []);
	const basePool = useMemo(() => buildBasePool(), []);
	const mistSpots = useMemo(() => buildMistSpots(), []);
	const mistTexture = useMemo(() => buildSpriteTexture(), []);
	const cascadeTexture = useMemo(() => buildCascadeTexture(), []);
	const mistPositions = useMemo(() => {
		const arr = new Float32Array(mistSpots.length * 3);
		mistSpots.forEach((s, i) => {
			arr[i * 3] = s.position.x;
			arr[i * 3 + 1] = s.position.y;
			arr[i * 3 + 2] = s.position.z;
		});
		return arr;
	}, [mistSpots]);

	const rockMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				// Kelabu-hangat lembap, smoothShading (bukan flatShading) — batu
				// sungai digilap air, licin, bukan tajam/berkelim spt batu gunung.
				color: '#6b6258',
				roughness: 0.42,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const poolMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#3ddcd2',
				emissive: '#15948c',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.15,
				metalness: 0.1,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const cascadeMat = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				map: cascadeTexture,
				color: '#eafffb',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		[cascadeTexture],
	);
	const mistMat = useMemo(
		() =>
			new THREE.PointsMaterial({
				size: 0.03,
				map: mistTexture,
				color: '#ffffff',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				sizeAttenuation: true,
				blending: THREE.AdditiveBlending,
			}),
		[mistTexture],
	);

	const landmarkMats = useMemo(() => [rockMat, poolMat], [rockMat, poolMat]);
	const detailMats = useMemo(() => [cascadeMat], [cascadeMat]);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);

		// Struktur kekal separa kelihatan dari orbit (lantai 0.55) — mercu
		// tanda biome, sama spt Heartbloom/Ascendari.
		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);
		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of detailMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near * 0.9, 0.05);
			mat.visible = mat.opacity > 0.01;
		}

		poolMat.emissiveIntensity = 0.4 * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 0.8));
		// "+=" (bukan "-=") — aliran mesti kelihatan dari ATAS (kolam mata air)
		// ke BAWAH (kolam utama), bukan songsang.
		cascadeTexture.offset.y += 0.5 * 0.016;

		mistMat.opacity = near * 0.5 * (0.6 + 0.4 * Math.sin(clock.elapsedTime * 2.4));
		mistMat.visible = mistMat.opacity > 0.01;
	});

	return (
		<group position={position} quaternion={quaternion}>
			{boulders.map((b, i) => (
				<mesh key={i} geometry={b.geo} material={rockMat} position={[b.x, b.y, b.z]} rotation={b.rotation} />
			))}
			<mesh geometry={sourcePool.geo} material={poolMat} position={[sourcePool.x, sourcePool.y, sourcePool.z]} />
			<mesh geometry={basePool.geo} material={poolMat} position={[basePool.x, basePool.y, basePool.z]} />
			<mesh position={[0, (UPPER_Y + BASE_Y) / 2, -0.006]} material={cascadeMat}>
				<planeGeometry args={[0.05, UPPER_Y - BASE_Y + 0.01, 1, 4]} />
			</mesh>
			{mistSpots.length > 0 ? (
				<points material={mistMat}>
					<bufferGeometry>
						<bufferAttribute
							attach="attributes-position"
							args={[mistPositions, 3]}
							count={mistPositions.length / 3}
							itemSize={3}
						/>
					</bufferGeometry>
				</points>
			) : null}
		</group>
	);
}
