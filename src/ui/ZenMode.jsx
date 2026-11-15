import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { css } from "styled-components";
import { useSettings } from "../settings/SettingsContext.jsx";
import { usePlayer } from "../player/PlayerContext.jsx";

/* ------------------------------------------------------------------ */
/*  Zero-Clutter Zen Mode                                              */
/*                                                                     */
/*  The Netflix / YouTube full-screen trick, worn by the whole app:    */
/*  the moment a song is playing and you stop touching the screen,     */
/*  the search bar, buttons, sliders and borders melt away. Move the   */
/*  mouse, tap, scroll or press a key and they come straight back.     */
/*                                                                     */
/*  It only ever hides itself while audio is *actually* playing, so    */
/*  the controls never vanish when you pause — there is always a way   */
/*  back. Turn it off in Settings → Appearance.                        */
/* ------------------------------------------------------------------ */

const IDLE_MS = 3000; // stillness before the chrome fades
const WAKE_THROTTLE = 150; // ms — cap how often a mousemove re-arms the timer

const Ctx = createContext(false);
export const useZen = () => useContext(Ctx);

export function ZenProvider({ children }) {
  const settingsCtx = useSettings();
  const settings = settingsCtx?.settings || {};
  const { isPlaying } = usePlayer();
  const enabled = settings.zenMode !== false;

  const [zen, setZen] = useState(false);
  const zenRef = useRef(false);
  zenRef.current = zen;
  const timer = useRef(0);
  const lastWake = useRef(0);

  useEffect(() => {
    // No music (or the feature is off) -> never hide, and wake anything
    // that was already faded out.
    if (!enabled || !isPlaying) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = 0;
      }
      if (zenRef.current) setZen(false);
      return undefined;
    }

    const arm = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setZen(true), IDLE_MS);
    };

    const wake = () => {
      if (zenRef.current) setZen(false);
      const now = Date.now();
      if (now - lastWake.current < WAKE_THROTTLE) return;
      lastWake.current = now;
      arm();
    };

    const events = ["mousemove", "pointermove", "pointerdown", "touchstart", "keydown", "wheel"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    arm();

    return () => {
      clearTimeout(timer.current);
      timer.current = 0;
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [enabled, isPlaying]);

  return <Ctx.Provider value={zen}>{children}</Ctx.Provider>;
}

/* The shared fade for every piece of chrome. Consumers pair this with
   `$zen={zen}` and their own `transition` so the slide is smooth both ways.
   (Chrome that must keep its content — like the lyrics panel — paints its
   own zen styles instead of borrowing this.) */
export const zenHide = css`
  opacity: ${({ $zen }) => ($zen ? 0 : 1)};
  pointer-events: ${({ $zen }) => ($zen ? "none" : "auto")};
`;
