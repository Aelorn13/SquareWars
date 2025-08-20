import { createPlayer } from "../components/player.js";
import { spawnEnemy } from "../components/enemy/enemy.js";
import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createTimerLabel,
  updateTimerLabel,
  createPauseLabel,
} from "../components/ui.js";
import { setupShooting } from "../components/shooting.js";
import { applyPowerUp } from "../components/powerup.js";
import { keysPressed } from "../components/controls.js";
import { maybeShowUpgrade } from "../components/upgrade.js";
const MINIMAL_SPAWN_INTERVAL = 0.2;
const INTERVAL_DECREASE = 0.02;
export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {
    // --- Inner arena (5% margin on each side) ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = {
      x: ARENA_MARGIN,
      y: ARENA_MARGIN,
      w: k.width() - ARENA_MARGIN * 2,
      h: k.height() - ARENA_MARGIN * 2,
    };

    // visible floor so players "feel" the boundary
    k.add([
      k.rect(ARENA.w, ARENA.h),
      k.pos(ARENA.x, ARENA.y),
      k.color(20, 20, 20), // slightly lighter than global background [10,10,10]
      k.outline(2, k.rgb(80, 80, 80)), // subtle frame
      k.fixed(),
      k.z(-50),
    ]);


    const sharedState = { isPaused: false, upgradeOpen: false, area: ARENA };

    let score = 0;
    let nextThresholdRef = { value: 10 };

    const addScore = (delta) => {
      score += delta;
      updateScoreLabel(scoreLabel, score, nextThresholdRef.value);
    };
    function increaseScore(amount) {
      addScore(amount);
      maybeShowUpgrade(
        k,
        player,
        sharedState,
        score,
        nextThresholdRef,
        addScore
      );
    }
    scoreRef.value = () => score;

    // Player
    const player = createPlayer(k, sharedState);
    setupShooting(k, player, sharedState);

    // UI
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    let spawnInterval = 2;
    const START_SPAWN_INTERVAL = spawnInterval;
    function clamp01(x) {
      return Math.max(0, Math.min(1, x));
    }

    const timerLabel = createTimerLabel(
      k,
      spawnInterval,
      MINIMAL_SPAWN_INTERVAL,
      INTERVAL_DECREASE
    );

    let spawnTimer = 0;
    let bossSpawned = false;
    let pausePressed = false;
    k.onUpdate(() => {
      //pause toggle
      if (keysPressed["KeyP"] && !pausePressed) {
        sharedState.isPaused = !sharedState.isPaused;
        pauseLabel.hidden = !sharedState.isPaused;
        pausePressed = true;
      }
      if (!keysPressed["KeyP"]) {
        pausePressed = false;
      }

      if (sharedState.isPaused) return;
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * (1 - player.getDashCooldownProgress());

      const denom = Math.max(
        0.0001,
        START_SPAWN_INTERVAL - MINIMAL_SPAWN_INTERVAL
      );
      const raw = (START_SPAWN_INTERVAL - spawnInterval) / denom;

      sharedState.spawnProgress = clamp01(raw);

      spawnTimer -= k.dt();
      if (spawnTimer <= 0) {
        if (!bossSpawned && spawnInterval <= MINIMAL_SPAWN_INTERVAL) {
          // Spawn boss instead of normal enemy
          spawnEnemy(
            k,
            player,
            () => drawHealthBar(k, player.hp()),
            () => updateScoreLabel(scoreLabel, score, nextThresholdRef.value),
            increaseScore,
            sharedState,
            "boss", // force boss type
            null,
            sharedState.spawnProgress // optional; ignored for boss
          );
          bossSpawned = true;
        } else if (!bossSpawned) {
          // Normal enemies
          spawnEnemy(
            k,
            player,
            () => drawHealthBar(k, player.hp()),
            () => updateScoreLabel(scoreLabel, score, nextThresholdRef.value),
            increaseScore,
            sharedState,
            null, // no forced type
            null, // no position override
            sharedState.spawnProgress
          );
        }

        spawnInterval = Math.max(
          MINIMAL_SPAWN_INTERVAL,
          spawnInterval - INTERVAL_DECREASE
        );
        spawnTimer = spawnInterval;
      }
      updateTimerLabel(
        timerLabel,
        k.dt(),
        MINIMAL_SPAWN_INTERVAL,
        INTERVAL_DECREASE,
        spawnInterval
      );
    });

    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp());
      });
      k.destroy(powerUp);
    });
  });
}
