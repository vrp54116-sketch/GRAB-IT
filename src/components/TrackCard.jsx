import React, { useState } from "react";
import styled from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { Heart, Play, Pause, Plus } from "../ui/Icons.jsx";
import { IconButton } from "../ui/kit.jsx";
import { useTrackPoster } from "../ui/usePoster.js";
import { wobbleBorder } from "../theme.jsx";
import AddToPlaylist from "./AddToPlaylist.jsx";
import DownloadButton from "./DownloadButton.jsx";

const Card = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transition: transform .18s cubic-bezier(.2,1.2,.4,1), box-shadow .18s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px) rotate(-0.8deg);
    box-shadow: 7px 9px 0 0 ${({ theme }) => theme.shadow};
  }
  &:active { transform: translateY(-1px) rotate(0) scale(.995); }
`;

const Art = styled.div`
  position: relative;
  aspect-ratio: 1;
  border: 2px solid ${({ theme }) => theme.line};
  border-radius: 12px;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform .5s cubic-bezier(.2,1,.3,1);
  }

  ${Card}:hover & img { transform: scale(1.07) rotate(.7deg); }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.line}55;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transition: opacity .18s ease;
`;

const PlayFab = styled.button`
  appearance: none;
  width: 52px; height: 52px;
  display: grid; place-items: center;
  border-radius: 50%;
  border: 2.6px solid ${({ theme }) => theme.line};
  background: ${({ theme }) => theme.accent2};
  color: ${({ theme }) => theme.onGold};
  transform: ${({ $show }) => ($show ? "scale(1)" : "scale(.8)")};
  transition: transform .18s ease;
  box-shadow: 2px 3px 0 0 rgba(0,0,0,.3);
`;

const Title = styled.div`
  font-weight: 800;
  font-size: 14.5px;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.3em;
`;

const Artist = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 14px;
  color: ${({ theme }) => theme.textSoft};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Corner = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transition: opacity .18s ease;

  button { background: ${({ theme }) => theme.surface}dd; color: ${({ theme }) => theme.text}; }
`;

const Badge = styled.span`
  position: absolute;
  bottom: 6px;
  left: 6px;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 12px;
  padding: 2px 8px;
  background: ${({ theme }) => theme.accent2};
  color: ${({ theme }) => theme.onGold};
  font-weight: 700;
  border: 2px solid ${({ theme }) => theme.line};
  border-radius: 999px;
  box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
  animation: floaty 3.4s ease-in-out infinite;
`;

export default function TrackCard({ track, list }) {
  const { playTrack, current, isPlaying, toggle, isLiked, toggleLike, addToQueue } = usePlayer();
  const [hover, setHover] = useState(false);
  const art = useTrackPoster(track);
  const isCurrent = current?.id === track.id;
  const playingThis = isCurrent && isPlaying;

  const onPlay = (e) => {
    e.stopPropagation();
    if (isCurrent) toggle();
    else playTrack(track, list);
  };

  return (
    <Card
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={onPlay}
      onClick={onPlay}
    >
      <Art>
        {art ? <img src={art} alt={track.title} loading="lazy" /> : null}
        <Overlay $show={hover}>
          <PlayFab $show={hover} onClick={onPlay} aria-label={playingThis ? "Pause" : "Play"}>
            {playingThis ? <Pause size={22} /> : <Play size={22} />}
          </PlayFab>
        </Overlay>
        <Corner $show={hover}>
          <IconButton
            $active={isLiked(track.id)}
            onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
            aria-label="Like"
          >
            <Heart size={19} filled={isLiked(track.id)} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
            aria-label="Add to queue"
          >
            <Plus size={19} />
          </IconButton>
          <DownloadButton track={track} size={19} />
          <AddToPlaylist track={track} size={19} />
        </Corner>
        {isCurrent && <Badge>now playing 🎧</Badge>}
      </Art>
      <Title title={track.title}>{track.title}</Title>
      <Artist title={track.artist}>{track.artist}</Artist>
    </Card>
  );
}
