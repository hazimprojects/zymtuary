import { motion } from 'framer-motion';
import ImmersiveRefresh from '../ui/ImmersiveRefresh';

type EntranceExperienceProps = {
	gardenKeeperLine: string;
	enterHref?: string;
};

const fade = {
	hidden: { opacity: 0, y: 6 },
	visible: (delay: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			duration: 2.2,
			delay,
			ease: [0.22, 1, 0.36, 1] as const,
		},
	}),
};

export default function EntranceExperience({
	gardenKeeperLine,
	enterHref = '/world',
}: EntranceExperienceProps) {
	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center bg-black px-8">
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
				<ImmersiveRefresh className="pointer-events-auto" />
			</div>

			<div className="flex max-w-md flex-col items-center text-center">
				<motion.p
					className="text-lg font-light tracking-wide text-[#f5f0e8] md:text-xl"
					variants={fade}
					initial="hidden"
					animate="visible"
					custom={0.8}
				>
					Selamat datang, Zym.
				</motion.p>

				<motion.p
					className="mt-10 text-sm font-light leading-relaxed text-[#f5f0e8]/70 md:text-base"
					variants={fade}
					initial="hidden"
					animate="visible"
					custom={3.6}
				>
					{gardenKeeperLine}
				</motion.p>

				<motion.div
					className="mt-16"
					variants={fade}
					initial="hidden"
					animate="visible"
					custom={6.4}
				>
					<a
						href={enterHref}
						className="group relative inline-block px-2 py-3 text-sm tracking-[0.2em] text-[#f5f0e8]/50 transition-colors duration-700 hover:text-[#c9a96e]/60"
					>
						<span className="relative z-10 uppercase">Masuk</span>
						<span
							aria-hidden
							className="absolute inset-x-0 bottom-2 mx-auto h-px w-0 bg-[#c9a96e]/30 transition-all duration-700 group-hover:w-full"
						/>
					</a>
				</motion.div>
			</div>
		</div>
	);
}
