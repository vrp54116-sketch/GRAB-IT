import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import VanillaTilt from "vanilla-tilt";
import { useSettings } from "../settings/SettingsContext.jsx";

/* ------------------------------------------------------------------ */
/*  3D Parallax Tilt Album Poster                                      */
/*                                                                     */
/*  A thin wrapper around vanilla-tilt.js. The artwork tilts toward    */
/*  the cursor (or the phone's gyroscope) and a soft glossy highlight  */
/*  follows the light across the sleeve. Everything stays inside the   */
/*  poster's own rounded corners, so it drops straight onto the        */
/*  existing Art styles in Album / Now Playing.                        */
/* ------------------------------------------------------------------ */

const TiltRoot = styled.div`
  position: relative;
  isolation: isolate;
  backface-visibility: hidden;
  will-change: transform;

  /* The sheen is painted above the artwork but under any badges. */
  .tilt-sheen {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    border-radius: inherit;
    opacity: var(--tilt-sheen-o, 0);
    background:
      radial-gradient(
        46% 62% at var(--tilt-sheen-x, 50%) var(--tilt-sheen-y, 42%),
        rgba(255, 255, 255, 0.78) 0%,
        rgba(255, 255, 255, 0.26) 30%,
        rgba(255, 255, 255, 0) 68%
      ),
      linear-gradient(
        112deg,
        rgba(255, 255, 255, 0) 30%,
        rgba(255, 255, 255, 0.22) 44%,
        rgba(255, 255, 255, 0.05) 56%,
        rgba(255, 255, 255, 0) 70%
      );
    mix-blend-mode: screen;
    transition: opacity 0.45s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none !important;
  }
`;

/* Respect the OS "reduce motion" setting live, not just at mount. */
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

export default function TiltPoster({
  children,
  className,
  style,
  disabled = false,
  max = 9,            // gentle — a vinyl sleeve, not a spinning sign
  scale = 1.02,
  speed = 450,
  perspective = 1100,
  startX = 0.9,       // tiny hand-drawn resting tilt
  startY = -0.7,
  gyroscope = true,
  ...rest
}) {
  const rootRef = useRef(null);
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || {};
  const reducedMotion = useReducedMotion();

  /* The app's own switches win too: "Animations" off or "3D poster tilt"
     off means the poster stays flat and still. */
  const enabled =
    !disabled &&
    !reducedMotion &&
    settings.posterTilt !== false &&
    settings.animations !== false;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    if (!enabled) {
      el.style.transform = "";
      el.style.transition = "";
      el.style.willChange = "";
      return undefined;
    }

    /* vanilla-tilt fires this after every frame it moves. Feed the cursor
       position into CSS so one soft highlight slides over the artwork. */
    const onTilt = (event) => {
      const { percentageX = 50, percentageY = 50 } = event.detail || {};
      const dx = percentageX - 50;
      const dy = percentageY - 50;
      const reach = Math.min(1, Math.hypot(dx, dy) / 58);

      el.style.setProperty("--tilt-sheen-x", `${percentageX.toFixed(1)}%`);
      el.style.setProperty("--tilt-sheen-y", `${percentageY.toFixed(1)}%`);
      el.style.setProperty("--tilt-sheen-o", (0.12 + reach * 0.55).toFixed(3));
    };

    /* iOS needs permission before deviceorientation delivers values, and
       it may only ask from a real user gesture — the first press on the
       poster is that gesture. */
    const askGyroscope = () => {
      const DeviceOrientation = window.DeviceOrientationEvent;
      if (DeviceOrientation && typeof DeviceOrientation.requestPermission === "function") {
        try {
          DeviceOrientation.requestPermission().catch(() => {
            /* no gyroscope / declined — the pointer tilt still works */
          });
        } catch {
          /* not a user gesture in this browser — pointer tilt still works */
        }
      }
    };

    el.addEventListener("tiltChange", onTilt);
    if (gyroscope) el.addEventListener("pointerdown", askGyroscope, { once: true });

    VanillaTilt.init(el, {
      max,
      scale,
      speed,
      perspective,
      startX,
      startY,
      "reset-to-start": true,
      easing: "cubic-bezier(.2,.8,.3,1)",
      gyroscope,
      gyroscopeSamples: 6,
      glare: false,
    });

    return () => {
      el.removeEventListener("tiltChange", onTilt);
      el.removeEventListener("pointerdown", askGyroscope);
      el.vanillaTilt?.destroy?.();
      el.style.transform = "";
      el.style.transition = "";
      el.style.willChange = "";
      el.style.removeProperty("--tilt-sheen-x");
      el.style.removeProperty("--tilt-sheen-y");
      el.style.removeProperty("--tilt-sheen-o");
    };
  }, [enabled, max, scale, speed, perspective, startX, startY, gyroscope]);

  return (
    <TiltRoot ref={rootRef} className={className} style={style} {...rest}>
      {children}
      <span className="tilt-sheen" aria-hidden="true" />
    </TiltRoot>
  );
}