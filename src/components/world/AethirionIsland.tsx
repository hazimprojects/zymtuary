import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, seededRng } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type AethirionIslandProps = {
	/** 0 di orbit jauh, 1 dalam atmosfera/descent — pulau hanya kelihatan
	 * apabila pelawat cukup dekat (ikut kanun: "boleh dicapai apabila
	 * seseorang cukup matang"), bukan sentiasa bersinar dari orbit jauh. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

/**
 * Bongkah "mesa terbalik" — rata/lebar di atas (tempat jungle tumbuh),
 * menirus ke satu hujung sempit/jengkel di bawah (gema rujukan: pulau
 * terapung gaya Pandora/Avatar dengan air terjun menitis dari hujung
 * bawah). Permukaan ATAS geometri sentiasa pada y=0 tempatan supaya pokok
 * boleh diletak terus di y=0 tanpa kira offset per-pulau.
 */
function buildMesaGeometry(topRadius: number, bottomRadius: number, height: number, seed: number): THREE.BufferGeometry {
	const geo = new THREE.CylinderGeometry(topRadius, bottomRadius, height, 8, 5, false);
	geo.translate(0, -height / 2, 0);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const depthT = THREE.MathUtils.clamp(-y / height, 0, 1);
		const n1 = Math.sin(i * 12.9898 + seed * 3.7) * 43758.5453;
		const n2 = Math.sin(i * 78.233 + seed * 9.1) * 12543.231;
		const f1 = Math.abs(n1 - Math.floor(n1));
		const f2 = Math.abs(n2 - Math.floor(n2));
		// Jengkel LEMBUT di atas, makin jengkel/tidak sekata menghampiri hujung
		// bawah — kesan batu merekah/runtuh di mana air terjun tercurah keluar.
		const jitter = 0.92 + f1 * 0.12 + f2 * 0.06 + depthT * f1 * 0.4;
		pos.setXYZ(i, x * jitter, y, z * jitter);
	}
	geo.computeVertexNormals();
	return geo;
}

function buildTreeGeometry(scale: number) {
	const trunk = new THREE.CylinderGeometry(0.004 * scale, 0.006 * scale, 0.028 * scale, 5);
	trunk.translate(0, 0.014 * scale, 0);
	const canopy = new THREE.ConeGeometry(0.017 * scale, 0.038 * scale, 6);
	canopy.translate(0, 0.031 * scale, 0);
	return { trunk, canopy };
}

type IslandSpec = {
	offset: [number, number, number];
	topRadius: number;
	bottomRadius: number;
	height: number;
	seed: number;
};

// Pulau nampak terlalu besar/rendah berbanding globe — kecilkan sedikit
// (bukan drastik) supaya nisbah skala lebih munasabah berbanding permukaan.
const ISLAND_SCALE = 0.7;

/** Kelompok — satu pulau utama + beberapa pulau kecil di sekelilingnya
 * (pada altitud berlainan, macam rujukan), semuanya bentuk mesa terbalik
 * yang sama, bukan gumpalan batu bulat. */
const RAW_ISLAND_SPECS: IslandSpec[] = [
	{ offset: [0, 0, 0], topRadius: 0.16, bottomRadius: 0.018, height: 0.26, seed: 11 },
	{ offset: [0.26, 0.04, 0.1], topRadius: 0.07, bottomRadius: 0.01, height: 0.13, seed: 23 },
	{ offset: [-0.22, -0.09, -0.12], topRadius: 0.055, bottomRadius: 0.008, height: 0.1, seed: 37 },
	{ offset: [0.06, -0.16, -0.24], topRadius: 0.045, bottomRadius: 0.007, height: 0.085, seed: 51 },
	{ offset: [-0.14, 0.1, 0.22], topRadius: 0.04, bottomRadius: 0.006, height: 0.08, seed: 64 },
];

const ISLAND_SPECS: IslandSpec[] = RAW_ISLAND_SPECS.map((s) => ({
	offset: [s.offset[0] * ISLAND_SCALE, s.offset[1] * ISLAND_SCALE, s.offset[2] * ISLAND_SCALE],
	topRadius: s.topRadius * ISLAND_SCALE,
	bottomRadius: s.bottomRadius * ISLAND_SCALE,
	height: s.height * ISLAND_SCALE,
	seed: s.seed,
}));

/** Pokok tumbuh tegak (local +Y) di atas permukaan rata pulau utama (jauh
 * lebih ramai drpd sebelum ini — kesan "jungle lebat" macam rujukan) +
 * beberapa di pulau kecil pertama. */
function buildTreeSpots(): { offset: [number, number, number]; islandIndex: number }[] {
	const rng = seededRng(771);
	const spots: { offset: [number, number, number]; islandIndex: number }[] = [];
	const mainTop = ISLAND_SPECS[0].topRadius;
	for (let i = 0; i < 11; i++) {
		const r = Math.sqrt(rng()) * mainTop * 0.78;
		const angle = rng() * Math.PI * 2;
		spots.push({ offset: [Math.cos(angle) * r, 0, Math.sin(angle) * r], islandIndex: 0 });
	}
	const satTop = ISLAND_SPECS[1].topRadius;
	for (let i = 0; i < 3; i++) {
		const r = Math.sqrt(rng()) * satTop * 0.7;
		const angle = rng() * Math.PI * 2;
		spots.push({ offset: [Math.cos(angle) * r, 0, Math.sin(angle) * r], islandIndex: 1 });
	}
	return spots;
}

type WaterfallSpec = { islandIndex: number; localX: number; localZ: number; startDrop: number; length: number; width: number };

/** Beberapa jalur air terjun tercurah dari hujung bawah pulau utama & satu
 * pulau kecil — gema rujukan (air menitis dari bongkah batu terapung ke
 * kabus di bawah). */
function buildWaterfallSpecs(): WaterfallSpec[] {
	const rng = seededRng(882);
	const specs: WaterfallSpec[] = [];
	const main = ISLAND_SPECS[0];
	for (let i = 0; i < 5; i++) {
		const r = main.bottomRadius + rng() * main.topRadius * 0.4;
		const angle = rng() * Math.PI * 2;
		specs.push({
			islandIndex: 0,
			localX: Math.cos(angle) * r,
			localZ: Math.sin(angle) * r,
			startDrop: main.height * (0.4 + rng() * 0.35),
			length: main.height * (0.9 + rng() * 0.7),
			width: 0.008 + rng() * 0.007,
		});
	}
	const sat = ISLAND_SPECS[1];
	specs.push({
		islandIndex: 1,
		localX: sat.bottomRadius * 1.5,
		localZ: 0,
		startDrop: sat.height * 0.5,
		length: sat.height * 1.1,
		width: 0.007,
	});
	return specs;
}

/** Tekstur jalur menegak (bukan gradien bulat) — legap dekat atas, pudar
 * ke bawah, dengan sedikit "jalur" rawak supaya nampak macam aliran air,
 * bukan asap rata. */
function buildWaterfallTexture(): THREE.CanvasTexture {
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

type MistPuff = { localOffset: THREE.Vector3; islandIndex: number; phase: number };

function buildMistPuffs(): MistPuff[] {
	const rng = seededRng(993);
	const puffs: MistPuff[] = [];
	const main = ISLAND_SPECS[0];
	for (let i = 0; i < 14; i++) {
		const angle = rng() * Math.PI * 2;
		const r = rng() * main.topRadius * 0.5;
		const y = -main.height * (1.1 + rng() * 0.6);
		puffs.push({ localOffset: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r), islandIndex: 0, phase: rng() });
	}
	return puffs;
}

const UP = new THREE.Vector3(0, 1, 0);

export default function AethirionIsland({ atmosphereBlendRef }: AethirionIslandProps) {
	const groupRef = useRef<THREE.Group>(null);
	const dirVec = useMemo(() => new THREE.Vector3(), []);
	const alignQuat = useMemo(() => new THREE.Quaternion(), []);
	const spinQuat = useMemo(() => new THREE.Quaternion(), []);

	const rockGeometries = useMemo(
		() => ISLAND_SPECS.map((s) => buildMesaGeometry(s.topRadius, s.bottomRadius, s.height, s.seed)),
		[],
	);
	const { trunk, canopy } = useMemo(() => buildTreeGeometry(ISLAND_SCALE), []);
	const treeSpots = useMemo(() => buildTreeSpots(), []);
	const waterfallSpecs = useMemo(() => buildWaterfallSpecs(), []);
	const mistPuffs = useMemo(() => buildMistPuffs(), []);

	const rockMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#8a7a62',
				flatShading: true,
				roughness: 0.88,
				metalness: 0.03,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const trunkMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({ color: '#4a3423', flatShading: true, roughness: 0.9, transparent: true, opacity: 0 }),
		[],
	);
	const canopyMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#7dbf52',
				emissive: '#2a3a12',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.7,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const waterfallTexture = useMemo(() => buildWaterfallTexture(), []);
	const waterfallMaterial = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				map: waterfallTexture,
				color: '#dff2ff',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		[waterfallTexture],
	);
	const mistTexture = useMemo(() => buildSpriteTexture(), []);
	const mistMaterial = useMemo(
		() =>
			new THREE.PointsMaterial({
				size: 0.05,
				map: mistTexture,
				color: '#eef8ff',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				sizeAttenuation: true,
			}),
		[mistTexture],
	);

	const materials = useMemo(
		() => [rockMaterial, trunkMaterial, canopyMaterial, waterfallMaterial, mistMaterial],
		[rockMaterial, trunkMaterial, canopyMaterial, waterfallMaterial, mistMaterial],
	);

	const waterfallGeos = useMemo(
		() => waterfallSpecs.map((w) => new THREE.PlaneGeometry(w.width, w.length, 1, 6)),
		[waterfallSpecs],
	);

	const mistPositions = useMemo(() => new Float32Array(mistPuffs.length * 3), [mistPuffs.length]);
	const mistGeomRef = useRef<THREE.BufferGeometry>(null);

	useFrame(({ clock }, delta) => {
		const t = clock.elapsedTime;
		// Sama seperti kanun: "tidak pernah diam di satu kedudukan cukup lama
		// untuk dipetakan" — kedudukan dikira terus daripada masa, hanyut
		// perlahan mengelilingi garisan Equilara.
		const theta = t * 0.05 + 1.4;
		const y = 0.03 + 0.06 * Math.sin(t * 0.09);
		const ring = Math.sqrt(Math.max(0, 1 - y * y));
		// Jauhkan lagi drpd permukaan globe — sebelum ini terlalu rendah/rapat.
		const altitude = GLOBE_RADIUS + 0.48 + Math.sin(t * 0.6) * 0.015;

		if (groupRef.current) {
			groupRef.current.position.set(ring * Math.sin(theta) * altitude, y * altitude, ring * Math.cos(theta) * altitude);
			// Ikut gravity Zymtuary: teras planet menarik jasad pulau, jadi hujung
			// tirus (bawah tempatan) MESTI menghadap teras globe, bukan "bawah"
			// dunia yang tetap. +Y tempatan (permukaan jungle rata) diselaraskan
			// ke arah radial KELUAR drpd teras (sama konvensyen objek permukaan),
			// supaya hujung tirus sentiasa menghala ke teras tidak kira di mana
			// pulau ini hanyut. Putaran paksi-Y dikekalkan sbg putaran tempatan
			// (disaputkan SEBELUM penjajaran) supaya ia berputar di sekeliling
			// paksi tirus sendiri, bukan paksi dunia.
			dirVec.copy(groupRef.current.position).normalize();
			alignQuat.setFromUnitVectors(UP, dirVec);
			spinQuat.setFromAxisAngle(UP, t * 0.12);
			groupRef.current.quaternion.copy(alignQuat).multiply(spinQuat);
		}

		// Air mengalir dari hujung tirus (dekat mesa) ke bawah menuju kabus —
		// offset.y BERTAMBAH supaya corak cerah (dekat mesa) beranjak ke v
		// rendah (dekat kabus) dari semasa ke semasa, iaitu jatuh, bukan naik.
		waterfallTexture.offset.y += delta * 0.6;

		for (let i = 0; i < mistPuffs.length; i++) {
			const p = mistPuffs[i];
			const bob = Math.sin(t * 0.3 + p.phase * Math.PI * 2) * 0.012;
			mistPositions[i * 3] = p.localOffset.x;
			mistPositions[i * 3 + 1] = p.localOffset.y + bob;
			mistPositions[i * 3 + 2] = p.localOffset.z;
		}
		if (mistGeomRef.current) mistGeomRef.current.attributes.position.needsUpdate = true;

		const blend = atmosphereBlendRef.current;
		// Sama macam pokok Heartbloom — pulau terapung ini patut kelihatan sbg
		// mercu tanda walau dari orbit jauh (lantai/rock sentiasa kelihatan
		// separuh, bukan hilang terus), jadi opacity ada lantai minimum (0.5)
		// drpd 0 — kekayaan penuh (air terjun/kabus) tetap hanya dlm atmosfera.
		const targetOpacity = THREE.MathUtils.lerp(0.5, 1, THREE.MathUtils.clamp((blend - 0.15) / 0.4, 0, 1));
		for (const mat of materials) {
			const target = mat === waterfallMaterial ? targetOpacity * 0.8 : mat === mistMaterial ? targetOpacity * 0.5 : targetOpacity;
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
	});

	return (
		<group ref={groupRef}>
			{ISLAND_SPECS.map((spec, i) => (
				<mesh key={i} geometry={rockGeometries[i]} material={rockMaterial} position={spec.offset} />
			))}
			{treeSpots.map((spot, i) => {
				const islandOffset = ISLAND_SPECS[spot.islandIndex].offset;
				const position: [number, number, number] = [
					islandOffset[0] + spot.offset[0],
					islandOffset[1] + spot.offset[1],
					islandOffset[2] + spot.offset[2],
				];
				return (
					<group key={i} position={position}>
						<mesh geometry={trunk} material={trunkMaterial} />
						<mesh geometry={canopy} material={canopyMaterial} />
					</group>
				);
			})}
			{waterfallSpecs.map((w, i) => {
				const islandOffset = ISLAND_SPECS[w.islandIndex].offset;
				const centerY = islandOffset[1] - w.startDrop - w.length / 2;
				return (
					<mesh
						key={i}
						geometry={waterfallGeos[i]}
						material={waterfallMaterial}
						position={[islandOffset[0] + w.localX, centerY, islandOffset[2] + w.localZ]}
					/>
				);
			})}
			<points>
				<bufferGeometry ref={mistGeomRef}>
					<bufferAttribute attach="attributes-position" args={[mistPositions, 3]} count={mistPositions.length / 3} itemSize={3} />
				</bufferGeometry>
				<primitive object={mistMaterial} attach="material" />
			</points>
		</group>
	);
}
