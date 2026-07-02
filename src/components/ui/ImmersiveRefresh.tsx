type ImmersiveRefreshProps = {
	className?: string;
};

export default function ImmersiveRefresh({ className = '' }: ImmersiveRefreshProps) {
	const handleRefresh = () => {
		window.location.reload();
	};

	return (
		<button
			type="button"
			onClick={handleRefresh}
			className={`font-body text-[0.55rem] uppercase tracking-[0.3em] text-[#f5f0e8]/35 transition-colors active:text-[#f5f0e8]/65 ${className}`}
			aria-label="Muat semula halaman"
		>
			↻ Muat semula
		</button>
	);
}
