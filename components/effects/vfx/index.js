// components/effects/vfx/index.js
import { getKaboomInstance } from './utils.js';
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

export function createBurnVfx(k, target, opts = {}) {
  if (!target || ((target.is?.("boss") || target.is?.("miniboss")) && opts.allowBoss === false)) {
    return null;
  }
  const kInstance = getKaboomInstance(k);

  const marker = createTintVfx(kInstance, target, { type: "burn", alpha: 0 });
  const overlay = createOverlay(kInstance, target, { ...opts, type: 'burn_icon' });

  const results = [];
  if (marker) results.push(...marker);
  if (overlay) results.push(overlay);
  return results;
}

export function destroyBurnVfx(k, vfx) {
  if (!vfx) return;
  const kInstance = getKaboomInstance(k);
  
  (Array.isArray(vfx) ? vfx : [vfx]).forEach(item => {
    if (!item) return;
    // CRITICAL FIX: Use the original, robust check.
    // Tint markers have a _restore method, overlays do not.
    if (typeof item._restore === 'function') {
      destroyTint(kInstance, item);
    } else {
      destroyOvl(kInstance, item);
    }
  });
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