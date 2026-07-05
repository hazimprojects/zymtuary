import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

const SUN_DIR = new THREE.Vector3(0.35, 0.55, 0.75).normalize();

type InteriorAtmosphereProps = {
	interiorBlendRef: RefObject<number>;
	isMobile?: boolean;
};

const skyCeilingVertex = /* glsl */ `
varying vec3 vWorldPos;

void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldPos = worldPos.xyz;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyCeilingFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uCloudColor;

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
	for (int i = 0; i < 4; i++) {
		v += a * noise(p);
		p *= 2.05;
		a *= 0.5;
	}
	return v;
}

void main() {
	vec3 drift = vec3(uTime * 0.04, uTime * 0.01, uTime * 0.03);
	float density = fbm(normalize(vWorldPos) * 4.5 + drift);
	density += fbm(normalize(vWorldPos) * 7.5 + drift * 1.4) * 0.45;
	float alpha = smoothstep(0.42, 0.72, density) * uOpacity;
	gl_FragColor = vec4(uCloudColor, alpha);
}
`;

/**
 * Matahari + halo + haze langit + SATU lapisan "siling awan" paling atas
 * utk rasa langit — side: BackSide sengaja (bukan DoubleSide macam dulu)
 * supaya HANYA kelihatan dari DALAM/BAWAH (memandang ke atas), bukan dari
 * luar/atas (memandang ke bawah ke permukaan) — dulu 3 lapisan DoubleSide
 * menyelubungi SELURUH langit tidak kira arah & menghalang pandangan dari
 * atas. Awan "kelompok" (gunung/pokok/Obsidian Hollow) kekal berasingan
 * drpd lapisan siling ini.
 */
export function InteriorAtmosphere({ interiorBlendRef }: InteriorAtmosphereProps) {
	const sunRef = useRef<THREE.Group>(null);
	const haloRef = useRef<THREE.Mesh>(null);
	const skyHazeRef = useRef<THREE.Mesh>(null);
	const sunMatRef = useRef<THREE.MeshBasicMaterial>(null);
	const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
	const { camera } = useThree();

	const ceilingMat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: skyCeilingVertex,
				fragmentShader: skyCeilingFragment,
				uniforms: {
					uTime: { value: 0 },
					uOpacity: { value: 0 },
					uCloudColor: { value: new THREE.Vector3(0.88, 0.9, 0.94) },
				},
				transparent: true,
				depthWrite: false,
				side: THREE.BackSide,
				blending: THREE.NormalBlending,
			}),
		[],
	);
	const ceilingBaseOpacity = 0.4;

	useFrame(({ clock }) => {
		const blend = interiorBlendRef.current;
		if (blend <= 0.001) return;

		if (sunRef.current) {
			sunRef.current.position.copy(camera.position).addScaledVector(SUN_DIR, 38);
		}

		ceilingMat.uniforms.uTime.value = clock.elapsedTime;
		ceilingMat.uniforms.uOpacity.value = ceilingBaseOpacity * blend;

		if (sunMatRef.current) sunMatRef.current.opacity = 0.95 * blend;
		if (haloMatRef.current) haloMatRef.current.opacity = 0.18 * blend;
		if (skyHazeRef.current?.material instanceof THREE.MeshBasicMaterial) {
			skyHazeRef.current.material.opacity = 0.06 * blend;
		}
	});

	return (
		<group>
			<group ref={sunRef} renderOrder={20}>
				<mesh>
					<sphereGeometry args={[1.8, 24, 24]} />
					<meshBasicMaterial
						ref={sunMatRef}
						color="#fff6dc"
						transparent
						opacity={0}
						depthWrite={false}
					/>
				</mesh>
				<mesh ref={haloRef}>
					<sphereGeometry args={[3.2, 16, 16]} />
					<meshBasicMaterial
						ref={haloMatRef}
						color="#ffd080"
						transparent
						opacity={0}
						depthWrite={false}
						blending={THREE.AdditiveBlending}
					/>
				</mesh>
			</group>

			<mesh ref={skyHazeRef} renderOrder={5}>
				<sphereGeometry args={[GLOBE_RADIUS + 1.6, 32, 32]} />
				<meshBasicMaterial
					color="#b8d4f0"
					transparent
					opacity={0}
					side={THREE.BackSide}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>

			{/* MESTI jauh lebih tinggi drpd DESCENT_CONFIG.maxAltitude (0.95) —
			    sebelum ini +0.6 duduk TEPAT dlm julat altitud terbang biasa
			    (0.05-0.95), jadi kamera kerap terbang TEPAT pada/dekat
			    permukaan sfera ini, menjadikan tekstur awan memenuhi SELURUH
			    skrin (gunung "hilang" ditelan kabus) — bukan cuma isu dekat
			    puncak Obsidian Hollow, tapi mana-mana penerbangan pada altitud
			    ~0.6. */}
			<mesh renderOrder={4}>
				<sphereGeometry args={[GLOBE_RADIUS + 1.15, 40, 40]} />
				<primitive object={ceilingMat} attach="material" />
			</mesh>
		</group>
	);
}
