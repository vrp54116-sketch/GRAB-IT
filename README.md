# GRAB IT! 🖐️

**V1.0.0 BETA (testing version)**

A music streaming web app (Apple Music / Spotify style) with a **hand-drawn, funny UI** —
paper in light mode, chalkboard in dark mode — and a day/night toggle.

Everything runs **free, with no accounts and no API keys.** All of your data
(likes, playlists, stats, local files) stays on your device.

```bash
npm install
npm run dev      # frontend only, hot reload -> http://localhost:5173
npm run build    # production build to dist/
npm start        # BUILD + RUN EVERYTHING -> http://localhost:4173
npm run preview
```

### `npm start` — the UI and the GRAB IT music service on one port

`npm start` builds the UI into `dist/` (only when `src/` changed), then boots
`server.mjs`, which serves two halves of the same app on port 4173:

| Path | What answers it |
|---|---|
| `/` and every app route | the built **GRAB IT!** UI from `dist/` (SPA fallback) |
| `/api/tracks/*` | the **GRAB IT** music API (`tracks.monochrome.st`), proxied same-origin — search, releases, artists and the FLAC audio stream (`/api/tracks/track/:trackId`, range requests supported) |
| `/track/:id`, `/album/:id`, `/artist/:id`, `/playlist/:id`, `/user/@name`, `/unreleased/*`, `/api/apple-video-cover` | the 21 Cloudflare Pages **Functions** from `dropit-backend/functions/`, mounted by `server.mjs` |
| `/api/health` | JSON status: frontend built? music service functions? upstream reachable? |

Open **http://localhost:4173** and you get *this* UI, not the cloned repo's UI —
the music service is just the engine behind it. Home grows a
**📡 Straight from GRAB IT — lossless FLAC** shelf that plays full-length
FLAC straight through `/api/tracks/track/:id`.

`npm run dev` stays frontend-only; Vite proxies the same `/api/tracks/*` paths
(see `vite.config.js`), so the code path is identical in dev and production.
The catalogue client (`api/backend.js`) retries transient upstream `502/503/504`
and timeout responses twice with a short backoff, and de-duplicates overlapping
requests, so a single cold CDN response never blanks the shelves.

Env knobs: `PORT` (4173), `HOST` (0.0.0.0), `TRACKS_API_URL`
(`https://tracks.monochrome.st`).

---

## 1. What's inside

### Pages
- **Login** — device-local profiles (name + emoji + optional PIN) or "Skip (guest)".
- **Home** — greeting, a personalised **top picks for you** built from your listening history (artists, likes and recent plays), **albums from GRAB IT**, a **lossless FLAC shelf**, moods & genres, quick-grab shelves,
  "artists you keep coming back to", saved albums, and a podcasts shelf (toggle in Settings).
- **Search** — top result + filters (All / Songs / Albums / Artists / Podcasts), everything from GRAB IT, plus search history.
- **New** — the big library: **Albums · Tracks · Artists**, with genre chips and search.
- **Radio** — type any vibe → endless non-repeating auto-DJ, plus hand-picked stations.
- **Podcasts** — Top chart + categories, open any show, play real episode audio (1×–2× speed in the player).
- **Library** — tabs: Liked · Playlists · Albums · Artists · Downloads (offline saves + your own files) · Recent · Vault.
- **Playlist** — open any playlist to rename it, play/shuffle, remove tracks, or delete it.
- **Album** / **Artist** — full album tracklists, artist bio (Wikipedia), songs, albums, follow, radio.
- **Settings** — 8 tabs: Appearance · Ambient · Audio · Equalizer · Sources · Account · Data · About.
- **Wrapped** — your year-in-review (hours, top artists, top tracks).
- **Listening party** — share any track as a link; whoever opens it starts the same song at the same spot.

### Player
- Full-screen **Now Playing** with **word-by-word lyrics that follow the song** — `<am-lyrics>`
  ([binimum/am-lyrics](https://github.com/binimum/am-lyrics)) fetches Apple-Music-style TTML
  from lrc.red / LyricsPlus / LRCLib / Genius, highlights each sung word, auto-scrolls, and
  lets you tap a line to seek. Plain LRCLIB sheets remain as the fallback when no provider has it.
  The lyrics engine is a lazy chunk (~194kB) that only loads when the sheet is opened.
- **Day / night switch** — an illustrated sketchy sun/moon toggle (sun + rotating rays by day,
  cratered moon + twinkling stars, comets and aurora by night) wired to the theme everywhere:
  sidebar, login card, Settings and the mobile top bar.
- Play/pause, next/prev, shuffle, repeat (off/all/one), seek, volume, mute.
- **Zero-clutter Zen Mode** — after **3 still seconds** with a song playing, the search bar,
  transport buttons, sliders and panel borders fade away (opacity `0`), leaving only the glowing
  album poster, the drifting colour field and the word-synced `<am-lyrics>`. Moving the mouse,
  tapping, scrolling or pressing any key brings the controls straight back. The timer only runs
  while audio is actually playing, so nothing ever vanishes when paused, and it can be switched
  off in *Settings → Appearance → Zero-clutter Zen mode*.
- **Real 10-band EQ** on the Web Audio graph, presets (Bass Boost, Late Night, Party…).
- **Live audio-reactive visualizer** (bars / circle / waveform).
- **Crossfade**, **gapless** preload, **volume normalization** (a real compressor on the Web
  Audio graph), **autoplay radio** when a queue ends, **sleep timer**, **Media Session**
  (OS/lock-screen keys).
- **Cross-Song Lyric Bridge** — in the final seconds of a track the incoming song's poster and
  its opening lyric softly peek in from the bottom edge while the two songs crossfade, so playlists
  flow with no dead air. With the crossfade dial at 0 the bridge still hands off over 5 seconds;
  turn it off in **Settings → Audio**. The opening line is pulled from LRCLIB once per track and cached.
- **Media Session metadata** + artwork.
- **Sing** — mid/side vocal step-back so you can sing along.
- **Slowed + Reverb** — one tap drops the tempo and floats the song in a real convolution tail.
  The **FX** tab (Now Playing) and **Settings → Audio** expose the dials: speed **0.5×–1.5×**,
  **pitch −12…+12 st**, **reverb 0–100%**, space (**Room / Hall / Cathedral**) and **warmth**
  (a lowpass for the lofi tone), plus **Slowed + Reverb / Nightcore / Vaporwave / Cathedral**
  presets. *Tape pitch* makes the vocals sink with the tempo (the classic slowed edit); turn it
  off to keep the vocals put and shift the pitch on its own. Effects run live on the Web Audio
  graph, so the visualizer reacts to them too.
- **8D / Spatial Audio** — the professional version, with the four things one `PannerNode` can't do:
  1. **dual-channel split** — the left and right channels fly as two independent binaural
     satellites (opposite orbit, or a mirrored **figure-8** weave) so stereo width is preserved;
  2. **rear-head muffler** — a `BiquadFilterNode` per channel sweeps a lowpass `20 000 Hz → 4 500 Hz`
     as that channel passes behind your head;
  3. **sub-bass anchor** — everything under `120 Hz` is crossed out of the orbit, summed to mono
     (dead centre) and lifted by a `+4 dB` low shelf, so the kick stays solid while the rest swirls;
  4. **Google Resonance room** — the [Resonance Audio SDK](https://github.com/resonance-audio/resonance-audio-web-sdk)
     is lazily loaded from **jsDelivr** and shares the existing `AudioContext`, adding real early wall
     reflections and a late tail. If the CDN is blocked, the native HRTF panners keep the orbit alive.

  **Orbit** is a medium-slow 8–12 s per circle, **Depth** sets radius + elevation, **Rear head** sets
  the muffler depth, **Sub anchor** the bass lift, and **Room** picks studio / club / hall / cathedral.
  There's an **8D Concert** preset too. Best with headphones; opaque/CORS-blocked streams fall back to
  plain audio.
- **The app wears the record** — [color-thief](https://github.com/lokesh/color-thief) extracts the dominant colour + palette from the current cover art, the player bar and Now Playing bloom with blurred, glowing gradients built from those hexes, and the dominant hex is fed straight into `<am-lyrics highlight-color>` so the active lyric wears the poster's colour too.
- **Palette chips** — the Now Playing sheet shows the extracted swatches; tap any chip to copy its hex.
- **3D parallax album poster** — album covers on the **Album** page are real little sleeves:
  move your cursor and the artwork tilts in 3D with a glossy light sheen sweeping across the cover
  ([vanilla-tilt.js](https://github.com/micku7zu/vanilla-tilt.js)). On a phone the gyroscope drives the
  tilt instead (iOS asks for motion permission on the first press). It respects *Settings → Appearance →
  3D poster tilt*, the Animations switch and `prefers-reduced-motion`.
- **Vinyl scratch & brake** — in **Now Playing** the album art is a round record (grooves, centre label
  and spindle). While a song plays it turns lazily; **press and hold** it and the disc spins down to a
  dead stop *in sync with the music* — `audio.playbackRate` eases from the current speed to `0.05` over
  ~420 ms with `preservesPitch = false`, so the pitch sinks with the tempo (the analog "vrrrrr-stop"),
  then the audio pauses. Lift your finger and both ramp back up over ~620 ms. Because `<am-lyrics>` reads
  `audio.currentTime` directly, the word-by-word highlight slows, freezes and spins back up with it. Works
  with mouse, touch or focusing the disc and holding Space/Enter.
- **Circadian & weather adaptive player** — GRAB IT! reads the clock and the sky and quietly
  re-dresses itself. `src/env/circadian.js` folds your local **time** (dawn / morning / afternoon /
  golden hour / dusk / night) and the live **WMO weather code** into one of nine **scenes** — *sunny
  morning, sunny day, golden evening, clear night, cloudy, rain, storm, snow, fog* — and every scene
  carries a **theme tint**, an **EQ curve** and a subtle **ambient bed**:
  - **Theme** — the butter/espresso palette is preserved but *washed* with the scene's hue
    (`applyAmbience` in `src/theme.jsx` mixes the hexes and lays a translucency over the sky), so a
    rainy evening cools the room blue and a sunny morning reads crisp. The `theme-color` meta,
    `body[data-ambient]` and `--ambient-ink` follow along; `src/ui/AmbientSky.jsx` draws the
    rain / snow / fog / storm / sun overlay in pure CSS.
  - **EQ** — a gentle weather curve is layered *under* your own 10-band EQ and clamped to ±12 dB
    (rainy evenings lift the warm low-mids, bright mornings add air). It works even with your EQ off.
  - **Ambience** — a procedural background bed (pink noise shaped per scene) plays only while music
    is playing and unmuted, scaled by volume and the **Ambient level** slider. **No audio files ship** —
    it's synthesised live in `src/audio/engine.js`.
  - **Weather** — live and key-less from **Open-Meteo** (`fetchWeather`), cached for 20 minutes;
    geolocation is requested once, gently delayed, and cached in `localStorage`.
  - **Control** — *Settings → Ambient* holds the master switch (turns the whole feature off), per-part
    toggles (theme / EQ / ambience), the level slider, a live scene readout and *Refresh sky* /
    *Use my location* buttons. Now Playing shows a small atmosphere chip.

### Data
- 100% local: likes, playlists, saved albums, follows, play history, listening stats.
- **Vault export/import** — move everything with one JSON file.
- Per-profile namespacing, PIN gate, wipe/reset.

---

## 2. Where the music comes from

The **catalogue and the audio both come from GRAB IT** — search, releases,
artists and the full-length **FLAC** stream all go through `/api/tracks/*`, which
`server.mjs` proxies same-origin from the music API. Display artwork is
filled in by **album-art**, which looks artists and albums up in Spotify's catalogue.

| Source | What it is | Quality |
|---|---|---|
| **GRAB IT catalogue** | every song / album / artist in the app, plus the stream at `/api/tracks/track/:id` | **Lossless · FLAC** (real, full-length) |
| **Artist & song posters** | [`album-art`](https://github.com/lacymorrow/album-art) — resolves artist photos and album covers via Spotify, cached locally | n/a |
| **Your own files** | You drop FLAC / ALAC / WAV / AIFF / MP3 / M4A / OGG in; stored offline in IndexedDB | full quality, original |
| **Your own server** | Self-hosted **Navidrome / Subsonic / Jellyfin** (`format=raw`, no transcode) | original (FLAC stays FLAC) |
| **Live radio** | Radio-Browser station directory (the Radio page) | live · 64–320k, codec shown honestly |
| **Podcasts** | iTunes Search API (shows + episodes) — GRAB IT carries no podcasts | RSS audio, speed 1×–2× |
| **Lyrics / bios** | LRCLIB (plain + synced) and Wikipedia | n/a |

> **Honest badges**
> `Lossless · FLAC` is only shown for GRAB IT tracks, which really are FLAC (verified from
> the stream headers). If GRAB IT can't resolve a particular track (it answers 502 for a
> few releases upstream), the player says so and **auto-skips to the next playable track**
> instead of stalling — a dead track never freezes the queue.

If a host ever blocks the Web Audio graph (CORS), GRAB IT! retries on a plain audio path — so
playback still works, EQ/visualizer just step aside for that track.

---

## 3. The "funny UI" system

- **Living sky** — the whole app borrows the day/night toggle's weather: a butter-yellow sky, a warm
  sun and cream clouds by day; espresso, a butter moon and warm twinkling stars by night
  (`src/theme.jsx` GlobalStyle). Everything is tinted from just two brand hues, `#FFE695` and `#342E1B`.
  When the **circadian & weather adaptive player** is on, the clock and your local sky wash an extra
  tint over this base (see *Player*), and `src/ui/AmbientSky.jsx` adds a matching weather overlay.
- **Cut-paper cards** — solid surfaces, wobbly `border-radius: 255px 15px 225px 15px/...` ink
  outlines (`wobbleBorder`, `--ink-edge`), hard offset shadows and a faint sketchbook grain.
- **Playful motion** — cards, chips, tabs and buttons straighten up when you hover, then tilt and
  lift with a dashed pencil outline (`Panel` / `SketchButton` in `src/ui/kit.jsx`).
- **Tape + dashed accents** — `Panel $tape` pins hero cards with masking tape; section titles end
  in a hand-drawn dashed rule.
- **Fonts:** *Nunito* everywhere — the same rounded bold used by the lyrics.
- **Signature bits:**
  - `Logo.jsx` — animated **GRAB IT!** wordmark with a waving hand.
  - `ThemeToggle.jsx` — the **day/night toggle** (sun ↔ moon, clouds, twinkling stars).
  - `PencilLoader.jsx` — the spinning-pencil boot loader.
  - `Visualizer.jsx` — live audio-reactive drawing.
  - `Toasts.jsx` — silly one-liners ("Queued it up! 🎟️").
- **Theme tokens** live in `src/theme.jsx` (`light` / `dark`), global style in `ThemeProvider`.

---

## 4. Project map

```
src/
  theme.jsx              # light/dark tokens, global style, wobbly-border helpers
  router.jsx             # tiny hash router (useRoute, go)
  App.jsx                # shell: sidebar + topbar + pages + player + Now Playing + boot loader
  api/music.js           # iTunes (songs/albums/artists/podcasts) + Wikipedia + LRCLIB
  api/backend.js         # the GRAB IT catalogue client (search, releases, artists, streams)
  api/recommend.js       # taste-aware "top picks" from play history
  api/sources.js         # Internet Archive + Audius + Radio-Browser (full-length/lossless)
  audio/engine.js        # dual-element Web Audio graph: preGain -> 10-band EQ -> Sing -> warmth -> reverb -> pitch -> analyser -> master -> stereo / HRTF orbit (+ vinyl-brake playbackRate ramp)
  audio/providers.js     # resolvePlayable (prefers offline downloads) + Subsonic/Navidrome client + quality labels
  audio/md5.js           # MD5 for Subsonic tokens
  settings/SettingsContext.jsx   # settings, EQ freq bands + presets, FX presets, defaults
  env/circadian.js + env/CircadianContext.jsx   # clock + Open-Meteo weather -> scene (tint, EQ, ambience)
  auth/AuthContext.jsx   # device-local profiles + PIN + login gate
  player/PlayerContext.jsx       # the whole transport + library state + offline downloads + stats + vault
  lib/                   # store (localStorage), idb (IndexedDB: files + downloads), offline (blob-URL registry), format (LRC parser, time), share (party links)
  ui/                    # kit, Icons, Logo, ThemeToggle, PencilLoader, Visualizer, SketchDefs, Toasts, useArtColors, TiltPoster, VinylPoster, AmbientSky, ZenMode
  components/            # Sidebar, TopBar, TrackCard, TrackRow, Player, NowPlaying, AddToPlaylist, DownloadButton, FxControls, SpatialControls
  pages/                 # Home, Search, Browse, ArchiveItem, Party, Playlist, Radio, Podcasts, Library, Album, Artist, Settings, Wrapped, Login
public/
  pitch-shifter.js       # granular AudioWorklet pitch shifter (dependency-free)
```

### Memory & low-end devices

GRAB IT runs happily on 8 GB laptops and phones. A few deliberate choices keep the
footprint down while everything still reacts in real time:

- **Analyser buffers are preallocated** (and the FFT dropped to 1024), so the 60 fps
  visualizer no longer allocates a fresh typed array every frame.
- **Downloads are device-local**: a saved song's bytes live in IndexedDB and play
  through a `blob:` URL, revocable when you delete the download (see `lib/offline.js`).
- **The Resonance room is torn down** the moment 8D or the room is switched off (or an
  opaque track bypasses the graph) and rebuilt on demand, so its ambisonic + convolution
  buffers don't sit in RAM for nothing.
- **Only one impulse response is cached**, and the convolver releases its buffer when
  reverb is dialled to zero.
- **Crossfaded elements are unloaded** once a fade completes, and idle media elements
  use `preload="metadata"` so tracks aren't buffered ahead unnecessarily.
- Per-URL caches (cover colours, release titles) are **capped** so a long session
  can't grow them without bound.

### How the FX are built

The app deliberately doesn't ship Tone.js: the same three capabilities are wired straight into the
graph it already has, so there's no second AudioContext and no extra ~200kB framework.

| Effect | Implementation |
|---|---|
| **Reverb** | `ConvolverNode` fed a procedurally generated impulse response (two decorrelated noise tails with an exponential decay), plus dry/wet gains and a warmth lowpass. |
| **Pitch** | A small granular `AudioWorkletProcessor` (`public/pitch-shifter.js`): two windowed read heads sweeping a ring buffer at `2^(semitones/12)`, crossfaded so the grain wrap is inaudible. |
| **Tempo** | `HTMLMediaElement.playbackRate`; `preservesPitch` is toggled by *Tape pitch* so the pitch can either ride the tempo or stay put. |
| **8D / Spatial** | A dedicated 8D bus off `master`, crossfaded against the dry stereo path. Stereo splitter → per-channel rear-head `BiquadFilterNode` lowpass (20 kHz → 4.5 kHz behind) → two HRTF `PannerNode`s (opposite orbit or figure-8); a 120 Hz crossover carries the sub-bass through a mono `ChannelMerger` with a +4 dB `lowshelf` so it stays centred; Google's `ResonanceAudio` (jsDelivr, same `AudioContext`) renders the room reflections, with the native panners as fallback. A `requestAnimationFrame` loop drives both the panners and the Resonance sources. |

When a source blocks CORS the player falls back to plain audio — speed still works (it's element
level), reverb, pitch and 8D step aside for that track. Without AudioWorklet support the pitch slider
falls back to tape-style playbackRate so it still changes the sound honestly.

### Listening Party (share a song)

Use **Share** in Now Playing to send a track as a link (`#/party/...`, `src/pages/Party.jsx`).
Whoever opens it starts the same song at the same spot — no accounts, no server of ours.

## 5. APIs used (all free, key-less, CORS-friendly)

- **iTunes Search API** — podcasts (shows + episodes) and the directory behind them.
- **GRAB IT music API** (`/api/tracks/*`) — catalogue search + full-length FLAC streams.
- **album-art / Spotify** — artist photos and album covers (posters), cached in `localStorage`.
- **color-thief** — dominant colour + palette extraction from those posters (source-clean canvas, cached per URL).
- **Internet Archive** — search, metadata and range-served FLAC/MP3 downloads.
- **Audius** — discovery provider search/trending and full-length track streams.
- **Radio-Browser** — live station directory (multiple CORS mirrors).
- **Apple RSS generator** — top podcast chart (`itunes.apple.com/us/rss/toppodcasts`).
- **LRCLIB** — plain + time-synced lyrics for karaoke animation.
- **Wikipedia REST** — artist summaries/photos.
- **Open-Meteo** — key-less live weather (WMO condition + temperature) that drives the circadian scene.

> Lawful note: audio is streamed from each source's own public API — GRAB IT! hosts nothing,
> downloads nothing and scrapes nothing. Personal / educational use.
