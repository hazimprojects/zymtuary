export type AmbientHandle = {
	start: () => Promise<void>;
	stop: () => void;
};

type AmbientConfig = {
	baseFreq: number;
	detune?: number;
	volume: number;
	noise?: number;
	pulse?: boolean;
};

const CONFIG: Record<string, AmbientConfig> = {
	primisera: { baseFreq: 55, volume: 0.06, noise: 0.018 },
	luminara: { baseFreq: 196, detune: 4, volume: 0.05, noise: 0.008 },
	noctira: { baseFreq: 110, detune: -6, volume: 0.045, noise: 0.012 },
	ignisara: { baseFreq: 82, volume: 0.055, noise: 0.01, pulse: true },
	nivira: { baseFreq: 262, detune: 2, volume: 0.04, noise: 0.006 },
	equilara: { baseFreq: 147, detune: 7, volume: 0.042, noise: 0.007 },
};

function createNoiseBuffer(ctx: AudioContext, seconds = 2) {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < data.length; i++) {
		const white = Math.random() * 2 - 1;
		last = (last + 0.02 * white) / 1.02;
		data[i] = last * 3.5;
	}
	return buffer;
}

export function createSpheralAmbient(spheralId: string): AmbientHandle {
	let ctx: AudioContext | null = null;
	let gain: GainNode | null = null;
	const nodes: AudioNode[] = [];
	let noiseSource: AudioBufferSourceNode | null = null;

	const stop = () => {
		if (!ctx || !gain) return;
		const end = ctx.currentTime + 0.8;
		gain.gain.cancelScheduledValues(ctx.currentTime);
		gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, end);
		window.setTimeout(() => {
			noiseSource?.stop();
			nodes.forEach((node) => {
				try {
					node.disconnect();
				} catch {
					/* already disconnected */
				}
			});
			void ctx?.close();
			ctx = null;
		}, 900);
	};

	const start = async () => {
		if (ctx) return;

		const config = CONFIG[spheralId] ?? CONFIG.primisera;
		ctx = new AudioContext();
		gain = ctx.createGain();
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.connect(ctx.destination);

		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(spheralId === 'nivira' ? 900 : 520, ctx.currentTime);
		filter.connect(gain);
		nodes.push(filter);

		const osc = ctx.createOscillator();
		osc.type = spheralId === 'ignisara' ? 'triangle' : 'sine';
		osc.frequency.setValueAtTime(config.baseFreq, ctx.currentTime);
		if (config.detune) osc.detune.setValueAtTime(config.detune, ctx.currentTime);
		osc.connect(filter);
		osc.start();
		nodes.push(osc);

		if (config.detune) {
			const osc2 = ctx.createOscillator();
			osc2.type = 'sine';
			osc2.frequency.setValueAtTime(config.baseFreq * 1.5, ctx.currentTime);
			osc2.connect(filter);
			osc2.start();
			nodes.push(osc2);
		}

		if (config.noise) {
			const noiseGain = ctx.createGain();
			noiseGain.gain.setValueAtTime(config.noise, ctx.currentTime);
			noiseGain.connect(filter);
			nodes.push(noiseGain);

			noiseSource = ctx.createBufferSource();
			noiseSource.buffer = createNoiseBuffer(ctx);
			noiseSource.loop = true;
			noiseSource.connect(noiseGain);
			noiseSource.start();
		}

		if (config.pulse) {
			const lfo = ctx.createOscillator();
			const lfoGain = ctx.createGain();
			lfo.frequency.setValueAtTime(0.08, ctx.currentTime);
			lfoGain.gain.setValueAtTime(6, ctx.currentTime);
			lfo.connect(lfoGain);
			lfoGain.connect(osc.frequency);
			lfo.start();
			nodes.push(lfo, lfoGain);
		}

		if (ctx.state === 'suspended') await ctx.resume();

		gain.gain.cancelScheduledValues(ctx.currentTime);
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(config.volume, ctx.currentTime + 3);
	};

	return { start, stop };
}
