import React from "react";
import styled from "styled-components";
import Logo from "../ui/Logo.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { go } from "../router.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useZen, zenHide } from "../ui/ZenMode.jsx";
import { wobbleBorder } from "../theme.jsx";
import { APP_TAGLINE, APP_VERSION_LABEL } from "../lib/appInfo.js";
import {
  Home, Search, Radio, Podcast, Library, Note, Settings as SettingsIcon, Trend, User, Sparkle,
} from "../ui/Icons.jsx";

const NAV = [
  { id: "home", label: "Home", Icon: Home, path: "/" },
  { id: "search", label: "Search", Icon: Search, path: "/search" },
  { id: "browse", label: "New", Icon: Sparkle, path: "/browse" },
  { id: "radio", label: "Radio", Icon: Radio, path: "/radio" },
  { id: "podcasts", label: "Podcasts", Icon: Podcast, path: "/podcasts" },
  { id: "library", label: "Your Library", Icon: Library, path: "/library" },
  { id: "wrapped", label: "GRAB IT! Wrapped", Icon: Trend, path: "/wrapped" },
];

const Aside = styled.aside`
  width: 262px;
  flex: none;
  padding: calc(18px + var(--safe-top)) 14px calc(104px + var(--safe-bottom)) calc(14px + var(--safe-left));
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-right: 2.6px dashed ${({ theme }) => theme.line}33;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: ${({ theme }) => theme.paper};
  ${zenHide}
  transition: opacity .6s ease;

  @media (max-width: 900px) {
    /* above the scrim (58), the player (47) and the bottom tab bar (46) */
    position: fixed;
    z-index: 62;
    inset: 0 auto 0 0;
    width: min(84vw, 262px);
    padding: calc(16px + var(--safe-top)) 14px calc(18px + var(--safe-bottom)) calc(14px + var(--safe-left));
    transform: translateX(${({ $open }) => ($open ? "0" : "-105%")});
    transition: transform .3s cubic-bezier(.2,1,.3,1), opacity .6s ease;
    will-change: transform;
    box-shadow: 8px 0 0 0 ${({ theme }) => theme.shadow};
  }
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const NavBtn = styled.button`
  appearance: none;
  position: relative;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: "Nunito", system-ui, sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: ${({ theme, $active }) => ($active ? theme.text : theme.textSoft)};
  background: ${({ theme, $active }) => ($active ? theme.surface : "transparent")};
  padding: 10px 14px;
  border: none;
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  outline: ${({ theme, $active }) => ($active ? `2.6px solid ${theme.line}` : "none")};
  box-shadow: ${({ theme, $active }) => ($active ? `3px 4px 0 0 ${theme.shadow}` : "none")};
  transition: transform .2s cubic-bezier(.2,1.2,.4,1), color .2s ease, background .2s ease, box-shadow .2s ease;
  transform: rotate(${({ $active }) => ($active ? "-0.7" : "0")}deg);
  svg {
    color: ${({ theme, $active }) => ($active ? theme.accent : "inherit")};
    transition: transform .25s cubic-bezier(.2,1.4,.4,1), color .2s ease;
  }

  /* pencil doodle that scribbles in beside the hovered item */
  &::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 50%;
    width: 7px;
    height: 7px;
    margin-top: -3.5px;
    border-radius: 45% 55% 52% 48%;
    background: ${({ theme }) => theme.accent};
    opacity: 0;
    transform: scale(.4);
    transition: opacity .2s ease, transform .25s cubic-bezier(.2,1.5,.4,1);
  }

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme, $active }) => ($active ? theme.surface : theme.surfaceAlt)};
    transform: translateX(4px) rotate(-0.6deg);
    box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
    svg { transform: rotate(-8deg) scale(1.08); color: ${({ theme }) => theme.accent}; }
    &::before { opacity: 1; transform: scale(1); }
  }
  &:active { transform: translateX(2px) scale(.985); }
`;

const Mini = styled.button`
  appearance: none;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textSoft};
  font-size: 14px;
  font-family: "Nunito", sans-serif;
  font-weight: 700;
  border-radius: 10px;
  width: 100%;
  transition: color .2s ease, background .2s ease, transform .18s cubic-bezier(.2,1.3,.4,1);
  &:hover { color: ${({ theme }) => theme.text}; background: ${({ theme }) => theme.surface}; transform: translateX(3px) rotate(-.4deg); }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  i {
    width: 40px; height: 40px; flex: none;
    display: grid; place-items: center;
    border-radius: 8px;
    ${wobbleBorder(2)}
    background: ${({ theme }) => theme.surfaceAlt};
    transition: transform .2s ease;
  }
  &:hover i { transform: rotate(-6deg); }
`;

const Box = styled.div`
  background: ${({ theme }) => theme.surfaceAlt};
  padding: 12px;
  ${wobbleBorder(2.6)}
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
`;

const BoxTitle = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 8px;
  display: flex; align-items: center; gap: 8px;
`;

const ProfileChip = styled.button`
  appearance: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  ${wobbleBorder(2.6)}
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  width: 100%;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease;
  .emoji { font-size: 22px; }
  .n { font-family: "Nunito", system-ui, sans-serif; font-size: 14px; font-weight: 800; }
  .s { font-family: "Nunito", system-ui, sans-serif; font-size: 12px; color: ${({ theme }) => theme.textSoft}; }
  &:hover { transform: translateY(-2px) rotate(-0.8deg); box-shadow: 5px 6px 0 0 ${({ theme }) => theme.shadow}; }
`;

export default function Sidebar({ page, playlists, open, onNavigate }) {
  const { current } = useAuth();
  const zen = useZen();
  const navigate = (path) => {
    go(path);
    onNavigate?.();
  };

  return (
    <Aside $open={open} $zen={zen}>
      <button
        onClick={() => navigate("/")}
        style={{ background: "none", border: "none", padding: 0 }}
        aria-label="GRAB IT! home"
      >
        <Logo size={26} />
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="hand" style={{ fontSize: 15, opacity: 0.75 }}>day / night</span>
        <ThemeToggle size={22} />
      </div>

      <Nav>
        {NAV.map(({ id, label, Icon, path }) => (
          <NavBtn key={id} $active={page === id} onClick={() => navigate(path)}>
            <Icon size={20} /> {label}
          </NavBtn>
        ))}
      </Nav>

      <Box>
        <BoxTitle>
          <Note size={17} /> Your playlists
        </BoxTitle>
        {playlists.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Nothing yet. Grab some songs and hit the ⋯ button to build one! 🧺
          </div>
        )}
        {playlists.map((pl) => (
          <Mini key={pl.id} onClick={() => navigate(`/playlist/${pl.id}`)}>
            <i><Note size={18} /></i>
            <span>{pl.name}</span>
            <span style={{ marginLeft: "auto", opacity: 0.6 }}>{pl.tracks.length}</span>
          </Mini>
        ))}
      </Box>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <NavBtn $active={page === "settings"} onClick={() => navigate("/settings")}>
          <SettingsIcon size={20} /> Settings
        </NavBtn>
        <ProfileChip onClick={() => navigate("/settings")}>
          <span className="emoji">{current ? current.emoji : "👤"}</span>
          <span style={{ textAlign: "left" }}>
            <span className="n" style={{ display: "block" }}>{current ? current.name : "Guest"}</span>
            <span className="s">{current ? "tap for account" : "not signed in"}</span>
          </span>
        </ProfileChip>
        <div
          style={{
            fontSize: 11.5,
            opacity: 0.65,
            fontFamily: '"Nunito", system-ui, sans-serif',
            display: "flex",
            alignItems: "center",
            gap: 5,
            lineHeight: 1.35,
          }}
        >
          <Sparkle size={12} /> {APP_TAGLINE}
        </div>
        <div
          style={{
            fontFamily: '"Nunito", system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".02em",
            opacity: 0.55,
            paddingLeft: 2,
          }}
        >
          {APP_VERSION_LABEL}
        </div>
      </div>
    </Aside>
  );
}
