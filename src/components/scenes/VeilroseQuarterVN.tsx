import { useState } from 'react';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import { SceneViewer } from './SceneViewer';
import { VEILROSE_SCENES, VEILROSE_ENTRY_SCENE } from '../../data/veilroseScenes';

/** Wrapper stateful — pegang scene semasa, navigasi bila hotspot diklik.
 * Gantian penuh untuk VeilroseQuarterWorld (Three.js) yang lama; struktur
 * hierarki (wilayah -> kawasan -> spot) kekal sama, cuma cara paparan
 * bertukar daripada dunia 3D kepada scene 2D statik + hotspot. */
export default function VeilroseQuarterVN() {
	const [sceneId, setSceneId] = useState<string>(VEILROSE_ENTRY_SCENE);
	const scene = VEILROSE_SCENES[sceneId];

	return (
		<div className="fixed inset-0 overflow-hidden bg-black text-[#f5f0e8]">
			<div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

			<header
				className="pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-start gap-1 px-5 pt-[max(1rem,env(safe-area-inset-top))]"
				style={{ textShadow: '0 2px 14px rgba(20,10,25,0.55)' }}
			>
				<a
					href="/wilayah/mendari"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/55 transition-colors active:text-[#f5f0e8]/85"
				>
					← Kembali
				</a>
				<p className="font-display text-sm font-light tracking-[0.18em] text-[#f5f0e8]/60">{scene.namaKawasan}</p>
			</header>

			<SceneViewer scene={scene} onNavigate={setSceneId} />
		</div>
	);
}
