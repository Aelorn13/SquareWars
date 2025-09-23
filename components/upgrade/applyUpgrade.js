// components/upgrade/applyUpgrade.js
import { showUpgradeUI, cleanupUpgradeUI } from "../ui/upgradeUI.js";
import { UPGRADE_CONFIG, rollRarityForStat, formatUpgradeForUI } from "./upgradeConfig.js";
import { getPermanentBaseStat, applyPermanentUpgrade } from "./statManager.js";
import { attachBuffManager } from "../buffManager.js";

/**
 * Flexible signature:
 *  applyUpgrade(player, chosenUpgrade)
 *  applyUpgrade(k, player, chosenUpgrade)
 *
 * chosenUpgrade may be:
 *  - an object { stat, rarity }
 *  - a statName string (rarity will be rolled automatically)
 */
export function applyUpgrade(...args) {
  let k, player, chosenUpgrade;
  if (args.length === 3) {
    [k, player, chosenUpgrade] = args;
  } else if (args.length === 2) {
    [player, chosenUpgrade] = args;
    k = window.k ?? player.k ?? globalThis.k;
  } else {
    console.warn("applyUpgrade: invalid arguments", args);
    return;
  }

  if (!player) {
    console.warn("applyUpgrade: missing player");
    return;
  }

  // Normalize chosenUpgrade
  let statName, rarity;
  if (typeof chosenUpgrade === "string") {
    statName = chosenUpgrade;
    rarity = rollRarityForStat(statName);
  } else if (chosenUpgrade && typeof chosenUpgrade === "object") {
    statName = chosenUpgrade.stat ?? chosenUpgrade.name ?? null;
    rarity = chosenUpgrade.rarity ?? (statName ? rollRarityForStat(statName) : undefined);
  } else {
    console.warn("applyUpgrade: invalid chosenUpgrade", chosenUpgrade);
    return;
  }

  const statConfig = UPGRADE_CONFIG[statName];
  if (!statConfig) {
    console.warn("applyUpgrade: unknown stat", statName);
    return;
  }

  // Ensure player has buff manager (some handlers expect this)
  attachBuffManager(k, player);

  // generate stable-ish source id for effects
  const sourceId = player.id ?? player._id ?? player.name ?? `p_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  // Special: multi-projectiles
  if (statName === "projectiles") {
    const currentBase = getPermanentBaseStat(player, "projectiles") || 1;
    const bonus = statConfig.bonuses?.[rarity?.tier] ?? 2;
    let newBase = currentBase + bonus;
    // keep odd number for symmetric spread if that's intended by gameplay
    if (newBase % 2 === 0) newBase += 1;
    applyPermanentUpgrade(player, "projectiles", newBase);
    return;
  }

  // Effect upgrades
  if (statConfig?.isEffect) {
    player._projectileEffects ??= [];

    // Use explicit per-tier bonuses if present
    let params = {};
    if (statConfig.bonuses && rarity && statConfig.bonuses[rarity.tier]) {
      params = { ...statConfig.bonuses[rarity.tier] };
    } else {
      const strength = (rarity?.multiplier ?? 0) * (statConfig.scale ?? 1);
      if (statConfig.effectType === "burn") {
        params.damagePerTick = Math.max(0.1, strength);
        params.duration = Math.max(1, Math.round(1 + strength * 3));
        params.tickInterval = 1;
      } else if (statConfig.effectType === "knockback") {
        params.force = Math.round(150 + strength * 300);
        params.duration = 0.12;
      } else if (statConfig.effectType === "slow") {
        params.slowFactor = Math.min(0.9, 0.15 + strength * 0.6);
        params.duration = Math.max(0.5, 1 + strength * 2.0);
      } else if (statConfig.effectType === "ricochet") {
        params.bounces = 1 + Math.floor(strength * 3);
        params.spread = 20;
      } else {
        params.value = strength;
      }
    }

    const newEffect = {
      type: statConfig.effectType,
      params,
      sourceUpgrade: statName,
      rarity,
      source: player,
      sourceId,
      k,
    };

    if (statConfig.isUnique) {
      const idx = player._projectileEffects.findIndex((e) => e.type === statConfig.effectType);
      if (idx >= 0) player._projectileEffects[idx] = newEffect;
      else player._projectileEffects.push(newEffect);
    } else {
      player._projectileEffects.push(newEffect);
    }

    return;
  }

  // Numeric stats
  const currentBase = getPermanentBaseStat(player, statName);
  let newBaseValue;
  if (statConfig.isAdditive) {
    const delta = (rarity?.multiplier ?? 0) * statConfig.scale;
    newBaseValue = currentBase + delta;
  } else {
    const delta = currentBase * (rarity?.multiplier ?? 0) * statConfig.scale;
    newBaseValue = statConfig.isInverse ? currentBase - delta : currentBase + delta;
  }

  if (statConfig.cap !== undefined) {
    newBaseValue = statConfig.isInverse ? Math.max(statConfig.cap, newBaseValue) : Math.min(statConfig.cap, newBaseValue);
  }

  applyPermanentUpgrade(player, statName, newBaseValue);

  if (statName === "attackSpeed") {
    player._cosmetics?.updateAttackSpeedColor?.();
  }
}

/**
 * maybeShowUpgrade - builds 3 offers but excludes unique effects the player already owns.
 * no signature changes here (k, player, sharedState, currentScore, nextThresholdRef, addScore)
 */
export function maybeShowUpgrade(k, player, sharedState, currentScore, nextThresholdRef, addScore) {
  if (sharedState.upgradeOpen || currentScore < nextThresholdRef.value) return;

  sharedState.isPaused = true;
  sharedState.upgradeOpen = true;

  const ownedEffects = new Set((player._projectileEffects ?? []).map(e => e.type));
  const available = Object.keys(UPGRADE_CONFIG).filter((stat) => {
    const cfg = UPGRADE_CONFIG[stat];
    if (cfg?.isEffect && cfg?.isUnique && ownedEffects.has(cfg.effectType)) return false;
    return true;
  });

  const offered = [];
  for (let i = 0; i < 3 && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    const statName = available.splice(idx, 1)[0];
    const rarity = rollRarityForStat(statName);
    offered.push(formatUpgradeForUI(statName, rarity));
  }

  showUpgradeUI(k, offered, (picked) => {
    if (picked === "skip") addScore(10);
    else {
      // picked may be a formatted object or a stat string
      applyUpgrade(player, picked);
    }

    cleanupUpgradeUI(k);
    sharedState.isPaused = false;
    sharedState.upgradeOpen = false;
  });

  nextThresholdRef.value = Math.floor(nextThresholdRef.value * 1.3) + 10;
}
