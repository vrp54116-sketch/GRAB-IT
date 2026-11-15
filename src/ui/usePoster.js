import { useEffect, useState } from "react";
import { artistPoster, songPoster } from "../lib/albumArt.js";

/**
 * Resolve an artist or song poster from Spotify (via album-art) and fall
 * back to the art we already had if the lookup comes up empty.
 *
 * `kind` is "artist" | "song". For songs, the album name is used to find the
 * right cover; if a backend track only has a release id we resolve the title
 * first. If nothing is found we keep the artwork the item already had.
 */
export function usePoster(kind, { artist = "", album = "", releaseId = "", fallback = "" } = {}) {
  const [url, setUrl] = useState(fallback || "");

  useEffect(() => {
    let alive = true;
    setUrl(fallback || "");

    const lookup =
      kind === "artist"
        ? artistPoster(artist)
        : songPoster(artist, album, releaseId);

    lookup
      .then((next) => {
        if (alive && next) setUrl(next);
      })
      .catch(() => {
        /* keep the fallback */
      });

    return () => {
      alive = false;
    };
  }, [kind, artist, album, releaseId, fallback]);

  return url || fallback || "";
}

/** Poster for a track object ({ artist, album, albumId, art, artBig }). */
export function useTrackPoster(track, fallback) {
  const existing = track?.artBig || track?.art || "";
  return usePoster("song", {
    artist: track?.artist || "",
    album: track?.album || "",
    releaseId: track?.albumId || track?.releaseId || "",
    fallback: fallback ?? existing,
  });
}

/** Poster for an artist name. */
export function useArtistPoster(name, fallback = "") {
  return usePoster("artist", { artist: name || "", fallback });
}

/** Poster for an album object ({ artist, title, art, artBig }). */
export function useAlbumPoster(album, fallback) {
  const existing = album?.artBig || album?.art || "";
  return usePoster("song", {
    artist: album?.artist || "",
    album: album?.title || album?.album || "",
    releaseId: album?.albumId || album?.id || "",
    fallback: fallback ?? existing,
  });
}