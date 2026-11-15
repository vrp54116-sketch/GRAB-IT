import React, { useRef, useState } from "react";
import styled from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { getAlbum } from "../api/music.js";
import { go } from "../router.jsx";
import TrackRow from "../components/TrackRow.jsx";
import TrackCard from "../components/TrackCard.jsx";
import {
  SectionTitle, Panel, SketchButton, Grid, Input, Chip, IconButton, Badge,
  TabBar, Tab, Spinner,
} from "../ui/kit.jsx";
import {
  Heart, Play, Shuffle, Plus, Trash, Download, Upload, Note, ListMusic, Mic,
  Folder, Timer, Lock, Radio as RadioIcon, Star, X,
} from "../ui/Icons.jsx";
import { wobbleBorder } from "../theme.jsx";
import { AlbumImage, ArtistImage } from "../ui/ArtImage.jsx";

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
`;

const BigArt = styled.div`
  width: 118px; height: 118px;
  flex: none;
  display: grid; place-items: center;
  border: 1px solid ${({ theme }) => theme.line};
  border-radius: 16px;
  background: ${({ theme }) => theme.gradient};
  color: ${({ theme }) => theme.onGold};
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  transform: rotate(-1.4deg);
`;

const Empty = styled(Panel)`
  p.hand { margin: 0; font-size: 18px; }
`;

const PlaylistCard = styled.div`
  background: ${({ theme }) => theme.surface};
  padding: 14px;
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
`;

const AlbumCard = styled.button`
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
  .t { font-weight: 800; font-size: 14px; margin-top: 8px; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; }
  .row { display: flex; align-items: center; gap: 6px; }
  .row .sp { flex: 1; }
`;

const ArtistCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  text-align: center;
  background: ${({ theme }) => theme.surface};
  ${wobbleBorder(2.6)}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  .av {
    width: 96px; height: 96px; border-radius: 50%;
    border: 1px solid ${({ theme }) => theme.line};
    overflow: hidden;
    background: ${({ theme }) => theme.gradient};
    display: grid; place-items: center;
    color: ${({ theme }) => theme.onGold};
    img { width: 100%; height: 100%; object-fit: cover; }
  }
  .n { font-weight: 800; font-size: 15px; }
  .a { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .7; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
`;

const LocalRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 2px dashed ${({ theme }) => theme.line}1f;
  &:last-child { border-bottom: none; }
  .t { font-weight: 800; font-size: 15px; }
  .s { font-family: "Nunito", system-ui, sans-serif; font-size: 13.5px; opacity: .72; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
`;

const StatBox = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  .b {
    background: ${({ theme }) => theme.surfaceAlt};
    padding: 12px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.line};
    text-align: center;
  }
  .n { font-family: "Nunito", system-ui, sans-serif; font-size: 24px; }
  .l { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; opacity: .75; }
`;

function fmtDur(ms) {
  const m = Math.round((ms || 0) / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(mb, 0.1).toFixed(1)} MB`;
}

export default function Library() {
  const {
    liked, recent, playlists, createPlaylist, removePlaylist,
    savedAlbums, toggleSaveAlbum,
    followed, toggleFollow, isFollowed,
    localTracks, addLocalFiles, removeLocal, clearLocal,
    downloads, removeDownload, clearDownloads,
    playAll, startRadio, exportVault, importVault, notify, stats,
  } = usePlayer();

  const [tab, setTab] = useState("liked");
  const [name, setName] = useState("");
  const [busyAlbum, setBusyAlbum] = useState(null);
  const fileRef = useRef(null);
  const localRef = useRef(null);

  const doShufflePlay = (list, label) => {
    if (!list.length) return notify(`${label} is emptier than my fridge 🧊`);
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    playAll(shuffled, 0);
  };

  const playAlbum = async (album) => {
    setBusyAlbum(album.id);
    try {
      const data = await getAlbum(album.id);
      if (data?.tracks?.length) playAll(data.tracks, 0);
      else notify("That album came back empty 🫙");
    } catch {
      notify("Couldn't fetch that album 😵");
    } finally {
      setBusyAlbum(null);
    }
  };

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importVault(String(reader.result));
    reader.readAsText(file);
    e.target.value = "";
  };

  const TABS = [
    { id: "liked", label: "Liked", Icon: Heart, n: liked.length },
    { id: "playlists", label: "Playlists", Icon: ListMusic, n: playlists.length },
    { id: "albums", label: "Albums", Icon: Note, n: savedAlbums.length },
    { id: "artists", label: "Artists", Icon: Mic, n: followed.length },
    { id: "downloads", label: "Downloads", Icon: Folder, n: downloads.length + localTracks.length },
    { id: "recent", label: "Recent", Icon: Timer, n: recent.length },
    { id: "vault", label: "Vault", Icon: Lock, n: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Head>
        <BigArt><Note size={50} /></BigArt>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: 30 }}>Your Library</h2>
          <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, opacity: .8, margin: "4px 0 0" }}>
            Everything you grabbed, saved and loved — kept on <b>your device only</b>.
          </p>
        </div>
      </Head>

      <TabBar>
        {TABS.map((t) => (
          <Tab key={t.id} $on={tab === t.id} onClick={() => setTab(t.id)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <t.Icon size={16} />
              {t.label}
              {t.n > 0 && <Badge>{t.n}</Badge>}
            </span>
          </Tab>
        ))}
      </TabBar>

      {tab === "liked" && (
        <section>
          <SectionTitle>
            <Heart size={20} filled /> Liked songs
          </SectionTitle>
          {liked.length === 0 ? (
            <Empty $tilt={-0.3}>
              <p className="hand">No liked songs yet. Tap the little heart anywhere and it lands here. ❤️</p>
            </Empty>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <SketchButton $variant="accent" onClick={() => playAll(liked, 0)}>
                  <Play size={18} /> Play all
                </SketchButton>
                <SketchButton onClick={() => doShufflePlay(liked, "Liked songs")}>
                  <Shuffle size={18} /> Shuffle
                </SketchButton>
              </div>
              <Panel $tilt={-0.25} style={{ padding: 10 }}>
                {liked.map((t, i) => (
                  <TrackRow key={t.id} track={t} list={liked} index={i} />
                ))}
              </Panel>
            </>
          )}
        </section>
      )}

      {tab === "playlists" && (
        <section>
          <SectionTitle>
            <ListMusic size={20} /> Playlists
          </SectionTitle>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, maxWidth: 560 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { createPlaylist(name); setName(""); } }}
                placeholder="New playlist name..."
                aria-label="New playlist name"
              />
            </div>
            <SketchButton $variant="accent" onClick={() => { createPlaylist(name); setName(""); }}>
              <Plus size={18} /> Create
            </SketchButton>
          </div>

          {playlists.length === 0 ? (
            <Empty $tilt={0.4}>
              <p className="hand">No playlists yet. Make one above, then hit ⋯ on any song to add it. 🧺</p>
            </Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {playlists.map((pl) => (
                <PlaylistCard key={pl.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="hand"
                      onClick={() => go(`/playlist/${pl.id}`)}
                      style={{ fontSize: 20, fontWeight: 800, cursor: "pointer", textDecoration: "none" }}
                      title="Open playlist"
                    >
                      {pl.name}
                    </button>
                    <Chip>{pl.tracks.length} track{pl.tracks.length === 1 ? "" : "s"}</Chip>
                    <div style={{ flex: 1 }} />
                    <IconButton onClick={() => playAll(pl.tracks, 0)} aria-label="Play playlist" title="Play">
                      <Play size={20} />
                    </IconButton>
                    <IconButton onClick={() => doShufflePlay(pl.tracks, `"${pl.name}"`)} aria-label="Shuffle playlist" title="Shuffle">
                      <Shuffle size={20} />
                    </IconButton>
                    <IconButton
                      onClick={() => { removePlaylist(pl.id); notify(`Deleted "${pl.name}" 🗑️`); }}
                      aria-label="Delete playlist"
                      title="Delete"
                    >
                      <Trash size={20} />
                    </IconButton>
                  </div>
                  {pl.tracks.length === 0 ? (
                    <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .7, marginBottom: 0 }}>
                      Empty for now — add songs with the ⋯ button.
                    </p>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      {pl.tracks.slice(0, 6).map((t, i) => (
                        <TrackRow key={t.id} track={t} list={pl.tracks} index={i} showAlbum={false} />
                      ))}
                      {pl.tracks.length > 6 && (
                        <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .7, margin: "6px 12px 2px" }}>
                          +{pl.tracks.length - 6} more… <button onClick={() => playAll(pl.tracks, 0)} style={{ textDecoration: "underline" }}>play the whole thing</button>
                        </p>
                      )}
                    </div>
                  )}
                </PlaylistCard>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "albums" && (
        <section>
          <SectionTitle>
            <Note size={20} /> Saved albums
          </SectionTitle>
          {savedAlbums.length === 0 ? (
            <Empty $tilt={-0.3}>
              <p className="hand">No albums saved. Open any album and hit Save to pin it here. 💿</p>
            </Empty>
          ) : (
            <Grid $min={160}>
              {savedAlbums.map((a) => (
                <AlbumCard key={a.id} onClick={() => go(`/album/${a.id}`)}>
                  <div className="art">
                    {busyAlbum === a.id ? <Spinner /> : <AlbumImage album={a} fallback={a.artBig || a.art} placeholder={<Note size={40} />} loading="lazy" />}
                  </div>
                  <div className="t">{a.title}</div>
                  <div className="a">{a.artist}{a.year ? ` • ${a.year}` : ""}</div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <IconButton onClick={(e) => { e.stopPropagation(); playAlbum(a); }} aria-label="Play album" title="Play">
                      <Play size={18} />
                    </IconButton>
                    <div className="sp" />
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); toggleSaveAlbum(a); }}
                      aria-label="Remove album"
                      title="Remove from library"
                    >
                      <Trash size={18} />
                    </IconButton>
                  </div>
                </AlbumCard>
              ))}
            </Grid>
          )}
        </section>
      )}

      {tab === "artists" && (
        <section>
          <SectionTitle>
            <Mic size={20} /> Followed artists
          </SectionTitle>
          {followed.length === 0 ? (
            <Empty $tilt={0.3}>
              <p className="hand">You're not following anyone yet. Star an artist and they'll show up here. ⭐</p>
            </Empty>
          ) : (
            <Grid $min={180}>
              {followed.map((a) => (
                <ArtistCard key={a.name}>
                  <div className="av">
                    <ArtistImage name={a.name} fallback={a.art} placeholder={<Mic size={40} />} loading="lazy" />
                  </div>
                  <div className="n">{a.name}</div>
                  <div className="a">
                    <SketchButton onClick={() => go(`/artist/${encodeURIComponent(a.name)}`)} style={{ fontSize: 13, padding: "6px 12px" }}>
                      Open
                    </SketchButton>
                    <SketchButton onClick={() => startRadio(a.name)} style={{ fontSize: 13, padding: "6px 12px" }}>
                      <RadioIcon size={15} /> Radio
                    </SketchButton>
                  </div>
                  <IconButton onClick={() => toggleFollow({ name: a.name })} aria-label="Unfollow" title="Unfollow">
                    <Star size={18} filled={isFollowed(a.name)} />
                  </IconButton>
                </ArtistCard>
              ))}
            </Grid>
          )}
        </section>
      )}

      {tab === "downloads" && (
        <section>
          <SectionTitle>
            <Folder size={20} /> Your downloads
          </SectionTitle>

          {downloads.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <SketchButton $variant="accent" onClick={() => playAll(downloads.map((d) => d.track), 0)}>
                  <Play size={18} /> Play offline
                </SketchButton>
                <SketchButton $variant="danger" onClick={clearDownloads}>
                  <Trash size={18} /> Clear downloads
                </SketchButton>
              </div>
              <Panel $tilt={-0.2} style={{ padding: 8, marginBottom: 18 }}>
                {downloads.map((d) => (
                  <LocalRow key={d.id}>
                    <div>
                      <div className="t">{d.track.title}</div>
                      <div className="s">
                        <span>{d.track.artist}</span>
                        <Badge $tone="lossless">{fmtSize(d.size)} · offline</Badge>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      <IconButton
                        onClick={() => playAll(downloads.map((x) => x.track), downloads.findIndex((x) => x.id === d.id))}
                        aria-label="Play"
                        title="Play"
                      >
                        <Play size={18} />
                      </IconButton>
                      <IconButton
                        onClick={() => removeDownload(d.id)}
                        aria-label="Remove download"
                        title="Remove download"
                      >
                        <Trash size={18} />
                      </IconButton>
                    </div>
                  </LocalRow>
                ))}
              </Panel>
            </>
          )}

          <h3 style={{ fontSize: 18, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={18} /> Your files
          </h3>
          <Panel $tilt={-0.3} style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 16, marginTop: 0 }}>
              Drop in your own files — <b>FLAC, ALAC, WAV, AIFF, MP3, M4A, OGG</b> — and they play at full quality
              straight from this browser (kept offline on your device). 🎁
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SketchButton $variant="accent" onClick={() => localRef.current?.click()}>
                <Plus size={18} /> Add audio files
              </SketchButton>
              {localTracks.length > 0 && (
                <>
                  <SketchButton onClick={() => playAll(localTracks, 0)}>
                    <Play size={18} /> Play all
                  </SketchButton>
                  <SketchButton onClick={() => doShufflePlay(localTracks, "Downloads")}>
                    <Shuffle size={18} /> Shuffle
                  </SketchButton>
                  <SketchButton
                    $variant="danger"
                    onClick={() => { clearLocal(); notify("Cleared all local files 🧹"); }}
                  >
                    <Trash size={18} /> Clear all
                  </SketchButton>
                </>
              )}
              <input
                ref={localRef}
                type="file"
                accept="audio/*,.flac,.m4a,.aiff,.alac,.wav,.ogg,.opus"
                multiple
                onChange={(e) => { addLocalFiles(e.target.files); e.target.value = ""; }}
                style={{ display: "none" }}
              />
            </div>
          </Panel>

          {localTracks.length === 0 ? (
            <Empty $tilt={0.3}>
              <p className="hand">No local files yet. Add some and enjoy the crunchy lossless goodness. 🎧</p>
            </Empty>
          ) : (
            <Panel $tilt={-0.2} style={{ padding: 8 }}>
              {localTracks.map((t) => (
                <LocalRow key={t.id}>
                  <div>
                    <div className="t">{t.title}</div>
                    <div className="s">
                      <span>{t.artist}</span>
                      {t.lossless
                        ? <Badge $tone="lossless">{t.format || "lossless"} 💎</Badge>
                        : <Badge>{t.format || "compressed"}</Badge>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <IconButton onClick={() => playAll(localTracks, localTracks.indexOf(t))} aria-label="Play" title="Play">
                      <Play size={18} />
                    </IconButton>
                    <IconButton
                      onClick={() => { removeLocal(t.localId); notify("Removed from downloads 🗑️"); }}
                      aria-label="Remove"
                      title="Remove"
                    >
                      <X size={18} />
                    </IconButton>
                  </div>
                </LocalRow>
              ))}
            </Panel>
          )}
        </section>
      )}

      {tab === "recent" && (
        <section>
          <SectionTitle>
            <Timer size={20} /> Recently played
          </SectionTitle>
          {recent.length === 0 ? (
            <Empty $tilt={-0.3}>
              <p className="hand">Nothing played yet. Go press some buttons! ▶️</p>
            </Empty>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <SketchButton onClick={() => playAll(recent, 0)}>
                  <Play size={18} /> Play history
                </SketchButton>
              </div>
              <Grid>
                {recent.slice(0, 12).map((t) => (
                  <TrackCard key={t.id} track={t} list={recent} />
                ))}
              </Grid>
            </>
          )}
        </section>
      )}

      {tab === "vault" && (
        <section>
          <SectionTitle>
            <Lock size={20} /> The Vault
          </SectionTitle>
          <Panel $tilt={-0.35}>
            <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 17, marginTop: 0 }}>
              Everything lives on <b>your device only</b> — no accounts, no servers, no tracking. Back it up
              or move it to another browser with one file. 🗝️
            </p>

            <StatBox style={{ marginBottom: 16 }}>
              <div className="b">
                <div className="n">{liked.length}</div>
                <div className="l">liked songs</div>
              </div>
              <div className="b">
                <div className="n">{playlists.length}</div>
                <div className="l">playlists</div>
              </div>
              <div className="b">
                <div className="n">{savedAlbums.length}</div>
                <div className="l">albums</div>
              </div>
              <div className="b">
                <div className="n">{Object.keys(stats.plays || {}).length}</div>
                <div className="l">songs played</div>
              </div>
              <div className="b">
                <div className="n">{fmtDur(stats.totalMs)}</div>
                <div className="l">listened</div>
              </div>
            </StatBox>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SketchButton onClick={exportVault}>
                <Download size={18} /> Export vault
              </SketchButton>
              <SketchButton onClick={() => fileRef.current?.click()}>
                <Upload size={18} /> Import vault
              </SketchButton>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                onChange={onImport}
                style={{ display: "none" }}
              />
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}
