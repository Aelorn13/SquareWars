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
    let score = 0;
    function increaseScore(amount) {
      score += amount;
    }
    scoreRef.value = () => score;

    // Player
    const player = createPlayer(k);
    setupShooting(k, player);

    // UI
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);

    // Background
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(20, 20, 20),
      k.z(-1),
      k.fixed(),
    ]);

    let spawnInterval = 2;
    let spawnTimer = 0;
    k.onUpdate(() => {
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * (1 - player.getDashCooldownProgress());

      spawnTimer -= k.dt();
      if (spawnTimer <= 0) {
        console.log(spawnInterval);
        spawnEnemy(
          k,
          player,
          () => drawHealthBar(k, player.hp()),
          () => updateScoreLabel(scoreLabel, score),
          increaseScore
        );
        spawnInterval = Math.max(0.5, spawnInterval - 0.02);
        spawnTimer = spawnInterval;
      }
    });

    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, () => {
        drawHealthBar(k, player.hp());
      });
      k.destroy(powerUp);
    });
  });
}
