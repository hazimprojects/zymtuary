import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';

export type SpheralData = {
	id: string;
	nama: string;
	mood: string;
	penerangan_pendek: string;
	audio_ambien: string;
};

export type SpotUtamaData = {
	nama: string;
	deskripsi: string;
};

export type WilayahData = {
	id: string;
	nama: string;
	keluarga_aetherys: string | null;
	warna: string;
	deskripsi: string;
	nota_atmosfera: string | null;
};

export type EntityData = {
	id: string;
	nama: string;
	gelaran: string;
	keadaan: string;
	bisikan: string;
	wilayah?: string;
	kawasan?: string;
	kawasan_deskripsi?: string;
	spot_utama?: SpotUtamaData[];
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
	wilayah = [],
}: {
	spheral: SpheralData;
	entities: EntityData[];
	wilayah?: WilayahData[];
}) {
	const [activeEntity, setActiveEntity] = useState<EntityData | null>(null);
	const color = AMBIEN[spheral.id] ?? '#f5f0e8';
	const moodSingkat = MOOD_SINGKAT[spheral.id] ?? spheral.mood.split(',')[0].trim();
	const layers = useMemo(() => splitLayers(spheral.penerangan_pendek), [spheral.penerangan_pendek]);
	const layerBaseDelay = 1.2;

	const groups = useMemo(() => {
		if (wilayah.length === 0) return null;
		return wilayah
			.map((w) => ({ wilayah: w, entities: entities.filter((e) => e.wilayah === w.id) }))
			.filter((g) => g.entities.length > 0);
	}, [wilayah, entities]);

	return (
		<div className="fixed inset-0 overflow-y-auto bg-black">
			<div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

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

				{groups && groups.length > 0 ? (
					<div className="mt-16 flex w-full flex-col items-center gap-12">
						{groups.map((group, groupIndex) => (
							<motion.div
								key={group.wilayah.id}
								className="flex flex-col items-center gap-4"
								initial="hidden"
								animate="visible"
								variants={{
									hidden: {},
									visible: {
										transition: {
											staggerChildren: 0.3,
											delayChildren:
												layerBaseDelay + layers.length * 1.8 + 0.6 + groupIndex * 0.6,
										},
									},
								}}
							>
								<motion.p
									className="text-center text-[0.6rem] uppercase tracking-[0.3em]"
									style={{ color: group.wilayah.warna }}
									variants={{
										hidden: { opacity: 0, y: 6 },
										visible: { opacity: 0.65, y: 0, transition: { duration: 2 } },
									}}
								>
									{group.wilayah.id === 'mendari' ? (
										<a href="/wilayah/mendari" className="underline-offset-4 hover:underline">
											{group.wilayah.nama} · masuki wilayah →
										</a>
									) : (
										group.wilayah.nama
									)}
								</motion.p>
								<ul className="flex flex-col items-center gap-4">
									{group.entities.map((entity) => (
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
								</ul>
							</motion.div>
						))}
					</div>
				) : entities.length > 0 ? (
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

							{activeEntity.kawasan ? (
								<motion.div
									className="mt-10 max-w-sm border-t border-[#f5f0e8]/10 pt-6"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 2, delay: 1.2 }}
								>
									<p className="text-[0.55rem] uppercase tracking-[0.32em] text-[#f5f0e8]/25">
										{activeEntity.kawasan}
									</p>
									{activeEntity.kawasan_deskripsi ? (
										<p className="mt-3 text-xs font-light leading-relaxed text-[#f5f0e8]/35">
											{activeEntity.kawasan_deskripsi}
										</p>
									) : null}
									{activeEntity.spot_utama && activeEntity.spot_utama.length > 0 ? (
										<ul className="mt-4 space-y-1.5">
											{activeEntity.spot_utama.map((spot) => (
												<li key={spot.nama} className="text-[0.7rem] italic text-[#f5f0e8]/30">
													{spot.nama}
												</li>
											))}
										</ul>
									) : null}
								</motion.div>
							) : null}
						</motion.div>
					) : null}
				</AnimatePresence>

				<p className="sr-only">{spheral.audio_ambien}</p>
			</div>
		</div>
	);
}
