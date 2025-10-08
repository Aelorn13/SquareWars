import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";
import { spawnEnemy } from "./enemySpawner.js";

const SPAWN_COUNT = 3;
const SPAWN_SPACING = 0.06;  // seconds between spawns
const OFFSET_MIN = 8;        // min spawn distance
const OFFSET_MAX = 18;       // max spawn distance

export function createSpawnerEnemy(k, player, gameContext, spawnPos) {
  const spawner = createEnemyGameObject(k, player, ENEMY_CONFIGS.spawner, spawnPos, gameContext);
  attachEnemyBehaviors(k, spawner, player);

  const originalDie = spawner.die.bind(spawner);

  spawner.die = function (...args) {
    if (this.dead) return;

    const deathPos = k.vec2(this.pos.x, this.pos.y);

    const spawnSmall = () => {
      const angle = k.deg2rad(k.rand(0, 360));
      const dir = k.vec2(Math.cos(angle), Math.sin(angle));
      const offset = dir.scale(k.rand(OFFSET_MIN, OFFSET_MAX));
      const smallPos = deathPos.add(offset);

  const small = spawnEnemy(k, player, gameContext, { 
      forceType: "small",
      spawnPos: smallPos,
      progress: gameContext.sharedState.spawnProgress, 
      difficulty: gameContext.difficulty, 
  });
      
      // The spawnEnemy function returns the new enemy when spawnPos is used.
      if (small && small.exists()) {
        small.canDropPowerup = false;
      }
    };

    const spawnAll = () => {
      for (let i = 0; i < SPAWN_COUNT; i++) {
        const delay = i * SPAWN_SPACING;
        if (delay === 0) spawnSmall();
        else k.wait(delay, spawnSmall);
      }
    };

    if (!gameContext?.sharedState?.isPaused) {
      spawnAll();
    } else {
      const waiter = this.onUpdate(() => {
        if (!this.exists() || !gameContext.sharedState.isPaused) {
          waiter.cancel();
          if (this.exists()) spawnAll();
        }
      });
    }

    originalDie(...args);
  };

  return spawner;
}