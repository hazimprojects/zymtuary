import { motion } from 'framer-motion';

export type SpheralEntry = {
	id: string;
	nama: string;
	mood: string;
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

/** Susunan visual — Primisera di tengah, lima lain mengelilingi */
const LAYOUT_ORDER = [
	{ id: 'luminara', className: 'col-start-1 row-start-1 justify-self-end' },
	{ id: 'noctira', className: 'col-start-3 row-start-1 justify-self-start' },
	{ id: 'ignisara', className: 'col-start-1 row-start-2 justify-self-end' },
	{ id: 'primisera', className: 'col-start-2 row-start-2 justify-self-center' },
	{ id: 'nivira', className: 'col-start-3 row-start-2 justify-self-start' },
	{ id: 'equilara', className: 'col-start-2 row-start-3 justify-self-center' },
] as const;

function SpheralZone({
	spheral,
	color,
	moodSingkat,
	pulseDelay,
}: {
	spheral: SpheralEntry;
	color: string;
	moodSingkat: string;
	pulseDelay: number;
}) {
	return (
		<motion.a
			href={`/spheral/${spheral.id}`}
			className="group relative flex flex-col items-center gap-3 outline-none"
			initial={{ opacity: 0, scale: 0.92 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 2.4, delay: pulseDelay * 0.15, ease: [0.22, 1, 0.36, 1] }}
			aria-label={`${spheral.nama} — ${moodSingkat}`}
		>
			<motion.span
				className="relative block h-20 w-20 rounded-full md:h-24 md:w-24"
				animate={{
					scale: [1, 1.06, 1],
					opacity: [0.55, 0.85, 0.55],
				}}
				transition={{
					duration: 5.5,
					delay: pulseDelay,
					repeat: Infinity,
					ease: 'easeInOut',
				}}
				style={{
					background: `radial-gradient(circle at 38% 32%, ${color}cc, ${color}44 55%, transparent 72%)`,
					boxShadow: `0 0 48px ${color}33, 0 0 96px ${color}18`,
				}}
			>
				<span
					className="absolute inset-2 rounded-full opacity-40 transition-opacity duration-700 group-hover:opacity-70"
					style={{
						background: `radial-gradient(circle, ${color}66, transparent 70%)`,
					}}
				/>
			</motion.span>

			<span className="flex flex-col items-center gap-1">
				<span
					className="text-sm font-light tracking-[0.12em] text-[#f5f0e8]/80 transition-colors duration-700 group-hover:text-[#f5f0e8]"
					style={{ textShadow: `0 0 24px ${color}44` }}
				>
					{spheral.nama}
				</span>
				<span className="text-[0.65rem] uppercase tracking-[0.25em] text-[#f5f0e8]/35">
					{moodSingkat}
				</span>
			</span>
		</motion.a>
	);
}

export default function WorldMap({ spherals }: { spherals: SpheralEntry[] }) {
	const byId = Object.fromEntries(spherals.map((s) => [s.id, s]));

	return (
		<div className="fixed inset-0 flex items-center justify-center bg-black px-6 py-16">
			<div className="grid w-full max-w-lg grid-cols-3 grid-rows-3 items-center justify-items-center gap-y-10 gap-x-4 md:max-w-2xl md:gap-y-14 md:gap-x-8">
				{LAYOUT_ORDER.map(({ id, className }, index) => {
					const spheral = byId[id];
					if (!spheral) return null;

					return (
						<div key={id} className={className}>
							<SpheralZone
								spheral={spheral}
								color={AMBIEN[id]}
								moodSingkat={MOOD_SINGKAT[id]}
								pulseDelay={index * 0.9}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}
