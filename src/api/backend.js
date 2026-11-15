/* ------------------------------------------------------------------ */
/*  Backend client — the cloned dropit-backend, running behind this UI */
/*                                                                     */
/*  Same-origin paths (no CORS, no keys):                              */
/*    GET /api/tracks/search?q=                  -> everything         */
/*    GET /api/tracks/search/tracks?q=&limit=    -> track search       */
/*    GET /api/tracks/search/releases?q=&limit=  -> album search       */
/*    GET /api/tracks/search/artists?q=&limit=   -> artist search      */
/*    GET /api/tracks/releases/:id               -> release + tracks   */
/*    GET /api/tracks/artists/:id                -> artist + releases  */
/*    GET /api/tracks/track/:trackId             -> audio stream (FLAC)*/
/*  server.mjs proxies these to the music API the backend ships with   */
/*  (tracks.monochrome.st). `npm run dev` proxies the same via vite.   */
/* ------------------------------------------------------------------ */

export const BACKEND_BASE = "/api/tracks";

const jsonCache = new Map();
const inflight = new Map();

/* The music API sits behind a CDN that occasionally answers 502/503/504 for a
   single request while it is warming up or under load. Those are transient —
   retry them (with a little backoff) instead of blanking the whole shelf. */
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS = [350, 900];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return RETRY_STATUSES.has(status);
}

/** fetch a JSON document, retrying transient upstream failures. */
async function fetchJSON(url, { timeout, retries }) {
  const attempts = Math.max(1, retries + 1);
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await sleep(delay + Math.floor(Math.random() * 150));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let res;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      // Parse inside the timeout window so a stalled body is bounded too.
      if (res.ok) return await res.json();
    } catch (error) {
      // Network blip, DNS hiccup, our own timeout, or a truncated body:
      // retry unless this was the last attempt.
      lastError = error;
      continue;
    } finally {
      clearTimeout(timer);
    }

    lastError = new Error(`backend ${res.status}`);
    lastError.status = res.status;
    if (!isRetryableStatus(res.status)) throw lastError;
  }

  throw lastError;
}

async function getJSON(pathAndQuery, { timeout = 12000, retries = 2 } = {}) {
  if (jsonCache.has(pathAndQuery)) return jsonCache.get(pathAndQuery);
  // Home fires several overlapping shelves; one request per URL is enough.
  if (inflight.has(pathAndQuery)) return inflight.get(pathAndQuery);

  const request = fetchJSON(`${BACKEND_BASE}${pathAndQuery}`, { timeout, retries })
    .then((data) => {
      jsonCache.set(pathAndQuery, data);
      if (jsonCache.size > 200) jsonCache.delete(jsonCache.keys().next().value);
      return data;
    })
    .finally(() => {
      inflight.delete(pathAndQuery);
    });

  inflight.set(pathAndQuery, request);
  return request;
}

export function backendStreamUrl(trackId) {
  const id = String(trackId || "").replace(/^bk-/, "");
  return `${BACKEND_BASE}/track/${encodeURIComponent(id)}`;
}

export function clearBackendCache() {
  jsonCache.clear();
}

/* ------------------------------ mappers ------------------------------ */

function artistNamesOf(item) {
  if (Array.isArray(item?.artistNames) && item.artistNames.length) return item.artistNames.join(", ");
  if (Array.isArray(item?.artists) && item.artists.length) {
    return item.artists.map((a) => a?.displayName || a?.name).filter(Boolean).join(", ");
  }
  return "Unknown artist";
}

function yearOf(date) {
  return (date || "").slice(0, 4);
}

function typeLabel(type) {
  if (!type) return "Album";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

/** backend track -> GRAB IT track */
export function mapTrack(item) {
  const trackId = String(item.trackId || item.id || "");
  const stream = backendStreamUrl(trackId);
  return {
    id: `bk-${trackId}`,
    trackId,
    recordingId: item.recordingId ? String(item.recordingId) : "",
    albumId: item.releaseId ? String(item.releaseId) : "",
    artistId: item.artistIds?.[0] || item.artists?.[0]?.artistId || "",
    source: "backend",
    title: item.title || "Untitled",
    artist: artistNamesOf(item),
    album: item.albumTitle || item.releaseTitle || "",
    art: item.artwork || "",
    artBig: item.artwork || "",
    preview: stream,
    stream,
    duration: item.duration || 0,
    genre: "",
    year: yearOf(item.releaseDate),
    trackNo: item.trackNumber || 0,
    discNo: item.discNumber || 1,
    explicit: !!item.explicit,
    lossless: true,
    format: "FLAC",
    quality: "Lossless · FLAC",
    playable: item.playable !== false,
  };
}

/** backend release -> GRAB IT album */
export function mapRelease(item) {
  const releaseId = String(item.releaseId || item.id || "");
  return {
    id: releaseId,
    albumId: releaseId,
    title: item.title || "Untitled",
    artist: artistNamesOf(item),
    artistId: item.artistIds?.[0] || item.artists?.[0]?.artistId || "",
    art: item.artwork || "",
    artBig: item.artwork || "",
    year: yearOf(item.releaseDate),
    trackCount: item.trackCount || item.tracks?.length || 0,
    genre: typeLabel(item.releaseType),
    label: item.label || "",
    explicit: !!item.explicit,
  };
}

/** backend artist -> GRAB IT artist */
export function mapArtist(item) {
  const artistId = String(item.artistId || item.id || "");
  return {
    id: artistId,
    artistId,
    name: item.displayName || item.name || "Unknown artist",
    username: item.username || "",
    genre: Array.isArray(item.genres) && item.genres.length ? item.genres.join(", ") : "Artist",
    art: item.avatar || "",
    link: item.externalLink || "",
    bio: item.biography || item.bio || "",
  };
}

/* ------------------------------- calls ------------------------------- */

export async function searchBackendTracks(query, limit = 30) {
  const q = String(query || "").trim();
  if (!q) return [];
  const data = await getJSON(`/search/tracks?q=${encodeURIComponent(q)}&limit=${limit}`);
  return (data.tracks || data.results || [])
    .filter((t) => t && t.playable !== false)
    .map(mapTrack);
}

export async function searchBackendReleases(query, limit = 24) {
  const q = String(query || "").trim();
  if (!q) return [];
  const data = await getJSON(`/search/releases?q=${encodeURIComponent(q)}&limit=${limit}`);
  return (data.releases || data.results || []).map(mapRelease);
}

export async function searchBackendArtists(query, limit = 12) {
  const q = String(query || "").trim();
  if (!q) return [];
  const data = await getJSON(`/search/artists?q=${encodeURIComponent(q)}&limit=${limit}`);
  return (data.artists || data.results || []).map(mapArtist);
}

/** Unified backend search: tracks + releases + artists in one round trip. */
export async function backendSearch(query, limit = 24) {
  const q = String(query || "").trim();
  if (!q) return { tracks: [], releases: [], artists: [] };
  const data = await getJSON(`/search?q=${encodeURIComponent(q)}`);
  return {
    tracks: (data.tracks || []).slice(0, limit).map(mapTrack),
    releases: (data.releases || []).slice(0, limit).map(mapRelease),
    artists: (data.artists || []).map(mapArtist),
  };
}

/** A release plus its full tracklist. */
/** Just the album title for a release id — used to look up song posters. */
const releaseTitleCache = new Map();
const RELEASE_TITLE_MAX = 200;
export function backendReleaseTitle(releaseId) {
  const id = String(releaseId || "").replace(/^al-/, "");
  if (!id) return Promise.resolve("");
  if (releaseTitleCache.has(id)) return releaseTitleCache.get(id);
  const request = getJSON(`/releases/${encodeURIComponent(id)}`, { timeout: 15000, retries: 1 })
    .then((data) => (data.release || data)?.title || "")
    .catch(() => "");
  releaseTitleCache.set(id, request);
  if (releaseTitleCache.size > RELEASE_TITLE_MAX) {
    releaseTitleCache.delete(releaseTitleCache.keys().next().value);
  }
  return request;
}

export async function backendRelease(releaseId) {
  const id = String(releaseId).replace(/^al-/, "");
  const data = await getJSON(`/releases/${encodeURIComponent(id)}`, { timeout: 25000, retries: 1 });
  const release = data.release || data;
  const album = mapRelease({
    ...release,
    trackCount: (release.tracks || []).length || release.trackCount,
  });
  const tracks = (release.tracks || release.items || []).map((t) =>
    mapTrack({ ...t, albumTitle: release.title, releaseId: album.albumId })
  );
  return { album, tracks };
}

/** An artist with top tracks and releases. */
export async function backendArtist(artistId) {
  const id = String(artistId).replace(/^ar-/, "");
  const data = await getJSON(`/artists/${encodeURIComponent(id)}`, { timeout: 25000, retries: 1 });
  const artist = data.artist || data;
  return {
    artist: mapArtist(artist),
    topTracks: (artist.topTracks || []).map(mapTrack),
    releases: (artist.releases || artist.albums || []).map(mapRelease),
  };
}

export async function backendHealth() {
  const res = await fetch("/api/health", { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}

/* Rotating queries used for the shelves on Home / New. */
const SHELF_QUERIES = [
  "daft punk",
  "fleetwood mac",
  "the weeknd",
  "tyler the creator",
  "radiohead",
  "sade",
  "kendrick lamar",
  "nirvana",
  "arctic monkeys",
  "frank ocean",
  "tame impala",
  "fka twigs",
];

export function backendShelfQuery() {
  return SHELF_QUERIES[Math.floor(Math.random() * SHELF_QUERIES.length)];
}