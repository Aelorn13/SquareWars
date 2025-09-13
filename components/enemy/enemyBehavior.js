/**
 * @file Defines enemy game object creation, behavior, and lifecycle.
 */

import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";
import { interpolateColor } from "../utils/visualEffects.js";

/**
 * Linearly interpolates between two angles, finding the shortest path.
 * @param {number} startAngle - The current angle in degrees.
 * @param {number} endAngle - The target angle in degrees.
 * @param {number} t - The interpolation factor (usually dt * speed).
 * @returns {number} The new, interpolated angle.
 */
function lerpAngle(startAngle, endAngle, t) {
  let diff = endAngle - startAngle;
  
  // Normalize the difference to be between -180 and 180 degrees.
  if (diff > 180) {
    diff -= 360; // Go the other way around the circle
  } else if (diff < -180) {
    diff += 360; // Go the other way around the circle
  }

  return startAngle + diff * t;
}

/**
 * Sets up the global collision handler between "enemy" and "player" tags.
 */
export function setupEnemyPlayerCollisions(k, gameContext) {
  // Constants for the knockback effect, easy to tweak here.
  const KNOCKBACK_DISTANCE = 120; // How far the player is pushed.
  const KNOCKBACK_DURATION = 0.1; // How long the push effect lasts in seconds.

  k.onCollide("enemy", "player", (enemy, player) => {
    // Ignore collision if the enemy is dead, player is invincible, or player is already being knocked back.
    if (enemy.dead || player.isInvincible || player.isKnockedBack) {
      return;
    }

    // --- Common Effects for Any Collision ---
    player.hurt(enemy.damage ?? 1);
    gameContext.updateHealthBar?.();
    k.shake(10);

    // --- Specific Logic Based on Enemy Type ---
    if (enemy.type === "boss") {
      // This is the special case for the boss.
      
      // 1. Set a flag on the player to disable their input during the knockback.
      player.isKnockedBack = true;

      // 2. Calculate the direction to push the player.
      // It's a vector pointing from the boss to the player.
      const knockbackDir = player.pos.sub(enemy.pos).unit();

      // 3. Calculate the destination point for the knockback.
      const knockbackDest = player.pos.add(knockbackDir.scale(KNOCKBACK_DISTANCE));

      // 4. Use k.tween for a smooth push effect.
      k.tween(
        player.pos,
        knockbackDest,
        KNOCKBACK_DURATION,
        (p) => (player.pos = p),
      ).then(() => {
        // 5. After the tween is finished, reset the flag.
        player.isKnockedBack = false;
      });

    } else {
      // For any non-boss enemy, they simply die on collision.
      enemy.die();
    }

    // --- Final Check (applies to all collisions) ---
    if (player.hp() <= 0) {
      k.go("gameover");
    }
  });
}

/**
 * Creates a single enemy game object with data components, but NO logic.
 * The spawner is responsible for attaching logic after creation.
 */
export function createEnemyGameObject(k, player, config, spawnPos, gameContext) {
  // Start with a base list of components for every enemy
  const components = [
    k.rect(config.size, config.size),
    k.color(...config.color),
    k.pos(spawnPos),
    k.anchor("center"),
    k.area(),
    k.rotate(0),
    k.health(config.maxHp),
    k.scale(1),
    // Use the opacity from the config, or default to 1 if not specified
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
  ];

  // Conditionally add the body component.
  //  check for `!== false` so that if the property is missing (undefined), it still defaults to adding the body.
  if (config.hasBody !== false) {
    components.push(k.body({ isSensor: true }));
  }

  // Create the enemy game object by passing the final list of components
  const enemy = k.add(components);
  return enemy;
}

/**
 * Attaches the core update and collision logic to a generic (non-boss) enemy object.
 */
export function attachEnemyBehaviors(k, enemy, player) {
  enemy.onUpdate(() => {
    if (enemy.gameContext.sharedState.isPaused || enemy.dead) return;
    // ---  SMOOTH ROTATION LOGIC ---
    const dir = player.pos.sub(enemy.pos);
    const targetAngle = dir.angle() + 90;
    const smoothingFactor = 10; // Higher number means faster turning

    enemy.angle = lerpAngle(enemy.angle, targetAngle, k.dt() * smoothingFactor);

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