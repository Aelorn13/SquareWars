// components/powerup/powerupEffects/temporaryStatBuffEffect.js
/**
 * A defensive, compatible implementation of temporary stat buffs and invincibility.
 *
 * This file intentionally uses a separate per-entity stat manager (target._statManager)
 * so it doesn't conflict with other _buffManager shapes present in the project.
 * For compatibility with other systems (applyPermanentUpgrade, getPermanentBaseStat),
 * we mirror the same baseStats object onto target._buffManager.baseStats when possible.
 *
 * Exports:
 *  - applyTemporaryStatBuff(k, target, statName, value, durationSeconds, mode = "multiplicative", gameContext)
 *  - applyInvincibility(k, player, durationSeconds, gameContext)
 *
 * The implementation is defensive: it guards against missing properties (pos/velocity/etc.)
 * and avoids overwriting unrelated manager implementations.
 */

/* ----------------- Helpers ----------------- */

/* Compute final value from a base given an array of buffs */
function computeFinalFromBase(base, buffs) {
  let finalValue = base;
  if (!buffs || buffs.length === 0) return finalValue;

  // absolute overrides everything
  const absoluteBuff = (buffs.find?.(b => b.mode === "absolute")) ?? null;
  if (absoluteBuff) return absoluteBuff.value;

  for (const buff of buffs) {
    if (buff.mode === "additive") finalValue += buff.value;
    else if (buff.mode === "multiplicative") finalValue *= buff.value;
  }
  return finalValue;
}

/* Recompute visible stat on target using manager.baseStats (but prefer entity._baseStats if present) */
function recomputeStat(target, statName) {
  const manager = target._statManager;
  if (!manager) return;

  // Keep manager.baseStats synced with any permanent store on the entity
  if (target._baseStats && target._baseStats[statName] !== undefined) {
    if (manager.baseStats[statName] !== Number(target._baseStats[statName])) {
      manager.baseStats[statName] = Number(target._baseStats[statName]);
    }
  }

  if (manager.baseStats[statName] === undefined) {
    // if visible stat exists on entity use that as base, else default 0
    manager.baseStats[statName] = Number(target[statName]) || 0;
  }

  const activeBuffs = (manager.activeBuffs || []).filter(b => b.stat === statName);
  const finalValue = computeFinalFromBase(manager.baseStats[statName], activeBuffs);

  // assign visible stat safely
  try {
    target[statName] = finalValue;
  } catch (e) {
    // ignore if target can't be assigned for some reason
  }

  // If no buffs remain for that stat, keep manager.baseStats synced with visible stat
  if (activeBuffs.length === 0) {
    manager.baseStats[statName] = Number(target[statName]) || 0;
    target._baseStats ??= {};
    target._baseStats[statName] = manager.baseStats[statName];

    // Also mirror to the broader _buffManager.baseStats for compatibility with other systems
    if (target._buffManager) {
      try {
        target._buffManager.baseStats = target._buffManager.baseStats || manager.baseStats;
        // keep them referencing the same object
        target._buffManager.baseStats = manager.baseStats;
      } catch (e) {}
    }
  }
}

/* Create or return a per-entity stat manager used by powerups.
 * This manager is stored at target._statManager to avoid colliding with other _buffManager shapes.
 * We also ensure target._buffManager.baseStats points to the same baseStats object for compatibility.
 */
function getOrCreateStatManager(k, target, gameContext) {
  if (!target) return null;
  if (target._statManager) return target._statManager;

  const manager = {
    activeBuffs: [], // { stat, mode, value, duration, onRemove? }
    baseStats: {},   // permanent base stats for this system
    initialized: true,
  };
  target._statManager = manager;

  // If entity already had explicit permanent base stats, copy them
  if (target._baseStats) {
    for (const s in target._baseStats) {
      manager.baseStats[s] = Number(target._baseStats[s]);
    }
  }

  // Mirror to target._buffManager.baseStats for other systems that expect it.
  if (!target._buffManager) {
    // create a minimal placeholder so other code can read baseStats safely
    target._buffManager = target._buffManager ?? {};
    target._buffManager.initialized = target._buffManager.initialized ?? true;
    target._buffManager.baseStats = manager.baseStats;
  } else {
    // attach or replace baseStats property so both managers use the same object
    try {
      target._buffManager.baseStats = manager.baseStats;
      target._buffManager.initialized = target._buffManager.initialized ?? true;
    } catch (e) {
      // ignore potential read-only shapes
    }
  }

  // Expose recomputeStat API used elsewhere (applyPermanentUpgrade expects this)
  target.recomputeStat = (statName) => recomputeStat(target, statName);

  // Per-entity update loop for ticking buff durations and auto-syncing base stats.
  // Avoid attaching multiple update callbacks: only attach once.
  let attached = false;
  if (typeof target.onUpdate === "function") {
    // attach safely
    try {
      target.onUpdate(() => {
        if (gameContext?.sharedState?.isPaused) return;

        let needsRecompute = false;

        // Tick down and remove expired buffs
        for (let i = manager.activeBuffs.length - 1; i >= 0; i--) {
          const buff = manager.activeBuffs[i];
          buff.duration -= (k.dt ? k.dt() : 0);
          if (buff.duration <= 0) {
            try { buff.onRemove?.(); } catch (e) {}
            manager.activeBuffs.splice(i, 1);
            needsRecompute = true;
          }
        }

        // Detect external permanent changes that happened while buffs active.
        for (const statName of Object.keys(manager.baseStats)) {
          const activeForStat = manager.activeBuffs.filter(b => b.stat === statName);
          if (activeForStat.length === 0) continue;

          const currentBase = manager.baseStats[statName];
          const expectedFinal = computeFinalFromBase(currentBase, activeForStat);
          const observed = Number(target[statName]) || 0;
          const deltaObserved = observed - expectedFinal;

          if (Math.abs(deltaObserved) > 1e-6) {
            // compute sensitivity
            const finalWithBasePlusOne = computeFinalFromBase(currentBase + 1, activeForStat);
            const sensitivity = finalWithBasePlusOne - expectedFinal;
            if (Math.abs(sensitivity) > 1e-12) {
              const baseDelta = deltaObserved / sensitivity;
              manager.baseStats[statName] = currentBase + baseDelta;
              target._baseStats ??= {};
              target._baseStats[statName] = manager.baseStats[statName];
              needsRecompute = true;
            }
          }
        }

        if (needsRecompute) {
          for (const statName in manager.baseStats) recomputeStat(target, statName);
        }
      });
      attached = true;
    } catch (e) {
      // fallback: if target.onUpdate throws, we won't have per-entity ticking.
    }
  }

  // If no per-entity onUpdate was attached, ensure a global fallback manager exists on k
  if (!attached) {
    try {
      if (!k._globalStatManagers) {
        k._globalStatManagers = [];
        if (typeof k.onUpdate === "function") {
          k.onUpdate(() => {
            const dt = k.dt ? k.dt() : 0;
            for (const m of k._globalStatManagers) {
              // Tick and remove expired buffs for manager m
              let needsRecompute = false;
              for (let i = m.activeBuffs.length - 1; i >= 0; i--) {
                const buff = m.activeBuffs[i];
                buff.duration -= dt;
                if (buff.duration <= 0) {
                  try { buff.onRemove?.(); } catch (e) {}
                  m.activeBuffs.splice(i, 1);
                  needsRecompute = true;
                }
              }
              if (needsRecompute) {
                for (const statName in m.baseStats) {
                  // recompute only if recomputeStat attached to the owner; we don't have owner here
                }
              }
            }
          });
        }
      }
      k._globalStatManagers.push(manager);
    } catch (e) {
      // ignore if k isn't available
    }
  }

  return manager;
}

/* ----------------- Public API ----------------- */

/**
 * Apply a temporary stat buff to an entity.
 *
 * mode: "multiplicative" | "additive" | "absolute"
 */
export function applyTemporaryStatBuff(
  k,
  target,
  statName,
  value,
  durationSeconds,
  mode = "multiplicative",
  gameContext
) {
  if (!target) return;

  const manager = getOrCreateStatManager(k, target, gameContext);
  if (!manager) return;

  // ensure arrays exist
  manager.activeBuffs = manager.activeBuffs || [];

  // Find identical existing buff to extend
  const existingBuff = (manager.activeBuffs.find?.(b => b.stat === statName && b.mode === mode && b.value === value)) ?? null;

  if (existingBuff) {
    existingBuff.duration = (existingBuff.duration || 0) + (durationSeconds || 0);
  } else {
    manager.activeBuffs.push({
      stat: statName,
      mode,
      value,
      duration: durationSeconds,
      onRemove: undefined,
    });
  }

  recomputeStat(target, statName);
}

/**
 * Apply temporary invincibility to the player (pausable).
 * Keeps a blink effect while invincible; stacked durations refresh.
 */
export function applyInvincibility(k, player, durationSeconds, gameContext) {
  if (!player) return;

  const manager = getOrCreateStatManager(k, player, gameContext);
  if (!manager) return;

  manager.activeBuffs = manager.activeBuffs || [];
  const buffKey = "invincibility";

  const existing = manager.activeBuffs.find(b => b.stat === buffKey);
  if (existing) {
    existing.duration = (existing.duration || 0) + durationSeconds;
    // ensure player state is correct
    player.isInvincible = true;
    return;
  }

  // start blink
  let flashEffect = null;
  try {
    if (k && typeof k.loop === "function") {
      flashEffect = k.loop(0.12, () => {
        try { player.hidden = !player.hidden; } catch (e) {}
      });
    }
  } catch (e) {
    flashEffect = null;
  }

  player.isInvincible = true;

  manager.activeBuffs.push({
    stat: buffKey,
    mode: "absolute",
    value: 1,
    duration: durationSeconds,
    onRemove: () => {
      try { player.isInvincible = false; } catch (e) {}
      try { player.hidden = false; } catch (e) {}
      try { flashEffect?.cancel?.(); } catch (e) {}
    },
  });
}
