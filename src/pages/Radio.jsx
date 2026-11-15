import React, { useState } from "react";
import styled, { keyframes } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import { TrackImage } from "../ui/ArtImage.jsx";
import { SketchButton, Input, Chip, SectionTitle, Panel, Spinner } from "../ui/kit.jsx";
import { Radio as RadioIcon, Play, Shuffle } from "../ui/Icons.jsx";
import { wobbleBorder } from "../theme.jsx";

const STATIONS = [
  { name: "Lo-Fi Study Cave", seed: "lofi hip hop chill", emoji: "📚" },
  { name: "Kitchen Dance Party", seed: "dance party hits", emoji: "🕺" },
  { name: "Sad Boi Hours", seed: "sad acoustic songs", emoji: "😭" },
  { name: "2000s Time Machine", seed: "2000s pop throwbacks", emoji: "📼" },
  { name: "Bollywood Blast", seed: "bollywood hits", emoji: "💃" },
  { name: "Gym Goblin Mode", seed: "workout motivation", emoji: "🏋️" },
  { name: "Jazz Café", seed: "jazz cafe smooth", emoji: "☕" },
  { name: "K-Pop Chaos", seed: "kpop hits", emoji: "🌸" },
];

const spin = keyframes` to { transform: rotate(360deg); } `;
const pulse = keyframes`
  0%,100% { transform: scale(1); opacity: .9; }
  50% { transform: scale(1.06); opacity: 1; }
`;

const Dial = styled.div`
  position: relative;
  width: 220px; height: 220px;
  margin: 4px auto 0;
  border-radius: 50%;
  ${wobbleBorder(3)}
  background: radial-gradient(circle at 30% 25%, ${({ theme }) => theme.surface}, ${({ theme }) => theme.bgAlt});
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  display: grid;
  place-items: center;
  animation: ${pulse} 2.4s ease-in-out infinite;

  &::after {
    content: "";
    position: absolute;
    inset: 14px;
    border-radius: 50%;
    border: 3px dashed ${({ theme }) => theme.accent};
    opacity: .5;
    animation: ${spin} 14s linear infinite;
  }
  .emoji { font-size: 66px; z-index: 1; }
`;

const Station = styled.button`
  appearance: none;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${({ theme }) => theme.surface};
  color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .15s ease, box-shadow .15s ease;
  &:hover { transform: translateY(-4px) rotate(-0.7deg); box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow}; }
  .e { font-size: 30px; }
  .n { font-family: "Nunito", system-ui, sans-serif; font-size: 15px; line-height: 1.15; }
  .s { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; }
`;

export default function Radio() {
  const { startRadio, radioSeed, loadingRadio, queue, current, playAll, shuffle, setShuffle } = usePlayer();
  const [seed, setSeed] = useState(radioSeed || "");

  const tune = () => startRadio(seed);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionTitle>
        <RadioIcon size={22} /> GRAB IT! Radio
      </SectionTitle>
      <Panel $tilt={-0.4} style={{ textAlign: "center" }}>
        <Dial>
          <span className="emoji">
            {loadingRadio ? "📡" : current ? "🎶" : "📻"}
          </span>
        </Dial>
        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 18, opacity: .85, margin: "16px 0 10px" }}>
          Type a vibe, get an endless non-repeating station. Auto-DJ never plays the same song twice. 🤖
        </p>
        <div style={{ display: "flex", gap: 10, maxWidth: 520, margin: "0 auto", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tune()}
              placeholder='e.g. "rainy day jazz"'
              aria-label="Radio seed"
            />
          </div>
          <SketchButton $variant="accent" onClick={tune} disabled={loadingRadio}>
            {loadingRadio ? <Spinner /> : <RadioIcon size={18} />} Tune in
          </SketchButton>
        </div>
        {radioSeed && (
          <div style={{ marginTop: 12 }}>
            <Chip>On air: {radioSeed}</Chip>
          </div>
        )}
      </Panel>

      <section>
        <SectionTitle>📻 Hand-picked stations</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {STATIONS.map((s, i) => (
            <Station key={s.name} onClick={() => startRadio(s.seed)} style={{ transform: `rotate(${i % 2 ? 0.5 : -0.5}deg)` }}>
              <span className="e">{s.emoji}</span>
              <span>
                <span className="n">{s.name}</span>
                <br />
                <span className="s">"{s.seed}"</span>
              </span>
            </Station>
          ))}
        </div>
      </section>

      {queue.length > 0 && (
        <section>
          <SectionTitle>
            <Shuffle size={20} /> Up next on the air
            <button
              onClick={() => setShuffle((v) => !v)}
              style={{ background: "none", border: "none", marginLeft: 8, cursor: "pointer", color: "inherit", fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 15, opacity: shuffle ? 1 : .6 }}
            >
              shuffle: {shuffle ? "on" : "off"}
            </button>
          </SectionTitle>
          <Gridish>
            {queue.slice(0, 24).map((t, i) => (
              <MiniTrack key={`${t.id}-${i}`} onClick={() => playAll(queue, i)} $cur={current?.id === t.id}>
                <TrackImage track={t} loading="lazy" />
                <div>
                  <div className="nm">{t.title}</div>
                  <div className="ar">{t.artist}</div>
                </div>
              </MiniTrack>
            ))}
          </Gridish>
        </section>
      )}

      <SketchButton onClick={() => go("/library")} style={{ alignSelf: "flex-start" }}>
        <Play size={18} /> Open my library
      </SketchButton>
    </div>
  );
}

const Gridish = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
`;

const MiniTrack = styled.button`
  appearance: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  text-align: left;
  border: 1px solid ${({ theme }) => theme.line}22;
  border-radius: 12px;
  background: ${({ theme, $cur }) => ($cur ? theme.surface : "transparent")};
  color: inherit;
  &:hover { background: ${({ theme }) => theme.surface}; }
  img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid ${({ theme }) => theme.line}; }
  div { min-width: 0; }
  .nm { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${({ theme, $cur }) => ($cur ? theme.accent : theme.text)}; }
  .ar { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;
