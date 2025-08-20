// components/ui/health.js
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
