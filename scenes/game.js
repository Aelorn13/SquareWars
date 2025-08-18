import { createPlayer } from "../components/player.js";
import { spawnEnemy } from "../components/enemy.js";
import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
} from "../components/ui.js";
import { setupShooting } from "../components/shooting.js";
import { applyPowerUp } from "../components/powerup.js";
import { keysPressed } from "../components/controls.js";
import { maybeShowUpgrade } from "../components/upgrade.js";

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

    let spawnInterval = 2;
    let spawnTimer = 0;
    let bossSpawned = false;

    const MINIMAL_SPAWN_INTERVAL = 0.5;

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

        spawnInterval = Math.max(MINIMAL_SPAWN_INTERVAL, spawnInterval - 0.02);
        spawnTimer = spawnInterval;
      }
    });

    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp());
      });
      k.destroy(powerUp);
    });

    const pauseLabel = k.add([
      k.text("PAUSE", { size: 48 }),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2),
      k.color(255, 255, 255),
      k.z(200),
      k.fixed(),
      { showOnPause: true },
    ]);
    pauseLabel.hidden = true;
  });
}
