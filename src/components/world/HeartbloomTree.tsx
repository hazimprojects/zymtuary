import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, deg, directionFromThetaY } from './worldGlobeConfig';

type HeartbloomTreeProps = {
	/** Sama seperti Vegetation/Aethirion — pokok gergasi hanya kelihatan
	 * sepenuhnya apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const HEARTBLOOM_THETA = deg(100);
const HEARTBLOOM_Y = 0.5;

const UP = new THREE.Vector3(0, 1, 0);

const TRUNK_H = 0.13;

/**
 * Pokok gergasi Heartbloom — pusat Heartbloom Isle, jauh lebih besar drpd
 * pokok hutan biasa yang diserak Vegetation.tsx di sekelilingnya. Tiga
 * lapisan kanopi bertindih (bukan satu kon tunggal) untuk kesan pokok
 * purba yang rendang & bertingkat.
 */
export default function HeartbloomTree({ atmosphereBlendRef }: HeartbloomTreeProps) {
	const dir = useMemo(() => new THREE.Vector3(...directionFromThetaY(HEARTBLOOM_THETA, HEARTBLOOM_Y)), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.006), [dir]);

	const trunkGeo = useMemo(() => {
		const g = new THREE.CylinderGeometry(0.02, 0.032, TRUNK_H, 7);
		g.translate(0, TRUNK_H / 2, 0);
		return g;
	}, []);
	const canopyLowGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.11, 0.12, 7);
		g.translate(0, TRUNK_H + 0.05, 0);
		return g;
	}, []);
	const canopyMidGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.08, 0.095, 7);
		g.translate(0, TRUNK_H + 0.095, 0);
		return g;
	}, []);
	const canopyTopGeo = useMemo(() => {
		const g = new THREE.ConeGeometry(0.05, 0.07, 7);
		g.translate(0, TRUNK_H + 0.135, 0);
		return g;
	}, []);

	const trunkMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#5a3d24', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const canopyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#c9d66a',
				emissive: '#4a5a1a',
				emissiveIntensity: 0.45,
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
			<mesh geometry={trunkGeo} material={trunkMat} />
			<mesh geometry={canopyLowGeo} material={canopyMat} />
			<mesh geometry={canopyMidGeo} material={canopyMat} />
			<mesh geometry={canopyTopGeo} material={canopyMat} />
		</group>
	);
}
