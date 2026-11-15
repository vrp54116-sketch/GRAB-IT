import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { getAlbum } from "../api/music.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import TrackRow from "../components/TrackRow.jsx";
import { SectionTitle, Panel, SketchButton, Chip, Skeleton, IconButton } from "../ui/kit.jsx";
import { Play, Shuffle, Heart, Back, Note } from "../ui/Icons.jsx";
import { AlbumImage } from "../ui/ArtImage.jsx";
import TiltPoster from "../ui/TiltPoster.jsx";

const Hero = styled.div`
  display: flex;
  gap: 22px;
  align-items: flex-end;
  flex-wrap: wrap;
  padding: 8px 0 18px;
`;

/* The album cover is a real little sleeve: cursor / gyroscope tilt with a
   glossy light sweep (see ui/TiltPoster.jsx). */
const Art = styled(TiltPoster)`
  width: 200px; height: 200px; flex: none;
  border: 1px solid ${({ theme }) => theme.line};
  border-radius: 18px;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  img { width: 100%; height: 100%; object-fit: cover; }
`;

export default function Album({ id }) {
  const { playAll, isAlbumSaved, toggleSaveAlbum } = usePlayer();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!id) return;
    setData(null); setErr(false);
    getAlbum(id).then(setData).catch(() => setErr(true));
  }, [id]);

  if (err) return <Panel><p className="hand" style={{ fontSize: 18 }}>Couldn't open that album 🫠</p></Panel>;
  if (!data) return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <Skeleton style={{ width: 200, height: 200 }} />
      <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton style={{ height: 34, width: "60%" }} />
        <Skeleton style={{ height: 20, width: "40%" }} />
        <Skeleton style={{ height: 44, width: 180 }} />
      </div>
    </div>
  );

  const { album, tracks } = data;
  if (!album) return <Panel><p className="hand" style={{ fontSize: 18 }}>Album not found 🤷</p></Panel>;

  const total = tracks.reduce((a, t) => a + (t.duration || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <IconButton onClick={() => window.history.back()} aria-label="Back"><Back size={22} /></IconButton>
      </div>
      <Hero>
        <Art><AlbumImage album={album} placeholder={<Note size={60} />} /></Art>
        <div style={{ flex: 1, minWidth: 240 }}>
          <Chip>Album</Chip>
          <h1 style={{ margin: "8px 0 2px", fontSize: "clamp(26px,4vw,44px)", lineHeight: 1.05 }}>{album.title}</h1>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .85, margin: "2px 0 12px" }}>
            <span onClick={() => go(`/artist/${encodeURIComponent(album.artist)}`)} style={{ textDecoration: "underline", cursor: "pointer" }}>{album.artist}</span>
            {" • "}{album.year} • {tracks.length} songs • {Math.round(total / 60000)} min {album.genre ? `• ${album.genre}` : ""}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SketchButton $variant="accent" onClick={() => playAll(tracks, 0)}><Play size={18} /> Play</SketchButton>
            <SketchButton onClick={() => { const t = tracks[Math.floor(Math.random() * tracks.length)]; playAll(tracks, tracks.indexOf(t)); }}><Shuffle size={18} /> Shuffle</SketchButton>
            <SketchButton onClick={() => toggleSaveAlbum(album)}>
              <Heart size={18} filled={isAlbumSaved(album.id)} /> {isAlbumSaved(album.id) ? "Saved" : "Save"}
            </SketchButton>
          </div>
        </div>
      </Hero>

      <section>
        <SectionTitle>Tracklist</SectionTitle>
        <Panel $tilt={-0.3} style={{ padding: 10 }}>
          {tracks.map((t, i) => <TrackRow key={t.id} track={t} list={tracks} index={i} showAlbum={false} />)}
        </Panel>
      </section>
    </div>
  );
}
