import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* The dropit-backend music API. In production `npm start` serves the built
   UI and proxies /api/tracks/* itself (see server.mjs); in dev, vite
   forwards the same paths so the frontend code never has to change. */
const BACKEND = process.env.TRACKS_API_URL || "https://tracks.monochrome.st";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api/tracks": {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/tracks/, ""),
      },
    },
  },
});
