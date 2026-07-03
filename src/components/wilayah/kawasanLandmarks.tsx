import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Setiap bentuk di sini direka terus daripada kawasan_deskripsi & spot_utama
 * Mendari dalam zip-model.json — bukan primitif generik. Rujuk teks lore
 * kalau nak ubah mana-mana satu.
 */

/** Veilrose Quarter — "jantung Mendari": dais/tangga marmar (Applause Steps)
 * bertingkat, dengan kuntum mawar faceted jambu→fuchsia di puncak (gerai
 * bunga mawar) dan tiga "topeng" pipih di sekeliling (Mask Vendor's Row). */
function VeilroseLandmark() {
	return (
		<group>
			<mesh position={[0, 0.09, 0]}>
				<cylinderGeometry args={[1.05, 1.3, 0.28, 6]} />
				<meshStandardMaterial color="#f3ead6" flatShading roughness={0.75} />
			</mesh>
			<mesh position={[0, 0.32, 0]}>
				<cylinderGeometry args={[0.62, 0.8, 0.26, 6]} />
				<meshStandardMaterial color="#f6ecd8" flatShading roughness={0.7} />
			</mesh>
			<mesh position={[0, 0.58, 0]} rotation={[0, Math.PI / 6, 0]}>
				<icosahedronGeometry args={[0.4, 0]} />
				<meshStandardMaterial color="#e8618f" flatShading emissive="#e8618f" emissiveIntensity={0.3} roughness={0.5} />
			</mesh>
			<mesh position={[0, 0.92, 0]} rotation={[0, -Math.PI / 5, 0]}>
				<icosahedronGeometry args={[0.24, 0]} />
				<meshStandardMaterial color="#f2a5c4" flatShading emissive="#f2a5c4" emissiveIntensity={0.35} roughness={0.45} />
			</mesh>
			{[0, 1, 2].map((i) => {
				const angle = (i / 3) * Math.PI * 2 + 0.4;
				return (
					<mesh key={i} position={[Math.cos(angle) * 1.12, 0.16, Math.sin(angle) * 1.12]} rotation={[0, -angle, 0]}>
						<cylinderGeometry args={[0.001, 0.2, 0.28, 5]} />
						<meshStandardMaterial color="#d94f7c" flatShading roughness={0.6} />
					</mesh>
				);
			})}
		</group>
	);
}

/** Faceless Bazaar — kedai-kedai yang tak pernah kekal sama: kluster kotak
 * condong pada ketinggian tak sekata, bahan kelabu-perak macam cermin. */
function FacelessBazaarLandmark() {
	const offsets = [
		{ x: -0.32, z: -0.1, h: 0.55, rot: 0.18 },
		{ x: 0.28, z: 0.18, h: 0.72, rot: -0.24 },
		{ x: 0.02, z: -0.35, h: 0.42, rot: 0.3 },
		{ x: -0.05, z: 0.3, h: 0.34, rot: -0.1 },
	];
	return (
		<group>
			{offsets.map((o, i) => (
				<mesh key={i} position={[o.x, o.h / 2, o.z]} rotation={[0, o.rot, 0]}>
					<boxGeometry args={[0.34, o.h, 0.34]} />
					<meshStandardMaterial color="#d7dee3" flatShading roughness={0.25} metalness={0.55} />
				</mesh>
			))}
			<mesh position={[0, 0.85, 0]} rotation={[0, Math.PI / 4, 0]}>
				<octahedronGeometry args={[0.22, 0]} />
				<meshStandardMaterial color="#eef3f5" flatShading roughness={0.15} metalness={0.7} />
			</mesh>
		</group>
	);
}

/** Idlewick — karusel yang tak pernah berhenti: cakera bertingkat warna
 * pastel (jambu/biru/kuning lemon) yang berputar perlahan tanpa henti. */
function IdlewickLandmark() {
	const spinRef = useRef<THREE.Group>(null);
	useFrame((_, delta) => {
		if (spinRef.current) spinRef.current.rotation.y += delta * 0.6;
	});
	return (
		<group>
			<mesh position={[0, 0.03, 0]}>
				<cylinderGeometry args={[0.04, 0.06, 0.9, 6]} />
				<meshStandardMaterial color="#e8985f" flatShading roughness={0.6} />
			</mesh>
			<group ref={spinRef} position={[0, 0.32, 0]}>
				<mesh position={[0, 0, 0]}>
					<cylinderGeometry args={[0.58, 0.58, 0.1, 8]} />
					<meshStandardMaterial color="#f7c6d9" flatShading emissive="#f7c6d9" emissiveIntensity={0.35} roughness={0.5} />
				</mesh>
				<mesh position={[0, 0.22, 0]}>
					<cylinderGeometry args={[0.4, 0.4, 0.1, 8]} />
					<meshStandardMaterial color="#a8d6ea" flatShading emissive="#a8d6ea" emissiveIntensity={0.35} roughness={0.5} />
				</mesh>
				<mesh position={[0, 0.42, 0]}>
					<cylinderGeometry args={[0.22, 0.22, 0.1, 8]} />
					<meshStandardMaterial color="#f5e79a" flatShading emissive="#f5e79a" emissiveIntensity={0.4} roughness={0.5} />
				</mesh>
			</group>
		</group>
	);
}

/** Harlequin's Corner — "lebih kecil dan lebih intim": kafe redup rendah
 * berdinding marun dengan cahaya lilin hangat, jauh lebih kecil daripada
 * kawasan lain untuk cerminkan skala intim yang dideskripsikan. */
function HarlequinCornerLandmark() {
	return (
		<group>
			<mesh position={[0, 0.24, 0]}>
				<cylinderGeometry args={[0.5, 0.58, 0.48, 6]} />
				<meshStandardMaterial color="#5c2430" flatShading roughness={0.8} />
			</mesh>
			<mesh position={[0, 0.56, 0]}>
				<coneGeometry args={[0.56, 0.34, 6]} />
				<meshStandardMaterial color="#3f1620" flatShading roughness={0.75} />
			</mesh>
			<mesh position={[0, 0.3, 0.42]}>
				<sphereGeometry args={[0.06, 6, 5]} />
				<meshStandardMaterial color="#f2c46a" emissive="#f2c46a" emissiveIntensity={0.9} roughness={0.4} />
			</mesh>
		</group>
	);
}

/** Velvet Alcove — "kawasan paling teduh", dinaungi pokok daun merah jambu
 * lembut, dengan ruang berlangsir merah wain (The Velvet Alcove) tersorok
 * di bawah kanopi. */
function VelvetAlcoveLandmark() {
	const trees = [
		{ x: -0.4, z: 0.1, s: 1 },
		{ x: 0.36, z: -0.18, s: 0.82 },
		{ x: 0.02, z: 0.4, s: 0.68 },
	];
	return (
		<group>
			<mesh position={[0, 0.18, 0]}>
				<boxGeometry args={[0.4, 0.36, 0.32]} />
				<meshStandardMaterial color="#5a1f38" flatShading roughness={0.7} />
			</mesh>
			{trees.map((t, i) => (
				<group key={i} position={[t.x, 0, t.z]} scale={t.s}>
					<mesh position={[0, 0.28, 0]}>
						<cylinderGeometry args={[0.05, 0.07, 0.5, 5]} />
						<meshStandardMaterial color="#6b4a3a" flatShading roughness={0.85} />
					</mesh>
					<mesh position={[0, 0.68, 0]}>
						<icosahedronGeometry args={[0.34, 0]} />
						<meshStandardMaterial color="#f0b9c9" flatShading roughness={0.65} />
					</mesh>
				</group>
			))}
		</group>
	);
}

export function KawasanLandmark({ id }: { id: string }) {
	switch (id) {
		case 'zymelisse':
			return <VeilroseLandmark />;
		case 'zymimic':
			return <FacelessBazaarLandmark />;
		case 'zyminque':
			return <IdlewickLandmark />;
		case 'zymarleq':
			return <HarlequinCornerLandmark />;
		case 'zymirae':
			return <VelvetAlcoveLandmark />;
		default:
			return null;
	}
}
