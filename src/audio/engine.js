import {
  EQ_FREQS, SPATIAL_SLOWEST, SPATIAL_FASTEST, SPATIAL_DEFAULT,
} from "../settings/SettingsContext.jsx";
import { gyroTracker } from "./gyro.js";

/** Reverb tail lengths, in seconds. */
export const REVERB_ROOMS = {
  room: 1.4,
  hall: 2.8,
  cathedral: 4.6,
};

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/* ------------------------------------------------------------------ */
/*  Circadian ambient bed shapes                                       */
/*  Filter recipes over one pink-noise loop; gain is the base level at  */
/*  bed level 1. Kept quiet on purpose — a whisper under the music.     */
/* ------------------------------------------------------------------ */
export const AMBIENT_SHAPES = {
  rain: { hp: 320, lp: 7200, peak: 1600, peakGain: 5, gain: 0.16, lfo: 0.06, lfoDepth: 0.35 },
  drizzle: { hp: 520, lp: 6000, peak: 2000, peakGain: 4, gain: 0.12, lfo: 0.08, lfoDepth: 0.3 },
  storm: { hp: 220, lp: 5200, peak: 1000, peakGain: 5, gain: 0.18, lfo: 0.05, lfoDepth: 0.5 },
  snow: { hp: 1400, lp: 9000, peak: 2600, peakGain: 3, gain: 0.1, lfo: 0.04, lfoDepth: 0.25 },
  fog: { hp: 120, lp: 1500, peak: 500, peakGain: 2, gain: 0.11, lfo: 0.03, lfoDepth: 0.3 },
  wind: { hp: 90, lp: 900, peak: 400, peakGain: 3, gain: 0.13, lfo: 0.05, lfoDepth: 0.5 },
  breeze: { hp: 420, lp: 3200, peak: 1200, peakGain: 2, gain: 0.07, lfo: 0.07, lfoDepth: 0.35 },
  night: { hp: 160, lp: 1100, peak: 700, peakGain: 3, gain: 0.1, lfo: 0.02, lfoDepth: 0.3 },
};

/* ------------------------------------------------------------------ */
/*  8D / Spatial Audio maths                                           */
/* ------------------------------------------------------------------ */

/** Crossover between the centred sub anchor and the orbiting satellites. */
export const SPATIAL_CROSSOVER = 120; // Hz
/** The rear-head muffler sweeps this far down when a source is dead behind. */
export const SPATIAL_REAR_FLOOR = 4500; // Hz
/** Gyro live-stage rear floor — matches the head-tracking design spec. */
export const SPATIAL_GYRO_REAR_FLOOR = 5000; // Hz
/** Half-angle between the left and right satellites on the virtual stage. */
export const SPATIAL_STAGE_SPREAD = 35; // degrees

/** Acoustic rooms for Google Resonance (dimensions in metres + wall materials). */
export const SPATIAL_ROOMS = {
  studio: {
    label: "Studio",
    dimensions: { width: 7, height: 3.4, depth: 9 },
    materials: {
      left: "wood-panel", right: "wood-panel", front: "plaster-smooth",
      back: "plaster-smooth", up: "acoustic-ceiling-tiles", down: "parquet-on-concrete",
    },
  },
  club: {
    label: "Club",
    dimensions: { width: 16, height: 6, depth: 24 },
    materials: {
      left: "concrete-block-painted", right: "concrete-block-painted", front: "brick-painted",
      back: "brick-painted", up: "plaster-rough", down: "polished-concrete-or-tile",
    },
  },
  hall: {
    label: "Concert hall",
    dimensions: { width: 24, height: 12, depth: 38 },
    materials: {
      left: "wood-panel", right: "wood-panel", front: "wood-panel",
      back: "wood-panel", up: "plaster-smooth", down: "parquet-on-concrete",
    },
  },
  cathedral: {
    label: "Cathedral",
    dimensions: { width: 32, height: 22, depth: 60 },
    materials: {
      left: "marble", right: "marble", front: "marble",
      back: "marble", up: "plaster-smooth", down: "marble",
    },
  },
};

const RESONANCE_CDN = "https://cdn.jsdelivr.net/npm/resonance-audio@1.0.0/build/resonance-audio.min.js";
let resonanceSdkPromise = null;

/** Lazy-load Google's Resonance Audio SDK straight from jsDelivr (once). */
function loadResonanceSdk() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("no browser"));
  }
  if (window.ResonanceAudio) return Promise.resolve(window.ResonanceAudio);
  if (!resonanceSdkPromise) {
    resonanceSdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = RESONANCE_CDN;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.dataset.resonanceAudio = "1";
      s.onload = () => (window.ResonanceAudio
        ? resolve(window.ResonanceAudio)
        : reject(new Error("ResonanceAudio global missing")));
      s.onerror = () => reject(new Error("Resonance Audio CDN blocked"));
      document.head.appendChild(s);
    }).catch((err) => {
      // Allow a later retry (e.g. the user re-enables the room after going online).
      resonanceSdkPromise = null;
      throw err;
    });
  }
  return resonanceSdkPromise;
}

/**
 * AudioEngine
 *
 * Graph mode (default) — two <audio> elements feeding one Web Audio graph:
 *
 *   elA -> gainA ┐
 *                ├-> preGain -> [EQ x10] -> Sing -> warmth -> ┌ dry ┐
 *   elB -> gainB ┘                                             └ reverb ┘
 *                    -> Pitch (AudioWorklet) -> analyser -> master -> ┌ dry  (untouched stereo) ┐
 *                                                                    └ wet  (whole 8D bus)      ┘ -> speakers
 *
 * Two elements give a real overlapping crossfade and gapless hand-off.
 *
 * "Slowed + Reverb" lives on that graph:
 *   • warmth   — a gentle lowpass that muffles the top end
 *   • reverb   — a real ConvolverNode fed a procedurally generated tail
 *   • pitch    — a granular AudioWorklet shifter, with a clean bypass
 *   • speed    — the media elements' playbackRate; with "tape" pitch on, the
 *                vocals sink with the tempo (the classic slowed edit), with it
 *                off the tempo moves alone and the shifter handles pitch.
 *
 * "8D / Spatial Audio" is a whole bus fed from master, crossfaded against the
 * untouched stereo path so toggling it never clicks. It is not one PannerNode:
 *   1. the L and R channels are split and flown as two independent binaural
 *      satellites (opposite orbit, or mirrored figure-8) — stereo width is kept;
 *   2. each channel runs through its own BiquadFilterNode "rear-head muffler"
 *      that sweeps 20 kHz -> 4.5 kHz as it crosses behind the listener;
 *   3. everything under 120 Hz is crossed out, summed to mono (dead centre) and
 *      lifted by a +4 dB low shelf — the sub-bass anchor;
 *   4. Google's Resonance Audio SDK (lazily loaded from jsDelivr) renders real
 *      early wall reflections. If the CDN is blocked, the native HRTF panners
 *      keep the orbit alive, so 8D never goes silent.
 *
 * Plain mode — a third element that is NOT routed through Web Audio. Used for
 * "opaque" sources (e.g. podcast episodes on hosts that don't send CORS
 * headers) and as an automatic retry when graph mode fails. Speed/tape still
 * work there (they're element-level); reverb + pitch step aside honestly.
 */
export class AudioEngine {
  constructor() {
    this.els = [this._mk(true), this._mk(true)];
    this.plain = this._mk(false);
    this.active = 0;
    this.mode = "graph";
    this.ctx = null;
    this.graph = null;
    this.processing = true;
    this.eqGains = EQ_FREQS.map(() => 0);
    this.eqOn = false;
    this.ambientEq = null; // circadian curve layered under the user's own EQ
    this.normalize = false; // even out loud / quiet tracks with a gentle compressor
    this.singAmount = 0;
    this.volume = 0.85;

    /* slowed + reverb */
    this.speed = 1;
    this.rate = 1;
    this.pitchSemis = 0;
    this.tapePitch = true;
    this.reverbAmount = 0;
    this.reverbRoom = "hall";
    this.warmth = 0;
    this.pitchReady = false;
    this.pitchFailed = false;
    this._pitchLoading = false;
    this._ir = null; // one impulse response at a time (rebuilt per room)
    this._irRoom = null;

    /* vinyl brake — press-and-hold on the spinning poster */
    this.brakeActive = false;
    this._brakeRAF = 0;
    this._brakeTick = null;
    this._brakeRate = null; // absolute playbackRate while the hand is down
    this._brakeBase = null; // the speed the transport will return to
    this._brakeWasPlaying = false;

    /* 8D / spatial audio */
    this.spatialOn = false;
    this.spatialSpeed = SPATIAL_DEFAULT; // Hz (10s per orbit)
    this.spatialDepth = 0.8; // 0..1 — orbit radius + height
    this.spatialMode = "orbit"; // orbit | figure8
    this.spatialRear = 1; // 0..1 — rear-head lowpass depth (20k -> 4.5k)
    this.spatialSub = 4; // dB — centred sub-bass low-shelf
    this.spatialRoom = true; // Google Resonance room acoustics
    this.spatialRoomSize = "club"; // studio | club | hall | cathedral
    this.spatialGyro = false; // phone-motion live stage (pauses the auto orbit)
    this.spatialRoomReady = false;
    this.spatialRoomFailed = false;
    this._roomLoading = false;
    this._spatialRAF = 0;
    this._spatialPhase = 0; // accumulated so speed changes glide, not jump
    this._spatialLast = 0;
    this._spatialRoomLast = 0;

    /* circadian ambient bed (procedural noise, own bus straight to output) */
    this.ambientType = null; // rain | storm | snow | fog | wind | breeze | night | drizzle
    this.ambientLevel = 0; // 0..1 — scales the bed's gain
    this._ambient = null;
    this._ambientBuf = null;

    this._l = new Map();
    this.els.forEach((el, i) => this._wire(el, i));
    this._wire(this.plain, "plain");
    this._applyPlayback();
  }

  _mk(cors) {
    const a = new Audio();
    if (cors) a.crossOrigin = "anonymous";
    // "metadata" keeps idle elements from buffering whole tracks into RAM;
    // preload() opts into "auto" only for the one track we're about to play.
    a.preload = "metadata";
    a.playsInline = true;
    a.volume = this.volume ?? 0.85;
    return a;
  }

  _wire(el, tag) {
    const emit = (t) => this._emit(t, { tag, el });
    ["loadedmetadata", "durationchange", "timeupdate", "progress", "ended", "play", "pause", "waiting", "playing", "error"].forEach(
      (ev) => el.addEventListener(ev, () => emit(ev))
    );
  }

  /* ---------- events ---------- */
  on(type, fn) {
    if (!this._l.has(type)) this._l.set(type, new Set());
    this._l.get(type).add(fn);
    return () => this._l.get(type)?.delete(fn);
  }
  _emit(type, detail) {
    this._l.get(type)?.forEach((fn) => fn(detail));
  }

  /* ---------- graph ---------- */
  _ensureGraph() {
    if (!this.processing) return null;
    if (this.graph) return this.graph;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.processing = false;
        return null;
      }
      const ctx = new AC();
      const preGain = ctx.createGain();
      /* Volume normalisation: a transparent-by-default compressor. Ratio 1 /
         threshold 0 does nothing; switching it on squeezes peaks so a loud
         master and a quiet B-side sit at the same level. */
      const norm = ctx.createDynamicsCompressor();
      norm.threshold.value = 0;
      norm.knee.value = 0;
      norm.ratio.value = 1;
      norm.attack.value = 0.004;
      norm.release.value = 0.24;
      const normGain = ctx.createGain();
      normGain.gain.value = 1;
      const eq = EQ_FREQS.map((f, i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
        b.frequency.value = f;
        b.Q.value = 1.1;
        b.gain.value = 0;
        return b;
      });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;
      const master = ctx.createGain();
      master.gain.value = 1;
      const gains = this.els.map(() => ctx.createGain());
      const sources = this.els.map((el) => ctx.createMediaElementSource(el));
      sources.forEach((s, i) => s.connect(gains[i]).connect(norm));
      norm.connect(normGain).connect(preGain);
      let node = preGain;
      eq.forEach((f) => {
        node.connect(f);
        node = f;
      });

      /* --- Sing: mid/side vocal step-back (L-R cancels the centre) --- */
      const sing = {
        dry: ctx.createGain(),
        wet: ctx.createGain(),
        splitter: ctx.createChannelSplitter(2),
        kL: ctx.createGain(),
        kR: ctx.createGain(),
        post: ctx.createGain(),
      };
      sing.dry.gain.value = 1;
      sing.wet.gain.value = 0;
      sing.kR.gain.value = -1;
      node.connect(sing.dry).connect(sing.post);
      node.connect(sing.splitter);
      sing.splitter.connect(sing.kL, 0);
      sing.splitter.connect(sing.kR, 1);
      sing.kL.connect(sing.wet);
      sing.kR.connect(sing.wet);
      sing.wet.connect(sing.post);
      sing.amount = 0;

      /* --- Warmth: a soft lowpass for the lofi / slowed tone --- */
      const warmth = ctx.createBiquadFilter();
      warmth.type = "lowpass";
      warmth.frequency.value = 20000;
      warmth.Q.value = 0.6;

      /* --- Reverb: real convolution, dry + wet --- */
      const convolver = ctx.createConvolver();
      convolver.normalize = true;
      const revDry = ctx.createGain();
      const revWet = ctx.createGain();
      revDry.gain.value = 1;
      revWet.gain.value = 0;

      /* --- Pitch: granular worklet, clean bypass until it loads --- */
      const pitch = {
        in: ctx.createGain(),
        out: ctx.createGain(),
        dry: ctx.createGain(),
        wet: ctx.createGain(),
        node: null,
      };
      pitch.dry.gain.value = 1;
      pitch.wet.gain.value = 0;
      pitch.in.connect(pitch.dry).connect(pitch.out);
      pitch.wet.connect(pitch.out);

      /* ------------------------------------------------------------------
         8D / Spatial Audio — four professional tricks, not one panner:

         1. Dual-channel split: L and R are separated and flown as two
            binaural satellites (opposite orbit or mirrored figure-8), so
            stereo width survives instead of collapsing to mono.
         2. Rear-head muffler: one BiquadFilterNode per channel sweeps
            20 kHz -> 4.5 kHz as that channel crosses behind the listener.
         3. Sub-bass anchor: < 120 Hz is crossed out of the orbit, summed
            to mono (dead centre) and lifted by a +4 dB low shelf.
         4. Acoustics: Google Resonance (loaded lazily from jsDelivr) adds
            real early wall reflections + late reverb. Until it arrives —
            or if the CDN is blocked — the native HRTF panners handle the
            orbit, so 8D never goes silent.

         master ─┬─ dry ─────────────────────────────────────────────► out (8D off)
                 └─ in ─ hp120 ×2 ─ split L/R ─ rear LP L/R ─┬─ panner L ─┐
                                                             ├─ panner R ─┤
                                                             └─ Resonance ─┴─ wet ► out (8D on)
                 └─ shelf +4dB ─ lp120 ×2 ─ mono ─ centre ──────────────┘
      ------------------------------------------------------------------ */
      const spatial = {
        dry: ctx.createGain(), // untouched stereo (8D off)
        wet: ctx.createGain(), // whole 8D bus (8D on)
        in: ctx.createGain(), // master -> spatial splitter
        hp: [],
        splitter: ctx.createChannelSplitter(2),
        rear: [], // one rear-head lowpass per channel
        panners: [], // native HRTF fallback / pre-Resonance path
        panGain: ctx.createGain(),
        room: null, // ResonanceAudio scene
        roomGain: ctx.createGain(),
        sources: [], // ResonanceAudio sources (L/R)
        sub: {},
      };
      spatial.dry.gain.value = 1;
      spatial.wet.gain.value = 0;
      spatial.in.gain.value = 0;
      spatial.panGain.gain.value = 1;
      spatial.roomGain.gain.value = 0;

      // Crossover: keep the deep end out of the orbit (24 dB/oct Linkwitz-Riley-ish).
      for (let i = 0; i < 2; i++) {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = SPATIAL_CROSSOVER;
        hp.Q.value = 0.707;
        spatial.hp.push(hp);
      }

      // Two mono satellites: left channel and right channel, each with its own
      // HRTF panner and its own rear-head lowpass.
      for (let ch = 0; ch < 2; ch++) {
        const rear = ctx.createBiquadFilter();
        rear.type = "lowpass";
        rear.frequency.value = 20000;
        rear.Q.value = 0.707;
        spatial.rear.push(rear);

        const p = ctx.createPanner();
        p.panningModel = "HRTF";
        p.distanceModel = "inverse";
        p.refDistance = 1.6;
        p.maxDistance = 40;
        p.rolloffFactor = 0.14; // subtle “further away at the back”
        p.coneInnerAngle = 360;
        p.coneOuterAngle = 0;
        p.coneOuterGain = 0;
        spatial.panners.push(p);
      }

      // Sub anchor: shelf (+4 dB) -> 120 Hz lowpass ×2 -> mono -> both ears.
      const subShelf = ctx.createBiquadFilter();
      subShelf.type = "lowshelf";
      subShelf.frequency.value = SPATIAL_CROSSOVER;
      subShelf.gain.value = this.spatialSub;
      const subLp = [0, 1].map(() => {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = SPATIAL_CROSSOVER;
        f.Q.value = 0.707;
        return f;
      });
      const subMono = ctx.createGain();
      subMono.channelCount = 1;
      subMono.channelCountMode = "explicit";
      subMono.channelInterpretation = "speakers";
      const subMerge = ctx.createChannelMerger(2);
      const subGain = ctx.createGain();
      subGain.gain.value = 1;
      spatial.sub = { shelf: subShelf, lp: subLp, mono: subMono, merge: subMerge, gain: subGain };

      sing.post.connect(warmth);
      warmth.connect(revDry).connect(pitch.in);
      warmth.connect(convolver).connect(revWet).connect(pitch.in);
      pitch.out.connect(analyser);
      analyser.connect(master);

      // Untouched stereo vs. the whole 8D bus — crossfaded by the toggle.
      master.connect(spatial.dry).connect(ctx.destination);
      master.connect(spatial.in);

      // Spatial satellites
      spatial.in.connect(spatial.hp[0]);
      spatial.hp[0].connect(spatial.hp[1]);
      spatial.hp[1].connect(spatial.splitter);
      spatial.splitter.connect(spatial.rear[0], 0);
      spatial.splitter.connect(spatial.rear[1], 1);
      spatial.rear[0].connect(spatial.panners[0]).connect(spatial.panGain);
      spatial.rear[1].connect(spatial.panners[1]).connect(spatial.panGain);
      spatial.panGain.connect(spatial.wet);

      // Resonance room bus (filled in when the SDK lands).
      spatial.roomGain.connect(spatial.wet);

      // Centred sub anchor.
      master.connect(subShelf);
      subShelf.connect(subLp[0]).connect(subLp[1]).connect(subMono);
      subMono.connect(subMerge, 0, 0);
      subMono.connect(subMerge, 0, 1);
      subMerge.connect(subGain).connect(spatial.wet);

      spatial.wet.connect(ctx.destination);

      // Listener faces -Z (Web Audio / Resonance convention). “Behind” is
      // therefore the positive-Z half-space; the rear filter uses the dot
      // product, so it stays correct if the listener ever turns.
      try {
        const l = ctx.listener;
        if (l.positionX) {
          l.positionX.value = 0; l.positionY.value = 0; l.positionZ.value = 0;
          l.forwardX.value = 0; l.forwardY.value = 0; l.forwardZ.value = -1;
          l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
        }
      } catch { /* older Safari */ }

      this.graph = {
        ctx, preGain, eq, analyser, master, gains, sources,
        norm, normGain,
        sing, warmth, convolver, revDry, revWet, pitch, spatial,
        // Preallocated analyser scratch space — the visualizer polls these at
        // 60fps, so allocating a new typed array every frame was pure garbage.
        freqBuf: new Uint8Array(analyser.frequencyBinCount),
        waveBuf: new Uint8Array(analyser.fftSize),
      };
      this.ctx = ctx;
      this._applyEq();
      this._applyNormalize(true);
      this._applySing();
      this._applyWarmth();
      this._applyReverb();
      this._applyPitchMix(true);
      this._applySpatial(true);
      this._applySub(true);
      // The bed is optional: a browser that refuses it must never take the
      // whole audio graph down with it.
      if (this.ambientType && this.ambientLevel > 0.001) {
        try {
          this._ambientEnsure();
        } catch {
          this._ambient = null;
        }
      }
      this._applyPlayback();
      this._updateSpatialLoop();
      this._loadPitchWorklet(ctx);
      if (this.spatialOn && this.spatialRoom) this._loadResonance(ctx);
      return this.graph;
    } catch {
      this.processing = false;
      return null;
    }
  }

  async resumeCtx() {
    const g = this._ensureGraph();
    if (g && g.ctx.state === "suspended") {
      try {
        await g.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  _gain(idx) {
    return this.graph ? this.graph.gains[idx] : null;
  }
  _ramp(idx, to, seconds) {
    const g = this._gain(idx);
    if (!g) return;
    const now = this.graph.ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, to), now + Math.max(0.01, seconds));
  }

  /** Smoothly move any AudioParam — no zipper noise while dragging sliders. */
  _param(param, value, seconds = 0.05) {
    if (!param || !this.graph) return;
    const now = this.graph.ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + Math.max(0.005, seconds));
    } catch {
      try { param.value = value; } catch { /* ignore */ }
    }
  }

  /* ---------- current element ---------- */
  setMode(mode) {
    if (mode !== this.mode) {
      this.brakeCancel();
      this.pause();
      this.mode = mode;
      // A Resonance scene is heavy; don't keep its convolvers alive while an
      // opaque source bypasses the graph. Rebuild it when we go back.
      if (mode === "plain") {
        this._teardownResonance();
      } else if (this.graph && this.spatialOn && this.spatialRoom) {
        this._loadResonance(this.graph.ctx);
      }
      this._updateSpatialLoop();
    }
  }
  get el() {
    return this.mode === "plain" ? this.plain : this.els[this.active];
  }
  get otherEl() {
    return this.els[this.active ^ 1];
  }

  async ensureReady() {
    await this.resumeCtx();
  }

  load(url, autoplay = true, idx = this.active) {
    this.brakeCancel();
    const el = this.mode === "plain" ? this.plain : this.els[idx];
    el.preload = "auto";
    if (el.src !== url) el.src = url;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    if (this.mode !== "plain") {
      const g = this._gain(idx);
      if (g) g.gain.value = 1;
    }
    el.volume = this.volume;
    this._applyPlayback();
    if (autoplay) return this.play(idx);
    return Promise.resolve();
  }

  preload(url, idx = this.active ^ 1) {
    if (this.mode === "plain") return;
    const el = this.els[idx];
    el.preload = "auto"; // only the imminent track buffers ahead
    if (el.src !== url) el.src = url;
    const g = this._gain(idx);
    if (g) g.gain.value = 0.0001;
    try {
      el.load();
    } catch {
      /* ignore */
    }
  }

  async play(idx = this.active) {
    await this.resumeCtx();
    const el = this.mode === "plain" ? this.plain : this.els[idx];
    if (this.mode !== "plain" && idx !== this.active) this._ramp(idx, 1, 0.05);
    try {
      await el.play();
    } catch {
      /* blocked */
    }
  }

  pause() {
    this.els.forEach((el) => el.pause());
    this.plain.pause();
  }

  seek(seconds) {
    const el = this.el;
    if (Number.isFinite(seconds)) el.currentTime = seconds;
  }

  setVolume(v) {
    this.volume = v;
    [...this.els, this.plain].forEach((el) => {
      el.volume = v;
    });
  }

  setProcessing(on) {
    this.processing = on;
  }

  /* ---------------- speed / pitch ---------------- */

  /** The speed the transport is asking for, before any vinyl-brake override. */
  _baseRate() {
    const speed = Math.max(0.5, Math.min(1.5, Number(this.speed) || 1));
    const rate = Math.max(0.5, Math.min(3, Number(this.rate) || 1));
    // Without the granular shifter, fold the pitch into playbackRate so the
    // slider still does *something* honest (tape-style; tempo follows).
    const fallbackPitch = this.pitchReady ? 1 : 2 ** (this.pitchSemis / 12);
    return Math.max(0.25, Math.min(4, rate * speed * fallbackPitch));
  }

  /**
   * Should the browser hold the singer's pitch while the tempo moves?
   * Tape mode lets pitch ride the speed dial — the classic "slowed" sound.
   * With the shifter available and tape off, tempo moves alone.
   */
  _preservePitch() {
    return this.pitchReady
      ? !this.tapePitch
      : !this.tapePitch && Math.abs(this.pitchSemis) < 0.01;
  }

  _setPreserve(el, preserve) {
    try {
      el.preservesPitch = preserve;
      el.mozPreservesPitch = preserve;
      el.webkitPreservesPitch = preserve;
    } catch {
      /* ignore */
    }
  }

  /** Effective playbackRate: podcast speed × the "slowed" speed dial. */
  _applyPlayback() {
    // While a hand is on the record the brake owns playbackRate, and pitch is
    // deliberately left to follow the speed (the analog "vrrrrr-stop").
    const target = this.brakeActive
      ? (this._brakeRate ?? this._baseRate())
      : this._baseRate();
    const preserve = this.brakeActive ? false : this._preservePitch();

    [...this.els, this.plain].forEach((el) => {
      try { el.playbackRate = target; } catch { /* ignore */ }
      this._setPreserve(el, preserve);
    });
  }

  /* ---------------- vinyl brake / scratch ---------------- */

  /**
   * Put a hand on the record: ramp the active element's playbackRate down to
   * `floor` with pitch following (preservesPitch = false), then pause once it
   * has come to a stop. Returns false when nothing is playing.
   */
  brakeStart({ duration = 420, floor = 0.05 } = {}) {
    const el = this.el;
    if (!el || el.paused || el.ended) return false;

    this._brakeStop();
    this.brakeActive = true;
    this._brakeWasPlaying = true;
    this._brakeBase = this._baseRate();
    const from = el.playbackRate || this._brakeBase;
    const to = Math.max(0.03, Math.min(Number(floor) || 0.05, this._brakeBase));
    const ms = Math.max(60, Number(duration) || 420);
    const t0 = performance.now();
    this._brakeRate = from;

    this._brakeTick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = p * p; // slip into the stop
      this._brakeRate = from + (to - from) * eased;
      this._applyPlayback();
      if (p < 1) {
        this._brakeRAF = requestAnimationFrame(this._brakeTick);
        return;
      }
      this._brakeRAF = 0;
      this._brakeRate = to;
      this._applyPlayback();
      // Come to a full stop — currentTime freezes, so the lyrics freeze too.
      [...this.els, this.plain].forEach((e) => {
        try { e.pause(); } catch { /* ignore */ }
      });
    };
    this._brakeRAF = requestAnimationFrame(this._brakeTick);
    return true;
  }

  /**
   * Lift the hand: resume from the frozen frame and ramp the rate (and the
   * pitch, which is still following it) back to the transport's normal speed.
   */
  brakeRelease({ duration = 620 } = {}) {
    if (!this.brakeActive) return;

    this._brakeStop();
    const el = this.el;
    const base = this._brakeBase ?? this._baseRate();
    const resume = this._brakeWasPlaying;
    this._brakeWasPlaying = false;
    this._brakeBase = null;

    if (!el || !resume) {
      this._endBrake();
      return;
    }

    // Call play() inside the releasing gesture so browsers don't block it,
    // then glide the rate home while the record spins back up.
    try {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      /* ignore */
    }
    this.resumeCtx();

    const from = Math.max(0.03, this._brakeRate ?? el.playbackRate ?? 0.05);
    const ms = Math.max(60, Number(duration) || 620);
    const t0 = performance.now();
    this._brakeRate = from;
    this._applyPlayback();

    this._brakeTick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) * (1 - p); // spin back up
      this._brakeRate = from + (base - from) * eased;
      this._applyPlayback();
      if (p < 1) {
        this._brakeRAF = requestAnimationFrame(this._brakeTick);
        return;
      }
      this._brakeRAF = 0;
      this._endBrake();
    };
    this._brakeRAF = requestAnimationFrame(this._brakeTick);
  }

  /** Drop any in-flight brake immediately (track change, teardown). */
  brakeCancel() {
    if (!this.brakeActive && !this._brakeRAF) return;
    this._brakeStop();
    this.brakeActive = false;
    this._brakeWasPlaying = false;
    this._brakeBase = null;
    this._brakeRate = null;
    this._applyPlayback();
  }

  _brakeStop() {
    if (this._brakeRAF) {
      cancelAnimationFrame(this._brakeRAF);
      this._brakeRAF = 0;
    }
    this._brakeTick = null;
  }

  _endBrake() {
    this._brakeStop();
    this.brakeActive = false;
    this._brakeWasPlaying = false;
    this._brakeBase = null;
    this._brakeRate = null;
    this._applyPlayback();
    this._emit("brakeend", { rate: this._baseRate() });
  }

  /** Playback speed for podcasts (1× ... 2×). */
  setRate(rate) {
    this.rate = Math.min(3, Math.max(0.5, Number(rate) || 1));
    this._applyPlayback();
  }

  /** The "slowed / nightcore" speed dial (0.5× ... 1.5×), for everything. */
  setSpeed(speed) {
    this.speed = Math.min(1.5, Math.max(0.5, Number(speed) || 1));
    this._applyPlayback();
  }

  /** Boat: should pitch sink with the speed dial? */
  setTape(on) {
    this.tapePitch = !!on;
    this._applyPlayback();
  }

  /** Pitch shift in semitones (-12 ... +12), independent of tempo. */
  setPitch(semis) {
    this.pitchSemis = Math.max(-12, Math.min(12, Number(semis) || 0));
    if (this.graph) {
      this._applyPitchMix();
      this._applyPitchRatio();
    }
    this._applyPlayback();
  }

  _applyPitchRatio() {
    const pitch = this.graph?.pitch;
    if (!pitch?.node) return;
    try {
      const ratio = pitch.node.parameters.get("ratio");
      if (ratio) ratio.value = 2 ** (this.pitchSemis / 12);
    } catch {
      /* ignore */
    }
  }

  _applyPitchMix(instant = false) {
    const pitch = this.graph?.pitch;
    if (!pitch) return;
    // Only run through the shifter when it's actually doing something: the
    // delay-line colours the sound even at 1.0, so 0 st is a true bypass.
    const on = this.pitchReady && Math.abs(this.pitchSemis) > 0.01;
    const t = instant ? 0.01 : 0.07;
    this._param(pitch.dry.gain, on ? 0 : 1, t);
    this._param(pitch.wet.gain, on ? 1 : 0, t);
  }

  async _loadPitchWorklet(ctx) {
    if (this._pitchLoading || this.pitchReady || this.pitchFailed) return;
    this._pitchLoading = true;
    try {
      if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") throw new Error("no AudioWorklet");
      const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
      await ctx.audioWorklet.addModule(`${base}pitch-shifter.js`);
      const g = this.graph;
      if (!g || g.ctx !== ctx) return;

      const node = new AudioWorkletNode(ctx, "grab-pitch", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
      });
      g.pitch.in.connect(node);
      node.connect(g.pitch.wet);
      g.pitch.node = node;
      this.pitchReady = true;
      this._applyPitchRatio();
      this._applyPitchMix(true);
      this._applyPlayback();
      this._emit("fxready", { pitch: true });
    } catch {
      // No worklet (old browser, insecure context, blocked module): pitch
      // falls back to tape-style playbackRate in _applyPlayback.
      this.pitchFailed = true;
      this.pitchReady = false;
    } finally {
      this._pitchLoading = false;
    }
  }

  /* ---------------- reverb ---------------- */

  /** amount 0..1, room: room | hall | cathedral, warmth 0..1 */
  setReverb(amount, room = this.reverbRoom, warmth = this.warmth) {
    this.reverbAmount = clamp01(amount);
    this.reverbRoom = REVERB_ROOMS[room] ? room : "hall";
    this.warmth = clamp01(warmth);
    if (this.graph) {
      this._applyReverb();
      this._applyWarmth();
    }
  }

  _applyWarmth() {
    const warmth = this.graph?.warmth;
    if (!warmth) return;
    // 20kHz (open) -> ~2.8kHz (very muffled)
    const hz = 20000 * 0.14 ** clamp01(this.warmth);
    this._param(warmth.frequency, hz, 0.08);
  }

  _applyReverb() {
    const g = this.graph;
    if (!g) return;
    const amount = clamp01(this.reverbAmount);
    // Keep the dry signal present so the tail sits behind the song, not on it.
    this._param(g.revWet.gain, 0.95 * amount, 0.06);
    this._param(g.revDry.gain, 1 - 0.45 * amount, 0.06);
    if (amount > 0.001) {
      const buf = this._irFor(this.reverbRoom);
      if (buf && g.convolver.buffer !== buf) g.convolver.buffer = buf;
    } else if (g.convolver.buffer) {
      // Reverb off: let the convolver and our cache release the tail buffer.
      g.convolver.buffer = null;
      this._ir = null;
      this._irRoom = null;
    }
  }

  /** Procedurally generated impulse response — no audio files to ship. */
  _irFor(room = "hall") {
    if (!this.graph) return null;
    if (this._ir && this._irRoom === room) return this._ir;

    const ctx = this.graph.ctx;
    const seconds = REVERB_ROOMS[room] || REVERB_ROOMS.hall;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const fadeIn = Math.max(1, Math.floor(ctx.sampleRate * 0.012));

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const noise = Math.random() * 2 - 1;
        lp += (noise - lp) * 0.34; // darken the tail so it never hisses
        const env = Math.pow(1 - t, 2.4) * Math.min(1, i / fadeIn);
        data[i] = lp * env;
      }
    }

    this._ir = buf;
    this._irRoom = room;
    return buf;
  }

  /* ---------------- 8D / spatial audio ---------------- */

  /**
   * Configure the 8D engine.
   *
   * speed: laps per second (0.083 .. 0.125), depth: 0..1 orbit size/elevation,
   * opts:  { mode: "orbit" | "figure8", rear: 0..1, sub: 0..12 dB,
   *          room: boolean, roomSize: studio | club | hall | cathedral,
   *          gyro: boolean }
   *
   * With `gyro` on, the automatic orbit pauses and the two channel satellites
   * follow gyroTracker's live yaw/pitch instead (Live Virtual Stage mode).
   *
   * Returns false when the current track bypasses Web Audio (opaque/CORS);
   * the setting can stay on and will engage on the next graph-mode track.
   */
  setSpatial(on, speed = this.spatialSpeed, depth = this.spatialDepth, opts = {}) {
    this.spatialOn = !!on;
    this.spatialSpeed = Math.max(
      SPATIAL_SLOWEST,
      Math.min(SPATIAL_FASTEST, Number(speed) || SPATIAL_DEFAULT)
    );
    this.spatialDepth = clamp01(depth);
    if (opts && typeof opts === "object") {
      if (opts.mode !== undefined) {
        this.spatialMode = opts.mode === "figure8" ? "figure8" : "orbit";
      }
      if (opts.rear !== undefined) this.spatialRear = clamp01(opts.rear);
      if (opts.sub !== undefined) {
        this.spatialSub = Math.max(0, Math.min(12, Number(opts.sub) || 0));
      }
      if (opts.room !== undefined) {
        const nextRoom = !!opts.room;
        // Toggling the room back on is a manual retry after a CDN failure.
        if (nextRoom && !this.spatialRoom) this.spatialRoomFailed = false;
        this.spatialRoom = nextRoom;
      }
      if (opts.roomSize && SPATIAL_ROOMS[opts.roomSize]) {
        this.spatialRoomSize = opts.roomSize;
      }
      if (opts.gyro !== undefined) this.spatialGyro = !!opts.gyro;
    }
    // Don't spin up an AudioContext just to save a preference; the graph is
    // built on the first play (or by the Sing toggle) and applies this then.
    if (this.graph) {
      if (!this.spatialOn || !this.spatialRoom) this._teardownResonance();
      this._applySub();
      this._applyRoom();
      if (this.spatialOn && this.spatialRoom) this._loadResonance(this.graph.ctx);
    }
    this._updateSpatialLoop();
    return !!this.graph;
  }

  _applySpatial(instant = false) {
    const s = this.graph?.spatial;
    if (!s) return;
    const on = this.spatialOn;
    if (!on || !this.spatialRoom) this._teardownResonance();
    const roomLive = on && this.spatialRoom && this.spatialRoomReady && !!s.room;
    const t = instant ? 0.02 : 0.32;
    // Crossfade the untouched stereo against the fully processed 8D bus.
    this._param(s.dry.gain, on ? 0 : 1, t);
    this._param(s.wet.gain, on ? 1 : 0, t);
    // Feed the spatial chain only while 8D is on (saves CPU when off).
    this._param(s.in.gain, on ? 1 : 0, t);
    // Native panners vs. the Resonance room — equal-ish hand-over.
    this._param(s.panGain.gain, roomLive ? 0 : on ? 1.12 : 0, t);
    this._param(s.roomGain.gain, roomLive ? 1 : 0, t);
    if (!on) this._resetPanners();
  }

  _applySub(instant = false) {
    const sub = this.graph?.spatial?.sub;
    if (!sub) return;
    this._param(sub.shelf.gain, this.spatialSub, instant ? 0.02 : 0.12);
  }

  _applyRoom() {
    const g = this.graph;
    if (!g) return;
    const size = this.spatialRoomSize;
    if (g.spatial.room && this._roomSizeApplied !== size) {
      const preset = SPATIAL_ROOMS[size] || SPATIAL_ROOMS.club;
      try {
        g.spatial.room.setRoomProperties(preset.dimensions, preset.materials);
        this._roomSizeApplied = size;
      } catch {
        /* ignore — keep the previous room */
      }
    }
    this._applySpatial();
  }

  _setPanner(p, x, y, z, smooth = true) {
    if (!p) return;
    const ctx = this.graph?.ctx;
    try {
      if (p.positionX && ctx) {
        const now = ctx.currentTime;
        const tau = smooth ? 0.04 : 0.0001;
        p.positionX.setTargetAtTime(x, now, tau);
        p.positionY.setTargetAtTime(y, now, tau);
        p.positionZ.setTargetAtTime(z, now, tau);
      } else {
        p.setPosition(x, y, z); // older Safari
      }
    } catch {
      /* ignore */
    }
  }

  _resetPanners() {
    const s = this.graph?.spatial;
    if (!s) return;
    s.panners.forEach((p) => this._setPanner(p, 0, 0, -1.6, false));
  }

  /** L/R source positions for the current orbit pattern. */
  _spatialPositions(phase) {
    // Reuse two preallocated xyz triples — this runs every animation frame.
    const buf = this._posBuf || (this._posBuf = [[0, 0, 0], [0, 0, 0]]);
    const depth = this.spatialDepth;
    const radius = 0.55 + depth * 2.4; // 0.55m .. ~2.95m
    const y = Math.sin(phase * 0.5) * (0.1 + depth * 0.7); // lazy vertical drift

    if (this.spatialMode === "figure8") {
      // Mirrored figure-8s: the two channels swap sides as they weave, and
      // pass the back of the head together — a big, cinematic rear sweep.
      const x = Math.sin(phase) * radius;
      const z = Math.sin(phase * 2) * radius * 0.5;
      buf[0][0] = x; buf[0][1] = y; buf[0][2] = z;
      buf[1][0] = -x; buf[1][1] = y; buf[1][2] = z;
      return buf;
    }

    // Classic 8D: left and right satellites orbit opposite each other, so
    // one ear always leads and the stereo image keeps its width.
    buf[0][0] = Math.cos(phase) * radius;
    buf[0][1] = y;
    buf[0][2] = Math.sin(phase) * radius;
    buf[1][0] = Math.cos(phase + Math.PI) * radius;
    buf[1][1] = y;
    buf[1][2] = Math.sin(phase + Math.PI) * radius;
    return buf;
  }

  /**
   * Live Virtual Stage positions. `yawDeg` / `pitchDeg` are already-smoothed
   * relative sensor angles. The stage centre sits on a sphere around the
   * listener and the two stereo satellites stay ±35° apart on that stage.
   */
  _spatialStagePositions(yawDeg, pitchDeg) {
    const buf = this._posBuf || (this._posBuf = [[0, 0, 0], [0, 0, 0]]);
    const radius = 0.55 + this.spatialDepth * 2.4;
    const yaw = ((Number(yawDeg) || 0) * Math.PI) / 180;
    const pitch = (Math.max(-75, Math.min(75, Number(pitchDeg) || 0)) * Math.PI) / 180;
    const spread = (SPATIAL_STAGE_SPREAD * Math.PI) / 180;
    const cosPitch = Math.cos(pitch);
    const y = Math.sin(pitch) * radius;

    // yaw 0 = straight ahead (-Z). Positive yaw moves the stage toward +X
    // (right ear); negative yaw toward -X (left ear). The source itself moves
    // inversely to the phone, so turning right leaves the stage to the left.
    const place = (angle, out) => {
      out[0] = Math.sin(angle) * radius * cosPitch;
      out[1] = y;
      out[2] = -Math.cos(angle) * radius * cosPitch;
    };
    place(yaw - spread, buf[0]); // left channel — slightly further left
    place(yaw + spread, buf[1]); // right channel — slightly further right
    return buf;
  }

  _updateSpatialLoop() {
    const should = this.spatialOn && this.graph && this.mode !== "plain";
    if (should && !this._spatialRAF) {
      const tick = () => {
        this._spatialRAF = 0;
        if (!this.spatialOn || !this.graph || this.mode === "plain") return;
        this._tickSpatial();
        this._spatialRAF = requestAnimationFrame(tick);
      };
      this._spatialLast = 0;
      this._spatialRAF = requestAnimationFrame(tick);
    } else if (!should && this._spatialRAF) {
      cancelAnimationFrame(this._spatialRAF);
      this._spatialRAF = 0;
      this._spatialLast = 0;
    }
  }

  _tickSpatial(force = false) {
    // rAF keeps the stage in sync with the screen and stops in hidden tabs.
    const now = performance.now();
    if (!this._spatialLast) this._spatialLast = now;
    const dt = Math.min(0.05, Math.max(0, (now - this._spatialLast) / 1000));
    this._spatialLast = now;

    const s = this.graph?.spatial;
    if (!s) return;

    // Live Virtual Stage: freeze the automatic orbit while the phone is
    // driving the sound field. gyroTracker is already EMA-smoothed and
    // wrap-safe, so this loop only has to project yaw/pitch onto the sphere.
    const live = this.spatialGyro && gyroTracker.active && gyroTracker.hasData;
    let left;
    let right;
    const radius = 0.55 + this.spatialDepth * 2.4;

    if (live) {
      const { yaw, pitch } = gyroTracker.orientation;
      [left, right] = this._spatialStagePositions(yaw, pitch);
    } else {
      // Clamp dt so returning to a hidden tab (or dragging the speed dial)
      // glides from where the sound was instead of teleporting.
      this._spatialPhase = (this._spatialPhase + dt * this.spatialSpeed * Math.PI * 2) % (Math.PI * 2);
      [left, right] = this._spatialPositions(this._spatialPhase);
    }

    // 1. Fly the two channel-satellites. setTargetAtTime(..., now, 0.04)
    //    inside _setPanner turns every sensor step into a continuous glide.
    this._setPanner(s.panners[0], left[0], left[1], left[2]);
    this._setPanner(s.panners[1], right[0], right[1], right[2]);

    // 2. Rear-head muffler: z > 0 is behind a listener facing -Z. Sweep the
    //    lowpass from 20 kHz (front/side) down to 5 kHz in gyro mode (4.5 kHz
    //    for the classic orbit) when the stage is truly behind the head.
    //    In live mode the stage is one physical object, so its centre yaw
    //    drives the filter — the ±35° satellites still keep their width.
    const rearFloor = live ? SPATIAL_GYRO_REAR_FLOOR : SPATIAL_REAR_FLOOR;
    const liveYaw = live ? (gyroTracker.yaw * Math.PI) / 180 : 0;
    const liveRear = Math.max(0, -Math.cos(liveYaw));
    [left, right].forEach((pos, ch) => {
      const rear = (live
        ? liveRear
        : Math.max(0, Math.min(1, pos[2] / radius))) * this.spatialRear;
      const cutoff = 20000 * (rearFloor / 20000) ** rear;
      const f = s.rear[ch];
      try {
        f.frequency.setTargetAtTime(cutoff, this.graph.ctx.currentTime, 0.04);
      } catch {
        try { f.frequency.value = cutoff; } catch { /* ignore */ }
      }
    });

    // 3. Resonance sources cost a bit more to move — 30 updates/s is plenty
    //    for an orbit, but live head-tracking deserves an update every frame.
    const roomInterval = live ? 16 : 33;
    if (s.room && (force || now - this._spatialRoomLast > roomInterval)) {
      this._spatialRoomLast = now;
      try {
        s.sources[0]?.setPosition(left[0], left[1], left[2]);
        s.sources[1]?.setPosition(right[0], right[1], right[2]);
      } catch {
        /* ignore */
      }
    }
  }

  /** Drop the Resonance scene and all its buffers when 8D/room turns off. */
  _teardownResonance() {
    const s = this.graph?.spatial;
    if (!s?.room) return;
    const scene = s.room;
    const sources = s.sources || [];
    // Detach the room's inputs/outputs so its internal convolution + ambisonic
    // buffers are no longer reachable and can be collected.
    try { s.rear[0]?.disconnect(sources[0]?.input); } catch { /* not connected */ }
    try { s.rear[1]?.disconnect(sources[1]?.input); } catch { /* not connected */ }
    try { scene.output?.disconnect(); } catch { /* ignore */ }
    s.room = null;
    s.sources = [];
    this.spatialRoomReady = false;
    this._roomSizeApplied = null;
  }

  /**
   * Pull Google's Resonance Audio SDK from jsDelivr, wire the two channel
   * satellites into a real acoustic room, then crossfade from the native
   * HRTF panners. If the CDN is blocked the native orbit simply keeps going.
   */
  async _loadResonance(ctx) {
    if (!this.spatialRoom || this.spatialRoomReady || this.spatialRoomFailed || this._roomLoading) return;
    this._roomLoading = true;
    try {
      const RA = await loadResonanceSdk();
      const g = this.graph;
      if (!g || g.ctx !== ctx || !this.spatialRoom) {
        this._roomLoading = false;
        return;
      }
      const preset = SPATIAL_ROOMS[this.spatialRoomSize] || SPATIAL_ROOMS.club;
      const scene = new RA(ctx, {
        ambisonicOrder: 1,
        listenerPosition: [0, 0, 0],
        listenerForward: [0, 0, -1],
        listenerUp: [0, 1, 0],
        dimensions: preset.dimensions,
        materials: preset.materials,
      });
      scene.output.connect(g.spatial.roomGain);

      const makeSource = () => scene.createSource({
        position: [0, 0, -1.6],
        // Keep the orbit inside minDistance so distance attenuation does not
        // pump the level as the satellites fly around.
        minDistance: 4,
        maxDistance: 60,
        rolloff: "logarithmic",
        gain: 1,
      });
      const left = makeSource();
      const right = makeSource();

      // Each Resonance source is mono, and the rear-head filters already sit
      // on each split channel — so the room inherits the same muffling.
      g.spatial.rear[0].connect(left.input);
      g.spatial.rear[1].connect(right.input);
      g.spatial.room = scene;
      g.spatial.sources = [left, right];
      this._roomSizeApplied = this.spatialRoomSize;
      this.spatialRoomReady = true;
      this._roomLoading = false;
      this._tickSpatial(true);
      this._applySpatial();
      this._emit("fxready", { room: true });
    } catch {
      // Offline / blocked CDN / ancient browser: native HRTF stays in charge.
      this.spatialRoomFailed = true;
      this._roomLoading = false;
      this._applySpatial();
    }
  }

  /** UI can poll this to show whether the Resonance room is live. */
  get spatialState() {
    return {
      on: this.spatialOn,
      graph: !!this.graph,
      loading: this._roomLoading,
      roomReady: this.spatialRoomReady,
      roomFailed: this.spatialRoomFailed,
      mode: this.spatialMode,
      gyro: this.spatialGyro,
      gyroActive: this.spatialGyro && gyroTracker.active && gyroTracker.hasData,
      gyroYaw: gyroTracker.yaw,
      gyroPitch: gyroTracker.pitch,
    };
  }

  setEq(enabled, bands) {
    this.eqOn = enabled;
    if (bands) this.eqGains = bands;
    this._applyEq();
  }

  /** Even out loud and quiet tracks with a gentle compressor (Web Audio only). */
  setNormalize(on) {
    this.normalize = !!on;
    this._applyNormalize();
  }

  _applyNormalize(instant = false) {
    const g = this.graph;
    if (!g?.norm) return;
    const t = instant ? 0.01 : 0.06;
    const on = this.normalize;
    this._param(g.norm.threshold, on ? -20 : 0, t);
    this._param(g.norm.knee, on ? 14 : 0, t);
    this._param(g.norm.ratio, on ? 3 : 1, t);
    this._param(g.norm.attack, on ? 0.005 : 0.004, t);
    this._param(g.norm.release, on ? 0.22 : 0.24, t);
    // A little make-up gain so normalisation doesn't just make everything
    // quieter: peaks get squeezed, the average level stays put.
    this._param(g.normGain.gain, on ? 1.3 : 1, t);
  }

  /**
   * Circadian EQ layer (10-band array, dB) mixed under the user's own curve.
   * Pass null to remove it. Works even while the user's EQ is switched off.
   */
  setAmbientEq(bands) {
    this.ambientEq = Array.isArray(bands) ? bands : null;
    this._applyEq();
  }

  /* ---------------- circadian ambient bed ---------------- */

  /**
   * Start / change / stop the procedural background layer.
   *
   * spec: { type, level } — type is one of AMBIENT_SHAPES, level 0..1.
   * Pass null (or level ~0) to fade it out. The bed is synthesised from a
   * pink-noise buffer and shaped by filters + a slow amplitude LFO, so
   * nothing has to be downloaded and every mood is a filter away.
   */
  setAmbient(spec) {
    const type = spec && AMBIENT_SHAPES[spec.type] ? spec.type : null;
    this.ambientType = type;
    this.ambientLevel = clamp01(spec?.level ?? 0);
    if (type && this.ambientLevel > 0.001) {
      try {
        this._ensureGraph();
        this._ambientEnsure();
      } catch {
        this._ambient = null;
      }
    }
    this._applyAmbient(false);
  }

  _ambientEnsure() {
    if (this._ambient) return this._ambient;
    const g = this._ensureGraph();
    if (!g) return null;
    const ctx = g.ctx;

    const src = ctx.createBufferSource();
    src.buffer = this._ambientBuffer(ctx);
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    hp.Q.value = 0.7;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    lp.Q.value = 0.7;

    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = 1500;
    peak.Q.value = 0.9;
    peak.gain.value = 3;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    // Slow amplitude LFO gives rain gusts / wind swells instead of a flat hiss.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.0001;

    src.connect(hp).connect(lp).connect(peak).connect(gain).connect(ctx.destination);
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start(0);
    try {
      src.start(0);
    } catch {
      /* ignore */
    }

    this._ambient = { src, hp, lp, peak, gain, lfo, lfoGain };
    return this._ambient;
  }

  _applyAmbient(instant = false) {
    if (!this._ambient) return;
    const shape = this.ambientType ? AMBIENT_SHAPES[this.ambientType] : null;
    const t = instant ? 0.03 : 0.7;
    const level = this.ambientLevel;
    const target = shape ? Math.max(0.0001, shape.gain * level) : 0.0001;

    this._param(this._ambient.gain.gain, target, t);
    this._param(this._ambient.lfoGain.gain, Math.max(0.0001, target * (shape?.lfoDepth ?? 0.3)), t);
    this._param(this._ambient.lfo.frequency, shape?.lfo ?? 0.06, t);
    if (shape) {
      this._param(this._ambient.hp.frequency, shape.hp, 0.6);
      this._param(this._ambient.lp.frequency, shape.lp, 0.6);
      this._param(this._ambient.peak.frequency, shape.peak, 0.6);
      this._param(this._ambient.peak.gain, shape.peakGain, 0.6);
    }
  }

  /** Pink-ish noise, crossfaded at the seam so a 4s loop is click-free. */
  _ambientBuffer(ctx) {
    if (this._ambientBuf) return this._ambientBuf;
    const len = Math.max(1, Math.floor(ctx.sampleRate * 4));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      brown = (brown + 0.02 * white) / 1.02;
      d[i] = Math.max(-1, Math.min(1, pink * 0.1 + brown * 0.6));
    }

    const fade = Math.min(len - 1, Math.floor(ctx.sampleRate * 0.25));
    for (let i = 0; i < fade; i++) {
      const a = d[len - fade + i];
      const b = d[i];
      const t = i / fade;
      d[len - fade + i] = a * (1 - t) + b * t;
    }

    this._ambientBuf = buf;
    return buf;
  }

  /** Sing mode: 0 = off, 1 = vocals stepped furthest back. */
  setSing(amount) {
    this.singAmount = Math.max(0, Math.min(1, Number(amount) || 0));
    this._ensureGraph();
    this._applySing();
  }

  _applySing() {
    const s = this.graph?.sing;
    if (!s) return;
    const a = this.singAmount;
    try {
      s.dry.gain.value = 1 - 0.45 * a;
      s.wet.gain.value = 0.6 * a;
      s.amount = a;
    } catch {
      /* ignore */
    }
  }
  _applyEq() {
    if (!this.graph) return;
    this.graph.eq.forEach((f, i) => {
      const user = this.eqOn ? this.eqGains[i] || 0 : 0;
      const ambient = this.ambientEq ? this.ambientEq[i] || 0 : 0;
      // Clamp so the user's curve + the weather curve can never clip the chain.
      const target = Math.max(-12, Math.min(12, user + ambient));
      try {
        f.gain.value = target;
      } catch {
        /* ignore */
      }
    });
  }

  get frequency() {
    if (!this.graph || this.mode === "plain") return null;
    const g = this.graph;
    const size = g.analyser.frequencyBinCount;
    if (!g.freqBuf || g.freqBuf.length !== size) g.freqBuf = new Uint8Array(size);
    g.analyser.getByteFrequencyData(g.freqBuf);
    return g.freqBuf;
  }
  get waveform() {
    if (!this.graph || this.mode === "plain") return null;
    const g = this.graph;
    const size = g.analyser.fftSize;
    if (!g.waveBuf || g.waveBuf.length !== size) g.waveBuf = new Uint8Array(size);
    g.analyser.getByteTimeDomainData(g.waveBuf);
    return g.waveBuf;
  }

  /** Real overlapping crossfade to a new URL. */
  async crossfadeTo(url, seconds = 4) {
    this.brakeCancel();
    if (this.mode === "plain" || !this.graph || seconds <= 0) {
      await this.load(url, true, this.mode === "plain" ? 0 : this.active);
      return;
    }
    const from = this.active;
    const to = this.active ^ 1;
    const el = this.els[to];
    el.preload = "auto";
    el.src = url;
    el.currentTime = 0;
    this._gain(to).gain.value = 0.0001;

    // A new source resets element-level settings in some browsers; make sure
    // the slowed/nightcore tempo follows the hand-off.
    this._applyPlayback();

    await this.resumeCtx();
    try {
      await el.play();
    } catch {
      /* ignore */
    }
    this._ramp(from, 0, seconds);
    this._ramp(to, 1, seconds);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const old = this.els[from];
    old.pause();
    // Release the faded-out buffer instead of letting it linger in RAM.
    try {
      old.removeAttribute("src");
      old.preload = "none";
      old.load();
    } catch {
      /* ignore */
    }
    this.active = to;
  }
}

export const engine = new AudioEngine();