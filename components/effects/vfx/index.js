// components/effects/vfx/index.js
import { getKaboomInstance, _applyOffsetToEntity, _randomLocalOffset, _ringOffset } from './utils.js';
import { createTintVfx, destroyTintVfx as destroyTint } from './tintManager.js';
import { createOverlay, destroyOverlay as destroyOvl } from './overlayManager.js';

export function createSlowVfx(k, target, opts = {}) {
  const kInstance = getKaboomInstance(k);
  return createTintVfx(kInstance, target, {
    type: "slow",
    color: [0, 180, 255],
    alpha: 0.36,
    pulse: { freq: opts.freq ?? 6, amp: 0.6, baseline: 0.6 },
    ...opts,
  });
}

export function destroySlowVfx(k, vfx) {
  if (!vfx) return;
  (Array.isArray(vfx) ? vfx : [vfx]).forEach(item => destroyTint(getKaboomInstance(k), item));
}

// createBurnVfx: returns overlay node or array of nodes (matching createOverlay behavior)
export function createBurnVfx(k, target, opts = {}) {
  if (!target) return null;
  if ((target.is?.("boss") || target.is?.("miniboss")) && opts.allowBoss === false) return null;

  const kInstance = getKaboomInstance(k);

  // aggregated aura
  if (opts.aggregated) {
    const overlay = createOverlay(kInstance, target, {
      type: "burn_icon",
      icon: opts.icon ?? "🔥",
      size: opts.size ?? opts.visualSize ?? 18,
      allowMultiple: false,
      reuse: true,
      offset: opts.offset ?? null,
    });
    return overlay ? (Array.isArray(overlay) ? overlay : overlay) : null;
  }

  // per-stack overlays: create separate overlay instances
  const count = Number.isFinite(opts.stackCount) ? Math.max(1, Math.floor(opts.stackCount))
               : Number.isFinite(opts.count) ? Math.max(1, Math.floor(opts.count))
               : 1;

  const results = [];
  for (let i = 0; i < count; i++) {
    const off = Array.isArray(opts.offset) ? opts.offset[i] ?? opts.offset[0] : opts.offset ?? null;
    const overlay = createOverlay(kInstance, target, {
      type: "burn_icon",
      icon: opts.icon ?? "🔥",
      size: opts.size ?? opts.visualSize ?? 12,
      forceNew: !!opts.forceNew,
      allowMultiple: !!opts.allowMultiple || !!opts.forceNew,
      offset: off ?? opts.randomSpot ? opts.offset ?? null : null,
      instanceId: opts.instanceId ? `${opts.instanceId}:${i}` : undefined,
    });
    if (overlay) results.push(overlay);
  }

  return results.length ? results : null;
}

export function destroyBurnVfx(k, vfx) {
  if (!vfx) return;
  const kInstance = getKaboomInstance(k);
  const items = Array.isArray(vfx) ? vfx : [vfx];
  for (const item of items) {
    try {
      destroyOverlay(kInstance, item);
    } catch (e) { /* ignore */ }
  }
}

export function destroyAllVfxForTarget(k, target) {
    if (!target) return;
    const kInstance = getKaboomInstance(k);
    if(target._buffManager && target._buffManager.buffs) {
        for (const buff of [...target._buffManager.buffs]) {
            if (buff.type.endsWith("_vfx")) {
                target._buffManager.removeBuff(buff.id);
            }
        }
    }
}

