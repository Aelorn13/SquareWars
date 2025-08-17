// components/upgrade.js
import { showUpgradeUI, cleanupUpgradeUI,updateScoreLabel } from "./ui.js";

export const rarities = [
  { name: "Common", color: [255, 255, 255], tier: 1, multiplier: 0.1 },
  { name: "Uncommon", color: [0, 255, 0], tier: 2, multiplier: 0.2 },
  { name: "Rare", color: [0, 0, 255], tier: 3, multiplier: 0.3 },
  { name: "Epic", color: [128, 0, 128], tier: 4, multiplier: 0.4 },
  { name: "Legendary", color: [255, 165, 0], tier: 5, multiplier: 0.5 },
];

export const upgrades = [
  { stat: "damage", name: "Damage Boost", icon: "🔫" },
  { stat: "speed", name: "Move Speed", icon: "🏃" },
  { stat: "luck", name: "Luck", icon: "🍀" },
  { stat: "bulletSpeed", name: "Bullet Speed", icon: "💨" },
  { stat: "attackSpeed", name: "Attack Speed", icon: "⚡" },
  { stat: "dashDuration", name: "Dash Duration", icon: "⏱️" },
  { stat: "dashCooldown", name: "Dash Cooldown", icon: "♻️" },
];

// Weighted rarity roll
function rollRarity() {
  const roll = Math.random();
  if (roll < 0.5) return rarities[0]; // 50%
  if (roll < 0.75) return rarities[1]; // 25%
  if (roll < 0.9) return rarities[2]; // 15%
  if (roll < 0.98) return rarities[3]; // 8%
  return rarities[4]; // 2%
}

export function maybeShowUpgrade(
  k,
  player,
  sharedState,
  score,
  nextThresholdRef,
  addScore
) {
  if (sharedState.upgradeOpen) return;

  if (score >= nextThresholdRef.value) {
    sharedState.isPaused = true;
    sharedState.upgradeOpen = true;

    // Pick 3 unique upgrades
    const available = [...upgrades];
    const chosen = [];
    for (let i = 0; i < 3 && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const upgradeDef = available.splice(idx, 1)[0]; // remove to avoid duplicates
      const rarity = rollRarity();
      chosen.push({ upgradeDef, rarity });
    }

    showUpgradeUI(k, chosen, (picked) => {
      if (picked === "skip") {
        addScore(10);
      } else {
        applyUpgrade(player, picked.upgradeDef, picked.rarity);
      }
      cleanupUpgradeUI(k);
      sharedState.isPaused = false;
      sharedState.upgradeOpen = false;
    });

    // Scale next threshold
    nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.5);
  }
}

export function applyUpgrade(player, upgradeDef, rarity) {
  const stat = upgradeDef.stat;
  const change = player[stat] * rarity.multiplier;

  if (stat === "dashCooldown" || stat === "attackSpeed") {
    // smaller is better for these stats
    player[stat] -= change;
    if (player[stat] < 0.05) player[stat] = 0.05; // clamp
  } else {
    // bigger is better
    player[stat] += change;
  }

  console.log(`Upgraded ${stat} → ${player[stat]}`);
}
