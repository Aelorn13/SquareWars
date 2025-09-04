// components/boss/brain.js

import {
  SUMMON_COOLDOWN,
  SHOOT_COOLDOWN,
  CHARGE_COOLDOWN,
  PHASE_COLORS,
  VULNERABILITY_DURATION, // Ensure this is imported for the vulnerability logic
} from "./constants.js";
import { updateTelegraph } from "./utils.js";
import {
  bossSummonMinions,
  bossSpreadShot,
  startCharge,
  updateChargeState
} from "./abilities.js";

/**
 * Contains the main AI logic for the boss, handling phase transitions, abilities, and cooldowns.
 * This function should be called within the boss's onUpdate loop.
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 * @param {object} player - The player game object.
 * @param {function} updateHealthBar - Function to update the player's health bar.
 * @param {function} updateScoreLabel - Function to update the score display.
 * @param {function} increaseScore - Function to increase the player's score.
 * @param {object} sharedState - Global game state object (e.g., for pause status).
 */
export function bossBrainUpdate(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState) {
  // If game is paused or boss is dead, do nothing
  if (sharedState.isPaused || boss.dead) return;

  updateTelegraph(k, boss);

  // --- Phase Transitions ---
  const hpRatio = boss.hp() / boss.maxHp;
  const previousPhase = boss.phase;

  if (hpRatio <= 0.6 && boss.phase === 1) {
    boss.phase = 2;
    boss.speed *= 1.2;
  }
  if (hpRatio <= 0.3 && boss.phase === 2) {
    boss.phase = 3;
    boss.speed *= 1.4;
  }

  if (boss.phase !== previousPhase) {
    boss.originalColor = PHASE_COLORS[boss.phase];
    if (!boss.isVulnerable) {
      boss.use(k.color(k.rgb(...boss.originalColor)));
    }
  }

  // --- Cooldown Management ---
  boss.cooldowns.summon -= k.dt();
  boss.cooldowns.shoot -= k.dt();
  boss.cooldowns.charge -= k.dt();

  // --- Ability Activation Logic ---
  if (boss.cooldowns.summon <= 0) {
    let minionCount;
    if (boss.phase === 1) minionCount = 3;
    else if (boss.phase === 2) minionCount = 5;
    else minionCount = 8;

    bossSummonMinions(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, minionCount);
    boss.cooldowns.summon = SUMMON_COOLDOWN;
  }

  if (boss.phase >= 2 && boss.cooldowns.shoot <= 0) {
    let bulletDamage = 2;
    let bulletSpeed = 120;
    let bulletCount = 12;

    if (boss.phase === 3) {
      bulletDamage = 3;
      bulletSpeed = 160;
      bulletCount = 18;
    }

    bossSpreadShot(k, boss, sharedState, bulletDamage, bulletSpeed, bulletCount);
    boss.cooldowns.shoot = SHOOT_COOLDOWN;
  }

  const canCharge = boss.cooldowns.charge <= 0 && boss.chargeState === "idle";
  if (canCharge) {
    if (boss.phase === 1) {
      startCharge(k, boss, player);
      boss.cooldowns.charge = CHARGE_COOLDOWN;
    } else if (boss.phase === 3) {
      startCharge(k, boss, player);
      boss.cooldowns.charge = CHARGE_COOLDOWN * 2;
    }
  }

  updateChargeState(k, boss);
}