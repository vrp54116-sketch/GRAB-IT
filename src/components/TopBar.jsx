import React, { useState } from "react";
import styled from "styled-components";
import { useTheme } from "../theme.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import Logo from "../ui/Logo.jsx";
import { IconButton, SketchButton } from "../ui/kit.jsx";
import { useZen, zenHide } from "../ui/ZenMode.jsx";
import { Search as SearchIcon, Back, Hand } from "../ui/Icons.jsx";

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: calc(14px + var(--safe-top)) 22px 14px;
  background: ${({ theme }) => theme.paper};
  border-bottom: 2.6px dashed ${({ theme }) => theme.line}2e;
  ${zenHide}
  transition: opacity .6s ease;
  @media (max-width: 900px) {
    gap: 8px;
    padding: calc(10px + var(--safe-top)) 14px 10px;
    .bar-spacer { display: none; }
  }
`;

const Form = styled.form`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 560px;
  min-width: 0;
  @media (max-width: 900px) {
    /* Phones get the Spotify layout: search lives in the Search tab, so the
       header stays a slim one-row bar instead of two stacked rows. */
    display: none;
  }
  @media (max-width: 440px) {
    gap: 7px;
    .grab-label { display: none; }
  }
`;

const Field = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 4px 4px 14px;
  background: ${({ theme }) => theme.surface};
  border: 2.4px solid ${({ theme }) => theme.inkEdge};
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  box-shadow: inset 2px 2px 0 0 ${({ theme }) => theme.shadow};
  transition: box-shadow .22s ease, border-color .22s ease, transform .22s cubic-bezier(.2,1.2,.4,1);

  svg { transition: transform .25s cubic-bezier(.2,1.4,.4,1), color .2s ease; }

  &:focus-within {
    transform: rotate(-.45deg);
    border-color: ${({ theme }) => theme.accent};
    box-shadow: inset 2px 2px 0 0 ${({ theme }) => theme.accent}55;
    svg { transform: rotate(-12deg) scale(1.08); color: ${({ theme }) => theme.accent}; }
  }

  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: "Nunito", sans-serif;
    font-weight: 600;
    font-size: 16px;
    color: ${({ theme }) => theme.text};
    padding: 8px 0;
    min-width: 0;
  }
  input::placeholder { color: ${({ theme }) => theme.textSoft}; }
`;

const MobileOnly = styled.div`
  display: none;
  @media (max-width: 900px) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 100%;
    min-width: 0;
  }
`;

export default function TopBar({ page, onSearch, onMenu, onBack }) {
  const { theme } = useTheme();
  const zen = useZen();
  const [q, setQ] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onSearch(q);
  };

  return (
    <Bar $zen={zen}>
      <MobileOnly>
        <IconButton onClick={onMenu} aria-label="Open menu">
          <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </IconButton>
        <Logo size={20} withHand={false} />
        <div style={{ marginLeft: "auto" }} />
        <ThemeToggle size={16} />
      </MobileOnly>

      {page !== "home" && (
        <IconButton onClick={onBack} aria-label="Back" style={{ display: "none" }}>
          <Back />
        </IconButton>
      )}

      <Form onSubmit={submit}>
        <Field>
          <SearchIcon size={19} style={{ color: theme.textSoft }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search songs, artists... try "lo-fi beats"'
            aria-label="Search"
          />
        </Field>
        <SketchButton type="submit" $variant="accent">
          <Hand size={18} /> <span className="grab-label">GRAB</span>
        </SketchButton>
      </Form>

      <div className="bar-spacer" style={{ flex: 1 }} />
    </Bar>
  );
}
