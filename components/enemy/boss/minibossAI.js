// components/enemy/boss/minibossAI.js
import { rotateTowardsPlayer, useAbilityHelper, attachProjectileDamageHandler } from "./bossAIcommon.js";

/**
 * Attach a miniboss brain.
 */
export function attachMinibossBrain(
  k,
  miniboss,
  player,
  gameContext,
  ability,
  scaling = {}
) {
  // Apply scaling
  if (scaling.hpMultiplier) {
    miniboss.maxHp *= scaling.hpMultiplier;
    miniboss.heal(miniboss.maxHp);
  }
  if (scaling.speedMultiplier) {
    miniboss.baseSpeed *= scaling.speedMultiplier;
    miniboss.speed = miniboss.baseSpeed;
  }

  // Init state
  miniboss.isBusy = false;
  miniboss.isVulnerable = false;
  miniboss.tag("miniboss");

  const COOLDOWN = 8;
  let cooldownTimer = COOLDOWN / 2;

  // Main update loop
  miniboss.onUpdate(() => {
    if (gameContext.sharedState.isPaused || miniboss.dead || miniboss.isBusy) {
      return;
    }

    cooldownTimer -= k.dt();

    if (cooldownTimer <= 0) {
      cooldownTimer = COOLDOWN;
      // Use the assigned ability. Preserve previous behavior by locking during telegraph.
      useAbilityHelper(k, miniboss, player, gameContext, ability, {
        blockDuringTelegraph: true,
      });
    } else {
      // Move towards player.
      rotateTowardsPlayer(k, miniboss, player, 10);
      miniboss.moveTo(player.pos, miniboss.speed);
    }
  });

  // Attach common projectile handler
  attachProjectileDamageHandler(k, miniboss, player, gameContext);
}
