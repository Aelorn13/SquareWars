import { DURATION_POWERBUFF, colorMap, iconMap } from "./powerupTypes.js";

/**
 * Spawns a power-up object in the game world.
 *
 * @param {object} k - The Kaboom.js context object
 * @param {Vec2} pos - The initial position of the power-up.
 * @param {string} type - The type of power-up (e.g., "speed", "shield").
 * @param {object} sharedState - An object containing shared game state, like `isPaused`.
 * @returns {GameObject} The created power-up game object.
 */
export function spawnPowerUp(k, pos, type, sharedState) {
  const POWERUP_SIZE = 20;
  const FADE_DURATION = 1; // Duration in seconds for the power-up to fade out
  const ROTATION_SPEED = 120; // Degrees per second

  // Determine the power-up's visual properties based on its type
  const powerUpColor = k.rgb(...(colorMap[type] || [200, 200, 200]));
  const powerUpIcon = iconMap[type] || "❓";

  // Create the main power-up game object
  const powerUp = k.add([
    k.rect(POWERUP_SIZE, POWERUP_SIZE),
    k.color(powerUpColor),
    k.pos(pos),
    k.anchor("center"),
    k.area(),
    k.rotate(0),
    k.z(50), // Render above most game elements
    k.opacity(1),
    "powerup", // Tag for easier identification and collision detection
    { type }, // Custom component to store the power-up's type
    {
      // Custom component to manage the power-up's active duration
      duration: DURATION_POWERBUFF,
      isFading: false, // Flag to indicate if the power-up is currently fading
    },
  ]);

  // Add dynamic behavior to the power-up
  powerUp.onUpdate(() => {
    // Rotate the power-up continuously
    powerUp.angle += ROTATION_SPEED * k.dt();

    // If the game is paused, prevent duration countdown and fading
    if (sharedState?.isPaused) return;

    // Decrease the power-up's remaining duration
    powerUp.duration -= k.dt();

    // Handle power-up expiration
    if (powerUp.duration <= 0) {
      k.destroy(powerUp);
      return;
    }

    // Manage fading and pulsing visual effects
    if (powerUp.duration < FADE_DURATION) {
      // Start fading out when duration is less than FADE_DURATION
      powerUp.isFading = true;
      powerUp.opacity = Math.max(0, powerUp.duration / FADE_DURATION);
    } else if (!powerUp.isFading) {
      // Apply a subtle pulsing effect when not fading
      const pulse = Math.sin(k.time() * 6) * 0.2 + 0.8;
      powerUp.opacity = pulse;
    }
  });

  // Create an icon overlay that follows the main power-up object
  const iconOverlay = k.add([
    k.text(powerUpIcon, { size: POWERUP_SIZE * 0.8 }), // Icon size relative to power-up
    k.pos(pos),
    k.anchor("center"),
    k.z(51), // Render icon above the power-up
    {
      // Custom component to link the icon's position and rotation to the power-up
      targetPowerUp: powerUp, // Reference to the power-up it follows
      update() {
        if (!this.targetPowerUp.exists()) {
          // If the power-up is destroyed, destroy the icon overlay as well
          k.destroy(this);
        } else {
          // Keep the icon's position and rotation synchronized with the power-up
          this.pos = this.targetPowerUp.pos;
          this.angle = this.targetPowerUp.angle;
          // Synchronize opacity with the power-up to fade together
          this.opacity = this.targetPowerUp.opacity;
        }
      },
    },
  ]);

  return powerUp;
}