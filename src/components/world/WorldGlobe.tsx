import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
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
		setActiveEntity(entity);
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
					style={{ touchAction: 'none' }}
				>
					<color attach="background" args={['#000000']} />
					<Suspense fallback={null}>
						<GlobeScene
							entities={entities}
							onHover={setHoveredEntity}
							onSelect={handleSelect}
							hoveredEntity={hoveredEntity}
							isMobile={isMobile}
						/>
					</Suspense>
				</Canvas>
			) : null}

			{/* Label hemisfera halus */}
			<div className="pointer-events-none absolute inset-x-0 top-[12vh] flex justify-center px-6">
				<motion.p
					className="font-body text-[0.55rem] uppercase tracking-[0.4em] text-[#f5f0e8]/20"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1.5, duration: 2.5 }}
				>
					Equilara
				</motion.p>
			</div>

			{/* Hover entity */}
			<AnimatePresence>
				{hoveredEntity && !activeEntity ? (
					<motion.div
						key={hoveredEntity.id}
						className="pointer-events-none absolute bottom-24 left-0 right-0 flex flex-col items-center gap-2 px-6"
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
						<span className="font-body text-[0.6rem] uppercase tracking-[0.28em] text-[#f5f0e8]/35">
							{hoveredEntity.gelaran} · {hoveredEntity.keluarga_aetherys}
						</span>
					</motion.div>
				) : null}
			</AnimatePresence>

			{/* Bisikan — echo/memori */}
			<AnimatePresence>
				{activeEntity ? (
					<>
						<motion.div
							className="fixed inset-0 z-20 bg-black/60 backdrop-blur-[2px]"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 1.2 }}
							onClick={() => setActiveEntity(null)}
							aria-hidden
						/>
						<motion.div
							className="fixed inset-0 z-30 flex items-center justify-center px-8"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
						>
							<div className="flex max-w-md flex-col items-center text-center">
								<p
									className="font-body text-[0.55rem] uppercase tracking-[0.4em] text-[#f5f0e8]/25"
									style={{ color: FAMILY_COLORS[activeEntity.keluarga_aetherys] }}
								>
									{activeEntity.keluarga_aetherys}
								</p>
								<h2 className="font-display mt-4 text-2xl font-light tracking-wide text-[#f5f0e8]/90 md:text-3xl">
									{activeEntity.nama}
								</h2>
								<p className="font-body mt-2 text-xs tracking-[0.2em] text-[#f5f0e8]/40">
									{activeEntity.gelaran}
								</p>
								<p className="font-display mt-10 text-lg font-light italic leading-relaxed text-[#f5f0e8]/75 md:text-xl">
									&ldquo;{activeEntity.bisikan}&rdquo;
								</p>
								<p className="font-body mt-8 text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/20">
									{activeEntity.keadaan === 'Dormant' ? 'dormant · echo' : 'distorsis · echo'}
								</p>
							</div>
						</motion.div>
					</>
				) : null}
			</AnimatePresence>

			<motion.p
				className="pointer-events-none absolute bottom-6 left-0 right-0 px-4 text-center font-body text-[0.55rem] uppercase leading-relaxed tracking-[0.22em] text-[#f5f0e8]/25 md:bottom-8 md:text-[0.6rem] md:tracking-[0.35em]"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 2.5, duration: 2 }}
			>
				{isMobile ? 'Putar · cubit · ketik titik cahaya' : 'Putar · ketik titik resonans'}
			</motion.p>
		</div>
	);
}
