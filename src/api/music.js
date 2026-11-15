/* ------------------------------------------------------------------ */
/*  The app's catalogue API — served by GRAB IT.                       */
/*                                                                     */
/*  songs / albums / artists / shelves / radio -> /api/tracks/*        */
/*  (GRAB IT's music API, proxied same-origin by server.mjs)           */
/*                                                                     */
/*  Still from the open web, because GRAB IT has no equivalent:        */
/*   - iTunes Search  -> podcasts (shows + episodes)                   */
/*   - Wikipedia REST -> artist bios                                   */
/*   - LRCLIB         -> lyrics (plain + time-synced)                  */
/* ------------------------------------------------------------------ */

import {
  mapTrack,
  mapRelease,
  mapArtist,
  searchBackendTracks,
  searchBackendReleases,
  searchBackendArtists,
  backendSearch,
  backendRelease,
  backendArtist,
} from "./backend.js";

const ITUNES = "https://itunes.apple.com/search";
const LOOKUP = "https://itunes.apple.com/lookup";

async function getJSON(url, signal) {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function art(url, size = 320) {
  if (!url) return "";
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/, `/${size}x${size}bb.$1`);
}

/* ---------------- songs ---------------- */

export async function searchSongs(term, limit = 24) {
  if (!term?.trim()) return [];
  return searchBackendTracks(term, limit);
}

/* ---------------- albums ---------------- */

export async function searchAlbums(term, limit = 12) {
  if (!term?.trim()) return [];
  return searchBackendReleases(term, limit);
}

export async function getAlbum(albumId) {
  return backendRelease(albumId);
}

/* ---------------- artists ---------------- */

export async function searchArtists(term, limit = 8) {
  if (!term?.trim()) return [];
  return searchBackendArtists(term, limit);
}

export async function artistSongs(name, limit = 24) {
  return searchBackendTracks(name, limit);
}

export async function artistAlbums(artistId, limit = 24) {
  if (!artistId) return [];
  const { releases } = await backendArtist(artistId);
  return releases.slice(0, limit);
}

/** Artist page bundle: tracks + releases from the backend, bio from Wikipedia. */
export async function artistBundle(name, limit = 24) {
  const [bio, artists] = await Promise.allSettled([artistBio(name), searchBackendArtists(name, 1)]);
  const artist = artists.status === "fulfilled" ? artists.value[0] : null;
  const detail = artist?.artistId ? await backendArtist(artist.artistId).catch(() => null) : null;
  const songs =
    detail?.topTracks?.length > 0
      ? detail.topTracks
      : await searchBackendTracks(name, limit).catch(() => []);
  return {
    bio: bio.status === "fulfilled" ? bio.value : null,
    artist: artist || detail?.artist || null,
    songs,
    releases: (detail?.releases || []).slice(0, limit),
  };
}

export async function artistBio(name) {
  try {
    const s = await getJSON(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
        name
      )}&limit=1`
    );
    const key = s?.pages?.[0]?.key;
    if (!key) return null;
    const sum = await getJSON(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`
    );
    return {
      extract: sum.extract || "",
      description: sum.description || "",
      thumb: sum.thumbnail?.source || "",
      url: sum.content_urls?.desktop?.page || "",
      title: sum.title || name,
    };
  } catch {
    return null;
  }
}

/* ---------------- podcasts (iTunes — the backend carries no podcasts) ---------------- */

function toPodcast(r) {
  return {
    id: `pc-${r.collectionId}`,
    collectionId: r.collectionId,
    title: r.collectionName,
    artist: r.artistName,
    art: art(r.artworkUrl100, 320),
    artBig: art(r.artworkUrl600 || r.artworkUrl100, 640),
    genre: r.primaryGenreName || "Podcast",
    count: r.trackCount || 0,
    feed: r.feedUrl || "",
  };
}

function toEpisode(r, show) {
  return {
    id: `ep-${r.trackId}`,
    trackId: r.trackId,
    source: "podcast",
    opaque: true, // RSS-hosted audio: skip the Web Audio graph
    title: r.trackName,
    artist: show?.title || r.collectionName || "Podcast",
    album: r.collectionName || show?.title || "",
    art: art(r.artworkUrl160 || r.artworkUrl100 || show?.art, 320),
    artBig: art(r.artworkUrl600 || r.artworkUrl160 || show?.art, 640),
    preview: r.previewUrl || "",
    duration: r.trackTimeMillis || 0,
    date: (r.releaseDate || "").slice(0, 10),
    description: r.description || r.shortDescription || "",
    episodeNo: r.episodeNumber || 0,
  };
}

export async function searchPodcasts(term, limit = 12, country = "us") {
  const data = await getJSON(
    `${ITUNES}?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=${limit}&country=${country}`
  );
  return (data.results || []).map(toPodcast);
}

export async function topPodcasts(limit = 18, country = "us") {
  try {
    // Apple's RSS generator is CORS-enabled (unlike rss.applemarketingtools.com).
    const data = await getJSON(
      `https://itunes.apple.com/${country}/rss/toppodcasts/limit=${limit}/json`
    );
    const entries = data.feed?.entry;
    const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
    return list
      .map((e) => {
        const img = (e["im:image"] || []).slice(-1)[0]?.label || "";
        return {
          id: `pc-${e.id?.attributes?.["im:id"] || e.id?.label || e["im:name"]?.label}`,
          collectionId: Number(e.id?.attributes?.["im:id"]) || 0,
          title: e["im:name"]?.label || "",
          artist: e["im:artist"]?.label || "",
          art: art(img, 320),
          artBig: art(img, 640),
          genre: e.category?.attributes?.label || "Top chart",
          count: 0,
          feed: "",
        };
      })
      .filter((p) => p.title && p.collectionId);
  } catch {
    return searchPodcasts("podcast", limit, country);
  }
}

export async function podcastEpisodes(collectionId, limit = 40) {
  const data = await getJSON(`${LOOKUP}?id=${collectionId}&entity=podcastEpisode&limit=${limit}`);
  const results = data.results || [];
  const showR = results.find((r) => r.wrapperType === "track");
  const show = showR ? toPodcast(showR) : null;
  const episodes = results
    .filter((r) => r.wrapperType === "podcastEpisode")
    .map((r) => toEpisode(r, show));
  return { show, episodes };
}

/* ---------------- shelves + radio ---------------- */

export async function shelf(term, limit = 12) {
  return searchBackendTracks(term, limit);
}

export async function albumShelf(term, limit = 12) {
  return searchBackendReleases(term, limit);
}

/** Everything the backend knows for a term, in one round trip. */
export async function catalogue(term, limit = 24) {
  return backendSearch(term, limit);
}

export async function buildRadio(seed, limit = 30) {
  let tracks = [];
  try {
    const found = await backendSearch(seed, limit);
    tracks = [...found.tracks];
    if (tracks.length < limit) {
      const extra = await Promise.allSettled([
        searchBackendTracks(`${seed} similar`, limit),
        searchBackendTracks(seed, limit),
      ]);
      for (const r of extra) if (r.status === "fulfilled") tracks.push(...r.value);
    }
  } catch {
    tracks = [];
  }
  const seen = new Set();
  const unique = tracks.filter((t) => {
    if (!t || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

/* ---------------- lyrics ---------------- */

export async function getLyricsMeta({ artist, title, album, duration }) {
  const params = new URLSearchParams();
  if (artist) params.set("artist_name", artist);
  if (title) params.set("track_name", title);
  if (album) params.set("album_name", album);
  if (duration) params.set("duration", Math.round(duration / 1000));
  try {
    const exact = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (exact.ok) {
      const d = await exact.json();
      if (d?.plainLyrics || d?.syncedLyrics) {
        return { plain: d.plainLyrics || null, synced: d.syncedLyrics || null };
      }
    }
  } catch {
    /* fall through */
  }
  try {
    const q = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`);
    if (q.ok) {
      const arr = await q.json();
      const hit = arr.find((x) => x.plainLyrics || x.syncedLyrics);
      if (hit) return { plain: hit.plainLyrics || null, synced: hit.syncedLyrics || null };
    }
  } catch {
    /* none */
  }
  return { plain: null, synced: null };
}

export async function getLyrics(opts) {
  const m = await getLyricsMeta(opts);
  return m.plain;
}

/* ---------------- misc ---------------- */

export { mapTrack, mapRelease, mapArtist };

export function smartQuery(q) {
  // tiny bit of "did you mean" help
  const fixes = {
    beatles: "The Beatles",
    "lofi": "lofi hip hop",
    "lo-fi": "lofi hip hop",
  };
  const k = (q || "").toLowerCase().trim();
  return fixes[k] || q;
}