
// ===== components/enemy/enemyBehavior.js =====
import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";
import { getPlayerStatsSnapshot } from "../ui/playerStatsUI.js";
import { applyProjectileEffects } from "../effects/applyProjectileEffects.js";
import { attachBuffManager } from "../buffManager.js";

const KNOCKBACK_DISTANCE = 120;
const KNOCKBACK_DURATION = 0.1;
const DAMAGE_COLOR = [240, 240, 240]; // Color when damaged

export function lerpAngle(start, end, t) {
  let diff = end - start;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  return start + diff * t;
}

/**
 * Blends between two RGB colors based on ratio (1.0 = startColor, 0.0 = endColor)
 */
export function interpolateColor(startColor, endColor, ratio) {
  const t = Math.min(1, Math.max(0, ratio));
  const inv = 1 - t;
  return [
    Math.floor(startColor[0] * t + endColor[0] * inv),
    Math.floor(startColor[1] * t + endColor[1] * inv),
    Math.floor(startColor[2] * t + endColor[2] * inv)
  ];
}

/**
 * Unified damage application for any entity
 */
function applyDamage(entity, amount, options = {}) {
  if (typeof entity.takeDamage === "function") {
    entity.takeDamage(amount, options);
  } else if (typeof entity.hurt === "function") {
    entity.hurt(amount);
  } else {
    entity.hp = Math.max(0, (entity.hp ?? 0) - amount);
  }
}

/**
 * Gets current HP regardless of implementation
 */
function getCurrentHp(entity) {
  return typeof entity.hp === "function" ? entity.hp() : entity.hp;
}

/**
 * Centralised handler for enemy-player collision
 */
function handleEnemyPlayerCollision(k, enemy, player, gameContext) {
  if (enemy.dead || player.isInvincible || player.isKnockedBack) return false;

  applyDamage(player, enemy.damage ?? 1, { source: enemy });
  gameContext.updateHealthBar?.();

  // Bosses knock back, others die
  const isBossType = enemy.type === "boss" || enemy.type === "miniboss";
  if (isBossType) {
    player.isKnockedBack = true;
    const dir = player.pos.sub(enemy.pos).unit();
    const dest = player.pos.add(dir.scale(KNOCKBACK_DISTANCE));
    
    k.tween(player.pos, dest, KNOCKBACK_DURATION, p => player.pos = p)
      .then(() => player.isKnockedBack = false);
  } else {
    enemy.die();
  }

  enemy._touchingPlayer = false;

  if (getCurrentHp(player) <= 0) {
    const snapshot = getPlayerStatsSnapshot(gameContext.player);
    k.go("gameover", { statsSnapshot: snapshot });
  }

  return true;
}

/**
 * Simple overlap check between two entities
 */
function isOverlapping(enemy, player) {
  const eSize = enemy._size ?? enemy.width ?? enemy.height ?? 28;
  const pSize = player.width ?? player.height ?? 28;
  const overlapDist = (eSize + pSize) * 0.5;
  return enemy.pos.dist(player.pos) <= overlapDist;
}

export function setupEnemyPlayerCollisions(k, gameContext) {
  let wasInvincible = false;

  k.onUpdate(() => {
    const player = gameContext.player;
    if (!player) return;
    
    const isInvincible = !!player.isInvincible;

    // Check pending collisions when invincibility ends
    if (wasInvincible && !isInvincible) {
      k.get("enemy").forEach(enemy => {
        if (enemy.dead || enemy._spawnGrace) return;
        
        if (enemy._touchingPlayer || isOverlapping(enemy, player)) {
          if (!player.isInvincible && !player.isKnockedBack) {
            handleEnemyPlayerCollision(k, enemy, player, gameContext);
          }
        }
        enemy._touchingPlayer = false;
      });
    }
    
    wasInvincible = isInvincible;
  });

  // Enemy-player collision
  k.onCollide("enemy", "player", (enemy, player) => {
    if (enemy.dead || enemy._spawnGrace || player._isGhosting) return;

    if (player.isInvincible || player.isKnockedBack) {
      enemy._touchingPlayer = true;
      return;
    }
    
    handleEnemyPlayerCollision(k, enemy, player, gameContext);
  });

  // Enemy projectile-player collision
  k.onCollide("player", "enemyProjectile", (player, proj) => {
    if (!player || !proj || player._isGhosting) return;
    if (player.isInvincible || player.isKnockedBack) return;

    applyDamage(player, proj.damage ?? 1, { source: proj.source });
    gameContext.updateHealthBar?.();

    if (proj._shouldDestroyAfterHit !== false) {
      try { k.destroy(proj); } catch (e) {}
    }

    if (getCurrentHp(player) <= 0) {
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
      dead: false,
      gameContext: gameContext,
      _size: config.size, // Store for overlap checks

      takeDamage(amount, ctx = {}) {
          this.hurt(amount);

        if (ctx.isCrit) {
          showCritEffect(k, this.pos, "CRIT!", k.rgb(255, 0, 0));
        }
        
        this.gameContext?.updateHealthBar?.();
        
        if (getCurrentHp(this) <= 0) this.die();
      },

      recomputeStat(statName) {
        if (statName !== "speed" || !this._buffManager) return;

        // Start with the pristine base speed stored in the manager.
        let finalSpeed = this._buffManager.baseStats.speed;
        
        // --- RAGE TANK LOGIC INTEGRATION ---
        if (this.type === "rageTank") {
          const hpRatio = Math.max(0.01, getCurrentHp(this) / this.maxHp);
          const rageMultiplier = (2 + (1 - hpRatio)); 
          finalSpeed *= rageMultiplier;
        }

        // Find all buffs that modify stats.
        const statBuffs = this._buffManager.getBuffsByType("stat");
        const slowBuffs = this._buffManager.getBuffsByType("slow");

        // Apply slow multipliers first
        for (const buff of slowBuffs) {
          if (buff.data?.factor) {
            finalSpeed *= buff.data.factor;
          }
        }

        // Apply generic stat buffs (for future use, like haste or other effects?)
        for (const buff of statBuffs) {
          if (buff.data?.stat === "speed") {
            const { mode, value } = buff.data;
            if (mode === "multiplicative") {
              finalSpeed *= value;
            } else if (mode === "additive") {
              finalSpeed += value;
            } else if (mode === "absolute") {
              finalSpeed = value;
              break; // Absolute overrides everything
            }
          }
        }
        
        // Set the final speed, ensuring a minimum value.
        this.speed = Math.max(1, finalSpeed);
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

  if (config.hasBody !== false) {
    components.push(k.body({ isSensor: true }));
  }

  const enemy = k.add(components);
  const mgr = attachBuffManager(k, enemy);
  if (mgr.baseStats.speed === undefined) {
    mgr.baseStats.speed = config.speed;
  }
  
  return enemy;
}

/**
 * Standard projectile collision handler for enemies
 */
export function handleProjectileCollision(k, enemy, projectile) {
  if (enemy.dead) return;

  applyProjectileEffects(k, projectile, enemy, {
    source: projectile.source,
    sourceId: projectile.sourceId,
     gameContext: enemy.gameContext,
  });

  applyDamage(enemy, projectile.damage, {
    source: projectile.source,
    isCrit: projectile.isCritical,
  });

  const hp = getCurrentHp(enemy);
  if (hp > 0) {
    // Update color based on health
    const hpRatio = Math.max(0.01, hp / enemy.maxHp);
    enemy.color = k.rgb(...interpolateColor(enemy.originalColor, DAMAGE_COLOR, hpRatio));
  } else {
    enemy.die();
  }
  if (projectile._shouldDestroyAfterHit !== false) {
    try { k.destroy(projectile); } catch (e) {}
  }
}

export function attachEnemyBehaviors(k, enemy, player) {
  enemy.onUpdate(() => {
    if (enemy.gameContext.sharedState.isPaused || enemy.dead || enemy._isStunned) return;
    //kind of dumb way for buffs and debuffs to work
    enemy.recomputeStat("speed");

    // Smooth rotation toward player
    const dir = player.pos.sub(enemy.pos);
    const targetAngle = dir.angle() + 90;
    enemy.angle = lerpAngle(enemy.angle, targetAngle, k.dt() * 10);
    
    enemy.moveTo(player.pos, enemy.speed);
  });

  enemy.onCollide("projectile", proj => handleProjectileCollision(k, enemy, proj));
}

function dropPowerUp(k, player, position, sharedState) {
  if ((player.luck ?? 0) > Math.random()) {
    const type = k.choose(Object.values(POWERUP_TYPES));
    spawnPowerUp(k, position, type, sharedState);
  }
}

function enemyDeathAnimation(k, enemy) {
  // Shrink and fade out
  k.tween(enemy.scale, k.vec2(0.1), 0.4, s => enemy.scale = s, k.easings.easeInQuad);
  k.tween(enemy.opacity, 0, 0.4, o => enemy.opacity = o, k.easings.linear)
    .then(() => k.destroy(enemy));
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