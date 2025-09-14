/**
 * @file Defines the configuration for all enemy types and their spawn rarity.
 */

/**
 * Holds all enemy configurations. Bosses have a spawnWeight of 0
 * to ensure they are only spawned intentionally, not through the random picker.
 * @type {Object<string, EnemyConfig>}
 */
export const ENEMY_CONFIGS = {
  normal: {
    name: "normal",
    score: 2, spawnWeight: 80, color: [245, 74, 74], size: 32,
    maxHp: 4, speed: 100, damage: 1, rarity: 0,
  },
  fast: {
    name: "fast",
    score: 3, spawnWeight: 15, color: [248, 175, 39], size: 28,
    maxHp: 2, speed: 180, damage: 1, rarity: 1,
    hasBody: false,  
    opacity: 0.7,     
  },
  tank: {
    name: "tank",
    score: 4, spawnWeight: 10, color: [100, 100, 255], size: 40,
    maxHp: 8, speed: 60, damage: 3, rarity: 2,
  },
  rageTank: {
    name:"rageTank",
    score: 6, spawnWeight: 3, color: [153, 36, 27], size: 36,
    maxHp: 10, speed: 60, damage: 2, rarity: 3,
  },
  boss: {
    name :"boss",
    score: 20, spawnWeight: 0, color: [60, 20, 20], size: 80,
    maxHp: 300, speed: 80, damage: 3, rarity: 99,
  },
};

/**
 * Defines how much to bias spawn weights based on game progress.
 * The index corresponds to an enemy's `rarity` property.
 * A value of `1.0` means the spawn weight is multiplied by `1 + 1.0 = 2` (doubled)
 * at maximum game progress.
 */
export const RARITY_SPAWN_BIAS = [-0.5, 0.3, 0.4, 1.2];