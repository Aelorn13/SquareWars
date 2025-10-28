//components/effects/vfx/overlayManager.js
import { getCurrentTime, isTargetEffectivelyDead, getSafeEntityPos, safeDestroy } from "./utils.js";

const activeOverlays = new Set();
let overlayUpdaterStarted = false;
let currentUpdater = null; // Track the active updater

/**
 * Clean up all overlays and stop the updater
 * Call this when transitioning between game scenes
 */
export function cleanupAllOverlays(k) {
  // Stop the updater
  if (currentUpdater && typeof currentUpdater.cancel === "function") {
    currentUpdater.cancel();
  }
  currentUpdater = null;
  overlayUpdaterStarted = false;

  // Destroy all active overlays
  for (const node of Array.from(activeOverlays)) {
    try {
      safeDestroy(k, node);
    } catch (e) {}
  }
  activeOverlays.clear();

  console.log("[overlayManager] Cleaned up all overlays");
}

function startOverlayUpdater(k) {
  // If already running, don't start another
  if (overlayUpdaterStarted && currentUpdater) return;

  // Clean up any stale state first
  if (overlayUpdaterStarted && !currentUpdater) {
    console.log("[overlayManager] Detected stale updater state, resetting...");
    overlayUpdaterStarted = false;
    activeOverlays.clear();
  }

  overlayUpdaterStarted = true;

  // Store the updater so we can cancel it later
  currentUpdater = k.onUpdate(() => {
    const time = getCurrentTime(k);

    for (const node of Array.from(activeOverlays)) {
      const target = node._follow;

      const nodeExists = typeof node?.exists === "function" ? node.exists() : !!node?.exists;
      const targetDead = isTargetEffectivelyDead(target);

      // Remove dead or invalid overlays
      if (!node || !nodeExists || node._manualRemove || targetDead) {
        activeOverlays.delete(node);
        try {
          safeDestroy(k, node);
        } catch (e) {}
        continue;
      }

      // Update position
      const pos = getSafeEntityPos(target);
      if (pos) node._lastPos = pos;
      if (!node._lastPos) continue;

      const { x: offX = 0, y: offY = 0 } = node._off ?? {};
      const wobble = Math.sin(time * 8 + node._phase) * 2;
      const destX = node._lastPos.x + offX;
      const destY = node._lastPos.y + offY + wobble;

      // Update node position
      try {
        if (node.pos && typeof node.pos.x === "number") {
          node.pos.x = destX;
          node.pos.y = destY;
        } else if (typeof node.moveTo === "function") {
          node.moveTo(destX, destY);
        } else if ("x" in node && "y" in node) {
          node.x = destX;
          node.y = destY;
        }
      } catch (e) {
        // Position update failed - node might be dead
        activeOverlays.delete(node);
        try {
          safeDestroy(k, node);
        } catch (e2) {}
        continue;
      }

      // Update scale animation
      const baseScale = node._baseScale ?? 1;
      const scale = baseScale * (1 + 0.12 * Math.sin(time * 8 + node._phase));
      if (node.scale && typeof node.scale.x === "number") {
        try {
          node.scale.x = scale;
          node.scale.y = scale;
        } catch (e) {}
      }

      // Authoritative cleanup based on buff existence
      try {
        const instId = node._instanceId;
        if (instId && target && target._buffManager && Array.isArray(target._buffManager.buffs)) {
          const age = time - (node._createdAt ?? 0);

          // Skip cleanup for very new overlays (< 60ms) to avoid race conditions
          if (age < 0.06) {
            continue;
          }

          // Check if the buff still exists
          const found = target._buffManager.buffs.some((b) => {
            if (!b || !b.id) return false;
            try {
              // Match exact buff id or buff id prefix (for multi-stack overlays)
              if (b.id === instId) return true;
              if (typeof instId === "string" && typeof b.id === "string" && instId.startsWith(b.id + ":")) {
                return true;
              }
            } catch (e) {}
            return false;
          });

          // If buff doesn't exist, remove the overlay
          if (!found) {
            activeOverlays.delete(node);
            try {
              safeDestroy(k, node);
            } catch (e) {}
            continue;
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  console.log("[overlayManager] Started overlay updater");
}

/**
 * Destroy all overlays that follow a specific target.
 */
function _destroyAllOverlaysForTarget(k, target) {
  for (const node of Array.from(activeOverlays)) {
    if (!node) continue;
    if (node._follow === target) {
      activeOverlays.delete(node);
      try {
        safeDestroy(k, node);
      } catch (e) {}
    }
  }
}

export function createOverlay(k, target, opts = {}) {
  if (!target || !k?.add) return null;

  // Start the updater if not already running
  startOverlayUpdater(k);

  // Register global destroy helper on k
  if (!k._destroyVfxFor) {
    k._destroyVfxFor = (t) => _destroyAllOverlaysForTarget(k, t);
  }

  // Reuse rules
  const preferReuse = opts.reuse !== false && !opts.forceNew && !opts.instanceId && !opts.allowMultiple;

  if (preferReuse) {
    for (const existing of activeOverlays) {
      // Check if node is still valid
      const nodeExists = typeof existing?.exists === "function" ? existing.exists() : !!existing?.exists;
      if (!nodeExists) {
        activeOverlays.delete(existing);
        continue;
      }

      if (existing._follow === target && existing.type === opts.type) {
        existing._refCount = (existing._refCount ?? 1) + 1;
        return existing;
      }
    }
  } else if (opts.instanceId) {
    for (const existing of activeOverlays) {
      const nodeExists = typeof existing?.exists === "function" ? existing.exists() : !!existing?.exists;
      if (!nodeExists) {
        activeOverlays.delete(existing);
        continue;
      }

      if (existing._follow === target && existing._instanceId === opts.instanceId && existing.type === opts.type) {
        existing._refCount = (existing._refCount ?? 1) + 1;
        return existing;
      }
    }
  }

  // Create new overlay
  const initialPos = getSafeEntityPos(target) ?? { x: 0, y: 0 };
  const defaultOffsetY = -(target.height ?? target.size ?? 0) * 0.5 - 8;
  const providedOffset =
    opts.offset && typeof opts.offset === "object" ? { x: opts.offset.x ?? 0, y: opts.offset.y ?? 0 } : null;
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
    textComp,
    colorArg,
    originComp,
    zComp,
    "vfx_overlay",
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

  // Stamp creation time
  try {
    node._createdAt = getCurrentTime(k) ?? Date.now() / 1000;
  } catch {
    node._createdAt = Date.now() / 1000;
  }

  // Patch target.die to clean up overlays immediately (only once)
  try {
    if (typeof target.die === "function" && !target._vfx_diePatched) {
      const origDie = target.die.bind(target);
      target._vfx_diePatched = true;
      target.die = function (...args) {
        try {
          k._destroyVfxFor?.(target);
        } catch (e) {}
        return origDie(...args);
      };
    }
  } catch (e) {
    /* ignore */
  }

  return node;
}

export function destroyOverlay(k, node) {
  if (!node) return;

  node._refCount = Math.max(0, (node._refCount ?? 1) - 1);
  if (node._refCount > 0) return;

  activeOverlays.delete(node);
  node._manualRemove = true;
  try {
    safeDestroy(k, node);
  } catch (e) {}
}
