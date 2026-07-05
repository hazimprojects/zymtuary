import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection, localToDir, seededRng, tangentBasis } from './worldGlobeConfig';

type TerrainRingsProps = {
	/** id LANDMARK_FEATURES yang jadi pusat cincin. */
	landmarkId: string;
	/** Jejari sudut (radian) tempat bukit/gunung diserak — BUKAN mengisi
	 * cakera macam TerrainProps punya batu, tapi satu gegelang supaya
	 * bentuknya "benteng melindungi" sekeliling pusat, bukan gunung tunggal. */
	ringRadius: number;
	count: number;
	heightRange: [number, number];
	seed: number;
	color: string;
	atmosphereBlendRef: React.MutableRefObject<number>;
};

type HillSpot = {
	position: THREE.Vector3;
	quaternion: THREE.Quaternion;
	scale: THREE.Vector3;
};

const UP = new THREE.Vector3(0, 1, 0);

function buildRingSpots(
	landmarkId: string,
	ringRadius: number,
	count: number,
	heightRange: [number, number],
	seed: number,
): HillSpot[] {
	const center = findLandmarkDirection(landmarkId);
	const { u, v } = tangentBasis(center);
	const rng = seededRng(seed);
	const spots: HillSpot[] = [];
	const angleStep = (Math.PI * 2) / count;

	for (let i = 0; i < count; i++) {
		const angle = i * angleStep + (rng() - 0.5) * angleStep * 0.7;
		const r = ringRadius * (0.88 + rng() * 0.24);
		const lu = Math.cos(angle) * r;
		const lv = Math.sin(angle) * r;
		const dir = new THREE.Vector3(...localToDir(center, u, v, lu, lv));

		const position = dir.clone().multiplyScalar(GLOBE_RADIUS + 0.004);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir);
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2));
		const tiltAxis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
		quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(tiltAxis, (rng() - 0.5) * 0.3));

		const h = heightRange[0] + rng() * (heightRange[1] - heightRange[0]);
		const scale = new THREE.Vector3(h * (0.8 + rng() * 0.4), h * (0.55 + rng() * 0.35), h * (0.8 + rng() * 0.4));
		spots.push({ position, quaternion, scale });
	}

	return spots;
}

function makeHillGeometry() {
	return new THREE.IcosahedronGeometry(1, 1);
}

/**
 * Banjaran/benteng gunung berbentuk cincin mengelilingi satu landmark —
 * teknik instancing sama dgn TerrainProps punya batu, tapi diserak pada
 * jejari sudut TETAP (gegelang) supaya bacaannya "benteng melindungi
 * lembah/puncak", bukan gunung yang mengisi cakera penuh.
 */
export default function TerrainRings({
	landmarkId,
	ringRadius,
	count,
	heightRange,
	seed,
	color,
	atmosphereBlendRef,
}: TerrainRingsProps) {
	const geo = useMemo(() => makeHillGeometry(), []);
	const spots = useMemo(
		() => buildRingSpots(landmarkId, ringRadius, count, heightRange, seed),
		[landmarkId, ringRadius, count, heightRange, seed],
	);

	const material = useMemo(
		() => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, transparent: true, opacity: 0 }),
		[color],
	);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		material.opacity = THREE.MathUtils.lerp(material.opacity, target, 0.05);
		material.visible = material.opacity > 0.01;
	});

	if (spots.length === 0) return null;

	return (
		<instancedMesh
			args={[geo, material, spots.length]}
			ref={(mesh) => {
				if (!mesh) return;
				const m = new THREE.Matrix4();
				spots.forEach((spot, i) => {
					m.compose(spot.position, spot.quaternion, spot.scale);
					mesh.setMatrixAt(i, m);
				});
				mesh.instanceMatrix.needsUpdate = true;
			}}
		/>
	);
}
