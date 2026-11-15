import { useEffect, useState } from "react";
import { getColorSync, getPaletteSync } from "colorthief";

/**
 * Pulls a dominant colour + palette out of album art (the poster resolved by
 * `album-art`) with color-thief — https://github.com/lokesh/color-thief — so
 * the player can "wear the record" like Octave.
 *
 * Results are cached per URL. Needs CORS on the image (Archive, Audius, Deezer
 * and mzstatic all allow it); failures are silent and simply leave the normal
 * theme colours in place.
 *
 * The returned object carries:
 *   hex / palette    – the dominant colour and the full extracted palette
 *   a1 / a2          – translucent primary / secondary (player bar washes)
 *   glowA / glowB / glowC – RGBA tokens for blurred background glows
 *   gradient         – a ready-made layered radial gradient
 *   shade            – a deep tone from the dominant hue
 */

const cache = new Map();
const inflight = new Map();
const CACHE_MAX = 120; // keep the last ~120 covers; older ones can be re-extracted

function remember(url, value) {
  if (cache.has(url)) cache.delete(url);
  cache.set(url, value);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

/* ------------------------------------------------------------------ */
/*  colour helpers                                                     */
/* ------------------------------------------------------------------ */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hsla(color, alpha) {
  return `hsl(${color.h} ${color.s}% ${color.l}% / ${alpha})`;
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  if (!a || !b) return hex;
  const m = (x, y) => Math.round(x + (y - x) * amount);
  return `#${[m(a.r, b.r), m(a.g, b.g), m(a.b, b.b)]
    .map((v) => clamp(v, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Keep the extracted colour as the highlight, but nudge it toward white/black
 * if it would vanish against the paper / chalkboard. Returns the theme ink when
 * even a full nudge cannot reach a readable contrast.
 */
export function readableHighlight(hex, theme) {
  if (!hex || !theme?.bg) return theme?.text || "#fff";
  const toward = theme.mode === "dark" ? "#ffffff" : "#000000";
  let out = hex;
  for (let i = 0; i < 10 && contrastRatio(out, theme.bg) < 3; i += 1) {
    out = mix(out, toward, 0.1);
  }
  return contrastRatio(out, theme.bg) >= 3 ? out : theme.text;
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* ------------------------------------------------------------------ */
/*  extraction                                                         */
/* ------------------------------------------------------------------ */

function load(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function toColor(entry) {
  const hex = entry.hex();
  const { h, s, l } = entry.hsl();
  return {
    hex,
    h,
    s,
    l,
    proportion: entry.proportion ?? 0,
    isDark: entry.isDark,
    isLight: entry.isLight,
  };
}

async function extract(url) {
  const img = await load(url);
  if (!img || !img.naturalWidth) return null;

  try {
    const raw = getPaletteSync(img, {
      colorCount: 6,
      quality: 8,
      colorSpace: "oklch",
    });
    const dominant = getColorSync(img, { quality: 8, colorSpace: "oklch" });
    const palette = (raw?.length ? raw : dominant ? [dominant] : []).map(toColor);
    if (!palette.length || !dominant) return null;

    const primary = toColor(dominant);
    const rest = palette.filter((c) => c.hex !== primary.hex);

    /* Glows need colours that actually emit light. A near-black sleeve can
       dominate the count, so rank the palette by vibrancy instead of area and
       lift anything muddy into a usable glow range. */
    const lift = (c) => ({
      ...c,
      l: clamp(c.l, 34, 78),
      s: clamp(c.s, 24, 84),
    });
    const vibrancy = (c) =>
      (c.s / 100) * (0.35 + 0.65 * (1 - Math.abs(c.l - 58) / 58));
    const vivid = palette
      .map(lift)
      .sort((a, b) => vibrancy(b) - vibrancy(a));

    const glow1 = vivid[0] || lift(primary);
    const glow2 =
      vivid.find((c) => c.hex !== glow1.hex && hueDistance(c.h, glow1.h) > 22) ||
      vivid[1] ||
      lift(primary);
    const glow3 =
      vivid.find(
        (c) =>
          c.hex !== glow1.hex &&
          c.hex !== glow2.hex &&
          hueDistance(c.h, glow1.h) > 14 &&
          hueDistance(c.h, glow2.h) > 14
      ) ||
      vivid[1] ||
      lift(primary);

    /* the secondary should actually *look* different: prefer a far hue with
       some saturation, so the two glows don't collapse into one colour */
    const secondary =
      [...rest]
        .sort((a, b) => {
          const score = (c) =>
            (hueDistance(c.h, primary.h) / 180) * 0.7 + (c.s / 100) * 0.3;
          return score(b) - score(a);
        })[0] || primary;

    const third =
      rest.find((c) => c.hex !== secondary.hex && hueDistance(c.h, secondary.h) > 18) ||
      rest[0] ||
      primary;

    const shade = {
      ...primary,
      l: clamp(primary.l * 0.35, 8, 22),
      s: clamp(primary.s, 25, 75),
    };

    const gradient = [
      `radial-gradient(70% 70% at 16% 14%, ${rgba(glow1.hex, 0.5)} 0%, transparent 62%)`,
      `radial-gradient(64% 64% at 84% 20%, ${rgba(glow2.hex, 0.42)} 0%, transparent 64%)`,
      `radial-gradient(90% 68% at 50% 104%, ${rgba(glow3.hex, 0.32)} 0%, transparent 66%)`,
    ].join(", ");

    return {
      hex: primary.hex,
      highlight: primary.hex, // feed straight into <am-lyrics highlight-color>
      palette: palette.map((c) => c.hex),
      colors: palette,
      primary,
      secondary,
      third,
      c1: `hsl(${primary.h} ${primary.s}% ${primary.l}%)`,
      c2: `hsl(${secondary.h} ${secondary.s}% ${secondary.l}%)`,
      a1: hsla(glow1, 0.4),
      a2: hsla(glow2, 0.32),
      glowA: rgba(glow1.hex, 0.55),
      glowB: rgba(glow2.hex, 0.46),
      glowC: rgba(glow3.hex, 0.34),
      shade: `hsl(${shade.h} ${shade.s}% ${shade.l}%)`,
      gradient,
    };
  } catch {
    /* tainted canvas / unsupported image — fall back to theme colours */
    return null;
  }
}

export function useArtColors(url) {
  const [colors, setColors] = useState(() => (url && cache.get(url)) || null);

  useEffect(() => {
    if (!url) {
      setColors(null);
      return;
    }
    if (cache.has(url)) {
      setColors(cache.get(url));
      return;
    }
    let alive = true;
    setColors(null);
    if (!inflight.has(url)) {
      inflight.set(
        url,
        extract(url).then((c) => {
          remember(url, c);
          inflight.delete(url);
          return c;
        })
      );
    }
    inflight.get(url).then((c) => {
      if (alive) setColors(c);
    });
    return () => { alive = false; };
  }, [url]);

  return colors;
}