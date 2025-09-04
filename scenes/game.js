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
} from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { keysPressed } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";

// Constants for enemy spawning
const MINIMAL_SPAWN_INTERVAL = 1.8; // The fastest enemies can spawn
const INTERVAL_DECREASE = 0.02; // How much the spawn interval decreases over time

/**
 * Defines the main game scene.
 * @param {kaboomCtx} k - The Kaboom.js/kaplay context object.
 * @param {Ref<Function>} scoreRef - A reference to a function that returns the current score.
 */
export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {
    // --- Game Arena Setup ---
    // Define an inner arena with a 5% margin for visual boundaries.
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = {
      x: ARENA_MARGIN,
      y: ARENA_MARGIN,
      w: k.width() - ARENA_MARGIN * 2,
      h: k.height() - ARENA_MARGIN * 2,
    };

    // Add a visual floor for the arena to clearly show boundaries.
    k.add([
      k.rect(ARENA.w, ARENA.h),
      k.pos(ARENA.x, ARENA.y),
      k.color(20, 20, 20), // Slightly darker background for the play area
      k.outline(2, k.rgb(80, 80, 80)), // Subtle border
      k.fixed(), // Stays in place relative to the camera
      k.z(-50), // Render behind other game objects
      "gameArena", // Tag for easy reference if needed
    ]);

    // --- Game State Management ---
    // Centralized object for managing shared game state across components.
    const gameState = {
      isPaused: false,
      isUpgradePanelOpen: false, // Renamed for clarity
      area: ARENA, // Reference to the game arena dimensions
      spawnProgress: 0, // Current progress towards minimal spawn interval (0-1)
    };

    // Score and upgrade threshold
    let currentScore = 0;
    // nextUpgradeScoreThresholdRef holds the score value at which the next upgrade becomes available.
    const nextUpgradeScoreThresholdRef = { value: 10 };

    /**
     * Updates the score and checks for upgrade availability.
     * @param {number} amount - The amount to add to the score.
     */
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

    // Expose the current score via the scoreRef for external access (e.g., end screen).
    scoreRef.value = () => currentScore;

    // --- Player Setup ---
    const player = createPlayer(k, gameState);
    setupPlayerShooting(k, player, gameState);

    // --- User Interface (UI) Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp()); // Initial health bar draw
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);

    // Initial spawn interval for enemies.
    let enemySpawnInterval = 2;
    const initialEnemySpawnInterval = enemySpawnInterval; // Store initial for calculating progress.

    // UI element for displaying spawn timer progress.
    const timerLabel = createTimerLabel(
      k,
      enemySpawnInterval,
      MINIMAL_SPAWN_INTERVAL,
      INTERVAL_DECREASE
    );

    // --- Game Loop Variables ---
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false; // To prevent multiple toggles on a single press.

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

      // If paused, stop all game logic.
      if (gameState.isPaused || gameState.isUpgradePanelOpen) return; // Also pause if upgrade panel is open

      // Update Dash Cooldown UI
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * player.getDashCooldownProgress();

      // Calculate and update enemy spawn progress (0 to 1).
      // This helps visualize how close the game is to max difficulty.
      const spawnIntervalRange =
        initialEnemySpawnInterval - MINIMAL_SPAWN_INTERVAL;
      gameState.spawnProgress =
        1 -
        (enemySpawnInterval - MINIMAL_SPAWN_INTERVAL) /
          Math.max(0.0001, spawnIntervalRange);
      gameState.spawnProgress = k.clamp(0, 1, gameState.spawnProgress); // Ensure between 0 and 1

      // Update Spawn Timer
      timeUntilNextSpawn -= k.dt();
      if (timeUntilNextSpawn <= 0) {
        // Determine enemy type to spawn
        const shouldSpawnBoss =
          !isBossSpawned && enemySpawnInterval <= MINIMAL_SPAWN_INTERVAL;

        spawnEnemy(
          k,
          player,
          () => drawHealthBar(k, player.hp()), // Callback to update health UI
          () =>
            updateScoreLabel(
              scoreLabel,
              currentScore,
              nextUpgradeScoreThresholdRef.value
            ), // Callback to update score UI
          addScore,
          gameState,
          shouldSpawnBoss ? "boss" : null, // Force boss type if conditions met
          null, // No position override
          gameState.spawnProgress // Pass spawn progress for enemy scaling
        );

        if (shouldSpawnBoss) {
          isBossSpawned = true;
        }

        // Decrease spawn interval, making enemies spawn faster over time.
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
    // Handle player collision with power-ups.
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp()); // Update health UI after applying power-up
      });
      k.destroy(powerUp); // Remove the power-up from the game
    });
  });
}
