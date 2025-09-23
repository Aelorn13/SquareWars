// visualEffects.js
// Tint + overlay VFX manager — overlays follow reliably and are cleaned up on death.

const activeVfx = new Set();      // tint marker objects
const activeOverlays = new Set(); // overlay nodes
let _vfxUpdaterStarted = false;
let _overlayUpdaterStarted = false;

/* ---------- utilities ---------- */
function _now(k) { return k?.time?.() ?? (typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000); }
function _isTargetDead(t) {
  if (!t) return true;
  if (t.dead || t._isDead || t._destroyed || t._removed || t.hidden) return true;
  // parent == null catches nodes removed from scene even if flags aren't set
  try { if (t.parent == null) return true; } catch {}
  return false;
}
function _getEntityPos(entity) {
  if (!entity) return null;
  try {
    if (typeof entity.pos === "function") {
      const p = entity.pos();
      if (!p) return null;
      if (Array.isArray(p) && p.length >= 2) return { x: p[0], y: p[1] };
      if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
    }
  } catch {}
  if (entity.pos && typeof entity.pos.x === "number" && typeof entity.pos.y === "number") return { x: entity.pos.x, y: entity.pos.y };
  if (typeof entity.x === "number" && typeof entity.y === "number") return { x: entity.x, y: entity.y };
  return null;
}
function _ensureOriginalColor(target) {
  if (Array.isArray(target.originalColor)) return;
  try {
    if (target.color && typeof target.color === "object" && "r" in target.color) {
      target.originalColor = [Math.round(target.color.r), Math.round(target.color.g), Math.round(target.color.b)];
      return;
    }
  } catch {}
  target.originalColor = target.originalColor ?? [255, 255, 255];
}
function _hpRatio(target) {
  const hpNow = (typeof target.hp === "function" ? target.hp() : target.hp) ?? 0;
  return target.maxHp ? Math.max(0.01, hpNow / target.maxHp) : 1;
}
function _computeBaseColor(target) {
  const orig = target.originalColor ?? [255, 255, 255];
  const hp = _hpRatio(target);
  const light = [240, 240, 240];
  return [
    Math.round(orig[0] * hp + light[0] * (1 - hp)),
    Math.round(orig[1] * hp + light[1] * (1 - hp)),
    Math.round(orig[2] * hp + light[2] * (1 - hp)),
  ];
}
function _clampChannel(v) { return Math.round(Math.max(0, Math.min(255, v))); }
function _setColor(target, k, rgb) {
  if (!target) return;
  const [r, g, b] = rgb.map(_clampChannel);
  if (typeof target.color === "function") {
    try { target.color(r, g, b); return; } catch {}
  }
  if (target.color && typeof target.color === "object") {
    try { target.color.r = r; target.color.g = g; target.color.b = b; return; } catch {}
  }
  if (k && typeof k.rgb === "function") {
    try { target.color = k.rgb(r, g, b); return; } catch {}
  }
  target.color = { r, g, b };
}

/* ---------- tint updater ---------- */
function _startVfxUpdater(k) {
  if (_vfxUpdaterStarted) return;
  _vfxUpdaterStarted = true;

  k.onUpdate(() => {
    const t = _now(k);
    const byTarget = new Map();

    for (const fx of Array.from(activeVfx)) {
      const target = fx._follow;
      if (!target || _isTargetDead(target)) { activeVfx.delete(fx); continue; }
      if (!byTarget.has(target)) byTarget.set(target, []);
      byTarget.get(target).push(fx);
    }

    for (const [target, fxs] of byTarget.entries()) {
      _ensureOriginalColor(target);
      const base = _computeBaseColor(target);

      let totalAlpha = 0;
      const overlay = [0, 0, 0];

      for (const fx of fxs) {
        const p = fx._params ?? {};
        let intensity = p.baseIntensity ?? 1;
        if (p.pulse) {
          const freq = p.pulse.freq ?? 6;
          const amp = p.pulse.amp ?? 0.4;
          const baseI = p.pulse.baseline ?? 0.6;
          intensity = baseI + amp * Math.sin(t * freq + (fx._phase ?? 0));
        }
        intensity = Math.max(0, intensity);
        const alpha = Math.max(0, Math.min(1, (p.alpha ?? 0.4) * intensity));
        overlay[0] += (p.color[0] * alpha);
        overlay[1] += (p.color[1] * alpha);
        overlay[2] += (p.color[2] * alpha);
        totalAlpha += alpha;
      }

      totalAlpha = Math.min(1, totalAlpha);
      const result = [
        Math.round(Math.min(255, base[0] * (1 - totalAlpha) + overlay[0])),
        Math.round(Math.min(255, base[1] * (1 - totalAlpha) + overlay[1])),
        Math.round(Math.min(255, base[2] * (1 - totalAlpha) + overlay[2])),
      ];
      _setColor(target, k, result);
    }
  });
}

/* ---------- tint API (ref-counted) ---------- */
function _createTintVfx(k, target, opts = {}) {
  if (!target) return null;
  _startVfxUpdater(k);

  // reuse and ref-count same type
  for (const ex of activeVfx) {
    if (ex._follow === target && ex.type === (opts.type ?? "tint")) {
      ex._refCount = (ex._refCount ?? 1) + 1;
      return [ex];
    }
  }

  const fx = {
    _follow: target,
    type: opts.type ?? "tint",
    _phase: Math.random() * Math.PI * 2,
    _params: {
      color: opts.color ?? [255, 255, 255],
      alpha: opts.alpha ?? 0.4,
      baseIntensity: opts.baseIntensity ?? 1,
      pulse: opts.pulse ?? null,
    },
    _refCount: 1,
    _restored: false,
  };

  fx._restore = (kIns) => {
    fx._refCount = Math.max(0, (fx._refCount ?? 1) - 1);
    if (fx._refCount > 0) return;
    if (fx._restored) return;
    fx._restored = true;
    activeVfx.delete(fx);
    const targetRef = fx._follow;
    const other = Array.from(activeVfx).some(ex => ex._follow === targetRef && ex !== fx);
    if (other) {
      _applyCombinedColorForTarget(kIns ?? globalThis.k, targetRef);
      return;
    }
    _ensureOriginalColor(targetRef);
    const base = _computeBaseColor(targetRef);
    _setColor(targetRef, kIns ?? globalThis.k, base);
  };

  activeVfx.add(fx);
  _applyCombinedColorForTarget(k, target);
  return [fx];
}
function _destroyTintVfx(k, arr) {
  if (!Array.isArray(arr)) return;
  for (const fx of arr) {
    try { if (fx && typeof fx._restore === "function") fx._restore(k); } catch {}
  }
}
function _applyCombinedColorForTarget(k, target) {
  if (!target) return;
  const fxs = Array.from(activeVfx).filter(ex => ex._follow === target);
  if (!fxs.length) {
    _ensureOriginalColor(target);
    _setColor(target, k, _computeBaseColor(target));
    return;
  }
  const t = _now(k);
  _ensureOriginalColor(target);
  const base = _computeBaseColor(target);
  let totalAlpha = 0;
  const overlay = [0, 0, 0];
  for (const fx of fxs) {
    const p = fx._params ?? {};
    let intensity = p.baseIntensity ?? 1;
    if (p.pulse) {
      const freq = p.pulse.freq ?? 6;
      const amp = p.pulse.amp ?? 0.4;
      const baseI = p.pulse.baseline ?? 0.6;
      intensity = baseI + amp * Math.sin(t * freq + (fx._phase ?? 0));
    }
    intensity = Math.max(0, intensity);
    const alpha = Math.max(0, Math.min(1, (p.alpha ?? 0.4) * intensity));
    overlay[0] += p.color[0] * alpha;
    overlay[1] += p.color[1] * alpha;
    overlay[2] += p.color[2] * alpha;
    totalAlpha += alpha;
  }
  totalAlpha = Math.min(1, totalAlpha);
  const result = [
    Math.round(Math.min(255, base[0] * (1 - totalAlpha) + overlay[0])),
    Math.round(Math.min(255, base[1] * (1 - totalAlpha) + overlay[1])),
    Math.round(Math.min(255, base[2] * (1 - totalAlpha) + overlay[2])),
  ];
  _setColor(target, k, result);
}

/* ---------- overlay system (ref-counted) ---------- */
function _startOverlayUpdater(k) {
  if (_overlayUpdaterStarted) return;
  _overlayUpdaterStarted = true;

  k.onUpdate(() => {
    const t = _now(k);
    for (const node of Array.from(activeOverlays)) {
      const target = node._follow;

      // remove if clearly dead/removed or flagged
      if (!target || _isTargetDead(target) || node._manualRemove) {
        activeOverlays.delete(node);
        try { k.destroy?.(node); } catch {}
        continue;
      }

      // get current pos; if missing use last known pos (don't remove immediately)
      let pos = _getEntityPos(target);
      if (!pos) pos = node._lastPos;
      else node._lastPos = pos;

      if (!pos) continue;

      const off = node._off ?? { x: 0, y: - (target.height ?? 0) * 0.5 - 8 };
      const phase = node._phase ?? 0;
      const wobble = Math.sin(t * 8 + phase) * 2;
      const tx = pos.x + off.x;
      const ty = pos.y + off.y + wobble;

      // Prefer moveTo (handles kaboom nodes) else write pos directly if available
      if (typeof node.moveTo === "function") {
        try { node.moveTo(tx, ty); } catch { /* ignore */ }
      } else if (node.pos && typeof node.pos.x === "number") {
        node.pos.x = tx; node.pos.y = ty;
      }

      // flicker scale
      const baseScale = node._baseScale ?? 1;
      const s = baseScale * (1 + 0.12 * Math.sin(t * 8 + phase));
      if (typeof node.scale === "function") {
        try { node.scale(s); } catch {}
      } else if (node.scale && typeof node.scale === "object") {
        try { node.scale.x = s; node.scale.y = s; } catch {}
      }
    }
  });
}

function _createBurnOverlay(k, target, opts = {}) {
  if (!target) return null;
  if (!k?.add) {
    console.warn("visualEffects: kaboom.add not available; burn overlay skipped.");
    return null;
  }
  _startOverlayUpdater(k);

  // reuse existing overlay and increment ref-count
  for (const n of activeOverlays) {
    if (n._follow === target) {
      n._refCount = (n._refCount ?? 1) + 1;
      return n;
    }
  }

  const icon = opts.icon ?? "🔥";
  const size = opts.size ?? 18;
  const baseScale = opts.scale ?? 1;
  const basePos = _getEntityPos(target) ?? { x: 0, y: 0 };

  let node = null;
  try {
    // explicit color + very high z to avoid being occluded
    const colorComp = typeof k.color === "function" ? k.color(255, 140, 20) : {};
    const zComp = typeof k.z === "function" ? k.z(1000) : {};
    node = k.add([
      k.pos(basePos.x, basePos.y - (target.height ?? 0) * 0.5 - 8),
      k.text?.(icon, { size }) ?? {},
      colorComp,
      k.origin?.("center") ?? {},
      zComp,
      "vfx_burn_icon",
      { _follow: target, _off: { x: 0, y: - (target.height ?? 0) * 0.5 - 8 }, _phase: Math.random() * Math.PI * 2, _baseScale: baseScale }
    ]);
    // ensure color set if k.color was not part of add
    if (node && node.color == null && typeof node.patch === "function") {
      try { node.patch?.({ color: { r:255, g:140, b:20 } }); } catch {}
    }
  } catch (e) {
    console.warn("visualEffects: k.add failed creating burn overlay. Falling back to safe node.", e);
    // fallback: create a simple JS object to keep API stable (won't render)
    node = { _follow: target, _off: { x: 0, y: - (target.height ?? 0) * 0.5 - 8 }, _phase: Math.random() * Math.PI * 2, _baseScale: baseScale, _isFake: true };
  }

  node._lastPos = basePos;
  node._manualRemove = false;
  node._refCount = 1;
  activeOverlays.add(node);

  // Ensure overlay removed on target.die()
  try {
    if (typeof target.die === "function" && !target._vfx_diePatched) {
      const origDie = target.die.bind(target);
      target._vfx_diePatched = true;
      target.die = function (...args) {
        try { _destroyAllVfxForTarget(k, target); } catch (e) {}
        return origDie(...args);
      };
    }
  } catch (e) { /* ignore */ }

  return node;
}


function _destroyBurnOverlay(k, node) {
  if (!node) return;
  node._refCount = Math.max(0, (node._refCount ?? 1) - 1);
  if (node._refCount > 0) return;
  activeOverlays.delete(node);
  node._manualRemove = true;
  try { k.destroy?.(node); } catch {}
}

/* ---------- helpers to remove all vfx for a target ---------- */
function _destroyAllVfxForTarget(k, target) {
  if (!target) return;
  // destroy tint vfx
  for (const fx of Array.from(activeVfx)) {
    if (fx._follow === target) {
      try { fx._restore?.(k); } catch {}
    }
  }
  // destroy overlays
  for (const node of Array.from(activeOverlays)) {
    if (node._follow === target) {
      try { _destroyBurnOverlay(k, node); } catch {}
    }
  }
}

/* ---------- public API ---------- */

export function createSlowVfx(k, target, opts = {}) {
  const defaults = {
    type: "slow",
    color: [0, 180, 255],
    alpha: 0.36,
    baseIntensity: 1,
    pulse: { freq: opts.freq ?? 6, amp: 0.6, baseline: 0.6 },
  };
  _startVfxUpdater(k);
  return _createTintVfx(k, target, { ...defaults, ...opts });
}
export function destroySlowVfx(k, vfx) { _destroyTintVfx(k, vfx); }

export function createBurnVfx(k, target, opts = {}) {
  if (!target) return null;
  if ((target.is?.("boss") || target.is?.("miniboss")) && opts.allowBoss === false) return null;

  _startVfxUpdater(k);
  _startOverlayUpdater(k);

  // marker tint (alpha 0). keep so tint system knows burn exists
  const marker = _createTintVfx(k, target, { type: "burn", color: opts.color ?? [255, 140, 20], alpha: 0.0, baseIntensity: 0, pulse: null });

  // create persistent overlay icon. this will always try to create a real node.
  const overlayNode = _createBurnOverlay(k, target, opts);

  const arr = [];
  if (Array.isArray(marker)) arr.push(...marker);
  if (overlayNode) arr.push(overlayNode);
  return arr;
}

export function destroyBurnVfx(k, vfx) {
  if (!vfx) return;
  if (!Array.isArray(vfx)) vfx = [vfx];
  for (const item of vfx) {
    if (!item) continue;
    if (typeof item._restore === "function") {
      try { item._restore(k); } catch {}
    } else {
      try { _destroyBurnOverlay(k, item); } catch {}
    }
  }
}
