// components/effects/utils.js

export const normalize = (v) => {
  if (!v || typeof v.x !== "number" || typeof v.y !== "number")
    return { x: 0, y: 0 };
  const m = Math.hypot(v.x, v.y);
  return m < 1e-6 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};

export const scale = (v, s) => ({ x: (v?.x ?? 0) * s, y: (v?.y ?? 0) * s });
export const add = (a, b) => ({
  x: (a?.x ?? 0) + (b?.x ?? 0),
  y: (a?.y ?? 0) + (b?.y ?? 0),
});
export const subtract = (a, b) => ({
  x: (a?.x ?? 0) - (b?.x ?? 0),
  y: (a?.y ?? 0) - (b?.y ?? 0),
});

// --- General utilities ---
export const getKaboom = (k) => k ?? globalThis.k;
export const isBoss = (ent) => !!(ent?.is?.("boss") || ent?.is?.("miniboss"));

export const genBuffId = (type, ctx = {}) => {
  const srcId =
    ctx.sourceId ??
    ctx.projectile?.id ??
    ctx.source?.id ??
    Math.floor(Math.random() * 1e9);
  const upgrade = ctx.sourceUpgrade ?? "generic";
  return `${type}_${srcId}_${upgrade}`;
};

// Add vector to entity property safely. Keeps Kaboom vec2 when available.
export const addVecToEntity = (entity, vec, k, prop) => {
  if (!entity || !vec) return;
  const cur = entity[prop] ?? { x: 0, y: 0 };
  const curX = typeof cur.x === "number" ? cur.x : 0;
  const curY = typeof cur.y === "number" ? cur.y : 0;
  const nx = curX + (vec.x ?? 0);
  const ny = curY + (vec.y ?? 0);
  entity[prop] = k?.vec2 ? k.vec2(nx, ny) : { x: nx, y: ny };
};

export const setEntityVec = (entity, vec, k, prop) => {
  if (!entity || !vec) return;
  entity[prop] = k?.vec2
    ? k.vec2(vec.x ?? 0, vec.y ?? 0)
    : { x: vec.x ?? 0, y: vec.y ?? 0 };
};

// VFX helper. If a buff system exists use it to track VFX.
export const applyVfxViaBuff = (
  k,
  target,
  buffManager,
  vfxId,
  duration,
  createFn,
  destroyFn
) => {
  const kaboom = getKaboom(k);
  if (buffManager?.applyBuff) {
    buffManager.applyBuff({
      id: vfxId,
      type: `${vfxId}_vfx`,
      duration,
      onApply(b) {
        b._vfx = createFn();
      },
      onRemove(b) {
        try {
          destroyFn(kaboom, b._vfx);
        } catch {}
      },
    });
    return;
  }
  const v = createFn();
  if (!v) return;
  if (kaboom?.wait) kaboom.wait(duration, () => destroyFn(kaboom, v));
  else setTimeout(() => destroyFn(kaboom, v), duration * 1000);
};
