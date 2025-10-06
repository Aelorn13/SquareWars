// ===== components/enemy/boss/minibossAI.js =====
import { rotateTowardsPlayer, useAbilityHelper, attachProjectileDamageHandler } from "./bossAIcommon.js";

export function attachMinibossBrain(k, miniboss, player, gameContext, ability, scaling = {}) {
  // Apply scaling
  if (scaling.hpMultiplier) {
    miniboss.maxHp *= scaling.hpMultiplier;
    miniboss.heal(miniboss.maxHp);
  }
  if (scaling.speedMultiplier) {
    miniboss.speed *= scaling.speedMultiplier;
  }

  miniboss.isBusy = false;
  miniboss.isVulnerable = false;
  miniboss.tag("miniboss");

  const COOLDOWN = 8;
  let cooldownTimer = COOLDOWN / 2;

  miniboss.onUpdate(() => {
    if (gameContext.sharedState.isPaused || miniboss.dead || miniboss.isBusy) return;

    cooldownTimer -= k.dt();

    if (cooldownTimer <= 0) {
      cooldownTimer = COOLDOWN;
      useAbilityHelper(k, miniboss, player, gameContext, ability, { blockDuringTelegraph: true });
    } else {
      rotateTowardsPlayer(k, miniboss, player, 10);
      miniboss.moveTo(player.pos, miniboss.speed);
    }
  });

  attachProjectileDamageHandler(k, miniboss, player, gameContext);
}