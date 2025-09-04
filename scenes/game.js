import { createPlayer } from "../components/player/player.js";
import { spawnEnemy } from "../components/enemy/enemy.js";
import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createTimerLabel,
  updateTimerLabel,
  createPauseLabel,
  createBossHealthBar
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

    // --- User Interface (UI) Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);

    let enemySpawnInterval = 2;
    const initialEnemySpawnInterval = enemySpawnInterval;

    const timerLabel = createTimerLabel(
      k,
      enemySpawnInterval,
      MINIMAL_SPAWN_INTERVAL,
      INTERVAL_DECREASE
    );

    // --- Game Loop Variables ---
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false;

    // --- Boss Related State ---
    let currentBoss = null; // Reference to the boss entity
    let isSpawningBoss = false; // NEW: Flag to prevent multiple boss spawn attempts

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

      // If paused or upgrade panel open, stop all game logic.
      if (gameState.isPaused || gameState.isUpgradePanelOpen) return;

      // Update Dash Cooldown UI
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * player.getDashCooldownProgress();

      // Calculate and update enemy spawn progress (0 to 1).
      const spawnIntervalRange =
        initialEnemySpawnInterval - MINIMAL_SPAWN_INTERVAL;
      gameState.spawnProgress =
        1 - (enemySpawnInterval - MINIMAL_SPAWN_INTERVAL) / Math.max(0.0001, spawnIntervalRange);
      gameState.spawnProgress = k.clamp(0, 1, gameState.spawnProgress);

      // Update Spawn Timer
      timeUntilNextSpawn -= k.dt();
      if (timeUntilNextSpawn <= 0) {
        // Determine enemy type to spawn
        const shouldSpawnBoss =
          !isBossSpawned && !isSpawningBoss && enemySpawnInterval <= MINIMAL_SPAWN_INTERVAL; // NEW: check isSpawningBoss

        if (shouldSpawnBoss) {
          isSpawningBoss = true; // Set flag to indicate boss spawning process has started
          const bossSpawnPromise = spawnEnemy(
            k,
            player,
            () => drawHealthBar(k, player.hp()),
            () =>
              updateScoreLabel(
                scoreLabel,
                currentScore,
                nextUpgradeScoreThresholdRef.value
              ),
            addScore,
            gameState,
            "boss", // Force boss type
            null, // No position override
            gameState.spawnProgress,
            true // Show telegraph
          );

          // Handle the promise when the boss is actually added to the scene
          if (bossSpawnPromise && typeof bossSpawnPromise.then === 'function') {
            bossSpawnPromise.then((bossEntity) => {
              currentBoss = bossEntity;
              if (currentBoss) {
                isBossSpawned = true; // Now the boss is truly in the game
                const bossHealthBarUI = createBossHealthBar(k, currentBoss);// Setup the health bar
              }
              isSpawningBoss = false; // Reset flag
            }).catch(error => {
              k.debug.error("Error spawning boss:", error);
              isSpawningBoss = false; // Reset flag even on error
            });
          } else {
            // Fallback for non-promise returns if spawnEnemy logic is mixed
            k.debug.error("spawnEnemy did not return a promise for boss type.");
            isSpawningBoss = false;
          }

        } else if (!isBossSpawned) { // Only spawn regular enemies if boss isn't spawned or in process
          spawnEnemy(
            k,
            player,
            () => drawHealthBar(k, player.hp()),
            () =>
              updateScoreLabel(
                scoreLabel,
                currentScore,
                nextUpgradeScoreThresholdRef.value
              ),
            addScore,
            gameState,
            null, // Spawn random enemy type
            null, // No position override
            gameState.spawnProgress // Pass spawn progress for enemy scaling
          );
        }

        // Decrease spawn interval, making enemies spawn faster over time.
        // This should apply even if the boss is spawning, to keep difficulty ramping.
        enemySpawnInterval = Math.max(
          MINIMAL_SPAWN_INTERVAL,
          enemySpawnInterval - INTERVAL_DECREASE
        );
        timeUntilNextSpawn = enemySpawnInterval; // Reset timer for the next spawn
      }

      // Update the spawn timer UI
      updateTimerLabel(
        timerLabel,
        k.dt(), // Time elapsed since last frame
        MINIMAL_SPAWN_INTERVAL,
        INTERVAL_DECREASE,
        enemySpawnInterval
      );
    });

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp());
      });
      k.destroy(powerUp);
    });
  });
}