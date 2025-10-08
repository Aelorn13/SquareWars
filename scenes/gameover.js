import { createPlayerStatsSnapshotUI } from "../components/ui/playerStatsUI.js";
import { getSelectedDifficultyConfig } from "../components/utils/difficultyManager.js";

export function defineGameOverScene(k, getScore) {
  k.scene("gameover", (args = {}) => {
    const difficultyConfig = getSelectedDifficultyConfig();
    const difficultyName = difficultyConfig.name.toUpperCase(); 

    const centerY = k.height() / 2;

    k.add([k.text("GAME OVER"), k.anchor("center"), k.pos(k.width() / 2, centerY - 120)]);
    k.add([k.text(`DIFFICULTY - ${difficultyName}`), k.anchor("center"), k.pos(k.width() / 2, centerY - 70)]);
    k.add([k.text(`Final score: ${getScore()}`), k.anchor("center"), k.pos(k.width() / 2, centerY - 30)]);


    if (args.statsSnapshot) {
      const x = k.width() / 2 - 180;
      const y = centerY + 10; // Adjusted y-pos
      
      createPlayerStatsSnapshotUI(k, args.statsSnapshot, { x, y, width: 360, size: 16 });
    }

    k.add([k.text("Click to play again", { size: 24 }), k.anchor("center"), k.pos(k.width() / 2, centerY + 130)]); // Adjusted y-pos
    let canClick = false;
    k.wait(1, () => (canClick = true));
    k.onClick(() => { if (canClick) k.go("game"); });
  });
}