
// ===== components/enemy/spawnerEnemy.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";

const SPAWN_COUNT = 3;
const SPAWN_SPACING = 0.06;  // seconds between spawns
const OFFSET_MIN = 8;         // min spawn distance
const OFFSET_MAX = 18;        // max spawn distance  
const SPAWN_GRACE = 0.12;     // collision immunity duration

export function createSpawnerEnemy(k, player, gameContext, spawnPos) {
  const spawner = createEnemyGameObject(k, player, ENEMY_CONFIGS.spawner, spawnPos, gameContext);
  attachEnemyBehaviors(k, spawner, player);

  const originalDie = spawner.die.bind(spawner);

  spawner.die = function (...args) {
    if (this.dead) return;

    // Capture death position immediately
    const deathPos = k.vec2(this.pos.x, this.pos.y);

    const spawnSmall = () => {
      const angle = k.deg2rad(k.rand(0, 360));
      const dir = k.vec2(Math.cos(angle), Math.sin(angle));
      const offset = dir.scale(k.rand(OFFSET_MIN, OFFSET_MAX));
      const smallPos = deathPos.add(offset);

      const small = createEnemyGameObject(k, player, ENEMY_CONFIGS.small, smallPos, this.gameContext);
      attachEnemyBehaviors(k, small, player);

      small.canDropPowerup = false;
      small._slowMultipliers = [];
      small._buffedMoveMultiplier = undefined;
      if (small.recomputeStat) small.recomputeStat("moveSpeed");

      // Brief immunity to avoid instant collision
      small._spawnGrace = true;
      k.wait(SPAWN_GRACE, () => { 
        if (small.exists()) small._spawnGrace = false; 
      });
    };

    const spawnAll = () => {
      for (let i = 0; i < SPAWN_COUNT; i++) {
        const delay = i * SPAWN_SPACING;
        if (delay === 0) spawnSmall();
        else k.wait(delay, spawnSmall);
      }
    };

    // Wait for unpause if needed
    if (!gameContext?.sharedState?.isPaused) {
      spawnAll();
    } else {
      const waiter = this.onUpdate(() => {
        if (!this.exists()) {
          waiter.cancel();
          return;
        }
        if (!gameContext.sharedState.isPaused) {
          waiter.cancel();
          spawnAll();
        }
      });
    }

    originalDie(...args);
  };

  return spawner;
}