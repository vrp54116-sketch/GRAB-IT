import React, { useCallback, useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useRoute, go } from "./router.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { usePlayer } from "./player/PlayerContext.jsx";
import { get as storeGet, set as storeSet } from "./lib/store.js";

import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Player from "./components/Player.jsx";
import MobileNav from "./components/MobileNav.jsx";
import NowPlaying from "./components/NowPlaying.jsx";
import LyricBridge from "./components/LyricBridge.jsx";

import Home from "./pages/Home.jsx";
import Search from "./pages/Search.jsx";
import Browse from "./pages/Browse.jsx";
import Radio from "./pages/Radio.jsx";
import Podcasts from "./pages/Podcasts.jsx";
import Library from "./pages/Library.jsx";
import Album from "./pages/Album.jsx";
import ArchiveItem from "./pages/ArchiveItem.jsx";
import Party from "./pages/Party.jsx";
import Playlist from "./pages/Playlist.jsx";
import Artist from "./pages/Artist.jsx";
import Settings from "./pages/Settings.jsx";
import Wrapped from "./pages/Wrapped.jsx";
import Login from "./pages/Login.jsx";

import SketchDefs from "./ui/SketchDefs.jsx";
import PencilLoader from "./ui/PencilLoader.jsx";
import IntroSplash from "./ui/IntroSplash.jsx";
import Toasts from "./ui/Toasts.jsx";
import AmbientSky from "./ui/AmbientSky.jsx";

const fade = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Shell = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
`;

const Main = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  padding: 24px 26px calc(150px + var(--safe-bottom));
  animation: ${fade} .35s ease both;
  @media (max-width: 900px) {
    padding: 16px 16px calc(var(--player-h) + var(--mobile-nav-h) + 24px);
  }
  @media (max-width: 440px) {
    padding: 12px 12px calc(var(--player-h) + var(--mobile-nav-h) + 20px);
  }
`;

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 58;
  background: ${({ theme }) => theme.line}66;
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  transition: opacity .3s ease;
  @media (min-width: 901px) { display: none; }
`;

const Boot = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.surface};
  transition: opacity .5s ease;
  opacity: ${({ $done }) => ($done ? 0 : 1)};
  pointer-events: ${({ $done }) => ($done ? "none" : "auto")};
`;

export default function App() {
  const route = useRoute();
  const { profiles, current, locked } = useAuth();
  const { playlists } = usePlayer();

  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);
  const [nowTab, setNowTab] = useState("lyrics");
  const [booting, setBooting] = useState(true);
  const [bootDone, setBootDone] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [guest, setGuest] = useState(() => storeGet("guest", false));

  useEffect(() => {
    const t1 = setTimeout(() => setBootDone(true), 1500);
    const t2 = setTimeout(() => setBooting(false), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const finishIntro = useCallback(() => setIntroOpen(false), []);

  const chooseGuest = () => {
    storeSet("guest", true);
    setGuest(true);
  };

  const openSearch = (term) => {
    setQuery(term || "");
    go("/search");
    setMenuOpen(false);
  };

  const pages = {
    home: <Home onSearch={openSearch} onMood={(m) => openSearch(m.q)} />,
    search: <Search query={query} setQuery={setQuery} />,
    browse: <Browse />,
    radio: <Radio />,
    podcasts: <Podcasts />,
    library: <Library />,
    album: <Album id={route.id} />,
    item: <ArchiveItem id={route.id} />,
    party: <Party id={route.id} />,
    playlist: <Playlist id={route.id} />,
    artist: <Artist name={route.id} />,
    settings: <Settings />,
    wrapped: <Wrapped />,
  };

  const needsLogin = locked || (profiles.length === 0 && !guest);

  if (needsLogin) {
    return (
      <>
        <SketchDefs />
        <AmbientSky />
        <Login onGuest={chooseGuest} />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <SketchDefs />
      <AmbientSky />
      <Shell>
        <Sidebar
          page={route.name}
          playlists={playlists}
          open={menuOpen}
          onNavigate={() => setMenuOpen(false)}
        />
        <Scrim $open={menuOpen} onClick={() => setMenuOpen(false)} />
        <Main>
          <TopBar
            page={route.name}
            onSearch={openSearch}
            onMenu={() => setMenuOpen((v) => !v)}
            onBack={() => window.history.back()}
          />
          <Content key={route.path}>{pages[route.name] || <Home onSearch={openSearch} onMood={(m) => openSearch(m.q)} />}</Content>
        </Main>
      </Shell>

      <MobileNav page={route.name} />
      <Player
        onOpenNowPlaying={() => { setNowTab("lyrics"); setNowOpen(true); }}
        onOpenQueue={() => { setNowTab("queue"); setNowOpen(true); }}
        onOpenFx={() => { setNowTab("fx"); setNowOpen(true); }}
      />
      <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} initialTab={nowTab} />
      <LyricBridge nowOpen={nowOpen} />
      <Toasts />

      {/* the title card waits for the pencil to finish, then draws itself */}
      {bootDone && introOpen && <IntroSplash onDone={finishIntro} />}

      {booting && (
        <Boot $done={bootDone}>
          <PencilLoader label="Sharpening the tunes..." />
        </Boot>
      )}
    </>
  );
}
