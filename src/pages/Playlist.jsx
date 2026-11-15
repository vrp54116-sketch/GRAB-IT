import React, { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import TrackRow from "../components/TrackRow.jsx";
import { Panel, SketchButton, Chip, IconButton, Input, Badge } from "../ui/kit.jsx";
import { Play, Shuffle, Trash, Back, Note } from "../ui/Icons.jsx";
import { fmtTime } from "../lib/format.js";
import { TrackImage } from "../ui/ArtImage.jsx";

/** A full playlist page: rename, play, shuffle, remove tracks, delete. */
export default function Playlist({ id }) {
  const {
    playlists, playAll, renamePlaylist, removePlaylist, removeFromPlaylist, notify,
  } = usePlayer();

  const pl = useMemo(() => playlists.find((p) => p.id === id), [playlists, id]);
  const [name, setName] = useState(pl?.name || "");

  useEffect(() => {
    if (pl) setName(pl.name);
  }, [pl?.id]);

  if (!pl) {
    return (
      <Panel $tilt={-0.4} style={{ textAlign: "center", padding: 36 }}>
        <div style={{ fontSize: 52 }}>🧺</div>
        <h2 style={{ margin: "6px 0" }}>This playlist wandered off</h2>
        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .8 }}>
          Maybe it was deleted. Your other playlists are safe.
        </p>
        <SketchButton onClick={() => go("/library")} style={{ marginTop: 8 }}>
          <Back size={18} /> Back to library
        </SketchButton>
      </Panel>
    );
  }

  const tracks = pl.tracks || [];
  const totalMs = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const covers = tracks.slice(0, 4);

  const saveName = () => {
    const clean = name.trim();
    if (!clean || clean === pl.name) return setName(pl.name);
    renamePlaylist(pl.id, clean);
    notify("Playlist renamed ✏️");
  };

  const play = () => {
    if (!tracks.length) return notify("Add some songs first 🤷");
    playAll(tracks, 0);
  };
  const shuffle = () => {
    if (!tracks.length) return notify("Add some songs first 🤷");
    playAll([...tracks].sort(() => Math.random() - 0.5), 0);
  };
  const destroy = () => {
    removePlaylist(pl.id);
    notify(`Deleted "${pl.name}" 🗑️`);
    go("/library");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <IconButton onClick={() => go("/library")} aria-label="Back"><Back size={22} /></IconButton>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{
          width: 190, height: 190, flex: "none", borderRadius: 16, overflow: "hidden",
          border: "3px solid currentColor", boxShadow: "6px 7px 0 rgba(0,0,0,.3)",
          transform: "rotate(-1deg)", background: "var(--surface-alt, #342E1B)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2,
        }}>
          {covers.length ? covers.map((t, i) => (
            <TrackImage key={i} track={t} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )) : (
            <div style={{ gridColumn: "span 2", display: "grid", placeItems: "center", height: "100%" }}>
              <Note size={54} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <Chip>Playlist</Chip>
          <div style={{ maxWidth: 460, margin: "8px 0 6px" }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
              aria-label="Playlist name"
            />
          </div>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .8, margin: "0 0 12px" }}>
            {tracks.length} track{tracks.length === 1 ? "" : "s"}
            {totalMs ? ` • ${fmtTime(totalMs)}` : ""}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <SketchButton $variant="accent" onClick={play}><Play size={18} /> Play</SketchButton>
            <SketchButton onClick={shuffle}><Shuffle size={18} /> Shuffle</SketchButton>
            <IconButton onClick={destroy} aria-label="Delete playlist" title="Delete playlist">
              <Trash size={20} />
            </IconButton>
            {tracks.some((t) => t.lossless) && <Badge $tone="lossless">💎 has lossless</Badge>}
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <Panel>
          <p className="hand" style={{ fontSize: 18, margin: 0 }}>
            Empty for now — add songs with the + button anywhere in GRAB IT! 🧺
          </p>
        </Panel>
      ) : (
        <Panel $tilt={-0.2} style={{ padding: 10 }}>
          {tracks.map((t, i) => (
            <div key={t.id + i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TrackRow track={t} list={tracks} index={i} showAlbum={false} />
              </div>
              <IconButton
                onClick={() => { removeFromPlaylist(pl.id, t.id); notify("Removed from playlist 🧹"); }}
                aria-label={`Remove ${t.title}`}
                title="Remove from playlist"
              >
                <Trash size={18} />
              </IconButton>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}