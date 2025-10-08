/**
 * Clamps a value between 0 and 1.
 * @param {number} v The value to clamp.
 * @returns {number} The clamped value.
 */
export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Linearly interpolates between two values.
 * @param {number} a The start value.
 * @param {number} b The end value.
 * @param {number} t The interpolation factor (0 to 1).
 * @returns {number} The interpolated value.
 */
export function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

/**
 * An ease-in-out sine easing function.
 * @param {number} x The input value (0 to 1).
 * @returns {number} The eased value (0 to 1).
 */
export function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}