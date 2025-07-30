export function defineGameOverScene(k, getScore) {
  k.scene("gameover", () => {
    k.add([
      k.text("GAME OVER"),
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
    k.wait(1.5, () => {
      canClick = true;
    });

    k.onClick(() => {
      if (!canClick) return;
      k.go("game");
    });
  });
}
