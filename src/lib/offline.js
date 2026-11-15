/* In-memory registry of blob URLs for downloaded tracks.
   IndexedDB holds the bytes; this maps a track id to a playable blob: URL so
   playback can skip the network entirely. URLs are revoked when a download is
   removed so memory doesn't creep up. */

const urls = new Map();

export function setOfflineUrl(id, url) {
  if (!id) return;
  const prev = urls.get(id);
  if (prev && prev !== url) URL.revokeObjectURL(prev);
  urls.set(id, url);
}

export function getOfflineUrl(id) {
  return (id && urls.get(id)) || null;
}

export function hasOffline(id) {
  return !!(id && urls.has(id));
}

export function releaseOffline(id) {
  const url = urls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(id);
  }
}

export function releaseAllOffline() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}