/**
 * @file Manages the spawning and lifecycle of power-up objects in the game world.
 */

import { DEFAULT_POWERUP_DURATION, POWERUP_CONFIG } from "./powerupTypes.js";

/**
 * Creates and manages a power-up entity in the game world.
 *
 * @param {object} k - The Kaboom.js context.
 * @param {Vec2} position - The initial position of the power-up.
 * @param {string} type - The type of power-up (e.g., "SPEED", "DAMAGE").
 * @param {object} sharedState - Shared game state, such as `isPaused`.
 * @returns {GameObject} The created power-up game object.
 */
export function spawnPowerUp(k, position, type, sharedState) {
  const POWERUP_SIZE = 20;
  const FADE_OUT_DURATION = 1; // Time in seconds to fade before expiring.
  const ROTATION_DEGREES_PER_SECOND = 120;

  const config = POWERUP_CONFIG[type] || {};
  const powerUpColor = k.rgb(...(config.color || [200, 200, 200]));
  const powerUpIcon = config.icon || "❓";

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

  // The icon is a separate entity that follows the main power-up body.
  const icon = k.add([
    k.text(powerUpIcon, { size: POWERUP_SIZE * 0.8 }),
    k.pos(position),
    k.anchor("center"),
    k.z(51), // Render above the power-up's square body.
  ]);

  powerUp.onUpdate(() => {
    // Continuous rotation for visual appeal.
    powerUp.angle += ROTATION_DEGREES_PER_SECOND * k.dt();

    // Pause all time-based logic if the game is paused.
    if (sharedState?.isPaused) return;

    // --- Duration and Expiration ---
    powerUp.duration -= k.dt();
    if (powerUp.duration <= 0) {
      k.destroy(powerUp);
      return;
    }

    // --- Visual Effects (Pulsing and Fading) ---
    if (powerUp.duration < FADE_OUT_DURATION) {
      // Fade out smoothly in the last second of its life.
      powerUp.isFading = true;
      powerUp.opacity = k.map(powerUp.duration, 0, FADE_OUT_DURATION, 0, 1);
    } else if (!powerUp.isFading) {
      // Apply a subtle pulsing effect when not fading.
      const pulse = Math.sin(k.time() * 6) * 0.2 + 0.8;
      powerUp.opacity = pulse;
    }
  });

  // Ensure the icon always stays perfectly synced with the main power-up object.
  icon.onUpdate(() => {
    if (!powerUp.exists()) {
      k.destroy(icon);
    } else {
      icon.pos = powerUp.pos;
      icon.angle = powerUp.angle;
      icon.opacity = powerUp.opacity;
    }
  });

  // When the power-up is destroyed, its icon should be too.
  powerUp.onDestroy(() => {
      if (icon.exists()) {
          k.destroy(icon);
      }
  });


  return powerUp;
}