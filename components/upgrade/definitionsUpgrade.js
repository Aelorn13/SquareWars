// Definitions, tuning knobs and rarity utilities.

/**
 * Defines the different rarities available for upgrades.
 * Each rarity has a name, color, tier, stat multiplier, and weight for rolling.
 */
export const RarityDefinitions = [
  { name: "Common",    color: [255, 255, 255], tier: 1, multiplier: 0.1, weight: 50 },
  { name: "Uncommon",  color: [0, 255, 0],     tier: 2, multiplier: 0.2, weight: 25 },
  { name: "Rare",      color: [0, 0, 255],     tier: 3, multiplier: 0.3, weight: 15 },
  { name: "Epic",      color: [128, 0, 128],   tier: 4, multiplier: 0.4, weight: 8  },
  { name: "Legendary", color: [255, 165, 0],   tier: 5, multiplier: 0.5, weight: 2  },
];

/**
 * Defines per-stat scaling multipliers.
 * These values tune the effective impact of a rarity's multiplier for each specific stat.
 */
export const StatScalingMultipliers = {
  damage: 1.0,
  speed: 0.8,
  luck: 0.4,
  bulletSpeed: 3,
  attackSpeed: 0.5,
  dashDuration: 3.0,
  dashCooldown: 1.5,
  critChance: 0.5,
  critMultiplier: 2,
  // Projectiles are handled specially in the `applyUpgrade` logic, not scaled here.
};

/**
 * Defines available upgrades shown to the player.
 * Each upgrade links to an internal stat, has a display name, and an icon.
 */
export const UpgradeDefinitions = [
  { stat: "damage",         name: "Damage Boost",    icon: "🔫" },
  { stat: "speed",          name: "Move Speed",      icon: "🏃" },
  { stat: "luck",           name: "Luck",            icon: "🍀" },
  { stat: "bulletSpeed",    name: "Bullet Speed",    icon: "💨" },
  { stat: "attackSpeed",    name: "Attack Speed",    icon: "⚡" },
  { stat: "dashDuration",   name: "Dash Duration",   icon: "⏱️" },
  { stat: "dashCooldown",   name: "Dash Cooldown",   icon: "♻️" },
  { stat: "critChance",     name: "Critical Chance", icon: "🎯" },
  { stat: "critMultiplier", name: "Critical Damage", icon: "💥" },
  { stat: "projectiles",    name: "Multi-Shot",      icon: "🔱" },
];

/**
 * A list of stats that are applied additively (flat points) rather than multiplicatively (percentage).
 */
export const AdditiveStats = ["luck", "critChance"];

/* ----------------- Rarity Roll Utilities ----------------- */

/**
 * Rolls a random rarity from a given list, weighted by the 'weight' field.
 * If no list is provided or the list is empty, it defaults to `RarityDefinitions`.
 *
 * @param {Array<Object>} [rarityPool=RarityDefinitions] - An optional array of rarity objects to pick from.
 * @returns {Object} The randomly selected rarity object.
 */
export function rollWeightedRarity(rarityPool = RarityDefinitions) {
  // Use `RarityDefinitions` as default if `rarityPool` is null, undefined, or empty.
  const activePool = (rarityPool && rarityPool.length) ? rarityPool : RarityDefinitions;

  // Calculate the total weight of all rarities in the active pool.
  const totalWeight = activePool.reduce((sum, rarity) => sum + (rarity.weight ?? 1), 0);

  // If total weight is zero or negative (shouldn't happen with default weight of 1),
  // return the first item to prevent division by zero or infinite loop.
  if (totalWeight <= 0) {
    console.warn("Total rarity weight is zero or less. Returning first rarity from pool.");
    return activePool[0];
  }

  // Generate a random number within the total weight range.
  let randomRoll = Math.random() * totalWeight;

  // Iterate through rarities, subtracting their weight until `randomRoll` drops below zero.
  // The rarity that causes this drop is the selected one.
  for (const rarity of activePool) {
    randomRoll -= rarity.weight ?? 1; // Use 1 as default weight if `rarity.weight` is missing.
    if (randomRoll <= 0) {
      return rarity;
    }
  }

  // Fallback: If for some reason no rarity was selected (e.g., floating point inaccuracies),
  // return the last rarity in the list.
  return activePool[activePool.length - 1];
}

/**
 * Rolls a rarity specifically for a given stat, applying special rules if necessary.
 * Currently, 'projectiles' can only roll Epic or Legendary rarities.
 *
 * @param {string} statName - The name of the stat for which to roll a rarity.
 * @returns {Object} The randomly selected rarity object for the given stat.
 */
export function rollRarityForStat(statName) {
  // Special handling for 'projectiles' stat.
  if (statName === "projectiles") {
    // Filter `RarityDefinitions` to include only rarities with a tier of 4 (Epic) or higher.
    const highTierRarities = RarityDefinitions.filter(rarity => rarity.tier >= 4);
    return rollWeightedRarity(highTierRarities);
  }
  // For all other stats, roll from the full set of rarity definitions.
  return rollWeightedRarity(RarityDefinitions);
}

/* ----------------- UI Formatting ----------------- */

/**
 * Formats an internal upgrade definition and its rolled rarity into a compact
 * object suitable for UI display.
 *
 * @param {Object} upgradeDefinition - The raw upgrade definition object (from `UpgradeDefinitions`).
 * @param {Object} rolledRarity - The selected rarity object for this upgrade (from `RarityDefinitions`).
 * @returns {Object} A formatted upgrade object with `bonusText`, `color`, and `rarity` details.
 */
export function formatUpgradeForUI(upgradeDefinition, rolledRarity) {
  // Special formatting logic for 'projectiles' stat.
  if (upgradeDefinition.stat === "projectiles") {
    // Defines the number of projectiles added based on rarity tier.
    // Tier 4 (Epic) adds 2, Tier 5 (Legendary) adds 4. Defaults to 2 if tier is unexpected.
    const projectileDeltaByTier = { 4: 2, 5: 4 };
    const delta = projectileDeltaByTier[rolledRarity.tier] ?? 2;

    return {
      ...upgradeDefinition,
      bonusText: `+${delta} projectiles`,
      color: rolledRarity.color,
      rarity: rolledRarity, // Include the full rarity object for detailed UI needs.
    };
  }

  // General formatting logic for other stats.
  // Retrieve the base scaling multiplier for the current stat, defaulting to 1.0 if not defined.
  const statBaseMultiplier = StatScalingMultipliers[upgradeDefinition.stat] ?? 1.0;

  // Determine if the stat's value should be displayed as inverse (e.g., cooldowns).
  const isInverseStat = upgradeDefinition.stat === "dashCooldown";

  // Calculate the raw percentage change.
  // rarity.multiplier comes from the RarityDefinitions (e.g., 0.1 for Common).
  const rawChangePercentage = rolledRarity.multiplier * statBaseMultiplier * 100;

  // Apply inverse logic if needed for display (e.g., -10% for dash cooldown).
  const displayPercentage = isInverseStat ? -rawChangePercentage : rawChangePercentage;

  return {
    ...upgradeDefinition,
    // Format the bonus text, ensuring a "+" sign for positive changes.
    bonusText: `${displayPercentage > 0 ? "+" : ""}${Math.round(displayPercentage)}%`,
    color: rolledRarity.color,
    rarity: rolledRarity, // Include the full rarity object for detailed UI needs.
  };
}