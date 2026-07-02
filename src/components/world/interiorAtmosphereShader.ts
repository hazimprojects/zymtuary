import * as THREE from 'three';

export const interiorCloudVertex = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vLocalNormal;

void main() {
	vLocalNormal = normalize(normal);
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldPos = worldPos.xyz;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function buildFragmentShader(octaves: number, doubleLayer: boolean): string {
	return /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uSunDir;
uniform vec3 uCloudColor;

varying vec3 vWorldPos;
varying vec3 vLocalNormal;

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
	for (int i = 0; i < ${octaves}; i++) {
		v += a * noise(p);
		p *= 2.05;
		a *= 0.5;
	}
	return v;
}

void main() {
	vec3 drift = vec3(uTime * 0.04, uTime * 0.01, uTime * 0.03);
	float density = fbm(normalize(vWorldPos) * 4.5 + drift);
	${doubleLayer ? 'density += fbm(normalize(vWorldPos) * 7.5 + drift * 1.4) * 0.45;' : ''}
	float alpha = smoothstep(0.42, 0.72, density) * uOpacity;

	float sunGlow = pow(max(dot(normalize(vLocalNormal), normalize(uSunDir)), 0.0), 6.0);
	vec3 col = mix(uCloudColor, vec3(1.0, 0.95, 0.82), sunGlow * 0.65);

	gl_FragColor = vec4(col, alpha);
}
`;
}

export const interiorCloudFragment = buildFragmentShader(4, true);
/** Kos per-piksel jauh lebih rendah (~4x kurang sampel noise) — untuk mobile,
 * di mana shell awan yang tumpang-tindih semasa descent boleh menjunam kadar bingkai. */
export const interiorCloudFragmentLow = buildFragmentShader(2, false);

export function createInteriorCloudMaterial(
	opacity: number,
	quality: 'high' | 'low' = 'high',
): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		vertexShader: interiorCloudVertex,
		fragmentShader: quality === 'low' ? interiorCloudFragmentLow : interiorCloudFragment,
		uniforms: {
			uTime: { value: 0 },
			uOpacity: { value: opacity },
			uSunDir: { value: new THREE.Vector3(0.35, 0.55, 0.75).normalize() },
			uCloudColor: { value: new THREE.Vector3(0.88, 0.9, 0.94) },
		},
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		blending: THREE.NormalBlending,
	});
}
