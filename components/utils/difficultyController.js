// ===== utils/difficultyController.js =====
import { lerp, easeInOutSine, clamp01 } from './mathUtils.js';

export class DifficultyController {
  constructor(config) {
    if (!config) {
      throw new Error("DifficultyController requires a configuration object.");
    }
    this.config = config;
  }

  /**
   * Scale a specific stat (hp or speed) based on progress
   * @param {string} statType - 'hp' or 'speed'
   * @param {number} baseValue - Base stat value
   * @param {number} progress - Game progress (0-1 = pre-boss, >1 = endless)
   */
  scaleStat(statType, baseValue, progress) {
    const statConfig = this.config[statType];
    if (!statConfig) {
      console.warn(`No scaling config for stat type: ${statType}`);
      return baseValue;
    }

    let multiplier;

    if (progress <= 1.0) {
      // Pre-Boss: Linear interpolation from start to end
      const t = easeInOutSine(clamp01(progress));
      multiplier = lerp(statConfig.start, statConfig.end, t);
    } else {
      // Endless: Exponential growth from end multiplier
      const endlessProgress = progress - 1.0;
      multiplier = statConfig.end * Math.pow(1 + endlessProgress, statConfig.endlessRate);
    }

    return baseValue * multiplier;
  }

  /**
   * Get spawn interval based on progress
   */
  getSpawnInterval(progress) {
    const MINIMAL_SPAWN_INTERVAL = 0.05;
    const { start, end, endlessDecay } = this.config.spawnInterval;

    let interval;

    if (progress <= 1.0) {
      // Pre-Boss: Linear interpolation
      const t = easeInOutSine(clamp01(progress));
      interval = lerp(start, end, t);
    } else {
      // Endless: Exponential decay towards minimum
      const endlessProgress = progress - 1.0;
      const range = end - MINIMAL_SPAWN_INTERVAL;
      interval = MINIMAL_SPAWN_INTERVAL + range * Math.exp(-endlessDecay * endlessProgress);
    }

    return Math.max(interval, MINIMAL_SPAWN_INTERVAL);
  }

  getBossSpawnTime() {
    return this.config.bossSpawnTime;
  }
}