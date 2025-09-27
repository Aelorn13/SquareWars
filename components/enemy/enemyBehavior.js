/** components/enemy/enemyBehavior.js */
import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";
import { interpolateColor } from "./interpolateColor.js";
import { getPlayerStatsSnapshot } from "../ui/playerStatsUI.js";

import { applyProjectileEffects } from "../effects/applyProjectileEffects.js";
import { attachBuffManager } from "../buffManager.js";

export function lerpAngle(startAngle, endAngle, t) {
  let diff = endAngle - startAngle;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  return startAngle + diff * t;
}

const KNOCKBACK_DISTANCE = 120;
const KNOCKBACK_DURATION = 0.1;

/**
 * Centralised handler for an enemy hitting the player.
 * Returns true if the hit was applied.
 */
function handleEnemyPlayerCollision(k, enemy, player, gameContext) {
  if (enemy.dead || player.isInvincible || player.isKnockedBack) return false;

  // Apply damage using player API if present
  if (typeof player.takeDamage === "function") {
    player.takeDamage(enemy.damage ?? 1, { source: enemy });
  } else if (typeof player.hurt === "function") {
    player.hurt(enemy.damage ?? 1);
  } else {
    player.hp = Math.max(0, (player.hp ?? 0) - (enemy.damage ?? 1));
  }
  gameContext.updateHealthBar?.();

  // Boss knockback else enemy dies on contact
  if (enemy.type === "boss" || enemy.type === "miniboss") {
    player.isKnockedBack = true;
    const knockbackDir = player.pos.sub(enemy.pos).unit();
    const knockbackDest = player.pos.add(
      knockbackDir.scale(KNOCKBACK_DISTANCE)
    );
    k.tween(
      player.pos,
      knockbackDest,
      KNOCKBACK_DURATION,
      (p) => (player.pos = p)
    ).then(() => {
      player.isKnockedBack = false;
    });
  } else {
    enemy.die();
  }

  // clear any pending-touch flag
  enemy._touchingPlayer = false;

  const playerHpNow = typeof player.hp === "function" ? player.hp() : player.hp;
  if ((playerHpNow ?? 0) <= 0) {
    const snapshot = getPlayerStatsSnapshot(gameContext.player);
    k.go("gameover", { statsSnapshot: snapshot });
  }

  return true;
}

function isOverlapping(enemy, player) {
  // use explicit _size if set, fallback to sensible default
  const eSize = enemy._size ?? enemy.width ?? enemy.height ?? 28;
  const pSize = player.width ?? player.height ?? 28;
  const overlapDist = (eSize + pSize) * 0.5;
  return enemy.pos.dist(player.pos) <= overlapDist;
}

export function setupEnemyPlayerCollisions(k, gameContext) {
  // Watch player invincibility toggle and replay pending touches when it ends.
  // Keep a small, local closure-level prev flag.
  let prevInv = !!gameContext.player?.isInvincible;

  k.onUpdate(() => {
    const player = gameContext.player;
    if (!player) return;
    const nowInv = !!player.isInvincible;

    if (prevInv && !nowInv) {
      // invincibility just ended -> check enemies that were touching or still overlap
      k.get("enemy").forEach((enemy) => {
        if (enemy.dead) return;
        if (enemy._spawnGrace) return; // ignore newly spawned enemies during grace
        if (enemy._touchingPlayer || isOverlapping(enemy, player)) {
          if (!player.isInvincible && !player.isKnockedBack) {
            handleEnemyPlayerCollision(k, enemy, player, gameContext);
          }
        }
        enemy._touchingPlayer = false;
      });
    }
    prevInv = nowInv;
  });

  k.onCollide("enemy", "player", (enemy, player) => {
    // If enemy already dead nothing to do
    if (enemy.dead || enemy._spawnGrace || player._isGhosting) return;

    // If player invincible or being knocked back, mark this enemy as touching and return.
    // We do not apply damage now so enemy doesn't die or knock the player during invuln.
    if (player.isInvincible || player.isKnockedBack) {
      enemy._touchingPlayer = true;
      return;
    }
    // Normal immediate collision handling
    handleEnemyPlayerCollision(k, enemy, player, gameContext);
  });
}

export function createEnemyGameObject(
  k,
  player,
  config,
  spawnPos,
  gameContext
) {
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
          const slowArr = Array.isArray(this._slowMultipliers)
            ? this._slowMultipliers
            : [];
          let multiplier = 1;
          for (const f of slowArr) multiplier *= Math.max(0, 1 - (f ?? 0));
          if (typeof this._buffedMoveMultiplier === "number")
            multiplier *= this._buffedMoveMultiplier;
          multiplier = Math.max(0.01, multiplier);
          this.speed = (this.baseSpeed ?? this.speed ?? 0) * multiplier;
        }
      },

      die() {
        if (this.dead) return;
        this.dead = true;
        this.area.enabled = false;
        this.gameContext.increaseScore?.(this.score);
        if (this.canDropPowerup !== false) {
          dropPowerUp(k, player, this.pos, this.gameContext.sharedState);
        }
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

  // store a reliable size for simple overlap checks elsewhere
  enemy._size = config.size;

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

    attachBuffManager(k, enemy);

    applyProjectileEffects(k, projectile, enemy, {
      source: projectile.source,
      sourceId: projectile.sourceId,
    });

    if (typeof enemy.takeDamage === "function") {
      enemy.takeDamage(projectile.damage, {
        source: projectile.source,
        isCrit: projectile.isCritical,
      });
    } else if (typeof enemy.hurt === "function") {
      enemy.hurt(projectile.damage);
    } else {
      enemy.hp = Math.max(0, (enemy.hp ?? 0) - projectile.damage);
    }

    const hpNow = (typeof enemy.hp === "function" ? enemy.hp() : enemy.hp) ?? 0;
    if (hpNow > 0) {
      if (enemy.type === "rageTank") {
        const hpRatio = enemy.hp() / enemy.maxHp;
        enemy.speed = enemy.baseSpeed * (2 + (1 - hpRatio));
      }
      const hpRatio = Math.max(0.01, enemy.hp() / enemy.maxHp);
      enemy.color = k.rgb(
        ...interpolateColor(enemy.originalColor, [240, 240, 240], hpRatio)
      );
    } else {
      enemy.die();
    }

    const shouldDestroy =
      projectile._shouldDestroyAfterHit === undefined
        ? true
        : !!projectile._shouldDestroyAfterHit;
    if (shouldDestroy) {
      try {
        k.destroy(projectile);
      } catch (e) {}
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
  k.tween(
    enemy.scale,
    k.vec2(0.1),
    0.4,
    (s) => (enemy.scale = s),
    k.easings.easeInQuad
  );
  k.tween(
    enemy.opacity,
    0,
    0.4,
    (o) => (enemy.opacity = o),
    k.easings.linear
  ).then(() => {
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
