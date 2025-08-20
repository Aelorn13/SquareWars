export const POWERUP_TYPES = [
  "heal",
  "rapidFire",
  "damage",
  "speed",
  "invincibility",
  "alwaysCrit",
];
const DURATION_POWERBUFF = 10;

const colorMap = {
  rapidFire: [255, 255, 0],
  heal: [207, 93, 183],
  invincibility: [204, 228, 118],
  speed: [98, 218, 202],
  damage: [187, 30, 30],
  alwaysCrit: [255, 100, 0],
};

const iconMap = {
  rapidFire: "⚡",
  heal: "❤️",
  invincibility: "⭐",
  speed: "🦵",
  damage: "💪",
  alwaysCrit: "🎯",
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
    { duration: DURATION_POWERBUFF },
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
function applyTemporaryStatBuff(
  k,
  obj,
  stat,
  multiplier,
  duration,
  absolute = false
) {
  if (!obj._buffData) obj._buffData = {};

  const now = Date.now();

  if (!obj._buffData[stat]) {
    // First time applying this buff
    obj._buffData[stat] = {
      original: obj[stat],
      endTime: now + duration * 1000,
      timeout: null,
    };
    if (absolute) {
      obj[stat] = multiplier; // set absolute value
    } else {
      obj[stat] *= multiplier; // multiply
    }

    const tick = () => {
      const remaining = (obj._buffData[stat].endTime - Date.now()) / 1000;
      if (remaining <= 0) {
        obj[stat] = obj._buffData[stat].original;
        delete obj._buffData[stat];
      } else {
        obj._buffData[stat].timeout = k.wait(Math.min(remaining, 0.1), tick);
      }
    };
    tick();
  } else {
    // Buff already exists -> extend duration
    obj._buffData[stat].endTime += duration * 1000; // stack duration
    // optional: can change "reset to max" instead of stacking, use:
    // obj._buffData[stat].endTime = now + duration * 1000;
  }
}

export function applyPowerUp(k, player, type, onHealPickup) {
  switch (type) {
    case "heal":
      player.heal(2);
      onHealPickup?.();
      break;
    case "invincibility":
      if (!player._buffData) player._buffData = {};
      if (!player._buffData.invincible) {
        player.isInvincible = true;

        const flash = k.loop(0.1, () => {
          player.hidden = !player.hidden;
        });

        player._buffData.invincible = {
          endTime: Date.now() + DURATION_POWERBUFF * 1000,
          timeout: null,
          flash,
        };

        const tick = () => {
          const remaining =
            (player._buffData.invincible.endTime - Date.now()) / 1000;
          if (remaining <= 0) {
            player.isInvincible = false;
            player.hidden = false;
            flash.cancel();
            delete player._buffData.invincible;
          } else {
            player._buffData.invincible.timeout = k.wait(
              Math.min(remaining, 0.1),
              tick
            );
          }
        };
        tick();
      } else {
        // Extend duration
        player._buffData.invincible.endTime += DURATION_POWERBUFF * 1000;
      }
      break;

    case "rapidFire":
      applyTemporaryStatBuff(k, player, "attackSpeed", 0.3, DURATION_POWERBUFF);
      break;

    case "damage":
      applyTemporaryStatBuff(k, player, "damage", 2, DURATION_POWERBUFF);
      break;

    case "speed":
      applyTemporaryStatBuff(k, player, "speed", 2, DURATION_POWERBUFF);
      applyTemporaryStatBuff(
        k,
        player,
        "dashCooldown",
        0.3,
        DURATION_POWERBUFF
      );
      break;
    case "alwaysCrit":
      applyTemporaryStatBuff(
        k,
        player,
        "critChance",
        1,
        DURATION_POWERBUFF,
        true
      );
      break;
  }
}
