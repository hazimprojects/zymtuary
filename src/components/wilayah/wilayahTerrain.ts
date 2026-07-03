import * as THREE from 'three';

export type KawasanAnchor = {
	id: string;
	nama: string;
	position: THREE.Vector3;
	color: string;
};

const ISLAND_RADIUS = 5.2;
const GRID_SEGMENTS = 26;

/** Gelombang sinus berlapis — cukup untuk beri rasa "tanah tak rata" tanpa
 * perlu pustaka noise luar; deterministik ikut kedudukan x/z. */
function ripple(x: number, z: number): number {
	return (
		Math.sin(x * 0.9 + z * 0.4) * 0.35 +
		Math.sin(x * 0.32 - z * 0.7 + 1.7) * 0.25 +
		Math.sin((x + z) * 0.55 + 3.1) * 0.18
	);
}

/** Susun kawasan dalam bentuk pentagon/heksagon rata di sekeliling pusat
 * pulau supaya semuanya kelihatan serentak dari kamera overview. */
export function layoutKawasanAnchors(
	ids: { id: string; nama: string }[],
	colors: string[],
	radius = 3.4,
): KawasanAnchor[] {
	const count = ids.length;
	return ids.map((entry, index) => {
		const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
		return {
			id: entry.id,
			nama: entry.nama,
			position: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
			color: colors[index % colors.length],
		};
	});
}

/** Bina geometri "pulau" faceted rendah-poligon — tinggi & warna setiap
 * verteks dipengaruhi oleh kawasan terdekat supaya sempadan antara kawasan
 * kelihatan sebagai peralihan warna poligon, bukan gradien tekstur. */
export function buildIslandGeometry(anchors: KawasanAnchor[], baseColor: string): THREE.BufferGeometry {
	const geometry = new THREE.PlaneGeometry(
		ISLAND_RADIUS * 2.4,
		ISLAND_RADIUS * 2.4,
		GRID_SEGMENTS,
		GRID_SEGMENTS,
	);
	geometry.rotateX(-Math.PI / 2);

	const position = geometry.attributes.position;
	const base = new THREE.Color(baseColor);
	const anchorColors = anchors.map((a) => new THREE.Color(a.color));
	const colors: number[] = [];

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		const distFromCenter = Math.hypot(x, z);
		const falloff = THREE.MathUtils.clamp(1 - distFromCenter / ISLAND_RADIUS, 0, 1);
		const shaped = Math.pow(falloff, 2.2);
		const height = shaped > 0 ? ripple(x, z) * 0.4 * shaped + shaped * 0.32 : -0.45;
		position.setY(i, height);

		let nearestIndex = 0;
		let nearestDist = Infinity;
		anchors.forEach((anchor, idx) => {
			const d = Math.hypot(x - anchor.position.x, z - anchor.position.z);
			if (d < nearestDist) {
				nearestDist = d;
				nearestIndex = idx;
			}
		});
		const blend = THREE.MathUtils.clamp(1 - nearestDist / 2.6, 0, 0.55);
		const shade = THREE.MathUtils.lerp(0.5, 1, shaped);
		const c = base.clone().lerp(anchorColors[nearestIndex] ?? base, blend);
		colors.push(c.r * shade, c.g * shade, c.b * shade);
	}

	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	return geometry;
}

export { ISLAND_RADIUS };
