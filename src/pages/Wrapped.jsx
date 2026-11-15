import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { TrackImage } from "../ui/ArtImage.jsx";
import { go } from "../router.jsx";
import { SectionTitle, Panel, SketchButton, Chip, Grid } from "../ui/kit.jsx";
import { Trend, Play, Star, Note, Sparkle } from "../ui/Icons.jsx";
import { fmtTime } from "../lib/format.js";
import { wobbleBorder } from "../theme.jsx";

const pop = keyframes`
  0% { transform: scale(.9) rotate(-2deg); opacity: 0; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
`;

const Big = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: clamp(44px, 10vw, 96px);
  line-height: 1;
  background: ${({ theme }) => theme.gradientInk};
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Stat = styled(Panel)`
  text-align: center;
  animation: ${pop} .4s ease both;
  .v { font-family: "Nunito", system-ui, sans-serif; font-size: clamp(26px, 4vw, 40px); }
  .k { font-family: "Nunito", system-ui, sans-serif; color: ${({ theme }) => theme.textSoft}; }
`;

export default function Wrapped() {
  const { stats, topArtists, topTracks, playAll } = usePlayer();
  const { current } = useAuth();

  const totalPlays = useMemo(
    () => Object.values(stats.plays || {}).reduce((a, p) => a + (p.count || 0), 0),
    [stats]
  );

  const byDay = useMemo(() => {
    const entries = Object.entries(stats.byDay || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-30);
    return entries;
  }, [stats]);

  const maxDay = Math.max(1, ...byDay.map(([, v]) => v));
  const hours = (stats.totalMs || 0) / 3600000;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionTitle><Trend size={22} /> {current ? `${current.name}'s` : "Your"} GRAB IT! Wrapped</SectionTitle>

      <Panel $tilt={-0.6} style={{ textAlign: "center", padding: "30px 20px" }}>
        <Chip>the year in you</Chip>
        <div style={{ margin: "12px 0" }}>
          <Big>{hours < 0.1 ? hours.toFixed(2) : hours.toFixed(1)}</Big>
          <div className="hand" style={{ fontSize: 20 }}>hours of listening</div>
        </div>
        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .85, margin: 0 }}>
          You played {totalPlays} song{totalPlays === 1 ? "" : "s"} — that's {fmtTime(stats.totalMs)} of vibes. 🎧
        </p>
      </Panel>

      {totalPlays === 0 && (
        <Panel $tilt={0.4}>
          <p className="hand" style={{ fontSize: 19, margin: 0 }}>
            Nothing here yet! Play some music and come back — I'll be counting. 📈
          </p>
          <SketchButton $variant="accent" onClick={() => go("/")} style={{ marginTop: 12 }}><Play size={18} /> Start listening</SketchButton>
        </Panel>
      )}

      {topArtists.length > 0 && (
        <section>
          <SectionTitle><Star size={20} /> Top artists</SectionTitle>
          <Grid $min={150}>
            {topArtists.slice(0, 8).map((a, i) => (
              <Stat key={a.name} $tilt={i % 2 ? 0.5 : -0.5}>
                <div style={{ fontSize: 34 }}>{["🥇", "🥈", "🥉"][i] || "🎤"}</div>
                <div className="v" style={{ fontSize: 20 }}>{a.name}</div>
                <div className="k">{a.count} play{a.count === 1 ? "" : "s"}</div>
              </Stat>
            ))}
          </Grid>
        </section>
      )}

      {topTracks.length > 0 && (
        <section>
          <SectionTitle><Note size={20} /> Top tracks</SectionTitle>
          <Panel $tilt={-0.3} style={{ padding: 10 }}>
            {topTracks.slice(0, 10).map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 10px" }}>
                <span className="hand" style={{ width: 26, textAlign: "center" }}>{i + 1}</span>
                <TrackImage track={t} style={{ width: 46, height: 46, borderRadius: 9, border: "2.4px solid currentColor", objectFit: "cover" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13, opacity: .7 }}>{t.artist}</div>
                </div>
                <Chip>{t.plays}×</Chip>
              </div>
            ))}
            <div style={{ padding: 10 }}>
              <SketchButton $variant="accent" onClick={() => playAll(topTracks, 0)}><Play size={18} /> Play your top tracks</SketchButton>
            </div>
          </Panel>
        </section>
      )}

      {byDay.length > 1 && (
        <section>
          <SectionTitle><Sparkle size={20} /> Listening rhythm</SectionTitle>
          <Panel $tilt={0.3}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 140 }}>
              {byDay.map(([d, v]) => (
                <div key={d} title={`${d}: ${fmtTime(v)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{
                    height: `${(v / maxDay) * 100}%`,
                    minHeight: 4,
                    background: "repeating-linear-gradient(-45deg, currentColor 0 4px, transparent 4px 8px)",
                    border: "2px solid currentColor",
                    borderRadius: 6,
                    opacity: .8,
                  }} />
                </div>
              ))}
            </div>
            <div style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 13, opacity: .7, marginTop: 8 }}>
              last {byDay.length} days
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}
