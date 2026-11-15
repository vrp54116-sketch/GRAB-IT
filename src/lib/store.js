/* Tiny, safe localStorage helper with a namespace. */

const NS = "grabit:";

export function get(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch {
    /* ignore */
  }
}

export function keys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function wipe() {
  keys().forEach(remove);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
