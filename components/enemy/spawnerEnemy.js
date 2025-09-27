/**
 * components/enemy/spawnerEnemy.js
 * Spawner enemy that, on death, spawns 3 Small enemies.
 *
 * Fix: ensure the spawner receives the normal enemy behavior hooks
 * (movement + projectile collision) by calling attachEnemyBehaviors.
 */

import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";

export function createSpawnerEnemy(k, player, gameContext, spawnPos) {
  const spawner = createEnemyGameObject(k, player, ENEMY_CONFIGS.spawner, spawnPos, gameContext);

  // --- FIX: attach normal enemy behavior so it moves and collides with projectiles ---
  attachEnemyBehaviors(k, spawner, player);

  // Preserve original die behavior (score, powerups, animation, destruction).
  const originalDie = spawner.die.bind(spawner);

  spawner.die = function (...args) {
    if (this.dead) return;

    // Snapshot the exact death position immediately.
    const deathPos = k.vec2(this.pos.x, this.pos.y);

    const SPAWN_COUNT = 3;
    const SPAWN_SPACING = 0.06;    // seconds between each small spawn
    const OFFSET_MIN = 8;         // radial offset min (pixels)
    const OFFSET_MAX = 18;        // radial offset max (pixels)
    const SPAWN_GRACE = 0.12;     // seconds during which smalls ignore player collisions

    const spawnOne = () => {
      const angle = k.deg2rad(k.rand(0, 360));
      const dir = k.vec2(Math.cos(angle), Math.sin(angle));
      const offset = dir.scale(k.rand(OFFSET_MIN, OFFSET_MAX));
      const smallPos = deathPos.add(offset);

      const small = createEnemyGameObject(k, player, ENEMY_CONFIGS.small, smallPos, this.gameContext);
      attachEnemyBehaviors(k, small, player);

      // smalls do NOT drop powerups by default
      small.canDropPowerup = false;

      // remove any inherited buff state
      small._slowMultipliers = [];
      small._buffedMoveMultiplier = undefined;
      if (typeof small.recomputeStat === "function") small.recomputeStat("moveSpeed");

      // brief spawn grace to avoid instant player collisions
      small._spawnGrace = true;
      k.wait(SPAWN_GRACE, () => { if (small.exists()) small._spawnGrace = false; });
    };

    const doSpawn = () => {
      for (let i = 0; i < SPAWN_COUNT; i++) {
        const delay = i * SPAWN_SPACING;
        if (delay === 0) spawnOne();
        else k.wait(delay, spawnOne);
      }
    };

    // Defer to unpause if the game is paused (matches boss pattern).
    if (!gameContext?.sharedState?.isPaused) {
      doSpawn();
    } else {
      const waiter = this.onUpdate(() => {
        if (!this.exists()) {
          waiter.cancel();
          return;
        }
        if (!gameContext.sharedState.isPaused) {
          waiter.cancel();
          doSpawn();
        }
      });
    }

    // Run original die logic (score, animation, destroy).
    originalDie(...args);
  };

  return spawner;
}
