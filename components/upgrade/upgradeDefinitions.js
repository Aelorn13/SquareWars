/**
 * @file Defines configurations for player upgrades, rarities, and related utility functions.
 */

/**
 * Defines the different rarities for upgrades.
 */
export const RARITY_DEFINITIONS = [
  { name: "Common",    color: [255, 255, 255], tier: 1, multiplier: 0.1, weight: 40 },
  { name: "Uncommon",  color: [0, 255, 0],     tier: 2, multiplier: 0.2, weight: 30 },
  { name: "Rare",      color: [0, 0, 255],     tier: 3, multiplier: 0.3, weight: 15 },
  { name: "Epic",      color: [128, 0, 128],   tier: 4, multiplier: 0.4, weight: 8  },
  { name: "Legendary", color: [255, 165, 0],   tier: 5, multiplier: 0.5, weight: 2  },
];

/**
 * A centralized configuration for all available player upgrades.
 */
export const UPGRADE_CONFIG = {
  damage:         { name: "Damage Boost",    icon: "🔫", scale: 1.0 },
  speed:          { name: "Move Speed",      icon: "🏃", scale: 0.8 },
  luck:           { name: "Luck",            icon: "🍀", scale: 0.5, isAdditive: true, cap: 1.0 },
  bulletSpeed:    { name: "Bullet Speed",    icon: "💨", scale: 3.0 },
  attackSpeed:    { name: "Attack Interval", icon: "⚡", scale: 0.5, isInverse: true, cap: 0.05 },
  dashDuration:   { name: "Dash Duration",   icon: "⏱️", scale: 5.0 },
  dashCooldown:   { name: "Dash Cooldown",   icon: "♻️", scale: 1.5, isInverse: true, cap: 0.05 },
  critChance:     { name: "Critical Chance", icon: "🎯", scale: 0.5, isAdditive: true, cap: 1.0 },
  critMultiplier: { name: "Critical Damage", icon: "💥", scale: 2.0 },
  projectiles:    {
    name: "Multi-Shot",
    icon: "🔱",
    // Projectiles have special logic and don't use standard scaling.
    isSpecial: true,
    // Define rarity-specific bonuses directly in the config.
    bonuses: {
      4: 2, // Epic: +2 projectiles
      5: 4, // Legendary: +4 projectiles
    },
    // Restrict which rarities can be rolled for this stat.
    allowedTiers: [4, 5],
  },
};


/* ----------------- Rarity Roll Utilities ----------------- */

/**
 * Rolls a random rarity from a given list, weighted by the 'weight' field.
 * @param {Array<Object>} [rarityPool=RARITY_DEFINITIONS] - The array of rarity objects to pick from.
 * @returns {Object} The randomly selected rarity object.
 */
export function rollWeightedRarity(rarityPool = RARITY_DEFINITIONS) {
  const totalWeight = rarityPool.reduce((sum, rarity) => sum + (rarity.weight ?? 1), 0);
  if (totalWeight <= 0) {
    return rarityPool[0]; // Prevent division by zero.
  }

  let randomRoll = Math.random() * totalWeight;
  for (const rarity of rarityPool) {
    randomRoll -= (rarity.weight ?? 1);
    if (randomRoll <= 0) {
      return rarity;
    }
  }
  return rarityPool[rarityPool.length - 1]; // Fallback.
}

/**
 * Rolls a rarity for a given stat, respecting any tier restrictions in its configuration.
 * @param {string} statName - The key of the stat in UPGRADE_CONFIG.
 * @returns {Object} The randomly selected rarity object.
 */
export function rollRarityForStat(statName) {
  const statConfig = UPGRADE_CONFIG[statName];
  const allowedTiers = statConfig?.allowedTiers;

  if (allowedTiers) {
    const filteredRarities = RARITY_DEFINITIONS.filter(r => allowedTiers.includes(r.tier));
    return rollWeightedRarity(filteredRarities);
  }

  return rollWeightedRarity();
}


/* ----------------- UI Formatting ----------------- */

/**
 * Formats an upgrade and its rolled rarity into an object suitable for UI display.
 * @param {string} statName - The key of the stat (e.g., "damage").
 * @param {Object} rolledRarity - The selected rarity object.
 * @returns {Object} A formatted upgrade object for the UI.
 */
export function formatUpgradeForUI(statName, rolledRarity) {
  const statConfig = UPGRADE_CONFIG[statName];
  const upgradeData = {
    stat: statName,
    name: statConfig.name,
    icon: statConfig.icon,
    color: rolledRarity.color,
    rarity: rolledRarity,
    bonusText: "",
  };

  // Handle special cases like projectiles first.
  if (statConfig.isSpecial && statName === "projectiles") {
    const bonus = statConfig.bonuses[rolledRarity.tier] ?? 2;
    upgradeData.bonusText = `+${bonus} projectiles`;
    return upgradeData;
  }

  // General formatting for numeric stats.
  const rawChange = rolledRarity.multiplier * statConfig.scale;

  if (statConfig.isAdditive) {
    upgradeData.bonusText = `+${(rawChange * 100).toFixed(0)}%`;
  } else {
    const displayPercentage = rawChange * 100 * (statConfig.isInverse ? -1 : 1);
    upgradeData.bonusText = `${displayPercentage > 0 ? "+" : ""}${displayPercentage.toFixed(0)}%`;
  }

  return upgradeData;
}