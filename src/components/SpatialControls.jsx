import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  useSettings, SPATIAL_SLOWEST, SPATIAL_FASTEST, SPATIAL_DEFAULT, SPATIAL_ROOM_SIZES,
} from "../settings/SettingsContext.jsx";
import { usePlayer } from "../player/PlayerContext.jsx";
import { engine } from "../audio/engine.js";
import {
  gyroTracker, canUseGyroSpatial, gyroNeedsPermission,
} from "../audio/gyro.js";
import { Slider, Switch, Select, SketchButton } from "../ui/kit.jsx";

/* ------------------------------------------------------------------ */
/*  8D / Spatial Audio controls. The graph side lives in audio/engine   */
/*  (dual-channel split + rear filter + sub anchor + Resonance room).   */
/*  Shared by Settings → Audio and the Now Playing FX tab.              */
/* ------------------------------------------------------------------ */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .text { flex: 1; min-width: 0; }
  b { display: block; font-size: 15px; font-weight: 800; }
`;

const Hint = styled.p`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13px;
  opacity: 0.72;
  margin: 3px 0 0;
  line-height: 1.5;
`;

const Dial = styled.div`
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 58px;
  align-items: center;
  gap: 10px;
  opacity: ${({ $off }) => ($off ? 0.5 : 1)};
  transition: opacity .2s ease;

  .k {
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
  }
  .v {
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 13px;
    text-align: right;
    color: ${({ theme }) => theme.textSoft};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    grid-template-columns: 74px minmax(0, 1fr) 50px;
    gap: 8px;
    .k { font-size: 13px; }
  }
`;

/** A sub-heading with a switch (for the Resonance room block). */
const RoomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
  opacity: ${({ $off }) => ($off ? 0.5 : 1)};
  transition: opacity .2s ease;

  .text { flex: 1; min-width: 0; }
  b { display: block; font-size: 15px; font-weight: 800; }
  span {
    display: block;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 13px;
    opacity: 0.72;
    margin-top: 2px;
  }
`;

/** Gyro head-tracking row: title, subtitle, switch and recenter action. */
const GyroRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0 6px;
  margin-top: 2px;
  border-top: 2px dashed ${({ theme }) => theme.line}26;

  .text { flex: 1; min-width: 0; }
  b { display: block; font-size: 15px; font-weight: 800; }
  .sub {
    display: block;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 13px;
    opacity: 0.72;
    margin-top: 3px;
    line-height: 1.5;
  }
  .warn {
    display: block;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 12.5px;
    font-weight: 700;
    margin-top: 6px;
    color: ${({ theme }) => theme.accent};
    line-height: 1.45;
  }

  @media (max-width: 480px) {
    gap: 10px;
  }
`;

const GyroActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex: none;
`;

const Recenter = styled(SketchButton)`
  font-size: 13px;
  padding: 7px 12px;
  box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
`;

const RadarWrap = styled.div`
  width: 112px;
  height: 112px;
  margin: 8px auto 2px;
  position: relative;
  border-radius: 50%;
  border: 2.4px solid ${({ theme }) => theme.inkEdge};
  background:
    radial-gradient(
      circle at 50% 50%,
      transparent 0 32%,
      ${({ theme }) => theme.line}22 33% 34%,
      transparent 35% 65%,
      ${({ theme }) => theme.line}18 66% 67%,
      transparent 68%
    ),
    ${({ theme }) => theme.surfaceAlt};
  box-shadow: inset 2px 2px 0 ${({ theme }) => theme.shadow};
  flex: none;

  .front, .back {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: .08em;
    opacity: .48;
  }
  .front { top: 5px; }
  .back { bottom: 5px; }
`;

const RadarCenter = styled.span`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px;
  border-radius: 50%;
  background: ${({ theme }) => theme.text};
  border: 2px solid ${({ theme }) => theme.surface};
  box-shadow: 0 0 0 1.5px ${({ theme }) => theme.inkEdge};
`;

const RadarDot = styled.span`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 11px;
  height: 11px;
  margin: -5.5px;
  border-radius: 50%;
  background: ${({ theme, $left }) => ($left ? theme.accent : theme.accent3)};
  border: 2px solid ${({ theme }) => theme.inkEdge};
  box-shadow: 1px 2px 0 ${({ theme }) => theme.shadow};
  pointer-events: none;
  will-change: transform, opacity;
`;

/** Top-down stage radar: the two dots mirror the live panner positions. */
function StageRadar({ enabled }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let raf = 0;
    const R = 41;
    const tick = () => {
      const o = gyroTracker.orientation;
      const place = (el, offset) => {
        if (!el) return;
        const angle = ((o.yaw + offset) * Math.PI) / 180;
        // Front of the stage is the top of the circle.
        const x = Math.sin(angle) * R;
        const y = -Math.cos(angle) * R;
        const elevation = Math.max(-1, Math.min(1, o.pitch / 60));
        const scale = 1 - Math.abs(elevation) * 0.25;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        el.style.opacity = o.active && o.hasData ? "1" : "0.35";
      };
      place(leftRef.current, -35);
      place(rightRef.current, 35);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <RadarWrap
      role="img"
      aria-label="Live sound stage radar — dots follow the phone's motion"
    >
      <span className="front">FRONT</span>
      <span className="back">BACK</span>
      <RadarCenter aria-hidden="true" />
      <RadarDot ref={leftRef} $left aria-hidden="true" />
      <RadarDot ref={rightRef} aria-hidden="true" />
    </RadarWrap>
  );
}

/** Shared toggle logic so the player bar, sheet and settings agree. */
export function useSpatial() {
  const { settings, update } = useSettings();
  const { notify } = usePlayer();
  const on = !!settings.spatial;

  const toggle = () => {
    const next = !on;
    update({ spatial: next });
    if (!next) {
      notify("8D off — stereo restored 🎧");
    } else if (engine.mode === "plain") {
      notify("8D is on — this stream plays plain, so it kicks in on the next track 🎧");
    } else {
      notify("8D on — dual binaural orbit, rear filter + room. Headphones 🎧");
    }
  };

  return { on, toggle };
}

export default function SpatialControls({ compact = false }) {
  const { settings, update } = useSettings();
  const { on, toggle } = useSpatial();
  const seconds = 1 / Math.max(
    SPATIAL_SLOWEST,
    Math.min(SPATIAL_FASTEST, Number(settings.spatialSpeed) || SPATIAL_DEFAULT)
  );
  const secondsLabel = `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
  const subDb = Number(settings.spatialSub) || 0;
  const subLabel = subDb > 0 ? `+${subDb.toFixed(1).replace(/\.0$/, "")} dB` : "0 dB";
  const roomOn = !!settings.spatialRoom;

  /* Resonance loads asynchronously from the CDN — reflect that honestly. */
  const [state, setState] = useState(() => engine.spatialState);
  useEffect(() => {
    const sync = () => setState(engine.spatialState);
    sync();
    const off = engine.on("fxready", sync);
    const id = on && roomOn ? setInterval(sync, 1200) : 0;
    return () => {
      off();
      if (id) clearInterval(id);
    };
  }, [on, roomOn]);
  const roomLive = !!state.roomReady;
  const roomFailed = !!state.roomFailed;

  /* ---- gyro head-tracking ---------------------------------------- */
  const { notify, isPlaying } = usePlayer();
  const gyroAllowed = canUseGyroSpatial();
  const gyroOn = !!settings.spatialGyro;
  const [gyroBusy, setGyroBusy] = useState(false);
  const [gyroState, setGyroState] = useState(() => gyroTracker.orientation);

  /* A light poll keeps the "waiting for motion" hint honest without
     re-rendering at sensor frequency — the radar itself reads the tracker
     directly inside its own rAF loop. */
  useEffect(() => {
    if (!gyroOn || !gyroAllowed) return undefined;
    const sync = () => setGyroState(gyroTracker.orientation);
    sync();
    const id = setInterval(sync, 700);
    return () => clearInterval(id);
  }, [gyroOn, gyroAllowed]);

  const gyroLive = gyroOn && gyroState.active && gyroState.hasData;

  const toggleGyro = async () => {
    if (!gyroAllowed || gyroBusy) return;

    if (gyroOn) {
      update({ spatialGyro: false });
      gyroTracker.stop();
      notify("Gyro stage off — the automatic 8D orbit is back 🎧");
      return;
    }

    // iOS needs requestPermission() *inside* this click, before any await
    // that could lose the user-gesture context. gyroTracker.enable() does it.
    setGyroBusy(true);
    const result = await gyroTracker.enable();
    setGyroBusy(false);

    if (!result.ok) {
      update({ spatialGyro: false });
      notify(
        result.reason === "denied"
          ? "Motion sensor access is required for Gyro 8D. Allow Motion & Orientation in your browser settings, then try again."
          : result.reason === "no-data"
            ? "No gyroscope readings from this phone — Gyro 8D needs a motion sensor, so it stays off."
            : "Mobile Gyroscope Required — Gyro 8D only works on a phone with motion sensors."
      );
      return;
    }

    update({ spatialGyro: true });
    notify("Gyro 8D on — turn your phone and the stage stays put in the room 🎧");
  };

  const recenterGyro = async () => {
    if (gyroBusy) return;

    // A persisted "on" toggle after a page reload can be waiting for the
    // iOS permission gesture. Recenter is a click, so it can grant it.
    if (gyroNeedsPermission() && !gyroTracker.granted) {
      setGyroBusy(true);
      const result = await gyroTracker.enable();
      setGyroBusy(false);
      if (!result.ok) {
        update({ spatialGyro: false });
        notify(
          result.reason === "denied"
            ? "Motion sensor access is required for Gyro 8D. Allow Motion & Orientation in your browser settings, then try again."
            : "No gyroscope readings from this phone — Gyro 8D stays off."
        );
        return;
      }
    }

    const ok = gyroTracker.recenter();
    notify(
      ok
        ? "Stage re-centered in front of you 🎯"
        : "Hold your phone steady for a moment — waiting for the gyroscope…"
    );
  };

  return (
    <Wrap>
      <Head>
        <div className="text">
          <b>8D / Spatial Audio</b>
          <Hint>
            Two binaural satellites (left and right channels) orbit opposite each other — or weave
            a figure-8 — so stereo width survives. A rear-head lowpass sweeps 20 kHz → 4.5 kHz as
            each one passes behind you, deep bass stays dead-centre at +4 dB, and Google Resonance
            adds real wall reflections. Headphones strongly recommended.
          </Hint>
        </div>
        <Switch $on={on} onClick={toggle} aria-label="8D spatial audio" />
      </Head>

      <GyroRow>
        <div className="text">
          <b>Gyro Spatial Tracking (Phone Motion 8D)</b>
          <span className="sub">
            Anchors the music stage in 3D space—turn your phone to shift sound direction.
          </span>
          {!gyroAllowed && (
            <span className="warn">
              Mobile Gyroscope Required — open GRAB IT! on a phone (touch device with motion
              sensors) to use live head-tracking.
            </span>
          )}
          {gyroAllowed && gyroOn && !on && (
            <span className="warn" style={{ opacity: 0.72 }}>
              Ready — turn 8D on to hear the live gyro stage.
            </span>
          )}
          {gyroAllowed && gyroOn && on && !isPlaying && (
            <span className="warn" style={{ opacity: 0.72 }}>
              Paused — motion tracking sleeps until playback resumes.
            </span>
          )}
          {gyroAllowed && gyroOn && on && isPlaying && !gyroLive && (
            <span className="warn">
              {gyroNeedsPermission() && !gyroTracker.granted
                ? "Motion access needs a tap — press Recenter Stage to grant it."
                : "Waiting for the gyroscope… the automatic orbit covers the gap."}
            </span>
          )}
          {gyroAllowed && gyroOn && on && isPlaying && gyroLive && (
            <span className="warn" style={{ opacity: 0.72 }}>
              ● Live stage — auto-orbit paused
            </span>
          )}
        </div>
        <GyroActions>
          <Switch
            $on={gyroAllowed && gyroOn}
            onClick={gyroAllowed ? toggleGyro : undefined}
            disabled={!gyroAllowed || gyroBusy}
            aria-label="Gyro spatial tracking"
            aria-disabled={!gyroAllowed || gyroBusy}
            title={gyroAllowed ? "Use your phone's motion to anchor the 8D stage" : "Mobile gyroscope required"}
            style={{
              opacity: gyroAllowed && !gyroBusy ? 1 : 0.45,
              cursor: gyroAllowed && !gyroBusy ? "pointer" : "not-allowed",
            }}
          />
          {gyroAllowed && gyroOn && (
            <Recenter
              type="button"
              onClick={recenterGyro}
              title="Make the way you're holding the phone the new front centre"
            >
              Recenter Stage
            </Recenter>
          )}
        </GyroActions>
      </GyroRow>

      {gyroOn && gyroAllowed && <StageRadar enabled />}

      <Dial $off={!on}>
        <span className="k">Motion</span>
        <Select
          value={settings.spatialMode}
          disabled={!on}
          onChange={(e) => update({ spatialMode: e.target.value })}
          aria-label="Spatial motion pattern"
          style={{ width: "100%" }}
        >
          <option value="orbit">Opposite orbit — classic 8D</option>
          <option value="figure8">Figure-8 weave — mirrored</option>
        </Select>
        <span className="v" />
      </Dial>

      <Dial $off={!on}>
        <span className="k">Orbit</span>
        <Slider
          min="8" max="12" step="0.5"
          value={Number(seconds.toFixed(1))}
          disabled={!on}
          onChange={(e) => update({ spatialSpeed: 1 / Number(e.target.value) })}
          aria-label="Spatial orbit speed in seconds per circle"
        />
        <span className="v">{secondsLabel}</span>
      </Dial>

      <Dial $off={!on}>
        <span className="k">Depth</span>
        <Slider
          min="0" max="1" step="0.01"
          value={settings.spatialDepth}
          disabled={!on}
          onChange={(e) => update({ spatialDepth: Number(e.target.value) })}
          aria-label="Spatial orbit depth"
        />
        <span className="v">{Math.round(settings.spatialDepth * 100)}%</span>
      </Dial>

      <Dial $off={!on}>
        <span className="k">Rear head</span>
        <Slider
          min="0" max="1" step="0.01"
          value={settings.spatialRear}
          disabled={!on}
          onChange={(e) => update({ spatialRear: Number(e.target.value) })}
          aria-label="Rear-head muffler depth"
        />
        <span className="v">{Math.round(settings.spatialRear * 100)}%</span>
      </Dial>

      <Dial $off={!on}>
        <span className="k">Sub anchor</span>
        <Slider
          min="0" max="12" step="0.5"
          value={settings.spatialSub}
          disabled={!on}
          onChange={(e) => update({ spatialSub: Number(e.target.value) })}
          aria-label="Centred sub-bass boost in decibels"
        />
        <span className="v">{subLabel}</span>
      </Dial>

      <RoomRow $off={!on}>
        <div className="text">
          <b>Resonance room</b>
          <span>Google early reflections + late tail (jsDelivr)</span>
        </div>
        <Switch
          $on={roomOn}
          onClick={() => update({ spatialRoom: !roomOn })}
          aria-label="Resonance room acoustics"
        />
      </RoomRow>

      <Dial $off={!on || !roomOn}>
        <span className="k">Room</span>
        <Select
          value={settings.spatialRoomSize}
          disabled={!on || !roomOn}
          onChange={(e) => update({ spatialRoomSize: e.target.value })}
          aria-label="Resonance room size"
          style={{ width: "100%" }}
        >
          {SPATIAL_ROOM_SIZES.map((size) => (
            <option key={size} value={size}>
              {size === "studio" ? "Studio — tight" :
                size === "club" ? "Club — lively" :
                size === "hall" ? "Concert hall — wide" : "Cathedral — huge"}
            </option>
          ))}
        </Select>
        <span className="v" />
      </Dial>

      {on && roomOn && (
        <Hint>
          {roomLive
            ? "✓ Resonance room live — two sources flying through a real acoustic model."
            : roomFailed
              ? "⚠ Resonance couldn't load (CDN blocked) — the dual-channel HRTF orbit + rear filter still run natively."
              : state.loading
                ? "Loading Google Resonance from jsDelivr… the native HRTF orbit covers the gap."
                : state.graph
                  ? "Waiting for a Web Audio stream — Resonance arms itself when a playable track starts."
                  : "Resonance loads from jsDelivr with the first played track."}
        </Hint>
      )}

      {!compact && (
        <Hint>
          Signal path: stereo split → rear-head filter per channel → dual binaural orbit → acoustic
          room, with a 120 Hz crossover holding kick and bass dead-centre. The{" "}
          <a href="https://github.com/resonance-audio/resonance-audio-web-sdk" target="_blank" rel="noreferrer">
            Resonance Audio SDK
          </a>{" "}
          shares the existing AudioContext, so the visualizer and every other effect keep working.
        </Hint>
      )}
    </Wrap>
  );
}