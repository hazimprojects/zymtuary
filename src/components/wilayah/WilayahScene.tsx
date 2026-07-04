import { useMemo } from 'react';
import * as THREE from 'three';
import type { EntityData, WilayahData } from '../entities/SpheralExperience';
import { buildIslandGeometry, layoutMendariAnchors, type KawasanAnchor, ISLAND_RADIUS } from './wilayahTerrain';
import { ZymCharacterController, type ZymJoystickVisual } from '../kawasan/ZymCharacterController';

/** Jejari berjalan Mendari — sedikit lebih kecil dari edge untuk Zym tidak
 * jatuh di cerun tepi pulau. */
const MENDARI_WALK_RADIUS = ISLAND_RADIUS * 0.82;
const MENDARI_TERRAIN: Parameters<typeof ZymCharacterController>[0]['terrainOptions'] = {
	islandRadius: ISLAND_RADIUS,
};
/** Zym terbang di Mendari — flying sentiasa aktif. */
const MENDARI_GLOW = '#d4a843';

export function WilayahScene({
	wilayah,
	entities,
	isMobile,
	interactionPaused,
	flying,
	nearSpotId,
	onNearSpotChange,
	onJoystickChange,
}: {
	wilayah: WilayahData;
	entities: EntityData[];
	isMobile: boolean;
	interactionPaused: boolean;
	flying: boolean;
	nearSpotId: string | null;
	onNearSpotChange: (id: string | null) => void;
	onJoystickChange: (joystick: ZymJoystickVisual | null) => void;
}) {
	const anchors = useMemo(
		() => layoutMendariAnchors(entities.map((e) => ({ id: e.id, nama: e.nama, kawasan: e.kawasan }))),
		[entities],
	);

	const geometry = useMemo(() => buildIslandGeometry(anchors, wilayah.warna), [anchors, wilayah.warna]);

	// Spawn di selatan — menghadap tengah pulau
	const startPosition: [number, number, number] = [0, 0, 5.2];

	return (
		<>
			<fog attach="fog" args={[wilayah.warna, 8, 30]} />
			<hemisphereLight args={['#fbe2a8', '#5a3d2a', 0.85]} />
			<directionalLight position={[-4, 3.5, 2]} intensity={1.3} color="#ffd9a0" />
			<ambientLight intensity={0.25} color={wilayah.warna} />

			<mesh geometry={geometry} receiveShadow={false}>
				<meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.02} />
			</mesh>

			<ZymCharacterController
				anchors={anchors}
				plazaRadius={MENDARI_WALK_RADIUS}
				startPosition={startPosition}
				glowColor={MENDARI_GLOW}
				isMobile={isMobile}
				interactionPaused={interactionPaused}
				flying={flying}
				terrainOptions={MENDARI_TERRAIN}
				onNearSpotChange={onNearSpotChange}
				onJoystickChange={onJoystickChange}
			/>
		</>
	);
}

export type { KawasanAnchor };
