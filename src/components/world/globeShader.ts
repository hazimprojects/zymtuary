import * as THREE from 'three';
import { SPHERAL_COLORS } from './worldGlobeConfig';

function hexToVec3(hex: string): THREE.Vector3 {
	const c = new THREE.Color(hex);
	return new THREE.Vector3(c.r, c.g, c.b);
}

export const ZONE_COLORS = {
	luminara: hexToVec3(SPHERAL_COLORS.luminara),
	noctira: hexToVec3(SPHERAL_COLORS.noctira),
	equilara: hexToVec3(SPHERAL_COLORS.equilara),
	ignisara: hexToVec3(SPHERAL_COLORS.ignisara),
	nivira: hexToVec3(SPHERAL_COLORS.nivira),
};

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
uniform float uTime;
uniform vec3 uHoverColor;
uniform float uHoverActive;
uniform vec3 uLuminara;
uniform vec3 uNoctira;
uniform vec3 uEquilara;
uniform vec3 uIgnisara;
uniform vec3 uNivira;

varying vec3 vNormal;
varying vec3 vObjectNormal;

vec3 zoneColor(vec3 n) {
	float phi = acos(clamp(n.y, -1.0, 1.0));
	float theta = atan(n.x, n.z);
	float phiN = phi / 3.14159265;

	float luminaraW = smoothstep(0.42, 0.32, phiN);
	float noctiraW = smoothstep(0.58, 0.68, phiN);
	float equilaraW = smoothstep(0.22, 0.0, abs(phiN - 0.5));

	float ignisaraTheta = smoothstep(0.12 * 3.14159265, 0.18 * 3.14159265, theta)
		* smoothstep(0.88 * 3.14159265, 0.82 * 3.14159265, theta);
	float ignisaraPhi = smoothstep(0.48, 0.54, phiN);
	float ignisaraW = ignisaraTheta * ignisaraPhi;

	float niviraTheta = smoothstep(1.08 * 3.14159265, 1.14 * 3.14159265, theta)
		* smoothstep(1.88 * 3.14159265, 1.82 * 3.14159265, theta);
	float niviraPhi = smoothstep(0.46, 0.38, phiN);
	float niviraW = niviraTheta * niviraPhi;

	vec3 col = vec3(0.04, 0.03, 0.025);
	col = mix(col, uLuminara, luminaraW * 0.58);
	col = mix(col, uNoctira, noctiraW * 0.58);
	col = mix(col, uEquilara, equilaraW * 0.42);
	col = mix(col, uIgnisara, ignisaraW * 0.7);
	col = mix(col, uNivira, niviraW * 0.7);

	return col;
}

void main() {
	vec3 n = normalize(vObjectNormal);
	vec3 col = zoneColor(n);

	float pulse = 0.72 + 0.1 * sin(uTime * 1.1);
	col *= pulse;

	float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
	col += fresnel * 0.06;

	col = mix(col, uHoverColor, uHoverActive * 0.55);

	gl_FragColor = vec4(col, 0.92);
}
`;

export function createGlobeMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		vertexShader: globeVertexShader,
		fragmentShader: globeFragmentShader,
		uniforms: {
			uTime: { value: 0 },
			uHoverColor: { value: new THREE.Vector3(1, 1, 1) },
			uHoverActive: { value: 0 },
			uLuminara: { value: ZONE_COLORS.luminara },
			uNoctira: { value: ZONE_COLORS.noctira },
			uEquilara: { value: ZONE_COLORS.equilara },
			uIgnisara: { value: ZONE_COLORS.ignisara },
			uNivira: { value: ZONE_COLORS.nivira },
		},
		transparent: true,
		depthWrite: true,
	});
}
