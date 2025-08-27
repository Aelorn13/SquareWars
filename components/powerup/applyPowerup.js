import { POWERUP_TYPES, DURATION_POWERBUFF } from "./powerupTypes.js";
import { spawnPowerUp } from "./spawnPowerup.js";
import { applyTemporaryStatBuff, spawnShockwave } from "./applyEffect.js";

export { POWERUP_TYPES, DURATION_POWERBUFF, spawnPowerUp };

/**
 * applyPowerUp(k, player, type, onHealPickup)
 * - keeps behaviour compatible with your previous code
 * - uses applyTemporaryStatBuff() for timed effects (stacking duration)
 */
export function applyPowerUp(k, player, type, onHealPickup) {
  switch (type) {
    case "heal":
      player.heal?.(2);
      onHealPickup?.();
      break;

    case "invincibility": {
      if (!player._buffData) player._buffData = {};
      if (!player._buffData.invincible) {
        player.isInvincible = true;
        const flash = k.loop(0.1, () => (player.hidden = !player.hidden));
        player._buffData.invincible = {
          endTime: Date.now() + DURATION_POWERBUFF * 1000,
          timer: null,
          flash,
        };

        const schedule = () => {
          const data = player._buffData.invincible;
          if (!data) return;
          const remainingMs = Math.max(0, data.endTime - Date.now());
          if (data.timer) data.timer.cancel?.();
          data.timer = k.wait(Math.max(0.001, remainingMs / 1000), () => {
            player.isInvincible = false;
            player.hidden = false;
            data.flash.cancel?.();
            delete player._buffData.invincible;
          });
        };
        schedule();
      } else {
        // extend duration
        player._buffData.invincible.endTime += DURATION_POWERBUFF * 1000;
        // reschedule
        const data = player._buffData.invincible;
        if (data.timer) data.timer.cancel?.();
        const remainingMs = Math.max(0, data.endTime - Date.now());
        data.timer = k.wait(Math.max(0.001, remainingMs / 1000), () => {
          player.isInvincible = false;
          player.hidden = false;
          data.flash.cancel?.();
          delete player._buffData.invincible;
        });
      }
      break;
    }

    case "rapidFire":
      applyTemporaryStatBuff(k, player, "attackSpeed", 0.4, DURATION_POWERBUFF);
      break;

    case "damage":
      applyTemporaryStatBuff(k, player, "damage", 1, DURATION_POWERBUFF, "additive");
      break;

    case "speed":
      applyTemporaryStatBuff(k, player, "speed", 2, DURATION_POWERBUFF);
      applyTemporaryStatBuff(k, player, "dashCooldown", 0.3, DURATION_POWERBUFF);
      break;

    case "alwaysCrit":
      applyTemporaryStatBuff(k, player, "critChance", 1, DURATION_POWERBUFF, "absolute");
      break;

    case "tripleProjectiles":
      applyTemporaryStatBuff(k, player, "projectiles", 2, DURATION_POWERBUFF,"additive");
      break;

    case "bomb":
      // visual + damage to current enemies only (snapshot)
      spawnShockwave(k, player.pos, { damage: 5, maxRadius: 320, speed: 560, segments: 28, segSize: 10 });
      break;

    default:
      console.warn("applyPowerUp: unknown type", type);
      break;
  }
}
