/**
 * @file A system for applying temporary, pausable, and stackable attribute buffs.
 */

/* Helper to compute final stat from a base plus buffs (absolute/additive/multiplicative) */
function computeFinalFromBase(base, buffs) {
  let finalValue = base;
  if (!buffs || buffs.length === 0) return finalValue;

  const absoluteBuff = buffs.find(b => b.mode === 'absolute');
  if (absoluteBuff) return absoluteBuff.value;

  for (const buff of buffs) {
    if (buff.mode === 'additive') finalValue += buff.value;
    else if (buff.mode === 'multiplicative') finalValue *= buff.value;
  }
  return finalValue;
}

/* Recompute visible stat on target using manager.baseStats (but prefer entity._baseStats if present) */
function recomputeStat(target, statName) {
  const manager = target._buffManager;
  if (!manager) return;

  // If the external permanent-store exists and differs, sync it into manager.baseStats
  if (target._baseStats && target._baseStats[statName] !== undefined) {
    if (manager.baseStats[statName] !== Number(target._baseStats[statName])) {
      manager.baseStats[statName] = Number(target._baseStats[statName]);
    }
  }

  if (manager.baseStats[statName] === undefined) {
    manager.baseStats[statName] = Number(target[statName]) || 0;
  }

  const base = manager.baseStats[statName];
  const activeBuffs = manager.activeBuffs.filter(b => b.stat === statName);
  const finalValue = computeFinalFromBase(base, activeBuffs);

  target[statName] = finalValue;

  // If no buffs remain, keep manager.baseStats synced with visible stat
  if (activeBuffs.length === 0) {
    manager.baseStats[statName] = Number(target[statName]) || 0;
    // Also mirror back to entity._baseStats for consistency
    target._baseStats ??= {};
    target._baseStats[statName] = manager.baseStats[statName];
  }
}

/* Initialize buff manager and attach utility to the entity (synchronise any existing _baseStats) */
function initializeBuffManager(k, target, gameContext) {
  const manager = (target._buffManager ??= {
    activeBuffs: [],
    baseStats: {},
    initialized: true,
  });

  // If the entity already had permanent base values, copy them into the buff manager
  if (target._baseStats) {
    for (const s in target._baseStats) {
      manager.baseStats[s] = Number(target._baseStats[s]);
    }
  }

  // Expose a recompute API the rest of your code can call (applyPermanentUpgrade expects this).
  target.recomputeStat = (statName) => recomputeStat(target, statName);

  target.onUpdate(() => {
    if (gameContext?.sharedState?.isPaused) return;

    let needsRecompute = false;

    // Tick down and remove expired buffs
    for (let i = manager.activeBuffs.length - 1; i >= 0; i--) {
      const buff = manager.activeBuffs[i];
      buff.duration -= k.dt();
      if (buff.duration <= 0) {
        buff.onRemove?.();
        manager.activeBuffs.splice(i, 1);
        needsRecompute = true;
      }
    }

    // Detect external permanent changes that happened while buffs active.
    // For simplicity we check stored permanent copy first (target._baseStats) and fall back to observed target value.
    for (const statName of Object.keys(manager.baseStats)) {
      const activeForStat = manager.activeBuffs.filter(b => b.stat === statName);
      if (activeForStat.length === 0) continue;

      const currentBase = manager.baseStats[statName];
      const expectedFinal = computeFinalFromBase(currentBase, activeForStat);
      const observed = Number(target[statName]) || 0;
      const deltaObserved = observed - expectedFinal;

      if (Math.abs(deltaObserved) > 1e-6) {
        const finalWithBasePlusOne = computeFinalFromBase(currentBase + 1, activeForStat);
        const sensitivity = finalWithBasePlusOne - expectedFinal;

        if (Math.abs(sensitivity) > 1e-12) {
          const baseDelta = deltaObserved / sensitivity;
          manager.baseStats[statName] = currentBase + baseDelta;
          // keep the permanent store in sync too
          target._baseStats ??= {};
          target._baseStats[statName] = manager.baseStats[statName];
          needsRecompute = true;
        }
      }
    }

    if (needsRecompute) {
      for (const statName in manager.baseStats) {
        recomputeStat(target, statName);
      }
    }
  });
}

/* Apply temporary stat buff (unchanged interface) */
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

  if (!target._buffManager?.initialized) {
    initializeBuffManager(k, target, gameContext);
  }

  const manager = target._buffManager;
  const existingBuff = manager.activeBuffs.find(
    b => b.stat === statName && b.mode === mode && b.value === value
  );

  if (existingBuff) {
    existingBuff.duration += durationSeconds;
  } else {
    manager.activeBuffs.push({
      stat: statName,
      mode,
      value,
      duration: durationSeconds,
    });
  }

  recomputeStat(target, statName);
}

/* Invincibility behavior (unchanged except initialization call) */
export function applyInvincibility(k, player, durationSeconds, gameContext) {
  if (!player) return;

  if (!player._buffManager?.initialized) {
    initializeBuffManager(k, player, gameContext);
  }

  const manager = player._buffManager;
  const buffKey = 'invincibility';
  const existingBuff = manager.activeBuffs.find(b => b.stat === buffKey);

  if (existingBuff) {
    existingBuff.duration += durationSeconds;
  } else {
    const flashEffect = k.loop(0.1, () => (player.hidden = !player.hidden));
    player.isInvincible = true;

    manager.activeBuffs.push({
      stat: buffKey,
      duration: durationSeconds,
      onRemove: () => {
        player.isInvincible = false;
        player.hidden = false;
        flashEffect.cancel();
      },
    });
  }
}
