import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { engine } from "../audio/engine.js";
import { gyroTracker } from "../audio/gyro.js";
import { resolvePlayable, subsonicReady } from "../audio/providers.js";
import { buildRadio, getLyricsMeta } from "../api/music.js";
import { parseLRC } from "../lib/format.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useCircadian } from "../env/CircadianContext.jsx";
import { get, set, uid } from "../lib/store.js";
import { allFiles, putFile, delFile, clearFiles, allDownloads, putDownload, delDownload, clearDownloads as clearDownloadStore } from "../lib/idb.js";
import { setOfflineUrl, releaseOffline } from "../lib/offline.js";

const Ctx = createContext(null);
export const usePlayer = () => useContext(Ctx);

/* Distinct sentinel so a guest profile (currentId === null) still triggers the
   first hydration instead of matching the ref's initial value. */
const UNSET = Symbol("unset");

/* The first line that is actually sung — skip instrumental markers and
   section headers ("[Verse 1]") that some plain sheets carry. */
function openingLyricLine(meta) {
  const synced = parseLRC(meta?.synced);
  const first = synced.find(
    (l) => l.text && !/^[♪\s.…-]+$/.test(l.text) && !/^[[(].*[\])]$/.test(l.text)
  );
  if (first) return first.text;
  const plain = String(meta?.plain || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s && !/^[[(].*[\])]$/.test(s));
  return plain || "";
}

export function PlayerProvider({ children }) {
  const { settings } = useSettings();
  const { currentId } = useAuth();
  const { scene: circadian } = useCircadian();
  const ns = (k) => `${currentId || "guest"}:${k}`;

  /* ---------------- library state ---------------- */
  const [liked, setLiked] = useState([]);
  const [recent, setRecent] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [savedAlbums, setSavedAlbums] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [stats, setStats] = useState({ plays: {}, artists: {}, totalMs: 0, byDay: {} });
  const [localTracks, setLocalTracks] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const localUrls = useRef(null);

  const loadedFor = useRef(UNSET);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (loadedFor.current === currentId) return;
    loadedFor.current = currentId;
    setHydrated(false);
    setLiked(get(ns("liked"), []));
    setRecent(get(ns("recent"), []));
    setPlaylists(get(ns("playlists"), []));
    setSavedAlbums(get(ns("albums"), []));
    setFollowed(get(ns("followed"), []));
    setStats(get(ns("stats"), { plays: {}, artists: {}, totalMs: 0, byDay: {} }));
    // Flip the flag in the same batch as the loads, so the save effects below
    // never write this profile's empty initial state back over real data.
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  /* Only persist once this profile's data has actually been loaded. Without
     this guard the first render (empty arrays) would clobber saved data on
     mount, and a profile switch would write the old profile's library into
     the new one before the load landed. */
  const canSave = hydrated && loadedFor.current === currentId;
  useEffect(() => { if (canSave) set(ns("liked"), liked); }, [liked, currentId, canSave]);
  useEffect(() => { if (canSave) set(ns("recent"), recent); }, [recent, currentId, canSave]);
  useEffect(() => { if (canSave) set(ns("playlists"), playlists); }, [playlists, currentId, canSave]);
  useEffect(() => { if (canSave) set(ns("albums"), savedAlbums); }, [savedAlbums, currentId, canSave]);
  useEffect(() => { if (canSave) set(ns("followed"), followed); }, [followed, currentId, canSave]);
  /* ---------------- stats persistence ----------------
     timeupdate fires ~4×/sec, so the stats object changes at that rate.
     JSON-stringifying and writing it that often blocks the main thread
     while music plays (and the object only grows). Throttle to once every
     3s, keep the newest value in a ref, and flush on the way out so a
     closed tab still saves the last few seconds of listening. */
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const statsIdRef = useRef(currentId);
  statsIdRef.current = currentId;
  const lastStatsWrite = useRef(0);
  const statsTimer = useRef(0);
  useEffect(() => {
    if (!canSave) return;
    const write = () => {
      lastStatsWrite.current = Date.now();
      set(ns("stats"), statsRef.current);
    };
    const wait = 3000 - (Date.now() - lastStatsWrite.current);
    if (wait <= 0) {
      if (statsTimer.current) {
        clearTimeout(statsTimer.current);
        statsTimer.current = 0;
      }
      write();
    } else if (!statsTimer.current) {
      statsTimer.current = setTimeout(() => {
        statsTimer.current = 0;
        write();
      }, wait);
    }
  }, [stats, currentId, canSave]);

  useEffect(() => {
    const flush = () => {
      if (loadedFor.current !== statsIdRef.current) return;
      set(`${statsIdRef.current || "guest"}:stats`, statsRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (statsTimer.current) clearTimeout(statsTimer.current);
      flush();
    };
  }, []);

  /* ---------------- playback state ---------------- */
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => get("volume", 0.85));
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");
  const [quality, setQuality] = useState(null);
  const [radioSeed, setRadioSeed] = useState("");
  const [loadingRadio, setLoadingRadio] = useState(false);
  const [sleepEnds, setSleepEnds] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);

  /* Cross-Song Lyric Bridge — the incoming track peeks in while the audio
     crossfades. `line` is the first sung line, fetched once per track. */
  const [bridge, setBridge] = useState({
    track: null, line: "", lineReady: false, visible: false,
  });
  const bridgeToken = useRef(0);
  const bridgeHideTimer = useRef(0);
  const bridgeLyricCache = useRef(new Map());

  const [toasts, setToasts] = useState([]);
  const notify = useCallback((msg) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const current = queue[index] || null;

  /* ---------------- refs for event handlers ---------------- */
  const r = useRef({});
  r.current = { queue, index, shuffle, repeat, settings, volume };
  const retriedRef = useRef(false);
  const failedRef = useRef(new Set());
  const crossingRef = useRef(false);
  const lastElapsedRef = useRef(0);
  /* Queue-end radio: remember which track already seeded a station so a
     failed/dead radio run can't loop forever. */
  const autoplayTriedRef = useRef("");
  const radioAutoplayRef = useRef(null);

  const isActiveTag = (tag) => (engine.mode === "plain" ? tag === "plain" : tag === engine.active);

  /* ---------------- engine volume / eq sync ---------------- */
  useEffect(() => {
    engine.setVolume(muted ? 0 : volume);
    set("volume", volume);
  }, [volume, muted]);

  useEffect(() => {
    engine.setEq(settings.eqEnabled, settings.eqBands);
  }, [settings.eqEnabled, settings.eqBands]);

  useEffect(() => {
    engine.setNormalize(settings.normalize);
  }, [settings.normalize]);

  /* circadian: a gentle weather curve layered under the user's own EQ */
  useEffect(() => {
    const on =
      settings.circadian !== false &&
      settings.circadianEq !== false &&
      !!circadian?.eq;
    engine.setAmbientEq(on ? circadian.eq : null);
  }, [settings.circadian, settings.circadianEq, circadian]);

  /* circadian: the subtle background bed, alive only while music plays */
  useEffect(() => {
    const on =
      settings.circadian !== false &&
      settings.circadianAmbience !== false &&
      isPlaying &&
      !muted &&
      !!circadian?.ambient;
    engine.setAmbient(
      on
        ? {
            type: circadian.ambient.type,
            level:
              (circadian.ambient.level ?? 0.4) *
              settings.circadianAmbienceLevel *
              Math.max(0, Math.min(1, volume)),
          }
        : null
    );
  }, [
    settings.circadian, settings.circadianAmbience, settings.circadianAmbienceLevel,
    isPlaying, muted, volume, circadian,
  ]);

  /* silence the bed if the provider ever unmounts */
  useEffect(() => () => engine.setAmbient(null), []);

  /* slowed + reverb: keep the graph in sync with the dials */
  useEffect(() => {
    engine.setReverb(settings.reverb, settings.reverbRoom, settings.warmth);
  }, [settings.reverb, settings.reverbRoom, settings.warmth]);

  /* 8D / spatial audio: same graph, dual-channel binaural orbit + room */
  useEffect(() => {
    engine.setSpatial(settings.spatial, settings.spatialSpeed, settings.spatialDepth, {
      mode: settings.spatialMode,
      rear: settings.spatialRear,
      sub: settings.spatialSub,
      room: settings.spatialRoom,
      roomSize: settings.spatialRoomSize,
      gyro: settings.spatialGyro,
    });
  }, [
    settings.spatial, settings.spatialSpeed, settings.spatialDepth,
    settings.spatialMode, settings.spatialRear, settings.spatialSub,
    settings.spatialRoom, settings.spatialRoomSize, settings.spatialGyro,
  ]);

  /* Gyro head-tracking listens only while it can actually do something:
     8D on + gyro toggle on + audio playing. Pausing, turning 8D off or
     disabling gyro detaches the deviceorientation listener (battery). */
  useEffect(() => {
    if (settings.spatial && settings.spatialGyro && isPlaying) {
      gyroTracker.start();
    } else {
      gyroTracker.stop();
    }
    return () => gyroTracker.stop();
  }, [settings.spatial, settings.spatialGyro, isPlaying]);

  useEffect(() => {
    engine.setTape(settings.tapePitch);
    engine.setSpeed(settings.speed);
    engine.setPitch(settings.pitch);
  }, [settings.speed, settings.pitch, settings.tapePitch]);

  useEffect(() => {
    engine.setProcessing(true);
  }, []);

  /* ---------------- media session ---------------- */
  const setMediaSession = useCallback((track) => {
    if (!("mediaSession" in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || "GRAB IT!",
        artwork: track.art ? [{ src: track.art, sizes: "320x320", type: "image/jpeg" }] : [],
      });
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------------- stats ---------------- */
  const bumpStat = useCallback((track, ms) => {
    setStats((s) => {
      const day = new Date().toISOString().slice(0, 10);
      const plays = { ...s.plays };
      const p = plays[track.id] || { count: 0, track };
      plays[track.id] = { ...p, count: p.count, track };
      const artists = { ...s.artists };
      const byDay = { ...s.byDay };
      byDay[day] = (byDay[day] || 0) + ms;
      return { ...s, plays, artists, byDay, totalMs: s.totalMs + ms };
    });
  }, []);

  const countPlay = useCallback((track) => {
    setStats((s) => {
      const plays = { ...s.plays };
      const artists = { ...s.artists };
      const p = plays[track.id];
      plays[track.id] = { count: (p?.count || 0) + 1, track, last: Date.now() };
      artists[track.artist] = (artists[track.artist] || 0) + 1;
      return { ...s, plays, artists };
    });
  }, []);

  /* ---------------- core activate ---------------- */
  const activate = useCallback(
    (track, { autoplay = true, crossfade = 0, preloadNext = true } = {}) => {
      if (!track) return;
      const playable = resolvePlayable(track, r.current.settings);
      if (!playable || !playable.url) {
        notify(`"${track.title}" has no playable audio 😢`);
        return;
      }
      hideBridge();
      retriedRef.current = false;
      engine.setMode(track.opaque ? "plain" : "graph");
      setQuality(playable.quality);
      setLoading(true);
      setMediaSession(track);
      if (crossfade > 0) {
        engine.crossfadeTo(playable.url, crossfade).finally(() => setLoading(false));
      } else {
        engine.load(playable.url, autoplay).finally(() => setLoading(false));
      }
      setElapsed(0);
      setProgress(0);
      lastElapsedRef.current = 0;
      countPlay(track);
      if (settings.historyEnabled) {
        setRecent((prev) => [track, ...prev.filter((x) => x.id !== track.id)].slice(0, 60));
      }
      // warm up the next track for gapless playback + the bridge's opening line
      if (preloadNext && !track.opaque) {
        const handoff = nextHandoff();
        const nxt = handoff?.track;
        if (nxt) {
          if (r.current.settings.gapless) {
            const np = resolvePlayable(nxt, r.current.settings);
            setTimeout(() => np && engine.preload(np.url), 1200);
          }
          if (r.current.settings.lyricBridge !== false) primeBridgeLyric(nxt);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [notify, setMediaSession, countPlay, settings.historyEnabled]
  );

  function nextIndexFor(q, i, sh) {
    if (!q.length) return i;
    if (sh) {
      if (q.length === 1) return i;
      let n = i;
      while (n === i) n = Math.floor(Math.random() * q.length);
      return n;
    }
    return i + 1 < q.length ? i + 1 : -1;
  }

  /* ---------------- Cross-Song Lyric Bridge ----------------
     The next track is resolved once per hand-off (shuffle included) so the
     poster + opening line we show is exactly the track the crossfade loads. */
  function nextHandoff() {
    const { queue: q, index: i, shuffle: sh, repeat: rep } = r.current;
    if (!q.length || i < 0 || rep === "one") return null;
    let ni = nextIndexFor(q, i, sh);
    if (ni === -1 && rep === "all") ni = 0;
    if (ni === -1 || ni === i) return null;
    const track = q[ni];
    if (!track || track.opaque) return null;
    return { index: ni, track };
  }

  /* One LRCLIB request per track; the promise is cached so the bridge is
     instant on later plays and can be warmed up while the song still runs. */
  const bridgeLyricPromise = (track) => {
    if (!track?.id || track.opaque) return Promise.resolve("");
    const cache = bridgeLyricCache.current;
    if (cache.has(track.id)) return cache.get(track.id);
    const p = getLyricsMeta({
      artist: track.artist,
      title: track.title,
      album: track.album,
      duration: track.duration,
    })
      .then(openingLyricLine)
      .catch(() => "");
    cache.set(track.id, p);
    while (cache.size > 80) cache.delete(cache.keys().next().value);
    return p;
  };

  const primeBridgeLyric = useCallback((track) => {
    bridgeLyricPromise(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showBridge = useCallback((track) => {
    if (!track?.id) return;
    bridgeToken.current += 1;
    const token = bridgeToken.current;
    if (bridgeHideTimer.current) {
      clearTimeout(bridgeHideTimer.current);
      bridgeHideTimer.current = 0;
    }
    setBridge({ track, line: "", lineReady: false, visible: true });
    bridgeLyricPromise(track).then((line) => {
      if (token !== bridgeToken.current) return;
      setBridge((b) =>
        b.visible && b.track?.id === track.id ? { ...b, line, lineReady: true } : b
      );
    });
    return token;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hideBridge = useCallback(() => {
    bridgeToken.current += 1;
    setBridge((b) => (b.visible ? { ...b, visible: false } : b));
  }, []);

  useEffect(() => () => {
    bridgeToken.current += 1;
    if (bridgeHideTimer.current) clearTimeout(bridgeHideTimer.current);
  }, []);

  /* ---------------- engine events ---------------- */
  useEffect(() => {
    const offs = [];
    offs.push(
      engine.on("timeupdate", ({ tag, el }) => {
        if (!isActiveTag(tag)) return;
        const t = el.currentTime * 1000;
        const d = (el.duration || 0) * 1000;
        setElapsed(t);
        setDuration(d);
        setProgress(el.duration ? el.currentTime / el.duration : 0);
        const delta = t - lastElapsedRef.current;
        if (delta > 0 && delta < 4000) {
          const cur = r.current.queue[r.current.index];
          if (cur) bumpStat(cur, delta);
        }
        lastElapsedRef.current = t;
        // crossfade trigger — the Lyric Bridge guarantees a 5s hand-off
        // even when the crossfade dial is at 0, so tracks never fall silent.
        const bridgeOn = r.current.settings.lyricBridge !== false;
        const cf = r.current.settings.crossfade > 0
          ? r.current.settings.crossfade
          : bridgeOn ? 5 : 0;
        if (
          cf > 0 &&
          engine.mode === "graph" &&
          !crossingRef.current &&
          el.duration &&
          el.duration - el.currentTime <= cf
        ) {
          const next = nextHandoff();
          if (next) {
            const np = resolvePlayable(next.track, r.current.settings);
            if (np?.url) {
              const seconds = Math.max(0.8, Math.min(cf, el.duration - el.currentTime));
              crossingRef.current = true;
              setIndex(next.index);
              setMediaSession(next.track);
              countPlay(next.track);
              const token = bridgeOn ? showBridge(next.track) : 0;
              engine.crossfadeTo(np.url, seconds).finally(() => {
                crossingRef.current = false;
                if (!bridgeOn) return;
                // let the incoming poster sit for a beat after the hand-off
                if (bridgeHideTimer.current) clearTimeout(bridgeHideTimer.current);
                bridgeHideTimer.current = setTimeout(() => {
                  bridgeHideTimer.current = 0;
                  if (token === bridgeToken.current) hideBridge();
                }, 900);
              });
            }
          }
        }
      })
    );
    offs.push(
      engine.on("loadedmetadata", ({ tag }) => {
        if (!isActiveTag(tag)) return;
        setDuration((engine.el.duration || 0) * 1000);
        setLoading(false);
      })
    );
    offs.push(engine.on("playing", ({ tag }) => { if (isActiveTag(tag)) { setIsPlaying(true); setLoading(false); } }));
    offs.push(engine.on("play", ({ tag }) => { if (isActiveTag(tag)) setIsPlaying(true); }));
    offs.push(engine.on("waiting", ({ tag }) => { if (isActiveTag(tag)) setLoading(true); }));
    offs.push(engine.on("pause", ({ tag }) => {
      // the outgoing element pauses as the crossfade completes — it must not
      // flip the UI to "paused" while the incoming track is still playing
      if (isActiveTag(tag) && !crossingRef.current) setIsPlaying(false);
    }));
    offs.push(
      engine.on("ended", ({ tag }) => {
        if (!isActiveTag(tag) || crossingRef.current) return;
        hideBridge();
        const { repeat: rep } = r.current;
        if (rep === "one") {
          engine.seek(0);
          engine.play();
          return;
        }
        const ni = nextIndexFor(r.current.queue, r.current.index, r.current.shuffle);
        if (ni === -1) {
          if (rep === "all" && r.current.queue.length) {
            setIndex(0);
            setTimeout(() => activate(r.current.queue[0]), 0);
          } else {
            const cur = r.current.queue[r.current.index];
            const auto = r.current.settings.autoplayRadio !== false;
            const seedable = cur && cur.source !== "podcast" && cur.source !== "radio";
            if (auto && seedable && autoplayTriedRef.current !== cur.id && radioAutoplayRef.current) {
              autoplayTriedRef.current = cur.id;
              setIsPlaying(false);
              notify("That was the last one — tuning a radio station 🎙️");
              radioAutoplayRef.current(cur.artist || cur.title);
            } else {
              setIsPlaying(false);
            }
          }
          return;
        }
        setIndex(ni);
        activate(r.current.queue[ni]);
      })
    );
    offs.push(
      engine.on("error", ({ tag }) => {
        if (!isActiveTag(tag)) return;
        hideBridge();
        const cur = r.current.queue[r.current.index];
        setLoading(false);
        if (!cur) return;
        if (engine.mode === "graph" && !retriedRef.current) {
          retriedRef.current = true;
          notify("Trying a safer audio path... 🔧");
          engine.setMode("plain");
          const np = resolvePlayable(cur, r.current.settings);
          engine.load(np.url, true);
          return;
        }
        notify(`Couldn't play "${cur.title}" 😵`);
        // A dead stream upstream must not end the party: skip to the next
        // track that hasn't already failed in this queue.
        const q = r.current.queue;
        failedRef.current.add(cur.id);
        let ni = r.current.index;
        for (let step = 1; step <= q.length; step++) {
          const cand = (r.current.index + step) % q.length;
          if (!failedRef.current.has(q[cand].id)) {
            ni = cand;
            break;
          }
        }
        if (ni !== r.current.index) {
          notify("Skipping a dead track ⏭️");
          setIndex(ni);
          activate(q[ni]);
        } else {
          setIsPlaying(false);
        }
      })
    );
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activate, bumpStat, countPlay, notify, setMediaSession, showBridge, hideBridge]);

  /* media session handlers */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch { /* ignore */ } };
    set("play", () => resume());
    set("pause", () => pause());
    set("nexttrack", () => next());
    set("previoustrack", () => prev());
    return () => {
      ["play", "pause", "nexttrack", "previoustrack"].forEach((a) => set(a, null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, index]);

  /* ---------------- controls ---------------- */
  const resume = useCallback(() => {
    if (!r.current.queue.length) return;
    if (r.current.index === -1) {
      setIndex(0);
      activate(r.current.queue[0]);
      return;
    }
    engine.ensureReady();
    engine.play();
  }, [activate]);

  const pause = useCallback(() => {
    engine.pause();
    hideBridge();
    setIsPlaying(false);
  }, [hideBridge]);

  const toggle = useCallback(() => {
    isPlaying ? pause() : resume();
  }, [isPlaying, pause, resume]);

  const next = useCallback(() => {
    const ni = nextIndexFor(r.current.queue, r.current.index, r.current.shuffle);
    if (ni === -1) {
      if (r.current.repeat === "all" && r.current.queue.length) {
        setIndex(0);
        activate(r.current.queue[0]);
      } else {
        engine.pause();
        setIsPlaying(false);
      }
      return;
    }
    setIndex(ni);
    activate(r.current.queue[ni]);
  }, [activate]);

  const prev = useCallback(() => {
    if (engine.el.currentTime > 4) {
      engine.seek(0);
      return;
    }
    const i = r.current.index;
    const ni = i <= 0 ? 0 : i - 1;
    setIndex(ni);
    activate(r.current.queue[ni]);
  }, [activate]);

  const seek = useCallback((ratio) => {
    const el = engine.el;
    if (!el.duration) return;
    engine.seek(Math.max(0, Math.min(1, ratio)) * el.duration);
  }, []);

  const seekSeconds = useCallback((s) => {
    engine.seek(s);
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
    setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  /* ---------------- queue actions ---------------- */
  const playAll = useCallback(
    (list, startIndex = 0) => {
      if (!list?.length) return;
      crossingRef.current = false;
      failedRef.current.clear();
      autoplayTriedRef.current = "";
      setQueue(list);
      setIndex(startIndex);
      activate(list[startIndex]);
    },
    [activate]
  );

  const playTrack = useCallback(
    (track, list = null) => {
      if (!track) return;
      if (list && list.length) {
        playAll(list, Math.max(0, list.findIndex((t) => t.id === track.id)));
        return;
      }
      const i = r.current.queue.findIndex((t) => t.id === track.id);
      if (i >= 0) {
        setIndex(i);
        activate(r.current.queue[i]);
        return;
      }
      const q = [...r.current.queue, track];
      setQueue(q);
      setIndex(q.length - 1);
      activate(track);
    },
    [activate, playAll]
  );

  const jumpTo = useCallback(
    (i) => {
      if (i < 0 || i >= r.current.queue.length) return;
      setIndex(i);
      activate(r.current.queue[i]);
    },
    [activate]
  );

  const addToQueue = useCallback(
    (track) => {
      setQueue((q) => (q.some((t) => t.id === track.id) ? q : [...q, track]));
      notify(`Queued it up! "${track.title}" 🎟️`);
    },
    [notify]
  );

  const playNext = useCallback(
    (track) => {
      setQueue((q) => {
        const without = q.filter((t) => t.id !== track.id);
        const at = Math.max(0, r.current.index) + 1;
        return [...without.slice(0, at), track, ...without.slice(at)];
      });
      notify(`"${track.title}" jumped the line! 🚀`);
    },
    [notify]
  );

  const removeFromQueue = useCallback(
    (i) => {
      setQueue((q) => {
        const n = q.filter((_, x) => x !== i);
        if (i < r.current.index) setIndex((idx) => idx - 1);
        return n;
      });
    },
    []
  );

  const moveInQueue = useCallback((from, to) => {
    setQueue((q) => {
      const n = q.slice();
      const [it] = n.splice(from, 1);
      n.splice(to, 0, it);
      return n;
    });
  }, []);

  const clearQueue = useCallback(() => {
    engine.pause();
    hideBridge();
    setQueue([]);
    setIndex(-1);
    setIsPlaying(false);
  }, [hideBridge]);

  /* ---------------- radio ---------------- */
  const startRadio = useCallback(
    async (seed) => {
      const s = (seed || "").trim();
      if (!s) return notify('Give me a seed first! e.g. "Chill lo-fi" 🌱');
      setLoadingRadio(true);
      setRadioSeed(s);
      notify(`Tuning to "${s}"... 📻`);
      try {
        const list = await buildRadio(s, 30);
        if (!list.length) return notify("That station is off-air. Try another vibe! 📡");
        playAll(list, 0);
        notify(`Now broadcasting: ${s} radio 🎙️`);
      } catch {
        notify("The radio tower tripped over. Try again! 🔌");
      } finally {
        setLoadingRadio(false);
      }
    },
    [notify, playAll]
  );

  /* The "ended" handler is registered once; it calls through this ref so it
     always sees the latest startRadio without re-binding every listener. */
  radioAutoplayRef.current = startRadio;

  /* ---------------- sleep timer ---------------- */
  useEffect(() => {
    if (!sleepEnds) return;
    const iv = setInterval(() => {
      const left = sleepEnds - Date.now();
      setSleepRemaining(Math.max(0, left));
      if (left <= 0) {
        engine.pause();
        setIsPlaying(false);
        setSleepEnds(0);
        notify("Sleep timer done — night night 😴");
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [sleepEnds, notify]);

  const setSleep = useCallback(
    (minutes) => {
      if (!minutes) {
        setSleepEnds(0);
        setSleepRemaining(0);
        notify("Sleep timer off ⏰");
        return;
      }
      setSleepEnds(Date.now() + minutes * 60000);
      notify(`Sleep timer set for ${minutes} min 😴`);
    },
    [notify]
  );

  /* ---------------- liked / playlists / albums / follow ---------------- */
  const isLiked = useCallback((id) => liked.some((t) => t.id === id), [liked]);

  const toggleLike = useCallback(
    (track) => {
      setLiked((l) => {
        const has = l.some((t) => t.id === track.id);
        notify(has ? `Removed "${track.title}" from Liked 💔` : `Liked "${track.title}"! ❤️`);
        return has ? l.filter((t) => t.id !== track.id) : [track, ...l];
      });
    },
    [notify]
  );

  const createPlaylist = useCallback(
    (name) => {
      const clean = (name || "").trim();
      if (!clean) return notify("Playlists need names, silly! ✏️");
      const pl = { id: uid(), name: clean, tracks: [], createdAt: Date.now() };
      setPlaylists((p) => [...p, pl]);
      notify(`Created playlist "${clean}" 🎉`);
      return pl;
    },
    [notify]
  );

  const addToPlaylist = useCallback(
    (playlistId, track) => {
      setPlaylists((p) =>
        p.map((pl) =>
          pl.id === playlistId && !pl.tracks.some((t) => t.id === track.id)
            ? { ...pl, tracks: [...pl.tracks, track] }
            : pl
        )
      );
      notify("Tucked it into your playlist! 🧺");
    },
    [notify]
  );

  const removePlaylist = useCallback((id) => {
    setPlaylists((p) => p.filter((pl) => pl.id !== id));
  }, []);

  const renamePlaylist = useCallback((id, name) => {
    setPlaylists((p) => p.map((pl) => (pl.id === id ? { ...pl, name } : pl)));
  }, []);

  const removeFromPlaylist = useCallback((playlistId, trackId) => {
    setPlaylists((p) =>
      p.map((pl) => (pl.id === playlistId ? { ...pl, tracks: pl.tracks.filter((t) => t.id !== trackId) } : pl))
    );
  }, []);

  const isAlbumSaved = useCallback((id) => savedAlbums.some((a) => a.id === id), [savedAlbums]);
  const toggleSaveAlbum = useCallback(
    (album) => {
      setSavedAlbums((a) => {
        const has = a.some((x) => x.id === album.id);
        notify(has ? "Album removed from library 📤" : `Saved "${album.title}" ✅`);
        return has ? a.filter((x) => x.id !== album.id) : [album, ...a];
      });
    },
    [notify]
  );

  const isFollowed = useCallback((name) => followed.some((a) => a.name === name), [followed]);
  const toggleFollow = useCallback(
    (artist) => {
      setFollowed((a) => {
        const has = a.some((x) => x.name === artist.name);
        notify(has ? `Unfollowed ${artist.name} 👋` : `Following ${artist.name}! ⭐`);
        return has ? a.filter((x) => x.name !== artist.name) : [{ ...artist }, ...a];
      });
    },
    [notify]
  );

  /* ---------------- local files ---------------- */
  const addLocalFiles = useCallback(
    async (files) => {
      const list = Array.from(files || []);
      if (!list.length) return;
      let added = 0;
      for (const f of list) {
        const isAudio = /audio|flac|mp3|m4a|wav|ogg|opus|aac|aiff/i.test(f.type + f.name);
        if (!isAudio) continue;
        const base = f.name.replace(/\.[^.]+$/, "");
        const [maybeArtist, maybeTitle] = base.includes(" - ") ? base.split(" - ") : ["", base];
        const rec = {
          id: uid(),
          name: f.name,
          type: f.type || "",
          size: f.size,
          blob: f,
          addedAt: Date.now(),
          artist: (maybeArtist || "Unknown artist").trim(),
          title: (maybeTitle || base).trim(),
          lossless: /flac|wav|aiff|alac/i.test(f.type + f.name),
        };
        try {
          await putFile(rec);
          added++;
        } catch {
          /* skip */
        }
      }
      const all = await allFiles();
      hydrateLocal(all);
      notify(added ? `Grabbed ${added} file${added > 1 ? "s" : ""} 🎁` : "No audio files in there 🤔");
    },
    [notify]
  );

  const hydrateLocal = useCallback((recs) => {
    // One blob: URL per file, reused across re-hydrations. Old URLs are only
    // revoked when the file is actually gone, so a playing track never loses
    // its source just because another import was added or removed.
    if (!localUrls.current) localUrls.current = new Map();
    const next = new Map();
    const mapped = recs.map((rec) => {
      let url = localUrls.current.get(rec.id);
      if (!url) url = URL.createObjectURL(rec.blob);
      next.set(rec.id, url);
      return {
        id: `lf-${rec.id}`,
        localId: rec.id,
        source: "local",
        title: rec.title,
        artist: rec.artist,
        album: "Local files",
        art: "",
        preview: url,
        blobUrl: url,
        duration: 0,
        lossless: rec.lossless,
        format: (rec.name.match(/\.([^.]+)$/)?.[1] || "").toUpperCase(),
      };
    });
    for (const [id, url] of localUrls.current) {
      if (!next.has(id)) URL.revokeObjectURL(url);
    }
    localUrls.current = next;
    setLocalTracks(mapped);
  }, []);

  useEffect(() => {
    allFiles()
      .then(hydrateLocal)
      .catch(() => {});
  }, [hydrateLocal]);

  const removeLocal = useCallback(
    async (localId) => {
      await delFile(localId);
      const all = await allFiles();
      hydrateLocal(all);
    },
    [hydrateLocal]
  );

  const clearLocal = useCallback(async () => {
    await clearFiles();
    hydrateLocal([]);
  }, [hydrateLocal]);

  /* ---------------- offline downloads ----------------
     Downloads are device-level: bytes live in IndexedDB, and a blob: URL is
     registered per track so resolvePlayable() can play it with no network. */
  const downloadedOnce = useRef(false);
  useEffect(() => {
    if (downloadedOnce.current) return;
    downloadedOnce.current = true;
    allDownloads()
      .then((recs) => {
        const mapped = recs.map((rec) => {
          const url = URL.createObjectURL(rec.blob);
          setOfflineUrl(rec.id, url);
          return { id: rec.id, track: rec.track, size: rec.size, addedAt: rec.addedAt, url };
        });
        setDownloads(mapped);
      })
      .catch(() => {});
  }, []);

  const isDownloaded = useCallback(
    (id) => downloads.some((d) => d.id === id),
    [downloads]
  );

  const downloadTrack = useCallback(
    async (track) => {
      if (!track?.id) return;
      if (track.source === "local") return notify("That one's already on your device 🎧");
      if (downloads.some((d) => d.id === track.id)) return notify("Already saved offline ✅");
      const playable = resolvePlayable(track, settings, { preferOffline: false });
      if (!playable?.url) return notify("Nothing to download for that track 🤔");
      notify(`Grabbing "${track.title}" for offline... 📥`);
      try {
        const res = await fetch(playable.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.size) throw new Error("empty");
        const slim = {
          id: track.id, source: track.source, title: track.title,
          artist: track.artist, album: track.album, art: track.art,
          artBig: track.artBig, duration: track.duration,
          lossless: track.lossless, format: track.format,
          genre: track.genre, year: track.year, scId: track.scId,
          preview: track.preview, stream: track.stream,
        };
        const rec = { id: track.id, track: slim, size: blob.size, addedAt: Date.now(), blob };
        await putDownload(rec);
        const url = URL.createObjectURL(blob);
        setOfflineUrl(track.id, url);
        setDownloads((d) =>
          d.some((x) => x.id === track.id)
            ? d
            : [{ id: track.id, track: slim, size: blob.size, addedAt: rec.addedAt, url }, ...d]
        );
        notify(`"${track.title}" is ready offline 🎉`);
      } catch {
        notify("Couldn't save that one offline — the source may block downloads 😕");
      }
    },
    [downloads, settings, notify]
  );

  const removeDownload = useCallback(
    async (id) => {
      try {
        await delDownload(id);
      } catch {
        /* ignore */
      }
      releaseOffline(id);
      setDownloads((d) => d.filter((x) => x.id !== id));
      notify("Download removed 🗑️");
    },
    [notify]
  );

  const clearDownloads = useCallback(async () => {
    try {
      await clearDownloadStore();
    } catch {
      /* ignore */
    }
    for (const d of downloads) releaseOffline(d.id);
    setDownloads([]);
    notify("Offline downloads cleared 🧹");
  }, [downloads, notify]);

  /* ---------------- vault ---------------- */
  const exportVault = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ liked, recent, playlists, savedAlbums, followed, stats, exportedAt: Date.now() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grab-it-vault.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Vault exported! Keep it safe 🗝️");
  }, [liked, recent, playlists, savedAlbums, followed, stats, notify]);

  const importVault = useCallback(
    (json) => {
      try {
        const d = typeof json === "string" ? JSON.parse(json) : json;
        if (d.liked) setLiked(d.liked);
        if (d.recent) setRecent(d.recent);
        if (d.playlists) setPlaylists(d.playlists);
        if (d.savedAlbums) setSavedAlbums(d.savedAlbums);
        if (d.followed) setFollowed(d.followed);
        if (d.stats) setStats(d.stats);
        notify("Vault restored! Welcome back 🎊");
      } catch {
        notify("That file looks like nonsense 🤨");
      }
    },
    [notify]
  );

  /* ---------------- derived ---------------- */
  const topArtists = useMemo(
    () =>
      Object.entries(stats.artists || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name, count })),
    [stats]
  );

  const topTracks = useMemo(
    () =>
      Object.values(stats.plays || {})
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 30)
        .map((p) => ({ ...p.track, plays: p.count })),
    [stats]
  );

  const value = useMemo(
    () => ({
      queue, index, current, isPlaying, loading, progress, elapsed, duration,
      bridge,
      volume, muted, setVolume, toggleMute, quality,
      shuffle, setShuffle, repeat, setRepeat,
      sleepEnds, sleepRemaining, setSleep,
      radioSeed, loadingRadio, startRadio,
      playTrack, playAll, jumpTo, addToQueue, playNext, removeFromQueue, moveInQueue, clearQueue,
      resume, pause, toggle, next, prev, seek, seekSeconds,
      liked, isLiked, toggleLike, recent,
      playlists, createPlaylist, addToPlaylist, removePlaylist, renamePlaylist, removeFromPlaylist,
      savedAlbums, isAlbumSaved, toggleSaveAlbum,
      followed, isFollowed, toggleFollow,
      localTracks, addLocalFiles, removeLocal, clearLocal,
      downloads, downloadTrack, removeDownload, clearDownloads, isDownloaded,
      stats, topArtists, topTracks,
      exportVault, importVault, notify, toasts,
      engine,
    }),
    [
      queue, index, current, isPlaying, loading, progress, elapsed, duration,
      bridge,
      volume, muted, setVolume, toggleMute, quality, shuffle, repeat, sleepEnds,
      sleepRemaining, setSleep, radioSeed, loadingRadio, startRadio, playTrack,
      playAll, jumpTo, addToQueue, playNext, removeFromQueue, moveInQueue, clearQueue,
      resume, pause, toggle, next, prev, seek, seekSeconds, liked, isLiked, toggleLike,
      recent, playlists, createPlaylist, addToPlaylist, removePlaylist, renamePlaylist,
      removeFromPlaylist, savedAlbums, isAlbumSaved, toggleSaveAlbum, followed,
      isFollowed, toggleFollow, localTracks, addLocalFiles, removeLocal, clearLocal,
      downloads, downloadTrack, removeDownload, clearDownloads, isDownloaded,
      stats, topArtists, topTracks, exportVault, importVault, notify, toasts,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
