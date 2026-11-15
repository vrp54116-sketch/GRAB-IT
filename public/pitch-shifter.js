/* ------------------------------------------------------------------ */
/*  GRAB IT! — granular pitch shifter (AudioWorklet)                  */
/*                                                                    */
/*  A small, dependency-free pitch shifter so the app can offer real  */
/*  pitch-shifting without dragging in a whole synthesis framework.    */
/*                                                                    */
/*  How it works: the input is written into a ring buffer at 1× while  */
/*  two read heads sweep through it at `ratio` (2^(semitones/12)).     */
/*  Each head is windowed with a raised cosine and offset by half a    */
/*  grain, so their weights always sum to 1 — one head fades out on    */
/*  its wrap while the other is at full volume. No clicks, no gaps.    */
/*                                                                    */
/*  `ratio` is k-rate: the UI sets it when the pitch slider moves.     */
/* ------------------------------------------------------------------ */

const RING = 1 << 15; // 32k samples (~0.7s @ 48k) — far more than we need
const MASK = RING - 1;
const GRAIN = 2048; // ~43ms grains: smooth, with a little natural smear

class GrabPitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "ratio",
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.bufs = [];
    this.write = 0;
    this.phase = 0;

    // raised-cosine window, precomputed (no trig in the audio hot loop)
    this.window = new Float32Array(1025);
    for (let k = 0; k <= 1024; k++) {
      const s = Math.sin((Math.PI * k) / 1024);
      this.window[k] = s * s;
    }
  }

  _buf(ch) {
    let b = this.bufs[ch];
    if (!b) {
      b = new Float32Array(RING);
      this.bufs[ch] = b;
    }
    return b;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output.length) return true;

    const frames = output[0].length;
    const channels = output.length;

    // Nothing connected yet (song paused / still loading): stay silent but alive.
    if (!input || !input.length) {
      for (let c = 0; c < channels; c++) output[c].fill(0);
      return true;
    }

    const ratio = params.ratio && params.ratio.length ? params.ratio[0] : 1;
    const step = (1 - ratio) / GRAIN;
    const inChannels = input.length;

    // ratio === 1 is the identity — skip the delay-line colouration entirely.
    if (Math.abs(ratio - 1) < 1e-5) {
      for (let c = 0; c < channels; c++) {
        output[c].set(input[Math.min(c, inChannels - 1)], 0, frames);
      }
      return true;
    }

    for (let i = 0; i < frames; i++) {
      // advance the read heads
      this.phase += step;
      if (this.phase >= 1) this.phase -= 1;
      else if (this.phase < 0) this.phase += 1;

      let phase2 = this.phase + 0.5;
      if (phase2 >= 1) phase2 -= 1;

      const w1 = this.window[(this.phase * 1024) | 0];
      const w2 = 1 - w1;

      const d1 = this.phase * GRAIN;
      const d2 = phase2 * GRAIN;

      // write the incoming frame first
      const w = this.write;
      for (let c = 0; c < channels; c++) {
        this._buf(c)[w] = input[Math.min(c, inChannels - 1)][i] || 0;
      }

      // fractional read positions (one sample behind the write head)
      const r1 = w - d1 - 1;
      const r2 = w - d2 - 1;
      const f1 = Math.floor(r1);
      const f2 = Math.floor(r2);
      const fr1 = r1 - f1;
      const fr2 = r2 - f2;
      const i1 = f1 & MASK;
      const i1b = (f1 + 1) & MASK;
      const i2 = f2 & MASK;
      const i2b = (f2 + 1) & MASK;

      for (let c = 0; c < channels; c++) {
        const buf = this._buf(c);
        const s1 = buf[i1] + (buf[i1b] - buf[i1]) * fr1;
        const s2 = buf[i2] + (buf[i2b] - buf[i2]) * fr2;
        output[c][i] = s1 * w1 + s2 * w2;
      }

      this.write = (w + 1) & MASK;
    }

    return true;
  }
}

registerProcessor("grab-pitch", GrabPitchShifter);