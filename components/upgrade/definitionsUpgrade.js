// Definitions, tuning knobs and rarity utilities.

/** Rarities (weights used for rolling) */
export const rarities = [
  { name: "Common",    color: [255, 255, 255], tier: 1, multiplier: 0.1, weight: 50 },
  { name: "Uncommon",  color: [0, 255, 0],     tier: 2, multiplier: 0.2, weight: 25 },
  { name: "Rare",      color: [0, 0, 255],     tier: 3, multiplier: 0.3, weight: 15 },
  { name: "Epic",      color: [128, 0, 128],   tier: 4, multiplier: 0.4, weight: 8  },
  { name: "Legendary", color: [255, 165, 0],   tier: 5, multiplier: 0.5, weight: 2  },
];

/** Per-stat scaling multipliers: tune how big a rarity.multiplier actually is for each stat */
export const statScaling = {
  damage: 1.0,
  speed: 0.8,
  luck: 0.4,
  bulletSpeed: 3,
  attackSpeed: 0.5,
  dashDuration: 3.0,
  dashCooldown: 1.5,
  critChance: 0.5,
  critMultiplier: 2,
  // projectiles handled specially in apply logic
};

/** Upgrade definitions shown to the player */
export const upgrades = [
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

/** Which stats are additive (flat points) vs multiplicative/scaling */
export const additiveStats = ["luck", "critChance"];

/* ----------------- Rarity roll helpers ----------------- */

/**
 * rollRarityFrom(list)
 * - weighted random pick using the `weight` field of items
 */
export function rollRarityFrom(list) {
  const pool = (list && list.length) ? list : rarities;
  const totalWeight = pool.reduce((s, r) => s + (r.weight ?? 1), 0);
  if (totalWeight <= 0) return pool[0];
  let roll = Math.random() * totalWeight;
  for (const r of pool) {
    roll -= r.weight ?? 1;
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

/**
 * rollRarityFor(stat)
 * - special-case: projectiles only come in Epic+Legendary
 */
export function rollRarityFor(stat) {
  if (stat === "projectiles") {
    const highTier = rarities.filter(r => r.tier >= 4);
    return rollRarityFrom(highTier);
  }
  return rollRarityFrom(rarities);
}

/* ----------------- UI formatting ----------------- */

/**
 * formatUpgrade(upgradeDef, rarity)
 * - transforms internal upgrade data into the compact format expected by UI
 */
export function formatUpgrade(upgrade, rarity) {
  if (upgrade.stat === "projectiles") {
    const deltaByTier = { 4: 2, 5: 4 };
    const delta = deltaByTier[rarity.tier] ?? 2;
    return {
      ...upgrade,
      bonusText: `+${delta} projectiles`,
      color: rarity.color,
      rarity,
    };
  }

  const baseMult = statScaling[upgrade.stat] ?? 1.0;
  const isInverse = upgrade.stat === "dashCooldown";
  const changePct = rarity.multiplier * baseMult * 100;
  const displayPct = isInverse ? -changePct : changePct;

  return {
    ...upgrade,
    bonusText: `${displayPct > 0 ? "+" : ""}${Math.round(displayPct)}%`,
    color: rarity.color,
    rarity,
  };
}
