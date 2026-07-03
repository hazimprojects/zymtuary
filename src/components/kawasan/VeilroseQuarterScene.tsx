import { useMemo } from 'react';
import type { SpotUtama } from '../world/worldGlobeConfig';
import { buildIslandGeometry, ISLAND_RADIUS } from '../wilayah/wilayahTerrain';
import { layoutVeilroseAnchors, AMBIENT_ROSE_STALLS } from './veilroseQuarterLayout';
import { SpotMarker } from './SpotMarker';
import { RoseStallProp } from './veilroseLandmarks';
import { ZymCharacterController, type JoystickSide, type ZymJoystickVisual } from './ZymCharacterController';

const BASE_GROUND_COLOR = '#e8c96a';
const ZYM_GLOW_COLOR = '#d4a843';
/** Plaza rata berakhir di ~0.74 x ISLAND_RADIUS (lihat wilayahTerrain.ts) —
 * kekalkan watak dalam kawasan ini supaya tidak berjalan ke cerun tepi. */
const PLAZA_WALK_RADIUS = ISLAND_RADIUS * 0.7;

export function VeilroseQuarterScene({
	spots,
	isMobile,
	interactionPaused,
	nearSpotId,
	flying,
	onNearSpotChange,
	onJoystickChange,
	onJoystickSideChange,
}: {
	spots: SpotUtama[];
	isMobile: boolean;
	interactionPaused: boolean;
	nearSpotId: string | null;
	flying: boolean;
	onNearSpotChange: (id: string | null) => void;
	onJoystickChange: (joystick: ZymJoystickVisual | null) => void;
	onJoystickSideChange: (side: JoystickSide) => void;
}) {
	const anchors = useMemo(() => layoutVeilroseAnchors(spots), [spots]);
	const geometry = useMemo(() => buildIslandGeometry(anchors, BASE_GROUND_COLOR), [anchors]);

	return (
		<>
			<fog attach="fog" args={[BASE_GROUND_COLOR, 6, 20]} />
			<hemisphereLight args={['#fbe2a8', '#5a3d2a', 0.85]} />
			<directionalLight position={[-4, 3.5, 2]} intensity={1.3} color="#ffd9a0" />
			<ambientLight intensity={0.25} color={BASE_GROUND_COLOR} />

			<mesh geometry={geometry} receiveShadow={false}>
				<meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.02} />
			</mesh>

			{AMBIENT_ROSE_STALLS.map((stall, i) => (
				<group key={i} position={[stall.x, 0.18, stall.z]} rotation={[0, stall.rot, 0]}>
					<RoseStallProp scale={stall.scale} />
				</group>
			))}

			{anchors.map((anchor, index) => (
				<SpotMarker key={anchor.id} anchor={anchor} active={anchor.id === nearSpotId} bobOffset={index * 1.4} />
			))}

			<ZymCharacterController
				anchors={anchors}
				plazaRadius={PLAZA_WALK_RADIUS}
				startPosition={[0, 0, 3.8]}
				glowColor={ZYM_GLOW_COLOR}
				isMobile={isMobile}
				interactionPaused={interactionPaused}
				flying={flying}
				onNearSpotChange={onNearSpotChange}
				onJoystickChange={onJoystickChange}
				onJoystickSideChange={onJoystickSideChange}
			/>
		</>
	);
}
