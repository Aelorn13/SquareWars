// components/upgrade.js
import { showUpgradeUI, cleanupUpgradeUI } from "./ui/upgradeUI.js";

export const rarities = [
  { name: "Common", color: [255, 255, 255], tier: 1, multiplier: 0.1 },
  { name: "Uncommon", color: [0, 255, 0], tier: 2, multiplier: 0.2 },
  { name: "Rare", color: [0, 0, 255], tier: 3, multiplier: 0.3 },
  { name: "Epic", color: [128, 0, 128], tier: 4, multiplier: 0.4 },
  { name: "Legendary", color: [255, 165, 0], tier: 5, multiplier: 0.5 },
];

// Different base multipliers per stat
const statMultipliers = {
  damage: 1.0, 
  speed: 0.8, 
  luck: 0.4,
  bulletSpeed: 1, 
  attackSpeed: 0.5,
  dashDuration: 2.0,
  dashCooldown: 1,
  critChance: 0.5,
  critMultiplier: 2,
};

export const upgrades = [
  { stat: "damage", name: "Damage Boost", icon: "🔫" },
  { stat: "speed", name: "Move Speed", icon: "🏃" },
  { stat: "luck", name: "Luck", icon: "🍀" },
  { stat: "bulletSpeed", name: "Bullet Speed", icon: "💨" },
  { stat: "attackSpeed", name: "Attack Speed", icon: "⚡" },
  { stat: "dashDuration", name: "Dash Duration", icon: "⏱️" },
  { stat: "dashCooldown", name: "Dash Cooldown", icon: "♻️" },
  { stat: "critChance", name: "Critical Chance", icon: "🎯" },
  { stat: "critMultiplier", name: "Critical Damage", icon: "💥" },
];
const additiveStats = ["luck", "critChance"];

// Weighted rarity roll
function rollRarity() {
  const roll = Math.random();
  if (roll < 0.5) return rarities[0]; // 50%
  if (roll < 0.75) return rarities[1]; // 25%
  if (roll < 0.9) return rarities[2]; // 15%
  if (roll < 0.98) return rarities[3]; // 8%
  return rarities[4]; // 2%
}

// Format upgrade into what UI expects
function formatUpgrade(upgradeDef, rarity) {
  const stat = upgradeDef.stat;
  const baseMult = statMultipliers[stat] ?? 1.0;
  const isInverse = stat === "dashCooldown";

  // Calculate percentage change
  const changePct = rarity.multiplier * baseMult * 100;
  const displayChange = isInverse ? -changePct : changePct;

  return {
    icon: upgradeDef.icon,
    name: upgradeDef.name,
    bonusText: `${displayChange > 0 ? "+" : ""}${Math.round(displayChange)}%`,
    color: rarity.color,
    upgradeDef,
    rarity,
  };
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
      chosen.push(formatUpgrade(upgradeDef, rarity));
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
    nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.5) + 5;
  }
}

export function applyUpgrade(player, upgradeDef, rarity) {
  const stat = upgradeDef.stat;
  const baseMult = statMultipliers[stat] ?? 1.0;

  let change;

  if (additiveStats.includes(stat)) {
    // Additive: increase by a flat fraction of 1 (e.g., 5% per Common)
    change = rarity.multiplier * baseMult; 
    player[stat] += change;

    // Clamp between 0 and 1
    if (player[stat] > 1) player[stat] = 1;
  } else {
    // Multiplicative / scaling for other stats
    change = player[stat] * rarity.multiplier * baseMult;

    if (stat === "dashCooldown" || stat === "attackSpeed") {
      player[stat] -= change;
      if (player[stat] < 0.05) player[stat] = 0.05;
    } else {
      player[stat] += change;
    }
  }

  console.log(`Upgraded ${stat} → ${player[stat]}`);
}


