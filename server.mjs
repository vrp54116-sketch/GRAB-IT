/* ------------------------------------------------------------------ */
/*  GRAB IT! — one server, two halves                                 */
/*                                                                     */
/*  FRONTEND : the built GRAB IT! UI  (./dist)                        */
/*  BACKEND  : the cloned dropit-backend                              */
/*              - Cloudflare Pages Functions (dropit-backend/functions)*/
/*              - the music API it depends on (tracks.monochrome.st)  */
/*                exposed same-origin under /api/tracks/*             */
/*                                                                     */
/*  Usage:  npm start            (builds dist if missing, then serves) */
/*          node server.mjs      (serve as-is)                        */
/*  Env:    PORT (default 4173), HOST (default 0.0.0.0)               */
/* ------------------------------------------------------------------ */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const BACKEND = path.join(ROOT, "dropit-backend");
const FUNCTIONS = path.join(BACKEND, "functions");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const TRACKS_UPSTREAM = (process.env.TRACKS_API_URL || "https://tracks.monochrome.st").replace(/\/+$/, "");
const TRACKS_PREFIX = "/api/tracks";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

/* ------------------------------ routing ------------------------------ */

/** Turn functions/user/@[username].js into /user/@:username */
function patternForFunction(relPath) {
  const segments = relPath.replace(/\.(js|mjs|ts)$/, "").split(path.sep).filter(Boolean);
  if (segments[segments.length - 1] === "index") segments.pop();
  return (
    "/" +
    segments
      .map((seg) => {
        if (/^\[\[\.\.\..+\]\]$/.test(seg)) return "*";
        if (/^\[\.\.\..+\]$/.test(seg)) return "*";
        if (/^\[.+\]$/.test(seg)) return ":" + seg.slice(1, -1);
        if (seg.includes("[") && seg.includes("]")) return seg.replace(/\[(.+?)\]/g, ":$1");
        return seg;
      })
      .join("/")
  );
}

function routeMatcher(pattern) {
  const keys = [];
  const rx = new RegExp(
    "^" +
      pattern
        .split("/")
        .map((seg) => {
          if (seg === "*") {
            keys.push("rest");
            return "(.*)";
          }
          if (seg.startsWith(":")) {
            keys.push(seg.slice(1));
            return "([^/]+)";
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/") +
      "/?$"
  );
  return (pathname) => {
    const m = rx.exec(pathname);
    if (!m) return null;
    const params = {};
    keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));
    return params;
  };
}

async function collectFunctions(dir, acc = []) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFunctions(full, acc);
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      const rel = path.relative(FUNCTIONS, full);
      const pattern = patternForFunction(rel);
      acc.push({
        rel,
        full,
        pattern,
        match: routeMatcher(pattern),
        // static segments before params, longer patterns first
        score: pattern.includes(":") || pattern.endsWith("*") ? 1 : 2,
        depth: pattern.split("/").length,
      });
    }
  }
  return acc;
}

const routes = (await collectFunctions(FUNCTIONS)).sort(
  (a, b) => b.score - a.score || b.depth - a.depth || a.pattern.localeCompare(b.pattern)
);

const moduleCache = new Map();
async function loadFunction(route) {
  if (!moduleCache.has(route.full)) {
    moduleCache.set(route.full, await import(pathToFileURL(route.full).href));
  }
  return moduleCache.get(route.full);
}

/* ------------------------------ helpers ------------------------------ */

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": buf.length,
    ...headers,
  });
  res.end(buf);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function toWebRequest(req) {
  const origin = `http://${req.headers.host || `localhost:${PORT}`}`;
  const url = new URL(req.url, origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeWebResponse(res, response, method = "GET") {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (["connection", "keep-alive", "transfer-encoding", "content-encoding"].includes(key)) return;
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  if (method === "HEAD" || !response.body) {
    res.end();
    return;
  }
  const stream = Readable.fromWeb(response.body);
  // A browser that pauses/seeks/closes drops the socket: never let that
  // surface as an unhandled 'error' event (it used to take the server down).
  stream.on("error", () => {
    if (!res.writableEnded) res.destroy();
  });
  res.on("close", () => stream.destroy());
  res.on("error", () => stream.destroy());
  stream.pipe(res);
}

/** Stream a file, tolerating clients that disconnect mid-transfer. */
function pipeFile(req, res, file, size, headers) {
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  const stream = fs.createReadStream(file);
  stream.on("error", () => {
    if (!res.writableEnded) res.destroy();
  });
  res.on("close", () => stream.destroy());
  res.on("error", () => stream.destroy());
  stream.pipe(res);
}

/* --------------------------- static frontend --------------------------- */

async function serveStatic(req, res, pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  const target = path.resolve(DIST, rel || "index.html");
  if (!target.startsWith(DIST)) return send(res, 403, "Forbidden");

  let file = target;
  try {
    const stat = await fsp.stat(file);
    if (stat.isDirectory()) file = path.join(file, "index.html");
  } catch {
    file = "";
  }

  if (file) {
    try {
      const stat = await fsp.stat(file);
      const ext = path.extname(file).toLowerCase();
      const immutable = rel.startsWith("assets/");
      pipeFile(req, res, file, stat.size, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
        "Accept-Ranges": "bytes",
      });
      return;
    } catch {
      /* fall through */
    }
  }

  // missing hashed asset -> real 404, everything else -> SPA fallback
  if (path.extname(rel) && !/\.html?$/i.test(rel)) return send(res, 404, "Not found");

  const indexPath = path.join(DIST, "index.html");
  try {
    const html = await fsp.readFile(indexPath);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": html.length,
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : html);
  } catch {
    send(
      res,
      500,
      "dist/index.html is missing — run `npm run build` first (or `npm start`, which builds for you)."
    );
  }
}

/* --------------------- backend: tracks audio/JSON --------------------- */

async function proxyTracks(req, res, pathname, search) {
  const upstreamPath = pathname.slice(TRACKS_PREFIX.length) || "/";
  const upstreamUrl = TRACKS_UPSTREAM + upstreamPath + (search || "");
  const headers = { Accept: req.headers.accept || "*/*", "Accept-Encoding": "identity" };
  if (req.headers.range) headers.Range = req.headers.range;
  if (req.headers["if-range"]) headers["If-Range"] = req.headers["if-range"];

  // Cancel the upstream request as soon as the client goes away (pause, seek,
  // tab closed) — otherwise the body stream errors out and kills the process.
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
    await writeWebResponse(res, upstream, req.method);
  } catch (error) {
    if (controller.signal.aborted || res.writableEnded) return;
    sendJson(res, 502, { error: "backend unreachable", upstream: upstreamUrl, detail: String(error?.message || error) });
  }
}

/* ------------------- backend: Pages Functions routes ------------------- */

async function runFunction(req, res, route, params) {
  const mod = await loadFunction(route);
  const handler = mod.onRequest || mod.onRequestGet || mod.default;
  if (typeof handler !== "function") return send(res, 500, `No handler exported by ${route.rel}`);

  const assetRequest = new Request(new URL("/index.html", `http://${req.headers.host}`));
  const env = {
    ...process.env,
    ASSETS: {
      fetch: async () => {
        try {
          const html = await fsp.readFile(path.join(DIST, "index.html"));
          return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
        } catch {
          return new Response("Frontend build missing (run npm run build).", { status: 500 });
        }
      },
      _assetRequest: assetRequest,
    },
  };

  const context = {
    request: toWebRequest(req),
    params,
    env,
    data: {},
    functionPath: route.pattern,
    next: async () => new Response(null, { status: 404 }),
    waitUntil: () => {},
    passThroughOnException: () => {},
  };

  try {
    const response = await handler(context);
    if (!response) return send(res, 500, `Handler ${route.rel} returned nothing`);
    await writeWebResponse(res, response, req.method);
  } catch (error) {
    console.error(`[backend] ${route.pattern} failed:`, error);
    sendJson(res, 500, { error: "backend function crashed", route: route.pattern, detail: String(error?.message || error) });
  }
}

/* ------------------------------- health ------------------------------- */

async function health(res) {
  let upstream = { ok: false };
  try {
    const probe = await fetch(`${TRACKS_UPSTREAM}/search/tracks?q=health&limit=1`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    upstream = { ok: probe.ok, status: probe.status, url: TRACKS_UPSTREAM };
  } catch (error) {
    upstream = { ok: false, url: TRACKS_UPSTREAM, detail: String(error?.message || error) };
  }

  let frontendBuilt = false;
  try {
    await fsp.access(path.join(DIST, "index.html"));
    frontendBuilt = true;
  } catch {
    frontendBuilt = false;
  }

  sendJson(res, 200, {
    ok: frontendBuilt && upstream.ok,
    frontend: { app: "GRAB IT!", servedFrom: "dist", built: frontendBuilt },
    backend: {
      path: "dropit-backend",
      functions: routes.length,
      musicApi: upstream,
      streamUrlPattern: `${TRACKS_PREFIX}/track/:trackId`,
    },
  });
}

/* ------------------------------- server ------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/api/health") return await health(res);
    if (pathname === TRACKS_PREFIX || pathname.startsWith(TRACKS_PREFIX + "/")) {
      return await proxyTracks(req, res, pathname, url.search);
    }

    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return send(res, 405, "Method not allowed");
    }

    for (const route of routes) {
      const params = route.match(pathname);
      if (params) return await runFunction(req, res, route, params);
    }

    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return await serveStatic(req, res, pathname);
  } catch (error) {
    console.error("[server] unhandled:", error);
    if (!res.headersSent) sendJson(res, 500, { error: String(error?.message || error) });
    else res.end();
  }
});

server.on("clientError", (error, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

/* Last line of defence: a client dropping an audio stream must never take
   the whole app down (that is exactly what used to happen). */
process.on("uncaughtException", (error) => {
  console.error("[server] uncaught:", error?.message || error);
});
process.on("unhandledRejection", (error) => {
  console.error("[server] unhandled:", error?.message || error);
});

server.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`\n  GRAB IT! is up`);
  console.log(`  frontend  ->  http://${shown}:${PORT}   (dist/)`);
  console.log(`  backend   ->  ${routes.length} dropit-backend functions mounted`);
  console.log(`  music api ->  ${TRACKS_PREFIX}/*  =>  ${TRACKS_UPSTREAM}`);
  console.log(`  health    ->  http://${shown}:${PORT}/api/health\n`);
});