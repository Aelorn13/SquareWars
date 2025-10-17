// components/upgrade/upgradeConfig.js
// Centralized upgrade + rarity configuration + UI formatter

export const RARITY_CONFIG = [
  { name: "Common", color: [255, 255, 255], tier: 1, multiplier: 0.15, weight: 100 },
  { name: "Uncommon", color: [0, 255, 0], tier: 2, multiplier: 0.2, weight: 50 },
  { name: "Rare", color: [0, 0, 255], tier: 3, multiplier: 0.25, weight: 25 },
  { name: "Epic", color: [128, 0, 128], tier: 4, multiplier: 0.3, weight: 12 },
  { name: "Legendary", color: [255, 165, 0], tier: 5, multiplier: 0.4, weight: 5 },
];

export const UPGRADE_CONFIG = {
  damage: { name: "Damage Boost", icon: "🔫", scale: 1.0, description: "Increases damage of projectiles." },
  speed: { name: "Move Speed", icon: "🏃", scale: 0.8, description: "Increases player movement speed." },
  luck: {
    name: "Luck",
    icon: "🍀",
    scale: 0.5,
    isAdditive: true,
    cap: 1.0,
    description: "Increases chance of dropping a power-up.",
  },
  attackSpeed: {
    name: "Attack Interval",
    icon: "⚡",
    scale: 0.5,
    isInverse: true,
    cap: 0.05,
    description: "Reduces the interval between attacks.",
  },
  critChance: {
    name: "Critical Chance",
    icon: "🎯",
    scale: 0.5,
    isAdditive: true,
    cap: 1.0,
    description: "Increases chance of a critical strike.",
  },
  critMultiplier: {
    name: "Critical Damage",
    icon: "💥",
    scale: 2.0,
    description: "Increases damage of critical strikes.",
  },

  projectiles: {
    name: "Multi-Shot",
    icon: "🔱",
    isSpecial: true,
    bonuses: { 4: 2, 5: 4 },
    allowedTiers: [4, 5],
  },

  burnOnHit: {
    name: "Incendiary Rounds",
    icon: "🔥",
    isEffect: true,
    isUnique: true,
    effectType: "burn",
    allowedTiers: [3, 4, 5],
    bonuses: {
      3: { damagePerTick: 0.125, duration: 4, tickInterval: 0.5 },
      4: { damagePerTick: 0.25, duration: 4, tickInterval: 0.5 },
      5: { damagePerTick: 0.5, duration: 4, tickInterval: 0.5 },
    },
  },

  knockbackOnHit: {
    name: "Knockback Rounds",
    icon: "🛡️",
    isEffect: true,
    isUnique: true,
    effectType: "knockback",
    allowedTiers: [3, 4, 5],
    bonuses: {
      3: { force: 300, duration: 0.12 },
      4: { force: 500, duration: 0.16 },
      5: { force: 800, duration: 0.2 },
    },
  },

  slowOnHit: {
    name: "Chilling Rounds",
    icon: "🧊",
    isEffect: true,
    isUnique: true,
    effectType: "slow",
    allowedTiers: [3, 4, 5],
    bonuses: {
      3: { slowFactor: 0.25, duration: 3 },
      4: { slowFactor: 0.5, duration: 4 },
      5: { slowFactor: 0.75, duration: 5 }, 
    },
  },

  ricochet: {
    name: "Ricochet Rounds",
    icon: "🔁",
    isEffect: true,
    isUnique: true,
    effectType: "ricochet",
    allowedTiers: [3, 4, 5],
    bonuses: {
      3: { bounces: 1, spread: 10 },
      4: { bounces: 2, spread: 18 },
      5: { bounces: 3, spread: 26 },
    },
  },
  pierce: {
    name: "Piercing Rounds",
    icon: "🗡️",
    isEffect: true,
    isUnique: true,
    effectType: "pierce",
    allowedTiers: [3, 4, 5],
    bonuses: {
      3: { pierces: 1 },
      4: { pierces: 2 },
      5: { pierces: 3 },
    },
  },

  ghost: {
    name: "Ghost",
    icon: "👻",
    isEffect: true,
    isUnique: true,
    effectType: "ghost",
    allowedTiers: [4],
    // no numeric bonus needed; presence of the upgrade grants the behaviour
    bonuses: {
      4: {
        /* semantic placeholder */
      },
    },
  },
  improveDash: {
    name: "Improve Dash",
    icon: "💨",
    scale: 1,
  },
    bomberman: {
    name: "Bomberman",
    icon: "💣",
    isEffect: true,
    isUnique: true,
    effectType: "bomberman",
    allowedTiers: [5], // Legendary tier only
    bonuses: {
      5: {
        distanceTrigger: 800,
        damageMultiplier: 4,
        maxRadius: 350,
      },
    },
  },
};

/* ----------------- Rarity utilities (cached weights) ----------------- */

const _weightsCache = new WeakMap();

function _buildCache(pool) {
  const weights = pool.map((r) => Math.max(0, r.weight ?? 1));
  const total = weights.reduce((s, v) => s + v, 0);
  const entry = { weights, total };
  _weightsCache.set(pool, entry);
  return entry;
}

/**
 * rollWeightedRarity(rarityPool = RARITY_CONFIG)
 * Returns a shallow copy of the chosen rarity config.
 */
export function rollWeightedRarity(rarityPool = RARITY_CONFIG) {
  const cache = _weightsCache.get(rarityPool) ?? _buildCache(rarityPool);
  const total = cache.total;
  if (total <= 0) return { ...(rarityPool[0] ?? {}) };
  let v = Math.random() * total;
  for (let i = 0; i < rarityPool.length; i++) {
    v -= cache.weights[i];
    if (v <= 0) return { ...rarityPool[i] };
  }
  return { ...rarityPool[rarityPool.length - 1] };
}

export function rollRarityForStat(statName) {
  const cfg = UPGRADE_CONFIG[statName];
  const allowed = cfg?.allowedTiers;
  if (allowed) {
    const pool = RARITY_CONFIG.filter((r) => allowed.includes(r.tier));
    return rollWeightedRarity(pool);
  }
  return rollWeightedRarity();
}

/* ----------------- UI formatting: numeric descriptions ----------------- */

/**
 * formatUpgradeForUI(statName, rolledRarity)
 * Returns:
 *  { stat, name, icon, color, rarity, bonusText, description }
 */
export function formatUpgradeForUI(statName, rolledRarity) {
  const cfg = UPGRADE_CONFIG[statName];
  const rarityTier = rolledRarity?.tier ?? 1;
  const rarityMult = rolledRarity?.multiplier ?? 0;

  const out = {
    stat: statName,
    name: cfg?.name ?? statName,
    icon: cfg?.icon ?? "",
    color: rolledRarity?.color ?? [255, 255, 255],
    rarity: rolledRarity,
    isUnique: cfg?.isUnique ?? false,
    bonusText: "",
    description: "",
  };

  if (!cfg) {
    out.bonusText = "";
    out.description = `Tier ${rarityTier}`;
    return out;
  }

  // projectiles special
  if (cfg.isSpecial && statName === "projectiles") {
    const bonus = cfg.bonuses?.[rarityTier] ?? 0;
    out.bonusText = `+${bonus} projectiles`;
    out.description = `Fire ${bonus} extra projectiles`;
    return out;
  }

  // effect upgrades: produce numeric description using explicit bonuses if present
  if (cfg.isEffect) {
    const tierBon = cfg.bonuses?.[rarityTier] ?? {};
    switch (cfg.effectType) {
       case "bomberman": {
        const trigger = Number(tierBon.distanceTrigger ?? 400);
        const mult = Number(tierBon.damageMultiplier ?? 4);
        out.bonusText = `${cfg.name}`;
        out.description = `Spawns a shockwave every ${trigger} units moved, dealing ${mult}x damage.`;
        return out;
      }
      case "burn": {
        const dps = Number(tierBon.damagePerTick ?? 0);
        const dur = Number(tierBon.duration ?? 0);
        const tick = Number(tierBon.tickInterval ?? 0);
        out.bonusText = `${cfg.name}`;
        out.description = `Apply a stack of debuff that deals ${(dur / tick) * dps} damage over ${dur} per seconds`;
        return out;
      }
      case "knockback": {
        const force = Number(tierBon.force ?? 0);
        const dur = Number(tierBon.duration ?? 0);
        out.bonusText = `${cfg.name}`;
        out.description = `Pushes enemy (force ${force}) and stuns for ${dur}s`;
        return out;
      }
      case "slow": {
        const sf = Number(tierBon.slowFactor ?? 0);
        const dur = Number(tierBon.duration ?? 0);
        out.bonusText = `${cfg.name}`;
        out.description = `Reduces move speed by ${Math.round(sf * 100)}% for ${dur}s`;
        return out;
      }
      case "ricochet": {
        const b = Number(tierBon.bounces ?? 0);
        const sp = Number(tierBon.spread ?? 0);
        out.bonusText = `${cfg.name}`;
        out.description = `Ricochet: ${b} bounces, spread ${sp}°`;
        return out;
      }
      case "ghost": {
        out.bonusText = `${cfg.name}`;
        out.description = `While dashing you become invincible and phase through enemies.`;
        return out;
      }
      case "pierce": {
        const p = Number(tierBon.pierces ?? 0);
        out.bonusText = `${cfg.name}`;
        out.description = `Pierce: ${p} enemies`;
        return out;
      }
      default: {
        out.bonusText = `${cfg.name}`;
        out.description = `Effect (tier ${rarityTier})`;
        return out;
      }
    }
  }
  // Special combined dash upgrade
  if (statName === "improveDash") {
    const scaleVal = cfg?.scale ?? 0.5;
    const strength = (rarityMult ?? 0) * scaleVal;
    const durPct = Math.round(strength * 100);
    const cdPct = Math.round(strength * 100);
    out.bonusText = `${durPct > 0 ? "+" + durPct + "%" : "+0%"} / -${cdPct}%`;
    out.description = `Dash: +${durPct}% duration, -${cdPct}% cooldown`;
    return out;
  }

  // default numeric stat formatting
  if (cfg.scale !== undefined && cfg.description == undefined) {
    const rawChange = rarityMult * (cfg.scale ?? 0);
    if (cfg.isAdditive) {
      const pct = Math.round(rawChange * 100);
      out.bonusText = `+${pct}%`;
      out.description = `${cfg.name}: +${pct}%`;
    } else {
      const signed = cfg.isInverse ? -rawChange : rawChange;
      const pct = Math.round(signed * 100);
      out.bonusText = `${pct > 0 ? "+" : ""}${pct}%`;
      out.description = `${cfg.name}: ${pct > 0 ? "+" : ""}${pct}%`;
    }
    return out;
  }
  if (cfg.description) {
    const rawChange = rarityMult * (cfg.scale ?? 0);
    if (cfg.isAdditive) {
      const pct = Math.round(rawChange * 100);
      out.bonusText = `+${pct}%`;
      out.description = cfg.description;
    } else {
      const signed = cfg.isInverse ? -rawChange : rawChange;
      const pct = Math.round(signed * 100);
      out.bonusText = `${pct > 0 ? "+" : ""}${pct}%`;
      out.description = cfg.description;
    }
    return out;
  }

  // fallback
  out.bonusText = `${cfg.name}`;
  out.description = `${cfg.name} (tier ${rarityTier})`;
  return out;
}
