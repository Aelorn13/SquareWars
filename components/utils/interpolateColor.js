/**components/utils/interpolateColor.js
 * @file Contains utility functions for visual effects like color manipulation.
 */

/**
 * Linearly interpolates between two RGB colors.
 * This version is designed to blend from a start color to an end color
 * as the ratio decreases from 1.0 to 0.0, which is perfect for health bars or damage effects.
 *
 * @param {number[]} startColor - The color when ratio is 1.0 (e.g., full health).
 * @param {number[]} endColor - The color when ratio is 0.0 (e.g., low health).
 * @param {number} ratio - The interpolation ratio (0.0 to 1.0).
 * @returns {number[]} The interpolated RGB color.
 */
export function interpolateColor(startColor, endColor, ratio) {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const inverseRatio = 1 - clampedRatio;

  const r = Math.floor(startColor[0] * clampedRatio + endColor[0] * inverseRatio);
  const g = Math.floor(startColor[1] * clampedRatio + endColor[1] * inverseRatio);
  const b = Math.floor(startColor[2] * clampedRatio + endColor[2] * inverseRatio);

  return [r, g, b];
}