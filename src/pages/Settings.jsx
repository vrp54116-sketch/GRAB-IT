import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useSettings, PRESETS, EQ_FREQS } from "../settings/SettingsContext.jsx";
import { useTheme } from "../theme.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useCircadian } from "../env/CircadianContext.jsx";
import { subsonicPing } from "../audio/providers.js";
import { wipe } from "../lib/store.js";
import { go, useRoute } from "../router.jsx";
import FxControls from "../components/FxControls.jsx";
import SpatialControls from "../components/SpatialControls.jsx";
import {
  SectionTitle, Panel, SketchButton, Input, Select, Switch, Slider, TabBar, Tab,
  IconButton, Chip, Badge, Spinner, ModalScrim, ModalCard,
} from "../ui/kit.jsx";
import {
  Palette, Equalizer, Server, User, Download, Upload, Trash, LogOut, UserPlus,
  Check, Sparkle, Trend, Folder, Info, Waves, Spatial, Cloud, Rain,
  Radio, Podcast,
} from "../ui/Icons.jsx";
import { wobbleBorder, wobbleBorderAlt } from "../theme.jsx";
import { APP_NAME, APP_TAGLINE, APP_VERSION_LABEL } from "../lib/appInfo.js";

const RowWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 2px dashed ${({ theme }) => theme.line}1f;
  &:last-child { border-bottom: none; }
  .label { flex: 1; min-width: 0; }
  .label b { display: block; font-size: 15px; font-weight: 800; }
  .label span { font-family: "Nunito", system-ui, sans-serif; font-size: 13.5px; color: ${({ theme }) => theme.textSoft}; }

  /* phones: a control that doesn't fit slides under its label, right-aligned,
     instead of squeezing the description into a two-word column. */
  @media (max-width: 600px) {
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 11px 0;
    .label { flex: 1 1 auto; min-width: 0; }
    > *:not(.label) { margin-left: auto; }
  }
`;

const SourceList = styled.div`display: flex; flex-direction: column;`;

const SourceRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 2px dashed ${({ theme }) => theme.line}1f;
  &:last-child { border-bottom: none; }

  .ic {
    width: 38px;
    height: 38px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: ${({ theme }) => theme.surfaceAlt};
    ${wobbleBorder(2)}
  }
  .txt { flex: 1; min-width: 0; }
  .txt b { display: block; font-size: 15px; font-weight: 800; }
  .txt p {
    margin: 2px 0 0;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: ${({ theme }) => theme.textSoft};
  }
  @media (max-width: 440px) {
    flex-wrap: wrap;
    gap: 10px;
    .ic { width: 34px; height: 34px; }
    .txt { flex: 1 1 calc(100% - 44px); }
    > span:last-child { margin-left: 44px; margin-top: -2px; }
  }
`;

const SOURCES = [
  {
    id: "grab",
    Icon: Sparkle,
    name: "GRAB IT catalogue",
    badge: "Lossless · FLAC",
    lossless: true,
    desc: "Every song, album and artist in the app — streamed full-length as real FLAC from GRAB IT's own music service.",
  },
  {
    id: "archive",
    Icon: Cloud,
    name: "Internet Archive",
    badge: "FLAC / MP3",
    desc: "Public-domain and artist-permitted recordings. Browse searches items that actually contain a FLAC file first.",
  },
  {
    id: "audius",
    Icon: Waves,
    name: "Audius",
    badge: "full tracks",
    desc: "Artist-uploaded, full-length tracks from the Audius discovery network.",
  },
  {
    id: "radio",
    Icon: Radio,
    name: "Radio-Browser",
    badge: "live",
    desc: "Thousands of live stations. The codec and bitrate shown in the player are read from the stream itself.",
  },
  {
    id: "podcasts",
    Icon: Podcast,
    name: "Podcasts",
    badge: "RSS audio",
    desc: "Shows and episodes from the iTunes directory — the audio itself comes straight from each publisher's RSS feed.",
  },
  {
    id: "local",
    Icon: Folder,
    name: "Your own files",
    badge: "original",
    desc: "FLAC, ALAC, WAV, AIFF, MP3, M4A and OGG you drop in. Stored in this browser only, at full quality.",
  },
  {
    id: "subsonic",
    Icon: Server,
    name: "Your own server",
    badge: "original / FLAC",
    desc: "Navidrome, Subsonic, Airsonic or Jellyfin. Set it up below and your library shows up in Search.",
  },
];

const Card = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

function Row({ title, desc, children }) {
  return (
    <RowWrap>
      <div className="label">
        <b>{title}</b>
        {desc && <span>{desc}</span>}
      </div>
      {children}
    </RowWrap>
  );
}

const TABS = [
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "ambient", label: "Ambient", Icon: Cloud },
  { id: "audio", label: "Audio", Icon: Equalizer },
  { id: "eq", label: "Equalizer", Icon: Sparkle },
  { id: "sources", label: "Sources", Icon: Server },
  { id: "account", label: "Account", Icon: User },
  { id: "data", label: "Data", Icon: Download },
  { id: "about", label: "About", Icon: Info },
];

/* The non-flat bits of a curve, biggest first — a one-line proof of what
   the weather is actually doing to the sound. */
function curveWords(curve) {
  if (!curve) return "flat";
  const parts = curve
    .map((db, i) => ({ db, f: EQ_FREQS[i] }))
    .filter((x) => Math.abs(x.db) >= 1)
    .sort((a, b) => Math.abs(b.db) - Math.abs(a.db))
    .slice(0, 4)
    .map((x) => `${x.db > 0 ? "+" : ""}${x.db}dB @ ${x.f >= 1000 ? `${x.f / 1000}k` : x.f}`);
  return parts.join(" · ") || "flat";
}

export default function Settings() {
  const { settings, update, setBand, resetEq, applyEqPreset, reset } = useSettings();
  const { theme, toggle } = useTheme();
  const {
    scene: circadian, weather, status: skyStatus, error: skyError,
    refresh, useMyLocation,
  } = useCircadian();
  const { profiles, current, createProfile, login, logout, removeProfile, updateProfile, AVATARS } = useAuth();
  const { exportVault, importVault, notify, localTracks, addLocalFiles, clearLocal } = usePlayer();
  const route = useRoute();
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === route.id) ? route.id : "appearance"));

  useEffect(() => {
    if (TABS.some((t) => t.id === route.id)) setTab(route.id);
  }, [route.id]);

  const [subStatus, setSubStatus] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newEmoji, setNewEmoji] = useState(AVATARS[0]);
  const fileRef = useRef(null);
  const vaultRef = useRef(null);

  const testSubsonic = async () => {
    setSubStatus("testing");
    try {
      await subsonicPing(settings.subsonic);
      setSubStatus("ok");
      notify("Server connected! Your lossless library is ready 🔊");
    } catch {
      setSubStatus("fail");
      notify("Couldn't reach the server. Check URL / login 🔌");
    }
  };

  const skyOn = settings.circadian !== false;
  const skyAgo = weather?.at ? Math.max(0, Math.round((Date.now() - weather.at) / 60000)) : null;
  const skyStatusText =
    skyStatus === "off" ? "Off — the app keeps its normal palette."
      : skyStatus === "locating" ? "Finding your location…"
        : skyStatus === "loading" ? "Fetching the latest sky…"
          : skyStatus === "ready"
            ? circadian?.hasWeather
              ? `${circadian.conditionLabel}${skyAgo != null ? ` · updated ${skyAgo <= 1 ? "just now" : `${skyAgo} min ago`}` : ""}`
              : "Using the clock alone — no weather yet."
            : skyStatus === "no-location" ? "Location off — the theme follows the clock only."
              : skyStatus === "error" ? "Couldn't reach the weather service. Using the clock."
                : "Waiting for the first reading…";
  const gate = { opacity: skyOn ? 1 : 0.45, pointerEvents: skyOn ? "auto" : "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle><Palette size={22} /> Settings</SectionTitle>

      <TabBar>
        {TABS.map(({ id, label, Icon }) => (
          <Tab key={id} $on={tab === id} onClick={() => setTab(id)}><Icon size={15} /> {label}</Tab>
        ))}
      </TabBar>

      {tab === "appearance" && (
        <Card>
          <Row title="Day / night theme" desc="Paper in the day, chalkboard at night.">
            <ThemeToggle size={18} />
          </Row>
          <Row title="Animations" desc="Wobbles, swaying and dancing equalizers.">
            <Switch $on={settings.animations} onClick={() => update({ animations: !settings.animations })} aria-label="Animations" />
          </Row>
          <Row title="3D poster tilt" desc="Tilt album covers with your cursor — or your phone's gyroscope — and let a glossy light sweep across the sleeve.">
            <Switch $on={settings.posterTilt} onClick={() => update({ posterTilt: !settings.posterTilt })} aria-label="3D poster tilt" />
          </Row>
          <Row title="Visualizer" desc="Live audio-reactive drawing on Now Playing.">
            <Switch $on={settings.visualizer} onClick={() => update({ visualizer: !settings.visualizer })} aria-label="Visualizer" />
          </Row>
          <Row title="Visualizer style" desc="Pick your vibe.">
            <Select value={settings.visualizerStyle} onChange={(e) => update({ visualizerStyle: e.target.value })}>
              <option value="bars">Bars</option>
              <option value="circle">Circle</option>
              <option value="wave">Waveform</option>
            </Select>
          </Row>
          <Row
            title="Zero-clutter Zen mode"
            desc="When a song is playing, the controls fade away after 3 still seconds so only the poster, the glow and the lyrics remain. Move, tap or press any key to bring them straight back."
          >
            <Switch $on={settings.zenMode !== false} onClick={() => update({ zenMode: !(settings.zenMode !== false) })} aria-label="Zen mode" />
          </Row>
          <Row title="Podcasts on Home" desc="Show a podcast shelf on the home page.">
            <Switch $on={settings.showPodcastsOnHome} onClick={() => update({ showPodcastsOnHome: !settings.showPodcastsOnHome })} aria-label="Podcasts on home" />
          </Row>
        </Card>
      )}

      {tab === "ambient" && (
        <>
          <Card>
            <Row
              title="Circadian & weather player"
              desc="Automatically shifts your theme, EQ curve and a subtle background layer to match your local time and the live weather."
            >
              <Switch
                $on={skyOn}
                onClick={() => update({ circadian: !skyOn })}
                aria-label="Circadian and weather adaptive player"
              />
            </Row>

            <div style={{ padding: "16px 0 6px", borderTop: `2px dashed ${theme.line}22` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>{circadian?.emoji || "🕰️"}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b style={{ display: "block", fontSize: 16 }}>{circadian?.label || "Reading the sky…"}</b>
                  <span style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13.5, color: theme.textSoft }}>
                    {skyStatusText}
                  </span>
                </div>
                {circadian?.hasWeather && circadian.tempC != null && (
                  <Chip>{Math.round(circadian.tempC)}°C</Chip>
                )}
                {circadian?.phaseLabel && <Badge>{circadian.phaseLabel}</Badge>}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <SketchButton onClick={() => refresh()} disabled={!skyOn || skyStatus === "locating" || skyStatus === "loading"}>
                  {skyStatus === "loading" || skyStatus === "locating" ? <Spinner /> : <Rain size={18} />} Refresh sky
                </SketchButton>
                <SketchButton onClick={() => useMyLocation()} disabled={!skyOn || skyStatus === "locating"}>
                  <Cloud size={18} /> Use my location
                </SketchButton>
              </div>

              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13, opacity: .65, margin: "12px 0 0" }}>
                Weather comes from <b>Open-Meteo</b> — free, key-less and tracking-free. Your
                coordinates are used only to ask for the current sky and never leave this device.
                {skyError ? ` (${skyError})` : ""}
              </p>
            </div>
          </Card>

          <Card>
            <Row title="Adapt the theme" desc="Tint the paper, the sky and the ambient art with the scene." >
              <div style={gate}>
                <Switch $on={settings.circadianTheme !== false} onClick={() => update({ circadianTheme: !settings.circadianTheme })} aria-label="Adapt theme" />
              </div>
            </Row>
            <Row title="Adapt the EQ" desc="A gentle curve layered under your own equalizer — warm rain, crisp mornings.">
              <div style={gate}>
                <Switch $on={settings.circadianEq !== false} onClick={() => update({ circadianEq: !settings.circadianEq })} aria-label="Adapt equalizer" />
              </div>
            </Row>
            <Row title="Ambient sound layer" desc="A quiet rain / wind / night bed underneath the music.">
              <div style={gate}>
                <Switch $on={settings.circadianAmbience !== false} onClick={() => update({ circadianAmbience: !settings.circadianAmbience })} aria-label="Ambient sound layer" />
              </div>
            </Row>
            <Row title="Ambient level" desc={`Whisper factor — ${Math.round((settings.circadianAmbienceLevel ?? 0.5) * 100)}%`}>
              <div style={{ width: 200, ...gate }}>
                <Slider
                  min="0" max="1" step="0.05"
                  value={settings.circadianAmbienceLevel ?? 0.5}
                  onChange={(e) => update({ circadianAmbienceLevel: Number(e.target.value) })}
                  aria-label="Ambient level"
                />
              </div>
            </Row>

            {circadian?.eq && (
              <div style={{ paddingTop: 14, borderTop: `2px dashed ${theme.line}22` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Sparkle size={16} />
                  <b style={{ fontSize: 15 }}>Right now: {circadian.label}</b>
                </div>
                <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13.5, opacity: .8, margin: 0 }}>
                  EQ curve — {curveWords(circadian.eq)} · bed — {circadian.ambient?.type || "none"}
                </p>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "audio" && (
        <>
          <Card>
            <Row title="Streaming quality" desc="Your own server can send the original file or a 320k MP3. Public streams and local files always play as they are.">
              <Select value={settings.quality} onChange={(e) => update({ quality: e.target.value })}>
                <option value="auto">Auto — FLAC when available</option>
                <option value="lossless">Lossless — original / FLAC</option>
                <option value="high">High — 320k MP3 (data saver)</option>
              </Select>
            </Row>
            <Row
              title="Crossfade"
              desc={`Blend one song into the next — ${settings.crossfade}s${settings.lyricBridge !== false && settings.crossfade === 0 ? " (the Lyric Bridge uses 5s)" : ""}.`}
            >
              <div style={{ width: 200 }}>
                <Slider min="0" max="12" step="1" value={settings.crossfade} onChange={(e) => update({ crossfade: Number(e.target.value) })} />
              </div>
            </Row>
            <Row
              title="Cross-Song Lyric Bridge"
              desc="Peek the next poster and its opening lyric as the final seconds crossfade — no dead air between tracks."
            >
              <Switch
                $on={settings.lyricBridge !== false}
                onClick={() => update({ lyricBridge: !(settings.lyricBridge !== false) })}
                aria-label="Cross-Song Lyric Bridge"
              />
            </Row>
            <Row title="Gapless playback" desc="Preload the next track so albums flow without gaps.">
              <Switch $on={settings.gapless} onClick={() => update({ gapless: !settings.gapless })} aria-label="Gapless" />
            </Row>
            <Row title="Volume normalization" desc="Evens out loud and quiet tracks with a gentle compressor on the Web Audio chain.">
              <Switch $on={settings.normalize} onClick={() => update({ normalize: !settings.normalize })} aria-label="Normalize" />
            </Row>
            <Row title="Autoplay radio" desc="When a queue runs out, keep going with a station seeded from the last artist.">
              <Switch $on={settings.autoplayRadio} onClick={() => update({ autoplayRadio: !settings.autoplayRadio })} aria-label="Autoplay radio" />
            </Row>
            <Row title="Save listening history" desc="Powers Recently Played and Wrapped.">
              <Switch $on={settings.historyEnabled} onClick={() => update({ historyEnabled: !settings.historyEnabled })} aria-label="History" />
            </Row>
            <Row title="Sleep timer default" desc="Minutes for the quick sleep timer.">
              <Select value={settings.sleepTimerDefault} onChange={(e) => update({ sleepTimerDefault: Number(e.target.value) })}>
                {[10, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
              </Select>
            </Row>
          </Card>

          <Card>
            <div style={{ padding: "2px 0 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Waves size={18} />
                <b style={{ fontSize: 17 }}>Slowed + Reverb</b>
                <Badge>real-time FX</Badge>
              </div>
              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14, opacity: .8, margin: "6px 0 0" }}>
                One tap drops the tempo and floats the song in a reverb tail — then tweak the pitch,
                the room and the warmth yourself. Everything runs live on the Web Audio graph.
              </p>
            </div>
            <FxControls />
          </Card>

          <Card>
            <div style={{ padding: "2px 0 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Spatial size={18} />
                <b style={{ fontSize: 17 }}>8D / Spatial Audio</b>
                <Badge>Dual binaural + room</Badge>
              </div>
              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14, opacity: .8, margin: "6px 0 0" }}>
                Professional 8D: left and right channels fly as two separate binaural satellites,
                each muffled as it passes behind your head, while bass under 120 Hz stays centred
                and Google Resonance paints real wall reflections around the orbit. On a phone,
                Gyro Spatial Tracking pins that stage to the room as you turn.
              </p>
            </div>
            <SpatialControls />
          </Card>
        </>
      )}

      {tab === "eq" && (
        <Card>
          <Row title="Equalizer" desc="Real 10-band EQ applied to the audio graph.">
            <Switch $on={settings.eqEnabled} onClick={() => update({ eqEnabled: !settings.eqEnabled })} aria-label="Equalizer" />
          </Row>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "6px 0 10px" }}>
            {Object.keys(PRESETS).map((k) => (
              <Chip key={k} as="button" onClick={() => applyEqPreset(k)} style={{ cursor: "pointer", border: "2px solid currentColor" }}>{k}</Chip>
            ))}
            <Chip as="button" onClick={resetEq} style={{ cursor: "pointer", border: "2px solid currentColor" }}>Reset</Chip>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", overflowX: "auto", padding: "8px 4px 4px" }}>
            {EQ_FREQS.map((f, i) => (
              <div key={f} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 42 }}>
                <span style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 12, color: "inherit", opacity: .7 }}>
                  {settings.eqBands[i] > 0 ? "+" : ""}{settings.eqBands[i]}
                </span>
                <input
                  type="range" min="-12" max="12" step="1" value={settings.eqBands[i]}
                  onChange={(e) => setBand(i, Number(e.target.value))}
                  disabled={!settings.eqEnabled}
                  style={{ writingMode: "vertical-lr", direction: "rtl", height: 130, accentColor: theme.accent, opacity: settings.eqEnabled ? 1 : .45 }}
                  aria-label={`${f} Hz`}
                />
                <span style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 11, opacity: .7 }}>{f >= 1000 ? `${f / 1000}k` : f}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13.5, opacity: .7, margin: "6px 0 0" }}>
            Tip: the EQ + visualizer need Web Audio access. Apple previews and local files allow this.
          </p>
        </Card>
      )}

      {tab === "sources" && (
        <>
          <Card>
            <div style={{ padding: "2px 0 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Server size={18} />
                <b style={{ fontSize: 17 }}>Where the music comes from</b>
              </div>
              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14, opacity: .8, margin: "6px 0 0" }}>
                GRAB IT! is a player, not a single library. It finds playable audio across the
                free sources below and always shows the real quality on the player badge.
              </p>
            </div>
            <SourceList>
              {SOURCES.map(({ id, Icon, name, badge, desc, lossless }) => (
                <SourceRow key={id}>
                  <span className="ic"><Icon size={18} /></span>
                  <span className="txt">
                    <b>{name}</b>
                    <p>{desc}</p>
                  </span>
                  <Badge $tone={lossless ? "lossless" : undefined} style={{ flex: "none", marginTop: 3 }}>
                    {badge}
                  </Badge>
                </SourceRow>
              ))}
            </SourceList>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Folder size={18} /> <b>Local files</b>
              <Badge $tone="lossless">original quality</Badge>
              <Chip>{localTracks.length} {localTracks.length === 1 ? "track" : "tracks"}</Chip>
            </div>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14, opacity: .8, margin: "0 0 10px" }}>
              Drop in your own songs — FLAC, ALAC, WAV and AIFF play exactly as they are, stored in
              this browser only.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SketchButton onClick={() => fileRef.current?.click()}><Upload size={18} /> Add files</SketchButton>
              {localTracks.length > 0 && <SketchButton onClick={() => { clearLocal(); notify("Local library cleared 🧹"); }}><Trash size={18} /> Clear</SketchButton>}
              <input
                ref={fileRef} type="file" accept="audio/*,.flac" multiple
                onChange={(e) => { addLocalFiles(e.target.files); e.target.value = ""; }}
                style={{ display: "none" }}
              />
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Server size={18} /> <b>Your own server</b>
              <Badge $tone="lossless">Subsonic API</Badge>
            </div>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14, opacity: .8, margin: "0 0 10px" }}>
              Point GRAB IT! at a Navidrome / Subsonic / Airsonic / Jellyfin server to stream your own
              library. It streams the original file (no transcode) unless you pick 320k MP3 in Audio.
            </p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", maxWidth: 520 }}>
              <Input
                placeholder="https://music.myserver.com" value={settings.subsonic.url}
                onChange={(e) => update({ subsonic: { ...settings.subsonic, url: e.target.value } })}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Input placeholder="username" value={settings.subsonic.user} onChange={(e) => update({ subsonic: { ...settings.subsonic, user: e.target.value } })} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Input type="password" placeholder="password" value={settings.subsonic.password} onChange={(e) => update({ subsonic: { ...settings.subsonic, password: e.target.value } })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Switch $on={settings.subsonic.enabled} onClick={() => update({ subsonic: { ...settings.subsonic, enabled: !settings.subsonic.enabled } })} aria-label="Enable server" />
                <span style={{ fontFamily: '"Nunito", system-ui, sans-serif' }}>enabled</span>
                <SketchButton
                  onClick={testSubsonic}
                  disabled={subStatus === "testing" || !settings.subsonic.url || !settings.subsonic.user || !settings.subsonic.password}
                >
                  {subStatus === "testing" ? <Spinner /> : <Server size={18} />} Test connection
                </SketchButton>
                {subStatus === "ok" && <Badge $tone="lossless"><Check size={12} /> connected</Badge>}
                {subStatus === "fail" && <Badge $tone="warn">not reachable</Badge>}
              </div>
            </div>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13, opacity: .65, marginTop: 10 }}>
              Your server must send CORS headers (most do, or enable them in the server config) for EQ,
              visualizer and normalization. Without them playback still works on the plain audio path.
            </p>
          </Card>
        </>
      )}

      {tab === "account" && (
        <Card>
          <div style={{ padding: "6px 0 12px" }}>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14.5, opacity: .85, margin: 0 }}>
              Profiles live on <b>this device only</b> — no cloud, no email, no tracking. A PIN is a friendly gate,
              not real security.
            </p>
          </div>
          {profiles.map((p) => (
            <RowWrap key={p.id}>
              <span style={{ fontSize: 28 }}>{p.emoji}</span>
              <div className="label">
                <b>{p.name} {p.id === current?.id ? "• you" : ""}</b>
                <span>{p.pin ? "PIN protected" : "no PIN"}</span>
              </div>
              {p.id !== current?.id && (
                <SketchButton onClick={() => { const r = login(p.id, p.pin ? prompt("PIN?") || "" : ""); notify(r.ok ? `Welcome back, ${p.name}!` : "Wrong PIN 🤨"); }}>
                  <User size={16} /> Switch
                </SketchButton>
              )}
              {profiles.length > 1 && (
                <IconButton onClick={() => removeProfile(p.id)} aria-label="Delete profile"><Trash size={18} /></IconButton>
              )}
            </RowWrap>
          ))}

          <div style={{ padding: "14px 0", borderTop: `2px dashed ${theme.line}22` }}>
            <b style={{ display: "block", marginBottom: 8 }}>Create a profile</b>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", maxWidth: 560 }}>
              <Select value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)}>
                {AVATARS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div style={{ width: 130 }}>
                <Input placeholder="PIN (optional)" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              </div>
              <SketchButton $variant="accent" onClick={() => { if (!newName.trim()) return notify("Give the profile a name 🙃"); createProfile({ name: newName, emoji: newEmoji, pin: newPin }); setNewName(""); setNewPin(""); notify("Profile created! 🎉"); }}>
                <UserPlus size={18} /> Add
              </SketchButton>
            </div>
          </div>

          {current && (
            <Row title="Signed in as" desc={current.name}>
              <SketchButton onClick={() => { logout(); notify("Logged out. Bye! 👋"); }}><LogOut size={18} /> Log out</SketchButton>
            </Row>
          )}
        </Card>
      )}

      {tab === "data" && (
        <Card>
          <Row title="Export your vault" desc="Liked songs, playlists, albums, stats — one JSON file.">
            <SketchButton onClick={exportVault}><Download size={18} /> Export</SketchButton>
          </Row>
          <Row title="Import a vault" desc="Restore from a file you exported.">
            <SketchButton onClick={() => vaultRef.current?.click()}><Upload size={18} /> Import</SketchButton>
            <input ref={vaultRef} type="file" accept="application/json" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const rd = new FileReader();
                rd.onload = () => importVault(String(rd.result));
                rd.readAsText(f);
                e.target.value = "";
              }}
            />
          </Row>
          <Row title="Reset settings" desc="Back to defaults. Your library is not touched.">
            <SketchButton onClick={() => { reset(); notify("Settings reset 🧼"); }}>Reset settings</SketchButton>
          </Row>
          <Row title="Erase everything" desc="Wipe all GRAB IT! data on this device. Cannot be undone.">
            <SketchButton $variant="danger" onClick={() => { if (confirm("Erase ALL GRAB IT! data on this device?")) { wipe(); location.reload(); } }}>
              <Trash size={18} /> Erase all
            </SketchButton>
          </Row>
        </Card>
      )}

      {tab === "about" && (
        <Card>
          <div style={{ padding: "10px 0 12px" }}>
            <h2 style={{ margin: 0 }}>{APP_NAME}</h2>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 16, opacity: .85, margin: "6px 0 0" }}>
              A free, private music player with a hand-drawn soul. No account, no ads, no tracking —
              {" "}{APP_TAGLINE}.
            </p>
          </div>

          <Row title="Version" desc="This build of the app.">
            <Chip style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{APP_VERSION_LABEL}</Chip>
          </Row>

          <Row title="Catalogue & audio" desc="GRAB IT music service — full-length lossless FLAC">
            <Chip>free</Chip>
          </Row>
          <Row title="More music" desc="Internet Archive · Audius · Radio-Browser">
            <Chip>free</Chip>
          </Row>
          <Row title="Podcasts" desc="iTunes directory — audio from each publisher's RSS">
            <Chip>free</Chip>
          </Row>
          <Row title="Lyrics" desc="LRCLIB — plain and time-synced">
            <Chip>free</Chip>
          </Row>
          <Row title="Artist info" desc="Wikipedia REST API">
            <Chip>free</Chip>
          </Row>
          <Row title="Local weather" desc="Open-Meteo — circadian & weather skin">
            <Chip>free</Chip>
          </Row>
          <Row title="Your lossless audio" desc="Your own files and your own server">
            <Chip>yours</Chip>
          </Row>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 14 }}>
            <SketchButton onClick={() => go("/wrapped")}><Trend size={18} /> See your Wrapped</SketchButton>
            <SketchButton onClick={() => go("/settings/sources")}><Server size={18} /> All sources</SketchButton>
          </div>

          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 12.5, opacity: .6, margin: "14px 0 0" }}>
            {APP_NAME} {APP_VERSION_LABEL.replace(/^V/, "v")} · made for the love of music, not for your data.
          </p>
        </Card>
      )}
    </div>
  );
}
