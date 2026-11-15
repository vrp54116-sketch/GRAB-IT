import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { get, set, uid } from "../lib/store.js";

/**
 * Device-local profiles. There is no server and no cloud: a "profile" is just a
 * named, optionally PIN-locked space on THIS device. Honest + private.
 * The PIN is a light gate, not real security — it never leaves the browser.
 */

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const KEY = "profiles";
const CURRENT = "currentProfile";

const AVATARS = ["🐣", "🦊", "🐙", "🐸", "🦄", "🐯", "🐼", "🦉", "🐵", "🐧", "🐨", "🐳"];

export function AuthProvider({ children }) {
  const [profiles, setProfiles] = useState(() => get(KEY, []));
  const [currentId, setCurrentId] = useState(() => get(CURRENT, null));
  const [locked, setLocked] = useState(false);

  useEffect(() => set(KEY, profiles), [profiles]);
  useEffect(() => set(CURRENT, currentId), [currentId]);

  const current = useMemo(
    () => profiles.find((p) => p.id === currentId) || null,
    [profiles, currentId]
  );

  useEffect(() => {
    setLocked(!!(current && current.pin));
  }, [current]);

  const createProfile = useCallback(
    ({ name, emoji, pin }) => {
      const clean = (name || "").trim() || "Groovy Human";
      const p = {
        id: uid(),
        name: clean,
        emoji: emoji || AVATARS[Math.floor(Math.random() * AVATARS.length)],
        pin: (pin || "").trim() || "",
        createdAt: Date.now(),
      };
      setProfiles((prev) => [...prev, p]);
      setCurrentId(p.id);
      setLocked(false);
      return p;
    },
    []
  );

  const login = useCallback(
    (id, pin = "") => {
      const p = profiles.find((x) => x.id === id);
      if (!p) return { ok: false, reason: "No such profile" };
      if (p.pin && p.pin !== pin) return { ok: false, reason: "Wrong PIN" };
      setCurrentId(id);
      setLocked(false);
      return { ok: true };
    },
    [profiles]
  );

  const logout = useCallback(() => {
    setCurrentId(null);
  }, []);

  const unlock = useCallback(
    (pin) => {
      if (!current) return false;
      if (!current.pin || current.pin === pin) {
        setLocked(false);
        return true;
      }
      return false;
    },
    [current]
  );

  const removeProfile = useCallback(
    (id) => {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (id === currentId) setCurrentId(null);
    },
    [currentId]
  );

  const updateProfile = useCallback((patch) => {
    setProfiles((prev) => prev.map((p) => (p.id === patch.id ? { ...p, ...patch } : p)));
  }, []);

  const value = useMemo(
    () => ({
      profiles,
      current,
      currentId,
      locked,
      AVATARS,
      createProfile,
      login,
      logout,
      unlock,
      removeProfile,
      updateProfile,
    }),
    [profiles, current, currentId, locked, createProfile, login, logout, unlock, removeProfile, updateProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
