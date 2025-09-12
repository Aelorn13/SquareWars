/**
 * @file Defines enemy game object creation, behavior, and lifecycle.
 */

import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";
import { interpolateColor } from "../utils/visualEffects.js";

/**
 * Sets up the global collision handler between "enemy" and "player" tags.
 */
export function setupEnemyPlayerCollisions(k, gameContext) {
  k.onCollide("enemy", "player", (enemy, player) => {
    if (enemy.dead || player.isInvincible) return;
    player.hurt(enemy.damage ?? 1);
    gameContext.updateHealthBar?.();
    k.shake(10);
    if (player.hp() <= 0) k.go("gameover");
    if (enemy.type !== "boss") {
      enemy.die();
    }
  });
}

/**
 * Creates a single enemy game object with data components, but NO logic.
 * The spawner is responsible for attaching logic after creation.
 */
export function createEnemyGameObject(k, player, config, spawnPos, gameContext) {
  const enemy = k.add([
    k.rect(config.size, config.size),
    k.color(...config.color),
    k.pos(spawnPos),
    k.anchor("center"),
    k.area(),
    k.body({ isSensor: true }), 
    k.health(config.maxHp),
    k.scale(1),
    k.opacity(1),
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
      die() {
        if (this.dead) return;
        this.dead = true;
        this.area.enabled = false;
        this.gameContext.increaseScore?.(this.score);
        dropPowerUp(k, player, this.pos, this.gameContext.sharedState);
        enemyDeathAnimation(k, this);
        if (this.type === "boss") {
          k.wait(0.5, () => k.go("victory"));
        }
      },
    },
  ]);
  return enemy;
}

/**
 * Attaches the core update and collision logic to a generic (non-boss) enemy object.
 */
export function attachEnemyBehaviors(k, enemy, player) {
  enemy.onUpdate(() => {
    if (enemy.gameContext.sharedState.isPaused || enemy.dead) return;
    enemy.moveTo(player.pos, enemy.speed);
  });

  enemy.onCollide("projectile", (projectile) => {
    if (enemy.dead) return;
    k.destroy(projectile);

    if (projectile.isCrit) {
      showCritEffect(k, enemy.pos, "CRIT!", k.rgb(255, 0, 0));
    }

    enemy.hurt(projectile.damage);

    if (enemy.hp() > 0) {
      if (enemy.type === "rageTank") {
        const hpRatio = enemy.hp() / enemy.maxHp;
        enemy.speed = enemy.baseSpeed * (2 + (1 - hpRatio));
      } else {
        // Temporarily slow the enemy on hit .
        enemy.speed = enemy.baseSpeed * 0.2;
        k.wait(0.1, () => {
          if (enemy.exists() && enemy.type !== "rageTank") {
            enemy.speed = enemy.baseSpeed;
          }
        });
      }
      const hpRatio = Math.max(0.01, enemy.hp() / enemy.maxHp);
      enemy.color = k.rgb(...interpolateColor(enemy.originalColor, [240, 240, 240], hpRatio));
    } else {
      enemy.die();
    }
  });
}

/**
 * Attempts to drop a power-up at a position based on player's luck.
 */
function dropPowerUp(k, player, position, sharedState) {
  if ((player.luck ?? 0) > Math.random()) {
    const chosenType = k.choose(Object.values(POWERUP_TYPES));
    spawnPowerUp(k, position, chosenType, sharedState);
  }
}

/**
 * Plays a death animation (scaling and fading) and destroys the object afterward.
 */
function enemyDeathAnimation(k, enemy) {
  k.tween(enemy.scale, k.vec2(0.1), 0.4, (s) => (enemy.scale = s), k.easings.easeInQuad);
  k.tween(enemy.opacity, 0, 0.4, (o) => (enemy.opacity = o), k.easings.linear)
    .then(() => {
      k.destroy(enemy);
    });
}

/**
 * Displays a floating text effect for critical hits.
 */
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