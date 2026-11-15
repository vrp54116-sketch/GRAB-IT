import React from "react";

/* Hand-drawn-ish line icons. Round caps + tiny wobble = doodle feel. */

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const I = ({ children, size = 22, ...rest }) => (
  <svg {...base} width={size} height={size} {...rest} aria-hidden="true">
    {children}
  </svg>
);

export const Play = (p) => (
  <I {...p}>
    <path d="M7 5.2 19 12 7 18.8Z" fill="currentColor" strokeWidth="1.6" />
  </I>
);
export const Pause = (p) => (
  <I {...p}>
    <path d="M8 5.5c.6 0 1 .5 1 1.1v10.8c0 .6-.4 1.1-1 1.1s-1-.5-1-1.1V6.6c0-.6.4-1.1 1-1.1Z" fill="currentColor" strokeWidth="1.4" />
    <path d="M16 5.5c.6 0 1 .5 1 1.1v10.8c0 .6-.4 1.1-1 1.1s-1-.5-1-1.1V6.6c0-.6.4-1.1 1-1.1Z" fill="currentColor" strokeWidth="1.4" />
  </I>
);
export const Next = (p) => (
  <I {...p}>
    <path d="M6 6.5 15 12l-9 5.5Z" fill="currentColor" strokeWidth="1.6" />
    <path d="M18.5 6v12.2" />
  </I>
);
export const Prev = (p) => (
  <I {...p}>
    <path d="M18 6.5 9 12l9 5.5Z" fill="currentColor" strokeWidth="1.6" />
    <path d="M5.5 6v12.2" />
  </I>
);
export const Heart = ({ filled, ...p }) => (
  <I {...p}>
    <path
      d="M12 20s-7.2-4.4-8.7-9C2.2 8 3.6 5 6.6 5c1.9 0 3.1 1 4 2.2C11.5 6 12.7 5 14.6 5c3 0 4.4 3 3.3 6-1.5 4.6-8.7 9-8.7 9Z"
      fill={filled ? "currentColor" : "none"}
    />
  </I>
);
export const Shuffle = (p) => (
  <I {...p}>
    <path d="M3 7h3.5c1.6 0 2.4 1 3.3 2.2M3 17h3.5c3 0 4-8 7-8H17" />
    <path d="M14.5 5.5 17.5 7.5 14.5 9.5" />
    <path d="M14.5 14.5 17.5 16.5 14.5 18.5" />
    <path d="M14 16.5c-.8 0-1.5.5-2 .5" />
  </I>
);
export const Repeat = ({ one, ...p }) => (
  <I {...p}>
    <path d="M4.5 9.5C4.5 7 6.3 5.5 8.5 5.5h7" />
    <path d="M13.5 3.5 16 5.5 13.5 7.5" />
    <path d="M19.5 14.5c0 2.5-1.8 4-4 4h-7" />
    <path d="M10.5 20.5 8 18.5 10.5 16.5" />
    {one && <text x="12" y="14.4" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Nunito">1</text>}
  </I>
);
export const Search = (p) => (
  <I {...p}>
    <circle cx="10.5" cy="10.5" r="5.6" />
    <path d="M15 15.2 20 20" />
  </I>
);
export const Home = (p) => (
  <I {...p}>
    <path d="M4 11 12 4.2 20 11" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </I>
);
export const Library = (p) => (
  <I {...p}>
    <path d="M5 5v14M10 5v14M15.4 5.4l1.6 1.4-3 12.6-1.6-1.4z" />
  </I>
);
export const Radio = (p) => (
  <I {...p}>
    <rect x="4" y="9" width="16" height="11" rx="2.5" />
    <path d="M17 6.5 6.5 9" />
    <circle cx="9" cy="14.5" r="2.4" />
    <path d="M14 12.5h3.5M14 16.5h3.5" />
  </I>
);
export const Podcast = (p) => (
  <I {...p}>
    <circle cx="12" cy="10" r="2.6" />
    <path d="M8.5 17.5c-.6-1.4-.9-2.6-.9-4a4.4 4.4 0 0 1 8.8 0c0 1.4-.3 2.6-.9 4" />
    <path d="M12 12.6V21" />
  </I>
);
export const Plus = (p) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);
export const Volume = ({ level = 1, ...p }) => (
  <I {...p}>
    <path d="M4 9.5v5h3l4 3.5V6L7 9.5Z" fill="currentColor" strokeWidth="1.6" />
    {level > 0.05 && <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />}
    {level > 0.5 && <path d="M16.8 7.5a6.5 6.5 0 0 1 0 9" />}
  </I>
);
export const Mute = (p) => (
  <I {...p}>
    <path d="M4 9.5v5h3l4 3.5V6L7 9.5Z" fill="currentColor" strokeWidth="1.6" />
    <path d="M15 10l4 4M19 10l-4 4" />
  </I>
);
export const Sun = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
  </I>
);
export const Moon = (p) => (
  <I {...p}>
    <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.6 7.6 0 1 0 19 14.5Z" />
  </I>
);
export const Cloud = (p) => (
  <I {...p}>
    <path d="M7.2 18.5h9.6a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.2A3.9 3.9 0 0 0 7.2 18.5Z" />
  </I>
);
export const Rain = (p) => (
  <I {...p}>
    <path d="M7.2 14.8h9.6a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.2A3.9 3.9 0 0 0 7.2 14.8Z" />
    <path d="M8.5 18l-1 2.6M12 18l-1 2.6M15.5 18l-1 2.6" />
  </I>
);
export const Download = (p) => (
  <I {...p}>
    <path d="M12 4v10" />
    <path d="M8 10.5 12 14.5 16 10.5" />
    <path d="M5 19h14" />
  </I>
);
export const Upload = (p) => (
  <I {...p}>
    <path d="M12 16V6" />
    <path d="M8 9.5 12 5.5 16 9.5" />
    <path d="M5 19h14" />
  </I>
);
export const Trash = (p) => (
  <I {...p}>
    <path d="M6 7.5h12M9.5 7.5V5.6h5v1.9" />
    <path d="M7.5 7.5 8.3 19h7.4l.8-11.5" />
  </I>
);
export const Note = (p) => (
  <I {...p}>
    <path d="M9 17.5V6.5l9-1.6v11" />
    <circle cx="6.8" cy="17.8" r="2.4" />
    <circle cx="15.8" cy="16.2" r="2.4" />
  </I>
);
export const Hand = (p) => (
  <I {...p}>
    <path d="M8.5 11V6.4a1.3 1.3 0 0 1 2.6 0V11" />
    <path d="M11.1 11V5.2a1.3 1.3 0 0 1 2.6 0V11" />
    <path d="M13.7 11.2V6.6a1.3 1.3 0 0 1 2.6 0V14c0 3.4-2.2 6-5.6 6-3 0-4.8-1.8-5.4-4.4L4.6 12a1.3 1.3 0 0 1 2.3-1.1l1.6 2.4" />
  </I>
);
export const Dots = (p) => (
  <I {...p}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" />
  </I>
);
export const Back = (p) => (
  <I {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </I>
);
export const Settings = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M5.9 5.9l1.4 1.4M16.7 16.7l1.4 1.4M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4" />
  </I>
);
export const User = (p) => (
  <I {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 19.5c1-3.4 3.7-5.2 7-5.2s6 1.8 7 5.2" />
  </I>
);
export const UserPlus = (p) => (
  <I {...p}>
    <circle cx="10" cy="8.5" r="3.4" />
    <path d="M4 19.5c.9-3.2 3.4-4.9 6.3-4.9 1 0 2 .2 2.8.6" />
    <path d="M17.5 14.5v6M14.5 17.5h6" />
  </I>
);
export const Lock = (p) => (
  <I {...p}>
    <rect x="5.5" y="10.5" width="13" height="9" rx="2.4" />
    <path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3" />
  </I>
);
export const LogOut = (p) => (
  <I {...p}>
    <path d="M14 5.5H7.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2H14" />
    <path d="M12 12h8M17 9l3 3-3 3" />
  </I>
);
export const Trend = (p) => (
  <I {...p}>
    <path d="M4 18.5V6M4 18.5h16" />
    <path d="M7.5 15.5 11 11l3 2.4 4.5-6" />
  </I>
);
export const Palette = (p) => (
  <I {...p}>
    <path d="M12 4a8 8 0 0 0 0 16c1.6 0 2.2-1 1.7-2.1-.6-1.3.3-2.4 1.7-2.4H17a3 3 0 0 0 3-3c0-4.8-3.6-8.5-8-8.5Z" />
    <circle cx="8.4" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.2" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
  </I>
);
export const Timer = (p) => (
  <I {...p}>
    <circle cx="12" cy="13" r="7.2" />
    <path d="M12 9.8V13l2.2 1.6M9.5 3.6h5" />
  </I>
);
export const Equalizer = (p) => (
  <I {...p}>
    <path d="M6 5v6M6 17v2M12 5v2M12 13v6M18 5v9M18 18v-2" />
    <path d="M4 15h4M10 9.5h4M16 16.5h4" />
  </I>
);
export const ListMusic = (p) => (
  <I {...p}>
    <path d="M4 6.5h9M4 11h9M4 15.5h6" />
    <circle cx="16.5" cy="16.5" r="2.6" />
    <path d="M19.1 16.5V6.2" />
  </I>
);
export const ChevronUp = (p) => (<I {...p}><path d="M5.5 15 12 8.5 18.5 15" /></I>);
export const ChevronDown = (p) => (<I {...p}><path d="M5.5 9 12 15.5 18.5 9" /></I>);
export const X = (p) => (<I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>);
export const Check = (p) => (<I {...p}><path d="M5 12.5 9.5 17 19 7" /></I>);
export const Folder = (p) => (
  <I {...p}>
    <path d="M4 7.5a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
  </I>
);
export const Server = (p) => (
  <I {...p}>
    <rect x="4" y="4.5" width="16" height="6" rx="2" />
    <rect x="4" y="13.5" width="16" height="6" rx="2" />
    <path d="M7.5 7.5h.01M7.5 16.5h.01" />
  </I>
);
export const Sparkle = (p) => (
  <I {...p}>
    <path d="M12 3.5c.7 3.4 1.8 4.5 5.2 5.2-3.4.7-4.5 1.8-5.2 5.2-.7-3.4-1.8-4.5-5.2-5.2 3.4-.7 4.5-1.8 5.2-5.2Z" />
    <path d="M18 14.5c.4 1.7.9 2.2 2.6 2.6-1.7.4-2.2.9-2.6 2.6-.4-1.7-.9-2.2-2.6-2.6 1.7-.4 2.2-.9 2.6-2.6Z" />
  </I>
);
export const Infinity = (p) => (
  <I {...p}>
    <path d="M7 9c-2 0-3.4 1.4-3.4 3s1.4 3 3.4 3c2.6 0 3.4-6 6-6 2 0 3.4 1.4 3.4 3s-1.4 3-3.4 3c-2.6 0-3.4-6-6-6Z" />
  </I>
);
export const Star = ({ filled, ...p }) => (
  <I {...p}>
    <path
      d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.3 7 19l.9-5.6-4-3.9 5.6-.8Z"
      fill={filled ? "currentColor" : "none"}
    />
  </I>
);
export const Mic = (p) => (
  <I {...p}>
    <rect x="9" y="3.5" width="6" height="10" rx="3" />
    <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" />
  </I>
);
export const Info = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11v5.4" />
    <circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
  </I>
);
export const Spatial = (p) => (
  <I {...p}>
    <circle cx="12" cy="9.2" r="2.5" />
    <path d="M7.7 16.4c.8-2.6 2.4-4 4.3-4s3.5 1.4 4.3 4" />
    <path d="M3.2 12.4c2.2-4.4 5.4-6.6 8.8-6.6s6.6 2.2 8.8 6.6" />
    <path d="M3.2 12.4c2.2 3.2 5.4 4.8 8.8 4.8s6.6-1.6 8.8-4.8" opacity=".55" />
    <circle cx="20.2" cy="8.6" r="1.25" fill="currentColor" stroke="none" />
  </I>
);
export const Waves = (p) => (
  <I {...p}>
    <path d="M3 8.5c1.9-2.3 3.9-2.3 5.8 0s3.9 2.3 5.8 0 3.9-2.3 5.8 0" />
    <path d="M3 14c1.9-2.3 3.9-2.3 5.8 0s3.9 2.3 5.8 0 3.9-2.3 5.8 0" />
  </I>
);
export const Queue = (p) => (
  <I {...p}>
    <path d="M4 7h11M4 12h11M4 17h7" />
    <path d="M19 9.5v8.2" />
    <circle cx="16.4" cy="18" r="2.6" />
  </I>
);
export const Share = (p) => (
  <I {...p}>
    <circle cx="6.5" cy="12" r="2.6" />
    <circle cx="17.5" cy="6.5" r="2.6" />
    <circle cx="17.5" cy="17.5" r="2.6" />
    <path d="M8.8 10.8 15.2 7.7M8.8 13.2l6.4 3.1" />
  </I>
);
export const Link = (p) => (
  <I {...p}>
    <path d="M10 14a4.2 4.2 0 0 0 5.9 0l2.3-2.3A4.2 4.2 0 0 0 12.3 5.8L11 7" />
    <path d="M14 10a4.2 4.2 0 0 0-5.9 0l-2.3 2.3a4.2 4.2 0 0 0 5.9 5.9L13 17" />
  </I>
);
export const Instagram = (p) => (
  <I {...p}>
    <rect x="4" y="4" width="16" height="16" rx="5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.9" cy="7.1" r="1" fill="currentColor" stroke="none" />
  </I>
);
