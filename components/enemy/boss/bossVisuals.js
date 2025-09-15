/**components/enemy/boss/bossVisuals.js
 * @file Contains reusable visual effect functions for bosses.
 */

/**
 * A generic function to handle visual telegraphs by smoothly tweening an entity's color.
 *
 * @param {object} k - The Kaboom.js context.
 * @param {object} entity - The game object to apply the effect to (must have an `originalColor` property).
 * @param {number[]} toColor - The target RGB color of the telegraph.
 * @param {number} duration - The total duration of the effect.
 * @param {boolean} [revert=true] - If true, the color will tween back to the original after reaching the target.
 * @returns {Promise} A promise that resolves when the main (outward) telegraph animation is complete.
 */
export function telegraphEffect(k, entity, toColor, duration, revert = true) {
  // Store the original color to ensure we can always revert correctly.
  const fromColor = k.rgb(...entity.originalColor);
  const targetColor = k.rgb(...toColor);

  // Use a promise to allow chaining actions after the telegraph completes.
  return new Promise(resolve => {
    // Tween from the current color to the target telegraph color.
    k.tween(
      entity.color,
      targetColor,
      duration / 2,
      (c) => entity.color = c,
      k.easings.linear
    ).then(() => {
      // Once the tween out is done, resolve the promise.
      resolve();
      // If revert is true, immediately start tweening back to the original color.
      if (revert) {
        k.tween(
          entity.color,
          fromColor,
          duration / 2,
          (c) => entity.color = c,
          k.easings.linear
        );
      }
    });
  });
}