import React from "react";
import styled, { keyframes } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useArtColors } from "../ui/useArtColors.js";
import { useTrackPoster } from "../ui/usePoster.js";
import { Note } from "../ui/Icons.jsx";
import { wobbleBorder } from "../theme.jsx";

/* ------------------------------------------------------------------ */
/*  Cross-Song Lyric Bridge                                            */
/*                                                                     */
/*  During the final seconds of a track the incoming song's poster and */
/*  its opening lyric softly peek in from the bottom edge while the    */
/*  two songs crossfade behind it. Purely visual — the audio hand-off  */
/*  happens in PlayerContext / AudioEngine.                            */
/* ------------------------------------------------------------------ */

const sweep = keyframes`
  from { transform: translateX(-120%); }
  to   { transform: translateX(420%); }
`;

const dot = keyframes`
  0%, 100% { transform: scale(.8); opacity: .45; }
  50%      { transform: scale(1.35); opacity: 1; }
`;

const floatUp = keyframes`
  from { transform: translateY(16px) rotate(-1.6deg); }
  to   { transform: translateY(0) rotate(0); }
`;

const Spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Wrap = styled.div`
  position: fixed;
  left: 50%;
  bottom: ${({ $nowOpen }) =>
    $nowOpen ? "calc(18px + var(--safe-bottom))" : "calc(86px + var(--safe-bottom))"};
  z-index: ${({ $nowOpen }) => ($nowOpen ? 85 : 55)};
  width: min(560px, calc(100vw - 28px));
  pointer-events: none;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: translate(-50%, ${({ $visible }) => ($visible ? "0" : "26px")})
    scale(${({ $visible }) => ($visible ? 1 : 0.96)});
  transform-origin: center bottom;
  transition:
    opacity .42s ease,
    transform .55s cubic-bezier(.2, 1.15, .3, 1),
    bottom .35s ease;
  will-change: transform, opacity;

  @media (prefers-reduced-motion: reduce) {
    transition: opacity .25s ease;
    transform: translate(-50%, 0);
  }
`;

const Card = styled.div`
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 10px 15px 10px 10px;
  background-color: ${({ theme }) => theme.paper};
  background-image: repeating-linear-gradient(
    -45deg,
    ${({ theme }) =>
      theme.mode === "dark" ? "rgba(255,255,255,.03)" : "rgba(52,46,27,.028)"} 0 1px,
    transparent 1px 11px
  );
  color: ${({ theme }) => theme.text};
  ${wobbleBorder(2.4)}
  box-shadow:
    4px 6px 0 0 ${({ theme }) => theme.shadow},
    0 20px 56px -24px ${({ $glow }) => $glow || "transparent"};
  animation: ${floatUp} .5s cubic-bezier(.2, 1.1, .3, 1) both;

  /* a soft band of light that travels across the card as the bridge opens */
  &::after {
    content: "";
    position: absolute;
    top: -30%;
    bottom: -30%;
    left: 0;
    width: 28%;
    background: linear-gradient(
      90deg,
      transparent,
      ${({ theme }) => theme.accent}24,
      transparent
    );
    transform: translateX(-120%);
    animation: ${sweep} 2.8s ease-in-out .35s infinite;
    pointer-events: none;

    @media (prefers-reduced-motion: reduce) { display: none; }
  }

  @media (max-width: 460px) {
    gap: 10px;
    padding: 8px 11px 8px 8px;
  }
`;

const Art = styled.div`
  position: relative;
  flex: none;
  width: 66px;
  height: 62px;

  @media (max-width: 460px) {
    width: 56px;
    height: 54px;
  }
`;

const Disc = styled.div`
  position: absolute;
  right: 0;
  top: 50%;
  width: 46px;
  height: 46px;
  margin-top: -23px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.inkEdge};
  background:
    repeating-radial-gradient(
      circle at 50% 50%,
      ${({ theme }) => (theme.mode === "dark" ? "#151208" : "#2b2617")} 0 2px,
      ${({ theme }) => (theme.mode === "dark" ? "#241e11" : "#3b3524")} 2px 4px
    );
  box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
  animation: ${Spin} 7s linear infinite;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ theme }) => theme.accent2};
    border: 1.5px solid ${({ theme }) => theme.inkEdge};
  }

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Cover = styled.div`
  position: absolute;
  left: 0;
  top: 50%;
  width: 58px;
  height: 58px;
  margin-top: -29px;
  border: 2px solid ${({ theme }) => theme.inkEdge};
  border-radius: 11px;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
  box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
  transform: rotate(-2.4deg);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  svg {
    position: absolute;
    inset: 0;
    margin: auto;
    color: ${({ theme }) => theme.textSoft};
  }

  @media (max-width: 460px) {
    width: 50px;
    height: 50px;
    margin-top: -25px;
  }
`;

const Text = styled.div`
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.accent};
  }

  .eyebrow i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${({ theme }) => theme.accent2};
    border: 1.5px solid ${({ theme }) => theme.inkEdge};
    animation: ${dot} 1.4s ease-in-out infinite;
  }

  .title {
    margin-top: 1px;
    font-weight: 900;
    font-size: 15.5px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artist {
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 12.5px;
    color: ${({ theme }) => theme.textSoft};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .line {
    margin-top: 5px;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 13.5px;
    font-style: italic;
    line-height: 1.32;
    color: ${({ theme }) => theme.text};
    opacity: ${({ $hasLine }) => ($hasLine ? 0.92 : 0.6)};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (max-width: 460px) {
    .title { font-size: 14px; }
    .artist { font-size: 11.5px; }
    .line { font-size: 12.5px; margin-top: 3px; -webkit-line-clamp: 1; }
  }
`;

export default function LyricBridge({ nowOpen = false }) {
  const { bridge } = usePlayer();
  const track = bridge?.track || null;
  const poster = useTrackPoster(track);
  const art = useArtColors(poster || track?.artBig || track?.art);
  const visible = !!bridge?.visible && !!track;
  const line = bridge?.line || "";
  const lineReady = !!bridge?.lineReady;

  if (!track) return null;

  return (
    <Wrap
      $visible={visible}
      $nowOpen={nowOpen}
      aria-hidden={!visible}
      role="status"
      aria-live="polite"
    >
      <Card $glow={art?.glowA}>
        <Art>
          <Disc aria-hidden="true" />
          <Cover>
            {poster ? (
              <img src={poster} alt="" decoding="async" draggable="false" />
            ) : (
              <Note size={24} />
            )}
          </Cover>
        </Art>
        <Text $hasLine={!!line}>
          <div className="eyebrow"><i aria-hidden="true" /> bridging into</div>
          <div className="title">{track.title}</div>
          <div className="artist">{track.artist}</div>
          <div className="line">
            {line ? (
              <>“{line}”</>
            ) : lineReady ? (
              <span>no lyrics — just vibes ✨</span>
            ) : (
              <span>finding the first line…</span>
            )}
          </div>
        </Text>
      </Card>
    </Wrap>
  );
}