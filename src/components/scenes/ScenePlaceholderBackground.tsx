import { VEILROSE_PALETTE } from '../kawasan/veilrosePalette';

/**
 * Latar sementara (Pilihan C, arahan_peralihan_visual_novel.md §4) — gradien
 * warna dari VEILROSE_PALETTE sahaja, tiada ilustrasi sebenar. Tujuannya
 * semata-mata untuk uji struktur navigasi/hotspot berfungsi betul sebelum
 * ilustrasi sebenar (Pilihan A/B) menggantikannya.
 */
const SCENE_GRADIENTS: Record<string, [string, string]> = {
	'mendari-hub': ['#e8c96a', VEILROSE_PALETTE.cream],
	'veilrose-plaza': [VEILROSE_PALETTE.gold, VEILROSE_PALETTE.cream],
	'veilrose-applause-steps': [VEILROSE_PALETTE.cream, VEILROSE_PALETTE.gold],
	'veilrose-mask-row': [VEILROSE_PALETTE.pink, VEILROSE_PALETTE.gold],
	'veilrose-memory-room': [VEILROSE_PALETTE.purple, VEILROSE_PALETTE.cream],
	'veilrose-back-alley': ['#7a5236', VEILROSE_PALETTE.ash],
	'veilrose-rehearsal-mirrors': [VEILROSE_PALETTE.purple, VEILROSE_PALETTE.pink],
	'veilrose-fallen-petals': [VEILROSE_PALETTE.ash, VEILROSE_PALETTE.driedRose],
};

export function ScenePlaceholderBackground({ sceneId, label }: { sceneId: string; label: string }) {
	const [from, to] = SCENE_GRADIENTS[sceneId] ?? [VEILROSE_PALETTE.gold, VEILROSE_PALETTE.cream];
	return (
		<div
			className="absolute inset-0 flex items-center justify-center"
			style={{ background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` }}
		>
			<span className="font-display px-8 text-center text-2xl font-light tracking-wide text-black/25">
				{label}
			</span>
		</div>
	);
}
