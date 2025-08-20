// components/ui/dash.js
export function drawDashCooldownBar(k) {
  const barWidth = 76;
  k.add([
    k.rect(barWidth, 10),
    k.pos(k.width() - barWidth - 8, 36),
    k.color(60, 60, 60),
    k.fixed(),
    k.z(100),
  ]);

  const dashBarFill = k.add([
    k.rect(barWidth, 10),
    k.pos(k.width() - barWidth - 8, 36),
    k.color(255, 255, 0),
    k.fixed(),
    k.z(101),
    { fullWidth: barWidth },
  ]);

  return dashBarFill;
}
