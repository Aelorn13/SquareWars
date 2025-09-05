import { createPlayer } from "../components/player/player.js";
// Import the refactored functions from the enemy file
import {
  spawnEnemy,
  setupEnemyPlayerCollisions,
} from "../components/enemy/enemy.js";
import { enemyDeathLogic } from "../components/enemy/enemy.js"; // Or the correct path

import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createTimerLabel,
  updateTimerLabel,
  createPauseLabel,
  createBossHealthBar,
} from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { keysPressed } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";

// Constants for enemy spawning
const MINIMAL_SPAWN_INTERVAL = 0.2; // The fastest enemies can spawn
const INTERVAL_DECREASE = 0.02; // How much the spawn interval decreases over time

/**
 * Defines the main game scene.
 * @param {kaboomCtx} k - The Kaboom.js/kaplay context object.
 * @param {Ref<Function>} scoreRef - A reference to a function that returns the current score.
 */
export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {
    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = {
      x: ARENA_MARGIN,
      y: ARENA_MARGIN,
      w: k.width() - ARENA_MARGIN * 2,
      h: k.height() - ARENA_MARGIN * 2,
    };

    k.add([
      k.rect(ARENA.w, ARENA.h),
      k.pos(ARENA.x, ARENA.y),
      k.color(20, 20, 20),
      k.outline(2, k.rgb(80, 80, 80)),
      k.fixed(),
      k.z(-50),
      "gameArena",
    ]);

    // --- Game State Management ---
    const gameState = {
      isPaused: false,
      isUpgradePanelOpen: false,
      area: ARENA,
      spawnProgress: 0,
    };

    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(
        scoreLabel,
        currentScore,
        nextUpgradeScoreThresholdRef.value
      );
      maybeShowUpgrade(
        k,
        player,
        gameState,
        currentScore,
        nextUpgradeScoreThresholdRef,
        addScore
      );
    };

    scoreRef.value = () => currentScore;

    // --- Player Setup ---
    const player = createPlayer(k, gameState);
    setupPlayerShooting(k, player, gameState);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);

    // --- Game Context  ---
const gameContext = {
    sharedState: gameState,
    increaseScore: addScore,
    updateHealthBar: () => drawHealthBar(k, player.hp()),
    enemyDeathLogic, // ES6 shorthand for enemyDeathLogic: enemyDeathLogic
};

// THIS IS FOR DEBUGGING: Check your browser's developer console for this message.
console.log("Game Context created in scene:", gameContext);
if (typeof gameContext.enemyDeathLogic !== 'function') {
    console.error("CRITICAL ERROR: enemyDeathLogic was NOT added to gameContext!");
}

    // --- Global Collision Setup
    setupEnemyPlayerCollisions(k, gameContext);

    // --- Game Loop Variables ---
    let enemySpawnInterval = 2;
    const initialEnemySpawnInterval = enemySpawnInterval;
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let isSpawningBoss = false;
    let wasPauseKeyPreviouslyPressed = false;
    let currentBoss = null;

    const timerLabel = createTimerLabel(
      k,
      enemySpawnInterval,
      MINIMAL_SPAWN_INTERVAL,
      INTERVAL_DECREASE
    );

    // --- Main Game Loop (onUpdate) ---
    k.onUpdate(() => {
      // Handle Pause Toggle
      if (keysPressed["KeyP"]) {
        if (!wasPauseKeyPreviouslyPressed) {
          gameState.isPaused = !gameState.isPaused;
          pauseLabel.hidden = !gameState.isPaused;
          wasPauseKeyPreviouslyPressed = true;
        }
      } else {
        wasPauseKeyPreviouslyPressed = false;
      }

      if (gameState.isPaused || gameState.isUpgradePanelOpen) return;

      // Update UI
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * player.getDashCooldownProgress();

      // Calculate enemy spawn progress
      const spawnIntervalRange =
        initialEnemySpawnInterval - MINIMAL_SPAWN_INTERVAL;
      gameState.spawnProgress =
        1 -
        (enemySpawnInterval - MINIMAL_SPAWN_INTERVAL) /
          Math.max(0.0001, spawnIntervalRange);
      gameState.spawnProgress = k.clamp(gameState.spawnProgress, 0, 1);

      // --- Enemy Spawning Logic ---
      timeUntilNextSpawn -= k.dt();
      if (timeUntilNextSpawn <= 0) {
        const shouldSpawnBoss =
          !isBossSpawned &&
          !isSpawningBoss &&
          enemySpawnInterval <= MINIMAL_SPAWN_INTERVAL;

        if (shouldSpawnBoss) {
          isSpawningBoss = true;
          // UPDATED: Call spawnEnemy with the new signature
          const bossSpawnPromise = spawnEnemy(k, player, gameContext, {
            forceType: "boss",
            progress: gameState.spawnProgress,
          });

          // The promise handling logic remains the same
          if (bossSpawnPromise && typeof bossSpawnPromise.then === "function") {
            bossSpawnPromise
              .then((bossEntity) => {
                currentBoss = bossEntity;
                if (currentBoss) {
                  isBossSpawned = true;
                  createBossHealthBar(k, currentBoss);
                }
                isSpawningBoss = false;
              })
              .catch((error) => {
                console.error("Error spawning boss:", error);
                isSpawningBoss = false;
              });
          } else {
            console.error("spawnEnemy did not return a promise for boss type.");
            isSpawningBoss = false;
          }
        } else if (!isBossSpawned) {
          // UPDATED: Call spawnEnemy with the new signature for regular enemies
          spawnEnemy(k, player, gameContext, {
            progress: gameState.spawnProgress,
          });
        }

        // Decrease spawn interval to ramp up difficulty
        enemySpawnInterval = Math.max(
          MINIMAL_SPAWN_INTERVAL,
          enemySpawnInterval - INTERVAL_DECREASE
        );
        timeUntilNextSpawn = enemySpawnInterval;
      }

      // Update the timer UI
      updateTimerLabel(
        timerLabel,
        k.dt(),
        MINIMAL_SPAWN_INTERVAL,
        INTERVAL_DECREASE,
        enemySpawnInterval
      );
    });

    // --- Event Handlers ---
player.onCollide("powerup", (powerUp) => {
  // The onHeal callback is the LAST argument.
  applyPowerUp(k, player, powerUp.type, gameContext, () => {
    drawHealthBar(k, player.hp());
  });
  k.destroy(powerUp);
});

  });
}
