import React from "react";
import styled, { css, keyframes } from "styled-components";
import { useTheme } from "../theme.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";

/* ------------------------------------------------------------------ */
/*  AmbientSky — the animated half of the circadian theme.             */
/*                                                                     */
/*  A fixed, non-interactive layer that draws the weather cue the       */
/*  scene asked for: rain streaks, drifting snow, fog banks, a storm    */
/*  flash or a warm sun shimmer. It is pure CSS (no canvas, no images)  */
/*  and quietly disappears when animations are turned off.              */
/* ------------------------------------------------------------------ */

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: ${({ $o = 1 }) => $o};
  transition: opacity 1.2s ease;
`;

const fall = keyframes`
  from { background-position: 0 0, 0 0; }
  to   { background-position: 0 260px, 0 420px; }
`;

const Rain = styled.div`
  position: absolute;
  inset: -45% -25%;
  transform: rotate(11deg);
  transform-origin: center;
  opacity: ${({ $heavy }) => ($heavy ? 0.6 : 0.42)};
  background-image:
    linear-gradient(to bottom, transparent 0 86%, rgba(206, 230, 255, 0.55) 86% 100%),
    linear-gradient(to bottom, transparent 0 90%, rgba(226, 240, 255, 0.4) 90% 100%);
  background-size: 2.4px 30px, 1.6px 46px;
  background-repeat: repeat;
  ${({ $anim }) =>
    $anim &&
    css`
      animation: ${fall} ${({ $heavy }) => ($heavy ? 0.5 : 0.72)}s linear infinite;
    `}
`;

const snowFall = keyframes`
  from { background-position: 0 0, 0 0; }
  to   { background-position: 34px 240px, -22px 340px; }
`;

const Snow = styled.div`
  position: absolute;
  inset: -20%;
  opacity: 0.5;
  background-image:
    radial-gradient(2.4px 2.4px at 24px 32px, rgba(255, 255, 255, 0.95) 50%, transparent 52%),
    radial-gradient(1.7px 1.7px at 130px 96px, rgba(255, 255, 255, 0.75) 50%, transparent 52%);
  background-size: 220px 220px, 330px 330px;
  background-repeat: repeat;
  ${({ $anim }) =>
    $anim &&
    css`
      animation: ${snowFall} 15s linear infinite;
    `}
`;

const fogDrift = keyframes`
  from { transform: translate3d(-4%, 0, 0) scale(1.05); }
  to   { transform: translate3d(4%, -1.5%, 0) scale(1.12); }
`;

const Fog = styled.div`
  position: absolute;
  inset: -18%;
  background-image:
    radial-gradient(60% 26% at 22% 30%, rgba(255, 255, 255, 0.4), transparent 72%),
    radial-gradient(66% 22% at 74% 56%, rgba(255, 255, 255, 0.34), transparent 74%),
    radial-gradient(58% 24% at 44% 80%, rgba(255, 255, 255, 0.28), transparent 76%);
  ${({ $anim }) =>
    $anim &&
    css`
      animation: ${fogDrift} 34s ease-in-out infinite alternate;
    `}
`;

const flash = keyframes`
  0%, 90%, 100% { opacity: 0; }
  92% { opacity: 0.55; }
  93% { opacity: 0.06; }
  95% { opacity: 0.38; }
  97% { opacity: 0; }
`;

const Flash = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(80% 60% at 68% 6%, rgba(255, 255, 255, 0.85), transparent 68%);
  opacity: 0;
  ${({ $anim }) =>
    $anim &&
    css`
      animation: ${flash} 11s ease-in-out infinite;
    `}
`;

const shimmer = keyframes`
  from { opacity: 0.55; transform: scale(1); }
  to   { opacity: 1; transform: scale(1.03); }
`;

const SunHaze = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(58% 42% at 82% 6%, rgba(255, 240, 190, 0.4), transparent 62%);
  ${({ $anim }) =>
    $anim &&
    css`
      animation: ${shimmer} 9s ease-in-out infinite alternate;
    `}
`;

export default function AmbientSky() {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const amb = theme?.ambient;
  const fx = amb?.fx;

  if (!fx || fx === "none") return null;
  const anim = settings.animations !== false;

  return (
    <Layer aria-hidden="true" data-ambient={amb.archetype}>
      {fx === "rain" && <Rain $anim={anim} />}
      {fx === "storm" && (
        <>
          <Rain $anim={anim} $heavy />
          <Flash $anim={anim} />
        </>
      )}
      {fx === "snow" && <Snow $anim={anim} />}
      {fx === "fog" && <Fog $anim={anim} />}
      {fx === "sun" && <SunHaze $anim={anim} />}
    </Layer>
  );
}
