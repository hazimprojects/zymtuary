import { useEffect, useRef } from 'react';

type Particle = {
	x: number;
	y: number;
	r: number;
	speed: number;
	drift: number;
	alpha: number;
};

export default function LuminaraParticles() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let frame = 0;
		let particles: Particle[] = [];

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			const count = Math.min(48, Math.floor((canvas.width * canvas.height) / 18000));
			particles = Array.from({ length: count }, () => ({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				r: Math.random() * 1.8 + 0.4,
				speed: Math.random() * 0.25 + 0.08,
				drift: (Math.random() - 0.5) * 0.12,
				alpha: Math.random() * 0.35 + 0.08,
			}));
		};

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (const p of particles) {
				p.y -= p.speed;
				p.x += p.drift;

				if (p.y < -8) {
					p.y = canvas.height + 8;
					p.x = Math.random() * canvas.width;
				}

				const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
				gradient.addColorStop(0, `rgba(245, 215, 142, ${p.alpha})`);
				gradient.addColorStop(1, 'rgba(245, 215, 142, 0)');

				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
				ctx.fill();
			}

			frame = requestAnimationFrame(draw);
		};

		resize();
		draw();
		window.addEventListener('resize', resize);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', resize);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none fixed inset-0 z-[1] opacity-70"
			aria-hidden
		/>
	);
}
