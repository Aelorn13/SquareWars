// components/upgrade/apply.js
// Main API: applyUpgrade and maybeShowUpgrade

import { showUpgradeUI, cleanupUpgradeUI } from "../ui/upgradeUI.js";
import { rarities, upgrades, rollRarityFor, formatUpgrade, statScaling, additiveStats } from "./index.js";
import { inferPermanentBase, setPermanentBaseAndRecompute } from "./baseStat.js";

/**
 * applyUpgrade(player, upgradeDef, rarity)
 * - modifies permanent/base stat(s) on the player and recomputes visible value.
 * - special-case: projectiles increases base by flat +2 / +4 for epic/legendary.
 */
export function applyUpgrade(player, upgradeDef, rarity) {
  const stat = upgradeDef.stat;

  if (stat === "projectiles") {
    const baseVal = inferPermanentBase(player, "projectiles") || 1;
    const deltaByTier = { 4: 2, 5: 4 };
    let newBase = baseVal + (deltaByTier[rarity.tier] ?? 2);
    if (newBase % 2 === 0) newBase += 1; // keep odd for symmetric spread
    setPermanentBaseAndRecompute(player, "projectiles", newBase);
    console.log(`Upgraded projectiles → base=${newBase}, visible=${player.projectiles}`);
    return;
  }

  const baseMult = statScaling[stat] ?? 1.0;

  if (additiveStats.includes(stat)) {
    const baseVal = inferPermanentBase(player, stat) || 0;
    let newBase = baseVal + rarity.multiplier * baseMult;
    if (stat === "critChance" || stat === "luck") newBase = Math.min(1, newBase);
    setPermanentBaseAndRecompute(player, stat, newBase);
    console.log(`Upgraded ${stat} → base=${newBase}, visible=${player[stat]}`);
    return;
  }

  const baseVal = inferPermanentBase(player, stat) || 0;
  const delta = baseVal * rarity.multiplier * baseMult;

  if (stat === "dashCooldown" || stat === "attackSpeed") {
    const newBase = Math.max(0.05, baseVal - delta); // smaller = better
    setPermanentBaseAndRecompute(player, stat, newBase);
    console.log(`Upgraded ${stat} → base=${newBase}, visible=${player[stat]}`);
  } else {
    const newBase = baseVal + delta;
    setPermanentBaseAndRecompute(player, stat, newBase);
    console.log(`Upgraded ${stat} → base=${newBase}, visible=${player[stat]}`);
  }
}

/**
 * maybeShowUpgrade(k, player, sharedState, score, nextThresholdRef, addScore)
 * - when score passes threshold, picks 3 unique upgrades (with rarity rules) and shows UI
 */
export function maybeShowUpgrade(k, player, sharedState, score, nextThresholdRef, addScore) {
  if (sharedState.upgradeOpen) return;
  if (score < nextThresholdRef.value) return;

  sharedState.isPaused = true;
  sharedState.upgradeOpen = true;

  const pool = [...upgrades];
  const chosen = [];

  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const upgrade = pool.splice(idx, 1)[0];
    const rarity = rollRarityFor(upgrade.stat);
    chosen.push(formatUpgrade(upgrade, rarity));
  }

  showUpgradeUI(k, chosen, (picked) => {
    if (picked === "skip") {
      addScore(10);
    } else {
      applyUpgrade(player, picked, picked.rarity);
    }
    cleanupUpgradeUI(k);
    sharedState.isPaused = false;
    sharedState.upgradeOpen = false;
  });

  nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.3) + 10;
}
