import React from "react";
import styled, { keyframes } from "styled-components";

const sway = keyframes`
  0%,100% { transform: rotate(-1.4deg) translateY(0); }
  50% { transform: rotate(1.1deg) translateY(-2px); }
`;

const wiggle = keyframes`
  0%,100% { transform: rotate(-9deg); }
  50% { transform: rotate(7deg); }
`;

const Wrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.text};
`;

const Wordmark = styled.svg`
  overflow: visible;
  filter: url(#sketchy-sm);
  animation: ${sway} 5.5s ease-in-out infinite;
  transform-origin: left center;
  /* a filtered SVG that sways forever is a hidden phone tax — hold still there */
  @media (max-width: 900px) {
    animation: none;
  }
`;

const Hand = styled.svg`
  overflow: visible;
  color: ${({ theme }) => theme.accent};
  animation: ${wiggle} 2.6s ease-in-out infinite;
  transform-origin: 50% 80%;
  @media (max-width: 900px) {
    animation: none;
  }
`;

export default function Logo({ size = 34, withHand = true, withBang = true }) {
  const h = size * 1.35;
  return (
    <Wrap>
      <Wordmark
        viewBox="0 0 300 62"
        height={h}
        width={(300 / 62) * h}
        role="img"
        aria-label="GRAB IT!"
      >
        <text
          x="2"
          y="44"
          fontFamily='"Nunito", system-ui, sans-serif'
          fontSize="42"
          fill="currentColor"
        >
          GRAB
        </text>
        <text
          x="168"
          y="44"
          fontFamily='"Nunito", system-ui, sans-serif'
          fontSize="42"
          fill="currentColor"
        >
          IT
        </text>
        {withBang && (
          <text
            x="243"
            y="46"
            fontFamily='"Nunito", system-ui, sans-serif'
            fontSize="44"
            fill="currentColor"
            transform="rotate(12 243 46)"
          >
            !
          </text>
        )}
      </Wordmark>
      {withHand && (
        <Hand viewBox="0 0 24 24" height={h * 0.8} width={h * 0.8} fill="none">
          <path
            d="M8.5 11V6.4a1.3 1.3 0 0 1 2.6 0V11M11.1 11V5.2a1.3 1.3 0 0 1 2.6 0V11M13.7 11.2V6.6a1.3 1.3 0 0 1 2.6 0V14c0 3.4-2.2 6-5.6 6-3 0-4.8-1.8-5.4-4.4L4.6 12a1.3 1.3 0 0 1 2.3-1.1l1.6 2.4"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Hand>
      )}
    </Wrap>
  );
}
