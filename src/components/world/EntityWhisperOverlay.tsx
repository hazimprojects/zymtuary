import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { FAMILY_COLORS, type EntityEntry } from './worldGlobeConfig';

type EntityWhisperOverlayProps = {
	entity: EntityEntry;
	onClose: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

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
			<motion.div
				className="fixed inset-0 z-40 bg-black/88 backdrop-blur-md"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 1.6 }}
				aria-hidden
			/>

			<motion.button
				type="button"
				className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 pb-16 pt-20"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 1.8, ease }}
				onClick={onClose}
				aria-label="Lepaskan bisikan"
			>
				<div className="max-w-sm text-center">
					<motion.p
						className="font-body text-[0.6rem] uppercase tracking-[0.38em]"
						style={{ color: familyColor }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 0.7 }}
						transition={{ duration: 1.8, delay: 0.3, ease }}
					>
						{entity.keluarga_aetherys}
					</motion.p>

					<motion.p
						className="font-body mt-5 text-[0.65rem] uppercase tracking-[0.32em] text-[#f5f0e8]/45"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 1.8, delay: 0.5, ease }}
					>
						{entity.gelaran}
					</motion.p>

					<motion.p
						className="font-display mt-9 text-[1.35rem] font-light italic leading-[1.7] text-[#f5f0e8]/88 md:text-2xl md:leading-relaxed"
						style={{ textShadow: `0 0 40px ${familyColor}33` }}
						initial={{ opacity: 0, filter: 'blur(8px)' }}
						animate={{ opacity: 1, filter: 'blur(0px)' }}
						transition={{ duration: 2.8, delay: 0.8, ease }}
					>
						&ldquo;{entity.bisikan}&rdquo;
					</motion.p>

					<motion.p
						className="font-display mt-10 text-base font-light tracking-[0.1em] text-[#f5f0e8]/50"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 2, delay: 1.6, ease }}
					>
						{entity.nama}
					</motion.p>
				</div>

				<motion.span
					className="font-body absolute bottom-[max(2rem,env(safe-area-inset-bottom))] text-[0.6rem] uppercase tracking-[0.28em] text-[#f5f0e8]/40"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 1.5, delay: 2, ease }}
				>
					ketik untuk lepaskan
				</motion.span>
			</motion.button>
		</>
	);
}
