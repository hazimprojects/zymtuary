import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Setiap bentuk di sini direka terus daripada spot_utama Veilrose Quarter
 * (zip-model.json, entiti zymelisse) — bukan primitif generik.
 */

/** The Applause Steps — "tangga marmar putih di tengah pasar... dipijak
 * beribu kali oleh mereka yang naik untuk 'dipuji'" — dais bertingkat besar
 * dengan cahaya hangat di puncak seperti sorotan lampu pentas. */
function ApplauseStepsLandmark() {
	const glowRef = useRef<THREE.Mesh>(null);
	useFrame(({ clock }) => {
		if (glowRef.current) {
			const t = clock.getElapsedTime();
			const mat = glowRef.current.material as THREE.MeshStandardMaterial;
			mat.emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.15;
		}
	});
	const tiers = [
		{ r: 1.9, h: 0.22 },
		{ r: 1.45, h: 0.22 },
		{ r: 1.0, h: 0.2 },
		{ r: 0.58, h: 0.18 },
	];
	let y = 0;
	return (
		<group>
			{tiers.map((tier, i) => {
				const pos = y + tier.h / 2;
				y += tier.h;
				return (
					<mesh key={i} position={[0, pos, 0]}>
						<cylinderGeometry args={[tier.r, tier.r + 0.22, tier.h, 8]} />
						<meshStandardMaterial color="#f3ead6" flatShading roughness={0.7} />
					</mesh>
				);
			})}
			<mesh ref={glowRef} position={[0, y + 0.05, 0]}>
				<cylinderGeometry args={[0.5, 0.5, 0.06, 8]} />
				<meshStandardMaterial color="#f2c46a" emissive="#f2c46a" emissiveIntensity={0.55} roughness={0.4} />
			</mesh>
			<pointLight position={[0, y + 1.2, 0]} intensity={0.6} color="#f2c46a" distance={5} />
		</group>
	);
}

/** The Memory Room of Smiling Frames — "bangunan rendah berdinding kaca
 * legap... beribu bingkai gambar" — bangunan kaca legap dengan grid bingkai
 * bercahaya lembut di fasadnya. */
function MemoryRoomLandmark() {
	const frameRows = 4;
	const frameCols = 5;
	const frames: { x: number; y: number }[] = [];
	for (let r = 0; r < frameRows; r++) {
		for (let c = 0; c < frameCols; c++) {
			frames.push({ x: (c - (frameCols - 1) / 2) * 0.34, y: 0.5 + r * 0.32 });
		}
	}
	return (
		<group>
			<mesh position={[0, 0.75, 0]}>
				<boxGeometry args={[2.4, 1.5, 1.8]} />
				<meshPhysicalMaterial
					color="#dce8ec"
					flatShading
					roughness={0.35}
					metalness={0.05}
					transmission={0.35}
					transparent
					opacity={0.75}
				/>
			</mesh>
			<mesh position={[0, 1.58, 0]}>
				<boxGeometry args={[2.55, 0.16, 1.95]} />
				<meshStandardMaterial color="#c7d4d8" flatShading roughness={0.7} />
			</mesh>
			{frames.map((f, i) => (
				<mesh key={i} position={[f.x, f.y, 0.91]}>
					<boxGeometry args={[0.16, 0.22, 0.03]} />
					<meshStandardMaterial color="#f5d78e" emissive="#f5d78e" emissiveIntensity={0.4} roughness={0.5} />
				</mesh>
			))}
		</group>
	);
}

/** The Mask Vendor's Row — "gerai-gerai yang menjual topeng senyuman...
 * dari yang paling nipis dan lutsinar sehingga yang tebal" — barisan gerai
 * kayu dengan topeng-topeng tergantung dalam pelbagai saiz/ketebalan. */
function MaskVendorRowLandmark() {
	const stalls = [
		{ x: -1.5, scale: 0.85 },
		{ x: 0, scale: 1.05 },
		{ x: 1.5, scale: 0.95 },
	];
	return (
		<group>
			{stalls.map((s, i) => (
				<group key={i} position={[s.x, 0, 0]} scale={s.scale}>
					<mesh position={[0, 0.3, 0]}>
						<boxGeometry args={[0.85, 0.6, 0.6]} />
						<meshStandardMaterial color="#6b4a3a" flatShading roughness={0.8} />
					</mesh>
					<mesh position={[0, 0.68, 0]} rotation={[0, Math.PI / 4, 0]}>
						<coneGeometry args={[0.72, 0.4, 4]} />
						<meshStandardMaterial color="#8a5a42" flatShading roughness={0.75} />
					</mesh>
					{[-0.22, 0, 0.22].map((mx, mi) => (
						<mesh key={mi} position={[mx, 0.72, 0.32]} rotation={[0.15, 0, 0]}>
							<sphereGeometry args={[0.15, 6, 5]} />
							<meshStandardMaterial color={mi === 1 ? '#f2c9dc' : '#e8a8c4'} flatShading roughness={0.6} />
						</mesh>
					))}
				</group>
			))}
		</group>
	);
}

export function VeilroseSpotLandmark({ id }: { id: string }) {
	switch (id) {
		case 'The Applause Steps':
			return <ApplauseStepsLandmark />;
		case 'The Memory Room of Smiling Frames':
			return <MemoryRoomLandmark />;
		case "The Mask Vendor's Row":
			return <MaskVendorRowLandmark />;
		default:
			return null;
	}
}

/** Gerai bunga mawar hiasan — mengisi plaza supaya "pasar terbuka dipenuhi
 * gerai bunga mawar" terasa padat, bukan sekadar 3 spot terpencil. */
export function RoseStallProp({ scale }: { scale: number }) {
	return (
		<group scale={scale}>
			<mesh position={[0, 0.18, 0]}>
				<cylinderGeometry args={[0.32, 0.36, 0.36, 6]} />
				<meshStandardMaterial color="#8a5a42" flatShading roughness={0.8} />
			</mesh>
			{[0, 1, 2].map((i) => (
				<mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.16, 0.42, Math.sin((i / 3) * Math.PI * 2) * 0.16]}>
					<icosahedronGeometry args={[0.19, 0]} />
					<meshStandardMaterial
						color={i === 0 ? '#e8618f' : i === 1 ? '#f2a5c4' : '#d94f7c'}
						flatShading
						emissive={i === 0 ? '#e8618f' : i === 1 ? '#f2a5c4' : '#d94f7c'}
						emissiveIntensity={0.25}
						roughness={0.55}
					/>
				</mesh>
			))}
		</group>
	);
}
