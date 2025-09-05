import { createPlayer } from "../components/player/player.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { setupBossBehaviors } from "../components/enemy/boss/bossSetup.js";
import { createScoreLabel, updateScoreLabel, drawHealthBar, drawDashCooldownBar, createTimerLabel, updateTimerLabel, createPauseLabel, createBossHealthBar, } from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { keysPressed } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";

const MINIMAL_SPAWN_INTERVAL = 0.2;
const INTERVAL_DECREASE = 0.02;

export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {
    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = { x: ARENA_MARGIN, y: ARENA_MARGIN, w: k.width() - ARENA_MARGIN * 2, h: k.height() - ARENA_MARGIN * 2 };
    k.add([ k.rect(ARENA.w, ARENA.h), k.pos(ARENA.x, ARENA.y), k.color(20, 20, 20), k.outline(2, k.rgb(80, 80, 80)), k.fixed(), k.z(-50), "gameArena" ]);

    // --- Game State & Context ---
    const gameState = { isPaused: false, isUpgradePanelOpen: false, area: ARENA, spawnProgress: 0 };
    const player = createPlayer(k, gameState);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(k, player, gameState, currentScore, nextUpgradeScoreThresholdRef, addScore);
    };

    scoreRef.value = () => currentScore;
    setupPlayerShooting(k, player, gameState);

    const gameContext = { sharedState: gameState, increaseScore: addScore, updateHealthBar: () => drawHealthBar(k, player.hp()) };
    setupEnemyPlayerCollisions(k, gameContext);
    setupBossBehaviors(k, gameContext);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    const timerLabel = createTimerLabel(k, 2, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE);

    // --- Game Loop Variables ---
    let enemySpawnInterval = 2;
    const initialEnemySpawnInterval = enemySpawnInterval;
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false;
    let currentBoss = null;

    // --- Main Game Loop (onUpdate) ---
    k.onUpdate(() => {
      // --- Pause Handling ---
      if (keysPressed["KeyP"]) {
        if (!wasPauseKeyPreviouslyPressed) {
          gameState.isPaused = !gameState.isPaused;
          pauseLabel.hidden = !gameState.isPaused;
          wasPauseKeyPreviouslyPressed = true;
        }
      } else {
        wasPauseKeyPreviouslyPressed = false;
      }
  k.paused = gameState.isPaused || gameState.isUpgradePanelOpen;

  // The existing guard clause. Now it respects the global pause state.
  if (k.paused) return;
      // --- UI Updates ---
      dashCooldownBar.width = dashCooldownBar.fullWidth * player.getDashCooldownProgress();
      updateTimerLabel(timerLabel, k.dt(), MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE, enemySpawnInterval);
      
      if (!isBossSpawned) {
        // Calculate spawn progress
        const spawnIntervalRange = initialEnemySpawnInterval - MINIMAL_SPAWN_INTERVAL;
        gameState.spawnProgress = 1 - (enemySpawnInterval - MINIMAL_SPAWN_INTERVAL) / Math.max(0.0001, spawnIntervalRange);
        gameState.spawnProgress = k.clamp(gameState.spawnProgress, 0, 1);

        // --- Enemy Spawning Countdown ---
        timeUntilNextSpawn -= k.dt();
        if (timeUntilNextSpawn <= 0) {
          const shouldSpawnBoss = enemySpawnInterval <= MINIMAL_SPAWN_INTERVAL;

          if (shouldSpawnBoss) {
            // Set the flag immediately to prevent any more spawns.
            isBossSpawned = true; 
            
            const bossSpawnPromise = spawnEnemy(k, player, gameContext, {
              forceType: "boss",
              progress: gameState.spawnProgress,
            });
            
            // The promise correctly waits for the boss to be created after its telegraph.
            if (bossSpawnPromise && typeof bossSpawnPromise.then === 'function') {
                bossSpawnPromise.then((bossEntity) => {
                    currentBoss = bossEntity;
                    if (currentBoss) {
                        // The boss health bar is now created reliably.
                        createBossHealthBar(k, currentBoss);
                    }
                }).catch(console.error);
            }
          } else {
            // If it's not time for the boss, spawn a regular enemy.
            spawnEnemy(k, player, gameContext, { progress: gameState.spawnProgress });
            
            // And update the timer for the next spawn.
            enemySpawnInterval = Math.max(MINIMAL_SPAWN_INTERVAL, enemySpawnInterval - INTERVAL_DECREASE);
            timeUntilNextSpawn = enemySpawnInterval;
          }
        }
      }
    });

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, gameContext, () => drawHealthBar(k, player.hp()));
      k.destroy(powerUp);
    });
  });
}