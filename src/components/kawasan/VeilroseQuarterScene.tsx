import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SpotUtama } from '../world/worldGlobeConfig';
import { buildIslandGeometry } from '../wilayah/wilayahTerrain';
import {
	layoutVeilroseAnchors,
	AMBIENT_ROSE_STALLS,
	AMBIENT_FLOWERING_TREES,
	AMBIENT_GRASS_TUFTS,
	VEILROSE_ISLAND_RADIUS,
} from './veilroseQuarterLayout';
import { SpotMarker } from './SpotMarker';
import { RoseStallProp } from './veilroseLandmarks';
import { VeilroseGrassTuft, VeilroseFloweringTree } from './veilroseDecor';
import { VEILROSE_PALETTE } from './veilrosePalette';
import { ZymCharacterController, type ZymJoystickVisual } from './ZymCharacterController';

const BASE_GROUND_COLOR = VEILROSE_PALETTE.gold;
const ZYM_GLOW_COLOR = '#d4a843';
/** Plaza rata berakhir di ~0.74 x islandRadius — kekalkan watak dalam kawasan ini. */
const PLAZA_WALK_RADIUS = VEILROSE_ISLAND_RADIUS * 0.72;
/** heartStepTierHeight dinaikkan daripada lalai (0.085) supaya Tangga
 * Tepukan terasa macam tangga sebenar yang boleh didaki, bukan riak yang
 * nyaris tak nampak — lihat ApplauseStepsLandmark dalam veilroseLandmarks.tsx
 * yang membina geometrinya terus daripada nombor yang sama ini. */
const VEILROSE_TERRAIN = { islandRadius: VEILROSE_ISLAND_RADIUS, heartStepTierHeight: 0.2 } as const;

export function VeilroseQuarterScene({
	spots,
	isMobile,
	interactionPaused,
	nearSpotId,
	flying,
	onNearSpotChange,
	onJoystickChange,
}: {
	spots: SpotUtama[];
	isMobile: boolean;
	interactionPaused: boolean;
	nearSpotId: string | null;
	flying: boolean;
	onNearSpotChange: (id: string | null) => void;
	onJoystickChange: (joystick: ZymJoystickVisual | null) => void;
}) {
	const anchors = useMemo(() => layoutVeilroseAnchors(spots), [spots]);
	const geometry = useMemo(
		() => buildIslandGeometry(anchors, BASE_GROUND_COLOR, VEILROSE_TERRAIN),
		[anchors],
	);
	const collisionRootRef = useRef<THREE.Group>(null);

	return (
		<>
			<fog attach="fog" args={[BASE_GROUND_COLOR, 8, 34]} />
			<hemisphereLight args={['#fbe2a8', '#5a3d2a', 0.85]} />
			<directionalLight position={[-4, 3.5, 2]} intensity={1.3} color="#ffd9a0" />
			<ambientLight intensity={0.25} color={BASE_GROUND_COLOR} />

			{/* Hiasan ambien (gerai mawar, pokok, rumput) sengaja DI LUAR
			 * collisionRootRef — ia tiada perlanggaran watak (lihat
			 * resolveCharacterObstacles, yang hanya guna `anchors`), jadi ia
			 * tidak patut menyekat pandangan kamera juga (raycast kamera guna
			 * root yang sama). Tanpa ini, pokok yang lebih tinggi/tebal
			 * daripada gerai mawar lama akan buat kamera "tersekat" menempel
			 * padanya semasa watak berjalan lalu berhampiran. */}
			<group>
				{AMBIENT_ROSE_STALLS.map((stall, i) => (
					<group key={i} position={[stall.x, 0.18, stall.z]} rotation={[0, stall.rot, 0]}>
						<RoseStallProp scale={stall.scale} swayPhase={i * 1.3} />
					</group>
				))}

				{AMBIENT_FLOWERING_TREES.map((tree, i) => (
					<group key={i} position={[tree.x, 0.18, tree.z]} rotation={[0, tree.rot, 0]}>
						<VeilroseFloweringTree scale={tree.scale} swayPhase={i} />
					</group>
				))}

				{AMBIENT_GRASS_TUFTS.map((tuft, i) => (
					<group key={i} position={[tuft.x, 0.18, tuft.z]} rotation={[0, tuft.rot, 0]}>
						<VeilroseGrassTuft scale={tuft.scale} swayPhase={i} />
					</group>
				))}
			</group>

			<group ref={collisionRootRef}>
				<mesh geometry={geometry} receiveShadow={false}>
					<meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.02} />
				</mesh>

				{anchors.map((anchor, index) => (
					<SpotMarker
						key={anchor.id}
						anchor={anchor}
						active={anchor.id === nearSpotId}
						bobOffset={index * 1.4}
						terrainOptions={VEILROSE_TERRAIN}
					/>
				))}
			</group>

			<ZymCharacterController
				anchors={anchors}
				plazaRadius={PLAZA_WALK_RADIUS}
				startPosition={[0, 0, 5.5]}
				glowColor={ZYM_GLOW_COLOR}
				isMobile={isMobile}
				interactionPaused={interactionPaused}
				flying={flying}
				collisionRoot={collisionRootRef}
				terrainOptions={VEILROSE_TERRAIN}
				onNearSpotChange={onNearSpotChange}
				onJoystickChange={onJoystickChange}
			/>
		</>
	);
}
