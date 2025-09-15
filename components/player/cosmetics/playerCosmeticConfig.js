/** components/player/cosmetics/playerCosmeticConfig.js
 * @file Configuration constants for player cosmetic effects.
 */

/**
 * Configuration for player size scaling based on HP.
 */
export const HP_SIZE_CONFIG = {
  minScale: 0.5,
  maxScale: 2,
  smoothingSpeed: 8,
};

/**
 * Configuration for player color change based on attack speed.
 */
export const ATTACK_SPEED_COLOR_CONFIG = {
  baseColor: [0, 0, 255],
  targetColor: [255, 255, 0],
  smoothingSpeed: 10,
};

/**
 * Configuration for the player's movement trail.
 */
export const TRAIL_CONFIG = {
  enabled: true,
  maxParticlesPerFrame: 3,
  minParticleLifespan: 0.15,
  maxParticleLifespan: 0.35,
  minParticleAlpha: 0.1,
  maxParticleAlpha: 0.4,
};

/**
 * Default configuration for the weapon barrel cosmetic.
 */
export const BARREL_CONFIG = {
  width: 32,
  height: 8,
  colour: [255, 220, 20],
  rounded: false,
  outlineWidth: 1,
  outlineColour: [40, 40, 0],
  inset: 16, // How much the barrel "sinks" into the player graphic
  heightPerProjectile: 2, // How much the barrel height increases per additional projectile
};

/**
 * Configuration for barrel length scaling based on bullet speed.
 */
export const BULLET_SPEED_BARREL_CONFIG = {
  enabled: true,
  scalingFactor: 15,
  maxLength: 100,
};