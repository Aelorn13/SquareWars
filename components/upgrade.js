// components/upgrade.js
import { showUpgradeUI, cleanupUpgradeUI } from "./ui/upgradeUI.js";

export const rarities = [
  { name: "Common",    color: [255, 255, 255], tier: 1, multiplier: 0.10, weight: 50 },
  { name: "Uncommon",  color: [0, 255, 0],     tier: 2, multiplier: 0.20, weight: 25 },
  { name: "Rare",      color: [0, 0, 255],     tier: 3, multiplier: 0.30, weight: 15 },
  { name: "Epic",      color: [128, 0, 128],   tier: 4, multiplier: 0.40, weight: 8  },
  { name: "Legendary", color: [255, 165, 0],   tier: 5, multiplier: 0.50, weight: 2  },
];

// %-style multipliers (non-additive)
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
  // projectiles is handled as a special-case (flat +2 / +4)
};

export const upgrades = [
  { stat: "damage",        name: "Damage Boost",     icon: "🔫" },
  { stat: "speed",         name: "Move Speed",       icon: "🏃" },
  { stat: "luck",          name: "Luck",             icon: "🍀" },
  { stat: "bulletSpeed",   name: "Bullet Speed",     icon: "💨" },
  { stat: "attackSpeed",   name: "Attack Speed",     icon: "⚡" },
  { stat: "dashDuration",  name: "Dash Duration",    icon: "⏱️" },
  { stat: "dashCooldown",  name: "Dash Cooldown",    icon: "♻️" },
  { stat: "critChance",    name: "Critical Chance",  icon: "🎯" },
  { stat: "critMultiplier",name: "Critical Damage",  icon: "💥" },
  { stat: "projectiles",   name: "Multi-Shot",       icon: "🔱" }, // NEW
];

const additiveStats = ["luck", "critChance"];

// --- Rarity rolling helpers (use weights from `rarities`) ---
function rollRarityFrom(list) {
  const pool = list.length ? list : rarities;
  const total = pool.reduce((s, r) => s + (r.weight ?? 1), 0);
  if (total <= 0) return pool[0];

  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= (r.weight ?? 1);
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

function rollRarityFor(stat) {
  // Multi-Shot only: Epic or Legendary, but still use their configured weights
  if (stat === "projectiles") {
    const allowed = rarities.filter((r) => r.tier >= 4); // Epic (4), Legendary (5)
    return rollRarityFrom(allowed);
  }
  // Everything else: any rarity by weight
  return rollRarityFrom(rarities);
}

// --- UI formatting ---
function formatUpgrade(upgradeDef, rarity) {
  const stat = upgradeDef.stat;

  if (stat === "projectiles") {
    const deltaByTier = { 4: 2, 5: 4 }; // Epic:+2, Legendary:+4
    const delta = deltaByTier[rarity.tier] ?? 2;
    return {
      icon: upgradeDef.icon,
      name: upgradeDef.name,
      bonusText: `+${delta} projectiles`,
      color: rarity.color,
      upgradeDef,
      rarity,
    };
  }

  const baseMult = statMultipliers[stat] ?? 1.0;
  const isInverse = stat === "dashCooldown";
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

    const available = [...upgrades];
    const chosen = [];
    for (let i = 0; i < 3 && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const upgradeDef = available.splice(idx, 1)[0];
      const rarity = rollRarityFor(upgradeDef.stat);
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

    nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.3) + 10;
  }
}

export function applyUpgrade(player, upgradeDef, rarity) {
  const stat = upgradeDef.stat;

  if (stat === "projectiles") {
    if (player.projectiles == null) player.projectiles = 1;
    const deltaByTier = { 4: 2, 5: 4 };
    const delta = deltaByTier[rarity.tier] ?? 2;
    player.projectiles += delta;
    if (player.projectiles % 2 === 0) player.projectiles += 1; // keep odd for symmetric spread
    console.log(`Upgraded projectiles → ${player.projectiles}`);
    return;
  }

  const baseMult = statMultipliers[stat] ?? 1.0;

  if (additiveStats.includes(stat)) {
    const change = rarity.multiplier * baseMult; // add as percentage points (0..1)
    player[stat] = Math.min(1, (player[stat] ?? 0) + change);
    console.log(`Upgraded ${stat} → ${player[stat]}`);
    return;
  }

  const change = (player[stat] ?? 0) * rarity.multiplier * baseMult;

  if (stat === "dashCooldown" || stat === "attackSpeed") {
    player[stat] = Math.max(0.05, (player[stat] ?? 0) - change);
  } else {
    player[stat] = (player[stat] ?? 0) + change;
  }

  console.log(`Upgraded ${stat} → ${player[stat]}`);
}
