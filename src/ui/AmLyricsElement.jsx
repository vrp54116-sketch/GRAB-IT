import React, { forwardRef } from "react";
import "@uimaxbai/am-lyrics/am-lyrics.js";

/* The bare <am-lyrics> custom element, split into its own chunk so the
   ~310kB lyrics engine only loads when someone opens the lyrics tab. */
const AmLyricsElement = forwardRef(function AmLyricsElement(props, ref) {
  return <am-lyrics ref={ref} {...props} />;
});

export default AmLyricsElement;