//components/utils/difficultySettings.js
export const DIFFICULTY = {
  easy: {
    enemySpeed: 0.9,
    enemyHp: 0.85,
    enemyDamage: 0.8,
    spawnInterval: 1.2,
    playerDamage: 1.1,
    playerSpeed: 1.05,
    playerHp: 1.15
  },
  normal: {
    enemySpeed: 1,
    enemyHp: 1,
    enemyDamage: 1,
    spawnInterval: 1,
    playerDamage: 1,
    playerSpeed: 1,
    playerHp: 1
  },
  hard: {
    enemySpeed: 1.15,
    enemyHp: 1.2,
    enemyDamage: 1.15,
    spawnInterval: 0.85,
    playerDamage: 0.9,
    playerSpeed: 0.95,
    playerHp: 0.9
  }
};
