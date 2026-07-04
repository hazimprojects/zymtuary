import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VEILROSE_PALETTE } from './veilrosePalette';
import { terrainParams, type IslandTerrainOptions } from '../wilayah/wilayahTerrain';

/**
 * Setiap bentuk di sini direka terus daripada spot_utama Veilrose Quarter
 * (zip-model.json, entiti zymelisse) — bukan primitif generik. Warna diambil
 * daripada VEILROSE_PALETTE (gaya Sky — pelbagai & hidup tetapi harmoni)
 * supaya setiap objek saling berkaitan, bukan dipilih berasingan.
 */

/** The Applause Steps — "tangga marmar putih di tengah pasar... dipijak
 * beribu kali oleh mereka yang naik untuk 'dipuji'" — dais bertingkat besar
 * dengan cahaya hangat di puncak seperti sorotan lampu pentas.
 *
 * Jejari & ketinggian setiap tingkat diambil TERUS daripada
 * heartStepRadius/heartStepTierHeight (wilayahTerrain.ts) — formula yang
 * sama yang menentukan permukaan tanah boleh-jalan sebenar — supaya apa
 * yang kelihatan sebagai tangga marmar sepadan tepat dengan apa yang
 * sebenarnya boleh didaki watak, bukan struktur berasingan yang melayang
 * tidak sepadan dengan tanah di bawahnya. */
function ApplauseStepsLandmark({ terrainOptions }: { terrainOptions?: IslandTerrainOptions }) {
	const glowRef = useRef<THREE.Mesh>(null);
	useFrame(({ clock }) => {
		if (glowRef.current) {
			const t = clock.getElapsedTime();
			const mat = glowRef.current.material as THREE.MeshStandardMaterial;
			mat.emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.15;
		}
	});

	const { heartStepRadius: R, heartStepTierHeight: H } = terrainParams(terrainOptions);
	// Apron asas melitupi SELURUH jejari heart-step (termasuk band terluar
	// yang tidak naik dalam formula tanah) supaya cerun tanah terdedah tidak
	// kelihatan — tanpa ini, cerun emas yang terdedah antara R dan 2R/3
	// itulah yang sebenarnya nampak macam timbunan pasir dari jauh, bukan
	// silinder marmar kecil di atasnya. Dua tingkat seterusnya terangkat
	// sebenar mengikut pecahan formula tanah dalam wilayahTerrain.ts.
	const BASE_APRON_HEIGHT = 0.06;
	const stepTiers = [
		{ r: R + 0.05, h: BASE_APRON_HEIGHT },
		{ r: (2 * R) / 3, h: H },
		{ r: R / 3, h: H },
	];
	let y = 0;
	const pennantCount = 8;
	const plinthAngles = [Math.PI / 2, -Math.PI / 2];

	return (
		<group>
			{stepTiers.map((tier, i) => {
				const pos = y + tier.h / 2;
				y += tier.h;
				return (
					<group key={i}>
						<mesh position={[0, pos, 0]}>
							<cylinderGeometry args={[tier.r, tier.r + 0.18, tier.h, 20]} />
							{/* fog={false} + putih terang (bukan cream) sengaja — kabus
							 * jarak scene ini condong ke warna emas tanah (BASE_GROUND_COLOR),
							 * jadi tanpa ini marmar bercampur dengan pasir dan nampak macam
							 * timbunan pasir dari jauh, bukan tangga marmar putih yang jelas. */}
							<meshStandardMaterial
								color="#FFFFFF"
								emissive="#FFFFFF"
								emissiveIntensity={0.1}
								flatShading
								roughness={0.55}
								fog={false}
							/>
						</mesh>
						{/* Jalur emas di bucu setiap tingkat — takrifan "tepi tangga"
						 * yang kekal terbaca dari jauh walaupun ketinggian tiap tingkat
						 * cetek, tanpa perlu struktur berasingan yang menjulang. */}
						<mesh position={[0, pos + tier.h / 2 - 0.02, 0]}>
							<cylinderGeometry args={[tier.r + 0.185, tier.r + 0.185, 0.04, 20]} />
							<meshStandardMaterial
								color={VEILROSE_PALETTE.gold}
								emissive={VEILROSE_PALETTE.gold}
								emissiveIntensity={0.35}
								flatShading
								roughness={0.4}
								fog={false}
							/>
						</mesh>
					</group>
				);
			})}
			<mesh ref={glowRef} position={[0, y + 0.06, 0]}>
				<cylinderGeometry args={[R / 3 - 0.1, R / 3 - 0.1, 0.12, 20]} />
				<meshStandardMaterial
					color={VEILROSE_PALETTE.gold}
					emissive={VEILROSE_PALETTE.gold}
					emissiveIntensity={0.6}
					roughness={0.4}
					fog={false}
				/>
			</mesh>
			<pointLight position={[0, y + 1.1, 0]} intensity={0.9} color={VEILROSE_PALETTE.gold} distance={9} />
			<pointLight position={[R * 0.55, y * 0.4, R * 0.2]} intensity={0.28} color={VEILROSE_PALETTE.pink} distance={4} />
			<pointLight position={[-R * 0.5, y * 0.4, -R * 0.3]} intensity={0.28} color={VEILROSE_PALETTE.purple} distance={4} />

			{/* Cerucuk panji di sekeliling gelanggang "pujian" */}
			{Array.from({ length: pennantCount }, (_, i) => {
				const a = (i / pennantCount) * Math.PI * 2;
				const px = Math.cos(a) * R;
				const pz = Math.sin(a) * R;
				const flagColor = i % 2 === 0 ? VEILROSE_PALETTE.pink : VEILROSE_PALETTE.purple;
				return (
					<group key={i} position={[px, 0, pz]} rotation={[0, -a, 0]}>
						<mesh position={[0, 0.55, 0]}>
							<cylinderGeometry args={[0.025, 0.03, 1.1, 5]} />
							<meshStandardMaterial color="#8a5a42" flatShading roughness={0.75} />
						</mesh>
						<mesh position={[0.09, 0.95, 0]} rotation={[0, 0, -Math.PI / 2]}>
							<coneGeometry args={[0.13, 0.22, 3]} />
							<meshStandardMaterial color={flagColor} flatShading emissive={flagColor} emissiveIntensity={0.2} roughness={0.6} />
						</mesh>
					</group>
				);
			})}

			{/* Plinth kembar berhampiran puncak, masing-masing bermahkotakan
			 * "piala" emas bersinar */}
			{plinthAngles.map((a, i) => {
				const px = Math.cos(a) * (R / 3 + 0.32);
				const pz = Math.sin(a) * (R / 3 + 0.32);
				return (
					<group key={i} position={[px, y, pz]}>
						<mesh position={[0, 0.12, 0]}>
							<cylinderGeometry args={[0.16, 0.19, 0.24, 8]} />
							<meshStandardMaterial color="#FFFFFF" flatShading roughness={0.55} fog={false} />
						</mesh>
						<mesh position={[0, 0.29, 0]}>
							<icosahedronGeometry args={[0.11, 0]} />
							<meshStandardMaterial
								color={VEILROSE_PALETTE.gold}
								emissive={VEILROSE_PALETTE.gold}
								emissiveIntensity={0.5}
								flatShading
								roughness={0.4}
							/>
						</mesh>
					</group>
				);
			})}
		</group>
	);
}

const MEMORY_ROOM_CURVE_RADIUS = 4.2;
const MEMORY_ROOM_HALF_SPAN = 1.35;
const MEMORY_ROOM_SEGMENT_HEIGHTS = [1.85, 2.05, 2.2, 2.3, 2.2, 2.05, 1.85];

/** The Memory Room of Smiling Frames — "bangunan rendah berdinding kaca
 * legap... beribu bingkai gambar" — bukan lagi satu kotak rata, tetapi
 * "galeri" dinding kaca yang melengkung panjang (7 seksyen mengikut lengkung
 * ~separuh plaza), setiap seksyen berbeza tinggi sedikit untuk siluet yang
 * lebih organik, dipenuhi grid bingkai bercahaya supaya "beribu bingkai"
 * terasa jauh lebih padat. `facingAngle` (dari SpotMarker, arah anchor dari
 * tengah plaza) memutar keseluruhan lengkung supaya fasadnya menghala ke
 * tengah plaza tidak kira di mana spot ini diletakkan. */
function MemoryRoomLandmark({ facingAngle = 0 }: { facingAngle?: number }) {
	const segments = MEMORY_ROOM_SEGMENT_HEIGHTS.length;
	const angles = Array.from({ length: segments }, (_, i) =>
		THREE.MathUtils.lerp(-MEMORY_ROOM_HALF_SPAN, MEMORY_ROOM_HALF_SPAN, i / (segments - 1)),
	);

	return (
		<group rotation={[0, facingAngle + Math.PI, 0]}>
			{angles.map((a, i) => {
				const h = MEMORY_ROOM_SEGMENT_HEIGHTS[i];
				const lx = MEMORY_ROOM_CURVE_RADIUS * Math.sin(a);
				const lz = MEMORY_ROOM_CURVE_RADIUS * (Math.cos(a) - 1);
				const frameCols = 2;
				const frameRows = 4;
				const frames: { fx: number; fy: number }[] = [];
				for (let r = 0; r < frameRows; r++) {
					for (let c = 0; c < frameCols; c++) {
						frames.push({ fx: (c - (frameCols - 1) / 2) * 0.4, fy: 0.4 + r * 0.35 });
					}
				}
				return (
					<group key={i} position={[lx, 0, lz]} rotation={[0, a, 0]}>
						<mesh position={[0, h / 2, 0]}>
							<boxGeometry args={[1.3, h, 0.22]} />
							{/* emissive ditambah supaya ungu kekal kelihatan ungu — cahaya
							 * hangat/oren scene ini (rendah komponen biru) menenggelamkan
							 * warna ungu jadi coklat/terakota kalau bergantung sepenuhnya
							 * pada pencahayaan luar untuk warnanya. */}
							<meshStandardMaterial
								color={VEILROSE_PALETTE.purple}
								emissive={VEILROSE_PALETTE.purple}
								emissiveIntensity={0.4}
								flatShading
								roughness={0.3}
								metalness={0.1}
								transparent
								opacity={0.82}
							/>
						</mesh>
						{/* Kornis kecil di atas tiap seksyen — gantian portico lurus
						 * lama, kini mengikuti lengkung */}
						<mesh position={[0, h + 0.09, 0]}>
							<boxGeometry args={[1.44, 0.14, 0.36]} />
							<meshStandardMaterial color={VEILROSE_PALETTE.cream} flatShading roughness={0.7} />
						</mesh>
						{frames.map((f, fi) => (
							<mesh key={fi} position={[f.fx, f.fy, 0.13]}>
								<boxGeometry args={[0.18, 0.24, 0.03]} />
								<meshStandardMaterial
									color={VEILROSE_PALETTE.gold}
									emissive={VEILROSE_PALETTE.gold}
									emissiveIntensity={0.4}
									roughness={0.5}
								/>
							</mesh>
						))}
					</group>
				);
			})}

			{/* Tiang penghubung antara tiap seksyen — sama formula lengkung
			 * seperti seksyen itu sendiri, pada sudut pertengahan */}
			{angles.slice(0, -1).map((a, i) => {
				const midA = (a + angles[i + 1]) / 2;
				const lx = MEMORY_ROOM_CURVE_RADIUS * Math.sin(midA);
				const lz = MEMORY_ROOM_CURVE_RADIUS * (Math.cos(midA) - 1);
				const h = (MEMORY_ROOM_SEGMENT_HEIGHTS[i] + MEMORY_ROOM_SEGMENT_HEIGHTS[i + 1]) / 2 + 0.15;
				return (
					<mesh key={i} position={[lx, h / 2, lz]} rotation={[0, midA, 0]}>
						<cylinderGeometry args={[0.06, 0.07, h, 8]} />
						<meshStandardMaterial color={VEILROSE_PALETTE.cream} flatShading roughness={0.6} />
					</mesh>
				);
			})}

			<pointLight position={[0, 1.6, 1.1]} intensity={0.5} color={VEILROSE_PALETTE.cream} distance={5} />
		</group>
	);
}

/** The Mask Vendor's Row — "gerai-gerai yang menjual topeng senyuman...
 * dari yang paling nipis dan lutsinar sehingga yang tebal" — enam gerai kini
 * jelas lebih besar berbanding avatar Zym (bumbung menjulang jauh melebihi
 * kepala), dengan tiga bentuk bumbung berbeza (kon, kubah, bendul condong)
 * bersilih ganti supaya barisan terasa pelbagai, bukan gerai seragam
 * disalin berulang. Ketebalan topeng dibezakan secara literal: nipis =
 * cakera legap-lutsinar, tebal = sfera pejal penuh. */
function MaskVendorRowLandmark() {
	const stalls: { x: number; scale: number; kind: 'cone' | 'dome' | 'awning'; wood: string; roof: string; thin: boolean }[] = [
		{ x: -5, scale: 0.85, kind: 'cone', wood: '#6b4a3a', roof: VEILROSE_PALETTE.pink, thin: true },
		{ x: -3, scale: 1.15, kind: 'dome', wood: '#7a5236', roof: VEILROSE_PALETTE.purple, thin: false },
		{ x: -1, scale: 1.35, kind: 'awning', wood: '#8a6a4a', roof: VEILROSE_PALETTE.gold, thin: true },
		{ x: 1, scale: 1.0, kind: 'cone', wood: '#5a4030', roof: VEILROSE_PALETTE.purple, thin: false },
		{ x: 3, scale: 1.2, kind: 'dome', wood: '#6b4a3a', roof: VEILROSE_PALETTE.pink, thin: true },
		{ x: 5, scale: 0.95, kind: 'awning', wood: '#7a5236', roof: VEILROSE_PALETTE.gold, thin: false },
	];

	return (
		<group>
			{stalls.map((s, i) => (
				<group key={i} position={[s.x, 0, 0]} scale={s.scale}>
					<mesh position={[0, 0.5, 0]}>
						<boxGeometry args={[1.1, 1.0, 0.75]} />
						<meshStandardMaterial color={s.wood} flatShading roughness={0.8} />
					</mesh>

					{s.kind === 'cone' ? (
						<mesh position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
							<coneGeometry args={[0.95, 0.9, 4]} />
							<meshStandardMaterial color="#8a5a42" flatShading roughness={0.75} />
						</mesh>
					) : null}
					{s.kind === 'dome' ? (
						<mesh position={[0, 1.02, 0]} scale={[1, 0.6, 1]}>
							<icosahedronGeometry args={[0.85, 1]} />
							<meshStandardMaterial color={s.roof} flatShading roughness={0.55} emissive={s.roof} emissiveIntensity={0.12} />
						</mesh>
					) : null}
					{s.kind === 'awning' ? (
						<mesh position={[0, 1.3, 0.42]} rotation={[0.32, 0, 0]}>
							<boxGeometry args={[1.35, 0.07, 0.95]} />
							<meshStandardMaterial color={s.roof} flatShading roughness={0.7} side={THREE.DoubleSide} />
						</mesh>
					) : null}

					{[-0.28, 0, 0.28].map((mx, mi) => {
						const color = mi === 1 ? VEILROSE_PALETTE.purple : VEILROSE_PALETTE.pink;
						return s.thin ? (
							<mesh key={mi} position={[mx, 1.12, 0.4]} rotation={[0.15, 0, 0]}>
								<cylinderGeometry args={[0.17, 0.17, 0.04, 8]} />
								<meshStandardMaterial color={color} flatShading roughness={0.5} transparent opacity={0.45} />
							</mesh>
						) : (
							<mesh key={mi} position={[mx, 1.12, 0.4]} rotation={[0.15, 0, 0]}>
								<sphereGeometry args={[0.18, 6, 5]} />
								<meshStandardMaterial color={color} flatShading roughness={0.6} />
							</mesh>
						);
					})}
				</group>
			))}
		</group>
	);
}

/** The Rehearsal Mirrors — "sebaris cermin panjang tersorok di lorong
 * belakang pasar... berlatih menyusun senyuman paling meyakinkan" — separuh
 * bulatan cermin menghala ke tengah, dengan permaidani kecil menandakan di
 * mana dia berdiri berlatih, dan sebuah bangku berhampiran. */
function RehearsalMirrorsLandmark() {
	const glassRefs = useRef<(THREE.Mesh | null)[]>([]);
	useFrame(({ clock }) => {
		const t = clock.getElapsedTime();
		glassRefs.current.forEach((mesh, i) => {
			if (!mesh) return;
			const mat = mesh.material as THREE.MeshStandardMaterial;
			mat.emissiveIntensity = 0.22 + Math.sin(t * 0.6 + i * 0.9) * 0.08;
		});
	});

	const mirrorAngles = [-1.0, -0.5, 0, 0.5, 1.0];
	const arcRadius = 1.1;

	return (
		<group>
			{/* Permaidani kecil menandakan tempat dia berlatih */}
			<mesh position={[0, 0.02, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.55, 16]} />
				<meshStandardMaterial color={VEILROSE_PALETTE.pink} flatShading roughness={0.85} transparent opacity={0.7} />
			</mesh>

			{mirrorAngles.map((a, i) => {
				const x = Math.sin(a) * arcRadius;
				const z = Math.cos(a) * arcRadius;
				return (
					<group key={i} position={[x, 0.85, z]} rotation={[0, a + Math.PI, 0]}>
						<mesh>
							<boxGeometry args={[0.9, 1.7, 0.08]} />
							<meshStandardMaterial color="#8a5a42" flatShading roughness={0.6} />
						</mesh>
						<mesh
							ref={(el) => {
								glassRefs.current[i] = el;
							}}
							position={[0, 0, 0.05]}
						>
							<boxGeometry args={[0.72, 1.5, 0.02]} />
							<meshStandardMaterial
								color={VEILROSE_PALETTE.cream}
								emissive={VEILROSE_PALETTE.cream}
								emissiveIntensity={0.22}
								flatShading
								roughness={0.25}
								metalness={0.3}
								transparent
								opacity={0.55}
							/>
						</mesh>
					</group>
				);
			})}

			{/* Bangku kecil di tepi */}
			<group position={[0.85, 0, -0.55]} rotation={[0, -0.6, 0]}>
				<mesh position={[0, 0.22, 0]}>
					<cylinderGeometry args={[0.005, 0.005, 0.44, 4]} />
					<meshStandardMaterial color="#6b4a3a" flatShading roughness={0.8} />
				</mesh>
				<mesh position={[0, 0.45, 0]}>
					<cylinderGeometry args={[0.22, 0.22, 0.08, 10]} />
					<meshStandardMaterial color={VEILROSE_PALETTE.purple} flatShading roughness={0.6} />
				</mesh>
			</group>
		</group>
	);
}

/** The Room of Fallen Petals — "bilik simpanan... kelopak mawar yang sudah
 * layu dan topeng senyuman yang retak — dibuang jauh dari mata pengunjung" —
 * bumbung condong terbuka tanpa dinding (boleh dilalui/dijenguk, bukan
 * bangunan tertutup), dengan mawar layu, serpihan topeng retak, dan sebuah
 * peti kayu. Warna sengaja dilesukan (ash/driedRose) berbanding pasar
 * hadapan yang sentiasa segar. */
function RoomOfFallenPetalsLandmark() {
	const wiltRefs = useRef<(THREE.Group | null)[]>([]);
	useFrame(({ clock }) => {
		const t = clock.getElapsedTime();
		wiltRefs.current.forEach((g, i) => {
			if (!g) return;
			g.rotation.z = -0.35 + Math.sin(t * 0.4 + i * 1.7) * 0.04;
		});
	});

	const wiltedClusters = [
		{ x: -0.5, z: -0.3 },
		{ x: 0.3, z: -0.5 },
		{ x: 0.05, z: 0.2 },
	];
	const maskFragments = [
		{ x: -0.9, z: 0.35, rot: 0.4 },
		{ x: 0.7, z: -0.15, rot: -0.8 },
		{ x: -0.2, z: 0.55, rot: 1.2 },
	];

	return (
		<group>
			{/* Tiang penyokong */}
			<mesh position={[-0.76, 0.65, -0.5]}>
				<cylinderGeometry args={[0.045, 0.05, 1.3, 6]} />
				<meshStandardMaterial color="#5a4030" flatShading roughness={0.85} />
			</mesh>
			<mesh position={[0.76, 0.65, -0.5]}>
				<cylinderGeometry args={[0.045, 0.05, 1.3, 6]} />
				<meshStandardMaterial color="#5a4030" flatShading roughness={0.85} />
			</mesh>
			<mesh position={[0, 0.65, 0.7]}>
				<cylinderGeometry args={[0.045, 0.05, 1.3, 6]} />
				<meshStandardMaterial color="#5a4030" flatShading roughness={0.85} />
			</mesh>
			{/* Bumbung condong terbuka — tiada dinding, boleh dilalui/dijenguk */}
			<mesh position={[0, 1.35, -0.05]} rotation={[0.22, 0, 0]}>
				<boxGeometry args={[2.0, 0.08, 1.7]} />
				<meshStandardMaterial color={VEILROSE_PALETTE.ash} flatShading roughness={0.8} />
			</mesh>

			{/* Kelopak & mawar layu — bercondong ke bawah, warna dilesukan */}
			{wiltedClusters.map((c, i) => (
				<group
					key={i}
					ref={(el) => {
						wiltRefs.current[i] = el;
					}}
					position={[c.x, 0.16, c.z]}
					rotation={[0, i * 1.1, -0.35]}
				>
					<mesh position={[0, 0.1, 0]}>
						<cylinderGeometry args={[0.02, 0.025, 0.2, 5]} />
						<meshStandardMaterial color="#6b5a42" flatShading roughness={0.85} />
					</mesh>
					<mesh position={[0, 0.19, 0]}>
						<icosahedronGeometry args={[0.11, 0]} />
						<meshStandardMaterial color={VEILROSE_PALETTE.driedRose} flatShading roughness={0.75} />
					</mesh>
				</group>
			))}

			{/* Serpihan topeng retak, tergeletak di lantai */}
			{maskFragments.map((m, i) => (
				<mesh key={i} position={[m.x, 0.03, m.z]} rotation={[-Math.PI / 2 + 0.3, 0, m.rot]}>
					<cylinderGeometry args={[0.14, 0.14, 0.025, 8, 1, false, 0, Math.PI * 1.5]} />
					<meshStandardMaterial color={VEILROSE_PALETTE.ash} flatShading roughness={0.7} side={THREE.DoubleSide} />
				</mesh>
			))}

			{/* Peti kayu simpanan */}
			<mesh position={[-0.55, 0.16, 0.55]} rotation={[0, 0.3, 0]}>
				<boxGeometry args={[0.42, 0.32, 0.3]} />
				<meshStandardMaterial color="#5a4030" flatShading roughness={0.8} />
			</mesh>
		</group>
	);
}

export function VeilroseSpotLandmark({
	id,
	terrainOptions,
	facingAngle,
}: {
	id: string;
	terrainOptions?: IslandTerrainOptions;
	facingAngle?: number;
}) {
	switch (id) {
		case 'The Applause Steps':
			return <ApplauseStepsLandmark terrainOptions={terrainOptions} />;
		case 'The Memory Room of Smiling Frames':
			return <MemoryRoomLandmark facingAngle={facingAngle} />;
		case "The Mask Vendor's Row":
			return <MaskVendorRowLandmark />;
		case 'The Rehearsal Mirrors':
			return <RehearsalMirrorsLandmark />;
		case 'The Room of Fallen Petals':
			return <RoomOfFallenPetalsLandmark />;
		default:
			return null;
	}
}

const BLOOM_COLORS = [VEILROSE_PALETTE.pink, VEILROSE_PALETTE.gold, VEILROSE_PALETTE.purple];
const SWAY_PERIOD = 5;

/** Gerai bunga mawar hiasan — mengisi plaza supaya "pasar terbuka dipenuhi
 * gerai bunga mawar" terasa padat, bukan sekadar 3 spot terpencil. Berayun
 * perlahan (macam angin lembut yang konsisten) supaya plaza terasa
 * "bernafas", bukan statik sepenuhnya. */
export function RoseStallProp({ scale, swayPhase = 0 }: { scale: number; swayPhase?: number }) {
	const clusterRef = useRef<THREE.Group>(null);
	useFrame(({ clock }) => {
		if (!clusterRef.current) return;
		const t = clock.getElapsedTime();
		const angle = (Math.PI * 2) / SWAY_PERIOD;
		clusterRef.current.rotation.z = Math.sin(t * angle + swayPhase) * 0.09;
		clusterRef.current.rotation.x = Math.sin(t * angle * 0.7 + swayPhase + 1.3) * 0.05;
	});
	return (
		<group scale={scale}>
			<mesh position={[0, 0.18, 0]}>
				<cylinderGeometry args={[0.32, 0.36, 0.36, 6]} />
				<meshStandardMaterial color="#8a5a42" flatShading roughness={0.8} />
			</mesh>
			{/* Daun — pengisi hijau lembut yang sebelum ini tiada langsung */}
			{[0, 1, 2].map((i) => {
				const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
				return (
					<mesh key={`leaf-${i}`} position={[Math.cos(a) * 0.14, 0.34, Math.sin(a) * 0.14]} rotation={[0.3, a, 0]}>
						<coneGeometry args={[0.07, 0.22, 4]} />
						<meshStandardMaterial color={VEILROSE_PALETTE.green} flatShading roughness={0.6} />
					</mesh>
				);
			})}
			<group ref={clusterRef} position={[0, 0.42, 0]}>
				{[0, 1, 2].map((i) => {
					const color = BLOOM_COLORS[i % BLOOM_COLORS.length];
					return (
						<mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.16, 0, Math.sin((i / 3) * Math.PI * 2) * 0.16]}>
							<icosahedronGeometry args={[0.19, 0]} />
							<meshStandardMaterial color={color} flatShading emissive={color} emissiveIntensity={0.22} roughness={0.55} />
						</mesh>
					);
				})}
			</group>
		</group>
	);
}
