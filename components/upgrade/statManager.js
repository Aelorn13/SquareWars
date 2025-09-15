//components/upgrade/statManager.js
/**
 * @file Manages the interaction between permanent base stats and temporary buff layers.
 */

/**
 * Safely retrieves the permanent base value for a stat.
 *
 * @param {object} entity - The entity (e.g., player) whose stats are being accessed.
 * @param {string} statName - The name of the stat (e.g., "damage").
 * @returns {number} The permanent base value of the stat.
 */
export function getPermanentBaseStat(entity, statName) {
  // Ensure the base stats storage exists.
  entity._baseStats ??= {};

  // Return the stored base value, or the visible stat if no base is stored yet.
  return entity._baseStats[statName] ?? entity[statName] ?? 0;
}

/**
 * Sets a new permanent base value for a stat and recomputes its final
 * visible value by applying all active temporary buffs.
 *
 * @param {object} entity - The entity whose stat is being upgraded.
 * @param {string} statName - The name of the stat (e.g., "damage").
 * @param {number} newBaseValue - The new permanent value for the stat.
 */
export function applyPermanentUpgrade(entity, statName, newBaseValue) {
  entity._baseStats ??= {};
  entity._baseStats[statName] = newBaseValue;

  // This function assumes a 'recomputeStat' method exists, provided by the buff system.
  // This decouples the upgrade logic from the buff calculation logic.
  if (typeof entity.recomputeStat === 'function') {
    entity.recomputeStat(statName);
  } else {
    // Fallback if no recompute function is found: just set the visible stat directly.
    // This may not reflect active buffs correctly.
    entity[statName] = newBaseValue;
  }
}