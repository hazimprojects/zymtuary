import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { EntityWhisperOverlay } from './EntityWhisperOverlay';
import {
	FAMILY_COLORS,
	HEMISPHERE_COLORS,
	type EntityEntry,
} from './worldGlobeConfig';
import { GlobeScene } from './GlobeScene';

export default function WorldGlobe({ entities }: { entities: EntityEntry[] }) {
	const [hoveredEntity, setHoveredEntity] = useState<EntityEntry | null>(null);
	const [activeEntity, setActiveEntity] = useState<EntityEntry | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener('change', update);
		setReady(true);
		return () => mq.removeEventListener('change', update);
	}, []);

	const handleSelect = useCallback((entity: EntityEntry) => {
		setHoveredEntity(null);
		setActiveEntity(entity);
	}, []);

	const handleClose = useCallback(() => {
		setActiveEntity(null);
	}, []);

	const familyColor = hoveredEntity
		? (FAMILY_COLORS[hoveredEntity.keluarga_aetherys] ?? HEMISPHERE_COLORS.equilara)
		: HEMISPHERE_COLORS.equilara;

	return (
		<div className="fixed inset-0 bg-black">
			{ready ? (
				<Canvas
					camera={{ position: [0, 0.05, 6.8], fov: 50, near: 0.1, far: 100 }}
					dpr={isMobile ? [1, 1.75] : [1, 2]}
					gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
					style={{ touchAction: activeEntity ? 'auto' : 'none' }}
				>
					<color attach="background" args={['#020408']} />
					<Suspense fallback={null}>
						<GlobeScene
							entities={entities}
							onHover={setHoveredEntity}
							onSelect={handleSelect}
							hoveredEntity={hoveredEntity}
							isMobile={isMobile}
							interactionPaused={!!activeEntity}
						/>
					</Suspense>
				</Canvas>
			) : null}

			{/* Navigasi & konteks */}
			<header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<a
					href="/"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/35 transition-colors active:text-[#f5f0e8]/60"
				>
					← Keluar
				</a>
				<div className="text-center">
					<p className="font-display text-lg font-light tracking-[0.12em] text-[#f5f0e8]/75 md:text-xl">
						Equilara
					</p>
					<p className="font-body mt-1 text-[0.6rem] leading-relaxed tracking-[0.12em] text-[#f5f0e8]/40">
						Atmosfera Zymtuary — daratan, laut, dan hutan di bawah langit yang sama
					</p>
				</div>
			</header>

			{/* Label hemisfera */}
			<div className="pointer-events-none absolute inset-x-0 top-[22vh] flex justify-between px-6 md:top-[20vh] md:px-12">
				<p className="font-body text-[0.55rem] uppercase tracking-[0.25em] text-[#d4a843]/35">
					Luminara ↑
				</p>
				<p className="font-body text-[0.55rem] uppercase tracking-[0.25em] text-[#5c4a8a]/35">
					↓ Noctira
				</p>
			</div>

			{/* Hover entity */}
			<AnimatePresence>
				{hoveredEntity && !activeEntity ? (
					<motion.div
						key={hoveredEntity.id}
						className="pointer-events-none absolute bottom-28 left-0 right-0 flex flex-col items-center gap-2 px-6 md:bottom-24"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
					>
						<span
							className="font-display text-xl font-light tracking-[0.12em] text-[#f5f0e8]/85 md:text-2xl"
							style={{ textShadow: `0 0 28px ${familyColor}55`, color: familyColor }}
						>
							{hoveredEntity.nama}
						</span>
						<span className="font-body text-[0.6rem] uppercase tracking-[0.28em] text-[#f5f0e8]/40">
							Ketik untuk dengar bisikan
						</span>
					</motion.div>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{activeEntity ? (
					<EntityWhisperOverlay
						key={activeEntity.id}
						entity={activeEntity}
						onClose={handleClose}
					/>
				) : null}
			</AnimatePresence>

			{!activeEntity ? (
				<motion.p
					className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-5 text-center font-body text-[0.6rem] leading-relaxed tracking-[0.15em] text-[#f5f0e8]/40"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1.5, duration: 2 }}
				>
					Putar dunia · cubit untuk zoom · ketik titik cahaya
				</motion.p>
			) : null}
		</div>
	);
}
