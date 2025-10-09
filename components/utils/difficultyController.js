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
   * Scales a base stat value based on the game's progress, now supporting endless scaling.
   * @param {number} baseValue The initial value of the stat (e.g., enemy HP).
   * @param {number} progress The game's current progress. Can be > 1 for endless mode.
   * @returns {number} The calculated final stat value.
   */
  scaleStat(baseValue, progress) {
    let t;
    if (progress <= 1.0) {
      t = easeInOutSine(clamp01(progress));
    } else {
      t = progress;
    }

    const multiplier = lerp(
      this.config.enemyStatMultiplier.start,
      this.config.enemyStatMultiplier.end,
      t
    );
    return baseValue * multiplier;
  }

  /**
   * Calculates the current enemy spawn interval based on game progress, now supporting endless scaling.
   * @param {number} progress The game's current progress. Can be > 1 for endless mode.
   * @returns {number} The calculated spawn interval in seconds.
   */
  getSpawnInterval(progress) {
    let t;
    if (progress <= 1.0) {
      t = easeInOutSine(clamp01(progress));
    } else {
      t = progress;
    }
    
    const interval = lerp(
      this.config.spawnInterval.start,
      this.config.spawnInterval.end,
      t
    );

    const MINIMAL_SPAWN_INTERVAL = 0.05; 
    return Math.max(interval, MINIMAL_SPAWN_INTERVAL);
  }

  /**
   * Returns the time at which the boss should spawn for this difficulty.
   * @returns {number} The boss spawn time in seconds.
   */
  getBossSpawnTime() {
    return this.config.bossSpawnTime;
  }
}