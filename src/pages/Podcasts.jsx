import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { searchPodcasts, topPodcasts, podcastEpisodes } from "../api/music.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { SectionTitle, Grid, Skeleton, Panel, Chip, SketchButton, IconButton, Badge } from "../ui/kit.jsx";
import { Podcast as PodcastIcon, Play, Pause, Back, Mic } from "../ui/Icons.jsx";
import { wobbleBorder } from "../theme.jsx";

const CATS = [
  { label: "Top", q: null },
  { label: "True Crime", q: "true crime" },
  { label: "Comedy", q: "comedy" },
  { label: "News", q: "daily news" },
  { label: "Tech", q: "technology" },
  { label: "Health", q: "health wellness" },
  { label: "Business", q: "business" },
  { label: "Storytelling", q: "storytelling" },
];

const Card = styled.button`
  appearance: none;
  text-align: left;
  display: block;
  cursor: pointer;
  background: ${({ theme }) => theme.surface};
  color: inherit;
  padding: 10px;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 1px solid ${({ theme }) => theme.line}; }
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; color: ${({ theme }) => theme.textSoft}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const EpRow = styled.div`
  display: flex; align-items: center; gap: 12px;
  padding: 10px; border-radius: 12px;
  background: ${({ theme, $cur }) => ($cur ? theme.surface : "transparent")};
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
  img { width: 54px; height: 54px; border-radius: 10px; border: 1px solid ${({ theme }) => theme.line}; object-fit: cover; flex: none; }
  .m { flex: 1; min-width: 0; }
  .t { font-weight: 800; font-size: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .d { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; color: ${({ theme }) => theme.textSoft}; }
`;

export default function Podcasts() {
  const { playAll, current, isPlaying, toggle } = usePlayer();
  const [cat, setCat] = useState(CATS[0]);
  const [items, setItems] = useState(null);
  const [show, setShow] = useState(null); // {show, episodes}

  useEffect(() => {
    if (cat.q === null) {
      setItems(null);
      topPodcasts(24).then(setItems).catch(() => setItems([]));
      return;
    }
    setItems(null);
    let alive = true;
    searchPodcasts(cat.q, 18).then((l) => alive && setItems(l)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [cat]);

  const openShow = async (p) => {
    setShow({ loading: true, title: p.title, art: p.art });
    try {
      const { show: s, episodes } = await podcastEpisodes(p.collectionId, 40);
      setShow({ show: s || p, episodes });
    } catch {
      setShow({ show: p, episodes: [], error: true });
    }
  };

  if (show) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <IconButton onClick={() => setShow(null)} aria-label="Back"><Back size={22} /></IconButton>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <img src={show.show?.art || show.art} alt="" style={{ width: 170, height: 170, objectFit: "cover", borderRadius: 16, border: "3px solid currentColor", boxShadow: "6px 7px 0 rgba(0,0,0,.3)", transform: "rotate(-1deg)" }} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <Chip>Podcast</Chip>
            <h1 style={{ margin: "8px 0 2px", fontSize: "clamp(24px,4vw,40px)" }}>{show.show?.title || show.title}</h1>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .85, margin: "0 0 12px" }}>{show.show?.artist}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <SketchButton $variant="accent" disabled={!show.episodes?.length} onClick={() => playAll(show.episodes, 0)}>
                <Play size={18} /> Play latest
              </SketchButton>
              <Badge>{show.episodes?.length || 0} episodes</Badge>
            </div>
          </div>
        </div>

        {show.loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ height: 74 }} />)}
          </div>
        ) : show.episodes?.length ? (
          <Panel $tilt={-0.2} style={{ padding: 8 }}>
            {show.episodes.map((ep, i) => {
              const isCur = current?.id === ep.id;
              return (
                <EpRow key={ep.id} $cur={isCur} onClick={() => (isCur ? toggle() : playAll(show.episodes, i))}>
                  <img src={ep.art} alt="" loading="lazy" />
                  <div className="m">
                    <div className="t">{ep.title}</div>
                    <div className="d">{ep.date} {ep.duration ? `• ${Math.round(ep.duration / 60000)} min` : ""}</div>
                  </div>
                  <IconButton $active={isCur} onClick={(e) => { e.stopPropagation(); isCur ? toggle() : playAll(show.episodes, i); }} aria-label="Play">
                    {isCur && isPlaying ? <Pause size={22} /> : <Play size={22} />}
                  </IconButton>
                </EpRow>
              );
            })}
          </Panel>
        ) : (
          <Panel><p className="hand" style={{ fontSize: 18, margin: 0 }}>No episodes available for this show right now 🎧</p></Panel>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle><PodcastIcon size={22} /> Podcasts &amp; shows</SectionTitle>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CATS.map((c) => (
          <Chip
            key={c.label}
            as="button"
            onClick={() => setCat(c)}
            style={{
              cursor: "pointer", border: "2px solid currentColor",
              background: cat.label === c.label ? undefined : "transparent",
              opacity: cat.label === c.label ? 1 : 0.7,
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <Panel $tilt={0.3} style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 15.5 }}>
        Tap a show to see its episodes — then just hit play. Real episode audio, straight to your ears. 🎙️
      </Panel>

      {!items ? (
        <Grid $min={150}>{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} style={{ aspectRatio: "0.8" }} />)}</Grid>
      ) : items.length === 0 ? (
        <Panel><p className="hand" style={{ margin: 0, fontSize: 18 }}>No shows found here. Try another category 🎧</p></Panel>
      ) : (
        <Grid $min={150}>
          {items.map((p) => (
            <Card key={p.id} onClick={() => openShow(p)}>
              <img src={p.art} alt={p.title} loading="lazy" />
              <div className="t">{p.title}</div>
              <div className="a">{p.artist}</div>
            </Card>
          ))}
        </Grid>
      )}
    </div>
  );
}
