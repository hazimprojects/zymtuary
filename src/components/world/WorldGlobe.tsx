import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import {
	FAMILY_COLORS,
	HEMISPHERE_COLORS,
	JOYSTICK_CONFIG,
	type EntityEntry,
	type SpheralRegionId,
	type ZoomMode,
} from './worldGlobeConfig';
import { GlobeScene } from './GlobeScene';
import type { JoystickVisual } from './DescentController';

const SPHERAL_NAMA: Record<SpheralRegionId, string> = {
	luminara: 'Luminara',
	noctira: 'Noctira',
	equilara: 'Equilara',
};

/** Langit dari dalam atmosfera patut biru cair berawan, bukan gelap/kelabu
 * seperti ruang angkasa — hanya orbit jauh yang kekal gelap berbintang. */
const BACKGROUND_BY_MODE: Record<ZoomMode, string> = {
	orbit: '#020408',
	atmosphere: '#0c2338',
	descent: '#8fc4ea',
};

export default function WorldGlobe({ entities }: { entities: EntityEntry[] }) {
	const [hoveredEntity, setHoveredEntity] = useState<EntityEntry | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [isPortrait, setIsPortrait] = useState(false);
	const [ready, setReady] = useState(false);
	const [zoomMode, setZoomMode] = useState<ZoomMode>('orbit');
	const [canvasKey, setCanvasKey] = useState(0);
	const [joystick, setJoystick] = useState<JoystickVisual | null>(null);
	const canvasEl = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener('change', update);
		setReady(true);
		return () => mq.removeEventListener('change', update);
	}, []);

	// Pengalaman ini direka untuk landscape — lebih immersive untuk toleh
	// ~360° dan joystick dua-penjuru. Di mobile, minta pelawat putar peranti.
	useEffect(() => {
		const mq = window.matchMedia('(orientation: portrait)');
		const update = () => setIsPortrait(mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	}, []);

	/** GPU mudah "hilang" konteks WebGL di mobile (latar belakang tab, tekanan memori) —
	 * tanpa ini, planet kekal kosong selama-lamanya sehingga muat semula manual. */
	const handleCanvasCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
		const canvas = gl.domElement;
		canvasEl.current = canvas;
		// `style` pada <Canvas> hanya terpakai pada div pembungkus, bukan elemen
		// <canvas> sebenar yang menerima sentuhan — set terus di sini supaya
		// gerak isyarat asli pelayar (skrol, pinch-zoom halaman) tidak merampas
		// seret/cubit sebelum pengendali penuding kita sempat menerimanya.
		canvas.style.touchAction = 'none';
		canvas.style.overscrollBehavior = 'none';
		const onLost = (e: Event) => e.preventDefault();
		const onRestored = () => setCanvasKey((k) => k + 1);
		canvas.addEventListener('webglcontextlost', onLost, false);
		canvas.addEventListener('webglcontextrestored', onRestored, false);
	}, []);

	/**
	 * Kunci landscape secara automatik supaya pelawat tak perlu putar peranti
	 * sendiri. Screen Orientation Lock API perlu (a) dicetuskan oleh gerak isyarat
	 * pengguna sebenar dan (b) selalunya perlu mod skrin penuh dahulu di pelayar
	 * mobile biasa — jadi ini dipanggil terus dalam pengendali ketik pada overlay
	 * "putar peranti", bukan automatik semasa mount. Kalau tidak disokong (cth.
	 * Safari iOS langsung tiada API ini), gagal senyap dan mesej putar manual
	 * kekal sebagai jalan fallback.
	 */
	const handleRequestLandscape = useCallback(async () => {
		try {
			const el = document.documentElement;
			if (!document.fullscreenElement && el.requestFullscreen) {
				await el.requestFullscreen().catch(() => {});
			}
			const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
			await orientation?.lock?.('landscape');
		} catch {
			// Tidak disokong pada peranti/pelayar ini — biar pelawat putar secara manual.
		}
	}, []);

	const familyColor = hoveredEntity
		? (FAMILY_COLORS[hoveredEntity.keluarga_aetherys] ?? HEMISPHERE_COLORS.equilara)
		: HEMISPHERE_COLORS.equilara;

	const showRotatePrompt = isMobile && isPortrait;

	return (
		<div className="fixed inset-0 bg-[#020408]">
			<div className="absolute inset-0">
				{ready ? (
					<Canvas
						key={canvasKey}
						camera={{ position: [0, 0.05, 6.8], fov: 48, near: 0.08, far: 100 }}
						dpr={isMobile ? [1, 1.75] : [1, 2]}
						gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
						style={{ touchAction: 'none' }}
						onCreated={handleCanvasCreated}
					>
						<color attach="background" args={[BACKGROUND_BY_MODE[zoomMode]]} />
						<Suspense fallback={null}>
							<GlobeScene
								entities={entities}
								onHover={setHoveredEntity}
								hoveredEntity={hoveredEntity}
								isMobile={isMobile}
								interactionPaused={showRotatePrompt}
								onZoomModeChange={setZoomMode}
								onJoystickChange={setJoystick}
							/>
						</Suspense>
					</Canvas>
				) : null}
			</div>

			<div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

			<header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
				<a
					href="/"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/30 transition-colors active:text-[#f5f0e8]/55"
				>
					← Keluar
				</a>
				<p className="font-display mt-8 text-base font-light tracking-[0.18em] text-[#f5f0e8]/45 md:text-lg">
					Equilara
				</p>
			</header>

			<AnimatePresence>
				{hoveredEntity ? (
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
							{hoveredEntity.wilayah ? `${hoveredEntity.kawasan} · ${SPHERAL_NAMA[hoveredEntity.spheral_rumah as SpheralRegionId] ?? hoveredEntity.wilayah}` : 'cahaya dari dalam'}
						</span>
					</motion.div>
				) : null}
			</AnimatePresence>

			<motion.p
				key={zoomMode}
				className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-6 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/28"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: zoomMode === 'orbit' ? 2 : 0.4, duration: 1.8 }}
			>
				{zoomMode === 'descent'
					? 'Seret penjuru bawah untuk bergerak · seret di tempat lain untuk toleh 360° · cubit keluar untuk naik'
					: zoomMode === 'atmosphere'
						? 'Zoom masuk lagi · masuki atmosfera seperti payung terjun'
						: 'Perhatikan cahaya yang menyusup · putar · zoom untuk mendekat'}
			</motion.p>

			{joystick ? (
				<div className="pointer-events-none fixed inset-0 z-30">
					<div
						className="absolute rounded-full border border-[#f5f0e8]/25"
						style={{
							width: JOYSTICK_CONFIG.maxRadius * 2,
							height: JOYSTICK_CONFIG.maxRadius * 2,
							left: joystick.originX - JOYSTICK_CONFIG.maxRadius,
							top: joystick.originY - JOYSTICK_CONFIG.maxRadius,
							background: 'radial-gradient(circle, rgba(245,240,232,0.06), transparent 70%)',
						}}
					/>
					<div
						className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5f0e8]/40"
						style={{
							left: joystick.originX + joystick.dx,
							top: joystick.originY + joystick.dy,
							boxShadow: '0 0 18px rgba(245,240,232,0.35)',
						}}
					/>
				</div>
			) : null}

			<AnimatePresence>
				{showRotatePrompt ? (
					<motion.button
						type="button"
						onClick={handleRequestLandscape}
						className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-black px-10 text-center"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.6 }}
					>
						<motion.span
							className="text-3xl"
							animate={{ rotate: [0, 90, 90, 0] }}
							transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.85, 1] }}
							aria-hidden
						>
							📱
						</motion.span>
						<p className="font-body text-[0.65rem] uppercase tracking-[0.32em] text-[#f5f0e8]/60">
							Ketik untuk masuk landscape
						</p>
						<p className="font-display max-w-xs text-sm font-light leading-relaxed text-[#f5f0e8]/35">
							Equilara paling immersive dalam landscape. Kalau peranti anda tidak menyokong
							putaran automatik, putar secara manual untuk meneruskan.
						</p>
					</motion.button>
				) : null}
			</AnimatePresence>
		</div>
	);
}
