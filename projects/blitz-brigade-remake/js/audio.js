// Fully synthesised sound — no audio files, everything is generated with WebAudio.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  get t() { return this.ctx.currentTime; }

  // distance attenuation for world sounds
  gainFor(distance) {
    if (distance == null) return 1;
    return Math.max(0, 1 - distance / 70) ** 1.6;
  }

  noise(duration, { gain = 0.4, filter = 1800, type = 'lowpass', q = 1, sweepTo = null, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = type;
    biquad.frequency.setValueAtTime(filter, t0);
    biquad.Q.value = q;
    if (sweepTo) biquad.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    src.connect(biquad).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  tone(freq, duration, { gain = 0.2, type = 'square', to = null, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.t + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  shot(kind, distance = null) {
    if (!this.enabled || !this.ctx) return;
    const d = this.gainFor(distance);
    if (d <= 0.01) return;
    switch (kind) {
      case 'rifle':
        this.noise(0.14, { gain: 0.42 * d, filter: 4200, sweepTo: 500 });
        this.tone(160, 0.1, { gain: 0.16 * d, type: 'sawtooth', to: 60 });
        break;
      case 'hmg':
        this.noise(0.1, { gain: 0.3 * d, filter: 3000, sweepTo: 400 });
        this.tone(120, 0.08, { gain: 0.12 * d, type: 'square', to: 55 });
        break;
      case 'smg':
        this.noise(0.09, { gain: 0.26 * d, filter: 5200, sweepTo: 900 });
        break;
      case 'sniper':
        this.noise(0.45, { gain: 0.6 * d, filter: 5200, sweepTo: 180 });
        this.tone(90, 0.35, { gain: 0.22 * d, type: 'sawtooth', to: 40 });
        break;
      case 'shotgun':
        this.noise(0.3, { gain: 0.55 * d, filter: 2600, sweepTo: 220 });
        this.tone(70, 0.22, { gain: 0.2 * d, type: 'square', to: 35 });
        break;
      default:
        this.noise(0.12, { gain: 0.3 * d, filter: 3600, sweepTo: 600 });
    }
  }

  impact(distance = null) {
    this.noise(0.07, { gain: 0.18 * this.gainFor(distance), filter: 2600, sweepTo: 800 });
  }

  hitmarker(lethal = false) {
    this.tone(lethal ? 1500 : 980, 0.07, { gain: 0.16, type: 'square', to: lethal ? 2400 : 1300 });
  }

  explosion(distance = null) {
    const d = this.gainFor(distance);
    this.noise(0.9, { gain: 0.8 * d, filter: 900, sweepTo: 60 });
    this.tone(60, 0.7, { gain: 0.35 * d, type: 'sawtooth', to: 25 });
  }

  reload() {
    this.tone(420, 0.05, { gain: 0.12, type: 'square', to: 260 });
    this.noise(0.08, { gain: 0.12, filter: 1800, delay: 0.12 });
    this.tone(320, 0.05, { gain: 0.12, type: 'square', to: 520, delay: 0.3 });
  }

  empty() {
    this.tone(900, 0.04, { gain: 0.08, type: 'square', to: 500 });
  }

  ability(kind) {
    switch (kind) {
      case 'cloak': this.tone(300, 0.5, { gain: 0.18, type: 'sine', to: 1400 }); break;
      case 'heal': this.tone(520, 0.35, { gain: 0.2, type: 'sine', to: 880 }); break;
      case 'bulwark': this.tone(180, 0.4, { gain: 0.22, type: 'square', to: 300 }); break;
      case 'recon': this.tone(1200, 0.4, { gain: 0.16, type: 'sine', to: 400 }); break;
      default: this.tone(600, 0.25, { gain: 0.16, type: 'triangle', to: 900 });
    }
  }

  kill() {
    this.tone(660, 0.09, { gain: 0.2, type: 'square' });
    this.tone(990, 0.14, { gain: 0.2, type: 'square', delay: 0.09 });
  }

  death() {
    this.tone(400, 0.6, { gain: 0.25, type: 'sawtooth', to: 70 });
    this.noise(0.5, { gain: 0.2, filter: 700, sweepTo: 120 });
  }

  capture(good = true) {
    if (good) {
      this.tone(520, 0.12, { gain: 0.18, type: 'triangle' });
      this.tone(780, 0.2, { gain: 0.18, type: 'triangle', delay: 0.12 });
    } else {
      this.tone(420, 0.2, { gain: 0.16, type: 'triangle', to: 220 });
    }
  }

  matchEnd(won) {
    const seq = won ? [523, 659, 784, 1046] : [523, 440, 349, 262];
    seq.forEach((f, i) => this.tone(f, 0.45, { gain: 0.2, type: 'triangle', delay: i * 0.18 }));
  }

  step(distance = null) {
    this.noise(0.05, { gain: 0.05 * this.gainFor(distance), filter: 900, sweepTo: 300 });
  }
}
