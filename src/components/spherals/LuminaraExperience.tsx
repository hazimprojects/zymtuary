import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { EntityData, SpheralData } from '../entities/SpheralExperience';
import LuminaraParticles from './LuminaraParticles';

const GOLD = '#d4a843';
const GOLD_SOFT = '#f5d78e';

/** Kedudukan organik — peratus viewport */
const ENTITY_LAYOUT: { x: number; y: number }[] = [
	{ x: 18, y: 68 },
	{ x: 38, y: 78 },
	{ x: 58, y: 72 },
	{ x: 78, y: 80 },
	{ x: 88, y: 64 },
	{ x: 28, y: 88 },
	{ x: 50, y: 92 },
	{ x: 72, y: 88 },
	{ x: 82, y: 74 },
];

const breathe = {
	hidden: { opacity: 0, filter: 'blur(10px)' },
	visible: (delay: number) => ({
		opacity: 1,
		filter: 'blur(0px)',
		transition: { duration: 3.2, delay, ease: [0.22, 1, 0.36, 1] as const },
	}),
};

function splitLayers(text: string) {
	return text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export default function LuminaraExperience({
	spheral,
	entities,
}: {
	spheral: SpheralData;
	entities: EntityData[];
}) {
	const [activeEntity, setActiveEntity] = useState<EntityData | null>(null);
	const layers = useMemo(() => splitLayers(spheral.penerangan_pendek), [spheral.penerangan_pendek]);
	const layerBase = 2.4;

	return (
		<div className="luminara-world fixed inset-0 overflow-hidden bg-black">
			{/* Cahaya menyusup — bloom masuk */}
			<motion.div
				className="pointer-events-none absolute inset-0 z-0"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 5.5, ease: [0.22, 1, 0.36, 1] }}
				aria-hidden
			>
				<div className="luminara-bloom absolute inset-0" />
				<div className="luminara-edge absolute inset-0" />
			</motion.div>

			<LuminaraParticles />

			{/* Redup apabila bisikan aktif */}
			<AnimatePresence>
				{activeEntity ? (
					<motion.div
						className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[2px]"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 2.4 }}
						onClick={() => setActiveEntity(null)}
						aria-hidden
					/>
				) : null}
			</AnimatePresence>

			{/* Tajuk & penerangan */}
			<div className="relative z-10 flex min-h-dvh flex-col items-center px-8 pt-[18vh]">
				<motion.p
					className="font-body text-[0.6rem] uppercase tracking-[0.45em] text-[#f5f0e8]/20"
					variants={breathe}
					initial="hidden"
					animate="visible"
					custom={1}
				>
					terbuka
				</motion.p>

				<motion.h1
					className="font-display mt-6 text-center text-4xl font-light tracking-[0.08em] text-[#f5f0e8]/90 md:text-5xl"
					style={{ textShadow: `0 0 60px ${GOLD}55, 0 0 120px ${GOLD}22` }}
					variants={breathe}
					initial="hidden"
					animate="visible"
					custom={1.8}
				>
					{spheral.nama}
				</motion.h1>

				<div className="mt-14 max-w-sm space-y-7">
					{layers.map((line, index) => (
						<motion.p
							key={line}
							className="font-body text-center text-sm font-light leading-[1.9] text-[#f5f0e8]/42 md:text-[0.95rem]"
							variants={breathe}
							initial="hidden"
							animate="visible"
							custom={layerBase + index * 2.2}
						>
							{line}
						</motion.p>
					))}
				</div>
			</div>

			{/* Entiti — titik cahaya dalam kabut */}
			<div className="pointer-events-none fixed inset-0 z-10">
				{entities.map((entity, index) => {
					const pos = ENTITY_LAYOUT[index] ?? { x: 50, y: 75 };
					const isActive = activeEntity?.id === entity.id;
					const isDimmed = activeEntity && !isActive;

					return (
						<motion.div
							key={entity.id}
							className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
							style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{
								opacity: isDimmed ? 0.12 : 1,
								scale: isActive ? 1.15 : 1,
							}}
							transition={{
								duration: 3,
								delay: layerBase + layers.length * 2.2 + index * 0.55,
								ease: [0.22, 1, 0.36, 1],
							}}
						>
							<button
								type="button"
								onClick={() => setActiveEntity(isActive ? null : entity)}
								className="group flex flex-col items-center gap-2.5 outline-none"
								aria-label={entity.nama}
							>
								<motion.span
									className="block h-2 w-2 rounded-full"
									animate={{
										boxShadow: [
											`0 0 12px ${GOLD}66, 0 0 24px ${GOLD}33`,
											`0 0 18px ${GOLD_SOFT}88, 0 0 36px ${GOLD}44`,
											`0 0 12px ${GOLD}66, 0 0 24px ${GOLD}33`,
										],
									}}
									transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
									style={{ background: `radial-gradient(circle, ${GOLD_SOFT}, ${GOLD})` }}
								/>
								<span
									className="font-body text-[0.65rem] tracking-[0.08em] transition-colors duration-700 group-hover:text-[#f5f0e8]/55"
									style={{ color: isActive ? `${GOLD_SOFT}cc` : 'rgba(245,240,232,0.28)' }}
								>
									{entity.nama}
								</span>
							</button>
						</motion.div>
					);
				})}
			</div>

			{/* Bisikan */}
			<AnimatePresence mode="wait">
				{activeEntity ? (
					<motion.div
						key={activeEntity.id}
						className="fixed inset-0 z-30 flex items-center justify-center px-10"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 2 }}
					>
						<div className="max-w-md text-center">
							<motion.p
								className="font-body text-[0.55rem] uppercase tracking-[0.4em] text-[#f5f0e8]/18"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 2.4, delay: 0.6 }}
							>
								{activeEntity.gelaran}
							</motion.p>
							<motion.p
								className="font-display mt-8 text-xl font-light italic leading-relaxed text-[#f5f0e8]/62 md:text-2xl"
								initial={{ opacity: 0, filter: 'blur(8px)' }}
								animate={{ opacity: 1, filter: 'blur(0px)' }}
								transition={{ duration: 3.6, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
							>
								&ldquo;{activeEntity.bisikan}&rdquo;
							</motion.p>
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>

			<p className="sr-only">{spheral.audio_ambien}</p>
		</div>
	);
}
