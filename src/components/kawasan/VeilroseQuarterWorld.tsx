import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import type { EntityData } from '../entities/SpheralExperience';
import { GAME_CONTROL_CONFIG } from './gameControlConfig';
import { VeilroseQuarterScene } from './VeilroseQuarterScene';
import type { ZymJoystickVisual } from './ZymCharacterController';

export default function VeilroseQuarterWorld({ entity }: { entity: EntityData }) {
	const [isMobile, setIsMobile] = useState(false);
	const [isPortrait, setIsPortrait] = useState(false);
	const [ready, setReady] = useState(false);
	const [canvasKey, setCanvasKey] = useState(0);
	const [nearSpotId, setNearSpotId] = useState<string | null>(null);
	const [joystick, setJoystick] = useState<ZymJoystickVisual | null>(null);
	const [flying, setFlying] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener('change', update);
		setReady(true);
		return () => mq.removeEventListener('change', update);
	}, []);

	// Watak Zym dikawal dengan joystick dua-penjuru — sama macam descent globe,
	// pengalaman ini perlukan landscape supaya lebih immersive & selesa.
	useEffect(() => {
		const mq = window.matchMedia('(orientation: portrait)');
		const update = () => setIsPortrait(mq.matches);
		update();
		mq.addEventListener('change', update);
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

	const spots = entity.spot_utama ?? [];
	const nearSpot = spots.find((s) => s.nama === nearSpotId) ?? null;
	const showRotatePrompt = isMobile && isPortrait;

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
						camera={{ position: [0, 3.5, 9], fov: isMobile ? 55 : 48, near: 0.1, far: 80 }}
						dpr={isMobile ? [1, 1.75] : [1, 2]}
						gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
						style={{ touchAction: 'none' }}
						onCreated={handleCanvasCreated}
					>
						<Suspense fallback={null}>
							<VeilroseQuarterScene
								spots={spots}
								isMobile={isMobile}
								interactionPaused={showRotatePrompt}
								nearSpotId={nearSpotId}
								flying={flying}
								onNearSpotChange={setNearSpotId}
								onJoystickChange={setJoystick}
							/>
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
				{nearSpot ? (
					<motion.div
						key={nearSpot.nama}
						className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex flex-col items-center gap-3 px-8 text-center md:bottom-24"
						style={{ textShadow: '0 2px 16px rgba(20,10,25,0.6)' }}
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
					>
						<span className="font-display max-w-sm text-lg font-light tracking-wide text-[#f5f0e8]/92 md:text-xl">
							{nearSpot.nama}
						</span>
						<span className="font-body max-w-md text-[0.75rem] italic leading-relaxed text-[#f5f0e8]/60">
							{nearSpot.deskripsi}
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
				{flying
					? 'Melayang — kiri: joystick gerak · kanan: toleh kamera'
					: 'Kiri: sentuh & seret untuk berjalan · kanan: seret untuk toleh kamera 360°'}
			</motion.p>

			<button
				type="button"
				onClick={() => setFlying((f) => !f)}
				aria-label={flying ? 'Mendarat' : 'Terbang'}
				className="pointer-events-auto fixed bottom-8 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#f5f0e8]/30 bg-black/45 text-xl backdrop-blur-sm transition-colors active:bg-black/60"
			>
				<span aria-hidden>{flying ? '✊' : '🖐️'}</span>
			</button>

			{joystick ? (
				<div className="pointer-events-none fixed inset-0 z-30">
					<div
						className="absolute rounded-full transition-colors"
						style={{
							width: GAME_CONTROL_CONFIG.maxRadius * 2,
							height: GAME_CONTROL_CONFIG.maxRadius * 2,
							left: joystick.originX - GAME_CONTROL_CONFIG.maxRadius,
							top: joystick.originY - GAME_CONTROL_CONFIG.maxRadius,
							border: '1px solid rgba(245,240,232,0.25)',
							background: 'radial-gradient(circle, rgba(245,240,232,0.06), transparent 70%)',
						}}
					/>
					<div
						className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
						style={{
							left: joystick.originX + joystick.dx,
							top: joystick.originY + joystick.dy,
							background: 'rgba(245,240,232,0.4)',
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
							Veilrose Quarter paling immersive dalam landscape. Kalau peranti anda tidak menyokong
							putaran automatik, putar secara manual untuk meneruskan.
						</p>
					</motion.button>
				) : null}
			</AnimatePresence>
		</div>
	);
}
