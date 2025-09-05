import { ENEMY_TYPES, chooseEnemyType } from "./enemyTypes.js";
import {
  interpolateColor,
  dropPowerUp,
  enemyDeathAnimation,
  pickEdgeSpawnPosFarFromPlayer,
  showSpawnTelegraph,
} from "./enemyUtils.js";
import { attachBossBrain } from "./boss/index.js";
import { VULNERABILITY_DAMAGE_MULTIPLIER } from "./boss/constants.js";

const TELEGRAPH_DURATION = 0.6; // In seconds

// =============================================================================
// REFACTOR 1: Global Collision Logic (Call this ONCE in your scene setup)
// =============================================================================

/**
 * Sets up the global collision handler between enemies and the player.
 * Should be called only once when the game scene is initialized.
 * @param {object} k - The Kaboom.js context.
 * @param {object} gameContext - Contains shared state and health update callbacks.
 */
export function setupEnemyPlayerCollisions(k, gameContext) {
  k.onCollide("enemy", "player", (enemy, player) => {
    if (enemy.dead || player.isInvincible) return;

    player.hurt(enemy.damage ?? 1);
    gameContext.updateHealthBar?.();
    k.shake(10);

    if (player.hp() <= 0) {
      k.go("gameover");
    }

    // Regular enemies are destroyed on collision with the player.
    if (enemy.type !== "boss") {
      k.destroy(enemy);
    }
  });
}


// =============================================================================
// REFACTOR 2: Main Spawning Orchestrator
// =============================================================================

/**
 * Orchestrates spawning an enemy, handling position, type selection, and telegraphing.
 * @param {object} k - The Kaboom.js context.
 * @param {object} player - The player entity.
 * @param {object} gameContext - Contains shared state, score, and UI update functions.
 * @param {object} options - Spawning options.
 * @param {string} [options.forceType=null] - Force a specific enemy type.
 * @param {object} [options.spawnPos=null] - Override the spawn position.
 * @param {number} [options.progress=0] - Game progress (0-1) for enemy selection.
 * @param {boolean} [options.showTelegraph=true] - Whether to show a spawn telegraph.
 * @returns {Promise|object|null} A promise for the boss, the enemy object if spawned immediately, or null.
 */
export function spawnEnemy(k, player, gameContext, options = {}) {
  const { forceType = null, spawnPos: posOverride = null, progress = 0, showTelegraph = true } = options;

  // 1. Determine enemy type configuration.
  const config = forceType
    ? ENEMY_TYPES.find((t) => t.name === forceType) ?? chooseEnemyType(ENEMY_TYPES, progress)
    : chooseEnemyType(ENEMY_TYPES, progress);

  // 2. Determine spawn position.
  const spawnPos = posOverride ?? pickEdgeSpawnPosFarFromPlayer(k, gameContext.sharedState, player, 120, 28);

  const enemyCreator = () => createEnemy(k, player, config, spawnPos, gameContext);

  // 3. Handle spawn timing (telegraph or immediate).
  if (!posOverride && showTelegraph) {
    showSpawnTelegraph(k, spawnPos, gameContext.sharedState, TELEGRAPH_DURATION);

    // Returns a promise for the boss to allow callers to get a reference to it.
    if (config.name === "boss") {
      return new Promise(resolve => {
        k.wait(TELEGRAPH_DURATION, () => resolve(enemyCreator()));
      });
    }

    // Fire-and-forget for regular enemies.
    k.wait(TELEGRAPH_DURATION, enemyCreator);
    return null;
  }

  // Spawn immediately if no telegraph is needed.
  return enemyCreator();
}


// =============================================================================
// REFACTOR 3: Enemy Creation and Behavior Attachment
// =============================================================================

/**
 * Creates and configures a single enemy entity with all its behaviors.
 */
function createEnemy(k, player, config, spawnPos, gameContext) {
  const enemy = k.add([
    k.rect(config.size, config.size),
    k.color(k.rgb(...config.color)),
    k.pos(spawnPos),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.rotate(0),
    k.health(config.maxHp),
    "enemy",
    // Custom properties
    {
      type: config.name,
      damage: config.damage,
      score: config.score,
      speed: config.speed,
      maxHp: config.maxHp,
      originalColor: config.color,
      baseSpeed: config.speed,
      dead: false,
    },
  ]);

  attachEnemyBehaviors(k, enemy, player, gameContext);

  if (enemy.type === "boss") {
    attachBossBrain(k, enemy, player, gameContext);
  }

  return enemy;
}

/**
 * Attaches onUpdate and onCollide behaviors to an enemy entity.
 */
function attachEnemyBehaviors(k, enemy, player, gameContext) {
  // --- Orient towards player initially ---
  enemy.rotateTo(player.pos.angle(enemy.pos));

  // --- Main Update Loop ---
  enemy.onUpdate(() => {
    if (gameContext.sharedState.isPaused || enemy.dead) return;

    // Boss movement is handled by its own brain, except for idle state.
    const isStandardMovement = enemy.type !== "boss" || (enemy.chargeState ?? "idle") === "idle";
    if (isStandardMovement) {
      enemy.moveTo(player.pos, enemy.speed);
    }
  });

  // --- Projectile Collision ---
  enemy.onCollide("projectile", (projectile) => {
    if (enemy.dead) return;

    let damageToApply = projectile.damage;

    // Handle boss vulnerability and crit effects
    if (enemy.type === "boss" && enemy.isVulnerable) {
      damageToApply *= VULNERABILITY_DAMAGE_MULTIPLIER;
      showCritEffect(k, enemy.pos, "CRIT!", k.rgb(255, 255, 0));
      k.shake(3);
    }

    enemy.hurt(damageToApply);
    k.destroy(projectile);

    if (projectile.isCrit) {
      showCritEffect(k, enemy.pos, "CRIT!", k.rgb(255, 0, 0)); // Visual for player crits
    }

    // --- Handle post-damage logic if enemy survives ---
    if (enemy.hp() > 0) {
      const hpRatio = Math.max(0.01, enemy.hp() / enemy.maxHp);

      // 'rageTank' speeds up as it loses health. Ramps up to 1.5x speed.
      if (enemy.type === "rageTank") {
        enemy.speed = enemy.baseSpeed * (1 + (1 - hpRatio) * 0.5);
      }

      // Non-boss enemies have visual feedback and a temporary slow.
      if (enemy.type !== "boss") {
        enemy.speed = enemy.baseSpeed * 0.3;
        k.wait(0.2, () => (enemy.speed = enemy.baseSpeed));
        enemy.color = k.rgb(...interpolateColor(enemy.originalColor, [240, 240, 240], hpRatio));
      }
    } else {
      // --- Handle enemy death ---
      enemyDeathLogic(k, enemy, player, gameContext);
      if (enemy.type === "boss") {
        k.wait(0.5, () => k.go("victory"));
      }
    }
  });
}

// =============================================================================
// REFACTOR 4: Utility and Logic Functions
// =============================================================================

/**
 * Handles the common logic for an enemy's death to avoid code duplication.
 */
export function enemyDeathLogic(k, enemy, player, gameContext) {
  if (enemy.dead) return; // Prevent this from running multiple times
  enemy.dead = true;

  enemyDeathAnimation(k, enemy);
  gameContext.increaseScore?.(enemy.score);
  dropPowerUp(k, player, enemy.pos, gameContext.sharedState);
}

/**
 * Displays a text-based critical hit effect at a position.
 */
function showCritEffect(k, pos, text, color) {
  k.add([
    k.text(text, { size: 16 }),
    k.pos(pos.add(k.rand(-20, 20), k.rand(-20, 20))),
    k.color(color),
    k.lifespan(0.5),
    k.move(k.UP, 40),
  ]);
}