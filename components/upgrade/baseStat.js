// Manages permanent base values and recomputes visible stats
// when temporary buff layers are active.

// Defines the structure for temporary buffs.
// type BuffLayer = {
//   absolute?: boolean;  // If true, this layer sets the stat to 'value' directly.
//   value?: number;     // The value to use if 'absolute' is true.
//   multiplier?: number; // Multiplies the current stat value.
//   endTime?: number;   // Timestamp when the buff expires.
//   timer?: any;        // Optional timer ID for clearing the buff.
// }

/**
 * Calculates or retrieves the permanent base value for a specific stat.
 *
 * If a base value is already stored, it's returned directly.
 * Otherwise, it attempts to infer the base by reversing multiplicative buffs.
 * If an 'absolute' buff exists, safe inference isn't possible, so the current
 * visible stat value is used as the base.
 * The inferred or retrieved base value is then stored for future use.
 *
 * @param {object} entity - The object (e.g., character) containing stats and buff layers.
 * @param {string} statName - The name of the stat (e.g., 'attack', 'defense').
 * @returns {number} The permanent base value of the stat.
 */
export function getPermanentBase(entity, statName) {
  entity._baseStats ??= {}; // Initialize _baseStats if it doesn't exist.

  // If the base stat is already stored, return it directly.
  if (entity._baseStats[statName] !== undefined) {
    return entity._baseStats[statName];
  }

  // Get all active buff layers for this stat.
  const activeBuffs = entity._buffLayers?.[statName] ?? [];

  // If no buffs are active, the current visible stat *is* the base.
  if (activeBuffs.length === 0) {
    const baseValue = Number(entity[statName]) || 0;
    entity._baseStats[statName] = baseValue;
    return baseValue;
  }

  // Check for any 'absolute' buffs which prevent reliable reversal.
  // If found, the current visible stat is treated as the base.
  if (activeBuffs.some(buff => buff.absolute)) {
    const baseValue = Number(entity[statName]) || 0;
    entity._baseStats[statName] = baseValue;
    return baseValue;
  }

  // If no absolute buffs, infer the base by reversing multiplicative buffs.
  let totalMultiplier = 1;
  for (const buff of activeBuffs) {
    totalMultiplier *= (buff.multiplier ?? 1); // Default to 1 if multiplier is undefined
  }

  // Calculate the inferred base by dividing the current stat by the total multiplier.
  // Handle division by zero if totalMultiplier is 0 (though unlikely with sane buffs).
  const currentVisibleStat = Number(entity[statName]) || 0;
  const inferredBase = totalMultiplier !== 0 ? currentVisibleStat / totalMultiplier : 0;

  entity._baseStats[statName] = inferredBase;
  return inferredBase;
}

/**
 * Sets a new permanent base value for a stat and immediately recomputes its
 * visible value by applying all active temporary buff layers.
 *
 * @param {object} entity - The object (e.g., character) containing stats and buff layers.
 * @param {string} statName - The name of the stat (e.g., 'attack', 'defense').
 * @param {number} newBaseValue - The new permanent base value for the stat.
 */
export function setPermanentBaseAndRecompute(entity, statName, newBaseValue) {
  entity._baseStats ??= {}; // Ensure _baseStats exists.
  // Store the new permanent base value.
  entity._baseStats[statName] = Number(newBaseValue);

  // Get all active buff layers for this stat.
  const activeBuffs = entity._buffLayers?.[statName] ?? [];

  // Start with the stored permanent base value.
  let computedValue = entity._baseStats[statName];
  let absoluteBuffApplied = false;

  // Apply buffs in order. Absolute buffs override all previous calculations
  // and subsequent multiplicative buffs only apply if no absolute buff has been seen.
  for (const buff of activeBuffs) {
    if (buff.absolute) {
      // An absolute buff sets the value directly, overriding anything before it.
      // Use 'value' field for absolute buffs.
      computedValue = buff.value ?? 0;
      absoluteBuffApplied = true;
    } else if (!absoluteBuffApplied) {
      // Only apply multiplicative buffs if no absolute buff has taken effect.
      computedValue *= (buff.multiplier ?? 1); // Default to 1 if multiplier is undefined
    }
  }

  // Update the entity's visible stat with the newly computed value.
  entity[statName] = computedValue;
}