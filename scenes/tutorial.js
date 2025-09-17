// scenes/tutorial.js 


export function TutorialScene(k) {

  const row = 50;
  const instructions = [
    "Move: WASD /  Arrows",
    "Fire: Left Mouse Button",
    "Dash: SPACE",
    "P: PAUSE",
  ];

  k.scene("tutorial", () => {
    instructions.forEach((text, i) => {
      k.add([
        k.text(text),
        k.anchor("left"),
        k.pos(k.width() / 4, k.height() / 2 - (instructions.length - i) * row + row),
      ]);
    });

    k.add([
      k.text("Click to START", { size: 24 }),
      k.anchor("center"),
      k.pos(k.width() / 2, k.height() / 2 + 50),
    ]);


    let canClick = false;
    k.wait(0.5, () => {
      canClick = true;
    });

    k.onClick(() => {
      if (!canClick) return;
      k.go("game");
    });
  });
}
