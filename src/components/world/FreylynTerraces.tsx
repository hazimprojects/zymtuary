import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type FreylynTerracesProps = {
	/** Sama seperti landmark lain — struktur kekal separa kelihatan dari
	 * orbit (mercu tanda), butiran (kilauan) hanya bila rapat. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Reka bentuk lama guna cincin sepusat (konsentrik) — rupanya spt "pastri
 * berlapis" / UFO bulat simetri, BUKAN spt rujukan sebenar (Pamukkale/
 * Baishuitai). Teres sebenar ialah BANJARAN kolam kecil tak sekata yg
 * melimpah menuruni cerun dlm SATU arah, berlorek/berlekuk organik, bukan
 * bulatan sepusat sekeliling satu pusat. Reka semula ikut "baris" (rows)
 * menuruni cerun (arah Z tempatan), setiap baris ada beberapa kolam
 * berasingan bentuk blob tak sekata (elips + gangguan harmonik sudut).
 */
function buildBlobBoundary(rng: () => number, irregularity: number): (theta: number) => number {
	const a1 = irregularity * (0.55 + rng() * 0.45);
	const p1 = rng() * Math.PI * 2;
	const a2 = irregularity * 0.45 * (0.4 + rng() * 0.6);
	const p2 = rng() * Math.PI * 2;
	return (theta: number) => 1 + a1 * Math.cos(theta + p1) + a2 * Math.cos(2 * theta + p2);
}

/** Silinder rendah/sederhana-poli diperturbasi per-sudut + skala elips —
 * teknik sama dgn buildMesaGeometry (AethirionIsland.tsx) tapi jejari x/z
 * berasingan supaya blob boleh jadi bujur (bukan bulat genap). */
function buildBlobGeometry(
	radiusX: number,
	radiusZ: number,
	height: number,
	boundaryFn: (theta: number) => number,
	segments = 10,
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

type RowDef = { z: number; width: number; cells: number; yTop: number };

// 5 baris menuruni cerun (z meningkat = makin ke hadapan/rendah), makin
// lebar & makin ramai kolam ke bawah — gema rujukan (teres jenis kipas
// yg melebar semasa turun bukit).
const ROWS: RowDef[] = [
	{ z: -0.065, width: 0.075, cells: 2, yTop: 0.044 },
	{ z: -0.03, width: 0.11, cells: 3, yTop: 0.033 },
	{ z: 0.008, width: 0.145, cells: 3, yTop: 0.022 },
	{ z: 0.048, width: 0.17, cells: 4, yTop: 0.011 },
	{ z: 0.088, width: 0.185, cells: 4, yTop: 0 },
];

const RIM_HEIGHT = 0.016;
const POOL_HEIGHT = 0.008;
const POOL_SCALE = 0.78;
const CELL_RADIUS_Z = 0.042;

// Mesti SEPADAN dgn pekali "falloff * X * heightScale" bagi type 'terraces'
// dlm globeShader.ts (terrainHeight) pd falloff=1 (pusat ciri, heightScale
// lalai 1) — permintaan pengguna: teres mesti melekat pada bukit sebenar,
// bukan terapung di atas lantai rata. Tanpa ini asas struktur akan
// tenggelam/terapung drpd permukaan bukit yg kini benar2 ditinggikan.
const MOUND_RISE = 0.065;

type Cell = {
	rimGeo: THREE.BufferGeometry;
	poolGeo: THREE.BufferGeometry;
	x: number;
	y: number;
	z: number;
	radiusX: number;
	radiusZ: number;
};

function buildCells(): Cell[] {
	const cells: Cell[] = [];
	ROWS.forEach((row, ri) => {
		const cellRadiusX = (row.width / Math.max(row.cells, 1)) * 0.62;
		for (let ci = 0; ci < row.cells; ci++) {
			const rng = seededRng(4400 + ri * 97 + ci * 13);
			const t = row.cells > 1 ? ci / (row.cells - 1) : 0.5;
			let x = THREE.MathUtils.lerp(-row.width / 2 + cellRadiusX * 0.7, row.width / 2 - cellRadiusX * 0.7, t);
			x += (rng() - 0.5) * cellRadiusX * 0.3;
			const z = row.z + (rng() - 0.5) * 0.01;
			const y = row.yTop + (rng() - 0.5) * 0.003;
			const rimBoundary = buildBlobBoundary(rng, 0.22);
			const rimGeo = buildBlobGeometry(cellRadiusX, CELL_RADIUS_Z, RIM_HEIGHT, rimBoundary, 10);
			const poolBoundary = buildBlobBoundary(rng, 0.16);
			const poolGeo = buildBlobGeometry(
				cellRadiusX * POOL_SCALE,
				CELL_RADIUS_Z * POOL_SCALE,
				POOL_HEIGHT,
				poolBoundary,
				10,
			);
			cells.push({ rimGeo, poolGeo, x, y, z, radiusX: cellRadiusX, radiusZ: CELL_RADIUS_Z });
		}
	});
	return cells;
}

type SparkleSpot = { position: THREE.Vector3 };

/** Kilauan lembut atas kolam — "air berkilau seperti kaca cair" (Codex). */
function buildSparkleSpots(cells: Cell[]): SparkleSpot[] {
	const rng = seededRng(6601);
	const spots: SparkleSpot[] = [];
	for (const cell of cells) {
		if (rng() < 0.65) {
			const count = 1 + Math.floor(rng() * 2);
			for (let i = 0; i < count; i++) {
				const ox = (rng() - 0.5) * cell.radiusX * 0.9;
				const oz = (rng() - 0.5) * cell.radiusZ * 0.9;
				spots.push({ position: new THREE.Vector3(cell.x + ox, cell.y - POOL_HEIGHT * 0.3, cell.z + oz) });
			}
		}
	}
	return spots;
}

/** Tekstur jalur air terjun menegak — teknik sama dgn AethirionIsland.tsx
 * (legap dekat atas, pudar ke bawah, jalur rawak). */
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

type CascadeSpot = { x: number; y: number; z: number; width: number; height: number };

/** Panel air melimpah rendah antara setiap pasangan baris — gantung tegak
 * (normal +Z), letak DoubleSide supaya arah menghadap x tak penting. */
function buildCascadeSpots(): CascadeSpot[] {
	const spots: CascadeSpot[] = [];
	for (let i = 0; i < ROWS.length - 1; i++) {
		const a = ROWS[i];
		const b = ROWS[i + 1];
		const drop = a.yTop - b.yTop;
		if (drop < 0.002) continue;
		spots.push({
			x: 0,
			y: (a.yTop + b.yTop) / 2,
			z: (a.z + b.z) / 2 + CELL_RADIUS_Z * 0.35,
			width: Math.min(a.width, b.width) * 0.7,
			height: drop + 0.006,
		});
	}
	return spots;
}

// Baris terakhir (ROWS[4]) berakhir pd cerun bukit, JAUH sebelum tepi
// jejari ciri 'freylyn-terraces-tasik' (tasik sekeliling) bermula — permintaan
// pengguna: air patut kelihatan terus mengalir menuruni cerun & melimpah jadi
// tasik itu, spt air terjun, bukan berhenti tiba-tiba di tepi baris terakhir.
const LAST_ROW = ROWS[ROWS.length - 1];
const OVERFLOW_Z = LAST_ROW.z + CELL_RADIUS_Z + 0.09;
const OVERFLOW_DROP = MOUND_RISE + 0.03;

function buildOverflowCascade(): CascadeSpot {
	return {
		x: 0,
		y: LAST_ROW.yTop - OVERFLOW_DROP / 2,
		z: OVERFLOW_Z,
		width: LAST_ROW.width * 0.5,
		height: OVERFLOW_DROP,
	};
}

/** Kolam kutipan cetek di kaki cerun — tempat limpahan terkumpul sebelum
 * bercantum dgn tasik sekeliling (ciri shader 'freylyn-terraces-tasik'). */
function buildCollectionPool(): { geo: THREE.BufferGeometry; y: number; z: number } {
	const rng = seededRng(8801);
	const boundary = buildBlobBoundary(rng, 0.2);
	const geo = buildBlobGeometry(0.078, 0.055, 0.01, boundary, 12);
	return { geo, y: LAST_ROW.yTop - OVERFLOW_DROP - 0.005, z: OVERFLOW_Z + 0.06 };
}

export default function FreylynTerraces({ atmosphereBlendRef }: FreylynTerracesProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('freylyn-terraces')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + MOUND_RISE + 0.004), [dir]);

	const cells = useMemo(() => buildCells(), []);
	const sparkleSpots = useMemo(() => buildSparkleSpots(cells), [cells]);
	const cascadeSpots = useMemo(() => [...buildCascadeSpots(), buildOverflowCascade()], []);
	const collectionPool = useMemo(() => buildCollectionPool(), []);
	const sparkleTexture = useMemo(() => buildSpriteTexture(), []);
	const cascadeTexture = useMemo(() => buildCascadeTexture(), []);
	const sparklePositions = useMemo(() => {
		const arr = new Float32Array(sparkleSpots.length * 3);
		sparkleSpots.forEach((s, i) => {
			arr[i * 3] = s.position.x;
			arr[i * 3 + 1] = s.position.y;
			arr[i * 3 + 2] = s.position.z;
		});
		return arr;
	}, [sparkleSpots]);

	const shelfMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				// Putih-krem CERAH dgn emissive halus — pastikan ia terbaca sbg
				// travertine putih walau di bawah ambient sejuk scene ini.
				color: '#faf6ec',
				emissive: '#e8dfc8',
				emissiveIntensity: 0.3,
				flatShading: true,
				roughness: 0.65,
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
	const sparkleMat = useMemo(
		() =>
			new THREE.PointsMaterial({
				size: 0.026,
				map: sparkleTexture,
				color: '#eafffa',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				sizeAttenuation: true,
				blending: THREE.AdditiveBlending,
			}),
		[sparkleTexture],
	);

	const landmarkMats = useMemo(() => [shelfMat, poolMat], [shelfMat, poolMat]);
	const detailMats = useMemo(() => [cascadeMat], [cascadeMat]);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);

		// Struktur teres kekal separa kelihatan dari orbit (lantai 0.55) —
		// mercu tanda biome, sama spt Heartbloom/Ascendari.
		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);
		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of detailMats) {
			// Dinaikkan drpd 0.7 — limpahan air mesti kelihatan jelas (permintaan
			// pengguna), bukan jalur telus nyaris tak nampak.
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near * 0.9, 0.05);
			mat.visible = mat.opacity > 0.01;
		}

		poolMat.emissiveIntensity = 0.4 * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 0.8));
		cascadeTexture.offset.y -= 0.5 * 0.016;

		sparkleMat.opacity = near * 0.55 * (0.6 + 0.4 * Math.sin(clock.elapsedTime * 2.2));
		sparkleMat.visible = sparkleMat.opacity > 0.01;
	});

	return (
		<group position={position} quaternion={quaternion}>
			{cells.map((cell, i) => (
				<group key={i}>
					<mesh geometry={cell.rimGeo} material={shelfMat} position={[cell.x, cell.y - RIM_HEIGHT / 2, cell.z]} />
					<mesh
						geometry={cell.poolGeo}
						material={poolMat}
						position={[cell.x, cell.y - 0.002 - POOL_HEIGHT / 2, cell.z]}
					/>
				</group>
			))}
			{cascadeSpots.map((c, i) => (
				<mesh key={i} position={[c.x, c.y, c.z]} material={cascadeMat}>
					<planeGeometry args={[c.width, c.height, 1, 4]} />
				</mesh>
			))}
			<mesh geometry={collectionPool.geo} material={poolMat} position={[0, collectionPool.y, collectionPool.z]} />
			{sparkleSpots.length > 0 ? (
				<points material={sparkleMat}>
					<bufferGeometry>
						<bufferAttribute
							attach="attributes-position"
							args={[sparklePositions, 3]}
							count={sparklePositions.length / 3}
							itemSize={3}
						/>
					</bufferGeometry>
				</points>
			) : null}
		</group>
	);
}
