import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';
import type { EntityData, WilayahData } from '../entities/SpheralExperience';
import { WilayahScene } from './WilayahScene';
import { GAME_CONTROL_CONFIG } from '../kawasan/gameControlConfig';
import type { ZymJoystickVisual } from '../kawasan/ZymCharacterController';

/** Kawasan yang sudah ada scene detail sendiri. */
const KAWASAN_ROUTES: Record<string, string> = {
	zymelisse: '/kawasan/veilrose-quarter',
};

export default function WilayahWorld({
	wilayah,
	entities,
}: {
	wilayah: WilayahData;
	entities: EntityData[];
}) {
	const [isMobile, setIsMobile] = useState(false);
	const [isPortrait, setIsPortrait] = useState(false);
	const [ready, setReady] = useState(false);
	const [canvasKey, setCanvasKey] = useState(0);
	const [nearSpotId, setNearSpotId] = useState<string | null>(null);
	const [joystick, setJoystick] = useState<ZymJoystickVisual | null>(null);
	const [flying, setFlying] = useState(true);
	const [diving, setDiving] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener('change', update);
		setReady(true);
		return () => mq.removeEventListener('change', update);
	}, []);

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
			if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen().catch(() => {});
			const ori = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
			await ori?.lock?.('landscape');
		} catch { /* Tidak disokong */ }
	}, []);

	const handleEnterKawasan = useCallback(() => {
		if (!nearSpotId || diving) return;
		const route = KAWASAN_ROUTES[nearSpotId];
		if (!route) return;
		setDiving(true);
		window.setTimeout(() => { window.location.href = route; }, 620);
	}, [nearSpotId, diving]);

	const nearEntity = entities.find((e) => e.id === nearSpotId) ?? null;
	const nearRoute = nearSpotId ? KAWASAN_ROUTES[nearSpotId] : null;
	const showRotatePrompt = isMobile && isPortrait;

	return (
		<div
			className="fixed inset-0 overflow-hidden"
			style={{ background: `linear-gradient(to bottom, #2c2140 0%, #7a4d55 38%, #d98f56 68%, #f6d999 100%)` }}
		>
			<div className="absolute inset-0">
				{ready ? (
					<Canvas
						key={canvasKey}
						camera={{
							position: [0, 2.0, 4.0],
							fov: isMobile ? GAME_CONTROL_CONFIG.baseFovMobile : GAME_CONTROL_CONFIG.baseFovDesktop,
							near: 0.1,
							far: 80,
						}}
						dpr={isMobile ? [1, 1.75] : [1, 2]}
						gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
						style={{ touchAction: 'none' }}
						onCreated={handleCanvasCreated}
					>
						<Suspense fallback={null}>
							<WilayahScene
								wilayah={wilayah}
								entities={entities}
								isMobile={isMobile}
								interactionPaused={showRotatePrompt}
								flying={flying}
								nearSpotId={nearSpotId}
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
					href="/world"
					className="pointer-events-auto font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/55 transition-colors active:text-[#f5f0e8]/85"
				>
					← Kembali ke Globe
				</a>
				<p className="font-display mt-8 text-base font-light tracking-[0.18em] text-[#f5f0e8]/80 md:text-lg">
					{wilayah.nama}
				</p>
			</header>

			{/* Spot reveal apabila Zym hampir — bisikan + nama kawasan */}
			<AnimatePresence mode="wait">
				{nearEntity ? (
					<motion.div
						key={nearEntity.id}
						className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex flex-col items-center gap-3 px-8 text-center md:bottom-24"
						style={{ textShadow: '0 2px 16px rgba(20,10,25,0.6)' }}
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
					>
						<span className="font-body text-[0.55rem] uppercase tracking-[0.32em] text-[#f5f0e8]/60">
							{nearEntity.kawasan} · {nearEntity.gelaran}
						</span>
						<span className="font-display max-w-sm text-lg font-light italic leading-relaxed text-[#f5f0e8]/92 md:text-xl">
							&ldquo;{nearEntity.bisikan}&rdquo;
						</span>
					</motion.div>
				) : (
					<motion.p
						key="idle"
						className="pointer-events-none absolute inset-x-0 bottom-28 z-20 px-8 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/45 md:bottom-24"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 1.4, duration: 1.8 }}
					>
						{wilayah.nama} · Mendekati kawasan untuk menjelajah
					</motion.p>
				)}
			</AnimatePresence>

			{/* Butang masuk kawasan — muncul bila cukup dekat */}
			<AnimatePresence>
				{nearRoute && !diving ? (
					<motion.button
						type="button"
						onClick={handleEnterKawasan}
						className="pointer-events-auto fixed bottom-28 right-6 z-40 flex items-center gap-2 rounded-full border border-[#f5f0e8]/30 bg-black/50 px-5 py-2.5 font-body text-[0.65rem] uppercase tracking-[0.22em] text-[#f5f0e8]/85 backdrop-blur-sm transition-colors active:bg-black/70"
						initial={{ opacity: 0, scale: 0.92 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.88 }}
						transition={{ duration: 0.4 }}
					>
						Masuk →
					</motion.button>
				) : null}
			</AnimatePresence>

			{/* Petunjuk kawalan bawah */}
			<motion.p
				className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-6 text-center font-body text-[0.55rem] leading-relaxed tracking-[0.2em] text-[#f5f0e8]/45"
				style={{ textShadow: '0 2px 14px rgba(20,10,25,0.55)' }}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6, duration: 1.8 }}
			>
				{flying
					? 'Melayang — kiri: joystick arah · kanan: toleh kamera'
					: 'Kiri: joystick arah jalan · kanan: seret toleh kamera 360°'}
			</motion.p>

			{/* Butang terbang */}
			<button
				type="button"
				onClick={() => setFlying((f) => !f)}
				aria-label={flying ? 'Mendarat' : 'Terbang'}
				className="pointer-events-auto fixed bottom-8 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#f5f0e8]/30 bg-black/45 text-xl backdrop-blur-sm transition-colors active:bg-black/60"
			>
				<span aria-hidden>{flying ? '✊' : '🖐️'}</span>
			</button>

			{/* Joystick visual overlay */}
			{joystick ? (
				<div className="pointer-events-none fixed inset-0 z-30">
					<div
						className="absolute rounded-full"
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

			{/* Overlay portrait → landscape */}
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
							Mendari paling immersive dalam landscape.
						</p>
					</motion.button>
				) : null}
			</AnimatePresence>

			{/* Fade semasa dive ke kawasan */}
			<AnimatePresence>
				{diving ? (
					<motion.div
						className="pointer-events-none fixed inset-0 z-[75] bg-[#e8618f]"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.62, ease: 'easeIn' }}
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
}
