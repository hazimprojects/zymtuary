import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng, tangentBasis, localToDir } from './worldGlobeConfig';

type MendariTownscapeProps = {
	/** Sama seperti Vegetation/Aethirion — kota hanya kelihatan sepenuhnya
	 * apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);
const MENDARI_RADIUS = 0.13;

type HouseSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: number;
};

/** Rumah kecil rendah-poli (dinding kotak + bumbung kon 4-segi) diserak di
 * sekeliling Mendari — "kota-taman" (Codex 5.2), bukan tanah kosong. Zon
 * tengah dikosongkan untuk carousel (signature Idlewick). */
function buildHouseSpots(): HouseSpot[] {
	const spots: HouseSpot[] = [];
	const center = findLandmarkDirection('mendari-kota');
	const { u, v } = tangentBasis(center);
	const rng = seededRng(6501);
	const count = 55;

	for (let i = 0; i < count; i++) {
		const r = 0.03 + Math.sqrt(rng()) * MENDARI_RADIUS * 0.88;
		const angle = rng() * Math.PI * 2;
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));

		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		const scale = 0.55 + rng() * 0.55;
		spots.push({ position, quaternion, scale });
	}

	return spots;
}

/**
 * Mendari — kota-taman Wilayah Lumiborne. Rumah kecil berbumbung merah
 * jambu (gema bougainvillea) diserak sekeliling satu carousel berputar
 * perlahan di tengah (gema "The Carousel That Never Stops" di Idlewick).
 */
export default function MendariTownscape({ atmosphereBlendRef }: MendariTownscapeProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('mendari-kota')), []);
	const carouselPosition = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.003), [dir]);
	const carouselQuaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);

	const houseSpots = useMemo(() => buildHouseSpots(), []);

	const wallGeo = useMemo(() => {
		const g = new THREE.BoxGeometry(0.024, 0.02, 0.024);
		g.translate(0, 0.01, 0);
		return g;
	}, []);
	const roofGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.019, 0.016, 4);
		g.rotateY(Math.PI / 4);
		g.translate(0, 0.028, 0);
		return g;
	}, []);

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

	const wallMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#d9b878', flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
		[],
	);
	const roofMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#d9698f',
				emissive: '#5a1f30',
				emissiveIntensity: 0.35,
				flatShading: true,
				roughness: 0.6,
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

	const materials = useMemo(() => [wallMat, roofMat, carouselRoofMat], [wallMat, roofMat, carouselRoofMat]);

	const carouselRef = useRef<THREE.Group>(null);
	const spinAngle = useRef(0);

	useFrame((_, delta) => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		// Gubah quaternion (bukan mutate rotation.y terus) — carousel perlu
		// berputar mengelilingi paksi "atas" TEMPATANnya sendiri (arah jejari
		// keluar dari globe), bukan paksi-Y dunia yang lurus. Euler rotation.y
		// akan bercampur dgn kecondongan asas quaternion dan jadi goyang.
		spinAngle.current += delta * 0.25;
		if (carouselRef.current) {
			carouselRef.current.quaternion
				.copy(carouselQuaternion)
				.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spinAngle.current));
		}
	});

	const houseInstances = useMemo(() => {
		if (houseSpots.length === 0) return null;
		const makeInstances = (geometry: THREE.BufferGeometry, material: THREE.Material) => (
			<instancedMesh
				args={[geometry, material, houseSpots.length]}
				ref={(mesh) => {
					if (!mesh) return;
					const m = new THREE.Matrix4();
					houseSpots.forEach((spot, i) => {
						m.compose(spot.position, spot.quaternion, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
						mesh.setMatrixAt(i, m);
					});
					mesh.instanceMatrix.needsUpdate = true;
				}}
			/>
		);
		return (
			<>
				{makeInstances(wallGeo, wallMat)}
				{makeInstances(roofGeo, roofMat)}
			</>
		);
	}, [houseSpots, wallGeo, roofGeo, wallMat, roofMat]);

	return (
		<group>
			{houseInstances}
			<group ref={carouselRef} position={carouselPosition} quaternion={carouselQuaternion}>
				<mesh geometry={carouselBaseGeo} material={wallMat} />
				<mesh geometry={carouselPoleGeo} material={wallMat} />
				{carouselSupportPositions.map((pos, i) => (
					<mesh key={i} geometry={carouselSupportGeo} material={wallMat} position={pos} />
				))}
				<mesh geometry={carouselRoofGeo} material={carouselRoofMat} />
			</group>
		</group>
	);
}
