import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import { SceneViewer } from './SceneViewer';
import { MENDARI_HUB_SCENE, MENDARI_UPCOMING_KAWASAN } from '../../data/mendariScenes';

/** Hub wilayah Mendari — peta 2D statik dengan satu hotspot berfungsi
 * (Veilrose Quarter) dan label pudar untuk kawasan lain yang belum dibina.
 * Menggantikan WilayahWorld (Three.js) yang lama. */
export default function MendariWilayahVN() {
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
					href="/world"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/55 transition-colors active:text-[#f5f0e8]/85"
				>
					← Kembali
				</a>
				<p className="font-display text-sm font-light tracking-[0.18em] text-[#f5f0e8]/60">
					{MENDARI_HUB_SCENE.namaWilayah}
				</p>
			</header>

			<SceneViewer scene={MENDARI_HUB_SCENE} />

			{MENDARI_UPCOMING_KAWASAN.map((k) => (
				<span
					key={k.nama}
					className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-body text-[0.55rem] uppercase tracking-[0.2em] text-[#f5f0e8]/30"
					style={{ left: `${k.position[0]}%`, top: `${k.position[1]}%` }}
				>
					{k.nama}
				</span>
			))}
		</div>
	);
}
