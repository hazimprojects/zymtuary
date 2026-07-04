import * as THREE from 'three';
import { HEMISPHERE_COLORS, GLOBE_RADIUS } from './worldGlobeConfig';

/** Bola rendah-poligon berwarna-vertex — teknik sama seperti buildIslandGeometry
 * (wilayahTerrain.ts lama): warna dicampur ikut ketinggian vertex (paksi-y)
 * antara tiga hemisfera, flatShading untuk gaya low-poly konsisten dengan
 * seluruh aplikasi, tanpa perlu shader GLSL tersendiri. */
export function buildGlobeGeometry(): THREE.BufferGeometry {
	const geometry = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 4);
	const position = geometry.attributes.position;
	const luminara = new THREE.Color(HEMISPHERE_COLORS.luminara);
	const noctira = new THREE.Color(HEMISPHERE_COLORS.noctira);
	const equilara = new THREE.Color(HEMISPHERE_COLORS.equilara);
	const colors: number[] = [];

	for (let i = 0; i < position.count; i++) {
		const y = position.getY(i) / GLOBE_RADIUS;
		let color: THREE.Color;
		if (y > 0.28) {
			const t = THREE.MathUtils.clamp((y - 0.28) / 0.72, 0, 1);
			color = equilara.clone().lerp(luminara, t);
		} else if (y < -0.28) {
			const t = THREE.MathUtils.clamp((-y - 0.28) / 0.72, 0, 1);
			color = equilara.clone().lerp(noctira, t);
		} else {
			color = equilara.clone();
		}
		colors.push(color.r, color.g, color.b);
	}

	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	return geometry;
}
