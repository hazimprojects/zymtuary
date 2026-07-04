import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import { JOYSTICK_CONFIG, WILAYAH_PORTALS, type ZoomMode } from './worldGlobeConfig';
import { getSkyColor } from './atmosphereTransition';
import { GlobeScene } from './GlobeScene';
import type { JoystickVisual } from './DescentController';

/** Langit luar Canvas — disegerakkan dengan blend atmosfera dalam scene */
const SPACE_BG = '#020408';

export default function WorldGlobe() {
	const [isMobile, setIsMobile] = useState(false);
	const [isPortrait, setIsPortrait] = useState(false);
	const [ready, setReady] = useState(false);
	const [zoomMode, setZoomMode] = useState<ZoomMode>('orbit');
	const [skyBackground, setSkyBackground] = useState(SPACE_BG);
	const [canvasKey, setCanvasKey] = useState(0);
	const [joystick, setJoystick] = useState<JoystickVisual | null>(null);
	const [nearPortalId, setNearPortalId] = useState<string | null>(null);
	const [diving, setDiving] = useState(false);
	const canvasEl = useRef<HTMLCanvasElement | null>(null);
	const nearPortal = nearPortalId ? WILAYAH_PORTALS[nearPortalId] : null;

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
		canvas.style.touchAction = 'none';
		canvas.style.overscrollBehavior = 'none';
		const onLost = (e: Event) => e.preventDefault();
		const onRestored = () => setCanvasKey((k) => k + 1);
		canvas.addEventListener('webglcontextlost', onLost, false);
		canvas.addEventListener('webglcontextrestored', onRestored, false);
	}, []);

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

	useEffect(() => {
		if (zoomMode !== 'descent') setNearPortalId(null);
	}, [zoomMode]);

	const handleEnterPortal = useCallback(() => {
		if (!nearPortal || diving) return;
		setDiving(true);
		window.setTimeout(() => {
			window.location.href = nearPortal.route;
		}, 620);
	}, [nearPortal, diving]);

	const showRotatePrompt = isMobile && isPortrait;

	const handleAtmosphereBlend = useCallback((blend: number) => {
		setSkyBackground(getSkyColor(blend).getStyle());
	}, []);

	return (
		<div className="fixed inset-0" style={{ backgroundColor: skyBackground }}>
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
						<Suspense fallback={null}>
							<GlobeScene
								isMobile={isMobile}
								interactionPaused={showRotatePrompt}
								onZoomModeChange={setZoomMode}
								onAtmosphereBlendChange={handleAtmosphereBlend}
								onJoystickChange={setJoystick}
								onPortalNear={setNearPortalId}
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
			</header>

			<motion.p
				key={zoomMode}
				className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-6 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/28"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: zoomMode === 'orbit' ? 2 : 0.4, duration: 1.8 }}
			>
				{zoomMode === 'descent'
					? 'Joystick kiri bawah untuk bergerak · seret kanan untuk toleh · cubit dua ibu jari untuk zoom'
					: zoomMode === 'atmosphere'
						? 'Joystick kiri bawah · seret kanan untuk toleh · cubit dua ibu jari untuk zoom'
						: isMobile
							? 'Joystick kiri bawah · seret kanan untuk toleh · cubit dua ibu jari untuk mendekat'
							: 'Putar · zoom untuk mendekat ke permukaan'}
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
				{nearPortal && !diving ? (
					<motion.button
						type="button"
						onClick={handleEnterPortal}
						className="pointer-events-auto fixed bottom-40 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#f5f0e8]/30 bg-black/45 px-6 py-3 backdrop-blur-sm"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 10 }}
						transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
					>
						<span className="font-body text-[0.6rem] uppercase tracking-[0.32em] text-[#f5f0e8]/85">
							◈ Masuk {nearPortal.nama}
						</span>
					</motion.button>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{diving ? (
					<motion.div
						className="pointer-events-none fixed inset-0 z-[75] bg-[#e8c96a]"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.62, ease: 'easeIn' }}
					/>
				) : null}
			</AnimatePresence>

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
							Pengalaman paling immersive dalam landscape. Kalau peranti anda tidak menyokong
							putaran automatik, putar secara manual untuk meneruskan.
						</p>
					</motion.button>
				) : null}
			</AnimatePresence>
		</div>
	);
}
