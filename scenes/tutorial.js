// scenes/tutorial.js

export function TutorialScene(k, isMobile) {
  // Define a different set of instructions for each platform
  const pcInstructions = [
    "Move: WASD",
    "Aim & Fire: Mouse",
    "Dash: SPACE",
    "Pause: P",
  ];

  const mobileInstructions = [
    "Move: Left Joystick",
    "Aim & Fire: Right Joystick",
    "Dash: Red Button",
  ];

  // Select the correct instructions and start text
  const instructions = isMobile ? mobileInstructions : pcInstructions;
  const startText = isMobile ? "Tap to START" : "Click to START";

  k.scene("tutorial", () => {
    const rowHeight = 60;
    const startY = k.height() / 2 - (instructions.length / 2) * rowHeight;

    // Display the relevant instructions
    instructions.forEach((text, i) => {
      k.add([
        k.text(text, { size: 32 }),
        k.anchor("center"),
        k.pos(k.width() / 2, startY + i * rowHeight),
      ]);
    });

    // Add the "start" prompt
    k.add([
      k.text(startText, { size: 40 }),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() - 150),
    ]);

    let canStart = false;
    k.wait(0.5, () => {
      canStart = true;
    });

    function startGame() {
        if (canStart) {
            k.go("game");
        }
    }

    // This handles the mouse click for PC users
    k.onClick(startGame);

    // This handles the screen tap for mobile users
    k.onTouchStart(startGame);
  });
}