export const POWERUP_TYPES = [
  "heal",
  "rapidFire",
  "damage",
  "speed",
  "invincibility",
];
const DURATION_POWERBUFF = 10;

const colorMap = {
  rapidFire: [255, 255, 0],
  heal: [207, 93, 183],
  invincibility: [204, 228, 118],
  speed: [98, 218, 202],
  damage: [187, 30, 30],
};

const iconMap = {
  rapidFire: "⚡",
  heal: "❤️",
  invincibility: "⭐",
  speed: "🦵",
  damage: "💪",
};

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
    {duration : DURATION_POWERBUFF},
  ]);

  const fadeTime = 1;
  powerUp.onUpdate(() => {
    powerUp.angle += 120 * k.dt();
    if (sharedState.isPaused) return;
    powerUp.duration -= k.dt();
    if (powerUp.duration <= 0) {
      k.destroy(powerUp);
      return;
    }
    // Fade out in the last fadeTime seconds
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
          this.angle = powerUp.angle; // Make it rotate together
        }
      },
    },
  ]);
  return powerUp;
}
function applyTemporaryStatBuff(k, obj, stat, multiplier, duration) {
  if (!obj._buffData) obj._buffData = {};
  if (!obj._buffData[stat]) {
    obj._buffData[stat] = { original: obj[stat] };
    obj[stat] *= multiplier;
  }
  // Cancel previous timeout if exists
  if (obj._buffData[stat].timeout) {
    obj._buffData[stat].timeout.cancel();
  }
  obj._buffData[stat].timeout = k.wait(duration, () => {
    obj[stat] = obj._buffData[stat].original;
    delete obj._buffData[stat];
  });
}

export function applyPowerUp(k, player, type, onHealPickup) {
  switch (type) {
    case "heal":
      player.heal(2);
      onHealPickup?.();
      break;
    case "invincibility":
      applyTemporaryStatBuff(k, player, "attackSpeed", 0.5, DURATION_POWERBUFF);
      if (player.isInvincible) return;

      player.isInvincible = true;
      const flash = k.loop(0.1, () => {
        player.hidden = !player.hidden;
      });

      k.wait(DURATION_POWERBUFF, () => {
        player.isInvincible = false;
        player.hidden = false;
        flash.cancel();
      });
      break;
    case "rapidFire":
      applyTemporaryStatBuff(k, player, "attackSpeed", 0.3, DURATION_POWERBUFF);
      break;

    case "damage":
      applyTemporaryStatBuff(k, player, "damage", 2, DURATION_POWERBUFF);
      break;

    case "speed":
      applyTemporaryStatBuff(k, player, "speed", 2, DURATION_POWERBUFF);
      applyTemporaryStatBuff(k, player, "dashCooldown", 0.3, DURATION_POWERBUFF);
      break;
  }
}
