export type AmbientHandle = {
	start: () => Promise<void>;
	stop: () => void;
};

type FileAmbientOptions = {
	src: string;
	volume?: number;
	fadeInSeconds?: number;
	fadeOutSeconds?: number;
};

export function createFileAmbient({
	src,
	volume = 0.38,
	fadeInSeconds = 4,
	fadeOutSeconds = 1.5,
}: FileAmbientOptions): AmbientHandle {
	let audio: HTMLAudioElement | null = null;
	let fadeFrame = 0;
	let stopping = false;

	const setVol = (v: number) => {
		if (audio) audio.volume = Math.max(0, Math.min(1, v));
	};

	const stop = () => {
		if (!audio || stopping) return;
		stopping = true;
		cancelAnimationFrame(fadeFrame);

		const el = audio;
		const startVol = el.volume;
		const t0 = performance.now();

		const fadeOut = (now: number) => {
			const t = (now - t0) / (fadeOutSeconds * 1000);
			if (t >= 1) {
				setVol(0);
				el.pause();
				el.src = '';
				return;
			}
			setVol(startVol * (1 - t));
			fadeFrame = requestAnimationFrame(fadeOut);
		};

		fadeFrame = requestAnimationFrame(fadeOut);
	};

	const start = async () => {
		if (audio) return;

		audio = new Audio(src);
		audio.loop = true;
		audio.preload = 'auto';
		setVol(0);

		try {
			await audio.play();
		} catch {
			/* autoplay blocked — caller may retry on gesture */
			return;
		}

		const t0 = performance.now();
		const ramp = (now: number) => {
			const t = (now - t0) / (fadeInSeconds * 1000);
			if (t >= 1) {
				setVol(volume);
				return;
			}
			setVol(volume * t);
			fadeFrame = requestAnimationFrame(ramp);
		};

		fadeFrame = requestAnimationFrame(ramp);
	};

	return { start, stop };
}
