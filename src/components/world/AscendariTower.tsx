import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { GLOBE_RADIUS, findLandmarkDirection, seededRng } from './worldGlobeConfig';

type AscendariTowerProps = {
	/** Sama seperti Vegetation/Aethirion — menara hanya kelihatan sepenuhnya
	 * apabila pelawat masuk atmosfera. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

const UP = new THREE.Vector3(0, 1, 0);

function mergePieces(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const merged = mergeBufferGeometries(pieces, false) ?? pieces[0];
	for (const p of pieces) p.dispose();
	return merged;
}

/** Satu tingkat silinder tirus, diletak pada altitud `y0` (bawah). Pulangkan
 * geometri + altitud atasnya (utk tingkat/hiasan seterusnya disusun terus). */
function addTier(pieces: THREE.BufferGeometry[], y0: number, topR: number, bottomR: number, h: number, segments = 10): number {
	const g = new THREE.CylinderGeometry(topR, bottomR, h, segments);
	g.translate(0, y0 + h / 2, 0);
	pieces.push(g);
	return y0 + h;
}

/** Kolar/ledge nipis melebar sedikit drpd tingkat di bawah & atasnya — kesan
 * balkoni/bumbung bertindih antara tingkat (gema rujukan: setiap tingkat ada
 * "bibir" jelas, bukan sambungan lurus rata). */
function addLedge(pieces: THREE.BufferGeometry[], y0: number, r: number, h = 0.01, segments = 10): number {
	const g = new THREE.CylinderGeometry(r, r * 1.14, h, segments);
	g.translate(0, y0 + h / 2, 0);
	pieces.push(g);
	return y0 + h;
}

const TOWER_LAYOUT_SEED = 7714;

type TowerLayout = {
	stoneGeo: THREE.BufferGeometry; // pale stone — tingkat & bumbung utama
	darkGeo: THREE.BufferGeometry; // batu gelap — plinth & jalur gah
	domeGeo: THREE.BufferGeometry;
	beaconTipY: number;
	ivyGeo: THREE.BufferGeometry;
	rockGeo: THREE.BufferGeometry;
};

/**
 * Bina seluruh silhouette menara SEKALI (deterministik) — tingkat berlapis
 * dgn ledge/balkoni antara setiap satu, kubah teal separuh-bulat, banyak
 * menara sudut kecil pada BEBERAPA aras (bukan satu gegelang di pangkal
 * sahaja), rusuk penopang menegak, lumut/tumbuhan memanjat di pangkal, &
 * serakan batu di kaki menara — gema rujukan menara ajaib gah berbilang
 * tingkat.
 */
function buildTowerLayout(): TowerLayout {
	const rng = seededRng(TOWER_LAYOUT_SEED);
	const dark: THREE.BufferGeometry[] = [];
	const stone: THREE.BufferGeometry[] = [];
	const ivy: THREE.BufferGeometry[] = [];
	const rock: THREE.BufferGeometry[] = [];

	// Plinth — asas melebar, batu gelap, duduk di puncak Pulau Ascendari.
	let y = addTier(dark, 0, 0.1, 0.125, 0.03, 12);
	// Serakan batu di sekeliling plinth (kesan tapak berbatu semula jadi).
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2 + (rng() - 0.5) * 0.4;
		const rr = 0.11 + rng() * 0.05;
		const s = 0.014 + rng() * 0.014;
		const g = new THREE.IcosahedronGeometry(1, 0);
		g.scale(s * (0.8 + rng() * 0.5), s * (0.6 + rng() * 0.4), s * (0.8 + rng() * 0.5));
		g.rotateY(rng() * Math.PI * 2);
		g.translate(Math.cos(a) * rr, 0.006, Math.sin(a) * rr);
		rock.push(g);
	}

	// Tingkat 1 — gah & lebar, batu gelap (pangkal berat, gaung).
	y = addTier(dark, y, 0.095, 0.11, 0.06, 11);
	// Lumut/tumbuhan memanjat pangkal — beberapa rumpun kecil hijau melekat.
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2 + rng();
		const ry = 0.02 + rng() * 0.05;
		const rIvy = 0.096;
		const s = 0.012 + rng() * 0.01;
		const g = new THREE.IcosahedronGeometry(1, 0);
		g.scale(s, s * 1.3, s);
		g.translate(Math.cos(a) * rIvy, ry, Math.sin(a) * rIvy);
		ivy.push(g);
	}
	y = addLedge(stone, y, 0.09);

	// Tingkat 2 — batu pucat, lebih tirus.
	y = addTier(stone, y, 0.078, 0.09, 0.065, 10);
	// Menara sudut kecil aras rendah — 6 kon condong keluar sedikit.
	{
		const r = 0.078;
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * Math.PI * 2 + (rng() - 0.5) * 0.2;
			const g = new THREE.ConeGeometry(0.011, 0.05, 6);
			g.translate(0, 0.025, 0);
			g.rotateZ((rng() - 0.5) * 0.25);
			g.translate(Math.cos(a) * r, y - 0.065 + 0.01, Math.sin(a) * r);
			stone.push(g);
		}
		// Rusuk penopang menegak — garisan nipis menegak pada tingkat ini.
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2;
			const g = new THREE.CylinderGeometry(0.005, 0.006, 0.065, 4);
			g.translate(Math.cos(a) * (r + 0.004), y - 0.065 / 2, Math.sin(a) * (r + 0.004));
			stone.push(g);
		}
	}
	y = addLedge(stone, y, 0.062);

	// Tingkat 3 — menuju kubah, tirus lagi.
	y = addTier(stone, y, 0.058, 0.068, 0.05, 9);
	{
		const r = 0.058;
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * Math.PI * 2 + (rng() - 0.5) * 0.3;
			const g = new THREE.ConeGeometry(0.009, 0.04, 6);
			g.translate(0, 0.02, 0);
			g.translate(Math.cos(a) * r, y - 0.05, Math.sin(a) * r);
			stone.push(g);
		}
	}
	const domeBaseY = y;

	// Kubah teal separuh-bulat — ciri paling ketara drpd rujukan.
	const domeR = 0.056;
	const domeGeo = new THREE.SphereGeometry(domeR, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
	domeGeo.translate(0, domeBaseY, 0);
	const domeTopY = domeBaseY + domeR * 0.82;

	// Kolar nipis di atas kubah, tempat tingkat atas bercambah keluar.
	y = addLedge(stone, domeTopY - 0.005, 0.024, 0.012);

	// Tingkat 4 — nipis, di atas kubah, menuju puncak.
	y = addTier(stone, y, 0.02, 0.026, 0.05, 8);
	y = addLedge(stone, y, 0.017);

	// Tingkat 5 — jalur gah gelap (gema jalur hitam reka bentuk asal).
	y = addTier(dark, y, 0.014, 0.019, 0.045, 8);

	// Puncak tirus tajam.
	const spireH = 0.1;
	{
		const g = new THREE.ConeGeometry(0.014, spireH, 8);
		g.translate(0, y + spireH / 2, 0);
		stone.push(g);
	}
	const beaconTipY = y + spireH;

	return {
		stoneGeo: mergePieces(stone),
		darkGeo: mergePieces(dark),
		domeGeo,
		beaconTipY,
		ivyGeo: mergePieces(ivy),
		rockGeo: mergePieces(rock),
	};
}

/**
 * Menara Ascendari — "menjulang lebih tinggi daripada mana-mana struktur
 * lain di Luminara" (Codex 5.2), afiniti Duskborne. Direka semula ikut
 * rujukan menara ajaib gah: berbilang tingkat dgn ledge/balkoni jelas antara
 * setiap satu, kubah teal, banyak menara sudut & rusuk penopang pada
 * beberapa aras (bukan satu gegelang tunggal), lumut memanjat pangkal, batu
 * berselerak di kaki, & mercu cahaya teal berdenyar memancar dari puncak
 * (gema alur cahaya dlm rujukan).
 */
export default function AscendariTower({ atmosphereBlendRef }: AscendariTowerProps) {
	const dir = useMemo(() => new THREE.Vector3(...findLandmarkDirection('ascendari-pulau')), []);
	const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
	const position = useMemo(() => dir.clone().multiplyScalar(GLOBE_RADIUS + 0.006), [dir]);

	const layout = useMemo(() => buildTowerLayout(), []);

	const beaconGeo = useMemo(() => {
		const h = 0.22;
		const g = new THREE.CylinderGeometry(0.0015, 0.005, h, 6, 1, true);
		g.translate(0, layout.beaconTipY + h / 2, 0);
		return g;
	}, [layout.beaconTipY]);

	const darkStoneMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#332e2a', flatShading: true, roughness: 0.85, transparent: true, opacity: 0 }),
		[],
	);
	const paleStoneMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#c4b896',
				emissive: '#3a3020',
				emissiveIntensity: 0.3,
				flatShading: true,
				roughness: 0.6,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const domeMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#3a8a86',
				emissive: '#1a5850',
				emissiveIntensity: 0.5,
				flatShading: true,
				roughness: 0.4,
				transparent: true,
				opacity: 0,
			}),
		[],
	);
	const ivyMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#4a7a34', emissive: '#1a3010', emissiveIntensity: 0.25, flatShading: true, roughness: 0.75, transparent: true, opacity: 0 }),
		[],
	);
	const rockMat = useMemo(
		() => new THREE.MeshStandardMaterial({ color: '#6e6a62', flatShading: true, roughness: 0.92, transparent: true, opacity: 0 }),
		[],
	);
	const beaconMat = useMemo(
		() => new THREE.MeshBasicMaterial({ color: '#aef2ea', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
		[],
	);
	const beaconLightRef = useRef<THREE.PointLight>(null);

	// Sama seperti pokok Heartbloom & pulau Aethirion — Menara Ascendari
	// "menjulang lebih tinggi drpd mana-mana struktur lain di Luminara"
	// (Codex 5.2), jadi siluetnya (batu gelap/pucat/kubah) patut kelihatan sbg
	// mercu tanda walau dari orbit jauh, bukan hilang terus. Perincian tanah
	// (lumut/batu) kekal lantai 0 — hanya kelihatan bila rapat.
	const landmarkMats = useMemo(() => [darkStoneMat, paleStoneMat, domeMat], [darkStoneMat, paleStoneMat, domeMat]);
	const groundMats = useMemo(() => [ivyMat, rockMat], [ivyMat, rockMat]);

	useFrame(({ clock }) => {
		const blend = atmosphereBlendRef.current;
		const near = THREE.MathUtils.clamp((blend - 0.15) / 0.35, 0, 1);
		const landmarkTarget = THREE.MathUtils.lerp(0.55, 1, near);

		for (const mat of landmarkMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, landmarkTarget, 0.05);
			mat.visible = mat.opacity > 0.01;
		}
		for (const mat of groundMats) {
			mat.opacity = THREE.MathUtils.lerp(mat.opacity, near, 0.05);
			mat.visible = mat.opacity > 0.01;
		}

		// Mercu cahaya teal berdenyar lembut — sama teknik dgn cahaya berdenyar
		// lain dlm codebase (bolt kilat, urat kristal), bukan legap statik.
		// Turut ada lantai (spt siluet menara) supaya beacon kelihatan dari
		// angkasa — gema "mercu cahaya menara kelihatan jauh" dlm rujukan.
		const pulse = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 0.9);
		const beaconTarget = landmarkTarget * pulse;
		beaconMat.opacity = THREE.MathUtils.lerp(beaconMat.opacity, beaconTarget * 0.8, 0.05);
		beaconMat.visible = beaconMat.opacity > 0.01;
		if (beaconLightRef.current) beaconLightRef.current.intensity = landmarkTarget * pulse * 1.4;
	});

	return (
		<group position={position} quaternion={quaternion}>
			<mesh geometry={layout.darkGeo} material={darkStoneMat} />
			<mesh geometry={layout.stoneGeo} material={paleStoneMat} />
			<mesh geometry={layout.domeGeo} material={domeMat} />
			<mesh geometry={layout.ivyGeo} material={ivyMat} />
			<mesh geometry={layout.rockGeo} material={rockMat} />
			<mesh geometry={beaconGeo} material={beaconMat} />
			<pointLight ref={beaconLightRef} color="#aef2ea" intensity={0} distance={0.5} position={[0, layout.beaconTipY + 0.03, 0]} />
		</group>
	);
}
