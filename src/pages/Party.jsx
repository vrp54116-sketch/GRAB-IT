import React, { useMemo, useState } from "react";
import { decodeTrack } from "../lib/share.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { go } from "../router.jsx";
import { Panel, SketchButton, Chip, Badge } from "../ui/kit.jsx";
import { Play, Sparkle, Note } from "../ui/Icons.jsx";
import { fmtTime } from "../lib/format.js";
import { useTrackPoster } from "../ui/usePoster.js";

/** A listening-party invite: opens the shared song at the shared moment. */
export default function Party({ id }) {
  const { playTrack, seek, notify } = usePlayer();
  const track = useMemo(() => decodeTrack(id), [id]);
  const [joined, setJoined] = useState(false);
  const poster = useTrackPoster(track);

  if (!track) {
    return (
      <Panel $tilt={-0.4} style={{ textAlign: "center", padding: 36 }}>
        <div style={{ fontSize: 52 }}>🎈</div>
        <h2 style={{ margin: "6px 0" }}>This party link is crumpled</h2>
        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .8 }}>
          It may be incomplete. Ask your friend to send it again.
        </p>
        <SketchButton onClick={() => go("/")} style={{ marginTop: 8 }}>Go home</SketchButton>
      </Panel>
    );
  }

  const startAt = Math.max(0, Number(track.startAt) || 0);

  const join = () => {
    playTrack(track, [track]);
    setJoined(true);
    if (startAt > 0) {
      // let the stream load, then drop everyone at the same spot
      setTimeout(() => {
        try { seek(startAt); } catch { /* ignore */ }
      }, 1200);
    }
    notify("You're in! Press play if it doesn't start 🎉");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", paddingTop: 10 }}>
      <Chip><Sparkle size={14} /> Listening party</Chip>

      <Panel $tilt={-0.5} style={{ width: "100%", maxWidth: 520, textAlign: "center", padding: 26 }}>
        <div style={{
          width: 220, height: 220, margin: "0 auto 16px", borderRadius: 18, overflow: "hidden",
          border: "3px solid currentColor", boxShadow: "7px 8px 0 rgba(0,0,0,.28)",
          transform: "rotate(-1.2deg)", background: "var(--surface-alt, #342E1B)",
        }}>
          {poster
            ? <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ display: "grid", placeItems: "center", height: "100%" }}><Note size={56} /></div>}
        </div>

        <h1 style={{ margin: "0 0 4px", fontSize: "clamp(22px,4vw,34px)", lineHeight: 1.1 }}>{track.title}</h1>
        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 18, opacity: .85, margin: "0 0 10px" }}>
          {track.artist}{track.album ? ` • ${track.album}` : ""}
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          {startAt > 0 && <Badge>starts at {fmtTime(startAt * 1000)}</Badge>}
          {track.lossless && <Badge $tone="lossless">💎 {track.format || "FLAC"}</Badge>}
        </div>

        <SketchButton $variant="accent" onClick={join}>
          <Play size={18} /> {joined ? "Play again" : "Join the party"}
        </SketchButton>

        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 14.5, opacity: .65, marginTop: 16, marginBottom: 0 }}>
          Everyone who opens this link starts the same song at the same spot — no account needed.
        </p>
      </Panel>
    </div>
  );
}