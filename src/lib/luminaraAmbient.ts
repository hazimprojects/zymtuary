export type AmbientHandle = {
	start: () => Promise<void>;
	stop: () => void;
};

export function createLuminaraAmbient(): AmbientHandle {
	let ctx: AudioContext | null = null;
	let gain: GainNode | null = null;
	const nodes: AudioNode[] = [];
	let noiseSource: AudioBufferSourceNode | null = null;

	const stop = () => {
		if (!ctx || !gain) return;
		const end = ctx.currentTime + 1.2;
		gain.gain.cancelScheduledValues(ctx.currentTime);
		gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, end);
		window.setTimeout(() => {
			noiseSource?.stop();
			nodes.forEach((node) => {
				try {
					node.disconnect();
				} catch {
					/* noop */
				}
			});
			void ctx?.close();
			ctx = null;
		}, 1300);
	};

	const start = async () => {
		if (ctx) return;

		ctx = new AudioContext();
		gain = ctx.createGain();
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.connect(ctx.destination);

		const masterFilter = ctx.createBiquadFilter();
		masterFilter.type = 'lowpass';
		masterFilter.frequency.setValueAtTime(680, ctx.currentTime);
		masterFilter.connect(gain);
		nodes.push(masterFilter);

		const freqs = [196, 293.66, 392];
		for (const freq of freqs) {
			const osc = ctx.createOscillator();
			const oscGain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, ctx.currentTime);
			oscGain.gain.setValueAtTime(freq === 196 ? 0.04 : 0.018, ctx.currentTime);
			osc.connect(oscGain);
			oscGain.connect(masterFilter);
			osc.start();
			nodes.push(osc, oscGain);
		}

		const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * 0.15;
		}

		const noiseFilter = ctx.createBiquadFilter();
		noiseFilter.type = 'bandpass';
		noiseFilter.frequency.setValueAtTime(420, ctx.currentTime);
		noiseFilter.Q.setValueAtTime(0.6, ctx.currentTime);

		const noiseGain = ctx.createGain();
		noiseGain.gain.setValueAtTime(0.012, ctx.currentTime);

		noiseSource = ctx.createBufferSource();
		noiseSource.buffer = buffer;
		noiseSource.loop = true;
		noiseSource.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(masterFilter);
		noiseSource.start();
		nodes.push(noiseFilter, noiseGain);

		const lfo = ctx.createOscillator();
		const lfoGain = ctx.createGain();
		lfo.frequency.setValueAtTime(0.05, ctx.currentTime);
		lfoGain.gain.setValueAtTime(12, ctx.currentTime);
		lfo.connect(lfoGain);
		lfoGain.connect(masterFilter.frequency);
		lfo.start();
		nodes.push(lfo, lfoGain);

		if (ctx.state === 'suspended') await ctx.resume();

		gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 4);
	};

	return { start, stop };
}
