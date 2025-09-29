//components/effects/vfx/OverlayManager.js
import { getCurrentTime, isTargetEffectivelyDead, getSafeEntityPos, safeDestroy } from './utils.js';

const activeOverlays = new Set();
let overlayUpdaterStarted = false;

function startOverlayUpdater(k) {
  if (overlayUpdaterStarted) return;
  overlayUpdaterStarted = true;

  k.onUpdate(() => {
    const time = getCurrentTime(k);
    for (const node of Array.from(activeOverlays)) {
      const target = node._follow;

      const nodeExists = typeof node?.exists === "function" ? node.exists() : !!node?.exists;
      const targetDead = isTargetEffectivelyDead(target);

      if (!node || !nodeExists || node._manualRemove || targetDead) {
        activeOverlays.delete(node);
        try { safeDestroy(k, node); } catch (e) {}
        continue;
      }

      const pos = getSafeEntityPos(target);
      if (pos) node._lastPos = pos;
      if (!node._lastPos) continue;

      const { x: offX = 0, y: offY = 0 } = node._off ?? {};
      const wobble = Math.sin(time * 8 + node._phase) * 2;
      const destX = node._lastPos.x + offX;
      const destY = node._lastPos.y + offY + wobble;

      // Prefer direct assignment for reliability
      try {
        if (node.pos && typeof node.pos.x === "number") {
          node.pos.x = destX;
          node.pos.y = destY;
        } else if (typeof node.moveTo === "function") {
          try { node.moveTo(destX, destY); } catch (e) {}
        } else if (typeof node.move === "function") {
          try { node.move(destX - (node._lastPos.x || 0), destY - (node._lastPos.y || 0)); } catch (e) {}
        } else if ("x" in node && "y" in node) {
          try { node.x = destX; node.y = destY; } catch (e) {}
        }
      } catch (e) {}

      const baseScale = node._baseScale ?? 1;
      const scale = baseScale * (1 + 0.12 * Math.sin(time * 8 + node._phase));
      if (node.scale && typeof node.scale.x === "number") {
        try { node.scale.x = node.scale.y = scale; } catch (e) {}
      }

      // === per-instance authoritative cleanup (robust) ===
      try {
        const instId = node._instanceId;
        if (instId && target && target._buffManager && Array.isArray(target._buffManager.buffs)) {
          // avoid premature cleanup for very-new overlays (race with buff registration)
          const age = (time - (node._createdAt ?? 0));
          if (age < 0.06) {
            // skip cleanup this frame; allow buff manager to register
          } else {
            // match either exact buff id or buff id prefix (buffId -> overlayId:index)
            const found = target._buffManager.buffs.some(b => {
              if (!b || !b.id) return false;
              try {
                if (b.id === instId) return true;
                if (typeof instId === "string" && typeof b.id === "string" && instId.startsWith(b.id + ":")) return true;
              } catch (e) {}
              return false;
            });
            if (!found) {
              activeOverlays.delete(node);
              try { safeDestroy(k, node); } catch (e) {}
              continue;
            }
          }
        }
      } catch (e) {
        // ignore cleanup errors
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

    // stamp creation time so updater can avoid premature cleanup races
  try {
    node._createdAt = getCurrentTime(k) ?? (Date.now() / 1000);
  } catch {
    node._createdAt = Date.now() / 1000;
  }

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
