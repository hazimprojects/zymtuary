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

vec3 earthTerrain(vec3 n, float detailBoost) {
	vec3 p = n * (4.2 + detailBoost * 2.5);
	float continent = fbm(p);
	float elevation = fbm(p * 2.4 + vec3(1.7, 2.3, 0.9));
	float detail = fbm(p * 6.0 + vec3(3.1, 0.4, 2.8));

	float land = smoothstep(0.44, 0.54, continent);
	float shore = smoothstep(0.0, 0.12, land) * (1.0 - smoothstep(0.12, 0.22, land));
	float mountain = smoothstep(0.58, 0.76, elevation + detail * 0.25) * land;
	float forest = smoothstep(0.38, 0.55, elevation) * land * (1.0 - mountain * 0.85);
	float meadow = land * (1.0 - forest * 0.7) * (1.0 - mountain);

	vec3 deepSea = vec3(0.04, 0.12, 0.22);
	vec3 shallowSea = vec3(0.08, 0.24, 0.34);
	vec3 sand = vec3(0.38, 0.34, 0.26);
	vec3 meadowCol = vec3(0.28, 0.36, 0.22);
	vec3 forestCol = vec3(0.10, 0.30, 0.18);
	vec3 peakCol = vec3(0.62, 0.58, 0.52);
	vec3 snowPeak = vec3(0.82, 0.80, 0.76);

	vec3 col = mix(deepSea, shallowSea, smoothstep(0.0, 0.44, continent));
	col = mix(col, sand, shore * 0.9);
	col = mix(col, meadowCol, meadow * 0.75);
	col = mix(col, forestCol, forest * 0.88);
	col = mix(col, peakCol, mountain * 0.7);
	col = mix(col, snowPeak, smoothstep(0.72, 0.88, elevation + detail * 0.3) * mountain);

	return col;
}

vec3 hemisphereTint(vec3 col, vec3 n) {
	float lat = n.y;
	col = mix(col, col * uLuminara * 1.55, smoothstep(0.0, 0.7, lat) * 0.22);
	col = mix(col, col * uNoctira * 1.35, smoothstep(0.0, 0.7, -lat) * 0.22);
	col = mix(col, col * uEquilara * 1.25, smoothstep(0.28, 0.0, abs(lat)) * 0.12);
	return col;
}

float cloudLayer(vec3 n, float proximity) {
	vec3 drift = vec3(uTime * 0.035, uTime * 0.008, uTime * 0.028);
	float c1 = fbm(n * 5.5 + drift);
	float c2 = fbm(n * 8.0 + drift * 1.3 + vec3(2.0, 0.0, 1.0)) * 0.55;
	float c = c1 + c2;
	float density = smoothstep(0.46, 0.72, c);
	float fade = mix(0.06, 0.2, proximity);
	return density * fade;
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

	vec3 col = earthTerrain(n, detailBoost);
	col = hemisphereTint(col, n);

	vec3 lightDir = normalize(vec3(0.35, 0.55, 0.75));
	float diffuse = 0.55 + 0.45 * max(dot(n, lightDir), 0.0);
	col *= diffuse;
	col *= 1.08 + detailBoost * 0.18;

	vec3 resonance = innerResonance(n, frontMask);
	col += resonance * mix(0.32, 0.18, uProximity);

	float clouds = cloudLayer(n, uProximity);
	col = mix(col, vec3(0.78, 0.76, 0.72), clouds);

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
