/**components/enemy/boss/bossConfig.js
 * @file Contains all configuration data for the final boss.
 */

// --- Core Durations and Multipliers ---
export const CHARGE_WINDUP_DURATION = 1.0;
export const CHARGE_MOVE_DURATION = 0.6;
export const CHARGE_SPEED_MULTIPLIER = 6;
export const VULNERABILITY_DURATION = 1.5;
export const VULNERABILITY_DAMAGE_MULTIPLIER = 2;


// --- Centralized Boss Configuration Object ---
export const BOSS_CONFIG = {
  cooldowns: {
    summon: 9,
    spreadShot: 2, // Renamed from "shoot" to match the ability name
    charge: 7,
  },

  // Visual parameters for telegraphing actions.
  telegraphs: {
    summon:     { color: [0, 200, 0],   duration: 0.4 },
    spreadShot: { color: [200, 100, 0], duration: 0.25 },
    charge:     { color: [200, 0, 0],   duration: CHARGE_WINDUP_DURATION },
    vulnerable: { color: [255, 255, 100] },
  },

  // Defines the boss's attributes and available abilities for each phase.
  phases: {
    1: {
      color: [60, 20, 20],
      speedMultiplier: 1.0,
      abilities: {
        summon: { minionType: "normal", count: 3 },
        charge: true,
      },
    },
    2: {
      color: [60, 40, 20],
      speedMultiplier: 1.05,
      abilities: {
        summon: { minionType: "normal", count: 4 },
        spreadShot: { damage: 1, speed: 300, count: 12 },
        charge: true,
      },
    },
    3: {
      color: [40, 20, 60],
      speedMultiplier: 1.1,
      abilities: {
        summon: { minionType: "normal", count: 5 },
        spreadShot: { damage: 1, speed: 300, count: 18 },
        charge: true,
      },
    },
  },
};