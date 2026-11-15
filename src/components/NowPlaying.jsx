import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";
import { getLyricsMeta } from "../api/music.js";
import { useCircadian } from "../env/CircadianContext.jsx";
import { parseLRC, activeLine, fmtTime, clamp } from "../lib/format.js";
import Visualizer from "../ui/Visualizer.jsx";
import SyncedLyrics from "../ui/SyncedLyrics.jsx";
import VinylPoster from "../ui/VinylPoster.jsx";
import { TabBar, Tab, IconButton, Chip, Spinner, Badge, Slider, SketchButton } from "../ui/kit.jsx";
import { engine } from "../audio/engine.js";
import { useArtColors } from "../ui/useArtColors.js";
import { useTrackPoster } from "../ui/usePoster.js";
import { useZen, zenHide } from "../ui/ZenMode.jsx";
import FxControls from "./FxControls.jsx";
import SpatialControls, { useSpatial } from "./SpatialControls.jsx";
import AddToPlaylist from "./AddToPlaylist.jsx";
import DownloadButton from "./DownloadButton.jsx";
import {
  Heart, Shuffle, Repeat, Play, Pause, Next, Prev, X, Timer, ChevronUp, ChevronDown,
  Trash, Mic, ListMusic, Sparkle, Share, Waves, Spatial,
} from "../ui/Icons.jsx";
import { wobbleBorder, skyBg } from "../theme.jsx";
import { fxActive } from "../settings/SettingsContext.jsx";
import LyricShare from "./LyricShare.jsx";

const rise = keyframes`
  from { opacity: 0; transform: translateY(18px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

/* the poster's palette breathing behind the sheet */
const drift = keyframes`
  0%   { transform: translate3d(-2%, -1%, 0) scale(1.04) rotate(-1deg); }
  50%  { transform: translate3d(2%, 1.5%, 0) scale(1.1) rotate(1deg); }
  100% { transform: translate3d(-1%, 2%, 0) scale(1.05) rotate(-.5deg); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  overflow: hidden;
  color: ${({ theme }) => theme.text};
  background:
    radial-gradient(120% 90% at 15% 0%, var(--np-a, ${({ theme }) => theme.accent}33) 0%, transparent 55%),
    radial-gradient(120% 90% at 90% 100%, var(--np-b, ${({ theme }) => theme.accent4}33) 0%, transparent 55%),
    ${({ theme }) => skyBg(theme)};
  transform: translateY(${({ $open }) => ($open ? "0" : "100%")});
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  visibility: ${({ $open }) => ($open ? "visible" : "hidden")};
  transition:
    transform .42s cubic-bezier(.2,1,.25,1),
    opacity .3s ease,
    visibility 0s ${({ $open }) => ($open ? "0s" : ".42s")};
  will-change: ${({ $open }) => ($open ? "transform, opacity" : "auto")};
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--safe-top) 0 var(--safe-bottom);
  isolation: isolate;

  /* hand-drawn border around the whole sheet */
  &::before {
    content: "";
    position: absolute;
    inset: 10px;
    border: 2.6px dashed ${({ theme }) => theme.line}2e;
    border-radius: 18px;
    pointer-events: none;
    opacity: ${({ $open, $zen }) => ($open && !$zen ? 1 : 0)};
    transition: opacity .6s ease .1s;
  }
`;

/* Blurred, glowing colour field distilled from the poster palette.
   It sits under the UI and slowly drifts while a song plays.
   Phones get the soft gradients alone; desktop adds a light blur. */
const GlowField = styled.div`
  position: absolute;
  inset: -18%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(44% 44% at 22% 24%, var(--np-glow-a, transparent) 0%, transparent 78%),
    radial-gradient(38% 38% at 78% 32%, var(--np-glow-b, transparent) 0%, transparent 78%),
    radial-gradient(52% 44% at 52% 94%, var(--np-glow-c, transparent) 0%, transparent 80%);
  opacity: ${({ $active }) => ($active ? 0.9 : 0.55)};
  animation: ${drift} 24s ease-in-out infinite alternate;
  transition: opacity .8s ease;
  will-change: transform;

  /* Desktop gets the extra-soft bloom; phones keep the gradients only,
     because a full-screen animated blur is expensive there. */
  @media (min-width: 901px) and (prefers-reduced-motion: no-preference) {
    filter: blur(26px) saturate(1.14);
  }

  @media (max-width: 900px) {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Top = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 16px 20px;
  ${zenHide}
  transition: opacity .6s ease;
  @media (max-width: 640px) {
    padding: 10px 12px;
    gap: 6px;
    /* Sing and Visualizer move into the FX tab where there's room */
    .sing, .viz, .sky { display: none; }
  }
`;

/* FX controls that only appear on phones — the header keeps the 4 essentials. */
const PhoneOnly = styled.div`
  display: none;
  @media (max-width: 640px) {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
`;

const Body = styled.div`
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 40%) 1fr;
  gap: 26px;
  padding: 0 26px 12px;
  overflow: hidden;
  animation: ${rise} .4s ease both;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 16px;
    padding: 0 16px 8px;
  }
`;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  @media (max-height: 560px) and (max-width: 900px) {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
`;

/* Everything under the record — title, palette, seek, transport, visualizer.
   One wrapper so Zen Mode can melt the whole stack away while the glowing
   poster stays put. */
const LeftChrome = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  ${zenHide}
  transition: opacity .6s ease;
`;

const ArtWrap = styled.div`
  position: relative;
  isolation: isolate;
`;

const BrakeHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: -4px;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 12.5px;
  color: ${({ theme }) => theme.textSoft};
  opacity: .78;
  transition: opacity .3s ease, color .3s ease;
  ${({ $braking, theme }) =>
    $braking &&
    css`
      color: ${theme.accent};
      opacity: 1;
    `}
`;

/* a soft halo of the poster's own colours bleeding out behind the cover */
const ArtGlow = styled.div`
  position: absolute;
  inset: 7%;
  z-index: 0;
  border-radius: 50%;
  background:
    radial-gradient(60% 60% at 30% 30%, var(--np-glow-a, transparent) 0%, transparent 72%),
    radial-gradient(60% 60% at 70% 70%, var(--np-glow-b, transparent) 0%, transparent 72%);
  filter: blur(34px) saturate(1.2);
  opacity: .7;
  transform: translateY(9px) scale(1.03);
  transition: opacity .5s ease;
  pointer-events: none;
  @media (prefers-reduced-motion: reduce) { filter: blur(26px); }
`;

const Title = styled.h1`
  font-size: clamp(22px, 3vw, 34px);
  margin: 0;
  line-height: 1.1;
`;

const Artist = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 17px;
  color: ${({ theme }) => theme.textSoft};
  margin-top: -6px;
`;

/* the palette color-thief pulled off the poster — tap a chip to copy its hex */
const PaletteStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  button {
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
    border: 1.8px solid ${({ theme }) => theme.inkEdge};
    box-shadow: 1px 2px 0 0 ${({ theme }) => theme.shadow};
    cursor: pointer;
    transition: transform .16s cubic-bezier(.2,1.3,.4,1), box-shadow .16s ease;
    &:hover { transform: translateY(-2px) rotate(9deg); box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow}; }
    &:active { transform: translateY(1px) scale(.94); box-shadow: 0 1px 0 0 ${({ theme }) => theme.shadow}; }
  }

  .hex {
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 11px;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textSoft};
    margin-left: 2px;
  }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const BigPlay = styled.button`
  appearance: none;
  width: 66px; height: 66px;
  display: grid; place-items: center;
  border-radius: 50%;
  border: 2.6px solid ${({ theme }) => theme.inkEdge};
  background: ${({ theme }) => theme.accent2};
  color: ${({ theme }) => theme.onGold};
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: scale(1.06) rotate(4deg); box-shadow: 5px 6px 0 0 ${({ theme }) => theme.shadow}; }
  &:active { transform: translate(2px,2px) scale(.97); box-shadow: 1px 1px 0 0 ${({ theme }) => theme.shadow}; }
`;

const SeekRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13px;
  color: ${({ theme }) => theme.textSoft};
`;

const Right = styled.div`
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background-color: ${({ theme }) => theme.surfaceAlt};
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0 33px,
    ${({ theme }) => theme.line}12 33px 34px
  );
  ${wobbleBorder(2.6)}
  box-shadow:
    4px 5px 0 0 ${({ theme }) => theme.shadow},
    0 0 52px -22px var(--np-glow-a, transparent);
  transition: background-color .6s ease, border-color .6s ease, box-shadow .6s ease;

  /* Zen: drop the panel's paper, ink border and shadow so the lyrics float
     free — but keep the lyrics themselves untouched. */
  ${({ $zen }) =>
    $zen &&
    css`
      background-color: transparent;
      background-image: none;
      border-color: transparent;
      box-shadow: none;
    `}

  @media (max-width: 640px) { padding: 10px; }
`;

/* The tab strip fades as one piece in Zen. */
const ZenTabBar = styled(TabBar)`
  ${zenHide}
  transition: opacity .6s ease;
`;

const LyricsScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px 8px 40px;
  mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 82%, transparent);
  scroll-behavior: smooth;
`;

const LyricLine = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: clamp(19px, 2.4vw, 30px);
  line-height: 1.5;
  padding: 6px 0;
  color: ${({ theme, $active }) => ($active ? "transparent" : theme.textSoft)};
  opacity: ${({ $active, $near }) => ($active ? 1 : $near ? 0.85 : 0.35)};
  transition: opacity .25s ease, transform .25s ease;
  transform-origin: left center;
  ${({ $active }) => $active && "transform: scale(1.04);"}
  ${({ $active }) =>
    $active &&
    css`
      background-image: linear-gradient(
        90deg,
        ${({ theme }) => theme.accent} 0%,
        ${({ theme }) => theme.accent2} var(--fill, 0%),
        ${({ theme }) => theme.textSoft} var(--fill, 0%),
        ${({ theme }) => theme.textSoft} 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
    `}
`;

const LyricsPane = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;


const QueueWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
`;

const QRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 12px;
  background: ${({ theme, $cur }) => ($cur ? theme.surface : "transparent")};
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
  img, .ph {
    width: 42px; height: 42px; border-radius: 8px; object-fit: cover;
    border: 1px solid ${({ theme }) => theme.line};
    background: ${({ theme }) => theme.surfaceAlt};
    flex: none;
  }
  .m { flex: 1; min-width: 0; }
  .nm { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${({ theme, $cur }) => ($cur ? theme.accent : theme.text)}; }
  .ar { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

function QueueArt({ track }) {
  const src = useTrackPoster(track);
  return src ? <img src={src} alt="" loading="lazy" /> : <div className="ph" />;
}

export default function NowPlaying({ open, onClose, goRadio, initialTab = "lyrics" }) {
  const {
    current, queue, index, isPlaying, toggle, next, prev, jumpTo, removeFromQueue,
    moveInQueue, clearQueue, elapsed, duration, progress, seek, seekSeconds, isLiked, toggleLike,
    shuffle, setShuffle, repeat, setRepeat, quality, setSleep, sleepEnds, sleepRemaining,
    notify,
  } = usePlayer();
  const { settings, update, applyFxPreset } = useSettings();
  const { scene: circadian } = useCircadian();
  const [tab, setTab] = useState(initialTab || "lyrics");
  const [lyrics, setLyrics] = useState({ plain: null, synced: null });
  const [lyricsStatus, setLyricsStatus] = useState("loading");
  const [engineLines, setEngineLines] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sing, setSing] = useState(false);
  const [braking, setBraking] = useState(false);
  const [lyricsArmed, setLyricsArmed] = useState(false);
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const poster = useTrackPoster(current);
  const art = useArtColors(poster || current?.artBig || current?.art);
  const fxOn = fxActive(settings);
  const { on: spatialOn, toggle: toggleSpatial } = useSpatial();
  const zen = useZen();

  /* ---- vinyl brake: press & hold the record ---- */
  const brakeStart = () => {
    if (!isPlaying) return;
    if (engine.brakeStart()) setBraking(true);
  };
  const brakeEnd = () => {
    setBraking(false);
    engine.brakeRelease();
  };

  /* Never leave the record stuck under a phantom hand when the sheet
     closes or the track changes. */
  useEffect(() => {
    if (!open) {
      setBraking(false);
      engine.brakeRelease();
    }
  }, [open]);

  useEffect(() => {
    setBraking(false);
    engine.brakeRelease();
  }, [current?.id]);

  useEffect(() => () => engine.brakeRelease(), []);

  /* Opening the sheet from the player bar can ask for a specific tab. */
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  const slowedOn = Math.abs(settings.speed - 0.8) < 0.01 && settings.reverb > 0.4;
  const toggleSlowed = () => {
    applyFxPreset(slowedOn ? "Off" : "Slowed + Reverb");
    notify(slowedOn ? "Back to normal speed 🎧" : "Slowed + reverb on 🌊");
  };

  useEffect(() => {
    engine.setSing(sing ? 0.9 : 0);
  }, [sing, current?.id]);

  /* Lyrics engine is ~300kB: only spin it up once the sheet is opened,
     then keep it mounted so switching tracks is instant. */
  useEffect(() => {
    if (open) setLyricsArmed(true);
  }, [open]);

  /* Word-synced lyrics come from <am-lyrics>. Only when that comes up dry
     (no provider hit) do we ask LRCLIB for a plain / line-synced sheet. */
  useEffect(() => {
    let alive = true;
    if (!current || lyricsStatus !== "empty") return;
    setLyrics({ plain: null, synced: null });
    setLoading(true);
    getLyricsMeta({
      artist: current.artist,
      title: current.title,
      album: current.album,
      duration: current.duration,
    })
      .then((l) => alive && setLyrics(l))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [current?.id, lyricsStatus]);

  const lines = useMemo(() => parseLRC(lyrics.synced), [lyrics.synced]);
  /* while the sheet is shut, don't recompute the active lyric on every audio
     tick — it keeps React from reconciling the whole lyric list in the background */
  const ai = useMemo(
    () => (open ? activeLine(lines, elapsed) : -1),
    [lines, elapsed, open]
  );

  useEffect(() => {
    if (!open || tab !== "lyrics") return;
    const el = activeRef.current;
    const box = scrollRef.current;
    if (!el || !box) return;
    const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTop = Math.max(0, target);
  }, [ai, tab, open]);

  const lineFill = (i) => {
    if (i !== ai || ai < 0) return "0%";
    const start = lines[i].time;
    const end = lines[i + 1] ? lines[i + 1].time : duration || start + 4000;
    return `${clamp(((elapsed - start) / Math.max(1, end - start)) * 100, 0, 100)}%`;
  };

  /* ---- tap a lyric line to seek there ---- */

  /* the share sheet lives inside the player, so never leave it floating
     when Now Playing itself slides away */
  useEffect(() => {
    if (!open) setShareOpen(false);
  }, [open]);

  const copySwatch = async (hex) => {
    try {
      await navigator.clipboard.writeText(hex);
      notify(`Palette hex copied — ${hex.toUpperCase()} 🎨`);
    } catch {
      notify(hex.toUpperCase());
    }
  };

  return (
    <Overlay
      $open={open}
      $zen={zen}
      aria-hidden={!open}
      style={
        art
          ? {
              "--np-a": art.a1,
              "--np-b": art.a2,
              "--np-glow-a": art.glowA,
              "--np-glow-b": art.glowB,
              "--np-glow-c": art.glowC,
            }
          : undefined
      }
    >
      <GlowField $active={open && isPlaying} aria-hidden="true" />
      <Top $zen={zen}>
        <IconButton onClick={onClose} aria-label="Close now playing"><X size={24} /></IconButton>
        <div style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 16 }}>
          Now Playing
        </div>
        {settings.circadian !== false && circadian?.enabled && (
          <Chip
            className="sky"
            title={`${circadian.label} — the theme, EQ and ambience follow your sky`}
            style={{ fontSize: 12.5, padding: "2px 10px" }}
          >
            {circadian.emoji} {circadian.label}
          </Chip>
        )}
        {quality && <Badge $tone={quality.lossless ? "lossless" : undefined}>{quality.badge} · {quality.text}</Badge>}
        <div style={{ flex: 1 }} />
        <IconButton
          $active={spatialOn}
          onClick={toggleSpatial}
          title="8D / Spatial Audio — orbit the sound around your head"
          aria-label="Toggle 8D spatial audio"
        >
          <Spatial size={22} />
        </IconButton>
        <IconButton
          $active={fxOn}
          onClick={toggleSlowed}
          title="Slowed + Reverb"
          aria-label="Toggle slowed and reverb"
        >
          <Waves size={22} />
        </IconButton>
        {current && (
          <IconButton
            onClick={() => setShareOpen(true)}
            title="Share a lyric card"
            aria-label="Share a lyric card"
          >
            <Share size={22} />
          </IconButton>
        )}
        <IconButton
          $active={sing}
          className="sing"
          onClick={() => setSing((v) => !v)}
          title="Sing — step the vocals back"
          aria-label="Sing"
        >
          <Mic size={22} />
        </IconButton>
        <IconButton
          $active={settings.visualizer}
          className="viz"
          onClick={() => update({ visualizer: !settings.visualizer })}
          title="Toggle visualizer"
          aria-label="Toggle visualizer"
        >
          <Sparkle size={22} />
        </IconButton>
        <IconButton
          onClick={() => setSleep(sleepEnds ? 0 : settings.sleepTimerDefault)}
          title="Sleep timer"
          aria-label="Sleep timer"
          $active={!!sleepEnds}
        >
          <Timer size={22} />
        </IconButton>
      </Top>

      <Body>
        <Left>
          <ArtWrap>
            <ArtGlow aria-hidden="true" />
            <VinylPoster
              poster={poster || current?.artBig || current?.art || ""}
              alt={current?.title ? `${current.title} album art` : "Album art"}
              playing={isPlaying}
              braking={braking}
              active={open}
              onBrakeStart={brakeStart}
              onBrakeEnd={brakeEnd}
              fallback={<Mic size={64} />}
            />
          </ArtWrap>

          <LeftChrome $zen={zen}>
          {current && (
            <BrakeHint $braking={braking} aria-live="polite">
              {braking ? "🖐 braking…" : "Press & hold the record to brake"}
            </BrakeHint>
          )}

          {current && (
            <>
              <Title>{current.title}</Title>
              <Artist>
                {current.artist}
                {current.album ? ` • ${current.album}` : ""}
                {current.year ? ` • ${current.year}` : ""}
              </Artist>
              {art?.palette?.length > 1 && (
                <PaletteStrip aria-label="Colour palette from this poster">
                  {art.palette.slice(0, 6).map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      style={{ background: hex }}
                      title={`Copy ${hex.toUpperCase()}`}
                      aria-label={`Copy palette colour ${hex}`}
                      onClick={() => copySwatch(hex)}
                    />
                  ))}
                  <span className="hex">{art.hex}</span>
                </PaletteStrip>
              )}
            </>
          )}

          <SeekRow>
            <span>{fmtTime(elapsed)}</span>
            <div style={{ flex: 1 }}>
              <Slider
                min="0" max="1000" value={Math.round((progress || 0) * 1000)}
                onChange={(e) => seek(Number(e.target.value) / 1000)}
                aria-label="Seek"
              />
            </div>
            <span>{current?.source === "radio" ? "LIVE" : fmtTime(duration || current?.duration || 0)}</span>
          </SeekRow>

          <Controls>
            <IconButton $active={shuffle} onClick={() => setShuffle((s) => !s)} aria-label="Shuffle"><Shuffle size={22} /></IconButton>
            <IconButton onClick={prev} aria-label="Previous"><Prev size={24} /></IconButton>
            <BigPlay onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={28} /> : <Play size={28} />}
            </BigPlay>
            <IconButton onClick={() => next()} aria-label="Next"><Next size={24} /></IconButton>
            <IconButton
              $active={repeat !== "off"}
              onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}
              aria-label="Repeat"
            >
              <Repeat size={22} one={repeat === "one"} />
            </IconButton>
            {current && (
              <IconButton $active={isLiked(current.id)} onClick={() => toggleLike(current)} aria-label="Like">
                <Heart size={22} filled={isLiked(current.id)} />
              </IconButton>
            )}
            {current && <AddToPlaylist track={current} size={22} />}
            {current && <DownloadButton track={current} size={22} />}
            {sing && <Chip>🎤 Sing</Chip>}
            {spatialOn && (
              <Chip
                as="button"
                onClick={toggleSpatial}
                style={{ cursor: "pointer", border: "2px solid currentColor", fontWeight: 800 }}
                title="8D spatial audio is on — tap to switch it off"
              >
                🎧 8D
              </Chip>
            )}
            {fxOn && (
              <Chip
                as="button"
                onClick={() => setTab("fx")}
                style={{ cursor: "pointer", border: "2px solid currentColor", fontWeight: 800 }}
                title="Open the slowed + reverb dials"
              >
                🌊 {settings.speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×
              </Chip>
            )}
            {sleepEnds > 0 && <Chip>😴 {Math.ceil(sleepRemaining / 60000)}m</Chip>}
          </Controls>

          {settings.visualizer && open && (
            <Visualizer style={settings.visualizerStyle} height={settings.visualizerStyle === "circle" ? 200 : 120} playing={isPlaying} />
          )}
          </LeftChrome>
        </Left>

        <Right $zen={zen}>
          <ZenTabBar $zen={zen}>
            <Tab $on={tab === "lyrics"} onClick={() => setTab("lyrics")}><Mic size={15} /> Lyrics</Tab>
            <Tab $on={tab === "fx"} onClick={() => setTab("fx")}><Waves size={15} /> FX</Tab>
            <Tab $on={tab === "queue"} onClick={() => setTab("queue")}><ListMusic size={15} /> Queue ({queue.length})</Tab>
            <div style={{ flex: 1 }} />
            {tab === "queue" && queue.length > 0 && (
              <Tab $on={false} onClick={clearQueue}>Clear</Tab>
            )}
          </ZenTabBar>

          {tab === "fx" ? (
            <QueueWrap>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <PhoneOnly>
                  <SketchButton
                    $variant={sing ? "accent" : undefined}
                    onClick={() => setSing((v) => !v)}
                    aria-pressed={sing}
                  >
                    <Mic size={16} /> {sing ? "Sing on" : "Sing"}
                  </SketchButton>
                  <SketchButton
                    $variant={settings.visualizer ? "accent" : undefined}
                    onClick={() => update({ visualizer: !settings.visualizer })}
                    aria-pressed={settings.visualizer}
                  >
                    <Sparkle size={16} /> Visualizer {settings.visualizer ? "on" : "off"}
                  </SketchButton>
                </PhoneOnly>
                <SpatialControls compact />
                <div style={{ borderTop: "2px dashed currentColor", opacity: 0.22 }} />
                <FxControls compact />
              </div>
            </QueueWrap>
          ) : tab === "lyrics" ? (
            <LyricsPane>
              {lyricsArmed && current && (
                <SyncedLyrics
                  track={current}
                  onStatus={setLyricsStatus}
                  onLines={setEngineLines}
                  active={open}
                  highlight={art?.highlight || art?.hex}
                />
              )}

              {lyricsStatus === "empty" && (
                <LyricsScroll ref={scrollRef}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 18 }}>
                      <Spinner /> hunting for lyrics...
                    </div>
                  ) : lines.length ? (
                    lines.map((l, i) => (
                      <LyricLine
                        key={i}
                        ref={i === ai ? activeRef : null}
                        $active={i === ai}
                        $near={Math.abs(i - ai) <= 1}
                        style={{ "--fill": lineFill(i), cursor: "pointer" }}
                        onClick={() => seekSeconds(l.time / 1000)}
                      >
                        {l.text || "♪"}
                      </LyricLine>
                    ))
                  ) : lyrics.plain ? (
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 18, lineHeight: 1.6, opacity: .9, margin: 0 }}>
                      {lyrics.plain}
                    </pre>
                  ) : (
                    <div style={{ textAlign: "center", marginTop: 40, opacity: .7 }}>
                      <Sparkle size={40} />
                      <p className="hand" style={{ fontSize: 19 }}>No lyrics for this one 🤷</p>
                      <p style={{ fontFamily: '"Nunito", system-ui, sans-serif' }}>Just vibe to it, yeah?</p>
                    </div>
                  )}
                </LyricsScroll>
              )}
            </LyricsPane>
          ) : (
            <QueueWrap>
              {queue.length === 0 && (
                <div style={{ textAlign: "center", opacity: .7, marginTop: 30 }}>
                  <p className="hand" style={{ fontSize: 19 }}>Queue's empty!</p>
                  <p style={{ fontFamily: '"Nunito", system-ui, sans-serif' }}>Grab a song or spin up the radio 📻</p>
                </div>
              )}
              {queue.map((t, i) => (
                <QRow key={`${t.id}-${i}`} $cur={i === index}>
                  <QueueArt track={t} />
                  <div className="m" onClick={() => jumpTo(i)} style={{ cursor: "pointer" }}>
                    <div className="nm">{t.title}</div>
                    <div className="ar">{t.artist}</div>
                  </div>
                  <IconButton onClick={() => moveInQueue(i, Math.max(0, i - 1))} aria-label="Move up" disabled={i === 0}><ChevronUp size={18} /></IconButton>
                  <IconButton onClick={() => moveInQueue(i, Math.min(queue.length - 1, i + 1))} aria-label="Move down" disabled={i === queue.length - 1}><ChevronDown size={18} /></IconButton>
                  <IconButton onClick={() => removeFromQueue(i)} aria-label="Remove"><Trash size={18} /></IconButton>
                </QRow>
              ))}
            </QueueWrap>
          )}
        </Right>
      </Body>

      {current && (
        <LyricShare
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          track={current}
          poster={poster}
          art={art}
          lines={engineLines.length ? engineLines : lines}
          elapsed={elapsed}
          notify={notify}
        />
      )}
    </Overlay>
  );
}
