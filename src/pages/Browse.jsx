import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { searchAlbums, searchSongs, searchArtists, shelf, albumShelf, getAlbum } from "../api/music.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import TrackCard from "../components/TrackCard.jsx";
import TrackRow from "../components/TrackRow.jsx";
import {
  SectionTitle, Panel, SketchButton, Grid, Input, Chip, IconButton, Badge,
  TabBar, Tab, Skeleton,
} from "../ui/kit.jsx";
import { Play, Shuffle, Back, Sparkle, Note, Mic } from "../ui/Icons.jsx";
import { AlbumImage, ArtistImage } from "../ui/ArtImage.jsx";
import { wobbleBorder } from "../theme.jsx";

const ItemCard = styled.button`
  appearance: none; text-align: left; padding: 10px; cursor: pointer;
  background: ${({ theme }) => theme.surface}; color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }
  .art {
    position: relative; width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden;
    border: 1px solid ${({ theme }) => theme.line}; background: ${({ theme }) => theme.surfaceAlt};
    display: grid; place-items: center; color: ${({ theme }) => theme.textSoft};
    img { width: 100%; height: 100%; object-fit: cover; }
  }
  .art.round { border-radius: 50%; }
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const Row = styled.div`
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
`;

const GENRES = [
  { id: "all", label: "Everything", q: "greatest hits" },
  { id: "pop", label: "Pop", q: "pop hits" },
  { id: "hiphop", label: "Hip-Hop", q: "hip hop" },
  { id: "rock", label: "Rock", q: "rock classics" },
  { id: "rnb", label: "R&B / Soul", q: "rnb soul" },
  { id: "electronic", label: "Electronic", q: "electronic dance" },
  { id: "jazz", label: "Jazz", q: "jazz standards" },
  { id: "indie", label: "Indie", q: "indie alternative" },
  { id: "bollywood", label: "Bollywood", q: "bollywood hits" },
  { id: "latin", label: "Latin", q: "latin reggaeton" },
  { id: "metal", label: "Metal", q: "metal" },
  { id: "country", label: "Country", q: "country" },
];

function Chips({ items, active, onPick }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      {items.map((it) => {
        const on = active === it.id;
        return (
          <Chip
            key={it.id}
            as="button"
            onClick={() => onPick(it)}
            style={{
              cursor: "pointer", border: "2px solid currentColor",
              background: on ? undefined : "transparent", opacity: on ? 1 : 0.72,
            }}
          >
            {it.label}
          </Chip>
        );
      })}
    </div>
  );
}

function SkelGrid({ n = 12, ratio = "1" }) {
  return <Grid $min={160}>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} style={{ aspectRatio: ratio }} />)}</Grid>;
}

export default function Browse() {
  const { playAll, notify } = usePlayer();
  const [tab, setTab] = useState("albums");
  const [term, setTerm] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
  const [openRelease, setOpenRelease] = useState(null); // { album, tracks }

  const [albums, setAlbums] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [artists, setArtists] = useState(null);

  const query = term.trim() || genre.q;

  useEffect(() => {
    let alive = true;
    if (tab === "albums") {
      setAlbums(null);
      (term.trim() ? searchAlbums(query, 36) : albumShelf(query, 36))
        .then((r) => alive && setAlbums(r))
        .catch(() => alive && setAlbums([]));
    }
    if (tab === "tracks") {
      setTracks(null);
      (term.trim() ? searchSongs(query, 36) : shelf(query, 36))
        .then((r) => alive && setTracks(r))
        .catch(() => alive && setTracks([]));
    }
    if (tab === "artists") {
      setArtists(null);
      searchArtists(query, 24)
        .then((r) => alive && setArtists(r))
        .catch(() => alive && setArtists([]));
    }
    return () => { alive = false; };
  }, [tab, query, term]);

  const openAlbum = async (album) => {
    setOpenRelease({ album, tracks: null });
    try {
      const { tracks: list } = await getAlbum(album.albumId);
      setOpenRelease({ album: { ...album, ...(list?.length ? { trackCount: list.length } : {}) }, tracks: list });
    } catch {
      setOpenRelease({ album, tracks: [], error: true });
    }
  };

  const playList = (list, i = 0) => {
    if (!list?.length) return notify("Nothing to play there 🤷");
    playAll(list, i);
  };
  const shuffleList = (list) => {
    if (!list?.length) return notify("Nothing to shuffle 🤷");
    playAll([...list].sort(() => Math.random() - 0.5), 0);
  };

  /* ---------------- release detail ---------------- */
  if (openRelease) {
    const { album, tracks: list } = openRelease;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <IconButton onClick={() => setOpenRelease(null)} aria-label="Back"><Back size={22} /></IconButton>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{
            width: 180, height: 180, flex: "none", borderRadius: 16, overflow: "hidden",
            border: "3px solid currentColor", boxShadow: "6px 7px 0 rgba(0,0,0,.3)",
            transform: "rotate(-1deg)", background: "var(--surface-alt, #342E1B)",
          }}>
            <AlbumImage album={album} placeholder={<Note size={54} />} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Chip>GRAB IT · Lossless</Chip>
            <h1 style={{ margin: "8px 0 2px", fontSize: "clamp(24px,4vw,40px)", lineHeight: 1.05 }}>{album.title}</h1>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .85, margin: "0 0 12px" }}>
              {album.artist}{album.year ? ` • ${album.year}` : ""}{album.label ? ` • ${album.label}` : ""}
            </p>
            <Row>
              <SketchButton $variant="accent" disabled={!list?.length} onClick={() => playList(list || [], 0)}>
                <Play size={18} /> Play all
              </SketchButton>
              <SketchButton disabled={!list?.length} onClick={() => shuffleList(list || [])}>
                <Shuffle size={18} /> Shuffle
              </SketchButton>
              <Badge $tone="lossless">FLAC 💎</Badge>
            </Row>
          </div>
        </div>

        {!list ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ height: 58 }} />)}
          </div>
        ) : list.length === 0 ? (
          <Panel><p className="hand" style={{ fontSize: 18, margin: 0 }}>No playable tracks in that release 🫙</p></Panel>
        ) : (
          <Panel $tilt={-0.2} style={{ padding: 10 }}>
            {list.map((t, i) => <TrackRow key={t.id} track={t} list={list} index={i} showAlbum={false} />)}
          </Panel>
        )}
      </div>
    );
  }

  /* ---------------- main browse ---------------- */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle><Sparkle size={22} /> New — the big library</SectionTitle>
      <Panel $tilt={0.25} style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 15.5 }}>
        Everything here comes from the <b>GRAB IT</b> catalogue — releases, artists and
        full-length <b>lossless FLAC</b> tracks, streamed straight from GRAB IT. 🎧
      </Panel>

      <TabBar>
        <Tab $on={tab === "albums"} onClick={() => setTab("albums")}><Note size={15} /> Albums</Tab>
        <Tab $on={tab === "tracks"} onClick={() => setTab("tracks")}><Play size={15} /> Tracks</Tab>
        <Tab $on={tab === "artists"} onClick={() => setTab("artists")}><Mic size={15} /> Artists</Tab>
      </TabBar>

      <div style={{ maxWidth: 560 }}>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search GRAB IT... (artist, album, song)"
          aria-label="Search GRAB IT"
        />
      </div>

      {!term.trim() && <Chips items={GENRES} active={genre.id} onPick={(g) => setGenre(g)} />}

      {tab === "albums" && (
        <section>
          {!albums ? <SkelGrid /> : albums.length === 0 ? (
            <Panel><p className="hand" style={{ margin: 0, fontSize: 18 }}>No albums found. Try another search 🎧</p></Panel>
          ) : (
            <Grid $min={160}>
              {albums.map((al) => (
                <ItemCard key={al.id} onClick={() => openAlbum(al)}>
                  <div className="art">
                    <AlbumImage album={al} placeholder={<Note size={40} />} loading="lazy" />
                  </div>
                  <div className="t">{al.title}</div>
                  <div className="a">{al.artist}{al.year ? ` • ${al.year}` : ""}</div>
                  <div style={{ marginTop: 6 }}><Badge $tone="lossless">FLAC 💎</Badge></div>
                </ItemCard>
              ))}
            </Grid>
          )}
        </section>
      )}

      {tab === "tracks" && (
        <section>
          {!tracks ? <SkelGrid ratio="0.72" /> : tracks.length === 0 ? (
            <Panel><p className="hand" style={{ margin: 0, fontSize: 18 }}>No tracks found. Try another search 🎧</p></Panel>
          ) : (
            <>
              <Row style={{ marginBottom: 12 }}>
                <SketchButton $variant="accent" onClick={() => playList(tracks, 0)}><Play size={18} /> Play all</SketchButton>
                <SketchButton onClick={() => shuffleList(tracks)}><Shuffle size={18} /> Shuffle</SketchButton>
              </Row>
              <Grid>
                {tracks.map((t) => <TrackCard key={t.id} track={t} list={tracks} />)}
              </Grid>
            </>
          )}
        </section>
      )}

      {tab === "artists" && (
        <section>
          {!artists ? <SkelGrid /> : artists.length === 0 ? (
            <Panel><p className="hand" style={{ margin: 0, fontSize: 18 }}>No artists found. Try another search 🎤</p></Panel>
          ) : (
            <Grid $min={160}>
              {artists.map((a) => (
                <ItemCard key={a.id} onClick={() => go(`/artist/${encodeURIComponent(a.name)}`)}>
                  <div className="art round">
                    <ArtistImage name={a.name} fallback={a.art} placeholder={<Mic size={40} />} loading="lazy" />
                  </div>
                  <div className="t">{a.name}</div>
                  <div className="a">{a.genre || "Artist"}</div>
                </ItemCard>
              ))}
            </Grid>
          )}
        </section>
      )}
    </div>
  );
}