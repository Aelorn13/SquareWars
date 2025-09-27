/**components/enemy/enemySpawner.js
 * @file Handles the logic for selecting, positioning, and spawning enemies.
 */

import { ENEMY_CONFIGS, RARITY_SPAWN_BIAS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";
import { attachBossBrain } from "./boss/bossAI.js";
import { attachMinibossBrain } from "./boss/minibossAI.js";
import { createSpawnerEnemy } from "./spawnerEnemy.js";

const TELEGRAPH_DURATION = 0.6;

/**
 * Orchestrates spawning an enemy, handling telegraphs and delayed creation.
 */
export function spawnEnemy(k, player, gameContext, options = {}) {
  const { forceType = null, spawnPos: posOverride = null, progress = 0, ability = null, scaling = {} } = options;

  const enemyConfig = forceType ? ENEMY_CONFIGS[forceType] : chooseEnemyType(progress);
  const spawnPos = posOverride ?? pickEdgeSpawnPosFarFromPlayer(k, gameContext.sharedState, player);

  const createAndFinalizeEnemy = () => {
    if (enemyConfig.name === "spawner") {
      return createSpawnerEnemy(k, player, gameContext, spawnPos);
    }

    const enemy = createEnemyGameObject(k, player, enemyConfig, spawnPos, gameContext);
    if (enemy.type === "boss") {
      attachBossBrain(k, enemy, player, gameContext);
    } 
    else if (enemy.type === "miniboss") {
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

  if (posOverride) {
    return createAndFinalizeEnemy();
  }

  showSpawnTelegraph(k, spawnPos, gameContext.sharedState, TELEGRAPH_DURATION);

  if (enemyConfig.name === "boss") {
    return new Promise((resolve) => {
      k.wait(TELEGRAPH_DURATION, () => {
        const boss = createAndFinalizeEnemy();
        resolve(boss);
      });
    });
  } else {
    k.wait(TELEGRAPH_DURATION, createAndFinalizeEnemy);
    return null;
  }
}

/**
 * Selects a random enemy type, biasing the choice based on game progress.
 */
function chooseEnemyType(gameProgress) {
  const enemyTypes = Object.values(ENEMY_CONFIGS);
  const clampedProgress = Math.max(0, Math.min(1, gameProgress));

  const effectiveWeights = enemyTypes.map((enemy) => {
    if (enemy.spawnWeight === 0) return 0;
    const rarityBias = RARITY_SPAWN_BIAS[enemy.rarity] ?? 0;
    const biasMultiplier = Math.max(0, 1 + clampedProgress * rarityBias);
    return enemy.spawnWeight * biasMultiplier;
  });

  const totalWeight = effectiveWeights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return enemyTypes[0];

  let randomRoll = Math.random() * totalWeight;
  for (let i = 0; i < enemyTypes.length; i++) {
    randomRoll -= effectiveWeights[i];
    if (randomRoll <= 0) {
      return enemyTypes[i];
    }
  }
  return enemyTypes[0];
}

/**
 * Picks a random spawn position just outside the game arena.
 */
function pickEdgeSpawnPos(k, sharedState, offset = 24) {
    const bounds = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
    const edges = [
        () => k.vec2(k.rand(bounds.x, bounds.x + bounds.w), bounds.y - offset),
        () => k.vec2(k.rand(bounds.x, bounds.x + bounds.w), bounds.y + bounds.h + offset),
        () => k.vec2(bounds.x - offset, k.rand(bounds.y, bounds.y + bounds.h)),
        () => k.vec2(bounds.x + bounds.w + offset, k.rand(bounds.y, bounds.y + bounds.h)),
    ];
    return k.choose(edges)();
}

/**
 * Tries multiple times to find a spawn position that is a minimum distance from the player.
 */
function pickEdgeSpawnPosFarFromPlayer(k, sharedState, player, minDistance = 120, maxTries = 8) {
  let bestPos = null;
  for (let i = 0; i < maxTries; i++) {
    const pos = pickEdgeSpawnPos(k, sharedState, 48);
    if (pos.dist(player.pos) >= minDistance) {
      return pos;
    }
    if (!bestPos) {
      bestPos = pos;
    }
  }
  return bestPos;
}

/**
 * Displays a visual telegraph indicating an upcoming enemy spawn.
 * This version uses a manual onUpdate loop to precisely control the animation feel.
 */
function showSpawnTelegraph(k, spawnPosition, sharedState, duration) {
  const arenaBounds = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
  const arenaCenter = k.vec2(arenaBounds.x + arenaBounds.w / 2, arenaBounds.y + arenaBounds.h / 2);
  const directionToCenter = arenaCenter.sub(spawnPosition).unit();

  // The parent object acts as an animation controller.
  const telegraphController = k.add([
    k.pos(spawnPosition),
    "spawnTelegraph",
    {
      elapsedTime: 0,
      // The update logic is now on the parent, controlling its children.
      update() {
        this.elapsedTime += k.dt();
        // Destroy the controller and its children when the animation is done.
        if (this.elapsedTime >= duration) {
          k.destroy(this);
          return;
        }

        const progress = this.elapsedTime / duration;

        // Animate the ring child
        const scalePulse = 0.6 + Math.sin(progress * Math.PI) * 0.6;
        this.ring.scale = k.vec2(scalePulse);
        this.ring.opacity = 0.9 * (1 - progress);

        // Animate the pointer child
        this.pointer.pos = directionToCenter.scale(8 * progress);
        this.pointer.scale = k.vec2(1 + progress * 0.4);
        this.pointer.opacity = 0.9 * (1 - progress);
      },
    },
  ]);

  // Children are added to the controller. They just exist; their parent animates them.
  telegraphController.ring = telegraphController.add([
    k.circle(9), k.pos(0, 0), k.anchor("center"), k.color(255, 255, 255),
    k.opacity(0.9), k.scale(1), k.z(60),
  ]);

  telegraphController.pointer = telegraphController.add([
    k.rect(70, 6, { radius: 3 }), k.pos(0, 0), k.anchor("center"),
    k.rotate(directionToCenter.angle()), k.color(255, 255, 255),
    k.opacity(0.9), k.scale(1), k.z(61),
  ]);
}