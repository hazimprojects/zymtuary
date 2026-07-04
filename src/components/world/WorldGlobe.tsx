import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import { GlobeScene } from './GlobeScene';
import { WILAYAH_PORTALS, type EntityEntry } from './worldGlobeConfig';

const mendariPortal = WILAYAH_PORTALS.mendari;

/** Peta dunia — globe kecil & stylized (BUKAN cubaan mensimulasikan bumi
 * sebenar) yang boleh di-orbit & di-zoom. Bila kamera cukup dekat & menghala
 * ke portal Mendari, muncul prompt untuk masuk ke halaman wilayah 2D
 * (src/pages/wilayah/mendari.astro) — bukan lagi descent 3D penuh seperti
 * dahulu, kerana peringkat wilayah/kawasan kini scene 2D statik. */
export default function WorldGlobe({ entities }: { entities: EntityEntry[] }) {
	const [portalNear, setPortalNear] = useState(false);

	return (
		<div className="fixed inset-0 overflow-hidden bg-black text-[#f5f0e8]">
			<div className="absolute inset-0">
				<Canvas
					camera={{ position: [0, 1.2, 5], fov: 45, near: 0.1, far: 50 }}
					gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
				>
					<Suspense fallback={null}>
						<GlobeScene entities={entities} onPortalProximity={setPortalNear} />
					</Suspense>
				</Canvas>
			</div>

			<div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

			<header
				className="pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-start gap-1 px-5 pt-[max(1rem,env(safe-area-inset-top))]"
				style={{ textShadow: '0 2px 14px rgba(20,10,25,0.55)' }}
			>
				<p className="font-display text-sm font-light tracking-[0.18em] text-[#f5f0e8]/60">Zymtuary</p>
			</header>

			<AnimatePresence>
				{portalNear ? (
					<motion.a
						href={mendariPortal.route}
						className="pointer-events-auto absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#f5f0e8]/40 bg-black/40 px-6 py-3 font-body text-[0.65rem] uppercase tracking-[0.25em] text-[#f5f0e8]/90 backdrop-blur-sm transition-colors active:bg-black/60"
						style={{ marginTop: '9rem' }}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.35, ease: 'easeOut' }}
					>
						Masuk ke {mendariPortal.nama}
					</motion.a>
				) : null}
			</AnimatePresence>

			<motion.p
				className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] px-6 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/40"
				style={{ textShadow: '0 2px 14px rgba(20,10,25,0.55)' }}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6, duration: 1.8 }}
			>
				Seret untuk pusing · cubit/skrol untuk zoom
			</motion.p>
		</div>
	);
}
