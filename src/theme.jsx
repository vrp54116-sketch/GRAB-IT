import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ThemeProvider as SCThemeProvider,
  createGlobalStyle,
} from "styled-components";
import { useCircadian } from "./env/CircadianContext.jsx";
import { useSettings } from "./settings/SettingsContext.jsx";

/* ------------------------------------------------------------------ */
/*  GRAB IT! themes — butter paper (light) and espresso night (dark)   */
/*  Brand palette: #FFE695 butter + #342E1B espresso. Every other tone */
/*  is a tint or shade of those two, so the whole app stays warm.      */
/* ------------------------------------------------------------------ */

const BUTTER = "#FFE695";   // brand yellow
const ESPRESSO = "#342E1B"; // brand ink

export const light = {
  mode: "light",
  bg: BUTTER,
  bgAlt: "#FFF4CE",
  surface: "#FFFCF0",
  surfaceAlt: "#FFF2C6",
  text: ESPRESSO,
  textSoft: "#6F5F34",
  line: ESPRESSO,
  accent: "#7F6119",       // ochre ink — reads like the dark pencil line
  accent2: "#F1C34A",      // solid gold, used for fills
  accent3: "#D8AE4B",      // soft gold
  accent4: "#8F7842",      // tan
  good: "#6E7A2E",         // olive, still in the warm family
  onGold: ESPRESSO,        // text on top of accent2 / accent3
  onInk: BUTTER,           // text on top of dark ink fills
  shadow: "rgba(52,46,27,0.26)",
  player: "#FFFCF0",
  chip: "#F7D57A",
  paper: "#FFFCF0",
  paperAlt: "#FFF2C6",
  inkEdge: ESPRESSO,
  inkShadow: "4px 6px 0 0 rgba(52,46,27,0.26)",
  gradient: "linear-gradient(135deg,#FFEFA8 0%,#FFE695 45%,#E8B84A 100%)",
  gradientInk: "linear-gradient(135deg,#7F6119 0%,#C79A2E 55%,#E8B84A 100%)",
};

export const dark = {
  mode: "dark",
  bg: "#1D190E",
  bgAlt: "#282214",
  surface: ESPRESSO,
  surfaceAlt: "#413921",
  text: "#FFEDB8",
  textSoft: "#C0AE7C",
  line: "#0F0C06",
  accent: BUTTER,          // butter becomes the light ink at night
  accent2: "#F1C34A",
  accent3: "#C9A249",
  accent4: "#9C854E",
  good: "#B7C468",
  onGold: ESPRESSO,
  onInk: BUTTER,
  shadow: "rgba(0,0,0,0.58)",
  player: ESPRESSO,
  chip: "#4A3F23",
  paper: ESPRESSO,
  paperAlt: "#413921",
  inkEdge: "#14100A",
  inkShadow: "4px 6px 0 0 rgba(0,0,0,0.58)",
  gradient: "linear-gradient(135deg,#FFE695 0%,#F1C34A 70%,#D8AE4B 100%)",
  gradientInk: "linear-gradient(135deg,#FFE695 0%,#F1C34A 60%,#C9A249 100%)",
};

export const ThemeCtx = createContext({ theme: light, toggle: () => {} });

/* The sky shared by the app background and the full-screen Now Playing sheet.
   Day: a butter-yellow sky, a warm sun glow, cream clouds.
   Night: espresso, a butter moon and a warm horizon haze. */
const DARK_SKY = `radial-gradient(50% 42% at 82% 8%, rgba(255,230,149,.13) 0%, rgba(255,230,149,.05) 30%, transparent 62%),
       radial-gradient(75% 60% at 50% 112%, rgba(138,106,28,.26) 0%, transparent 66%),
       linear-gradient(180deg, #17130A 0%, #241E11 46%, #342E1B 100%)`;

const LIGHT_SKY = `radial-gradient(58% 42% at 84% 5%, rgba(255,252,235,.95) 0%, rgba(255,240,184,.55) 18%, rgba(255,240,184,0) 50%),
       radial-gradient(55% 42% at 14% 88%, rgba(255,253,242,.62) 0%, rgba(255,253,242,0) 62%),
       linear-gradient(180deg, #FFDD7A 0%, #FFE695 40%, #FFF2C6 72%, #FFFBEC 100%)`;

/* The circadian scene lays a translucent wash in front of the base sky, so
   a rainy evening reads cool blue without losing the hand-drawn palette. */
export const skyBg = (theme) => {
  const base = theme.mode === "dark" ? DARK_SKY : LIGHT_SKY;
  const wash = theme.ambient?.wash;
  return wash ? `${wash}, ${base}` : base;
};

export const useTheme = () => useContext(ThemeCtx);

/* ---------------- circadian theme blending ----------------
   Mix a little of the scene's colour into the base tokens. Everything stays
   a tint of the two brand hues; the weather just leans the warmth around. */

const isHex = (v) => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mixHex = (a, b, t) => {
  if (!isHex(a) || !isHex(b)) return a;
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

const rgba = (hex, a) => {
  if (!isHex(hex)) return `rgba(0,0,0,${a})`;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Fold a circadian scene into an existing theme (or return it untouched). */
export function applyAmbience(base, scene) {
  if (!scene || !scene.tint) return { ...base, ambient: null };

  const tint = scene.tint;
  const strength = Math.max(0, Math.min(1, tint.strength ?? 0.35)) * (base.mode === "dark" ? 0.75 : 1);
  const toward = (token, amount) =>
    mixHex(base[token], tint.color, Math.min(0.6, strength * amount));
  const towardAccent = (token, amount) =>
    mixHex(base[token], tint.accent || tint.color, Math.min(0.6, strength * amount));

  const paper = toward("paper", 0.3);
  const accent2 = towardAccent("accent2", 0.45);
  const accent3 = towardAccent("accent3", 0.45);

  return {
    ...base,
    bg: toward("bg", 0.5),
    bgAlt: toward("bgAlt", 0.45),
    surface: toward("surface", 0.28),
    surfaceAlt: toward("surfaceAlt", 0.32),
    paper,
    paperAlt: toward("paperAlt", 0.34),
    player: toward("player", 0.24),
    chip: toward("chip", 0.5),
    accent: towardAccent("accent", 0.5),
    accent2,
    accent3,
    accent4: towardAccent("accent4", 0.4),
    gradient: `linear-gradient(135deg, ${mixHex(paper, tint.color, 0.35)} 0%, ${accent2} 52%, ${accent3} 100%)`,
    ambient: {
      ...scene,
      wash: `radial-gradient(75% 60% at 20% 8%, ${rgba(tint.color, 0.34)} 0%, ${rgba(tint.color, 0)} 62%),
       linear-gradient(180deg, ${rgba(tint.color, 0.22)} 0%, ${rgba(tint.color, 0.07)} 58%, ${rgba(tint.color, 0)} 100%)`,
      glow: rgba(tint.accent || tint.color, 0.5),
    },
  };
}

const STORAGE_KEY = "grabit:theme";

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved =
      typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
    if (saved === "dark") return "dark";
    if (saved === "light") return "light";
    const prefersDark =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  const { scene } = useCircadian();
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || {};
  const base = mode === "dark" ? dark : light;

  /* Circadian & weather adaptation: tint the whole palette + sky. */
  const ambientOn =
    settings.circadian !== false &&
    settings.circadianTheme !== false &&
    !!scene?.enabled;
  const theme = useMemo(
    () => applyAmbience(base, ambientOn ? scene : null),
    [base, ambientOn, scene]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme.mode);
    document.body.dataset.theme = theme.mode;
    if (theme.ambient?.archetype) document.body.dataset.ambient = theme.ambient.archetype;
    else delete document.body.dataset.ambient;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.bg);
  }, [theme]);

  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));

  return (
    <ThemeCtx.Provider value={{ theme, toggle, scene }}>
      <SCThemeProvider theme={theme}>
        <GlobalStyle />
        {children}
      </SCThemeProvider>
    </ThemeCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  The hand-drawn look lives here                                    */
/* ------------------------------------------------------------------ */

export const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }

  html, body, #root { height: 100%; }

  html {
    -webkit-text-size-adjust: 100%;
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
    --mobile-nav-h: 0px;
    --player-h: 0px;
  }

  @media (max-width: 900px) {
    html {
      --mobile-nav-h: calc(56px + var(--safe-bottom));
      --player-h: 66px;
    }
  }

  body {
    margin: 0;
    font-family: "Nunito", system-ui, sans-serif;
    font-weight: 500;
    color: ${({ theme }) => theme.text};
    background-color: ${({ theme }) => theme.bg};
    background-image: ${({ theme }) => skyBg(theme)};
    background-repeat: no-repeat;
    background-size: cover;
    overscroll-behavior: none;
    -webkit-tap-highlight-color: transparent;
    transition: background .6s ease, color .35s ease;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    --v-a: ${({ theme }) => theme.accent};
    --v-b: ${({ theme }) => theme.accent2};
    --paper: ${({ theme }) => theme.paper};
    --paper-alt: ${({ theme }) => theme.paperAlt};
    --ink-edge: ${({ theme }) => theme.inkEdge};
    --ink-shadow: ${({ theme }) => theme.inkShadow};
    --surface-alt: ${({ theme }) => theme.surfaceAlt};
    --ambient-glow: ${({ theme }) => theme.ambient?.glow || "transparent"};
    --ambient-ink: ${({ theme }) => theme.ambient?.tint?.accent || theme.accent};
  }

  /* day: drifting clouds · night: a subtle field of stars */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    transition: opacity .6s ease;
    ${({ theme }) =>
      theme.mode === "dark"
        ? `background-image:
             radial-gradient(1.5px 1.5px at 30px 40px, rgba(255,246,218,.95) 50%, transparent 52%),
             radial-gradient(1px 1px at 120px 92px, rgba(255,246,218,.68) 50%, transparent 52%),
             radial-gradient(1.2px 1.2px at 84px 164px, rgba(255,235,178,.90) 50%, transparent 52%),
             radial-gradient(1px 1px at 206px 28px, rgba(255,246,218,.58) 50%, transparent 52%),
             radial-gradient(1.6px 1.6px at 246px 142px, rgba(255,230,149,.95) 50%, transparent 52%);
           background-size: 260px 220px, 180px 180px, 300px 260px, 220px 200px, 340px 300px;
           background-position: 0 0, 40px 60px, 90px 20px, 150px 120px, 20px 200px;
           background-repeat: repeat;
           opacity: .85;
           animation: starTwinkle 7s ease-in-out infinite alternate;`
        : `background-image:
             radial-gradient(ellipse 360px 96px at 12% 18%, rgba(255,253,242,.55), transparent 70%),
             radial-gradient(ellipse 430px 120px at 82% 10%, rgba(255,253,242,.46), transparent 72%),
             radial-gradient(ellipse 520px 150px at 58% 44%, rgba(255,253,242,.26), transparent 74%);
           background-repeat: no-repeat;
           opacity: .9;
           animation: cloudDrift 70s ease-in-out infinite alternate;`}
  }

  /* day: the sun · night: a soft moon and a violet horizon glow */
  body::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    transition: opacity .6s ease;
    ${({ theme }) =>
      theme.mode === "dark"
        ? `background-image:
             radial-gradient(circle at 84% 8%, rgba(255,246,214,.98) 0 2.7%, rgba(245,231,194,.85) 2.7% 4.3%, rgba(255,230,149,.22) 4.4% 8.6%, transparent 22%),
             radial-gradient(circle at 86.2% 6.2%, rgba(29,25,14,.94) 0 4.1%, transparent 4.35%),
             radial-gradient(circle at 84% 8%, rgba(255,230,149,.16) 0 18%, transparent 42%),
             radial-gradient(ellipse 90% 42% at 50% 116%, rgba(138,106,28,.26), transparent 70%);
           opacity: .9;
           animation: moonGlow 9s ease-in-out infinite alternate;`
        : `background-image:
             radial-gradient(circle at 84% 7%, #fffdf0 0 3.4%, #ffe9a3 3.4% 5.5%, #ffd56e 5.5% 7.2%, rgba(255,210,110,.42) 7.3% 11.5%, rgba(255,210,110,.16) 11.6% 19%, transparent 32%),
             radial-gradient(circle at 84% 7%, rgba(255,238,150,.32) 0 26%, transparent 48%);
           opacity: .95;
           animation: sunPulse 8s ease-in-out infinite alternate;`}
  }

  h1, h2, h3, .hand {
    font-family: "Nunito", system-ui, sans-serif;
    font-weight: 800;
    letter-spacing: -.02em;
  }

  button { font-family: inherit; font-weight: 700; cursor: pointer; }

  /* one soft focus ring for the whole app */
  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.accent};
    outline-offset: 3px;
  }

  ::-webkit-scrollbar { width: 12px; height: 12px; }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.accent};
    background-clip: padding-box;
    border: 3px solid transparent;
    border-radius: 999px;
  }
  ::-webkit-scrollbar-track { background: transparent; }

  a { color: inherit; }

  ::selection { background: ${({ theme }) => theme.accent2}; color: ${({ theme }) => theme.onGold}; }

  /* shared motion — every page/panel can borrow these */
  @keyframes inkIn {
    from { opacity: 0; transform: translateY(14px) rotate(-.6deg) scale(.985); }
    to { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
  }
  @keyframes inkFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes dashGrow {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  @keyframes floaty {
    0%, 100% { transform: translateY(0) rotate(-.4deg); }
    50% { transform: translateY(-5px) rotate(.4deg); }
  }
  @keyframes wobbleTiny {
    0%, 100% { transform: rotate(-1deg); }
    50% { transform: rotate(1deg); }
  }

  /* sky motion */
  @keyframes starTwinkle {
    0% { opacity: .45; }
    50% { opacity: .85; }
    100% { opacity: .6; }
  }
  @keyframes cloudDrift {
    from { transform: translateX(-1.5%) translateY(0); }
    to { transform: translateX(1.5%) translateY(-1%); }
  }
  @keyframes sunPulse {
    from { opacity: .82; transform: scale(1); }
    to { opacity: 1; transform: scale(1.018); }
  }
  @keyframes moonGlow {
    from { opacity: .78; }
    to { opacity: 1; }
  }

  @media (max-width: 900px) {
    /* touch screens: the ambient sky motion is pretty but never worth the
       GPU time on a phone — keep the art, drop the frames. */
    body::before, body::after { animation: none !important; }
    ::-webkit-scrollbar { width: 0; height: 0; }
  }

  @media (hover: none) {
    /* stop sticky :hover states from following a tap around the screen */
    button, a { -webkit-tap-highlight-color: transparent; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

/* ------------------------------------------------------------------ */
/*  Reusable css helpers                                              */
/* ------------------------------------------------------------------ */

/* the hand-cut paper edges that make every control feel drawn */
export const wobbleBorder = (w = 2.6) => `
  border: ${w}px solid var(--ink-edge);
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
`;

export const wobbleBorderAlt = (w = 2.6) => `
  border: ${w}px solid var(--ink-edge);
  border-radius: 15px 225px 15px 255px / 255px 15px 225px 15px;
`;

export const tilt = (deg = -0.6) => `transform: rotate(${deg}deg);`;
