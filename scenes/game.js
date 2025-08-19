import { createPlayer } from "../components/player.js";
import { spawnEnemy } from "../components/enemy.js";
import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createTimerLabel,
  updateTimerLabel,
  createPauseLabel 
} from "../components/ui.js";
import { setupShooting } from "../components/shooting.js";
import { applyPowerUp } from "../components/powerup.js";
import { keysPressed } from "../components/controls.js";
import { maybeShowUpgrade } from "../components/upgrade.js";
const MINIMAL_SPAWN_INTERVAL = 0.5;
const INTERVAL_DECREASE = 0.02;
export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {
    const sharedState = { isPaused: false, upgradeOpen: false };

    let score = 0;
    let nextThresholdRef = { value: 10 };

    const addScore = (delta) => {
      score += delta;
      updateScoreLabel(scoreLabel, score);
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
    const timerLabel = createTimerLabel(k, spawnInterval, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE);

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

      spawnTimer -= k.dt();
      if (spawnTimer <= 0) {
        if (!bossSpawned && spawnInterval <= MINIMAL_SPAWN_INTERVAL) {
          // Spawn boss instead of normal enemy
          spawnEnemy(
            k,
            player,
            () => drawHealthBar(k, player.hp()),
            () => updateScoreLabel(scoreLabel, score),
            increaseScore,
            sharedState,
            "boss" // force boss type
          );
          bossSpawned = true;
        } else if (!bossSpawned) {
          // Normal enemies
          spawnEnemy(
            k,
            player,
            () => drawHealthBar(k, player.hp()),
            () => updateScoreLabel(scoreLabel, score),
            increaseScore,
            sharedState
          );
        }

        spawnInterval = Math.max(
          MINIMAL_SPAWN_INTERVAL,
          spawnInterval - INTERVAL_DECREASE
        );
        spawnTimer = spawnInterval;
      }
       updateTimerLabel(timerLabel, k.dt(), MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE, spawnInterval);
    });

    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp());
      });
      k.destroy(powerUp);
    });
  });
}
