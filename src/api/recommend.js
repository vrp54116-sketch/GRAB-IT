import { searchBackendTracks } from "./backend.js";

/* ------------------------------------------------------------------ */
/*  Taste-aware recommendations                                        */
/*                                                                     */
/*  "Top picks for you" is built from what this listener actually     */
/*  plays — the artists they repeat, the songs they like, and the      */
/*  genres around them — instead of a random seed. Cold starts fall    */
/*  back to the rotating seed shelf so the page is never empty.        */
/* ------------------------------------------------------------------ */

function artistScores({ topArtists = [], recent = [], liked = [], stats }) {
  const scores = new Map();
  const add = (name, weight) => {
    const key = String(name || "").trim();
    if (!key) return;
    scores.set(key, (scores.get(key) || 0) + weight);
  };

  topArtists.forEach((a, i) => {
    const depth = Math.max(1, topArtists.length - i);
    add(a.name, Math.max(1, a.count || 0) * (1 + depth * 0.08));
  });
  Object.entries(stats?.artists || {}).forEach(([name, count]) => {
    add(name, (count || 0) * 1.2);
  });
  recent.slice(0, 25).forEach((t, i) => add(t?.artist, 1 + (25 - i) * 0.05));
  liked.forEach((t) => add(t?.artist, 0.8));

  return [...scores.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

function genreScores({ liked = [], recent = [], stats }) {
  const scores = new Map();
  const add = (genre, weight) => {
    String(genre || "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .forEach((g) => scores.set(g, (scores.get(g) || 0) + weight));
  };
  liked.forEach((t) => add(t?.genre, 1.4));
  recent.slice(0, 25).forEach((t, i) => add(t?.genre, 1 + (25 - i) * 0.03));
  Object.entries(stats?.genres || {}).forEach(([genre, count]) => add(genre, (count || 0) * 0.9));
  return [...scores.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((g) => g.name);
}

/** Interleave result buckets so one prolific artist can't dominate the shelf. */
function weave(buckets, exclude, limit) {
  const seen = new Set();
  const out = [];
  const maxLen = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < maxLen && out.length < limit; i++) {
    for (const bucket of buckets) {
      const track = bucket[i];
      if (!track?.id || seen.has(track.id) || exclude.has(track.id)) continue;
      seen.add(track.id);
      out.push(track);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function topPicks({
  topArtists = [],
  recent = [],
  liked = [],
  stats = null,
  seed = "",
  limit = 14,
} = {}) {
  const artists = artistScores({ topArtists, recent, liked, stats });
  const genres = genreScores({ liked, recent, stats });
  const exclude = new Set(
    [...liked, ...recent].map((t) => t?.id).filter(Boolean)
  );

  const queries = [];
  const seenQuery = new Set();
  const pushQuery = (q) => {
    const clean = String(q || "").trim();
    if (!clean || seenQuery.has(clean.toLowerCase())) return;
    seenQuery.add(clean.toLowerCase());
    queries.push(clean);
  };

  // Your strongest artists first, then a couple of adjacent genres for variety.
  artists.slice(0, 4).forEach((a) => pushQuery(a.name));
  genres.slice(0, 3).forEach((g) => pushQuery(g));

  const coldStart = queries.length === 0;
  if (coldStart && seed) pushQuery(seed);

  if (queries.length === 0) return [];

  const perQuery = Math.max(8, Math.ceil(limit / 2));
  const settled = await Promise.allSettled(
    queries.map((q) => searchBackendTracks(q, perQuery))
  );
  const buckets = settled.map((r) => (r.status === "fulfilled" ? r.value : []));

  let picks = weave(buckets, exclude, limit);

  // Not enough matches (or we filtered a lot out) — widen with the seed.
  if (picks.length < limit && seed && !coldStart) {
    try {
      const fallback = await searchBackendTracks(seed, limit);
      const seen = new Set(picks.map((t) => t.id));
      for (const t of fallback) {
        if (picks.length >= limit) break;
        if (!t?.id || seen.has(t.id) || exclude.has(t.id)) continue;
        seen.add(t.id);
        picks.push(t);
      }
    } catch {
      /* keep what we have */
    }
  }

  return picks;
}