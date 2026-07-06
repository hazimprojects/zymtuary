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
		const count = 90;
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
	if (feature.type === 'green' || feature.type === 'tree') return 4;
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
			const isForestCloud = feature.type === 'green' || feature.type === 'tree';
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

	const materials = useMemo(
		() => [rockWarmMat, rockColdMat, crystalWarmMat, crystalColdMat, flowerMat],
		[rockWarmMat, rockColdMat, crystalWarmMat, crystalColdMat, flowerMat],
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
			<CloudLayer puffs={warmCloudPuffs} texture={cloudTexture} color="#fff6e6" size={0.075} atmosphereBlendRef={atmosphereBlendRef} />
			<CloudLayer puffs={coldCloudPuffs} texture={cloudTexture} color="#eaf4ff" size={0.075} atmosphereBlendRef={atmosphereBlendRef} />
		</group>
	);
}
