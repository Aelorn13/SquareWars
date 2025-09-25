// components/effects/vfx/tintManager.js
import { getCurrentTime, isTargetEffectivelyDead, ensureOriginalColor, computeBaseColorCached, setEntityColor } from './utils.js';

const activeTintVfx = new Set();
let tintUpdaterStarted = false;

function startTintUpdater(k) {
  if (tintUpdaterStarted) return;
  tintUpdaterStarted = true;

  k.onUpdate(() => {
    const time = getCurrentTime(k);
    const vfxByTarget = new Map();

    for (const fx of activeTintVfx) {
      if (isTargetEffectivelyDead(fx._follow)) {
        activeTintVfx.delete(fx);
      } else {
        if (!vfxByTarget.has(fx._follow)) vfxByTarget.set(fx._follow, []);
        vfxByTarget.get(fx._follow).push(fx);
      }
    }

    for (const [target, fxs] of vfxByTarget.entries()) {
      ensureOriginalColor(target);
      const baseColor = computeBaseColorCached(target);
      const overlayColor = [0, 0, 0];
      let totalAlpha = 0;

      for (const fx of fxs) {
        let intensity = fx._params.baseIntensity ?? 1;
        if (fx._params.pulse) {
          const { freq = 6, amp = 0.4, baseline = 0.6 } = fx._params.pulse;
          intensity = baseline + amp * Math.sin(time * freq + (fx._phase ?? 0));
        }
        const alpha = Math.max(0, Math.min(1, (fx._params.alpha ?? 0.4) * intensity));
        // This is the line that was crashing
        overlayColor[0] += fx._params.color[0] * alpha;
        overlayColor[1] += fx._params.color[1] * alpha;
        overlayColor[2] += fx._params.color[2] * alpha;
        totalAlpha += alpha;
      }

      totalAlpha = Math.min(1, totalAlpha);
const finalColor = [
  Math.round(Math.max(0, Math.min(255, baseColor[0] * (1 - totalAlpha) + overlayColor[0]))),
  Math.round(Math.max(0, Math.min(255, baseColor[1] * (1 - totalAlpha) + overlayColor[1]))),
  Math.round(Math.max(0, Math.min(255, baseColor[2] * (1 - totalAlpha) + overlayColor[2]))),
];
      setEntityColor(target, k, finalColor);
    }
  });
}

export function createTintVfx(k, target, opts = {}) {
  if (!target) return null;
  startTintUpdater(k);

  for (const existingFx of activeTintVfx) {
    if (existingFx._follow === target && existingFx.type === opts.type) {
      existingFx._refCount++;
      return [existingFx];
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
    _restore: (kaboom) => {
      fx._refCount--;
      if (fx._refCount <= 0) {
        activeTintVfx.delete(fx);
        const hasOtherVfx = Array.from(activeTintVfx).some(other => other._follow === target);
        if (!hasOtherVfx) {
            ensureOriginalColor(target);
            setEntityColor(target, kaboom, computeBaseColorCached(target));
        }
      }
    },
  };

  activeTintVfx.add(fx);
  return [fx];
}

export function destroyTintVfx(k, fx) {
  if (fx && typeof fx._restore === "function") {
    try { fx._restore(k); } catch {}
  }
}