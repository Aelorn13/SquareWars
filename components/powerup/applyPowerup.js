//components/powerup/applyPowerup.js
/**
 * @file Handles the application of power-up effects to the player or game world.
 */

import { POWERUP_CONFIG, DEFAULT_POWERUP_DURATION } from "./powerupTypes.js";
import { applyTemporaryStatBuff, applyInvincibility } from "./powerupEffects/temporaryStatBuffEffect.js";
import { spawnShockwave } from "./powerupEffects/shockwaveEffect.js";

/**
 * Applies a power-up effect to the player based on its type from the configuration.
 */
export function applyPowerUp(k, player, powerUpType, gameContext, onHeal) {
  const config = POWERUP_CONFIG[powerUpType];

  if (!config || !config.effects) {
    console.warn(`applyPowerUp: No configuration found for type: ${powerUpType}`);
    return;
  }

  for (const effect of config.effects) {
    switch (effect.type) {
      case 'statBuff':
        applyTemporaryStatBuff(
          k,
          player,
          effect.stat,
          effect.value,
          DEFAULT_POWERUP_DURATION,
          effect.mode,
          gameContext 
        );
        break;

      case 'heal':
        player.heal(effect.amount);
        onHeal?.();
        break;

      case 'shockwave':
        spawnShockwave(k, player.pos, {
          damage: effect.damage,
          maxRadius: effect.maxRadius,
          sharedState :gameContext.sharedState
        });
        k.shake(12);
        break;

      case 'invincibility':
        applyInvincibility(k, player, DEFAULT_POWERUP_DURATION, gameContext);
        break;

      default:
        console.warn(`applyPowerUp: Unknown effect type: ${effect.type}`);
        break;
    }
  }
}