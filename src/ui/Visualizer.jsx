import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { engine } from "../audio/engine.js";

const Wrap = styled.div`
  width: 100%;
  height: ${({ $h }) => $h}px;
  display: grid;
  place-items: center;
  overflow: hidden;
`;

/**
 * Live visualizer reading the real analyser when available, and a smooth
 * synthetic animation when the current source bypasses the audio graph.
 */
export default function Visualizer({ style = "bars", height = 190, playing = true, tint }) {
  const ref = useRef(null);
  const raf = useRef(0);
  const phase = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ctx = canvas.getContext("2d");
    let alive = true;

    const resize = () => {
      const w = canvas.clientWidth || 300;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();

    const readColors = () => {
      const cs = getComputedStyle(document.body);
      return {
        a: tint || cs.getPropertyValue("--v-a").trim() || "#7F6119",
        b: cs.getPropertyValue("--v-b").trim() || "#F1C34A",
      };
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const freq = playing ? engine.frequency : null;
      const { a, b } = readColors();
      phase.current += 0.03;

      if (style === "circle") {
        const cx = w / 2;
        const cy = h / 2;
        const base = Math.min(w, h) * 0.22;
        const bars = 72;
        for (let i = 0; i < bars; i++) {
          const t = i / bars;
          let v;
          if (freq) v = freq[Math.floor((i / bars) * (freq.length * 0.55))] / 255;
          else v = (Math.sin(phase.current * 1.6 + i * 0.35) * 0.5 + 0.5) * (playing ? 1 : 0.15);
          const len = base * 0.35 + v * base * 1.25;
          const ang = t * Math.PI * 2;
          const x1 = cx + Math.cos(ang) * base;
          const y1 = cy + Math.sin(ang) * base;
          const x2 = cx + Math.cos(ang) * (base + len);
          const y2 = cy + Math.sin(ang) * (base + len);
          ctx.strokeStyle = i % 2 ? a : b;
          ctx.lineWidth = 4 * dpr;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (style === "wave") {
        const wave = playing ? engine.waveform : null;
        ctx.lineWidth = 3.4 * dpr;
        ctx.lineJoin = "round";
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, a);
        grad.addColorStop(1, b);
        ctx.strokeStyle = grad;
        ctx.beginPath();
        const n = wave ? wave.length : 256;
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * w;
          let y;
          if (wave) y = (wave[i] / 128) * (h / 2);
          else y = h / 2 + Math.sin(i * 0.05 + phase.current * 2) * h * 0.16 * (playing ? 1 : 0.2);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      } else {
        // bars
        const bars = 56;
        const gap = 3 * dpr;
        const bw = (w - gap * (bars - 1)) / bars;
        // One gradient per frame instead of one per bar (~56 allocations/frame).
        const barGrad = ctx.createLinearGradient(0, h, 0, 0);
        barGrad.addColorStop(0, a);
        barGrad.addColorStop(1, b);
        ctx.fillStyle = barGrad;
        for (let i = 0; i < bars; i++) {
          let v;
          if (freq) v = freq[Math.floor((i / bars) * (freq.length * 0.6))] / 255;
          else v = (Math.sin(phase.current * 2 + i * 0.3) * 0.5 + 0.5) * (playing ? 0.9 : 0.12);
          const bh = Math.max(3 * dpr, v * h * 0.92);
          const x = i * (bw + gap);
          const y = h - bh;
          const rad = Math.min(bw / 2, 5 * dpr);
          ctx.beginPath();
          ctx.roundRect?.(x, y, bw, bh, rad);
          if (!ctx.roundRect) ctx.rect(x, y, bw, bh);
          ctx.fill();
        }
      }
    };
    const tick = () => {
      if (!alive) return;
      draw();
      // only spin at 60fps while there is something to animate
      if (playing && !document.hidden) raf.current = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(raf.current);
      if (!alive) return;
      if (!playing || document.hidden) {
        // one calm still frame so the canvas is never blank
        tick();
        return;
      }
      tick();
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (!playing) draw();
    });
    ro.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf.current);
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();
    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [style, height, playing, tint]);

  return <Wrap $h={height}><canvas ref={ref} style={{ width: "100%", height }} /></Wrap>;
}
