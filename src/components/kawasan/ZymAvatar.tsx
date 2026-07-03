import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

/**
 * Avatar Zym-kesedaran — siluet neutral bercahaya tanpa wajah/ciri peribadi
 * (Garden Keeper panggil SETIAP pelawat "Zym", jadi avatar mesti boleh jadi
 * "sesiapa saja"). Badan cahaya lembut yang warnanya ikut wilayah/hemisfera.
 * Muncul dengan animasi "jatuh dengan lembut daripada cahaya menjadi bentuk
 * penuh" — mencerminkan Zym-kesedaran baru memasuki Zymtuary.
 */
export function ZymAvatar({ glowColor }: { glowColor: string }) {
	const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
	const headMatRef = useRef<THREE.MeshStandardMaterial>(null);
	const groupRef = useRef<THREE.Group>(null);
	const formProgress = useRef(0);
	const bobPhase = useRef(Math.random() * Math.PI * 2);

	useFrame((_, delta) => {
		if (formProgress.current < 1) {
			formProgress.current = Math.min(1, formProgress.current + delta * 0.55);
		}
		const t = easeOutCubic(formProgress.current);
		if (groupRef.current) {
			groupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.05, 1, t));
			bobPhase.current += delta * 1.1;
			groupRef.current.position.y = Math.sin(bobPhase.current) * 0.035;
		}
		const restingIntensity = 0.55;
		const entryIntensity = 2.6;
		const intensity = THREE.MathUtils.lerp(entryIntensity, restingIntensity, t);
		if (bodyMatRef.current) bodyMatRef.current.emissiveIntensity = intensity;
		if (headMatRef.current) headMatRef.current.emissiveIntensity = intensity * 1.15;
	});

	return (
		<group ref={groupRef}>
			<mesh position={[0, 0.5, 0]}>
				<cylinderGeometry args={[0.12, 0.33, 1.0, 7]} />
				<meshStandardMaterial
					ref={bodyMatRef}
					color={glowColor}
					emissive={glowColor}
					emissiveIntensity={0.55}
					roughness={0.4}
					flatShading
				/>
			</mesh>
			<mesh position={[0, 1.12, 0]}>
				<sphereGeometry args={[0.16, 8, 7]} />
				<meshStandardMaterial
					ref={headMatRef}
					color={glowColor}
					emissive={glowColor}
					emissiveIntensity={0.65}
					roughness={0.35}
					flatShading
				/>
			</mesh>
			<pointLight position={[0, 0.7, 0]} intensity={0.5} color={glowColor} distance={4} />
		</group>
	);
}
