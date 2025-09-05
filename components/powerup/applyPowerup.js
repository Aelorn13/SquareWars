/**
 * @file Handles the application of power-up effects to the player or game world.
 */

import { POWERUP_CONFIG, DEFAULT_POWERUP_DURATION } from "./powerupTypes.js";
import { applyTemporaryStatBuff } from "./powerupEffects/temporaryStatBuffEffect.js";
import { spawnShockwave } from "./powerupEffects/shockwaveEffect.js";

/**
 * Manages the invincibility buff, extending its duration if already active.
 * @param {object} k - The Kaboom.js context.
 * @param {object} player - The player entity.
 */
function handleInvincibilityBuff(k, player) {
  player._buffData = player._buffData || {};
  const buffKey = "invincibility";
  let activeBuff = player._buffData[buffKey];

  if (activeBuff) {
    // If already invincible, extend the duration and reset the removal timer.
    activeBuff.endTime += DEFAULT_POWERUP_DURATION * 1000;
    activeBuff.removalTimer.cancel();
  } else {
    // If not, apply the effect for the first time.
    player.isInvincible = true;
    const flashEffect = k.loop(0.1, () => (player.hidden = !player.hidden));
    activeBuff = {
      endTime: Date.now() + DEFAULT_POWERUP_DURATION * 1000,
      flashEffect: flashEffect,
    };
    player._buffData[buffKey] = activeBuff;
  }

  // Schedule the removal of the invincibility effect.
  const remainingDurationMs = Math.max(0, activeBuff.endTime - Date.now());
  activeBuff.removalTimer = k.wait(remainingDurationMs / 1000, () => {
    player.isInvincible = false;
    player.hidden = false;
    activeBuff.flashEffect.cancel();
    delete player._buffData[buffKey];
  });
}

/**
 * Applies a power-up effect to the player based on its type from the configuration.
 * @param {object} k - The Kaboom.js context.
 * @param {object} player - The player entity.
 * @param {string} powerUpType - The type of power-up to apply (e.g., "SPEED").
 * @param {object} gameContext - The shared game context object.
 * @param {function} [onHeal] - Optional callback for heal power-ups.
 */
export function applyPowerUp(k, player, powerUpType, gameContext, onHeal) {
  const config = POWERUP_CONFIG[powerUpType];

  if (!config || !config.effects) {
    console.warn(`applyPowerUp: No configuration found for type: ${powerUpType}`);
    return;
  }

  // Iterate over all effects defined for this power-up.
  for (const effect of config.effects) {
    switch (effect.type) {
      case 'statBuff':
        applyTemporaryStatBuff(k, player, effect.stat, effect.value, DEFAULT_POWERUP_DURATION, effect.mode);
        break;

      case 'heal':
        player.heal(effect.amount);
        onHeal?.();
        break;

      case 'shockwave':
        spawnShockwave(k, player.pos, {
          damage: effect.damage,
          maxRadius: effect.maxRadius,
        });
        k.shake(12);
        break;

      case 'invincibility':
        handleInvincibilityBuff(k, player);
        break;

      default:
        console.warn(`applyPowerUp: Unknown effect type: ${effect.type}`);
        break;
    }
  }
}