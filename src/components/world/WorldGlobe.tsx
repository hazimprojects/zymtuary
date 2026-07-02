import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { EntityWhisperOverlay } from './EntityWhisperOverlay';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import {
	FAMILY_COLORS,
	HEMISPHERE_COLORS,
	type EntityEntry,
	type ZoomMode,
} from './worldGlobeConfig';
import { GlobeScene } from './GlobeScene';

export default function WorldGlobe({ entities }: { entities: EntityEntry[] }) {
	const [hoveredEntity, setHoveredEntity] = useState<EntityEntry | null>(null);
	const [activeEntity, setActiveEntity] = useState<EntityEntry | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [ready, setReady] = useState(false);
	const [zoomMode, setZoomMode] = useState<ZoomMode>('orbit');
	const [canvasKey, setCanvasKey] = useState(0);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener('change', update);
		setReady(true);
		return () => mq.removeEventListener('change', update);
	}, []);

	/** GPU mudah "hilang" konteks WebGL di mobile (latar belakang tab, tekanan memori) —
	 * tanpa ini, planet kekal kosong selama-lamanya sehingga muat semula manual. */
	const handleCanvasCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
		const canvas = gl.domElement;
		const onLost = (e: Event) => e.preventDefault();
		const onRestored = () => setCanvasKey((k) => k + 1);
		canvas.addEventListener('webglcontextlost', onLost, false);
		canvas.addEventListener('webglcontextrestored', onRestored, false);
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
		<div className="fixed inset-0 bg-[#020408]">
			<motion.div
				className="absolute inset-0"
				animate={{ filter: activeEntity ? 'brightness(0.22)' : 'brightness(1)' }}
				transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
			>
				{ready ? (
					<Canvas
						key={canvasKey}
						camera={{ position: [0, 0.05, 6.8], fov: 48, near: 0.08, far: 100 }}
						dpr={isMobile ? [1, 1.75] : [1, 2]}
						gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
						style={{ touchAction: activeEntity ? 'auto' : 'none' }}
						onCreated={handleCanvasCreated}
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
							onZoomModeChange={setZoomMode}
						/>
						</Suspense>
					</Canvas>
				) : null}
			</motion.div>

			<div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

			<motion.header
				className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]"
				animate={{ opacity: activeEntity ? 0.12 : 1 }}
				transition={{ duration: 2 }}
			>
				<a
					href="/"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/30 transition-colors active:text-[#f5f0e8]/55"
				>
					← Keluar
				</a>
				<p className="font-display mt-8 text-base font-light tracking-[0.18em] text-[#f5f0e8]/45 md:text-lg">
					Equilara
				</p>
			</motion.header>

			<AnimatePresence>
				{hoveredEntity && !activeEntity ? (
					<motion.div
						key={hoveredEntity.id}
						className="pointer-events-none absolute bottom-28 left-0 right-0 flex flex-col items-center gap-2 px-6 md:bottom-24"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
					>
						<span
							className="font-display text-lg font-light italic tracking-wide text-[#f5f0e8]/55 md:text-xl"
							style={{ textShadow: `0 0 32px ${familyColor}44` }}
						>
							{hoveredEntity.nama}
						</span>
						<span className="font-body text-[0.55rem] uppercase tracking-[0.32em] text-[#f5f0e8]/25">
							bisikan dari dalam
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
					key={zoomMode}
					className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-6 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/28"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: zoomMode === 'orbit' ? 2 : 0.4, duration: 1.8 }}
				>
					{zoomMode === 'descent'
						? 'Anda melayang dalam Equilara · seret untuk pandang ~360° · angkat kepala ke matahari & awan · cubit keluar untuk naik'
						: zoomMode === 'atmosphere'
							? 'Zoom masuk lagi · masuki atmosfera seperti payung terjun'
							: 'Perhatikan cahaya yang menyusup · putar · zoom · ketik di mana ia terasa'}
				</motion.p>
			) : null}
		</div>
	);
}
