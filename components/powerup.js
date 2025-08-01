export const POWERUP_TYPES = [
  "heal",
  "rapidFire",
  "damage",
  "speed",
  "invincibility",
];
export function spawnPowerUp(k, pos, type) {
  const size = 20;
  const colorMap = {
    rapidFire: k.rgb(255, 255, 0),
    heal: k.rgb(207, 93, 183, 1),
    invincibility: k.rgb(204, 228, 118, 1),
    speed: k.rgb(98, 218, 202, 1),
    damage: k.rgb(187, 30, 30, 1),
  };

  const iconMap = {
    rapidFire: "⚡",
    heal: "❤️",
    invincibility: "⭐",
    speed: "🦵",
    damage: "💪",
  };
  const color = colorMap[type] || k.rgb(200, 200, 200);
  const icon = iconMap[type] || "❓";
  // Base square with collision and color
  const powerUp = k.add([
    k.rect(size, size),
    k.color(color),
    k.pos(pos),
    k.anchor("center"),
    k.area(),
    k.rotate(0),
    k.z(50),
    k.opacity(1),
    k.lifespan(10, { fade: 0.5 }),
    "powerup",
    { type },
  ]);

  powerUp.onUpdate(() => {
    const pulse = Math.sin(k.time() * 6) * 0.2 + 0.8; // Range ~0.6 to 1.0
    powerUp.opacity = pulse;
    powerUp.angle += 120 * k.dt(); // 120 degrees per second
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
          this.angle = powerUp.angle; // Make it rotate together
        }
      },
    },
  ]);
  return powerUp;
}

export function applyPowerUp(k, player, type, onHealPickup) {
function applyTemporaryStatBuff(obj, stat, multiplier, duration) {
  if (!obj._buffData) obj._buffData = {};

  // Cancel existing timeout if exists
  if (obj._buffData[stat]?.timeout) {
    obj._buffData[stat].timeout.cancel();
  } else {
    obj._buffData[stat] = { original: obj[stat] };
    obj[stat] *= multiplier;
  }

  obj._buffData[stat].timeout = k.wait(duration, () => {
    obj[stat] = obj._buffData[stat].original;
    delete obj._buffData[stat];
  });
}
const durationPowerbuff=10;
  switch (type) {
    case "heal":
      player.heal(2);
      onHealPickup?.();
      break;
    case "invincibility":
      if (player.isInvincible) return;

      player.isInvincible = true;
      const flash = k.loop(0.1, () => {
        player.hidden = !player.hidden;
      });

      k.wait(10, () => {
        player.isInvincible = false;
        player.hidden = false;
        flash.cancel();
      });
      break;
    case "rapidFire":
      applyTemporaryStatBuff(player, "attackSpeed", 0.5,durationPowerbuff);
      break;

    case "damage":
      applyTemporaryStatBuff(player, "damage", 2, durationPowerbuff);
      break;

    case "speed":
      applyTemporaryStatBuff(player, "speed", 2, durationPowerbuff);
      break;
  }
}

