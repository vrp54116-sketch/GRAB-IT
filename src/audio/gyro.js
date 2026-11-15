/* ------------------------------------------------------------------ */
/*  Gyro Spatial Head-Tracking                                         */
/*                                                                     */
/*  A tiny deviceorientation bridge for the 8D engine. It keeps the    */
/*  raw alpha/beta/gamma readings, turns them into relative yaw/pitch  */
/*  deltas around a user-defined "front centre", and smooths those     */
/*  deltas with an exponential moving average.                         */
/*                                                                     */
/*  The listener is attached only while it is useful (8D on, gyro      */
/*  toggle on, audio playing) so a paused phone never keeps its motion */
/*  sensor awake.                                                      */
/* ------------------------------------------------------------------ */

/** EMA factor — low enough to kill sensor jitter, high enough to feel live. */
export const GYRO_EMA = 0.15;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Normalise any angle to the open interval (-180, 180]. */
export function wrap180(deg) {
  const d = ((Number(deg) + 180) % 360 + 360) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** Shortest signed rotation from `from` to `to`, safe across the 0/360 seam. */
const shortestDelta = (from, to) => wrap180(to - from);

/** Does this browser expose the DeviceOrientation API at all? */
export function gyroSupported() {
  return typeof window !== "undefined" && typeof window.DeviceOrientationEvent !== "undefined";
}

/** iOS 13+ gates sensors behind a user-gesture permission prompt. */
export function gyroNeedsPermission() {
  return (
    gyroSupported() &&
    typeof window.DeviceOrientationEvent.requestPermission === "function"
  );
}

/** Coarse-pointer / touch detection — desktops get the graceful hint instead. */
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return true;
    if (window.matchMedia?.("(hover: none)")?.matches) return true;
  } catch {
    /* matchMedia can throw in exotic webviews */
  }
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
}

/** True only on a touch device that can actually deliver motion events. */
export function canUseGyroSpatial() {
  return gyroSupported() && isTouchDevice();
}

class GyroSpatialTracker {
  constructor() {
    this.active = false; // deviceorientation listener attached
    this.granted = false; // permission already granted this session
    this.hasData = false; // at least one useful orientation event seen
    this.supported = gyroSupported();
    this.reference = null; // { alpha, beta } at the 0° centre
    this.raw = { alpha: null, beta: null, gamma: null, absolute: false };
    this.yaw = 0; // smoothed relative yaw, degrees (-180..180)
    this.pitch = 0; // smoothed relative pitch, degrees (-90..90)
    this.lastEventAt = 0;
    this._handler = (e) => this._onOrientation(e);
    this._dataWaiter = null;
  }

  /** Snapshot consumed by the engine's rAF loop and by the radar UI. */
  get orientation() {
    return {
      active: this.active,
      hasData: this.hasData,
      yaw: this.yaw,
      pitch: this.pitch,
      // Explicit aliases for the two values the spatial engine cares about.
      deltaYaw: this.yaw,
      deltaPitch: this.pitch,
      lastEventAt: this.lastEventAt,
      raw: { ...this.raw },
    };
  }

  /**
   * Turn tracking on from a user gesture. On iOS this MUST be called
   * directly from the click handler so requestPermission() is allowed.
   * Returns { ok: true } or { ok: false, reason }.
   */
  async enable() {
    if (!gyroSupported()) return { ok: false, reason: "unsupported" };

    if (gyroNeedsPermission()) {
      try {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== "granted") {
          this.granted = false;
          return { ok: false, reason: "denied" };
        }
      } catch {
        this.granted = false;
        return { ok: false, reason: "denied" };
      }
    }
    this.granted = true;

    // The next real reading becomes the new 0° reference centre.
    this.hasData = false;
    this.raw = { alpha: null, beta: null, gamma: null, absolute: false };
    this.reference = null;
    this.yaw = 0;
    this.pitch = 0;

    if (!this._attach()) return { ok: false, reason: "unsupported" };

    // A browser can expose the API but have no sensor behind it. Give the
    // device a moment to produce a reading before claiming success.
    const gotData = await this._waitForData(1200);
    if (!gotData) {
      this.stop();
      return { ok: false, reason: "no-data" };
    }
    return { ok: true };
  }

  /** Resume listening without losing the current centre (e.g. after pause). */
  start() {
    if (!gyroSupported()) return false;
    if (gyroNeedsPermission() && !this.granted) return false;
    return this._attach();
  }

  /** Detach the deviceorientation listener — the battery-saving path. */
  stop() {
    this._detach();
  }

  /** Re-zero the stage at the phone's current physical orientation. */
  recenter() {
    const { alpha, beta } = this.raw;
    if (this.hasData && (alpha != null || beta != null)) {
      this.reference = {
        alpha: alpha == null ? 0 : alpha,
        beta: beta == null ? 0 : beta,
      };
      this.yaw = 0;
      this.pitch = 0;
      return true;
    }
    // No reading yet: the next event after this becomes the reference.
    this.reference = null;
    this.yaw = 0;
    this.pitch = 0;
    return false;
  }

  _attach() {
    if (this.active) return true;
    if (typeof window === "undefined") return false;
    window.addEventListener("deviceorientation", this._handler, true);
    this.active = true;
    return true;
  }

  _detach() {
    if (!this.active) return;
    try {
      window.removeEventListener("deviceorientation", this._handler, true);
    } catch {
      /* ignore */
    }
    this.active = false;
  }

  _waitForData(ms) {
    if (this.hasData) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._dataWaiter = null;
        resolve(false);
      }, ms);
      this._dataWaiter = () => {
        clearTimeout(timer);
        this._dataWaiter = null;
        resolve(true);
      };
    });
  }

  _onOrientation(e) {
    const alpha = Number.isFinite(e.alpha) ? e.alpha : null;
    const beta = Number.isFinite(e.beta) ? e.beta : null;
    const gamma = Number.isFinite(e.gamma) ? e.gamma : null;
    if (alpha == null && beta == null && gamma == null) return;

    this.raw = { alpha, beta, gamma, absolute: !!e.absolute };
    this.hasData = true;
    this.lastEventAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this._dataWaiter) this._dataWaiter();

    // First reading after enabling/recentering defines "straight ahead".
    if (!this.reference) {
      this.reference = {
        alpha: alpha == null ? 0 : alpha,
        beta: beta == null ? 0 : beta,
      };
      this.yaw = 0;
      this.pitch = 0;
      return;
    }

    /*
     * DeviceOrientation alpha follows the right-hand rule around the
     * world-up axis, so turning the phone right makes alpha decrease.
     * We keep the signed delta as-is: the engine uses x = sin(yaw), and
     * because the listener faces -Z, a negative yaw lands on -X (the
     * left ear) — exactly the "fixed stage slides left" behaviour.
     *
     * beta is the front/back tilt. A positive delta lifts the virtual
     * stage upward; the engine clamps the final elevation to a sane arc.
     */
    let yawTarget = this.yaw;
    if (alpha != null) yawTarget = wrap180(alpha - this.reference.alpha);

    let pitchTarget = this.pitch;
    if (beta != null) {
      pitchTarget = clamp(wrap180(beta - this.reference.beta), -90, 90);
    }

    // EMA on the relative angles, with shortest-path math so crossing
    // North (359.9° -> 0.1°) never snaps the sound field around.
    this.yaw = wrap180(this.yaw + shortestDelta(this.yaw, yawTarget) * GYRO_EMA);
    this.pitch = clamp(this.pitch + (pitchTarget - this.pitch) * GYRO_EMA, -90, 90);
  }
}

export const gyroTracker = new GyroSpatialTracker();
