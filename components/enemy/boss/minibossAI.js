/**
 * @file Contains the AI for a miniboss, which uses one pre-assigned boss ability.
 */

import { showCritEffect,lerpAngle } from "../enemyBehavior.js";
import { VULNERABILITY_DAMAGE_MULTIPLIER } from "./bossConfig.js";
import { applyProjectileEffects } from "../../effects/applyProjectileEffects.js";
import { attachBuffManager } from "../../effects/buffs/buffManager.js";
/**
 * Attaches the miniboss AI logic to a game object.
 * @param {object} k - The Kaboom context.
 * @param {object} miniboss - The miniboss game object.
 * @param {object} player - The player game object.
 * @param {object} gameContext - Shared game context.
 * @param {object} ability - The specific ability object (e.g., summonMinions, spreadShot).
 * @param {object} scaling - Optional scaling multipliers.
 */
export function attachMinibossBrain(
  k,
  miniboss,
  player,
  gameContext,
  ability,
  scaling = {}
) {
  // --- Apply Scaling ---
  if (scaling.hpMultiplier) {
    miniboss.maxHp *= scaling.hpMultiplier;
    miniboss.heal(miniboss.maxHp);
  }
  if (scaling.speedMultiplier) {
    miniboss.baseSpeed *= scaling.speedMultiplier;
    miniboss.speed = miniboss.baseSpeed;
  }

  // --- Initialize State ---
  miniboss.isBusy = false;
  miniboss.isVulnerable = false;
  miniboss.tag("miniboss");

  const COOLDOWN = 8;
  let cooldownTimer = COOLDOWN / 2;

  // --- Main AI Update Loop ---
  miniboss.onUpdate(() => {
    if (gameContext.sharedState.isPaused || miniboss.dead || miniboss.isBusy) {
      return; // Do nothing if paused, dead, or busy with an ability
    }

    cooldownTimer -= k.dt();

    if (cooldownTimer <= 0) {
      cooldownTimer = COOLDOWN;
      // Use the ability instead of moving
      useAbility(ability);
    } else {
      // Move towards player when not using an ability
      // ---  SMOOTH ROTATION LOGIC ---
      const dir = player.pos.sub(miniboss.pos);
      const targetAngle = dir.angle() + 90;
      const smoothingFactor = 10; // Higher number means faster turning

      miniboss.angle = lerpAngle(
        miniboss.angle,
        targetAngle,
        k.dt() * smoothingFactor
      );

      miniboss.moveTo(player.pos, miniboss.speed);
    }
  });

  // --- Helper to execute an ability ---
  const useAbility = (abilityToUse) => {
    miniboss.isBusy = true; // Lock the AI
    const telegraph = abilityToUse.initiate(k, miniboss, player, gameContext);
    const params = abilityToUse.getParams(); // Miniboss always uses phase 1 params

    k.wait(telegraph.duration, () => {
      if (miniboss.exists()) {
        abilityToUse.execute(k, miniboss, player, gameContext, params);
      }
    });

    // Release the lock if the ability is not self-terminating (like charge)
    if (abilityToUse.name !== "charge") {
      k.wait(telegraph.duration + 0.1, () => {
        if (miniboss.exists()) {
          miniboss.isBusy = false;
        }
      });
    }
  };

  // Simple projectile collision
  miniboss.onCollide("projectile", (projectile) => {
    if (miniboss.dead) return;

  attachBuffManager(k, miniboss);
    
      applyProjectileEffects(k, projectile, miniboss, { source: projectile.source, sourceId: projectile.sourceId });

    let damage = projectile.damage;
    if (miniboss.isVulnerable) {
      damage *= VULNERABILITY_DAMAGE_MULTIPLIER;
      showCritEffect(k, miniboss.pos, "CRIT!", k.rgb(255, 255, 0));
      k.shake(3);
    } else if (projectile.isCrit) {
      showCritEffect(k, miniboss.pos, "CRIT!", k.rgb(255, 0, 0));
    }
    miniboss.hurt(damage);

    if (miniboss.hp() <= 0) {
      miniboss.die();
    }
          const shouldDestroy = projectile._shouldDestroyAfterHit === undefined ? true : !!projectile._shouldDestroyAfterHit;
  if (shouldDestroy) {
    try { k.destroy(projectile); } catch (e) {}
  } else {
    // keep projectile (ricochet already updated velocity/_bouncesLeft)
  }
  });
}
