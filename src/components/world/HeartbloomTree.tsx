import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection } from './worldGlobeConfig';

type HeartbloomTreeProps = {
	/** Sama seperti Vegetation/Aethirion — pokok gergasi hanya kelihatan
	 * sepenuhnya apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

const TRUNK_H = 0.15;

/** Kanopi rata/bujur (bukan kon tirus macam pokok pine) — sfera unit
 * dipepatkan (scale.y kecil drpd scale.x/z) untuk profil "payung/rak
 * daun" bertingkat macam world tree sebenar. */
function makeCanopyGeometry(radiusXZ: number, radiusY: number, centerY: number): THREE.BufferGeometry {
	const g = new THREE.IcosahedronGeometry(1, 1);
	g.scale(radiusXZ, radiusY, radiusXZ);
	g.translate(0, centerY, 0);
	return g;
}

/**
 * Pokok gergasi Heartbloom — world tree bertingkat macam rujukan (kanopi
 * rata/bujur berlapis, bukan silhouette pine/Krismas), dengan pangkal akar
 * melebar di dasar batang. Jauh lebih besar drpd pokok hutan biasa yang
 * sudah diserak Vegetation.tsx di sekelilingnya.
 */
export default function HeartbloomTree({ atmosphereBlendRef }: HeartbloomTreeProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('heartbloom')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.006), [dir]);

	const rootFlareGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.075, 0.05, 8);
		g.translate(0, 0.025, 0);
		return g;
	}, []);
	const trunkGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.026, 0.045, TRUNK_H, 7);
		g.translate(0, TRUNK_H / 2 + 0.02, 0);
		return g;
	}, []);
	const canopyLowGeo = useMemo(() => makeCanopyGeometry(0.16, 0.09, TRUNK_H + 0.05), []);
	const canopyMidGeo = useMemo(() => makeCanopyGeometry(0.115, 0.07, TRUNK_H + 0.135), []);
	const canopyTopGeo = useMemo(() => makeCanopyGeometry(0.075, 0.05, TRUNK_H + 0.2), []);

	const trunkMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#5a3d24', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const canopyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#a8c94a',
				emissive: '#4a5a1a',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.65,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	const materials = useMemo(() => [trunkMat, canopyMat], [trunkMat, canopyMat]);

	useFrame(() => {
		const blend = atmosphereBlendRef.current;
		const target = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		for (const mat of materials) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={rootFlareGeo} material={trunkMat} />
			<mesh geometry={trunkGeo} material={trunkMat} />
			<mesh geometry={canopyLowGeo} material={canopyMat} />
			<mesh geometry={canopyMidGeo} material={canopyMat} />
			<mesh geometry={canopyTopGeo} material={canopyMat} />
		</group>
	);
}
