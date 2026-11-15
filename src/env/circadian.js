/* ------------------------------------------------------------------ */
/*  Circadian & weather scene builder                                  */
/*                                                                     */
/*  Turns the local clock + live weather (Open-Meteo, free, key-less)  */
/*  into one "scene" descriptor that the whole app can wear:           */
/*    • tint  — colours the theme + sky are shifted toward             */
/*    • eq    — a subtle 10-band curve layered under the user's EQ     */
/*    • bed   — a procedural background sound layer (rain, wind, ...)  */
/*    • fx    — which ambient sky effect to draw                       */
/*                                                                     */
/*  Pure logic, no React and no DOM, so it is easy to reason about.    */
/* ------------------------------------------------------------------ */

import { get, set } from "../lib/store.js";
import { EQ_FREQS } from "../settings/SettingsContext.jsx";

export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export const COORDS_KEY = "circadian:coords";
export const WEATHER_KEY = "circadian:weather";

/** How long a fetched weather reading stays fresh. */
export const WEATHER_TTL = 20 * 60 * 1000;

/* ---------------- WMO weather codes ---------------- */

const WMO = {
  0: { condition: "clear", label: "Clear sky", emoji: "☀️" },
  1: { condition: "clear", label: "Mainly clear", emoji: "🌤️" },
  2: { condition: "cloudy", label: "Partly cloudy", emoji: "⛅" },
  3: { condition: "cloudy", label: "Overcast", emoji: "☁️" },
  45: { condition: "fog", label: "Fog", emoji: "🌫️" },
  48: { condition: "fog", label: "Rime fog", emoji: "🌫️" },
  51: { condition: "drizzle", label: "Light drizzle", emoji: "🌦️" },
  53: { condition: "drizzle", label: "Drizzle", emoji: "🌦️" },
  55: { condition: "drizzle", label: "Heavy drizzle", emoji: "🌧️" },
  56: { condition: "drizzle", label: "Freezing drizzle", emoji: "🌧️" },
  57: { condition: "drizzle", label: "Freezing drizzle", emoji: "🌧️" },
  61: { condition: "rain", label: "Light rain", emoji: "🌦️" },
  63: { condition: "rain", label: "Rain", emoji: "🌧️" },
  65: { condition: "rain", label: "Heavy rain", emoji: "🌧️" },
  66: { condition: "rain", label: "Freezing rain", emoji: "🌧️" },
  67: { condition: "rain", label: "Freezing rain", emoji: "🌧️" },
  71: { condition: "snow", label: "Light snow", emoji: "🌨️" },
  73: { condition: "snow", label: "Snow", emoji: "❄️" },
  75: { condition: "snow", label: "Heavy snow", emoji: "❄️" },
  77: { condition: "snow", label: "Snow grains", emoji: "🌨️" },
  80: { condition: "rain", label: "Rain showers", emoji: "🌦️" },
  81: { condition: "rain", label: "Rain showers", emoji: "🌧️" },
  82: { condition: "rain", label: "Violent showers", emoji: "⛈️" },
  85: { condition: "snow", label: "Snow showers", emoji: "🌨️" },
  86: { condition: "snow", label: "Snow showers", emoji: "❄️" },
  95: { condition: "thunder", label: "Thunderstorm", emoji: "⛈️" },
  96: { condition: "thunder", label: "Thunder + hail", emoji: "⛈️" },
  99: { condition: "thunder", label: "Thunder + hail", emoji: "⛈️" },
};

const UNKNOWN_SKY = { condition: "unknown", label: "Sky unknown", emoji: "🌡️" };

/** Map a WMO weather code to a small, friendly description. */
export function weatherInfo(code) {
  if (code === null || code === undefined) return UNKNOWN_SKY;
  return WMO[Number(code)] || UNKNOWN_SKY;
}

/* ---------------- time of day ---------------- */

export const PHASES = {
  night: { label: "Night", emoji: "🌙" },
  dawn: { label: "Dawn", emoji: "🌅" },
  morning: { label: "Morning", emoji: "🌞" },
  afternoon: { label: "Afternoon", emoji: "🌤️" },
  golden: { label: "Golden hour", emoji: "🌇" },
  evening: { label: "Evening", emoji: "🌆" },
};

/** The local-clock part of the scene (independent of weather). */
export function dayPhase(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 5) return "night";
  if (h < 8) return "dawn";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 19.5) return "golden";
  if (h < 22) return "evening";
  return "night";
}

/* ---------------- archetypes ---------------- */
/*  Nine moods the app can settle into. Each one carries the theme tint,
   the gentle EQ curve (dB per band, keyed by frequency so it always
   lines up with EQ_FREQS) and the ambient bed spec. */

const curve = (db) => EQ_FREQS.map((f) => db[f] ?? 0);

export const ARCHETYPES = {
  sunnyMorning: {
    adjective: "Sunny",
    tint: { color: "#FFD36E", accent: "#E8A93A", strength: 0.34 },
    eq: curve({ 32: -1, 64: -1, 125: 0, 250: 0, 500: 1, 1000: 2, 2000: 3, 4000: 3, 8000: 2, 16000: 1 }),
    ambient: { type: "breeze", level: 0.3 },
    fx: "sun",
  },
  sunnyDay: {
    adjective: "Bright",
    tint: { color: "#FFE79A", accent: "#F1C34A", strength: 0.26 },
    eq: curve({ 32: -1, 64: 0, 125: 0, 250: 0, 500: 1, 1000: 1, 2000: 2, 4000: 2, 8000: 1, 16000: 1 }),
    ambient: { type: "breeze", level: 0.22 },
    fx: "sun",
  },
  goldenEvening: {
    adjective: "Golden",
    tint: { color: "#FF9E5C", accent: "#E07A3C", strength: 0.42 },
    eq: curve({ 32: 1, 64: 2, 125: 2, 250: 3, 500: 2, 1000: 1, 2000: 0, 4000: -1, 8000: -1, 16000: -2 }),
    ambient: { type: "wind", level: 0.28 },
    fx: "sun",
  },
  clearNight: {
    adjective: "Clear",
    tint: { color: "#3A4A8C", accent: "#8FA6E8", strength: 0.4 },
    eq: curve({ 32: -2, 64: -2, 125: -1, 250: 0, 500: 1, 1000: 2, 2000: 2, 4000: 1, 8000: 0, 16000: -1 }),
    ambient: { type: "night", level: 0.3 },
    fx: "none",
  },
  cloudy: {
    adjective: "Cloudy",
    tint: { color: "#B9B2A0", accent: "#8C8578", strength: 0.3 },
    eq: curve({ 32: 0, 64: 0, 125: 0, 250: 1, 500: 1, 1000: 1, 2000: 1, 4000: 0, 8000: 0, 16000: 0 }),
    ambient: { type: "wind", level: 0.3 },
    fx: "none",
  },
  rain: {
    adjective: "Rainy",
    tint: { color: "#4E7FB8", accent: "#5C8FD6", strength: 0.46 },
    // warm low-mids up, sparkle gently tucked away — the "rainy evening" curve
    eq: curve({ 32: 1, 64: 2, 125: 3, 250: 2, 500: 1, 1000: 0, 2000: -1, 4000: -1, 8000: -2, 16000: -2 }),
    ambient: { type: "rain", level: 0.5 },
    fx: "rain",
  },
  storm: {
    adjective: "Stormy",
    tint: { color: "#3A3F63", accent: "#6E77B0", strength: 0.5 },
    eq: curve({ 32: 3, 64: 3, 125: 2, 250: 1, 500: 0, 1000: -1, 2000: -2, 4000: -2, 8000: -2, 16000: -3 }),
    ambient: { type: "storm", level: 0.55 },
    fx: "storm",
  },
  snow: {
    adjective: "Snowy",
    tint: { color: "#BFD8EE", accent: "#88A9CC", strength: 0.42 },
    eq: curve({ 32: -2, 64: -1, 125: -1, 250: 0, 500: 0, 1000: 1, 2000: 2, 4000: 3, 8000: 3, 16000: 2 }),
    ambient: { type: "snow", level: 0.35 },
    fx: "snow",
  },
  fog: {
    adjective: "Foggy",
    tint: { color: "#A9A79C", accent: "#8A8880", strength: 0.36 },
    eq: curve({ 32: 0, 64: 1, 125: 2, 250: 2, 500: 1, 1000: 0, 2000: 0, 4000: -1, 8000: -1, 16000: -1 }),
    ambient: { type: "fog", level: 0.28 },
    fx: "fog",
  },
};

/** Pick the mood that fits the clock + weather. */
export function pickArchetype(phase, condition) {
  const night = phase === "night";
  switch (condition) {
    case "thunder":
      return "storm";
    case "snow":
      return "snow";
    case "fog":
      return "fog";
    case "rain":
      return "rain";
    case "drizzle":
      return "rain";
    case "cloudy":
      return "cloudy";
    case "clear":
      break;
    default:
      break;
  }
  // clear sky (or no weather at all): follow the sun
  if (night) return "clearNight";
  if (phase === "golden" || phase === "evening") return "goldenEvening";
  if (phase === "dawn" || phase === "morning") return "sunnyMorning";
  return "sunnyDay";
}

function composeLabel(phase, info, archetype) {
  const ph = PHASES[phase]?.label || "Now";
  if (info && info.condition !== "unknown") {
    return `${ARCHETYPES[archetype].adjective} ${ph.toLowerCase()}`;
  }
  // no live weather — describe the light honestly
  if (phase === "night") return "Late night";
  if (phase === "golden") return "Golden hour";
  if (phase === "dawn") return "Dawn light";
  return `${ph} light`;
}

/**
 * Build the full scene descriptor.
 *
 * @param {object}  opts
 * @param {Date}    opts.now      local time to read (defaults to now)
 * @param {object?} opts.weather  a reading from fetchWeather (or null)
 * @param {boolean} opts.enabled  is the feature switched on?
 */
export function buildScene({ now = new Date(), weather = null, enabled = true } = {}) {
  const phase = dayPhase(now);
  const info = weather ? weatherInfo(weather.code) : UNKNOWN_SKY;
  const arch = ARCHETYPES[pickArchetype(phase, info.condition)];

  return {
    enabled: !!enabled,
    at: now.getTime(),
    phase,
    phaseLabel: PHASES[phase].label,
    phaseEmoji: PHASES[phase].emoji,
    condition: info.condition,
    conditionLabel: weather ? info.label : null,
    weatherCode: weather?.code ?? null,
    tempC: weather?.tempC ?? null,
    wind: weather?.wind ?? null,
    humidity: weather?.humidity ?? null,
    isDay: weather?.isDay ?? phase !== "night",
    archetype: pickArchetype(phase, info.condition),
    label: composeLabel(phase, weather ? info : null, pickArchetype(phase, info.condition)),
    emoji: weather && info.condition !== "unknown" ? info.emoji : PHASES[phase].emoji,
    tint: arch.tint,
    eq: arch.eq,
    ambient: arch.ambient,
    fx: arch.fx,
    hasWeather: !!weather,
  };
}

/* ---------------- network ---------------- */

/** Live current weather from Open-Meteo (no key, CORS-friendly). */
export async function fetchWeather(lat, lon, signal) {
  const url =
    `${OPEN_METEO}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
    "&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m" +
    "&timezone=auto";
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`weather request failed (${res.status})`);
  const j = await res.json();
  const c = j.current || {};
  return {
    code: c.weather_code ?? null,
    tempC: c.temperature_2m ?? null,
    wind: c.wind_speed_10m ?? null,
    humidity: c.relative_humidity_2m ?? null,
    isDay: c.is_day === 1,
    at: Date.now(),
  };
}

/** One-shot geolocation with a sane timeout; rejects if unavailable/denied. */
export function getCoords({ timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: +pos.coords.latitude.toFixed(3),
          lon: +pos.coords.longitude.toFixed(3),
        }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout, maximumAge: 15 * 60 * 1000 }
    );
  });
}

/* ---------------- tiny cache helpers ---------------- */

export function cachedWeather() {
  const c = get(WEATHER_KEY, null);
  return c && c.at && Date.now() - c.at < WEATHER_TTL ? c : null;
}

/** Any cached reading, fresh or not — shown while a refresh is in flight. */
export function storedWeather() {
  const c = get(WEATHER_KEY, null);
  return c && c.at ? c : null;
}

export function cachedCoords() {
  return get(COORDS_KEY, null);
}

export function saveCoords(coords) {
  set(COORDS_KEY, coords);
}

export function saveWeather(weather) {
  set(WEATHER_KEY, weather);
}
