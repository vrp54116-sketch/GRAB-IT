import React from "react";
import { useAlbumPoster, useArtistPoster, useTrackPoster } from "./usePoster.js";

/**
 * Image helpers that swap in posters from album-art (Spotify) and fall back
 * to the artwork the item already carried. `placeholder` renders when there
 * is no artwork at all, which keeps the app's hand-drawn icons in play.
 */

export function ArtistImage({ name, fallback = "", placeholder = null, ...imgProps }) {
  const src = useArtistPoster(name, fallback);
  return src ? <img src={src} alt={name || ""} {...imgProps} /> : placeholder;
}

export function TrackImage({ track, fallback, placeholder = null, ...imgProps }) {
  const src = useTrackPoster(track, fallback);
  return src ? <img src={src} alt={track?.title || ""} {...imgProps} /> : placeholder;
}

export function AlbumImage({ album, fallback, placeholder = null, ...imgProps }) {
  const src = useAlbumPoster(album, fallback);
  return src ? <img src={src} alt={album?.title || ""} {...imgProps} /> : placeholder;
}