import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { useSettings } from "../settings/SettingsContext.jsx";
import {
  buildScene, fetchWeather, getCoords, dayPhase,
  storedWeather, cachedCoords, saveCoords, saveWeather,
  WEATHER_TTL,
} from "./circadian.js";

/* ------------------------------------------------------------------ */
/*  CircadianProvider — reads the clock every minute and the weather    */
/*  every ~20 minutes, then hands the rest of the app a single "scene". */
/*                                                                     */
/*  It is deliberately forgiving: if location is denied or the network  */
/*  is down, the time-of-day half keeps working and weather is simply   */
/*  reported as unknown. Nothing here ever blocks the UI.               */
/* ------------------------------------------------------------------ */

const Ctx = createContext(null);

const EMPTY = {
  scene: null,
  weather: null,
  coords: null,
  status: "idle",
  error: "",
  enabled: false,
  refresh: () => {},
  useMyLocation: () => {},
};

export const useCircadian = () => useContext(Ctx) || EMPTY;

export function CircadianProvider({ children }) {
  const { settings } = useSettings();
  const enabled = settings.circadian !== false;

  const [weather, setWeather] = useState(() => storedWeather());
  const [coords, setCoords] = useState(() => cachedCoords());
  const [status, setStatus] = useState(() => (storedWeather() ? "ready" : "idle"));
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0); // re-renders the scene once a minute

  /* refs so the interval always reads the newest values */
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const inFlight = useRef(false);

  const refresh = useCallback(async ({ locate = false } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      let c = coordsRef.current;
      if (locate || !c) {
        setStatus("locating");
        try {
          c = await getCoords();
          saveCoords(c);
          setCoords(c);
        } catch {
          // location denied / unavailable — carry on with time only
          if (!c) {
            setStatus("no-location");
            return;
          }
        }
      }
      if (!c) {
        setStatus("no-location");
        return;
      }
      setStatus("loading");
      const w = await fetchWeather(c.lat, c.lon);
      saveWeather(w);
      setWeather(w);
      setError("");
      setStatus("ready");
    } catch (e) {
      setError(String(e?.message || e));
      setStatus(weatherRef.current ? "ready" : "error");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const useMyLocation = useCallback(() => refresh({ locate: true }), [refresh]);

  /* clock: rebuild the scene once a minute so the theme drifts with the day */
  useEffect(() => {
    if (!enabled) return undefined;
    const iv = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(iv);
  }, [enabled]);

  /* weather: fetch on enable, then refresh on a timer + when the tab returns */
  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return undefined;
    }
    const fresh = weatherRef.current && Date.now() - weatherRef.current.at < WEATHER_TTL;
    // Small delay so the first prompt never fights the boot animation.
    const kick = fresh
      ? 0
      : setTimeout(() => refresh({ locate: !coordsRef.current }), 1800);
    if (fresh) setStatus("ready");

    const iv = setInterval(() => {
      if (document.hidden) return;
      const cur = weatherRef.current;
      if (!cur || Date.now() - cur.at >= WEATHER_TTL) refresh({ locate: !coordsRef.current });
    }, WEATHER_TTL);

    const onVisible = () => {
      if (document.hidden) return;
      const cur = weatherRef.current;
      if (!cur || Date.now() - cur.at >= WEATHER_TTL) refresh({ locate: !coordsRef.current });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (kick) clearTimeout(kick);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  const phase = dayPhase(new Date());
  const scene = useMemo(
    () => buildScene({ now: new Date(), weather, enabled }),
    // When `tick` re-renders us each minute, `phase` is recomputed; the scene
    // object only changes when the light (or the weather) actually changes.
    [weather, enabled, phase]
  );

  const value = useMemo(
    () => ({ scene, weather, coords, status, error, enabled, refresh, useMyLocation }),
    [scene, weather, coords, status, error, enabled, refresh, useMyLocation]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
