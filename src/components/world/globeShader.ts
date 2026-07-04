import * as THREE from 'three';
import {
	HEMISPHERE_COLORS,
	MAX_FEATURES,
	MAX_RIVER_POINTS,
	buildFeatureUniformArrays,
	buildRiverUniformArrays,
} from './worldGlobeConfig';
import { createEntityGlowUniforms, type EntityGlowUniforms } from './entityGlowUniforms';

function hexToVec3(hex: string): THREE.Vector3 {
	const c = new THREE.Color(hex);
	return new THREE.Vector3(c.r, c.g, c.b);
}

export const globeVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vObjectNormal;
varying vec3 vViewDir;

void main() {
	vNormal = normalize(normalMatrix * normal);
	vObjectNormal = normalize(normal);
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vViewDir = normalize(cameraPosition - worldPos.xyz);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const globeFragmentShader = /* glsl */ `
#define MAX_GLOWS 24
#define MAX_FEATURES 16
#define MAX_RIVER_POINTS 7

uniform float uTime;
uniform float uProximity;
uniform vec3 uLuminara;
uniform vec3 uNoctira;
uniform vec3 uEquilara;
uniform int uEntityCount;
uniform vec3 uEntityDirs[MAX_GLOWS];
uniform vec3 uEntityColors[MAX_GLOWS];
uniform float uEntityStrength[MAX_GLOWS];
uniform vec3 uHoverDir;
uniform float uHoverActive;
uniform int uFeatureCount;
uniform vec3 uFeatureDirs[MAX_FEATURES];
uniform float uFeatureType[MAX_FEATURES];
uniform float uFeatureRadius[MAX_FEATURES];
uniform vec3 uRiverAPoints[MAX_RIVER_POINTS];
uniform vec3 uRiverBPoints[MAX_RIVER_POINTS];
uniform vec3 uRiverAColor;
uniform vec3 uRiverBColor;

varying vec3 vNormal;
varying vec3 vObjectNormal;
varying vec3 vViewDir;

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
	vec3 u = f;
	return mix(
		mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
		mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
		u.z
	);
}

float fbm(vec3 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.1;
		a *= 0.5;
	}
	return v;
}

/** Versi murah fbm (2 oktaf) — untuk tekstur mercu tanda supaya kos per-piksel
 * tidak melonjak dengan banyak mercu tanda aktif serentak. */
float fbm2(vec3 p) {
	float v = noise(p) * 0.5;
	v += noise(p * 2.1) * 0.25;
	return v;
}

/**
 * Permukaan Zymtuary bukan planet biasa — tiada benua/lautan sebenar.
 * Tiga alam (Luminara cahaya, Noctira bayang, Equilara garisan penyatuan)
 * mengalir sebagai arus warna organik yang saling meresap di sempadan
 * (rujuk deskripsi Wandari: "dua lukisan cat air belum kering bertindih"),
 * bukan bentuk tanah/air yang terpisah tajam.
 */
vec3 mythicSurface(vec3 n, float detailBoost) {
	float lat = n.y;

	// Arus terwarap (domain warp) — mengelak corak "pulau benua" fbm mentah
	// supaya rupa tidak terbaca sebagai peta bumi walau pada sudut mana pun.
	vec3 p = n * (2.1 + detailBoost * 0.9);
	vec3 warp = vec3(fbm(p + 4.1), fbm(p + 7.7), fbm(p + 1.3)) - 0.5;
	vec3 pw = p + warp * 1.7;

	float flowBroad = fbm(pw * 1.4);
	float flowFine = fbm(pw * 3.6 + 9.0);
	float veins = smoothstep(0.5, 0.86, flowFine * 0.6 + flowBroad * 0.4);

	// Sempadan hemisfera diganggu oleh arus supaya tidak jadi cincin licin —
	// zon pertindihan gold/violet terasa cair, bukan garis lintang tegar.
	float drift = (flowBroad - 0.5) * 0.55 + (flowFine - 0.5) * 0.2;
	float lumMask = smoothstep(-0.08, 0.62, lat + drift);
	float noctMask = smoothstep(-0.08, 0.62, -lat + drift);
	float overlap = lumMask * noctMask; // jalur "cat air bertindih" di sekitar Equilara

	vec3 col = uEquilara;
	col = mix(col, uLuminara, lumMask);
	col = mix(col, uNoctira, noctMask * (1.0 - lumMask * 0.6));
	col = mix(col, (uLuminara + uNoctira) * 0.5, overlap * 0.55);

	// Urat cahaya/kristal halus — bukan hutan/gunung, sekadar denyutan dalaman
	col *= 0.86 + veins * 0.34;
	col += veins * mix(uLuminara, uNoctira, step(0.0, -lat)) * 0.06;

	return col;
}

/** Kabus setiap alam — hangat keemasan di Luminara, sejuk berkabus di
 * Noctira, dan berpadu lembut sepanjang garisan Equilara — bukan awan
 * putih generik yang membaca seperti litupan awan bumi sebenar. */
vec3 hazeLayer(vec3 n, float proximity, out float density) {
	float lat = n.y;
	vec3 drift = vec3(uTime * 0.03, uTime * 0.006, uTime * 0.024);
	float h1 = fbm(n * 3.2 + drift);
	float h2 = fbm(n * 6.0 + drift * 1.25 + vec3(2.0, 0.0, 1.0)) * 0.5;
	float h = h1 + h2;
	density = smoothstep(0.5, 0.74, h) * mix(0.05, 0.16, proximity);

	float lum = smoothstep(0.0, 0.6, lat);
	float noct = smoothstep(0.0, 0.6, -lat);
	vec3 hazeCol = uEquilara * 1.1;
	hazeCol = mix(hazeCol, uLuminara * 1.3, lum);
	hazeCol = mix(hazeCol, uNoctira * 1.15, noct);
	return hazeCol;
}

/**
 * Warna asas setiap jenis mercu tanda — dicondongkan ikut hemisfera (warm =
 * Luminara, sebaliknya Noctira) supaya "gunung" atau "air" yang sama jenis
 * kelihatan berbeza wataknya: gunung berapi vs obsidian, laut hangat vs
 * tasik gelap tak berdasar, padang bunga vs hutan senja.
 */
vec3 featureColor(float t, float lat) {
	float warm = step(0.0, lat);
	if (t < 0.5) return mix(vec3(0.6, 0.92, 1.0), vec3(1.0, 0.45, 0.08), warm); // rekahan
	if (t < 1.5) return mix(vec3(0.09, 0.08, 0.11), vec3(0.22, 0.12, 0.08), warm); // gunung — gelap tapi tak jadi lubang hitam
	if (t < 2.5) return mix(vec3(0.02, 0.05, 0.1), vec3(0.16, 0.42, 0.38), warm); // air
	if (t < 3.5) return mix(vec3(0.08, 0.2, 0.13), vec3(0.42, 0.48, 0.16), warm); // hijau
	if (t < 4.5) return vec3(0.5, 0.42, 0.28); // padang pasir
	if (t < 5.5) return vec3(0.85, 0.42, 0.08); // teres air panas — jingga terang, bukan keemasan pudar
	return vec3(0.3, 0.42, 0.15); // pokok Heartbloom
}

/** Mercu tanda liar — gema lapisan mitos yang lebih dalam menembusi
 * permukaan wilayah kini. Tepi setiap tampalan diganggu noise supaya bukan
 * bulatan licin — bentuknya terasa organik, bukan dicap-tera. */
vec3 applyFeatures(vec3 col, vec3 n) {
	for (int i = 0; i < MAX_FEATURES; i++) {
		if (i >= uFeatureCount) break;
		vec3 dir = uFeatureDirs[i];
		float t = uFeatureType[i];
		float radius = uFeatureRadius[i];

		float align = dot(n, dir);
		// Tapisan murah dahulu (satu dot product) — elak kira fbm2 mahal untuk
		// piksel yang jelas jauh di luar radius maksimum (radius * 1.7 ikut
		// gangguan tepi di bawah). Dengan 11 mercu tanda per piksel, ini elak
		// beban noise yang melonjak pada permukaan yang jauh daripada semua
		// mercu tanda (majoriti permukaan pada bila-bila masa).
		if (align < cos(radius * 1.9)) continue;

		float edgeNoise = fbm2(n * 9.0 + dir * 3.0) - 0.5;
		float cosR = cos(radius * (1.0 + edgeNoise * 0.45));
		// Peralihan berkadar dengan saiz mercu tanda (bukan pemalar tegar) —
		// pada sfera rendah-poligon (48 sisi mobile), pemalar kecil terbentuk
		// tepi tajam/segi tiga kelihatan. Peralihan lebar melenyapkan itu.
		float epsilon = max(radius * 0.4, 0.03);
		float mask = smoothstep(cosR - epsilon, cosR + epsilon, align);
		if (mask < 0.004) continue;

		vec3 fc = featureColor(t, n.y);

		if (t < 0.5) {
			float crack = smoothstep(0.4, 0.78, fbm2(n * 30.0 + dir * 5.0));
			float glow = mask * crack * (0.7 + 0.3 * sin(uTime * 1.4 + float(i)));
			col = mix(col, fc, mask * 0.35);
			col += fc * glow * 1.8;
		} else if (t < 1.5) {
			float ridge = 0.7 + 0.3 * fbm2(n * 12.0 + dir * 2.0);
			col = mix(col, fc * ridge, mask * 0.8);
		} else if (t < 2.5) {
			float sparkle = smoothstep(0.82, 0.97, fbm2(n * 20.0 + vec3(uTime * 0.15, 0.0, 0.0)));
			col = mix(col, fc, mask * 0.78);
			col += sparkle * mask * 0.06;
		} else if (t < 3.5) {
			float speckle = smoothstep(0.7, 0.88, fbm2(n * 26.0 + dir * 6.0));
			col = mix(col, fc, mask * 0.78);
			col += speckle * mask * fc * 0.5;
		} else if (t < 4.5) {
			col = mix(col, fc, mask * 0.75);
		} else if (t < 5.5) {
			float rings = 0.5 + 0.5 * sin(acos(clamp(align, -1.0, 1.0)) * 40.0);
			col = mix(col, fc * (0.75 + rings * 0.4), mask * 0.78);
		} else {
			float core = smoothstep(cosR + epsilon * 0.6, 1.0, align);
			col = mix(col, fc, mask * 0.75);
			col += fc * core * 0.5;
		}
	}
	return col;
}

float distToSegment(vec3 p, vec3 a, vec3 b) {
	vec3 ab = b - a;
	float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
	return distance(p, a + ab * t);
}

/** Jarak ke titik-titik sungai sahaja (bukan segmen) akan jadi rantaian
 * "manik" terputus-putus — ukur jarak ke SEGMEN antara titik berturutan
 * supaya sungai kelihatan sebagai alur berterusan. */
float riverMask(vec3 n, vec3 pts[MAX_RIVER_POINTS], float width) {
	float d = 10.0;
	for (int i = 0; i < MAX_RIVER_POINTS - 1; i++) {
		d = min(d, distToSegment(n, pts[i], pts[i + 1]));
	}
	return smoothstep(width, width * 0.25, d);
}

vec3 applyRivers(vec3 col, vec3 n) {
	float da = riverMask(n, uRiverAPoints, 0.05);
	float db = riverMask(n, uRiverBPoints, 0.05);
	col = mix(col, uRiverAColor, da * 0.85);
	col = mix(col, uRiverBColor, db * 0.85);
	return col;
}

/** Aethirion — pulau terapung yang "tidak pernah diam di satu kedudukan
 * cukup lama untuk dipetakan", jadi kedudukannya dikira terus daripada masa
 * (bukan koordinat tetap) — hanyut perlahan mengelilingi garisan Equilara. */
vec3 aethirionGlow(vec3 n) {
	float theta = uTime * 0.05 + 1.4;
	float y = 0.03 + 0.06 * sin(uTime * 0.09);
	float ring = sqrt(max(0.0, 1.0 - y * y));
	vec3 dir = vec3(ring * sin(theta), y, ring * cos(theta));
	float align = dot(n, dir);
	// Susut eksponen lembut (bukan smoothstep sempit) — sinar cahaya yang
	// pudar keluar, bukan cakera putih bertepi keras.
	float glow = exp(-max(0.0, 1.0 - align) * 90.0);
	float pulse = 0.7 + 0.3 * sin(uTime * 1.1);
	return vec3(0.95, 0.92, 0.8) * glow * pulse * 1.3;
}

vec3 innerResonance(vec3 n, float frontMask) {
	vec3 glow = vec3(0.0);
	for (int i = 0; i < MAX_GLOWS; i++) {
		if (i >= uEntityCount) break;
		float align = dot(n, uEntityDirs[i]);
		float core = smoothstep(0.988, 0.9998, align);
		float bleed = smoothstep(0.972, 0.988, align) * 0.18;
		float pulse = 0.82 + 0.18 * sin(uTime * 0.75 + float(i) * 1.1);
		float w = (core * 1.4 + bleed) * uEntityStrength[i] * pulse;
		glow += uEntityColors[i] * w;
	}

	float hoverAlign = dot(n, normalize(uHoverDir));
	float hoverBoost = smoothstep(0.975, 0.999, hoverAlign) * uHoverActive * 0.5;
	glow += uEquilara * hoverBoost;

	return glow * frontMask;
}

void main() {
	vec3 n = normalize(vObjectNormal);
	float frontMask = smoothstep(0.08, 0.35, dot(n, normalize(vViewDir)));
	float detailBoost = uProximity;

	vec3 col = mythicSurface(n, detailBoost);
	col = applyFeatures(col, n);
	col = applyRivers(col, n);

	vec3 lightDir = normalize(vec3(0.35, 0.55, 0.75));
	float diffuse = 0.55 + 0.45 * max(dot(n, lightDir), 0.0);
	col *= diffuse;
	col *= 1.08 + detailBoost * 0.18;

	vec3 resonance = innerResonance(n, frontMask);
	col += resonance * mix(0.32, 0.18, uProximity);
	col += aethirionGlow(n) * frontMask;

	float hazeDensity;
	vec3 haze = hazeLayer(n, uProximity, hazeDensity);
	col = mix(col, haze, hazeDensity);

	float breathe = 0.94 + 0.03 * sin(uTime * 0.7);
	col *= breathe;

	float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.4);
	col += fresnel * vec3(0.14, 0.12, 0.10) * frontMask;

	float atmosRim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 3.0);
	col += atmosRim * uEquilara * mix(0.06, 0.14, uProximity) * frontMask;

	gl_FragColor = vec4(col, 1.0);
}
`;

export function createGlobeMaterial(entityUniforms?: EntityGlowUniforms): THREE.ShaderMaterial {
	const glow = entityUniforms ?? createEntityGlowUniforms();

	const { dirs, types, radii, count } = buildFeatureUniformArrays();
	const featureDirs = Array.from({ length: MAX_FEATURES }, (_, i) =>
		dirs[i] ? new THREE.Vector3(...dirs[i]) : new THREE.Vector3(0, 1, 0),
	);
	const featureTypes = Array.from({ length: MAX_FEATURES }, (_, i) => types[i] ?? 0);
	const featureRadii = Array.from({ length: MAX_FEATURES }, (_, i) => radii[i] ?? 0.1);

	const rivers = buildRiverUniformArrays();
	const riverPoints = (river?: (typeof rivers)[number]) =>
		Array.from({ length: MAX_RIVER_POINTS }, (_, i) => new THREE.Vector3(...(river?.points[i] ?? [0, 1, 0])));

	return new THREE.ShaderMaterial({
		vertexShader: globeVertexShader,
		fragmentShader: globeFragmentShader,
		uniforms: {
			uTime: { value: 0 },
			uProximity: { value: 0 },
			uLuminara: { value: hexToVec3(HEMISPHERE_COLORS.luminara) },
			uNoctira: { value: hexToVec3(HEMISPHERE_COLORS.noctira) },
			uEquilara: { value: hexToVec3(HEMISPHERE_COLORS.equilara) },
			uFeatureCount: { value: count },
			uFeatureDirs: { value: featureDirs },
			uFeatureType: { value: featureTypes },
			uFeatureRadius: { value: featureRadii },
			uRiverAPoints: { value: riverPoints(rivers[0]) },
			uRiverBPoints: { value: riverPoints(rivers[1]) },
			uRiverAColor: { value: hexToVec3(rivers[0]?.color ?? '#5ba3a0') },
			uRiverBColor: { value: hexToVec3(rivers[1]?.color ?? '#4a5568') },
			...glow,
		},
	});
}
