import { ENEMY_TYPES, chooseEnemyType } from "./enemyTypes.js";
import {
  interpolateColor,
  dropPowerUp,
  enemyDeathAnimation,
  pickEdgeSpawnPosFarFromPlayer,
  showSpawnTelegraph,
} from "./enemyUtils.js";
import { attachBossBrain } from "./boss/index.js";
import {VULNERABILITY_DAMAGE_MULTIPLIER} from "./boss/constants.js"

/**
 * Spawns an enemy entity into the game world.
 *
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player entity.
 * @param {function} updateHealthBar - Function to update the player's health bar UI.
 * @param {function} updateScoreLabel - Function to update the score label UI.
 * @param {function} increaseScore - Function to increase the player's score.
 * @param {object} sharedState - Global shared state object for the game.
 * @param {string|null} [forceType=null] - Optional: Forces a specific enemy type (e.g., "boss").
 * @param {object|null} [spawnPositionOverride=null] - Optional: If provided, spawns the enemy at this specific position, skipping edge telegraph.
 * @param {number} [progress=0] - Game progress (0-1) used for rarity ramping of enemy types.
 * @param {boolean} [showTelegraph=true] - If true and no spawnPositionOverride, shows an edge telegraph before spawning.
 */
export function spawnEnemy(
  k,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState,
  forceType = null,
  spawnPositionOverride = null,
  progress = 0,
  showTelegraph = true
) {
  // === 1. Initialize Global Collision Hook (One-Time Setup) ===
  // Ensures that the player-enemy collision logic is only set up once globally.
  if (!sharedState._enemyPlayerCollisionHookInitialized) {
    sharedState._enemyPlayerCollisionHookInitialized = true;
    k.onCollide("enemy", "player", (enemy, playerEntity) => {
      // Safely handle cases where entities might be null or already dead.
      if (!enemy || !playerEntity || enemy.dead) return;
      if (playerEntity.isInvincible) return;

      // Player takes damage.
      playerEntity.hurt(enemy.damage ?? 1);
      updateHealthBar?.();
      k.shake(10); // Visual feedback for player taking damage.

      // Check for player death.
      if (playerEntity.hp && playerEntity.hp() <= 0) {
        k.go("gameover");
      }

      // Non-boss enemies are destroyed upon colliding with the player.
      if (enemy.type !== "boss") {
        k.destroy(enemy);
      }
    });
  }

  // === 2. Determine Spawn Position ===
  const defaultSpawnPosition = pickEdgeSpawnPosFarFromPlayer(
    k,
    sharedState,
    player,
    120, // Min distance from player
    28 // Min distance from edge
  );
  const actualSpawnPosition = spawnPositionOverride ?? defaultSpawnPosition;

  // === 3. Determine Enemy Type ===
  // If forceType is provided, find that specific type; otherwise, choose based on progress.
  const enemyTypeConfig = forceType
    ? ENEMY_TYPES.find((type) => type.name === forceType) ??
      chooseEnemyType(ENEMY_TYPES, progress) // Fallback if forced type not found
    : chooseEnemyType(ENEMY_TYPES, progress);

  // === 4. Core Enemy Creation Function ===
  // This function encapsulates the actual creation and setup of the enemy entity.
  const createEnemyEntity = () => {
    const enemy = k.add([
      k.rect(enemyTypeConfig.size, enemyTypeConfig.size),
      k.color(k.rgb(...enemyTypeConfig.color)),
      k.anchor("center"),
      k.area(), // Enables collisions
      k.body(), // Enables physics (gravity, collision response - though body usually implies gravity)
      k.pos(actualSpawnPosition),
      k.rotate(0),
      k.health(enemyTypeConfig.maxHp),
      "enemy", // Tag for collision detection
      {
        originalColor: enemyTypeConfig.color,
        score: enemyTypeConfig.score,
        speed: enemyTypeConfig.speed,
        maxHp: enemyTypeConfig.maxHp,
        damage: enemyTypeConfig.damage,
        type: enemyTypeConfig.name,
        dead: false, // Custom flag to indicate death state
      },
    ]);

    // Store base stats for later modifications (e.g., speed changes)
    enemy._baseStats = {
      speed: enemy.speed,
    };

    // Initial orientation towards the player.
    enemy.rotateTo(player.pos.angle(enemy.pos));

    // --- Enemy Update Loop (Movement, Death Check) ---
    enemy.onUpdate(() => {
      if (sharedState.isPaused || enemy.dead) return;

      // Bosses might have specific charge states where they don't move.
      if (enemy.type !== "boss" || (enemy.chargeState ?? "idle") === "idle") {
        enemy.moveTo(player.pos, enemy.speed);
      }

      // If enemy is already dead, no further update logic needed.
      if (enemy.dead) return;

      // Safely get current health.
      const currentHp = typeof enemy.hp === "function" ? enemy.hp() : enemy.hp;

      // Skip health check until HP is a valid number.
      if (typeof currentHp !== "number" || Number.isNaN(currentHp)) return;

      // Handle enemy death when HP drops to or below zero.
      if (currentHp <= 0) {
        enemyDeathLogic(
          k,
          enemy,
          player,
          increaseScore,
          updateScoreLabel,
          sharedState
        );
      }
    });

    // --- Projectile Collision Handler ---
    enemy.onCollide("projectile", (projectile) => {
      if (enemy.dead) return; // Prevent actions on an already dead enemy.

      k.destroy(projectile); // Projectile is consumed on hit.

      let damageToApply = projectile.damage; // Start with base damage

      if (enemy.type === "boss" && enemy.isVulnerable) {
        damageToApply *= VULNERABILITY_DAMAGE_MULTIPLIER;
        k.add([
          k.text("CRIT!", { size: 16 }),
          k.color(255, 255, 0), // Yellow text
          k.pos(enemy.pos.add(k.rand(-20, 20), k.rand(-20, 20))),
          k.lifespan(0.5),
          k.move(k.UP, 40),
          k.opacity(1),
        ]);
        k.shake(3); //  screen shake xdd
      }

      enemy.hurt(damageToApply); // Apply calculated damage to the enemy.

      // Visual feedback for critical hits.
      if (projectile.isCrit) {
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 100 + 50;
          const critParticle = k.add([
            k.circle(2),
            k.color(255, 0, 0), // Red color for crit
            k.pos(enemy.pos),
            k.anchor("center"),
          ]);
          const velocity = k
            .vec2(Math.cos(angle), Math.sin(angle))
            .scale(speed);
          k.tween(
            critParticle.pos,
            critParticle.pos.add(velocity.scale(0.2)),
            0.2,
            (v) => (critParticle.pos = v)
          );
          k.wait(0.2, () => k.destroy(critParticle));
        }
      }

      // Handle enemy state if still alive after damage.
      if (enemy.hp() > 0) {
        const hpRatio = Math.max(enemy.hp() / enemy.maxHp, 0.01); // Avoid division by zero, min 0.01

        // Specific behavior for "rageTank" type.
        if (enemy.type === "rageTank") {
          // rageTank speeds up as it loses HP.
          enemy.speed = enemy._baseStats.speed * (1 + (1 - hpRatio) * 0.5); // Smoother ramping, tuned factor
        }

        // General visual feedback and temporary speed reduction for non-boss enemies.
        if (enemy.type !== "boss") {
          // Briefly slow down non-boss enemies after being hit.
          enemy.speed = enemy._baseStats.speed * 0.3; // Significantly slow down
          k.wait(0.2, () => (enemy.speed = enemy._baseStats.speed)); // Return to original speed

          // Interpolate enemy color towards white based on health ratio.
          const hitColor = [240, 240, 240];
          enemy.use(
            k.color(
              k.rgb(...interpolateColor(enemy.originalColor, hitColor, hpRatio))
            )
          );
        }
      } else {
        // Enemy defeated by projectile.
        enemyDeathLogic(
          k,
          enemy,
          player,
          increaseScore,
          updateScoreLabel,
          sharedState
        );
        if (enemy.type === "boss") {
          k.wait(0.5, () => k.go("victory")); // Transition to victory screen for boss
        }
      }
    });

    // --- Boss-Specific AI Attachment ---
    if (enemy.type === "boss") {
      attachBossBrain(
        k,
        enemy,
        player,
        updateHealthBar,
        updateScoreLabel,
        increaseScore,
        sharedState
      );
    }

    return enemy;
  };

  // === 5. Handle Spawn Telegraph or Immediate Spawn ===
  if (forceType === "boss") {
    // Special handling for boss to always return the boss object, even if telegraphed
    const TELEGRAPH_DURATION_SECONDS = 0.6;
    showSpawnTelegraph(k, actualSpawnPosition, sharedState, TELEGRAPH_DURATION_SECONDS);
    return new Promise(resolve => {
      k.wait(TELEGRAPH_DURATION_SECONDS, () => {
        const bossEntity = createEnemyEntity();
        resolve(bossEntity);
      });
    });
  } else {
    // For non-bosses or if not forced as boss, behave as before
    if (spawnPositionOverride || !showTelegraph) {
      return createEnemyEntity();
    } else {
      const TELEGRAPH_DURATION_SECONDS = 0.6;
      showSpawnTelegraph(k, actualSpawnPosition, sharedState, TELEGRAPH_DURATION_SECONDS);
      k.wait(TELEGRAPH_DURATION_SECONDS, () => {
        createEnemyEntity();
      });
      return null; // Non-bosses return null if telegraphed (or handle differently if needed)
    }
  }
}

/**
 * Handles the common logic for an enemy's death.
 * This function is extracted to avoid duplication in onUpdate and onCollide.
 */
function enemyDeathLogic(
  k,
  enemy,
  player,
  increaseScore,
  updateScoreLabel,
  sharedState
) {
  if (enemy.dead) return; // Prevent double-triggering death logic
     enemy.dead = true;
  enemyDeathAnimation(k, enemy); // Visual death effect
  increaseScore?.(enemy.score); // Update player score
  updateScoreLabel?.(); // Refresh score display
  dropPowerUp(k, player, enemy.pos, sharedState); // Drop power-up at enemy's position
}
