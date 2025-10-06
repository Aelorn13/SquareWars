// ===== components/enemy/enemyMerger.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";

/**
 * Configuration for enemy merging.
 * Key: The 'name' of the enemy from ENEMY_CONFIGS that can merge.
 * Properties:
 *   - mergeTime: Time in seconds enemies must be in contact to merge.
 *   - statMultiplier: The factor by which HP/damage stats are increased per merge level.
 *   - sizeMultiplier: The factor by which size increases per merge level (additive).
 */
const MERGE_CONFIG = {
  tank: {
    mergeTime: 3,
    statMultiplier: 3,
    sizeMultiplier: 0.75, // Merged tank will be 1.75x, then 2.5x, etc.
  },
    normal: {
    mergeTime: 3,
    statMultiplier: 3,
    sizeMultiplier: 0.75, // Merged tank will be 1.75x, then 2.5x, etc.
  },
};

// Tracks ongoing collisions between mergeable enemies.
const ongoingCollisions = new Map();

/**
 * Creates a unique, order-independent ID for a pair of enemies.
 */
function getPairId(e1, e2) {
  return e1.id < e2.id ? `${e1.id}-${e2.id}` : `${e2.id}-${e1.id}`;
}

/**
 * Executes the merge, creating a new, more powerful version of the same enemy type.
 */
function performMerge(k, gameContext, enemy1, enemy2, config) {
  if (enemy1.dead || enemy2.dead) return;

  const baseConfig = ENEMY_CONFIGS[enemy1.type];
  if (!baseConfig) {
    console.error(`Base config for type "${enemy1.type}" not found!`);
    return;
  }
  
  const newMergeLevel = (enemy1.mergeLevel || 1) + 1;

  // 1. Calculate the spawn position for the new enemy.
  const midpoint = enemy1.pos.add(enemy2.pos).scale(0.5);

  // 2. Dynamically create the configuration for the merged enemy based on its new level.
  // The score value is increased here, so the player gets a larger reward later.
  const mergedConfig = {
    ...baseConfig,
    maxHp: Math.round(baseConfig.maxHp * Math.pow(config.statMultiplier, newMergeLevel - 1)),
    damage: Math.round(baseConfig.damage * Math.pow(config.statMultiplier, newMergeLevel - 1)),
    size: baseConfig.size * (1 + (newMergeLevel - 1) * config.sizeMultiplier),
    score: Math.round(baseConfig.score * Math.pow(config.statMultiplier, newMergeLevel - 1) * newMergeLevel),
    color: [
      Math.max(0, baseConfig.color[0] - 20 * (newMergeLevel - 1)),
      Math.max(0, baseConfig.color[1] - 20 * (newMergeLevel - 1)),
      Math.max(0, baseConfig.color[2] - 20 * (newMergeLevel - 1))
    ],
  };
  
  // --- THIS LINE WAS REMOVED ---
  // gameContext.increaseScore?.(enemy1.score + enemy2.score); 
  // -----------------------------

  // 3. Destroy the original enemies.
  if (enemy1.exists()) k.destroy(enemy1);
  if (enemy2.exists()) k.destroy(enemy2);

  // 4. Create the new, powerful enemy.
  const mergedEnemy = createEnemyGameObject(k, gameContext.player, mergedConfig, midpoint, gameContext);
  
  mergedEnemy.mergeLevel = newMergeLevel;
  
  attachEnemyBehaviors(k, mergedEnemy, gameContext.player);

  // 5. Add a visual effect for the merge.
  k.add([
    k.circle(mergedConfig.size * 0.7),
    k.pos(midpoint),
    k.anchor('center'),
    k.scale(1),
    k.color(255, 255, 255),
    k.opacity(0.8),
    k.lifespan(0.4, { fade: 0.4 })
  ]);

  k.tween(mergedEnemy.scale, k.vec2(1.2), 0.1, (s) => mergedEnemy.scale = s, k.easings.easeOutQuad).then(() => {
    k.tween(mergedEnemy.scale, k.vec2(1), 0.1, (s) => mergedEnemy.scale = s, k.easings.easeInQuad);
  });
}

/**
 * Sets up all the necessary listeners for the enemy merging mechanic.
 * @param {KaboomCtx} k The Kaboom context.
 * @param {object} gameContext The global game context, including sharedState.
 */
export function setupEnemyMerging(k, gameContext) {
  k.onAdd("enemy", (enemy) => {
    if (MERGE_CONFIG[enemy.type]) {
      enemy.use("mergeable");
      enemy.isMerging = false;
      enemy.mergeLevel = enemy.mergeLevel || 1;
    }
  });

  k.onCollide("mergeable", "mergeable", (e1, e2) => {
    if (e1.type !== e2.type || e1.mergeLevel !== e2.mergeLevel || e1.isMerging || e2.isMerging || e1.dead || e2.dead) {
      return;
    }

    const pairId = getPairId(e1, e2);
    if (!ongoingCollisions.has(pairId)) {
      ongoingCollisions.set(pairId, {
        enemy1: e1,
        enemy2: e2,
        startTime: k.time(),
      });
    }
  });

  k.onCollideEnd("mergeable", "mergeable", (e1, e2) => {
    const pairId = getPairId(e1, e2);
    ongoingCollisions.delete(pairId);
    
    if(e1.exists() && !e1.dead) e1.color = k.rgb(...interpolateColorToOriginal(e1));
    if(e2.exists() && !e2.dead) e2.color = k.rgb(...interpolateColorToOriginal(e2));
  });
  
  const interpolateColorToOriginal = (enemy) => {
      const baseConfig = ENEMY_CONFIGS[enemy.type];
      return [
        Math.max(0, baseConfig.color[0] - 20 * ((enemy.mergeLevel || 1) - 1)),
        Math.max(0, baseConfig.color[1] - 20 * ((enemy.mergeLevel || 1) - 1)),
        Math.max(0, baseConfig.color[2] - 20 * ((enemy.mergeLevel || 1) - 1))
      ]
  }

  k.onUpdate(() => {
    if (gameContext.sharedState.isPaused) {
      return;
    }

    for (const [pairId, collisionData] of ongoingCollisions.entries()) {
      const { enemy1, enemy2, startTime } = collisionData;
      const config = MERGE_CONFIG[enemy1.type];

      if (!enemy1.exists() || !enemy2.exists() || enemy1.dead || enemy2.dead) {
        ongoingCollisions.delete(pairId);
        continue;
      }

      const elapsedTime = k.time() - startTime;
      const mergeProgress = elapsedTime / config.mergeTime;

      const intensity = 1 + Math.sin(k.time() * 30) * 0.5 * mergeProgress;
      const originalColor = interpolateColorToOriginal(enemy1);

      const newColor = k.rgb(
          originalColor[0] * intensity,
          originalColor[1] * intensity,
          originalColor[2] * intensity,
      );
      enemy1.color = newColor;
      enemy2.color = newColor;
      
      if (elapsedTime >= config.mergeTime) {
        enemy1.isMerging = true;
        enemy2.isMerging = true;
        
        performMerge(k, gameContext, enemy1, enemy2, config);
        
        ongoingCollisions.delete(pairId);
      }
    }
  });
}
