// components/effects/vfx/overlayManager.js
import { getCurrentTime, isTargetEffectivelyDead, getSafeEntityPos, safeDestroy } from './utils.js';
import { destroyAllVfxForTarget } from './index.js'; // We'll need this for the die patch

const activeOverlays = new Set();
let overlayUpdaterStarted = false;

function startOverlayUpdater(k) {
  if (overlayUpdaterStarted) return;
  overlayUpdaterStarted = true;

  k.onUpdate(() => {
    const time = getCurrentTime(k);
    for (const node of activeOverlays) {
      const target = node._follow;

      if (isTargetEffectivelyDead(target) || node._manualRemove) {
        activeOverlays.delete(node);
        safeDestroy(k, node);
        continue;
      }

      const pos = getSafeEntityPos(target);
      if (pos) node._lastPos = pos;
      if (!node._lastPos) continue;

      const { x: offX = 0, y: offY = 0 } = node._off;
      const wobble = Math.sin(time * 8 + node._phase) * 2;
      
      if (typeof node.moveTo === "function") {
        node.moveTo(node._lastPos.x + offX, node._lastPos.y + offY + wobble);
      }

      const baseScale = node._baseScale ?? 1;
      const scale = baseScale * (1 + 0.12 * Math.sin(time * 8 + node._phase));
      if (node.scale) node.scale.x = node.scale.y = scale;
    }
  });
}

export function createOverlay(k, target, opts = {}) {
  if (!target || !k?.add) return null;
  startOverlayUpdater(k);

  for (const existing of activeOverlays) {
    if (existing._follow === target && existing.type === opts.type) {
      existing._refCount = (existing._refCount ?? 1) + 1;
      return existing;
    }
  }

  const initialPos = getSafeEntityPos(target) ?? { x: 0, y: 0 };
  const offsetY = -(target.height ?? 0) * 0.5 - 8;

  const textComp = k.text?.(opts.icon ?? "🔥", { size: opts.size ?? 18 }) ?? {};
let colorArg;
if (Array.isArray(opts.color)) {
  const [r=255,g=140,b=20] = opts.color;
  colorArg = k.color?.(r,g,b) ?? {};
} else {
  const r = opts.color?.r ?? 255;
  const g = opts.color?.g ?? 140;
  const b = opts.color?.b ?? 20;
  colorArg = k.color?.(r,g,b) ?? {};
}
  const originComp = k.origin?.("center") ?? {};
  const zComp = k.z?.(1000) ?? {};

  const node = k.add([
    k.pos(initialPos.x, initialPos.y + offsetY),
    textComp, colorArg, originComp, zComp, "vfx_overlay",
    {
      _follow: target,
      _off: { x: 0, y: offsetY },
      _phase: Math.random() * Math.PI * 2,
      _baseScale: opts.scale ?? 1,
      _lastPos: initialPos,
      _refCount: 1,
      type: opts.type ?? "burn_icon",
    },
  ]);

  activeOverlays.add(node);
  
  try {
    if (typeof target.die === "function" && !target._vfx_diePatched) {
      const origDie = target.die.bind(target);
      target._vfx_diePatched = true;
      target.die = function (...args) {
        // destroyAllVfxForTarget is defined in vfx/index.js
        // We will add it there to avoid circular dependencies.
        k._destroyVfxFor?.(target);
        return origDie(...args);
      };
      // Register a global helper on k to avoid import cycles.
      if (!k._destroyVfxFor) {
          k._destroyVfxFor = (t) => destroyAllVfxForTarget(k, t);
      }
    }
  } catch (e) { /* ignore */ }


  return node;
}

export function destroyOverlay(k, node) {
  if (!node) return;
  node._refCount = Math.max(0, (node._refCount ?? 1) - 1);
  if (node._refCount > 0) return;
  
  activeOverlays.delete(node);
  // Flag for removal in case it's still in the update loop this frame
  node._manualRemove = true; 
  safeDestroy(k, node);
}