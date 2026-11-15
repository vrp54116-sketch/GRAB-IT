import React, { useEffect, useState } from "react";
import { archiveTracks } from "../api/sources.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import TrackRow from "../components/TrackRow.jsx";
import { Panel, SketchButton, Chip, IconButton, Badge, Skeleton } from "../ui/kit.jsx";
import { Play, Shuffle, Back } from "../ui/Icons.jsx";

/** Detail page for one Internet Archive item (lossless when it carries FLAC). */
export default function ArchiveItem({ id }) {
  const { playAll, notify } = usePlayer();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setFailed(false);
    archiveTracks(id)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id]);

  const tracks = data?.tracks || [];
  const item = data?.item || { id, title: id, artist: "Internet Archive", art: `https://archive.org/services/img/${encodeURIComponent(id)}` };
  const losslessCount = tracks.filter((t) => t.lossless).length;

  const play = (i = 0) => {
    if (!tracks.length) return notify("Nothing to play there 🤷");
    playAll(tracks, i);
  };
  const shuffle = () => {
    if (!tracks.length) return notify("Nothing to shuffle 🤷");
    playAll([...tracks].sort(() => Math.random() - 0.5), 0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <IconButton onClick={() => (window.history.length > 1 ? window.history.back() : go("/browse"))} aria-label="Back">
          <Back size={22} />
        </IconButton>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{
          width: 190, height: 190, flex: "none", borderRadius: 16, overflow: "hidden",
          border: "3px solid currentColor", boxShadow: "6px 7px 0 rgba(0,0,0,.3)",
          transform: "rotate(-1deg)", background: "var(--surface-alt, #342E1B)",
        }}>
          <img src={item.art} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <Chip>Internet Archive {losslessCount ? "· Lossless" : "· Audio"}</Chip>
          <h1 style={{ margin: "8px 0 2px", fontSize: "clamp(24px,4vw,40px)", lineHeight: 1.05 }}>{item.title}</h1>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .85, margin: "0 0 12px" }}>{item.artist}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <SketchButton $variant="accent" disabled={!tracks.length} onClick={() => play(0)}>
              <Play size={18} /> Play all
            </SketchButton>
            <SketchButton disabled={!tracks.length} onClick={shuffle}>
              <Shuffle size={18} /> Shuffle
            </SketchButton>
            {!!losslessCount && <Badge $tone="lossless">{losslessCount} FLAC track{losslessCount === 1 ? "" : "s"} 💎</Badge>}
          </div>
        </div>
      </div>

      {failed ? (
        <Panel><p className="hand" style={{ fontSize: 18, margin: 0 }}>That item wouldn't load. Try another 🫠</p></Panel>
      ) : !data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} style={{ height: 58 }} />)}
        </div>
      ) : tracks.length === 0 ? (
        <Panel><p className="hand" style={{ fontSize: 18, margin: 0 }}>No playable audio in that item 🫙</p></Panel>
      ) : (
        <Panel $tilt={-0.2} style={{ padding: 10 }}>
          {tracks.map((t, i) => <TrackRow key={t.id} track={t} list={tracks} index={i} showAlbum={false} />)}
        </Panel>
      )}
    </div>
  );
}