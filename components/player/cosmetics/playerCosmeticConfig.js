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
 * @type {object}
 * @property {boolean} enabled - Whether the trail effect is enabled.
 * @property {number} speedThresholdMultiplier - Multiplier for baseline speed to determine trail emission threshold.
 * @property {number} minEmissionInterval - Slowest interval (seconds) for trail particle emission.
 * @property {number} maxEmissionInterval - Fastest interval (seconds) for trail particle emission.
 * @property {number} minParticleLifespan - Minimum lifespan (seconds) for trail particles.
 * @property {number} maxParticleLifespan - Maximum lifespan (seconds) for trail particles.
 * @property {number} minParticleAlpha - Minimum opacity for trail particles.
 * @property {number} maxParticleAlpha - Maximum opacity for trail particles.
 * @property {number} particleRadiusFactor - Factor to determine the trail particle's corner radius relative to player size.
 * @property {number} zOffset - Z-index offset for trail particles relative to the player.
 */
export const TRAIL_CONFIG = {
  enabled: true,
  speedThresholdMultiplier: 3, // Trail emits when current speed exceeds baselineSpeed * this multiplier
  minEmissionInterval: 0.06, // Slowest emission cadence
  maxEmissionInterval: 0.015, // Fastest emission cadence (at max intensity)
  minParticleLifespan: 0.15,
  maxParticleLifespan: 0.35,
  minParticleAlpha: 0.15,
  maxParticleAlpha: 0.6,
  particleRadiusFactor: 0.25, // Rounded corners for trail quads
  zOffset: -1, // Render behind player (if player.z is set)
};

/**
 * Default configuration for weapon barrel cosmetics.
 * @type {object}
 * @property {number} width - Width of each barrel rectangle.
 * @property {number} height - Height of each barrel rectangle.
 * @property {number[]} colour - RGB array for the barrel color.
 * @property {boolean} rounded - Whether barrels should have rounded corners.
 * @property {number} outlineWidth - Width of the barrel outline.
 * @property {number[]} outlineColour - RGB array for the barrel outline color.
 * @property {number} zOffset - Z-index offset for barrels relative to the player.
 * @property {number} inset - How much the barrel "sinks" into the player graphic (pixels).
 * @property {number} maxBarrels - Maximum number of barrels to display.
 */
export const BARREL_CONFIG = {
  width: 32,
  height: 8,
  colour: [255, 220, 20],
  rounded: false,
  outlineWidth: 1,
  outlineColour: [40, 40, 0],
  zOffset: -0.5, // Render slightly in front of the player by default
  inset: 16, // How much the barrel "sinks" into the player graphic
  maxBarrels: 15,
};