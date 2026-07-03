import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import type { EntityData } from '../entities/SpheralExperience';
import { VeilroseQuarterScene } from './VeilroseQuarterScene';

export default function VeilroseQuarterWorld({ entity }: { entity: EntityData }) {
	const [isMobile, setIsMobile] = useState(false);
	const [ready, setReady] = useState(false);
	const [canvasKey, setCanvasKey] = useState(0);
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener('change', update);
		setReady(true);
		return () => mq.removeEventListener('change', update);
	}, []);

	const handleCanvasCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
		const canvas = gl.domElement;
		canvas.style.touchAction = 'none';
		canvas.style.overscrollBehavior = 'none';
		const onLost = (e: Event) => e.preventDefault();
		const onRestored = () => setCanvasKey((k) => k + 1);
		canvas.addEventListener('webglcontextlost', onLost, false);
		canvas.addEventListener('webglcontextrestored', onRestored, false);
	}, []);

	const spots = entity.spot_utama ?? [];
	const activeSpot = spots.find((s) => s.nama === activeId) ?? null;

	return (
		<div
			className="fixed inset-0 overflow-hidden"
			style={{
				background: `linear-gradient(to bottom, #2c2140 0%, #7a4d55 38%, #d98f56 68%, #f6d999 100%)`,
			}}
		>
			<div className="absolute inset-0">
				{ready ? (
					<Canvas
						key={canvasKey}
						camera={{ position: [0, isMobile ? 12.2 : 12.6, isMobile ? 12.2 : 12.6], fov: isMobile ? 52 : 44, near: 0.1, far: 80 }}
						dpr={isMobile ? [1, 1.75] : [1, 2]}
						gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
						style={{ touchAction: 'none' }}
						onCreated={handleCanvasCreated}
					>
						<Suspense fallback={null}>
							<VeilroseQuarterScene spots={spots} isMobile={isMobile} activeId={activeId} onSelect={setActiveId} />
						</Suspense>
					</Canvas>
				) : null}
			</div>

			<div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

			<header
				className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]"
				style={{ textShadow: '0 2px 14px rgba(20,10,25,0.55)' }}
			>
				<a
					href="/wilayah/mendari"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/55 transition-colors active:text-[#f5f0e8]/85"
				>
					← Kembali ke Mendari
				</a>
				<p className="font-display mt-8 text-base font-light tracking-[0.18em] text-[#f5f0e8]/80 md:text-lg">
					{entity.kawasan}
				</p>
				<p className="mt-1 font-body text-[0.55rem] uppercase tracking-[0.32em] text-[#f5f0e8]/45">
					Mendari · {entity.gelaran}
				</p>
			</header>

			<AnimatePresence mode="wait">
				{activeSpot ? (
					<motion.div
						key={activeSpot.nama}
						className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex flex-col items-center gap-3 px-8 text-center md:bottom-24"
						style={{ textShadow: '0 2px 16px rgba(20,10,25,0.6)' }}
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
					>
						<span className="font-display max-w-sm text-lg font-light tracking-wide text-[#f5f0e8]/92 md:text-xl">
							{activeSpot.nama}
						</span>
						<span className="font-body max-w-md text-[0.75rem] italic leading-relaxed text-[#f5f0e8]/60">
							{activeSpot.deskripsi}
						</span>
					</motion.div>
				) : (
					<motion.p
						key="bisikan"
						className="pointer-events-none absolute inset-x-0 bottom-28 z-20 px-8 text-center font-display text-base font-light italic leading-relaxed text-[#f5f0e8]/55 md:bottom-24 md:text-lg"
						style={{ textShadow: '0 2px 16px rgba(20,10,25,0.6)' }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 1.4, duration: 1.8 }}
					>
						&ldquo;{entity.bisikan}&rdquo;
					</motion.p>
				)}
			</AnimatePresence>

			<motion.p
				className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-6 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/45"
				style={{ textShadow: '0 2px 14px rgba(20,10,25,0.55)' }}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6, duration: 1.8 }}
			>
				{activeId ? 'Ketik semula untuk kembali melihat keseluruhan' : 'Putar · zoom · ketik spot untuk menjelajah'}
			</motion.p>
		</div>
	);
}
