import React, { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { useSettings } from "../settings/SettingsContext.jsx";

/* ------------------------------------------------------------------ */
/*  Vinyl Poster — the album sleeve as a spinning record               */
/*                                                                     */
/*  While a song plays the disc turns lazily. Press and hold it and    */
/*  the rotation — like the music — slips to a halt; let go and both   */
/*  spin back up. The audio side lives in audio/engine.js (playbackRate */
/*  ramp + preservesPitch = false), so <am-lyrics> follows for free.   */
/* ------------------------------------------------------------------ */

const TURN_SECONDS = 12; // one lazy revolution at full speed
const STOP_MS = 420; // hand on the record -> dead stop
const SPIN_UP_MS = 620; // hand off -> back to full speed

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReduced(event.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

const Stage = styled.div`
  position: relative;
  z-index: 1;
  width: min(100%, 46vh);
  aspect-ratio: 1;
  margin: 0 auto;
  display: grid;
  place-items: center;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  outline: none;
  cursor: ${({ $braking }) => ($braking ? "grabbing" : "grab")};

  @media (max-width: 900px) { width: min(100%, 34vh); }
  @media (max-width: 640px) { width: min(100%, 30vh, 250px); }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.accent};
    outline-offset: 6px;
    border-radius: 50%;
  }
`;

const Vinyl = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: #0a0a0f;
  border: 2.6px solid ${({ theme }) => theme.inkEdge};
  box-shadow: 6px 7px 0 0 ${({ theme }) => theme.shadow};
  transition: box-shadow .35s ease, transform .25s ease;
  isolation: isolate;

  ${({ $braking, theme }) =>
    $braking &&
    css`
      transform: scale(.985);
      box-shadow: 4px 5px 0 0 ${theme.shadow};
    `}

  @media (hover: hover) {
    ${Stage}:hover & {
      box-shadow: 8px 10px 0 0 ${({ theme }) => theme.shadow};
    }
  }
`;

/* the part that actually turns — artwork, grooves and centre label */
const Spin = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  will-change: transform;
  transform: translateZ(0) rotate(0rad);
  backface-visibility: hidden;
`;

const Cover = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(.92) contrast(1.03) brightness(.9);
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
`;

const Fallback = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, .72);
`;

/* fine concentric grooves pressed into the surface */
const Grooves = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background: repeating-radial-gradient(
    circle at 50% 50%,
    rgba(255, 255, 255, .10) 0 .7px,
    rgba(0, 0, 0, 0) .7px 2.4px,
    rgba(0, 0, 0, .22) 2.4px 3.1px,
    rgba(255, 255, 255, .045) 3.1px 3.8px
  );
  mix-blend-mode: overlay;
  opacity: .85;
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 50%, transparent 54%, rgba(0, 0, 0, .26) 82%, rgba(0, 0, 0, .5) 100%),
    linear-gradient(135deg, rgba(255, 255, 255, .06), transparent 40%);
`;

/* centre label + spindle hole */
const Label = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 33%;
  height: 33%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: ${({ theme }) => theme.mode === "dark" ? "rgba(8,8,12,.8)" : "rgba(20,18,24,.74)"};
  border: 1px solid rgba(255, 255, 255, .34);
  box-shadow:
    0 0 0 4px rgba(0, 0, 0, .3),
    inset 0 0 22px rgba(0, 0, 0, .75);
  display: grid;
  place-items: center;
  pointer-events: none;

  /* the spindle pokes through the middle */
  &::after {
    content: "";
    width: 8%;
    height: 8%;
    border-radius: 50%;
    background: #050507;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, .18);
  }
`;

/* light keeps its position while the record turns underneath it */
const Sheen = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    conic-gradient(
      from 200deg at 50% 50%,
      transparent 0deg,
      rgba(255, 255, 255, .16) 42deg,
      transparent 96deg,
      transparent 206deg,
      rgba(255, 255, 255, .09) 248deg,
      transparent 300deg
    ),
    radial-gradient(120% 120% at 30% 24%, rgba(255, 255, 255, .16), transparent 56%);
  mix-blend-mode: screen;
  opacity: .85;
`;

const Edge = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1.5px rgba(255, 255, 255, .2),
    inset 0 0 28px rgba(0, 0, 0, .55);
`;

export default function VinylPoster({
  poster,
  alt = "",
  playing = false,
  braking = false,
  active = true,
  onBrakeStart,
  onBrakeEnd,
  fallback = null,
  className,
  style,
}) {
  const spinRef = useRef(null);
  const angleRef = useRef(0);
  const speedRef = useRef(0); // 0..1 of full speed
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const holdingRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || {};

  const animate = active && !reducedMotion && settings.animations !== false;

  /* Where the rotation wants to be this frame. */
  useEffect(() => {
    targetRef.current = playing && !braking ? 1 : 0;
  }, [playing, braking]);

  /* ---- the spin loop: a smooth ramp both ways, not a CSS jump ---- */
  useEffect(() => {
    if (!animate) {
      speedRef.current = 0;
      return undefined;
    }
    if (!playing && !braking && speedRef.current < 0.001) return undefined;

    let last = 0;
    const tick = (now) => {
      if (!last) last = now;
      const dt = Math.min(64, now - last) / 1000;
      last = now;

      const target = targetRef.current;
      const ramp = (target > speedRef.current ? SPIN_UP_MS : STOP_MS) / 1000;
      const diff = target - speedRef.current;
      if (diff) {
        const step = Math.min(Math.abs(diff), dt / Math.max(0.05, ramp));
        speedRef.current += Math.sign(diff) * step;
      }

      if (speedRef.current > 0.0001) {
        angleRef.current =
          (angleRef.current + speedRef.current * dt * (Math.PI * 2 / TURN_SECONDS)) %
          (Math.PI * 2);
        if (spinRef.current) {
          spinRef.current.style.transform = `translateZ(0) rotate(${angleRef.current}rad)`;
        }
      }

      // Park the loop once the record is fully stopped and nothing asks it
      // to turn. A prop change (play/press) restarts it.
      if (target === 0 && speedRef.current <= 0.0001) {
        rafRef.current = 0;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [animate, playing, braking]);

  /* ---- press & hold ---- */
  const press = (event) => {
    if (!active || holdingRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!playing) return;
    event.preventDefault();
    holdingRef.current = true;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    onBrakeStart?.();
  };

  const release = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    onBrakeEnd?.();
  };

  const onKeyDown = (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (event.repeat || holdingRef.current || !playing) return;
    holdingRef.current = true;
    onBrakeStart?.();
  };

  const onKeyUp = (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    release();
  };

  return (
    <Stage
      className={className}
      style={style}
      $braking={braking}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-label="Press and hold the record to brake the music"
      title="Press & hold to brake the record"
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <Vinyl $braking={braking}>
        <Spin ref={spinRef}>
          {poster ? <Cover src={poster} alt={alt} decoding="async" draggable="false" /> : <Fallback>{fallback}</Fallback>}
          <Grooves aria-hidden="true" />
          <Label aria-hidden="true" />
        </Spin>
        <Vignette aria-hidden="true" />
        <Sheen aria-hidden="true" />
        <Edge aria-hidden="true" />
      </Vinyl>
    </Stage>
  );
}