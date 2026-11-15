import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { Check, Dots, ListMusic, Plus } from "../ui/Icons.jsx";
import { IconButton } from "../ui/kit.jsx";

/* A tiny popover that lets you drop a track into any playlist (or spin up
   a fresh one on the spot). Shared by track rows, track cards and Now Playing
   so "add to playlist" works everywhere you see a song. */

const Wrap = styled.div`
  position: relative;
  display: inline-flex;
`;

const Pop = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  width: 240px;
  max-height: min(320px, 60vh);
  overflow-y: auto;
  padding: 8px;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  border: 2px solid ${({ theme }) => theme.inkEdge};
  border-radius: 14px;
  box-shadow: 4px 6px 0 0 ${({ theme }) => theme.shadow};
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 14px;
`;

const Item = styled.button`
  appearance: none;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.surfaceAlt};
    outline: none;
  }
  .n {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .c {
    flex: none;
    opacity: .6;
    font-size: 12px;
  }
`;

const Empty = styled.p`
  margin: 4px 8px 8px;
  opacity: .7;
  line-height: 1.35;
`;

const NewRow = styled.div`
  display: flex;
  gap: 6px;
  padding: 7px 4px 2px;
  margin-top: 4px;
  border-top: 1.5px dashed ${({ theme }) => theme.line}44;

  input {
    flex: 1;
    min-width: 0;
    font-family: "Nunito", sans-serif;
    font-size: 13.5px;
    padding: 7px 10px;
    border-radius: 9px;
    border: 2px solid ${({ theme }) => theme.line}44;
    background: ${({ theme }) => theme.surfaceAlt};
    color: inherit;
    outline: none;
  }
  input:focus {
    border-color: ${({ theme }) => theme.accent};
  }
  button {
    appearance: none;
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 2px solid ${({ theme }) => theme.inkEdge};
    background: ${({ theme }) => theme.accent2};
    color: ${({ theme }) => theme.onGold};
    border-radius: 9px;
    cursor: pointer;
  }
  button:hover {
    transform: translateY(-1px);
  }
`;

export default function AddToPlaylist({
  track,
  label = "Add to playlist",
  icon: Icon = Dots,
  size = 18,
}) {
  const { playlists, addToPlaylist, createPlaylist } = usePlayer();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const make = () => {
    const clean = name.trim();
    if (!clean) return;
    const pl = createPlaylist(clean);
    if (pl) addToPlaylist(pl.id, track);
    setName("");
    setOpen(false);
  };

  return (
    <Wrap ref={wrapRef}>
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        $active={open}
      >
        <Icon size={size} />
      </IconButton>
      {open && (
        <Pop role="menu" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          {playlists.length === 0 && (
            <Empty>No playlists yet — name one below and it's yours 👇</Empty>
          )}
          {playlists.map((pl) => {
            const has = pl.tracks.some((t) => t.id === track?.id);
            return (
              <Item
                key={pl.id}
                role="menuitem"
                onClick={() => addToPlaylist(pl.id, track)}
                title={has ? "Already in this playlist" : `Add to ${pl.name}`}
              >
                {has ? <Check size={16} /> : <ListMusic size={16} />}
                <span className="n">{pl.name}</span>
                <span className="c">{pl.tracks.length}</span>
              </Item>
            );
          })}
          <NewRow>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") make();
              }}
              placeholder="New playlist..."
              aria-label="New playlist name"
            />
            <button type="button" onClick={make} aria-label="Create playlist and add song">
              <Plus size={16} />
            </button>
          </NewRow>
        </Pop>
      )}
    </Wrap>
  );
}