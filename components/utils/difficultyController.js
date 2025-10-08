 `components/utils/DifficultyController.js`
import { lerp, easeInOutSine, clamp01 } from './mathUtils.js';

export class DifficultyController {
  /**
   * @param {object} config A specific difficulty configuration object from difficultyManager.js
   */
  constructor(config) {
    if (!config) {
      throw new Error("DifficultyController requires a configuration object.");
    }
    this.config = config;
  }

  /**
   * Scales a base stat value based on the game's progress.
   * @param {number} baseValue The initial value of the stat (e.g., enemy HP).
   * @param {number} progress The game's current progress (a value from 0 to 1).
   * @returns {number} The calculated final stat value.
   */
  scaleStat(baseValue, progress) {
    const easedProgress = easeInOutSine(clamp01(progress));
    const multiplier = lerp(
      this.config.enemyStatMultiplier.start,
      this.config.enemyStatMultiplier.end,
      easedProgress
    );
    return baseValue * multiplier;
  }

  /**
   * Calculates the current enemy spawn interval based on game progress.
   * @param {number} progress The game's current progress (a value from 0 to 1).
   * @returns {number} The calculated spawn interval in seconds.
   */
  getSpawnInterval(progress) {
    const easedProgress = easeInOutSine(clamp01(progress));
    return lerp(
      this.config.spawnInterval.start,
      this.config.spawnInterval.end,
      easedProgress
    );
  }

  /**
   * Returns the time at which the boss should spawn for this difficulty.
   * @returns {number} The boss spawn time in seconds.
   */
  getBossSpawnTime() {
    return this.config.bossSpawnTime;
  }
}