import { showUpgradeUI, cleanupUpgradeUI } from "../ui/upgradeUI.js";
import { UPGRADE_CONFIG, rollRarityForStat, formatUpgradeForUI } from "./upgradeDefinitions.js";
import { getPermanentBaseStat, applyPermanentUpgrade } from "./statManager.js";

/**
 * Applies a chosen permanent upgrade to the player's stats.
 * This function is now data-driven by the UPGRADE_CONFIG object.
 * @param {object} chosenUpgrade - The formatted upgrade object from the UI.
 */
export function applyUpgrade(player, chosenUpgrade) {
  const { stat: statName, rarity } = chosenUpgrade;
  const statConfig = UPGRADE_CONFIG[statName];

  // --- Special Case: Projectiles ---
  if (statName === "projectiles") {
    const currentBase = getPermanentBaseStat(player, "projectiles") || 1;
    const bonus = statConfig.bonuses[rarity.tier] ?? 2;
    let newBase = currentBase + bonus;

    // Ensure an odd number of projectiles for a symmetrical firing pattern.
    if (newBase % 2 === 0) {
      newBase += 1;
    }
    applyPermanentUpgrade(player, "projectiles", newBase);
    return;
  }

  // --- Standard Numeric Stats ---
  const currentBase = getPermanentBaseStat(player, statName);
  let newBaseValue;

  if (statConfig.isAdditive) {
    const delta = rarity.multiplier * statConfig.scale;
    newBaseValue = currentBase + delta;
  } else { // Multiplicative stat
    const delta = currentBase * rarity.multiplier * statConfig.scale;
    newBaseValue = statConfig.isInverse
      ? currentBase - delta // For stats where lower is better (e.g., cooldowns).
      : currentBase + delta; // For stats where higher is better.
  }

  // Apply a cap if one is defined in the configuration.
  if (statConfig.cap !== undefined) {
    newBaseValue = statConfig.isInverse
      ? Math.max(statConfig.cap, newBaseValue) // e.g., cooldown can't go below 0.05
      : Math.min(statConfig.cap, newBaseValue); // e.g., crit chance can't exceed 1.0
  }

  applyPermanentUpgrade(player, statName, newBaseValue);

  // Trigger cosmetic updates if necessary.
  if (statName === "attackSpeed") {
    player._cosmetics?.updateAttackSpeedColor?.();
  }
}

/**
 * Checks if the player should be shown the upgrade selection screen.
 */
export function maybeShowUpgrade(k, player, sharedState, currentScore, nextThresholdRef, addScore) {
  if (sharedState.upgradeOpen || currentScore < nextThresholdRef.value) {
    return;
  }

  sharedState.isPaused = true;
  sharedState.upgradeOpen = true;

  const availableUpgrades = Object.keys(UPGRADE_CONFIG);
  const offeredUpgrades = [];

  // Select 3 unique upgrades to offer the player.
  for (let i = 0; i < 3 && availableUpgrades.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableUpgrades.length);
    const statName = availableUpgrades.splice(randomIndex, 1)[0];
    const rarity = rollRarityForStat(statName);
    offeredUpgrades.push(formatUpgradeForUI(statName, rarity));
  }

  showUpgradeUI(k, offeredUpgrades, (pickedUpgrade) => {
    if (pickedUpgrade === "skip") {
      addScore(10);
    } else {
      applyUpgrade(player, pickedUpgrade);
    }

    cleanupUpgradeUI(k);
    sharedState.isPaused = false;
    sharedState.upgradeOpen = false;
  });

  // Increase the score required for the next upgrade.
  nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.3) + 10;
}