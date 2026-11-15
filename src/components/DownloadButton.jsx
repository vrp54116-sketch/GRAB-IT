import React from "react";
import { usePlayer } from "../player/PlayerContext.jsx";
import { Check, Download } from "../ui/Icons.jsx";
import { IconButton } from "../ui/kit.jsx";

/* One-tap offline save for any track. Shows a check once the bytes are
   tucked into IndexedDB; tapping again removes them. */
export default function DownloadButton({ track, size = 18 }) {
  const { isDownloaded, downloadTrack, removeDownload } = usePlayer();
  const done = isDownloaded(track?.id);

  return (
    <IconButton
      $active={done}
      onClick={(e) => {
        e.stopPropagation();
        if (done) removeDownload(track.id);
        else downloadTrack(track);
      }}
      aria-label={done ? "Remove download" : "Download for offline"}
      title={done ? "Saved offline — tap to remove" : "Download for offline"}
    >
      {done ? <Check size={size} /> : <Download size={size} />}
    </IconButton>
  );
}