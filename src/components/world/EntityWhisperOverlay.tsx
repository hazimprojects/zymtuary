import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { FAMILY_COLORS, type EntityEntry } from './worldGlobeConfig';

type EntityWhisperOverlayProps = {
	entity: EntityEntry;
	onClose: () => void;
};

export function EntityWhisperOverlay({ entity, onClose }: EntityWhisperOverlayProps) {
	const familyColor = FAMILY_COLORS[entity.keluarga_aetherys] ?? '#c9a96e';

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	return (
		<>
			<motion.button
				type="button"
				className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.4 }}
				onClick={onClose}
				aria-label="Tutup bisikan"
			/>

			<motion.div
				className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-5 pb-10 pt-20 md:items-center md:pb-0"
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 16 }}
				transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
				role="dialog"
				aria-modal="true"
				aria-labelledby="whisper-title"
			>
				<div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[#f5f0e8]/10 bg-[#0a0908]/95 px-6 py-8 shadow-2xl md:px-8 md:py-10">
					<p
						className="font-body text-center text-[0.6rem] uppercase tracking-[0.35em]"
						style={{ color: `${familyColor}99` }}
					>
						{entity.keluarga_aetherys}
					</p>

					<h2
						id="whisper-title"
						className="font-display mt-3 text-center text-2xl font-light tracking-wide text-[#f5f0e8]/95 md:text-3xl"
					>
						{entity.nama}
					</h2>
					<p className="font-body mt-1 text-center text-xs tracking-[0.18em] text-[#f5f0e8]/45">
						{entity.gelaran}
					</p>

					<p className="font-display mt-8 text-center text-base font-light italic leading-relaxed text-[#f5f0e8]/80 md:text-lg">
						&ldquo;{entity.bisikan}&rdquo;
					</p>

					<p className="font-body mt-6 text-center text-[0.55rem] uppercase tracking-[0.28em] text-[#f5f0e8]/30">
						{entity.keadaan === 'Dormant' ? 'dormant · echo' : 'distorsis · echo'}
					</p>

					<button
						type="button"
						onClick={onClose}
						className="font-body mt-8 flex w-full items-center justify-center rounded-full border border-[#f5f0e8]/20 py-3.5 text-sm uppercase tracking-[0.25em] text-[#f5f0e8]/70 transition-colors active:bg-[#f5f0e8]/10 md:mt-10"
					>
						Tutup
					</button>
				</div>
			</motion.div>
		</>
	);
}
