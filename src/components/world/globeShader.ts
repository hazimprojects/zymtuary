import * as THREE from 'three';
import { HEMISPHERE_COLORS } from './worldGlobeConfig';

function hexToVec3(hex: string): THREE.Vector3 {
	const c = new THREE.Color(hex);
	return new THREE.Vector3(c.r, c.g, c.b);
}

export const globeVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vObjectNormal;
varying vec3 vWorldPos;

void main() {
	vNormal = normalize(normalMatrix * normal);
	vObjectNormal = normalize(normal);
	vec4 wp = modelMatrix * vec4(position, 1.0);
	vWorldPos = wp.xyz;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const globeFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uLuminara;
uniform vec3 uNoctira;
uniform vec3 uEquilara;

varying vec3 vNormal;
varying vec3 vObjectNormal;
varying vec3 vWorldPos;

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

vec3 terrainColor(vec3 n) {
	vec3 samplePos = n * 4.2;
	float continent = fbm(samplePos);
	float elevation = fbm(samplePos * 2.4 + vec3(1.7, 2.3, 0.9));
	float detail = fbm(samplePos * 6.0 + vec3(3.1, 0.4, 2.8));

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

vec3 atmosphereTint(vec3 col, vec3 n) {
	float lat = n.y;
	float northW = smoothstep(0.0, 0.7, lat);
	float southW = smoothstep(0.0, 0.7, -lat);
	float horizonW = smoothstep(0.28, 0.0, abs(lat));

	col = mix(col, col * uLuminara * 1.6, northW * 0.22);
	col = mix(col, col * uNoctira * 1.4, southW * 0.22);
	col = mix(col, col * uEquilara * 1.3, horizonW * 0.15);

	return col;
}

float cloudLayer(vec3 n) {
	float c = fbm(n * 5.5 + vec3(uTime * 0.02, 0.0, uTime * 0.015));
	return smoothstep(0.52, 0.68, c) * 0.35;
}

void main() {
	vec3 n = normalize(vObjectNormal);
	vec3 col = terrainColor(n);
	col = atmosphereTint(col, n);

	float breathe = 0.88 + 0.04 * sin(uTime * 0.7);
	col *= breathe;

	float clouds = cloudLayer(n);
	col = mix(col, vec3(0.75, 0.72, 0.68), clouds);

	float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.2);
	col += fresnel * vec3(0.12, 0.10, 0.08);

	float atmosRim = pow(1.0 - max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
	col += atmosRim * uEquilara * 0.08;

	gl_FragColor = vec4(col, 1.0);
}
`;

export function createGlobeMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		vertexShader: globeVertexShader,
		fragmentShader: globeFragmentShader,
		uniforms: {
			uTime: { value: 0 },
			uLuminara: { value: hexToVec3(HEMISPHERE_COLORS.luminara) },
			uNoctira: { value: hexToVec3(HEMISPHERE_COLORS.noctira) },
			uEquilara: { value: hexToVec3(HEMISPHERE_COLORS.equilara) },
		},
	});
}
