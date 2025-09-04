// ==============================
// applyTemporaryStatBuff
// ==============================
/**
 * Applies a time-limited stat buff to an object. Buffs are layered,
 * allowing multiple buffs to stack or replace each other based on their mode.
 *
 * - Maintains a base snapshot per stat (`obj._baseStats`) to ensure buffs
 *   work correctly with permanent upgrades. This base is set on the first buff.
 * - Active buffs for a stat are stored in `obj._buffLayers[stat]`.
 * - Extending an existing buff updates its expiry time rather than adding a new entry.
 * - When all buffs for a stat expire, the stat is restored to its base value,
 *   and the base is then synced to the current value for future buffs.
 *
 * @param {object} k - The Kaboom.js context object, used for `k.wait`.
 * @param {object} obj - The object receiving the buff (e.g., player, enemy).
 * @param {string} statName - The name of the stat to buff (e.g., "attackSpeed", "damage").
 * @param {number} value - The value associated with the buff (multiplier, absolute value, or additive amount).
 * @param {number} durationSeconds - The duration of the buff in seconds.
 * @param {"multiplier" | "absolute" | "additive"} mode - The mode of the buff.
 *   - "multiplier" (default): `stat = base * value`
 *   - "absolute": `stat = value` (overrides all other buffs)
 *   - "additive": `stat = base + value`
 */
export function applyTemporaryStatBuff(
  k,
  obj,
  statName,
  value,
  durationSeconds,
  mode = "multiplier",
) {
  if (!obj) {
    console.warn("applyTemporaryStatBuff called with nullish object.");
    return;
  }

  // Initialize buff layers and base stats if they don't exist.
  const buffLayers = (obj._buffLayers ??= {});
  const baseStats = (obj._baseStats ??= {});
  const now = Date.now();
  const durationMs = Math.max(0, durationSeconds * 1000);

  // If this is the first time we're buffing this specific stat,
  // snapshot its current value as the base.
  if (baseStats[statName] === undefined) {
    baseStats[statName] = Number(obj[statName]) || 0;
  }

  /**
   * Recalculates the stat's effective value based on its base and all active buffs.
   * This function also handles syncing the base stat if no buffs remain.
   */
  const recomputeStat = () => {
    let currentVal = baseStats[statName];
    const activeBuffs = buffLayers[statName] || [];

    if (activeBuffs.length > 0) {
      let absoluteBuffApplied = false;
      for (const buff of activeBuffs) {
        if (buff.mode === "absolute") {
          // Absolute buffs override all others. If multiple absolute buffs exist,
          // the last one in the array (most recently applied) will take precedence
          // due to the loop order.
          currentVal = buff.value;
          absoluteBuffApplied = true;
        } else if (!absoluteBuffApplied) {
          // Apply multiplier or additive buffs only if no absolute buff is active.
          if (buff.mode === "multiplier") {
            currentVal *= buff.value;
          } else if (buff.mode === "additive") {
            currentVal += buff.value;
          }
        }
      }
    }

    obj[statName] = currentVal;

    // Special handling for attackSpeed to trigger UI updates if necessary.
    if (statName === "attackSpeed") {
      obj._cosmetics?.updateAttackSpeedColor?.();
    }

    // If no active buffs remain for this stat, sync the base value to the
    // current (potentially permanently upgraded) value for future buffs.
    if (activeBuffs.length === 0) {
      baseStats[statName] = Number(obj[statName]) || 0;
      // Clean up the empty layer array to keep `_buffLayers` tidy.
      delete buffLayers[statName];
    }
  };

  /**
   * Schedules the expiry of a specific buff entry.
   * @param {object} buffEntry - The buff object to schedule for expiry.
   */
  const scheduleBuffExpiry = (buffEntry) => {
    // Calculate remaining time for the buff. Ensure at least a small delay.
    const remainingTimeSeconds = Math.max(0.001, (buffEntry.endTime - Date.now()) / 1000);

    // Cancel any pre-existing timer for this buff to prevent multiple expirations.
    buffEntry.timer?.cancel?.();

    buffEntry.timer = k.wait(remainingTimeSeconds, () => {
      const activeBuffs = buffLayers[statName];
      if (activeBuffs) {
        // Remove the expired buff from the array.
        const buffIndex = activeBuffs.indexOf(buffEntry);
        if (buffIndex >= 0) {
          activeBuffs.splice(buffIndex, 1);
        }
      }
      recomputeStat(); // Recalculate stat after buff removal.
    });
  };

  // Get or initialize the array of buffs for this specific stat.
  const statBuffs = (buffLayers[statName] ??= []);

  // Check if an identical buff (same mode and value) already exists.
  // If so, just extend its duration.
  const existingBuff = statBuffs.find(
    (b) => b.mode === mode && b.value === value,
  );

  if (existingBuff) {
    existingBuff.endTime += durationMs;
    scheduleBuffExpiry(existingBuff); // Reschedule with new end time.
  } else {
    // Create a new buff entry and add it to the active buffs.
    const newBuffEntry = {
      mode,
      value,
      endTime: now + durationMs,
      timer: null, // Will be set by scheduleBuffExpiry
    };
    statBuffs.push(newBuffEntry);
    recomputeStat(); // Recalculate stat immediately as a new buff is active.
    scheduleBuffExpiry(newBuffEntry); // Schedule its expiry.
  }
}
