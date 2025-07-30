import { createPlayer } from "../components/player.js";
import { spawnEnemy } from "../components/enemy.js";
import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
} from "../components/ui.js";
import { setupShooting } from "../components/shooting.js";

export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {

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

    // Attach shooting system
    setupShooting(k, player);

    // Spawn enemies
    k.loop(1, () => {
      spawnEnemy(
        k,
        player,
        () => {
          drawHealthBar(k, player.hp());
        },
        () => {
          score++;
          updateScoreLabel(scoreLabel, score);
        }
      );
    });
  });
}
