/* ------------------------------------------------------------------ */
/*  Full-length, lawful audio sources — largest-library multi-source   */
/*   - GRAB IT catalogue : full-length lossless FLAC (api/backend.js)  */
/*   - Internet Archive  : ~1M FLAC/public-domain items   (CORS *)     */
/*   - Audius             : artist-uploaded full tracks   (CORS *)     */
/*   - Radio-Browser      : live stations (full songs)                 */
/*  Everything runs in the browser or through GRAB IT's own proxy.     */
/* ------------------------------------------------------------------ */

const IA_SEARCH = "https://archive.org/advancedsearch.php";
const IA_META = "https://archive.org/metadata";
const IA_DL = "https://archive.org/download";
const IA_IMG = "https://archive.org/services/img";

const AUDIUS = "https://discoveryprovider.audius.co/v1";
const APP = "GrabIt";

/* radio-browser has several mirrors; try them in order */
const RB_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
];

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const enc = (s) => String(s || "").trim();

/* ---------------- Internet Archive ---------------- */

const AUDIO_EXT = /\.(flac|mp3|ogg|oga|opus|m4a|wav|aiff?)$/i;

function iaFileUrl(identifier, name) {
  return `${IA_DL}/${encodeURIComponent(identifier)}/${String(name)
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/**
 * Search the Archive for audio items. Pass `losslessOnly` to restrict to
 * items that actually contain a FLAC file (real lossless).
 */
export async function archiveSearch(term, { rows = 24, page = 1, losslessOnly = true } = {}) {
  const q = [
    "mediatype:audio",
    losslessOnly ? "format:(Flac)" : "",
    term?.trim() ? `(${term.trim()})` : "",
  ]
    .filter(Boolean)
    .join(" AND ");
  const params = new URLSearchParams();
  params.set("q", q);
  ["identifier", "title", "creator", "year", "date", "collection", "downloads"].forEach((f) =>
    params.append("fl[]", f)
  );
  params.append("sort[]", "downloads desc");
  params.set("rows", String(rows));
  params.set("page", String(page));
  params.set("output", "json");
  const data = await getJSON(`${IA_SEARCH}?${params.toString()}`);
  return (data?.response?.docs || []).map(toArchiveItem);
}

function toArchiveItem(d) {
  const creator = Array.isArray(d.creator) ? d.creator[0] : d.creator;
  return {
    id: d.identifier,
    source: "archive",
    kind: "item",
    title: d.title || d.identifier,
    artist: creator || "Internet Archive",
    year: String(d.year || (d.date || "").slice(0, 4) || ""),
    art: `${IA_IMG}/${encodeURIComponent(d.identifier)}`,
    artBig: `${IA_IMG}/${encodeURIComponent(d.identifier)}`,
    collection: Array.isArray(d.collection) ? d.collection[0] : d.collection || "",
    downloads: d.downloads || 0,
  };
}

/** Fetch an Archive item and turn its audio files into playable tracks. */
export async function archiveTracks(identifier) {
  const data = await getJSON(`${IA_META}/${encodeURIComponent(identifier)}`);
  const meta = data?.metadata || {};
  const itemTitle =
    (Array.isArray(meta.title) ? meta.title[0] : meta.title) || identifier;
  const creator =
    (Array.isArray(meta.creator) ? meta.creator[0] : meta.creator) || "Internet Archive";
  const files = data?.files || [];

  const audio = files.filter((f) => {
    const n = f.name || "";
    const fmt = (f.format || "").toLowerCase();
    return (AUDIO_EXT.test(n) || fmt.includes("flac") || fmt.includes("mp3")) && !f.name.startsWith("__ia_thumb");
  });

  // Prefer lossless, then highest quality, and de-duplicate by base name.
  const rank = (f) => {
    const fmt = (f.format || "").toLowerCase();
    const n = f.name.toLowerCase();
    if (fmt.includes("flac") || n.endsWith(".flac")) return 0;
    if (n.endsWith(".wav") || n.endsWith(".aiff") || n.endsWith(".alac")) return 1;
    if (fmt.includes("ogg") || n.endsWith(".ogg") || n.endsWith(".opus")) return 2;
    return 3;
  };
  const byBase = new Map();
  for (const f of audio) {
    const base = f.name.replace(AUDIO_EXT, "").replace(/\.(vbr|sample)$/i, "");
    const cur = byBase.get(base);
    if (!cur || rank(f) < rank(cur)) byBase.set(base, f);
  }

  const tracks = [...byBase.values()].map((f, i) => {
    const fmt = (f.format || "").toLowerCase();
    const n = f.name.toLowerCase();
    const lossless = fmt.includes("flac") || n.endsWith(".flac") || n.endsWith(".wav") || n.endsWith(".aiff");
    const format = n.endsWith(".flac") || fmt.includes("flac") ? "FLAC"
      : n.endsWith(".wav") ? "WAV"
      : n.endsWith(".aiff") ? "AIFF"
      : n.endsWith(".opus") ? "OPUS"
      : n.endsWith(".ogg") ? "OGG"
      : n.endsWith(".m4a") ? "M4A"
      : "MP3";
    const title = f.title || f.name.replace(AUDIO_EXT, "").replace(/[_-]+/g, " ").trim();
    return {
      id: `ia-${identifier}-${f.name}`,
      source: "archive",
      title,
      artist: f.artist || creator,
      album: itemTitle,
      art: `${IA_IMG}/${encodeURIComponent(identifier)}`,
      artBig: `${IA_IMG}/${encodeURIComponent(identifier)}`,
      preview: iaFileUrl(identifier, f.name),
      duration: Math.round(parseFloat(f.length || "0") * 1000) || 0,
      lossless,
      format,
      year: "",
      trackNo: i + 1,
      archiveId: identifier,
    };
  });
  return { item: { id: identifier, title: itemTitle, artist: creator, art: `${IA_IMG}/${encodeURIComponent(identifier)}` }, tracks };
}

/* ---------------- Audius ---------------- */

const _aud = (u, size) => (u ? (u[size] || u["480x480"] || u["1000x1000"] || u["150x150"]) : "");

function toAudiusTrack(t) {
  const art = t.artwork || {};
  return {
    id: `au-${t.id}`,
    auId: t.id,
    source: "audius",
    title: t.title,
    artist: t.user?.name || "Audius artist",
    album: t.album_backlink ? t.album_backlink : t.genre || "Audius",
    art: _aud(art, "480x480"),
    artBig: _aud(art, "1000x1000"),
    preview: `${AUDIUS}/tracks/${t.id}/stream?app_name=${APP}`,
    duration: (t.duration || 0) * 1000,
    genre: t.genre || "",
    year: (t.release_date || t.created_at || "").slice(0, 4),
    playCount: t.play_count || 0,
    lossless: false,
    format: "MP3",
  };
}

export async function audiusSearch(term, limit = 24) {
  if (!term?.trim()) return [];
  const data = await getJSON(
    `${AUDIUS}/tracks/search?query=${encodeURIComponent(term)}&app_name=${APP}&limit=${limit}`
  );
  return (data?.data || []).map(toAudiusTrack);
}

export async function audiusTrending(limit = 24, genre = "") {
  const g = genre ? `&genre=${encodeURIComponent(genre)}` : "";
  const data = await getJSON(`${AUDIUS}/tracks/trending?app_name=${APP}&limit=${limit}${g}`);
  return (data?.data || []).map(toAudiusTrack);
}

export const AUDIUS_GENRES = [
  "Electronic", "Hip-Hop/Rap", "House", "Techno", "Drum & Bass", "Dubstep",
  "Trap", "Lo-Fi", "Ambient", "Rock", "Pop", "R&B/Soul", "Jazz", "Classical",
];

/* ---------------- Radio-Browser (live stations) ---------------- */

async function rbFetch(path) {
  let lastErr;
  for (const base of RB_MIRRORS) {
    try {
      const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" } });
      if (res.ok) return res.json();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("no mirror");
}

function toStation(s) {
  return {
    id: `rb-${s.stationuuid}`,
    source: "radio",
    opaque: true,
    title: s.name?.trim(),
    artist: s.country || s.language || "Live radio",
    album: (s.tags || "").split(",").slice(0, 3).join(" · ") || "Internet radio",
    art: s.favicon || "",
    artBig: s.favicon || "",
    preview: s.url_resolved || s.url,
    duration: 0,
    codec: s.codec || "",
    bitrate: s.bitrate || 0,
    tags: s.tags || "",
    country: s.country || "",
    votes: s.votes || 0,
    clicks: s.clickcount || 0,
  };
}

export async function radioByTag(tag, limit = 30) {
  const data = await rbFetch(
    `/json/stations/bytag/${encodeURIComponent(tag)}?limit=${limit}&hidebroken=true&order=clickcount&reverse=true`
  );
  return (data || []).filter((s) => s.url_resolved || s.url).map(toStation);
}

export async function radioSearch(name, limit = 30) {
  const data = await rbFetch(
    `/json/stations/search?name=${encodeURIComponent(name)}&limit=${limit}&hidebroken=true&order=clickcount&reverse=true`
  );
  return (data || []).filter((s) => s.url_resolved || s.url).map(toStation);
}

export async function radioTop(limit = 40) {
  const data = await rbFetch(`/json/stations/topclick/${limit}?hidebroken=true`);
  return (data || []).filter((s) => s.url_resolved || s.url).map(toStation);
}

export const RADIO_TAGS = [
  "jazz", "classical", "lofi", "chillout", "rock", "pop", "hip hop", "electronic",
  "house", "ambient", "oldies", "reggae", "news", "country",
];

/* ---------------- Curated Archive collections (huge + lossless) ---------------- */

export const ARCHIVE_COLLECTIONS = [
  { id: "etree", label: "Live Music Archive", q: "collection:etree", emoji: "🎸", c1: "#FFE695", c2: "#F1C34A" },
  { id: "78rpm", label: "78 RPM & Cylinder", q: "collection:georgeblood", emoji: "📻", c1: "#F1C34A", c2: "#8F7842" },
  { id: "audio_music", label: "Community Audio", q: "collection:audio_music", emoji: "🌍", c1: "#FFF6D8", c2: "#D8AE4B" },
  { id: "netlabels", label: "Netlabels (CC)", q: "collection:netlabels", emoji: "🏷️", c1: "#E8B84A", c2: "#FFE695" },
  { id: "classical", label: "Classical", q: "subject:classical AND mediatype:audio", emoji: "🎻", c1: "#D8AE4B", c2: "#FFE695" },
  { id: "jazz_ia", label: "Jazz", q: "subject:jazz AND mediatype:audio", emoji: "🎷", c1: "#B7C468", c2: "#4A4126" },
  { id: "hiphop", label: "Hip-Hop", q: "subject:hip-hop AND mediatype:audio", emoji: "🧢", c1: "#F1C34A", c2: "#6B4A1E" },
  { id: "rock_ia", label: "Rock & Live", q: "subject:rock AND mediatype:audio", emoji: "🤘", c1: "#E8B84A", c2: "#5A2E1C" },
];

export async function archiveCollection(collectionQuery, rows = 24) {
  const params = new URLSearchParams();
  params.set("q", `${collectionQuery} AND format:(Flac)`);
  ["identifier", "title", "creator", "year", "downloads"].forEach((f) => params.append("fl[]", f));
  params.append("sort[]", "downloads desc");
  params.set("rows", String(rows));
  params.set("output", "json");
  const data = await getJSON(`${IA_SEARCH}?${params.toString()}`);
  return (data?.response?.docs || []).map(toArchiveItem);
}
