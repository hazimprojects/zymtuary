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

void main() {
	vNormal = normalize(normalMatrix * normal);
	vObjectNormal = normalize(normal);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const globeFragmentShader = /* glsl */ `
#define MAX_GLOWS 24

uniform float uTime;
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
	for (int i = 0; i < 4; i++) {
		v += a * noise(p);
		p *= 2.1;
		a *= 0.5;
	}
	return v;
}

vec3 dreamTerrain(vec3 n) {
	vec3 p = n * 3.8;
	float continent = fbm(p);
	float elevation = fbm(p * 2.2 + vec3(1.2, 2.0, 0.6));

	float land = smoothstep(0.46, 0.56, continent);
	float forest = smoothstep(0.35, 0.52, elevation) * land * 0.7;
	float sea = 1.0 - land;

	vec3 deep = vec3(0.03, 0.08, 0.14);
	vec3 water = vec3(0.06, 0.16, 0.24);
	vec3 landCol = vec3(0.14, 0.18, 0.12);
	vec3 grove = vec3(0.08, 0.22, 0.14);

	vec3 col = mix(deep, water, sea * 0.8);
	col = mix(col, landCol, land * 0.65);
	col = mix(col, grove, forest);
	return col;
}

vec3 hemisphereTint(vec3 col, vec3 n) {
	float lat = n.y;
	float northW = smoothstep(0.0, 0.65, lat);
	float southW = smoothstep(0.0, 0.65, -lat);
	col = mix(col, col * uLuminara * 1.4, northW * 0.18);
	col = mix(col, col * uNoctira * 1.3, southW * 0.18);
	return col;
}

vec3 innerResonance(vec3 n) {
	vec3 glow = vec3(0.0);
	for (int i = 0; i < MAX_GLOWS; i++) {
		if (i >= uEntityCount) break;
		float align = dot(n, uEntityDirs[i]);
		float core = smoothstep(0.955, 0.999, align);
		float halo = smoothstep(0.78, 0.955, align) * 0.55;
		float pulse = 0.78 + 0.22 * sin(uTime * 0.9 + float(i) * 1.3);
		float w = (core * 1.8 + halo) * uEntityStrength[i] * pulse;
		glow += uEntityColors[i] * w;
	}

	float hoverAlign = dot(n, normalize(uHoverDir));
	float hoverBoost = smoothstep(0.88, 0.995, hoverAlign) * uHoverActive * 0.6;
	glow += uEquilara * hoverBoost;

	return glow;
}

void main() {
	vec3 n = normalize(vObjectNormal);
	vec3 col = dreamTerrain(n);
	col = hemisphereTint(col, n);

	vec3 resonance = innerResonance(n);
	col += resonance * 0.42;
	col = mix(col, col + resonance * 0.35, min(length(resonance) * 1.5, 0.75));

	float mist = fbm(n * 4.0 + vec3(uTime * 0.015, 0.0, uTime * 0.01));
	col = mix(col, uEquilara * 0.35, mist * 0.12);

	float breathe = 0.9 + 0.05 * sin(uTime * 0.55);
	col *= breathe;

	float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.8);
	col += fresnel * vec3(0.08, 0.07, 0.06);

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
			uLuminara: { value: hexToVec3(HEMISPHERE_COLORS.luminara) },
			uNoctira: { value: hexToVec3(HEMISPHERE_COLORS.noctira) },
			uEquilara: { value: hexToVec3(HEMISPHERE_COLORS.equilara) },
			...glow,
		},
	});
}
