// scenes/tutorial.js 

import { setCurrentDifficulty, difficultySettings } from "../components/utils/difficultyManager.js";

export function TutorialScene(k) {

  k.scene("tutorial", () => {
    // --- Common Vertical Centering ---
    // We will use the center of the screen as the main anchor for both columns.
    const centerY = k.height() / 2;

    // --- LEFT SIDE: INSTRUCTIONS ---
    const row = 50;
    const instructions = [
      "Move: WASD / Arrows",
      "Fire: Left Mouse Button",
      "Dash: SPACE",
      "R:    Autoshoot",
      "P:    PAUSE",
    ];

    // This new formula properly centers the block of text around the centerY position.
    instructions.forEach((text, i) => {
      k.add([
        k.text(text, { size: 24 }),
        k.anchor("left"),
        k.pos(
            k.width() / 8,
            centerY + (i - (instructions.length - 1) / 2) * row
        ),
      ]);
    });

    // --- RIGHT SIDE: DIFFICULTY SELECTION ---
    const difficulties = [
        { key: 'easy', label: difficultySettings.easy.name },
        { key: 'normal', label: difficultySettings.normal.name },
        { key: 'hard', label: difficultySettings.hard.name },
    ];
    const buttonSpacing = 100;
    const buttonWidth = 200;
    const buttonHeight = 80;

    k.add([
        k.text("Select difficulty\nto start the game", { size: 32, align: "center" }),
        k.anchor("center"),
        // NEW: Moved the title up to create more space below it.
        k.pos(k.width() * 0.75, centerY - 200),
    ]);
    
    // This formula centers the block of buttons around the centerY position.
    difficulties.forEach((diff, i) => {
        const buttonCenter = k.vec2(
            k.width() * 0.75, 
            (centerY + 40) + (i - (difficulties.length - 1) / 2) * buttonSpacing
        );

        // Add the button container
        const btn = k.add([
            k.rect(buttonWidth, buttonHeight, { radius: 8 }),
            k.pos(buttonCenter),
            k.anchor("center"),
            k.color(0, 0, 0),
            k.outline(4, k.rgb(255, 255, 255)),
            k.area(),
            k.z(10),
            {
                difficultyKey: diff.key,
            }
        ]);

        // Add the button text
        const btnText = btn.add([
            k.text(diff.label, { size: 28 }),
            k.anchor("center"),
            k.color(255, 255, 255),
            k.z(20),
        ]);

        // Hover effect (no changes here)
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
        
        // Click action (no changes here)
        btn.onClick(() => {
            setCurrentDifficulty(btn.difficultyKey);
            k.go("game");
        });
    });
  });
}
