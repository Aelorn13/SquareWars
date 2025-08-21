import { DURATION_POWERBUFF, colorMap, iconMap } from "./powerupTypes.js";

export function spawnPowerUp(k, pos, type, sharedState) {
  const size = 20;
  const color = k.rgb(...(colorMap[type] || [200, 200, 200]));
  const icon = iconMap[type] || "❓";

  const powerUp = k.add([
    k.rect(size, size),
    k.color(color),
    k.pos(pos),
    k.anchor("center"),
    k.area(),
    k.rotate(0),
    k.z(50),
    k.opacity(1),
    "powerup",
    { type },
    { duration: DURATION_POWERBUFF },
  ]);

  const fadeTime = 1;
  powerUp.onUpdate(() => {
    powerUp.angle += 120 * k.dt();
    if (sharedState?.isPaused) return;
    powerUp.duration -= k.dt();
    if (powerUp.duration <= 0) {
      k.destroy(powerUp);
      return;
    }
    if (powerUp.duration < fadeTime) {
      powerUp.opacity = Math.max(0, powerUp.duration / fadeTime);
    } else {
      const pulse = Math.sin(k.time() * 6) * 0.2 + 0.8;
      powerUp.opacity = pulse;
    }
  });

  // Icon overlay that follows the power-up
  k.add([
    k.text(icon, { size: 16 }),
    k.pos(pos.x, pos.y),
    k.anchor("center"),
    k.z(51),
    {
      follows: powerUp,
      update() {
        if (!powerUp.exists()) {
          k.destroy(this);
        } else {
          this.pos = powerUp.pos;
          this.angle = powerUp.angle;
        }
      },
    },
  ]);

  return powerUp;
}
