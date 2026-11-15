import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { searchSongs, searchAlbums, searchArtists, searchPodcasts, smartQuery } from "../api/music.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import TrackRow from "../components/TrackRow.jsx";
import TrackCard from "../components/TrackCard.jsx";
import { SectionTitle, Grid, Skeleton, Chip, SketchButton, Input, Panel, TabBar, Tab } from "../ui/kit.jsx";
import { Search as SearchIcon, Radio as RadioIcon, Play, Note, Mic } from "../ui/Icons.jsx";
import { useArtistPoster, useTrackPoster } from "../ui/usePoster.js";
import { AlbumImage, ArtistImage } from "../ui/ArtImage.jsx";
import { get as storeGet, set as storeSet } from "../lib/store.js";
import { wobbleBorder } from "../theme.jsx";

const SUGGESTIONS = ["lofi beats", "daft punk", "taylor swift", "bollywood hits", "jazz cafe", "k-pop", "acoustic"];

const Empty = styled(Panel)`
  text-align: center;
  padding: 40px 22px;
  .big { font-size: 52px; display: block; margin-bottom: 6px; }
`;

const TopCard = styled(Panel)`
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
  img {
    width: 120px; height: 120px; object-fit: cover;
    border-radius: 14px; border: 1px solid ${({ theme }) => theme.line};
    box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  }
`;

const AlbumCardBtn = styled.button`
  appearance: none; text-align: left; padding: 10px; cursor: pointer;
  background: ${({ theme }) => theme.surface}; color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 1px solid ${({ theme }) => theme.line}; }
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; color: ${({ theme }) => theme.textSoft}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

function TopArt({ item }) {
  const trackSrc = useTrackPoster(item);
  const artistSrc = useArtistPoster(item?.name);
  const isArtist = item && !item.preview;
  const src = isArtist ? artistSrc : trackSrc;
  return src ? (
    <img src={src} alt="" />
  ) : (
    <div style={{ width: 120, height: 120, display: "grid", placeItems: "center" }}>
      <Mic size={44} />
    </div>
  );
}

export default function Search({ query, setQuery }) {
  const { playAll, startRadio } = usePlayer();
  const [local, setLocal] = useState(query || "");
  const [tab, setTab] = useState("all");
  const [res, setRes] = useState(null); // {songs, albums, artists, podcasts}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => storeGet("searchHistory", []));

  const remember = (q) => {
    const next = [q, ...history.filter((x) => x !== q)].slice(0, 8);
    setHistory(next);
    storeSet("searchHistory", next);
  };

  const run = async (term) => {
    const q = smartQuery((term ?? "").trim());
    if (!q) return;
    setLoading(true); setError(""); setRes(null); setTab("all");
    const [s, al, ar, pc] = await Promise.allSettled([
      searchSongs(q, 30),
      searchAlbums(q, 12),
      searchArtists(q, 6),
      searchPodcasts(q, 8),
    ]);
    setRes({
      songs: s.status === "fulfilled" ? s.value : [],
      albums: al.status === "fulfilled" ? al.value : [],
      artists: ar.status === "fulfilled" ? ar.value : [],
      podcasts: pc.status === "fulfilled" ? pc.value : [],
    });
    if (s.status !== "fulfilled") setError("Hmm, the music shelf fell over. Try again? 🫠");
    setLoading(false);
  };

  useEffect(() => {
    if (query) { setLocal(query); run(query); }
    else setRes(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const submit = (e) => {
    e.preventDefault();
    const q = local.trim();
    if (!q) return;
    setQuery(q);
    remember(q);
    run(q);
  };

  const total = res ? res.songs.length + res.albums.length + res.artists.length + res.podcasts.length : 0;
  const top = res?.songs?.[0] || res?.artists?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <form onSubmit={submit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="What are we grabbing today?" aria-label="Search" />
        </div>
        <SketchButton type="submit" $variant="accent"><SearchIcon size={18} /> Search</SketchButton>
      </form>

      {history.length > 0 && !res && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="hand" style={{ fontSize: 14, opacity: .7 }}>Recent:</span>
          {history.map((h) => (
            <Chip key={h} as="button" onClick={() => { setLocal(h); setQuery(h); run(h); }} style={{ cursor: "pointer", border: "2px solid currentColor" }}>{h}</Chip>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="hand" style={{ fontSize: 15, opacity: .75 }}>Try:</span>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} as="button" onClick={() => { setLocal(s); setQuery(s); remember(s); run(s); }} style={{ cursor: "pointer", border: "2px solid currentColor" }}>{s}</Chip>
        ))}
      </div>

      {loading && (
        <Grid>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ aspectRatio: "0.72" }} />)}</Grid>
      )}

      {!loading && !res && (
        <Empty $tilt={-0.4}>
          <span className="big">🔍</span>
          <h2 style={{ margin: "4px 0" }}>Search for anything</h2>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .8 }}>
            Songs, albums, artists, podcasts... GRAB IT! will snatch them up.
          </p>
        </Empty>
      )}

      {!loading && error && (
        <Empty $tilt={0.4}><span className="big">🧹</span>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 18 }}>{error}</p>
        </Empty>
      )}

      {!loading && res && total === 0 && (
        <Empty $tilt={-0.4}>
          <span className="big">🫥</span>
          <h2 style={{ margin: "4px 0" }}>Nothing found for "{query}"</h2>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .8 }}>Try a mood like "chill" or check the spelling 🧘</p>
        </Empty>
      )}

      {!loading && res && total > 0 && (
        <>
          <TabBar>
            <Tab $on={tab === "all"} onClick={() => setTab("all")}>All</Tab>
            <Tab $on={tab === "songs"} onClick={() => setTab("songs")}>Songs ({res.songs.length})</Tab>
            <Tab $on={tab === "albums"} onClick={() => setTab("albums")}>Albums ({res.albums.length})</Tab>
            <Tab $on={tab === "artists"} onClick={() => setTab("artists")}>Artists ({res.artists.length})</Tab>
            <Tab $on={tab === "podcasts"} onClick={() => setTab("podcasts")}>Podcasts ({res.podcasts.length})</Tab>
          </TabBar>

          {(tab === "all" || tab === "songs") && top && (
            <TopCard $tilt={-0.4}>
              <TopArt item={top} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <Chip>{top.artistId && !top.preview ? "Top artist" : "Top result"}</Chip>
                <h2 style={{ margin: "8px 0 2px", fontSize: 28 }}>{top.title || top.name}</h2>
                <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .8, margin: 0 }}>
                  {top.artist || `${top.genre || "Artist"} • ${res.songs.length} songs found`}
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  {top.preview ? (
                    <SketchButton $variant="accent" onClick={() => playAll(res.songs, 0)}><Play size={18} /> Play all</SketchButton>
                  ) : (
                    <SketchButton $variant="accent" onClick={() => go(`/artist/${encodeURIComponent(top.name)}`)}>Open artist</SketchButton>
                  )}
                  <SketchButton onClick={() => startRadio(query || local)}><RadioIcon size={18} /> Radio</SketchButton>
                </div>
              </div>
            </TopCard>
          )}

          {(tab === "all" || tab === "artists") && res.artists.length > 0 && (
            <section>
              <SectionTitle><Mic size={20} /> Artists</SectionTitle>
              <Grid $min={150}>
                {res.artists.map((a) => (
                  <AlbumCardBtn key={a.id} onClick={() => go(`/artist/${encodeURIComponent(a.name)}`)}>
                    <div style={{ width: "100%", aspectRatio: 1, display: "grid", placeItems: "center", borderRadius: 12, border: "2.6px solid currentColor", background: "linear-gradient(135deg,#FFE695,#D8AE4B)", overflow: "hidden" }}>
                      <ArtistImage name={a.name} fallback={a.art} placeholder={<span style={{ fontSize: 44 }}>🎤</span>} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div className="t">{a.name}</div>
                    <div className="a">{a.genre || "Artist"}</div>
                  </AlbumCardBtn>
                ))}
              </Grid>
            </section>
          )}

          {(tab === "all" || tab === "albums") && res.albums.length > 0 && (
            <section>
              <SectionTitle><Note size={20} /> Albums</SectionTitle>
              <Grid $min={150}>
                {res.albums.map((al) => (
                  <AlbumCardBtn key={al.id} onClick={() => go(`/album/${al.albumId}`)}>
                    <AlbumImage album={al} placeholder={<Note size={40} />} loading="lazy" />
                    <div className="t">{al.title}</div>
                    <div className="a">{al.artist} • {al.year}</div>
                  </AlbumCardBtn>
                ))}
              </Grid>
            </section>
          )}

          {(tab === "all" || tab === "songs") && res.songs.length > 0 && (
            <section>
              <SectionTitle>🎧 Songs</SectionTitle>
              <Panel $tilt={-0.3} style={{ padding: 10 }}>
                {res.songs.map((t, i) => <TrackRow key={t.id} track={t} list={res.songs} index={i} />)}
              </Panel>
            </section>
          )}

          {(tab === "all" || tab === "podcasts") && res.podcasts.length > 0 && (
            <section>
              <SectionTitle>🎙️ Podcasts</SectionTitle>
              <Grid $min={150}>
                {res.podcasts.map((p) => (
                  <AlbumCardBtn key={p.id} onClick={() => go(`/podcasts`)}>
                    <img src={p.art} alt={p.title} loading="lazy" />
                    <div className="t">{p.title}</div>
                    <div className="a">{p.artist}</div>
                  </AlbumCardBtn>
                ))}
              </Grid>
            </section>
          )}

          {(tab === "all" || tab === "songs") && (
          <section>
            <SectionTitle>🎧 More picks</SectionTitle>
            <Grid>
              {res.songs.slice(0, 8).map((t) => <TrackCard key={t.id} track={t} list={res.songs} />)}
            </Grid>
          </section>
          )}
        </>
      )}
    </div>
  );
}
