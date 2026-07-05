import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng, tangentBasis, localToDir } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type MendariTownscapeProps = {
	/** Sama seperti Vegetation/Aethirion — kota hanya kelihatan sepenuhnya
	 * apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);
const MENDARI_RADIUS = 0.13;

// Kebun/taman menghuni SATU sektor sudut kota (bukan serata) — kesan
// "daerah taman" tersendiri dlm kota, gema kota-taman (Codex 5.2: "setiap
// bumbung rumah dilitupi bunga bougainvillea", "kota-taman yang terlalu
// sempurna"). Rumah dielakkan drpd sektor ini.
const GARDEN_CENTER_ANGLE = Math.PI * 0.25;
const GARDEN_HALF_SPAN = 0.95;

function angularDist(a: number, b: number): number {
	return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** Sempadan kota tak sekata (harmonik sudut) — elak "bulatan cantik" genap
 * (pengajaran drpd Vegetation.tsx round sebelum ini). */
function buildIrregularBoundary(rng: () => number): (theta: number) => number {
	const a1 = 0.12 + rng() * 0.1;
	const p1 = rng() * Math.PI * 2;
	const a2 = 0.06 + rng() * 0.08;
	const p2 = rng() * Math.PI * 2;
	return (theta: number) => 1 + a1 * Math.cos(theta + p1) + a2 * Math.cos(2 * theta + p2);
}

type HouseSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: number;
	variant: number;
};

const HOUSE_VARIANT_COUNT = 3;
const INNER_EXCLUSION = 0.032; // ruang utk carousel + air pancut di tengah

/** Rumah diserak organik (radial + sempadan tak sekata), MENGELAK sektor
 * taman — kesan "kota besar" berjalan-jalur, bukan cakera genap satu
 * bentuk rumah berulang. */
function buildHouseSpots(count: number): HouseSpot[] {
	const spots: HouseSpot[] = [];
	const center = findLandmarkDirection('mendari-kota');
	const { u, v } = tangentBasis(center);
	const rng = seededRng(6501);
	const boundary = buildIrregularBoundary(rng);
	const maxAttempts = count * 6;

	let attempts = 0;
	while (spots.length < count && attempts < maxAttempts) {
		attempts++;
		const angle = rng() * Math.PI * 2;
		if (angularDist(angle, GARDEN_CENTER_ANGLE) < GARDEN_HALF_SPAN) continue;

		const maxR = MENDARI_RADIUS * 0.92 * boundary(angle);
		const r = INNER_EXCLUSION + Math.sqrt(rng()) * (maxR - INNER_EXCLUSION);
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));

		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		const scale = 0.55 + rng() * 0.55;
		const variant = Math.floor(rng() * HOUSE_VARIANT_COUNT);
		spots.push({ position, quaternion, scale, variant });
	}

	return spots;
}

type GardenSpot = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number };

/** Pokok & rumpun bunga taman — dlm sektor taman sahaja, gema "kota-taman". */
function buildGardenSpots(treeCount: number, flowerCount: number): { trees: GardenSpot[]; flowers: GardenSpot[] } {
	const center = findLandmarkDirection('mendari-kota');
	const { u, v } = tangentBasis(center);
	const rng = seededRng(6733);

	const makeSpot = (rMin: number, rMax: number, scaleMin: number, scaleMax: number): GardenSpot => {
		const angle = GARDEN_CENTER_ANGLE + (rng() - 0.5) * GARDEN_HALF_SPAN * 1.7;
		const r = rMin + Math.sqrt(rng()) * (rMax - rMin);
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));
		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		return { position, quaternion, scale: scaleMin + rng() * (scaleMax - scaleMin) };
	};

	const trees = Array.from({ length: treeCount }, () => makeSpot(INNER_EXCLUSION, MENDARI_RADIUS * 0.85, 0.7, 1.1));
	const flowers = Array.from({ length: flowerCount }, () => makeSpot(INNER_EXCLUSION * 0.7, MENDARI_RADIUS * 0.9, 0.6, 1.2));
	return { trees, flowers };
}

function mergePieces(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const p of pieces) p.dispose();
	return merged;
}

/**
 * Menara loceng Mendari — mercu tanda kota (gema rujukan: menara jam/loceng
 * menjulang di atas bumbung rumah), diletak di tepi bertentangan drpd sektor
 * taman supaya jadi "penanda" bahagian bandar yg lain.
 */
function buildBellTowerGeo(): THREE.BufferGeometry {
	const pieces: THREE.BufferGeometry[] = [];
	let y = 0;
	const add = (topR: number, bottomR: number, h: number, segments = 8) => {
		const g = new THREE.CylinderGeometry(topR, bottomR, h, segments);
		g.translate(0, y + h / 2, 0);
		pieces.push(g);
		y += h;
	};
	add(0.021, 0.024, 0.05); // asas
	add(0.017, 0.02, 0.035); // badan
	add(0.014, 0.016, 0.022); // aras loceng
	const roof = new THREE.ConeGeometry(0.02, 0.03, 8);
	roof.translate(0, y + 0.015, 0);
	pieces.push(roof);
	return mergePieces(pieces);
}

const HOUSE_ROOF_COLORS = ['#d9698f', '#c97a3a', '#b8506e'] as const;
const HOUSE_WALL_COLORS = ['#d9b878', '#e0c290', '#cfae70'] as const;

type HouseVariant = { wallGeo: THREE.BufferGeometry; roofGeo: THREE.BufferGeometry; bloomGeo: THREE.BufferGeometry };

/** 3 bentuk rumah berlainan (pondok/rumah-teres/rumah-lebar) — kesan "kota
 * besar" pelbagai rupa, bukan satu bentuk berulang. Setiap satu ada
 * "bloom" (rumpun bunga bougainvillea kecil) di puncak bumbung — gema
 * langsung "setiap bumbung dilitupi bunga bougainvillea" (Codex 5.2). */
function buildHouseVariants(): HouseVariant[] {
	// V0 — pondok (asal).
	const wall0 = new THREE.BoxGeometry(0.024, 0.02, 0.024);
	wall0.translate(0, 0.01, 0);
	const roof0 = new THREE.ConeGeometry(0.019, 0.016, 4);
	roof0.rotateY(Math.PI / 4);
	roof0.translate(0, 0.028, 0);
	const bloom0 = new THREE.IcosahedronGeometry(0.007, 0);
	bloom0.translate(0, 0.038, 0);

	// V1 — rumah-teres (lebih tinggi & tirus).
	const wall1 = new THREE.BoxGeometry(0.02, 0.032, 0.02);
	wall1.translate(0, 0.016, 0);
	const roof1 = new THREE.ConeGeometry(0.016, 0.02, 4);
	roof1.rotateY(Math.PI / 4);
	roof1.translate(0, 0.042, 0);
	const bloom1 = new THREE.IcosahedronGeometry(0.0065, 0);
	bloom1.translate(0, 0.053, 0);

	// V2 — rumah lebar (kesan kedai/rumah agam kecil).
	const wall2 = new THREE.BoxGeometry(0.033, 0.022, 0.026);
	wall2.translate(0, 0.011, 0);
	const roof2 = new THREE.ConeGeometry(0.023, 0.017, 4);
	roof2.rotateY(Math.PI / 4);
	roof2.translate(0, 0.03, 0);
	const bloom2 = new THREE.IcosahedronGeometry(0.008, 0);
	bloom2.translate(0, 0.039, 0);

	return [
		{ wallGeo: wall0, roofGeo: roof0, bloomGeo: bloom0 },
		{ wallGeo: wall1, roofGeo: roof1, bloomGeo: bloom1 },
		{ wallGeo: wall2, roofGeo: roof2, bloomGeo: bloom2 },
	];
}

function buildTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(0.0025, 0.0038, 0.018, 5);
	trunk.translate(0, 0.009, 0);
	const canopy = new THREE.IcosahedronGeometry(0.013, 1);
	canopy.translate(0, 0.023, 0);
	return { trunk, canopy };
}

const FLOWER_COLORS = ['#e8547a', '#f0b23a', '#e88a3a', '#d9698f'] as const;

/** Rumpun bunga rendah utk katil bunga taman — pelbagai warna (gema
 * bougainvillea/taman berbunga-bunga). */
function buildFlowerVariants(): THREE.BufferGeometry[] {
	return FLOWER_COLORS.map((_, i) => {
		const rng = seededRng(910 + i);
		const pieces: THREE.BufferGeometry[] = [];
		for (let j = 0; j < 3; j++) {
			const g = new THREE.IcosahedronGeometry(0.005 + rng() * 0.003, 0);
			g.translate((rng() - 0.5) * 0.012, 0.004 + rng() * 0.003, (rng() - 0.5) * 0.012);
			pieces.push(g);
		}
		return mergePieces(pieces);
	});
}

/** Air pancut kecil di plaza (kolam + tiang tengah + sembur partikel) — satu
 * lagi mercu tanda plaza selain carousel. */
function buildFountainGeo(): { basinGeo: THREE.BufferGeometry; poleGeo: THREE.BufferGeometry } {
	const basin = new THREE.CylinderGeometry(0.018, 0.02, 0.008, 12);
	basin.translate(0, 0.004, 0);
	const rim = new THREE.TorusGeometry(0.018, 0.0025, 6, 14);
	rim.rotateX(Math.PI / 2);
	rim.translate(0, 0.008, 0);
	const pole = new THREE.CylinderGeometry(0.0025, 0.004, 0.014, 6);
	pole.translate(0, 0.007 + 0.008, 0);
	return { basinGeo: mergePieces([basin, rim]), poleGeo: pole };
}

type WaterSpray = { offset: THREE.Vector3; phase: number };

function buildWaterSpray(): WaterSpray[] {
	const rng = seededRng(4471);
	return Array.from({ length: 14 }, () => {
		const angle = rng() * Math.PI * 2;
		const r = rng() * 0.006;
		return { offset: new THREE.Vector3(Math.cos(angle) * r, rng() * 0.012, Math.sin(angle) * r), phase: rng() };
	});
}

/**
 * Mendari — kota-taman Wilayah Lumiborne (Codex 5.2). Sebelum ini hanya 55
 * rumah kotak SAMA berselerak di sekeliling carousel — kini kota SEBENAR:
 * 3 bentuk rumah berbeza (setiap satu berbunga bougainvillea di bumbung),
 * daerah taman berpokok & berbunga tersendiri, menara loceng menjulang jadi
 * mercu tanda, & air pancut plaza di sisi carousel (dua mercu tanda plaza).
 * Carousel asal ("The Carousel That Never Stops") dikekalkan tanpa
 * perubahan — signature Idlewick.
 */
export default function MendariTownscape({ atmosphereBlendRef }: MendariTownscapeProps) {
	const centerDir = useMemo(() => findLandmarkDirection('mendari-kota'), []);
	const dir = useMemo(() => new THREE.Vector3(...centerDir), [centerDir]);
	const { u: uArr, v: vArr } = useMemo(() => tangentBasis(centerDir), [centerDir]);
	const carouselPosition = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003), [dir]);
	const carouselQuaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);

	const houseSpots = useMemo(() => buildHouseSpots(90), []);
	const houseVariants = useMemo(() => buildHouseVariants(), []);
	const gardenSpots = useMemo(() => buildGardenSpots(16, 26), []);
	const { trunk: treeTrunkGeo, canopy: treeCanopyGeo } = useMemo(() => buildTreeGeometry(), []);
	const flowerVariants = useMemo(() => buildFlowerVariants(), []);
	const bellTowerGeo = useMemo(() => buildBellTowerGeo(), []);
	const { basinGeo: fountainBasinGeo, poleGeo: fountainPoleGeo } = useMemo(() => buildFountainGeo(), []);
	const waterSpray = useMemo(() => buildWaterSpray(), []);

	// Menara loceng di tepi kota BERTENTANGAN drpd sektor taman — jadi
	// penanda jelas di bahagian bandar yg lain, macam menara pengawal di
	// rujukan.
	const towerPosition = useMemo(() => {
		const angle = GARDEN_CENTER_ANGLE + Math.PI;
		const r = MENDARI_RADIUS * 0.62;
		const dirT = new THREE.Vector3(...localToDir(centerDir, uArr, vArr, Math.cos(angle) * r, Math.sin(angle) * r));
		return dirT.multiplyScalar(GLOBE_RADIUS + 0.003);
	}, [centerDir, uArr, vArr]);
	const towerQuaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, towerPosition.clone().normalize()), [towerPosition]);

	// Air pancut betul2 di sisi carousel (plaza tengah ada DUA mercu tanda).
	const fountainPosition = useMemo(() => {
		const angle = GARDEN_CENTER_ANGLE + Math.PI * 0.55;
		const r = INNER_EXCLUSION * 1.6;
		const dirF = new THREE.Vector3(...localToDir(centerDir, uArr, vArr, Math.cos(angle) * r, Math.sin(angle) * r));
		return dirF.multiplyScalar(GLOBE_RADIUS + 0.003);
	}, [centerDir, uArr, vArr]);
	const fountainQuaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, fountainPosition.clone().normalize()), [fountainPosition]);

	const wallMats = useMemo(
		() => HOUSE_WALL_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, transparent: true, opacity: 0 })),
		[],
	);
	const roofMats = useMemo(
		() =>
			HOUSE_ROOF_COLORS.map(
				(c) =>
					new THREE.MeshStandardMaterial({
						color: c,
						emissive: '#5a1f30',
						emissiveIntensity: 0.3,
						flatShading: true,
						roughness: 0.6,
						transparent: true,
						opacity: 0,
					}),
			),
		[],
	);
	const bloomMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#e8547a',
				emissive: '#6a1a38',
				emissiveIntensity: 0.45,
				flatShading: true,
				roughness: 0.55,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const carouselRoofMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#e8a34a',
				emissive: '#5a3410',
				emissiveIntensity: 0.35,
				flatShading: true,
				roughness: 0.55,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const treeTrunkMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#6a4a2a', flatShading: true, roughness: 0.8, transparent: true, opacity: 0 }),
		[],
	);
	const treeCanopyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#8ec24a',
				emissive: '#3a5a1a',
				emissiveIntensity: 0.35,
				flatShading: true,
				roughness: 0.65,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const flowerMats = useMemo(
		() =>
			FLOWER_COLORS.map(
				(c) =>
					new THREE.MeshStandardMaterial({
						color: c,
						emissive: c,
						emissiveIntensity: 0.3,
						flatShading: true,
						roughness: 0.6,
						transparent: true,
						opacity: 0,
					}),
			),
		[],
	);
	const towerMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#d9b878', flatShading: true, roughness: 0.7, transparent: true, opacity: 0 }),
		[],
	);
	const fountainMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#b8a888', flatShading: true, roughness: 0.6, transparent: true, opacity: 0 }),
		[],
	);
	const waterTexture = useMemo(() => buildSpriteTexture(), []);
	const waterMat = useMemo(
		() =>
			new THREE.PointsMaterial({
				size: 0.006,
				map: waterTexture,
				color: '#cfeaff',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				sizeAttenuation: true,
				blending: THREE.AdditiveBlending,
			}),
		[waterTexture],
	);

	// Menara loceng ialah MERCU TANDA kota — sama corak dgn Heartbloom/
	// Ascendari/Aethirion: kekal separa kelihatan dari orbit (lantai 0.55),
	// bukan hilang terus. Elemen kota lain (rumah/taman/air pancut) kekal
	// lantai 0 — hanya kelihatan bila rapat.
	const cityMats = useMemo(
		() => [...wallMats, ...roofMats, bloomMat, carouselRoofMat, treeTrunkMat, treeCanopyMat, ...flowerMats, fountainMat],
		[wallMats, roofMats, bloomMat, carouselRoofMat, treeTrunkMat, treeCanopyMat, flowerMats, fountainMat],
	);
	const landmarkMats = useMemo(() => [towerMat], [towerMat]);

	const waterPositions = useMemo(() => new Float32Array(waterSpray.length * 3), [waterSpray.length]);
	const waterGeomRef = useRef<THREE.BufferGeometry>(null);

	const carouselBaseGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.03, 0.032, 0.012, 10);
		g.translate(0, 0.006, 0);
		return g;
	}, []);
	const carouselPoleGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6);
		g.translate(0, 0.012 + 0.025, 0);
		return g;
	}, []);
	const carouselRoofGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.034, 0.024, 10);
		g.translate(0, 0.012 + 0.05 + 0.012, 0);
		return g;
	}, []);
	const carouselSupportGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 4);
		g.translate(0, 0.012 + 0.025, 0);
		return g;
	}, []);
	const carouselSupportPositions = useMemo(() => {
		const r = 0.024;
		return [0, 1, 2, 3, 4, 5].map((i) => {
			const a = (i / 6) * Math.PI * 2;
			return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
		});
	}, []);

	const carouselRef = useRef<THREE.Group>(null);
	const spinAngle = useRef(0);

	useFrame(({ clock }, delta) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);

		for (const mat of cityMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		waterMat.opacity = THREE.MathUtils.lerp(waterMat.opacity, near * 0.8, 0.05);
		waterMat.visible = waterMat.opacity > 0.01;

		// Gubah quaternion (bukan mutate rotation.y terus) — carousel perlu
		// berputar mengelilingi paksi "atas" TEMPATANnya sendiri.
		spinAngle.current += delta * 0.25;
		if (carouselRef.current) {
			carouselRef.current.quaternion
				.copy(carouselQuaternion)
				.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spinAngle.current));
		}

		for (let i = 0; i < waterSpray.length; i++) {
			const w = waterSpray[i];
			const t = (clock.elapsedTime * 0.6 + w.phase) % 1;
			waterPositions[i * 3] = w.offset.x;
			waterPositions[i * 3 + 1] = 0.019 + t * 0.02;
			waterPositions[i * 3 + 2] = w.offset.z;
		}
		if (waterGeomRef.current) waterGeomRef.current.attributes.position.needsUpdate = true;
	});

	const houseByVariant = useMemo(() => {
		const groups: HouseSpot[][] = Array.from({ length: HOUSE_VARIANT_COUNT }, () => []);
		for (const s of houseSpots) groups[s.variant].push(s);
		return groups;
	}, [houseSpots]);

	const makeInstances = (list: HouseSpot[] | GardenSpot[], geometry: THREE.BufferGeometry, material: THREE.Material) => {
		if (list.length === 0) return null;
		return (
			<instancedMesh
				args={[geometry, material, list.length]}
				ref={(mesh) => {
					if (!mesh) return;
					const m = new THREE.Matrix4();
					list.forEach((spot, i) => {
						m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
						mesh.setMatrixAt(i, m);
					});
					mesh.instanceMatrix.needsUpdate = true;
				}}
			/>
		);
	};

	return (
		<group>
			{houseVariants.map((v, i) => (
				<group key={i}>
					{makeInstances(houseByVariant[i], v.wallGeo, wallMats[i])}
					{makeInstances(houseByVariant[i], v.roofGeo, roofMats[i])}
					{makeInstances(houseByVariant[i], v.bloomGeo, bloomMat)}
				</group>
			))}

			{makeInstances(gardenSpots.trees, treeTrunkGeo, treeTrunkMat)}
			{makeInstances(gardenSpots.trees, treeCanopyGeo, treeCanopyMat)}
			{gardenSpots.flowers.map((spot, i) => {
				const variant = i % flowerVariants.length;
				return (
					<mesh
						key={i}
						geometry={flowerVariants[variant]}
						material={flowerMats[variant]}
						position={spot.position}
						quaternion={spot.quaternion}
						scale={spot.scale}
					/>
				);
			})}

			<mesh geometry={bellTowerGeo} material={towerMat} position={towerPosition} quaternion={towerQuaternion} />

			<group position={fountainPosition} quaternion={fountainQuaternion}>
				<mesh geometry={fountainBasinGeo} material={fountainMat} />
				<mesh geometry={fountainPoleGeo} material={fountainMat} />
				<points>
					<bufferGeometry ref={waterGeomRef}>
						<bufferAttribute attach="attributes-position" args={[waterPositions, 3]} count={waterPositions.length / 3} itemSize={3} />
					</bufferGeometry>
					<primitive object={waterMat} attach="material" />
				</points>
			</group>

			<group ref={carouselRef} position={carouselPosition} quaternion={carouselQuaternion}>
				<mesh geometry={carouselBaseGeo} material={wallMats[0]} />
				<mesh geometry={carouselPoleGeo} material={wallMats[0]} />
				{carouselSupportPositions.map((pos, i) => (
					<mesh key={i} geometry={carouselSupportGeo} material={wallMats[0]} position={pos} />
				))}
				<mesh geometry={carouselRoofGeo} material={carouselRoofMat} />
			</group>
		</group>
	);
}
