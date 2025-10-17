// utils/difficultyController.js

import { lerp, easeInOutSine, clamp01 } from './mathUtils.js';

export class DifficultyController {
  constructor(config) {
    if (!config) {
      throw new Error("DifficultyController requires a configuration object.");
    }
    this.config = config;
  }

  scaleStat(baseValue, progress) {
    let multiplier;
    if (progress <= 1.0) {
      // --- Pre-Boss Scaling ---
      // Linearly interpolates the multiplier from start to end over the course of the pre-boss phase.
      const t = easeInOutSine(clamp01(progress));
      multiplier = lerp(
        this.config.enemyStatMultiplier.start,
        this.config.enemyStatMultiplier.end,
        t
      );
    } else {
      // --- Endless Mode Scaling ---
      // 'endlessProgress' tracks time *since* endless mode began (starts at 0).
      const endlessProgress = progress - 1.0;
      
      // Uses the *final* multiplier from the pre-boss phase as our starting point.
      // This ensures a seamless, continuous transition with no difficulty drop.
      const baseMultiplier = this.config.enemyStatMultiplier.end;
      const rate = this.config.endlessScaling.statMultiplierRate;
      
      // The exponential growth is applied *on top of* the final pre-boss multiplier.
      multiplier = baseMultiplier * Math.pow(1 + endlessProgress, rate);
    }
    return baseValue * multiplier;
  }

  getSpawnInterval(progress) {
    let interval;
    const MINIMAL_SPAWN_INTERVAL = 0.05; 

    if (progress <= 1.0) {
      // --- Pre-Boss Scaling ---
      // Linearly interpolates the interval from its starting value down to its end value.
      const t = easeInOutSine(clamp01(progress));
      interval = lerp(
        this.config.spawnInterval.start,
        this.config.spawnInterval.end,
        t
      );
    } else {
      // --- Endless Mode Scaling ---
      const endlessProgress = progress - 1.0;
      
      // Uses the *final* spawn interval from the pre-boss phase as our starting point for the decay.
      // This ensures a seamless transition where the spawn rate doesn't suddenly reset or jump.
      const baseInterval = this.config.spawnInterval.end;
      const decay = this.config.endlessScaling.spawnIntervalDecay;

      // The interval decays exponentially from the 'baseInterval' towards the absolute minimum.
      const range = baseInterval - MINIMAL_SPAWN_INTERVAL;
      interval = MINIMAL_SPAWN_INTERVAL + range * Math.exp(-decay * endlessProgress);
    }
    
    // Enforce the hard cap at all times.
    return Math.max(interval, MINIMAL_SPAWN_INTERVAL);
  }

  getBossSpawnTime() {
    return this.config.bossSpawnTime;
  }
}