import styled, { css, keyframes } from "styled-components";
import { wobbleBorder, wobbleBorderAlt } from "../theme.jsx";

/* ------------------------------------------------------------------ */
/*  The shared sketchbook: every control in GRAB IT! is drawn here.    */
/* ------------------------------------------------------------------ */

export const jiggle = keyframes`
  0%,100% { transform: rotate(-0.7deg); }
  50% { transform: rotate(0.7deg); }
`;
export const pop = keyframes`
  0% { transform: scale(.92); }
  60% { transform: scale(1.03); }
  100% { transform: scale(1); }
`;
export const float = keyframes`
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;
export const cardIn = keyframes`
  from { opacity: 0; transform: translateY(16px) rotate(-1.2deg) scale(.97); }
  to { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
`;
export const inkSweep = keyframes`
  from { background-position: 220% 0; }
  to { background-position: -60% 0; }
`;

/* panels: cut-paper cards with a faint sketchbook grain */
export const Panel = styled.div`
  background-color: ${({ theme }) => theme.surface};
  background-image: repeating-linear-gradient(
    -45deg,
    ${({ theme }) =>
      theme.mode === "dark" ? "rgba(255,255,255,.028)" : "rgba(52,46,27,.03)"} 0 1px,
    transparent 1px 11px
  );
  color: ${({ theme }) => theme.text};
  padding: 18px;
  ${wobbleBorder()}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  position: relative;
  transition: transform .2s cubic-bezier(.2,1.2,.4,1), box-shadow .2s ease, background .3s ease;
  ${({ $tilt = 0 }) => ($tilt ? `transform: rotate(${$tilt}deg);` : "")}
  ${({ $tape, theme }) =>
    $tape &&
    css`
      &::before {
        content: "";
        position: absolute;
        top: -12px;
        left: 30px;
        width: 84px;
        height: 22px;
        background: ${theme.mode === "dark"
          ? "rgba(255,255,255,.15)"
          : "rgba(255,255,255,.72)"};
        border: 1.5px solid ${theme.line}22;
        transform: rotate(-4deg);
        box-shadow: 1px 2px 0 ${theme.shadow};
        pointer-events: none;
        z-index: 2;
      }
    `}
  ${({ $lift }) =>
    $lift &&
    css`
      &:hover {
        transform: translateY(-3px) rotate(-.5deg);
        box-shadow: 6px 8px 0 0 ${({ theme }) => theme.shadow};
      }
    `}
`;

export const PanelAlt = styled(Panel)`
  ${wobbleBorderAlt()}
`;

export const SketchButton = styled.button`
  appearance: none;
  position: relative;
  font-family: "Nunito", system-ui, sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: ${({ theme, $variant }) =>
    $variant === "accent" ? theme.onGold : $variant === "danger" ? theme.onInk : theme.text};
  background: ${({ theme, $variant }) =>
    $variant === "accent"
      ? `linear-gradient(140deg, ${theme.accent2}, ${theme.accent3})`
      : $variant === "danger"
        ? `linear-gradient(140deg, ${theme.inkEdge}, ${theme.inkEdge})`
        : `linear-gradient(140deg, ${theme.paperAlt}, ${theme.paper})`};
  padding: 10px 18px;
  ${wobbleBorder()}
  box-shadow: 4px 5px 0 0 ${({ theme }) => theme.shadow};
  display: inline-flex;
  align-items: center;
  gap: 9px;
  transition: transform .16s cubic-bezier(.2,1.2,.4,1), box-shadow .16s ease, background .2s ease;
  white-space: nowrap;

  @media (max-width: 440px) {
    padding: 9px 13px;
    font-size: 14px;
    gap: 6px;
  }

  /* a second dashed pencil outline that appears when you hover */
  &::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 2px dashed ${({ theme }) => theme.accent};
    opacity: 0;
    transform: scale(.96) rotate(.6deg);
    transition: opacity .2s ease, transform .25s cubic-bezier(.2,1.3,.4,1);
    pointer-events: none;
  }

  &:hover {
    transform: translate(-1px, -2px) rotate(-.9deg);
    box-shadow: 6px 8px 0 0 ${({ theme }) => theme.shadow};
    &::after { opacity: .55; transform: scale(1.03) rotate(-.8deg); }
  }
  &:active { transform: translate(2px, 2px) rotate(0); box-shadow: 1px 1px 0 0 ${({ theme }) => theme.shadow}; &::after { opacity: 0; } }
  &:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: 2px 2px 0 0 ${({ theme }) => theme.shadow}; }
`;

export const IconButton = styled.button`
  appearance: none;
  flex: none;
  background: transparent;
  border: none;
  color: ${({ theme, $active }) => ($active ? theme.accent : theme.textSoft)};
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  position: relative;
  transition: transform .18s cubic-bezier(.2,1.3,.4,1), color .2s ease, background .2s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    border: 2px dashed ${({ theme }) => theme.accent};
    opacity: 0;
    transform: scale(.7);
    transition: opacity .18s ease, transform .25s cubic-bezier(.2,1.4,.4,1);
  }

  &:hover {
    color: ${({ theme }) => theme.accent};
    background: ${({ theme }) => theme.surfaceAlt};
    transform: rotate(-7deg) scale(1.08);
    &::before { opacity: .45; transform: scale(1); }
  }
  &:active { transform: scale(.92) rotate(2deg); }
  &:disabled { opacity: .4; cursor: not-allowed; }
  &:disabled::before { display: none; }
`;

export const RoundPlay = styled.button`
  appearance: none;
  width: 58px; height: 58px;
  display: grid; place-items: center;
  color: ${({ theme }) => theme.onGold};
  background: ${({ theme }) => theme.accent2};
  border: 2.6px solid ${({ theme }) => theme.inkEdge};
  border-radius: 50%;
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  position: relative;
  transition: transform .18s cubic-bezier(.2,1.3,.4,1), box-shadow .18s ease;

  &::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px dashed ${({ theme }) => theme.accent};
    opacity: 0;
    transform: scale(.85);
    transition: opacity .2s ease, transform .3s cubic-bezier(.2,1.3,.4,1);
  }

  &:hover {
    transform: rotate(6deg) scale(1.07);
    box-shadow: 5px 7px 0 0 ${({ theme }) => theme.shadow};
    &::after { opacity: .55; transform: scale(1) rotate(12deg); }
  }
  &:active { transform: translate(2px, 2px) scale(.97); box-shadow: 1px 1px 0 0 ${({ theme }) => theme.shadow}; }
`;

export const Chip = styled.span`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  background: ${({ theme }) => theme.chip};
  color: ${({ theme }) => theme.text};
  ${wobbleBorderAlt(2)}
  box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
  transform: rotate(-0.6deg);
  transition: transform .2s cubic-bezier(.2,1.4,.4,1), box-shadow .2s ease;
  &:hover { transform: rotate(.8deg) translateY(-1px); box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow}; }
`;

export const Badge = styled.span`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 11.5px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1.5px solid ${({ theme }) => theme.inkEdge};
  background: ${({ theme, $tone }) =>
    $tone === "lossless" ? theme.accent3 : $tone === "warn" ? theme.accent2 : theme.surfaceAlt};
  color: ${({ theme, $tone }) => ($tone ? theme.onGold : theme.text)};
  white-space: nowrap;
  transition: transform .2s ease;
  &:hover { transform: rotate(-2deg) scale(1.04); }
`;

export const Tag = styled.span`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 13px;
  color: ${({ theme }) => theme.textSoft};
`;

export const Input = styled.input`
  font-family: "Nunito", sans-serif;
  font-size: 16px;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surface};
  padding: 11px 16px;
  width: 100%;
  ${wobbleBorder()}
  outline: none;
  box-shadow: inset 2px 2px 0 0 ${({ theme }) => theme.shadow};
  transition: box-shadow .2s ease, transform .2s ease, border-color .2s ease;
  &::placeholder { color: ${({ theme }) => theme.textSoft}; }
  &:focus {
    box-shadow: inset 2px 2px 0 0 ${({ theme }) => theme.accent};
    transform: rotate(-.4deg);
  }
`;

export const Select = styled.select`
  font-family: "Nunito", sans-serif;
  font-size: 15px;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surface};
  padding: 9px 14px;
  ${wobbleBorder(2.4)}
  outline: none;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease;
  &:hover { transform: translateY(-1px); box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow}; }
`;

export const SectionTitle = styled.h2`
  font-size: 26px;
  margin: 6px 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  &::after {
    content: "";
    flex: 1;
    height: 0;
    border-top: 2.5px dashed ${({ theme }) => theme.accent};
    opacity: .55;
    transform-origin: left center;
    animation: dashGrow .7s .1s cubic-bezier(.2,1,.3,1) both;
  }
  @media (max-width: 900px) {
    font-size: 22px;
    margin: 2px 0 12px;
    gap: 8px;
  }
  @media (max-width: 440px) { font-size: 20px; }
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $min = 165 }) => $min}px, 1fr));
  gap: 16px;

  @media (max-width: 640px) {
    grid-template-columns: repeat(auto-fill, minmax(${({ $min = 165 }) => `min(${$min}px, 43vw)`}, 1fr));
    gap: 12px;
  }

  > * { animation: ${cardIn} .5s cubic-bezier(.2,1.1,.35,1) both; }
  > *:nth-child(1) { animation-delay: .02s; }
  > *:nth-child(2) { animation-delay: .06s; }
  > *:nth-child(3) { animation-delay: .1s; }
  > *:nth-child(4) { animation-delay: .14s; }
  > *:nth-child(5) { animation-delay: .18s; }
  > *:nth-child(6) { animation-delay: .22s; }
  > *:nth-child(7) { animation-delay: .26s; }
  > *:nth-child(8) { animation-delay: .3s; }
  > *:nth-child(9) { animation-delay: .34s; }
  > *:nth-child(10) { animation-delay: .38s; }
  > *:nth-child(n + 11) { animation-delay: .42s; }
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ $gap = 10 }) => $gap}px;
`;

export const Spinner = styled.span`
  width: 18px; height: 18px;
  border: 3px dashed ${({ theme }) => theme.accent};
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export const Skeleton = styled.div`
  position: relative;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
  border-radius: 12px;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 20%, ${({ theme }) => theme.bgAlt} 50%, transparent 80%);
    transform: translateX(-100%);
    animation: shimmer 1.25s infinite linear;
  }
  @keyframes shimmer { to { transform: translateX(100%); } }
`;

/* ---------------- Slider (range) ---------------- */
export const Slider = styled.input.attrs({ type: "range" })`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: ${({ theme }) => theme.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.inkEdge};
  outline: none;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease;

  &:hover { box-shadow: ${({ theme }) => theme.inkShadow}; }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 45% 55% 48% 52% / 52% 46% 54% 48%;
    background: ${({ theme }) => theme.accent2};
    border: 2px solid ${({ theme }) => theme.inkEdge};
    box-shadow: 2px 3px 0 0 ${({ theme }) => theme.shadow};
    cursor: grab;
    transform: rotate(-6deg);
    transition: transform .15s ease;
  }
  &:active::-webkit-slider-thumb { cursor: grabbing; transform: rotate(4deg) scale(1.08); }
  &::-moz-range-thumb {
    width: 20px; height: 20px;
    border-radius: 45% 55% 48% 52% / 52% 46% 54% 48%;
    background: ${({ theme }) => theme.accent2};
    border: 2px solid ${({ theme }) => theme.inkEdge};
  }
`;

/* ---------------- Tabs ---------------- */
export const TabBar = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;

  /* phones: one swipeable row instead of a tall wall of chips */
  @media (max-width: 900px) {
    flex-wrap: nowrap;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    padding: 2px 2px 6px;
    margin-bottom: 14px;
    &::-webkit-scrollbar { display: none; }
    > * { flex: none; scroll-snap-align: start; }
  }
`;
export const Tab = styled.button`
  appearance: none;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 14px;
  padding: 8px 16px;
  color: ${({ theme, $on }) => ($on ? theme.onGold : theme.text)};
  background: ${({ theme, $on }) => ($on ? theme.accent2 : theme.surface)};
  ${wobbleBorder(2.4)}
  box-shadow: ${({ theme, $on }) => ($on ? `2px 3px 0 0 ${theme.shadow}` : "none")};
  transform: rotate(${({ $on }) => ($on ? "-1" : "0.6")}deg);
  cursor: pointer;
  transition: transform .18s cubic-bezier(.2,1.3,.4,1), box-shadow .18s ease, background .2s ease;

  &:hover {
    transform: rotate(-.4deg) translateY(-2px);
    box-shadow: 3px 5px 0 0 ${({ theme }) => theme.shadow};
  }
  &:active { transform: translate(1px, 1px); box-shadow: none; }

  @media (max-width: 900px) {
    padding: 8px 13px;
    font-size: 13.5px;
  }
`;

/* ---------------- Toggle switch ---------------- */
export const Switch = styled.button`
  appearance: none;
  width: 58px; height: 32px;
  flex: none;
  border-radius: 999px;
  border: 2.4px solid ${({ theme }) => theme.inkEdge};
  background: ${({ theme, $on }) => ($on ? theme.accent3 : theme.surfaceAlt)};
  box-shadow: inset 2px 2px 0 0 ${({ theme }) => theme.shadow};
  position: relative;
  cursor: pointer;
  transition: background .25s ease;
  &::after {
    content: "";
    position: absolute;
    top: 1px; left: ${({ $on }) => ($on ? "26px" : "2px")};
    width: 24px; height: 24px;
    border-radius: 48% 52% 46% 54% / 54% 48% 52% 46%;
    background: ${({ theme }) => theme.surface};
    border: 2px solid ${({ theme }) => theme.inkEdge};
    box-shadow: 1px 2px 0 0 ${({ theme }) => theme.shadow};
    transition: left .25s cubic-bezier(.2,1.4,.4,1), transform .25s ease;
  }
  &:hover { background: ${({ theme, $on }) => ($on ? theme.accent3 : theme.bgAlt)}; }
  &:hover::after { transform: rotate(8deg) scale(1.04); }
  &:active::after { transform: scale(.94); }
`;

/* ---------------- Modal ---------------- */
export const ModalScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 70;
  background: ${({ theme }) => theme.line}66;
  display: grid;
  place-items: center;
  padding: 20px;
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  transition: opacity .25s ease;
`;
export const ModalCard = styled(Panel)`
  width: min(520px, 96vw);
  max-height: 86vh;
  overflow-y: auto;
  animation: ${pop} .25s ease both;
`;

export const srOnly = css`
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`;