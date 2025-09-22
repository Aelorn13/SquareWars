// components/enemy/boss/aiCommon.js
import { showCritEffect, lerpAngle } from "../enemyBehavior.js";
import { VULNERABILITY_DAMAGE_MULTIPLIER } from "./bossConfig.js";
import { applyProjectileEffects } from "../../effects/applyProjectileEffects.js";
import { attachBuffManager } from "../../effects/buffs/buffManager.js";

/**
 * Wait for `duration` seconds while respecting pause.
 * Resolves true if completed, false if entity was removed.
 */
export function waitUnpaused(k, entity, gameContext, duration) {
  return new Promise((resolve) => {
    let remaining = Math.max(0, duration || 0);
    const waiter = entity.onUpdate(() => {
      if (!entity.exists()) {
        waiter.cancel();
        resolve(false);
        return;
      }
      // entity.onUpdate is not invoked when k.paused is true.
      remaining -= k.dt();
      if (remaining <= 0) {
        waiter.cancel();
        resolve(true);
      }
    });
  });
}

/**
 * Attach common projectile collision handling used by boss and miniboss.
 */
export function attachProjectileDamageHandler(k, entity, player, gameContext) {
  entity.onCollide("projectile", (projectile) => {
    if (entity.dead) return;

    attachBuffManager(k, entity);

    applyProjectileEffects(k, projectile, entity, {
      source: projectile.source,
      sourceId: projectile.sourceId,
    });

    let damage = projectile.damage ?? 1;

    if (entity.isVulnerable) {
      damage *= VULNERABILITY_DAMAGE_MULTIPLIER;
      showCritEffect(k, entity.pos, "CRIT!", k.rgb(255, 255, 0));
      k.shake(3);
    } else if (projectile.isCrit) {
      showCritEffect(k, entity.pos, "CRIT!", k.rgb(255, 0, 0));
    }

    entity.hurt(damage);

    if (entity.hp && entity.hp() <= 0) {
      entity.die();
    }

    const shouldDestroy =
      projectile._shouldDestroyAfterHit === undefined
        ? true
        : !!projectile._shouldDestroyAfterHit;

    if (shouldDestroy) {
      try {
        k.destroy(projectile);
      } catch (e) {}
    } else {
      // projectile remains (ricochet logic handled elsewhere)
    }
  });
}

/**
 * Unified ability caller that:
 *  - shows telegraph via ability.initiate
 *  - waits for telegraph.duration using waitUnpaused (so it pauses with the game)
 *  - optionally locks entity.isBusy during telegraph
 *  - calls ability.execute
 *  - releases lock for non-self-terminating abilities
 *
 * options:
 *  - blockDuringTelegraph: boolean (default true). If true, entity.isBusy is set before telegraph.
 *  - releaseDelay: seconds to wait after execute to release lock for non-self-terminating abilities.
 */
export async function useAbilityHelper(
  k,
  entity,
  player,
  gameContext,
  ability,
  options = {}
) {
  const { blockDuringTelegraph = true, releaseDelay = 0.1 } = options;

  if (!ability || !ability.initiate) return false;

  if (blockDuringTelegraph) {
    entity.isBusy = true;
  }

  const telegraph = ability.initiate(k, entity, player, gameContext) || {
    duration: 0,
  };

  const params =
    entity.phase !== undefined
      ? ability.getParams?.(entity.phase)
      : ability.getParams?.();

  // wait for the telegraph to finish in a pause-aware way
  const ok = await waitUnpaused(k, entity, gameContext, telegraph.duration || 0);
  if (!ok || !entity.exists()) {
    // cleanup if entity died/removed before telegraph finished
    if (blockDuringTelegraph) entity.isBusy = false;
    return false;
  }

  // If we didn't lock during telegraph, lock now for execution.
  if (!blockDuringTelegraph) entity.isBusy = true;

  try {
    ability.execute(k, entity, player, gameContext, params);
  } catch (e) {
    console.error("ability.execute error", e);
  }

  // For abilities that don't self-terminate (e.g. summon/spreadShot) release the lock.
  if (ability.name !== "charge") {
    // Wait a short moment, respecting pause, then release.
    waitUnpaused(k, entity, gameContext, releaseDelay).then(() => {
      if (entity.exists()) {
        entity.isBusy = false;
      }
    });
  }

  return true;
}

/**
 * Small helper to rotate smoothly toward player.
 */
export function rotateTowardsPlayer(k, entity, player, smoothing = 10) {
  const dir = player.pos.sub(entity.pos);
  const targetAngle = dir.angle() + 90;
  entity.angle = lerpAngle(entity.angle, targetAngle, k.dt() * smoothing);
}
