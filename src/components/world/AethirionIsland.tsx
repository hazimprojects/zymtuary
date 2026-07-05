import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

type AethirionIslandProps = {
	/** 0 di orbit jauh, 1 dalam atmosfera/descent — pulau hanya kelihatan
	 * apabila pelawat cukup dekat (ikut kanun: "boleh dicapai apabila
	 * seseorang cukup matang"), bukan sentiasa bersinar dari orbit jauh. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

/** Gumpalan batu rendah-poligon — icosahedron disubdivide sekali dengan
 * jitter LEMBUT (bukan melampau) per-verteks — cukup untuk lasak/tidak
 * simetri sempurna, tapi masih kelihatan seperti batu bulat, bukan
 * kristal bergerigi tajam. */
function buildRockGeometry(radius: number, seed: number, flatten: number): THREE.BufferGeometry {
	const geo = new THREE.IcosahedronGeometry(radius, 1);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const n1 = Math.sin(i * 12.9898 + seed * 3.7) * 43758.5453;
		const n2 = Math.sin(i * 78.233 + seed * 9.1) * 12543.231;
		const jitter = 0.9 + Math.abs(n1 - Math.floor(n1)) * 0.14 + Math.abs(n2 - Math.floor(n2)) * 0.06;
		pos.setXYZ(i, x * jitter, y * jitter * flatten, z * jitter);
	}
	geo.computeVertexNormals();
	return geo;
}

function buildTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(0.004, 0.006, 0.028, 5);
	trunk.translate(0, 0.014, 0);
	const canopy = new THREE.ConeGeometry(0.017, 0.038, 6);
	canopy.translate(0, 0.031, 0);
	return { trunk, canopy };
}

type IslandSpec = { offset: [number, number, number]; radius: number; seed: number; flatten: number };

/** Kelompok — satu pulau utama + beberapa pulau kecil di sekelilingnya,
 * bukan satu bongkah tunggal terlalu geometri. */
const ISLAND_SPECS: IslandSpec[] = [
	{ offset: [0, 0, 0], radius: 0.12, seed: 11, flatten: 0.7 },
	{ offset: [0.21, -0.06, 0.05], radius: 0.045, seed: 23, flatten: 0.72 },
	{ offset: [-0.18, 0.02, -0.08], radius: 0.04, seed: 37, flatten: 0.7 },
	{ offset: [0.03, -0.08, -0.2], radius: 0.032, seed: 51, flatten: 0.74 },
	{ offset: [-0.1, 0.05, 0.18], radius: 0.028, seed: 64, flatten: 0.68 },
];

/** Kedudukan pokok kecil di atas pulau utama (radius 0.12) — setiap satu
 * diorientasikan tegak keluar dari pusat pulau (macam pokok pada globe),
 * bukan ikut satu arah tetap yang boleh kelihatan tumbuh ke tepi. Jejari
 * (0.135-0.145) sengaja MELEBIHI radius pulau (0.12) supaya pangkal pokok
 * sentiasa berada di atas permukaan batu berjitar, bukan terbenam/terapung
 * pada cerun yang tidak rata. */
const TREE_SPOTS: [number, number, number][] = [
	[0.04, 0.13, 0.025],
	[-0.05, 0.125, -0.03],
	[0.012, 0.14, -0.055],
	[-0.022, 0.128, 0.05],
];

const UP = new THREE.Vector3(0, 1, 0);

export default function AethirionIsland({ atmosphereBlendRef }: AethirionIslandProps) {
	const groupRef = useRef<THREE.Group>(null);

	const rockGeometries = useMemo(() => ISLAND_SPECS.map((s) => buildRockGeometry(s.radius, s.seed, s.flatten)), []);
	const { trunk, canopy } = useMemo(() => buildTreeGeometry(), []);
	const treeTransforms = useMemo(
		() =>
			TREE_SPOTS.map((pos) => {
				const dir = new THREE.Vector3(...pos).normalize();
				return { position: new THREE.Vector3(...pos), quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir) };
			}),
		[],
	);

	const rockMaterial = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#a89678',
				flatShading: true,
				roughness: 0.85,
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
				color: '#9ab85a',
				emissive: '#2a3a12',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.75,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const materials = useMemo(() => [rockMaterial, trunkMaterial, canopyMaterial], [rockMaterial, trunkMaterial, canopyMaterial]);

	useFrame(({ clock }) => {
		const t = clock.elapsedTime;
		// Sama seperti kanun: "tidak pernah diam di satu kedudukan cukup lama
		// untuk dipetakan" — kedudukan dikira terus daripada masa, hanyut
		// perlahan mengelilingi garisan Equilara.
		const theta = t * 0.05 + 1.4;
		const y = 0.03 + 0.06 * Math.sin(t * 0.09);
		const ring = Math.sqrt(Math.max(0, 1 - y * y));
		const altitude = GLOBE_RADIUS + 0.22 + Math.sin(t * 0.6) * 0.015;

		if (groupRef.current) {
			groupRef.current.position.set(ring * Math.sin(theta) * altitude, y * altitude, ring * Math.cos(theta) * altitude);
			// Putar mengufuk (paksi-Y) sahaja — bukan senget/goyang (paksi-Z),
			// supaya pulau kekal "atas" konsisten macam ada gravity sendiri
			// dan pokok sentiasa kelihatan tegak, bukan senget ikut putaran.
			groupRef.current.rotation.y = t * 0.12;
		}

		const blend = atmosphereBlendRef.current;
		const targetOpacity = THREE.MathUtils.clamp((blend - 0.25) / 0.4, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
	});

	return (
		<group ref={groupRef}>
			{ISLAND_SPECS.map((spec, i) => (
				<mesh key={i} geometry={rockGeometries[i]} material={rockMaterial} position={spec.offset} />
			))}
			{treeTransforms.map((tr, i) => (
				<group key={i} position={tr.position} quaternion={tr.quaternion}>
					<mesh geometry={trunk} material={trunkMaterial} />
					<mesh geometry={canopy} material={canopyMaterial} />
				</group>
			))}
		</group>
	);
}
