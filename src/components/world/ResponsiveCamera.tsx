import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function ResponsiveCamera({ isMobile, disabled = false }: { isMobile: boolean; disabled?: boolean }) {
	const { camera, size } = useThree();
	const hasSetInitialPosition = useRef(false);

	useEffect(() => {
		if (disabled) return;
		if (!(camera instanceof THREE.PerspectiveCamera)) return;

		const portrait = size.height > size.width;
		const narrow = size.width < 768 || isMobile;

		if (narrow) {
			camera.fov = portrait ? 54 : 50;
			if (!hasSetInitialPosition.current) {
				const dist = portrait ? 6.8 : 5.8;
				camera.position.set(0, 0.05, dist);
				hasSetInitialPosition.current = true;
			}
		} else {
			camera.fov = 45;
			if (!hasSetInitialPosition.current) {
				camera.position.set(0, 0.4, 4.2);
				hasSetInitialPosition.current = true;
			}
		}

		camera.near = 0.1;
		camera.far = 100;
		camera.updateProjectionMatrix();
	}, [camera, size.width, size.height, isMobile, disabled]);

	return null;
}
