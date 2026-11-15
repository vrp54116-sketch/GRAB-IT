import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { shelf, searchSongs, topPodcasts, albumShelf } from "../api/music.js";
import { topPicks } from "../api/recommend.js";
import { searchBackendTracks, backendShelfQuery } from "../api/backend.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";
import { go } from "../router.jsx";
import TrackCard from "../components/TrackCard.jsx";
import TrackRow from "../components/TrackRow.jsx";
import { SectionTitle, Grid, SketchButton, Skeleton, Chip, Panel } from "../ui/kit.jsx";
import { Hand, Radio as RadioIcon, Note, Play, Mic, Podcast as PodcastIcon } from "../ui/Icons.jsx";
import { ArtistImage, AlbumImage } from "../ui/ArtImage.jsx";
import { wobbleBorder } from "../theme.jsx";

const MOODS = [
  { label: "Pop", q: "pop hits", emoji: "🎈", c1: "#FFE695", c2: "#F1C34A" },
  { label: "Hip-Hop", q: "hip hop", emoji: "🧢", c1: "#F1C34A", c2: "#D8AE4B" },
  { label: "Chill", q: "chill lofi", emoji: "🧸", c1: "#FFF6D8", c2: "#FFE695" },
  { label: "Workout", q: "workout motivation", emoji: "💪", c1: "#E8B84A", c2: "#C79A2E" },
  { label: "Focus", q: "focus instrumental", emoji: "🧠", c1: "#FFF0BC", c2: "#F1C34A" },
  { label: "Throwbacks", q: "2000s hits", emoji: "📼", c1: "#FFE695", c2: "#B98C2E" },
];

const ROTATING = [
  "daft punk",
  "fleetwood mac",
  "the weeknd",
  "tyler the creator",
  "radiohead",
  "sade",
  "kendrick lamar",
  "arctic monkeys",
];

const ShelfCard = styled.button`
  appearance: none; text-align: left; padding: 10px; cursor: pointer;
  background: ${({ theme }) => theme.surface}; color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 1px solid ${({ theme }) => theme.line}; }
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const Hero = styled(Panel)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  justify-content: space-between;
`;

const Greeting = styled.h1`
  font-size: clamp(26px, 4vw, 40px);
  margin: 0 0 6px;
  line-height: 1.05;
`;

const MoodTile = styled.button`
  appearance: none;
  position: relative;
  text-align: left;
  padding: 16px;
  min-height: 108px;
  color: ${({ theme }) => theme.onGold};
  background: linear-gradient(135deg, ${({ $c1 }) => $c1}, ${({ $c2 }) => $c2});
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transform: rotate(${({ $t }) => $t}deg);
  transition: transform .16s ease, box-shadow .16s ease;
  overflow: hidden;

  &:hover { transform: translateY(-4px) rotate(-0.6deg) scale(1.01); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }

  .emoji { font-size: 30px; display: block; }
  .label { font-family: "Nunito", system-ui, sans-serif; font-size: 20px; margin-top: 8px; display: block; }
  .q { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .75; }
  .blob {
    position: absolute; right: -16px; bottom: -22px;
    width: 90px; height: 90px; border-radius: 50%;
    background: rgba(255,255,255,.28);
  }
`;

const MiniCard = styled.button`
  appearance: none;
  text-align: left;
  padding: 10px;
  cursor: pointer;
  background: ${({ theme }) => theme.surface};
  color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }
  .art {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.line};
    background: ${({ theme }) => theme.surfaceAlt};
    display: grid; place-items: center;
    color: ${({ theme }) => theme.textSoft};
    img { width: 100%; height: 100%; object-fit: cover; }
  }
  .art.round { border-radius: 50%; }
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

export default function Home({ onSearch, onMood }) {
  const { playAll, playTrack, recent, liked, startRadio, topArtists, savedAlbums, stats } = usePlayer();
  const { settings } = useSettings();
  const [picks, setPicks] = useState(null);
  const [shows, setShows] = useState([]);
  const seed = useMemo(() => ROTATING[Math.floor(Math.random() * ROTATING.length)], []);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  /* Keep the newest listening signal in a ref so the recommendation request
     only re-runs when taste actually changes — not on every stats tick. */
  const tasteRef = useRef({ topArtists, recent, liked, stats });
  tasteRef.current = { topArtists, recent, liked, stats };
  const tasteKey = useMemo(
    () =>
      [
        topArtists.slice(0, 6).map((a) => a.name).join("|"),
        liked.slice(0, 12).map((t) => t.id).join("|"),
        recent.slice(0, 12).map((t) => t.id).join("|"),
      ].join("~"),
    [topArtists, liked, recent]
  );

  useEffect(() => {
    if (!settings.showPodcastsOnHome) { setShows([]); return; }
    let alive = true;
    topPodcasts(12).then((l) => alive && setShows(l)).catch(() => {});
    return () => { alive = false; };
  }, [settings.showPodcastsOnHome]);

  useEffect(() => {
    let alive = true;
    setPicks(null);
    const taste = tasteRef.current;
    topPicks({ ...taste, seed, limit: 14 })
      .then((list) => {
        if (!alive) return;
        if (list.length) {
          setPicks(list);
          return;
        }
        return shelf(seed, 14)
          .then((fallback) => alive && setPicks(fallback))
          .catch(() => alive && setPicks([]));
      })
      .catch(() =>
        shelf(seed, 14)
          .then((fallback) => alive && setPicks(fallback))
          .catch(() => alive && setPicks([]))
      );
    return () => { alive = false; };
    // tasteKey is the stable fingerprint of the listening history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, tasteKey]);

  const [moodTracks, setMoodTracks] = useState({});
  useEffect(() => {
    let alive = true;
    MOODS.slice(0, 3).forEach((m) => {
      searchSongs(m.q, 10).then((list) => {
        if (alive) setMoodTracks((prev) => ({ ...prev, [m.label]: list }));
      }).catch(() => {});
    });
    return () => { alive = false; };
  }, []);

  /* backend shelves */
  const [albums, setAlbums] = useState(null);
  const [backendTracks, setBackendTracks] = useState(null);
  useEffect(() => {
    let alive = true;
    albumShelf(seed, 10)
      .then((l) => alive && setAlbums(l))
      .catch(() => alive && setAlbums([]));
    searchBackendTracks(backendShelfQuery(), 14)
      .then((l) => alive && setBackendTracks(l))
      .catch(() => alive && setBackendTracks([]));
    return () => { alive = false; };
  }, [seed]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <Hero $tape $tilt={-0.3}>
        <div>
          <Greeting>
            {greet}, human <span aria-hidden>👋</span>
          </Greeting>
          <p style={{ margin: 0, fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 18, opacity: .8 }}>
            {topArtists.length > 0 ? (
              <>Picked from what you keep playing: <Chip>{topArtists[0].name}</Chip></>
            ) : (
              <>Today's vibe auto-picked from: <Chip>#{seed}</Chip></>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SketchButton
            $variant="accent"
            onClick={() => picks?.length && playAll(picks, 0)}
          >
            <Play size={18} /> Play today's picks
          </SketchButton>
          <SketchButton onClick={() => startRadio(seed)}>
            <RadioIcon size={18} /> Start {seed} radio
          </SketchButton>
        </div>
      </Hero>

      <section>
        <SectionTitle>
          <Hand size={22} /> Top picks for you
        </SectionTitle>
        {!picks ? (
          <Grid>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} style={{ aspectRatio: "0.72" }} />
            ))}
          </Grid>
        ) : (
          <Grid>
            {picks.map((t) => (
              <TrackCard key={t.id} track={t} list={picks} />
            ))}
          </Grid>
        )}
      </section>

      <section>
        <SectionTitle>💿 Albums from GRAB IT</SectionTitle>
        {!albums ? (
          <Grid $min={160}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} style={{ aspectRatio: 1 }} />)}</Grid>
        ) : albums.length === 0 ? (
          <Panel><p className="hand" style={{ margin: 0 }}>GRAB IT is napping. Try the New page 🛌</p></Panel>
        ) : (
          <Grid $min={150}>
            {albums.map((al) => (
              <ShelfCard key={al.id} onClick={() => go(`/album/${al.albumId}`)}>
                <AlbumImage album={al} placeholder={<Note size={40} />} loading="lazy" />
                <div className="t">{al.title}</div>
                <div className="a">{al.artist}{al.year ? ` • ${al.year}` : ""} · FLAC</div>
              </ShelfCard>
            ))}
          </Grid>
        )}
        <div style={{ marginTop: 10 }}>
          <SketchButton onClick={() => go("/browse")}>Open the full library →</SketchButton>
        </div>
      </section>

      <section>
        <SectionTitle>📡 Straight from GRAB IT — lossless FLAC</SectionTitle>
        {!backendTracks ? (
          <Grid>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ aspectRatio: "0.72" }} />)}</Grid>
        ) : backendTracks.length === 0 ? (
          <Panel><p className="hand" style={{ margin: 0 }}>GRAB IT isn’t answering. Start it with <code>npm start</code> 📡</p></Panel>
        ) : (
          <Grid>
            {backendTracks.map((t) => <TrackCard key={t.id} track={t} list={backendTracks} />)}
          </Grid>
        )}
      </section>

      <section>
        <SectionTitle>🌈 Browse moods &amp; genres</SectionTitle>
        <Grid $min={200}>
          {MOODS.map((m, i) => (
            <MoodTile
              key={m.label}
              $c1={m.c1}
              $c2={m.c2}
              $t={(i % 2 ? 1 : -1) * 0.7}
              onClick={() => onMood(m)}
            >
              <span className="blob" />
              <span className="emoji">{m.emoji}</span>
              <span className="label">{m.label}</span>
              <span className="q">{m.q}</span>
            </MoodTile>
          ))}
        </Grid>
      </section>

      {Object.entries(moodTracks).map(([label, list]) => (
        <section key={label}>
          <SectionTitle>
            <Note size={20} /> {label} — quick grab
          </SectionTitle>
          <Grid>
            {list.slice(0, 6).map((t) => (
              <TrackCard key={t.id} track={t} list={list} />
            ))}
          </Grid>
        </section>
      ))}

      {recent.length > 0 && (
        <section>
          <SectionTitle>🕰️ Recently played</SectionTitle>
          <Panel $tilt={-0.3} style={{ padding: 10 }}>
            {recent.slice(0, 6).map((t, i) => (
              <TrackRow key={t.id + i} track={t} list={recent} index={i} />
            ))}
          </Panel>
        </section>
      )}

      {liked.length > 0 && (
        <section>
          <SectionTitle>❤️ Liked songs</SectionTitle>
          <Grid>
            {liked.slice(0, 6).map((t) => (
              <TrackCard key={t.id} track={t} list={liked} />
            ))}
          </Grid>
        </section>
      )}

      {topArtists.length > 0 && (
        <section>
          <SectionTitle>
            <Mic size={20} /> Artists you keep coming back to
          </SectionTitle>
          <Grid $min={160}>
            {topArtists.slice(0, 8).map((a) => (
              <MiniCard key={a.name} onClick={() => go(`/artist/${encodeURIComponent(a.name)}`)}>
                <div className="art round">
                  <ArtistImage name={a.name} fallback={a.art} placeholder={<Mic size={40} />} />
                </div>
                <div className="t">{a.name}</div>
                <div className="a">{a.count} play{a.count === 1 ? "" : "s"}</div>
              </MiniCard>
            ))}
          </Grid>
        </section>
      )}

      {savedAlbums.length > 0 && (
        <section>
          <SectionTitle>
            <Note size={20} /> Albums in your library
          </SectionTitle>
          <Grid $min={160}>
            {savedAlbums.slice(0, 8).map((al) => (
              <MiniCard key={al.id} onClick={() => go(`/album/${al.id}`)}>
                <div className="art"><AlbumImage album={al} fallback={al.art} placeholder={<Note size={40} />} loading="lazy" /></div>
                <div className="t">{al.title}</div>
                <div className="a">{al.artist}{al.year ? ` • ${al.year}` : ""}</div>
              </MiniCard>
            ))}
          </Grid>
        </section>
      )}

      {shows.length > 0 && (
        <section>
          <SectionTitle>
            <PodcastIcon size={20} /> Podcasts for your commute
          </SectionTitle>
          <Grid $min={160}>
            {shows.slice(0, 8).map((p) => (
              <MiniCard key={p.id} onClick={() => go("/podcasts")}>
                <div className="art">{p.art ? <img src={p.art} alt={p.title} loading="lazy" /> : <PodcastIcon size={40} />}</div>
                <div className="t">{p.title}</div>
                <div className="a">{p.artist}</div>
              </MiniCard>
            ))}
          </Grid>
        </section>
      )}
    </div>
  );
}
