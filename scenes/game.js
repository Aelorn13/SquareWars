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
export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {
    function inceaseScore(amount) {
  score += amount;
}
    // UI
    const scoreLabel = createScoreLabel(k);
    let score = 0;
    scoreRef.value = () => score;

    // Background
    k.add([
      k.rect(k.height, k.width),
      k.pos(0, 0),
      k.color(20, 20, 20),
      k.z(-1),
      k.fixed(),
    ]);

    // Player
    const player = createPlayer(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);

    // Attach shooting system
    setupShooting(k, player);

    k.onUpdate(() => {
      const progress = player.getDashCooldownProgress(); // 0 to 1
      dashCooldownBar.width = dashCooldownBar.fullWidth * progress;
    });
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp());
      });
      k.destroy(powerUp);
    });
    // Spawn enemies
    let spawnInterval = 2; // Start at 2 seconds
    let loopHandle;

 function spawnEnemyLoop() {
        spawnEnemy(k, player,
          () => {drawHealthBar(k, player.hp());},
          () => {updateScoreLabel(scoreLabel, score);},
          inceaseScore
        );
// Reduce interval over time (clamp to 0.5s)
  if (spawnInterval > 0.5) {
    spawnInterval -= 0.01;
  }

  setTimeout(spawnEnemyLoop, spawnInterval * 1000);
}

// Start the loop
spawnEnemyLoop();
  });
}
