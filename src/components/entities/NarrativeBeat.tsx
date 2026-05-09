import { motion } from 'framer-motion';

type BeatProps = {
	title: string;
	passage: string;
	interactionPrompt?: string;
};

export default function NarrativeBeat({ title, passage, interactionPrompt }: BeatProps) {
	return (
		<motion.div
			className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
		>
			<h1 className="text-xl font-semibold tracking-tight text-amber-100">{title}</h1>
			<p className="leading-relaxed text-zinc-300">{passage}</p>
			{interactionPrompt ? (
				<motion.p
					className="border-l-2 border-amber-500/50 pl-4 text-sm italic text-zinc-400"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.2 }}
				>
					{interactionPrompt}
				</motion.p>
			) : null}
		</motion.div>
	);
}
