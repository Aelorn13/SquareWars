import { POWERUP_TYPES, DURATION_POWERBUFF } from "./powerupTypes.js";
import { spawnPowerUp } from "./spawnPowerup.js";
import { applyTemporaryStatBuff} from "./powerupEffects/temporaryStatBuffEffect.js";
import { spawnShockwave } from "./powerupEffects/shockwaveEffect.js";

export { POWERUP_TYPES, DURATION_POWERBUFF, spawnPowerUp };

// A small helper to ensure player._buffData exists
function ensureBuffData(player) {
  if (!player._buffData) {
    player._buffData = {};
  }
}

/**
 * Manages the invincibility buff for a player.
 * Applies invincibility, sets up a visual flash, and schedules its removal.
 * If invincibility is already active, it extends the duration.
 * @param {object} k - The game engine instance (e.g., Kaboom.js 'k').
 * @param {object} player - The player object to apply the buff to.
 */
function handleInvincibilityBuff(k, player) {
  ensureBuffData(player);

  const buffKey = "invincibility";
  let buff = player._buffData[buffKey];

  if (!buff) {
    // Apply initial invincibility
    player.isInvincible = true;
    // Create a flashing effect for visual feedback
    const flashEffect = k.loop(0.1, () => (player.hidden = !player.hidden));

    buff = {
      // Calculate the end time for the buff
      endTime: Date.now() + DURATION_POWERBUFF * 1000,
      // Placeholder for the timer that will remove the buff
      removalTimer: null,
      // Store the flashing effect to cancel it later
      flashEffect,
    };
    player._buffData[buffKey] = buff;
  } else {
    // If already invincible, extend the duration
    buff.endTime += DURATION_POWERBUFF * 1000;
  }

  // Schedule or reschedule the buff removal
  if (buff.removalTimer) {
    buff.removalTimer.cancel?.(); // Cancel any existing timer to prevent duplicates
  }

  const remainingDurationMs = Math.max(0, buff.endTime - Date.now());
  // Set a new timer to remove the buff after the calculated duration
  buff.removalTimer = k.wait(Math.max(0.001, remainingDurationMs / 1000), () => {
    player.isInvincible = false;
    player.hidden = false; // Ensure player is visible again
    buff.flashEffect.cancel?.(); // Stop the flashing effect
    delete player._buffData[buffKey]; // Clean up buff data
  });
}

/**
 * applyPowerUp(k, player, powerUpType, onHealPickup)
 * - Applies various power-ups to the player based on the type.
 * - Uses applyTemporaryStatBuff() for timed effects (stacking duration).
 * - Handles specific logic for heal and invincibility power-ups.
 * @param {object} k - The game engine instance (e.g., Kaboom.js 'k').
 * @param {object} player - The player object to apply the power-up to.
 * @param {string} powerUpType - The type of power-up to apply (e.g., "heal", "invincibility").
 * @param {function} [onHealPickup] - Optional callback function to execute when a "heal" power-up is picked up.
 */
export function applyPowerUp(k, player, powerUpType, onHealPickup) {
  switch (powerUpType) {
    case POWERUP_TYPES.HEAL: // Using defined constants is generally better
      player.heal?.(2);
      onHealPickup?.(); // Execute callback if provided
      break;

    case POWERUP_TYPES.INVINCIBILITY:
      handleInvincibilityBuff(k, player); // Delegate invincibility logic
      break;

    case POWERUP_TYPES.RAPID_FIRE:
      // Increase attack speed by 40%
      applyTemporaryStatBuff(k, player, "attackSpeed", 0.4, DURATION_POWERBUFF);
      break;

    case POWERUP_TYPES.DAMAGE:
      // Increase damage by 1 (additive)
      applyTemporaryStatBuff(k, player, "damage", 1, DURATION_POWERBUFF, "additive");
      break;

    case POWERUP_TYPES.SPEED:
      // Increase movement speed by 2
      applyTemporaryStatBuff(k, player, "speed", 2, DURATION_POWERBUFF);
      // Reduce dash cooldown by 30%
      applyTemporaryStatBuff(k, player, "dashCooldown", 0.3, DURATION_POWERBUFF);
      break;

    case POWERUP_TYPES.ALWAYS_CRIT:
      // Set critical chance to 100% (absolute value)
      applyTemporaryStatBuff(k, player, "critChance", 1, DURATION_POWERBUFF, "absolute");
      break;

    case POWERUP_TYPES.TRIPLE_PROJECTILES:
      // Add 2 extra projectiles (resulting in 3 total with base 1)
      applyTemporaryStatBuff(k, player, "projectiles", 2, DURATION_POWERBUFF, "additive");
      break;

    case POWERUP_TYPES.BOMB:
      // Spawn a shockwave effect for visual and damage to current enemies
      spawnShockwave(k, player.pos, {
        damage: 5,
        maxRadius: 320,
        speed: 560,
        segments: 28,
        segSize: 10
      });
      break;

    default:
      console.warn(`applyPowerUp: Unknown power-up type encountered: ${powerUpType}`);
      break;
  }
}