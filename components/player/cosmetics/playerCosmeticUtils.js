
/**
 * Clamps a value between a minimum and maximum.
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} The clamped value.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolates between two values.
 * @param {number} a - The start value.
 * @param {number} b - The end value.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Safely retrieves a numerical property from an object, handling functions and nullish values.
 * @param {object} obj - The object to retrieve the property from.
 * @param {string} prop - The name of the property.
 * @param {number} [defaultValue=0] - The default value if the property is not found or invalid.
 * @returns {number} The numerical value of the property or the default value.
 */
export function getNumericProp(obj, prop, defaultValue = 0) {
  const value = obj[prop];
  if (typeof value === "function") {
    return Number(value()) || defaultValue;
  }
  return Number(value) || defaultValue;
}

/**
 * Gets a player's position, ensuring it's a `k.Vec2` object.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 * @returns {k.Vec2} The player's position as a k.Vec2.
 */
export function getPlayerPosition(k, player) {
  if (player.pos && typeof player.pos.clone === "function") {
    return player.pos.clone();
  }
  return k.vec2(player.pos.x, player.pos.y);
}

/** Converts degrees to radians. */
export const toRadians = (degrees) => (degrees * Math.PI) / 180;
/** Converts radians to degrees. */
export const toDegrees = (radians) => (radians * 180) / Math.PI;