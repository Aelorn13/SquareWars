// ===== components/enemy/slimeEnemy.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";

const TRAIL_COOLDOWN = 0.75;
const POOL_LIFESPAN = 5.0;
const POOL_SIZE = 20;
const SLOW_MODIFIER = 0.5;
const FADE_DURATION = 0.5;

// Track per-scene setup state
const sceneSetupState = new WeakMap();

/**
 * Setup puddle logic for this specific game context
 * Uses WeakMap to track per-scene state and avoid conflicts
 */
function setupPuddleLogic(k, gameContext) {
  if (sceneSetupState.has(gameContext)) return;
  sceneSetupState.set(gameContext, true);

  k.onUpdate("slimePuddle", (puddle) => {
    if (!puddle || !puddle.exists()) return;

    if (gameContext.sharedState.isPaused || gameContext.sharedState.upgradeOpen) {
      return;
    }
    puddle._lifeTimer -= k.dt();

    if (puddle._lifeTimer <= FADE_DURATION) {
      const fadeProgress = puddle._lifeTimer / FADE_DURATION;
      puddle.opacity = Math.max(0, fadeProgress);
    }

    if (puddle._lifeTimer <= 0) {
      try {
        puddle.destroy();
      } catch (e) {}
    }
  });
}

/**
 * Cleanup function to call when scene ends
 */
export function cleanupSlimePuddles(k) {
  const puddles = k.get("slimePuddle");
  for (const puddle of puddles) {
    try {
      if (puddle && puddle.exists()) {
        puddle.destroy();
      }
    } catch (e) {}
  }
}

export function createSlimeEnemy(k, player, gameContext, spawnPos) {
  setupPuddleLogic(k, gameContext);

  const cfg = ENEMY_CONFIGS.slime;
  const slime = createEnemyGameObject(k, player, cfg, spawnPos, gameContext);
  attachEnemyBehaviors(k, slime, player);

  slime._trailCooldown = TRAIL_COOLDOWN;

  slime.onUpdate(() => {
    if (!slime || !slime.exists() || slime.dead) return;
    if (gameContext.sharedState.isPaused || gameContext.sharedState.upgradeOpen) {
      return;
    }

    slime._trailCooldown -= k.dt();

    if (slime._trailCooldown <= 0) {
      slime._trailCooldown = TRAIL_COOLDOWN;
      const slimePoolPoints = [
        k.vec2(0, -POOL_SIZE),
        k.vec2(POOL_SIZE * 0.8, -POOL_SIZE * 0.6),
        k.vec2(POOL_SIZE, 0),
        k.vec2(POOL_SIZE * 0.5, POOL_SIZE * 0.9),
        k.vec2(-POOL_SIZE * 0.2, POOL_SIZE),
        k.vec2(-POOL_SIZE, POOL_SIZE * 0.3),
        k.vec2(-POOL_SIZE * 0.9, -POOL_SIZE * 0.4),
      ];

      try {
        k.add([
          k.polygon(slimePoolPoints),
          k.pos(slime.pos.x, slime.pos.y), // Clone position values
          k.anchor("center"),
          k.area({ shape: new k.Polygon(slimePoolPoints) }),
          k.color(80, 150, 30),
          k.opacity(0.7),
          k.z(-1),
          "slimePuddle",
          {
            slowdownModifier: SLOW_MODIFIER,
            _lifeTimer: POOL_LIFESPAN,
            _createdAt: k.time?.() ?? Date.now() / 1000,
          },
        ]);
      } catch (e) {
        console.error("[slimeEnemy] Failed to create puddle:", e);
      }
    }
  });
  return slime;
}
