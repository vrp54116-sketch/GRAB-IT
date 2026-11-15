import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { get, set } from "../lib/store.js";

export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/* 8D orbit speed. Medium-slow on purpose — a roomy 8–12s circle feels like
   live surround, while a fast spin just feels dizzy. Stored as Hz internally. */
export const SPATIAL_SLOWEST = 1 / 12; // 12s per circle
export const SPATIAL_FASTEST = 1 / 8; // 8s per circle
export const SPATIAL_DEFAULT = 1 / 10; // 10s per circle
export const SPATIAL_ROOM_SIZES = ["studio", "club", "hall", "cathedral"];

export const DEFAULT_SETTINGS = {
  /* playback */
  quality: "auto", // auto | lossless | high  (your server: raw FLAC vs 320k MP3)
  crossfade: 0, // seconds, 0..12
  gapless: true,
  lyricBridge: true, // peek the next poster + opening lyric through the hand-off
  normalize: false, // even out loud / quiet tracks on the Web Audio graph
  autoplayRadio: true, // keep playing when a list ends

  /* equalizer */
  eqEnabled: false,
  eqBands: EQ_FREQS.map(() => 0), // dB, -12..12
  presets: {},

  /* slowed + reverb (real-time effects on the Web Audio graph) */
  speed: 1, // 0.5 .. 1.5 — the "slowed / nightcore" tempo dial
  pitch: 0, // semitones, -12 .. 12 — independent pitch shift
  tapePitch: true, // true = pitch sinks with the speed dial (classic slowed edit)
  reverb: 0, // 0 .. 1 wet mix
  reverbRoom: "hall", // room | hall | cathedral
  warmth: 0, // 0 .. 1 lowpass damping for the lofi tone

  /* 8D / spatial audio (binaural HRTF orbit on the Web Audio graph) */
  spatial: false, // orbit the mix around the listener
  spatialSpeed: SPATIAL_DEFAULT, // Hz — 10s per orbit (UI constrains 8–12s)
  spatialDepth: 0.8, // 0 .. 1 orbit radius + vertical drift
  spatialMode: "orbit", // orbit (opposite L/R) | figure8 (weaving L/R)
  spatialRear: 1, // 0 .. 1 rear-head muffler depth (20 kHz -> 4.5 kHz)
  spatialSub: 4, // dB low-shelf on the centred sub-bass anchor
  spatialRoom: true, // Google Resonance acoustic room (jsDelivr)
  spatialRoomSize: "club", // studio | club | hall | cathedral
  spatialGyro: false, // phone-motion head-tracking — live virtual stage

  /* sources */
  subsonic: { url: "", user: "", password: "", enabled: false },

  /* circadian & weather adaptive player */
  circadian: true, // master switch — theme + EQ + ambience follow clock & weather
  circadianTheme: true, // shift the palette + sky with the scene
  circadianEq: true, // layer a gentle EQ curve under the user's own EQ
  circadianAmbience: true, // play the subtle background sound layer
  circadianAmbienceLevel: 0.5, // 0..1 — scales the bed

  /* look */
  visualizer: true,
  visualizerStyle: "bars", // bars | circle | wave
  animations: true,
  zenMode: true, // hide the chrome after a few still seconds while music plays
  posterTilt: true, // 3D parallax tilt + glossy sheen on album artwork

  /* behaviour */
  historyEnabled: true,
  showPodcastsOnHome: true,
  sleepTimerDefault: 30, // minutes
};

const Ctx = createContext(null);
export const useSettings = () => useContext(Ctx);

const KEY = "settings";

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = get(KEY, {}) || {};
    const merged = {
      ...DEFAULT_SETTINGS,
      ...saved,
      subsonic: { ...DEFAULT_SETTINGS.subsonic, ...(saved.subsonic || {}) },
    };
    // keep older saved values inside the medium-slow 8–12s window
    const hz = Number(merged.spatialSpeed);
    merged.spatialSpeed = hz > 0
      ? Math.min(SPATIAL_FASTEST, Math.max(SPATIAL_SLOWEST, hz))
      : SPATIAL_DEFAULT;
    merged.spatialDepth = Math.min(1, Math.max(0, Number(merged.spatialDepth) || 0));
    merged.spatialRear = merged.spatialRear === undefined
      ? 1
      : Math.min(1, Math.max(0, Number(merged.spatialRear) || 0));
    merged.spatialSub = Math.min(12, Math.max(0, Number(merged.spatialSub) || 0));
    merged.spatialMode = merged.spatialMode === "figure8" ? "figure8" : "orbit";
    merged.spatialRoomSize = SPATIAL_ROOM_SIZES.includes(merged.spatialRoomSize)
      ? merged.spatialRoomSize
      : "club";
    merged.spatialGyro = !!merged.spatialGyro;
    merged.circadianAmbienceLevel = Math.min(
      1,
      Math.max(0, Number.isFinite(Number(merged.circadianAmbienceLevel)) ? Number(merged.circadianAmbienceLevel) : 0.5)
    );
    return merged;
  });

  useEffect(() => set(KEY, settings), [settings]);

  const update = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const setBand = useCallback((i, db) => {
    setSettings((s) => {
      const bands = s.eqBands.slice();
      bands[i] = db;
      return { ...s, eqBands: bands };
    });
  }, []);

  const resetEq = useCallback(() => {
    setSettings((s) => ({ ...s, eqBands: EQ_FREQS.map(() => 0) }));
  }, []);

  const applyEqPreset = useCallback((name) => {
    setSettings((s) => {
      const p = PRESETS[name];
      return p ? { ...s, eqBands: p.slice(), eqEnabled: true } : s;
    });
  }, []);

  const applyFxPreset = useCallback((name) => {
    const p = FX_PRESETS[name];
    if (p) setSettings((s) => ({ ...s, ...p }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ settings, update, setBand, resetEq, applyEqPreset, applyFxPreset, reset, EQ_FREQS }),
    [settings, update, setBand, resetEq, applyEqPreset, applyFxPreset, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const PRESETS = {
  Flat: EQ_FREQS.map(() => 0),
  "Bass Boost": [8, 6, 4, 2, 0, 0, 0, 1, 2, 3],
  "Late Night": [-4, -3, -2, 0, 1, 2, 2, 1, 0, -1],
  Party: [6, 5, 3, 0, -1, 0, 2, 3, 4, 5],
  Vocal: [-2, -1, 0, 2, 3, 3, 2, 1, 0, -1],
  "Podcast Clarity": [-6, -4, -1, 2, 4, 4, 3, 2, 1, 0],
};

/* One-tap presets for the speed / pitch / reverb / 8D dials. */
const SPATIAL_OFF = {
  spatial: false, spatialSpeed: SPATIAL_DEFAULT, spatialDepth: 0.8,
  spatialMode: "orbit", spatialRear: 1, spatialSub: 4,
  spatialRoom: true, spatialRoomSize: "club",
};

export const FX_PRESETS = {
  "Slowed + Reverb": {
    speed: 0.8, pitch: 0, tapePitch: true, reverb: 0.55, reverbRoom: "hall", warmth: 0.45,
    ...SPATIAL_OFF,
  },
  Nightcore: {
    speed: 1.3, pitch: 0, tapePitch: true, reverb: 0.1, reverbRoom: "room", warmth: 0.05,
    ...SPATIAL_OFF,
  },
  Vaporwave: {
    speed: 0.72, pitch: 0, tapePitch: true, reverb: 0.5, reverbRoom: "cathedral", warmth: 0.6,
    ...SPATIAL_OFF,
  },
  Cathedral: {
    speed: 1, pitch: 0, tapePitch: true, reverb: 0.75, reverbRoom: "cathedral", warmth: 0.3,
    ...SPATIAL_OFF,
  },
  "8D Concert": {
    speed: 1, pitch: 0, tapePitch: true, reverb: 0.32, reverbRoom: "hall", warmth: 0.08,
    spatial: true, spatialSpeed: SPATIAL_DEFAULT, spatialDepth: 1,
    spatialMode: "orbit", spatialRear: 1, spatialSub: 4,
    spatialRoom: true, spatialRoomSize: "club",
  },
  Off: {
    speed: 1, pitch: 0, tapePitch: true, reverb: 0, reverbRoom: "hall", warmth: 0,
    ...SPATIAL_OFF,
  },
};

/** Is any effect (speed / pitch / reverb / warmth) currently doing something? */
export const fxActive = (s) =>
  Math.abs(s.speed - 1) > 0.001 ||
  Math.abs(s.pitch) > 0.001 ||
  s.reverb > 0.001 ||
  s.warmth > 0.001;
