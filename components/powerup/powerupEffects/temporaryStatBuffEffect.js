/**
 * @file A system for applying temporary, stackable attribute buffs to game objects.
 */

/**
 * Applies a time-limited stat modification to an object. This system is designed
 * to be robust, handling multiple overlapping buffs and permanent stat upgrades gracefully.
 *
 * How it works:
 * 1.  `_baseStats`: When a stat is buffed for the first time, its original value is stored.
 *     This ensures buffs always modify the "true" base, not a value already modified by another buff.
 * 2.  `_buffLayers`: Each active buff is stored as a layer. This allows multiple buffs
 *     (e.g., two speed boosts) to coexist on the same stat.
 * 3.  `recomputeStat`: After any change (buff added/removed), this function recalculates the
 *     stat's final value by applying all active buff layers to the base stat.
 * 4.  Buff Extension: Applying an identical buff that's already active will extend its duration
 *     instead of adding a redundant new layer.
 *
 * @param {object} k - The Kaboom.js context, used for `k.wait`.
 * @param {object} target - The game object receiving the buff (e.g., player).
 * @param {string} statName - The name of the stat to buff (e.g., "attackSpeed").
 * @param {number} value - The value of the buff.
 * @param {number} durationSeconds - The duration of the buff in seconds.
 * @param {"multiplicative" | "additive" | "absolute"} mode - How the buff is applied:
 *   - "multiplicative": stat = base * value
 *   - "additive": stat = base + value
 *   - "absolute": stat = value (overrides all other buffs)
 */
export function applyTemporaryStatBuff(
  k,
  target,
  statName,
  value,
  durationSeconds,
  mode = "multiplicative",
) {
  if (!target) {
    console.warn("applyTemporaryStatBuff: `target` object is null or undefined.");
    return;
  }

  // Initialize storage on the target object if it doesn't exist.
  const buffLayers = (target._buffLayers ??= {});
  const baseStats = (target._baseStats ??= {});

  // Snapshot the stat's current value as the base if this is the first buff.
  if (baseStats[statName] === undefined) {
    baseStats[statName] = Number(target[statName]) || 0;
  }

  /**
   * Recalculates the stat's value based on its base and all active buffs.
   */
  const recomputeStat = () => {
    let finalValue = baseStats[statName];
    const activeBuffs = buffLayers[statName] || [];

    if (activeBuffs.length > 0) {
      // Prioritize 'absolute' buffs. If one exists, it dictates the value.
      const absoluteBuff = activeBuffs.find(b => b.mode === 'absolute');
      if (absoluteBuff) {
        finalValue = absoluteBuff.value;
      } else {
        // Otherwise, apply additive and multiplicative buffs to the base value.
        activeBuffs.forEach(buff => {
          if (buff.mode === "additive") {
            finalValue += buff.value;
          } else if (buff.mode === "multiplicative") {
            finalValue *= buff.value;
          }
        });
      }
    }

    target[statName] = finalValue;
    
    // After all buffs expire, sync the base stat to the target's current stat.
    // This accounts for permanent upgrades acquired while buffs were active.
    if (activeBuffs.length === 0) {
      baseStats[statName] = Number(target[statName]) || 0;
      delete buffLayers[statName]; // Clean up empty array.
    }
  };

  /**
   * Schedules the removal of a buff after its duration expires.
   * @param {object} buffEntry - The buff object to schedule for removal.
   */
  const scheduleBuffExpiry = (buffEntry) => {
    const remainingTime = (buffEntry.endTime - Date.now()) / 1000;
    buffEntry.timer?.cancel(); // Cancel any existing timer for this buff.

    buffEntry.timer = k.wait(remainingTime, () => {
      const activeBuffs = buffLayers[statName];
      if (activeBuffs) {
        const index = activeBuffs.indexOf(buffEntry);
        if (index > -1) {
          activeBuffs.splice(index, 1);
        }
      }
      recomputeStat();
    });
  };

  const statBuffs = (buffLayers[statName] ??= []);
  const durationMs = durationSeconds * 1000;

  // Check if an identical buff already exists to extend it.
  const existingBuff = statBuffs.find(b => b.mode === mode && b.value === value);

  if (existingBuff) {
    existingBuff.endTime = Date.now() + ((existingBuff.endTime - Date.now()) + durationMs);
    scheduleBuffExpiry(existingBuff);
  } else {
    const newBuff = {
      mode,
      value,
      endTime: Date.now() + durationMs,
      timer: null,
    };
    statBuffs.push(newBuff);
    scheduleBuffExpiry(newBuff);
  }

  recomputeStat(); // Immediately apply the new/updated buff.
}