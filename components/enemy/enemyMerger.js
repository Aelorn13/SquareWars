// ===== components/enemy/enemyMerger.js =====

// 1. IMPORT the main spawnEnemy function
import { spawnEnemy } from "./enemySpawner.js";
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { attachEnemyBehaviors } from "./enemyBehavior.js";

const MERGE_CONFIG = {
  tank: {
    mergeTime: 3,
    statMultiplier: 3,
    sizeMultiplier: 0.75,
  },
  normal: {
    mergeTime: 3,
    statMultiplier: 3,
    sizeMultiplier: 0.75, 
  },
};

const ongoingCollisions = new Map();

function getPairId(e1, e2) {
  return e1.id < e2.id ? `${e1.id}-${e2.id}` : `${e2.id}-${e1.id}`;
}

/**
 * Executes the merge, creating a new, more powerful version of the same enemy type.
 */
function performMerge(k, gameContext, enemy1, enemy2, config) {
  if (enemy1.dead || enemy2.dead) return;

  const newMergeLevel = (enemy1.mergeLevel || 1) + 1;
  const midpoint = enemy1.pos.add(enemy2.pos).scale(0.5);
  const baseConfig = ENEMY_CONFIGS[enemy1.type];

  // 2. DESTROY the old enemies first.
  if (enemy1.exists()) k.destroy(enemy1);
  if (enemy2.exists()) k.destroy(enemy2);

  // 3. CREATE a new enemy using the main spawner.
  // This ensures it gets the correct base stats scaled by the DifficultyController.
  const mergedEnemy = spawnEnemy(k, gameContext.player, gameContext, {
      forceType: enemy1.type,
      spawnPos: midpoint, // This makes it spawn instantly
      progress: gameContext.sharedState.spawnProgress,
      difficulty: gameContext.difficulty, // This is the critical part
  });

  // If the enemy couldn't be created for some reason, stop here.
  if (!mergedEnemy || !mergedEnemy.exists()) return;

  // 4. APPLY the merge-specific bonuses ON TOP of the difficulty-scaled stats.
  mergedEnemy.mergeLevel = newMergeLevel;
  
  // Apply stat and score multipliers
  const multiplier = Math.pow(config.statMultiplier, newMergeLevel - 1);
  mergedEnemy.hp = Math.round(mergedEnemy.hp * multiplier);
  mergedEnemy.damage = Math.round(mergedEnemy.damage * multiplier);
  mergedEnemy.scoreValue = Math.round(mergedEnemy.scoreValue * multiplier * newMergeLevel);

  // Apply size and color changes
  const newSize = baseConfig.size * (1 + (newMergeLevel - 1) * config.sizeMultiplier);
  mergedEnemy.scale = k.vec2(newSize / baseConfig.size);
  mergedEnemy.color = k.rgb(
    Math.max(0, baseConfig.color[0] - 20 * (newMergeLevel - 1)),
    Math.max(0, baseConfig.color[1] - 20 * (newMergeLevel - 1)),
    Math.max(0, baseConfig.color[2] - 20 * (newMergeLevel - 1))
  );

  // 5. ADD a visual effect for the merge.
  k.add([
    k.circle(newSize * 0.7),
    k.pos(midpoint),
    k.anchor('center'),
    k.scale(1),
    k.color(255, 255, 255),
    k.opacity(0.8),
    k.lifespan(0.4, { fade: 0.4 })
  ]);

  k.tween(mergedEnemy.scale, mergedEnemy.scale.scale(1.2), 0.1, (s) => mergedEnemy.scale = s, k.easings.easeOutQuad).then(() => {
    k.tween(mergedEnemy.scale, mergedEnemy.scale.scale(1/1.2), 0.1, (s) => mergedEnemy.scale = s, k.easings.easeInQuad);
  });
}

/**
 * Sets up all the necessary listeners for the enemy merging mechanic.
 */
export function setupEnemyMerging(k, gameContext) {
  // The rest of this file remains exactly the same.
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