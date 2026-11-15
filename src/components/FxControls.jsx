import React from "react";
import styled from "styled-components";
import { useSettings, FX_PRESETS, fxActive } from "../settings/SettingsContext.jsx";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useTheme } from "../theme.jsx";
import { Chip, Slider, Select, Switch, SketchButton } from "../ui/kit.jsx";

/* ------------------------------------------------------------------ */
/*  The slowed + reverb dials. Shared by Now Playing and Settings so   */
/*  the two never drift apart.                                         */
/* ------------------------------------------------------------------ */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    cursor: pointer;
    border: 2px solid currentColor;
    font-weight: 800;
    transform: rotate(${({ $tilt }) => $tilt || 0}deg);
  }
`;

const Dial = styled.div`
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 58px;
  align-items: center;
  gap: 10px;

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

const Hint = styled.p`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13px;
  opacity: 0.7;
  margin: 0;
  line-height: 1.5;
`;

const fmtSpeed = (v) => {
  const s = Number(v).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}×`;
};

const fmtSemis = (v) => {
  const n = Number(v);
  if (!n) return "0 st";
  return `${n > 0 ? "+" : ""}${n} st`;
};

const matches = (s, p) =>
  Math.abs(s.speed - p.speed) < 0.001 &&
  Math.abs(s.pitch - p.pitch) < 0.001 &&
  s.tapePitch === p.tapePitch &&
  Math.abs(s.reverb - p.reverb) < 0.001 &&
  s.reverbRoom === p.reverbRoom &&
  Math.abs(s.warmth - p.warmth) < 0.001 &&
  !!s.spatial === !!p.spatial &&
  Math.abs(s.spatialSpeed - p.spatialSpeed) < 0.001 &&
  Math.abs(s.spatialDepth - p.spatialDepth) < 0.001 &&
  s.spatialMode === p.spatialMode &&
  Math.abs(s.spatialRear - p.spatialRear) < 0.001 &&
  Math.abs(s.spatialSub - p.spatialSub) < 0.001 &&
  !!s.spatialRoom === !!p.spatialRoom &&
  s.spatialRoomSize === p.spatialRoomSize;

const presetName = (s) => Object.keys(FX_PRESETS).find((k) => matches(s, FX_PRESETS[k])) || "Custom";

export default function FxControls({ compact = false }) {
  const { settings, update, applyFxPreset } = useSettings();
  const { notify } = usePlayer();
  const { theme } = useTheme();
  const active = fxActive(settings);
  const current = presetName(settings);

  return (
    <Wrap>
      <PresetRow $tilt={-0.4}>
        {Object.keys(FX_PRESETS).map((name) => {
          const on = current === name;
          return (
            <Chip
              key={name}
              as="button"
              onClick={() => applyFxPreset(name)}
              style={{
                cursor: "pointer",
                border: "2px solid currentColor",
                fontWeight: 800,
                background: on ? theme.accent2 : theme.chip,
                color: on ? theme.onGold : theme.text,
                outline: on ? `2px dashed ${theme.accent}` : "none",
                outlineOffset: 2,
              }}
              aria-pressed={on}
            >
              {name === "Slowed + Reverb" ? "🌊 " : name === "Nightcore" ? "⚡ " : name === "Vaporwave" ? "🌴 " : name === "Cathedral" ? "⛪ " : "🎧 "}
              {name}
            </Chip>
          );
        })}
      </PresetRow>

      <Dial>
        <span className="k">Speed</span>
        <Slider
          min="0.5" max="1.5" step="0.01"
          value={settings.speed}
          onChange={(e) => update({ speed: Number(e.target.value) })}
          aria-label="Playback speed"
        />
        <span className="v">{fmtSpeed(settings.speed)}</span>
      </Dial>

      <Dial>
        <span className="k">Pitch</span>
        <Slider
          min="-12" max="12" step="1"
          value={settings.pitch}
          onChange={(e) => update({ pitch: Number(e.target.value) })}
          aria-label="Pitch shift in semitones"
        />
        <span className="v">{fmtSemis(settings.pitch)}</span>
      </Dial>

      <Dial>
        <span className="k">Reverb</span>
        <Slider
          min="0" max="1" step="0.01"
          value={settings.reverb}
          onChange={(e) => update({ reverb: Number(e.target.value) })}
          aria-label="Reverb amount"
        />
        <span className="v">{Math.round(settings.reverb * 100)}%</span>
      </Dial>

      <Dial>
        <span className="k">Warmth</span>
        <Slider
          min="0" max="1" step="0.01"
          value={settings.warmth}
          onChange={(e) => update({ warmth: Number(e.target.value) })}
          aria-label="Warmth (lowpass damping)"
        />
        <span className="v">{Math.round(settings.warmth * 100)}%</span>
      </Dial>

      <Dial>
        <span className="k">Space</span>
        <Select value={settings.reverbRoom} onChange={(e) => update({ reverbRoom: e.target.value })} aria-label="Reverb space">
          <option value="room">Room — tight</option>
          <option value="hall">Hall — classic slowed</option>
          <option value="cathedral">Cathedral — huge</option>
        </Select>
        <span className="v">{settings.reverbRoom}</span>
      </Dial>

      <Dial>
        <span className="k">Tape pitch</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Switch
            $on={settings.tapePitch}
            onClick={() => update({ tapePitch: !settings.tapePitch })}
            aria-label="Pitch follows speed"
          />
          <span style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13, opacity: 0.75 }}>
            {settings.tapePitch ? "vocals sink with tempo" : "keep vocals, shift separately"}
          </span>
        </div>
        <span className="v" />
      </Dial>

      {!compact && (
        <Hint>
          Speed is a real tempo change (the classic “slowed edit” drops the pitch with it — turn
          <b> Tape pitch</b> off to keep the vocals put). Reverb is a real convolution tail, and pitch
          is a granular shifter running in the Web Audio graph, so the visualizer dances to the
          effect too. Streams that block CORS fall back to plain audio — speed still works, reverb
          and pitch sit that one out.
        </Hint>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <SketchButton
          $variant={active ? undefined : "accent"}
          onClick={() => {
            applyFxPreset(active ? "Off" : "Slowed + Reverb");
            notify(active ? "Back to normal speed 🎧" : "Slowed + reverb on 🌊");
          }}
        >
          {active ? "🎧 Back to normal" : "🌊 Slowed + Reverb"}
        </SketchButton>
        <SketchButton onClick={() => { applyFxPreset("Off"); notify("FX reset 🧼"); }}>
          Reset FX
        </SketchButton>
        <span style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13, opacity: 0.65 }}>
          {active ? `on · ${current}` : "off"}
        </span>
      </div>
    </Wrap>
  );
}