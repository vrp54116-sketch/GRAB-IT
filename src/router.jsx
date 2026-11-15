import { useEffect, useState } from "react";

/** Tiny hash router — no dependencies. */
export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const path = hash.replace(/^#/, "") || "/";
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { path, parts, name: parts[0] || "home", id: parts[1] || null };
}

export function go(to) {
  const target = to.startsWith("#") ? to : `#${to}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}
