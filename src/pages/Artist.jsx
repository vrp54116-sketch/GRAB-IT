import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { artistBundle } from "../api/music.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import TrackRow from "../components/TrackRow.jsx";
import { SectionTitle, Panel, SketchButton, Chip, Grid, Skeleton } from "../ui/kit.jsx";
import { Play, Shuffle, Mic, Star, Radio as RadioIcon } from "../ui/Icons.jsx";
import { useArtistPoster } from "../ui/usePoster.js";
import { AlbumImage } from "../ui/ArtImage.jsx";
import { wobbleBorder } from "../theme.jsx";

const Hero = styled.div`
  display: flex;
  gap: 22px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const Avatar = styled.div`
  width: 168px; height: 168px; flex: none;
  border: 1px solid ${({ theme }) => theme.line};
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, ${({ theme }) => theme.accent2}, ${({ theme }) => theme.accent3});
  display: grid; place-items: center;
  color: ${({ theme }) => theme.onGold};
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transform: rotate(-1.5deg);
  img { width: 100%; height: 100%; object-fit: cover; }
`;

const AlbumCardBtn = styled.button`
  appearance: none; text-align: left; padding: 10px; cursor: pointer;
  background: ${({ theme }) => theme.surface}; color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 1px solid ${({ theme }) => theme.line}; }
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; }
`;

export default function Artist({ name }) {
  const { playAll, startRadio, isFollowed, toggleFollow } = usePlayer();
  const [songs, setSongs] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [bio, setBio] = useState(null);
  const [avatar, setAvatar] = useState("");
  const avatarArt = useArtistPoster(name, avatar);

  useEffect(() => {
    if (!name) return;
    setSongs(null); setAlbums([]); setBio(null); setAvatar("");
    let alive = true;
    artistBundle(name, 24)
      .then((bundle) => {
        if (!alive) return;
        setSongs(bundle.songs || []);
        setAlbums(bundle.releases || []);
        setBio(bundle.bio || null);
        setAvatar(bundle.artist?.art || bundle.bio?.thumb || "");
      })
      .catch(() => {
        if (!alive) return;
        setSongs([]);
      });
    return () => { alive = false; };
  }, [name]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Hero>
        <Avatar>
          {avatarArt ? <img src={avatarArt} alt={name} /> : <Mic size={64} />}
        </Avatar>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Chip>Artist</Chip>
          <h1 style={{ margin: "8px 0 2px", fontSize: "clamp(28px,5vw,50px)", lineHeight: 1 }}>{name}</h1>
          {bio?.description && <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .8, margin: "4px 0 10px" }}>{bio.description}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <SketchButton $variant="accent" onClick={() => songs?.length && playAll(songs, 0)}><Play size={18} /> Play</SketchButton>
            <SketchButton onClick={() => songs?.length && playAll([...songs].sort(() => Math.random() - 0.5), 0)}><Shuffle size={18} /> Shuffle</SketchButton>
            <SketchButton onClick={() => startRadio(name)}><RadioIcon size={18} /> Radio</SketchButton>
            <SketchButton onClick={() => toggleFollow({ name, artistId: null, art: avatarArt || bio?.thumb || songs?.[0]?.art })}>
              <Star size={18} filled={isFollowed(name)} /> {isFollowed(name) ? "Following" : "Follow"}
            </SketchButton>
          </div>
        </div>
      </Hero>

      {bio?.extract && (
        <Panel $tilt={-0.3}>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, margin: 0, lineHeight: 1.6 }}>
            {bio.extract}
            {bio.url ? <> <a href={bio.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>more on Wikipedia ↗</a></> : null}
          </p>
        </Panel>
      )}

      <section>
        <SectionTitle>🔥 Popular</SectionTitle>
        {!songs ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ height: 58 }} />)}
          </div>
        ) : (
          <Panel $tilt={-0.3} style={{ padding: 10 }}>
            {songs.map((t, i) => <TrackRow key={t.id} track={t} list={songs} index={i} showAlbum={false} />)}
          </Panel>
        )}
      </section>

      {albums.length > 0 && (
        <section>
          <SectionTitle>💿 Albums</SectionTitle>
          <Grid $min={150}>
            {albums.map((al) => (
              <AlbumCardBtn key={al.id} onClick={() => go(`/album/${al.albumId}`)}>
                <AlbumImage album={al} loading="lazy" />
                <div className="t">{al.title}</div>
                <div className="a">
                  {[al.year, al.trackCount ? `${al.trackCount} songs` : "", al.genre].filter(Boolean).join(" • ")}
                </div>
              </AlbumCardBtn>
            ))}
          </Grid>
        </section>
      )}
    </div>
  );
}
