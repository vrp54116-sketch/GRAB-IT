import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import styled, { css, keyframes } from "styled-components";
import { toBlob, getFontEmbedCSS } from "html-to-image";
import { SketchButton, Spinner, Tab, Tag } from "../ui/kit.jsx";
import {
  X, Download, Share, Note, Link as LinkIcon, Check, Play,
} from "../ui/Icons.jsx";
import { partyUrl } from "../lib/share.js";

/* ------------------------------------------------------------------ */
/*  Share a favourite lyric — a poster-grade card, rendered with      */
/*  html-to-image (https://github.com/bubkoo/html-to-image) and       */
/*  exported as a crisp 1080px PNG.                                    */
/*                                                                     */
/*  The card is drawn at its real export size (1080×1920 for Stories,  */
/*  1080×1080 for feeds) and the preview is just a scaled copy.        */
/* ------------------------------------------------------------------ */

const STORY = { w: 1080, h: 1920 };
const SQUARE = { w: 1080, h: 1080 };
const MAX_LINES = 4;
const MIN_LINES = 2;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(14px) rotate(-.6deg) scale(.97); }
  to { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
`;

const h = (color, fallbackHue) => (Number.isFinite(color?.h) ? color.h : fallbackHue);
const s = (color, fallback) => (Number.isFinite(color?.s) ? Math.max(10, color.s) : fallback);
const l = (color, fallback) => (Number.isFinite(color?.l) ? color.l : fallback);

function hsla(color, alpha) {
  return `hsla(${h(color, 42)}, ${s(color, 60)}%, ${l(color, 55)}%, ${alpha})`;
}

/* The poster still paints the whole card, but every tone is pushed into a
   deep, saturated range so cream lyrics always stay readable. */
function cardPalette(art) {
  const p = art?.primary || { h: 42, s: 64, l: 54 };
  const s2 = art?.secondary || { h: 26, s: 58, l: 48 };
  const t = art?.third || p;
  return {
    bg: `linear-gradient(155deg, hsl(${h(p, 42)} 34% 15%) 0%, hsl(${h(s2, 26)} 30% 7%) 58%, hsl(${h(p, 42)} 38% 12%) 100%)`,
    tint: [
      `radial-gradient(70% 55% at 18% 8%, ${hsla(p, 0.6)} 0%, transparent 62%)`,
      `radial-gradient(62% 50% at 88% 20%, ${hsla(s2, 0.5)} 0%, transparent 64%)`,
      `radial-gradient(80% 60% at 50% 108%, ${hsla(t, 0.36)} 0%, transparent 70%)`,
    ].join(", "),
    accent: `hsl(${h(s2, 26)} 88% 78%)`,
    accentInk: `hsl(${h(p, 42)} 68% 30%)`,
    glow: hsla(p, 0.55),
  };
}

/* ---------------- card ---------------- */

const Card = styled.div`
  position: relative;
  width: ${STORY.w}px;
  height: ${({ $format }) => ($format === "story" ? STORY.h : SQUARE.h)}px;
  overflow: hidden;
  isolation: isolate;
  color: #fff7e1;
  font-family: "Nunito", system-ui, -apple-system, sans-serif;
  background: ${({ $bg }) => $bg};

  &::after {
    content: "";
    position: absolute;
    inset: 30px;
    z-index: 6;
    border: 3px dashed rgba(255, 247, 225, .28);
    border-radius: 34px;
    pointer-events: none;
  }
`;

const Backdrop = styled.img`
  position: absolute;
  inset: -9%;
  width: 118%;
  height: 118%;
  object-fit: cover;
  opacity: .26;
  z-index: 0;
  transform: rotate(-2deg) scale(1.04);
`;

const Tint = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  background: ${({ $tint }) => $tint};
`;

const Grain = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  opacity: .12;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
  pointer-events: none;
`;

const Inner = styled.div`
  position: relative;
  z-index: 3;
  height: 100%;
  padding: ${({ $format }) => ($format === "story" ? "66px 72px 58px" : "56px 64px 46px")};
  display: flex;
  flex-direction: column;
`;

const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex: none;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 41px;
  font-weight: 900;
  letter-spacing: -.035em;
  color: #fff9e8;

  svg { width: 41px; height: 41px; }
`;

const CardTag = styled.span`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: .16em;
  padding: 9px 18px;
  color: #fff8e6;
  background: rgba(255, 255, 255, .12);
  border: 2px solid rgba(255, 248, 230, .5);
  border-radius: 999px;
`;

const Middle = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ $format }) => ($format === "story" ? 44 : 24)}px;
`;

const Hero = styled.div`
  display: flex;
  flex-direction: ${({ $format }) => ($format === "story" ? "column" : "row")};
  align-items: center;
  justify-content: center;
  gap: ${({ $format }) => ($format === "story" ? 28 : 34)}px;
  width: 100%;
`;

const PosterWrap = styled.div`
  position: relative;
  flex: none;
  width: ${({ $format }) => ($format === "story" ? "610px" : "238px")};
  height: ${({ $format }) => ($format === "story" ? "610px" : "238px")};
  transform: rotate(-2.1deg);
`;

const PosterClip = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 28px;
  border: 7px solid rgba(255, 248, 230, .96);
  background: rgba(20, 16, 8, .45);
  box-shadow:
    14px 18px 0 rgba(0, 0, 0, .3),
    0 0 0 2px rgba(14, 10, 4, .5);

  img { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

const Tape = styled.span`
  position: absolute;
  top: -24px;
  left: 50%;
  z-index: 2;
  width: 190px;
  height: 46px;
  transform: translateX(-50%) rotate(-3.2deg);
  background: rgba(255, 248, 226, .74);
  border: 2px solid rgba(20, 16, 8, .14);
  box-shadow: 0 3px 0 rgba(0, 0, 0, .16);
`;

const PosterBlank = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: rgba(255, 247, 225, .8);
  background:
    radial-gradient(80% 80% at 30% 20%, rgba(255, 255, 255, .12), transparent 70%),
    rgba(20, 16, 8, .4);
`;

const Meta = styled.div`
  min-width: 0;
  text-align: ${({ $format }) => ($format === "story" ? "center" : "left")};
`;

const SongTitle = styled.div`
  font-size: ${({ $format, $chars }) => {
    const story = $format === "story";
    if ($chars > 30) return story ? "52px" : "33px";
    if ($chars > 20) return story ? "60px" : "39px";
    return story ? "72px" : "47px";
  }};
  font-weight: 900;
  line-height: 1.04;
  letter-spacing: -.035em;
  color: #fffaf0;
  overflow-wrap: anywhere;
`;

const SongArtist = styled.div`
  margin-top: ${({ $format }) => ($format === "story" ? "12px" : "7px")};
  font-size: ${({ $format }) => ($format === "story" ? "36px" : "26px")};
  font-weight: 800;
  letter-spacing: -.01em;
  color: ${({ $accent }) => $accent};
  overflow-wrap: anywhere;
`;

const SongAlbum = styled.div`
  margin-top: 6px;
  font-size: ${({ $format }) => ($format === "story" ? "23px" : "18px")};
  font-weight: 600;
  color: rgba(255, 247, 225, .58);
  overflow-wrap: anywhere;
`;

const Paper = styled.div`
  position: relative;
  width: 100%;
  min-height: ${({ $format }) => ($format === "story" ? "336px" : "0")};
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: ${({ $format }) => ($format === "story" ? "54px 58px 46px" : "34px 44px 30px")};
  color: #2e2718;
  background-color: #fff8e6;
  background-image: radial-gradient(rgba(52, 46, 27, .045) 1px, transparent 1px);
  background-size: 7px 7px;
  border: 5px solid #161007;
  border-radius: 26px 10px 24px 12px / 12px 24px 10px 26px;
  box-shadow: 12px 14px 0 rgba(0, 0, 0, .32);
  transform: rotate(.55deg);
  overflow: hidden;
`;

const Quote = styled.span`
  position: absolute;
  top: -12px;
  left: 20px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: ${({ $format }) => ($format === "story" ? "150px" : "108px")};
  line-height: 1;
  color: ${({ $accent }) => $accent};
  opacity: .2;
  pointer-events: none;
`;

const Lines = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ $format }) => ($format === "story" ? "10px" : "6px")};
  text-align: center;
  font-size: ${({ $size }) => `${$size}px`};
  font-weight: 800;
  line-height: 1.28;
  letter-spacing: -.025em;
  text-wrap: balance;
  overflow-wrap: anywhere;
`;

const CardLine = styled.div`
  margin: 0;

  &:last-child { color: ${({ $accent }) => $accent}; }
`;

const Scribble = styled.svg`
  display: block;
  width: ${({ $format }) => ($format === "story" ? "176px" : "132px")};
  height: 16px;
  margin: ${({ $format }) => ($format === "story" ? "24px" : "16px")} auto 0;
  overflow: visible;
  path {
    fill: none;
    stroke: ${({ $accent }) => $accent};
    stroke-width: 3.4;
    stroke-linecap: round;
    opacity: .85;
  }
`;

const Foot = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-size: 25px;
  font-weight: 600;
  color: rgba(255, 247, 225, .72);

  b { color: #fff9e8; font-weight: 900; }
`;

const Eq = styled.span`
  display: inline-flex;
  align-items: flex-end;
  gap: 4px;
  height: 26px;
  margin-right: 2px;

  i {
    display: block;
    width: 5px;
    border-radius: 2px;
    background: ${({ $accent }) => $accent};
  }
  i:nth-child(1) { height: 12px; }
  i:nth-child(2) { height: 21px; }
  i:nth-child(3) { height: 16px; }
  i:nth-child(4) { height: 26px; }
  i:nth-child(5) { height: 14px; }
`;

const FootDot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 247, 225, .4);
`;

function lyricSize(lines, format) {
  const chars = lines.join(" ").length;
  const base = format === "story" ? 60 : 43;
  const factor = chars > 190 ? 0.66 : chars > 140 ? 0.76 : chars > 95 ? 0.87 : chars > 55 ? 0.95 : 1;
  return Math.round(base * factor);
}

/* ---------------- modal ---------------- */

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 95;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(12, 9, 4, .74);
  backdrop-filter: blur(9px);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  transition: opacity .25s ease;
`;

const Panel = styled.div`
  width: min(1120px, 96vw);
  max-height: 92dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 410px;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  border: 2.6px solid ${({ theme }) => theme.inkEdge};
  border-radius: 24px 10px 22px 12px / 12px 22px 10px 24px;
  box-shadow: 9px 11px 0 0 ${({ theme }) => theme.shadow};
  overflow: hidden;
  animation: ${popIn} .3s cubic-bezier(.2, 1.1, .35, 1) both;

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(620px, 96vw);
    max-height: 94dvh;
    overflow-y: auto;
  }
`;

const Stage = styled.div`
  position: relative;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 22px;
  background:
    radial-gradient(80% 70% at 20% 10%, rgba(255, 230, 149, .12), transparent 65%),
    radial-gradient(70% 60% at 90% 90%, rgba(255, 230, 149, .08), transparent 65%),
    #17130b;

  @media (max-width: 940px) {
    padding: 16px;
    min-height: ${({ $format }) => ($format === "story" ? "44vh" : "38vh")};
  }
`;

const PreviewBox = styled.div`
  position: relative;
  width: 100%;
  height: ${({ $format }) => ($format === "story" ? "min(60vh, 620px)" : "min(46vh, 470px)")};
  min-height: 260px;

  @media (max-width: 940px) {
    height: ${({ $format }) => ($format === "story" ? "40vh" : "34vh")};
    min-height: 220px;
  }
`;

const PreviewScale = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  filter: drop-shadow(0 22px 34px rgba(0, 0, 0, .5));
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 18px 18px 16px;
  border-left: 2.4px solid ${({ theme }) => theme.inkEdge};
  background-color: ${({ theme }) => theme.surfaceAlt};
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0 33px,
    ${({ theme }) => theme.line}12 33px 34px
  );

  @media (max-width: 940px) {
    border-left: none;
    border-top: 2.4px solid ${({ theme }) => theme.inkEdge};
    padding: 16px;
  }
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: none;
`;

const HeadText = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 23px;
  line-height: 1.1;
`;

const Sub = styled.p`
  margin: 5px 0 0;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.35;
  color: ${({ theme }) => theme.textSoft};
`;

const CloseBtn = styled.button`
  appearance: none;
  flex: none;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.inkEdge};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  box-shadow: 2px 3px 0 ${({ theme }) => theme.shadow};
  transition: transform .16s ease, box-shadow .16s ease;
  &:hover { transform: rotate(-7deg) scale(1.06); }
  &:active { transform: translate(1px, 1px); box-shadow: none; }
`;

const FormatRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 12px;
  flex: none;
`;

const PickHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  margin-bottom: 8px;

  .count {
    margin-left: auto;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 12.5px;
    font-weight: 800;
    color: ${({ theme, $ok }) => ($ok ? theme.good : theme.textSoft)};
  }
`;

const LineList = styled.div`
  position: relative;
  flex: 1;
  min-height: 120px;
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 6px 8px 2px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 14px), transparent);
`;

const PickLine = styled.button`
  appearance: none;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  padding: 8px 10px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: transparent;
  color: ${({ theme, $on }) => ($on ? theme.text : theme.textSoft)};
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 14px;
  font-weight: ${({ $on }) => ($on ? 800 : 600)};
  line-height: 1.35;
  transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease;

  &:hover { background: ${({ theme }) => theme.surface}; transform: translateX(1px); }

  .dot {
    flex: none;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 2px solid ${({ theme, $on }) => ($on ? theme.inkEdge : theme.textSoft)};
    background: ${({ theme, $on }) => ($on ? theme.accent2 : "transparent")};
    color: ${({ theme }) => theme.onGold};
  }

  .txt { flex: 1; min-width: 0; }

  .now {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.accent};
  }

  ${({ $on, theme }) =>
    $on &&
    css`
      background: ${theme.surface};
      border-color: ${theme.accent};
      box-shadow: 2px 3px 0 0 ${theme.shadow};
    `}
`;

const Stepper = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
  padding: 9px 0 4px;
  border-top: 2px dashed ${({ theme }) => theme.line}2b;
  margin-top: 4px;

  .n {
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 12.5px;
    font-weight: 800;
    min-width: 62px;
    text-align: center;
  }
`;

const StepBtn = styled.button`
  appearance: none;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  border: 2px solid ${({ theme }) => theme.inkEdge};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 1px 2px 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover:not(:disabled) { transform: translateY(-1px) rotate(-2deg); }
  &:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: none; }
  &:disabled { opacity: .38; cursor: not-allowed; }
`;

const Hint = styled.div`
  min-height: 17px;
  margin: 2px 0 8px;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme, $warn }) => ($warn ? theme.accent : theme.textSoft)};
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: none;

  > * { flex: 1; min-width: 0; justify-content: center; }
`;

const SmallLink = styled.button`
  appearance: none;
  align-self: center;
  margin-top: 9px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textSoft};
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  border-radius: 8px;
  transition: color .16s ease, background .16s ease;
  &:hover { color: ${({ theme }) => theme.accent}; background: ${({ theme }) => theme.surface}; }
`;

const Busy = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Empty = styled.div`
  padding: 18px 8px;
  text-align: center;
  color: ${({ theme }) => theme.textSoft};
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.45;
`;

const CaptureHost = styled.div`
  position: fixed;
  top: 0;
  left: -200000px;
  z-index: -1;
  width: ${STORY.w}px;
  height: ${STORY.h}px;
  pointer-events: none;
  opacity: 0;
`;

/* ---------------- helpers ---------------- */

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* Inline the poster so the PNG never depends on a third-party CORS header
   at capture time. Falls back to the original URL if the fetch is blocked. */
async function posterDataUrl(url) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  try {
    const res = await fetch(url, { mode: "cors", referrerPolicy: "no-referrer" });
    if (!res.ok) return url;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return url;
    return await blobToDataUrl(blob);
  } catch {
    return url;
  }
}

function slugFor(track) {
  return `${track?.artist || "grab-it"}-${track?.title || "lyrics"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "grab-it-lyric";
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const waitForImages = (node) => Promise.all(
  [...node.querySelectorAll("img")].map((img) => {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  })
);

export default function LyricShare({
  open, onClose, track, poster, art, lines = [], elapsed = 0, notify,
}) {
  const [format, setFormat] = useState("story");
  const [range, setRange] = useState(null);
  const [busy, setBusy] = useState(false);
  const [posterSrc, setPosterSrc] = useState(poster || "");
  const [scale, setScale] = useState(0.2);

  const captureRef = useRef(null);
  const boxRef = useRef(null);
  const listRef = useRef(null);
  const fontCssRef = useRef(null);
  const fontCssTried = useRef(false);

  const dims = format === "story" ? STORY : SQUARE;
  const palette = useMemo(() => cardPalette(art), [art]);

  const clean = useMemo(
    () => (lines || [])
      .map((line) => ({
        text: String(line?.text ?? "").replace(/\s+/g, " ").trim(),
        time: Number(line?.time) || 0,
      }))
      .filter((line) => line.text && !/^[♪\s.]+$/.test(line.text)),
    [lines]
  );
  const cleanLines = useMemo(() => clean.map((line) => line.text), [clean]);

  /* the line being sung when the sheet opened — a lovely place to start */
  const activeIndex = useMemo(() => {
    let found = -1;
    clean.forEach((line, i) => {
      if (line.time <= Number(elapsed || 0)) found = i;
    });
    return found;
  }, [clean, elapsed]);

  const startAtRef = useRef(0);
  useEffect(() => {
    if (open) startAtRef.current = Math.max(0, activeIndex);
    // capture the moment of opening, not every playback tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, track?.id]);

  const selected = useMemo(() => {
    if (!range || !cleanLines.length) return [];
    const a = Math.max(0, Math.min(range[0], range[1]));
    const b = Math.min(cleanLines.length - 1, Math.max(range[0], range[1]));
    return cleanLines.slice(a, b + 1);
  }, [range, cleanLines]);

  const count = selected.length;
  const canExport = count >= MIN_LINES;

  /* fresh auto-selection whenever the sheet opens or the song changes */
  useEffect(() => {
    if (!open || !cleanLines.length) {
      setRange(null);
      return;
    }
    const len = cleanLines.length;
    const anchor = Math.min(Math.max(0, startAtRef.current), len - 1);
    const start = Math.min(anchor, Math.max(0, len - 3));
    const end = Math.min(len - 1, start + 2);
    setRange([start, end]);
  }, [open, track?.id, cleanLines.length]);

  /* inline poster for a CORS-proof capture */
  useEffect(() => {
    let alive = true;
    if (!open) return undefined;
    setPosterSrc(poster || "");
    posterDataUrl(poster).then((src) => {
      if (alive && src) setPosterSrc(src);
    });
    return () => { alive = false; };
  }, [open, poster]);

  /* scaled preview */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => {
      const next = Math.min(
        box.clientWidth / dims.w,
        box.clientHeight / dims.h
      );
      setScale(Math.max(0.05, Math.min(next, 1)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dims.w, dims.h, open]);

  /* start the picker on the selected line */
  useEffect(() => {
    if (!open || !range) return;
    const box = listRef.current;
    if (!box) return;
    const first = box.querySelector('[data-on="true"]');
    if (!first) return;
    box.scrollTop = Math.max(0, first.offsetTop - box.clientHeight / 2 + first.clientHeight / 2);
  }, [open, range?.[0], range?.[1], format]);

  /* escape closes the sheet */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const threeFrom = useCallback((index) => {
    const len = cleanLines.length;
    const start = Math.min(Math.max(0, index), Math.max(0, len - 3));
    return [start, Math.min(len - 1, start + 2)];
  }, [cleanLines.length]);

  const pickLine = useCallback((index) => {
    setRange((current) => {
      if (!current) return threeFrom(index);
      const start = Math.min(current[0], current[1]);
      const end = Math.max(current[0], current[1]);

      /* inside the block: slide the whole block so this line starts it */
      if (index >= start && index <= end) return threeFrom(index);

      /* just outside: grow the block, up to 4 lines */
      const nextStart = Math.min(start, index);
      const nextEnd = Math.max(end, index);
      if (nextEnd - nextStart + 1 <= MAX_LINES) return [nextStart, nextEnd];

      /* too far away: start a fresh 3-line block here */
      return threeFrom(index);
    });
  }, [threeFrom]);

  const bump = (delta) => {
    setRange((current) => {
      if (!current || !cleanLines.length) return current;
      const start = Math.min(current[0], current[1]);
      const end = Math.max(current[0], current[1]);
      const nextEnd = Math.min(cleanLines.length - 1, end + delta);
      if (nextEnd < start) return current;
      if (nextEnd === end) return current;
      return [start, nextEnd];
    });
  };

  const ensureFontCss = async () => {
    if (fontCssRef.current || fontCssTried.current) return;
    fontCssTried.current = true;
    try {
      if (captureRef.current) {
        fontCssRef.current = await getFontEmbedCSS(captureRef.current);
      }
    } catch {
      /* text will fall back to the system sans — still a perfectly good card */
    }
  };

  const buildBlob = useCallback(async () => {
    const node = captureRef.current;
    if (!node) throw new Error("card is not ready yet");

    try { await document.fonts?.ready; } catch { /* keep going */ }
    await waitForImages(node);
    await ensureFontCss();

    const base = {
      cacheBust: false,
      pixelRatio: 1,
      width: dims.w,
      height: dims.h,
      backgroundColor: "#0d0a05",
    };

    /* 1) with the embedded Nunito, 2) let the library try, 3) skip fonts */
    const attempts = [
      fontCssRef.current ? { ...base, fontEmbedCSS: fontCssRef.current } : base,
      base,
      { ...base, skipFonts: true },
    ];

    let lastError = null;
    for (const options of attempts) {
      try {
        const blob = await toBlob(node, options);
        if (blob) return blob;
        lastError = new Error("the canvas came back empty");
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("could not draw the card");
  }, [dims.w, dims.h]);

  const share = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    try {
      const blob = await buildBlob();
      const file = new File([blob], `${slugFor(track)}.png`, { type: "image/png" });
      const text = `${selected.join("\n")}\n\n— ${track.artist || "unknown"} · ${track.title || ""}`;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: track.title, text });
          notify?.("Card shared 🎉");
        } catch (err) {
          if (err?.name !== "AbortError") throw err;
        }
      } else {
        download(blob, file.name);
        notify?.("Saved your card — open Instagram or WhatsApp and share it 📲");
      }
    } catch (err) {
      console.error("[grab-it] lyric card", err);
      notify?.("Couldn't draw that card — try again?");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    try {
      const blob = await buildBlob();
      download(blob, `${slugFor(track)}-${format}.png`);
      notify?.("PNG saved — crisp and ready to post ✨");
    } catch (err) {
      console.error("[grab-it] lyric card", err);
      notify?.("Couldn't draw that card — try again?");
    } finally {
      setBusy(false);
    }
  };

  const copyParty = async () => {
    if (!track) return;
    const url = partyUrl(track, elapsed);
    try {
      await navigator.clipboard.writeText(url);
      notify?.("Party link copied — send it to a friend 🎉");
    } catch {
      notify?.(`Party link: ${url}`);
    }
  };

  if (!track || !open) return null;

  const size = lyricSize(selected, format);
  const cardProps = {
    track,
    poster: posterSrc,
    lines: selected,
    format,
    palette,
    size,
  };

  return (
    <Scrim $open={open} aria-hidden={!open} onClick={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <Panel role="dialog" aria-modal="true" aria-label="Share a lyric card">
        <Stage $format={format}>
          <PreviewBox ref={boxRef} $format={format}>
            <PreviewScale
              style={{
                width: dims.w,
                height: dims.h,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            >
              <CardView {...cardProps} />
            </PreviewScale>
          </PreviewBox>
        </Stage>

        <Controls>
          <Head>
            <HeadText>
              <Title>Grab a lyric</Title>
              <Sub>Pick 2–4 lines, choose a shape, and post the moment.</Sub>
            </HeadText>
            <CloseBtn onClick={onClose} aria-label="Close share card"><X size={19} /></CloseBtn>
          </Head>

          <FormatRow>
            <Tab $on={format === "story"} onClick={() => setFormat("story")}>Story 9:16</Tab>
            <Tab $on={format === "square"} onClick={() => setFormat("square")}>Post 1:1</Tab>
          </FormatRow>

          {cleanLines.length ? (
            <>
              <PickHead $ok={canExport}>
                <Tag>Choose your moment</Tag>
                <span className="count">{count} / {MAX_LINES} lines</span>
              </PickHead>

              <LineList ref={listRef}>
                {cleanLines.map((text, i) => {
                  const on = range
                    ? i >= Math.min(range[0], range[1]) && i <= Math.max(range[0], range[1])
                    : false;
                  return (
                    <PickLine
                      key={`${i}-${text}`}
                      type="button"
                      data-on={on ? "true" : undefined}
                      $on={on}
                      onClick={() => pickLine(i)}
                      aria-pressed={on}
                    >
                      <span className="dot">{on && <Check size={11} />}</span>
                      <span className="txt">{text}</span>
                      {i === activeIndex && (
                        <span className="now"><Play size={9} /> now</span>
                      )}
                    </PickLine>
                  );
                })}
              </LineList>

              <Stepper>
                <StepBtn
                  type="button"
                  onClick={() => bump(-1)}
                  disabled={count <= 1}
                  aria-label="One less line"
                >−</StepBtn>
                <span className="n">{count} line{count === 1 ? "" : "s"}</span>
                <StepBtn
                  type="button"
                  onClick={() => bump(1)}
                  disabled={count >= MAX_LINES || (
                    range && Math.max(range[0], range[1]) >= cleanLines.length - 1
                  )}
                  aria-label="One more line"
                >+</StepBtn>
                <span style={{ flex: 1 }} />
                <Tag>{count >= 2 ? "tap another line to extend" : "pick at least 2"}</Tag>
              </Stepper>
              <Hint $warn={!canExport}>
                {!canExport
                  ? "Tap one more line — a share card needs two."
                  : count >= MAX_LINES
                    ? "That's the max — four lines keeps it readable."
                    : "Your card updates as you pick."}
              </Hint>
            </>
          ) : (
            <Empty>
              No lyrics landed for this one 🤷<br />
              Try another track — or let this one just vibe.
            </Empty>
          )}

          <ActionRow>
            <SketchButton
              type="button"
              $variant="accent"
              onClick={share}
              disabled={!canExport || busy}
            >
              {busy ? <Busy><Spinner /> brewing…</Busy> : <><Share size={17} /> Share</>}
            </SketchButton>
            <SketchButton
              type="button"
              onClick={save}
              disabled={!canExport || busy}
            >
              <Download size={17} /> Save PNG
            </SketchButton>
          </ActionRow>

          <SmallLink type="button" onClick={copyParty}>
            <LinkIcon size={14} /> or copy the listening-party link
          </SmallLink>
        </Controls>
      </Panel>

      <CaptureHost aria-hidden="true">
        <div ref={captureRef}>
          <CardView {...cardProps} />
        </div>
      </CaptureHost>
    </Scrim>
  );
}

/* ------------------------------------------------------------------ */
/*  The card itself                                                    */
/* ------------------------------------------------------------------ */

function CardView({ track, poster, lines, format, palette, size }) {
  const eq = [0, 1, 2, 3, 4];
  const title = track?.title || "Untitled";
  return (
    <Card $format={format} $bg={palette.bg}>
      {poster ? <Backdrop src={poster} alt="" crossOrigin="anonymous" /> : null}
      <Tint $tint={palette.tint} />
      <Grain />

      <Inner $format={format}>
        <Top>
          <Brand>
            <HandMark />
            GRAB IT!
          </Brand>
          <CardTag>LYRIC CARD</CardTag>
        </Top>

        <Middle $format={format}>
          <Hero $format={format}>
            <PosterWrap $format={format}>
              <Tape />
              <PosterClip>
                {poster ? (
                  <img src={poster} alt="" crossOrigin="anonymous" />
                ) : (
                  <PosterBlank><Note size={64} /></PosterBlank>
                )}
              </PosterClip>
            </PosterWrap>

            <Meta $format={format}>
              <SongTitle $format={format} $chars={title.length}>{title}</SongTitle>
              <SongArtist $format={format} $accent={palette.accent}>
                {track?.artist || "Unknown artist"}
              </SongArtist>
              {(track?.album || track?.year) && (
                <SongAlbum $format={format}>
                  {[track?.album, track?.year].filter(Boolean).join(" · ")}
                </SongAlbum>
              )}
            </Meta>
          </Hero>

          <Paper $format={format}>
            <Quote $format={format} $accent={palette.accentInk}>“</Quote>
            <Lines $format={format} $size={size}>
              {lines.map((line, i) => (
                <CardLine key={i} $accent={palette.accentInk}>{line}</CardLine>
              ))}
            </Lines>
            <Scribble $format={format} $accent={palette.accentInk} viewBox="0 0 180 16" aria-hidden="true">
              <path d="M3 11c22-7 41-8 60-4 17 4 33 5 52 1 20-4 37-3 61 3" />
            </Scribble>
          </Paper>
        </Middle>

        <Foot>
          <Eq $accent={palette.accent} aria-hidden="true">
            {eq.map((i) => <i key={i} />)}
          </Eq>
          <span>made with <b>GRAB IT!</b></span>
          <FootDot />
          <span>music you can grab</span>
        </Foot>
      </Inner>
    </Card>
  );
}

function HandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 11V6.4a1.3 1.3 0 0 1 2.6 0V11M11.1 11V5.2a1.3 1.3 0 0 1 2.6 0V11M13.7 11.2V6.6a1.3 1.3 0 0 1 2.6 0V14c0 3.4-2.2 6-5.6 6-3 0-4.8-1.8-5.4-4.4L4.6 12a1.3 1.3 0 0 1 2.3-1.1l1.6 2.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}