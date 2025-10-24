// ===== components/encounter/hive.js =====

import { createEnemyGameObject, handleProjectileCollision } from "../enemy/enemyBehavior.js";
import { spawnEnemy } from "../enemy/enemySpawner.js";

export const hiveEncounter = {
  name: "The Hive",
  isFinished: true,
  activeHives: 0, // Keep track of how many hives are alive

  start(k, gameContext) {
    this.isFinished = false;
    this.activeHives = 0;
    const { player, increaseScore, sharedState: gameState, difficulty } = gameContext;

    // --- Encounter Configuration ---
    const numHives = k.randi(1, 3); // Spawns 1 or 2 hives
    const SPAWN_RATE = 1.5; // Seconds between spawns
    const SCORE_PER_HIVE = 7;

    // --- Hive Scaling ---
    const BASE_HP = 20;
    const HP_SCALING_PER_SECOND = 60 / 120;
    const scaledHp = Math.floor(BASE_HP + (gameState.elapsedTime * HP_SCALING_PER_SECOND));

    const hiveConfig = {
      name: "hive",
      maxHp: scaledHp,
      speed: 0, // Hives are stationary
      damage: 0,
      score: SCORE_PER_HIVE,
      size: 45,
      color: [140, 50, 180], // A menacing purple
      hasBody: false,
    };

    // --- Spawn the Hives ---
    for (let i = 0; i < numHives; i++) {
      // Find a spawn position away from the player
      const spawnPos = k.vec2(
        k.rand(gameState.area.x + 50, gameState.area.x + gameState.area.w - 50),
        k.rand(gameState.area.y + 50, gameState.area.y + gameState.area.h - 50)
      );

      // We need a direct reference to 'this' encounter object for the die function
      const encounter = this;
      const hive = createEnemyGameObject(k, player, hiveConfig, spawnPos, gameContext);

      // --- Add custom properties for hive logic ---
      hive._spawnCooldown = k.rand(0.5, SPAWN_RATE); // Stagger initial spawns
      hive.isDying = false; // For death animation

      // Increment the counter for each hive created
      this.activeHives++;

      // --- Visuals: Make the hive pulse ---
      hive.onUpdate(() => {
        // Use a wave function to smoothly scale the hive up and down
        const pulse = k.wave(0.95, 1.05, k.time() * 2);
        if (!hive.isDying) {
          hive.scale = k.vec2(pulse);
        }
      });

      // --- Main Spawning Logic ---
      hive.onUpdate(() => {
        if (hive.dead || hive.isDying || gameState.isPaused || gameState.upgradeOpen) {
          return;
        }

        hive._spawnCooldown -= k.dt();
        if (hive._spawnCooldown <= 0) {
          hive._spawnCooldown = SPAWN_RATE;

          // Determine which enemy to spawn (5% chance for slime)
          const enemyType = k.rand() < 0.05 ? 'slime' : 'small';
          
          spawnEnemy(k, player, gameContext, {
            forceType: enemyType,
            spawnPos: hive.pos,
            difficulty: difficulty, 
          });
        }
      });
      
      // --- Handle taking damage ---
      hive.onCollide("projectile", (proj) => {
        if (hive.isDying) return;
        handleProjectileCollision(k, hive, proj);
      });

      // --- DEATH LOGIC ---
      hive.die = () => {
        if (hive.dead) return;
        hive.dead = true;
        hive.area.enabled = false;
        hive.isDying = true;

        increaseScore(hive.score);
        encounter.activeHives--;
        if (encounter.activeHives <= 0) {
          encounter.isFinished = true;
        }

        // Death animation: shrink and fade away
        k.tween(hive.scale, k.vec2(0), 0.4, (s) => (hive.scale = s), k.easings.easeInQuad);
        k.tween(hive.opacity, 0, 0.4, (o) => (hive.opacity = o), k.easings.easeInQuad).then(() => {
          k.destroy(hive);
        });
      };

      // Failsafe: if a hive is destroyed by other means, ensure we update the counter
      hive.onDestroy(() => {
        if (!hive.isDying) { // Only run if 'die' wasn't the cause
            encounter.activeHives--;
            if (encounter.activeHives <= 0) {
                encounter.isFinished = true;
            }
        }
      });
    }
  },
};