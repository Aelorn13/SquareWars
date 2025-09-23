// components/powerup/spawnPowerup.js
import { DEFAULT_POWERUP_DURATION, POWERUP_CONFIG } from "./powerupTypes.js";

/**
 * Creates and manages a power-up entity.
 * If the player comes within `magnetRadius` the power-up will drift toward them.
 */
export function spawnPowerUp(k, position, type, sharedState) {
  const POWERUP_SIZE = 20;
  const FADE_OUT_DURATION = 1; // seconds
  const ROTATION_DEGREES_PER_SECOND = 120;

  const config = POWERUP_CONFIG[type] || {};
  const powerUpColor = k.rgb(...(config.color || [200, 200, 200]));
  const powerUpIcon = config.icon || "❓";

  // Magnet tuning. Can be overridden per power-up in POWERUP_CONFIG.
  const MAGNET_RADIUS = config.magnetRadius ?? 70;
  const MAGNET_STRENGTH = config.magnetStrength ?? 1.0; // multiplier for max speed
  const MIN_ATTRACT_SPEED = 30; // px/s when just inside radius
  const MAX_ATTRACT_SPEED = 220 * MAGNET_STRENGTH; // px/s when close

  const powerUp = k.add([
    k.rect(POWERUP_SIZE, POWERUP_SIZE),
    k.color(powerUpColor),
    k.pos(position),
    k.anchor("center"),
    k.area(),
    k.rotate(0),
    k.opacity(1),
    k.z(50),
    "powerup",
    { type },
    {
      duration: DEFAULT_POWERUP_DURATION,
      isFading: false,
    },
  ]);

  const icon = k.add([
    k.text(powerUpIcon, { size: POWERUP_SIZE * 0.8 }),
    k.pos(position),
    k.anchor("center"),
    k.z(51),
  ]);

  powerUp.onUpdate(() => {
    // rotation
    powerUp.angle += ROTATION_DEGREES_PER_SECOND * k.dt();

    // pause time-based logic while game paused
    if (sharedState?.isPaused) return;

    // duration
    powerUp.duration -= k.dt();
    if (powerUp.duration <= 0) {
      k.destroy(powerUp);
      return;
    }

    // pulsing / fading
    if (powerUp.duration < FADE_OUT_DURATION) {
      powerUp.isFading = true;
      powerUp.opacity = k.map(powerUp.duration, 0, FADE_OUT_DURATION, 0, 1);
    } else if (!powerUp.isFading) {
      const pulse = Math.sin(k.time() * 6) * 0.2 + 0.8;
      powerUp.opacity = pulse;
    }

    // --- attraction toward player ---
    // find primary player (first with "player" tag)
    const players = k.get?.("player") ?? [];
    const player = players && players.length ? players[0] : null;
    if (player && player.pos && typeof player.pos.x === "number") {
      // compute distance
      const dx = (player.pos.x ?? player.x ?? 0) - (powerUp.pos.x ?? powerUp.x ?? 0);
      const dy = (player.pos.y ?? player.y ?? 0) - (powerUp.pos.y ?? powerUp.y ?? 0);
      const dist = Math.hypot(dx, dy);

      if (dist > 1 && dist <= MAGNET_RADIUS) {
        // normalized attraction factor (0 at edge -> 1 at center)
        let t = 1 - dist / MAGNET_RADIUS;
        t = Math.max(0, Math.min(1, t));
        // ease curve for smoother motion (quadratic)
        const ease = t * t;
        const speed = MIN_ATTRACT_SPEED + (MAX_ATTRACT_SPEED - MIN_ATTRACT_SPEED) * ease;
        const move = speed * k.dt();

        const nx = dx / dist;
        const ny = dy / dist;

        // apply movement by mutating pos components
        powerUp.pos.x = (powerUp.pos.x ?? powerUp.x ?? 0) + nx * move;
        powerUp.pos.y = (powerUp.pos.y ?? powerUp.y ?? 0) + ny * move;
      }
    }
  });

  // keep icon synced
  icon.onUpdate(() => {
    if (!powerUp.exists?.() && !powerUp.exists) {
      k.destroy(icon);
    } else {
      // copy reference where possible so icon follows exactly
      icon.pos = powerUp.pos;
      icon.angle = powerUp.angle;
      icon.opacity = powerUp.opacity;
    }
  });

  powerUp.onDestroy(() => {
    if (icon.exists?.()) k.destroy(icon);
  });

  return powerUp;
}
