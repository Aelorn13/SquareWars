//components/powerup/powerupEffect/temporaryStatBuffEffect.js
/**
 * @file A system for applying temporary, pausable, and stackable attribute buffs.
 */

/**
 * Recalculates a target's stat based on its base value and all active buffs.
 */
function recomputeStat(target, statName) {
  const manager = target._buffManager;
  if (!manager) return;

  if (manager.baseStats[statName] === undefined) {
    manager.baseStats[statName] = Number(target[statName]) || 0;
  }

  let finalValue = manager.baseStats[statName];
  const activeBuffs = manager.activeBuffs.filter(b => b.stat === statName);

  if (activeBuffs.length > 0) {
    const absoluteBuff = activeBuffs.find(b => b.mode === 'absolute');
    if (absoluteBuff) {
      finalValue = absoluteBuff.value;
    } else {
      activeBuffs.forEach(buff => {
        if (buff.mode === "additive") finalValue += buff.value;
        else if (buff.mode === "multiplicative") finalValue *= buff.value;
      });
    }
  }

  target[statName] = finalValue;

  if (activeBuffs.length === 0) {
    manager.baseStats[statName] = Number(target[statName]) || 0;
  }
}

/**
 * Initializes the buff management system on a target object.
 */
function initializeBuffManager(k, target, gameContext) { // <--- CHANGED: 'k' is now a parameter.
  const manager = (target._buffManager ??= {
    activeBuffs: [],
    baseStats: {},
    initialized: true,
  });

  target.onUpdate(() => {
    if (gameContext.sharedState.isPaused) return;

    let needsRecompute = false;
    for (let i = manager.activeBuffs.length - 1; i >= 0; i--) {
      const buff = manager.activeBuffs[i];
      buff.duration -= k.dt(); // <--- FIX: 'k' is now defined and this works correctly.

      if (buff.duration <= 0) {
        buff.onRemove?.();
        manager.activeBuffs.splice(i, 1);
        needsRecompute = true;
      }
    }

    if (needsRecompute) {
      const statsToUpdate = [...new Set(manager.activeBuffs.map(b => b.stat))];
      for (const statName in manager.baseStats) {
        recomputeStat(target, statName);
      }
    }
  });
}

/**
 * Applies a time-limited, pausable stat modification to an object.
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

  if (!target._buffManager?.initialized) {
    initializeBuffManager(k, target, gameContext); // <--- CHANGED: Pass 'k' to the function.
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

/**
 * Applies a pausable invincibility effect.

 */
export function applyInvincibility(k, player, durationSeconds, gameContext) {
  if (!player) return;

  if (!player._buffManager?.initialized) {
    initializeBuffManager(k, player, gameContext); // <--- CHANGED: Pass 'k' to the function.
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