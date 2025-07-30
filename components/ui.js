export function createScoreLabel(k) {
  const label = k.add([
    k.text("Score: 0", { size: 24 }),
    k.pos(20, 20),
    k.layer("ui"),
    k.fixed(),
    k.z(100),
    "scoreLabel",
  ]);
  return label;
}

export function updateScoreLabel(label, score) {
  label.text = `Score: ${score}`;
}

export function drawHealthBar(k, hp) {
  k.get("hp-ui").forEach(k.destroy);
  const squareSize = 20;
  const margin = 8;
  for (let i = 0; i < hp; i++) {
    k.add([
      k.rect(squareSize, squareSize),
      k.color(0, 255, 0),
      k.pos(k.width() - (squareSize + margin) * (i + 1), margin),
      k.fixed(),
      k.z(100),
      "hp-ui",
    ]);
  }
}
