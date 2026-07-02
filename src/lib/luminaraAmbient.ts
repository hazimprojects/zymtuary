export type AmbientHandle = {
	start: () => Promise<void>;
	stop: () => void;
};

function brownNoise(ctx: AudioContext, seconds = 4) {
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

export function createLuminaraAmbient(): AmbientHandle {
	let ctx: AudioContext | null = null;
	let master: GainNode | null = null;
	const nodes: AudioNode[] = [];
	let noiseSource: AudioBufferSourceNode | null = null;

	const stop = () => {
		if (!ctx || !master) return;
		const t = ctx.currentTime;
		master.gain.cancelScheduledValues(t);
		master.gain.setValueAtTime(master.gain.value, t);
		master.gain.linearRampToValueAtTime(0, t + 1.5);
		window.setTimeout(() => {
			noiseSource?.stop();
			nodes.forEach((n) => {
				try {
					n.disconnect();
				} catch {
					/* noop */
				}
			});
			void ctx?.close();
			ctx = null;
		}, 1600);
	};

	const start = async () => {
		if (ctx) return;

		ctx = new AudioContext();
		master = ctx.createGain();
		master.gain.setValueAtTime(0, ctx.currentTime);
		master.connect(ctx.destination);

		const warmth = ctx.createBiquadFilter();
		warmth.type = 'lowpass';
		warmth.frequency.setValueAtTime(720, ctx.currentTime);
		warmth.Q.setValueAtTime(0.4, ctx.currentTime);
		warmth.connect(master);
		nodes.push(warmth);

		// Lapisan 1: angin cahaya — brown noise lembut, bukan bandpass
		const airFilter = ctx.createBiquadFilter();
		airFilter.type = 'lowpass';
		airFilter.frequency.setValueAtTime(380, ctx.currentTime);

		const airGain = ctx.createGain();
		airGain.gain.setValueAtTime(0.022, ctx.currentTime);

		noiseSource = ctx.createBufferSource();
		noiseSource.buffer = brownNoise(ctx);
		noiseSource.loop = true;
		noiseSource.connect(airFilter);
		airFilter.connect(airGain);
		airGain.connect(warmth);
		noiseSource.start();
		nodes.push(airFilter, airGain);

		// Lapisan 2: pad hangat — dua nada hampir sama untuk shimmer halus
		const padBus = ctx.createGain();
		padBus.gain.setValueAtTime(0.028, ctx.currentTime);
		padBus.connect(warmth);
		nodes.push(padBus);

		const padFreqs = [130.81, 131.4, 196.0];
		const padGains = [1, 0.85, 0.35];

		padFreqs.forEach((freq, i) => {
			const osc = ctx.createOscillator();
			osc.type = i === 2 ? 'sine' : 'triangle';
			osc.frequency.setValueAtTime(freq, ctx.currentTime);
			if (i === 1) osc.detune.setValueAtTime(8, ctx.currentTime);

			const g = ctx.createGain();
			g.gain.setValueAtTime(padGains[i] ?? 0.5, ctx.currentTime);
			osc.connect(g);
			g.connect(padBus);
			osc.start();
			nodes.push(osc, g);
		});

		// Napas sangat perlahan pada pad sahaja — bukan sapuan filter
		const breath = ctx.createOscillator();
		const breathDepth = ctx.createGain();
		breath.frequency.setValueAtTime(0.025, ctx.currentTime);
		breathDepth.gain.setValueAtTime(0.006, ctx.currentTime);
		breath.connect(breathDepth);
		breathDepth.connect(padBus.gain);
		breath.start();
		nodes.push(breath, breathDepth);

		if (ctx.state === 'suspended') await ctx.resume();

		master.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 4);
	};

	return { start, stop };
}
