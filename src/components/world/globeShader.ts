import * as THREE from 'three';
import { HEMISPHERE_COLORS } from './worldGlobeConfig';
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

	vec3 lightDir = normalize(vec3(0.35, 0.55, 0.75));
	float diffuse = 0.55 + 0.45 * max(dot(n, lightDir), 0.0);
	col *= diffuse;
	col *= 1.08 + detailBoost * 0.18;

	vec3 resonance = innerResonance(n, frontMask);
	col += resonance * mix(0.32, 0.18, uProximity);

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

	return new THREE.ShaderMaterial({
		vertexShader: globeVertexShader,
		fragmentShader: globeFragmentShader,
		uniforms: {
			uTime: { value: 0 },
			uProximity: { value: 0 },
			uLuminara: { value: hexToVec3(HEMISPHERE_COLORS.luminara) },
			uNoctira: { value: hexToVec3(HEMISPHERE_COLORS.noctira) },
			uEquilara: { value: hexToVec3(HEMISPHERE_COLORS.equilara) },
			...glow,
		},
	});
}
