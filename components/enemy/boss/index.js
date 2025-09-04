// components/boss/index.js (formerly components/enemy/boss.js)

import {
  SUMMON_COOLDOWN,
  SHOOT_COOLDOWN,
  CHARGE_COOLDOWN,
  PHASE_COLORS,
} from "./constants.js";
import { bossBrainUpdate } from "./brain.js";

/**
 * Attaches the main AI logic to the boss game object.
 * This includes handling phase transitions, abilities, cooldowns, and charge mechanics.
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 * @param {object} player - The player game object.
 * @param {function} updateHealthBar - Function to update the player's health bar.
 * @param {function} updateScoreLabel - Function to update the score display.
 * @param {function} increaseScore - Function to increase the player's score.
 * @param {object} sharedState - Global game state object (e.g., for pause status).
 */
export function attachBossBrain(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState) {
  // --- Global Collision Handler for Boss Bullets ---
  // Ensure this handler is only registered once globally to prevent multiple executions.
  if (!sharedState._bossBulletHook) {
    sharedState._bossBulletHook = true; // Mark as registered
    k.onCollide("player", "bossBullet", (p, bullet) => {
      if (p.isInvincible) return;

      p.hurt(bullet.damage ?? 2);
      updateHealthBar?.();
      k.destroy(bullet);

      if (p.hp() <= 0) {
        k.go("gameover");
      }
    });
  }

  // --- Initialise Boss State ---
  boss.phase = 1;
  boss.cooldowns = {
    summon: SUMMON_COOLDOWN,
    shoot: SHOOT_COOLDOWN,
    charge: CHARGE_COOLDOWN,
  };
  boss.chargeState = "idle";
  boss.chargeTimer = 0;
  boss.chargeDirection = k.vec2(0, 0);
  boss.isVulnerable = false;

  boss.originalColor = PHASE_COLORS[1];
  boss.use(k.color(k.rgb(...boss.originalColor)));

  // --- Boss Update Loop ---
  boss.onUpdate(() => {
    bossBrainUpdate(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState);
  });
}