import React from "react";

/* One hidden SVG holding the "wobbly ink" filters used all over the app. */
export default function SketchDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="sketchy" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.028 0.036"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="sketchy-sm" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.05"
            numOctaves="2"
            seed="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
