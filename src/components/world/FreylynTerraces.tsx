import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';
import { buildSpriteTexture } from './FeatureParticles';

type FreylynTerracesProps = {
	/** Sama seperti landmark lain — struktur kekal separa kelihatan dari
	 * orbit (mercu tanda), butiran (kilauan) hanya bila rapat. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

/** Sempadan teres tak sekata (harmonik sudut, 2 gelombang) — elak bulatan
 * genap sempurna (pengajaran drpd Vegetation.tsx/MendariTownscape round
 * terdahulu), gema tepi kolam Pamukkale/Baishuitai yg berlekuk organik. */
function buildTerraceBoundary(rng: () => number): (theta: number) => number {
	const a1 = 0.09 + rng() * 0.06;
	const p1 = rng() * Math.PI * 2;
	const a2 = 0.045 + rng() * 0.05;
	const p2 = rng() * Math.PI * 2;
	return (theta: number) => 1 + a1 * Math.cos(theta + p1) + a2 * Math.cos(2 * theta + p2);
}

/** Silinder rendah-poli diperturbasi per-sudut ikut boundaryFn — teknik SAMA
 * dgn buildMesaGeometry (AethirionIsland.tsx): pusingkan CylinderGeometry
 * genap jadi bentuk "blob" tak sekata dgn menskalakan jejari setiap verteks
 * ikut sudutnya, bukan bina BufferGeometry dari kosong. */
function buildTerraceTierGeometry(
	radius: number,
	height: number,
	boundaryFn: (theta: number) => number,
	segments = 24,
): THREE.BufferGeometry {
	const geo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, false);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		const r = Math.hypot(x, z);
		if (r < 0.0001) continue;
		const angle = Math.atan2(z, x);
		const factor = boundaryFn(angle);
		pos.setXYZ(i, x * factor, pos.getY(i), z * factor);
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();
	return geo;
}

type Tier = {
	shelfGeo: THREE.BufferGeometry;
	poolGeo: THREE.BufferGeometry;
	shelfY: number;
	poolY: number;
};

const TIER_RADII = [0.2, 0.152, 0.112, 0.078] as const;
const TIER_HEIGHT = 0.02;
const POOL_HEIGHT = 0.009;
// Kolam meliputi HAMPIR seluruh jejari tingkat sendiri (bibir putih nipis
// sahaja di tepi) — pusingan terdahulu (0.76) hampir SAMA dgn nisbah
// jejari antara tingkat berturutan, jadi tingkat atas menutupi hampir
// SEMUA kolam tingkat bawah, tinggal jalur nipis sahaja. Gema rujukan:
// kolam ialah elemen dominan, bukan batu.
const POOL_SCALE = 0.92;
const TIER_OVERLAP = 0.003;

function buildTiers(): Tier[] {
	const tiers: Tier[] = [];
	let bottomY = 0;
	for (let i = 0; i < TIER_RADII.length; i++) {
		const rng = seededRng(4401 + i * 71);
		const shelfBoundary = buildTerraceBoundary(rng);
		const poolBoundary = buildTerraceBoundary(seededRng(5501 + i * 71));
		const shelfGeo = buildTerraceTierGeometry(TIER_RADII[i], TIER_HEIGHT, shelfBoundary);
		const poolGeo = buildTerraceTierGeometry(TIER_RADII[i] * POOL_SCALE, POOL_HEIGHT, poolBoundary);
		const shelfY = bottomY + TIER_HEIGHT / 2;
		const poolY = bottomY + TIER_HEIGHT - POOL_HEIGHT / 2 + 0.0015;
		shelfGeo.translate(0, shelfY, 0);
		poolGeo.translate(0, poolY, 0);
		tiers.push({ shelfGeo, poolGeo, shelfY, poolY });
		bottomY += TIER_HEIGHT - TIER_OVERLAP;
	}
	return tiers;
}

type SparkleSpot = { position: THREE.Vector3; phase: number };

/** Kilauan lembut atas kolam — "air berkilau seperti kaca cair" (Codex). */
function buildSparkleSpots(tiers: Tier[]): SparkleSpot[] {
	const rng = seededRng(6601);
	const spots: SparkleSpot[] = [];
	for (let i = 0; i < tiers.length; i++) {
		const count = 5 - i;
		const r = TIER_RADII[i] * POOL_SCALE * 0.75;
		for (let j = 0; j < count; j++) {
			const angle = rng() * Math.PI * 2;
			const rr = Math.sqrt(rng()) * r;
			const x = Math.cos(angle) * rr;
			const z = Math.sin(angle) * rr;
			spots.push({ position: new THREE.Vector3(x, tiers[i].poolY + POOL_HEIGHT / 2 + 0.002, z), phase: rng() });
		}
	}
	return spots;
}

/** Tekstur jalur air terjun menegak — teknik sama dgn AethirionIsland.tsx
 * (legap dekat atas, pudar ke bawah, jalur rawak). */
function buildCascadeTexture(): THREE.CanvasTexture {
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

type CascadeSpot = { position: THREE.Vector3; width: number; length: number };

/** Beberapa jalur kecil air melimpah dari kolam atas ke bawah — di satu
 * sisi sahaja (bukan sekeliling), gema rujukan (air melimpah tepi teres). */
function buildCascadeSpots(tiers: Tier[]): CascadeSpot[] {
	const rng = seededRng(7701);
	const spots: CascadeSpot[] = [];
	for (let i = 0; i < tiers.length - 1; i++) {
		const angle = 0.3 + rng() * 0.5;
		const r = TIER_RADII[i + 1] * 0.85;
		const x = Math.cos(angle) * r;
		const z = Math.sin(angle) * r;
		const dropTop = tiers[i + 1].poolY;
		const dropBottom = tiers[i].poolY;
		const length = dropTop - dropBottom;
		spots.push({
			position: new THREE.Vector3(x, (dropTop + dropBottom) / 2, z),
			width: 0.012 + rng() * 0.008,
			length,
		});
	}
	return spots;
}

export default function FreylynTerraces({ atmosphereBlendRef }: FreylynTerracesProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('freylyn-terraces')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.004), [dir]);

	const tiers = useMemo(() => buildTiers(), []);
	const sparkleSpots = useMemo(() => buildSparkleSpots(tiers), [tiers]);
	const cascadeSpots = useMemo(() => buildCascadeSpots(tiers), [tiers]);
	const sparkleTexture = useMemo(() => buildSpriteTexture(), []);
	const cascadeTexture = useMemo(() => buildCascadeTexture(), []);

	const shelfMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				// Putih-krem CERAH dgn emissive halus — pastikan ia terbaca sbg
				// travertine putih walau di bawah ambient sejuk scene ini (round
				// terdahulu, warna pucat '#f0ebe0' tanpa emissive terbias kelabu).
				color: '#faf6ec',
				emissive: '#e8dfc8',
				emissiveIntensity: 0.3,
				flatShading: true,
				roughness: 0.65,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const poolMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				// Turquoise lebih tepu/cerah (gema rujukan Pamukkale) — round
				// terdahulu terlalu muted/gelap.
				color: '#3ddcd2',
				emissive: '#15948c',
				emissiveIntensity: 0.4,
				flatShading: true,
				roughness: 0.15,
				metalness: 0.1,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const cascadeMat = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				map: cascadeTexture,
				color: '#eafffb',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		[cascadeTexture],
	);
	const sparkleMat = useMemo(
		() =>
			new THREE.PointsMaterial({
				size: 0.028,
				map: sparkleTexture,
				color: '#eafffa',
				transparent: true,
				opacity: 0,
				depthWrite: false,
				sizeAttenuation: true,
				blending: THREE.AdditiveBlending,
			}),
		[sparkleTexture],
	);

	const landmarkMats = useMemo(() => [shelfMat, poolMat], [shelfMat, poolMat]);
	const detailMats = useMemo(() => [cascadeMat], [cascadeMat]);

	const sparklePositions = useMemo(() => new Float32Array(sparkleSpots.length * 3), [sparkleSpots.length]);
	const sparkleGeomRef = useRef<THREE.BufferGeometry>(null);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);

		// Struktur teres kekal separa kelihatan dari orbit (lantai 0.55) —
		// mercu tanda biome, sama spt Heartbloom/Ascendari.
		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);
		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of detailMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near * 0.7, 0.05);
			mat.visible = mat.opacity > 0.01;
		}

		poolMat.emissiveIntensity = 0.4 * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 0.8));
		cascadeTexture.offset.y -= 0.5 * 0.016;

		for (let i = 0; i < sparkleSpots.length; i++) {
			const s = sparkleSpots[i];
			sparklePositions[i * 3] = s.position.x;
			sparklePositions[i * 3 + 1] = s.position.y;
			sparklePositions[i * 3 + 2] = s.position.z;
		}
		if (sparkleGeomRef.current) sparkleGeomRef.current.attributes.position.needsUpdate = true;
		if (sparkleMat) {
			const flicker = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 2.1);
			sparkleMat.opacity = near * flicker * 0.8;
			sparkleMat.visible = near > 0.01;
		}
	});

	return (
		<group position={position} quaternion={quaternion}>
			{tiers.map((tier, i) => (
				<group key={i}>
					<mesh geometry={tier.shelfGeo} material={shelfMat} />
					<mesh geometry={tier.poolGeo} material={poolMat} />
				</group>
			))}
			{cascadeSpots.map((c, i) => (
				<mesh key={i} position={c.position} rotation={[0, Math.atan2(c.position.x, c.position.z), 0]} material={cascadeMat}>
					<planeGeometry args={[c.width, c.length, 1, 4]} />
				</mesh>
			))}
			{sparkleSpots.length > 0 ? (
				<points material={sparkleMat}>
					<bufferGeometry ref={sparkleGeomRef}>
						<bufferAttribute
							attach="attributes-position"
							args={[sparklePositions, 3]}
							count={sparklePositions.length / 3}
							itemSize={3}
						/>
					</bufferGeometry>
				</points>
			) : null}
		</group>
	);
}
