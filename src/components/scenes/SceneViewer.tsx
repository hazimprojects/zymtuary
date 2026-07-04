import { AnimatePresence, motion } from 'framer-motion';
import type { Scene } from './sceneTypes';
import { ScenePlaceholderBackground } from './ScenePlaceholderBackground';

/**
 * Komponen teras navigasi visual-novel — papar satu Scene (latar + hotspot +
 * kapsyen), dengan fade-to-black pendek antara scene (bukan hard cut).
 * Latar sementara guna ScenePlaceholderBackground (Pilihan C); apabila
 * ilustrasi sebenar sedia, gantikan sahaja bahagian itu dengan <img>.
 */
export function SceneViewer({ scene, onNavigate }: { scene: Scene; onNavigate?: (target: string) => void }) {
	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={scene.id}
				className="absolute inset-0"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.4, ease: 'easeInOut' }}
			>
				<ScenePlaceholderBackground sceneId={scene.id} label={scene.namaSpot ?? scene.namaKawasan} />

				{scene.hotspot.map((h) => {
					const className =
						'pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#f5f0e8]/40 bg-black/35 px-4 py-2 font-body text-[0.6rem] uppercase tracking-[0.2em] text-[#f5f0e8]/85 backdrop-blur-sm transition-colors active:bg-black/55';
					const style = { left: `${h.position[0]}%`, top: `${h.position[1]}%` };
					const key = h.href ?? h.target ?? h.label;
					return h.href ? (
						<a key={key} href={h.href} className={className} style={style}>
							{h.label}
						</a>
					) : (
						<button key={key} type="button" onClick={() => h.target && onNavigate?.(h.target)} className={className} style={style}>
							{h.label}
						</button>
					);
				})}

				<AnimatePresence mode="wait">
					{scene.deskripsi ? (
						<motion.div
							key={`deskripsi-${scene.id}`}
							className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2 px-8 text-center"
							style={{ textShadow: '0 2px 16px rgba(20,10,25,0.6)' }}
							initial={{ opacity: 0, y: 14 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 8 }}
							transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
						>
							{scene.namaSpot ? (
								<span className="font-display max-w-sm text-base font-light tracking-wide text-[#f5f0e8]/92 md:text-lg">
									{scene.namaSpot}
								</span>
							) : null}
							<span className="font-body max-w-md text-[0.7rem] italic leading-relaxed text-[#f5f0e8]/55">
								{scene.deskripsi}
							</span>
						</motion.div>
					) : scene.bisikan ? (
						<motion.p
							key={`bisikan-${scene.id}`}
							className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 px-8 text-center font-display text-sm font-light italic leading-relaxed text-[#f5f0e8]/50 md:text-base"
							style={{ textShadow: '0 2px 16px rgba(20,10,25,0.6)' }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 1, duration: 1.4 }}
						>
							&ldquo;{scene.bisikan}&rdquo;
						</motion.p>
					) : null}
				</AnimatePresence>
			</motion.div>
		</AnimatePresence>
	);
}
