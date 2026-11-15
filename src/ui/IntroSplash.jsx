import React, { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { APP_NAME, APP_TAGLINE } from "../lib/appInfo.js";
import { skyBg } from "../theme.jsx";

/* ------------------------------------------------------------------ */
/*  IntroSplash — the hand-drawn title card that plays once the pencil */
/*  loader has finished sharpening.                                    */
/*                                                                     */
/*  Everything is transform/opacity only (no JS animation loop, no     */
/*  canvas), the layout is fluid with clamp() so the same card feels   */
/*  right on a phone and on a laptop, and it bows out with a paper     */
/*  curtain lift. Tap, click or any key skips it.                      */
/* ------------------------------------------------------------------ */

const HOLD_MS = 3000;        // time the finished card sits before leaving
const EXIT_MS = 620;         // curtain lift duration — keep in sync with css
const REDUCED_HOLD_MS = 900; // static card for prefers-reduced-motion

const TAGLINE_PARTS = APP_TAGLINE.split("·").map((s) => s.trim()).filter(Boolean);

/* every letter leans a little, like it was inked by hand */
const LETTER_TILT = [-5, 3, -2, 4, 0, -3, 2, 10];

const SPARKLES = [
  { x: 13, y: 27, s: 22, d: 0.28 },
  { x: 85, y: 21, s: 17, d: 0.52 },
  { x: 78, y: 75, s: 20, d: 0.7 },
  { x: 19, y: 71, s: 15, d: 0.44 },
  { x: 50, y: 13, s: 13, d: 0.86 },
  { x: 91, y: 55, s: 12, d: 0.96, mobile: false },
  { x: 7, y: 51, s: 12, d: 0.64, mobile: false },
];

const NOTES = [
  { x: 16, d: 0.5, s: 30 },
  { x: 82, d: 1.7, s: 24 },
  { x: 61, d: 3.1, s: 19, mobile: false },
];

/* ------------------------------------------------------------------ */
/*  Motion                                                             */
/* ------------------------------------------------------------------ */

const letterIn = keyframes`
  0%   { opacity: 0; transform: translateY(-30%) scale(1.32) rotate(calc(var(--r) * 1.8)); }
  62%  { opacity: 1; transform: translateY(4%) scale(.975) rotate(calc(var(--r) * .7)); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--r)); }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px) rotate(-1.2deg); }
  to   { opacity: 1; transform: translateY(0) rotate(0); }
`;

const drawLine = keyframes`
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
`;

const handDrop = keyframes`
  0%   { opacity: 0; transform: translateY(-34px) rotate(-34deg) scale(.68); }
  55%  { opacity: 1; transform: translateY(4px) rotate(-9deg) scale(1.06); }
  100% { opacity: 1; transform: translateY(0) rotate(-14deg) scale(1); }
`;

const handWiggle = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(9deg); }
`;

const sparkPop = keyframes`
  0%   { opacity: 0; transform: scale(.2) rotate(-40deg); }
  70%  { opacity: 1; transform: scale(1.14) rotate(4deg); }
  100% { opacity: .9; transform: scale(1) rotate(0); }
`;

const sparkTwinkle = keyframes`
  0%, 100% { opacity: .4; transform: rotate(0); }
  50%      { opacity: 1; transform: rotate(14deg); }
`;

const noteFloat = keyframes`
  0%   { opacity: 0; transform: translate3d(0, 14vh, 0) rotate(-12deg) scale(.8); }
  18%  { opacity: .5; }
  72%  { opacity: .38; }
  100% { opacity: 0; transform: translate3d(2vw, -50vh, 0) rotate(16deg) scale(1.06); }
`;

const auraIn = keyframes`
  from { opacity: 0; transform: scale(.86); }
  to   { opacity: 1; transform: scale(1); }
`;

const ringSpin = keyframes`
  from { transform: rotate(0); }
  to   { transform: rotate(360deg); }
`;

const markFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
`;

const hintIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: .62; transform: translateY(0); }
`;

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

const Stage = styled.div`
  position: fixed;
  inset: 0;
  z-index: 88;
  overflow: hidden;
  display: grid;
  place-items: center;
  isolation: isolate;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  background: ${({ theme }) => skyBg(theme)};
  transform: translateY(${({ $leaving }) => ($leaving ? "-100%" : "0")});
  transition: transform ${EXIT_MS}ms cubic-bezier(.76, 0, .24, 1);
  will-change: transform;
  pointer-events: ${({ $leaving }) => ($leaving ? "none" : "auto")};

  /* the faint sketchbook grain that every paper panel in the app has */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-image: repeating-linear-gradient(
      -45deg,
      ${({ theme }) =>
        theme.mode === "dark" ? "rgba(255,255,255,.03)" : "rgba(52,46,27,.032)"} 0 1px,
      transparent 1px 12px
    );
    opacity: .7;
  }
`;

const Aura = styled.div`
  position: absolute;
  width: min(124vmin, 980px);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 46%, ${({ theme }) => theme.accent2}3d 0%, transparent 56%),
    radial-gradient(circle at 50% 62%, ${({ theme }) => theme.accent4}26 0%, transparent 60%);
  opacity: .95;
  animation: ${auraIn} 1.3s ease both;
`;

const Ring = styled.div`
  position: absolute;
  width: min(74vmin, 620px);
  aspect-ratio: 1;
  margin: auto;
  border-radius: 50%;
  border: 2px dashed ${({ theme }) => theme.accent};
  opacity: .2;
  animation: ${ringSpin} 52s linear infinite;
  will-change: transform;
`;

const Scene = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(940px, 94vw);
  padding: 0 2vw;
  text-align: center;
  opacity: ${({ $leaving }) => ($leaving ? 0 : 1)};
  transform: ${({ $leaving }) => ($leaving ? "translateY(-18px)" : "none")};
  transition: opacity .3s ease, transform .5s ease;
`;

const Kicker = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1.4vw, 12px);
  font-size: clamp(9.5px, 1.9vw, 12.5px);
  line-height: 1;
  font-weight: 800;
  letter-spacing: .34em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.textSoft};
  margin-bottom: clamp(10px, 2.4vh, 22px);
  animation: ${fadeUp} .6s cubic-bezier(.2, 1.1, .4, 1) .22s both;

  svg {
    flex: none;
    width: clamp(11px, 2vw, 15px);
    height: clamp(11px, 2vw, 15px);
    opacity: .8;
  }
`;

const Mark = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-size: clamp(3rem, 13vw, 8.4rem);
  line-height: .96;
  letter-spacing: -.055em;
  white-space: nowrap;
  animation: ${markFloat} 5.5s ease-in-out 1.9s infinite;
`;

const Letter = styled.span`
  display: inline-block;
  transform-origin: 50% 86%;
  color: ${({ theme }) => theme.text};
  text-shadow: .045em .055em 0 ${({ theme }) => theme.accent3};
  animation: ${letterIn} .74s cubic-bezier(.18, 1.26, .36, 1) both;
  animation-delay: calc(.38s + var(--i) * .058s);

  ${({ $gold, theme }) =>
    $gold &&
    css`
      color: ${theme.accent2};
      -webkit-text-stroke: .026em ${theme.inkEdge};
      text-shadow: .05em .06em 0 ${theme.shadow};
    `}
`;

const Space = styled.span`
  display: inline-block;
  width: .26em;
`;

const HandWrap = styled.span`
  display: inline-block;
  align-self: center;
  width: .6em;
  height: .6em;
  margin: 0 0 .14em .06em;
  color: ${({ theme }) => theme.accent};
  transform-origin: 50% 85%;
  animation: ${handDrop} .58s cubic-bezier(.2, 1.35, .4, 1) 1.22s both;
  filter: drop-shadow(.03em .045em 0 ${({ theme }) => theme.shadow});

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    animation: ${handWiggle} 2.8s ease-in-out 1.8s infinite;
  }
`;

const Underline = styled.svg`
  width: clamp(190px, 54vw, 560px);
  height: auto;
  margin-top: clamp(2px, .8vh, 10px);
  overflow: visible;

  .gold, .ink {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
    animation: ${drawLine} .8s ease-out both;
  }
  .gold {
    stroke: ${({ theme }) => theme.accent2};
    stroke-width: 12;
    animation-delay: 1.08s;
  }
  .ink {
    stroke: ${({ theme }) => theme.inkEdge};
    stroke-width: 4;
    opacity: .8;
    animation-delay: 1.18s;
  }
`;

const Tagline = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: clamp(4px, 1vw, 9px) clamp(6px, 1.4vw, 12px);
  max-width: min(92vw, 620px);
  margin-top: clamp(18px, 3.6vh, 34px);
  padding: clamp(9px, 1.8vw, 13px) clamp(16px, 3.6vw, 30px);
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surface};
  border: 2.2px solid var(--ink-edge);
  border-radius: 15px 225px 15px 255px / 255px 15px 225px 15px;
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  transform: rotate(-1.2deg);

  .part {
    font-size: clamp(12.5px, 2.9vw, 17px);
    font-weight: 800;
    letter-spacing: .01em;
    animation: ${fadeUp} .6s cubic-bezier(.2, 1.1, .4, 1) both;
    animation-delay: calc(1.34s + var(--i) * .08s);
  }
  .dot {
    font-size: clamp(12px, 2.6vw, 16px);
    line-height: 1;
    color: ${({ theme }) => theme.accent};
    opacity: .7;
    animation: ${fadeUp} .6s ease both;
    animation-delay: calc(1.4s + var(--i) * .08s);
  }
`;

const Sparkles = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
`;

const Spark = styled.span`
  position: absolute;
  width: var(--s);
  height: var(--s);
  transform: translate(-50%, -50%);
  pointer-events: none;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    color: ${({ theme }) => theme.accent2};
    opacity: .9;
    animation:
      ${sparkPop} .7s cubic-bezier(.2, 1.5, .4, 1) var(--d) both,
      ${sparkTwinkle} 2.4s ease-in-out calc(var(--d) + .7s) infinite;
  }

  @media (max-width: 620px) {
    ${({ $mobile }) => !$mobile && "display: none;"}
  }
`;

const Notes = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
`;

const Note = styled.span`
  position: absolute;
  bottom: 6%;
  width: var(--s);
  height: var(--s);
  pointer-events: none;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    color: ${({ theme }) => theme.accent};
    opacity: 0;
    animation: ${noteFloat} 6.5s ease-in var(--d) infinite;
  }

  @media (max-width: 620px) {
    ${({ $mobile }) => !$mobile && "display: none;"}
  }
`;

const Hint = styled.div`
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: calc(18px + var(--safe-bottom));
  transform: translateX(-50%);
  font-size: clamp(10.5px, 2vw, 12.5px);
  font-weight: 700;
  letter-spacing: .1em;
  color: ${({ theme }) => theme.textSoft};
  white-space: nowrap;
  animation: ${hintIn} .6s ease 1.7s both;

  .tp { display: inline; }
  .kb { display: none; }
  @media (hover: hover) and (pointer: fine) {
    .tp { display: none; }
    .kb { display: inline; }
  }
`;

/* ------------------------------------------------------------------ */
/*  The card                                                           */
/* ------------------------------------------------------------------ */

function SparkleShape() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c.85 4.6 2.4 6.15 7 7-4.6.85-6.15 2.4-7 7-.85-4.6-2.4-6.15-7-7 4.6-.85 6.15-2.4 7-7Z" />
      <path d="M19 14.6c.4 2.1 1.1 2.8 3.2 3.2-2.1.4-2.8 1.1-3.2 3.2-.4-2.1-1.1-2.8-3.2-3.2 2.1-.4 2.8-1.1 3.2-3.2Z" opacity=".7" />
    </svg>
  );
}

function HandShape() {
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

function NoteShape() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 18V5.2l8-2v10.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.2" cy="18.2" r="2.8" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="15.2" cy="16.2" r="2.8" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export default function IntroSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  /* Hold the card, then lift the curtain. */
  useEffect(() => {
    const reduced =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;
    const timer = setTimeout(() => setLeaving(true), hold);
    return () => clearTimeout(timer);
  }, []);

  /* Unmount only after the curtain has finished travelling. */
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => doneRef.current?.(), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  /* Any key is a skip — phones use a tap on the stage itself. */
  useEffect(() => {
    const onKey = () => setLeaving(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Stage
      $leaving={leaving}
      role="img"
      aria-label={`${APP_NAME} — ${APP_TAGLINE}`}
      onPointerDown={() => setLeaving(true)}
    >
      <Aura aria-hidden="true" />
      <Ring aria-hidden="true" />

      <Sparkles aria-hidden="true">
        {SPARKLES.map((sp, i) => (
          <Spark
            key={i}
            $mobile={sp.mobile !== false}
            style={{
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              "--s": `${sp.s}px`,
              "--d": `${sp.d}s`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.2c.85 4.6 2.4 6.15 7 7-4.6.85-6.15 2.4-7 7-.85-4.6-2.4-6.15-7-7 4.6-.85 6.15-2.4 7-7Z" />
            </svg>
          </Spark>
        ))}
      </Sparkles>

      <Notes aria-hidden="true">
        {NOTES.map((n, i) => (
          <Note
            key={i}
            $mobile={n.mobile !== false}
            style={{ left: `${n.x}%`, "--d": `${n.d}s`, "--s": `${n.s}px` }}
          >
            <NoteShape />
          </Note>
        ))}
      </Notes>

      <Scene $leaving={leaving}>
        <Kicker>
          <SparkleShape />
          music you can grab
          <SparkleShape />
        </Kicker>

        <Mark>
          {[...APP_NAME].map((ch, i) =>
            ch === " " ? (
              <Space key={`sp-${i}`} aria-hidden="true" />
            ) : (
              <Letter
                key={`${ch}-${i}`}
                $gold={ch === "!"}
                aria-hidden="true"
                style={{ "--i": i, "--r": `${LETTER_TILT[i] ?? 0}deg` }}
              >
                {ch}
              </Letter>
            )
          )}
          <HandWrap aria-hidden="true">
            <HandShape />
          </HandWrap>
        </Mark>

        <Underline viewBox="0 0 600 26" aria-hidden="true" preserveAspectRatio="none">
          <path
            className="gold"
            pathLength="1"
            d="M6 17c54-9 108-11 164-5 56 6 110 9 166 3 54-5 104-8 166-2 24 2 48 4 68 1"
          />
          <path
            className="ink"
            pathLength="1"
            d="M8 18c54-9 107-11 163-5 55 6 109 9 165 3 53-5 103-8 165-2 23 2 46 4 66 1"
          />
        </Underline>

        <Tagline>
          {TAGLINE_PARTS.map((part, i) => (
            <React.Fragment key={part}>
              {i > 0 && (
                <span className="dot" aria-hidden="true" style={{ "--i": i }}>
                  ·
                </span>
              )}
              <span className="part" style={{ "--i": i }}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </Tagline>
      </Scene>

      <Hint>
        <span className="tp">tap anywhere to skip</span>
        <span className="kb">click or press any key to skip</span>
      </Hint>
    </Stage>
  );
}