export function fmtTime(ms) {
  if (!ms || Number.isNaN(ms) || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export const nfmt = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;

/**
 * Parse an LRC string into [{ time (ms), text }].
 * Handles [mm:ss.xx] and [mm:ss:xx] plus multiple stamps per line.
 */
export function parseLRC(lrc) {
  if (!lrc) return [];
  const out = [];
  const lines = lrc.split(/\r?\n/);
  const stamp = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const line of lines) {
    const text = line.replace(stamp, "").trim();
    let m;
    stamp.lastIndex = 0;
    while ((m = stamp.exec(line))) {
      const min = +m[1];
      const sec = +m[2];
      let frac = m[3] ? +m[3] : 0;
      if (m[3] && m[3].length === 1) frac *= 100;
      else if (m[3] && m[3].length === 2) frac *= 10;
      else if (m[3] && m[3].length === 3) frac *= 1;
      out.push({ time: min * 60000 + sec * 1000 + frac, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Index of the active lyric line for a given time (ms). */
export function activeLine(lines, ms) {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= ms) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function hashHue(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}
