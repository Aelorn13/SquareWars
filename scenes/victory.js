export function defineVictoryScene(k, getScore) {
  k.scene("victory", () => {
    k.add([
      k.text("VICTORY!!!"),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2 - 100),
    ]);

    k.add([
      k.text(`Final score: ${getScore()}`),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2 - 50),
    ]);

    k.add([
      k.text("Click to play again", { size: 24 }),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2),
    ]);

    let canClick = false;
    k.wait(1, () => {
      canClick = true;
    });

    k.onClick(() => {
      if (canClick) k.go("game");
    });
  });
}
