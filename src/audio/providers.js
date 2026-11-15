import { md5 } from "./md5.js";
import { getOfflineUrl } from "../lib/offline.js";

/* ------------------------------------------------------------------ */
/*  Audio source providers                                           */
/* ------------------------------------------------------------------ */

export const QUALITY_LABEL = {
  preview: { text: "Preview clip", lossless: false, badge: "clip" },
  local: { text: "Local file", lossless: false, badge: "owned" },
  flac: { text: "Lossless · FLAC", lossless: true, badge: "FLAC" },
  subsonic: { text: "Server · original", lossless: true, badge: "raw" },
  audius: { text: "Audius · full track", lossless: false, badge: "full" },
  radio: { text: "Live radio", lossless: false, badge: "live" },
  offline: { text: "Offline · saved", lossless: true, badge: "offline" },
  backend: { text: "Lossless · FLAC (GRAB IT)", lossless: true, badge: "FLAC" },
};

/* ---------------- Subsonic / Navidrome / Jellyfin(Subsonic API) ---------------- */

function subParams(cfg) {
  const salt = Math.random().toString(36).slice(2, 10);
  const token = md5(cfg.password + salt);
  return {
    u: cfg.user,
    t: token,
    s: salt,
    v: "1.16.1",
    c: "grabIT",
    f: "json",
  };
}

function base(cfg) {
  let url = (cfg.url || "").trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

export function subsonicReady(cfg) {
  return !!(cfg && cfg.enabled && cfg.url && cfg.user && cfg.password);
}

export function subsonicUrl(cfg, endpoint, extra = {}) {
  const q = new URLSearchParams({ ...subParams(cfg), ...extra });
  return `${base(cfg)}/rest/${endpoint}?${q.toString()}`;
}

/** Stream URL — format=raw means "do not transcode": original FLAC stays FLAC. */
export function subsonicStream(cfg, id, { lossless = true } = {}) {
  return subsonicUrl(cfg, "stream.view", {
    id,
    format: lossless ? "raw" : "mp3",
    maxBitRate: lossless ? 0 : 320,
  });
}

export function subsonicCover(cfg, id, size = 400) {
  return subsonicUrl(cfg, "getCoverArt.view", { id, size });
}

export async function subsonicPing(cfg) {
  const res = await fetch(subsonicUrl(cfg, "ping.view"));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const r = data["subsonic-response"];
  if (!r || r.status !== "ok") throw new Error("Server said no");
  return r;
}

function mapSong(cfg, s) {
  return {
    id: `sc-${s.id}`,
    scId: s.id,
    source: "subsonic",
    title: s.title,
    artist: s.artist || "Unknown artist",
    album: s.album || "",
    art: s.coverArt ? subsonicCover(cfg, s.coverArt, 320) : "",
    artBig: s.coverArt ? subsonicCover(cfg, s.coverArt, 640) : "",
    duration: (s.duration || 0) * 1000,
    genre: s.genre || "",
    year: s.year ? String(s.year) : "",
    suffix: s.suffix || "",
    bitRate: s.bitRate || 0,
    lossless: ["flac", "alac", "wav", "aiff", "ape"].includes((s.suffix || "").toLowerCase()),
  };
}

export async function subsonicSearch(cfg, query, limit = 40) {
  const res = await fetch(
    subsonicUrl(cfg, "search3.view", {
      query,
      songCount: limit,
      artistCount: 5,
      albumCount: 5,
    })
  );
  const data = await res.json();
  const r = data["subsonic-response"];
  if (!r || r.status !== "ok") throw new Error("search failed");
  const songs = r.searchResult3?.song || [];
  return songs.map((s) => mapSong(cfg, s));
}

export async function subsonicRandom(cfg, size = 30) {
  const res = await fetch(subsonicUrl(cfg, "getRandomSongs.view", { size }));
  const data = await res.json();
  const r = data["subsonic-response"];
  if (!r || r.status !== "ok") throw new Error("random failed");
  return (r.randomSongs?.song || []).map((s) => mapSong(cfg, s));
}

/* ---------------- resolve a playable URL for a track ---------------- */

export function resolvePlayable(track, settings, { preferOffline = true } = {}) {
  if (!track) return null;
  if (preferOffline && track.source !== "local") {
    const offline = getOfflineUrl(track.id);
    if (offline) return { url: offline, quality: QUALITY_LABEL.offline };
  }
  if (track.source === "local") {
    const fmt = track.format || (track.lossless ? "FLAC" : "AUDIO");
    return {
      url: track.blobUrl,
      quality: track.lossless
        ? { text: `Lossless · ${fmt}`, lossless: true, badge: fmt }
        : { text: `Local · ${fmt}`, lossless: false, badge: "owned" },
    };
  }
  if (track.source === "subsonic" && subsonicReady(settings.subsonic)) {
    /* The quality dial only means something where we can actually choose:
       your own server can serve raw FLAC or a 320k MP3 transcode. Local
       files and public streams are what they are. */
    const pref = settings.quality || "auto";
    const lossless = pref === "lossless" || (pref === "auto" && !!track.lossless);
    return {
      url: subsonicStream(settings.subsonic, track.scId, { lossless }),
      quality: lossless
        ? track.lossless
          ? QUALITY_LABEL.flac
          : QUALITY_LABEL.subsonic
        : { text: "Server · MP3 320", lossless: false, badge: "320k" },
    };
  }
  if (track.source === "archive") {
    return {
      url: track.preview,
      quality: track.lossless
        ? { text: `Lossless · ${track.format || "FLAC"}`, lossless: true, badge: (track.format || "FLAC") }
        : { text: `Archive · ${track.format || "MP3"}`, lossless: false, badge: "full" },
    };
  }
  if (track.source === "audius") {
    return { url: track.preview, quality: QUALITY_LABEL.audius };
  }
  if (track.source === "radio") {
    const bits = [track.codec, track.bitrate ? `${track.bitrate}k` : ""].filter(Boolean).join(" ");
    return {
      url: track.preview,
      quality: { text: `Live · ${bits || "stream"}`, lossless: false, badge: "live" },
    };
  }
  if (track.source === "backend") {
    return {
      url: track.stream || track.preview,
      quality: QUALITY_LABEL.backend,
    };
  }
  return { url: track.preview, quality: QUALITY_LABEL.preview };
}
