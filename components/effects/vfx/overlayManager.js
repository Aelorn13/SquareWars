import { getCurrentTime, isTargetEffectivelyDead, getSafeEntityPos, safeDestroy } from './utils.js';

const activeOverlays = new Set();
let overlayUpdaterStarted = false;

function startOverlayUpdater(k) {
  if (overlayUpdaterStarted) return;
  overlayUpdaterStarted = true;

  k.onUpdate(() => {
    const time = getCurrentTime(k);
    // copy to avoid mutation issues while iterating
    for (const node of Array.from(activeOverlays)) {
      const target = node._follow;

      // If node or target is invalid, remove and destroy now.
      if (!node || !node.exists || node._manualRemove || isTargetEffectivelyDead(target)) {
        activeOverlays.delete(node);
        try { safeDestroy(k, node); } catch (e) {}
        continue;
      }

      const pos = getSafeEntityPos(target);
      if (pos) node._lastPos = pos;
      if (!node._lastPos) continue;

      const { x: offX = 0, y: offY = 0 } = node._off ?? {};
      const wobble = Math.sin(time * 8 + node._phase) * 2;

      if (typeof node.moveTo === "function") {
        try { node.moveTo(node._lastPos.x + offX, node._lastPos.y + offY + wobble); } catch (e) {}
      } else if (typeof node.move === "function") {
        try { node.move(node._lastPos.x + offX - (node._lastPos.x || 0), node._lastPos.y + offY + wobble - (node._lastPos.y || 0)); } catch (e) {}
      } else {
        // best-effort fallback
        try {
          if (node.pos && typeof node.pos.x === "number") {
            node.pos.x = node._lastPos.x + offX;
            node.pos.y = node._lastPos.y + offY + wobble;
          } else if ("x" in node && "y" in node) {
            node.x = node._lastPos.x + offX;
            node.y = node._lastPos.y + offY + wobble;
          }
        } catch (e) {}
      }

      const baseScale = node._baseScale ?? 1;
      const scale = baseScale * (1 + 0.12 * Math.sin(time * 8 + node._phase));
      if (node.scale) {
        try { node.scale.x = node.scale.y = scale; } catch (e) {}
      }
    }
  });
}

/**
 * Destroy all overlays that follow a specific target.
 * Exposed on k as _destroyVfxFor for immediate use from target.die.
 */
function _destroyAllOverlaysForTarget(k, target) {
  for (const node of Array.from(activeOverlays)) {
    if (!node) continue;
    if (node._follow === target) {
      activeOverlays.delete(node);
      try { safeDestroy(k, node); } catch (e) {}
    }
  }
}

export function createOverlay(k, target, opts = {}) {
  if (!target || !k?.add) return null;
  startOverlayUpdater(k);

  // register global destroy helper on k so other modules can call it
  if (!k._destroyVfxFor) k._destroyVfxFor = (t) => _destroyAllOverlaysForTarget(k, t);

  // reuse rules
  const preferReuse = opts.reuse !== false && !opts.forceNew && !opts.instanceId && !opts.allowMultiple;

  if (preferReuse) {
    for (const existing of activeOverlays) {
      if (existing._follow === target && existing.type === opts.type) {
        existing._refCount = (existing._refCount ?? 1) + 1;
        return existing;
      }
    }
  } else if (opts.instanceId) {
    for (const existing of activeOverlays) {
      if (existing._follow === target && existing._instanceId === opts.instanceId && existing.type === opts.type) {
        existing._refCount = (existing._refCount ?? 1) + 1;
        return existing;
      }
    }
  }

  const initialPos = getSafeEntityPos(target) ?? { x: 0, y: 0 };
  const defaultOffsetY = -(target.height ?? target.size ?? 0) * 0.5 - 8;
  const providedOffset = opts.offset && typeof opts.offset === 'object' ? { x: opts.offset.x ?? 0, y: opts.offset.y ?? 0 } : null;
  const nodeOffset = { x: providedOffset?.x ?? 0, y: providedOffset?.y ?? defaultOffsetY };

  const textComp = k.text?.(opts.icon ?? "🔥", { size: opts.size ?? 18 }) ?? {};
  let colorArg;
  if (Array.isArray(opts.color)) {
    const [r = 255, g = 140, b = 20] = opts.color;
    colorArg = k.color?.(r, g, b) ?? {};
  } else {
    const r = opts.color?.r ?? 255;
    const g = opts.color?.g ?? 140;
    const b = opts.color?.b ?? 20;
    colorArg = k.color?.(r, g, b) ?? {};
  }
  const originComp = k.origin?.("center") ?? {};
  const zComp = k.z?.(1000) ?? {};

  const node = k.add([
    k.pos(initialPos.x, initialPos.y + nodeOffset.y),
    textComp, colorArg, originComp, zComp, "vfx_overlay",
    {
      _follow: target,
      _off: nodeOffset,
      _phase: Math.random() * Math.PI * 2,
      _baseScale: opts.scale ?? 1,
      _lastPos: initialPos,
      _refCount: 1,
      type: opts.type ?? "burn_icon",
      _instanceId: opts.instanceId ?? null,
    },
  ]);

  activeOverlays.add(node);

  // patch die to clear overlays immediately (only patch once)
  try {
    if (typeof target.die === "function" && !target._vfx_diePatched) {
      const origDie = target.die.bind(target);
      target._vfx_diePatched = true;
      target.die = function (...args) {
        try { k._destroyVfxFor?.(target); } catch (e) {}
        return origDie(...args);
      };
    }
  } catch (e) { /* ignore */ }

  return node;
}

export function destroyOverlay(k, node) {
  if (!node) return;
  node._refCount = Math.max(0, (node._refCount ?? 1) - 1);
  if (node._refCount > 0) return;

  activeOverlays.delete(node);
  node._manualRemove = true;
  try { safeDestroy(k, node); } catch (e) {}
}
