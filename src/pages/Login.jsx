import React, { useState } from "react";
import styled, { keyframes } from "styled-components";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "../ui/Logo.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { Panel, SketchButton, Input, Select, Chip } from "../ui/kit.jsx";
import { UserPlus, Lock, User, Sparkle, Mic } from "../ui/Icons.jsx";
import { wobbleBorder } from "../theme.jsx";
import { APP_VERSION_LABEL } from "../lib/appInfo.js";

const float = keyframes`
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: calc(24px + var(--safe-top)) 16px calc(24px + var(--safe-bottom));
  background:
    radial-gradient(90% 70% at 12% 0%, ${({ theme }) => theme.accent}22 0%, transparent 60%),
    radial-gradient(90% 70% at 90% 100%, ${({ theme }) => theme.accent4}22 0%, transparent 60%);
`;

const Box = styled(Panel)`
  width: min(560px, 96vw);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: ${float} 6s ease-in-out infinite;
`;

const ProfileBtn = styled.button`
  appearance: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: ${({ theme }) => theme.surfaceAlt};
  color: inherit;
  ${wobbleBorder(2.6)}
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  cursor: pointer;
  .emoji { font-size: 30px; }
  .n { font-family: "Nunito", system-ui, sans-serif; font-size: 17px; font-weight: 800; }
  .s { font-family: "Nunito", system-ui, sans-serif; font-size: 13px; color: ${({ theme }) => theme.textSoft}; display: block; text-align: left; }
  &:hover { transform: translateY(-3px) rotate(-0.8deg); box-shadow: 5px 6px 0 0 ${({ theme }) => theme.shadow}; }
`;

export default function Login({ onGuest }) {
  const { profiles, current, locked, unlock, createProfile, login, AVATARS } = useAuth();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState(profiles.length ? "pick" : "create");
  const [name, setName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [emoji, setEmoji] = useState(AVATARS[0]);

  const tryUnlock = () => {
    if (unlock(pin)) setErr("");
    else setErr("Nope, that's not it 🤨");
  };

  return (
    <Wrap>
      <Box $tape>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Logo size={28} />
          <ThemeToggle size={22} />
        </div>

        {locked && current ? (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 54 }}>{current.emoji}</div>
              <h1 style={{ margin: "4px 0" }}>Hi {current.name}!</h1>
              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .8 }}>This profile is PIN-locked 🔒</p>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ width: 170 }}>
                <Input
                  type="password" placeholder="PIN" value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                  autoFocus
                />
              </div>
              <SketchButton $variant="accent" onClick={tryUnlock}><Lock size={18} /> Unlock</SketchButton>
            </div>
            {err && <p style={{ textAlign: "center", color: "inherit", fontFamily: '"Nunito", system-ui, sans-serif' }}>{err}</p>}
            <SketchButton onClick={() => login("", "")} style={{ display: "none" }}>.</SketchButton>
          </>
        ) : mode === "pick" ? (
          <>
            <div>
              <h1 style={{ margin: "0 0 2px" }}>Who's listening?</h1>
              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .8, margin: 0 }}>
                Pick a profile — everything stays on this device 🔐
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {profiles.map((p) => (
                <ProfileBtn key={p.id} onClick={() => { const r = login(p.id, ""); if (!r.ok) setErr("PIN required"); }}>
                  <span className="emoji">{p.emoji}</span>
                  <span>
                    <span className="n">{p.name}</span>
                    <span className="s">{p.pin ? "🔒 PIN protected" : "tap to start listening"}</span>
                  </span>
                </ProfileBtn>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SketchButton onClick={() => setMode("create")}><UserPlus size={18} /> New profile</SketchButton>
              <SketchButton onClick={onGuest}><User size={18} /> Continue as guest</SketchButton>
            </div>
            {err && <p style={{ fontFamily: '"Nunito", system-ui, sans-serif' }}>{err}</p>}
          </>
        ) : (
          <>
            <div>
              <h1 style={{ margin: "0 0 2px" }}>Make it yours 👋</h1>
              <p style={{ fontFamily: '"Nunito", system-ui, sans-serif', opacity: .8, margin: 0 }}>
                A profile keeps your likes, playlists and stats separate. No email, no cloud.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Select value={emoji} onChange={(e) => setEmoji(e.target.value)}>
                {AVATARS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div style={{ width: 140 }}>
                <Input placeholder="PIN (optional)" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SketchButton $variant="accent" onClick={() => { createProfile({ name, emoji, pin: newPin }); }}>
                <Sparkle size={18} /> Let's go
              </SketchButton>
              {profiles.length > 0 && <SketchButton onClick={() => setMode("pick")}>Back</SketchButton>}
              <SketchButton onClick={onGuest}><User size={18} /> Skip (guest)</SketchButton>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip><Mic size={13} /> music</Chip>
              <Chip>no ads</Chip>
              <Chip>no tracking</Chip>
              <Chip>100% offline data</Chip>
            </div>
          </>
        )}
        <div style={{ textAlign: "center", fontFamily: '"Nunito", system-ui, sans-serif', fontSize: 11.5, fontWeight: 700, opacity: .55 }}>
          {APP_VERSION_LABEL}
        </div>
      </Box>
    </Wrap>
  );
}
