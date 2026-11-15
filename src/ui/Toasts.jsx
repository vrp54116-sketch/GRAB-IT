import React from "react";
import styled, { keyframes } from "styled-components";
import { usePlayer } from "../player/PlayerContext.jsx";
import { wobbleBorderAlt } from "../theme.jsx";

const slide = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const Stack = styled.div`
  position: fixed;
  z-index: 60;
  left: 50%;
  bottom: 118px;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  pointer-events: none;
`;

const Toast = styled.div`
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 16px;
  font-weight: 700;
  background: ${({ theme }) => theme.accent2};
  color: ${({ theme }) => theme.onGold};
  padding: 10px 18px;
  ${wobbleBorderAlt(2.6)}
  box-shadow: 3px 4px 0 0 ${({ theme }) => theme.shadow};
  animation: ${slide} .28s ease both;
  max-width: 78vw;
  text-align: center;
`;

export default function Toasts() {
  const { toasts } = usePlayer();
  return (
    <Stack aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id}>{t.msg}</Toast>
      ))}
    </Stack>
  );
}
