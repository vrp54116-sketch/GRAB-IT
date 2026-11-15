import React from "react";
import styled from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { Heart, Play, Pause, Plus, Dots } from "../ui/Icons.jsx";
import { IconButton } from "../ui/kit.jsx";
import { useTrackPoster } from "../ui/usePoster.js";
import AddToPlaylist from "./AddToPlaylist.jsx";
import DownloadButton from "./DownloadButton.jsx";

const RowWrap = styled.div`
  display: grid;
  grid-template-columns: 44px 52px 1fr 130px auto;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: background .18s ease, transform .18s cubic-bezier(.2,1.3,.4,1), box-shadow .18s ease;

  &:hover {
    background: ${({ theme }) => theme.surface};
    transform: translateX(4px) rotate(-.25deg);
    box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
  }
  &:active { transform: translateX(1px) scale(.996); }
  @media (max-width: 640px) {
    grid-template-columns: 30px 46px minmax(0, 1fr) auto;
    gap: 8px;
    padding: 6px 6px;
    &:hover { transform: none; box-shadow: none; background: transparent; }
  }
`;

const Idx = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 16px;
  color: ${({ theme }) => theme.textSoft};
  display: grid;
  place-items: center;
`;

const Thumb = styled.img`
  width: 46px;
  height: 46px;
  border-radius: 9px;
  border: 2px solid var(--ink-edge);
  object-fit: cover;
  background: ${({ theme }) => theme.surfaceAlt};
`;

const Meta = styled.div`
  min-width: 0;
`;

const Name = styled.div`
  font-weight: 800;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme, $active }) => ($active ? theme.accent : theme.text)};
`;

const Sub = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13.5px;
  color: ${({ theme }) => theme.textSoft};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Album = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13.5px;
  color: ${({ theme }) => theme.textSoft};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  @media (max-width: 640px) { display: none; }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  @media (max-width: 640px) {
    gap: 0;
    > *:last-child { display: none; }
  }
`;

export default function TrackRow({ track, list, index, showAlbum = true }) {
  const { playTrack, current, isPlaying, toggle, isLiked, toggleLike, addToQueue } = usePlayer();
  const art = useTrackPoster(track);
  const isCurrent = current?.id === track.id;
  const playingThis = isCurrent && isPlaying;

  return (
    <RowWrap
      onClick={() => (isCurrent ? toggle() : playTrack(track, list))}
      onDoubleClick={() => (isCurrent ? toggle() : playTrack(track, list))}
    >
      <Idx>
        {playingThis ? (
          <Dancing>
            <span /><span /><span /><span />
          </Dancing>
        ) : (
          <span>{typeof index === "number" ? index + 1 : "♪"}</span>
        )}
      </Idx>
      <Thumb src={art} alt="" loading="lazy" />
      <Meta>
        <Name $active={isCurrent}>{track.title}</Name>
        <Sub>{track.artist}</Sub>
      </Meta>
      {showAlbum && <Album>{track.album}</Album>}
      <Actions>
        <IconButton
          $active={isLiked(track.id)}
          onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
          aria-label="Like"
        >
          <Heart size={18} filled={isLiked(track.id)} />
        </IconButton>
        <IconButton onClick={(e) => { e.stopPropagation(); addToQueue(track); }} aria-label="Add to queue">
          <Plus size={18} />
        </IconButton>
        <DownloadButton track={track} size={18} />
        <AddToPlaylist track={track} size={18} />
        <IconButton as="span" aria-hidden="true">
          {playingThis ? <Pause size={18} /> : <Play size={18} />}
        </IconButton>
      </Actions>
    </RowWrap>
  );
}

/* tiny equalizer for the currently playing row */
const Dancing = styled.div`
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 16px;
  span {
    width: 3px;
    background: ${({ theme }) => theme.accent};
    border-radius: 2px;
    animation: bounce 0.9s ease-in-out infinite;
    &:nth-child(1) { height: 60%; animation-delay: -0.2s; }
    &:nth-child(2) { height: 100%; animation-delay: -0.5s; }
    &:nth-child(3) { height: 45%; animation-delay: -0.1s; }
    &:nth-child(4) { height: 80%; animation-delay: -0.35s; }
  }
  @keyframes bounce {
    0%, 100% { transform: scaleY(0.35); }
    50% { transform: scaleY(1); }
  }
`; 
