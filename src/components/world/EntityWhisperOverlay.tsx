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
			{/* Kabut — redupkan dunia */}
			<motion.div
				className="fixed inset-0 z-40 bg-black/80 backdrop-blur-[4px]"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 2 }}
				aria-hidden
			/>

			{/* Bisikan — seluruh skrin boleh diketik untuk lepaskan */}
			<motion.button
				type="button"
				className="fixed inset-0 z-50 flex flex-col items-center justify-center px-10 pb-16 pt-24"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 2, ease }}
				onClick={onClose}
				aria-label="Lepaskan bisikan"
			>
				<div className="max-w-md text-center">
					<motion.p
						className="font-body text-[0.55rem] uppercase tracking-[0.42em]"
						style={{ color: `${familyColor}55` }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 2.2, delay: 0.5, ease }}
					>
						{entity.keluarga_aetherys}
					</motion.p>

					<motion.p
						className="font-body mt-6 text-[0.6rem] uppercase tracking-[0.38em] text-[#f5f0e8]/22"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 2.4, delay: 0.8, ease }}
					>
						{entity.gelaran}
					</motion.p>

					<motion.p
						className="font-display mt-10 text-xl font-light italic leading-[1.75] text-[#f5f0e8]/68 md:text-2xl md:leading-relaxed"
						initial={{ opacity: 0, filter: 'blur(10px)' }}
						animate={{ opacity: 1, filter: 'blur(0px)' }}
						transition={{ duration: 3.6, delay: 1.2, ease }}
					>
						&ldquo;{entity.bisikan}&rdquo;
					</motion.p>

					<motion.p
						className="font-display mt-12 text-sm font-light tracking-[0.14em] text-[#f5f0e8]/28"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 2.8, delay: 2.2, ease }}
					>
						{entity.nama}
					</motion.p>

					<motion.p
						className="font-body mt-14 text-[0.55rem] uppercase tracking-[0.32em] text-[#f5f0e8]/18"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 2, delay: 3, ease }}
					>
						{entity.keadaan === 'Dormant' ? 'dormant · echo' : 'distorsis · echo'}
					</motion.p>
				</div>

				<motion.span
					className="font-body absolute bottom-[max(2rem,env(safe-area-inset-bottom))] text-[0.6rem] uppercase tracking-[0.28em] text-[#f5f0e8]/30"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 2, delay: 2.5, ease }}
				>
					ketik untuk lepaskan
				</motion.span>
			</motion.button>
		</>
	);
}
