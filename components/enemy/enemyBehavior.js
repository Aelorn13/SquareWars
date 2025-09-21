/** components/enemy/enemyBehavior.js */
import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";
import { interpolateColor } from "../utils/visualEffects.js";
import { getPlayerStatsSnapshot } from "../ui/playerStatsUI.js";

import { applyProjectileEffects } from "../effects/applyProjectileEffects.js";
import { attachBuffManager } from "../effects/buffs/buffManager.js";

export function lerpAngle(startAngle, endAngle, t) {
  let diff = endAngle - startAngle;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  return startAngle + diff * t;
}

export function setupEnemyPlayerCollisions(k, gameContext) {
  const KNOCKBACK_DISTANCE = 120;
  const KNOCKBACK_DURATION = 0.1;

  k.onCollide("enemy", "player", (enemy, player) => {
    if (enemy.dead || player.isInvincible || player.isKnockedBack) return;

    if (typeof player.takeDamage === "function") {
      player.takeDamage(enemy.damage ?? 1, { source: enemy });
    } else if (typeof player.hurt === "function") {
      player.hurt(enemy.damage ?? 1);
    } else {
      player.hp = Math.max(0, (player.hp ?? 0) - (enemy.damage ?? 1));
    }
    gameContext.updateHealthBar?.();

    if (enemy.type === "boss" || enemy.type === "miniboss") {
      player.isKnockedBack = true;
      const knockbackDir = player.pos.sub(enemy.pos).unit();
      const knockbackDest = player.pos.add(knockbackDir.scale(KNOCKBACK_DISTANCE));
      k.tween(player.pos, knockbackDest, KNOCKBACK_DURATION, (p) => (player.pos = p)).then(() => {
        player.isKnockedBack = false;
      });
    } else {
      enemy.die();
    }

    const playerHpNow = typeof player.hp === "function" ? player.hp() : player.hp;
    if ((playerHpNow ?? 0) <= 0) {
      const snapshot = getPlayerStatsSnapshot(gameContext.player);
      k.go("gameover", { statsSnapshot: snapshot });
    }
  });
}

export function createEnemyGameObject(k, player, config, spawnPos, gameContext) {
  const components = [
    k.rect(config.size, config.size),
    k.color(...config.color),
    k.pos(spawnPos),
    k.anchor("center"),
    k.area(),
    k.rotate(0),
    k.health(config.maxHp),
    k.scale(1),
    k.opacity(config.opacity ?? 1),
    "enemy",
    {
      type: config.name,
      damage: config.damage,
      score: config.score,
      speed: config.speed,
      maxHp: config.maxHp,
      originalColor: config.color,
      baseSpeed: config.speed,
      dead: false,
      gameContext: gameContext,

      takeDamage(amount, ctx = {}) {
        if (typeof this.hurt === "function") this.hurt(amount);
        else this.hp = Math.max(0, (this.hp ?? 0) - amount);

        if (ctx.isCrit) {
          showCritEffect(k, this.pos, "CRIT!", k.rgb(255, 0, 0));
        }

        this.gameContext?.updateHealthBar?.();

        const currentHp = typeof this.hp === "function" ? this.hp() : this.hp;
        if ((currentHp ?? 0) <= 0) this.die();
      },

      recomputeStat(statName) {
        if (statName === "moveSpeed" || statName === "speed") {
          const slowArr = Array.isArray(this._slowMultipliers) ? this._slowMultipliers : [];
          let multiplier = 1;
          for (const f of slowArr) multiplier *= Math.max(0, 1 - (f ?? 0));
          if (typeof this._buffedMoveMultiplier === "number") multiplier *= this._buffedMoveMultiplier;
          multiplier = Math.max(0.01, multiplier);
          this.speed = (this.baseSpeed ?? this.speed ?? 0) * multiplier;
        }
      },

      die() {
        if (this.dead) return;
        this.dead = true;
        this.area.enabled = false;
        this.gameContext.increaseScore?.(this.score);
        dropPowerUp(k, player, this.pos, this.gameContext.sharedState);
        enemyDeathAnimation(k, this);
        if (this.type === "boss") {
          const snapshot = getPlayerStatsSnapshot(gameContext.player);
          k.wait(0.5, () => k.go("victory", { statsSnapshot: snapshot }));
        }
      },
    },
  ];

  if (config.hasBody !== false) components.push(k.body({ isSensor: true }));

  const enemy = k.add(components);
  attachBuffManager(k, enemy);
  enemy.recomputeStat?.("moveSpeed");
  return enemy;
}

export function attachEnemyBehaviors(k, enemy, player) {
  enemy.onUpdate(() => {
    if (enemy.gameContext.sharedState.isPaused || enemy.dead) return;
    if (enemy._isStunned) return; // skip movement while stunned by knockback
    const dir = player.pos.sub(enemy.pos);
    const targetAngle = dir.angle() + 90;
    const smoothingFactor = 10;
    enemy.angle = lerpAngle(enemy.angle, targetAngle, k.dt() * smoothingFactor);
    enemy.moveTo(player.pos, enemy.speed);
  });

enemy.onCollide("projectile", (projectile) => {
  if (enemy.dead) return;

  // ensure buff manager present
  attachBuffManager(k, enemy);

  // 1) Apply projectile effects first (ricochet may adjust projectile._shouldDestroyAfterHit & velocity)
  applyProjectileEffects(k, projectile, enemy, { source: projectile.source, sourceId: projectile.sourceId });

  // 2) Apply immediate damage via unified API
  if (typeof enemy.takeDamage === "function") {
    enemy.takeDamage(projectile.damage, { source: projectile.source, isCrit: projectile.isCritical });
  } else if (typeof enemy.hurt === "function") {
    enemy.hurt(projectile.damage);
  } else {
    enemy.hp = Math.max(0, (enemy.hp ?? 0) - projectile.damage);
  }

  // 3) Update visuals / special behavior
  const hpNow = (typeof enemy.hp === "function" ? enemy.hp() : enemy.hp) ?? 0;
  if (hpNow > 0) {
    if (enemy.type === "rageTank") {
      const hpRatio = enemy.hp() / enemy.maxHp;
      enemy.speed = enemy.baseSpeed * (2 + (1 - hpRatio));
    }
    const hpRatio = Math.max(0.01, enemy.hp() / enemy.maxHp);
    enemy.color = k.rgb(...interpolateColor(enemy.originalColor, [240, 240, 240], hpRatio));
  } else {
    enemy.die();
  }

  // 4) Decide whether to destroy projectile:
  // If handler set _shouldDestroyAfterHit=false we keep it alive; default = destroy.
  const shouldDestroy = projectile._shouldDestroyAfterHit === undefined ? true : !!projectile._shouldDestroyAfterHit;
  if (shouldDestroy) {
    try { k.destroy(projectile); } catch (e) {}
  } else {
    // keep projectile (ricochet already updated velocity/_bouncesLeft)
  }
});
}

function dropPowerUp(k, player, position, sharedState) {
  if ((player.luck ?? 0) > Math.random()) {
    const chosenType = k.choose(Object.values(POWERUP_TYPES));
    spawnPowerUp(k, position, chosenType, sharedState);
  }
}

function enemyDeathAnimation(k, enemy) {
  k.tween(enemy.scale, k.vec2(0.1), 0.4, (s) => (enemy.scale = s), k.easings.easeInQuad);
  k.tween(enemy.opacity, 0, 0.4, (o) => (enemy.opacity = o), k.easings.linear).then(() => {
    k.destroy(enemy);
  });
}

export function showCritEffect(k, pos, text, color) {
  k.add([
    k.text(text, { size: 16 }),
    k.pos(pos.add(k.rand(-20, 20), k.rand(-20, 20))),
    k.color(color),
    k.opacity(1),
    k.lifespan(0.5, { fade: 0.25 }),
    k.move(k.UP, 40),
  ]);
}
