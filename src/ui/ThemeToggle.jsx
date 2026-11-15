import React from "react";
import styled from "styled-components";
import { useTheme } from "../theme.jsx";

/* ------------------------------------------------------------------ */
/*  Day / night switch — sketchy sun, clouds, moon and a tiny galaxy.  */
/*  Reads + writes the app theme (see theme.jsx) so it stays in sync   */
/*  with the Settings page toggle and localStorage.                    */
/* ------------------------------------------------------------------ */

const Wrapper = styled.div`
  display: inline-flex;
  flex: none;
  line-height: 0;

  .theme-switch {
    --container-width: 5.625em;
    --container-height: 2.5em;
    --container-radius: 0.38em;
    --container-light-bg: #C79A2E;
    --container-night-bg: #342E1B;
    --circle-container-diameter: 3.375em;
    --sun-moon-diameter: 2.125em;
    --sun-bg: #FFE695;
    --moon-bg: #F6EBCB;
    --spot-color: #C9B98D;
    --circle-container-offset: calc(
      (var(--circle-container-diameter) - var(--container-height)) / 2 * -1
    );
    --stars-color: #FFF6D8;
    --clouds-color: #FFFBEC;
    --back-clouds-color: #EBD9A6;
    --transition: 0.5s cubic-bezier(0, -0.02, 0.4, 1.25);
    --circle-transition: 0.3s cubic-bezier(0, -0.02, 0.35, 1.17);
    display: inline-block;
    position: relative;
  }

  .theme-switch,
  .theme-switch *,
  .theme-switch *::before,
  .theme-switch *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-size: var(--toggle-size);
  }

  .theme-switch__checkbox {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .theme-switch__container {
    width: var(--container-width);
    height: var(--container-height);
    background-color: var(--container-light-bg);
    border-radius: var(--container-radius);
    overflow: hidden;
    cursor: pointer;
    position: relative;
    background-image: linear-gradient(
      to bottom,
      var(--container-light-bg) 0%,
      #A8801F 100%
    );
    transition: all var(--transition);
    box-shadow:
      0 0 0 2.5px ${({ theme }) => theme.line},
      3px 4px 0 2.5px ${({ theme }) => theme.shadow};
    transform: rotate(-0.7deg);
    filter: url(#sketchy);
  }

  .theme-switch__container::before {
    content: "";
    position: absolute;
    z-index: 1;
    inset: 0;
    background-image: repeating-linear-gradient(
      -50deg,
      transparent,
      transparent 7px,
      rgba(255, 255, 255, 0.04) 7px,
      rgba(255, 255, 255, 0.04) 8px
    );
    border-radius: inherit;
    pointer-events: none;
  }

  .theme-switch__checkbox:focus-visible + .theme-switch__container {
    outline: 3px dashed ${({ theme }) => theme.accent};
    outline-offset: 4px;
  }

  .theme-switch__circle-container {
    width: var(--circle-container-diameter);
    height: var(--circle-container-diameter);
    background-color: rgba(255, 255, 255, 0.1);
    position: absolute;
    left: var(--circle-container-offset);
    top: var(--circle-container-offset);
    border-radius: var(--container-radius);
    box-shadow:
      inset 0 0 0 3.375em rgba(255, 255, 255, 0.1),
      inset 0 0 0 3.375em rgba(255, 255, 255, 0.1),
      0 0 0 0.625em rgba(255, 255, 255, 0.1),
      0 0 0 1.25em rgba(255, 255, 255, 0.1);
    display: flex;
    transition: var(--circle-transition);
    pointer-events: none;
  }

  .theme-switch__circle-container::before {
    content: "";
    position: absolute;
    width: calc(var(--circle-container-diameter) + 1.5em);
    height: calc(var(--circle-container-diameter) + 1.5em);
    left: -0.75em;
    top: -0.75em;
    border-radius: 50%;
    background: conic-gradient(
      transparent 0deg,
      transparent 8deg,
      rgba(255, 230, 149, 0.55) 8deg,
      rgba(255, 230, 149, 0.55) 22deg,
      transparent 22deg,
      transparent 53deg,
      rgba(255, 230, 149, 0.55) 53deg,
      rgba(255, 230, 149, 0.55) 67deg,
      transparent 67deg,
      transparent 98deg,
      rgba(255, 230, 149, 0.55) 98deg,
      rgba(255, 230, 149, 0.55) 112deg,
      transparent 112deg,
      transparent 143deg,
      rgba(255, 230, 149, 0.55) 143deg,
      rgba(255, 230, 149, 0.55) 157deg,
      transparent 157deg,
      transparent 188deg,
      rgba(255, 230, 149, 0.55) 188deg,
      rgba(255, 230, 149, 0.55) 202deg,
      transparent 202deg,
      transparent 233deg,
      rgba(255, 230, 149, 0.55) 233deg,
      rgba(255, 230, 149, 0.55) 247deg,
      transparent 247deg,
      transparent 278deg,
      rgba(255, 230, 149, 0.55) 278deg,
      rgba(255, 230, 149, 0.55) 292deg,
      transparent 292deg,
      transparent 323deg,
      rgba(255, 230, 149, 0.55) 323deg,
      rgba(255, 230, 149, 0.55) 337deg,
      transparent 337deg,
      transparent 360deg
    );
    animation: rotateSunRays 14s linear infinite;
    opacity: 1;
    transition: opacity var(--transition);
    pointer-events: none;
    filter: url(#sketchy-sm);
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__circle-container::before {
    opacity: 0;
    animation-play-state: paused;
  }

  @keyframes rotateSunRays {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .theme-switch__sun-moon-container {
    pointer-events: auto;
    position: relative;
    z-index: 2;
    width: var(--sun-moon-diameter);
    height: var(--sun-moon-diameter);
    margin: auto;
    border-radius: var(--container-radius);
    background-color: var(--sun-bg);
    box-shadow:
      0.062em 0.062em 0.062em 0em rgba(254, 255, 239, 0.61) inset,
      0em -0.062em 0.062em 0em #B98C2E inset,
      0.1em 0.13em 0 0.04em ${({ theme }) => theme.line};
    filter: url(#sketchy-sm) drop-shadow(0.062em 0.125em 0.125em rgba(0, 0, 0, 0.25))
      drop-shadow(0em 0.062em 0.125em rgba(0, 0, 0, 0.25));
    overflow: hidden;
    transition: var(--transition);
    transform: scale(1);
  }

  .theme-switch__sun-moon-container:hover {
    transform: scale(1.1) rotate(5deg);
  }

  .theme-switch__moon {
    transform: translateX(100%);
    width: 100%;
    height: 100%;
    background-color: var(--moon-bg);
    border-radius: inherit;
    box-shadow:
      0.062em 0.062em 0.062em 0em rgba(254, 255, 239, 0.61) inset,
      0em -0.062em 0.062em 0em #B9A87C inset;
    transition:
      all var(--transition),
      transform 0.3s ease;
    position: relative;
  }

  .theme-switch__moon:hover {
    transform: rotate(15deg);
  }

  .theme-switch__spot {
    position: absolute;
    top: 0.75em;
    left: 0.312em;
    width: 0.75em;
    height: 0.75em;
    border-radius: var(--container-radius);
    background-color: var(--spot-color);
    box-shadow: 0em 0.0312em 0.062em rgba(0, 0, 0, 0.25) inset;
    transition: background-color 0.3s ease;
    filter: url(#sketchy-sm);
  }

  .theme-switch__spot:nth-of-type(2) {
    width: 0.375em;
    height: 0.375em;
    top: 0.937em;
    left: 1.375em;
  }
  .theme-switch__spot:nth-last-of-type(3) {
    width: 0.25em;
    height: 0.25em;
    top: 0.312em;
    left: 0.812em;
  }
  .theme-switch__moon:hover .theme-switch__spot {
    background-color: #A8925F;
  }

  .theme-switch__clouds {
    width: 1.25em;
    height: 1.25em;
    background-color: var(--clouds-color);
    border-radius: var(--container-radius);
    position: absolute;
    bottom: -0.625em;
    left: 0.312em;
    box-shadow:
      0.937em 0.312em var(--clouds-color),
      -0.312em -0.312em var(--back-clouds-color),
      1.437em 0.375em var(--clouds-color),
      0.5em -0.125em var(--back-clouds-color),
      2.187em 0 var(--clouds-color),
      1.25em -0.062em var(--back-clouds-color),
      2.937em 0.312em var(--clouds-color),
      2em -0.312em var(--back-clouds-color),
      3.625em -0.062em var(--clouds-color),
      2.625em 0em var(--back-clouds-color),
      4.5em -0.312em var(--clouds-color),
      3.375em -0.437em var(--back-clouds-color),
      4.625em -1.75em 0 0.437em var(--clouds-color),
      4em -0.625em var(--back-clouds-color),
      4.125em -2.125em 0 0.437em var(--back-clouds-color);
    transition: 0.5s cubic-bezier(0, -0.02, 0.4, 1.25);
    filter: url(#sketchy-sm);
  }

  .theme-switch__stars-container {
    position: absolute;
    color: var(--stars-color);
    top: -100%;
    left: 0.312em;
    width: 2.75em;
    height: auto;
    transition: var(--transition);
  }

  .theme-switch__checkbox:checked + .theme-switch__container {
    background-color: var(--container-night-bg);
    background-image: linear-gradient(
      to bottom,
      var(--container-night-bg) 0%,
      #241E11 100%
    );
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__circle-container {
    left: calc(
      100% - var(--circle-container-offset) - var(--circle-container-diameter)
    );
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__circle-container:hover {
    left: calc(
      100% - var(--circle-container-offset) - var(--circle-container-diameter) -
        0.187em
    );
  }

  .theme-switch__circle-container:hover {
    left: calc(var(--circle-container-offset) + 0.187em);
  }

  .theme-switch__checkbox:checked + .theme-switch__container .theme-switch__moon {
    transform: translate(0);
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__clouds {
    bottom: -4.062em;
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__stars-container {
    top: 50%;
    transform: translateY(-50%);
  }

  .theme-switch__container:hover .theme-switch__clouds {
    transform: translateX(15px) scale(1.02);
  }

  .theme-switch__sun-moon-container::after {
    content: "";
    position: absolute;
    inset: -5px;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.2) 0%,
      transparent 70%
    );
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .theme-switch__sun-moon-container:hover::after {
    opacity: 1;
  }

  .theme-switch__shooting-star {
    position: absolute;
    width: 2px;
    height: 2px;
    background: #FFF6D8;
    top: 20%;
    left: -10%;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .theme-switch__shooting-star-2 {
    position: absolute;
    width: 1px;
    height: 1px;
    background: #FFF6D8;
    top: 35%;
    left: -10%;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .theme-switch__meteor {
    position: absolute;
    width: 3px;
    height: 3px;
    background: #FFE695;
    border-radius: 50%;
    top: -10%;
    left: 50%;
    opacity: 0;
    filter: blur(1px);
    transition: opacity 0.3s ease;
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__shooting-star {
    animation: shootingStar 2s linear infinite;
    opacity: 1;
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__shooting-star-2 {
    animation: shootingStar 3s linear infinite 1s;
    opacity: 1;
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__meteor {
    animation: meteor 4s linear infinite 2s;
    opacity: 1;
  }

  @keyframes shootingStar {
    0% {
      transform: translateX(0) translateY(0) rotate(45deg);
      opacity: 1;
    }
    100% {
      transform: translateX(150px) translateY(150px) rotate(45deg);
      opacity: 0;
    }
  }

  @keyframes meteor {
    0% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateY(150px) scale(0.3);
      opacity: 0;
    }
  }

  .theme-switch__stars-cluster {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .theme-switch__stars-cluster .star {
    position: absolute;
    width: 2px;
    height: 2px;
    background: #FFF6D8;
    border-radius: 50%;
    box-shadow: 0 0 4px 1px #FFF6D8;
  }

  .theme-switch__stars-cluster .star:nth-child(1) {
    top: 20%;
    left: 20%;
    animation: twinkle 1s infinite ease-in-out;

    animation-play-state: paused;
  }
  .theme-switch__stars-cluster .star:nth-child(2) {
    top: 30%;
    left: 55%;
    animation: twinkle 1s infinite ease-in-out 0.3s;

    animation-play-state: paused;
  }
  .theme-switch__stars-cluster .star:nth-child(3) {
    top: 40%;
    left: 80%;
    animation: twinkle 1s infinite ease-in-out 0.6s;

    animation-play-state: paused;
  }
  .theme-switch__stars-cluster .star:nth-child(4) {
    top: 60%;
    left: 30%;
    animation: twinkle 1s infinite ease-in-out 0.9s;

    animation-play-state: paused;
  }
  .theme-switch__stars-cluster .star:nth-child(5) {
    top: 70%;
    left: 65%;
    animation: twinkle 1s infinite ease-in-out 1.2s;

    animation-play-state: paused;
  }

  .theme-switch__aurora {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(
      90deg,
      rgba(255, 230, 149, 0) 0%,
      rgba(255, 230, 149, 0.22) 25%,
      rgba(241, 195, 74, 0.22) 50%,
      rgba(255, 230, 149, 0.22) 75%,
      rgba(255, 230, 149, 0) 100%
    );
    opacity: 0;
    filter: blur(4px);
    transform: translateY(-100%);
    transition: opacity 0.3s ease;
  }

  .theme-switch__comets {
    position: absolute;
    inset: 0;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .theme-switch__comets .comet {
    position: absolute;
    width: 2px;
    height: 2px;
    background: linear-gradient(90deg, #FFF6D8 0%, transparent 90%);
    border-radius: 50%;
    filter: blur(1px);
  }

  .theme-switch__comets .comet:nth-child(1) {
    top: 30%;
    left: -10%;
    animation: cometMove 4s linear infinite;

    animation-play-state: paused;
  }
  .theme-switch__comets .comet:nth-child(2) {
    top: 50%;
    left: -10%;
    animation: cometMove 6s linear infinite 2s;

    animation-play-state: paused;
  }

  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  @keyframes cometMove {
    0% {
      transform: translateX(0) translateY(0) rotate(-45deg) scale(1);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateX(200px) translateY(200px) rotate(-45deg) scale(0.2);
      opacity: 0;
    }
  }

  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__stars-cluster {
    opacity: 1;
  }
  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__aurora {
    opacity: 1;
    animation: auroraWave 8s linear infinite;
  }
  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__comets {
    opacity: 1;
  }

  /* only spin the nocturnal bits while the switch is actually in night mode */
  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__stars-cluster
    .star,
  .theme-switch__checkbox:checked
    + .theme-switch__container
    .theme-switch__comets
    .comet {
    animation-play-state: running;
  }

  @keyframes auroraWave {
    0% {
      transform: translateY(-100%) translateX(-50%);
    }
    100% {
      transform: translateY(-100%) translateX(50%);
    }
  }

  @media (max-width: 900px) {
    /* tiny screens: keep the art, drop the constant frames */
    .theme-switch__circle-container::before,
    .theme-switch__stars-cluster .star,
    .theme-switch__comets .comet,
    .theme-switch__aurora,
    .theme-switch__shooting-star,
    .theme-switch__shooting-star-2,
    .theme-switch__meteor {
      animation: none !important;
    }
  }
`;

export default function ThemeToggle({ size = 20 }) {
  const { theme, toggle } = useTheme();
  const dark = theme.mode === "dark";

  return (
    <Wrapper style={{ "--toggle-size": `${size}px` }}>
      <label className="theme-switch">
        <input
          className="theme-switch__checkbox"
          type="checkbox"
          role="switch"
          checked={dark}
          onChange={toggle}
          aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
          title={`Switch to ${dark ? "light" : "dark"} mode`}
        />
        <div className="theme-switch__container">
          <div className="theme-switch__clouds" />
          <div className="theme-switch__stars-container">
            <svg fill="none" viewBox="0 0 144 55" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z" clipRule="evenodd" fillRule="evenodd" />
            </svg>
          </div>
          <div className="theme-switch__circle-container">
            <div className="theme-switch__sun-moon-container">
              <div className="theme-switch__moon">
                <div className="theme-switch__spot" />
                <div className="theme-switch__spot" />
                <div className="theme-switch__spot" />
              </div>
            </div>
          </div>
          <div className="theme-switch__shooting-star" />
          <div className="theme-switch__shooting-star-2" />
          <div className="theme-switch__meteor" />
          <div className="theme-switch__stars-cluster">
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
          </div>
          <div className="theme-switch__aurora" />
          <div className="theme-switch__comets">
            <div className="comet" />
            <div className="comet" />
          </div>
        </div>
      </label>
    </Wrapper>
  );
}