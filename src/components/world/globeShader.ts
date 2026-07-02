import * as THREE from 'three';
import { HEMISPHERE_COLORS } from './worldGlobeConfig';

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
uniform float uTime;
uniform vec3 uLuminara;
uniform vec3 uNoctira;
uniform vec3 uEquilara;

varying vec3 vNormal;
varying vec3 vObjectNormal;

vec3 atmosphereColor(vec3 n) {
	float lat = n.y;

	float northW = smoothstep(0.05, 0.75, lat);
	float southW = smoothstep(0.05, 0.75, -lat);
	float horizonW = smoothstep(0.35, 0.0, abs(lat));

	vec3 col = uEquilara * 0.35;
	col = mix(col, uLuminara, northW * 0.52);
	col = mix(col, uNoctira, southW * 0.52);
	col = mix(col, uEquilara * 1.15, horizonW * 0.38);

	float mergeShimmer = sin(uTime * 0.4 + n.x * 4.0 + n.z * 3.0) * 0.5 + 0.5;
	col += mergeShimmer * horizonW * vec3(0.04, 0.03, 0.05);

	return col;
}

void main() {
	vec3 n = normalize(vObjectNormal);
	vec3 col = atmosphereColor(n);

	float breathe = 0.78 + 0.08 * sin(uTime * 0.85);
	col *= breathe;

	float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.5);
	col += fresnel * vec3(0.07, 0.06, 0.05);

	float cloud = sin(n.x * 8.0 + uTime * 0.3) * sin(n.z * 6.0 - uTime * 0.2) * 0.03;
	col += cloud;

	gl_FragColor = vec4(col, 0.88);
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
		transparent: true,
		depthWrite: true,
	});
}
