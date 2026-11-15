import React from "react";
import styled from "styled-components";
import { go } from "../router.jsx";
import { Home, Search, Sparkle, Library } from "../ui/Icons.jsx";

/* ------------------------------------------------------------------ */
/*  Phone navigation — the Spotify-style bottom tab bar.               */
/*  It sits under the mini player, above the safe-area inset, and only */
/*  renders on narrow screens; desktop keeps the full sidebar.         */
/* ------------------------------------------------------------------ */

const NAV = [
  { id: "home", label: "Home", Icon: Home, path: "/" },
  { id: "search", label: "Search", Icon: Search, path: "/search" },
  { id: "browse", label: "New", Icon: Sparkle, path: "/browse" },
  { id: "library", label: "Library", Icon: Library, path: "/library" },
];

const Bar = styled.nav`
  display: none;

  @media (max-width: 900px) {
    position: fixed;
    z-index: 46;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-items: stretch;
    gap: 2px;
    min-height: calc(56px + var(--safe-bottom));
    padding: 4px 8px calc(4px + var(--safe-bottom));
    background: ${({ theme }) => theme.paper};
    border-top: 2.4px solid ${({ theme }) => theme.inkEdge};
    box-shadow: 0 -3px 0 0 ${({ theme }) => theme.shadow};
  }
`;

const Item = styled.button`
  appearance: none;
  border: none;
  background: transparent;
  color: ${({ theme, $on }) => ($on ? theme.text : theme.textSoft)};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 2px;
  min-width: 0;
  border-radius: 14px;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .01em;
  position: relative;
  transition: color .18s ease, background .18s ease, transform .18s ease;

  svg {
    transition: transform .2s cubic-bezier(.2,1.4,.4,1);
  }

  &::before {
    content: "";
    position: absolute;
    top: 3px;
    width: 18px;
    height: 3px;
    border-radius: 999px;
    background: ${({ theme }) => theme.accent};
    opacity: ${({ $on }) => ($on ? 1 : 0)};
    transform: scaleX(${({ $on }) => ($on ? 1 : 0.2)});
    transition: opacity .18s ease, transform .22s cubic-bezier(.2,1.4,.4,1);
  }

  ${({ $on, theme }) =>
    $on &&
    `
      background: ${theme.surfaceAlt}66;
      svg { transform: translateY(-1px) scale(1.06); color: ${theme.accent}; }
    `}

  &:active svg { transform: scale(.9); }
`;

export default function MobileNav({ page }) {
  return (
    <Bar aria-label="Primary">
      {NAV.map(({ id, label, Icon, path }) => {
        const on = page === id;
        return (
          <Item
            key={id}
            $on={on}
            onClick={() => go(path)}
            aria-current={on ? "page" : undefined}
            aria-label={label}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Item>
        );
      })}
    </Bar>
  );
}
