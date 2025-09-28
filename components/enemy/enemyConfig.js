// components/enemy/enemyConfig.js
export const ENEMY_CONFIGS = {
  normal: {
    name: "normal",
    score: 2,
    spawnWeightStart: 80,      
    spawnWeightEnd: 30,        
    color: [245, 74, 74], size: 32,
    maxHp: 4, speed: 100, damage: 1, rarity: 0,
  },

  fast: {
    name: "fast",
    score: 3,
    spawnWeightStart: 15,
    spawnWeightEnd: 22,      
    color: [248, 175, 39], size: 28,
    maxHp: 2, speed: 180, damage: 1, rarity: 1,
    hasBody: false, opacity: 0.7,
  },

  tank: {
    name: "tank",
    score: 4,
    spawnWeightStart: 10,
    spawnWeightEnd: 20,        
    color: [100, 100, 255], size: 40,
    maxHp: 8, speed: 60, damage: 2, rarity: 2,
  },

  rageTank: {
    name: "rageTank",
    score: 6,
    spawnWeightStart: 3,
    spawnWeightEnd: 8,       
    color: [153, 36, 27], size: 36,
    maxHp: 9, speed: 60, damage: 2, rarity: 3,
  },

  spawner: {
    name: "spawner",
    score: 8,
    spawnWeightStart: 7,
    spawnWeightEnd: 11,       
    color: [200, 50, 150], size: 36,
    maxHp: 6, speed: 55, damage: 1, rarity: 2,
  },

  small: {
    name: "small",
    score: 1,
    spawnWeightStart: 0,       // never picked by random picker
    spawnWeightEnd: 0,
    color: [220, 220, 220], size: 16,
    maxHp: 1, speed: 140, damage: 1, rarity: 0,
    hasBody: false, opacity: 1,
  },

  sniper: {
    name: "sniper",
    score: 6,
    spawnWeightStart: 4,
    spawnWeightEnd: 8,       
    color: [120, 40, 200], size: 30,
    maxHp: 5, speed: 120, damage: 1, rarity: 1,
  },

  miniboss: {
    name: "miniboss",
    score: 30, spawnWeightStart: 0, spawnWeightEnd: 0,
    color: [140,40,140], size: 50,
    maxHp: 40, speed: 75, damage: 2, rarity: 98,
  },

  boss: {
    name: "boss",
    score: 50, spawnWeightStart: 0, spawnWeightEnd: 0,
    color: [60,20,20], size: 80,
    maxHp: 300, speed: 80, damage: 3, rarity: 99,
  },
};
