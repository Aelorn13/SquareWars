// components/ui/pause.js
export function createPauseLabel(k) {
  const pauseLabel = k.add([
    k.text("PAUSE", { size: 48 }),
    k.anchor("center"),
    k.pos(k.width() / 2, k.height() / 2),
    k.color(255, 255, 255),
    k.z(200),
    k.fixed(),
    "pauseLabel",
  ]);
  pauseLabel.hidden = true;
  return pauseLabel;
}
