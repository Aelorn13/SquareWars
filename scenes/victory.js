import { createPlayerStatsSnapshotUI } from "../components/ui/playerStatsUI.js";

export function defineVictoryScene(k, getScore) {
  k.scene("victory", (args = {}) => {
    k.add([k.text("VICTORY!!!"), k.anchor("center"), k.pos(k.width() / 2, k.height() / 2 - 100)]);
    k.add([k.text(`Final score: ${getScore()}`), k.anchor("center"), k.pos(k.width() / 2, k.height() / 2 - 50)]);

    // Show static final player stats (centered under score) if provided
    if (args.statsSnapshot) {
      const x = k.width() / 2 - 180;
      const y = k.height() / 2 - 10;
      
      // Use the function imported at the top of the file directly
      createPlayerStatsSnapshotUI(k, args.statsSnapshot, { x, y, width: 360, size: 16 });
    }

    k.add([k.text("Click to play again", { size: 24 }), k.anchor("center"), k.pos(k.width() / 2, k.height() / 2 + 110)]); // Adjusted y-pos to match gameover scene
    let canClick = false;
    k.wait(1, () => { canClick = true; });
    k.onClick(() => { if (canClick) k.go("game"); });
  });
}