import { createPlayerStatsSnapshotUI } from "../components/ui/playerStatsUI.js";
import { getSelectedDifficultyConfig } from "../components/utils/difficultyManager.js";

export function defineGameOverScene(k, getScore) {
  k.scene("victory", (args = {}) => {
    const difficultyConfig = getSelectedDifficultyConfig();
    const difficultyName = difficultyConfig.name.toUpperCase(); 

    const centerY = k.height() / 2;

    k.add([k.text("VICTORY!!!"), k.anchor("center"), k.pos(k.width() / 2, centerY - 120)]);
    k.add([k.text(`DIFFICULTY - ${difficultyName}`), k.anchor("center"), k.pos(k.width() / 2, centerY - 70)]);
    k.add([k.text(`Final score: ${getScore()}`), k.anchor("center"), k.pos(k.width() / 2, centerY - 30)]);

    if (args.statsSnapshot) {
      const x = k.width() / 2 - 180;
      const y = centerY + 10;
      createPlayerStatsSnapshotUI(k, args.statsSnapshot, { x, y, width: 360, size: 16 });
    }

    const buttonWidth = 280;
    const buttonHeight = 70;
    let canClick = false;
    k.wait(0.5, () => (canClick = true));

    // This is a helper function to create styled buttons
    function createButton(text, position, onClickAction) {
        const btn = k.add([
            k.rect(buttonWidth, buttonHeight, { radius: 8 }),
            k.pos(position),
            k.anchor("center"),
            k.color(0, 0, 0),
            k.outline(4, k.rgb(255, 255, 255)),
            k.area(),
            k.z(10),
        ]);

        const btnText = k.add([
            k.text(text, { size: 18 }),
            k.anchor("center"),
            k.pos(position),
            k.z(20),
        ]);

        btn.onHover(() => {
            k.setCursor("pointer");
            btn.color = k.rgb(255, 255, 255);
            btnText.color = k.rgb(0, 0, 0);
        });

        btn.onHoverEnd(() => {
            k.setCursor("default");
            btn.color = k.rgb(0, 0, 0);
            btnText.color = k.rgb(255, 255, 255);
        });

        btn.onClick(() => {
            if (canClick) onClickAction();
        });
    }

    createButton("Play Again", k.vec2(k.width()-150, k.height()-200), () => {
        k.go("game");
    });

    createButton("Change Difficulty", k.vec2(k.width()-150, k.height()-100), () => {
        k.go("tutorial");
    });
  });
}