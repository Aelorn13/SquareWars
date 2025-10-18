// components/player/autoShoot.js
import { inputState } from "./controls.js";
import { SPOTLIGHT_Z_INDEX } from "../encounter/spotlight.js";
const _state = new WeakMap(); // player -> boolean
const _opts = new WeakMap(); // player -> { range, smoothing }
const DEFAULT_OPTS = { range: Infinity, smoothing: 0 };

function ensureInitialized(player) {
  if (!_state.has(player)) {
    _state.set(player, false);
  }
  if (!_opts.has(player)) {
    _opts.set(player, { ...DEFAULT_OPTS });
  }
  // if disabled ensure no lingering target/firing
  if (!_state.get(player)) {
    if (typeof player.clearAutoAimTarget === "function") player.clearAutoAimTarget();
    else player._autoAimTarget = null;
    player.isShooting = false;
  }
}

function getOpts(player) {
  ensureInitialized(player);
  return _opts.get(player) ?? { ...DEFAULT_OPTS };
}

function isEnabled(player) {
  ensureInitialized(player);
  return _state.get(player) === true;
}

function setEnabled(player, v) {
  ensureInitialized(player);
  _state.set(player, !!v);
  if (!v) {
    if (typeof player.clearAutoAimTarget === "function") player.clearAutoAimTarget();
    else player._autoAimTarget = null;
    player.isShooting = false;
  }
}

// public API
export function enableAutoShoot(player, options = {}) {
  _opts.set(player, {
    range: typeof options.range === "number" ? options.range : DEFAULT_OPTS.range,
    smoothing: typeof options.smoothing === "number" ? options.smoothing : DEFAULT_OPTS.smoothing,
  });
  setEnabled(player, true);
}

export function disableAutoShoot(player) {
  setEnabled(player, false);
  _opts.delete(player);
}

export function toggleAutoShoot(player, options = {}) {
  ensureInitialized(player);
  const next = !_state.get(player);
  if (next) enableAutoShoot(player, options);
  else disableAutoShoot(player);
  return next;
}

/**
 * Call every frame: autoShootTick(k, player, gameState)
 * It will early-return when disabled. Disabled is the default state.
 */
export function autoShootTick(k, player, gameState) {
  if (!player || player.dead) return;

  ensureInitialized(player);
  if (!_state.get(player)) return; // guaranteed disabled by default

  if (gameState?.isPaused || gameState?.isUpgradePanelOpen) {
    player.isShooting = false;
    return;
  }
  const isSpotlightActive = k.get("darknessOverlay").length > 0;
  let enemies;

  if (isSpotlightActive) {
    // During the spotlight encounter, a target is only valid if it's on the visible Z layer.
    enemies = k.get("enemy").filter((e) => e && !e.dead && e.z === SPOTLIGHT_Z_INDEX.VISIBLE);
  } else {
    // Default behavior for all other times (including normal gameplay).
    enemies = k.get("enemy").filter((e) => e && !e.dead);
  }

  if (!enemies.length) {
    if (typeof player.clearAutoAimTarget === "function") player.clearAutoAimTarget();
    else player._autoAimTarget = null;
    player.isShooting = false;
    return;
  }

  // find closest
  let closest = null;
  let minD = Infinity;
  for (const e of enemies) {
    const d = player.pos.dist(e.pos);
    if (d < minD) {
      minD = d;
      closest = e;
    }
  }

  const { range } = getOpts(player);
  if (!closest || minD > range) {
    if (typeof player.clearAutoAimTarget === "function") player.clearAutoAimTarget();
    else player._autoAimTarget = null;
    player.isShooting = false;
    return;
  }

  const targetVec = k.vec2(closest.pos.x, closest.pos.y);
  if (typeof player.setAutoAimTarget === "function") {
    player.setAutoAimTarget(targetVec);
  } else {
    player._autoAimTarget = targetVec;
  }

  try {
    player.rotateTo(closest.pos.angle(player.pos));
  } catch (e) {}
  player.isShooting = true;
  if (typeof player.tryFire === "function") {
    player.tryFire();
  } else if (typeof inputState !== "undefined") {
    inputState.firing = true;
  }
}
