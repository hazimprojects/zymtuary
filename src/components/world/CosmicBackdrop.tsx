import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';

type CosmicBackdropProps = {
	/** 0 di angkasa jauh, 1 dalam atmosfera — nebula "Aethernals" penuh di
	 * angkasa, pudar bila masuk atmosfera (langit ambil alih). */
	atmosphereBlendRef: RefObject<number>;
};

const backdropVertex = /* glsl */ `
varying vec3 vDir;

void main() {
	vDir = normalize(position);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Nebula kosmik "Aethernals" — cuaca kosmik yg indah sbg latar angkasa
 * (bukan hitam legam). Palet gema tiga alam Zymtuary: emas hangat Luminara,
 * ungu-magenta Noctira, teal Equilara — mengalir sbg awan nebula fbm
 * berbilang lapisan + taburan bintang halus + denyar cahaya kosmik.
 */
const backdropFragment = /* glsl */ `
uniform float uTime;
uniform float uFade;
uniform vec3 uLuminara;
uniform vec3 uNoctira;
uniform vec3 uEquilara;

varying vec3 vDir;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float n000 = hash(i);
	float n100 = hash(i + vec3(1.0, 0.0, 0.0));
	float n010 = hash(i + vec3(0.0, 1.0, 0.0));
	float n110 = hash(i + vec3(1.0, 1.0, 0.0));
	float n001 = hash(i + vec3(0.0, 0.0, 1.0));
	float n101 = hash(i + vec3(1.0, 0.0, 1.0));
	float n011 = hash(i + vec3(0.0, 1.0, 1.0));
	float n111 = hash(i + vec3(1.0, 1.0, 1.0));
	return mix(
		mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
		mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
		f.z
	);
}

float fbm(vec3 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 6; i++) {
		v += a * noise(p);
		p = p * 2.02 + vec3(1.7, 9.2, 3.3);
		a *= 0.5;
	}
	return v;
}

// Bintang halus — titik terang jarang pada grid noise frekuensi tinggi.
float starField(vec3 dir, float density, float sharp) {
	float n = hash(floor(dir * density));
	float s = pow(n, sharp);
	return smoothstep(0.0, 1.0, s);
}

void main() {
	vec3 dir = normalize(vDir);
	vec3 drift = vec3(uTime * 0.006, uTime * 0.003, uTime * 0.0045);

	// Dua lapisan nebula mengalir pada kadar berbeza (kedalaman).
	float neb1 = fbm(dir * 2.4 + drift);
	float neb2 = fbm(dir * 4.6 - drift * 1.7 + vec3(5.0));
	float nebula = neb1 * 0.65 + neb2 * 0.45;

	// Arus warna — magenta/ungu Noctira, teal Equilara, emas Luminara
	// bercampur ikut kontur nebula (bukan jalur mendatar kaku).
	float band = fbm(dir * 1.3 + vec3(0.0, uTime * 0.004, 0.0));
	vec3 col = vec3(0.02, 0.03, 0.06); // dasar angkasa dalam (biru-hitam, bukan hitam legam)

	// Gradien warna skala-besar (frekuensi rendah) meliputi SELURUH langit —
	// supaya tiada lompang hitam luas walau di zon nebula jarang; aurora
	// kosmik lembut beralih ungu↔teal↔emas merentasi kubah.
	float sweep = fbm(dir * 0.8 + vec3(uTime * 0.003, 0.0, uTime * 0.002));
	vec3 washA = mix(uNoctira, uEquilara, smoothstep(0.3, 0.7, sweep));
	vec3 washB = mix(washA, uLuminara, smoothstep(0.6, 0.9, band));
	col += washB * 0.16;

	float magenta = smoothstep(0.28, 0.72, nebula) * smoothstep(0.25, 0.68, band);
	float teal = smoothstep(0.32, 0.78, neb2) * (1.0 - band * 0.85);
	float gold = smoothstep(0.5, 0.85, neb1) * smoothstep(0.45, 0.9, band);

	col += uNoctira * 1.6 * magenta;
	col += uEquilara * 1.3 * teal;
	col += uLuminara * 1.1 * gold;

	// Wash asas lembut ikut arus warna — supaya zon paling gelap pun ada
	// sedikit cahaya kosmik (bukan lompang hitam besar di sekeliling planet).
	col += mix(uNoctira, uEquilara, band) * (0.05 + 0.05 * nebula);

	// Halo cahaya kosmik lembut berpusar (denyar perlahan).
	float glow = smoothstep(0.6, 0.95, nebula);
	float pulse = 0.8 + 0.2 * sin(uTime * 0.25 + nebula * 6.28);
	col += mix(uNoctira, uEquilara, teal) * glow * pulse * 0.35;

	// Bintang — dua saiz/kepekatan utk kedalaman.
	float starsFar = starField(dir, 220.0, 42.0) * 0.6;
	float starsNear = starField(dir + 3.3, 90.0, 60.0);
	float twinkle = 0.7 + 0.3 * sin(uTime * 1.5 + dir.x * 40.0 + dir.z * 33.0);
	col += vec3(0.85, 0.9, 1.0) * (starsFar + starsNear * twinkle);

	// Alpha = uFade: legap penuh (nebula) di angkasa, lut sinar habis dlm
	// atmosfera supaya warna langit scene.background kelihatan menembusinya.
	gl_FragColor = vec4(col, uFade);
}
`;

export function CosmicBackdrop({ atmosphereBlendRef }: CosmicBackdropProps) {
	const matRef = useRef<THREE.ShaderMaterial>(null);

	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: backdropVertex,
				fragmentShader: backdropFragment,
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					// Warna nebula lebih tepu drpd warna permukaan supaya "indah"
					// & terang di angkasa gelap.
					uLuminara: { value: new THREE.Vector3(0.95, 0.72, 0.32) },
					uNoctira: { value: new THREE.Vector3(0.55, 0.28, 0.72) },
					uEquilara: { value: new THREE.Vector3(0.25, 0.68, 0.7) },
				},
				side: THREE.BackSide,
				transparent: true,
				depthWrite: false,
				// depthTest AKTIF (bukan false) — supaya planet (legap, tulis
				// depth) menghalang nebula di belakangnya & KEKAL kelihatan;
				// depthTest:false dulu menyebabkan nebula mengecat ATAS planet.
				// Jejari 60 < far(100) jadi tiada isu terpangkas satah-jauh.
				depthTest: true,
			}),
		[],
	);

	useFrame(({ clock }) => {
		material.uniforms.uTime.value = clock.elapsedTime;
		const blend = atmosphereBlendRef.current ?? 0;
		// Penuh di angkasa (blend 0), pudar habis apabila masuk atmosfera
		// (langit/awan ambil alih) supaya nebula tidak "menembusi" langit siang.
		material.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(0.05, 0.5, blend);
	});

	return (
		// Jejari 60 — MESTI selesa di dalam satah-jauh kamera (far = 100),
		// jika tidak sinar tengah-pandangan yg mengenai sfera pada jarak
		// lebih jauh (≈ D + jejari) terpangkas → lompang gelap di tengah.
		<mesh renderOrder={-10} frustumCulled={false}>
			<sphereGeometry args={[60, 32, 32]} />
			<primitive object={material} ref={matRef} attach="material" />
		</mesh>
	);
}
