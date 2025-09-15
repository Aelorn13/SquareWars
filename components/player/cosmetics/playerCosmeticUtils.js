//components/player/cosmetics/playerCosmeticUtils.js
/**
 * @file Contains generic utility functions for cosmetic calculations.
 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Safely gets a copy of the player's position vector.
 * @param {object} player - The player object.
 * @returns {Vec2} A clone of the player's position.
 */
export function getPlayerPosition(player) {
  return player.pos.clone();
}