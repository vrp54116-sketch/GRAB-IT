/* ------------------------------------------------------------------ */
/*  Artist & song posters                                              */
/*                                                                     */
/*  Powered by the `album-art` package (github.com/lacymorrow/album-art) */
/*  which looks artwork up in Spotify's catalogue:                     */
/*    artistPoster("Daft Punk")            -> artist photo             */
/*    songPoster("Daft Punk", "Discovery") -> album / song cover       */
/*                                                                     */
/*  Results are cached in localStorage (successes 30 days, misses 10   */
/*  minutes) and de-duplicated in flight, so a grid of 40 tracks that  */
/*  share a handful of albums only hits Spotify a handful of times.    */
/*  A small queue keeps us from opening dozens of sockets at once.     */
/* ------------------------------------------------------------------ */

import albumArt from "album-art";
import { backendReleaseTitle } from "../api/backend.js";

const STORAGE_KEY = "grabit:album-art-cache:v1";
const OK_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const MISS_TTL = 1000 * 60 * 10; // retry blanks after 10 min
const MAX_ENTRIES = 500;
const MAX_CONCURRENT = 4;

const clean = (value) => String(value || "").trim().replace(/\s+/g, " ");

/* ------------------------------- cache ------------------------------- */

function loadCache() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const cache = loadCache();
const inflight = new Map();
let saveTimer = null;

function remember(key, url) {
  cache[key] = { url: url || "", at: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (cache[a]?.at || 0) - (cache[b]?.at || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete cache[k]);
  }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      }
    } catch {
      /* storage full or blocked — cache still works for this session */
    }
  }, 400);
}

function read(key) {
  const row = cache[key];
  if (!row) return null;
  const ttl = row.url ? OK_TTL : MISS_TTL;
  if (Date.now() - row.at > ttl) {
    delete cache[key];
    return null;
  }
  return row.url || "";
}

/* ---------------------------- concurrency ---------------------------- */

let active = 0;
const waiting = [];

function schedule(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          const next = waiting.shift();
          if (next) next();
        });
    };
    if (active < MAX_CONCURRENT) run();
    else waiting.push(run);
  });
}

function lookup(key, artist, options) {
  const cached = read(key);
  if (cached !== null) return Promise.resolve(cached);

  if (inflight.has(key)) return inflight.get(key);

  const request = schedule(() => albumArt(artist, options))
    .then((url) => {
      remember(key, url || "");
      return url || "";
    })
    .catch(() => "") // network / no-result: keep caller's fallback, retry later
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

/* ------------------------------ public API ------------------------------ */

/** Poster for a track, looked up by its artist + album name.
 *  Backend search results only carry a release id, so when the album
 *  name is missing we resolve it first (cached per release). */
export async function songPoster(artist, album, releaseId) {
  const a = clean(artist);
  let al = clean(album);

  if (a && !al && releaseId) {
    al = clean(await backendReleaseTitle(releaseId));
  }

  if (!a || !al) return "";
  return lookup(`s:${a.toLowerCase()}|${al.toLowerCase()}`, a, {
    album: al,
    size: "large",
  });
}

/** Poster for an artist. */
export function artistPoster(name) {
  const a = clean(name);
  if (!a) return Promise.resolve("");
  return lookup(`a:${a.toLowerCase()}`, a, { size: "large" });
}

/** Poster for an album (same Spotify lookup as a song). */
export function albumPoster(artist, album) {
  return songPoster(artist, album);
}

/** Warm the cache without caring about the result. */
export function prefetchArtist(name) {
  artistPoster(name).catch(() => {});
}

export function prefetchSong(artist, album, releaseId) {
  songPoster(artist, album, releaseId).catch(() => {});
}