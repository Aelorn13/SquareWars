import { showUpgradeUI, cleanupUpgradeUI } from "../ui/upgradeUI.js";
import { RarityDefinitions,  UpgradeDefinitions,  rollRarityForStat,  formatUpgradeForUI,  StatScalingMultipliers,  AdditiveStats } from "./index.js";
import {  getPermanentBase, setPermanentBaseAndRecompute } from "./baseStat.js";

/**
 * Applies a chosen upgrade to the player's permanent/base stats and recomputes visible values.
 * Special handling for 'projectiles' and 'movementSpeed' ensures correct base values.
 *
 * @param {object} player - The player object whose stats are being upgraded.
 * @param {object} upgradeDef - The definition of the upgrade to apply.
 * @param {object} rarity - The rarity object associated with the upgrade, containing its multiplier.
 */
export function applyUpgrade(player, upgradeDef, rarity) {
  const statName = upgradeDef.stat; // Renamed 'stat' to 'statName' for clarity.
  const rarityMultiplier = rarity.multiplier;

  // --- Special Case: Projectiles ---
  if (statName === "projectiles") {
    // Projectiles always start at 1 if not defined.
    const currentBaseProjectiles = getPermanentBase(player, "projectiles") || 1;
    const deltaByTier = { 4: 2, 5: 4 }; // Epic: +2, Legendary: +4
    // Default to +2 if rarity tier is not epic or legendary.
    let newBaseProjectiles = currentBaseProjectiles + (deltaByTier[rarity.tier] ?? 2);

    // Ensure an odd number of projectiles for symmetric spread (e.g., 1, 3, 5).
    if (newBaseProjectiles % 2 === 0) {
      newBaseProjectiles += 1;
    }

    setPermanentBaseAndRecompute(player, "projectiles", newBaseProjectiles);
    console.log(`Upgraded projectiles → base=${newBaseProjectiles}, visible=${player.projectiles}`);
    return; // Early exit for special 'projectiles' logic.
  }

  // Determine the scaling factor for the stat, defaulting to 1.0 if not specified.
  const statScale = StatScalingMultipliers[statName] ?? 1.0;

  // Initialize base value for the stat. For movementSpeed, ensure a starting value if none exists.
  let currentBaseValue;
  if (statName === "movementSpeed") {
    currentBaseValue = getPermanentBase(player, statName) || player._baseStats.speed; 
  } else {
    currentBaseValue = getPermanentBase(player, statName) || player._baseStats[statName];
  }

  let newBaseValue;

  // --- Additive Stats (e.g., critChance, luck) ---
  if (AdditiveStats.includes(statName)) {
    newBaseValue = currentBaseValue + rarityMultiplier * statScale;

    // Cap certain additive stats at 1 (100%).
    if (statName === "critChance" || statName === "luck") {
      newBaseValue = Math.min(1, newBaseValue);
    }
  }
  // --- Multiplicative Stats (most other stats) ---
  else {
    const delta = currentBaseValue * rarityMultiplier * statScale;

    if (statName === "dashCooldown" || statName === "attackSpeed") {
      // For these stats, smaller values are better, so we subtract the delta.
      // Ensure the value doesn't go below a practical minimum (e.g., 0.05).
      newBaseValue = Math.max(0.05, currentBaseValue - delta);

      // Special cosmetic update for attack speed.
      if (statName === "attackSpeed") {
        player._cosmetics?.updateAttackSpeedColor?.();
      }
    } else {
      // For other multiplicative stats, larger values are better, so we add the delta.
      newBaseValue = currentBaseValue + delta;
    }
  }

  // Apply the newly computed base value and recompute the player's visible stat.
  setPermanentBaseAndRecompute(player, statName, newBaseValue);
  console.log(`Upgraded ${statName} → base=${newBaseValue.toFixed(2)}, visible=${player[statName].toFixed(2)}`);
}
/**
 * Checks if the player's score has crossed an upgrade threshold.
 * If so, it pauses the game, presents three random upgrades to the player,
 * and applies the chosen upgrade or a score bonus for skipping.
 *
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 * @param {object} sharedState - An object holding shared game state (e.g., isPaused, upgradeOpen).
 * @param {number} currentScore - The player's current score.
 * @param {object} nextThresholdRef - A reference object holding the next score threshold for an upgrade.
 * @param {function} addScore - A function to add score to the player.
 */
export function maybeShowUpgrade(k, player, sharedState, currentScore, nextThresholdRef, addScore) {
  // If an upgrade UI is already open, or the score hasn't met the threshold, do nothing.
  if (sharedState.upgradeOpen || currentScore < nextThresholdRef.value) {
    return;
  }

  // Pause the game and mark that the upgrade UI is open.
  sharedState.isPaused = true;
  sharedState.upgradeOpen = true;

  // Create a shallow copy of the available upgrades pool to pick from without modifying the original.
  const availableUpgrades = [...UpgradeDefinitions];
  const chosenUpgrades = [];

  // Select 3 unique upgrades.
  for (let i = 0; i < 3 && availableUpgrades.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableUpgrades.length);
    // Remove the chosen upgrade from the pool to ensure uniqueness.
    const upgradeDefinition = availableUpgrades.splice(randomIndex, 1)[0];
    const upgradeRarity = rollRarityForStat(upgradeDefinition.stat);
    chosenUpgrades.push(formatUpgradeForUI(upgradeDefinition, upgradeRarity));
  }

  // Display the upgrade UI and handle the player's choice.
  showUpgradeUI(k, chosenUpgrades, (pickedUpgrade) => {
    if (pickedUpgrade === "skip") {
      addScore(10); // Reward for skipping upgrades.
    } else {
      // Apply the chosen upgrade to the player.
      applyUpgrade(player, pickedUpgrade, pickedUpgrade.rarity);
    }

    // Clean up the UI and resume the game.
    cleanupUpgradeUI(k);
    sharedState.isPaused = false;
    sharedState.upgradeOpen = false;
  });

  // Increase the next score threshold for the subsequent upgrade.
  // Using Math.floor ensures the threshold remains an integer.
  nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.3) + 10;
}