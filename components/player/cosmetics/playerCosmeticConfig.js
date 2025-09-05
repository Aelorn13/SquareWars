/**
 * Configuration for player size scaling based on HP.
 * @type {object}
 * @property {number} minScale - Minimum scale factor for the player.
 * @property {number} maxScale - Maximum scale factor for the player.
 * @property {number} smoothingSpeed - Speed at which the scale interpolates towards the target.
 */
export const HP_SIZE_CONFIG = {
  minScale: 0.5,
  maxScale: 2,
  smoothingSpeed: 8,
};

/**
 * Configuration for player color change based on attack speed.
 * @type {object}
 * @property {number[]} baseColor - RGB array for the default color [R, G, B].
 * @property {number[]} targetColor - RGB array for the color at max attack speed difference [R, G, B].
 * @property {number} smoothingSpeed - Speed at which the color interpolates towards the target.
 */
export const ATTACK_SPEED_COLOR_CONFIG = {
  baseColor: [0, 0, 255],
  targetColor: [255, 255, 0],
  smoothingSpeed: 10,
};

/**
 * Configuration for the player's movement trail (for fast movement/dashing).
 */
export const TRAIL_CONFIG = {
  enabled: true,
  speedThresholdMultiplier: 3, // Trail emits when current speed exceeds baselineSpeed * this multiplier
  minEmissionInterval: 0.04, // Slowest emission cadence
  maxEmissionInterval: 0.015, // Fastest emission cadence (at max intensity)
  minParticleLifespan: 0.15,
  maxParticleLifespan: 0.35,
  minParticleAlpha: 0.1,
  maxParticleAlpha: 0.4,
  zOffset: -1,
  maxParticlesPerFrame: 3,
};

/**
 * Default configuration for weapon barrel cosmetics.
 */
export const BARREL_CONFIG = {
  width: 32,
  height: 8,
  colour: [255, 220, 20],
  rounded: false,
  outlineWidth: 1,
  outlineColour: [40, 40, 0],
  zOffset: -2, // Render slightly in front of the player by default
  inset: 16, // How much the barrel "sinks" into the player graphic
  maxBarrels: 15,
};

export const BULLET_SPEED_BARREL_CONFIG = {
  enabled: true,
  scalingFactor: 15,
  maxLength: 100,
};