export function TutorialScene(k) {
  k.scene("tutorial", () => {
    k.add([
      k.text("Movement: WASD /  Arrows"),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2 - 100),
    ]);

    k.add([
      k.text(`Fire: Left Mouse Button`),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2 - 50),
    ]);

    k.add([
      k.text("Click to START", { size: 24 }),
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
