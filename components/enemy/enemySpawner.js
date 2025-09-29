
// ===== components/enemy/enemySpawner.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";
import { attachBossBrain } from "./boss/bossAI.js";
import { attachMinibossBrain } from "./boss/minibossAI.js";
import { createSpawnerEnemy } from "./spawnerEnemy.js";
import { createSniperEnemy } from "./sniperEnemy.js";

const TELEGRAPH_DURATION = 0.6;

export function spawnEnemy(k, player, gameContext, options = {}) {
  const { forceType, spawnPos: posOverride, progress = 0, ability, scaling = {} } = options;

  const enemyConfig = forceType ? ENEMY_CONFIGS[forceType] : chooseEnemyType(progress);
  const spawnPos = posOverride ?? pickEdgeSpawnPosFarFromPlayer(k, gameContext.sharedState, player);

  const createEnemy = () => {
    // Special enemy types
    if (enemyConfig.name === "spawner") {
      return createSpawnerEnemy(k, player, gameContext, spawnPos);
    }
    if (enemyConfig.name === "sniper") {
      return createSniperEnemy(k, player, gameContext, spawnPos);
    }

    // Standard enemy creation
    const enemy = createEnemyGameObject(k, player, enemyConfig, spawnPos, gameContext);
    
    // Attach appropriate AI
    if (enemy.type === "boss") {
      attachBossBrain(k, enemy, player, gameContext);
    } else if (enemy.type === "miniboss") {
      if (!ability) {
        console.error("Miniboss spawned without an ability!");
        return;  
      }
      attachMinibossBrain(k, enemy, player, gameContext, ability, scaling);
    } else {
      attachEnemyBehaviors(k, enemy, player);
    }
    
    return enemy;
  };

  // Immediate spawn if position override
  if (posOverride) {
    return createEnemy();
  }

  // Show telegraph before spawning
  showSpawnTelegraph(k, spawnPos, gameContext.sharedState, TELEGRAPH_DURATION);

  // Boss spawns return a promise
  if (enemyConfig.name === "boss") {
    return new Promise(resolve => {
      k.wait(TELEGRAPH_DURATION, () => resolve(createEnemy()));
    });
  }

  // Regular enemies spawn after telegraph
  k.wait(TELEGRAPH_DURATION, createEnemy);
  return null;
}

/**
 * Select enemy type based on game progress
 * Progress 0-1 interpolates between start and end spawn weights
 */
function chooseEnemyType(progress) {
  const types = Object.values(ENEMY_CONFIGS);
  const p = Math.max(0, Math.min(1, progress));

  // Calculate effective weights for current progress
  const weights = types.map(enemy => {
    const start = enemy.spawnWeightStart ?? 0;
    if (start === 0) return 0; // Skip enemies with 0 start weight
    
    const end = enemy.spawnWeightEnd ?? start;
    return Math.max(0, start + (end - start) * p);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    // Fallback to first enemy with positive weight
    return types.find(e => (e.spawnWeightStart ?? 0) > 0) ?? types[0];
  }

  // Weighted random selection
  let r = Math.random() * total;
  for (let i = 0; i < types.length; i++) {
    r -= weights[i];
    if (r <= 0) return types[i];
  }
  return types[0];
}

function pickEdgeSpawnPos(k, sharedState, offset = 24) {
  const bounds = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
  
  // Random position on one of four edges
  const edges = [
    () => k.vec2(k.rand(bounds.x, bounds.x + bounds.w), bounds.y - offset), // Top
    () => k.vec2(k.rand(bounds.x, bounds.x + bounds.w), bounds.y + bounds.h + offset), // Bottom
    () => k.vec2(bounds.x - offset, k.rand(bounds.y, bounds.y + bounds.h)), // Left
    () => k.vec2(bounds.x + bounds.w + offset, k.rand(bounds.y, bounds.y + bounds.h)), // Right
  ];
  
  return k.choose(edges)();
}

/**
 * Find spawn position far from player
 */
function pickEdgeSpawnPosFarFromPlayer(k, sharedState, player, minDist = 120, maxTries = 8) {
  let best = null;
  
  for (let i = 0; i < maxTries; i++) {
    const pos = pickEdgeSpawnPos(k, sharedState, 48);
    if (pos.dist(player.pos) >= minDist) return pos;
    if (!best) best = pos;
  }
  
  return best;
}

/**
 * Visual indicator for incoming enemy spawn
 */
function showSpawnTelegraph(k, pos, sharedState, duration) {
  const arena = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
  const center = k.vec2(arena.x + arena.w / 2, arena.y + arena.h / 2);
  const dirToCenter = center.sub(pos).unit();

  const telegraph = k.add([
    k.pos(pos),
    "spawnTelegraph",
    {
      elapsed: 0,
      update() {
        this.elapsed += k.dt();
        if (this.elapsed >= duration) {
          k.destroy(this);
          return;
        }

        const progress = this.elapsed / duration;
        
        // Pulse ring
        const pulse = 0.6 + Math.sin(progress * Math.PI) * 0.6;
        this.ring.scale = k.vec2(pulse);
        this.ring.opacity = 0.9 * (1 - progress);
        
        // Animate pointer
        this.pointer.pos = dirToCenter.scale(8 * progress);
        this.pointer.scale = k.vec2(1 + progress * 0.4);
        this.pointer.opacity = 0.9 * (1 - progress);
      },
    },
  ]);

  // Ring indicator
  telegraph.ring = telegraph.add([
    k.circle(9),
    k.pos(0, 0),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.scale(1),
    k.z(60),
  ]);

  // Direction pointer
  telegraph.pointer = telegraph.add([
    k.rect(70, 6, { radius: 3 }),
    k.pos(0, 0),
    k.anchor("center"),
    k.rotate(dirToCenter.angle()),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.scale(1),
    k.z(61),
  ]);
}