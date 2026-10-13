/**
 * Fully procedural sound: every effect is synthesised with WebAudio, so the
 * game ships with zero audio assets. The context is created lazily on the first
 * user gesture (required by mobile browsers).
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private rocket: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  set muted(m: boolean) {
    this._muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.8;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.wind = this.loop('bandpass', 400, 0.6);
      this.rocket = this.loop('lowpass', 500, 1);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private loop(type: BiquadFilterType, freq: number, q: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    return { gain, filter };
  }

  /** Continuous sounds, driven every frame by the flight state. */
  setFlight(speed: number, boosting: boolean, active: boolean): void {
    if (!this.ctx || !this.wind || !this.rocket) return;
    const t = this.ctx.currentTime;
    const w = active ? Math.min(0.5, speed / 120) : 0;
    this.wind.gain.gain.setTargetAtTime(w, t, 0.1);
    this.wind.filter.frequency.setTargetAtTime(250 + speed * 9, t, 0.1);
    this.rocket.gain.gain.setTargetAtTime(active && boosting ? 0.55 : 0, t, 0.05);
    this.rocket.filter.frequency.setTargetAtTime(380 + Math.random() * 120, t, 0.03);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, vol: number, type: BiquadFilterType = 'lowpass'): void {
    if (!this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + dur);
  }

  coin(big = false): void {
    const base = big ? 660 : 990;
    this.tone(base, 0.08, 'square', 0.08);
    this.tone(base * 1.5, 0.18, 'square', 0.08, 0.06);
  }
  ring(): void {
    this.tone(300, 0.35, 'sine', 0.25, 0, 1200);
  }
  pop(): void {
    this.burst(0.12, 2500, 0.5, 'highpass');
    this.tone(500, 0.1, 'triangle', 0.2, 0, 900);
  }
  launch(): void {
    this.burst(0.5, 900, 0.35, 'bandpass');
  }
  impact(strength: number): void {
    const v = Math.min(1, strength / 30);
    this.burst(0.25 + v * 0.3, 300 + v * 400, 0.25 + v * 0.5);
    this.tone(110, 0.25, 'sine', 0.3 * v + 0.1, 0, 40);
  }
  click(): void {
    this.tone(700, 0.05, 'triangle', 0.15);
  }
  buy(): void {
    this.tone(523, 0.08, 'square', 0.1);
    this.tone(659, 0.08, 'square', 0.1, 0.07);
    this.tone(784, 0.16, 'square', 0.1, 0.14);
  }
  flap(): void {
    this.burst(0.18, 600, 0.3, 'bandpass');
    this.tone(220, 0.15, 'triangle', 0.12, 0, 330);
  }
  splash(strength: number): void {
    const v = Math.min(1, strength / 25);
    this.burst(0.35 + v * 0.4, 1800, 0.3 + v * 0.4, 'highpass');
    this.tone(300, 0.2, 'sine', 0.12, 0.02, 120);
  }
  honk(): void {
    this.tone(440, 0.18, 'square', 0.09);
    this.tone(330, 0.18, 'square', 0.07);
  }
  denied(): void {
    this.tone(180, 0.18, 'sawtooth', 0.12, 0, 120);
  }
  cash(): void {
    for (let i = 0; i < 4; i++) this.tone(1200 + i * 200, 0.07, 'square', 0.06, i * 0.06);
  }
  fanfare(): void {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.22, 'square', 0.1, i * 0.14));
  }
}
