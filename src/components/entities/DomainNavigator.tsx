import { motion } from 'framer-motion';

export type DomainEntry = {
	slug: string;
	title: string;
	tagline: string;
	path: string;
};

const list = {
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.08, delayChildren: 0.06 },
	},
	hidden: { opacity: 0 },
};

const item = {
	visible: { opacity: 1, y: 0 },
	hidden: { opacity: 0, y: 10 },
};

export default function DomainNavigator({ domains }: { domains: DomainEntry[] }) {
	return (
		<motion.nav
			className="mx-auto max-w-lg px-4"
			initial="hidden"
			animate="visible"
			variants={list}
			aria-label="Domains of the mythos"
		>
			<ul className="flex flex-col gap-3">
				{domains.map((d) => (
					<motion.li key={d.slug} variants={item}>
						<a
							className="block rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition hover:border-amber-500/40 hover:bg-zinc-900"
							href={d.path}
						>
							<span className="block font-medium text-zinc-50">{d.title}</span>
							<span className="block text-sm text-zinc-400">{d.tagline}</span>
						</a>
					</motion.li>
				))}
			</ul>
		</motion.nav>
	);
}
