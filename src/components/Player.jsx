import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";
import { go } from "../router.jsx";
import {
  Play, Pause, Next, Prev, Shuffle, Repeat, Heart, Volume, Mute, Note, ListMusic, Equalizer, Waves,
  Spatial,
} from "../ui/Icons.jsx";
import { IconButton, Badge, Chip, Spinner } from "../ui/kit.jsx";
import { fmtTime } from "../lib/format.js";
import { engine } from "../audio/engine.js";
import { fxActive } from "../settings/SettingsContext.jsx";
import { useArtColors } from "../ui/useArtColors.js";
import { useTrackPoster } from "../ui/usePoster.js";
import { useZen, zenHide } from "../ui/ZenMode.jsx";
import { useSpatial } from "./SpatialControls.jsx";

const Bar = styled.footer`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(300px, 2fr) minmax(200px, 1fr);
  align-items: center;
  gap: 14px;
  padding: 10px 18px calc(10px + var(--safe-bottom));
  background: ${({ theme }) => theme.player};
  border-top: 2.6px solid ${({ theme }) => theme.inkEdge};
  box-shadow:
    0 -4px 0 0 ${({ theme }) => theme.shadow},
    0 -16px 68px -26px ${({ $glow }) => $glow || "transparent"};
  ${zenHide}
  transition: background .8s ease, box-shadow .8s ease, opacity .6s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(90% 220% at 8% 50%, ${({ $a1 }) => $a1 || "transparent"} 0%, transparent 62%),
      radial-gradient(90% 220% at 92% 50%, ${({ $a2 }) => $a2 || "transparent"} 0%, transparent 62%),
      radial-gradient(46% 180% at 50% 120%, ${({ $glowC }) => $glowC || "transparent"} 0%, transparent 70%);
    opacity: .85;
    transition: opacity .6s ease;
  }

  /* a blurred bloom of the poster's colours rising off the bar */
  &::after {
    content: "";
    position: absolute;
    left: 7%;
    right: 7%;
    top: -30px;
    height: 46px;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      ${({ $glowA }) => $glowA || "transparent"} 0%,
      ${({ $glowB }) => $glowB || "transparent"} 55%,
      ${({ $glowA }) => $glowA || "transparent"} 100%
    );
    filter: blur(26px);
    opacity: .6;
    border-radius: 50%;
    transition: opacity .7s ease;
  }
  > * { position: relative; z-index: 1; }

  /* ---- phones: a compact mini player stacked above the tab bar ---- */
  @media (max-width: 900px) {
    bottom: var(--mobile-nav-h);
    z-index: 47;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 8px 12px;
    box-shadow:
      0 -3px 0 0 ${({ theme }) => theme.shadow},
      0 -14px 40px -22px ${({ $glow }) => $glow || "transparent"};
  }
  @media (max-width: 440px) {
    gap: 4px;
    padding: 7px 10px;
  }
`;

/* The phone mini player has no room for the full seek row — a 3px pencil
   line along the top edge still shows exactly where the song is. */
const Hair = styled.div`
  display: none;

  @media (max-width: 900px) {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    height: 3px;
    width: ${({ $pct }) => `${$pct}%`};
    background: ${({ theme }) => theme.accent2};
    box-shadow: 0 0 0 1px ${({ theme }) => theme.shadow};
    border-radius: 0 3px 3px 0;
    transition: width .18s linear;
    pointer-events: none;
    z-index: 3;
  }
`;

const Cover = styled.div`
  position: relative;
  width: 54px; height: 54px; flex: none;
  border: 2px solid var(--ink-edge);
  border-radius: 10px; overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
  box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .22s cubic-bezier(.2,1.3,.4,1), box-shadow .22s ease;
  img { width: 100%; height: 100%; object-fit: cover; }
  svg { position: absolute; inset: 0; margin: auto; color: ${({ theme }) => theme.textSoft}; }
  @media (max-width: 900px) { width: 46px; height: 46px; border-radius: 9px; }
  @media (max-width: 440px) { width: 42px; height: 42px; }
`;

const NowInfo = styled.button`
  appearance: none; border: none; background: transparent; color: inherit;
  display: flex; align-items: center; gap: 12px; text-align: left; min-width: 0; padding: 0;
  &:hover ${Cover} {
    transform: rotate(-3deg) scale(1.06);
    box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  }
  @media (max-width: 900px) { gap: 9px; }
`;

const T = styled.div`
  min-width: 0;
  .name { font-weight: 800; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .artist { font-family: "Nunito", system-ui, sans-serif; font-size: 13.5px; color: ${({ theme }) => theme.textSoft}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 900px) {
    .name { font-size: 14px; }
    .artist { font-size: 12.5px; }
    .quality { display: none; }
  }
`;

const Center = styled.div`display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0;`;
const Controls = styled.div`
  display: flex; align-items: center; gap: 6px;
  @media (max-width: 900px) {
    gap: 0;
    /* shuffle + repeat live in the full Now Playing sheet on phones */
    > button:first-child, > button:last-child { display: none; }
  }
  @media (max-width: 440px) { gap: 0; }
`;

const pulseRing = keyframes`
  0%, 100% { transform: scale(1) rotate(0deg); opacity: .45; }
  50% { transform: scale(1.12) rotate(8deg); opacity: .18; }
`;

const inkSlide = keyframes`
  from { background-position: 0 0; }
  to { background-position: 24px 0; }
`;

const MainBtn = styled.button`
  appearance: none;
  width: 48px; height: 48px;
  display: grid; place-items: center;
  border-radius: 50%;
  border: 2.6px solid var(--ink-edge);
  background: ${({ theme }) => theme.accent2};
  color: ${({ theme }) => theme.onGold};
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  position: relative;
  transition: transform .16s cubic-bezier(.2,1.3,.4,1), box-shadow .16s ease;
  &:hover { transform: rotate(4deg) scale(1.07); box-shadow: 4px 6px 0 0 ${({ theme }) => theme.shadow}; }
  &:active { transform: translate(1px,1px) scale(.97); box-shadow: 1px 1px 0 0 ${({ theme }) => theme.shadow}; }

  /* a scribbled pulse ring while the song is running */
  &::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px dashed ${({ theme }) => theme.accent};
    opacity: ${({ $playing }) => ($playing ? ".45" : "0")};
    animation: ${({ $playing }) => ($playing ? pulseRing : "none")} 2.4s ease-in-out infinite;
    transition: opacity .3s ease;
    pointer-events: none;
  }

  @media (max-width: 900px) {
    width: 44px; height: 44px;
    border-width: 2.2px;
  }
`;

const ProgressRow = styled.div`
  display: flex; align-items: center; gap: 10px; width: 100%; max-width: 580px;
  font-family: "Nunito", system-ui, sans-serif; font-size: 12.5px; color: ${({ theme }) => theme.textSoft};
  @media (max-width: 700px) {
    gap: 8px;
    .time { display: none; }
  }
  @media (max-width: 900px) { display: none; }
`;

const Track = styled.div`
  flex: 1; height: 10px; position: relative; cursor: pointer;
  background: ${({ theme }) => theme.surfaceAlt};
  border: 2px solid var(--ink-edge);
  border-radius: 999px;
  transition: height .18s ease;
  touch-action: none;
  @media (hover: hover) {
    &:hover { height: 14px; }
  }

  /* the ink fill, with a slow pencil-hatch shimmer while music is playing */
  &::after {
    content: ""; position: absolute; inset: 0; width: ${({ $pct }) => `${$pct}%`};
    border-radius: inherit;
    background: repeating-linear-gradient(-45deg, ${({ theme }) => theme.accent} 0 6px, ${({ theme }) => theme.accent4} 6px 12px);
    background-size: 24px 24px;
    transition: width .12s linear;
    animation: ${({ $playing }) => ($playing ? inkSlide : "none")} 1.1s linear infinite;
  }

  /* the pencil nib you drag */
  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: ${({ $pct }) => `calc(${$pct}% - 7px)`};
    width: 14px; height: 14px;
    border-radius: 48% 52% 46% 54% / 54% 48% 52% 46%;
    background: ${({ theme }) => theme.accent2};
    border: 2px solid var(--ink-edge);
    box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
    translate: 0 -50%;
    transition: left .12s linear, transform .15s ease;
    z-index: 2;
  }
  &:hover::before { transform: rotate(8deg) scale(1.12); }
  &:active::before { transform: scale(.94); }
`;

const Right = styled.div`
  display: flex; align-items: center; justify-content: flex-end; gap: 2px;
  @media (max-width: 900px) { display: none; }
`;

const VolWrap = styled.div`display: flex; align-items: center; gap: 4px; width: 108px;`;

const VolTrack = styled.div`
  flex: 1; height: 8px;
  background: ${({ theme }) => theme.surfaceAlt};
  border: 2px solid var(--ink-edge);
  border-radius: 999px; position: relative; cursor: pointer;
  &::after {
    content: ""; position: absolute; inset: 0; width: ${({ $v }) => `${$v * 100}%`};
    background: ${({ theme }) => theme.accent3}; border-radius: 999px;
  }
`;

function useDragSeek(onRatio) {
  const ref = useRef(null);
  const apply = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    onRatio(Math.min(1, Math.max(0, (x - rect.left) / rect.width)));
  };
  const start = (e) => {
    apply(e);
    const move = (ev) => apply(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return { ref, onPointerDown: start };
}

export default function Player({ onOpenNowPlaying, onOpenQueue, onOpenFx }) {
  const {
    current, isPlaying, toggle, next, prev, progress, elapsed, duration, quality, loading,
    volume, muted, setVolume, toggleMute, shuffle, setShuffle, repeat, setRepeat,
    isLiked, toggleLike, sleepEnds, sleepRemaining, seek,
  } = usePlayer();
  const { settings } = useSettings();
  const [lastVol, setLastVol] = useState(volume || 0.85);
  const [rate, setRate] = useState(1);
  const p = useDragSeek(seek);
  const poster = useTrackPoster(current);
  const art = useArtColors(poster || current?.artBig || current?.art);
  const isPodcast = current?.source === "podcast";
  const isLive = current?.source === "radio";
  const fxOn = fxActive(settings);
  const { on: spatialOn, toggle: toggleSpatial } = useSpatial();
  const zen = useZen();
  const speedLabel = `${settings.speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×`;

  useEffect(() => {
    engine.setRate(isPodcast ? rate : 1);
  }, [rate, isPodcast, current?.id]);

  const cycleRate = () => {
    const steps = [1, 1.25, 1.5, 1.75, 2];
    setRate((r) => steps[(steps.indexOf(r) + 1) % steps.length]);
  };

  return (
    <Bar
      $zen={zen}
      $a1={art?.a1}
      $a2={art?.a2}
      $glow={art?.glowB}
      $glowA={art?.glowA}
      $glowB={art?.glowB}
      $glowC={art?.glowC}
    >
      <Hair $pct={isLive ? 100 : Math.round((progress || 0) * 100)} />
      <NowInfo onClick={onOpenNowPlaying} aria-label="Open now playing">
        <Cover>
          {poster ? <img src={poster} alt="" decoding="async" draggable="false" /> : <Note size={24} />}
        </Cover>
        <T>
          <div className="name">{current ? current.title : "Nothing playing"}</div>
          <div className="artist">{current ? current.artist : "Hit GRAB on something fun 👉"}</div>
          {quality && (
            <div className="quality" style={{ marginTop: 3 }}>
              <Badge $tone={quality.lossless ? "lossless" : undefined}>
                {quality.lossless ? "🔊 " : ""}{quality.text}
              </Badge>
            </div>
          )}
        </T>
      </NowInfo>

      <Center>
        <Controls>
          <IconButton $active={shuffle} onClick={() => setShuffle((s) => !s)} aria-label="Shuffle"><Shuffle size={19} /></IconButton>
          <IconButton onClick={prev} aria-label="Previous"><Prev size={22} /></IconButton>
          <MainBtn $playing={isPlaying} onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"}>
            {loading ? <Spinner /> : isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </MainBtn>
          <IconButton onClick={() => next()} aria-label="Next"><Next size={22} /></IconButton>
          <IconButton
            $active={repeat !== "off"}
            onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}
            aria-label="Repeat"
          >
            <Repeat size={19} one={repeat === "one"} />
          </IconButton>
        </Controls>
        <ProgressRow>
          <span className="time">{fmtTime(elapsed)}</span>
          <Track
            ref={p.ref}
            onPointerDown={p.onPointerDown}
            $pct={Math.round((progress || 0) * 100)}
            $playing={isPlaying}
            role="slider" aria-label="Seek"
            aria-valuenow={Math.round((progress || 0) * 100)}
          />
          <span className="time">{isLive ? "LIVE" : fmtTime(duration || current?.duration || 0)}</span>
        </ProgressRow>
      </Center>

      <Right>
        {sleepEnds > 0 && <Badge>😴 {Math.ceil(sleepRemaining / 60000)}m</Badge>}
        {isPodcast && (
          <Chip
            as="button"
            onClick={cycleRate}
            title="Podcast speed"
            style={{ cursor: "pointer", border: "2px solid currentColor", fontWeight: 800 }}
          >
            {rate}×
          </Chip>
        )}
        {spatialOn && (
          <Chip
            as="button"
            onClick={toggleSpatial}
            title="8D spatial audio is on — tap to switch it off"
            style={{ cursor: "pointer", border: "2px solid currentColor", fontWeight: 800 }}
          >
            🎧 8D
          </Chip>
        )}
        {fxOn && (
          <Chip
            as="button"
            onClick={onOpenFx}
            title="Slowed + reverb is on — open the dials"
            style={{ cursor: "pointer", border: "2px solid currentColor", fontWeight: 800 }}
          >
            🌊 {speedLabel}
          </Chip>
        )}
        <IconButton $active={fxOn} onClick={onOpenFx} aria-label="Slowed and reverb" title="Slowed + Reverb">
          <Waves size={20} />
        </IconButton>
        <IconButton
          $active={spatialOn}
          onClick={toggleSpatial}
          aria-label="8D spatial audio"
          title="8D / Spatial Audio"
        >
          <Spatial size={20} />
        </IconButton>
        <IconButton onClick={onOpenQueue} aria-label="Queue" title="Queue"><ListMusic size={20} /></IconButton>
        <IconButton
          $active={settings.eqEnabled}
          onClick={() => go("/settings")}
          aria-label="Equalizer"
          title="Equalizer"
        >
          <Equalizer size={20} />
        </IconButton>
        {current && (
          <IconButton $active={isLiked(current.id)} onClick={() => toggleLike(current)} aria-label="Like">
            <Heart size={20} filled={isLiked(current.id)} />
          </IconButton>
        )}
        <IconButton
          onClick={() => {
            if (muted) { setVolume(lastVol || 0.85); return; }
            setLastVol(volume);
            toggleMute();
          }}
          aria-label="Mute"
        >
          {muted || volume === 0 ? <Mute size={20} /> : <Volume level={volume} size={20} />}
        </IconButton>
        <VolWrap>
          <VolTrack
            $v={muted ? 0 : volume}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setVolume(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
            }}
            role="slider" aria-label="Volume"
            aria-valuenow={Math.round(volume * 100)}
          />
        </VolWrap>
      </Right>
    </Bar>
  );
}
