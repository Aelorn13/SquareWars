import { getCurrentTime, isTargetEffectivelyDead, getSafeEntityPos, safeDestroy } from './utils.js';

const activeOverlays = new Set();
let overlayUpdaterStarted = false;
let pauseCheckFn = null;

// Allow setting a pause check function
export function setOverlayPauseCheck(fn) {
  pauseCheckFn = fn;
}

function startOverlayUpdater(k) {
  if (overlayUpdaterStarted) return;
  overlayUpdaterStarted = true;

  k.onUpdate(() => {
    // Skip updates during pause but don't destroy overlays
    if (pauseCheckFn?.()) return;
    
    const time = getCurrentTime(k);
    
    for (const node of Array.from(activeOverlays)) {
      const target = node._follow;
      const nodeExists = typeof node?.exists === "function" ? node.exists() : !!node;
      const targetDead = isTargetEffectivelyDead(target);

      if (!nodeExists || node._manualRemove || targetDead) {
        activeOverlays.delete(node);
        safeDestroy(k, node);
        continue;
      }

      // Update position
      const pos = getSafeEntityPos(target);
      if (pos) {
        node._lastPos = pos;
        const { x: offX = 0, y: offY = 0 } = node._off ?? {};
        const wobble = Math.sin(time * 8 + node._phase) * 2;
        
        if (node.pos) {
          node.pos.x = pos.x + offX;
          node.pos.y = pos.y + offY + wobble;
        }
      }

      // Update scale animation
      const baseScale = node._baseScale ?? 1;
      const scale = baseScale * (1 + 0.12 * Math.sin(time * 8 + node._phase));
      if (node.scale) {
        node.scale.x = node.scale.y = scale;
      }

      // Check if buff still exists (with grace period for new overlays)
      if (node._instanceId && target?._buffManager?.buffs) {
        const age = time - (node._createdAt ?? 0);
        if (age > 0.06) { // Skip very new overlays
          const buffExists = target._buffManager.buffs.some(b => 
            b?.id === node._instanceId || 
            (typeof node._instanceId === "string" && node._instanceId.startsWith(b?.id + ":"))
          );
          
          if (!buffExists) {
            activeOverlays.delete(node);
            safeDestroy(k, node);
          }
        }
      }
    }
  });
}

function destroyAllOverlaysForTarget(k, target) {
  for (const node of Array.from(activeOverlays)) {
    if (node?._follow === target) {
      activeOverlays.delete(node);
      safeDestroy(k, node);
    }
  }
}

export function createOverlay(k, target, opts = {}) {
  if (!target || !k?.add) return null;
  startOverlayUpdater(k);

  // Register destroy helper
  k._destroyVfxFor = k._destroyVfxFor ?? (t => destroyAllOverlaysForTarget(k, t));

  // Check for reuse
  if (!opts.forceNew && !opts.allowMultiple) {
    for (const existing of activeOverlays) {
      if (existing._follow === target && existing.type === opts.type) {
        existing._refCount = (existing._refCount ?? 1) + 1;
        return existing;
      }
    }
  }

  // Create new overlay
  const pos = getSafeEntityPos(target) ?? { x: 0, y: 0 };
  const defaultOffsetY = -(target.height ?? target.size ?? 0) * 0.5 - 8;
  const offset = opts.offset ?? { x: 0, y: defaultOffsetY };

  const node = k.add([
    k.pos(pos.x + offset.x, pos.y + offset.y),
    k.text(opts.icon ?? "🔥", { size: opts.size ?? 18 }),
    k.color(...(opts.color ?? [255, 140, 20])),
    k.origin?.("center") ?? {},
    k.z(1000),
    "vfx_overlay",
    {
      _follow: target,
      _off: offset,
      _phase: Math.random() * Math.PI * 2,
      _baseScale: opts.scale ?? 1,
      _lastPos: pos,
      _refCount: 1,
      type: opts.type ?? "burn_icon",
      _instanceId: opts.instanceId ?? null,
      _createdAt: getCurrentTime(k) ?? Date.now() / 1000,
    },
  ]);

  activeOverlays.add(node);

  // Patch target.die to cleanup overlays
  if (typeof target.die === "function" && !target._vfxDiePatched) {
    const origDie = target.die.bind(target);
    target._vfxDiePatched = true;
    target.die = function(...args) {
      k._destroyVfxFor?.(target);
      return origDie(...args);
    };
  }

  return node;
}

export function destroyOverlay(k, node) {
  if (!node) return;
  
  node._refCount = Math.max(0, (node._refCount ?? 1) - 1);
  if (node._refCount > 0) return;

  activeOverlays.delete(node);
  node._manualRemove = true;
  safeDestroy(k, node);
}