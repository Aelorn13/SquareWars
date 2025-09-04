// components/boss/utils.js

import {
  TELEGRAPH_FADE_OUT_DURATION
} from "./constants.js";

/**
 * Linearly interpolates between two RGB colors.
 * @param {number[]} from - The starting RGB color [r, g, b].
 * @param {number[]} to - The ending RGB color [r, g, b].
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number[]} The interpolated RGB color.
 */
export function lerpColor(from, to, t) {
  return [
    Math.floor(from[0] * (1 - t) + to[0] * t),
    Math.floor(from[1] * (1 - t) + to[1] * t),
    Math.floor(from[2] * (1 - t) + to[2] * t),
  ];
}

/**
 * Initiates a visual telegraph animation for the boss, changing its color.
 * @param {object} boss - The boss game object.
 * @param {number[]} toColor - The target RGB color for the telegraph.
 * @param {number} duration - How long the color change takes.
 * @param {boolean} [returnToOriginal=true] - If true, the color will fade back to the original after the telegraph.
 */
export function startTelegraph(boss, toColor, duration, returnToOriginal = true) {
  // Ensure that if a telegraph is already ongoing, it completes or transitions smoothly
  if (boss._telegraphProgress != null && boss._telegraphProgress < boss._telegraphDuration) {
    // If a telegraph is active, blend from the current display color, not originalColor
    boss._telegraphFrom = [boss.color.r, boss.color.g, boss.color.b];
  } else {
    boss._telegraphFrom = boss.originalColor; // Start from the current phase color
  }

  boss._telegraphProgress = 0;
  boss._telegraphDuration = duration;
  boss._telegraphTo = toColor;
  boss._telegraphReturn = returnToOriginal;
}

/**
 * Updates the telegraph animation state for the boss.
 * This function should be called inside the boss's onUpdate loop.
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 */
export function updateTelegraph(k, boss) {
  if (boss._telegraphProgress != null) {
    boss._telegraphProgress += k.dt();
    const progressRatio = Math.min(1, boss._telegraphProgress / boss._telegraphDuration);

    if (boss.isVulnerable && boss._telegraphProgress % 0.2 < 0.1) {
      boss.use(k.color(k.rgb(255, 255, 100)));
    } else {
      boss.use(k.color(k.rgb(...lerpColor(boss._telegraphFrom, boss._telegraphTo, progressRatio))));
    }

    if (progressRatio >= 1) {
      if (boss._telegraphReturn) {
        boss._telegraphFrom = boss._telegraphTo;
        boss._telegraphTo = boss.originalColor;
        boss._telegraphDuration = TELEGRAPH_FADE_OUT_DURATION;
        boss._telegraphProgress = 0;
        boss._telegraphReturn = false;
      } else {
        boss._telegraphProgress = null;
        if (!boss.isVulnerable) {
          boss.use(k.color(k.rgb(...boss.originalColor)));
        }
      }
    }
  }
}