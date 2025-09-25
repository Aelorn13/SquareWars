// components/effects/vfx/utils.js

export const getKaboomInstance = (kInstance) => kInstance ?? globalThis.k;

export const getCurrentTime = (k) => k?.time?.() ?? performance.now() / 1000;

/**
 * Robustly checks if a target entity is dead or removed from the scene.
 */
export const isTargetEffectivelyDead = (target) => {
  if (!target || target.dead || target.hidden) return true;
  // A Kaboom obj removed from the scene will have its parent set to null.
  try { if (target.parent == null) return true; } catch {}
  return false;
};

/**
 * Safely retrieves the position of an entity.
 */
export const getSafeEntityPos = (entity) => {
  if (!entity) return null;
  if (entity.pos && typeof entity.pos.x === "number") return entity.pos;
  if (typeof entity.x === "number" && typeof entity.y === "number") return { x: entity.x, y: entity.y };
  return null;
};

/**
 * Caches the original color of a target for tint calculations.
 */
export const ensureOriginalColor = (target) => {
  if (target.originalColor) return;
  if (target.color && "r" in target.color) {
    target.originalColor = [target.color.r, target.color.g, target.color.b];
  } else {
    target.originalColor = [255, 255, 255];
  }
};

/**
 * Computes the base color for an entity, blending towards white at low HP.
 */
export const getHpRatio = (target) => {
  if (!target) return 1;
  const hpNow = (typeof target.hp === "function" ? target.hp() : (target.hp ?? 0));
  const maxHp = (typeof target.maxHp === "function" ? target.maxHp() : (target.maxHp ?? 1));
  if (!Number.isFinite(maxHp) || maxHp <= 0) return 1;
  return Math.max(0.01, Math.min(1, hpNow / maxHp));
};

export const computeBaseColor = (target) => {
  const orig = Array.isArray(target.originalColor) ? target.originalColor : (target.originalColor ?? [255,255,255]);
  const hp = getHpRatio(target);
  const light = [240,240,240];
  return [
    Math.round(orig[0] * hp + light[0] * (1 - hp)),
    Math.round(orig[1] * hp + light[1] * (1 - hp)),
    Math.round(orig[2] * hp + light[2] * (1 - hp)),
  ];
};

/**
 * Safely sets the color of a target entity.
 */
export const setEntityColor = (target, k, rgb) => {
  if (!target || !rgb) return;
  const r = Math.round(Math.max(0, Math.min(255, rgb[0] ?? 0)));
  const g = Math.round(Math.max(0, Math.min(255, rgb[1] ?? 0)));
  const b = Math.round(Math.max(0, Math.min(255, rgb[2] ?? 0)));

  if (target.color && typeof target.color === "object" && "r" in target.color) {
    target.color.r = r; target.color.g = g; target.color.b = b;
    return;
  }
  if (k?.rgb && typeof k.rgb === "function") {
    try { target.color = k.rgb(r, g, b); return; } catch {}
  }
  target.color = { r, g, b };
};

/**
 * Safely destroys a Kaboom game object.
 */
export const safeDestroy = (k, node) => {
    if (node && typeof node.destroy === 'function') {
        try { node.destroy(); } catch {}
    }
};

const _hpCache = new WeakMap();
export const computeBaseColorCached = (target) => {
  const hp = getHpRatio(target);
  const prev = _hpCache.get(target);
  if (prev?.hp === hp && Array.isArray(prev.color)) return prev.color;
  const color = computeBaseColor(target);
  _hpCache.set(target, { hp, color });
  return color;
};

export function _applyOffsetToEntity(k, ent, offset) {
  if (!ent || !offset) return;
  if (Array.isArray(ent)) return ent.forEach(e => _applyOffsetToEntity(k, e, offset));
  try {
    if (typeof ent.move === "function") {
      ent.move(offset.x ?? 0, offset.y ?? 0);
      return;
    }
    if (ent.pos && typeof ent.pos.add === "function") {
      // try to set pos via vector add (best-effort)
      try { ent.pos = ent.pos.add(k.vec2(offset.x ?? 0, offset.y ?? 0)); return; } catch(e){}
    }
    if ("x" in ent && "y" in ent) {
      ent.x = (ent.x ?? 0) + (offset.x ?? 0);
      ent.y = (ent.y ?? 0) + (offset.y ?? 0);
      return;
    }
  } catch (e) { /* ignore */ }
}

export function _randomLocalOffset(k, target, opts = {}) {
  const w = (target.width ?? target.size ?? opts.targetWidth ?? 40);
  const h = (target.height ?? target.size ?? opts.targetHeight ?? w);
  const radius = Math.max(6, Math.min(w, h) * 0.45);
  const ang = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
}

export function _ringOffset(index, total, target, opts = {}) {
  const w = (target.width ?? target.size ?? opts.targetWidth ?? 40);
  const h = (target.height ?? target.size ?? opts.targetHeight ?? w);
  const radius = Math.max(8, Math.min(w, h) * 0.45);
  const ang = (index / Math.max(1, total)) * Math.PI * 2;
  return { x: Math.cos(ang) * radius, y: Math.sin(ang) * radius };
}
