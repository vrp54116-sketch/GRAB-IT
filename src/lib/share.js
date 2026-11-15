/**
 * Listening-party links. A party link carries one track (plus the moment it
 * was shared) inside the URL — no server, no account. Whoever opens it starts
 * the same song at the same spot.
 */

const FIELDS = [
  "id", "source", "title", "artist", "album", "art", "artBig", "preview",
  "duration", "lossless", "format", "auId", "archiveId", "codec", "bitrate",
  "opaque", "scId", "year", "trackNo",
];

export function encodeTrack(track, seconds = 0) {
  if (!track) return "";
  const slim = {};
  FIELDS.forEach((k) => {
    if (track[k] !== undefined && track[k] !== null) slim[k] = track[k];
  });
  slim.startAt = Math.max(0, Math.round(Number(seconds) || 0));
  const bytes = new TextEncoder().encode(JSON.stringify(slim));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeTrack(token) {
  if (!token) return null;
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data && data.title ? data : null;
  } catch {
    return null;
  }
}

export function partyUrl(track, seconds) {
  const token = encodeTrack(track, seconds);
  return `${window.location.origin}${window.location.pathname}#/party/${token}`;
}