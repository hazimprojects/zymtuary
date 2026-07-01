import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { createSpheralAmbient } from '../../lib/spheralAmbient';

export type SpheralData = {
	id: string;
	nama: string;
	mood: string;
	penerangan_pendek: string;
	audio_ambien: string;
};

export type EntityData = {
	id: string;
	nama: string;
	gelaran: string;
	keadaan: string;
	bisikan: string;
};

const AMBIEN: Record<string, string> = {
	primisera: '#3d2e1f',
	luminara: '#d4a843',
	noctira: '#5c4a8a',
	ignisara: '#c44d2a',
	nivira: '#8eb8c8',
	equilara: '#b8bcc4',
};

const MOOD_SINGKAT: Record<string, string> = {
	primisera: 'sunyi',
	luminara: 'terbuka',
	noctira: 'melindungi',
	ignisara: 'dorongan',
	nivira: 'hening',
	equilara: 'seimbang',
};

const fadeUp = {
	hidden: { opacity: 0, y: 8 },
	visible: (delay: number) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 2.4, delay, ease: [0.22, 1, 0.36, 1] as const },
	}),
};

function splitLayers(text: string) {
	return text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export default function SpheralExperience({
	spheral,
	entities,
}: {
	spheral: SpheralData;
	entities: EntityData[];
}) {
	const [activeEntity, setActiveEntity] = useState<EntityData | null>(null);
	const color = AMBIEN[spheral.id] ?? '#f5f0e8';
	const moodSingkat = MOOD_SINGKAT[spheral.id] ?? spheral.mood.split(',')[0].trim();
	const layers = useMemo(() => splitLayers(spheral.penerangan_pendek), [spheral.penerangan_pendek]);
	const layerBaseDelay = 1.2;

	useEffect(() => {
		const ambient = createSpheralAmbient(spheral.id);
		let started = false;

		const begin = () => {
			if (started) return;
			started = true;
			void ambient.start();
		};

		begin();

		const onGesture = () => begin();
		document.addEventListener('pointerdown', onGesture, { once: true });

		return () => {
			document.removeEventListener('pointerdown', onGesture);
			ambient.stop();
		};
	}, [spheral.id]);

	return (
		<div className="fixed inset-0 overflow-y-auto bg-black">
			<div
				className="pointer-events-none fixed inset-0 opacity-50"
				style={{
					background: `radial-gradient(ellipse 70% 50% at 50% 35%, ${color}22, transparent 70%)`,
				}}
				aria-hidden
			/>

			<div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-8 pb-24 pt-20">
				<motion.p
					className="text-center text-[0.65rem] uppercase tracking-[0.35em] text-[#f5f0e8]/25"
					variants={fadeUp}
					initial="hidden"
					animate="visible"
					custom={0.4}
				>
					{moodSingkat}
				</motion.p>

				<motion.h1
					className="mt-5 text-center text-2xl font-light tracking-[0.14em] text-[#f5f0e8]/85 md:text-3xl"
					style={{ textShadow: `0 0 48px ${color}44` }}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
					custom={0.9}
				>
					{spheral.nama}
				</motion.h1>

				<div className="mt-12 space-y-6">
					{layers.map((line, index) => (
						<motion.p
							key={line}
							className="text-center text-sm font-light leading-relaxed text-[#f5f0e8]/45 md:text-base"
							variants={fadeUp}
							initial="hidden"
							animate="visible"
							custom={layerBaseDelay + index * 1.8}
						>
							{line}
						</motion.p>
					))}
				</div>

				{entities.length > 0 ? (
					<motion.ul
						className="mt-16 flex flex-col items-center gap-4"
						initial="hidden"
						animate="visible"
						variants={{
							hidden: {},
							visible: {
								transition: {
									staggerChildren: 0.35,
									delayChildren: layerBaseDelay + layers.length * 1.8 + 0.6,
								},
							},
						}}
					>
						{entities.map((entity) => (
							<motion.li
								key={entity.id}
								variants={{
									hidden: { opacity: 0, y: 8 },
									visible: {
										opacity: 1,
										y: 0,
										transition: { duration: 2.4, ease: [0.22, 1, 0.36, 1] },
									},
								}}
							>
								<button
									type="button"
									onClick={() => setActiveEntity(entity)}
									className="group text-sm font-light tracking-wide text-[#f5f0e8]/35 transition-colors duration-700 hover:text-[#f5f0e8]/65"
									style={{
										textShadow:
											activeEntity?.id === entity.id ? `0 0 20px ${color}33` : undefined,
									}}
								>
									{entity.nama}
								</button>
							</motion.li>
						))}
					</motion.ul>
				) : null}

				<AnimatePresence mode="wait">
					{activeEntity ? (
						<motion.div
							key={activeEntity.id}
							className="mt-20 flex flex-col items-center text-center"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 6 }}
							transition={{ duration: 2.8, ease: [0.22, 1, 0.36, 1] }}
						>
							<p className="text-[0.6rem] uppercase tracking-[0.3em] text-[#f5f0e8]/20">
								{activeEntity.gelaran}
							</p>
							<motion.p
								className="mt-6 max-w-sm text-base font-light italic leading-relaxed text-[#f5f0e8]/55 md:text-lg"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 3.2, delay: 0.4, ease: 'easeOut' }}
							>
								&ldquo;{activeEntity.bisikan}&rdquo;
							</motion.p>
						</motion.div>
					) : null}
				</AnimatePresence>

				<p className="sr-only">{spheral.audio_ambien}</p>
			</div>
		</div>
	);
}
