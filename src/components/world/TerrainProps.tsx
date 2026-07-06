import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import {
	FISSURE_CENTERS,
	GLOBE_RADIUS,
	LANDMARK_FEATURES,
	MAX_CRACK_SEGMENTS,
	directionFromThetaY,
	generateCrackNetwork,
	localToDir,
	seededRng,
	tangentBasis,
	type LandmarkFeature,
} from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type TerrainPropsProps = {
	/** Sama seperti Vegetation/Aethirion — perincian ini hanya kelihatan
	 * sepenuhnya apabila pelawat masuk atmosfera, bukan dari orbit jauh. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

type PropSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: THREE.Vector3;
	warm: boolean;
	variant: number;
};

const UP = new THREE.Vector3(0, 1, 0);

function radialSpot(
	dirVec: THREE.Vector3,
	heightOffset: number,
	scale: THREE.Vector3,
	spin: number,
	warm: boolean,
	tilt = 0,
	tiltAxis?: THREE.Vector3,
	variant = 0,
): PropSpot {
	const position = dirVec.clone().multiplyScalar(GLOBE_RADIUS + heightOffset);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dirVec);
	quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
	if (tilt !== 0 && tiltAxis) {
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(tiltAxis, tilt));
	}
	return { position, quaternion, scale, warm, variant };
}

/** Gugusan batu kecil rendah-poli — badlands & gunung (termasuk obsidian)
 * sahaja, TIADA di kawasan hijau/laut. Guna satu geometri kongsi (unit
 * icosahedron) diskala tak seragam + putaran rawak setiap instance untuk
 * variasi bentuk, elakkan jitter per-verteks yang mahal pada bilangan besar. */
function densityForRock(feature: LandmarkFeature): number {
	// ringMode (banjaran/benteng gegelang) sudah ada relief+warna batu
	// sendiri drpd shader — serakan cakera penuh di sini akan menutupi
	// lembah/puncak yg dikelilinginya (cth. tasik Heartbloom) dgn batu.
	if (feature.ringMode) return 0;
	if (feature.type === 'mountain') return 220;
	if (feature.type === 'arid') return 180;
	// Batu-batu bertaburan di lantai hutan (gema rujukan: batu kelabu
	// berselerak antara pokok pain) — jauh lebih jarang drpd padang batu
	// gunung, sekadar aksen kedalaman/realistik, bukan medan batu penuh.
	if (feature.type === 'green' || feature.type === 'tree') return 45;
	return 0;
}

function buildRockSpots(): PropSpot[] {
	const spots: PropSpot[] = [];
	for (const feature of LANDMARK_FEATURES) {
		const count = densityForRock(feature);
		if (count === 0) continue;

		const center = directionFromThetaY(feature.theta, feature.y);
		const { u, v } = tangentBasis(center);
		const rng = seededRng(feature.theta * 500 + feature.y * 3000 + count);
		const warm = feature.y > 0;

		const innerFrac = Math.min(0.98, (feature.innerExclusion ?? 0) / (feature.radius * 0.92));
		for (let i = 0; i < count; i++) {
			// innerFrac>0 elak batu terserak di atas tasik kecil di tengah
			// (cth. padang-bunga) — sama teknik gegelang dgn Vegetation.tsx.
			const r = Math.sqrt(innerFrac * innerFrac + rng() * (1 - innerFrac * innerFrac)) * feature.radius * 0.92;
			const angle = rng() * Math.PI * 2;
			const lu = Math.cos(angle) * r;
			const lv = Math.sin(angle) * r;
			const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));

			const s = 0.012 + rng() * 0.02;
			const scale = new THREE.Vector3(s * (0.75 + rng() * 0.55), s * (0.5 + rng() * 0.4), s * (0.75 + rng() * 0.55));
			const tiltAxis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
			spots.push(radialSpot(dir, 0.003, scale, rng() * Math.PI * 2, warm, (rng() - 0.5) * 0.7, tiltAxis));
		}
	}
	return spots;
}

type FlowerSpot = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number; color: THREE.Color };

const FLOWER_COLORS = ['#f2e2a0', '#e8a8c4', '#c9a0e0', '#ffffff'] as const;

/** Satu kluster bunga liar — tangkai nipis + kuntum kecil di hujung.
 * Geometri KONGSI (satu template), warna & saiz beza per-instance via
 * instanceColor (teknik sama dgn Vegetation.tsx) supaya padang nampak
 * pelbagai warna bunga, bukan satu warna rata berulang. */
function makeFlowerClusterGeometry(): THREE.BufferGeometry {
	// Saiz sengaja SANGAT kecil — aksen rumput/bunga tanah, BUKAN pokok mini.
	// Tinggi puncak ~0.008 pd skala 1 (~1/3 tinggi pokok terkecil di
	// Vegetation.tsx yg kini ~0.014+ selepas pembesaran pokok round terdahulu).
	const stem = new THREE.CylinderGeometry(0.0004, 0.0006, 0.005, 4);
	stem.translate(0, 0.0025, 0);
	const bloom = new THREE.IcosahedronGeometry(0.0022, 0);
	bloom.translate(0, 0.0057, 0);
	// PENTING: Cylinder berindeks lalai, Icosahedron tak berindeks —
	// toNonIndexed() KEDUA-DUA dahulu elak mergeBufferGeometries gagal
	// senyap (pengajaran drpd bug MendariTownscape.tsx round terdahulu).
	const nonIndexed = [stem, bloom].map((g) => g.toNonIndexed());
	const merged = mergeBufferGeometries(nonIndexed, false);
	if (!merged) throw new Error('makeFlowerClusterGeometry: mergeBufferGeometries gagal');
	const toDispose = new Set([stem, bloom, ...nonIndexed]);
	for (const g of toDispose) g.dispose();
	return merged;
}

/** Kluster bunga liar diserak dlm gegelang [innerExclusion, radius] — elak
 * bunga di atas tasik (jika ada) tapi kekal merata sisa padang, termasuk
 * bertindih sedikit dgn zon hutan (peralihan padang→hutan yg semula jadi). */
function buildFlowerSpots(): FlowerSpot[] {
	const spots: FlowerSpot[] = [];
	for (const feature of LANDMARK_FEATURES) {
		if (!feature.flowers) continue;

		const center = directionFromThetaY(feature.theta, feature.y);
		const { u, v } = tangentBasis(center);
		const rng = seededRng(feature.theta * 600 + feature.y * 5000 + 707);
		// "bunga-bunga yang banyak" — dinaikkan drpd 90 asal, terutama krn
		// batu besar dah dibuang (padang-bunga kini type 'meadow', tak
		// termasuk dlm senarai layak batu) & ada lebih ruang lapang.
		const count = 260;
		const outerR = feature.radius * 0.9;
		const innerFrac = Math.min(0.98, (feature.innerExclusion ?? 0) * 0.8 / outerR);

		for (let i = 0; i < count; i++) {
			const rho = Math.sqrt(innerFrac * innerFrac + rng() * (1 - innerFrac * innerFrac));
			const angle = rng() * Math.PI * 2;
			const r = rho * outerR;
			const lu = Math.cos(angle) * r;
			const lv = Math.sin(angle) * r;
			const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));
			const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
			const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
			quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
			const scale = 0.6 + rng() * 0.5;
			const color = new THREE.Color(FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)]);
			spots.push({ position, quaternion, scale, color });
		}
	}
	return spots;
}

const CRYSTAL_VARIANT_COUNT = 4;

/** Satu "cebisan" kristal condong — bukan diamond simetri, tapi tirus
 * sehala macam serpihan sebenar tumbuh dari retakan. */
function makeShardGeometry(radiusBottom: number, height: number, segments: number, leanX: number, leanZ: number): THREE.BufferGeometry {
	const geo = new THREE.ConeGeometry(radiusBottom, height, segments, 1);
	geo.translate(0, height / 2, 0);
	geo.rotateX(leanX);
	geo.rotateZ(leanZ);
	return geo;
}

/** Kluster kristal — gabungan 2-4 cebisan tirus pada saiz/sudut berlainan
 * dicantum jadi satu geometri (guna mergeBufferGeometries), macam formasi
 * kristal sebenar tumbuh berkelompok dari batu, bukan satu bentuk diamond
 * generik tunggal. Beberapa variant dijana sekali sahaja dan dikongsi. */
function makeCrystalClusterGeometry(seed: number): THREE.BufferGeometry {
	const rng = seededRng(seed);
	const shardCount = 2 + Math.floor(rng() * 3);
	const pieces: THREE.BufferGeometry[] = [];

	for (let i = 0; i < shardCount; i++) {
		const radiusBottom = 0.14 + rng() * 0.14;
		const height = 0.55 + rng() * 0.85;
		const segments = 5 + Math.floor(rng() * 2);
		const leanX = (rng() - 0.5) * 0.9;
		const leanZ = (rng() - 0.5) * 0.9;
		const shard = makeShardGeometry(radiusBottom, height, segments, leanX, leanZ);
		const offsetU = (rng() - 0.5) * 0.4;
		const offsetV = (rng() - 0.5) * 0.4;
		shard.translate(offsetU, 0, offsetV);
		shard.rotateY(rng() * Math.PI * 2);
		pieces.push(shard);
	}

	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const piece of pieces) piece.dispose();
	return merged;
}

/** Kristal kecil bercahaya sepanjang rekahan Ignisara (lava, oren) dan
 * Nivira (ais, biru-putih) — diserak mengikut segmen retak SEBENAR (data
 * sama dengan glow rekahan dalam shader), dibenamkan sedikit (bukan
 * terapung di atas) dan dicondongkan rawak macam serpihan tumbuh keluar
 * dari mulut retak, bukan berdiri tegak sempurna. */
function buildCrystalSpots(): PropSpot[] {
	const spots: PropSpot[] = [];
	const perFissureMax = Math.floor(MAX_CRACK_SEGMENTS / FISSURE_CENTERS.length);

	for (const fissure of FISSURE_CENTERS) {
		const center = directionFromThetaY(fissure.theta, fissure.y);
		const segments = generateCrackNetwork(center, fissure.radius, fissure.seed, perFissureMax).filter(
			(s) => s.width > 0.0001,
		);
		const rng = seededRng(fissure.seed * 31 + 5);
		const warm = fissure.y > 0;

		for (const seg of segments) {
			const a = new THREE.Vector3(...seg.a);
			const b = new THREE.Vector3(...seg.b);
			const perSeg = 10;
			for (let i = 0; i < perSeg; i++) {
				const t = rng();
				const along = a.clone().lerp(b, t).normalize();
				const s = 0.006 + rng() * 0.012;
				const scale = new THREE.Vector3(s, s, s);
				const tiltAxis = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).normalize();
				const variant = Math.floor(rng() * CRYSTAL_VARIANT_COUNT);
				spots.push(radialSpot(along, -0.004, scale, rng() * Math.PI * 2, warm, (rng() - 0.5) * 0.8, tiltAxis, variant));
			}
		}
	}
	return spots;
}

/** Rekahan Ignisara sekali gus ialah Abythralis Grotto (Codex — "celah-celah
 * gua yang menghubungkan Ignisara dengan Abythralis Grotto"), rumah
 * Pyrauchs: "cahaya keemasan berkelip lembut dan air hangat mengalir di
 * antara akar purba". Tiga lapisan ditambah KHUSUS di lokasi ini (bukan
 * Rekahan Nivira — itu ais, lore berlainan) supaya identiti gua wujud
 * bersama rekahan lava sedia ada, bukan menggantikannya. */
const ABYTHRALIS_GROTTO_FISSURE_ID = 'ignisara-rekahan';

function findAbythralisGrottoFissure() {
	return FISSURE_CENTERS.find((f) => f.id === ABYTHRALIS_GROTTO_FISSURE_ID) ?? null;
}

type GlowSpot = { dir: THREE.Vector3; baseHeight: number; phase: number };

/** Cahaya keemasan lembut berkelip — sprite sama teknik dgn kabus, tapi
 * warna hangat keemasan & flicker lebih ketara (opacity berdenyut, bukan
 * sekadar terapung), macam pijar Pyrauchs & lorong gua yg diterangi lembut. */
function buildGrottoGlowSpots(): GlowSpot[] {
	const fissure = findAbythralisGrottoFissure();
	if (!fissure) return [];
	const center = directionFromThetaY(fissure.theta, fissure.y);
	const { u, v } = tangentBasis(center);
	const rng = seededRng(fissure.seed * 53 + 11);
	const spots: GlowSpot[] = [];
	for (let i = 0; i < 26; i++) {
		const r = Math.sqrt(rng()) * fissure.radius * 0.85;
		const angle = rng() * Math.PI * 2;
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));
		spots.push({ dir, baseHeight: 0.02 + rng() * 0.035, phase: rng() });
	}
	return spots;
}

type PoolSpot = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number };

/** Kolam air hangat kecil terselit antara batu-batu rekahan — cakera rendah
 * emas-amber, bukan tasik biasa (warna air standard terlalu sejuk/teal
 * utk suasana gua bercahaya keemasan). */
function buildGrottoPoolSpots(): PoolSpot[] {
	const fissure = findAbythralisGrottoFissure();
	if (!fissure) return [];
	const center = directionFromThetaY(fissure.theta, fissure.y);
	const { u, v } = tangentBasis(center);
	const rng = seededRng(fissure.seed * 67 + 19);
	const spots: PoolSpot[] = [];
	for (let i = 0; i < 7; i++) {
		const r = Math.sqrt(rng()) * fissure.radius * 0.7;
		const angle = rng() * Math.PI * 2;
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));
		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.0035);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		const scale = 0.022 + rng() * 0.02;
		spots.push({ position, quaternion, scale });
	}
	return spots;
}

function makeGrottoPoolGeometry(): THREE.BufferGeometry {
	// Cakera rendah tak sekata (7 sisi, bukan bulatan genap) — kolam kecil
	// semula jadi, bukan bentuk geometri sempurna.
	const geo = new THREE.CylinderGeometry(1, 0.88, 0.05, 7);
	return geo;
}

type RootSpot = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number };

/** Akar purba melilit/menjalar antara batu — kluster tirus condong dari
 * satu titik pangkal (teknik sama dgn makeCrystalClusterGeometry) tapi
 * bentuk kayu bengkok, bukan kristal tirus tajam. */
function makeAncientRootGeometry(seed: number): THREE.BufferGeometry {
	const rng = seededRng(seed);
	const rootCount = 3 + Math.floor(rng() * 2);
	const pieces: THREE.BufferGeometry[] = [];
	for (let i = 0; i < rootCount; i++) {
		const len = 0.05 + rng() * 0.055;
		const rBottom = 0.009 + rng() * 0.007;
		const rTop = rBottom * 0.5;
		const seg = new THREE.CylinderGeometry(rTop, rBottom, len, 5);
		seg.translate(0, len / 2, 0);
		seg.rotateX((rng() - 0.5) * 2.3);
		seg.rotateZ((rng() - 0.5) * 2.3);
		seg.translate((rng() - 0.5) * 0.018, 0, (rng() - 0.5) * 0.018);
		pieces.push(seg);
	}
	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const p of pieces) p.dispose();
	return merged;
}

const ROOT_VARIANT_COUNT = 3;

function buildGrottoRootSpots(): RootSpot[] {
	const fissure = findAbythralisGrottoFissure();
	if (!fissure) return [];
	const center = directionFromThetaY(fissure.theta, fissure.y);
	const { u, v } = tangentBasis(center);
	const rng = seededRng(fissure.seed * 83 + 29);
	const spots: RootSpot[] = [];
	for (let i = 0; i < 16; i++) {
		const r = Math.sqrt(rng()) * fissure.radius * 0.95;
		const angle = rng() * Math.PI * 2;
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));
		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.004);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		const scale = 0.7 + rng() * 0.7;
		spots.push({ position, quaternion, scale });
	}
	return spots;
}

type CloudPuff = {
	dir: THREE.Vector3;
	baseHeight: number;
	phase: number;
	speed: number;
	warm: boolean;
};

/** Kepulan wap/kabus (bukan poligon) berhampiran kawasan gunung & hijau/
 * pokok — dijana sebagai partikel sprite lembut (sama teknik dgn ember/
 * salji) supaya kelihatan macam kabus pekat bertumpuk, bukan bentuk 3D
 * bersegi. Beberapa puff bertindih rapat setiap "gumpalan" untuk kesan
 * pekat, terapung rendah dan hanyut perlahan (bukan naik ke langit). */
function densityForCloud(feature: LandmarkFeature): number {
	if (feature.ringMode) return 0;
	if (feature.type === 'mountain') return 5;
	if (feature.type === 'green' || feature.type === 'tree' || feature.type === 'meadow') return 4;
	return 0;
}

function buildCloudPuffs(): CloudPuff[] {
	const puffs: CloudPuff[] = [];
	for (const feature of LANDMARK_FEATURES) {
		const clumps = densityForCloud(feature);
		if (clumps === 0) continue;

		const center = directionFromThetaY(feature.theta, feature.y);
		const { u, v } = tangentBasis(center);
		const rng = seededRng(feature.theta * 800 + feature.y * 4000 + 99);
		const warm = feature.y > 0;

		for (let c = 0; c < clumps; c++) {
			const r = Math.sqrt(rng()) * feature.radius * 1.05;
			const angle = rng() * Math.PI * 2;
			const cu = Math.cos(angle) * r;
			const cv = Math.sin(angle) * r;
			const puffsInClump = 7 + Math.floor(rng() * 5);

			// Kabus hutan MESTI terapung DI ATAS puncak kanopi pokok, bukan di
			// paras/bawahnya — pokok (Vegetation.tsx) boleh capai ~0.05 unit di
			// atas permukaan, jadi baseHeight rendah (0.03-0.08) sebelum ini
			// bertindih/di bawah kanopi utk kawasan hutan. Gunung kekal rendah
			// (kabus kaki bukit), hutan/pokok dinaikkan dgn ketara.
			const isForestCloud = feature.type === 'green' || feature.type === 'tree' || feature.type === 'meadow';
			for (let p = 0; p < puffsInClump; p++) {
				const ou = cu + (rng() - 0.5) * 0.05;
				const ov = cv + (rng() - 0.5) * 0.05;
				const dir = new THREE.Vector3(...localToDir(center, u, v, ou, ov));
				const baseHeight = isForestCloud ? 0.1 + rng() * 0.08 : 0.03 + rng() * 0.05;
				puffs.push({ dir, baseHeight, phase: rng(), speed: 0.15 + rng() * 0.2, warm });
			}
		}
	}
	return puffs;
}

function CloudLayer({
	puffs,
	texture,
	color,
	size,
	atmosphereBlendRef,
}: {
	puffs: CloudPuff[];
	texture: THREE.Texture;
	color: string;
	size: number;
	atmosphereBlendRef: React.MutableRefObject<number>;
}) {
	const positions = useMemo(() => new Float32Array(puffs.length * 3), [puffs.length]);
	const geomRef = useRef<THREE.BufferGeometry>(null);
	const materialRef = useRef<THREE.PointsMaterial>(null);

	useFrame(({ clock }) => {
		for (let i = 0; i < puffs.length; i++) {
			const p = puffs[i];
			const bob = Math.sin(clock.elapsedTime * p.speed + p.phase * Math.PI * 2) * 0.006;
			const altitude = GLOBE_RADIUS + p.baseHeight + bob;
			positions[i * 3] = p.dir.x * altitude;
			positions[i * 3 + 1] = p.dir.y * altitude;
			positions[i * 3 + 2] = p.dir.z * altitude;
		}
		if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;

		if (materialRef.current) {
			const blend = atmosphereBlendRef.current;
			const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1) * 0.8;
			materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, target, 0.06);
			materialRef.current.visible = materialRef.current.opacity > 0.01;
		}
	});

	if (puffs.length === 0) return null;

	return (
		<points>
			<bufferGeometry ref={geomRef}>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
			</bufferGeometry>
			<pointsMaterial
				ref={materialRef}
				size={size}
				map={texture}
				color={color}
				transparent
				opacity={0}
				depthWrite={false}
				sizeAttenuation
				blending={THREE.NormalBlending}
			/>
		</points>
	);
}

/** Sama struktur dgn CloudLayer, tapi opacity BERDENYUT per-partikel
 * (bukan sekadar fade masuk atmosfera sekali) — "berkelip lembut" cahaya
 * Abythralis Grotto, bukan kabus terapung rata. */
function GrottoGlowLayer({
	spots,
	texture,
	atmosphereBlendRef,
}: {
	spots: GlowSpot[];
	texture: THREE.Texture;
	atmosphereBlendRef: React.MutableRefObject<number>;
}) {
	const positions = useMemo(() => new Float32Array(spots.length * 3), [spots.length]);
	const geomRef = useRef<THREE.BufferGeometry>(null);
	const materialRef = useRef<THREE.PointsMaterial>(null);
	const blendRef = useRef(0);

	useFrame(({ clock }) => {
		for (let i = 0; i < spots.length; i++) {
			const s = spots[i];
			const bob = Math.sin(clock.elapsedTime * 0.3 + s.phase * Math.PI * 2) * 0.004;
			const altitude = GLOBE_RADIUS + s.baseHeight + bob;
			positions[i * 3] = s.dir.x * altitude;
			positions[i * 3 + 1] = s.dir.y * altitude;
			positions[i * 3 + 2] = s.dir.z * altitude;
		}
		if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true;

		const target = THREE.MathUtils.clamp((atmosphereBlendRef.current - 0.15) / 0.35, 0, 1);
		blendRef.current = THREE.MathUtils.lerp(blendRef.current, target, 0.06);
		if (materialRef.current) {
			const flicker = 0.65 + 0.35 * Math.sin(clock.elapsedTime * 1.8);
			materialRef.current.opacity = blendRef.current * flicker * 0.85;
			materialRef.current.visible = blendRef.current > 0.01;
		}
	});

	if (spots.length === 0) return null;

	return (
		<points>
			<bufferGeometry ref={geomRef}>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
			</bufferGeometry>
			<pointsMaterial
				ref={materialRef}
				size={0.05}
				map={texture}
				color="#ffcf7a"
				transparent
				opacity={0}
				depthWrite={false}
				sizeAttenuation
				blending={THREE.AdditiveBlending}
			/>
		</points>
	);
}

function makeRockGeometry() {
	return new THREE.IcosahedronGeometry(1, 0);
}

export default function TerrainProps({ atmosphereBlendRef }: TerrainPropsProps) {
	const rockGeo = useMemo(() => makeRockGeometry(), []);
	const crystalGeoVariants = useMemo(
		() => Array.from({ length: CRYSTAL_VARIANT_COUNT }, (_, i) => makeCrystalClusterGeometry(401 + i * 37)),
		[],
	);
	const cloudTexture = useMemo(() => buildSpriteTexture(), []);

	const rockSpots = useMemo(() => buildRockSpots(), []);
	const crystalSpots = useMemo(() => buildCrystalSpots(), []);
	const cloudPuffs = useMemo(() => buildCloudPuffs(), []);
	const flowerSpots = useMemo(() => buildFlowerSpots(), []);
	const flowerGeo = useMemo(() => makeFlowerClusterGeometry(), []);

	// Abythralis Grotto (di lokasi Rekahan Ignisara) — cahaya keemasan,
	// kolam air hangat, akar purba.
	const grottoGlowSpots = useMemo(() => buildGrottoGlowSpots(), []);
	const grottoPoolSpots = useMemo(() => buildGrottoPoolSpots(), []);
	const grottoPoolGeo = useMemo(() => makeGrottoPoolGeometry(), []);
	const grottoRootSpots = useMemo(() => buildGrottoRootSpots(), []);
	const grottoRootGeoVariants = useMemo(
		() => Array.from({ length: ROOT_VARIANT_COUNT }, (_, i) => makeAncientRootGeometry(601 + i * 41)),
		[],
	);
	const grottoRootByVariant = useMemo(() => {
		const rng = seededRng(701);
		const groups: RootSpot[][] = Array.from({ length: ROOT_VARIANT_COUNT }, () => []);
		for (const spot of grottoRootSpots) groups[Math.floor(rng() * ROOT_VARIANT_COUNT)].push(spot);
		return groups;
	}, [grottoRootSpots]);

	const rockWarmMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#7a6a58', flatShading: true, roughness: 0.95, transparent: true, opacity: 0 }),
		[],
	);
	const rockColdMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#17151c',
				flatShading: true,
				roughness: 0.35,
				metalness: 0.2,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const crystalWarmMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#ff8a3d',
				emissive: '#ff5a1a',
				emissiveIntensity: 1.1,
				flatShading: true,
				roughness: 0.3,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const crystalColdMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#a8ecff',
				emissive: '#5fc4ff',
				emissiveIntensity: 1.1,
				flatShading: true,
				roughness: 0.3,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const flowerMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.6, transparent: true, opacity: 0 }),
		[],
	);

	const grottoPoolMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#e8b34a',
				emissive: '#a8621a',
				emissiveIntensity: 0.5,
				flatShading: true,
				roughness: 0.25,
				metalness: 0.15,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const grottoRootMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#6b4a2a', flatShading: true, roughness: 0.9, transparent: true, opacity: 0 }),
		[],
	);

	const materials = useMemo(
		() => [rockWarmMat, rockColdMat, crystalWarmMat, crystalColdMat, flowerMat, grottoPoolMat, grottoRootMat],
		[rockWarmMat, rockColdMat, crystalWarmMat, crystalColdMat, flowerMat, grottoPoolMat, grottoRootMat],
	);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.06);
			mat.visible = mat.opacity > 0.01;
		}
		const pulse = 1.0 + 0.18 * Math.sin(clock.elapsedTime * 1.6);
		crystalWarmMat.emissiveIntensity = 1.1 * pulse;
		crystalColdMat.emissiveIntensity = 1.1 * (2.0 - pulse);
		grottoPoolMat.emissiveIntensity = 0.5 * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.2));
	});

	const warmRocks = useMemo(() => rockSpots.filter((s) => s.warm), [rockSpots]);
	const coldRocks = useMemo(() => rockSpots.filter((s) => !s.warm), [rockSpots]);
	const warmCloudPuffs = useMemo(() => cloudPuffs.filter((p) => p.warm), [cloudPuffs]);
	const coldCloudPuffs = useMemo(() => cloudPuffs.filter((p) => !p.warm), [cloudPuffs]);

	const crystalGroups = useMemo(() => {
		const groups: { variant: number; warm: boolean; spots: PropSpot[] }[] = [];
		for (let variant = 0; variant < CRYSTAL_VARIANT_COUNT; variant++) {
			for (const warm of [true, false]) {
				const spots = crystalSpots.filter((s) => s.variant === variant && s.warm === warm);
				if (spots.length > 0) groups.push({ variant, warm, spots });
			}
		}
		return groups;
	}, [crystalSpots]);

	const makeInstances = (list: PropSpot[], geometry: THREE.BufferGeometry, material: THREE.Material, key: string) => {
		if (list.length === 0) return null;
		return (
			<instancedMesh
				key={key}
				args={[geometry, material, list.length]}
				ref={(mesh) => {
					if (!mesh) return;
					const m = new THREE.Matrix4();
					list.forEach((spot, i) => {
						m.compose(spot.position, spot.quaternion, spot.scale);
						mesh.setMatrixAt(i, m);
					});
					mesh.instanceMatrix.needsUpdate = true;
				}}
			/>
		);
	};

	return (
		<group>
			{makeInstances(warmRocks, rockGeo, rockWarmMat, 'rock-warm')}
			{makeInstances(coldRocks, rockGeo, rockColdMat, 'rock-cold')}
			{crystalGroups.map(({ variant, warm, spots }) =>
				makeInstances(
					spots,
					crystalGeoVariants[variant],
					warm ? crystalWarmMat : crystalColdMat,
					`crystal-${variant}-${warm ? 'warm' : 'cold'}`,
				),
			)}
			{flowerSpots.length > 0 ? (
				<instancedMesh
					args={[flowerGeo, flowerMat, flowerSpots.length]}
					ref={(mesh) => {
						if (!mesh) return;
						const m = new THREE.Matrix4();
						flowerSpots.forEach((spot, i) => {
							m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
							mesh.setMatrixAt(i, m);
							mesh.setColorAt(i, spot.color);
						});
						mesh.instanceMatrix.needsUpdate = true;
						if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
					}}
				/>
			) : null}
			{grottoPoolSpots.length > 0 ? (
				<instancedMesh
					args={[grottoPoolGeo, grottoPoolMat, grottoPoolSpots.length]}
					ref={(mesh) => {
						if (!mesh) return;
						const m = new THREE.Matrix4();
						grottoPoolSpots.forEach((spot, i) => {
							m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, 1, spot.scale));
							mesh.setMatrixAt(i, m);
						});
						mesh.instanceMatrix.needsUpdate = true;
					}}
				/>
			) : null}
			{grottoRootByVariant.map((spots, variant) =>
				spots.length > 0 ? (
					<instancedMesh
						key={`grotto-root-${variant}`}
						args={[grottoRootGeoVariants[variant], grottoRootMat, spots.length]}
						ref={(mesh) => {
							if (!mesh) return;
							const m = new THREE.Matrix4();
							spots.forEach((spot, i) => {
								m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
								mesh.setMatrixAt(i, m);
							});
							mesh.instanceMatrix.needsUpdate = true;
						}}
					/>
				) : null,
			)}
			<GrottoGlowLayer spots={grottoGlowSpots} texture={cloudTexture} atmosphereBlendRef={atmosphereBlendRef} />
			<CloudLayer puffs={warmCloudPuffs} texture={cloudTexture} color="#fff6e6" size={0.075} atmosphereBlendRef={atmosphereBlendRef} />
			<CloudLayer puffs={coldCloudPuffs} texture={cloudTexture} color="#eaf4ff" size={0.075} atmosphereBlendRef={atmosphereBlendRef} />
		</group>
	);
}
