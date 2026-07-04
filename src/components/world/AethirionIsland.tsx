import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from './worldGlobeConfig';

type AethirionIslandProps = {
	/** 0 di orbit jauh, 1 dalam atmosfera/descent — pulau hanya kelihatan
	 * apabila pelawat cukup dekat (ikut kanun: "boleh dicapai apabila
	 * seseorang cukup matang"), bukan sentiasa bersinar dari orbit jauh. */
	atmosphereBlendRef: React.MutableRefObject<number>;
};

/** Pulau rendah-poligon terapung — dibina daripada icosahedron mentah (20
 * muka rata semula jadi) yang dipuntir sedikit supaya tidak simetri
 * sempurna, dengan flatShading untuk rupa "low poly" tulen. */
function buildIslandGeometry(): THREE.BufferGeometry {
	const geo = new THREE.IcosahedronGeometry(0.11, 0);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const jitter = 0.85 + Math.abs(Math.sin(i * 12.9898 + i * i * 3.7)) * 0.3;
		pos.setXYZ(i, x * jitter, y * jitter * 0.62, z * jitter);
	}
	geo.computeVertexNormals();
	return geo;
}

export default function AethirionIsland({ atmosphereBlendRef }: AethirionIslandProps) {
	const groupRef = useRef<THREE.Group>(null);
	const geometry = useMemo(() => buildIslandGeometry(), []);
	const material = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: '#e8ddc0',
				flatShading: true,
				roughness: 0.7,
				metalness: 0.05,
				transparent: true,
				opacity: 0,
			}),
		[],
	);

	useFrame(({ clock }) => {
		const t = clock.elapsedTime;
		// Sama seperti kanun: "tidak pernah diam di satu kedudukan cukup lama
		// untuk dipetakan" — kedudukan dikira terus daripada masa, hanyut
		// perlahan mengelilingi garisan Equilara.
		const theta = t * 0.05 + 1.4;
		const y = 0.03 + 0.06 * Math.sin(t * 0.09);
		const ring = Math.sqrt(Math.max(0, 1 - y * y));
		const altitude = GLOBE_RADIUS + 0.22 + Math.sin(t * 0.6) * 0.015;

		if (groupRef.current) {
			groupRef.current.position.set(ring * Math.sin(theta) * altitude, y * altitude, ring * Math.cos(theta) * altitude);
			groupRef.current.rotation.y = t * 0.15;
			groupRef.current.rotation.z = Math.sin(t * 0.3) * 0.08;
		}

		const blend = atmosphereBlendRef.current;
		const targetOpacity = THREE.MathUtils.clamp((blend - 0.25) / 0.4, 0, 1);
		material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
		material.visible = material.opacity > 0.01;
	});

	return (
		<group ref={groupRef}>
			<mesh geometry={geometry} material={material} />
		</group>
	);
}
