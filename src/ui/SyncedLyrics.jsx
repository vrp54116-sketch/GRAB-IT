import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useTheme } from "../theme.jsx";
import { engine } from "../audio/engine.js";
import { readableHighlight } from "./useArtColors.js";

const AmLyricsElement = lazy(() => import("./AmLyricsElement.jsx"));

/* ------------------------------------------------------------------ */
/*  Word-by-word, Apple-Music-style lyrics (binimum/am-lyrics).        */
/*                                                                     */
/*  The <am-lyrics> web component does its own fetching (lrc.red,      */
/*  LyricsPlus, LRCLib, Genius...) and its own animation — we only     */
/*  feed it the clock. A rAF loop reads the live <audio> time so the   */
/*  highlighting stays glued to the track between React updates.       */
/* ------------------------------------------------------------------ */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Host = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  animation: ${fadeIn} .45s ease both;

  am-lyrics {
    width: 100%;
    height: 100%;
    display: block;
    --am-lyrics-highlight-color: ${({ theme }) => theme.text};
    --lyplus-text-secondary: ${({ theme }) => theme.textSoft};
    --am-lyrics-highlight-surface: ${({ theme }) =>
      theme.mode === "dark" ? `${theme.accent}4d` : `${theme.accent2}66`};
    --am-lyrics-highlight-radius: 14px;
    --am-lyrics-wide-font-size: clamp(26px, 3vw, 42px);
    --am-lyrics-compact-font-size: 22px;
    --am-lyrics-wide-selected-position: 26%;
    --am-lyrics-compact-selected-position: 22%;
    --am-lyrics-inline-padding: 6px;
    --lyplus-blur-amount: .035em;
  }

  /* a faint sketchy edge so the lyrics look pinned onto the paper */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 18px;
    box-shadow: inset 0 0 0 1.5px ${({ theme }) => theme.line}14;
  }
`;

const LoadingNote = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 18px;
  color: ${({ theme }) => theme.textSoft};
  padding: 16px 4px;
  animation: ${fadeIn} .4s ease both;
`;

export default function SyncedLyrics({ track, onStatus, onLines, active = true, highlight }) {
  const { duration, seekSeconds, isPlaying, elapsed } = usePlayer();
  const { theme } = useTheme();
  const ref = useRef(null);
  const [status, setStatus] = useState("loading");
  const linesCb = useRef(onLines);
  linesCb.current = onLines;

  /* Hand the rendered lyric lines up to Now Playing so the share card can
     pick from exactly what the listener is looking at — same timing, same
     text, including whatever provider <am-lyrics> ended up using. */
  useEffect(() => {
    if (status !== "ready") {
      linesCb.current?.([]);
      return;
    }
    const sr = ref.current?.shadowRoot;
    if (!sr) return;
    const nodes = [
      ...sr.querySelectorAll(".lyrics-line:not(.lyrics-gap):not(.lyrics-footer)"),
    ];
    const parsed = nodes
      .map((node) => {
        const main = node.querySelector(".main-vocal-container") || node;
        return {
          time: Number(node.getAttribute("data-start-time")) || 0,
          text: (main.textContent || "").replace(/\s+/g, " ").trim(),
        };
      })
      .filter((line) => line.text && !/^[♪\s.]+$/.test(line.text));
    linesCb.current?.(parsed);
  }, [status, track?.id]);

  /* the dominant poster colour, nudged only if it would disappear against
     the current paper / chalkboard */
  const lyricColor = readableHighlight(highlight, theme);

  /* ---- the clock: 60fps straight off the live audio element ----
     (rAF is throttled in occluded tabs, so the player's own
     timeupdate state also pushes the clock below.)
     Only runs while the Now Playing sheet is actually visible. */
  useEffect(() => {
    let raf = 0;
    let lastPaused = null;
    const tick = () => {
      const el = ref.current;
      const audio = engine.el;
      if (el) {
        const t = audio && Number.isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0;
        el.currentTime = t;
        const paused = !(audio && !audio.paused && !audio.ended);
        if (paused !== lastPaused) {
          el.paused = paused;
          lastPaused = paused;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    if (!active) {
      const el = ref.current;
      if (el) el.paused = true;
      return;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  /* fallback clock — fires ~4×/sec with the player, even when rAF sleeps */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = elapsed;
    el.paused = !isPlaying || !active;
  }, [elapsed, isPlaying, status, active]);

  /* ---- theme + duration (drives palette and trailing instrumental dots) ---- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.highlightColor = lyricColor;
    el.setAttribute("highlight-color", lyricColor);
    el.style.setProperty("--am-lyrics-highlight-color", lyricColor);
    el.style.setProperty(
      "--am-lyrics-highlight-surface",
      theme.mode === "dark" ? `${lyricColor}33` : `${lyricColor}26`
    );
    el.style.setProperty("--am-lyrics-glow-radius", "6px");
    el.fontFamily = '"Nunito", system-ui, -apple-system, sans-serif';
    if (duration > 0) el.duration = duration;
  }, [lyricColor, duration, status, theme.mode]);

  /* ---- did we actually get lyrics? watch the shadow DOM ---- */
  useEffect(() => {
    setStatus("loading");
    onStatus?.("loading");
    let alive = true;
    let iv = 0;
    let settled = false;
    const finish = (s) => {
      if (!alive || settled) return;
      settled = true;
      setStatus(s);
      onStatus?.(s);
      clearInterval(iv);
    };
    const look = () => {
      const sr = ref.current?.shadowRoot;
      if (!sr) return;
      if (sr.querySelector(".lyrics-line")) finish("ready");
      else if (sr.querySelector(".no-lyrics")) finish("empty");
    };
    const start = setTimeout(() => {
      look();
      iv = setInterval(look, 400);
    }, 350);
    // give up politely: providers can be slow, but a plain sheet beats skeletons forever
    const bail = setTimeout(() => finish("empty"), 12000);
    return () => {
      alive = false;
      clearTimeout(start);
      clearTimeout(bail);
      clearInterval(iv);
    };
  }, [track?.id, onStatus]);

  /* ---- tap a line to jump there ---- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLine = (e) => {
      const ms = e?.detail?.timestamp;
      if (typeof ms === "number" && Number.isFinite(ms)) seekSeconds(ms / 1000);
    };
    el.addEventListener("line-click", onLine);
    return () => el.removeEventListener("line-click", onLine);
  }, [seekSeconds, status]);

  if (!track) return null;

  const hostStyle = {
    "--am-lyrics-highlight-color": lyricColor,
    "--am-lyrics-highlight-surface":
      theme.mode === "dark" ? `${lyricColor}33` : `${lyricColor}26`,
    "--am-lyrics-glow-radius": "6px",
    ...(status === "empty" ? { display: "none" } : null),
  };

  return (
    <Host style={hostStyle}>
      <Suspense fallback={<LoadingNote>tuning the lyrics…</LoadingNote>}>
        <AmLyricsElement
          key={track.id}
          ref={ref}
          song-title={track.title || ""}
          song-artist={track.artist || ""}
          song-album={track.album || ""}
          query={`${track.title || ""} ${track.artist || ""}`.trim()}
        />
      </Suspense>
    </Host>
  );
}