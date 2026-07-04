import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SpotUtama } from '../world/worldGlobeConfig';
import {
	layoutVeilroseAnchors,
	layoutBuildingColliders,
	AMBIENT_ROSE_STALLS,
	AMBIENT_FLOWERING_TREES,
	AMBIENT_GRASS_TUFTS,
	ALLEY_FLAG_LINES,
	ALLEY_CORNER_DECOR,
	VEILROSE_ISLAND_RADIUS,
	VEILROSE_SPAWN,
} from './veilroseQuarterLayout';
import { buildVeilroseQuarterGeometry } from './veilroseQuarterTerrain';
import {
	VeilroseQuarterBuildings,
	VeilroseAlleyPavements,
	VeilroseCitySilhouettes,
	VeilroseStreetMouths,
} from './veilroseBuildings';
import { SpotMarker } from './SpotMarker';
import { RoseStallProp } from './veilroseLandmarks';
import { VeilroseGrassTuft, VeilroseFloweringTree, VeilroseAlleyFlagLine, VeilroseAlleyCornerDecor } from './veilroseDecor';
import { VEILROSE_PALETTE } from './veilrosePalette';
import { ZymCharacterController, type ZymJoystickVisual } from './ZymCharacterController';

const BASE_GROUND_COLOR = VEILROSE_PALETTE.gold;
const ZYM_GLOW_COLOR = '#d4a843';
const PLAZA_WALK_RADIUS = VEILROSE_ISLAND_RADIUS * 0.98;
const VEILROSE_TERRAIN = {
	terrainProfile: 'veilrose-quarter' as const,
	heartStepTierHeight: 0.28,
	heartStepRadius: 1.75,
	islandRadius: VEILROSE_ISLAND_RADIUS,
};

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
	const spotAnchors = useMemo(() => layoutVeilroseAnchors(spots), [spots]);
	const buildingColliders = useMemo(() => layoutBuildingColliders(), []);
	const allObstacleAnchors = useMemo(
		() => [...spotAnchors, ...buildingColliders],
		[spotAnchors, buildingColliders],
	);
	const geometry = useMemo(
		() =>
			buildVeilroseQuarterGeometry(
				spotAnchors,
				BASE_GROUND_COLOR,
				VEILROSE_TERRAIN.heartStepRadius,
				VEILROSE_TERRAIN.heartStepTierHeight,
			),
		[spotAnchors],
	);
	const collisionRootRef = useRef<THREE.Group>(null);

	return (
		<>
			<fog attach="fog" args={[BASE_GROUND_COLOR, 12, 58]} />
			<hemisphereLight args={['#fbe2a8', '#5a3d2a', 0.85]} />
			<directionalLight position={[-4, 3.5, 2]} intensity={1.3} color="#ffd9a0" />
			<ambientLight intensity={0.25} color={BASE_GROUND_COLOR} />

			<VeilroseCitySilhouettes />

			{/* Hiasan ambien tanpa perlanggaran */}
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

				{ALLEY_FLAG_LINES.map((line, i) => (
					<VeilroseAlleyFlagLine key={i} from={line.from} to={line.to} phase={i} />
				))}

				{ALLEY_CORNER_DECOR.map((d, i) => (
					<group key={i} position={[d.x, 0.18, d.z]} rotation={[0, d.rot, 0]}>
						<VeilroseAlleyCornerDecor kind={d.kind} />
					</group>
				))}
			</group>

			<group ref={collisionRootRef}>
				<mesh geometry={geometry} receiveShadow={false}>
					<meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.02} />
				</mesh>

				<VeilroseAlleyPavements />
				<VeilroseQuarterBuildings />
				<VeilroseStreetMouths />

				{spotAnchors.map((anchor, index) => (
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
				anchors={allObstacleAnchors}
				plazaRadius={PLAZA_WALK_RADIUS}
				startPosition={VEILROSE_SPAWN}
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
