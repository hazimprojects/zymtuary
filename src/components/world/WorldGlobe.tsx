import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import {
	MOOD_SINGKAT,
	SPHERAL_COLORS,
	type SpheralEntry,
} from './worldGlobeConfig';
import { GlobeScene } from './GlobeScene';

export default function WorldGlobe({ spherals }: { spherals: SpheralEntry[] }) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
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

	const handleSelect = useCallback((id: string) => {
		window.location.href = `/spheral/${id}`;
	}, []);

	const hovered = spherals.find((s) => s.id === hoveredId);

	return (
		<div className="fixed inset-0 bg-black">
			{ready ? (
				<Canvas
					camera={{ position: [0, 0.4, 4.2], fov: 45 }}
					dpr={isMobile ? [1, 1.5] : [1, 2]}
					gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
					style={{ touchAction: 'none' }}
				>
					<color attach="background" args={['#000000']} />
					<Suspense fallback={null}>
						<GlobeScene
							spherals={spherals}
							onHover={setHoveredId}
							onSelect={handleSelect}
							hoveredId={hoveredId}
							isMobile={isMobile}
						/>
					</Suspense>
				</Canvas>
			) : null}

			{/* Label hover */}
			<AnimatePresence>
				{hovered ? (
					<motion.div
						key={hovered.id}
						className="pointer-events-none absolute bottom-24 left-0 right-0 flex flex-col items-center gap-2 px-6"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
					>
						<span
							className="font-display text-2xl font-light tracking-[0.14em] text-[#f5f0e8]/90 md:text-3xl"
							style={{
								textShadow: `0 0 32px ${SPHERAL_COLORS[hovered.id]}66`,
								color: SPHERAL_COLORS[hovered.id],
							}}
						>
							{hovered.nama}
						</span>
						<span className="font-body text-[0.65rem] uppercase tracking-[0.3em] text-[#f5f0e8]/40">
							{MOOD_SINGKAT[hovered.id]}
						</span>
					</motion.div>
				) : null}
			</AnimatePresence>

			{/* Petunjuk halus */}
			<motion.p
				className="pointer-events-none absolute bottom-8 left-0 right-0 text-center font-body text-[0.6rem] uppercase tracking-[0.35em] text-[#f5f0e8]/25"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 2.5, duration: 2 }}
			>
				{isMobile ? 'Sentuh & putar' : 'Putar untuk meneroka'}
			</motion.p>
		</div>
	);
}
